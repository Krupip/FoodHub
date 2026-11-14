# Frontend FoodHub

Antarmuka web platform resep makanan digital Nusantara berbasis **HTML5**, **CSS3**, dan **Modern JavaScript (ES6+)** tanpa ketergantungan library/framework eksternal (*Vanilla Web Standards*).

---

## Daftar Berkas & Struktur Halaman

```
frontend/
├── index.html               # Beranda: banner hero, pencarian cepat, 3 kartu resep populer
├── daftar-resep.html        # Katalog Resep: pencarian lengkap & filter kategori/waktu/level
├── detail-resep.html        # Detail Resep: kalkulator porsi dinamis, bahan, langkah & ulasan
├── faq.html                 # FAQ: panduan pengunjung, member, admin + tambah pertanyaan interaktif
├── masuk.html               # Form login pengguna (member & admin)
├── daftar.html              # Form registrasi akun member baru
├── profil.html              # Profil akun: info pengguna & koleksi Resep Favorit tersimpan
├── admin/                   # Modul Panel Pengelola (Admin)
│   ├── dasbor.html          # Ringkasan statistik sistem (resep tayang, sembunyi, pengguna)
│   ├── kelola-resep.html    # UI tambah/edit/hapus resep; backend masih guarded stub 501
│   ├── moderasi-resep.html  # UI moderasi status publikasi resep (Tayang / Sembunyi)
│   └── kelola-pengguna.html # Daftar & hapus pengguna demo lokal, bukan akun database
├── css/
│   └── style.css            # Seluruh aturan gaya, palet warna, layout grid & responsif
├── js/
│   └── main.js              # Auth online-only, logika halaman, client API & fallback non-auth
├── tests/
│   └── auth.test.js         # Tes autentikasi dengan node:test + VM, tanpa dependency
└── img/                     # Aset gambar resep lokal & logo FoodHub
```

---

## Fitur-Fitur Utama Frontend

Bagian ini menjelaskan antarmuka yang tersedia, **bukan klaim bahwa CRUD backend sudah selesai**. Auth sudah online-only; profil, favorit, ulasan, dan administrasi backend masih berupa guarded stubs `501` (lihat bagian kontrak nomor 9).

### 1. Eksplorasi & Katalog Resep
- **Kartu Resep Standar**:
  - Grid 3 kolom responsif di desktop, 2 kolom di tablet, dan 1 kolom di mobile.
  - Foto berukuran proporsional (tinggi 240px) berlatar krem (`#F4E7D7`), judul tebal, deskripsi singkat resep, asal daerah, durasi memasak, dan bintang rating rata-rata.
- **Pencarian & Multi-Filter**: Pencarian nama resep atau bahan masakan secara *real-time* digabung dengan filter kategori masakan, batas waktu memasak (menit), dan tingkat kesulitan (*Mudah, Sedang, Sulit*).

### 2. Panduan Memasak Interaktif (`detail-resep.html`)
- **Kalkulator Porsi Dinamis**: Mengubah jumlah porsi secara instan dengan tombol **`+`** atau **`−`**; seluruh takaran gram/ml setiap bahan dihitung ulang otomatis secara proporsional.
- **UI Favorit**: Tombol simpan/hapus favorit dan koleksi di Profil tersedia; mutasi backend saat ini mengembalikan `501`, belum menyimpan favorit.
- **UI Rating & Ulasan Bintang**: Form ulasan teks dan rating bintang 1–5 tersedia bagi pengguna yang masuk; pengiriman backend masih `501`.

### 3. FAQ Interaktif & Manajemen Mandiri (`faq.html`)
- **Filter Kategori Panduan**: Tombol *chip* untuk menyaring pertanyaan khusus **Pengunjung Umum**, **Member**, atau **Admin**.
- **Fitur Tambah Pertanyaan Langsung dari Web**:
  - Tombol **`+ Tambah Pertanyaan`** membuka formulir jendela pop-up (*modal dialog*).
  - Pengguna dapat memilih kategori target (*Pengunjung, Member, Admin*), mengetik pertanyaan, dan menuliskan jawabannya.
  - Pertanyaan baru langsung tampil seketika di kategori yang sesuai dengan gaya kartu *accordion* seragam (bisa diklik buka-tutup) dan dilengkapi tombol **Hapus** untuk menghapusnya kapan saja (tersimpan di `localStorage`).

