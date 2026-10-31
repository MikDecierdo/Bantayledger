<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use PDO;
use Throwable;

/**
 * Copies the store's data from one MySQL database to another — for example a
 * backup of the live Aiven database onto this laptop, or moving to a new Aiven
 * database in another region (docs/DEPLOY_RENDER.md, "Move the database").
 *
 * Everything is asked at the keyboard; passwords are typed hidden. Sign-in
 * tokens, sessions, caches, queued jobs, offline-sync keys and password-reset
 * links are not copied (people simply sign in again). Generated columns are
 * left out because the database fills them itself.
 */
class CopyDatabase extends Command
{
    protected $signature = 'db:copy';

    protected $description = 'Copy all store data from one MySQL database to another (backup, or moving to a new region)';

    private const SKIP = [
        'migrations', 'personal_access_tokens', 'sessions', 'cache', 'cache_locks',
        'jobs', 'job_batches', 'failed_jobs', 'idempotency_keys', 'password_reset_tokens',
    ];

    private const CHUNK = 500;

    public function handle(): int
    {
        $this->info('Copy BantayLedger data between two databases.');
        $this->line('Nothing is deleted from the database you copy FROM.');
        $this->newLine();

        $this->connect('copy_from', 'FROM (the database to copy from)');
        $this->connect('copy_to', 'TO (the database to copy into)');

        $from = DB::connection('copy_from');
        $to = DB::connection('copy_to');

        if (! $this->hasTable('copy_to', 'migrations')) {
            if (! $this->confirm('The TO database has no BantayLedger tables yet. Create them now?', true)) {
                $this->error('Nothing copied.');

                return self::FAILURE;
            }
            Artisan::call('migrate', ['--database' => 'copy_to', '--force' => true], $this->output);
        }

        $tables = collect($from->select("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name"))
            ->pluck('t')->reject(fn ($t) => in_array($t, self::SKIP, true))->values();

        $missing = $tables->reject(fn ($t) => $this->hasTable('copy_to', $t));
        if ($missing->isNotEmpty()) {
            $this->error('The TO database is missing tables: ' . $missing->implode(', ') . '. Run the migrations on it first.');

            return self::FAILURE;
        }

        $notEmpty = $tables->filter(fn ($t) => $to->table($t)->exists());
        if ($notEmpty->isNotEmpty()) {
            $this->warn('The TO database already has data in: ' . $notEmpty->implode(', '));
            if (! $this->confirm('Empty those tables in the TO database and copy fresh?', false)) {
                $this->error('Nothing copied.');

                return self::FAILURE;
            }
        }

        $to->statement('SET FOREIGN_KEY_CHECKS = 0');
        try {
            foreach ($notEmpty as $t) {
                $to->table($t)->delete();
            }

            $results = [];
            foreach ($tables as $t) {
                $columns = $this->copyableColumns($t);
                $count = 0;
                $batch = [];
                foreach ($from->table($t)->select($columns)->cursor() as $row) {
                    $batch[] = (array) $row;
                    if (count($batch) >= self::CHUNK) {
                        $to->table($t)->insert($batch);
                        $count += count($batch);
                        $batch = [];
                    }
                }
                if ($batch) {
                    $to->table($t)->insert($batch);
                    $count += count($batch);
                }
                $results[] = [$t, $count, $to->table($t)->count()];
            }
        } finally {
            $to->statement('SET FOREIGN_KEY_CHECKS = 1');
        }

        $this->newLine();
        $this->table(['Table', 'Copied', 'Now in TO'], $results);

        $bad = array_filter($results, fn ($r) => $r[1] !== $r[2]);
        if ($bad) {
            $this->error('Some tables do not match. Do not switch over yet.');

            return self::FAILURE;
        }
        $this->info('Done: every table matches.');

        return self::SUCCESS;
    }

    /** Asks for one side's connection details and checks that it connects. */
    private function connect(string $name, string $label): void
    {
        for ($attempt = 1; ; $attempt++) {
            if ($attempt > 3) {
                throw new \RuntimeException("Could not connect to the $label database after 3 tries.");
            }
            $this->line("<comment>$label</comment>");
            $host = $this->ask('  Host', '127.0.0.1');
            $port = $this->ask('  Port', '3306');
            $database = $this->ask('  Database name', 'defaultdb');
            $user = $this->ask('  User', 'avnadmin');
            $password = (string) $this->secret('  Password (hidden; press Enter if none)');
            $ca = trim((string) $this->ask('  CA certificate file for Aiven, e.g. C:\Users\you\Downloads\ca.pem (Enter if none)', ''), " \"'");

            $options = [];
            if ($ca !== '') {
                if (! is_file($ca)) {
                    $this->error("  Can't find $ca. Try again.");

                    continue;
                }
                $options[PHP_VERSION_ID >= 80500 ? \Pdo\Mysql::ATTR_SSL_CA : PDO::MYSQL_ATTR_SSL_CA] = $ca;
            }

            config(["database.connections.$name" => [
                'driver' => 'mysql',
                'host' => $host,
                'port' => $port,
                'database' => $database,
                'username' => $user,
                'password' => $password,
                'charset' => 'utf8mb4',
                'collation' => 'utf8mb4_unicode_ci',
                'prefix' => '',
                'strict' => false,
                'options' => $options,
            ]]);
            DB::purge($name);

            try {
                DB::connection($name)->getPdo();
                $this->info("  Connected to $database on $host.");
                $this->newLine();

                return;
            } catch (Throwable $e) {
                $this->error('  Could not connect: ' . $e->getMessage());
                $this->line('  Check the details and try again.');
            }
        }
    }

    private function hasTable(string $connection, string $table): bool
    {
        return DB::connection($connection)->table('information_schema.tables')
            ->whereRaw('table_schema = DATABASE()')->where('table_name', $table)->exists();
    }

    /** Columns present in both databases, without the ones the database computes itself. */
    private function copyableColumns(string $table): array
    {
        $read = fn (string $c) => collect(DB::connection($c)->select(
            "SELECT column_name AS c, extra AS e FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position",
            [$table],
        ));

        $source = $read('copy_from')->reject(fn ($r) => str_contains(strtoupper((string) $r->e), 'GENERATED'))->pluck('c');
        $target = $read('copy_to')->reject(fn ($r) => str_contains(strtoupper((string) $r->e), 'GENERATED'))->pluck('c');

        return $source->intersect($target)->values()->all();
    }
}
