<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** The activity log, for the store owner. Read only: entries can't be changed or removed here. */
class ActivityController extends Controller
{
    public function index(Request $request, string $business)
    {
        $data = $request->validate([
            'category' => 'nullable|in:price,stock,expense,sale,purchase,product,staff,store,account',
            'q' => 'nullable|string|max:100',
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d',
            'before' => 'nullable|integer|min:1',
            'limit' => 'nullable|integer|min:1|max:100',
        ]);

        $limit = (int) ($data['limit'] ?? 50);

        $query = DB::table('activity_logs')->where('business_id', $business);

        if (! empty($data['category'])) {
            $query->where('category', $data['category']);
        }
        if (! empty($data['from'])) {
            $query->where('created_at', '>=', $data['from'].' 00:00:00');
        }
        if (! empty($data['to'])) {
            $query->where('created_at', '<=', $data['to'].' 23:59:59');
        }
        if (! empty($data['before'])) {
            $query->where('activity_log_id', '<', $data['before']);
        }
        if (! empty($data['q'])) {
            $like = '%'.addcslashes(trim($data['q']), '%_\\').'%';
            $query->where(fn ($q) => $q
                ->where('subject_name', 'like', $like)
                ->orWhere('actor_name', 'like', $like)
                ->orWhere('notes', 'like', $like));
        }

        // One extra row shows whether there's another page.
        $rows = $query->orderByDesc('activity_log_id')->limit($limit + 1)->get();
        $hasMore = $rows->count() > $limit;
        $rows = $rows->take($limit);

        return [
            'items' => $rows->map(fn ($row) => [
                'id' => (int) $row->activity_log_id,
                'at' => Carbon::parse($row->created_at, config('app.timezone'))->toIso8601String(),
                'actor' => $row->actor_name,
                'category' => $row->category,
                'action' => $row->action,
                'subject' => $row->subject_name,
                'oldValue' => $row->old_value === null ? null : (float) $row->old_value,
                'newValue' => $row->new_value === null ? null : (float) $row->new_value,
                'unit' => $row->unit,
                'notes' => $row->notes,
                'recordDate' => $row->record_date,
            ])->values(),
            'nextBefore' => $hasMore ? (int) $rows->last()->activity_log_id : null,
        ];
    }
}
