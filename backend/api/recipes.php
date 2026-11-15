<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

requireRequestMethod('GET');

if (array_key_exists('id', $_GET)) {
    sendErrorResponse('Detail resep belum diimplementasikan.', 501);
}

const RECIPE_SORTS = [
    'popular' => 'v.favorite_count DESC, v.avg_rating DESC, v.review_count DESC, v.title ASC, v.id ASC',
    'rating' => 'v.avg_rating DESC, v.review_count DESC, v.title ASC, v.id ASC',
    'newest' => 'v.created_at DESC, v.id DESC',
    'title' => 'v.title ASC, v.id ASC',
    'time' => 'v.cook_time_minutes ASC, v.title ASC, v.id ASC',
];

$conditions = ['v.is_published = 1'];
$params = [];

$search = readQueryString('q', 100);
if ($search !== null) {
    // Escape karakter wildcard agar "%" dan "_" dicari sebagai teks biasa.
    $like = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search) . '%';
    $conditions[] = "(v.title LIKE ? ESCAPE '!' OR EXISTS (
        SELECT 1 FROM recipe_ingredients ri WHERE ri.recipe_id = v.id AND ri.name LIKE ? ESCAPE '!'
    ))";
    array_push($params, $like, $like);
}

$category = readQueryString('category', 50);
if ($category !== null) {
    $conditions[] = 'EXISTS (
        SELECT 1 FROM recipe_categories rc JOIN categories c ON c.id = rc.category_id
        WHERE rc.recipe_id = v.id AND (c.name = ? OR c.slug = ?)
    )';
    array_push($params, $category, $category);
}

$minTime = readQueryInt('min_time', 1, 65535);
$maxTime = readQueryInt('max_time', 1, 65535);
if ($minTime !== null && $maxTime !== null && $minTime > $maxTime) {
    sendErrorResponse('Parameter min_time tidak boleh lebih besar dari max_time.', 422);
}
if ($minTime !== null) {
    $conditions[] = 'v.cook_time_minutes >= ?';
    $params[] = $minTime;
}
if ($maxTime !== null) {
    $conditions[] = 'v.cook_time_minutes <= ?';
    $params[] = $maxTime;
}

$difficulty = readQueryString('difficulty', 10);
if ($difficulty !== null) {
    $difficulty = strtolower($difficulty);
    if (!in_array($difficulty, ['mudah', 'sedang', 'sulit'], true)) {
        sendErrorResponse('Parameter difficulty harus mudah, sedang, atau sulit.', 422);
    }
    $conditions[] = 'v.difficulty = ?';
    $params[] = $difficulty;
}

$sort = readQueryString('sort', 20) ?? 'popular';
if (!array_key_exists($sort, RECIPE_SORTS)) {
    sendErrorResponse('Parameter sort harus popular, rating, newest, title, atau time.', 422);
}

$limit = readQueryInt('limit', 1, 100) ?? 100;
$offset = readQueryInt('offset', 0, 100000) ?? 0;
$where = implode(' AND ', $conditions);

$pdo = getDatabaseConnection();

// Kondisi hanya memakai kolom yang ada di tabel recipes, sehingga total tidak perlu menghitung view.
$stmt = $pdo->prepare("SELECT COUNT(*) FROM recipes v WHERE {$where}");
$stmt->execute($params);
$total = (int) $stmt->fetchColumn();

$stmt = $pdo->prepare(
    "SELECT v.id, v.title, v.slug, v.region, r.story, v.image_path, v.cook_time_minutes,
            v.difficulty, v.servings, v.is_published, v.created_at,
            v.avg_rating, v.review_count, v.favorite_count
     FROM v_recipe_cards v JOIN recipes r ON r.id = v.id
     WHERE {$where}
     ORDER BY " . RECIPE_SORTS[$sort] . '
     LIMIT ? OFFSET ?'
);
foreach ($params as $index => $value) {
    $stmt->bindValue($index + 1, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
}
$stmt->bindValue(count($params) + 1, $limit, PDO::PARAM_INT);
$stmt->bindValue(count($params) + 2, $offset, PDO::PARAM_INT);
$stmt->execute();
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
        'categories' => $categoriesByRecipe[$id] ?? [],
    ];
}, $rows);

sendJsonResponse([
    'recipes' => $recipes,
    'total' => $total,
    'limit' => $limit,
    'offset' => $offset,
]);
