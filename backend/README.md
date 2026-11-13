# Backend FoodHub (PHP native)

API JSON berbasis PHP native + MySQLi. Semua query memakai **prepared statement**,
password memakai `password_hash()` / `password_verify()`, dan login memakai `$_SESSION`.

## Struktur

```
backend/
├── config/database.php      ← setting koneksi MySQL (host, user, password, nama DB)
├── includes/
│   ├── bootstrap.php        ← session, respons JSON, helper query, cek login/admin
│   └── recipes.php          ← format data resep, validasi & simpan resep
└── api/
    ├── health.php           ← cek koneksi database
    ├── auth.php             ← daftar, masuk, keluar, cek user aktif
    ├── categories.php       ← daftar kategori
    ├── recipes.php          ← Beranda, Daftar Resep, Detail Resep
    ├── favorites.php        ← Profil > Resep Favorit, tombol Simpan
    ├── reviews.php          ← rating & ulasan di Detail Resep
    ├── profile.php          ← Profil > Informasi Profil
    └── admin/recipes.php    ← Kelola Resep: tambah, edit, hapus, sembunyikan
```

## Cara menjalankan

1. Nyalakan **MySQL** di XAMPP, lalu import `database/foodhub.sql` lewat phpMyAdmin.
2. Jalankan server dari **folder utama proyek** (folder `FoodHub`, bukan folder `backend`):

   ```
   C:\xampp\php\php.exe -S localhost:8000
   ```

   Atau pindahkan folder `FoodHub` ke `C:\xampp\htdocs\` lalu nyalakan **Apache**
   (alamatnya jadi `http://localhost/FoodHub/...`).
3. Cek koneksi: buka `http://localhost:8000/backend/api/health.php`.
   Kalau berhasil, hasilnya `{"status":"ok","database":"foodhub","recipes":14}`.

Frontend dan backend harus dibuka dari alamat (host & port) yang sama supaya cookie login ikut terkirim.
Dari halaman di `frontend/`, alamat API-nya `../backend/api/...`
(dari `frontend/admin/` alamatnya `../../backend/api/...`).

## Daftar endpoint

Semua respons berupa JSON. Kalau gagal, bentuknya `{"error": "pesan"}` dengan kode HTTP 4xx/5xx.
Data dikirim sebagai JSON (`Content-Type: application/json`).

| Method | URL | Akses | Kegunaan |
|---|---|---|---|
| GET | `api/health.php` | Semua | Cek koneksi database |
| POST | `api/auth.php?action=register` | Tamu | Daftar `{name, email, password}` |
| POST | `api/auth.php?action=login` | Tamu | Masuk `{email, password, remember}` |
| POST | `api/auth.php?action=logout` | Member | Keluar |
| GET | `api/auth.php?action=me` | Semua | User yang sedang login (`null` jika tamu) |
| GET | `api/categories.php` | Semua | Daftar kategori |
| GET | `api/recipes.php` | Semua | Daftar resep. Filter opsional: `q`, `category`, `max_time`, `difficulty`, `sort` (`popular`/`newest`/`rating`/`title`), `limit` |
| GET | `api/recipes.php?id=1` | Semua | Detail resep: bahan, langkah, ulasan, `is_favorite` |
| GET | `api/favorites.php` | Member | Daftar resep favorit |
| POST | `api/favorites.php` | Member | Simpan favorit `{recipe_id}` |
| DELETE | `api/favorites.php?recipe_id=1` | Member | Hapus favorit |
| POST | `api/reviews.php` | Member | Kirim ulasan `{recipe_id, rating, comment}` |
| GET | `api/profile.php` | Member | Informasi profil |
| POST | `api/profile.php` | Member | Ubah profil `{name, bio}` |
| POST | `api/profile.php?action=password` | Member | Ganti sandi `{current_password, new_password}` |
| GET | `api/admin/recipes.php` | Admin | Semua resep, termasuk yang disembunyikan |
| GET | `api/admin/recipes.php?id=1` | Admin | Detail resep untuk form Edit |
| POST | `api/admin/recipes.php` | Admin | Tambah resep |
| PUT | `api/admin/recipes.php?id=1` | Admin | Edit resep |
| PATCH | `api/admin/recipes.php?id=1` | Admin | Sembunyikan/tayangkan `{is_published: false}` |
| DELETE | `api/admin/recipes.php?id=1` | Admin | Hapus resep |

Contoh body **Tambah/Edit Resep**:

```json
{
  "title": "Rendang Daging Sapi",
  "region": "Sumatera Barat",
  "story": "Cerita di balik resep...",
  "image_path": "img/rendang.jpg",
  "cook_time_minutes": 180,
  "difficulty": "sulit",
  "servings": 6,
  "is_published": true,
  "categories": ["Makanan Berat"],
  "ingredients": [
    {"name": "Daging sapi", "quantity": 1000, "unit": "g"},
    ["Garam", 1, "sdt"]
  ],
  "steps": ["Haluskan bumbu.", "Masak bersama santan hingga kering."]
}
```

## Contoh pemakaian dari JavaScript (frontend)

```js
// Daftar resep kategori "Cepat"
const res = await fetch('../backend/api/recipes.php?category=cepat');
const { recipes } = await res.json();

// Masuk
const r = await fetch('../backend/api/auth.php?action=login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, remember: true })
});
const data = await r.json();
if (!r.ok) toast(data.error);
```

Teks dari API (judul, ulasan, dan sebagainya) dikirim apa adanya. Saat menampilkannya di HTML,
tetap lewatkan ke fungsi `esc()` yang sudah ada di `main.js` supaya aman dari XSS.