### 4. Akun & Profil Pengguna (`profil.html`)
- Melihat informasi akun yang sedang masuk (nama, email, peran, tanggal bergabung).
- Form perubahan nama tampilan profil tersedia, tetapi penyimpanan backend masih `501`.
- UI koleksi/hapus **Resep Favorit** tersedia dengan fallback lokal terbatas; belum merupakan pengelolaan favorit database.

### 5. Panel Pengelola Admin (`admin/`)
- **Kelola Resep**:
  - **Tambah Resep Baru**: Dialog formulir modal lengkap (nama resep, asal daerah, kategori, waktu, kesulitan, porsi, gambar, cerita, daftar bahan, dan langkah memasak).
  - **Edit Resep**: Membuka data resep yang ada ke formulir untuk diperbarui.
  - **Hapus Resep**: Tombol dan konfirmasi hapus tersedia, tetapi belum menghapus resep database.
  - Endpoint administrasi resep masih guarded stub `501`; tambah/edit/hapus belum merupakan CRUD backend yang berfungsi.
- **Moderasi Resep**: UI status tayang/sembunyi tersedia (`is_published = 1` vs `0`); mutasi backend belum diimplementasikan.
- **Kelola Pengguna**: Tabel dan aksi hapus masih memakai pengguna demo lokal, bukan daftar/penghapusan akun database.

---

## Akun Demo Pengujian

Akun berikut mengacu pada data awal database, bukan akun login lokal. Akun hanya dapat dipakai jika benar-benar tersedia di database backend dengan kredensial yang sesuai. Backend PHP dan database harus aktif; tidak ada autentikasi demo/offline.

Hak akses di bawah menunjukkan peran yang dituju, bukan jaminan fitur non-auth sudah diimplementasikan.

| Email | Kata Sandi | Peran | Hak Akses |
|---|---|---|---|
| `admin@foodhub.id` | `admin123` | **Admin** | Panel Dasbor Admin, Kelola Resep, Moderasi Resep, Kelola Pengguna |
| `raka@contoh.id` | `rahasia123` | **Member** | Simpan Favorit, Kirim Rating & Ulasan, Edit Profil |
| `nadia@contoh.id` | `rahasia123` | **Member** | Simpan Favorit, Kirim Rating & Ulasan, Edit Profil |

---

## Autentikasi Online-Only (Nomor 8 + CSRF Nomor 9)

Integrasi frontend **registrasi, login, pemeriksaan sesi (`me`), dan logout sudah selesai** sesuai kontrak berikut. Pastikan database lama sudah mendapat migrasi `database/migrations/001_remember_tokens.sql` untuk fitur Ingat saya. Backend memiliki pengujian HTTP dengan database lokal; tes frontend memakai mock DOM/fetch, sehingga pemeriksaan tampilan langsung di browser tetap disarankan.

| Endpoint `backend/api/auth.php` | Request | Respons sukses | Header respons `X-CSRF-Token` |
|---|---|---|---|
| `POST ?action=register` | JSON `{name,email,password}`, tidak wajib CSRF | `201 {user:{id,name,email,role}}` | Wajib, 64 karakter hex lowercase |
| `POST ?action=login` | JSON `{email,password,remember:boolean}`, tidak wajib CSRF | `200 {user:{id,name,email,role}}` | Wajib, 64 karakter hex lowercase |
| `GET ?action=me` | Cookie server, tanpa body | `200 {user:{id,name,email,role}}` atau `{user:null}` | Wajib jika `user != null`; tidak ada untuk anon |
| `POST ?action=logout` | `Content-Type: application/json`; CSRF wajib jika authenticated; body tidak wajib | `200 {message:"Berhasil keluar."}` | Tidak dibutuhkan setelah logout |

