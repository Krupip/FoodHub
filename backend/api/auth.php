<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

$action = $_GET['action'] ?? '';

if (!in_array($action, ['register', 'login', 'me', 'logout'], true)) {
    sendErrorResponse('Aksi autentikasi tidak ditemukan.', 404);
}

if ($action === 'me') {
    requireRequestMethod('GET');
    $user = getAuthenticatedUser();
    if ($user === null) {
        discardAnonymousSession();
    } else {
        publishCsrfToken();
        session_write_close();
    }
    sendJsonResponse(['user' => $user]);
}

if ($action === 'logout') {
    requireRequestMethod('POST');
    // Tidak menerima form lintas situs; frontend memakai JSON tanpa membutuhkan body.
    requireJsonContentType();
    $user = getAuthenticatedUser();
    if ($user !== null) {
        publishCsrfToken();
        requireCsrfToken();
    }
    startUserSession();
    forgetRememberedLogin();
    destroyUserSession();
    sendJsonResponse(['message' => 'Berhasil keluar.']);
}

requireRequestMethod('POST');
$input = readJsonBody();
$name = $input['name'] ?? null;

if ($action === 'register') {
    if (!is_string($name)) {
        sendErrorResponse('Nama wajib diisi dengan teks.', 422);
    }

    $name = trim($name);

    if (mb_strlen($name, 'UTF-8') < 3 || mb_strlen($name, 'UTF-8') > 100) {
        sendErrorResponse('Nama harus terdiri dari 3 sampai 100 karakter.', 422);
    }
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
$minimumPasswordLength = $action === 'register' ? 8 : 1;
if (mb_strlen($password, 'UTF-8') < $minimumPasswordLength || strlen($password) > 72 || str_contains($password, "\0")) {
    sendErrorResponse(
        "Kata sandi minimal {$minimumPasswordLength} karakter, maksimal 72 byte, dan tidak boleh mengandung karakter null.",
        422
    );
}

if ($action === 'login' && array_key_exists('remember', $input) && !is_bool($input['remember'])) {
    sendErrorResponse('Pilihan ingat saya harus berupa boolean.', 422);
}

$pdo = getDatabaseConnection();

if ($action === 'login') {
    $stmt = $pdo->prepare(
        'SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Tetap jalankan bcrypt untuk email yang tidak terdaftar, bukan langsung menolak.
    $hash = $user['password_hash'] ?? '$2y$10$Ze7J8IGfmg96sWhw3HtequUFSeDSM8AYX/Ht8QkgenAHGk1v/srCi';
    $passwordMatches = password_verify($password, $hash);

    if ($user === false || !$passwordMatches) {
        sendErrorResponse('Email atau kata sandi salah.', 401);
    }

    $user['id'] = (int) $user['id'];
    establishUserSession($user['id'], $input['remember'] ?? false);
    publishCsrfToken();
    session_write_close();

    unset($user['password_hash']);
    sendJsonResponse(['user' => $user]);
}

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
forgetRememberedLogin();
$_SESSION = ['user_id' => $userId];
publishCsrfToken();
session_write_close();

sendJsonResponse([
    'user' => [
        'id' => $userId,
        'name' => $name,
        'email' => $email,
        'role' => 'member',
    ],
], 201);
