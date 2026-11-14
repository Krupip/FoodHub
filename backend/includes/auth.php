<?php

declare(strict_types=1);

function startUserSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('foodhub_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => isset($_SERVER['HTTPS'])
            && $_SERVER['HTTPS'] !== ''
            && strtolower($_SERVER['HTTPS']) !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    if (!session_start()) {
        throw new RuntimeException('Tidak dapat memulai sesi pengguna.');
    }
}
