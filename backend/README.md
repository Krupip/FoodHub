# Backend FoodHub

## Koneksi database (PDO)

### 1. Persiapan

- Jalankan MySQL/MariaDB melalui Laragon.
- Pastikan PHP mengaktifkan ekstensi `pdo_mysql` dan `mbstring` (untuk validasi panjang nama/password Unicode pada registrasi).
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
| `includes/auth.php` | Menyediakan `startUserSession()` untuk memulai sesi pengguna dengan cookie aman |

Muat bootstrap di awal endpoint, sebelum mencetak output. Koneksi database baru dibuka ketika `getDatabaseConnection()` dipanggil. Session baru dimulai saat `startUserSession()` dipanggil; endpoint publik seperti kategori tidak membuat sesi. Pemeriksaan izin login/admin belum diimplementasikan.

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

## API registrasi

### Request

```http
POST /FoodHub/backend/api/auth.php?action=register
Content-Type: application/json
```

Contoh body:

```json
{
  "name": "Budi Santoso",
  "email": "budi@example.com",
  "password": "passwordcontoh123"
}
```

Aturan validasi:

| Field | Aturan |
|---|---|
| `name` | Wajib berupa teks; spasi di awal/akhir dihapus; panjang 3–100 karakter Unicode |
| `email` | Wajib berupa teks dengan format email valid; spasi di awal/akhir dihapus; dinormalisasi menjadi huruf kecil; maksimal 150 karakter |
| `password` | Wajib berupa teks; minimal 8 karakter Unicode, maksimal 72 byte, dan tidak mengandung karakter null; spasi password dipertahankan |

Batas 72 byte mencegah pemotongan password diam-diam oleh bcrypt. Untuk karakter multibyte, 72 byte bisa berarti kurang dari 72 karakter. Password disimpan menggunakan `password_hash(..., PASSWORD_BCRYPT)`, bukan teks asli. Unique constraint database menangani email duplikat, termasuk jika dua request dengan email yang sama datang bersamaan.

Role selalu ditetapkan sebagai `member` di server. Field tambahan seperti `role` dan `id` dari klien tidak digunakan. Konfirmasi password dan persetujuan pada form tetap diperiksa frontend; endpoint menerima tiga field di atas sesuai kontrak JavaScript saat ini.

### Respons berhasil — 201

Contoh respons (ID mengikuti database):

```json
{
  "user": {
    "id": 4,
    "name": "Budi Santoso",
    "email": "budi@example.com",
    "role": "member"
  }
}
```

Respons tidak menyertakan password atau hash. Registrasi memulai sesi, meregenerasi ID sesi, lalu menyimpan hanya `user_id` sebagai identitas login. Data sesi sebelumnya diganti pada registrasi berhasil. Cookie bernama `foodhub_session` memakai `HttpOnly`, `SameSite=Lax`, serta `Secure` ketika request terdeteksi menggunakan HTTPS langsung. Cookie tidak diberi masa berlaku persisten (`lifetime = 0`). Jika HTTPS diterminasi di reverse proxy, konfigurasi deteksi HTTPS harus disesuaikan dengan proxy tepercaya sebelum deployment.

**Batas implementasi:** registrasi dan login sudah membuat sesi di server, tetapi `action=me` dan `action=logout` belum tersedia. Frontend memanggil `action=me` saat setiap halaman dimuat, sehingga status login belum dapat ditampilkan secara konsisten setelah redirect/reload sampai tahap 8C selesai. Jangan menganggap tampilan mode demo sebagai bukti sesi backend. Aksi selain `register` dan `login` saat ini mengembalikan `404`.

### Respons gagal

| Status | Kondisi |
|---|---|
| `400` | Body kosong, JSON rusak, atau bukan objek |
| `404` | Aksi autentikasi tidak tersedia |
| `405` | Method selain POST untuk registrasi; header `Allow: POST` |
| `409` | Email sudah terdaftar |
| `415` | Content-Type bukan `application/json` |
| `422` | Field wajib tidak ada, tipe salah, atau nilai tidak memenuhi validasi |
| `500` | Kesalahan database/sesi/internal; detail hanya dicatat ke log |

