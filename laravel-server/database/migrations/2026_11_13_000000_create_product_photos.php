<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Product photos kept in the database instead of on the server's disk.
 *
 * The live server (Render free plan) has a temporary disk that is wiped on
 * every deploy and restart, so photos saved as files disappeared. The
 * database is permanent. Photos are shrunk before saving (about 50-150 KB).
 *
 * `token` is random and goes in the photo's address, so the address can't be
 * guessed (an <img> can't send the login token, so the route is public).
 * products.image_path holds "db:<token>" for these photos.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE TABLE product_photos (
            product_id CHAR(36) NOT NULL PRIMARY KEY,
            token CHAR(40) NOT NULL,
            mime VARCHAR(20) NOT NULL,
            bytes INT UNSIGNED NOT NULL,
            data MEDIUMBLOB NOT NULL,
            created_at TIMESTAMP NULL,
            updated_at TIMESTAMP NULL,
            UNIQUE KEY product_photos_token_unique (token),
            CONSTRAINT fk_product_photos_product_id FOREIGN KEY (product_id) REFERENCES products (product_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS product_photos');
    }
};
