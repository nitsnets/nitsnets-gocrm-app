<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Record;
use App\Models\User;
use App\Services\GoogleIdentityVerifier;
use App\Services\SessionIssuer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use stdClass;
use Throwable;

class GoogleLoginController extends Controller
{
    public function status(): JsonResponse
    {
        return response()->json(['data' => ['configured' => $this->configured()]]);
    }

    public function start(Request $request): JsonResponse
    {
        $input = $this->validateInput($request, ['client' => 'required|in:web,ios', 'code_challenge' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{43}$/D']]);
        if (! $this->configured()) {
            throw new ApiException(503, 'google_login_not_configured', 'El acceso con Google no está configurado.');
        }
        $state = bin2hex(random_bytes(32));
        $nonce = bin2hex(random_bytes(32));
        $verifier = bin2hex(random_bytes(32));
        Record::table('google_login_states')->where('expires_at', '<', now())->delete();
        Record::table('google_login_handoffs')->where('expires_at', '<', now())->delete();
        Record::table('google_login_states')->create([
            'state_hash' => hash('sha256', $state),
            'nonce_hash' => hash('sha256', $nonce),
            'code_verifier' => Crypt::encryptString($verifier),
            'client' => $input['client'],
            'client_challenge' => $input['code_challenge'],
            'expires_at' => now()->addMinutes(10),
        ]);
        $authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query([
            'client_id' => config('google_login.client_id'),
            'redirect_uri' => config('google_login.redirect_uri'),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'nonce' => $nonce,
            'code_challenge' => $this->challenge($verifier),
            'code_challenge_method' => 'S256',
            'prompt' => 'select_account',
        ]);

        return response()->json(['data' => ['authorization_url' => $authorizationUrl, 'state' => $state]]);
    }

    public function callback(Request $request, GoogleIdentityVerifier $verifier): RedirectResponse
    {
        $rawState = $request->query('state');
        if (! is_string($rawState) || ! preg_match('/^[a-f0-9]{64}$/D', $rawState)) {
            throw new ApiException(400, 'invalid_oauth_state', 'El estado de acceso no es válido o ha caducado.');
        }
        $state = DB::transaction(function () use ($rawState) {
            $state = Record::table('google_login_states')->where('state_hash', hash('sha256', $rawState))->where('expires_at', '>', now())->lockForUpdate()->first();
            if (! $state) {
                throw new ApiException(400, 'invalid_oauth_state', 'El estado de acceso no es válido o ha caducado.');
            }
            $state->delete();

            return $state;
        });
        if ($request->has('error')) {
            return $this->returnToClient($state->client, ['error' => $request->query('error') === 'access_denied' ? 'access_denied' : 'provider_error', 'state' => $rawState]);
        }
        try {
            $code = $request->query('code');
            if (! is_string($code) || $code === '' || strlen($code) > 4096 || ! $this->configured()) {
                throw new \RuntimeException('Google authorization code missing.');
            }
            $tokenResponse = Http::asForm()->timeout(20)->post('https://oauth2.googleapis.com/token', [
                'client_id' => config('google_login.client_id'),
                'client_secret' => config('google_login.client_secret'),
                'redirect_uri' => config('google_login.redirect_uri'),
                'grant_type' => 'authorization_code',
                'code' => $code,
                'code_verifier' => Crypt::decryptString($state->code_verifier),
            ]);
            if (! $tokenResponse->successful() || ! is_string($tokenResponse->json('id_token'))) {
                throw new \RuntimeException('Google token exchange failed.');
            }
            $claims = $verifier->verify($tokenResponse->json('id_token'), $state->nonce_hash);
            $user = $this->resolveUser($claims);
            $handoff = bin2hex(random_bytes(32));
            Record::table('google_login_handoffs')->create(['user_id' => $user->id, 'code_hash' => hash('sha256', $handoff), 'client_challenge' => $state->client_challenge, 'expires_at' => now()->addSeconds(60)]);

            return $this->returnToClient($state->client, ['code' => $handoff, 'state' => $rawState]);
        } catch (ApiException $exception) {
            return $this->returnToClient($state->client, ['error' => $exception->errorCode === 'google_login_not_allowed' ? 'not_allowed' : 'provider_error', 'state' => $rawState]);
        } catch (Throwable) {
            Log::warning('google_login.provider_error');

            return $this->returnToClient($state->client, ['error' => 'provider_error', 'state' => $rawState]);
        }
    }

    public function exchange(Request $request, SessionIssuer $issuer): JsonResponse
    {
        $input = $this->validateInput($request, ['code' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/D'], 'code_verifier' => ['required', 'string', 'regex:/^[A-Za-z0-9._~-]{43,128}$/D']]);
        $session = DB::transaction(function () use ($input, $issuer) {
            $handoff = Record::table('google_login_handoffs')->where('code_hash', hash('sha256', $input['code']))->where('expires_at', '>', now())->lockForUpdate()->first();
            if (! $handoff || ! hash_equals($handoff->client_challenge, $this->challenge($input['code_verifier']))) {
                throw new ApiException(400, 'invalid_login_code', 'El código de acceso no es válido o ha caducado.');
            }
            $user = User::find($handoff->user_id);
            if (! $user || ! Record::table('memberships')->where('user_id', $user->id)->exists()) {
                throw new ApiException(403, 'google_login_not_allowed', 'La cuenta no tiene acceso a ninguna empresa.');
            }
            $handoff->delete();

            return $issuer->issue($user);
        });

        return response()->json(['data' => $session]);
    }

    private function resolveUser(stdClass $claims): User
    {
        return DB::transaction(function () use ($claims) {
            $identity = Record::table('google_identities')->where('subject', $claims->sub)->first();
            if ($identity) {
                $user = User::whereKey($identity->user_id)->lockForUpdate()->first();
            } else {
                $email = strtolower($claims->email);
                $domain = substr(strrchr($email, '@'), 1);
                $authoritative = in_array($domain, ['gmail.com', 'googlemail.com'], true) || (is_string($claims->hd ?? null) && strtolower($claims->hd) === $domain);
                $user = $authoritative ? User::where('email', $email)->lockForUpdate()->first() : null;
                if ($user && Record::table('google_identities')->where('user_id', $user->id)->where('subject', '!=', $claims->sub)->exists()) {
                    $user = null;
                }
            }
            if (! $user || ! Record::table('memberships')->where('user_id', $user->id)->exists()) {
                throw new ApiException(403, 'google_login_not_allowed', 'La cuenta no está autorizada para este CRM.');
            }
            if (! $identity) {
                $linked = Record::table('google_identities')->firstOrCreate(['subject' => $claims->sub], ['user_id' => $user->id]);
                if ($linked->user_id !== $user->id) {
                    throw new ApiException(403, 'google_login_not_allowed', 'La identidad ya está vinculada a otra cuenta.');
                }
            }

            return $user;
        });
    }

    private function returnToClient(string $client, array $parameters): RedirectResponse
    {
        $uri = config('google_login.'.$client.'_return_uri');

        return redirect()->away($uri.(str_contains($uri, '?') ? '&' : '?').http_build_query($parameters));
    }

    private function challenge(#[\SensitiveParameter] string $verifier): string
    {
        return rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    }

    private function configured(): bool
    {
        return (bool) (config('google_login.client_id') && config('google_login.client_secret'));
    }
}