Contoh email duplikat:

```json
{
  "error": "Email sudah terdaftar."
}
```

### Pengujian manual

Gunakan Postman untuk mengirim request POST di atas dan pilih Body → raw → JSON. Request berhasil menghasilkan `201`, data `user`, dan cookie sesi. Periksa tabel `users` untuk memastikan password tersimpan sebagai hash. Kirim ulang email yang sama untuk memeriksa respons `409`.

Form `frontend/daftar.html` sudah mengirim request ke endpoint ini. Untuk memeriksa prosesnya, buka Developer Tools → Network dengan opsi Preserve log karena frontend melakukan redirect setelah pendaftaran berhasil. Membuka URL endpoint di address bar browser hanya mengirim GET dan seharusnya menghasilkan `405`, bukan membuat akun.

## API login

### Request

```http
POST /FoodHub/backend/api/auth.php?action=login
Content-Type: application/json
```

Contoh body:

```json
{
  "email": "budi@example.com",
  "password": "passwordcontoh123",
  "remember": false
}
```

Gunakan akun yang sudah dibuat melalui registrasi atau akun lokal yang memang tersedia di database.

| Field | Aturan |
|---|---|
| `email` | Wajib berupa teks dengan format valid; spasi awal/akhir dihapus, dinormalisasi menjadi huruf kecil, maksimal 150 karakter |
| `password` | Wajib berupa teks tidak kosong, maksimal 72 byte, tanpa karakter null; tidak di-trim |
| `remember` | Opsional; jika dikirim harus berupa boolean JSON (`true` atau `false`), bukan teks/angka/null |

Batas minimal 8 karakter hanya diterapkan saat membuat password melalui registrasi. Login memverifikasi password yang tersimpan dan tidak menerapkan ulang batas minimum registrasi pada password lama.

**Opsi Ingat saya:** `remember` diterima untuk kompatibilitas dengan frontend, tetapi baik `true` maupun `false` saat ini tetap membuat cookie sesi nonpersisten. Belum ada token login persisten, pemulihan login setelah browser ditutup, atau tabel penyimpanan token. Jangan menganggap pengaturan `localStorage` frontend sebagai login persisten yang aman. Fitur tersebut memerlukan implementasi token terpisah.

### Alur login

1. Validasi method, JSON, dan field.
2. Cari pengguna berdasarkan email menggunakan prepared statement.
3. Periksa password dengan `password_verify()`. Untuk email tidak terdaftar, verifikasi tetap dijalankan terhadap hash dummy agar tidak langsung keluar tanpa proses bcrypt.
4. Tolak kredensial salah dengan pesan yang sama, tanpa memberi tahu apakah email terdaftar.
5. Setelah kredensial benar, mulai sesi dan regenerasi ID-nya.
6. Ganti data sesi menjadi hanya `user_id`, lalu simpan sesi.
7. Kirim informasi pengguna dari database tanpa password atau hash. ID dan role dari body request tidak digunakan.

### Respons berhasil — 200

Contoh respons (data mengikuti akun di database):

```json
{
  "user": {
    "id": 4,
    "name": "Budi Santoso",
    "email": "budi@example.com",
    "role": "member"
  }
}
```

Akun admin mengembalikan `role: "admin"` sesuai database. Login gagal tidak membuat sesi login baru atau mengganti identitas sesi yang sudah aktif. Pengaturan cookie sama dengan sesi registrasi: `HttpOnly`, `SameSite=Lax`, dan `Secure` saat HTTPS terdeteksi.

### Respons gagal

| Status | Kondisi |
|---|---|
| `400` | Body kosong, JSON rusak, atau bukan objek |
| `401` | Email tidak terdaftar atau password salah |
| `405` | Method selain POST; header `Allow: POST` |
| `415` | Content-Type bukan JSON |
| `422` | Field wajib, tipe, format, atau batas nilai tidak sesuai |
| `500` | Kesalahan database/sesi/internal |

