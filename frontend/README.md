# Frontend FoodHub

Antarmuka web FoodHub untuk menjelajahi resep masakan Nusantara. Frontend menggunakan HTML, CSS, dan JavaScript tanpa framework eksternal, serta berkomunikasi dengan API backend untuk autentikasi dan data aplikasi.

## Struktur berkas

| Berkas / direktori | Fungsi |
|---|---|
| `index.html` | Beranda dan resep pilihan |
| `daftar-resep.html` | Daftar dan pencarian resep |
| `detail-resep.html` | Detail resep, takaran bahan, dan ulasan |
| `faq.html` | Pertanyaan yang sering diajukan |
| `masuk.html` | Form masuk |
| `daftar.html` | Form pendaftaran |
| `profil.html` | Profil pengguna dan resep favorit |
| `admin/dasbor.html` | Ringkasan statistik admin |
| `admin/kelola-resep.html` | Pengelolaan resep |
| `admin/moderasi-resep.html` | Moderasi resep |
| `admin/kelola-pengguna.html` | Pengelolaan pengguna |
| `css/style.css` | Gaya dan tata letak halaman |
| `js/main.js` | Logika interaksi halaman dan komunikasi API |
| `tests/auth.test.js` | Pengujian otomatis autentikasi |
| `img/` | Logo, gambar resep, dan foto unggahan |

## Halaman yang didukung

```text
Beranda
├── Daftar Resep
│   └── Detail Resep
├── FAQ
├── Masuk / Daftar
└── Profil
    └── Resep Favorit

Admin
├── Dasbor
├── Kelola Resep
├── Moderasi Resep
└── Kelola Pengguna
```

## Fitur frontend

- Mencari dan memfilter resep berdasarkan kategori serta kriteria resep.
- Melihat detail resep dan menyesuaikan jumlah porsi.
- Menyimpan resep favorit serta membaca, mengirim, dan mengelola ulasan.
- Mendaftar, masuk, dan mengelola profil pengguna.
- Mengelola resep, moderasi, pengguna, dan statistik melalui halaman admin.
- Mengirim permintaan API backend dengan perlindungan token CSRF.

## Menjalankan frontend

1. Pastikan backend dan database sudah dikonfigurasi sesuai petunjuk di [README Backend](../backend/README.md) dan [README Database](../database/README.md).
2. Jalankan proyek melalui web server lokal, misalnya Laragon. Frontend perlu dibuka melalui web server agar permintaan ke API backend dapat berjalan.
3. Buka URL lokal untuk halaman `frontend/index.html` melalui browser.

## Pengujian otomatis

Dari direktori `frontend/`, jalankan:

```sh
node --check js/main.js
node --test tests/auth.test.js
```
