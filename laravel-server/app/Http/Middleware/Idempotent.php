<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Makes a "create" request safe to send more than once.
 *
 * The phone app queues sales, expenses, purchases and spoiled items recorded
 * offline and sends each with an `Idempotency-Key` header when it is back
 * online. The first request with a key runs normally and, if it succeeds,
 * its reply is stored; any repeat with the same key (from the same user) gets
 * that stored reply back instead of creating a second record. Failed replies
 * are not stored, so the phone can fix the problem and try again.
 *
 * Requests without the header pass straight through.
 */
class Idempotent
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = (string) $request->header('Idempotency-Key', '');
        $user = $request->user();

        if ($key === '' || ! $user || ! preg_match('/^[A-Za-z0-9_-]{8,64}$/', $key)) {
            return $next($request);
        }

        $where = ['user_id' => $user->user_id, 'idempotency_key' => $key];
        $existing = DB::table('idempotency_keys')->where($where)->first();

        if ($existing) {
            if ((int) $existing->response_status === 0) {
                return response()->json(['message' => __('This record is still being saved. Please wait a moment.')], 409);
            }

            return response((string) $existing->response_body, (int) $existing->response_status)
                ->header('Content-Type', 'application/json')
                ->header('Idempotent-Replay', 'true');
        }

        try {
            DB::table('idempotency_keys')->insert($where + ['request_path' => substr($request->path(), 0, 255)]);
        } catch (QueryException) {
            // Another copy of this request started a moment ago.
            return response()->json(['message' => __('This record is still being saved. Please wait a moment.')], 409);
        }

        try {
            $response = $next($request);
        } catch (\Throwable $e) {
            DB::table('idempotency_keys')->where($where)->delete();
            throw $e;
        }

        if ($response->isSuccessful()) {
            DB::table('idempotency_keys')->where($where)->update([
                'response_status' => $response->getStatusCode(),
                'response_body' => $response->getContent(),
            ]);
        } else {
            DB::table('idempotency_keys')->where($where)->delete();
        }

        return $response;
    }
}
