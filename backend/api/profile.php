<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? '';

if (!in_array($requestMethod, ['GET', 'POST', 'PUT', 'PATCH'], true)) {
    header('Allow: GET, POST, PUT, PATCH');
    sendErrorResponse('Metode HTTP tidak diizinkan.', 405);
}

$user = requireLogin();
$pdo = getDatabaseConnection();

if ($requestMethod === 'GET') {
    session_write_close();

    $stmt = $pdo->prepare(
        'SELECT id, name, email, role, avatar_path, bio, created_at, updated_at
         FROM users
         WHERE id = ?'
    );
    $stmt->execute([$user['id']]);
    $profile = $stmt->fetch();

    if ($profile === false) {
        sendErrorResponse('Pengguna tidak ditemukan.', 404);
    }

    $profile['id'] = (int) $profile['id'];

    sendJsonResponse(['user' => $profile]);
}

requireCsrfForMutation();
$input = readJsonBody();
session_write_close();

if (!isset($input['name']) || !is_string($input['name'])) {
    sendErrorResponse('Nama wajib diisi dengan teks.', 422);
}

$name = trim($input['name']);

if (mb_strlen($name, 'UTF-8') < 3 || mb_strlen($name, 'UTF-8') > 100) {
    sendErrorResponse('Nama harus terdiri dari 3 sampai 100 karakter.', 422);
}

$bio = null;
$hasBio = false;
if (array_key_exists('bio', $input)) {
    $hasBio = true;
    if ($input['bio'] !== null && !is_string($input['bio'])) {
        sendErrorResponse('Bio harus berupa teks atau null.', 422);
    }
    if (is_string($input['bio'])) {
        $bio = trim($input['bio']);
        if (mb_strlen($bio, 'UTF-8') > 255) {
            sendErrorResponse('Bio maksimal 255 karakter.', 422);
        }
    }
}

if ($hasBio) {
    $stmt = $pdo->prepare('UPDATE users SET name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $stmt->execute([$name, $bio, $user['id']]);
} else {
    $stmt = $pdo->prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $stmt->execute([$name, $user['id']]);
}

$stmt = $pdo->prepare(
    'SELECT id, name, email, role, avatar_path, bio, created_at, updated_at
     FROM users
     WHERE id = ?'
);
$stmt->execute([$user['id']]);
$updatedUser = $stmt->fetch();

if ($updatedUser === false) {
    sendErrorResponse('Pengguna tidak ditemukan.', 404);
}

$updatedUser['id'] = (int) $updatedUser['id'];

sendJsonResponse([
    'message' => 'Perubahan profil berhasil disimpan.',
    'user' => $updatedUser,
]);
