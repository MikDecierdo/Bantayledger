<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\ActivityLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Ported from server/src/services/catalogService.ts (categoryService). */
class CategoryController extends Controller
{
    public function index(string $business)
    {
        return DB::table('categories')->where('business_id', $business)->orderBy('name')->get(['categories.*', 'category_id as id']);
    }

    public function store(Request $request, string $business)
    {
        $data = $request->validate(['name' => 'required|string|max:80', 'description' => 'nullable|string|max:500']);

        $id = (string) Str::uuid();
        DB::transaction(function () use ($id, $business, $data) {
            DB::table('categories')->insert([
                'category_id' => $id,
                'business_id' => $business,
                'name' => trim($data['name']),
                'description' => $data['description'] ?? null,
            ]);
            ActivityLog::record($business, ActivityLog::STORE, 'category_added', ['subjectId' => $id, 'subject' => trim($data['name'])]);
        });

        return response()->json(DB::table('categories')->where('category_id', $id)->first(['categories.*', 'category_id as id']), 201);
    }

    public function destroy(string $business, string $id)
    {
        DB::transaction(function () use ($business, $id) {
            $name = DB::table('categories')->where('business_id', $business)->where('category_id', $id)->value('name');
            if ($name === null) {
                return;
            }
            DB::table('categories')->where('business_id', $business)->where('category_id', $id)->delete();
            ActivityLog::record($business, ActivityLog::STORE, 'category_removed', ['subjectId' => $id, 'subject' => $name]);
        });

        return response()->noContent();
    }
}
