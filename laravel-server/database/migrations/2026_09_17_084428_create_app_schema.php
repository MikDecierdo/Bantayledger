<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * BantayLedger app schema — ported from the original Postgres/Supabase
 * schema (supabase/migrations/0001_schema.sql), by way of the earlier
 * Node/Express+Knex port (server/migrations/20260101000001_initial_schema.js).
 * Same MySQL DDL, same translation notes apply (uuid -> CHAR(36) generated
 * app-side, timestamptz -> DATETIME(3) UTC, numeric -> DECIMAL, boolean ->
 * TINYINT(1)) — the one difference from the Node port is that `profiles` is
 * merged into Laravel's own `users` table rather than kept separate, so
 * every FK below points at `users` directly.
 *
 * Business-rule triggers and RLS policies are NOT ported here, same as the
 * Node version — that logic lives in app/Services/InventoryService.php and
 * the EnsureBusinessMember/EnsureBusinessManager middleware, wrapped in DB
 * transactions, not in MySQL triggers/RLS-equivalents.
 */
return new class extends Migration
{
    public function up(): void
    {
        $raw = fn (string $sql) => DB::statement($sql);

        $raw("
            CREATE TABLE businesses (
              id             CHAR(36) NOT NULL PRIMARY KEY,
              name           VARCHAR(160) NOT NULL,
              business_type  VARCHAR(100),
              address        TEXT,
              phone          VARCHAR(50),
              email          VARCHAR(255),
              currency       CHAR(3) NOT NULL DEFAULT 'PHP',
              owner_id       CHAR(36) NOT NULL,
              created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              updated_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
              CONSTRAINT businesses_name_len CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 160),
              CONSTRAINT businesses_currency_len CHECK (CHAR_LENGTH(currency) = 3),
              CONSTRAINT fk_businesses_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        $raw("
            CREATE TABLE business_users (
              id           CHAR(36) NOT NULL PRIMARY KEY,
              business_id  CHAR(36) NOT NULL,
              user_id      CHAR(36) NOT NULL,
              role         VARCHAR(10) NOT NULL DEFAULT 'STAFF',
              created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT business_users_role_check CHECK (role IN ('OWNER', 'ADMIN', 'STAFF')),
              CONSTRAINT business_users_unique UNIQUE (business_id, user_id),
              CONSTRAINT fk_bu_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_bu_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX business_users_user_id_idx ON business_users (user_id);");
        $raw("CREATE INDEX business_users_business_id_idx ON business_users (business_id);");

        $raw("
            CREATE TABLE categories (
              id           CHAR(36) NOT NULL PRIMARY KEY,
              business_id  CHAR(36) NOT NULL,
              name         VARCHAR(80) NOT NULL,
              description  TEXT,
              created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT categories_business_id_name_key UNIQUE (business_id, name),
              CONSTRAINT categories_name_len CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 80),
              CONSTRAINT fk_categories_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX categories_business_id_idx ON categories (business_id);");

        $raw("
            CREATE TABLE suppliers (
              id              CHAR(36) NOT NULL PRIMARY KEY,
              business_id     CHAR(36) NOT NULL,
              name            VARCHAR(160) NOT NULL,
              contact_person  VARCHAR(160),
              phone           VARCHAR(50),
              email           VARCHAR(255),
              address         TEXT,
              status          VARCHAR(10) NOT NULL DEFAULT 'active',
              created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
              CONSTRAINT suppliers_business_id_name_key UNIQUE (business_id, name),
              CONSTRAINT suppliers_status_check CHECK (status IN ('active', 'review', 'inactive')),
              CONSTRAINT fk_suppliers_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX suppliers_business_id_idx ON suppliers (business_id);");

        $raw("
            CREATE TABLE products (
              id                CHAR(36) NOT NULL PRIMARY KEY,
              business_id       CHAR(36) NOT NULL,
              category_id       CHAR(36),
              supplier_id       CHAR(36),
              name              VARCHAR(255) NOT NULL,
              sku               VARCHAR(100),
              description       TEXT,
              unit              VARCHAR(20) NOT NULL DEFAULT 'pcs',
              current_stock     DECIMAL(14,3) NOT NULL DEFAULT 0,
              minimum_stock     DECIMAL(14,3) NOT NULL DEFAULT 0,
              maximum_stock     DECIMAL(14,3),
              reorder_quantity  DECIMAL(14,3) NOT NULL DEFAULT 0,
              cost_price        DECIMAL(14,2) NOT NULL DEFAULT 0,
              selling_price     DECIMAL(14,2) NOT NULL DEFAULT 0,
              status            VARCHAR(10) NOT NULL DEFAULT 'healthy',
              created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
              CONSTRAINT products_business_id_name_key UNIQUE (business_id, name),
              CONSTRAINT products_business_id_sku_key UNIQUE (business_id, sku),
              CONSTRAINT products_status_check CHECK (status IN ('healthy', 'low', 'critical', 'out')),
              CONSTRAINT products_current_stock_check CHECK (current_stock >= 0),
              CONSTRAINT products_minimum_stock_check CHECK (minimum_stock >= 0),
              CONSTRAINT products_maximum_stock_check CHECK (maximum_stock IS NULL OR maximum_stock >= minimum_stock),
              CONSTRAINT products_reorder_quantity_check CHECK (reorder_quantity >= 0),
              CONSTRAINT products_cost_price_check CHECK (cost_price >= 0),
              CONSTRAINT products_selling_price_check CHECK (selling_price >= 0),
              CONSTRAINT fk_products_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
              CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX products_business_id_idx ON products (business_id);");
        $raw("CREATE INDEX products_category_id_idx ON products (category_id);");
        $raw("CREATE INDEX products_supplier_id_idx ON products (supplier_id);");
        $raw("CREATE INDEX products_business_status_idx ON products (business_id, status);");

        $raw("
            CREATE TABLE sales (
              id              CHAR(36) NOT NULL PRIMARY KEY,
              business_id     CHAR(36) NOT NULL,
              user_id         CHAR(36),
              reference       VARCHAR(100),
              total_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
              payment_method  VARCHAR(20) NOT NULL DEFAULT 'Cash',
              sale_date       DATE NOT NULL DEFAULT (CURRENT_DATE),
              notes           TEXT,
              created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT sales_total_amount_check CHECK (total_amount >= 0),
              CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('Cash', 'GCash', 'Maya', 'Card', 'Other')),
              CONSTRAINT sales_business_id_reference_key UNIQUE (business_id, reference),
              CONSTRAINT fk_sales_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_sales_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX sales_business_id_date_idx ON sales (business_id, sale_date DESC);");
        $raw("CREATE INDEX sales_created_at_idx ON sales (created_at DESC);");

        $raw("
            CREATE TABLE sale_items (
              id          CHAR(36) NOT NULL PRIMARY KEY,
              sale_id     CHAR(36) NOT NULL,
              product_id  CHAR(36) NOT NULL,
              quantity    DECIMAL(14,3) NOT NULL,
              unit_price  DECIMAL(14,2) NOT NULL,
              subtotal    DECIMAL(14,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
              CONSTRAINT sale_items_quantity_check CHECK (quantity > 0),
              CONSTRAINT sale_items_unit_price_check CHECK (unit_price >= 0),
              CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
              CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX sale_items_sale_id_idx ON sale_items (sale_id);");
        $raw("CREATE INDEX sale_items_product_id_idx ON sale_items (product_id);");

        $raw("
            CREATE TABLE purchases (
              id             CHAR(36) NOT NULL PRIMARY KEY,
              business_id    CHAR(36) NOT NULL,
              supplier_id    CHAR(36),
              user_id        CHAR(36),
              reference      VARCHAR(100),
              total_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
              status         VARCHAR(10) NOT NULL DEFAULT 'received',
              purchase_date  DATE NOT NULL DEFAULT (CURRENT_DATE),
              notes          TEXT,
              created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT purchases_total_amount_check CHECK (total_amount >= 0),
              CONSTRAINT purchases_status_check CHECK (status IN ('received', 'pending', 'cancelled')),
              CONSTRAINT purchases_business_id_reference_key UNIQUE (business_id, reference),
              CONSTRAINT fk_purchases_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL,
              CONSTRAINT fk_purchases_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX purchases_business_id_date_idx ON purchases (business_id, purchase_date DESC);");
        $raw("CREATE INDEX purchases_supplier_id_idx ON purchases (supplier_id);");

        $raw("
            CREATE TABLE purchase_items (
              id           CHAR(36) NOT NULL PRIMARY KEY,
              purchase_id  CHAR(36) NOT NULL,
              product_id   CHAR(36) NOT NULL,
              quantity     DECIMAL(14,3) NOT NULL,
              unit_cost    DECIMAL(14,2) NOT NULL,
              subtotal     DECIMAL(14,2) GENERATED ALWAYS AS (ROUND(quantity * unit_cost, 2)) STORED,
              CONSTRAINT purchase_items_quantity_check CHECK (quantity > 0),
              CONSTRAINT purchase_items_unit_cost_check CHECK (unit_cost >= 0),
              CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases (id) ON DELETE CASCADE,
              CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX purchase_items_purchase_id_idx ON purchase_items (purchase_id);");
        $raw("CREATE INDEX purchase_items_product_id_idx ON purchase_items (product_id);");

        $raw("
            CREATE TABLE inventory_movements (
              id              CHAR(36) NOT NULL PRIMARY KEY,
              business_id     CHAR(36) NOT NULL,
              product_id      CHAR(36) NOT NULL,
              movement_type   VARCHAR(10) NOT NULL,
              quantity        DECIMAL(14,3) NOT NULL,
              reference_type  VARCHAR(20),
              reference_id    CHAR(36),
              notes           TEXT,
              created_by      CHAR(36),
              created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT inventory_movements_type_check
                CHECK (movement_type IN ('PURCHASE', 'SALE', 'WASTE', 'ADJUSTMENT', 'RETURN')),
              CONSTRAINT inventory_movements_quantity_nonzero CHECK (quantity <> 0),
              CONSTRAINT inventory_movements_sign_check CHECK (
                (movement_type IN ('PURCHASE', 'RETURN') AND quantity > 0)
                OR (movement_type IN ('SALE', 'WASTE') AND quantity < 0)
                OR (movement_type = 'ADJUSTMENT')
              ),
              CONSTRAINT fk_im_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_im_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
              CONSTRAINT fk_im_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX inventory_movements_business_id_idx ON inventory_movements (business_id);");
        $raw("CREATE INDEX inventory_movements_product_created_idx ON inventory_movements (product_id, created_at DESC);");
        $raw("CREATE INDEX inventory_movements_reference_idx ON inventory_movements (reference_type, reference_id);");

        $raw("
            CREATE TABLE expenses (
              id            CHAR(36) NOT NULL PRIMARY KEY,
              business_id   CHAR(36) NOT NULL,
              user_id       CHAR(36),
              category      VARCHAR(100) NOT NULL,
              description   VARCHAR(300) NOT NULL,
              amount        DECIMAL(14,2) NOT NULL,
              expense_date  DATE NOT NULL DEFAULT (CURRENT_DATE),
              created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT expenses_amount_check CHECK (amount >= 0),
              CONSTRAINT expenses_description_len CHECK (CHAR_LENGTH(description) BETWEEN 1 AND 300),
              CONSTRAINT fk_expenses_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_expenses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX expenses_business_id_date_idx ON expenses (business_id, expense_date DESC);");

        $raw("
            CREATE TABLE waste_records (
              id              CHAR(36) NOT NULL PRIMARY KEY,
              business_id     CHAR(36) NOT NULL,
              product_id      CHAR(36) NOT NULL,
              user_id         CHAR(36),
              quantity        DECIMAL(14,3) NOT NULL,
              reason          VARCHAR(20) NOT NULL,
              estimated_cost  DECIMAL(14,2) NOT NULL DEFAULT 0,
              waste_date      DATE NOT NULL DEFAULT (CURRENT_DATE),
              notes           TEXT,
              created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT waste_records_quantity_check CHECK (quantity > 0),
              CONSTRAINT waste_records_estimated_cost_check CHECK (estimated_cost >= 0),
              CONSTRAINT waste_records_reason_check
                CHECK (reason IN ('Expired', 'Damaged', 'Spoiled', 'Spillage', 'Customer Return')),
              CONSTRAINT fk_waste_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_waste_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
              CONSTRAINT fk_waste_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX waste_records_business_id_date_idx ON waste_records (business_id, waste_date DESC);");
        $raw("CREATE INDEX waste_records_product_id_idx ON waste_records (product_id);");

        $raw("
            CREATE TABLE forecast_runs (
              id             CHAR(36) NOT NULL PRIMARY KEY,
              business_id    CHAR(36) NOT NULL,
              model_version  VARCHAR(50) NOT NULL DEFAULT 'unversioned',
              status         VARCHAR(10) NOT NULL DEFAULT 'pending',
              started_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              completed_at   DATETIME(3),
              error_message  TEXT,
              created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT forecast_runs_status_check CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
              CONSTRAINT fk_forecast_runs_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX forecast_runs_business_id_idx ON forecast_runs (business_id, started_at DESC);");

        $raw("
            CREATE TABLE demand_forecasts (
              id                  CHAR(36) NOT NULL PRIMARY KEY,
              business_id         CHAR(36) NOT NULL,
              product_id          CHAR(36) NOT NULL,
              run_id              CHAR(36),
              forecast_date       DATE NOT NULL,
              predicted_quantity  DECIMAL(14,3) NOT NULL,
              lower_bound         DECIMAL(14,3),
              upper_bound         DECIMAL(14,3),
              confidence          DECIMAL(5,2),
              model_version       VARCHAR(50),
              created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT demand_forecasts_quantity_check CHECK (predicted_quantity >= 0),
              CONSTRAINT demand_forecasts_bounds_check
                CHECK (lower_bound IS NULL OR upper_bound IS NULL OR lower_bound <= upper_bound),
              CONSTRAINT demand_forecasts_confidence_check
                CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
              CONSTRAINT demand_forecasts_unique UNIQUE (business_id, product_id, forecast_date, run_id),
              CONSTRAINT fk_demand_forecasts_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_demand_forecasts_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
              CONSTRAINT fk_demand_forecasts_run FOREIGN KEY (run_id) REFERENCES forecast_runs (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX demand_forecasts_lookup_idx ON demand_forecasts (business_id, product_id, forecast_date);");

        $raw("
            CREATE TABLE price_forecasts (
              id               CHAR(36) NOT NULL PRIMARY KEY,
              business_id      CHAR(36) NOT NULL,
              product_id       CHAR(36) NOT NULL,
              run_id           CHAR(36),
              forecast_date    DATE NOT NULL,
              predicted_price  DECIMAL(14,2) NOT NULL,
              lower_bound      DECIMAL(14,2),
              upper_bound      DECIMAL(14,2),
              confidence       DECIMAL(5,2),
              model_version    VARCHAR(50),
              created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT price_forecasts_price_check CHECK (predicted_price >= 0),
              CONSTRAINT price_forecasts_bounds_check
                CHECK (lower_bound IS NULL OR upper_bound IS NULL OR lower_bound <= upper_bound),
              CONSTRAINT price_forecasts_confidence_check
                CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
              CONSTRAINT price_forecasts_unique UNIQUE (business_id, product_id, forecast_date, run_id),
              CONSTRAINT fk_price_forecasts_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_price_forecasts_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
              CONSTRAINT fk_price_forecasts_run FOREIGN KEY (run_id) REFERENCES forecast_runs (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX price_forecasts_lookup_idx ON price_forecasts (business_id, product_id, forecast_date);");

        $raw("
            CREATE TABLE cost_forecasts (
              id                     CHAR(36) NOT NULL PRIMARY KEY,
              business_id            CHAR(36) NOT NULL,
              product_id             CHAR(36) NOT NULL,
              run_id                 CHAR(36),
              forecast_date          DATE NOT NULL,
              forecasted_quantity    DECIMAL(14,3) NOT NULL,
              forecasted_unit_price  DECIMAL(14,2) NOT NULL,
              forecasted_total_cost  DECIMAL(14,2) NOT NULL,
              confidence             DECIMAL(5,2),
              model_version          VARCHAR(50),
              created_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT cost_forecasts_quantity_check CHECK (forecasted_quantity >= 0),
              CONSTRAINT cost_forecasts_unit_price_check CHECK (forecasted_unit_price >= 0),
              CONSTRAINT cost_forecasts_total_check CHECK (forecasted_total_cost >= 0),
              CONSTRAINT cost_forecasts_confidence_check
                CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
              CONSTRAINT cost_forecasts_unique UNIQUE (business_id, product_id, forecast_date, run_id),
              CONSTRAINT fk_cost_forecasts_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_cost_forecasts_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
              CONSTRAINT fk_cost_forecasts_run FOREIGN KEY (run_id) REFERENCES forecast_runs (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX cost_forecasts_lookup_idx ON cost_forecasts (business_id, product_id, forecast_date);");

        $raw("
            CREATE TABLE alerts (
              id           CHAR(36) NOT NULL PRIMARY KEY,
              business_id  CHAR(36) NOT NULL,
              product_id   CHAR(36),
              type         VARCHAR(20) NOT NULL,
              severity     VARCHAR(10) NOT NULL DEFAULT 'info',
              title        VARCHAR(255) NOT NULL,
              message      TEXT NOT NULL,
              is_read      TINYINT(1) NOT NULL DEFAULT 0,
              created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT alerts_severity_check CHECK (severity IN ('critical', 'warning', 'info')),
              CONSTRAINT alerts_type_check CHECK (type IN ('Inventory', 'Pricing', 'Sales', 'Supplier', 'Expense')),
              CONSTRAINT fk_alerts_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_alerts_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX alerts_business_unread_idx ON alerts (business_id, is_read, created_at DESC);");
        $raw("CREATE INDEX alerts_business_id_created_idx ON alerts (business_id, created_at DESC);");

        $raw("
            CREATE TABLE recommendations (
              id           CHAR(36) NOT NULL PRIMARY KEY,
              business_id  CHAR(36) NOT NULL,
              product_id   CHAR(36),
              type         VARCHAR(20) NOT NULL,
              title        VARCHAR(255) NOT NULL,
              message      TEXT NOT NULL,
              reason       TEXT,
              action       TEXT,
              severity     VARCHAR(10) NOT NULL DEFAULT 'medium',
              confidence   DECIMAL(5,2),
              created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              read_at      DATETIME(3),
              CONSTRAINT recommendations_severity_check CHECK (severity IN ('high', 'medium', 'low')),
              CONSTRAINT recommendations_type_check
                CHECK (type IN ('Inventory', 'Pricing', 'Purchasing', 'Sales', 'Waste')),
              CONSTRAINT recommendations_confidence_check
                CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
              CONSTRAINT fk_recommendations_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_recommendations_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX recommendations_business_id_created_idx ON recommendations (business_id, created_at DESC);");

        $raw("
            CREATE TABLE cost_anomalies (
              id              CHAR(36) NOT NULL PRIMARY KEY,
              business_id     CHAR(36) NOT NULL,
              product_id      CHAR(36),
              reference_type  VARCHAR(20),
              reference_id    CHAR(36),
              expected_cost   DECIMAL(14,2) NOT NULL,
              actual_cost     DECIMAL(14,2) NOT NULL,
              difference      DECIMAL(14,2) GENERATED ALWAYS AS (actual_cost - expected_cost) STORED,
              severity        VARCHAR(10) NOT NULL DEFAULT 'medium',
              explanation     TEXT,
              created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              CONSTRAINT cost_anomalies_expected_check CHECK (expected_cost >= 0),
              CONSTRAINT cost_anomalies_actual_check CHECK (actual_cost >= 0),
              CONSTRAINT cost_anomalies_severity_check CHECK (severity IN ('high', 'medium', 'low')),
              CONSTRAINT fk_cost_anomalies_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
              CONSTRAINT fk_cost_anomalies_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $raw("CREATE INDEX cost_anomalies_business_id_created_idx ON cost_anomalies (business_id, created_at DESC);");
    }

    public function down(): void
    {
        $tablesInReverseDependencyOrder = [
            'cost_anomalies', 'recommendations', 'alerts',
            'cost_forecasts', 'price_forecasts', 'demand_forecasts', 'forecast_runs',
            'waste_records', 'expenses', 'inventory_movements',
            'purchase_items', 'purchases', 'sale_items', 'sales',
            'products', 'suppliers', 'categories', 'business_users', 'businesses',
        ];

        foreach ($tablesInReverseDependencyOrder as $table) {
            DB::statement("DROP TABLE IF EXISTS `{$table}`;");
        }
    }
};
