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

    $stmt = $pdo->prepare(
        'SELECT v.id, v.title, v.slug, v.region, r.story, v.image_path,
                v.cook_time_minutes, v.difficulty, v.servings, v.is_published,
                v.created_at, v.avg_rating, v.review_count, v.favorite_count,
                f.created_at AS favorited_at
         FROM favorites f
         JOIN v_recipe_cards v ON v.id = f.recipe_id
         JOIN recipes r ON r.id = v.id
         WHERE f.user_id = ? AND v.is_published = 1
         ORDER BY f.created_at DESC, f.recipe_id DESC'
    );
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();

    $categoriesByRecipe = [];
    if ($rows !== []) {
        $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare(
            "SELECT rc.recipe_id, c.name
             FROM recipe_categories rc JOIN categories c ON c.id = rc.category_id
             WHERE rc.recipe_id IN ({$placeholders})
             ORDER BY c.name"
        );
        $stmt->execute($ids);
        foreach ($stmt->fetchAll() as $row) {
            $categoriesByRecipe[(int) $row['recipe_id']][] = $row['name'];
        }
    }

    $recipes = array_map(static function (array $row) use ($categoriesByRecipe): array {
        $id = (int) $row['id'];

        return [
            'id' => $id,
            'title' => $row['title'],
            'slug' => $row['slug'],
            'region' => $row['region'],
            'story' => $row['story'],
            'image_path' => $row['image_path'],
            'cook_time_minutes' => (int) $row['cook_time_minutes'],
            'difficulty' => $row['difficulty'],
            'servings' => (int) $row['servings'],
            'is_published' => (bool) $row['is_published'],
            'created_at' => $row['created_at'],
            'avg_rating' => $row['avg_rating'] === null ? null : (float) $row['avg_rating'],
            'review_count' => (int) $row['review_count'],
            'favorite_count' => (int) $row['favorite_count'],
            'favorited_at' => $row['favorited_at'],
            'categories' => $categoriesByRecipe[$id] ?? [],
        ];
    }, $rows);

    sendJsonResponse([
        'recipes' => $recipes,
        'total' => count($recipes),
    ]);
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

    $stmt = $pdo->prepare('INSERT IGNORE INTO favorites (user_id, recipe_id) VALUES (?, ?)');
    $stmt->execute([$user['id'], $recipeId]);

    sendJsonResponse([
        'message' => 'Resep berhasil disimpan ke favorit.',
        'is_favorite' => true,
    ], 200);
}

// DELETE method
$recipeId = readQueryInt('recipe_id', 1, 4294967295);
session_write_close();

if ($recipeId === null) {
    sendErrorResponse('Parameter recipe_id wajib diisi dengan bilangan bulat positif.', 422);
}

$stmt = $pdo->prepare('DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?');
$stmt->execute([$user['id'], $recipeId]);

sendJsonResponse([
    'message' => 'Resep berhasil dihapus dari favorit.',
    'is_favorite' => false,
]);
