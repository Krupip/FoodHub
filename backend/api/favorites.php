<?php
/**
 * Resep Favorit (wajib login)
 *   GET    /backend/api/favorites.php                -> daftar resep favorit (Profil > Resep Favorit)
 *   POST   /backend/api/favorites.php  {recipe_id}   -> simpan ke favorit
 *   DELETE /backend/api/favorites.php?recipe_id=1    -> hapus dari favorit
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/recipes.php';

allow('GET', 'POST', 'DELETE');
$userId = (int) require_login()['id'];

if (method() === 'GET') {
    $list = rows('SELECT v.* FROM favorites f JOIN v_recipe_cards v ON v.id = f.recipe_id
                  WHERE f.user_id = ? AND v.is_published = 1
                  ORDER BY f.created_at DESC', [$userId]);
    json_out(['recipes' => array_map('recipe_card', $list)]);
}

$recipeId = filter_var(method() === 'POST' ? (input()['recipe_id'] ?? null) : ($_GET['recipe_id'] ?? null), FILTER_VALIDATE_INT);
if (!$recipeId) {
    fail('recipe_id wajib diisi.', 422);
}

if (method() === 'POST') {
    if (!row('SELECT id FROM recipes WHERE id = ? AND is_published = 1', [$recipeId])) {
        fail('Resep tidak ditemukan.', 404);
    }
    run('INSERT IGNORE INTO favorites (user_id, recipe_id) VALUES (?, ?)', [$userId, $recipeId]);
    json_out(['is_favorite' => true]);
}

// DELETE
run('DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?', [$userId, $recipeId]);
json_out(['is_favorite' => false]);
