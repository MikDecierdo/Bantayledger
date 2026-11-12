<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\AccountData;
use App\Services\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/** Ported from server/src/services/accountService.ts. */
class BusinessController extends Controller
{
    public function updateProfile(Request $request)
    {
        $data = $request->validate([
            'fullName' => 'sometimes|string|max:160',
            'phone' => 'sometimes|nullable|string|max:50',
            'avatarUrl' => 'sometimes|nullable|string|max:255',
            'language' => 'sometimes|in:en,tl,ceb',
        ]);

        $patch = [];
        if (array_key_exists('language', $data)) {
            $patch['language'] = $data['language'];
        }
        if (array_key_exists('fullName', $data)) {
            $patch['name'] = trim($data['fullName']);
        }
        if (array_key_exists('phone', $data)) {
            $patch['phone'] = $data['phone'] ? trim($data['phone']) : null;
        }
        if (array_key_exists('avatarUrl', $data)) {
            $patch['avatar_url'] = $data['avatarUrl'];
        }

        if ($patch) {
            DB::table('users')->where('user_id', $request->user()->user_id)->update($patch);
        }

        return DB::table('users')->where('user_id', $request->user()->user_id)->first(['users.*', 'user_id as id']);
    }

    /** Records that the person read and accepted the data privacy notice, and their language. */
    public function acceptPrivacy(Request $request)
    {
        $data = $request->validate([
            'version' => 'required|string|max:10',
            'language' => 'required|in:en,tl,ceb',
        ]);

        DB::table('users')->where('user_id', $request->user()->user_id)->update([
            'privacy_accepted_at' => now(),
            'privacy_version' => $data['version'],
            'terms_accepted_at' => now(),
            'language' => $data['language'],
        ]);

        return DB::table('users')->where('user_id', $request->user()->user_id)->first(['users.*', 'user_id as id']);
    }

    public function show(string $business)
    {
        return DB::table('businesses')->where('business_id', $business)->first(['businesses.*', 'business_id as id']);
    }

