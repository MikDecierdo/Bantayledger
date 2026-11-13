<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Product photos stored in the database (table product_photos), so they
 * survive deploys and restarts of a server whose disk is temporary.
 *
 * products.image_path is "db:<token>" for these; older rows may still hold a
 * file path under storage/app/public from before the move.
 */
class ProductPhotos
{
    public const PREFIX = 'db:';

    /** Longest side after shrinking, in pixels. */
    private const MAX_SIDE = 800;

    private const QUALITY = 82;

    /** The address the app loads the photo from, or null when there is none. */
    public static function url(?string $imagePath): ?string
    {
        if (! $imagePath) {
            return null;
        }
        if (str_starts_with($imagePath, self::PREFIX)) {
            return rtrim((string) config('app.url'), '/').'/api/photos/'.substr($imagePath, strlen(self::PREFIX)).'.jpg';
        }

        // A photo from before the move: only while its file is still there,
        // so the app shows its placeholder instead of a broken picture.
        return Storage::disk('public')->exists($imagePath) ? Storage::disk('public')->url($imagePath) : null;
    }

    /** Shrinks and saves a photo for the product. Returns the new image_path. */
    public static function save(string $productId, string $bytes): string
    {
        [$data, $mime] = self::shrink($bytes);
        $token = Str::random(40);
        $now = now();

        DB::table('product_photos')->updateOrInsert(
            ['product_id' => $productId],
            ['token' => $token, 'mime' => $mime, 'bytes' => strlen($data), 'data' => $data, 'created_at' => $now, 'updated_at' => $now],
        );

        return self::PREFIX.$token;
    }

    public static function delete(string $productId): void
    {
        DB::table('product_photos')->where('product_id', $productId)->delete();
    }

    /** Removes a leftover file from before the move (no-op for database photos). */
    public static function deleteOldFile(?string $imagePath): void
    {
        if ($imagePath && ! str_starts_with($imagePath, self::PREFIX)) {
            Storage::disk('public')->delete($imagePath);
        }
    }

    /**
     * At most 800 px on the long side, as JPEG on white, turned upright when a
     * phone camera saved it sideways. Returns [bytes, mime]. If the image can't
     * be read (should not happen after validation), it is kept as it came.
     *
     * @return array{0: string, 1: string}
     */
    public static function shrink(string $bytes): array
    {
        $source = @imagecreatefromstring($bytes);
        if ($source === false) {
            $info = @getimagesizefromstring($bytes);

            return [$bytes, $info['mime'] ?? 'image/jpeg'];
        }

        // Shrink first, then turn: turning a full-size phone photo needs a lot of memory.
        $w = imagesx($source);
        $h = imagesy($source);
        $scale = min(1, self::MAX_SIDE / max($w, $h));
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));

        $out = imagecreatetruecolor($nw, $nh);
        imagefill($out, 0, 0, imagecolorallocate($out, 255, 255, 255));
        imagecopyresampled($out, $source, 0, 0, 0, 0, $nw, $nh, $w, $h);
        imagedestroy($source);
        $out = self::upright($out, self::orientation($bytes));

        ob_start();
        imageinterlace($out, true);
        imagejpeg($out, null, self::QUALITY);
        $data = (string) ob_get_clean();
        imagedestroy($out);

        return [$data, 'image/jpeg'];
    }

    /** Applies the camera's EXIF orientation (1-8). */
    private static function upright(\GdImage $img, int $orientation): \GdImage
    {
        $rotate = fn (\GdImage $i, int $angle) => imagerotate($i, $angle, 0) ?: $i;
        switch ($orientation) {
            case 2: imageflip($img, IMG_FLIP_HORIZONTAL);
                break;
            case 3: $img = $rotate($img, 180);
                break;
            case 4: imageflip($img, IMG_FLIP_VERTICAL);
                break;
            case 5: $img = $rotate($img, -90);
                imageflip($img, IMG_FLIP_HORIZONTAL);
                break;
            case 6: $img = $rotate($img, -90);
                break;
            case 7: $img = $rotate($img, 90);
                imageflip($img, IMG_FLIP_HORIZONTAL);
                break;
            case 8: $img = $rotate($img, 90);
                break;
        }

        return $img;
    }

    /**
     * The EXIF orientation of a JPEG, read straight from its bytes (the server
     * image has no exif extension). 1 when there is none.
     */
    public static function orientation(string $bytes): int
    {
        if (substr($bytes, 0, 2) !== "\xFF\xD8") {
            return 1;
        }
        $pos = 2;
        $len = strlen($bytes);
        while ($pos + 4 <= $len && $bytes[$pos] === "\xFF") {
            $marker = ord($bytes[$pos + 1]);
            $size = unpack('n', substr($bytes, $pos + 2, 2))[1];
            if ($marker === 0xE1 && substr($bytes, $pos + 4, 6) === "Exif\0\0") {
                $tiff = $pos + 10;
                $little = substr($bytes, $tiff, 2) === 'II';
                $u16 = fn (int $at) => unpack($little ? 'v' : 'n', substr($bytes, $at, 2))[1] ?? 0;
                $u32 = fn (int $at) => unpack($little ? 'V' : 'N', substr($bytes, $at, 4))[1] ?? 0;
                $ifd = $tiff + $u32($tiff + 4);
                $count = $u16($ifd);
                for ($i = 0; $i < $count; $i++) {
                    $entry = $ifd + 2 + $i * 12;
                    if ($entry + 12 > $len) {
                        break;
                    }
                    if ($u16($entry) === 0x0112) {
                        $value = $u16($entry + 8);

                        return $value >= 1 && $value <= 8 ? $value : 1;
                    }
                }

                return 1;
            }
            if ($marker === 0xDA) {
                break; // image data starts; no EXIF before it
            }
            $pos += 2 + $size;
        }

        return 1;
    }
}
