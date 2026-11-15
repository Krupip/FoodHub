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

## API daftar resep — 10A

```http
GET /FoodHub/backend/api/recipes.php
```

Endpoint publik (tanpa login, tanpa sesi/cookie/CSRF) hanya menerima `GET`. **Hanya resep tayang (`is_published = 1`) yang pernah dikirim**; resep disembunyikan admin tidak muncul, termasuk lewat pencarian judul atau bahan. Method lain menghasilkan `405` dengan `Allow: GET`.

### Parameter query

Semua parameter opsional dan dapat digabung (logika AND). Nilai kosong atau berisi spasi saja dianggap tidak dikirim. Parameter yang tidak dikenal diabaikan.

| Parameter | Aturan |
|---|---|
| `q` | Maksimal 100 karakter. Mencari sebagian judul **atau** nama bahan, tanpa membedakan huruf besar/kecil. `%` dan `_` dicari sebagai teks biasa. |
| `category` | Nama atau slug kategori, mis. `Makanan Berat` atau `makanan-berat`. Kategori tidak dikenal menghasilkan daftar kosong, bukan error. |
| `max_time` / `min_time` | Bilangan bulat 1–65535 (menit), batas termasuk. `min_time` tidak boleh lebih besar dari `max_time`. |
| `difficulty` | `mudah`, `sedang`, atau `sulit` (huruf besar diterima). |
| `sort` | `popular` (default), `rating`, `newest`, `title`, atau `time`. Nilai lain ditolak; urutan tidak pernah disusun dari input mentah. |
| `limit` | 1–100, default 100. |
| `offset` | 0–100000, default 0. |

Urutan `popular`: jumlah favorit terbanyak, lalu rating tertinggi, jumlah ulasan, judul, dan ID. Resep tanpa rating berada di akhir untuk `rating`/`popular`.

Frontend mengirim `min_time=61` untuk opsi **Lebih dari 60 menit**. Sebelumnya opsi itu menghilangkan filter waktu sehingga semua resep tampil.

### Respons berhasil — 200

```json
{
  "recipes": [
    {
      "id": 1,
      "title": "Rendang Daging Sapi",
      "slug": "rendang-daging-sapi",
      "region": "Sumatera Barat",
      "story": "Olahan daging sapi empuk ...",
      "image_path": "img/rendang.jpg",
      "cook_time_minutes": 180,
      "difficulty": "sulit",
      "servings": 6,
      "is_published": true,
      "created_at": "2026-08-05 08:00:00",
      "avg_rating": 5.0,
      "review_count": 2,
      "favorite_count": 1,
      "categories": ["Makanan Berat"]
    }
  ],
  "total": 14,
  "limit": 100,
  "offset": 0
}
```

- `categories` berupa **array nama kategori** (terurut), bukan string `GROUP_CONCAT`. Filter kategori tidak menghilangkan kategori lain milik resep.
- `avg_rating` bernilai `null` jika belum ada ulasan. Angka dikirim sebagai angka JSON dan `is_published` sebagai boolean.
- `story` disertakan karena kartu frontend menampilkannya sebagai deskripsi. `image_path` bisa `null`.
- `total` adalah jumlah seluruh hasil sebelum `limit`/`offset`. Hasil kosong tetap `200` dengan `"recipes": []`.
- Waktu `created_at` mengikuti zona waktu database dan tidak diberi penanda zona.

### Respons gagal

| Status | Kondisi |
|---|---|
| `405` | Method selain GET |
| `422` | Parameter bukan teks tunggal (mis. `q[]=x`), bukan UTF-8, terlalu panjang, di luar rentang, atau nilai `difficulty`/`sort` tidak dikenal |

| `500` | Kesalahan database/internal tanpa detail teknis |

Contoh: `{"error":"Parameter sort harus popular, rating, newest, title, atau time."}`


### Pengujian manual

