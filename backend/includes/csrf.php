<?php

declare(strict_types=1);

function getCsrfToken(): string
{
    startUserSession();
    $token = $_SESSION['csrf_token'] ?? null;

    if (!is_string($token) || preg_match('/\A[a-f0-9]{64}\z/', $token) !== 1) {
        $token = bin2hex(random_bytes(32));
        $_SESSION['csrf_token'] = $token;
    }

    return $token;
}

function publishCsrfToken(): void
{
    header('X-CSRF-Token: ' . getCsrfToken());
}

function requireCsrfToken(): void
{
    $expected = $_SESSION['csrf_token'] ?? null;
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;

    if (session_status() !== PHP_SESSION_ACTIVE
        || !is_string($expected)
        || !is_string($provided)
        || preg_match('/\A[a-f0-9]{64}\z/', $provided) !== 1
        || !hash_equals($expected, $provided)) {
        sendErrorResponse('Token CSRF tidak valid. Muat ulang halaman dan coba lagi.', 403);
    }
}

function requireCsrfForMutation(): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET', 'HEAD', 'OPTIONS'], true)) {
        requireCsrfToken();
    }
}
