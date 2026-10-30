<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Answers in the language the app asked for (Accept-Language: en | tl | ceb).
 * Anything else falls back to English.
 */
class SetLocale
{
    public const SUPPORTED = ['en', 'tl', 'ceb'];

    public function handle(Request $request, Closure $next): Response
    {
        $wanted = strtolower(substr((string) $request->header('Accept-Language', 'en'), 0, 3));
        $wanted = rtrim($wanted, '-,;_ ');
        if (! in_array($wanted, self::SUPPORTED, true)) {
            // e.g. "fil" or "tl-PH"
            $short = substr($wanted, 0, 2);
            $wanted = $short === 'fi' ? 'tl' : (in_array($short, self::SUPPORTED, true) ? $short : 'en');
        }

        app()->setLocale($wanted);

        return $next($request);
    }
}
