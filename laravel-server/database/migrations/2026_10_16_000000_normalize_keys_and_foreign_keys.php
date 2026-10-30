<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Key normalisation.
 *
 *  - Every application table's primary key is named after its table
 *    (products.product_id, sales.sale_id, ...), and a foreign key carries the
 *    same name as the key it points to.
 *  - Links that were free text become real foreign keys: the stock ledger
 *    points at the exact sale / purchase / spoiled-item record that caused it,
 *    cost anomalies point at their purchase, recommendations point at the
 *    forecast run that produced them, sales.verified_by and sessions.user_id
 *    are constrained.
 *
 * Laravel's own tables (sessions, personal_access_tokens, cache, jobs, ...)
 * keep their framework `id` column.
 *
 * MariaDB 10.4 has no RENAME COLUMN, so columns are renamed with CHANGE and
 * every foreign key is dropped first and re-created afterwards, keeping the
 * ON DELETE / ON UPDATE rule it had.
 */
return new class extends Migration
{
    /** table => new primary key name (old name is always `id`). */
    private const PRIMARY_KEYS = [
        'users' => 'user_id',
        'businesses' => 'business_id',
        'business_users' => 'business_user_id',
        'categories' => 'category_id',
        'suppliers' => 'supplier_id',
        'products' => 'product_id',
        'sales' => 'sale_id',
        'sale_items' => 'sale_item_id',
        'purchases' => 'purchase_id',
        'purchase_items' => 'purchase_item_id',
        'expenses' => 'expense_id',
        'waste_records' => 'waste_record_id',
        'inventory_movements' => 'inventory_movement_id',
        'forecast_runs' => 'forecast_run_id',
        'demand_forecasts' => 'demand_forecast_id',
        'price_forecasts' => 'price_forecast_id',
        'cost_forecasts' => 'cost_forecast_id',
        'recommendations' => 'recommendation_id',
        'alerts' => 'alert_id',
        'cost_anomalies' => 'cost_anomaly_id',
    ];

    /** table => [old foreign key column => new name]. */
    private const FOREIGN_KEY_RENAMES = [
        'businesses' => ['owner_id' => 'owner_user_id'],
        'products' => ['variant_group_id' => 'variant_group_product_id'],
        'sales' => ['verified_by' => 'verified_by_user_id'],
        'inventory_movements' => ['created_by' => 'created_by_user_id'],
        'demand_forecasts' => ['run_id' => 'forecast_run_id'],
        'price_forecasts' => ['run_id' => 'forecast_run_id'],
        'cost_forecasts' => ['run_id' => 'forecast_run_id'],
    ];

    private function schema(): string
    {
        return DB::getDatabaseName();
    }

    private function nullability(string $table, string $column): string
    {
        $row = DB::selectOne(
            'SELECT IS_NULLABLE AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [$this->schema(), $table, $column]
        );

        return ($row && $row->n === 'YES') ? 'NULL' : 'NOT NULL';
    }

    private function columnExists(string $table, string $column): bool
    {
        return (bool) DB::selectOne(
            'SELECT 1 AS x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [$this->schema(), $table, $column]
        );
    }

    private function renameColumn(string $table, string $old, string $new): void
    {
        if (! $this->columnExists($table, $old) || $this->columnExists($table, $new)) {
            return;
        }
        $null = $this->nullability($table, $old);
        DB::statement("ALTER TABLE `{$table}` CHANGE `{$old}` `{$new}` CHAR(36) {$null}");
    }

    /** @return array<int, object> every foreign key defined on the given tables */
    private function foreignKeys(array $tables): array
    {
        $in = implode(',', array_fill(0, count($tables), '?'));

        return DB::select(
            "SELECT k.TABLE_NAME AS tbl, k.CONSTRAINT_NAME AS name, k.COLUMN_NAME AS col,
                    k.REFERENCED_TABLE_NAME AS ref_table, k.REFERENCED_COLUMN_NAME AS ref_col,
                    r.DELETE_RULE AS on_delete, r.UPDATE_RULE AS on_update
             FROM information_schema.KEY_COLUMN_USAGE k
             JOIN information_schema.REFERENTIAL_CONSTRAINTS r
               ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
             WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL AND k.TABLE_NAME IN ({$in})",
            array_merge([$this->schema()], $tables)
        );
    }

    private function dropForeignKeys(array $tables): array
    {
        $fks = $this->foreignKeys($tables);
        foreach ($fks as $fk) {
            DB::statement("ALTER TABLE `{$fk->tbl}` DROP FOREIGN KEY `{$fk->name}`");
        }

        return $fks;
    }

    private function addForeignKey(string $table, string $column, string $refTable, string $refColumn, string $onDelete, string $onUpdate = 'RESTRICT'): void
    {
        $name = "fk_{$table}_{$column}";
        DB::statement(
            "ALTER TABLE `{$table}` ADD CONSTRAINT `{$name}` FOREIGN KEY (`{$column}`) REFERENCES `{$refTable}` (`{$refColumn}`) ON DELETE {$onDelete} ON UPDATE {$onUpdate}"
        );
    }

    private function dropIndexIfExists(string $table, string $index): void
    {
        $exists = DB::selectOne(
            'SELECT 1 AS x FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
            [$this->schema(), $table, $index]
        );
        if ($exists) {
            DB::statement("ALTER TABLE `{$table}` DROP INDEX `{$index}`");
        }
    }

    public function up(): void
    {
        $tables = array_keys(self::PRIMARY_KEYS);
        $old = $this->dropForeignKeys(array_merge($tables, ['sessions']));

        // 1. primary keys and renamed foreign keys
        foreach (self::PRIMARY_KEYS as $table => $pk) {
            $this->renameColumn($table, 'id', $pk);
        }
        foreach (self::FOREIGN_KEY_RENAMES as $table => $map) {
            foreach ($map as $from => $to) {
                $this->renameColumn($table, $from, $to);
            }
        }

        // 2. stock ledger: exact source record instead of reference_type/reference_id
        foreach (['sale_id', 'purchase_id', 'waste_record_id'] as $col) {
            if (! $this->columnExists('inventory_movements', $col)) {
                DB::statement("ALTER TABLE inventory_movements ADD COLUMN `{$col}` CHAR(36) NULL AFTER movement_type");
            }
        }
        if ($this->columnExists('inventory_movements', 'reference_type')) {
            DB::statement("UPDATE inventory_movements m JOIN sales s ON s.sale_id = m.reference_id SET m.sale_id = s.sale_id WHERE m.reference_type = 'sale'");
            DB::statement("UPDATE inventory_movements m JOIN purchases p ON p.purchase_id = m.reference_id SET m.purchase_id = p.purchase_id WHERE m.reference_type = 'purchase'");
            DB::statement("UPDATE inventory_movements m JOIN waste_records w ON w.waste_record_id = m.reference_id SET m.waste_record_id = w.waste_record_id WHERE m.reference_type = 'waste'");
            $this->dropIndexIfExists('inventory_movements', 'inventory_movements_reference_idx');
            DB::statement('ALTER TABLE inventory_movements DROP COLUMN reference_type, DROP COLUMN reference_id');
            DB::statement('CREATE INDEX inventory_movements_sale_idx ON inventory_movements (sale_id)');
            DB::statement('CREATE INDEX inventory_movements_purchase_idx ON inventory_movements (purchase_id)');
            DB::statement('CREATE INDEX inventory_movements_waste_idx ON inventory_movements (waste_record_id)');
            DB::statement('ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_single_source CHECK ((sale_id IS NOT NULL) + (purchase_id IS NOT NULL) + (waste_record_id IS NOT NULL) <= 1)');
        }

        // 3. cost anomalies point at the purchase they came from
        if (! $this->columnExists('cost_anomalies', 'purchase_id')) {
            DB::statement('ALTER TABLE cost_anomalies ADD COLUMN purchase_id CHAR(36) NULL AFTER product_id');
            DB::statement("UPDATE cost_anomalies a JOIN purchases p ON p.purchase_id = a.reference_id SET a.purchase_id = p.purchase_id WHERE a.reference_type = 'purchase'");
            DB::statement('ALTER TABLE cost_anomalies DROP COLUMN reference_type, DROP COLUMN reference_id');
        }

        // 4. recommendations remember the run that produced them
        if (! $this->columnExists('recommendations', 'forecast_run_id')) {
            DB::statement('ALTER TABLE recommendations ADD COLUMN forecast_run_id CHAR(36) NULL AFTER product_id');
            DB::statement(
                'UPDATE recommendations r SET r.forecast_run_id = (
                    SELECT f.forecast_run_id FROM forecast_runs f WHERE f.business_id = r.business_id ORDER BY f.started_at DESC LIMIT 1
                 )'
            );
        }

        // 5. clean values that would violate the new constraints
        DB::statement('UPDATE sales SET verified_by_user_id = NULL WHERE verified_by_user_id IS NOT NULL AND verified_by_user_id NOT IN (SELECT user_id FROM users)');
        DB::statement('UPDATE sessions SET user_id = NULL WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT user_id FROM users)');

        // 6. foreign keys: the ones that existed (renamed), then the new ones
        $pk = self::PRIMARY_KEYS;
        $done = [];
        foreach ($old as $fk) {
            $col = self::FOREIGN_KEY_RENAMES[$fk->tbl][$fk->col] ?? $fk->col;
            $refCol = $pk[$fk->ref_table] ?? $fk->ref_col;
            if ($fk->tbl === 'inventory_movements' && $col === 'reference_id') {
                continue;
            }
            $this->addForeignKey($fk->tbl, $col, $fk->ref_table, $refCol, $fk->on_delete, $fk->on_update);
            $done[$fk->tbl.'.'.$col] = true;
        }
        $new = [
            ['sales', 'verified_by_user_id', 'users', 'user_id', 'SET NULL'],
            ['inventory_movements', 'sale_id', 'sales', 'sale_id', 'CASCADE'],
            ['inventory_movements', 'purchase_id', 'purchases', 'purchase_id', 'CASCADE'],
            ['inventory_movements', 'waste_record_id', 'waste_records', 'waste_record_id', 'CASCADE'],
            ['inventory_movements', 'created_by_user_id', 'users', 'user_id', 'SET NULL'],
            ['cost_anomalies', 'purchase_id', 'purchases', 'purchase_id', 'CASCADE'],
            ['recommendations', 'forecast_run_id', 'forecast_runs', 'forecast_run_id', 'SET NULL'],
            ['sessions', 'user_id', 'users', 'user_id', 'CASCADE'],
        ];
        foreach ($new as [$t, $c, $rt, $rc, $del]) {
            if (! isset($done[$t.'.'.$c])) {
                $this->addForeignKey($t, $c, $rt, $rc, $del);
            }
        }
    }

    public function down(): void
    {
        $tables = array_keys(self::PRIMARY_KEYS);
        $this->dropForeignKeys(array_merge($tables, ['sessions']));

        // ledger and anomalies back to reference_type / reference_id
        DB::statement('ALTER TABLE inventory_movements DROP CONSTRAINT inventory_movements_single_source');
        DB::statement("ALTER TABLE inventory_movements ADD COLUMN reference_type VARCHAR(20) NULL AFTER quantity, ADD COLUMN reference_id CHAR(36) NULL AFTER reference_type");
        DB::statement("UPDATE inventory_movements SET reference_type = 'sale', reference_id = sale_id WHERE sale_id IS NOT NULL");
        DB::statement("UPDATE inventory_movements SET reference_type = 'purchase', reference_id = purchase_id WHERE purchase_id IS NOT NULL");
        DB::statement("UPDATE inventory_movements SET reference_type = 'waste', reference_id = waste_record_id WHERE waste_record_id IS NOT NULL");
        DB::statement("UPDATE inventory_movements SET reference_type = 'adjustment' WHERE reference_type IS NULL AND movement_type = 'ADJUSTMENT'");
        DB::statement('DROP INDEX inventory_movements_sale_idx ON inventory_movements');
        DB::statement('DROP INDEX inventory_movements_purchase_idx ON inventory_movements');
        DB::statement('DROP INDEX inventory_movements_waste_idx ON inventory_movements');
        DB::statement('ALTER TABLE inventory_movements DROP COLUMN sale_id, DROP COLUMN purchase_id, DROP COLUMN waste_record_id');
        DB::statement('CREATE INDEX inventory_movements_reference_idx ON inventory_movements (reference_type, reference_id)');

        DB::statement('ALTER TABLE cost_anomalies ADD COLUMN reference_type VARCHAR(20) NULL, ADD COLUMN reference_id CHAR(36) NULL');
        DB::statement("UPDATE cost_anomalies SET reference_type = 'purchase', reference_id = purchase_id WHERE purchase_id IS NOT NULL");
        DB::statement('ALTER TABLE cost_anomalies DROP COLUMN purchase_id');
        DB::statement('ALTER TABLE recommendations DROP COLUMN forecast_run_id');

        foreach (self::FOREIGN_KEY_RENAMES as $table => $map) {
            foreach ($map as $from => $to) {
                $this->renameColumn($table, $to, $from);
            }
        }
        foreach (self::PRIMARY_KEYS as $table => $pk) {
            $this->renameColumn($table, $pk, 'id');
        }

        // original foreign keys (rules as in the base schema)
        $fks = [
            ['businesses', 'owner_id', 'users', 'RESTRICT'],
            ['business_users', 'business_id', 'businesses', 'CASCADE'],
            ['business_users', 'user_id', 'users', 'CASCADE'],
            ['categories', 'business_id', 'businesses', 'CASCADE'],
            ['suppliers', 'business_id', 'businesses', 'CASCADE'],
            ['products', 'business_id', 'businesses', 'CASCADE'],
            ['products', 'category_id', 'categories', 'SET NULL'],
            ['products', 'supplier_id', 'suppliers', 'SET NULL'],
            ['products', 'variant_group_id', 'products', 'SET NULL'],
            ['sales', 'business_id', 'businesses', 'CASCADE'],
            ['sales', 'user_id', 'users', 'SET NULL'],
            ['sale_items', 'sale_id', 'sales', 'CASCADE'],
            ['sale_items', 'product_id', 'products', 'RESTRICT'],
            ['purchases', 'business_id', 'businesses', 'CASCADE'],
            ['purchases', 'supplier_id', 'suppliers', 'SET NULL'],
            ['purchases', 'user_id', 'users', 'SET NULL'],
            ['purchase_items', 'purchase_id', 'purchases', 'CASCADE'],
            ['purchase_items', 'product_id', 'products', 'RESTRICT'],
            ['inventory_movements', 'business_id', 'businesses', 'CASCADE'],
            ['inventory_movements', 'product_id', 'products', 'CASCADE'],
            ['inventory_movements', 'created_by', 'users', 'SET NULL'],
            ['expenses', 'business_id', 'businesses', 'CASCADE'],
            ['expenses', 'user_id', 'users', 'SET NULL'],
            ['waste_records', 'business_id', 'businesses', 'CASCADE'],
            ['waste_records', 'product_id', 'products', 'RESTRICT'],
            ['waste_records', 'user_id', 'users', 'SET NULL'],
            ['forecast_runs', 'business_id', 'businesses', 'CASCADE'],
            ['demand_forecasts', 'business_id', 'businesses', 'CASCADE'],
            ['demand_forecasts', 'product_id', 'products', 'CASCADE'],
            ['demand_forecasts', 'run_id', 'forecast_runs', 'SET NULL'],
            ['price_forecasts', 'business_id', 'businesses', 'CASCADE'],
            ['price_forecasts', 'product_id', 'products', 'CASCADE'],
            ['price_forecasts', 'run_id', 'forecast_runs', 'SET NULL'],
            ['cost_forecasts', 'business_id', 'businesses', 'CASCADE'],
            ['cost_forecasts', 'product_id', 'products', 'CASCADE'],
            ['cost_forecasts', 'run_id', 'forecast_runs', 'SET NULL'],
            ['alerts', 'business_id', 'businesses', 'CASCADE'],
            ['alerts', 'product_id', 'products', 'CASCADE'],
            ['recommendations', 'business_id', 'businesses', 'CASCADE'],
            ['recommendations', 'product_id', 'products', 'CASCADE'],
            ['cost_anomalies', 'business_id', 'businesses', 'CASCADE'],
            ['cost_anomalies', 'product_id', 'products', 'CASCADE'],
        ];
        foreach ($fks as [$t, $c, $rt, $del]) {
            DB::statement("ALTER TABLE `{$t}` ADD CONSTRAINT `fk_{$t}_{$c}` FOREIGN KEY (`{$c}`) REFERENCES `{$rt}` (`id`) ON DELETE {$del}");
        }
    }
};
