-- ==========================================================================
--  FoodHub - Contoh query per halaman
--  Di PHP, ganti nilai contoh dengan placeholder (?) prepared statement.
-- ==========================================================================
USE `foodhub`;

-- --------------------------------------------------------------------------
-- MASUK / DAFTAR (dibutuhkan untuk Profil & Kelola Resep)
-- --------------------------------------------------------------------------
-- Daftar: INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?);
-- Masuk : ambil hash lalu cek dengan password_verify() di PHP
SELECT id, name, email, password_hash, role FROM users WHERE email = 'raka@contoh.id';

-- --------------------------------------------------------------------------
-- BERANDA
-- --------------------------------------------------------------------------
SELECT id, name, slug FROM categories ORDER BY id;                -- chip kategori

SELECT * FROM v_recipe_cards WHERE is_published = 1                 -- resep populer
ORDER BY favorite_count DESC, avg_rating DESC
LIMIT 4;

-- --------------------------------------------------------------------------
-- DAFTAR RESEP - cari nama/bahan + filter kategori, waktu, kesulitan
-- (hapus baris filter yang tidak dipilih pengguna)
-- --------------------------------------------------------------------------
SELECT DISTINCT v.*
FROM v_recipe_cards v
LEFT JOIN recipe_ingredients ri ON ri.recipe_id = v.id
LEFT JOIN recipe_categories  rc ON rc.recipe_id = v.id
WHERE v.is_published = 1
  AND (v.title LIKE '%soto%' OR ri.name LIKE '%soto%')
  AND rc.category_id = 1
  AND v.cook_time_minutes <= 90
  AND v.difficulty = 'sedang'
ORDER BY v.title;

-- --------------------------------------------------------------------------
-- DETAIL RESEP
-- --------------------------------------------------------------------------
SELECT v.*, r.story FROM v_recipe_cards v JOIN recipes r ON r.id = v.id WHERE v.id = 1 AND v.is_published = 1;

-- Bahan, takaran disesuaikan porsi (contoh: dari porsi dasar jadi 3 porsi)
SELECT ri.name, ROUND(ri.quantity * 3 / r.servings, 2) AS quantity, ri.unit
FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id
WHERE ri.recipe_id = 1 ORDER BY ri.sort_order;

SELECT step_number, instruction FROM recipe_steps WHERE recipe_id = 1 ORDER BY step_number;

SELECT rv.rating, rv.comment, rv.created_at, u.name
FROM reviews rv JOIN users u ON u.id = rv.user_id
WHERE rv.recipe_id = 1 ORDER BY rv.created_at DESC;

-- Sudah difavoritkan user ini? (untuk tombol Simpan)
SELECT 1 FROM favorites WHERE user_id = 2 AND recipe_id = 1;

-- Simpan / batal favorit
-- INSERT IGNORE INTO favorites (user_id, recipe_id) VALUES (?, ?);
-- DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?;

-- Tulis ulasan (kalau sudah pernah, ulasan lama diganti)
-- INSERT INTO reviews (recipe_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
--   ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment);

-- --------------------------------------------------------------------------
-- PROFIL
-- --------------------------------------------------------------------------
-- Informasi Profil
SELECT id, name, email, role, bio, avatar_path, created_at FROM users WHERE id = 2;
-- UPDATE users SET name = ?, bio = ? WHERE id = ?;
-- Ganti password: UPDATE users SET password_hash = ? WHERE id = ?;

-- Resep Favorit
SELECT v.* FROM favorites f JOIN v_recipe_cards v ON v.id = f.recipe_id
WHERE f.user_id = 2 AND v.is_published = 1 ORDER BY f.created_at DESC;

-- --------------------------------------------------------------------------
-- KELOLA RESEP (admin) - cek $_SESSION role = 'admin' di PHP
-- --------------------------------------------------------------------------
-- Daftar resep untuk tabel admin
SELECT id, title, region, categories, cook_time_minutes, difficulty, is_published, created_at
FROM v_recipe_cards ORDER BY created_at DESC;

-- TAMBAH RESEP (pakai transaksi)
-- START TRANSACTION;
-- INSERT INTO recipes (created_by, title, slug, region, story, image_path,
--                      cook_time_minutes, difficulty, servings) VALUES (?,?,?,?,?,?,?,?,?);
-- SET @rid = LAST_INSERT_ID();          -- di PHP: $conn->insert_id
-- INSERT INTO recipe_categories (recipe_id, category_id) VALUES (@rid, ?);
-- INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, sort_order) VALUES (@rid, ?, ?, ?, ?);
-- INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (@rid, ?, ?);
-- COMMIT;

-- EDIT RESEP (pakai transaksi): ubah data utama, lalu ganti bahan/langkah/kategori
-- START TRANSACTION;
-- UPDATE recipes SET title=?, slug=?, region=?, story=?, image_path=?,
--        cook_time_minutes=?, difficulty=?, servings=? WHERE id = ?;
-- DELETE FROM recipe_categories  WHERE recipe_id = ?;
-- DELETE FROM recipe_ingredients WHERE recipe_id = ?;
-- DELETE FROM recipe_steps       WHERE recipe_id = ?;
-- ...INSERT ulang seperti Tambah Resep...
-- COMMIT;

-- SEMBUNYIKAN / TAYANGKAN
-- UPDATE recipes SET is_published = ? WHERE id = ?;

-- HAPUS RESEP (bahan, langkah, kategori, favorit, ulasan ikut terhapus - CASCADE)
-- DELETE FROM recipes WHERE id = ?;
