<?php
/**
 * Ulasan & rating di Detail Resep
 *   POST /backend/api/reviews.php  {recipe_id, rating (1-5), comment}
 *   Wajib login. Satu member = satu ulasan per resep (kirim lagi = ulasan diganti).
 *   Daftar ulasan sudah ikut di GET recipes.php?id=...
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/recipes.php';

allow('POST');
$userId = (int) require_login()['id'];

$recipeId = filter_var(input()['recipe_id'] ?? null, FILTER_VALIDATE_INT);
$rating   = filter_var(input()['rating'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 5]]);
$comment  = str_in('comment');

if (!$recipeId || !row('SELECT id FROM recipes WHERE id = ? AND is_published = 1', [$recipeId])) {
    fail('Resep tidak ditemukan.', 404);
}
if ($rating === false || $rating === null) {
    fail('Rating harus angka 1 sampai 5.', 422);
}
if (mb_strlen($comment) > 2000) {
    fail('Ulasan maksimal 2000 karakter.', 422);
}

run('INSERT INTO reviews (recipe_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_at = NOW()',
    [$recipeId, $userId, $rating, $comment !== '' ? $comment : null]);

json_out(['reviews' => recipe_detail($recipeId)['reviews']], 201);
