# Backend FoodHub

## Koneksi database (PDO)

### 1. Persiapan

- Jalankan MySQL/MariaDB melalui Laragon.
- Pastikan PHP mengaktifkan ekstensi `pdo_mysql`.
- Import `database/foodhub.sql` jika database belum tersedia. **File tersebut menghapus database `foodhub` yang sudah ada sebelum membuat ulang. Backup data penting terlebih dahulu.**

### 2. Konfigurasi lokal

Jika belum ada, salin `backend/config/database.example.php` menjadi `backend/config/database.local.php`.

Sesuaikan nilai pada `database.local.php` dengan pengaturan database Laragon:

| Kunci | Fungsi | Contoh lokal |
|---|---|---|
| `host` | Alamat server database | `127.0.0.1` |
| `port` | Port MySQL/MariaDB | `3306` |
| `database` | Nama database | `foodhub` |
| `username` | Pengguna database | `root` |
| `password` | Password pengguna database | String kosong jika akun lokal memang tanpa password |

Nilai contoh bukan jaminan konfigurasi Laragon kamu. `database.local.php` diabaikan Git karena berisi kredensial. Jangan gunakan akun `root` tanpa password untuk produksi; gunakan akun khusus dengan izin yang diperlukan saja.

### 3. Menggunakan koneksi

Contoh pemakaian di file langsung di dalam `backend/api/`:

```php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

$pdo = getDatabaseConnection();

$stmt = $pdo->prepare(
    'SELECT id, name, slug FROM categories WHERE id = ?'
);
$stmt->execute([1]);

$category = $stmt->fetch();
```

Gunakan placeholder untuk input pengguna. Jangan menyambungkan input pengguna langsung ke string SQL. Placeholder berlaku untuk nilai; nama kolom atau pilihan sorting harus ditentukan melalui whitelist.

Fungsi `getDatabaseConnection()` membuka koneksi saat pertama kali dipanggil dan menggunakan kembali koneksi tersebut selama request PHP yang sama. Pengaturan koneksi:

- Charset `utf8mb4`.
- Error database menjadi exception (`PDO::ERRMODE_EXCEPTION`).
- Hasil query berupa associative array (`PDO::FETCH_ASSOC`).
- Prepared statement native (`PDO::ATTR_EMULATE_PREPARES = false`).

### 4. Menguji koneksi

Dari terminal di direktori utama proyek `FoodHub`, jalankan:

```sh
php -l backend/config/database.php
php -r 'require "backend/config/database.php"; $pdo = getDatabaseConnection(); echo $pdo->query("SELECT DATABASE()")->fetchColumn(), PHP_EOL;'
```

Jika berhasil, perintah kedua menampilkan `foodhub`. Pengujian ini hanya membaca database, tidak mengubah data.

### 5. Penanganan kegagalan

- Konfigurasi belum tersedia: buat `database.local.php` dari file contoh.
- Ekstensi belum aktif: aktifkan `pdo_mysql` di konfigurasi PHP yang digunakan, lalu restart web server.
- Koneksi gagal: periksa layanan database, host, port, username, password, dan keberadaan database `foodhub`. Detail kesalahan driver dicatat melalui `error_log()` PHP, bukan dimasukkan ke pesan exception publik.

Endpoint API memuat `backend/includes/bootstrap.php` untuk menggunakan penanganan error bersama. Exception yang tidak ditangani menghasilkan respons JSON `500` dengan pesan umum; detail kesalahan dicatat melalui `error_log()`. Bootstrap menonaktifkan `display_errors` dan mengaktifkan `log_errors` untuk request API. Tetap terapkan konfigurasi tersebut pada PHP produksi, termasuk untuk error yang terjadi sebelum bootstrap dijalankan. Jangan sediakan file konfigurasi, log, atau backup database sebagai unduhan publik.

## Pola request dan respons JSON

File bersama yang tersedia:

| File | Fungsi |
|---|---|
| `includes/bootstrap.php` | Memuat helper dan koneksi, mengatur header keamanan/cache, serta menangani error internal |
| `includes/response.php` | Menyediakan `sendJsonResponse()` dan `sendErrorResponse()` |
| `includes/validation.php` | Menyediakan `requireRequestMethod()` dan `readJsonBody()` |

Muat bootstrap di awal endpoint, sebelum mencetak output. Koneksi database baru dibuka ketika `getDatabaseConnection()` dipanggil. Bootstrap belum memulai session atau menerapkan autentikasi; fitur tersebut dikerjakan pada tahap berikutnya.

