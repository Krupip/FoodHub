<?php

declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/response.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/csrf.php';
require_once __DIR__ . '/../config/database.php';

set_exception_handler(static function (Throwable $exception): void {
    error_log(sprintf(
        'FoodHub API: %s: %s di %s:%d',
        get_class($exception),
        $exception->getMessage(),
        $exception->getFile(),
        $exception->getLine()
    ));

    sendErrorResponse('Terjadi kesalahan pada server. Silakan coba lagi nanti.', 500);
});

set_error_handler(static function (
    int $severity,
    string $message,
    string $file,
    int $line
): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }

    throw new ErrorException($message, 0, $severity, $file, $line);
});

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
