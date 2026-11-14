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
│   ├── kelola-resep.html    # CRUD resep: Tambah resep (modal popup), Edit & Hapus resep
│   ├── moderasi-resep.html  # Moderasi status publikasi resep (Tayang / Sembunyi)
│   └── kelola-pengguna.html # Daftar akun pengguna terdaftar & aksi hapus akun
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

### 1. Eksplorasi & Katalog Resep
- **Kartu Resep Standar**:
  - Grid 3 kolom responsif di desktop, 2 kolom di tablet, dan 1 kolom di mobile.
  - Foto berukuran proporsional (tinggi 240px) berlatar krem (`#F4E7D7`), judul tebal, deskripsi singkat resep, asal daerah, durasi memasak, dan bintang rating rata-rata.
- **Pencarian & Multi-Filter**: Pencarian nama resep atau bahan masakan secara *real-time* digabung dengan filter kategori masakan, batas waktu memasak (menit), dan tingkat kesulitan (*Mudah, Sedang, Sulit*).

### 2. Panduan Memasak Interaktif (`detail-resep.html`)
- **Kalkulator Porsi Dinamis**: Mengubah jumlah porsi secara instan dengan tombol **`+`** atau **`−`**; seluruh takaran gram/ml setiap bahan dihitung ulang otomatis secara proporsional.
- **Penyimpanan Favorit**: Simpan resep ke koleksi pribadi dengan satu klik (tersinkron ke halaman Profil).
- **Sistem Rating & Ulasan Bintang**: Memberikan ulasan teks dan rating bintang 1–5 bagi pengguna yang telah masuk akun.

### 3. FAQ Interaktif & Manajemen Mandiri (`faq.html`)
- **Filter Kategori Panduan**: Tombol *chip* untuk menyaring pertanyaan khusus **Pengunjung Umum**, **Member**, atau **Admin**.
- **Fitur Tambah Pertanyaan Langsung dari Web**:
  - Tombol **`+ Tambah Pertanyaan`** membuka formulir jendela pop-up (*modal dialog*).
  - Pengguna dapat memilih kategori target (*Pengunjung, Member, Admin*), mengetik pertanyaan, dan menuliskan jawabannya.
  - Pertanyaan baru langsung tampil seketika di kategori yang sesuai dengan gaya kartu *accordion* seragam (bisa diklik buka-tutup) dan dilengkapi tombol **Hapus** untuk menghapusnya kapan saja (tersimpan di `localStorage`).

### 4. Akun & Profil Pengguna (`profil.html`)
- Melihat informasi akun yang sedang masuk (nama, email, peran, tanggal bergabung).
- Mengubah nama tampilan profil.
- Mengelola daftar **Resep Favorit** tersimpan dan menghapus resep dari favorit.

### 5. Panel Pengelola Admin (`admin/`)
- **Kelola Resep**:
  - **Tambah Resep Baru**: Dialog formulir modal lengkap (nama resep, asal daerah, kategori, waktu, kesulitan, porsi, gambar, cerita, daftar bahan, dan langkah memasak).
  - **Edit Resep**: Membuka data resep yang ada ke formulir untuk diperbarui.
  - **Hapus Resep**: Menghapus resep secara permanen dari sistem.
- **Moderasi Resep**: Menayangkan atau menyembunyikan resep (`is_published = 1` vs `is_published = 0`). Resep yang disembunyikan tidak akan tampil di katalog publik.
- **Kelola Pengguna**: Menampilkan tabel seluruh pengguna terdaftar dan menghapus akun member.

---

## Akun Demo Pengujian

Akun berikut mengacu pada data awal database, bukan akun login lokal. Akun hanya dapat dipakai jika benar-benar tersedia di database backend dengan kredensial yang sesuai. Backend PHP dan database harus aktif; tidak ada autentikasi demo/offline.

| Email | Kata Sandi | Peran | Hak Akses |
|---|---|---|---|
| `admin@foodhub.id` | `admin123` | **Admin** | Panel Dasbor Admin, Kelola Resep, Moderasi Resep, Kelola Pengguna |
| `raka@contoh.id` | `rahasia123` | **Member** | Simpan Favorit, Kirim Rating & Ulasan, Edit Profil |
| `nadia@contoh.id` | `rahasia123` | **Member** | Simpan Favorit, Kirim Rating & Ulasan, Edit Profil |

---

## Autentikasi Online-Only (Nomor 8)

Integrasi frontend **registrasi, login, pemeriksaan sesi (`me`), dan logout sudah selesai** sesuai kontrak berikut. Pastikan database lama sudah mendapat migrasi `database/migrations/001_remember_tokens.sql` untuk fitur Ingat saya. Backend memiliki pengujian HTTP dengan database lokal; tes frontend memakai mock DOM/fetch, sehingga pemeriksaan tampilan langsung di browser tetap disarankan.

