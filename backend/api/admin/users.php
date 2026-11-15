<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/bootstrap.php';

$user = requireAdmin();

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($requestMethod, ['GET', 'POST', 'DELETE'], true)) {
    header('Allow: GET, POST, DELETE');
    sendErrorResponse('Metode HTTP tidak diizinkan.', 405);
}

$pdo = getDatabaseConnection();

if ($requestMethod === 'GET') {
    // Return list of users (id, name, email, role, created_at)
    $stmt = $pdo->prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id ASC');
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    sendJsonResponse(['users' => $users]);
}

if ($requestMethod === 'POST') {
    requireCsrfForMutation();
    $input = readJsonBody();

    $name = isset($input['name']) && is_string($input['name']) ? trim($input['name']) : '';
    $email = isset($input['email']) && is_string($input['email']) ? strtolower(trim($input['email'])) : '';
    $password = isset($input['password']) && is_string($input['password']) ? $input['password'] : '';

    if (mb_strlen($name, 'UTF-8') < 3 || mb_strlen($name, 'UTF-8') > 100) {
        sendErrorResponse('Nama harus terdiri dari 3 hingga 100 karakter.', 422);
    }
    if ($email === '' || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendErrorResponse('Format email tidak valid.', 422);
    }
    if (strlen($password) < 8 || strlen($password) > 72) {
        sendErrorResponse('Kata sandi harus terdiri dari 8 hingga 72 karakter.', 422);
    }

    // Periksa apakah email sudah terdaftar
    $checkStmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $checkStmt->execute([$email]);
    if ($checkStmt->fetchColumn() !== false) {
        sendErrorResponse('Email sudah terdaftar.', 409);
    }

    // Insert user (role selalu member)
    $stmt = $pdo->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $stmt->execute([$name, $email, $passwordHash, 'member']);
    $newId = (int) $pdo->lastInsertId();
    $createdUser = [
        'id' => $newId,
        'name' => $name,
        'email' => $email,
        'role' => 'member',
    ];
    sendJsonResponse(['user' => $createdUser], 201);
}

if ($requestMethod === 'DELETE') {
    requireCsrfForMutation();
    $id = readQueryInt('id', 1, 4294967295);
    if ($id === null) {
        sendErrorResponse('Parameter id wajib diisi dengan bilangan bulat positif.', 422);
    }
    // Prevent deleting self
    if ($id === (int) $user['id']) {
        sendErrorResponse('Tidak dapat menghapus akun admin sendiri.', 403);
    }
    // Check target user exists and role
    $stmt = $pdo->prepare('SELECT role FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $target = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($target === false) {
        sendErrorResponse('Pengguna tidak ditemukan.', 404);
    }
    if ($target['role'] === 'admin') {
        sendErrorResponse('Tidak dapat menghapus akun admin lain.', 403);
    }
    // Delete user (cascade will clean related data)
    $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$id]);
    sendJsonResponse(['message' => 'Pengguna berhasil dihapus.']);
}
?>