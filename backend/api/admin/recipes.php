<?php

declare(strict_types=1);

require_once __DIR__ . '/../../includes/bootstrap.php';

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? '';

if (!in_array($requestMethod, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    header('Allow: GET, POST, PUT, PATCH, DELETE');
    sendErrorResponse('Metode HTTP tidak diizinkan.', 405);
}

$user = requireAdmin();
$pdo = getDatabaseConnection();

function generateRecipeSlug(PDO $pdo, string $title, ?int $currentRecipeId = null): string
{
    $base = strtolower(trim((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $title), '-'));
    if ($base === '') {
        $base = 'resep';
    }
    $slug = $base;
    $suffix = 1;
    while (true) {
        $sql = 'SELECT id FROM recipes WHERE slug = ?';
        $params = [$slug];
        if ($currentRecipeId !== null) {
            $sql .= ' AND id != ?';
            $params[] = $currentRecipeId;
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        if ($stmt->fetch() === false) {
            return $slug;
        }
        $suffix++;
        $slug = $base . '-' . $suffix;
    }
}

function syncRecipeCategories(PDO $pdo, int $recipeId, array $categories): void
{
    $stmtDelete = $pdo->prepare('DELETE FROM recipe_categories WHERE recipe_id = ?');
    $stmtDelete->execute([$recipeId]);

    $stmtFind = $pdo->prepare('SELECT id FROM categories WHERE name = ? OR slug = ? LIMIT 1');
    $stmtInsert = $pdo->prepare('INSERT IGNORE INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)');

    foreach ($categories as $cat) {
        if (!is_string($cat) || trim($cat) === '') {
            continue;
        }
        $cat = trim($cat);
        $stmtFind->execute([$cat, $cat]);
        $catId = $stmtFind->fetchColumn();
        if ($catId !== false) {
            $stmtInsert->execute([$recipeId, (int) $catId]);
        }
    }
}

function syncRecipeIngredients(PDO $pdo, int $recipeId, array $ingredients): void
{
    $stmtDelete = $pdo->prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?');
    $stmtDelete->execute([$recipeId]);

    $stmtInsert = $pdo->prepare(
        'INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, sort_order)
         VALUES (?, ?, ?, ?, ?)'
    );

    $sortOrder = 1;
    foreach ($ingredients as $ing) {
        if (is_string($ing)) {
            $name = trim($ing);
            $qty = null;
            $unit = null;
        } elseif (is_array($ing)) {
            $name = trim((string) ($ing['name'] ?? ''));
            $qty = isset($ing['quantity']) && is_numeric($ing['quantity']) ? (float) $ing['quantity'] : null;
            $unit = isset($ing['unit']) && is_string($ing['unit']) ? trim($ing['unit']) : null;
            if ($unit === '') {
                $unit = null;
            }
        } else {
            continue;
        }

        if ($name === '') {
            continue;
        }

        $stmtInsert->execute([$recipeId, $name, $qty, $unit, $sortOrder++]);
    }
}

function syncRecipeSteps(PDO $pdo, int $recipeId, array $steps): void
{
    $stmtDelete = $pdo->prepare('DELETE FROM recipe_steps WHERE recipe_id = ?');
    $stmtDelete->execute([$recipeId]);

    $stmtInsert = $pdo->prepare(
        'INSERT INTO recipe_steps (recipe_id, step_number, instruction)
         VALUES (?, ?, ?)'
    );

    $stepNumber = 1;
    foreach ($steps as $step) {
        if (!is_string($step)) {
            continue;
        }
        $instruction = trim($step);
        if ($instruction === '') {
            continue;
        }
        $stmtInsert->execute([$recipeId, $stepNumber++, $instruction]);
    }
}

if ($requestMethod === 'GET') {
    session_write_close();

    if (array_key_exists('id', $_GET)) {
        $id = readQueryInt('id', 1, 4294967295);
        if ($id === null) {
            sendErrorResponse('Parameter id wajib diisi dengan bilangan bulat positif.', 422);
        }

        $stmt = $pdo->prepare(
            'SELECT r.id, r.created_by, r.title, r.slug, r.region, r.story, r.image_path,
                    r.cook_time_minutes, r.difficulty, r.servings, r.is_published,
                    r.created_at, r.updated_at, u.name AS author
             FROM recipes r
             LEFT JOIN users u ON u.id = r.created_by
             WHERE r.id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        if ($row === false) {
            sendErrorResponse('Resep tidak ditemukan.', 404);
        }

        $stmt = $pdo->prepare(
            'SELECT c.name FROM recipe_categories rc
             JOIN categories c ON c.id = rc.category_id
             WHERE rc.recipe_id = ? ORDER BY c.name'
        );
        $stmt->execute([$id]);
        $categories = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $stmt = $pdo->prepare(
            'SELECT name, quantity, unit FROM recipe_ingredients
             WHERE recipe_id = ? ORDER BY sort_order, id'
        );
        $stmt->execute([$id]);
        $ingredients = array_map(static fn (array $i): array => [
            'name' => $i['name'],
            'quantity' => $i['quantity'] === null ? null : (float) $i['quantity'],
            'unit' => $i['unit'],
        ], $stmt->fetchAll());

        $stmt = $pdo->prepare(
            'SELECT instruction FROM recipe_steps
             WHERE recipe_id = ? ORDER BY step_number'
        );
        $stmt->execute([$id]);
        $steps = $stmt->fetchAll(PDO::FETCH_COLUMN);

        sendJsonResponse([
            'recipe' => [
                'id' => (int) $row['id'],
                'created_by' => $row['created_by'] === null ? null : (int) $row['created_by'],
                'author' => $row['author'] ?? 'Tim FoodHub',
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
                'updated_at' => $row['updated_at'],
                'categories' => $categories,
                'ingredients' => $ingredients,
                'steps' => $steps,
            ],
        ]);
    }

    $search = readQueryString('q', 100) ?? readQueryString('search', 100);
    $params = [];
    $whereClause = '';
    if ($search !== null) {
        $whereClause = ' WHERE (v.title LIKE ? OR v.region LIKE ? OR r.story LIKE ?)';
        $keyword = '%' . $search . '%';
        $params = [$keyword, $keyword, $keyword];
    }

    $stmt = $pdo->prepare(
        "SELECT v.id, v.title, v.slug, v.region, r.story, v.image_path, v.cook_time_minutes,
                v.difficulty, v.servings, v.is_published, v.created_at,
                v.avg_rating, v.review_count, v.favorite_count
         FROM v_recipe_cards v
         JOIN recipes r ON r.id = v.id
         {$whereClause}
         ORDER BY v.created_at DESC, v.id DESC"
    );
    $stmt->execute($params);
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
        'total' => count($recipes),
    ]);
}

requireCsrfForMutation();

if ($requestMethod === 'PATCH') {
    $id = readQueryInt('id', 1, 4294967295);
    if ($id === null) {
        sendErrorResponse('Parameter id wajib diisi dengan bilangan bulat positif.', 422);
    }

    $input = readJsonBody();
    session_write_close();

    if (!array_key_exists('is_published', $input) || !is_bool($input['is_published'])) {
        sendErrorResponse('Parameter is_published harus berupa boolean.', 422);
    }

    $isPublished = $input['is_published'];

    $stmt = $pdo->prepare('SELECT id FROM recipes WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->fetch() === false) {
        sendErrorResponse('Resep tidak ditemukan.', 404);
    }

    $stmt = $pdo->prepare('UPDATE recipes SET is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $stmt->execute([(int) $isPublished, $id]);

    sendJsonResponse([
        'message' => $isPublished ? 'Resep berhasil ditayangkan.' : 'Resep berhasil disembunyikan.',
        'is_published' => $isPublished,
    ]);
}

if ($requestMethod === 'DELETE') {
    $id = readQueryInt('id', 1, 4294967295);
    session_write_close();

    if ($id === null) {
        sendErrorResponse('Parameter id wajib diisi dengan bilangan bulat positif.', 422);
    }

    $stmt = $pdo->prepare('SELECT id FROM recipes WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->fetch() === false) {
        sendErrorResponse('Resep tidak ditemukan.', 404);
    }

    $stmt = $pdo->prepare('DELETE FROM recipes WHERE id = ?');
    $stmt->execute([$id]);

    sendJsonResponse([
        'message' => 'Resep berhasil dihapus.',
    ]);
}

// POST (Create) or PUT (Update)
$isUpdate = $requestMethod === 'PUT';
$updateId = null;

if ($isUpdate) {
    $updateId = readQueryInt('id', 1, 4294967295);
    if ($updateId === null) {
        sendErrorResponse('Parameter id wajib diisi dengan bilangan bulat positif.', 422);
    }

    $stmt = $pdo->prepare('SELECT id, slug FROM recipes WHERE id = ?');
    $stmt->execute([$updateId]);
    $existing = $stmt->fetch();
    if ($existing === false) {
        sendErrorResponse('Resep tidak ditemukan.', 404);
    }
}

$input = readJsonBody();
session_write_close();

$title = isset($input['title']) && is_string($input['title']) ? trim($input['title']) : '';
if ($title === '' || mb_strlen($title, 'UTF-8') < 3 || mb_strlen($title, 'UTF-8') > 150) {
    sendErrorResponse('Judul resep wajib diisi antara 3 sampai 150 karakter.', 422);
}

$story = isset($input['story']) && is_string($input['story']) ? trim($input['story']) : '';
if ($story === '') {
    sendErrorResponse('Deskripsi/cerita resep wajib diisi.', 422);
}

$region = isset($input['region']) && is_string($input['region']) ? trim($input['region']) : 'Nusantara';
if (mb_strlen($region, 'UTF-8') > 60) {
    sendErrorResponse('Asal daerah maksimal 60 karakter.', 422);
}

$cookTime = isset($input['cook_time_minutes']) && is_numeric($input['cook_time_minutes']) ? (int) $input['cook_time_minutes'] : 30;
if ($cookTime < 1 || $cookTime > 65535) {
    sendErrorResponse('Waktu memasak harus antara 1 sampai 65535 menit.', 422);
}

$difficulty = isset($input['difficulty']) && is_string($input['difficulty']) ? strtolower(trim($input['difficulty'])) : 'sedang';
if (!in_array($difficulty, ['mudah', 'sedang', 'sulit'], true)) {
    sendErrorResponse('Tingkat kesulitan harus mudah, sedang, atau sulit.', 422);
}

$servings = isset($input['servings']) && is_numeric($input['servings']) ? (int) $input['servings'] : 2;
if ($servings < 1 || $servings > 255) {
    sendErrorResponse('Porsi harus antara 1 sampai 255.', 422);
}

$imagePath = isset($input['image_path']) && is_string($input['image_path']) ? trim($input['image_path']) : null;
if ($imagePath === '') {
    $imagePath = null;
}
if ($imagePath !== null && str_starts_with($imagePath, 'data:image/')) {
    if (preg_match('/^data:image\/(jpeg|png|webp);base64,(.+)$/', $imagePath, $matches)) {
        $ext = '.' . ($matches[1] === 'jpeg' ? 'jpg' : $matches[1]);
        $imageData = base64_decode($matches[2], true);
        if ($imageData !== false && strlen($imageData) <= 5 * 1024 * 1024) {
            $uploadDir = realpath(__DIR__ . '/../../../frontend/img');
            if ($uploadDir === false) {
                $uploadDir = __DIR__ . '/../../../frontend/img';
            }
            $targetSubDir = $uploadDir . DIRECTORY_SEPARATOR . 'uploads';
            if (!is_dir($targetSubDir)) {
                mkdir($targetSubDir, 0755, true);
            }
            $safeName = 'resep_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . $ext;
            if (file_put_contents($targetSubDir . DIRECTORY_SEPARATOR . $safeName, $imageData) !== false) {
                $imagePath = 'img/uploads/' . $safeName;
            }
        }
    }
}
if ($imagePath !== null && mb_strlen($imagePath, 'UTF-8') > 255) {
    sendErrorResponse('Path gambar maksimal 255 karakter.', 422);
}

$isPublished = isset($input['is_published']) ? (bool) $input['is_published'] : true;
$categories = isset($input['categories']) && is_array($input['categories']) ? $input['categories'] : [];
$ingredients = isset($input['ingredients']) && is_array($input['ingredients']) ? $input['ingredients'] : [];
$steps = isset($input['steps']) && is_array($input['steps']) ? $input['steps'] : [];

try {
    $pdo->beginTransaction();

    if ($isUpdate) {
        $slug = generateRecipeSlug($pdo, $title, $updateId);
        $stmt = $pdo->prepare(
            'UPDATE recipes
             SET title = ?, slug = ?, region = ?, story = ?, image_path = ?,
                 cook_time_minutes = ?, difficulty = ?, servings = ?,
                 is_published = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?'
        );
        $stmt->execute([
            $title, $slug, $region, $story, $imagePath,
            $cookTime, $difficulty, $servings, (int) $isPublished, $updateId,
        ]);
        $recipeId = $updateId;
    } else {
        $slug = generateRecipeSlug($pdo, $title);
        $stmt = $pdo->prepare(
            'INSERT INTO recipes (created_by, title, slug, region, story, image_path,
                                  cook_time_minutes, difficulty, servings, is_published)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $user['id'], $title, $slug, $region, $story, $imagePath,
            $cookTime, $difficulty, $servings, (int) $isPublished,
        ]);
        $recipeId = (int) $pdo->lastInsertId();
    }

    syncRecipeCategories($pdo, $recipeId, $categories);
    syncRecipeIngredients($pdo, $recipeId, $ingredients);
    syncRecipeSteps($pdo, $recipeId, $steps);

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

sendJsonResponse([
    'message' => $isUpdate ? 'Resep berhasil diperbarui.' : 'Resep berhasil ditambahkan.',
    'recipe' => [
        'id' => $recipeId,
        'title' => $title,
        'slug' => $slug,
        'region' => $region,
        'is_published' => $isPublished,
    ],
], $isUpdate ? 200 : 201);