| Endpoint `backend/api/auth.php` | Request | Respons sukses |
|---|---|---|
| `POST ?action=register` | JSON `{name,email,password}` | `201 {user:{id,name,email,role}}` |
| `POST ?action=login` | JSON `{email,password,remember:boolean}` | `200 {user:{id,name,email,role}}` |
| `GET ?action=me` | Cookie server, tanpa body | `200 {user:{id,name,email,role}}` atau `{user:null}` |
| `POST ?action=logout` | Header `Content-Type: application/json`; body tidak wajib | `200 {message:"Berhasil keluar."}` |

- Seluruh request memakai `credentials: 'same-origin'`. Sajikan frontend dan backend pada origin yang sama; cookie sesi/remember dikelola server, bukan JavaScript.
- **Ingat saya nyata:** `remember: true` meminta token aman **HttpOnly selama 30 hari** dari server; `false` memakai sesi biasa. Frontend tidak menyimpan identitas atau token autentikasi ke `localStorage`/`sessionStorage`.
- Setiap inisialisasi halaman memanggil `me`. Backend wajib memeriksa database untuk keberadaan akun dan peran terbaru; akun yang dihapus/peran yang berubah tidak boleh dipulihkan dari demo lokal.
- Jika `me` gagal (jaringan, HTTP error, JSON/bentuk respons rusak), pengguna dianggap tidak masuk (**fail closed**), notifikasi ditampilkan, dan konten member/admin tetap tersembunyi. Pengunjung tanpa sesi diarahkan ke login dengan `next`; kegagalan pemeriksaan sesi juga meneruskan notifikasi ke form login. Member yang membuka admin diarahkan ke beranda.
- Redirect `next` tetap dibatasi ke nama halaman lokal yang diizinkan pola frontend, bukan URL eksternal.
- Login/registrasi hanya berhasil setelah API mengembalikan objek pengguna valid (`id`, `name`, `email`, `role` member/admin). Respons HTTP sukses dengan JSON rusak, pengguna tidak lengkap, atau payload error tetap ditolak.
- Tombol logout navigasi dan sidebar memakai handler yang sama. Pengguna baru dianggap keluar dan diarahkan ke beranda setelah respons API valid; kegagalan tetap di halaman, menampilkan error, serta memungkinkan percobaan ulang. Backend bertanggung jawab mencabut cookie sesi **dan** token remember.
- Submit login/registrasi dan klik logout ganda dicegah selama request berlangsung.
- Migrasi menghapus **hanya identitas lama `fh_s`** dari kedua storage. Data pengguna demo `fh_users` tetap dipertahankan dan **tidak pernah dipakai untuk autentikasi**. Seed demo tidak lagi berisi password; saat daftar demo dibaca oleh fitur lokal, hanya properti plaintext `pass` lama yang dibuang, tanpa menghapus akun/favorit/metadata lainnya.
- Backend tetap wajib mengotorisasi setiap endpoint terlindungi; penyembunyian halaman di frontend bukan pengganti otorisasi server. Error backend diharapkan berupa `{error:string}` dengan status HTTP yang sesuai.

## Fitur Lain: API, Data Lokal & Fallback

`main.js` juga memanggil `recipes.php`, `favorites.php`, `reviews.php`, `profile.php`, dan `admin/recipes.php`. Integrasi autentikasi di atas **tidak berarti seluruh fitur lain sudah tersambung backend**:

- Katalog/detail resep dan sebagian halaman admin masih memiliki fallback data lokal ketika API gagal.
- FAQ khusus tetap disimpan di `localStorage`.
- Daftar/jumlah pengguna pada panel admin masih memakai `users()`/`fh_users` demo lokal; hapus pengguna demo bukan penghapusan akun database.
- Profil dan favorit masih memiliki tampilan/fallback lokal terbatas sambil menunggu integrasi lanjutan. Data lokal bukan bukti sesi atau hak admin.

Backend profil, administrasi pengguna, dan favorit lanjutan berada di luar scope nomor 8 ini. Tidak ada fallback autentikasi saat API tidak tersedia.

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

Tes memakai modul bawaan `node:test`, `node:assert`, dan `node:vm` dengan mock DOM, storage, serta fetch. Cakupan meliputi otoritas API pada `me`/login/registrasi, penolakan payload rusak, proteksi member/admin, migrasi identitas lokal, logout sukses/gagal, pembatasan redirect, dan pencegahan request ganda. Tes tidak membutuhkan server/database dan tidak menggantikan uji integrasi cookie HttpOnly/remember 30 hari dengan backend nyata.

