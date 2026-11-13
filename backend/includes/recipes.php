<?php
/**
 * Fungsi bersama untuk data resep: format kartu, detail lengkap,
 * dan simpan (tambah/edit) resep beserta bahan, langkah, dan kategori.
 */

declare(strict_types=1);

const DIFFICULTIES = ['mudah', 'sedang', 'sulit'];

/** Ubah 1 baris v_recipe_cards menjadi data kartu resep. */
function recipe_card(array $r): array
{
    return [
        'id'                => (int) $r['id'],
        'title'             => $r['title'],
        'slug'              => $r['slug'],
        'region'            => $r['region'],
        'image_path'        => $r['image_path'],
        'cook_time_minutes' => (int) $r['cook_time_minutes'],
        'difficulty'        => $r['difficulty'],
        'servings'          => (int) $r['servings'],
        'is_published'      => (bool) $r['is_published'],
        'avg_rating'        => $r['avg_rating'] !== null ? (float) $r['avg_rating'] : null,
        'review_count'      => (int) $r['review_count'],
        'favorite_count'    => (int) $r['favorite_count'],
        'categories'        => $r['categories'] ? explode(', ', $r['categories']) : [],
        'created_at'        => $r['created_at'],
    ];
}

/** Detail lengkap satu resep, atau null bila tidak ada / tidak tayang. */
function recipe_detail(int $id, bool $includeHidden = false): ?array
{
    $sql = 'SELECT v.*, r.story FROM v_recipe_cards v JOIN recipes r ON r.id = v.id WHERE v.id = ?';
    if (!$includeHidden) {
        $sql .= ' AND v.is_published = 1';
    }
    $r = row($sql, [$id]);
    if (!$r) {
        return null;
    }

    $recipe = recipe_card($r);
    $recipe['story'] = $r['story'];

    $recipe['ingredients'] = array_map(fn($i) => [
        'name'     => $i['name'],
        'quantity' => $i['quantity'] !== null ? (float) $i['quantity'] : null,
        'unit'     => $i['unit'],
    ], rows('SELECT name, quantity, unit FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order, id', [$id]));

    $recipe['steps'] = array_column(
        rows('SELECT instruction FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number', [$id]),
        'instruction'
    );

    $recipe['reviews'] = array_map(fn($v) => [
        'user_id'    => (int) $v['user_id'],
        'user_name'  => $v['name'],
        'rating'     => (int) $v['rating'],
        'comment'    => $v['comment'],
        'created_at' => $v['created_at'],
    ], rows('SELECT rv.user_id, u.name, rv.rating, rv.comment, rv.created_at
             FROM reviews rv JOIN users u ON u.id = rv.user_id
             WHERE rv.recipe_id = ? ORDER BY rv.created_at DESC', [$id]));

    return $recipe;
}

/** Buat slug unik dari judul, mis. "Soto Ayam" -> "soto-ayam" / "soto-ayam-2". */
function unique_slug(string $title, int $exceptId = 0): string
{
    $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($title)), '-') ?: 'resep';
    $slug = $base;
    for ($n = 2; row('SELECT id FROM recipes WHERE slug = ? AND id <> ?', [$slug, $exceptId]); $n++) {
        $slug = $base . '-' . $n;
    }
    return $slug;
}

/**
 * Validasi input form resep. Mengembalikan data bersih atau memanggil fail().
 *
 * Format input (JSON):
 * {
 *   "title": "...", "region": "...", "story": "...", "image_path": "img/x.jpg",
 *   "cook_time_minutes": 45, "difficulty": "sedang", "servings": 4, "is_published": true,
 *   "categories":  ["Makanan Berat", 2],                 // nama atau id kategori
 *   "ingredients": [{"name":"Garam","quantity":1,"unit":"sdt"}, ...]  // atau ["Garam", 1, "sdt"]
 *   "steps":       ["Langkah 1", "Langkah 2"]
 * }
 */
