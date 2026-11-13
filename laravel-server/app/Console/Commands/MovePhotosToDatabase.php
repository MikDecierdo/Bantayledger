<?php

namespace App\Console\Commands;

use App\Services\ProductPhotos;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Moves product photos saved as files (storage/app/public/products) into the
 * database. A photo whose file is gone (the live server's disk is wiped on
 * every deploy) is cleared, so the app shows its placeholder instead of a
 * broken picture. Safe to run again: photos already in the database are skipped.
 */
class MovePhotosToDatabase extends Command
{
    protected $signature = 'photos:move-to-db';

    protected $description = 'Move product photos from the disk into the database';

    public function handle(): int
    {
        $rows = DB::table('products')
            ->whereNotNull('image_path')
            ->where('image_path', 'not like', ProductPhotos::PREFIX.'%')
            ->get(['product_id', 'image_path']);

        $moved = 0;
        $missing = 0;
        foreach ($rows as $row) {
            $disk = Storage::disk('public');
            if ($disk->exists($row->image_path)) {
                DB::transaction(function () use ($row, $disk) {
                    $path = ProductPhotos::save($row->product_id, (string) $disk->get($row->image_path));
                    DB::table('products')->where('product_id', $row->product_id)->update(['image_path' => $path]);
                });
                $disk->delete($row->image_path);
                $moved++;
            } else {
                DB::table('products')->where('product_id', $row->product_id)->update(['image_path' => null]);
                $missing++;
            }
        }

        $this->info("Photos moved into the database: $moved. Photos whose file was already gone (cleared): $missing.");

        return self::SUCCESS;
    }
}