Buka `http://localhost/FoodHub/backend/api/recipes.php` (atau tambahkan `?q=soto&category=Makanan%20Berat&sort=time`) dan pastikan respons berupa JSON. Pada `frontend/daftar-resep.html`, periksa Network → `recipes.php`; perhatikan bahwa **jika API gagal, halaman diam-diam memakai data lokal**, jadi status `200` pada tab Network adalah bukti yang valid, bukan tampilan kartu saja. Beranda juga memakai endpoint ini untuk 3 resep populer (`sort=popular&limit=3`).

## API detail resep — 10B

### Request

```http
GET /FoodHub/backend/api/recipes.php?id=1
```

Endpoint ini **publik**, sehingga tidak perlu login. Jika query memiliki key `id`, endpoint memilih detail, bukan daftar; parameter daftar seperti `q`, `sort`, dan `limit` diabaikan.

- `id` wajib berupa bilangan bulat `1–4294967295` (rentang ID tabel `INT UNSIGNED`). Nilai kosong, array, pecahan, negatif, teks, atau di luar rentang menghasilkan `422`.
- Hanya resep `is_published = 1` yang tersedia. Resep tersembunyi dan ID yang tidak ditemukan sama-sama menghasilkan `404`, termasuk jika pembaca adalah admin. Pratinjau resep admin bukan bagian endpoint publik ini.
- Query database menggunakan prepared statement.

### Respons berhasil — 200

Respons berupa `{"recipe": {...}}`, bukan array `recipes`. Objek resep memuat **seluruh field kartu pada 10A**, ditambah:

| Field | Bentuk dan arti |
|---|---|
| `author` | Nama pembuat dari tabel users; `Tim FoodHub` jika tidak ada pembuat |
| `ingredients` | Array objek `{name, quantity, unit}`, sesuai urutan `sort_order`, lalu ID |
| `steps` | Array teks instruksi sesuai `step_number` |
| `reviews` | Array objek `{user_name, rating, comment, created_at}`, terbaru dahulu; ID menurun jika waktunya sama |
| `is_favorite` | Boolean apakah pengguna yang sedang login menyimpan resep tersebut |

Contoh bentuk respons (data ilustrasi, ID dan nilainya dapat berbeda):

```json
{
  "recipe": {
    "id": 1,
    "title": "Resep Contoh",
    "slug": "resep-contoh",
    "region": "Jawa Tengah",
    "story": "Cerita di balik resep.",
    "image_path": null,
    "cook_time_minutes": 30,
    "difficulty": "mudah",
    "servings": 2,
    "is_published": true,
    "created_at": "2026-11-15 08:00:00",
    "avg_rating": 4.5,
    "review_count": 2,
    "favorite_count": 1,
    "categories": ["Cepat"],
    "author": "Tim FoodHub",
    "ingredients": [
      {"name": "Beras", "quantity": 250, "unit": "g"},
      {"name": "Garam", "quantity": null, "unit": null}
    ],
    "steps": ["Siapkan bahan.", "Masak hingga matang."],
    "reviews": [
      {"user_name": "Nadia", "rating": 4, "comment": "Enak", "created_at": "2026-11-15 10:00:00"},
      {"user_name": "Raka", "rating": 5, "comment": "Mantap", "created_at": "2026-11-15 09:00:00"}
    ],
    "is_favorite": false
  }
}
```

Takaran dikirim sebagai angka dasar untuk `servings`; frontend menghitung `quantity × porsi_baru / servings`. `quantity: null` berarti secukupnya. Relasi kosong tetap berupa `[]`; rating tanpa ulasan berupa `null`. Email, hash password, dan token autentikasi tidak dimasukkan ke JSON detail maupun ulasan.