function validate_recipe(array $in): array
{
    $title = trim((string) ($in['title'] ?? ''));
    if ($title === '' || mb_strlen($title) > 150) {
        fail('Nama resep wajib diisi (maks. 150 karakter).', 422);
    }

    $time = filter_var($in['cook_time_minutes'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
    if ($time === false) {
        fail('Waktu memasak harus angka menit lebih dari 0.', 422);
    }

    $servings = filter_var($in['servings'] ?? 2, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100]]);
    if ($servings === false) {
        fail('Porsi harus angka 1 sampai 100.', 422);
    }

    $difficulty = strtolower(trim((string) ($in['difficulty'] ?? 'sedang')));
    if (!in_array($difficulty, DIFFICULTIES, true)) {
        fail('Tingkat kesulitan harus mudah, sedang, atau sulit.', 422);
    }

    // Kategori: terima nama atau id, ubah ke id
    $categoryIds = [];
    foreach ((array) ($in['categories'] ?? []) as $c) {
        $found = is_numeric($c)
            ? row('SELECT id FROM categories WHERE id = ?', [(int) $c])
            : row('SELECT id FROM categories WHERE name = ? OR slug = ?', [(string) $c, (string) $c]);
        if (!$found) {
            fail('Kategori tidak dikenal: ' . $c, 422);
        }
        $categoryIds[(int) $found['id']] = true;
    }

    // Bahan
    $ingredients = [];
    foreach ((array) ($in['ingredients'] ?? []) as $i) {
        if (is_array($i) && array_is_list($i)) {
            $i = ['name' => $i[0] ?? '', 'quantity' => $i[1] ?? null, 'unit' => $i[2] ?? null];
        }
        $name = trim((string) (is_array($i) ? ($i['name'] ?? '') : $i));
        if ($name === '') {
            continue;
        }
        $qty = is_array($i) && isset($i['quantity']) && $i['quantity'] !== '' ? $i['quantity'] : null;
        if ($qty !== null && (!is_numeric($qty) || $qty < 0)) {
            fail('Jumlah bahan "' . $name . '" harus berupa angka.', 422);
        }
        $ingredients[] = [
            'name'     => mb_substr($name, 0, 120),
            'quantity' => $qty !== null ? (float) $qty : null,
            'unit'     => is_array($i) && !empty($i['unit']) ? mb_substr(trim((string) $i['unit']), 0, 20) : null,
        ];
    }
    if (!$ingredients) {
        fail('Minimal satu bahan harus diisi.', 422);
    }

    // Langkah
    $steps = array_values(array_filter(array_map(
        fn($s) => trim((string) $s),
        (array) ($in['steps'] ?? [])
    ), fn($s) => $s !== ''));
    if (!$steps) {
        fail('Minimal satu langkah memasak harus diisi.', 422);
    }

    $region = trim((string) ($in['region'] ?? ''));
    $image  = trim((string) ($in['image_path'] ?? ''));

    return [
        'title'             => $title,
        'region'            => $region !== '' ? mb_substr($region, 0, 60) : null,
        'story'             => trim((string) ($in['story'] ?? '')) ?: null,
        'image_path'        => $image !== '' ? mb_substr($image, 0, 255) : null,
        'cook_time_minutes' => $time,
        'difficulty'        => $difficulty,
        'servings'          => $servings,
        'is_published'      => array_key_exists('is_published', $in) ? (int) (bool) $in['is_published'] : 1,
        'category_ids'      => array_keys($categoryIds),
        'ingredients'       => $ingredients,
        'steps'             => $steps,
    ];
}

/**
 * Simpan resep (tambah bila $id = 0, edit bila $id > 0) dalam satu transaksi.
 * Mengembalikan id resep.
 */
function save_recipe(array $d, int $adminId, int $id = 0): int
{
    $conn = db();
    $conn->begin_transaction();
    try {
        $slug = unique_slug($d['title'], $id);
        $fields = [$d['title'], $slug, $d['region'], $d['story'], $d['image_path'],
                   $d['cook_time_minutes'], $d['difficulty'], $d['servings'], $d['is_published']];

        if ($id === 0) {
            run('INSERT INTO recipes (title, slug, region, story, image_path, cook_time_minutes,
                                      difficulty, servings, is_published, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [...$fields, $adminId]);
            $id = (int) $conn->insert_id;
        } else {
            run('UPDATE recipes SET title = ?, slug = ?, region = ?, story = ?, image_path = ?,
                        cook_time_minutes = ?, difficulty = ?, servings = ?, is_published = ?
                 WHERE id = ?', [...$fields, $id]);
            // Ganti seluruh bahan, langkah, dan kategori dengan yang baru
            run('DELETE FROM recipe_categories  WHERE recipe_id = ?', [$id]);
            run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [$id]);
            run('DELETE FROM recipe_steps       WHERE recipe_id = ?', [$id]);
        }

        foreach ($d['category_ids'] as $cid) {
            run('INSERT INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)', [$id, $cid]);
        }
        foreach ($d['ingredients'] as $n => $i) {
            run('INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, sort_order) VALUES (?, ?, ?, ?, ?)',
                [$id, $i['name'], $i['quantity'], $i['unit'], $n + 1]);
        }
        foreach ($d['steps'] as $n => $s) {
            run('INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)', [$id, $n + 1, $s]);
        }

        $conn->commit();
        return $id;
    } catch (Throwable $e) {
        $conn->rollback();
        throw $e;
    }
}
