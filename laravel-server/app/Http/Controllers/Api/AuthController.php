<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Auth. Ported from server/src/auth/authService.ts, but using Laravel
 * Sanctum's personal-access tokens instead of a hand-rolled JWT + hashed
 * refresh-token scheme — Sanctum already gives per-token revocation (delete
 * the row) and expiry, which is what the Node port built refresh_tokens for.
 * Password hashing uses Laravel's own Hash facade (bcrypt) rather than
 * porting the PBKDF2 scheme from src/lib/crypto.ts — bcrypt via Hash is the
 * Laravel-idiomatic choice and the User model's password cast already uses it.
 */
class AuthController extends Controller
{
    public const PRIVACY_NOTICE_VERSION = '1';

    public function signup(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => ['required', 'string', 'min:8', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/\d/', 'regex:/[^A-Za-z0-9]/'],
            'fullName' => 'required|string',
            'phone' => ['nullable', 'string', 'regex:/^\+639\d{9}$/'],
            'businessName' => 'required|string',
        ], [
            'password.regex' => __('Use a stronger password: at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.'),
            'phone.regex' => __('Enter a valid Philippine mobile number, e.g. +63 917 123 4567.'),
        ]);

        $email = strtolower(trim($data['email']));

        if (User::where('email', $email)->exists()) {
            throw ApiException::conflict('An account with that email already exists. Try signing in instead.');
        }

        $user = DB::transaction(function () use ($data, $email) {
            $user = User::create([
                'user_id' => (string) Str::uuid(),
                'email' => $email,
                'name' => trim($data['fullName']),
                'phone' => isset($data['phone']) ? trim($data['phone']) : null,
                'password' => Hash::make($data['password']),
            ]);

            $businessId = (string) Str::uuid();
            DB::table('businesses')->insert([
                'business_id' => $businessId,
                'name' => trim($data['businessName']),
                'owner_user_id' => $user->user_id,
            ]);
            DB::table('business_users')->insert([
                'business_user_id' => (string) Str::uuid(),
                'business_id' => $businessId,
                'user_id' => $user->user_id,
                'role' => 'OWNER',
            ]);

            return $user;
        });

        $token = $user->createToken('api')->plainTextToken;

        return response()->json(['userId' => $user->user_id, 'accessToken' => $token], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', strtolower(trim($data['email'])))->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ApiException::unauthorized('That email and password combination is not correct.');
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json(['userId' => $user->user_id, 'accessToken' => $token]);
    }

    /**
     * "Forgot password": emails a one-time reset link (valid 60 minutes) to the
     * website's /reset-password page. Always answers the same way whether or
     * not the email has an account, so it can't be used to look up accounts.
     */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => 'required|email']);

        try {
            Password::broker()->sendResetLink(['email' => strtolower(trim($data['email']))]);
        } catch (\Throwable $e) {
            report($e);
            throw ApiException::badGateway('We could not send the email right now. Please try again in a few minutes.');
        }

        return response()->json(['ok' => true]);
    }

    /** Sets a new password from the emailed link, then signs the user in. */
    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
            'password' => ['required', 'string', 'min:8', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/\d/', 'regex:/[^A-Za-z0-9]/'],
        ], [
            'password.regex' => __('Use a stronger password: at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.'),
        ]);

        $resetUser = null;
        $status = Password::broker()->reset(
            ['email' => strtolower(trim($data['email'])), 'token' => $data['token'], 'password' => $data['password']],
            function (User $user, string $password) use (&$resetUser) {
                $user->forceFill(['password' => Hash::make($password), 'remember_token' => Str::random(60)])->save();
                $resetUser = $user;
            },
        );

        if ($status !== Password::PASSWORD_RESET || ! $resetUser) {
            throw ApiException::unprocessable('This reset link is invalid or has expired. Request a new one from the sign-in page.');
        }

        $token = $resetUser->createToken('api')->plainTextToken;

        return response()->json(['userId' => $resetUser->user_id, 'accessToken' => $token]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    public function me(Request $request)
    {
        $user = $request->user();

        $businesses = DB::table('business_users')
            ->join('businesses', 'businesses.business_id', '=', 'business_users.business_id')
            ->where('business_users.user_id', $user->user_id)
            ->orderBy('businesses.name')
            ->select('businesses.*', 'businesses.business_id as id', 'business_users.role as membershipRole')
            ->get();

        return response()->json([
            'profile' => $user,
            'businesses' => $businesses,
            // Bumping this re-asks everyone to read and accept the notice.
            'privacyNoticeVersion' => self::PRIVACY_NOTICE_VERSION,
        ]);
    }

    public function createBusiness(Request $request)
    {
        $data = $request->validate(['name' => 'required|string']);
        $user = $request->user();

        $businessId = DB::transaction(function () use ($data, $user) {
            $businessId = (string) Str::uuid();
            DB::table('businesses')->insert([
                'business_id' => $businessId,
                'name' => trim($data['name']),
                'owner_user_id' => $user->user_id,
            ]);
            DB::table('business_users')->insert([
                'business_user_id' => (string) Str::uuid(),
                'business_id' => $businessId,
                'user_id' => $user->user_id,
                'role' => 'OWNER',
            ]);

            return $businessId;
        });

        return response()->json(['businessId' => $businessId], 201);
    }
}
