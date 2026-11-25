# FoodHub

FoodHub adalah aplikasi web resep makanan Nusantara. Pengunjung dapat mencari resep dan melihat detail cara memasaknya; pengguna dapat menyimpan resep favorit dan menulis ulasan; admin dapat mengelola resep, moderasi, pengguna, serta melihat statistik.

Aplikasi terdiri dari frontend HTML, CSS, dan JavaScript; backend API PHP; serta database MySQL/MariaDB.

## Fitur aplikasi

### Pengunjung

- Melihat resep pilihan dan daftar resep.
- Mencari resep serta memfilter daftar berdasarkan kategori dan kriteria yang tersedia.
- Membuka detail resep, melihat bahan dan langkah memasak, serta menyesuaikan jumlah porsi.
- Membaca FAQ.

### Pengguna

- Mendaftar, masuk, dan keluar dari akun.
- Mengelola informasi profil.
- Menyimpan dan menghapus resep favorit.
- Membaca dan mengirim rating serta ulasan pada resep.

### Admin

- Melihat statistik ringkas aplikasi.
- Menambah, melihat, mengubah, dan menghapus resep.
- Mengunggah gambar resep dan mengatur status tayang atau tersembunyi.
- Memoderasi resep dan mengelola pengguna.

## Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | PHP dan PDO |
| Database | MySQL/MariaDB |
| Pengujian frontend | Node.js `node:test` |
| Pengujian API | PHP CLI |

Frontend tidak menggunakan framework JavaScript eksternal. Permintaan data dan autentikasi dilakukan melalui endpoint PHP di backend.

## Struktur proyek

```text
FoodHub/
├── frontend/
│   ├── index.html                 # Beranda
│   ├── daftar-resep.html          # Daftar dan pencarian resep
│   ├── detail-resep.html          # Detail resep
│   ├── faq.html                   # Pertanyaan umum
│   ├── masuk.html                 # Form masuk
│   ├── daftar.html                # Form pendaftaran
│   ├── profil.html                # Profil dan resep favorit
│   ├── admin/                     # Halaman admin
│   ├── css/style.css              # Gaya antarmuka
│   ├── js/main.js                 # Interaksi halaman dan komunikasi API
│   ├── tests/auth.test.js         # Pengujian autentikasi frontend
│   └── img/                       # Logo dan gambar resep
├── backend/
│   ├── api/                       # Endpoint API
│   │   └── admin/                 # Endpoint khusus admin
│   ├── config/                    # Konfigurasi koneksi database
│   ├── includes/                  # Helper autentikasi, CSRF, respons, validasi
│   └── tests/api.php              # Pengujian API
├── database/
│   ├── foodhub.sql                # Skema dan data awal
│   ├── queries.sql                # Contoh query
│   └── migrations/                # Migrasi untuk database yang sudah ada
├── docs/                          # Dokumen laporan proyek
└── README.md                      # Panduan umum proyek
```

Penjelasan dan instruksi teknis tiap bagian tersedia di:

- [Panduan frontend](frontend/README.md)
- [Panduan backend dan API](backend/README.md)
- [Panduan database](database/README.md)

## Alur kerja aplikasi

1. Browser memuat halaman frontend dari web server lokal.
2. JavaScript frontend mengirim request ke endpoint pada `backend/api/`.
3. Backend memvalidasi request, sesi pengguna, hak akses, dan token CSRF untuk operasi yang mengubah data.
4. Backend menggunakan PDO untuk membaca atau memperbarui database MySQL/MariaDB.
5. Backend mengirim respons JSON yang dipakai frontend untuk memperbarui tampilan.

Halaman publik dapat dibuka tanpa akun. Fitur profil dan favorit memerlukan pengguna yang masuk. Endpoint pengelolaan dan statistik admin memerlukan akun admin. Jangan mengandalkan penyembunyian tombol di frontend sebagai kontrol akses; pemeriksaan akses dilakukan kembali oleh backend.