- Seluruh request memakai `credentials: 'same-origin'`. Sajikan frontend dan backend pada origin yang sama; cookie sesi/remember dikelola server, bukan JavaScript.
- **Ingat saya nyata:** `remember: true` meminta token aman **HttpOnly selama 30 hari** dari server; `false` memakai sesi biasa. Frontend tidak menyimpan identitas atau token autentikasi ke `localStorage`/`sessionStorage`.
- Setiap inisialisasi halaman memanggil `me`. Backend wajib memeriksa database untuk keberadaan akun dan peran terbaru; akun yang dihapus/peran yang berubah tidak boleh dipulihkan dari demo lokal.
- Jika `me` gagal (jaringan, HTTP error, JSON/bentuk respons rusak, atau user authenticated tanpa header CSRF valid), pengguna dianggap tidak masuk (**fail closed**), notifikasi ditampilkan, dan konten member/admin tetap tersembunyi. Pengunjung tanpa sesi diarahkan ke login dengan `next`; kegagalan pemeriksaan sesi juga meneruskan notifikasi ke form login. Member yang membuka admin diarahkan ke beranda.
- Redirect `next` tetap dibatasi ke nama halaman lokal yang diizinkan pola frontend, bukan URL eksternal.
- Login/registrasi hanya dianggap berhasil setelah API mengembalikan objek pengguna valid (`id`, `name`, `email`, `role` member/admin) **dan header CSRF valid**. Respons HTTP sukses dengan JSON rusak, pengguna tidak lengkap, payload error, atau header CSRF hilang/rusak tetap ditolak.
- Tombol logout navigasi dan sidebar memakai handler yang sama. Pengguna baru dianggap keluar dan diarahkan ke beranda setelah respons API valid; kegagalan tetap di halaman, menampilkan error, serta memungkinkan percobaan ulang. Backend bertanggung jawab mencabut cookie sesi **dan** token remember.
- Submit login/registrasi dan klik logout ganda dicegah selama request berlangsung.
- Migrasi menghapus **hanya identitas lama `fh_s`** dari kedua storage. Data pengguna demo `fh_users` tetap dipertahankan dan **tidak pernah dipakai untuk autentikasi**. Seed demo tidak lagi berisi password; saat daftar demo dibaca oleh fitur lokal, hanya properti plaintext `pass` lama yang dibuang, tanpa menghapus akun/favorit/metadata lainnya.
- Backend tetap wajib mengotorisasi setiap endpoint terlindungi; penyembunyian halaman di frontend bukan pengganti otorisasi server. Error backend diharapkan berupa `{error:string}` dengan status HTTP yang sesuai.

## CSRF & Guarded Stubs (Nomor 9)

- JSON sukses/error auth **tidak berubah**. Token CSRF hanya dibaca dari header respons `X-CSRF-Token`, bukan dari body maupun properti `user`. Nilainya harus string tepat **64 karakter `[0-9a-f]`**, tanpa spasi/newline; uppercase atau format lain ditolak.
- Token stabil selama sesi yang sama dan berotasi saat server mengganti identitas sesi melalui login, registrasi, atau restore remember. `api()` menyimpan token valid di variabel **memori halaman saja**, tidak ke `localStorage`/`sessionStorage`. Respons login/register/me mengganti cache sebelumnya; `me` anon, logout sukses, dan `401` endpoint terlindungi membuang cache serta identitas frontend. Login gagal tidak dianggap sebagai pergantian sesi.
- `api()` otomatis menyertakan token yang tersedia sebagai header pada unsafe methods (`POST`/`PUT`/`PATCH`/`DELETE`). `GET`/`HEAD`/`OPTIONS` tidak mengirim token dan tidak memerlukan refresh token. Public POST login/register tidak memerlukan preflight CSRF, tetapi boleh membawa token cache jika sudah ada.
- Jika mutasi protected (termasuk logout) belum memiliki cache, klien terlebih dahulu melakukan **satu GET `auth.php?action=me` per pemanggilan** melalui helper fetch nonrekursif untuk mengambil token atau memulihkan remember. Jika hasilnya anon, request asli tetap dikirim tanpa token agar backend dapat mengembalikan `401`, atau `200` untuk logout anon yang idempotent. Jika user authenticated tetapi header hilang/tidak valid, atau refresh gagal, request mutasi **tidak dikirim** dan error diteruskan ke notifikasi/form pemanggil.
- Tidak ada retry otomatis mutasi saat `403` (atau status error lain), agar tidak menggandakan operasi. Header CSRF valid dari respons error, termasuk `403`/`501`, dapat memperbarui cache untuk **percobaan manual berikutnya**. Logout authenticated tanpa token/cocok sesi akan `403` dan **tidak mencabut sesi**; frontend tetap di halaman dan tidak menampilkan sukses.
- Guard backend `requireLogin()` menolak anon dengan `401`; `requireAdmin()` menolak member dengan `403`. Guard membaca peran terbaru dari database, mengembalikan array user secara internal, dan menerbitkan header CSRF saat lolos. Ini bukan perubahan bentuk JSON user yang diterima frontend.
- Endpoint `profile.php`, `favorites.php`, `reviews.php`, `admin/recipes.php`, `admin/users.php`, dan `admin/stats.php` saat ini **guarded stubs**: otorisasi dahulu, verifikasi CSRF untuk unsafe methods, lalu `501` karena bisnis/CRUD belum diimplementasikan. `GET`/`HEAD`/`OPTIONS` tidak wajib token tetapi tetap tunduk pada guard endpoint. Status `401`/`403`/`501` bukan indikasi mutasi berhasil.
- Perubahan frontend nomor 9 hanya menambahkan transport/cache CSRF dan tes; tidak menambah endpoint atau mengimplementasikan bisnis/CRUD. Penyembunyian UI tidak menggantikan guard dan validasi CSRF server.

