<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Offline sync: a phone that recorded a sale (or expense, purchase, spoiled
 * item) without signal sends it later with an Idempotency-Key header. If the
 * reply is lost and the phone sends it again, the stored reply is returned
 * instead of recording it twice. See App\Http\Middleware\Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->string('idempotency_key', 64);
            $table->char('user_id', 36);
            $table->string('request_path', 255);
            // 0 while the first request is still running.
            $table->unsignedSmallInteger('response_status')->default(0);
            $table->longText('response_body')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->primary(['user_id', 'idempotency_key']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
    }
};
