-- Jalankan pada database FoodHub yang sudah ada; tidak menghapus data pengguna.
-- expires_at disimpan dalam UTC.
CREATE TABLE IF NOT EXISTS `remember_tokens` (
  `selector`   CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id`    INT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `expires_at` DATETIME NOT NULL,
  PRIMARY KEY (`selector`),
  KEY `idx_remember_user` (`user_id`),
  KEY `idx_remember_expiry` (`expires_at`),
  CONSTRAINT `fk_remember_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
