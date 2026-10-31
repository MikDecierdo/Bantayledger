<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A sale can be paid partly in cash and partly by GCash. Each part is one row
 * in sale_payments; sales.payment_method says Cash, GCash or Mixed for the
 * whole sale. Existing sales get one payment row for their full total.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE TABLE sale_payments (
              sale_payment_id   CHAR(36) NOT NULL PRIMARY KEY,
              sale_id           CHAR(36) NOT NULL,
              payment_method    VARCHAR(10) NOT NULL,
              amount            DECIMAL(14,2) NOT NULL,
              payment_reference VARCHAR(4) NULL,
              created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT sale_payments_method_check CHECK (payment_method IN ('Cash', 'GCash')),
              CONSTRAINT sale_payments_amount_check CHECK (amount > 0),
              CONSTRAINT fk_sale_payments_sale FOREIGN KEY (sale_id) REFERENCES sales (sale_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        DB::statement('CREATE INDEX sale_payments_sale_id_idx ON sale_payments (sale_id)');
        DB::statement('CREATE INDEX sale_payments_method_ref_idx ON sale_payments (payment_method, payment_reference)');

        DB::statement('ALTER TABLE sales DROP CONSTRAINT sales_payment_method_check');
        DB::statement("ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('Cash','GCash','Card','Other','Mixed'))");

        // One payment per existing sale, for its whole total (Card / Other count as Cash).
        DB::statement("
            INSERT INTO sale_payments (sale_payment_id, sale_id, payment_method, amount, payment_reference)
            SELECT UUID(), sale_id,
                   CASE WHEN payment_method = 'GCash' THEN 'GCash' ELSE 'Cash' END,
                   total_amount,
                   CASE WHEN payment_method = 'GCash' THEN payment_reference ELSE NULL END
            FROM sales
            WHERE total_amount > 0
        ");
    }

    public function down(): void
    {
        DB::statement("UPDATE sales SET payment_method = 'Cash' WHERE payment_method = 'Mixed'");
        DB::statement('ALTER TABLE sales DROP CONSTRAINT sales_payment_method_check');
        DB::statement("ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('Cash','GCash','Card','Other'))");
        DB::statement('DROP TABLE sale_payments');
    }
};
