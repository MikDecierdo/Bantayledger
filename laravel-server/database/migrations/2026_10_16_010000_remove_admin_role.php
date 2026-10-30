<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Two roles only: OWNER (created at sign-up) and STAFF (added by the owner). */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("UPDATE business_users SET role = 'STAFF' WHERE role = 'ADMIN'");
        DB::statement('ALTER TABLE business_users DROP CONSTRAINT business_users_role_check');
        DB::statement("ALTER TABLE business_users ADD CONSTRAINT business_users_role_check CHECK (role IN ('OWNER', 'STAFF'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE business_users DROP CONSTRAINT business_users_role_check');
        DB::statement("ALTER TABLE business_users ADD CONSTRAINT business_users_role_check CHECK (role IN ('OWNER', 'ADMIN', 'STAFF'))");
    }
};
