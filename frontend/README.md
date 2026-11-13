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
│   └── main.js              # Logika interaktif, routing halaman, kalkulator porsi, client API & offline fallback
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

Untuk mencoba fitur Member dan Admin secara langsung:

| Email | Kata Sandi | Peran | Hak Akses |
|---|---|---|---|
| `admin@foodhub.id` | `admin123` | **Admin** | Panel Dasbor Admin, Kelola Resep, Moderasi Resep, Kelola Pengguna |
| `raka@contoh.id` | `rahasia123` | **Member** | Simpan Favorit, Kirim Rating & Ulasan, Edit Profil |
| `nadia@contoh.id` | `rahasia123` | **Member** | Simpan Favorit, Kirim Rating & Ulasan, Edit Profil |

---

## Arsitektur Integrasi: API & Offline Fallback

Frontend dibangun dengan pendekatan **Hybrid Client Architecture**:
1. **Mode Online (Backend Terhubung)**:  
   `main.js` mengirim permintaan asinkron (`fetch()`) ke endpoint PHP di `../backend/api/` (`auth.php`, `recipes.php`, `favorites.php`, `reviews.php`, `profile.php`, `admin/recipes.php`).
2. **Mode Offline (Backend Belum Aktif / Demo Standalone)**:  
   Jika backend PHP belum dinyalakan atau gagal dijangkau, antarmuka otomatis beralih (*fallback*) menggunakan data lokal di memori dan `localStorage` peramban. Seluruh fungsi navigasi, penambahan resep, favorit, filter, dan FAQ tetap dapat diuji tanpa hambatan *error*.

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
   - Atau gunakan ekstensi **Live Server** di VS Code: klik kanan pada `frontend/index.html` → pilih **Open with Live Server**.

2. **Membuka Langsung di Browser**:
   - Cukup klik dua kali berkas `frontend/index.html` pada peramban web modern (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari).
