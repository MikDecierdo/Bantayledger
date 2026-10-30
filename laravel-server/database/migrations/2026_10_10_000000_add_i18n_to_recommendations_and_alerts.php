<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Insight and alert sentences are stored as an English template plus
 * parameters (JSON), so the same row can be shown in English, Tagalog or
 * Cebuano. The plain `title`/`message`/... columns keep the English text as a
 * fallback and for rows created before this existed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recommendations', function (Blueprint $table) {
            $table->text('i18n')->nullable()->after('supporting');
        });
        Schema::table('alerts', function (Blueprint $table) {
            $table->text('i18n')->nullable()->after('message');
        });
    }

    public function down(): void
    {
        Schema::table('recommendations', function (Blueprint $table) {
            $table->dropColumn('i18n');
        });
        Schema::table('alerts', function (Blueprint $table) {
            $table->dropColumn('i18n');
        });
    }
};
