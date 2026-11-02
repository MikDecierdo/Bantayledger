<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * A person's right to take their data with them or have it removed: the
 * download file and the deletion of stores and accounts.
 */
class AccountData
{
    /** Tables that belong directly to a store, included in the download file. */
    private const STORE_TABLES = [
        'categories', 'suppliers', 'products', 'sales', 'purchases', 'expenses', 'waste_records',
        'inventory_movements', 'business_events', 'subscription_payments', 'forecast_runs',
        'demand_forecasts', 'price_forecasts', 'cost_forecasts', 'cost_anomalies', 'alerts', 'recommendations',
    ];

    /** The person's own details, plus every record of the stores they own. */
    public static function export(string $userId): array
    {
        $profile = DB::table('users')->where('user_id', $userId)->first([
            'user_id', 'name', 'email', 'phone', 'language', 'privacy_accepted_at', 'privacy_version',
            'terms_accepted_at', 'created_at',
        ]);

        $memberOf = DB::table('business_users')
            ->join('businesses', 'businesses.business_id', '=', 'business_users.business_id')
            ->where('business_users.user_id', $userId)
            ->get(['businesses.name as store', 'business_users.role']);

        $stores = [];
        foreach (DB::table('businesses')->where('owner_user_id', $userId)->get() as $business) {
            $id = $business->business_id;
            $store = ['store' => $business];
            $store['members'] = DB::table('business_users')
                ->join('users', 'users.user_id', '=', 'business_users.user_id')
                ->where('business_users.business_id', $id)
                ->get(['users.name', 'users.email', 'users.phone', 'business_users.role']);
            foreach (self::STORE_TABLES as $table) {
                $store[$table] = DB::table($table)->where('business_id', $id)->get();
            }
            $store['sale_items'] = DB::table('sale_items')
                ->join('sales', 'sales.sale_id', '=', 'sale_items.sale_id')
                ->where('sales.business_id', $id)->get(['sale_items.*']);
            $store['sale_payments'] = DB::table('sale_payments')
                ->join('sales', 'sales.sale_id', '=', 'sale_payments.sale_id')
                ->where('sales.business_id', $id)->get(['sale_payments.*']);
            $store['purchase_items'] = DB::table('purchase_items')
                ->join('purchases', 'purchases.purchase_id', '=', 'purchase_items.purchase_id')
                ->where('purchases.business_id', $id)->get(['purchase_items.*']);
            $stores[] = $store;
        }

        return [
            'exported_at' => now()->toIso8601String(),
            'profile' => $profile,
            'member_of' => $memberOf,
            'stores' => $stores,
        ];
    }

    /**
     * Deletes the account. An owner's stores go with it, along with any staff
     * logins that belong to no other store. Records a staff member entered in
     * someone else's store stay with that store, without their name.
     */
    public static function deleteAccount(string $userId): void
    {
        $photos = [];

        DB::transaction(function () use ($userId, &$photos) {
            $owned = DB::table('businesses')->where('owner_user_id', $userId)->pluck('business_id');
            $members = DB::table('business_users')
                ->whereIn('business_id', $owned)
                ->where('user_id', '!=', $userId)
                ->pluck('user_id')
                ->unique();

            foreach ($owned as $businessId) {
                $photos = array_merge($photos, self::deleteStore($businessId));
            }

            self::deleteUser($userId);

            foreach ($members as $memberId) {
                self::deleteUserIfUnattached($memberId);
            }
        });

        // Only once the database has really changed; a file can't be rolled back.
        self::deletePhotos($photos);
    }

    /** Removes a login that no longer belongs to any store. */
    public static function deleteUserIfUnattached(string $userId): void
    {
        $inUse = DB::table('business_users')->where('user_id', $userId)->exists()
            || DB::table('businesses')->where('owner_user_id', $userId)->exists();

        if (! $inUse) {
            self::deleteUser($userId);
        }
    }

    /**
     * Removes one store and returns the paths of its product photos.
     *
     * Sales, purchases and spoiled items come first: their rows refuse to let
     * a product go while they still point at it, so the store can't simply be
     * deleted and left to cascade.
     */
    private static function deleteStore(string $businessId): array
    {
        $photos = DB::table('products')->where('business_id', $businessId)->whereNotNull('image_path')->pluck('image_path')->all();

        DB::table('sales')->where('business_id', $businessId)->delete();
        DB::table('purchases')->where('business_id', $businessId)->delete();
        DB::table('waste_records')->where('business_id', $businessId)->delete();
        DB::table('businesses')->where('business_id', $businessId)->delete();

        // Not tied to the store by a foreign key.
        DB::table('idempotency_keys')->where('request_path', 'like', "%/businesses/{$businessId}/%")->delete();
        if (config('cache.default') === 'database' && Schema::hasTable('cache')) {
            DB::table('cache')->where('key', 'like', "%{$businessId}%")->delete();
        }

        return $photos;
    }

    private static function deleteUser(string $userId): void
    {
        $email = DB::table('users')->where('user_id', $userId)->value('email');

        DB::table('business_users')->where('user_id', $userId)->delete();
        DB::table('personal_access_tokens')->where('tokenable_id', $userId)->delete();
        DB::table('idempotency_keys')->where('user_id', $userId)->delete();
        if ($email) {
            DB::table('password_reset_tokens')->where('email', $email)->delete();
        }
        DB::table('users')->where('user_id', $userId)->delete();
    }

    private static function deletePhotos(array $paths): void
    {
        foreach ($paths as $path) {
            try {
                Storage::disk('public')->delete($path);
            } catch (\Throwable $e) {
                report($e);
            }
        }
    }
}
