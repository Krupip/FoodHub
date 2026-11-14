<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

requireRequestMethod('GET');

$pdo = getDatabaseConnection();
$stmt = $pdo->query('SELECT id, name, slug FROM categories ORDER BY id');
$categories = $stmt->fetchAll();

foreach ($categories as &$category) {
    $category['id'] = (int) $category['id'];
}
unset($category);

sendJsonResponse(['categories' => $categories]);
