<?php

namespace App\Services;

use App\Exceptions\ApiException;
use Illuminate\Support\Facades\Http;

/**
 * Checks a Google ID token from "Continue with Google" (the website's Google
 * button or the Android app's native Google sign-in) and returns who it is.
 *
 * Uses Google's tokeninfo endpoint, so no extra package is needed. The token
 * is accepted only if Google issued it for one of our OAuth client ids
 * (GOOGLE_CLIENT_IDS), it hasn't expired and the email is verified.
 */
class GoogleTokenVerifier
{
    /** @return array{sub: string, email: string, name: string} */
    public static function verify(string $idToken): array
    {
        $clientIds = config('services.google.client_ids', []);
        if (empty($clientIds)) {
            throw ApiException::unprocessable('Google sign-in is not set up yet. Use your email and password.');
        }

        try {
            $res = Http::timeout(15)->get(config('services.google.tokeninfo_url'), ['id_token' => $idToken]);
        } catch (\Throwable) {
            throw ApiException::unprocessable('Could not reach Google. Please try again.');
        }

        $info = $res->json() ?? [];
        $issuer = $info['iss'] ?? '';
        $valid = $res->successful()
            && in_array($info['aud'] ?? '', $clientIds, true)
            && in_array($issuer, ['accounts.google.com', 'https://accounts.google.com'], true)
            && (int) ($info['exp'] ?? 0) > time()
            && in_array($info['email_verified'] ?? false, [true, 'true'], true)
            && ! empty($info['sub'])
            && ! empty($info['email']);

        if (! $valid) {
            throw ApiException::unauthorized('Google sign-in did not work. Please try again.');
        }

        $email = strtolower(trim($info['email']));

        return [
            'sub' => (string) $info['sub'],
            'email' => $email,
            'name' => trim((string) ($info['name'] ?? '')) ?: strstr($email, '@', true),
        ];
    }
}
