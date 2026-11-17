# FoodHub — Platform Resep Makanan Nusantara Digital

FoodHub adalah aplikasi web platform resep makanan digital Nusantara yang dibangun menggunakan **Native PHP 8+**, **MySQL/MariaDB**, serta **Vanilla Web Standards (HTML5, CSS3, Modern ES6+ JavaScript)** tanpa ketergantungan framework atau library eksternal.

---

## 🚀 Fitur Utama

### 1. Eksplorasi & Katalog Resep
- **Pencarian & Multi-Filter:** Pencarian nama resep atau bahan secara real-time dengan filter kategori masakan, batas waktu memasak, dan tingkat kesulitan.
- **Katalog Responsif:** Grid kartu resep dengan foto, asal daerah, durasi memasak, dan rating rata-rata bintang.
- **Detail Resep Interaktif:** Kalkulator porsi dinamis (perhitungan proporsional bahan otomatis) dan langkah memasak terurut.

### 2. Autentikasi & Keamanan Sesi
- **Registrasi & Login:** Berbasis sesi aman di database dengan password hashing (`PASSWORD_DEFAULT`), normalisasi input, dan proteksi role.
- **Ingat Saya (Persistent Login):** Token 30 hari berbasis HttpOnly cookie dengan hash SHA-256 verifier di database dan rotasi token otomatis.
- **Proteksi CSRF Komprehensif:** Header `X-CSRF-Token` 64 karakter hex wajib untuk semua mutasi HTTP (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Fail-Closed:** Penolakan akses instan untuk identitas tidak sah atau manipulasi role.

### 3. Akun & Interaksi Pengguna (Member)
- **Profil Pengguna:** Melihat informasi akun dan memperbarui nama tampilan profil.
- **Koleksi Resep Favorit:** Menyimpan dan menghapus resep favorit dengan sinkronisasi database.
- **Rating & Ulasan:** Memberikan ulasan teks dan rating bintang 1–5 untuk resep yang tayang (1 ulasan per resep per akun).

### 4. Panel Pengelola Admin (`/admin/`)
- **Dasbor Statistik:** Ringkasan statistik real-time dari database (total resep, resep tayang, resep disembunyikan, dan total pengguna).
- **Kelola Resep:** Fitur pencarian resep secara real-time (*search*), menambah resep baru via formulir modal lengkap, memperbarui resep, dan menghapus resep (cascade delete bahan, langkah, dan favorit).
- **Moderasi Resep:** Mengubah status tayang/sembunyi (*Publish/Hide*) resep secara instan.
- **Kelola Pengguna:** Melihat daftar seluruh akun pengguna, menambahkan akun pengguna baru dengan validasi email duplikat, dan menghapus akun member (dengan proteksi anti-hapus admin).

---

## 🛠️ Struktur Proyek

```
FoodHub/
├── backend/
│   ├── api/
│   │   ├── auth.php             # Endpoint autentikasi (register, login, me, logout)
│   │   ├── categories.php       # Endpoint kategori resep
│   │   ├── favorites.php        # Endpoint kelola resep favorit
│   │   ├── profile.php          # Endpoint profil pengguna
│   │   ├── recipes.php          # Endpoint katalog & detail resep publik
│   │   ├── reviews.php          # Endpoint rating & ulasan resep
│   │   └── admin/
│   │       ├── recipes.php      # CRUD & moderasi resep admin
│   │       ├── stats.php        # Statistik dasbor admin
│   │       └── users.php        # Kelola pengguna admin
│   ├── config/
│   │   ├── database.php         # Handler koneksi PDO
│   │   ├── database.example.php # Contoh konfigurasi lokal
│   │   └── database.local.php   # Konfigurasi lokal (diabaikan Git)
│   ├── includes/
│   │   ├── auth.php             # Guard requireLogin(), requireAdmin(), sesi
│   │   ├── bootstrap.php        # Bootstrap error handling & headers
│   │   ├── csrf.php             # Validasi dan penerbitan token CSRF
│   │   ├── response.php         # Helper sendJsonResponse() & sendErrorResponse()
│   │   └── validation.php       # Helper validasi HTTP request & JSON body
│   └── tests/
│       └── api.php              # Test suite backend integrasi HTTP & MySQL
├── database/
│   ├── foodhub.sql              # Skema database & data awal lengkap
│   ├── queries.sql              # Kueri referensi fitur
│   └── migrations/
│       └── 001_remember_tokens.sql # Migrasi tabel remember_tokens
├── frontend/
│   ├── index.html               # Beranda
│   ├── daftar-resep.html        # Katalog dan pencarian resep
│   ├── detail-resep.html        # Detail resep & kalkulator porsi
│   ├── masuk.html               # Halaman login
│   ├── daftar.html              # Halaman registrasi
│   ├── profil.html              # Halaman profil & koleksi favorit
│   ├── faq.html                 # Halaman FAQ interaktif
│   ├── admin/
│   │   ├── dasbor.html          # Dasbor statistik admin
│   │   ├── kelola-resep.html    # Panel kelola resep
│   │   ├── moderasi-resep.html  # Panel moderasi status tayang resep
│   │   └── kelola-pengguna.html # Panel kelola akun pengguna
│   ├── css/
│   │   └── style.css            # Desain antarmuka & responsivitas
│   ├── js/
│   │   └── main.js              # Logika frontend, auth, dan client API
│   └── tests/
│       └── auth.test.js         # Pengujian frontend Node.js
└── README.md
```

---

## 💻 Panduan Menjalankan

### 1. Prasyarat
- PHP 8.1+ dengan ekstensi `pdo_mysql` dan `mbstring` aktif.
- MySQL/MariaDB (via Laragon atau XAMPP).
- Node.js (untuk menjalankan automated test frontend).

### 2. Konfigurasi Database
1. Buat database dan import skema awal:
   ```sh
   mysql -u root -p foodhub < database/foodhub.sql
   ```
2. Salin file konfigurasi jika belum ada:
   ```sh
   cp backend/config/database.example.php backend/config/database.local.php
   ```
   Sesuaikan `username` dan `password` database lokal Anda.

### 3. Akun Pengujian
| Email | Kata Sandi | Peran | Hak Akses |
|---|---|---|---|
| `admin@foodhub.id` | `admin123` | **Admin** | Dasbor, Kelola & Moderasi Resep, Kelola Pengguna |
| `raka@contoh.id` | `rahasia123` | **Member** | Simpan Favorit, Ulasan & Rating, Edit Profil |
| `nadia@contoh.id` | `rahasia123` | **Member** | Simpan Favorit, Ulasan & Rating, Edit Profil |

---

## 🧪 Menjalankan Pengujian Otomatis

### Pengujian Backend (PHP):
Menguji seluruh endpoint API, autentikasi, guard, CSRF, validasi, dan operasi basis data:
```sh
php backend/tests/api.php
```

### Pengujian Frontend (Node.js):
Menguji kontrak autentikasi, fail-closed, proteksi rute, dan logika CSRF:
```sh
node --check frontend/js/main.js
node --test frontend/tests/auth.test.js
```
