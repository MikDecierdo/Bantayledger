<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The store's own yearly events (barangay fiesta and the like). National
 * events such as Christmas are built in (App\Services\EventCalendar).
 */
class EventController extends Controller
{
    private const MAX_EVENTS = 20;

    private const COLUMNS = ['event_id as id', 'name', 'month', 'day', 'prep_days as prepDays', 'created_at as createdAt'];

    public function index(string $business)
    {
        return DB::table('business_events')->where('business_id', $business)->orderBy('month')->orderBy('day')->get(self::COLUMNS);
    }

    public function store(Request $request, string $business)
    {
        $data = $request->validate([
            'name' => 'required|string|max:80',
            'month' => 'required|integer|between:1,12',
            'day' => 'required|integer|between:1,31',
            'prepDays' => 'nullable|integer|between:3,60',
        ]);

        $name = trim($data['name']);
        if ($name === '') {
            throw ApiException::unprocessable('Enter a name for the event.');
        }
        // 2024 is a leap year, so February 29 is accepted.
        if (! checkdate((int) $data['month'], (int) $data['day'], 2024)) {
            throw ApiException::unprocessable('That date does not exist. Check the month and day.');
        }
        if (DB::table('business_events')->where('business_id', $business)->count() >= self::MAX_EVENTS) {
            throw ApiException::unprocessable('You can save up to :max events.', ['max' => self::MAX_EVENTS]);
        }
        $exists = DB::table('business_events')->where('business_id', $business)
            ->where('name', $name)->where('month', $data['month'])->where('day', $data['day'])->exists();
        if ($exists) {
            throw ApiException::conflict('That event is already saved.');
        }

        $id = (string) Str::uuid();
        DB::table('business_events')->insert([
            'event_id' => $id,
            'business_id' => $business,
            'name' => $name,
            'month' => (int) $data['month'],
            'day' => (int) $data['day'],
            'prep_days' => (int) ($data['prepDays'] ?? 21),
        ]);

        return response()->json(DB::table('business_events')->where('event_id', $id)->first(self::COLUMNS), 201);
    }

    public function destroy(string $business, string $id)
    {
        DB::table('business_events')->where('business_id', $business)->where('event_id', $id)->delete();

        return response()->noContent();
    }
}
