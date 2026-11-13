<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;

/**
 * Serves product photos from the database. Public on purpose: an <img> can't
 * send the login token. The address holds a random 40-character token, and a
 * new photo gets a new token, so browsers may keep a photo for a year.
 */
class PhotoController extends Controller
{
    public function show(string $token)
    {
        $photo = preg_match('/^[A-Za-z0-9]{40}$/', $token)
            ? DB::table('product_photos')->where('token', $token)->first(['mime', 'data'])
            : null;

        if (! $photo) {
            abort(404);
        }

        return response($photo->data, 200, [
            'Content-Type' => $photo->mime,
            'Content-Length' => (string) strlen($photo->data),
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
