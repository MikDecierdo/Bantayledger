<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Replaces Supabase RLS, ported from the Node port's requireBusinessMember.
 * Every business-scoped route must run this (or EnsureBusinessManager)
 * before touching data — there is no automatic boundary the way
 * 0003_rls.sql gave Postgres. Route param must be named {business}.
 */
class EnsureBusinessMember
{
    public function handle(Request $request, Closure $next): Response
    {
        $businessId = $request->route('business');
        $userId = $request->user()?->user_id;

        if (! $userId) {
            throw ApiException::unauthorized();
        }

        $isMember = DB::table('business_users')
            ->where('business_id', $businessId)
            ->where('user_id', $userId)
            ->exists();

        if (! $isMember) {
            throw ApiException::forbidden();
        }

        return $next($request);
    }
}