Respons kredensial salah:

```json
{
  "error": "Email atau kata sandi salah."
}
```

### Pengujian manual dan integrasi frontend

- Di Postman, kirim request login dengan akun yang benar. Pastikan status `200`, respons `user`, dan cookie `foodhub_session` diterima.
- Coba password salah dan email yang tidak terdaftar. Keduanya harus menghasilkan `401` dengan pesan yang sama.
- Buka `frontend/masuk.html` melalui web server. Handler login sudah memakai endpoint ini dan kini tidak lagi mencoba akun demo lokal jika API menolak request atau tidak dapat dihubungi.
- Pemeriksaan sesi ketika halaman dimuat (`initAuth`) masih memiliki fallback demo lama dan belum terhubung ke endpoint `me`. Login end-to-end lintas halaman baru dapat diuji sepenuhnya setelah tahap 8C; logout menunggu tahap 8D. Pengujian otomatis memeriksa sesi melalui route khusus pada router sementara, bukan endpoint publik tambahan.

Sebelum digunakan di produksi, tambahkan pembatasan percobaan login dan mekanisme login persisten jika dibutuhkan. Tahap ini belum menerapkan rate limiting.

## Pengujian otomatis

Dari direktori utama proyek, jalankan:

```sh
php backend/tests/api.php
```

Syarat: PHP CLI dengan `pdo_mysql`, `mbstring`, session, `proc_open` dan HTTP stream aktif, serta database lokal yang sudah dikonfigurasi. Script menjalankan server PHP sementara pada port lokal yang tersedia, kemudian menghentikannya dan menghapus router sementara setelah selesai. Tidak perlu menjalankan server pengujian sendiri.

Pengujian mencakup:

- GET kategori dari database, tipe field, urutan ID, dan header JSON.
- Penolakan POST, PUT, PATCH, dan DELETE dengan `405` serta header `Allow`.
- Pembacaan JSON Unicode dan nested, objek kosong, serta Content-Type dengan charset.
- Penolakan Content-Type salah (`415`), body kosong, JSON rusak, dan body bukan objek (`400`).
- Respons sukses `201` dan penanganan exception/warning/error encoding sebagai JSON `500` tanpa detail internal.

- Validasi registrasi: method, aksi tidak tersedia, tipe konten, JSON, field wajib, tipe field, batas panjang, dan password dengan karakter null.
- Registrasi berhasil, normalisasi nama/email, role selalu member, hash password, dan respons tanpa kredensial.
- Cookie sesi, regenerasi ID, sesi login pada request berikutnya, serta penolakan cookie sesi lama.
- Email duplikat menghasilkan `409` tanpa membuat akun kedua atau mengganti identitas login.
- Batas nama Unicode 100 karakter dan password 72 byte.
- Login: method, JSON, field wajib, tipe field, batas nilai, serta boolean `remember`.
- Password salah dan email tidak terdaftar menghasilkan `401` dengan pesan yang sama.
- Login member/admin, normalisasi email, password dengan spasi, serta respons tanpa password/hash.
- Regenerasi ID sesi saat login, penolakan cookie lama, dan identitas sesi yang tetap utuh jika login berikutnya gagal.
- Login dengan `remember` tidak menerbitkan cookie persisten sebelum fitur token diimplementasikan.

**Pengujian autentikasi menulis ke database lokal:** script membuat dua akun dengan alamat email acak khusus pengujian, mengubah salah satu akun uji menjadi admin untuk memeriksa login berdasarkan role, lalu menghapus hanya akun uji tersebut dalam blok `finally`, termasuk ketika assertion gagal. Sesi pengujian menggunakan direktori sementara terpisah yang juga dibersihkan. Akun yang sudah ada tidak diubah. Gunakan database pengembangan, bukan database produksi. Jika proses dihentikan paksa sebelum cleanup berjalan, akun uji berawalan `foodhub-test-` dapat tertinggal dan harus diperiksa secara manual.

Endpoint resep, profil, favorit, ulasan, admin, serta aksi me/logout belum diimplementasikan.
