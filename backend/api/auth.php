<?php
/**
 * Autentikasi
 *   POST /backend/api/auth.php?action=register  {name, email, password}
 *   POST /backend/api/auth.php?action=login     {email, password, remember}
 *   POST /backend/api/auth.php?action=logout
 *   GET  /backend/api/auth.php?action=me        -> {user: {...} | null}
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'me':
        allow('GET');
        $u = current_user();
        json_out(['user' => $u ? user_out($u) : null]);

    case 'register':
        allow('POST');
        $name     = str_in('name');
        $email    = strtolower(str_in('email'));
        $password = (string) (input()['password'] ?? '');

        if ($name === '' || mb_strlen($name) > 100) {
            fail('Nama wajib diisi (maks. 100 karakter).', 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            fail('Format email tidak valid.', 422);
        }
        if (strlen($password) < 8) {
            fail('Kata sandi minimal 8 karakter.', 422);
        }
        if (row('SELECT id FROM users WHERE email = ?', [$email])) {
            fail('Email sudah terdaftar.', 409);
        }

        run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [$name, $email, password_hash($password, PASSWORD_DEFAULT)]);

        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) db()->insert_id;
        json_out(['user' => user_out(current_user())], 201);

    case 'login':
        allow('POST');
        $email    = strtolower(str_in('email'));
        $password = (string) (input()['password'] ?? '');

        $u = row('SELECT id, password_hash FROM users WHERE email = ?', [$email]);
        if (!$u || !password_verify($password, $u['password_hash'])) {
            fail('Email atau kata sandi salah.', 401);
        }

        session_regenerate_id(true);   // cegah session fixation
        $_SESSION['user_id'] = (int) $u['id'];

        // "Ingat Saya": cookie sesi bertahan 30 hari, bukan hilang saat browser ditutup
        if (!empty(input()['remember'])) {
            $p = session_get_cookie_params();
            setcookie(session_name(), session_id(), [
                'expires'  => time() + 60 * 60 * 24 * 30,
                'path'     => $p['path'],
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        }

        json_out(['user' => user_out(current_user())]);

    case 'logout':
        allow('POST');
        $_SESSION = [];
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path']]);
        session_destroy();
        json_out(['ok' => true]);

    default:
        fail('Action tidak dikenal. Gunakan register, login, logout, atau me.', 404);
}
