<?php
/**
 * GET /backend/api/health.php
 * Cek apakah backend sudah tersambung ke database.
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

allow('GET');

try {
    $count = row('SELECT COUNT(*) AS n FROM recipes')['n'];
    json_out(['status' => 'ok', 'database' => DB_NAME, 'recipes' => (int) $count]);
} catch (mysqli_sql_exception $e) {
    json_out([
        'status' => 'error',
        'error'  => 'Tidak bisa terhubung ke database. Pastikan MySQL di XAMPP menyala '
                  . 'dan database/foodhub.sql sudah di-import.',
    ], 500);
}