## Menyiapkan proyek secara lokal

### Prasyarat

- Laragon atau XAMPP dengan Apache/Nginx dan MySQL/MariaDB.
- PHP dengan ekstensi `pdo_mysql` dan `mbstring`, serta dukungan session.
- Node.js untuk menjalankan pengujian frontend.

### Langkah persiapan

1. Letakkan atau clone proyek di direktori web server lokal, misalnya direktori `www` Laragon.
2. Nyalakan web server dan MySQL/MariaDB.
3. Buat database menggunakan [instruksi database](database/README.md). **Import `database/foodhub.sql` akan menghapus database `foodhub` yang sudah ada sebelum membuat ulang; backup data penting terlebih dahulu.**
4. Siapkan konfigurasi koneksi backend dengan menyalin `backend/config/database.example.php` menjadi `backend/config/database.local.php`, lalu sesuaikan host, port, nama database, username, dan password.
5. Buka frontend melalui URL lokal web server, misalnya `http://localhost/FoodHub/frontend/`. Jangan membuka file HTML langsung melalui `file://`, karena frontend perlu mengakses endpoint backend melalui web server.
6. Untuk detail konfigurasi, migrasi database, dan penggunaan API, ikuti [README backend](backend/README.md) serta [README database](database/README.md).

File `database.local.php` berisi konfigurasi lokal dan tidak boleh dibagikan atau digunakan untuk menyimpan kredensial produksi. Gunakan akun database khusus dengan izin minimum pada lingkungan produksi.

## Endpoint backend

Endpoint utama berada di `backend/api/`:

| Endpoint | Fungsi |
|---|---|
| `auth.php` | Registrasi, login, pemeriksaan sesi, dan logout |
| `categories.php` | Membaca kategori resep |
| `recipes.php` | Membaca daftar dan detail resep |
| `profile.php` | Membaca dan memperbarui profil |
| `favorites.php` | Membaca, menyimpan, dan menghapus favorit |
| `reviews.php` | Membaca, membuat, dan menghapus ulasan |
| `admin/recipes.php` | Pengelolaan dan moderasi resep oleh admin |
| `admin/users.php` | Pengelolaan pengguna oleh admin |
| `admin/stats.php` | Statistik dasbor admin |
| `admin/upload.php` | Unggah gambar resep oleh admin |

Rincian method HTTP, parameter, contoh request, bentuk respons, dan aturan validasi dijelaskan di [README backend](backend/README.md).

## Data dan keamanan

- Database menyimpan akun, resep, kategori, bahan, langkah memasak, favorit, ulasan, dan token login persisten.
- Password akun disimpan dalam bentuk hash, bukan sebagai teks biasa.
- Operasi yang mengubah data dilindungi validasi CSRF.
- Endpoint member dan admin memeriksa autentikasi serta peran di backend.
- Query database menggunakan PDO; input pengguna perlu divalidasi dan query memakai prepared statement.
- Resep tersembunyi tidak ditampilkan dalam daftar publik.
- Penghapusan resep atau pengguna dapat menghapus data terkait melalui relasi database. Lihat catatan cascade pada [README database](database/README.md).
- Kredensial, file konfigurasi lokal, dan log internal tidak boleh dipublikasikan.

## Menjalankan pengujian

Jalankan dari direktori utama proyek.

### Pemeriksaan dan pengujian frontend

```sh
node --check frontend/js/main.js
node --test frontend/tests/auth.test.js
```

### Pengujian API

```sh
php backend/tests/api.php
```

Pengujian API memerlukan PHP CLI dengan ekstensi dan layanan database yang sudah dikonfigurasi. Test API dapat membuat serta menghapus data fixture khusus pengujian; gunakan database pengembangan, bukan database produksi. Detail cakupan dan prasyarat pengujian tersedia di [README backend](backend/README.md).
