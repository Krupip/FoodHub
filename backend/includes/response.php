<?php

declare(strict_types=1);

function sendJsonResponse(array $data, int $statusCode = 200): void
{
    $json = json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
    );

    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');

    echo $json;
    exit;
}

function sendErrorResponse(string $message, int $statusCode): void
{
    sendJsonResponse(['error' => $message], $statusCode);
}
