<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

$action = $_GET['action'] ?? '';

if ($action !== 'register') {
    sendErrorResponse('Aksi autentikasi tidak ditemukan.', 404);
}

requireRequestMethod('POST');
$input = readJsonBody();

if (!isset($input['name']) || !is_string($input['name'])) {
    sendErrorResponse('Nama wajib diisi dengan teks.', 422);
}

$name = trim($input['name']);

if (mb_strlen($name, 'UTF-8') < 3 || mb_strlen($name, 'UTF-8') > 100) {
    sendErrorResponse('Nama harus terdiri dari 3 sampai 100 karakter.', 422);
}

if (!isset($input['email']) || !is_string($input['email'])) {
    sendErrorResponse('Email wajib diisi dengan teks.', 422);
}

$email = strtolower(trim($input['email']));

if (strlen($email) > 150 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    sendErrorResponse('Format email tidak valid atau melebihi 150 karakter.', 422);
}

if (!isset($input['password']) || !is_string($input['password'])) {
    sendErrorResponse('Kata sandi wajib diisi dengan teks.', 422);
}

$password = $input['password'];

// Bcrypt hanya memproses 72 byte pertama; tolak kelebihan agar tidak terpotong diam-diam.
if (mb_strlen($password, 'UTF-8') < 8 || strlen($password) > 72 || str_contains($password, "\0")) {
    sendErrorResponse('Kata sandi minimal 8 karakter, maksimal 72 byte, dan tidak boleh mengandung karakter null.', 422);
}

$pdo = getDatabaseConnection();
$passwordHash = password_hash($password, PASSWORD_BCRYPT);

// Pastikan penyimpanan sesi dapat dimulai sebelum membuat akun di database.
startUserSession();
if (!session_regenerate_id(true)) {
    throw new RuntimeException('Tidak dapat memperbarui sesi pengguna.');
}

try {
    $stmt = $pdo->prepare(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'member')"
    );
    $stmt->execute([$name, $email, $passwordHash]);
} catch (PDOException $exception) {
    // Unique constraint tetap menangani dua request serentak dengan email yang sama.
    if (($exception->errorInfo[0] ?? null) === '23000' && (int) ($exception->errorInfo[1] ?? 0) === 1062) {
        sendErrorResponse('Email sudah terdaftar.', 409);
    }

    throw $exception;
}

$userId = (int) $pdo->lastInsertId();
$_SESSION = ['user_id' => $userId];
session_write_close();

sendJsonResponse([
    'user' => [
        'id' => $userId,
        'name' => $name,
        'email' => $email,
        'role' => 'member',
    ],
], 201);
