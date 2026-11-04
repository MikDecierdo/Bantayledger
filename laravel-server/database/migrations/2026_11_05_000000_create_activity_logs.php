<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * The activity log: who changed a price, a stock level or an expense, when, and
 * from what to what. Rows are only ever added.
 *
 * Unlike inventory_movements, whose rows go when their sale or purchase is
 * deleted, entries stay. So there's deliberately no foreign key to the product
 * or expense, and the names are copied in, to keep an entry readable after the
 * thing it describes is gone. The rising id gives the exact order of events.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->bigIncrements('activity_log_id');
            $table->char('business_id', 36);
            $table->char('user_id', 36)->nullable();
            $table->string('actor_name')->nullable();
            $table->string('category', 10);
            $table->string('action', 30);
            $table->char('subject_id', 36)->nullable();
            $table->string('subject_name', 300);
            $table->decimal('old_value', 14, 3)->nullable();
            $table->decimal('new_value', 14, 3)->nullable();
            $table->string('unit', 20)->nullable();
            $table->string('notes', 500)->nullable();
            $table->date('record_date')->nullable();
            $table->dateTime('created_at');

            $table->index(['business_id', 'activity_log_id']);
            $table->index(['business_id', 'category', 'activity_log_id']);
            $table->foreign('business_id')->references('business_id')->on('businesses')->cascadeOnDelete();
            $table->foreign('user_id')->references('user_id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
