<?php
/**
 * Dimuat di awal setiap file API.
 * Berisi: session, format respons JSON, helper query (prepared statement),
 * dan helper autentikasi.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

// ---------------------------------------------------------------------------
// Session & header
// ---------------------------------------------------------------------------
session_set_cookie_params([
    'path'     => '/',
    'httponly' => true,   // cookie tidak bisa dibaca JavaScript
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// Error tak terduga -> balas JSON 500 tanpa membocorkan detail ke pengguna
set_exception_handler(function (Throwable $e): void {
    error_log('[FoodHub] ' . $e);
    http_response_code(500);
    echo json_encode(['error' => 'Terjadi kesalahan pada server.']);
});

// ---------------------------------------------------------------------------
// Respons
// ---------------------------------------------------------------------------
function json_out($data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $code = 400): never
{
    json_out(['error' => $message], $code);
}

function method(): string
{
    return $_SERVER['REQUEST_METHOD'];
}

/** Hanya izinkan method tertentu, selain itu 405. */
function allow(string ...$methods): void
{
    if (!in_array(method(), $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        fail('Method tidak diizinkan.', 405);
    }
}

/** Data yang dikirim klien: body JSON, atau form biasa ($_POST). */
function input(): array
{
    static $data = null;
    if ($data === null) {
        $json = json_decode(file_get_contents('php://input') ?: '', true);
        $data = is_array($json) ? $json : $_POST;
    }
    return $data;
}

/** Ambil string dari input, sudah di-trim. */
function str_in(string $key, string $default = ''): string
{
    $v = input()[$key] ?? $default;
    return is_scalar($v) ? trim((string) $v) : $default;
}

// ---------------------------------------------------------------------------
// Query (semua lewat prepared statement -> aman dari SQL Injection)
// ---------------------------------------------------------------------------
function run(string $sql, array $params = []): mysqli_stmt
{
    $stmt = db()->prepare($sql);
    if ($params) {
        $types = '';
        foreach ($params as $p) {
            $types .= is_int($p) ? 'i' : (is_float($p) ? 'd' : 's');
        }
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    return $stmt;
}

/** Banyak baris. */
function rows(string $sql, array $params = []): array
{
    return run($sql, $params)->get_result()->fetch_all(MYSQLI_ASSOC);
}

/** Satu baris, atau null bila tidak ada. */
function row(string $sql, array $params = []): ?array
{
    return run($sql, $params)->get_result()->fetch_assoc() ?: null;
}

// ---------------------------------------------------------------------------
// Autentikasi
// ---------------------------------------------------------------------------
function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    return row(
        'SELECT id, name, email, role, bio, avatar_path, created_at FROM users WHERE id = ?',
        [(int) $_SESSION['user_id']]
    );
}

function require_login(): array
{
    $user = current_user();
    if (!$user) {
        fail('Silakan masuk terlebih dahulu.', 401);
    }
    return $user;
}

function require_admin(): array
{
    $user = require_login();
    if ($user['role'] !== 'admin') {
        fail('Halaman ini khusus admin.', 403);
    }
    return $user;
}

function user_out(array $u): array
{
    return [
        'id'          => (int) $u['id'],
        'name'        => $u['name'],
        'email'       => $u['email'],
        'role'        => $u['role'],
        'bio'         => $u['bio'],
        'avatar_path' => $u['avatar_path'],
        'created_at'  => $u['created_at'],
    ];
}
