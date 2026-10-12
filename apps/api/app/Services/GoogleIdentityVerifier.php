<?php

namespace App\Services;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use stdClass;
use Throwable;

class GoogleIdentityVerifier
{
    private const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

    private const CACHE_KEY = 'google_login:jwks:v1';

    public function verify(#[\SensitiveParameter] string $idToken, string $nonceHash): stdClass
    {
        try {
            $parts = explode('.', $idToken);
            if (count($parts) !== 3) {
                throw new RuntimeException;
            }
            $header = JWT::jsonDecode(JWT::urlsafeB64Decode($parts[0]));
            if (($header->alg ?? null) !== 'RS256' || ! is_string($header->kid ?? null) || strlen($header->kid) > 255) {
                throw new RuntimeException;
            }
            $keys = $this->keys();
            if (! isset($keys[$header->kid])) {
                $keys = $this->keys(true);
            }
            $claims = JWT::decode($idToken, $keys);
            $clientId = config('google_login.client_id');
            if (! in_array($claims->iss ?? null, ['accounts.google.com', 'https://accounts.google.com'], true)
                || ($claims->aud ?? null) !== $clientId
                || (isset($claims->azp) && $claims->azp !== $clientId)
                || ! is_int($claims->exp ?? null) || $claims->exp <= time()
                || ! is_int($claims->iat ?? null) || $claims->iat > time()
                || ! is_string($claims->nonce ?? null) || ! hash_equals($nonceHash, hash('sha256', $claims->nonce))
                || ($claims->email_verified ?? null) !== true
                || ! is_string($claims->sub ?? null) || $claims->sub === '' || strlen($claims->sub) > 255
                || ! is_string($claims->email ?? null) || ! filter_var($claims->email, FILTER_VALIDATE_EMAIL)
            ) {
                throw new RuntimeException;
            }

            return $claims;
        } catch (Throwable) {
            throw new RuntimeException('Google identity verification failed.');
        }
    }

    private function keys(bool $refresh = false): array
    {
        if ($refresh) {
            Cache::forget(self::CACHE_KEY);
        }
        $jwks = Cache::get(self::CACHE_KEY);
        if (! is_array($jwks)) {
            $response = Http::acceptJson()->timeout(15)->get(self::JWKS_URL);
            if (! $response->successful() || ! is_array($response->json('keys'))) {
                throw new RuntimeException('Google signing keys unavailable.');
            }
            $jwks = ['keys' => array_values(array_filter($response->json('keys'), fn ($key) => is_array($key) && ($key['kty'] ?? null) === 'RSA' && ($key['alg'] ?? 'RS256') === 'RS256' && ($key['use'] ?? 'sig') === 'sig'))];
            preg_match('/max-age=(\d+)/', $response->header('Cache-Control') ?? '', $matches);
            Cache::put(self::CACHE_KEY, $jwks, min(86400, max(60, (int) ($matches[1] ?? 3600))));
        }

        return JWK::parseKeySet($jwks, 'RS256');
    }
}
