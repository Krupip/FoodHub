<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? '';

if (!in_array($requestMethod, ['GET', 'POST', 'DELETE'], true)) {
    header('Allow: GET, POST, DELETE');
    sendErrorResponse('Metode HTTP tidak diizinkan.', 405);
}

$user = requireLogin();
$pdo = getDatabaseConnection();

if ($requestMethod === 'GET') {
    session_write_close();

    $recipeId = readQueryInt('recipe_id', 1, 4294967295);

    if ($recipeId !== null) {
        $stmt = $pdo->prepare(
            'SELECT u.name AS user_name, rv.rating, rv.comment, rv.created_at
             FROM reviews rv
             JOIN users u ON u.id = rv.user_id
             WHERE rv.recipe_id = ?
             ORDER BY rv.created_at DESC, rv.id DESC'
        );
        $stmt->execute([$recipeId]);
        $reviews = array_map(static fn (array $row): array => [
            'user_name' => $row['user_name'],
            'rating' => (int) $row['rating'],
            'comment' => $row['comment'],
            'created_at' => $row['created_at'],
        ], $stmt->fetchAll());
    } else {
        $stmt = $pdo->prepare(
            'SELECT rv.id, rv.recipe_id, r.title AS recipe_title, rv.rating, rv.comment, rv.created_at
             FROM reviews rv
             JOIN recipes r ON r.id = rv.recipe_id
             WHERE rv.user_id = ?
             ORDER BY rv.created_at DESC, rv.id DESC'
        );
        $stmt->execute([$user['id']]);
        $reviews = array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'recipe_id' => (int) $row['recipe_id'],
            'recipe_title' => $row['recipe_title'],
            'rating' => (int) $row['rating'],
            'comment' => $row['comment'],
            'created_at' => $row['created_at'],
        ], $stmt->fetchAll());
    }

    sendJsonResponse(['reviews' => $reviews]);
}

requireCsrfForMutation();

if ($requestMethod === 'POST') {
    $input = readJsonBody();
    session_write_close();

    $recipeId = $input['recipe_id'] ?? null;
    if (!is_int($recipeId) && !(is_string($recipeId) && preg_match('/\A[1-9]\d*\z/', $recipeId))) {
        sendErrorResponse('Parameter recipe_id wajib diisi dengan bilangan bulat positif.', 422);
    }
    $recipeId = (int) $recipeId;
    if ($recipeId < 1 || $recipeId > 4294967295) {
        sendErrorResponse('Parameter recipe_id di luar rentang yang diizinkan.', 422);
    }

    $stmt = $pdo->prepare('SELECT id FROM recipes WHERE id = ? AND is_published = 1');
    $stmt->execute([$recipeId]);
    if ($stmt->fetch() === false) {
        sendErrorResponse('Resep tidak ditemukan atau tidak tersedia.', 404);
    }

    $rating = $input['rating'] ?? null;
    if (!is_int($rating) && !(is_string($rating) && preg_match('/\A[1-5]\z/', $rating))) {
        sendErrorResponse('Rating harus berupa bilangan bulat antara 1 sampai 5.', 422);
    }
    $rating = (int) $rating;
    if ($rating < 1 || $rating > 5) {
        sendErrorResponse('Rating harus berupa bilangan bulat antara 1 sampai 5.', 422);
    }

    $comment = null;
    if (array_key_exists('comment', $input) && $input['comment'] !== null) {
        if (!is_string($input['comment'])) {
            sendErrorResponse('Komentar ulasan harus berupa teks atau null.', 422);
        }
        $comment = trim($input['comment']);
        if (mb_strlen($comment, 'UTF-8') > 1000) {
            sendErrorResponse('Komentar ulasan maksimal 1000 karakter.', 422);
        }
        if ($comment === '') {
            $comment = null;
        }
    }

    $stmt = $pdo->prepare(
        'INSERT INTO reviews (recipe_id, user_id, rating, comment, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
           rating = VALUES(rating),
           comment = VALUES(comment),
           created_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$recipeId, $user['id'], $rating, $comment]);

    $stmt = $pdo->prepare(
        'SELECT id, recipe_id, user_id, rating, comment, created_at
         FROM reviews
         WHERE recipe_id = ? AND user_id = ?'
    );
    $stmt->execute([$recipeId, $user['id']]);
    $saved = $stmt->fetch();

    sendJsonResponse([
        'message' => 'Ulasan berhasil dikirim.',
        'review' => [
            'id' => (int) $saved['id'],
            'recipe_id' => (int) $saved['recipe_id'],
            'rating' => (int) $saved['rating'],
            'comment' => $saved['comment'],
            'created_at' => $saved['created_at'],
        ],
    ], 200);
}

// DELETE method
$recipeId = readQueryInt('recipe_id', 1, 4294967295);
session_write_close();

if ($recipeId === null) {
    sendErrorResponse('Parameter recipe_id wajib diisi dengan bilangan bulat positif.', 422);
}

$stmt = $pdo->prepare('DELETE FROM reviews WHERE user_id = ? AND recipe_id = ?');
$stmt->execute([$user['id'], $recipeId]);

sendJsonResponse([
    'message' => 'Ulasan berhasil dihapus.',
]);