**Status favorit:** tanpa cookie, endpoint tidak membuat sesi dan selalu mengirim `false`. Jika ada cookie sesi/remember, backend memvalidasi identitas lewat helper autentikasi yang sama dengan `me`; cookie tidak sah/akun terhapus diperlakukan sebagai tamu, bukan menolak detail publik. Remember valid dapat memulihkan sesi dan merotasi cookie. Respons terautentikasi menerbitkan header `X-CSRF-Token`; GET detail tidak memerlukan header CSRF dari klien. Parameter `user_id`/`role` dari query tidak dipercaya. Respons memakai `Cache-Control: no-store` agar status favorit tidak tersimpan dalam cache.

### Respons gagal

| Status | Kondisi |
|---|---|
| `404` | Resep tidak ada atau disembunyikan; `{"error":"Resep tidak ditemukan."}` |
| `405` | Method selain GET, dengan header `Allow: GET` |
| `422` | Parameter `id` kosong atau tidak valid |
| `500` | Kesalahan internal/database, tanpa detail teknis |

### Pengujian manual

1. Buka `http://localhost/FoodHub/backend/api/recipes.php?id=1` dan periksa objek `recipe`, bahan, langkah, kategori, serta ulasannya.
2. Buka `http://localhost/FoodHub/frontend/detail-resep.html?id=1` pada origin yang sama. Periksa Network → `recipes.php?id=1` berstatus `200`.
3. Ubah porsi pada halaman detail; takaran angka berubah, sementara bahan secukupnya tetap secukupnya.
4. Coba `?id=abc` pada API (`422`) dan ID resep tersembunyi/tidak ada (`404`). Halaman detail tidak lagi memakai fallback resep demo; kegagalan jaringan/server menampilkan pesan gagal memuat, bukan data lokal.
5. Jika sudah memiliki data favorit di database, bandingkan `is_favorite` sebelum dan setelah login dengan akun pemiliknya.

**Batas tahap ini:** membaca ulasan dan status favorit sudah tersedia. Menambah/menghapus favorit serta menulis ulasan tetap tahap berikutnya; endpoint mutasinya masih `501` setelah lolos guard/CSRF. Daftar resep/beranda masih memiliki fallback lokal yang terpisah; perubahan 10B hanya menghapus fallback pada detail.

## API profil pengguna — 11

### 1. Membaca profil pengguna

```http
GET /FoodHub/backend/api/profile.php
```

Endpoint terlindungi: mensyaratkan login aktif (`requireLogin()`). Pengunjung anonim ditolak `401`.

#### Respons berhasil — 200

```json
{
  "user": {
    "id": 2,
    "name": "Raka Pratama",
    "email": "raka@contoh.id",
    "role": "member",
    "avatar_path": null,
    "bio": null,
    "created_at": "2026-09-12 10:00:00",
    "updated_at": null
  }
}
```

- Data selalu dibaca dari tabel `users` berdasarkan identitas sesi server.
- `id` berupa integer JSON, `password_hash` tidak pernah disertakan.
- Header `X-CSRF-Token` diterbitkan secara stabil selama sesi berlangsung.

### 2. Memperbarui profil pengguna

```http
POST /FoodHub/backend/api/profile.php
Content-Type: application/json
X-CSRF-Token: <token_csrf_sesi>
```

Mendukung method `POST`, `PUT`, dan `PATCH`. Mutasi memerlukan header `X-CSRF-Token` yang sah dan tipe konten `application/json`.

Contoh body:

```json
{
  "name": "Raka P. Perkasa",
  "bio": "Pecinta masakan pedas Nusantara."
}
```

Aturan validasi:

| Field | Tipe | Aturan |
|---|---|---|
| `name` | String | Wajib. Spasi di awal/akhir dipotong. Panjang 3–100 karakter Unicode. |
| `bio` | String / Null | Opsional. Maksimal 255 karakter Unicode. |

- Parameter lain seperti `id`, `email`, `role`, dan `password_hash` diabaikan sehingga pengguna tidak dapat memanipulasi hak akses atau identitasnya.
- Waktu `updated_at` diperbarui otomatis oleh database.

#### Respons berhasil — 200

