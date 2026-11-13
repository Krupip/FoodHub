-- ==========================================================================
--  FoodHub - Platform Resep Makanan Digital
--  Basis data MySQL / MariaDB (XAMPP)
--
--  Halaman yang didukung:
--    Beranda, Daftar Resep > Detail Resep,
--    Profil > Resep Favorit & Informasi Profil,
--    Kelola Resep (admin) > Tambah / Edit / Hapus Resep
--
--  Cara import: phpMyAdmin -> Import -> pilih file ini -> Go
--           atau: mysql -u root < foodhub.sql
--
--  Akun demo:
--    admin@foodhub.id / admin123    (admin)
--    raka@contoh.id   / rahasia123  (member)
--    nadia@contoh.id  / rahasia123  (member)
-- ==========================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET FOREIGN_KEY_CHECKS = 0;

DROP DATABASE IF EXISTS `foodhub`;
CREATE DATABASE `foodhub` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `foodhub`;

-- --------------------------------------------------------------------------
-- 1. users : akun pengguna (Masuk/Daftar, Profil > Informasi Profil)
-- --------------------------------------------------------------------------
CREATE TABLE `users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(100) NOT NULL,
  `email`         VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'hasil password_hash()',
  `role`          ENUM('member','admin') NOT NULL DEFAULT 'member',
  `avatar_path`   VARCHAR(255) NULL,
  `bio`           VARCHAR(255) NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 2. categories : kategori resep (filter di Beranda & Daftar Resep)
-- --------------------------------------------------------------------------
CREATE TABLE `categories` (
  `id`   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `slug` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name`),
  UNIQUE KEY `uq_categories_slug` (`slug`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 3. recipes : resep (dikelola admin lewat Kelola Resep)
-- --------------------------------------------------------------------------
CREATE TABLE `recipes` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `created_by`        INT UNSIGNED NULL COMMENT 'admin yang menambahkan',
  `title`             VARCHAR(150) NOT NULL,
  `slug`              VARCHAR(170) NOT NULL,
  `region`            VARCHAR(60)  NULL COMMENT 'asal daerah, mis. Sumatera Barat',
  `story`             TEXT NULL COMMENT 'cerita di balik resep',
  `image_path`        VARCHAR(255) NULL,
  `cook_time_minutes` SMALLINT UNSIGNED NOT NULL,
  `difficulty`        ENUM('mudah','sedang','sulit') NOT NULL DEFAULT 'sedang',
  `servings`          TINYINT UNSIGNED NOT NULL DEFAULT 2 COMMENT 'porsi dasar takaran',
  `is_published`      TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = tayang, 0 = disembunyikan admin',
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_recipes_slug` (`slug`),
  KEY `idx_recipes_title` (`title`),
  CONSTRAINT `fk_recipes_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_recipes_servings` CHECK (`servings` > 0),
  CONSTRAINT `chk_recipes_time`     CHECK (`cook_time_minutes` > 0)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 4. recipe_categories : relasi banyak-ke-banyak resep <-> kategori
-- --------------------------------------------------------------------------
CREATE TABLE `recipe_categories` (
  `recipe_id`   INT UNSIGNED NOT NULL,
  `category_id` SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (`recipe_id`, `category_id`),
  KEY `idx_rc_category` (`category_id`),
  CONSTRAINT `fk_rc_recipe`   FOREIGN KEY (`recipe_id`)   REFERENCES `recipes` (`id`)    ON DELETE CASCADE,
  CONSTRAINT `fk_rc_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 5. recipe_ingredients : bahan + takaran untuk porsi dasar
--    takaran porsi baru = quantity * porsi_baru / recipes.servings
-- --------------------------------------------------------------------------
CREATE TABLE `recipe_ingredients` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recipe_id`  INT UNSIGNED NOT NULL,
  `name`       VARCHAR(120) NOT NULL,
  `quantity`   DECIMAL(10,2) NULL COMMENT 'NULL = secukupnya',
  `unit`       VARCHAR(20) NULL,
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_ri_recipe` (`recipe_id`),
  CONSTRAINT `fk_ri_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 6. recipe_steps : langkah memasak berurutan
-- --------------------------------------------------------------------------
CREATE TABLE `recipe_steps` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recipe_id`   INT UNSIGNED NOT NULL,
  `step_number` SMALLINT UNSIGNED NOT NULL,
  `instruction` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_steps_order` (`recipe_id`, `step_number`),
  CONSTRAINT `fk_steps_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 7. favorites : resep yang disimpan member (Profil > Resep Favorit)
-- --------------------------------------------------------------------------
CREATE TABLE `favorites` (
  `user_id`    INT UNSIGNED NOT NULL,
  `recipe_id`  INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `recipe_id`),
  KEY `idx_fav_recipe` (`recipe_id`),
  CONSTRAINT `fk_fav_user`   FOREIGN KEY (`user_id`)   REFERENCES `users` (`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_fav_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 8. reviews : rating 1-5 & ulasan di Detail Resep (1 per member per resep)
-- --------------------------------------------------------------------------
CREATE TABLE `reviews` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recipe_id`  INT UNSIGNED NOT NULL,
  `user_id`    INT UNSIGNED NOT NULL,
  `rating`     TINYINT UNSIGNED NOT NULL,
  `comment`    TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reviews_user_recipe` (`recipe_id`, `user_id`),
  KEY `idx_reviews_user` (`user_id`),
  CONSTRAINT `fk_reviews_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_user`   FOREIGN KEY (`user_id`)   REFERENCES `users` (`id`)   ON DELETE CASCADE,
  CONSTRAINT `chk_reviews_rating` CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- VIEW v_recipe_cards : data kartu resep (Beranda, Daftar Resep, Favorit)
-- --------------------------------------------------------------------------
CREATE VIEW `v_recipe_cards` AS
SELECT
  r.id, r.title, r.slug, r.region, r.image_path, r.cook_time_minutes,
  r.difficulty, r.servings, r.is_published, r.created_at,
  (SELECT ROUND(AVG(rv.rating), 1) FROM reviews rv WHERE rv.recipe_id = r.id) AS avg_rating,
  (SELECT COUNT(*) FROM reviews rv WHERE rv.recipe_id = r.id)                AS review_count,
  (SELECT COUNT(*) FROM favorites f WHERE f.recipe_id = r.id)                AS favorite_count,
  (SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ')
     FROM recipe_categories rc JOIN categories c ON c.id = rc.category_id
    WHERE rc.recipe_id = r.id)                                               AS categories
FROM recipes r;

-- ==========================================================================
--  DATA AWAL - 14 resep sama dengan data frontend (js/main.js)
-- ==========================================================================

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `created_at`) VALUES
  (1, 'Admin FoodHub', 'admin@foodhub.id', '$2y$10$GH6HWReWzDWY50/mmjlfV.nfSU8Jlg5Q6HdTg9Iltomp651YB6ZOi', 'admin', '2026-08-01 08:00:00'),
  (2, 'Raka Pratama', 'raka@contoh.id', '$2y$10$cGLCubazt9NwRGCgBtsMi.OMnu5JUuDZyeQujeqJPGqYcYswLZp4i', 'member', '2026-09-12 10:00:00'),
  (3, 'Nadia Putri', 'nadia@contoh.id', '$2y$10$cGLCubazt9NwRGCgBtsMi.OMnu5JUuDZyeQujeqJPGqYcYswLZp4i', 'member', '2026-10-03 09:30:00');

INSERT INTO `categories` (`id`, `name`, `slug`) VALUES
  (1, 'Makanan Berat', 'makanan-berat'),
  (2, 'Sehat', 'sehat'),
  (3, 'Kue', 'kue'),
  (4, 'Minuman', 'minuman'),
  (5, 'Cepat', 'cepat'),
  (6, 'Anak Kos', 'anak-kos');

INSERT INTO `recipes` (`id`, `created_by`, `title`, `slug`, `region`, `story`, `image_path`, `cook_time_minutes`, `difficulty`, `servings`, `created_at`) VALUES
  (1, 1, 'Rendang Daging Sapi', 'rendang-daging-sapi', 'Sumatera Barat', 'Olahan daging sapi empuk kaya rempah khas Minangkabau yang dimasak perlahan hingga santan mengering dan bumbu meresap sempurna.', 'img/rendang.jpg', 180, 'sulit', 6, '2026-08-05 08:00:00'),
  (2, 1, 'Gulai Itiak', 'gulai-itiak', 'Sumatera Barat', 'Gulai bebek muda khas Koto Gadang Bukittinggi dengan lumuran sambal cabai hijau berlimpah dan santan gurih aromatik.', 'img/gulai-itiak.jpg', 120, 'sedang', 4, '2026-08-05 08:00:00'),
  (3, 1, 'Sate Padang', 'sate-padang', 'Sumatera Barat', 'Sate lidah dan daging sapi empuk dengan siraman kuah kuning kental kaya rempah kunyit, serai, dan lada gurih pedas.', 'img/sate-padang.jpg', 60, 'sedang', 4, '2026-08-05 08:00:00'),
  (4, 1, 'Pempek Kapal Selam', 'pempek-kapal-selam', 'Sumatera Selatan', 'Olahan ikan tenggiri kenyal khas Palembang berisi telur utuh, digoreng garing lalu disajikan dengan cuko pedas manis asam.', 'img/pempek.jpg', 90, 'sedang', 6, '2026-08-05 08:00:00'),
  (5, 1, 'Soto Ayam Lamongan', 'soto-ayam-lamongan', 'Jawa Timur', 'Soto ayam berkuah kuning bening gurih segar dengan taburan bubuk koya gurih renyah dari kerupuk udang dan bawang putih.', 'img/soto-lamongan.jpg', 60, 'sedang', 4, '2026-08-05 08:00:00'),
  (6, 1, 'Rawon Daging Sapi', 'rawon-daging-sapi', 'Jawa Timur', 'Sup daging sapi khas Jawa Timur berwarna hitam pekat dari kluwek matang, disajikan bersama sambal terasi dan tauge pendek segar.', 'img/rawon.jpg', 90, 'sedang', 5, '2026-08-05 08:00:00'),
  (7, 1, 'Gudeg Jogja', 'gudeg-jogja', 'DI Yogyakarta', 'Nangka muda dimasak perlahan berjam-jam dengan santan kental, gula aren murni, dan daun jati hingga cokelat kemerahan manis legit.', 'img/gudeg.jpg', 240, 'sulit', 6, '2026-08-05 08:00:00'),
  (8, 1, 'Sate Lilit Bali', 'sate-lilit-bali', 'Bali', 'Cincangan daging ikan tenggiri lembut berpadu parutan kelapa muda dan rempah base genep khas Bali, dililitkan di batang serai harum.', 'img/sate-lilit.jpg', 50, 'sedang', 4, '2026-08-05 08:00:00'),
  (9, 1, 'Ayam Betutu', 'ayam-betutu', 'Bali', 'Ayam kampung utuh berbalur rempah bumbu genep komplit pedas gurih, dibungkus daun pisang lalu dipanggang matang meresap.', 'img/ayam-betutu.jpg', 120, 'sedang', 5, '2026-08-05 08:00:00'),
  (10, 1, 'Papeda Kuah Kuning', 'papeda-kuah-kuning', 'Papua', 'Papeda sagu kenyal lembut khas pesisir timur Nusantara disiram sup ikan tongkol kuah kuning beraroma kemangi dan asam jeruk nipis.', 'img/papeda.jpg', 45, 'sedang', 4, '2026-08-05 08:00:00'),
  (11, 1, 'Gado-Gado Betawi', 'gado-gado-betawi', 'DKI Jakarta', 'Salad tradisional Betawi dari aneka sayuran rebus segar, tahu tempe goreng, disiram saus kacang tanah legit gurih beraroma limau.', 'img/gado-gado.jpg', 35, 'mudah', 3, '2026-08-05 08:00:00'),
  (12, 1, 'Es Cendol Dawet', 'es-cendol-dawet', 'Jawa Tengah', 'Minuman es tradisional Jawa dengan cendol pandan hijau kenyal, siraman santan gurih segar, dan kinca gula kelapa nangka wangi.', 'img/es-cendol.jpg', 40, 'sedang', 4, '2026-08-05 08:00:00'),
  (13, 1, 'Nasi Liwet Solo', 'nasi-liwet-solo', 'Jawa Tengah', 'Nasi gurih harum berbalur santan dan rempah daun salam, disajikan hangat dengan suwiran ayam opor lembut, sayur labu siam, dan areh santan.', 'img/nasi-liwet.jpg', 60, 'sedang', 4, '2026-08-05 08:00:00'),
  (14, 1, 'Soto Makassar', 'soto-makassar', 'Sulawesi Selatan', 'Sup daging sapi khas Makassar berkuah kaldu pekat gurih berbumbu rempah kacang tanah sangrai, disajikan bersama ketupat daun kelapa.', 'img/soto-makassar.jpg', 90, 'sedang', 5, '2026-08-05 08:00:00');

INSERT INTO `recipe_categories` (`recipe_id`, `category_id`) VALUES
  (1, 1),
  (2, 1),
  (3, 1),
  (4, 1),
  (4, 5),
  (5, 1),
  (5, 6),
  (6, 1),
  (7, 1),
  (8, 1),
  (8, 5),
  (9, 1),
  (10, 1),
  (10, 2),
  (11, 2),
  (11, 1),
  (11, 5),
  (12, 4),
  (12, 5),
  (13, 1),
  (14, 1);

INSERT INTO `recipe_ingredients` (`recipe_id`, `name`, `quantity`, `unit`, `sort_order`) VALUES
  (1, 'Daging sapi', 1000, 'g', 1),
  (1, 'Santan kental', 1000, 'ml', 2),
  (1, 'Cabai merah', 150, 'g', 3),
  (1, 'Bawang merah', 100, 'g', 4),
  (1, 'Bawang putih', 50, 'g', 5),
  (1, 'Lengkuas', 40, 'g', 6),
  (1, 'Serai', 3, 'batang', 7),
  (1, 'Daun jeruk', 6, 'lembar', 8),
  (1, 'Kelapa parut sangrai', 100, 'g', 9),
  (1, 'Garam', 2, 'sdt', 10),
  (2, 'Bebek muda', 1, 'ekor', 1),
  (2, 'Cabai hijau keriting', 250, 'g', 2),
  (2, 'Bawang merah', 10, 'siung', 3),
  (2, 'Bawang putih', 5, 'siung', 4),
  (2, 'Lengkuas', 30, 'g', 5),
  (2, 'Santan kelapa', 600, 'ml', 6),
  (2, 'Daun kunyit', 1, 'lembar', 7),
  (2, 'Asam kandis', 2, 'buah', 8),
  (2, 'Garam', 1.5, 'sdt', 9),
  (3, 'Daging dan lidah sapi', 500, 'g', 1),
  (3, 'Tepung beras', 60, 'g', 2),
  (3, 'Kunyit', 4, 'ruas', 3),
  (3, 'Bawang merah', 8, 'siung', 4),
  (3, 'Bawang putih', 4, 'siung', 5),
  (3, 'Ketumbar sangrai', 1, 'sdm', 6),
  (3, 'Serai', 2, 'batang', 7),
  (3, 'Air kaldu rebusan', 800, 'ml', 8),
  (3, 'Garam', 1.5, 'sdt', 9),
  (4, 'Ikan tenggiri giling', 500, 'g', 1),
  (4, 'Tepung sagu tani', 300, 'g', 2),
  (4, 'Telur ayam', 4, 'butir', 3),
  (4, 'Bawang putih', 4, 'siung', 4),
  (4, 'Gula merah batok', 200, 'g', 5),
  (4, 'Cabai rawit hijau', 15, 'buah', 6),
  (4, 'Asam jawa', 30, 'g', 7),
  (4, 'Air es', 200, 'ml', 8),
  (4, 'Garam', 1.5, 'sdt', 9),
  (5, 'Ayam kampung', 600, 'g', 1),
  (5, 'Bawang putih', 6, 'siung', 2),
  (5, 'Bawang merah', 8, 'siung', 3),
  (5, 'Kunyit bakar', 3, 'ruas', 4),
  (5, 'Kemiri sangrai', 4, 'butir', 5),
  (5, 'Serai', 2, 'batang', 6),
  (5, 'Daun jeruk', 4, 'lembar', 7),
  (5, 'Kerupuk udang goreng', 50, 'g', 8),
  (5, 'Soun seduh', 80, 'g', 9),
  (5, 'Garam', 2, 'sdt', 10),
  (5, 'Air', 1800, 'ml', 11),
  (6, 'Daging sapi sandung lamur', 600, 'g', 1),
  (6, 'Kluwek tua hitam', 5, 'buah', 2),
  (6, 'Bawang merah', 8, 'siung', 3),
  (6, 'Bawang putih', 5, 'siung', 4),
  (6, 'Lengkuas', 3, 'cm', 5),
  (6, 'Serai', 2, 'batang', 6),
  (6, 'Daun jeruk purut', 4, 'lembar', 7),
  (6, 'Tauge pendek segar', 100, 'g', 8),
  (6, 'Telur asin', 3, 'butir', 9),
  (6, 'Garam', 2, 'sdt', 10),
  (7, 'Nangka muda cacah', 1000, 'g', 1),
  (7, 'Santan kental kelapa', 1000, 'ml', 2),
  (7, 'Gula merah kelapa aren', 150, 'g', 3),
  (7, 'Bawang merah', 10, 'siung', 4),
  (7, 'Bawang putih', 6, 'siung', 5),
  (7, 'Ketumbar bubuk', 1, 'sdm', 6),
  (7, 'Daun salam segar', 6, 'lembar', 7),
  (7, 'Lengkuas memarkan', 50, 'g', 8),
  (7, 'Telur rebus kupas', 6, 'butir', 9),
  (7, 'Garam', 1.5, 'sdt', 10),
  (8, 'Daging ikan tenggiri cincang', 500, 'g', 1),
  (8, 'Kelapa parut setengah tua', 120, 'g', 2),
  (8, 'Bawang merah', 8, 'siung', 3),
  (8, 'Bawang putih', 5, 'siung', 4),
  (8, 'Kencur', 3, 'cm', 5),
  (8, 'Kunyit bakar', 3, 'cm', 6),
  (8, 'Cabai rawit merah', 6, 'buah', 7),
  (8, 'Batang serai segar', 10, 'batang', 8),
  (8, 'Garam', 1, 'sdt', 9),
  (9, 'Ayam kampung utuh', 1, 'ekor', 1),
  (9, 'Bawang merah cincang', 12, 'siung', 2),
  (9, 'Bawang putih cincang', 6, 'siung', 3),
  (9, 'Kencur cincang', 4, 'ruas', 4),
  (9, 'Kunyit cincang', 3, 'ruas', 5),
  (9, 'Lengkuas cincang', 4, 'cm', 6),
  (9, 'Cabai rawit merah iris', 15, 'buah', 7),
  (9, 'Minyak kelapa murni', 4, 'sdm', 8),
  (9, 'Daun pisang pembungkus', 3, 'lembar', 9),
  (9, 'Garam', 2, 'sdt', 10),
  (10, 'Tepung sagu murni', 250, 'g', 1),
  (10, 'Ikan tongkol segar', 500, 'g', 2),
  (10, 'Kunyit bakar', 4, 'ruas', 3),
  (10, 'Bawang merah', 6, 'siung', 4),
  (10, 'Bawang putih', 4, 'siung', 5),
  (10, 'Serai memarkan', 2, 'batang', 6),
  (10, 'Daun kemangi segar', 1, 'ikat', 7),
  (10, 'Jeruk nipis peras', 2, 'buah', 8),
  (10, 'Garam', 1.5, 'sdt', 9),
  (10, 'Air mendidih', 1200, 'ml', 10),
  (11, 'Kacang tanah goreng giling', 200, 'g', 1),
  (11, 'Kentang kukus potong', 2, 'buah', 2),
  (11, 'Kol iris rebus', 100, 'g', 3),
  (11, 'Tauge rebus sebentar', 100, 'g', 4),
  (11, 'Kacang panjang rebus', 100, 'g', 5),
  (11, 'Tahu dan tempe goreng', 4, 'potong', 6),
  (11, 'Telur rebus belah dua', 2, 'butir', 7),
  (11, 'Gula merah aren', 40, 'g', 8),
  (11, 'Air asam jawa', 2, 'sdm', 9),
  (11, 'Jeruk limau', 2, 'buah', 10),
  (11, 'Garam', 1, 'sdt', 11),
  (12, 'Tepung beras', 120, 'g', 1),
  (12, 'Air pandan suji', 500, 'ml', 2),
  (12, 'Santan kelapa matang', 400, 'ml', 3),
  (12, 'Gula merah aren', 200, 'g', 4),
  (12, 'Buah nangka matang', 50, 'g', 5),
  (12, 'Es batu serut', 300, 'g', 6),
  (12, 'Garam', 0.5, 'sdt', 7),
  (13, 'Beras pulen', 450, 'g', 1),
  (13, 'Santan kelapa', 700, 'ml', 2),
  (13, 'Daun salam segar', 4, 'lembar', 3),
  (13, 'Serai memarkan', 2, 'batang', 4),
  (13, 'Daging ayam suwir opor', 200, 'g', 5),
  (13, 'Labu siam iris korek', 150, 'g', 6),
  (13, 'Santan areh kental gurih', 100, 'ml', 7),
  (13, 'Garam', 1.5, 'sdt', 8),
  (14, 'Daging sapi sandung lamur', 700, 'g', 1),
  (14, 'Kacang tanah sangrai giling halus', 150, 'g', 2),
  (14, 'Bawang merah', 10, 'siung', 3),
  (14, 'Bawang putih', 6, 'siung', 4),
  (14, 'Serai memarkan', 3, 'batang', 5),
  (14, 'Lengkuas memarkan', 30, 'g', 6),
  (14, 'Ketumbar sangrai', 1, 'sdm', 7),
  (14, 'Jintan sangrai', 0.5, 'sdt', 8),
  (14, 'Air tajin cucian beras', 1800, 'ml', 9),
  (14, 'Garam', 2, 'sdt', 10);

INSERT INTO `recipe_steps` (`recipe_id`, `step_number`, `instruction`) VALUES
  (1, 1, 'Haluskan cabai merah, bawang merah, bawang putih, jahe, dan lengkuas.'),
  (1, 2, 'Masukkan bumbu halus, serai, daun jeruk, dan santan ke wajan bersama potongan daging.'),
  (1, 3, 'Masak dengan api sedang sambil sesekali diaduk agar santan tidak pecah hingga mendidih.'),
  (1, 4, 'Tambahkan kelapa parut sangrai dan garam, lalu kecilkan api dan aduk perlahan hingga mengering kecokelatan.'),
  (2, 1, 'Bakar sebentar bebek di atas bara untuk membersihkan bulu halus dan mengurangi lemak berlebih.'),
  (2, 2, 'Giling kasar cabai hijau keriting, bawang merah, bawang putih, jahe, dan lengkuas.'),
  (2, 3, 'Tumis bumbu giling bersama daun kunyit dan serai hingga harum semerbak.'),
  (2, 4, 'Tuang santan dan masukkan potongan bebek serta asam kandis, masak api sedang hingga daging bebek empuk meresap.'),
  (3, 1, 'Rebus potongan daging dan lidah sapi bersama bumbu rempah halus dan serai hingga empuk, lalu potong dadu.'),
  (3, 2, 'Tusukkan daging pada tusukan sate bambu, bakar sebentar di atas bara api beraroma asap.'),
  (3, 3, 'Saring air kaldu rebusan, larutkan tepung beras, lalu masak sambil diaduk cepat hingga kuah meletup-letup kental.'),
  (3, 4, 'Sajikan sate hangat disiram kuah kuning kental dan taburan bawang goreng renyah.'),
  (4, 1, 'Uleni ikan tenggiri dingin dengan air es dan garam hingga adonan mengembang kenyal.'),
  (4, 2, 'Campur tepung sagu perlahan bertahap tanpa diuleni terlalu keras.'),
  (4, 3, 'Bentuk adonan menjadi mangkuk kantong, isi dengan sebutir telur mentah, lalu rekatkan tepi adonan rapat.'),
  (4, 4, 'Rebus dalam air mendidih hingga mengapung matang, goreng sesaat sebelum disajikan bersama cuko hitam kental.'),
  (5, 1, 'Rebus ayam kampung bersama serai dan daun jeruk hingga kaldu bening terbentuk, suwir daging ayamnya.'),
  (5, 2, 'Haluskan bawang putih, bawang merah, kunyit, dan kemiri lalu tumis hingga matang harum.'),
  (5, 3, 'Masukkan bumbu tumis ke dalam kuah kaldu rebusan, bumbui garam, dan didihkan hingga meresap gurih.'),
  (5, 4, 'Tumbuk kerupuk udang goreng bersama bawang putih goreng untuk bubuk koya, taburkan di atas mangkuk soto hangat.'),
  (6, 1, 'Rendam isi buah kluwek tua dengan air panas lalu haluskan bersama bawang merah, bawang putih, dan ketumbar.'),
  (6, 2, 'Tumis bumbu halus kluwek bersama serai, lengkuas, dan daun jeruk hingga aroma khas keluar.'),
  (6, 3, 'Masukkan potongan daging sapi, aduk hingga berubah warna lalu tuang air kaldu dan masak hingga empuk.'),
  (6, 4, 'Sajikan rawon hitam gurih dengan taburan tauge pendek mentah, telur asin, dan sambal terasi pedas.'),
  (7, 1, 'Alasi dasar panci dengan daun salam dan potongan lengkuas memar.'),
  (7, 2, 'Tata nangka muda, telur rebus kupas, bumbu halus bawang dan ketumbar, serta sisiran gula merah.'),
  (7, 3, 'Tuang santan kelapa perlahan, masak di atas api kecil berjam-jam hingga air santan mengering meresap.'),
  (7, 4, 'Biarkan gudeg mengendap semalaman agar warna cokelat kemerahan makin pekat dan bumbu manis legit makin mantap.'),
  (8, 1, 'Haluskan bumbu base genep (bawang, kencur, kunyit, cabai) lalu tumis sebentar sampai harum.'),
  (8, 2, 'Campur daging ikan cincang, kelapa parut, bumbu tumis, dan garam hingga adonan liat kalis.'),
  (8, 3, 'Lilitkan adonan pada ujung batang serai segar hingga padat membulat.'),
  (8, 4, 'Panggang di atas bara api atau wajan datar hingga sate harum kekuningan matang merata.'),
  (9, 1, 'Campurkan bumbu cincang genep dengan minyak kelapa dan garam hingga merata.'),
  (9, 2, 'Balurkan bumbu ke seluruh bagian ayam kampung luar dan rongga dalam.'),
  (9, 3, 'Bungkus rapat ayam berbumbu dengan daun pisang berlapis.'),
  (9, 4, 'Kukus selama 45 menit lalu panggang hingga bumbu mengering harum dan daging ayam sangat empuk.'),
  (10, 1, 'Larutkan sagu dengan sedikit air dingin dan perasan jeruk nipis di wadah baskom.'),
  (10, 2, 'Tuangkan air mendidih sambil diaduk cepat satu arah hingga sagu berubah bening kental elastis.'),
  (10, 3, 'Tumis bumbu halus kunyit dan serai, tambahkan air kaldu dan potongan ikan tongkol segar.'),
  (10, 4, 'Masak hingga ikan matang, masukkan daun kemangi dan jeruk nipis, sajikan bersama papeda hangat.'),
  (11, 1, 'Haluskan cabai, bawang putih goreng, garam, dan gula merah di atas cobek.'),
  (11, 2, 'Campur kacang tanah halus dengan air hangat dan asam jawa, uleg hingga menjadi saus kacang kental.'),
  (11, 3, 'Beri perasan jeruk limau segar pada saus kacang agar wangi.'),
  (11, 4, 'Tata sayuran rebus, tahu, tempe, dan telur rebus, siramkan saus kacang dan beri taburan emping.'),
  (12, 1, 'Masak tepung beras dan air pandan sambil diaduk sampai meletup-letup kental bening.'),
  (12, 2, 'Cetak adonan cendol panas di atas wadah berisi air es.'),
  (12, 3, 'Rebus gula merah aren bersama potongan nangka harum menjadi sirup kinca manis.'),
  (12, 4, 'Sajikan cendol dalam gelas bersama sirup kinca, es batu serut, dan siraman santan gurih.'),
  (13, 1, 'Cuci beras bersih, masak bersama santan, daun salam, serai, dan garam hingga santan terserap (aron).'),
  (13, 2, 'Tutup rapat panci liwet dan masak dengan api kecil hingga nasi tanak pulen beraroma harum gurih.'),
  (13, 3, 'Masak sayur labu siam kuah santan pedas gurih untuk pendamping.'),
  (13, 4, 'Sajikan nasi liwet di pincuk daun pisang dengan suwiran ayam opor, sayur labu siam, dan areh santan kental.'),
  (14, 1, 'Rebus daging sapi dalam air tajin bersama serai dan lengkuas sampai empuk, potong dadu.'),
  (14, 2, 'Haluskan bumbu rempah lalu tumis hingga harum semerbak berminyak.'),
  (14, 3, 'Masukkan bumbu tumisan dan gilingan kacang tanah sangrai ke kuah rebusan daging.'),
  (14, 4, 'Masak hingga kuah mengental gurih berminyak. Sajikan panas bersama ketupat, irisan daun seledri, dan perasan jeruk nipis.');

INSERT INTO `favorites` (`user_id`, `recipe_id`, `created_at`) VALUES
  (2, 1, '2026-11-02 12:05:00'),
  (2, 5, '2026-11-08 07:50:00'),
  (3, 11, '2026-11-09 13:15:00'),
  (3, 7, '2026-11-10 20:00:00');

INSERT INTO `reviews` (`recipe_id`, `user_id`, `rating`, `comment`, `created_at`) VALUES
  (1, 2, 5, 'Rendangnya empuk, bumbunya meresap sampai ke dalam!', '2026-11-02 12:00:00'),
  (1, 3, 5, 'Resep warisan yang jelas takarannya. Mantap.', '2026-11-05 18:20:00'),
  (5, 2, 4, 'Kuahnya segar, koyanya bikin nagih.', '2026-11-08 07:45:00'),
  (11, 3, 5, 'Bumbu kacangnya pas, cocok buat makan siang sehat.', '2026-11-09 13:10:00'),
  (12, 2, 4, 'Segar banget buat siang hari.', '2026-11-11 15:30:00');

SET FOREIGN_KEY_CHECKS = 1;
