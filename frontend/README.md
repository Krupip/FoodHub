# Frontend FoodHub

Antarmuka web platform resep makanan Nusantara berbasis **HTML5**, **CSS3**, dan **Vanilla JavaScript (ES6+)** tanpa library atau framework eksternal.

## Struktur Berkas

```
frontend/
├── index.html               # Beranda: pencarian resep & resep pilihan
├── daftar-resep.html        # Katalog resep dengan pencarian & filter
├── detail-resep.html        # Detail resep, hitung porsi (+/-), bahan & langkah
├── faq.html                 # Pertanyaan umum (accordion <details>)
├── masuk.html               # Form login member/admin
├── daftar.html              # Form pendaftaran akun member
├── profil.html              # Profil member & daftar resep favorit
├── admin/
│   ├── dasbor.html          # Statistik ringkas admin
│   ├── kelola-resep.html    # Tambah, edit, hapus, upload & kompres foto resep
│   └── kelola-pengguna.html # Daftar, tambah, & hapus akun member
├── css/
│   └── style.css            # Styling minimalis & responsif (~320 baris)
├── js/
│   └── main.js              # Satu file JS: API client, CSRF, auth, navigasi & admin
├── tests/
│   └── auth.test.js         # 201 automated test autentikasi & CSRF (node:test)
└── img/                     # Aset gambar resep, logo, dan hasil upload
```

## Panduan Belajar untuk Pemula (Persiapan UAS)

1. **`css/style.css`**: Styling murni CSS3 menggunakan CSS Grid, Flexbox, dan `:root` variabel. Bersih, rapi, dan mudah dipahami baris per baris.
2. **`js/main.js`**:
   - **Bagian 1–2**: Fungsi `api()` dan `fetchApi()` untuk mengirim request ke `backend/api/` dengan header `X-CSRF-Token` yang disimpan di memori.
   - **Bagian 3–4**: Pemeriksaan sesi aktif `auth.php?action=me` dan proteksi halaman `member`/`admin`.
   - **Bagian 5**: Fungsi render kartu resep `card()` dan menu navigasi `buildNav()`.
   - **Bagian 6**: Fungsi `kompresFoto()` menggunakan HTML5 `<canvas>` untuk mengecilkan foto kamera HP (> 2 MB) secara otomatis.
   - **Bagian 7**: Objek `PG` yang menjalankan logika tiap halaman (`index`, `daftar-resep`, `detail-resep`, `profil`, `masuk`, `daftar`, `dasbor`, `kelola-resep`, `kelola-pengguna`).

## Menjalankan Pengujian

```sh
node --check frontend/js/main.js
node --test frontend/tests/auth.test.js
```
