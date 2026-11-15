<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/bootstrap.php';

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($requestMethod, ['GET', 'POST', 'DELETE'], true)) {
    header('Allow: GET, POST, DELETE');
    sendErrorResponse('Metode HTTP tidak diizinkan.', 405);
}

$user = requireAdmin();
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
    // Basic validation
    if (!isset($input['name']) || !is_string($input['name']) || trim($input['name']) === '' ||
        !isset($input['email']) || !is_string($input['email']) || !filter_var($input['email'], FILTER_VALIDATE_EMAIL) ||
        !isset($input['password']) || !is_string($input['password']) || strlen($input['password']) < 8) {
        sendErrorResponse('Data pengguna tidak valid.', 422);
    }
    // Insert user (role forced to member)
    $stmt = $pdo->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    $passwordHash = password_hash($input['password'], PASSWORD_DEFAULT);
    $stmt->execute([trim($input['name']), trim($input['email']), $passwordHash, 'member']);
    $newId = (int)$pdo->lastInsertId();
    $user = ['id' => $newId, 'name' => trim($input['name']), 'email' => trim($input['email']), 'role' => 'member'];
    sendJsonResponse(['user' => $user], 201);
}

if ($requestMethod === 'DELETE') {
    // Return list of all users
    $stmt = $pdo->prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id ASC');
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    sendJsonResponse(['users' => $users]);
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