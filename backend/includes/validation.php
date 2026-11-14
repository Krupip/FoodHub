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

function readJsonBody(): array
{
    $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));

    if ($contentType !== 'application/json') {
        sendErrorResponse('Content-Type harus application/json.', 415);
    }

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
