<?php
/**
 * GET /backend/api/categories.php  -> daftar kategori (chip di Beranda & filter Daftar Resep)
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

allow('GET');

$cats = rows('SELECT id, name, slug FROM categories ORDER BY id');
foreach ($cats as &$c) {
    $c['id'] = (int) $c['id'];
}
json_out(['categories' => $cats]);
