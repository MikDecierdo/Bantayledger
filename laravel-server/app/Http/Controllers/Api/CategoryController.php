<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
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
        $data = $request->validate(['name' => 'required|string', 'description' => 'nullable|string']);

        $id = (string) Str::uuid();
        DB::table('categories')->insert([
            'category_id' => $id,
            'business_id' => $business,
            'name' => trim($data['name']),
            'description' => $data['description'] ?? null,
        ]);

        return response()->json(DB::table('categories')->where('category_id', $id)->first(['categories.*', 'category_id as id']), 201);
    }

    public function destroy(string $business, string $id)
    {
        DB::table('categories')->where('business_id', $business)->where('category_id', $id)->delete();

        return response()->noContent();
    }
}
