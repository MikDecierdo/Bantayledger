<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Every route in this app is a JSON API — there is no login page to redirect
 * a guest to. Laravel's default unauthenticated-guest handling only returns
 * 401 JSON when $request->expectsJson() is true; otherwise it tries
 * route('login'), which doesn't exist here and throws a 500. Real API
 * clients (fetch, axios, mobile HTTP clients) almost always send
 * `Accept: application/json` themselves, but nothing should depend on a
 * caller remembering to — so force it for every request in the api group.
 */
class ForceJsonResponse
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}
