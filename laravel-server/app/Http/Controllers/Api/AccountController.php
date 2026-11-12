<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\AccountData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/** Settings → Your data: download everything, or delete the account. */
class AccountController extends Controller
{
    public function export(Request $request)
    {
        return response()->json(AccountData::export($request->user()->user_id));
    }

    public function destroy(Request $request)
    {
        $data = $request->validate(['password' => 'required|string|max:255']);
        $user = $request->user();

        if (! Hash::check($data['password'], $user->password)) {
            throw ApiException::unprocessable('That password is not correct.');
        }

        AccountData::deleteAccount($user->user_id);

        return response()->noContent();
    }
}
