<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Jobs\SyncGmail;
use App\Models\Record;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class GmailController extends Controller
{
    public function status(Request $r): JsonResponse
    {
        $c = $this->connection($r);

        return response()->json(['data' => ['configured' => $this->configured(), 'connected' => (bool) $c, 'email' => $c?->email, 'last_synced_at' => $c?->last_synced_at, 'status' => $c?->status ?? ($this->configured() ? 'disconnected' : 'not_configured')]]);
    }

    public function connect(Request $r): JsonResponse
    {
        abort_unless($this->configured(), 503);
        $input = $r->validate(['client' => 'sometimes|in:web,ios']);
        $state = bin2hex(random_bytes(32));
        $verifier = bin2hex(random_bytes(32));
        Record::table('oauth_states')->where('expires_at', '<', now())->delete();
        Record::table('oauth_states')->create(['workspace_id' => $r->attributes->get('api_session')->workspace_id, 'user_id' => $r->user()->id, 'client' => $input['client'] ?? 'web', 'state_hash' => hash('sha256', $state), 'code_verifier' => Crypt::encryptString($verifier), 'expires_at' => now()->addMinutes(10)]);
        $url = 'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query(['client_id' => config('gmail.client_id'), 'redirect_uri' => config('gmail.redirect_uri'), 'response_type' => 'code', 'scope' => 'https://www.googleapis.com/auth/gmail.readonly', 'access_type' => 'offline', 'prompt' => 'consent', 'state' => $state, 'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='), 'code_challenge_method' => 'S256']);

        return response()->json(['data' => ['authorization_url' => $url, 'state' => $state]]);
    }

    public function callback(Request $r): RedirectResponse
    {
        $r->validate(['state' => 'required|string|max:200', 'code' => 'required_without:error|string|max:3000', 'error' => 'required_without:code|string|max:200']);
        $state = DB::transaction(function () use ($r) {
            $s = Record::table('oauth_states')->where('state_hash', hash('sha256', $r->input('state')))->where('expires_at', '>', now())->lockForUpdate()->first();
            abort_unless($s, 400, 'El estado OAuth no es válido o ya se ha utilizado.');
            $s->delete();

            return $s;
        });
        abort_unless(Record::table('memberships')->where('user_id', $state->user_id)->where('workspace_id', $state->workspace_id)->exists(), 403);
        if ($r->has('error')) {
            return $this->returnToClient($state, $r->input('state'), 'cancelled');
        }
        try {
            $tokens = Http::asForm()->timeout(20)->post('https://oauth2.googleapis.com/token', ['client_id' => config('gmail.client_id'), 'client_secret' => config('gmail.client_secret'), 'redirect_uri' => config('gmail.redirect_uri'), 'grant_type' => 'authorization_code', 'code' => $r->input('code'), 'code_verifier' => Crypt::decryptString($state->code_verifier)]);
            if (! $tokens->successful() || ! $tokens->json('access_token') || ! $tokens->json('refresh_token')) {
                return $this->returnToClient($state, $r->input('state'), 'error');
            }
            $profile = Http::withToken($tokens->json('access_token'))->timeout(20)->get('https://gmail.googleapis.com/gmail/v1/users/me/profile');
            if (! $profile->successful() || ! $profile->json('emailAddress')) {
                return $this->returnToClient($state, $r->input('state'), 'error');
            }
        } catch (\Throwable) {
            return $this->returnToClient($state, $r->input('state'), 'error');
        }
        $email = strtolower($profile->json('emailAddress'));
        $existing = Record::table('gmail_connections')->where('workspace_id', $state->workspace_id)->where('user_id', $state->user_id)->first();
        if ($existing && $existing->email !== $email) {
            return $this->returnToClient($state, $r->input('state'), 'account_mismatch');
        }
        $connection = Record::table('gmail_connections')->updateOrCreate(['workspace_id' => $state->workspace_id, 'user_id' => $state->user_id], ['email' => $email, 'access_token' => Crypt::encryptString($tokens->json('access_token')), 'refresh_token' => Crypt::encryptString($tokens->json('refresh_token')), 'expires_at' => now()->addSeconds($tokens->json('expires_in', 3600)), 'history_id' => null, 'status' => 'queued', 'last_synced_at' => null]);
        SyncGmail::dispatch($connection->id);

        return $this->returnToClient($state, $r->input('state'), 'connected');
    }

    private function returnToClient(Record $state, string $nonce, string $result): RedirectResponse
    {
        if ($state->client === 'ios') {
            return redirect()->away('com.nitsnets.crm://oauth/gmail?'.http_build_query(['state' => $nonce, 'gmail' => $result]));
        }
        $returnUri = config('gmail.frontend_url');

        return redirect()->away($returnUri.(str_contains($returnUri, '?') ? '&' : '?').'gmail='.$result);
    }

    public function sync(Request $r): JsonResponse
    {
        $c = $this->connection($r);
        if (! $c) {
            throw new ApiException(409, 'integration_not_connected', 'Conecta primero Gmail.');
        }
        if ($c->status === 'reauthorization_required') {
            throw new ApiException(409, 'integration_reauthorization_required', 'Vuelve a conectar Gmail para renovar el permiso.');
        }
        Record::table('gmail_connections')->whereKey($c->id)->where('status', '!=', 'syncing')->update(['status' => 'queued']);
        SyncGmail::dispatch($c->id);

        return response()->json(['data' => ['status' => 'queued']], 202);
    }

    public function disconnect(Request $r): Response
    {
        $c = $this->connection($r);
        if ($c) {
            $c->delete();
        }

        return response()->noContent();
    }

    private function connection(Request $r): ?Record
    {
        return Record::table('gmail_connections')->where('workspace_id', $r->attributes->get('api_session')->workspace_id)->where('user_id', $r->user()->id)->first();
    }

    private function configured(): bool
    {
        return (bool) (config('gmail.client_id') && config('gmail.client_secret'));
    }
}
