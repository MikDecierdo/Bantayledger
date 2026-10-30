<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/** OWNER only. Staff can record transactions but cannot edit the catalogue, delete records or manage the team. */
class EnsureBusinessManager
{
    public function handle(Request $request, Closure $next): Response
    {
        $businessId = $request->route('business');
        $userId = $request->user()?->user_id;

        if (! $userId) {
            throw ApiException::unauthorized();
        }

        $role = DB::table('business_users')
            ->where('business_id', $businessId)
            ->where('user_id', $userId)
            ->value('role');

        if ($role !== 'OWNER') {
            throw ApiException::forbidden();
        }

        return $next($request);
    }
}
