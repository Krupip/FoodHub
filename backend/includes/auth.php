<?php

declare(strict_types=1);

const REMEMBER_LOGIN_SECONDS = 30 * 24 * 60 * 60;

function authCookieOptions(int $expires = 0): array
{
    return [
        'expires' => $expires,
        'path' => '/',
        'secure' => isset($_SERVER['HTTPS'])
            && $_SERVER['HTTPS'] !== ''
            && strtolower($_SERVER['HTTPS']) !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

function startUserSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('foodhub_session');
    $cookieOptions = authCookieOptions();
    unset($cookieOptions['expires']);
    session_set_cookie_params(['lifetime' => 0] + $cookieOptions);

    if (!session_start()) {
        throw new RuntimeException('Tidak dapat memulai sesi pengguna.');
    }
}

function destroyUserSession(): void
{
    $_SESSION = [];

    if (session_status() === PHP_SESSION_ACTIVE && !session_destroy()) {
        throw new RuntimeException('Tidak dapat mengakhiri sesi pengguna.');
    }

    setcookie('foodhub_session', '', authCookieOptions(time() - 3600));
    unset($_COOKIE['foodhub_session']);
}

function readRememberCookie(): ?array
{
    $value = $_COOKIE['foodhub_remember'] ?? null;

    if (!is_string($value) || preg_match('/\A([a-f0-9]{24}):([a-f0-9]{64})\z/', $value, $matches) !== 1) {
        return null;
    }

    return ['selector' => $matches[1], 'token_hash' => hash('sha256', $matches[2])];
}

function clearRememberCookie(): void
{
    setcookie('foodhub_remember', '', authCookieOptions(time() - 3600));
    unset($_COOKIE['foodhub_remember']);
}

function forgetRememberedLogin(): void
{
    $token = readRememberCookie();
    $sessionSelector = $_SESSION['remember_selector'] ?? null;
    $userId = $_SESSION['user_id'] ?? null;
    $hasSessionToken = is_string($sessionSelector)
        && preg_match('/\A[a-f0-9]{24}\z/', $sessionSelector) === 1
        && is_int($userId) && $userId > 0;

    if ($token !== null || $hasSessionToken) {
        $pdo = getDatabaseConnection();

        if ($token !== null) {
            $stmt = $pdo->prepare('DELETE FROM remember_tokens WHERE selector = ? AND token_hash = ?');
            $stmt->execute([$token['selector'], $token['token_hash']]);
        }

        if ($hasSessionToken) {
            $stmt = $pdo->prepare('DELETE FROM remember_tokens WHERE selector = ? AND user_id = ?');
            $stmt->execute([$sessionSelector, $userId]);
        }
    }

    if (isset($_COOKIE['foodhub_remember']) || $hasSessionToken) {
        clearRememberCookie();
    }
}

function rememberUser(int $userId): void
{
    $selector = bin2hex(random_bytes(12));
    $token = bin2hex(random_bytes(32));
    $expires = time() + REMEMBER_LOGIN_SECONDS;
    $pdo = getDatabaseConnection();
    $stmt = $pdo->prepare('DELETE FROM remember_tokens WHERE user_id = ? AND expires_at <= UTC_TIMESTAMP()');
    $stmt->execute([$userId]);
    $stmt = $pdo->prepare(
        'INSERT INTO remember_tokens (selector, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$selector, $userId, hash('sha256', $token), gmdate('Y-m-d H:i:s', $expires)]);

    $_SESSION['remember_selector'] = $selector;
    setcookie('foodhub_remember', $selector . ':' . $token, authCookieOptions($expires));
}

function establishUserSession(int $userId, bool $remember): void
{
    startUserSession();
    forgetRememberedLogin();

    if (!session_regenerate_id(true)) {
        throw new RuntimeException('Tidak dapat memperbarui sesi pengguna.');
    }

    $_SESSION = [];
    if ($remember) {
        rememberUser($userId);
    }
    $_SESSION['user_id'] = $userId;
}

function restoreRememberedUser(): ?array
{
    $token = readRememberCookie();

    if ($token === null) {
        if (isset($_COOKIE['foodhub_remember'])) {
            clearRememberCookie();
        }
        return null;
    }

    $pdo = getDatabaseConnection();
    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.email, u.role, rt.token_hash, rt.expires_at
         FROM remember_tokens rt JOIN users u ON u.id = rt.user_id
         WHERE rt.selector = ? AND rt.expires_at > UTC_TIMESTAMP()'
    );
    $stmt->execute([$token['selector']]);
    $user = $stmt->fetch();

    if ($user === false || !hash_equals($user['token_hash'], $token['token_hash'])) {
        clearRememberCookie();
        return null;
    }

    if (!session_regenerate_id(true)) {
        throw new RuntimeException('Tidak dapat memperbarui sesi pengguna.');
    }

    $newToken = bin2hex(random_bytes(32));
    // Compare-and-swap: token yang sudah dipakai tidak dapat diputar ulang.
    $stmt = $pdo->prepare(
        'UPDATE remember_tokens SET token_hash = ?
         WHERE selector = ? AND token_hash = ? AND expires_at > UTC_TIMESTAMP()'
    );
    $stmt->execute([hash('sha256', $newToken), $token['selector'], $token['token_hash']]);

    if ($stmt->rowCount() !== 1) {
        clearRememberCookie();
        return null;
    }

    $user['id'] = (int) $user['id'];
    $_SESSION = ['user_id' => $user['id'], 'remember_selector' => $token['selector']];
    $expires = (new DateTimeImmutable($user['expires_at'], new DateTimeZone('UTC')))->getTimestamp();
    setcookie('foodhub_remember', $token['selector'] . ':' . $newToken, authCookieOptions($expires));
    unset($user['token_hash'], $user['expires_at']);

    return $user;
}

function getAuthenticatedUser(): ?array
{
    startUserSession();
    $userId = $_SESSION['user_id'] ?? null;

    if (is_int($userId) && $userId > 0) {
        $pdo = getDatabaseConnection();
        if (isset($_SESSION['remember_selector'])) {
            $stmt = $pdo->prepare(
                'SELECT u.id, u.name, u.email, u.role FROM users u
                 JOIN remember_tokens rt ON rt.user_id = u.id
                 WHERE u.id = ? AND rt.selector = ? AND rt.expires_at > UTC_TIMESTAMP()'
            );
            $stmt->execute([$userId, $_SESSION['remember_selector']]);
        } else {
            $stmt = $pdo->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
            $stmt->execute([$userId]);
        }
        $user = $stmt->fetch();

        if ($user !== false) {
            $user['id'] = (int) $user['id'];
            return $user;
        }

        // Akun/token dicabut: jangan pulihkan identitas lain pada request yang sama.
        forgetRememberedLogin();
        destroyUserSession();
        return null;
    }

    $_SESSION = [];
    return restoreRememberedUser();
}
