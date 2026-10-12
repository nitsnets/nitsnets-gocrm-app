<?php

namespace Tests\Feature;

use App\Models\Record;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class GoogleLoginTest extends TestCase
{
    use RefreshDatabase;

    private static string $privateKey = '';

    private static array $jwk;

    private string $verifier;

    private User $user;

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, self::$privateKey);
        $details = openssl_pkey_get_details($key);
        self::$jwk = ['kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'kid' => 'test-key', 'n' => self::base64url($details['rsa']['n']), 'e' => self::base64url($details['rsa']['e'])];
    }

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->seed();
        $this->user = User::where('email', 'eladio@nitsnets.demo')->firstOrFail();
        $this->user->update(['email' => 'eladio@gmail.com']);
        $this->verifier = str_repeat('v', 64);
        config(['google_login.client_id' => 'login-client', 'google_login.client_secret' => 'login-secret', 'google_login.redirect_uri' => 'http://127.0.0.1:8000/api/v1/auth/google/callback', 'google_login.web_return_uri' => 'http://127.0.0.1:3000/api/auth/google/callback', 'google_login.ios_return_uri' => 'com.nitsnets.crm://oauth/google']);
        Http::preventStrayRequests();
    }

    private static function base64url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function start(string $client = 'web'): array
    {
        $data = $this->postJson('/api/v1/auth/google/start', ['client' => $client, 'code_challenge' => self::base64url(hash('sha256', $this->verifier, true))])->assertOk()->json('data');
        parse_str(parse_url($data['authorization_url'], PHP_URL_QUERY), $data['parameters']);

        return $data;
    }

    private function claims(array $flow, array $override = []): array
    {
        return array_merge(['iss' => 'https://accounts.google.com', 'aud' => 'login-client', 'azp' => 'login-client', 'exp' => time() + 3600, 'iat' => time() - 1, 'nonce' => $flow['parameters']['nonce'], 'sub' => 'google-user-123', 'email' => $this->user->email, 'email_verified' => true], $override);
    }

    private function fakeProvider(array $claims, ?string $jwt = null): void
    {
        Http::swap(new Factory);
        Http::preventStrayRequests();
        $jwt ??= JWT::encode($claims, self::$privateKey, 'RS256', 'test-key');
        Http::fake(['https://oauth2.googleapis.com/token' => Http::response(['id_token' => $jwt, 'access_token' => 'discard-me']), 'https://www.googleapis.com/oauth2/v3/certs' => Http::response(['keys' => [self::$jwk]], 200, ['Cache-Control' => 'public, max-age=3600'])]);
    }

    private function finishOAuth(array $flow, string $suffix = '&code=google-code'): array
    {
        $response = $this->get('/api/v1/auth/google/callback?state='.$flow['state'].$suffix)->assertRedirect();
        parse_str(parse_url($response->headers->get('Location'), PHP_URL_QUERY), $params);

        return ['response' => $response, 'params' => $params];
    }

    public function test_google_login_issues_same_session_shape_without_tokens_in_redirect_and_uses_provider_pkce(): void
    {
        $this->getJson('/api/v1/auth/google')->assertOk()->assertJsonPath('data.configured', true);
        $flow = $this->start();
        $this->assertSame('openid email profile', $flow['parameters']['scope']);
        $this->assertSame('S256', $flow['parameters']['code_challenge_method']);
        $state = Record::table('google_login_states')->first();
        $providerVerifier = Crypt::decryptString($state->code_verifier);
        $this->assertNotSame($this->verifier, $providerVerifier);
        $this->assertSame(self::base64url(hash('sha256', $providerVerifier, true)), $flow['parameters']['code_challenge']);
        $this->assertNotSame($flow['state'], $state->state_hash);
        $this->fakeProvider($this->claims($flow));
        $callback = $this->finishOAuth($flow);
        $this->assertSame($flow['state'], $callback['params']['state']);
        $this->assertStringStartsWith('http://127.0.0.1:3000/api/auth/google/callback?', $callback['response']->headers->get('Location'));
        $this->assertArrayNotHasKey('token', $callback['params']);
        $this->assertDatabaseCount('api_sessions', 0);
        $this->assertDatabaseCount('gmail_connections', 0);
        $this->assertDatabaseHas('google_identities', ['user_id' => $this->user->id, 'subject' => 'google-user-123']);
        $login = $this->postJson('/api/v1/auth/google/exchange', ['code' => $callback['params']['code'], 'code_verifier' => $this->verifier])->assertOk()->assertJsonStructure(['data' => ['token', 'user' => ['id', 'name', 'email'], 'workspace' => ['id', 'name'], 'workspaces']])->assertJsonPath('data.user.id', $this->user->id)->json('data');
        $this->getJson('/api/v1/me', ['Authorization' => 'Bearer '.$login['token']])->assertOk();
        $this->assertDatabaseMissing('api_sessions', ['token_hash' => $login['token']]);
        $this->assertDatabaseCount('google_login_handoffs', 0);
        Http::assertSent(fn ($request) => $request->url() === 'https://oauth2.googleapis.com/token' && $request['code_verifier'] === $providerVerifier && $request['redirect_uri'] === config('google_login.redirect_uri'));
    }

    public function test_ios_uses_fixed_return_uri_and_input_cannot_override_redirect(): void
    {
        $this->postJson('/api/v1/auth/google/start', ['client' => 'ios', 'code_challenge' => self::base64url(hash('sha256', $this->verifier, true)), 'redirect_uri' => 'https://evil.example'])->assertUnprocessable();
        $flow = $this->start('ios');
        $this->fakeProvider($this->claims($flow));
        $response = $this->finishOAuth($flow);
        $this->assertStringStartsWith('com.nitsnets.crm://oauth/google?', $response['response']->headers->get('Location'));
    }

    public function test_unconfigured_and_bad_client_challenge_are_explicit(): void
    {
        config(['google_login.client_id' => null, 'google_login.client_secret' => null]);
        $this->getJson('/api/v1/auth/google')->assertJsonPath('data.configured', false);
        $this->postJson('/api/v1/auth/google/start', ['client' => 'web', 'code_challenge' => self::base64url(hash('sha256', $this->verifier, true))])->assertStatus(503)->assertJsonPath('error.code', 'google_login_not_configured');
        $this->postJson('/api/v1/auth/google/start', ['client' => 'evil', 'code_challenge' => 'short'])->assertUnprocessable();
    }

    public function test_state_and_handoff_are_single_use_and_wrong_verifier_cannot_exchange(): void
    {
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow));
        $callback = $this->finishOAuth($flow);
        $this->getJson('/api/v1/auth/google/callback?state='.$flow['state'].'&code=google-code')->assertStatus(400)->assertJsonPath('error.code', 'invalid_oauth_state');
        $code = $callback['params']['code'];
        $this->postJson('/api/v1/auth/google/exchange', ['code' => $code, 'code_verifier' => str_repeat('x', 64)])->assertStatus(400);
        $this->assertDatabaseCount('api_sessions', 0);
        $this->postJson('/api/v1/auth/google/exchange', ['code' => $code, 'code_verifier' => $this->verifier])->assertOk();
        $this->postJson('/api/v1/auth/google/exchange', ['code' => $code, 'code_verifier' => $this->verifier])->assertStatus(400);
        $this->assertDatabaseCount('api_sessions', 1);
    }

    public function test_expired_state_handoff_and_unknown_state_fail_closed(): void
    {
        $flow = $this->start();
        Record::table('google_login_states')->update(['expires_at' => now()->subSecond()]);
        $this->getJson('/api/v1/auth/google/callback?state='.$flow['state'].'&code=abc')->assertStatus(400);
        $this->getJson('/api/v1/auth/google/callback?state='.str_repeat('a', 64).'&code=abc')->assertStatus(400);
        Http::assertNothingSent();
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow));
        $callback = $this->finishOAuth($flow);
        Record::table('google_login_handoffs')->update(['expires_at' => now()->subSecond()]);
        $this->postJson('/api/v1/auth/google/exchange', ['code' => $callback['params']['code'], 'code_verifier' => $this->verifier])->assertStatus(400);
        $this->assertDatabaseCount('api_sessions', 0);
    }

    public function test_provider_denial_and_failure_return_only_safe_errors_and_consume_state(): void
    {
        $flow = $this->start();
        $result = $this->finishOAuth($flow, '&error=access_denied');
        $this->assertSame(['error' => 'access_denied', 'state' => $flow['state']], $result['params']);
        Http::assertNothingSent();
        $flow = $this->start();
        Http::fake(['https://oauth2.googleapis.com/token' => Http::response(['error' => 'invalid_grant', 'secret' => 'sensitive'], 400)]);
        $result = $this->finishOAuth($flow);
        $this->assertSame(['error' => 'provider_error', 'state' => $flow['state']], $result['params']);
        $this->assertDatabaseCount('google_login_states', 0);
        $this->assertDatabaseCount('api_sessions', 0);
    }

    public static function invalidClaims(): array
    {
        return ['issuer' => [['iss' => 'https://evil.example']], 'audience' => [['aud' => 'other-client']], 'authorized-party' => [['azp' => 'other-client']], 'expired' => [['exp' => 1]], 'future-issued' => [['iat' => 4102444800]], 'nonce' => [['nonce' => 'wrong']], 'unverified-email' => [['email_verified' => false]], 'missing-subject' => [['sub' => '']], 'malformed-email' => [['email' => 'not-email']], 'multi-audience' => [['aud' => ['login-client', 'evil']]]];
    }

    #[DataProvider('invalidClaims')]
    public function test_invalid_signed_claims_never_issue_session(array $override): void
    {
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow, $override));
        $result = $this->finishOAuth($flow);
        $this->assertSame('provider_error', $result['params']['error']);
        $this->assertDatabaseCount('google_identities', 0);
        $this->assertDatabaseCount('google_login_handoffs', 0);
        $this->assertDatabaseCount('api_sessions', 0);
    }

    public function test_wrong_signature_and_algorithm_cannot_authenticate(): void
    {
        $flow = $this->start();
        $jwt = JWT::encode($this->claims($flow), str_repeat('s', 64), 'HS256', 'test-key');
        $this->fakeProvider([], $jwt);
        $result = $this->finishOAuth($flow);
        $this->assertSame('provider_error', $result['params']['error']);
        $flow = $this->start();
        $jwt = JWT::encode($this->claims($flow), self::$privateKey, 'RS256', 'test-key');
        $parts = explode('.', $jwt);
        $parts[2] = self::base64url(str_repeat('x', 256));
        $this->fakeProvider([], implode('.', $parts));
        $this->assertSame('provider_error', $this->finishOAuth($flow)['params']['error']);
        $this->assertDatabaseCount('api_sessions', 0);
    }

    public function test_unknown_user_or_membership_removal_cannot_create_account_or_session(): void
    {
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow, ['email' => 'unknown@gmail.com']));
        $this->assertSame('not_allowed', $this->finishOAuth($flow)['params']['error']);
        $this->assertDatabaseCount('users', 3);
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow));
        $result = $this->finishOAuth($flow);
        Record::table('memberships')->where('user_id', $this->user->id)->delete();
        $this->postJson('/api/v1/auth/google/exchange', ['code' => $result['params']['code'], 'code_verifier' => $this->verifier])->assertForbidden();
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow));
        $this->assertSame('not_allowed', $this->finishOAuth($flow)['params']['error']);
        $this->assertDatabaseCount('api_sessions', 0);
    }

    public function test_external_email_first_link_requires_google_hosted_domain_authority(): void
    {
        $this->user->update(['email' => 'eladio@example.com']);
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow));
        $this->assertSame('not_allowed', $this->finishOAuth($flow)['params']['error']);
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow, ['hd' => 'other.example']));
        $this->assertSame('not_allowed', $this->finishOAuth($flow)['params']['error']);
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow, ['hd' => 'example.com']));
        $this->assertArrayHasKey('code', $this->finishOAuth($flow)['params']);
        $this->assertDatabaseCount('google_identities', 1);
    }

    public function test_linked_identity_is_stable_by_subject_and_different_subject_cannot_take_over(): void
    {
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow));
        $this->finishOAuth($flow);
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow, ['email' => 'changed@external.example']));
        $result = $this->finishOAuth($flow);
        $this->postJson('/api/v1/auth/google/exchange', ['code' => $result['params']['code'], 'code_verifier' => $this->verifier])->assertOk()->assertJsonPath('data.user.id', $this->user->id);
        $flow = $this->start();
        $this->fakeProvider($this->claims($flow, ['sub' => 'different-subject']));
        $this->assertSame('not_allowed', $this->finishOAuth($flow)['params']['error']);
        $this->assertDatabaseCount('google_identities', 1);
    }

    public function test_jwks_key_rotation_refreshes_cache_and_unknown_kid_fails_closed(): void
    {
        $flow = $this->start();
        Cache::put('google_login:jwks:v1', ['keys' => [array_merge(self::$jwk, ['kid' => 'old'])]], 3600);
        $this->fakeProvider($this->claims($flow));
        $this->assertArrayHasKey('code', $this->finishOAuth($flow)['params']);
        $flow = $this->start();
        $this->fakeProvider([], JWT::encode($this->claims($flow), self::$privateKey, 'RS256', 'unknown'));
        $this->assertSame('provider_error', $this->finishOAuth($flow)['params']['error']);
    }
}
