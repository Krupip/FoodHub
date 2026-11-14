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

### Migrasi database lama untuk Ingat saya

Instalasi baru melalui `database/foodhub.sql` sudah memiliki tabel `remember_tokens`. Untuk database yang sebelumnya diimpor, jalankan migrasi tambahan dari direktori utama proyek:

```sh
php -r 'require "backend/config/database.php"; getDatabaseConnection()->exec(file_get_contents("database/migrations/001_remember_tokens.sql"));'
```

Migrasi ini hanya menambah tabel jika belum ada dan tidak menghapus data pengguna/resep. Jangan mengimpor ulang `foodhub.sql` untuk memperbarui database lama, karena file tersebut menghapus database. Migrasi dijalankan secara eksplisit, bukan otomatis ketika endpoint web dipanggil.

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
| `includes/validation.php` | Menyediakan `requireRequestMethod()`, `requireJsonContentType()`, dan `readJsonBody()` |
| `includes/auth.php` | Mengelola sesi, identitas dari database, Ingat saya, serta guard `requireLogin()` dan `requireAdmin()` |
| `includes/csrf.php` | Menyediakan token CSRF sesi, header respons, dan validasi mutasi |

Muat bootstrap di awal endpoint, sebelum mencetak output. Koneksi database baru dibuka ketika diperlukan. Session baru dimulai saat helper autentikasi dipanggil; endpoint publik seperti kategori tidak membuat sesi. Guard login/admin dan perlindungan CSRF tersedia pada nomor 9 di bawah.

Contoh pola untuk endpoint POST mendatang (bukan endpoint baru yang sudah diimplementasikan):