Contoh pola untuk endpoint POST mendatang (bukan endpoint baru yang sudah diimplementasikan):

```php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

requireRequestMethod('POST');
$input = readJsonBody();

if (!isset($input['name']) || !is_string($input['name']) || trim($input['name']) === '') {
    sendErrorResponse('Nama wajib diisi.', 422);
}

// Jalankan logika fitur dan penyimpanan setelah validasi.
sendJsonResponse(['message' => 'Berhasil.']);
```

- `sendJsonResponse($data, $statusCode = 200)` mengirim JSON dan menghentikan eksekusi. Gunakan status `201` setelah berhasil membuat data.
- `sendErrorResponse($message, $statusCode)` mengirim `{"error":"..."}` dan menghentikan eksekusi.
- `requireRequestMethod('GET')` menolak method lain dengan status `405` dan header `Allow: GET`.
- `readJsonBody()` mensyaratkan `Content-Type: application/json` (parameter charset boleh disertakan). Content-Type lain menghasilkan `415`.
- Body kosong, JSON rusak, atau JSON bukan objek menghasilkan `400`. Objek kosong `{}` diperbolehkan; field wajib tetap harus divalidasi oleh endpoint. Input yang benar dikembalikan sebagai associative array, termasuk data nested.
- Warning PHP yang aktif diubah menjadi exception agar tidak mencemari respons JSON. Exception internal menghasilkan `500` tanpa stack trace atau detail database di body respons.

Format respons mengikuti frontend: properti seperti `categories`, `user`, dan `recipes` ditempatkan langsung di tingkat teratas, bukan dibungkus lagi dalam `data`.

## API kategori

### Request

```http
GET /FoodHub/backend/api/categories.php
```

Endpoint ini bersifat publik, tidak memerlukan login, dan hanya menerima `GET`. Query hanya membaca kolom `id`, `name`, dan `slug` dari tabel `categories`, terurut berdasarkan `id`.

### Respons berhasil — 200

Contoh potongan respons:

```json
{
  "categories": [
    {
      "id": 1,
      "name": "Makanan Berat",
      "slug": "makanan-berat"
    }
  ]
}
```

`id` selalu berupa integer JSON. Jika tabel kosong, respons tetap `200` dengan `{"categories":[]}`.

### Respons gagal

| Status | Kondisi |
|---|---|
| `405` | Method selain GET, dilengkapi header `Allow: GET` |
| `500` | Koneksi/query database atau kesalahan internal lain gagal |

Contoh kegagalan method:

```json
{
  "error": "Metode HTTP tidak diizinkan."
}
```

### Pengujian manual

Dengan web server dan database Laragon aktif, buka:

```text
http://localhost/FoodHub/backend/api/categories.php
```

Alamat ini berlaku jika web server menggunakan folder `www` sebagai document root. Respons seharusnya berupa JSON, bukan halaman HTML. Buka beranda frontend dan periksa Developer Tools → Network → `categories.php`; statusnya harus `200` dengan data kategori. Frontend memiliki fallback lokal, jadi tampilan kategori saja belum membuktikan API berhasil.

## Pengujian otomatis

Dari direktori utama proyek, jalankan:

```sh
php backend/tests/api.php
```

Syarat: PHP CLI dengan `pdo_mysql`, `proc_open` dan HTTP stream aktif, serta database lokal yang sudah dikonfigurasi. Script menjalankan server PHP sementara pada port lokal yang tersedia, kemudian menghentikannya dan menghapus router sementara setelah selesai. Tidak perlu menjalankan server pengujian sendiri.

Pengujian mencakup:

- GET kategori dari database, tipe field, urutan ID, dan header JSON.
- Penolakan POST, PUT, PATCH, dan DELETE dengan `405` serta header `Allow`.
- Pembacaan JSON Unicode dan nested, objek kosong, serta Content-Type dengan charset.
- Penolakan Content-Type salah (`415`), body kosong, JSON rusak, dan body bukan objek (`400`).
- Respons sukses `201` dan penanganan exception/warning/error encoding sebagai JSON `500` tanpa detail internal.

Pengujian hanya membaca database, tidak membuat atau mengubah data. Endpoint autentikasi, resep, profil, favorit, ulasan, dan admin belum diimplementasikan.
