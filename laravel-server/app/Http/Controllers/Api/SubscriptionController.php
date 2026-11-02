<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\SubscriptionPlan;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Demo subscription for the project defense: a typed 13-digit GCash reference
 * activates Plus. No money moves and nothing is checked with GCash.
 */
class SubscriptionController extends Controller
{
    public function show(string $business)
    {
        return response()->json($this->state($business));
    }

    public function store(Request $request, string $business)
    {
        $data = $request->validate([
            'term' => 'required|in:' . implode(',', array_keys(SubscriptionPlan::TERMS)),
            'reference' => ['required', 'string', 'regex:/^\d{13}$/'],
        ], [
            'reference.regex' => __('Enter the full 13-digit GCash reference number.'),
        ]);

        if (DB::table('subscription_payments')->where('reference', $data['reference'])->exists()) {
            throw ApiException::conflict('That reference number was already used.');
        }

        // Activating while on Plus extends from the current end date.
        $currentEnd = SubscriptionPlan::active()->where('business_id', $business)->max('expires_at');
        $start = $currentEnd ? Carbon::parse($currentEnd) : now();

        try {
            DB::table('subscription_payments')->insert([
                'payment_id' => (string) Str::uuid(),
                'business_id' => $business,
                'user_id' => $request->user()->user_id,
                'term' => $data['term'],
                'amount' => SubscriptionPlan::TERMS[$data['term']],
                'reference' => $data['reference'],
                'starts_at' => $start,
                'expires_at' => SubscriptionPlan::endOf($data['term'], $start),
            ]);
        } catch (UniqueConstraintViolationException) {
            throw ApiException::conflict('That reference number was already used.');
        }

        return response()->json($this->state($business), 201);
    }

    /** Back to Free, so the demo can be repeated. History is kept. */
    public function destroy(string $business)
    {
        SubscriptionPlan::active()->where('business_id', $business)->update(['cancelled_at' => now()]);

        return response()->json($this->state($business));
    }

    private function state(string $business): array
    {
        $rows = DB::table('subscription_payments')->where('business_id', $business)
            ->orderByDesc('created_at')->orderByDesc('expires_at')->limit(20)->get();
        $active = $rows->filter(fn ($r) => $r->cancelled_at === null && Carbon::parse($r->expires_at)->isFuture());
        $current = $active->sortByDesc('expires_at')->first();

        return [
            'plan' => $current ? 'plus' : 'free',
            'expiresAt' => $current?->expires_at,
            'term' => $current?->term,
            'terms' => collect(SubscriptionPlan::TERMS)->map(fn ($amount, $term) => ['term' => $term, 'amount' => $amount])->values(),
            'history' => $rows->map(fn ($r) => [
                'id' => $r->payment_id,
                'term' => $r->term,
                'amount' => (float) $r->amount,
                // Only the last 4 digits ever leave the server.
                'reference' => str_repeat('•', 9) . substr($r->reference, -4),
                'paidAt' => $r->created_at,
                'expiresAt' => $r->expires_at,
                'cancelled' => $r->cancelled_at !== null,
            ])->values(),
        ];
    }
}
