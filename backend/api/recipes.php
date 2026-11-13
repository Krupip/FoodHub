<?php
/**
 * Resep untuk publik (hanya yang tayang)
 *
 *   GET /backend/api/recipes.php?id=1
 *       Detail Resep: data resep + bahan + langkah + ulasan + is_favorite
 *
 *   GET /backend/api/recipes.php?q=soto&category=makanan-berat&max_time=60&difficulty=sedang&sort=popular&limit=4
 *       Beranda / Daftar Resep. Semua parameter opsional:
 *       q          cari di nama resep, asal daerah, atau nama bahan
 *       category   nama atau slug kategori
 *       max_time   waktu memasak maksimal (menit)
 *       difficulty mudah | sedang | sulit
 *       sort       popular (default) | newest | rating | title
 *       limit      jumlah maksimal hasil (1-100)
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/recipes.php';

allow('GET');

// ---------- Detail ----------
if (isset($_GET['id'])) {
    $id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
    $recipe = $id ? recipe_detail($id) : null;
    if (!$recipe) {
        fail('Resep tidak ditemukan.', 404);
    }

    $user = current_user();
    $recipe['is_favorite'] = $user
        && row('SELECT 1 FROM favorites WHERE user_id = ? AND recipe_id = ?', [(int) $user['id'], $id]) !== null;

    json_out(['recipe' => $recipe]);
}

// ---------- Daftar + filter ----------
$where  = ['v.is_published = 1'];
$params = [];

$q = trim((string) ($_GET['q'] ?? ''));
if ($q !== '') {
    $like = '%' . $q . '%';
    $where[] = '(v.title LIKE ? OR v.region LIKE ?
                 OR EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.recipe_id = v.id AND ri.name LIKE ?))';
    array_push($params, $like, $like, $like);
}

$category = trim((string) ($_GET['category'] ?? ''));
if ($category !== '') {
    $where[] = 'EXISTS (SELECT 1 FROM recipe_categories rc JOIN categories c ON c.id = rc.category_id
                        WHERE rc.recipe_id = v.id AND (c.name = ? OR c.slug = ?))';
    array_push($params, $category, $category);
}

$maxTime = filter_var($_GET['max_time'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($maxTime) {
    $where[] = 'v.cook_time_minutes <= ?';
    $params[] = $maxTime;
}

$difficulty = strtolower(trim((string) ($_GET['difficulty'] ?? '')));
if (in_array($difficulty, DIFFICULTIES, true)) {
    $where[] = 'v.difficulty = ?';
    $params[] = $difficulty;
}

$orderBy = [
    'popular' => 'v.favorite_count DESC, v.avg_rating DESC, v.id',
    'rating'  => 'v.avg_rating DESC, v.review_count DESC, v.id',
    'newest'  => 'v.created_at DESC, v.id DESC',
    'title'   => 'v.title',
][$_GET['sort'] ?? 'popular'] ?? 'v.favorite_count DESC, v.avg_rating DESC, v.id';

$limit = filter_var($_GET['limit'] ?? 100, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100]]) ?: 100;

$sql = 'SELECT v.* FROM v_recipe_cards v WHERE ' . implode(' AND ', $where)
     . ' ORDER BY ' . $orderBy . ' LIMIT ' . $limit;

json_out(['recipes' => array_map('recipe_card', rows($sql, $params))]);
