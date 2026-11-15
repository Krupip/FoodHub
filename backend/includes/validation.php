<?php

declare(strict_types=1);

function requireRequestMethod(string $allowedMethod): void
{
    $requestMethod = $_SERVER['REQUEST_METHOD'] ?? '';

    if ($requestMethod !== $allowedMethod) {
        header('Allow: ' . $allowedMethod);
        sendErrorResponse('Metode HTTP tidak diizinkan.', 405);
    }
}

// Parameter query kosong dianggap tidak dikirim; nilai bukan teks atau bukan UTF-8 ditolak.
function readQueryString(string $name, int $maxLength): ?string
{
    if (!array_key_exists($name, $_GET)) {
        return null;
    }

    $value = $_GET[$name];

    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || str_contains($value, "\0")) {
        sendErrorResponse("Parameter {$name} harus berupa teks yang valid.", 422);
    }

    $value = trim($value);

    if ($value === '') {
        return null;
    }

    if (mb_strlen($value, 'UTF-8') > $maxLength) {
        sendErrorResponse("Parameter {$name} maksimal {$maxLength} karakter.", 422);
    }

    return $value;
}

function readQueryInt(string $name, int $min, int $max): ?int
{
    $value = readQueryString($name, 10);

    if ($value === null) {
        return null;
    }

    if (preg_match('/\A\d+\z/', $value) !== 1 || (int) $value < $min || (int) $value > $max) {
        sendErrorResponse("Parameter {$name} harus bilangan bulat {$min}–{$max}.", 422);
    }

    return (int) $value;
}

function requireJsonContentType(): void
{
    $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));

    if ($contentType !== 'application/json') {
        sendErrorResponse('Content-Type harus application/json.', 415);
    }
}

function readJsonBody(): array
{
    requireJsonContentType();
    $body = file_get_contents('php://input');

    if ($body === false || trim($body) === '') {
        sendErrorResponse('Body JSON wajib diisi.', 400);
    }

    try {
        $data = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        sendErrorResponse('Body JSON tidak valid.', 400);
    }

    // Decode associative menyamakan {} dan []; periksa bentuk objek dari body asli.
    if (!is_array($data) || substr(ltrim($body), 0, 1) !== '{') {
        sendErrorResponse('Body JSON harus berupa objek.', 400);
    }

    return $data;
}
