<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/bootstrap.php';

$user = requireAdmin();

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? '';
if ($requestMethod !== 'GET') {
    header('Allow: GET');
    sendErrorResponse('Metode HTTP tidak diizinkan.', 405);
}

$pdo = getDatabaseConnection();

// Gather statistics
$stats = [];
// total recipes
$stmt = $pdo->prepare('SELECT COUNT(*) FROM recipes');
$stmt->execute();
$stats['total_recipes'] = (int)$stmt->fetchColumn();
// published recipes
$stmt = $pdo->prepare('SELECT COUNT(*) FROM recipes WHERE is_published = 1');
$stmt->execute();
$stats['published_recipes'] = (int)$stmt->fetchColumn();
// hidden recipes
$stmt = $pdo->prepare('SELECT COUNT(*) FROM recipes WHERE is_published = 0');
$stmt->execute();
$stats['hidden_recipes'] = (int)$stmt->fetchColumn();
// total users
$stmt = $pdo->prepare('SELECT COUNT(*) FROM users');
$stmt->execute();
$stats['total_users'] = (int)$stmt->fetchColumn();

sendJsonResponse(['stats' => $stats]);
?>