```json
{
  "message": "Perubahan profil berhasil disimpan.",
  "user": {
    "id": 2,
    "name": "Raka P. Perkasa",
    "email": "raka@contoh.id",
    "role": "member",
    "avatar_path": null,
    "bio": "Pecinta masakan pedas Nusantara.",
    "created_at": "2026-09-12 10:00:00",
    "updated_at": "2026-11-15 21:05:00"
  }
}
```

#### Respons gagal

| Status | Kondisi |
|---|---|
| `401` | Belum masuk / sesi kedaluwarsa |
| `403` | Header `X-CSRF-Token` hilang, tidak cocok dengan sesi, atau format salah |
| `405` | Method selain GET, POST, PUT, PATCH (mis. DELETE) |
| `415` | Content-Type bukan `application/json` pada mutasi |
| `422` | `name` tidak ada, bukan string, kurang dari 3 karakter, atau lebih dari 100 karakter |
| `500` | Kesalahan internal server / koneksi database |

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
- Daftar resep (10A): hanya resep tayang, field kartu, kategori array, rating/favorit dari database, pencarian judul/bahan tanpa duplikat, escape `%`/`_`, filter kategori/tingkat/waktu, kombinasi filter, semua urutan, limit/offset/total, validasi 422, dan method 405.
- Detail resep (10B): konsistensi field dengan daftar, penulis, urutan bahan/langkah/ulasan, takaran pecahan/null, array kosong, privasi kolom akun, status favorit per pengguna, ID palsu/invalid, resep tersembunyi bahkan untuk admin, resep dihapus, cookie invalid/akun terhapus sebagai tamu, pemulihan remember/rotasi/replay, logout, serta tidak ada cookie/CSRF anonim.

**Pengujian daftar dan detail resep** membuat empat resep fixture (satu disembunyikan) lengkap dengan bahan, langkah, kategori, favorit, dan ulasan memakai slug berawalan `foodhub-test-`. Fixture dihapus pada blok `finally` melalui `ON DELETE CASCADE`; data resep awal tidak diubah. Jika proses dihentikan paksa, hapus resep berslug `foodhub-test-%` secara manual.

**Pengujian autentikasi menulis ke database lokal:** script membuat dua akun dengan alamat email acak khusus pengujian, mengubah salah satu akun uji menjadi admin untuk memeriksa login berdasarkan role, lalu menghapus hanya akun uji tersebut dalam blok `finally`, termasuk ketika assertion gagal. Sesi pengujian menggunakan direktori sementara terpisah yang juga dibersihkan. Akun yang sudah ada tidak diubah. Gunakan database pengembangan, bukan database produksi. Jika proses dihentikan paksa sebelum cleanup berjalan, akun uji berawalan `foodhub-test-` dapat tertinggal dan harus diperiksa secara manual.

Tes frontend tanpa dependency tambahan:

```sh
node --check frontend/js/main.js
node --test frontend/tests/auth.test.js
```

Tes Node memakai VM/mock DOM/fetch untuk memeriksa kontrak autentikasi, fail-closed, proteksi halaman, redirect, kegagalan logout, serta tidak adanya sumber autentikasi lokal. Regresi detail memeriksa tampilan data API, rating null, kegagalan API tanpa fallback demo, respons tidak lengkap, dan URL tanpa ID. Tes PHP menggunakan HTTP dan database lokal nyata, termasuk token remember. Belum ada pengujian browser nyata yang terotomatisasi.

- Profil pengguna (11): membaca profil akun lengkap dari database, validasi nama 3–100 karakter dan bio opsional, penolakan manipulasi role/id/email, proteksi CSRF pada POST/PUT/PATCH, method DELETE ditolak 405.

Autentikasi nomor 8, fondasi otorisasi/CSRF nomor 9, daftar resep 10A, detail resep 10B, dan API profil pengguna (11) selesai. Pengelolaan favorit/ulasan dan admin belum diimplementasikan; endpoint terlindungi tersebut baru berupa guarded stub dengan status `501`.