## Fitur Lain: API, Data Lokal & Fallback

`main.js` juga memanggil `recipes.php`, `favorites.php`, `reviews.php`, `profile.php`, dan `admin/recipes.php`. Integrasi autentikasi di atas **tidak berarti seluruh fitur lain sudah tersambung backend**:

- Katalog/detail resep dan sebagian halaman admin masih memiliki fallback data lokal ketika API gagal.
- FAQ khusus tetap disimpan di `localStorage`.
- Daftar/jumlah pengguna pada panel admin masih memakai `users()`/`fh_users` demo lokal; hapus pengguna demo bukan penghapusan akun database.
- Profil dan favorit masih memiliki tampilan/fallback lokal terbatas sambil menunggu integrasi lanjutan. Data lokal bukan bukti sesi atau hak admin.

Implementasi bisnis backend profil/favorit/ulasan/administrasi tetap di luar scope frontend nomor 9 ini; guarded stubs-nya mengembalikan `501` setelah guard/CSRF lolos. Tidak ada fallback autentikasi saat API tidak tersedia.

---

## Desain & Gaya Antarmuka (CSS)

- **Palet Warna Utama**:
  - Merah Utama: `#DC2A22` (hover `#B71D17`)
  - Krem Latar: `#FFF7EE` & Krem Pasir: `#F6E7D5` / `#F4E7D7`
  - Kuning Madu: `#F5B335`
  - Hijau Sirih: `#2F7D5B`
  - Tinta Cokelat Arang: `#241915`
- **Tipografi**:
  - Judul / Display: **Fraunces** (Serif klasik bergaya hangat & ramah)
  - Isi / UI: **Outfit** (Sans-serif modern, bersih, dan mudah dibaca)
- **Responsivitas**:
  - Desktop (> 900px): Tata letak grid penuh 3 kolom dan sidebar admin tetap.
  - Tablet (600px – 900px): Tata letak adaptif 2 kolom.
  - Mobile (< 600px): Tata letak 1 kolom, navigasi drawer menu burger (*hamburger menu*).

---

## Cara Menjalankan Frontend

1. **Menggunakan Web Server Lokal (Direkomendasikan)**:
   - Jalankan **Apache** di XAMPP, letakkan folder proyek di `htdocs/FoodHub`, lalu akses melalui:
     ```
     http://localhost/FoodHub/frontend/
     ```
   - Di Laragon, gunakan Apache/PHP dan URL proyek yang setara. Pastikan endpoint `backend/api/auth.php` dan database tersedia pada origin yang sama. Gunakan HTTPS pada deployment untuk cookie aman.

2. **Pratinjau Statis / Offline**:
   - Live Server atau membuka `frontend/index.html` langsung hanya cocok untuk pratinjau fitur lokal/publik. Cara ini tidak menjalankan PHP; autentikasi tidak tersedia dan halaman terlindungi tidak dibuka.

## Menjalankan Tes Frontend

Dari root proyek, dengan Node.js yang mendukung `node:test` (Node 18+):

```sh
node --check frontend/js/main.js
node --check frontend/tests/auth.test.js
node --test frontend/tests/auth.test.js
```

Tes memakai modul bawaan `node:test`, `node:assert`, dan `node:vm` dengan mock DOM, storage, serta fetch/header respons. Seluruh 95 tes auth nomor 8 tetap dipertahankan. Regresi nomor 9 meliputi header logout/mutasi, pengecualian safe methods/public auth, refresh `me` nonrekursif (remember/anon), rotasi/pembersihan cache sesi, header hilang/rusak, larangan token dari body/storage, kompatibilitas mock tanpa headers, tanpa retry otomatis `403`, serta penanganan guarded stubs `501` termasuk form profil tanpa sukses palsu. Tes tidak membutuhkan server/database dan tidak menggantikan uji integrasi cookie HttpOnly/remember 30 hari, guard, dan CSRF dengan backend nyata.