```php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

requireRequestMethod('POST');
$user = requireLogin();
requireCsrfForMutation();
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
- `requireJsonContentType()` mensyaratkan `Content-Type: application/json` (parameter charset boleh disertakan). Content-Type lain menghasilkan `415`. `readJsonBody()` juga menjalankan pemeriksaan ini.
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

Respons tidak menyertakan password atau hash. Registrasi memulai sesi, meregenerasi ID sesi, menyimpan `user_id` sebagai identitas login, dan membuat token CSRF sesi yang dikirim lewat header `X-CSRF-Token`. Data sesi sebelumnya diganti pada registrasi berhasil. Cookie bernama `foodhub_session` memakai `HttpOnly`, `SameSite=Lax`, serta `Secure` ketika request terdeteksi menggunakan HTTPS langsung. Cookie tidak diberi masa berlaku persisten (`lifetime = 0`). Jika HTTPS diterminasi di reverse proxy, konfigurasi deteksi HTTPS harus disesuaikan dengan proxy tepercaya sebelum deployment.

**Status nomor 8:** `register`, `login`, `me`, dan `logout` sudah tersedia. Frontend memanggil `me` setiap halaman dimuat dan menggunakan identitas dari API saja. Registrasi juga mencabut token Ingat saya akun sebelumnya pada browser yang sama agar sesi akun lama tidak dipulihkan setelah beralih akun. Aksi yang tidak dikenal mengembalikan `404`.

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

**Opsi Ingat saya:** `remember: true` membuat cookie `foodhub_remember` dengan masa berlaku absolut 30 hari. Cookie berisi selector acak dan verifier acak 256-bit; hanya hash SHA-256 verifier yang disimpan pada `remember_tokens`, bukan password atau token mentah. Jika sesi PHP tidak tersedia, `me` dapat memverifikasi token ini, meregenerasi sesi, dan merotasi verifier. Token lama tidak berlaku setelah rotasi, logout, atau kedaluwarsa. Masa berlaku tidak diperpanjang saat pemulihan.

`remember: false` atau field yang tidak dikirim memakai sesi biasa dan mencabut token Ingat saya browser tersebut jika ada. Token pada perangkat lain tidak dicabut. Cookie sesi maupun remember memakai `HttpOnly`, `SameSite=Lax`, serta `Secure` saat HTTPS terdeteksi. Tidak ada identitas atau token autentikasi yang disimpan frontend ke localStorage/sessionStorage.

### Alur login

1. Validasi method, JSON, dan field.
2. Cari pengguna berdasarkan email menggunakan prepared statement.
3. Periksa password dengan `password_verify()`. Untuk email tidak terdaftar, verifikasi tetap dijalankan terhadap hash dummy agar tidak langsung keluar tanpa proses bcrypt.
4. Tolak kredensial salah dengan pesan yang sama, tanpa memberi tahu apakah email terdaftar.
5. Setelah kredensial benar, mulai sesi dan regenerasi ID-nya.
6. Ganti identitas sesi dengan `user_id` serta selector token jika Ingat saya aktif, buat token CSRF baru, lalu simpan sesi.
7. Kirim informasi pengguna dari database tanpa password atau hash, dan token CSRF melalui header `X-CSRF-Token`. ID dan role dari body request tidak digunakan.

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
- Inisialisasi halaman (`initAuth`) memanggil `me`. Gagal jaringan atau respons tidak valid membuat frontend menganggap pengguna tidak masuk, menampilkan pesan, dan tidak membuka konten terlindungi. Tidak ada fallback ke akun/sesi demo lokal.
- Tombol logout navbar dan sidebar hanya menganggap logout berhasil setelah API sukses. Kegagalan tidak diabaikan dan tidak menyebabkan redirect palsu.
- Submit autentikasi ganda dicegah selama request berjalan. Identitas lama `fh_s` dibersihkan; data demo fitur lain tidak dipakai untuk autentikasi.

Sebelum digunakan di produksi, tambahkan pembatasan percobaan login. Tahap ini belum menerapkan rate limiting. Gunakan HTTPS dan pastikan konfigurasi reverse proxy tepercaya meneruskan status HTTPS secara benar; kode tidak mempercayai header proxy bebas.

## API pemeriksaan sesi — 8C

```http
GET /FoodHub/backend/api/auth.php?action=me
```

Endpoint tidak memerlukan body JSON. Browser mengirim cookie melalui `credentials: 'same-origin'` pada frontend.

- Session berisi ID akun yang masih ada: `200` dengan `{"user":{"id":4,"name":"Budi Santoso","email":"budi@example.com","role":"member"}}` (contoh data).
- Tidak login: `200` dengan `{"user":null}`, bukan `401`.
- Session tidak ada, tetapi token Ingat saya valid: buat sesi baru, rotasi token, dan kirim pengguna yang ditemukan.
- Token rusak, tidak dikenal, kedaluwarsa, atau sudah dipakai: kirim `user: null`. Respons anonim tidak mengirim `Set-Cookie`, agar respons tab yang kalah dalam pemulihan paralel tidak menimpa cookie login baru dari tab lain. Token tidak valid tidak dipercaya walaupun cookie lama masih tersimpan di browser; login/logout berikutnya mengelola cookie secara eksplisit.
- Akun sesi telah dihapus: cabut sesi/token di server dan kirim `user: null`.
- Sesi yang berasal dari Ingat saya tetap memeriksa selector token di database. Jika token dicabut/kedaluwarsa, sesi terkait tidak tetap login.
- Role dan nama selalu dibaca ulang dari database, bukan dari nilai lama di session/localStorage atau query string.
- Method selain GET menghasilkan `405` dengan `Allow: GET`. Kesalahan database/sesi menghasilkan JSON `500` tanpa detail internal.

Objek `user` hanya berisi `id`, `name`, `email`, dan `role`; hash/password tidak pernah disertakan. Jika pengguna aktif, respons juga memiliki header `X-CSRF-Token` yang stabil selama sesi yang sama. Respons anonim tidak menerbitkan token CSRF. Endpoint ini tidak menggantikan guard pada endpoint bisnis.

## API logout — 8D

```http
POST /FoodHub/backend/api/auth.php?action=logout
Content-Type: application/json
```

Body tidak wajib, sesuai request frontend. Content-Type JSON diwajibkan agar endpoint tidak menerima POST form lintas situs; backend tidak membuka CORS lintas origin. **Pengguna yang masih login wajib mengirim header `X-CSRF-Token` dari sesi yang sama**. Token hilang/salah menghasilkan `403` tanpa mengakhiri sesi atau mencabut token Ingat saya. Logout anonim tetap idempoten dan tidak memerlukan token. Method GET menghasilkan `405` dengan `Allow: POST`; Content-Type lain menghasilkan `415`.

Logout mencabut token Ingat saya pada browser tersebut (termasuk lewat selector yang disimpan di sesi), menghapus data sesi server, dan menghapus cookie `foodhub_session` serta `foodhub_remember` jika ada. Session ID/token sebelum logout tidak dapat digunakan kembali. Logout anonim atau berulang tetap aman dan menghasilkan:

```json
{
  "message": "Berhasil keluar."
}
```

HTTP status `200`. Perangkat lain tetap login. Jika pencabutan token atau sesi gagal, respons berupa error `500`, bukan keberhasilan semu.

### Alur pengujian manual nomor 8

1. Jalankan web server dan database, lalu terapkan migrasi jika menggunakan database lama.
2. Buka `frontend/daftar.html`, daftarkan email baru, dan pastikan respons register `201`.
3. Setelah redirect/reload, periksa request `me`: harus `200` dengan akun yang baru dibuat.
4. Tekan Keluar. Pastikan logout `200`, halaman berpindah ke beranda, dan `me` berikutnya mengembalikan `user: null`.
5. Login kembali. Password salah harus `401`; kredensial benar `200` dengan role sesuai database.
6. Coba login dengan Ingat saya. Melalui pengelola cookie browser, hapus **hanya** `foodhub_session` dan pertahankan `foodhub_remember`, kemudian reload. Sesi dipulihkan lewat `me` dan verifier remember berubah.
7. Logout lagi. Cookie/token lama tidak dapat memulihkan login. Halaman member/admin tanpa sesi diarahkan ke login.

## Pemeriksaan izin dan CSRF — nomor 9

### Guard login dan admin

Kedua helper tersedia setelah memuat `includes/bootstrap.php`. Keduanya mengembalikan array pengguna yang tervalidasi (`id`, `name`, `email`, `role`), bukan sekadar boolean.

| Kondisi | `requireLogin()` | `requireAdmin()` |
|---|---|---|
| Belum login / sesi tidak valid / akun dihapus | JSON `401` | JSON `401` |
| Member aktif | Lanjut | JSON `403` |
| Admin aktif | Lanjut | Lanjut |

Role selalu dibaca dari database pada request yang sedang berjalan, termasuk sesi yang dipulihkan lewat Ingat saya. Perubahan role langsung berlaku pada cookie sesi yang sama. `user_id`, `role`, maupun data localStorage dari klien tidak digunakan untuk memberi izin. Penolakan menghentikan eksekusi sebelum logika fitur dijalankan.

Contoh respons belum login:

```json
{"error":"Silakan masuk terlebih dahulu."}
```

Contoh penolakan member pada endpoint admin:

```json
{"error":"Akses hanya diizinkan untuk admin."}
```

Guard yang menolak pengguna anonim tidak menerbitkan cookie atau token CSRF, sehingga tidak menimpa sesi hasil login/pemulihan dari tab lain. Kesalahan database tetap menjadi `500` melalui bootstrap, bukan dianggap pengguna anonim.

### Perlindungan CSRF

CSRF adalah request perubahan data yang dikirim menggunakan cookie pengguna tanpa persetujuannya. Token sesi menambahkan bukti bahwa klien terlebih dahulu menerima respons API yang sah.

- Token dibuat dari 32 byte acak dan dikirim sebagai 64 karakter hex lowercase melalui header respons `X-CSRF-Token`.
- Token disimpan pada session server sebagai `csrf_token`, tidak pada objek JSON `user`, database, atau localStorage/sessionStorage frontend.
- Login/registrasi sukses, `me` pengguna aktif, dan guard pengguna aktif menerbitkan header token. Token stabil pada sesi yang sama dan diganti saat login/registrasi/pemulihan sesi baru.
- `requireCsrfToken()` memeriksa header request `X-CSRF-Token` terhadap token session menggunakan `hash_equals()`. Token hilang, salah format, atau dari sesi lain menghasilkan `403`.
- `requireCsrfForMutation()` mewajibkan pemeriksaan untuk method selain GET/HEAD/OPTIONS. Panggil setelah pemeriksaan izin dan sebelum membaca/menyimpan perubahan data.
- POST login/register tetap merupakan endpoint publik dengan body JSON; tidak mensyaratkan token sesi yang belum dimiliki pengguna. POST logout untuk pengguna aktif wajib CSRF.
- Token CSRF bukan pengganti autentikasi: penyalinan token tanpa sesi yang sesuai tidak memberi akses.

Frontend membaca token dari header, menyimpannya hanya di memori, dan menambahkan header pada mutasi. Jika cache kosong, frontend memeriksa `me` terlebih dahulu; respons autentikasi tanpa token yang valid ditolak. Request mutasi yang mendapat `403` tidak diulang otomatis, untuk menghindari perubahan ganda. Token baru pada header error dapat dipakai untuk percobaan ulang manual.

### Pola endpoint member

Contoh untuk file langsung di `backend/api/` (logika bisnis belum diimplementasikan):

```php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