    public function update(Request $request, string $business)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:160',
            'businessType' => 'sometimes|nullable|string|max:100',
            'address' => 'sometimes|nullable|string|max:500',
            'phone' => 'sometimes|nullable|string|max:50',
            'email' => 'sometimes|nullable|string|max:255',
            'monthlyPurchaseBudget' => 'sometimes|nullable|numeric|min:0',
        ]);

        $existing = DB::table('businesses')->where('business_id', $business)->first();
        if (! $existing) {
            throw ApiException::notFound('That business could not be found.');
        }

        $patch = [];
        if (array_key_exists('name', $data)) {
            $patch['name'] = trim($data['name']);
        }
        if (array_key_exists('businessType', $data)) {
            $patch['business_type'] = $data['businessType'] ?: null;
        }
        if (array_key_exists('address', $data)) {
            $patch['address'] = $data['address'] ?: null;
        }
        if (array_key_exists('phone', $data)) {
            $patch['phone'] = $data['phone'] ?: null;
        }
        if (array_key_exists('email', $data)) {
            $patch['email'] = $data['email'] ?: null;
        }
        if (array_key_exists('monthlyPurchaseBudget', $data)) {
            $patch['monthly_purchase_budget'] = $data['monthlyPurchaseBudget'];
        }

        // update()'s affected-row count is 0 (not an error) when the new
        // values are identical to what's already stored — e.g. saving the
        // same budget twice — so existence is checked separately above
        // rather than inferred from that count.
        if ($patch !== []) {
            DB::transaction(function () use ($business, $patch, $existing) {
                DB::table('businesses')->where('business_id', $business)->update($patch);

                $codes = [
                    'name' => 'name',
                    'business_type' => 'business_type',
                    'address' => 'address',
                    'phone' => 'phone',
                    'email' => 'email',
                    'purchase_budget' => 'monthly_purchase_budget',
                ];
                $fields = [];
                foreach ($codes as $code => $column) {
                    if (array_key_exists($column, $patch)) {
                        $fields[$code] = [$existing->{$column}, $patch[$column]];
                    }
                }
                $changed = ActivityLog::changedFields($fields);
                if ($changed !== '') {
                    ActivityLog::record($business, ActivityLog::STORE, 'store_details_changed', [
                        'subjectId' => $business,
                        'subject' => $patch['name'] ?? $existing->name,
                        'notes' => $changed,
                    ]);
                }
            });
        }

        return DB::table('businesses')->where('business_id', $business)->first(['businesses.*', 'business_id as id']);
    }

    public function members(string $business)
    {
        $rows = DB::table('business_users as bu')
            ->join('users as u', 'u.user_id', '=', 'bu.user_id')
            ->where('bu.business_id', $business)
            ->select('bu.business_user_id as membership_id', 'bu.user_id', 'bu.role', 'u.name', 'u.email', 'u.phone', 'u.avatar_url')
            ->get();

        return $rows->map(fn ($row) => [
            'membershipId' => $row->membership_id,
            'userId' => $row->user_id,
            'role' => $row->role,
            'fullName' => $row->name ?? '—',
            'email' => $row->email ?? '',
            'phone' => $row->phone ?? '',
            'avatarUrl' => $row->avatar_url,
        ])->values();
    }

    private const PASSWORD_RULES = ['required', 'string', 'min:8', 'max:72', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/\d/', 'regex:/[^A-Za-z0-9]/'];

    /** The owner creates a login for a helper. There is no email service, so the owner sets the first password. */
    public function addMember(Request $request, string $business)
    {
        $data = $request->validate([
            'fullName' => 'required|string|max:160',
            'email' => 'required|email|max:255',
            'phone' => ['nullable', 'string', 'regex:/^\+639\d{9}$/'],
            'password' => self::PASSWORD_RULES,
        ], [
            'password.regex' => __('Use a stronger password: at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.'),
            'phone.regex' => __('Enter a valid Philippine mobile number, e.g. +63 917 123 4567.'),
        ]);

        $email = strtolower(trim($data['email']));
        if (DB::table('users')->where('email', $email)->exists()) {
            throw ApiException::conflict('An account with that email already exists. Try signing in instead.');
        }

        $userId = (string) Str::uuid();
        DB::transaction(function () use ($data, $email, $userId, $business, $request) {
            DB::table('users')->insert([
                'user_id' => $userId,
                'email' => $email,
                'name' => trim($data['fullName']),
                'phone' => isset($data['phone']) ? trim($data['phone']) : null,
                'password' => Hash::make($data['password']),
                'language' => $request->user()->language,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('business_users')->insert([
                'business_user_id' => (string) Str::uuid(),
                'business_id' => $business,
                'user_id' => $userId,
                'role' => 'STAFF',
            ]);
            ActivityLog::record($business, ActivityLog::STAFF, 'staff_added', ['subjectId' => $userId, 'subject' => trim($data['fullName'])]);
        });

        return response()->json(['userId' => $userId], 201);
    }

    public function resetMemberPassword(Request $request, string $business, string $userId)
    {
        $data = $request->validate(['password' => self::PASSWORD_RULES], [
            'password.regex' => __('Use a stronger password: at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.'),
        ]);

        $role = DB::table('business_users')->where('business_id', $business)->where('user_id', $userId)->value('role');
        if ($role !== 'STAFF') {
            throw ApiException::notFound('That person is not a member of this business.');
        }

        DB::transaction(function () use ($business, $userId, $data) {
            DB::table('users')->where('user_id', $userId)->update(['password' => Hash::make($data['password'])]);
            // Sign the staff member out everywhere so the old password stops working.
            DB::table('personal_access_tokens')->where('tokenable_id', $userId)->delete();
            ActivityLog::record($business, ActivityLog::STAFF, 'staff_password_reset', [
                'subjectId' => $userId,
                'subject' => DB::table('users')->where('user_id', $userId)->value('name') ?? '—',
            ]);
        });

        return response()->noContent();
    }

    public function removeMember(Request $request, string $business, string $userId)
    {
        $role = DB::table('business_users')->where('business_id', $business)->where('user_id', $userId)->value('role');
        if ($role === null) {
            throw ApiException::notFound('That person is not a member of this business.');
        }
        if ($role === 'OWNER') {
            throw ApiException::badRequest('The owner cannot be removed.');
        }

        DB::transaction(function () use ($business, $userId) {
            // Named before their login may go below.
            ActivityLog::record($business, ActivityLog::STAFF, 'staff_removed', [
                'subjectId' => $userId,
                'subject' => DB::table('users')->where('user_id', $userId)->value('name') ?? '—',
            ]);
            DB::table('business_users')->where('business_id', $business)->where('user_id', $userId)->delete();
            DB::table('personal_access_tokens')->where('tokenable_id', $userId)->delete();
            // A helper's login exists only for the store; it goes once they have none left.
            AccountData::deleteUserIfUnattached($userId);
        });

        return response()->noContent();
    }
}
