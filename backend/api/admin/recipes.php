<?php
/**
 * Kelola Resep (khusus admin)
 *   GET    /backend/api/admin/recipes.php            -> semua resep (termasuk yang disembunyikan)
 *   GET    /backend/api/admin/recipes.php?id=1       -> detail untuk form Edit
 *   POST   /backend/api/admin/recipes.php            -> Tambah Resep (format body: lihat includes/recipes.php)
 *   PUT    /backend/api/admin/recipes.php?id=1       -> Edit Resep
 *   PATCH  /backend/api/admin/recipes.php?id=1  {is_published: false}  -> Sembunyikan / Tayangkan
 *   DELETE /backend/api/admin/recipes.php?id=1       -> Hapus Resep
 */

declare(strict_types=1);

require_once __DIR__ . '/../../includes/bootstrap.php';
require_once __DIR__ . '/../../includes/recipes.php';

allow('GET', 'POST', 'PUT', 'PATCH', 'DELETE');
$admin = require_admin();

$id = isset($_GET['id']) ? filter_var($_GET['id'], FILTER_VALIDATE_INT) : null;
if ($id !== null && (!$id || !row('SELECT id FROM recipes WHERE id = ?', [$id]))) {
    fail('Resep tidak ditemukan.', 404);
}

switch (method()) {
    case 'GET':
        if ($id) {
            json_out(['recipe' => recipe_detail($id, true)]);
        }
        $list = rows('SELECT * FROM v_recipe_cards ORDER BY created_at DESC, id DESC');
        json_out(['recipes' => array_map('recipe_card', $list)]);

    case 'POST':
        $newId = save_recipe(validate_recipe(input()), (int) $admin['id']);
        json_out(['recipe' => recipe_detail($newId, true)], 201);

    case 'PUT':
        if (!$id) {
            fail('Parameter id wajib diisi.', 422);
        }
        save_recipe(validate_recipe(input()), (int) $admin['id'], $id);
        json_out(['recipe' => recipe_detail($id, true)]);

    case 'PATCH':
        if (!$id || !array_key_exists('is_published', input())) {
            fail('Parameter id dan is_published wajib diisi.', 422);
        }
        run('UPDATE recipes SET is_published = ? WHERE id = ?', [(int) (bool) input()['is_published'], $id]);
        json_out(['recipe' => recipe_detail($id, true)]);

    case 'DELETE':
        if (!$id) {
            fail('Parameter id wajib diisi.', 422);
        }
        // Bahan, langkah, kategori, favorit, dan ulasan ikut terhapus (ON DELETE CASCADE)
        run('DELETE FROM recipes WHERE id = ?', [$id]);
        json_out(['ok' => true]);
}