requireRequestMethod('POST');
$user = requireLogin();
requireCsrfForMutation();
$input = readJsonBody();
session_write_close();

// Validasi data dan gunakan $user['id'] sebagai pemilik data, bukan ID dari body.
// Jalankan logika fitur setelah semua pemeriksaan berhasil.
```

### Pola endpoint admin

Contoh untuk file di `backend/api/admin/`:

```php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../../includes/bootstrap.php';

$user = requireAdmin();
requireCsrfForMutation();
session_write_close();

// Tambahkan pembatasan method, validasi input, dan logika fitur sesuai endpoint.
```

Jangan menjalankan query perubahan data sebelum guard dan validasi CSRF berhasil. Penyembunyian tombol/redirect admin di frontend bukan pengganti guard server.

### Endpoint yang sudah dipasang guard

| Endpoint | Guard |
|---|---|
| `api/profile.php` | `requireLogin()` |
| `api/favorites.php` | `requireLogin()` |
| `api/reviews.php` | `requireLogin()` |
| `api/admin/recipes.php` | `requireAdmin()` |
| `api/admin/users.php` | `requireAdmin()` |
| `api/admin/stats.php` | `requireAdmin()` |

Seluruh endpoint tersebut juga memakai `requireCsrfForMutation()`. Setelah izin/CSRF lolos, endpoint sementara membalas **`501` dengan pesan fitur belum diimplementasikan**. Ini bukan CRUD yang sudah selesai dan tidak menyimpan perubahan apa pun. Pengunjung ditolak `401`, member pada endpoint admin `403`, dan mutasi tanpa CSRF valid `403` sebelum mencapai stub `501`.

Kategori dan autentikasi publik tidak diberi guard login. `me` anonim tetap `200 {"user":null}`; status `401` digunakan untuk endpoint yang memang mensyaratkan login.

### Cara menguji lewat Postman

1. Kirim login yang benar dan biarkan cookie jar Postman menyimpan `foodhub_session`.
2. Salin nilai header respons `X-CSRF-Token`. Token yang sama juga tersedia pada GET `auth.php?action=me`.
3. GET `profile.php` tanpa cookie harus `401`; dengan sesi member/admin mendapat `501` karena fitur profil belum dibuat.
4. GET `admin/recipes.php` dengan sesi member harus `403`; sesi admin mendapat `501`.
5. Kirim POST/PUT/PATCH/DELETE ke endpoint terlindungi. Tanpa token atau dengan token sesi lain harus `403` jika izin pengguna terpenuhi; dengan header yang cocok mencapai `501`.
6. Untuk logout pengguna aktif, sertakan `Content-Type: application/json` dan `X-CSRF-Token`. Token salah harus `403` dan `me` masih mengenali akun; token benar menghasilkan `200` dan mengakhiri sesi.

Lihat status dan respons di Network/Postman. Beberapa fitur frontend masih memiliki fallback demo yang dapat menyamarkan `501`; tampilan lokal tidak membuktikan backend bisnis sudah tersedia.

## Pengujian otomatis

Dari direktori utama proyek, jalankan:

```sh
php backend/tests/api.php
```

Syarat: PHP CLI dengan `pdo_mysql`, `mbstring`, session, `proc_open` dan HTTP stream aktif, serta database lokal yang sudah dikonfigurasi dan memiliki tabel `remember_tokens`. Script menjalankan server PHP sementara pada port lokal yang tersedia, kemudian menghentikannya dan menghapus router sementara setelah selesai. Tidak perlu menjalankan server pengujian sendiri.

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
- Me anonim, sesi registrasi/login, penolakan ID palsu, serta pembacaan nama/role terbaru.
- Pemulihan Ingat saya, penyimpanan hash saja, kedaluwarsa UTC, rotasi token, serta penolakan replay/token palsu/rusak.
- Logout biasa/berulang dan invalidasi cookie/token sebelum logout, termasuk sesi lama yang terkait selector remember yang dicabut.
- Dua pemulihan dengan snapshot token yang sama: respons yang kalah tidak menimpa cookie jar yang sudah menerima sesi/token pemenang.
- Login tanpa remember serta registrasi akun baru mencabut token akun sebelumnya pada browser yang sama.
- Penghapusan akun mengakhiri autentikasi dan menghapus token terkait lewat foreign key.
- Guard pengguna anonim `401`, member pada admin `403`, dan akses sah lewat fixture sementara `200`.
- Keenam endpoint asli sudah dilindungi dan mencapai `501` hanya setelah izin/CSRF valid.
- Promosi/demosi role langsung berlaku, input role/ID palsu tidak memberi akses, serta sesi akun terhapus ditolak.
- CSRF stabil per sesi, rotasi saat autentikasi baru, penolakan token hilang/salah/sesi lain, dan logout gagal tidak mencabut autentikasi.

**Pengujian autentikasi menulis ke database lokal:** script membuat dua akun dengan alamat email acak khusus pengujian, mengubah salah satu akun uji menjadi admin untuk memeriksa login berdasarkan role, lalu menghapus hanya akun uji tersebut dalam blok `finally`, termasuk ketika assertion gagal. Sesi pengujian menggunakan direktori sementara terpisah yang juga dibersihkan. Akun yang sudah ada tidak diubah. Gunakan database pengembangan, bukan database produksi. Jika proses dihentikan paksa sebelum cleanup berjalan, akun uji berawalan `foodhub-test-` dapat tertinggal dan harus diperiksa secara manual.

Tes frontend tanpa dependency tambahan:

```sh
node --check frontend/js/main.js
node --test frontend/tests/auth.test.js
```

Tes Node memakai VM/mock DOM/fetch untuk memeriksa kontrak autentikasi, fail-closed, proteksi halaman, redirect, kegagalan logout, serta tidak adanya sumber autentikasi lokal. Tes PHP menggunakan HTTP dan database lokal nyata, termasuk token remember. Belum ada pengujian browser nyata yang terotomatisasi.

Autentikasi nomor 8 dan fondasi otorisasi/CSRF nomor 9 selesai. Logika bisnis resep, profil, favorit, ulasan, dan admin belum diimplementasikan; endpoint terlindungi baru berupa guarded stub dengan status `501`.
