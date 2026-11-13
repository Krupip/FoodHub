/* ==========================================================================
   FoodHub - main.js
   Frontend murni. Data contoh disimpan di localStorage agar semua fitur
   bisa dicoba tanpa backend.
   Saat backend (PHP/MySQL) siap, ganti fungsi penyimpanan (ld/sv/users/urs)
   dengan fetch ke API.
   ========================================================================== */
(function () {
'use strict';

/* ---------- Konstanta Global & Utilitas DOM ---------- */

const B   = document.body;
const P   = B.dataset.page;          // nama halaman aktif (dari data-page)
const R   = B.dataset.root || '';     // path relatif ke root frontend
const ACC = B.dataset.access || '';   // level akses: '', 'member', 'admin'

/** querySelector shortcut */
const $ = (s, r) => (r || document).querySelector(s);

/** querySelectorAll → Array */
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

/** Parameter URL saat ini */
const qs = new URLSearchParams(location.search);

/** Escape HTML untuk mencegah XSS */
const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

/**
 * Baca data dari localStorage
 * @param {string} k - kunci localStorage
 * @param {*} d - nilai default jika kunci tidak ditemukan
 */
const ld = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch (e) {
    return d;
  }
};

/**
 * Simpan data ke localStorage
 * @param {string} k - kunci localStorage
 * @param {*} v - nilai yang disimpan (akan di-JSON.stringify)
 */
const sv = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    toast('Penyimpanan peramban penuh.');
  }
};

/** Tanggal hari ini dalam format ISO (YYYY-MM-DD) */
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Tampilkan notifikasi toast di bagian bawah layar
 * @param {string} m - pesan yang ditampilkan
 */
function toast(m) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = m;
  t.className = 'show';
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.className = ''; }, 2600);
}

/* ==========================================================================
   Ikon SVG Inline
   Default: ikon SVG inline. Untuk memakai ikon Flaticon
   (https://www.flaticon.com/free-icons/web): unduh SVG, simpan di
   frontend/img/icons/<nama>.svg (nama sesuai kunci IC di bawah),
   lalu ubah ICON_FILES jadi true.
   ========================================================================== */

const ICON_FILES = false;

/** Peta ikon: nama → isi SVG path/shape */
const IC = {
  search:  '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chef:    '<path d="M7 19v-4a4 4 0 0 1-.5-7.9 5 5 0 0 1 11 0A4 4 0 0 1 17 15v4z"/><path d="M7 17h10"/>',
  users:   '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6.5 6.5 0 0 1 3 6"/>',
  heart:   '<path d="M12 20s-8-4.9-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.1-8 11-8 11z"/>',
  star:    '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  plus:    '<path d="M12 5v14M5 12h14"/>',
  minus:   '<path d="M5 12h14"/>',
  fridge:  '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M6 10h12M9 6v1.5M9 13v3"/>',
  map:     '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  chat:    '<path d="M4 5h16v11H9l-5 4z"/>',
  user:    '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout:  '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  menu:    '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x:       '<path d="M6 6l12 12M18 6 6 18"/>',
  check:   '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  trash:   '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit:    '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  flag:    '<path d="M5 21V4h12l-2 4 2 4H5"/>',
  grid:    '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  book:    '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/>',
  send:    '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  bowl:    '<path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>',
  share:   '<circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="m8.2 10.8 6.6-3.6M8.2 13.2l6.6 3.6"/>'
};

/**
 * Hasilkan markup ikon (SVG inline atau file eksternal)
 * @param {string} n - nama ikon (kunci dari IC)
 */
const ic = n => ICON_FILES
  ? `<img class="ic" src="${R}img/icons/${n}.svg" alt="">`
  : `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

/**
 * Ganti semua elemen [data-ic] dengan markup ikon yang sesuai
 * @param {Element} root - elemen induk yang akan di-scan
 */
const hydrate = root => $$('[data-ic]', root).forEach(e => {
  e.innerHTML = ic(e.dataset.ic);
});


/* ==========================================================================
   Sesi & Pengguna (Data Contoh)
   Manajemen sesi menggunakan sessionStorage/localStorage.
   ========================================================================== */

/**
 * Ambil data sesi pengguna yang sedang login
 * @returns {Object|null} objek sesi {email} atau null
 */
const sess = () => {
  try {
    const v = sessionStorage.getItem('fh_s') || localStorage.getItem('fh_s');
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
};

/**
 * Simpan sesi login
 * @param {Object} u - data pengguna
 * @param {boolean} keep - true = ingat saya (localStorage), false = sesi saja
 */
const setSess = (u, keep) => {
  try {
    sessionStorage.removeItem('fh_s');
    localStorage.removeItem('fh_s');
    (keep ? localStorage : sessionStorage).setItem('fh_s', JSON.stringify({ email: u.email }));
  } catch (e) {
    /* abaikan */
  }
};

/** Hapus sesi login (logout) */
const endSess = () => {
  try {
    sessionStorage.removeItem('fh_s');
    localStorage.removeItem('fh_s');
  } catch (e) {
    /* abaikan */
  }
};

/**
 * Ambil daftar pengguna dari localStorage, buat data contoh jika belum ada
 * @returns {Array} array objek pengguna
 */
function users() {
  let u = ld('fh_users', null);
  if (!u) {
    u = [
      { name: 'Admin FoodHub', email: 'admin@foodhub.id', pass: 'admin123', role: 'admin', fav: [], at: '2026-08-01' },
      { name: 'Raka Pratama',  email: 'raka@contoh.id',   pass: 'rahasia123', role: 'member', fav: [], at: '2026-09-12' },
      { name: 'Nadia Putri',   email: 'nadia@contoh.id',  pass: 'rahasia123', role: 'member', fav: [], at: '2026-10-03' }
    ];
    sv('fh_users', u);
  }
  return u;
}

/** Ambil data pengguna yang sedang login */
const me = () => {
  const s = sess();
  return s ? (users().filter(x => x.email === s.email)[0] || null) : null;
};

let U = me(); // pengguna yang sedang login

/* ---------- Proteksi Akses Halaman ---------- */

// Halaman khusus member: redirect ke login jika belum masuk
if (ACC === 'member' && !U) {
  location.replace(R + 'masuk.html?next=' + encodeURIComponent(
    location.pathname.split('/').pop() + location.search
  ));
  return;
}

// Halaman khusus admin: redirect jika bukan admin
if (ACC === 'admin') {
  if (!U) {
    location.replace(R + 'masuk.html?next=' + encodeURIComponent(
      'admin/' + location.pathname.split('/').pop()
    ));
    return;
  }
  if (U.role !== 'admin') {
    location.replace(R + 'index.html');
    return;
  }
}


/* ==========================================================================
   Data Resep Contoh (Bawaan / Seed)
   Struktur objek resep:
     id  - ID unik resep
     n   - nama resep
     p   - provinsi asal (kosong jika bukan masakan daerah)
     k   - array kategori (misal ['Cepat', 'Anak Kos'])
     w   - waktu memasak (menit)
     l   - tingkat kesulitan ('Mudah' | 'Sedang' | 'Sulit')
     s   - jumlah porsi
     r   - rata-rata rating
     rc  - jumlah rating
     v   - flag vegetarian/tanpa daging (1 = ya)
     u   - nama pengunggah
     c   - cerita di balik resep
     b   - bahan: array of [nama, jumlah, satuan]
     t   - langkah memasak: array of string
   ========================================================================== */

/** Bahan dasar yang dianggap selalu tersedia (untuk fitur Isi Kulkas) */
const BASIC = ['garam', 'gula', 'minyak', 'air', 'es batu'];

const RECIPES = [
  {
    id: 1, n: 'Rendang Daging Sapi', p: 'Sumatera Barat', k: ['Makanan Berat'],
    w: 180, l: 'Sulit', s: 6, r: 5.0, rc: 48,
    f: 'img/rendang.jpg',
    u: 'Tim FoodHub',
    c: 'Olahan daging sapi empuk kaya rempah khas Minangkabau yang dimasak perlahan hingga santan mengering dan bumbu meresap sempurna.',
    b: [['Daging sapi', 1000, 'g'], ['Santan kental', 1000, 'ml'], ['Cabai merah', 150, 'g'], ['Bawang merah', 100, 'g'], ['Bawang putih', 50, 'g'], ['Lengkuas', 40, 'g'], ['Serai', 3, 'batang'], ['Daun jeruk', 6, 'lembar'], ['Kelapa parut sangrai', 100, 'g'], ['Garam', 2, 'sdt']],
    t: [
      'Haluskan cabai merah, bawang merah, bawang putih, jahe, dan lengkuas.',
      'Masukkan bumbu halus, serai, daun jeruk, dan santan ke wajan bersama potongan daging.',
      'Masak dengan api sedang sambil sesekali diaduk agar santan tidak pecah hingga mendidih.',
      'Tambahkan kelapa parut sangrai dan garam, lalu kecilkan api dan aduk perlahan hingga mengering kecokelatan.'
    ]
  },
  {
    id: 2, n: 'Gulai Itiak', p: 'Sumatera Barat', k: ['Makanan Berat'],
    w: 120, l: 'Sedang', s: 4, r: 4.9, rc: 42,
    f: 'img/gulai-itiak.jpg',
    u: 'Tim FoodHub',
    c: 'Gulai bebek muda khas Koto Gadang Bukittinggi dengan lumuran sambal cabai hijau berlimpah dan santan gurih aromatik.',
    b: [['Bebek muda', 1, 'ekor'], ['Cabai hijau keriting', 250, 'g'], ['Bawang merah', 10, 'siung'], ['Bawang putih', 5, 'siung'], ['Lengkuas', 30, 'g'], ['Santan kelapa', 600, 'ml'], ['Daun kunyit', 1, 'lembar'], ['Asam kandis', 2, 'buah'], ['Garam', 1.5, 'sdt']],
    t: [
      'Bakar sebentar bebek di atas bara untuk membersihkan bulu halus dan mengurangi lemak berlebih.',
      'Giling kasar cabai hijau keriting, bawang merah, bawang putih, jahe, dan lengkuas.',
      'Tumis bumbu giling bersama daun kunyit dan serai hingga harum semerbak.',
      'Tuang santan dan masukkan potongan bebek serta asam kandis, masak api sedang hingga daging bebek empuk meresap.'
    ]
  },
  {
    id: 3, n: 'Sate Padang', p: 'Sumatera Barat', k: ['Makanan Berat'],
    w: 60, l: 'Sedang', s: 4, r: 4.9, rc: 39,
    f: 'img/sate-padang.jpg',
    u: 'Tim FoodHub',
    c: 'Sate lidah dan daging sapi empuk dengan siraman kuah kuning kental kaya rempah kunyit, serai, dan lada gurih pedas.',
    b: [['Daging dan lidah sapi', 500, 'g'], ['Tepung beras', 60, 'g'], ['Kunyit', 4, 'ruas'], ['Bawang merah', 8, 'siung'], ['Bawang putih', 4, 'siung'], ['Ketumbar sangrai', 1, 'sdm'], ['Serai', 2, 'batang'], ['Air kaldu rebusan', 800, 'ml'], ['Garam', 1.5, 'sdt']],
    t: [
      'Rebus potongan daging dan lidah sapi bersama bumbu rempah halus dan serai hingga empuk, lalu potong dadu.',
      'Tusukkan daging pada tusukan sate bambu, bakar sebentar di atas bara api beraroma asap.',
      'Saring air kaldu rebusan, larutkan tepung beras, lalu masak sambil diaduk cepat hingga kuah meletup-letup kental.',
      'Sajikan sate hangat disiram kuah kuning kental dan taburan bawang goreng renyah.'
    ]
  },
  {
    id: 4, n: 'Pempek Kapal Selam', p: 'Sumatera Selatan', k: ['Makanan Berat'],
    w: 90, l: 'Sedang', s: 6, r: 4.8, rc: 33,
    f: 'img/pempek.jpg',
    u: 'Tim FoodHub',
    c: 'Olahan ikan tenggiri kenyal khas Palembang berisi telur utuh, digoreng garing lalu disajikan dengan cuko pedas manis asam.',
    b: [['Ikan tenggiri giling', 500, 'g'], ['Tepung sagu tani', 300, 'g'], ['Telur ayam', 4, 'butir'], ['Bawang putih', 4, 'siung'], ['Gula merah batok', 200, 'g'], ['Cabai rawit hijau', 15, 'buah'], ['Asam jawa', 30, 'g'], ['Air es', 200, 'ml'], ['Garam', 1.5, 'sdt']],
    t: [
      'Uleni ikan tenggiri dingin dengan air es dan garam hingga adonan mengembang kenyal.',
      'Campur tepung sagu perlahan bertahap tanpa diuleni terlalu keras.',
      'Bentuk adonan menjadi mangkuk kantong, isi dengan sebutir telur mentah, lalu rekatkan tepi adonan rapat.',
      'Rebus dalam air mendidih hingga mengapung matang, goreng sesaat sebelum disajikan bersama cuko hitam kental.'
    ]
  },
  {
    id: 5, n: 'Soto Ayam Lamongan', p: 'Jawa Timur', k: ['Makanan Berat'],
    w: 60, l: 'Sedang', s: 4, r: 4.8, rc: 31,
    f: 'img/soto-lamongan.jpg',
    u: 'Tim FoodHub',
    c: 'Soto ayam berkuah kuning bening gurih segar dengan taburan bubuk koya gurih renyah dari kerupuk udang dan bawang putih.',
    b: [['Ayam kampung', 600, 'g'], ['Bawang putih', 6, 'siung'], ['Bawang merah', 8, 'siung'], ['Kunyit bakar', 3, 'ruas'], ['Kemiri sangrai', 4, 'butir'], ['Serai', 2, 'batang'], ['Daun jeruk', 4, 'lembar'], ['Kerupuk udang goreng', 50, 'g'], ['Soun seduh', 80, 'g'], ['Garam', 2, 'sdt'], ['Air', 1800, 'ml']],
    t: [
      'Rebus ayam kampung bersama serai dan daun jeruk hingga kaldu bening terbentuk, suwir daging ayamnya.',
      'Haluskan bawang merah, bawang putih, kemiri, dan kunyit, tumis hingga harum berminyak lalu masukkan ke kuah kaldu.',
      'Haluskan kerupuk udang goreng dan bawang putih goreng untuk membuat taburan koya gurih.',
      'Tata soun, suwiran ayam, dan telur rebus dalam mangkuk, siram kuah panas dan beri taburan bubuk koya melimpah.'
    ]
  },
  {
    id: 6, n: 'Rawon Daging Sapi', p: 'Jawa Timur', k: ['Makanan Berat'],
    w: 120, l: 'Sedang', s: 5, r: 4.8, rc: 29,
    f: 'img/rawon.jpg',
    u: 'Tim FoodHub',
    c: 'Sup daging sapi legendaris Jawa Timur berkuah hitam pekat dari rempah kluwek pilihan dengan aroma khas yang sangat gurih.',
    b: [['Daging sapi sandung lamur', 600, 'g'], ['Kluwek matang hitam', 5, 'buah'], ['Bawang merah', 8, 'siung'], ['Bawang putih', 5, 'siung'], ['Serai', 2, 'batang'], ['Daun jeruk purut', 4, 'lembar'], ['Lengkuas', 3, 'cm'], ['Tauge pendek', 100, 'g'], ['Garam', 2, 'sdt'], ['Air', 1800, 'ml']],
    t: [
      'Buka kluwek, rendam isinya dengan air hangat lalu haluskan bersama bawang merah, bawang putih, dan kemiri.',
      'Tumis bumbu halus bersama serai, lengkuas, dan daun jeruk sampai harum semerbak berminyak.',
      'Masukkan potongan daging sapi sandung lamur, aduk rata hingga berubah warna.',
      'Tuangkan air, masak dengan api kecil hingga daging empuk meresap kuah hitam gurih. Sajikan bersama tauge pendek segar.'
    ]
  },
  {
    id: 7, n: 'Gudeg Jogja', p: 'DI Yogyakarta', k: ['Makanan Berat'],
    w: 240, l: 'Sulit', s: 6, r: 4.7, rc: 26,
    f: 'img/gudeg.jpg',
    u: 'Tim FoodHub',
    c: 'Nangka muda dimasak perlahan berjam-jam bersama santan, gula kelapa aren, dan rempah daun jati hingga legit manis gurih.',
    b: [['Nangka muda potong', 1000, 'g'], ['Santan kelapa', 1000, 'ml'], ['Gula merah aren', 150, 'g'], ['Bawang merah', 10, 'siung'], ['Bawang putih', 6, 'siung'], ['Ketumbar sangrai', 1, 'sdm'], ['Daun salam', 6, 'lembar'], ['Lengkuas', 40, 'g'], ['Telur rebus kupas', 6, 'butir'], ['Garam', 1.5, 'sdt']],
    t: [
      'Alasi dasar panci dengan daun salam dan lengkuas memar.',
      'Tata potongan nangka muda, telur rebus, dan bumbu halus di dalam panci.',
      'Tuangkan santan dan gula merah aren, masak dengan api kecil tertutup selama 3-4 jam.',
      'Masak perlahan hingga kuah santan mengering dan nangka berubah warna cokelat kemerahan legit.'
    ]
  },
  {
    id: 8, n: 'Sate Lilit Bali', p: 'Bali', k: ['Makanan Berat'],
    w: 60, l: 'Sedang', s: 4, r: 4.7, rc: 22,
    f: 'img/sate-lilit.jpg',
    u: 'Tim FoodHub',
    c: 'Daging ikan tenggiri lembut berpadu parutan kelapa muda dan rempah base genep khas Bali, dililitkan di batang serai harum.',
    b: [['Daging ikan tenggiri cincang', 500, 'g'], ['Kelapa parut setengah tua', 120, 'g'], ['Bawang merah', 8, 'siung'], ['Bawang putih', 5, 'siung'], ['Kencur', 3, 'cm'], ['Kunyit bakar', 3, 'cm'], ['Cabai rawit merah', 6, 'buah'], ['Batang serai segar', 10, 'batang'], ['Garam', 1, 'sdt']],
    t: [
      'Haluskan bumbu base genep (bawang, kencur, kunyit, cabai) lalu tumis sebentar sampai harum.',
      'Campur daging ikan cincang, kelapa parut, bumbu tumis, dan garam hingga adonan liat kalis.',
      'Lilitkan adonan pada ujung batang serai segar hingga padat membulat.',
      'Panggang di atas bara api atau wajan datar hingga sate harum kekuningan matang merata.'
    ]
  },
  {
    id: 9, n: 'Ayam Betutu', p: 'Bali', k: ['Makanan Berat'],
    w: 120, l: 'Sedang', s: 5, r: 4.8, rc: 25,
    f: 'img/ayam-betutu.jpg',
    u: 'Tim FoodHub',
    c: 'Ayam kampung utuh berbalur rempah bumbu genep komplit pedas gurih, dibungkus daun pisang lalu dipanggang matang meresap.',
    b: [['Ayam kampung utuh', 1, 'ekor'], ['Bawang merah cincang', 12, 'siung'], ['Bawang putih cincang', 6, 'siung'], ['Kencur cincang', 4, 'ruas'], ['Kunyit cincang', 3, 'ruas'], ['Lengkuas cincang', 4, 'cm'], ['Cabai rawit merah iris', 15, 'buah'], ['Minyak kelapa murni', 4, 'sdm'], ['Daun pisang pembungkus', 3, 'lembar'], ['Garam', 2, 'sdt']],
    t: [
      'Campurkan bumbu cincang genep dengan minyak kelapa dan garam hingga merata.',
      'Balurkan bumbu ke seluruh bagian ayam kampung luar dan rongga dalam.',
      'Bungkus rapat ayam berbumbu dengan daun pisang berlapis.',
      'Kukus selama 45 menit lalu panggang hingga bumbu mengering harum dan daging ayam sangat empuk.'
    ]
  },
  {
    id: 10, n: 'Papeda Kuah Kuning', p: 'Papua', k: ['Makanan Berat'],
    w: 45, l: 'Sedang', s: 4, r: 4.6, rc: 16,
    f: 'img/papeda.jpg',
    u: 'Tim FoodHub',
    c: 'Papeda sagu kenyal lembut khas pesisir timur Nusantara disiram sup ikan tongkol kuah kuning beraroma kemangi dan asam jeruk nipis.',
    b: [['Tepung sagu murni', 250, 'g'], ['Ikan tongkol segar', 500, 'g'], ['Kunyit bakar', 4, 'ruas'], ['Bawang merah', 6, 'siung'], ['Bawang putih', 4, 'siung'], ['Serai memarkan', 2, 'batang'], ['Daun kemangi segar', 1, 'ikat'], ['Jeruk nipis peras', 2, 'buah'], ['Garam', 1.5, 'sdt'], ['Air mendidih', 1200, 'ml']],
    t: [
      'Larutkan sagu dengan sedikit air dingin dan perasan jeruk nipis di wadah baskom.',
      'Tuangkan air mendidih sambil diaduk cepat satu arah hingga sagu berubah bening kental elastis.',
      'Tumis bumbu halus kunyit dan serai, tambahkan air kaldu dan potongan ikan tongkol segar.',
      'Masak hingga ikan matang, masukkan daun kemangi dan jeruk nipis, sajikan bersama papeda hangat.'
    ]
  },
  {
    id: 11, n: 'Gado-Gado Betawi', p: 'DKI Jakarta', k: ['Sehat', 'Makanan Berat'],
    w: 35, l: 'Mudah', s: 3, r: 4.7, rc: 20, v: 1,
    f: 'img/gado-gado.jpg',
    u: 'Tim FoodHub',
    c: 'Salad tradisional Betawi dari aneka sayuran rebus segar, tahu tempe goreng, disiram saus kacang tanah legit gurih beraroma limau.',
    b: [['Kacang tanah goreng giling', 200, 'g'], ['Kentang kukus potong', 2, 'buah'], ['Kol iris rebus', 100, 'g'], ['Tauge rebus sebentar', 100, 'g'], ['Kacang panjang rebus', 100, 'g'], ['Tahu dan tempe goreng', 4, 'potong'], ['Telur rebus belah dua', 2, 'butir'], ['Gula merah aren', 40, 'g'], ['Air asam jawa', 2, 'sdm'], ['Jeruk limau', 2, 'buah'], ['Garam', 1, 'sdt']],
    t: [
      'Haluskan cabai, bawang putih goreng, garam, dan gula merah di atas cobek.',
      'Campur kacang tanah halus dengan air hangat dan asam jawa, uleg hingga menjadi saus kacang kental.',
      'Beri perasan jeruk limau segar pada saus kacang agar wangi.',
      'Tata sayuran rebus, tahu, tempe, dan telur rebus, siramkan saus kacang dan beri taburan emping.'
    ]
  },
  {
    id: 12, n: 'Es Cendol Dawet', p: 'Jawa Tengah', k: ['Minuman'],
    w: 40, l: 'Sedang', s: 4, r: 4.6, rc: 21, v: 1,
    f: 'img/es-cendol.jpg',
    u: 'Tim FoodHub',
    c: 'Minuman es tradisional Jawa dengan cendol pandan hijau kenyal, siraman santan gurih segar, dan kinca gula kelapa nangka wangi.',
    b: [['Tepung beras', 120, 'g'], ['Air pandan suji', 500, 'ml'], ['Santan kelapa matang', 400, 'ml'], ['Gula merah aren', 200, 'g'], ['Buah nangka matang', 50, 'g'], ['Es batu serut', 300, 'g'], ['Garam', 0.5, 'sdt']],
    t: [
      'Masak tepung beras dan air pandan sambil diaduk sampai meletup-letup kental bening.',
      'Cetak adonan cendol panas di atas wadah berisi air es.',
      'Rebus gula merah aren bersama potongan nangka harum menjadi sirup kinca manis.',
      'Sajikan cendol dalam gelas bersama sirup kinca, es batu serut, dan siraman santan gurih.'
    ]
  },
  {
    id: 13, n: 'Nasi Liwet Solo', p: 'Jawa Tengah', k: ['Makanan Berat'],
    w: 60, l: 'Sedang', s: 4, r: 4.8, rc: 27,
    f: 'img/nasi-liwet.jpg',
    u: 'Tim FoodHub',
    c: 'Nasi gurih harum berbalur santan dan rempah daun salam, disajikan hangat dengan suwiran ayam opor lembut, sayur labu siam, dan areh santan.',
    b: [['Beras pulen', 450, 'g'], ['Santan kelapa', 700, 'ml'], ['Daun salam segar', 4, 'lembar'], ['Serai memarkan', 2, 'batang'], ['Daging ayam suwir opor', 200, 'g'], ['Labu siam iris korek', 150, 'g'], ['Santan areh kental gurih', 100, 'ml'], ['Garam', 1.5, 'sdt']],
    t: [
      'Cuci beras bersih, masak bersama santan, daun salam, serai, dan garam hingga santan terserap (aron).',
      'Tutup rapat panci liwet dan masak dengan api kecil hingga nasi tanak pulen beraroma harum gurih.',
      'Masak sayur labu siam kuah santan pedas gurih untuk pendamping.',
      'Sajikan nasi liwet di pincuk daun pisang dengan suwiran ayam opor, sayur labu siam, dan areh santan kental.'
    ]
  },
  {
    id: 14, n: 'Soto Makassar', p: 'Sulawesi Selatan', k: ['Makanan Berat'],
    w: 90, l: 'Sedang', s: 5, r: 4.8, rc: 34,
    f: 'img/soto-makassar.jpg',
    u: 'Tim FoodHub',
    c: 'Sup daging sapi khas Makassar berkuah kaldu pekat gurih berbumbu rempah kacang tanah sangrai, disajikan bersama ketupat daun kelapa.',
    b: [['Daging sapi sandung lamur', 700, 'g'], ['Kacang tanah sangrai giling halus', 150, 'g'], ['Bawang merah', 10, 'siung'], ['Bawang putih', 6, 'siung'], ['Serai memarkan', 3, 'batang'], ['Lengkuas memarkan', 30, 'g'], ['Ketumbar sangrai', 1, 'sdm'], ['Jintan sangrai', 0.5, 'sdt'], ['Air tajin cucian beras', 1800, 'ml'], ['Garam', 2, 'sdt']],
    t: [
      'Rebus daging sapi dalam air tajin bersama serai dan lengkuas sampai empuk, potong dadu.',
      'Haluskan bumbu rempah lalu tumis hingga harum semerbak berminyak.',
      'Masukkan bumbu tumisan dan gilingan kacang tanah sangrai ke kuah rebusan daging.',
      'Masak hingga kuah mengental gurih berminyak. Sajikan panas bersama ketupat, irisan daun seledri, dan perasan jeruk nipis.'
    ]
  }
];


/* ==========================================================================
   Data Wilayah, Profil Daerah, Topik Forum, & Ulasan
   ========================================================================== */

/** Daftar provinsi per pulau di Indonesia */
const PROVS = [
  ['Sumatera', [
    'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau',
    'Jambi', 'Sumatera Selatan', 'Bangka Belitung', 'Bengkulu', 'Lampung'
  ]],
  ['Jawa', [
    'DKI Jakarta', 'Jawa Barat', 'Banten', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur'
  ]],
  ['Bali & Nusa Tenggara', [
    'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur'
  ]],
  ['Kalimantan', [
    'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara'
  ]],
  ['Sulawesi', [
    'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara'
  ]],
  ['Maluku', [
    'Maluku', 'Maluku Utara'
  ]],
  ['Papua', [
    'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan'
  ]]
];

/** Profil kuliner singkat tiap provinsi: [Bahan khas, Teknik utama, Hidangan khas] */
const PROF = {
  'Sumatera Barat':   ['Santan, cabai, rempah', 'Merendang & Menggulai', 'Rendang, Gulai Itiak, Sate Padang'],
  'Sumatera Selatan': ['Ikan tenggiri, sagu, cuko', 'Merebus lalu menggoreng', 'Pempek Kapal Selam'],
  'Jawa Timur':       ['Kluwek, kunyit, serai', 'Merebus kuah kaldu rempah', 'Rawon & Soto Lamongan'],
  'DI Yogyakarta':    ['Nangka muda, gula aren', 'Memasak perlahan dengan santan', 'Gudeg Jogja'],
  'Papua':            ['Sagu murni, ikan tongkol', 'Mengolah sagu jadi papeda', 'Papeda kuah kuning'],
  'Bali':             ['Ikan, kelapa parut, base genep', 'Melilit dan memanggang', 'Sate lilit & Ayam Betutu'],
  'Jawa Tengah':      ['Santan, gula merah aren, beras', 'Mengukus dan merebus santan', 'Nasi Liwet & Es Cendol'],
  'Sulawesi Selatan': ['Daging sapi, kacang tanah sangrai', 'Merebus kaldu kuah rempah pekat', 'Soto Makassar'],
  'DKI Jakarta':      ['Kacang tanah, aneka sayuran', 'Merebus dan menguleg saus kacang', 'Gado-gado Betawi']
};

/** Data awal diskusi komunitas / forum */
const TOP = [
  {
    id: 1,
    j: 'Tips agar sambal tidak cepat basi?',
    a: 'Raka P.',
    d: '2026-10-02',
    b: 'Saya sering membuat sambal dalam jumlah banyak, tetapi tiga hari sudah berubah rasa. Ada yang punya trik penyimpanan?'
  },
  {
    id: 2,
    j: 'Pengganti santan untuk rendang?',
    a: 'Nadia P.',
    d: '2026-10-09',
    b: 'Santan kental sedang mahal. Adakah alternatif yang masih terasa gurih?'
  },
  {
    id: 3,
    j: 'Menu tradisional nusantara yang hemat untuk sehari-hari',
    a: 'Dimas A.',
    d: '2026-10-20',
    b: 'Mohon rekomendasi resep masakan daerah yang bahannya mudah didapat di pasar dan ramah di kantong.'
  }
];

/** Balasan default untuk diskusi */
const REP = {
  1: [{ a: 'Nadia P.', t: 'Tumis sambal sampai minyaknya pecah, lalu simpan di toples kaca yang bersih dan kering.', d: '2026-10-03' }],
  3: [{ a: 'Raka P.',  t: 'Gado-gado Betawi dan Soto Lamongan di FoodHub cocok sekali untuk menu lezat dan hemat.', d: '2026-10-21' }]
};

/* ==========================================================================
   Helper & Utilitas Data Resep
   ========================================================================== */

/** Daftar kategori aktif */
const cats = () => ld('fh_cats', ['Makanan Berat', 'Sehat', 'Minuman']);

/** Resep yang diunggah oleh pengguna */
const urs = () => ld('fh_ur', []);

/** Gabungan resep bawaan + resep pengguna yang sudah disetujui */
const all = () => RECIPES.concat(urs().filter(r => r.st === 'disetujui'));

/** Cari resep berdasarkan ID */
const byId = id => RECIPES.concat(urs()).filter(r => String(r.id) === String(id))[0];

/** Filter bahan utama (mengabaikan bumbu/bahan dasar) */
const utama = r => r.b.filter(i => BASIC.indexOf(String(i[0]).toLowerCase()) < 0);

/** Ambil semua ulasan dari storage */
const rvAll = () => ld('fh_rv', {});

/** Hitung rata-rata rating resep */
const rat = r => {
  const v = rvAll()[r.id] || [];
  const n = (r.rc || 0) + v.length;
  if (!n) return null;
  let s = (r.r || 0) * (r.rc || 0);
  v.forEach(x => { s += x.s; });
  return { a: s / n, n };
};

/** Hasilkan teks bintang (misal '★★★★☆') */
const starTxt = a => '★'.repeat(Math.round(a)) + '☆'.repeat(5 - Math.round(a));

/** Menghasilkan nomor warna acak stabil (0-4) berdasarkan ID */
const hue = id => String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 5;

/** Format angka dengan 2 desimal maksimum dalam format Indonesia */
const fmt = n => (Math.round(n * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 });

/** Hasilkan badge tag kategori dan provinsi */
const tags = r => (r.p ? `<span class="tag r">${esc(r.p)}</span>` : '') +
  r.k.map(k => `<span class="tag">${esc(k)}</span>`).join('');

/** Hasilkan thumbnail kartu resep */
const thumb = (r, badge) => {
  const src = r.f ? (/^(https?:|data:|\/)/i.test(r.f) ? r.f : R + r.f) : '';
  return `
  <div class="thumb">
    ${badge || ''}
    ${src ? `
      <img src="${esc(src)}" alt="${esc(r.n)}" loading="lazy" referrerpolicy="no-referrer"
           onload="this.classList.add('loaded')"
           onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
      <div class="thumb-ph" style="display:none;">
        <span class="ph-txt">Foto resep</span>
      </div>
    ` : `
      <div class="thumb-ph" style="display:flex;">
        <span class="ph-txt">Foto resep</span>
      </div>
    `}
  </div>
`;
};

/** Hasilkan markup HTML kartu resep lengkap */
function card(r) {
  const t = rat(r);
  const desc = r.c ? (r.c.length > 70 ? r.c.slice(0, 70).trim() + '…' : r.c) : '';
  return `
    <a class="card" href="${R}detail-resep.html?id=${encodeURIComponent(r.id)}">
      ${thumb(r)}
      <div class="cb">
        <div class="tags">${tags(r)}</div>
        <h3>${esc(r.n)}</h3>
        ${desc ? `<p class="desc">${esc(desc)}</p>` : ''}
        <div class="meta">
          <span>${ic('clock')} ${r.w} mnt</span>
          <span>${esc(r.l)}</span>
          <span class="gold">${t ? '★ ' + t.a.toFixed(1) : 'Belum ada rating'}</span>
        </div>
      </div>
    </a>
  `;
}

/** Ambil resep dari provinsi tertentu */
const provRec = p => all().filter(r => r.p === p);

/** Ambil profil daerah */
const prof = p => PROF[p] || ['Segera dilengkapi', 'Segera dilengkapi', 'Segera dilengkapi'];

/** Box ringkasan provinsi */
const provBox = p => {
  const f = prof(p);
  return `
    <div class="panel">
      <span class="pill">Provinsi dipilih</span>
      <h2>${esc(p)}</h2>
      <p class="muted">Ringkasan kuliner ${esc(p)}: bahan khas, teknik memasak, dan hidangan khas daerah.</p>
      <div class="st4">
        <div><b>${provRec(p).length}</b><span>Jumlah resep</span></div>
        <div><b>${esc(f[0])}</b><span>Bahan khas</span></div>
        <div><b>${esc(f[1])}</b><span>Teknik utama</span></div>
        <div><b>${esc(f[2])}</b><span>Hidangan khas</span></div>
      </div>
    </div>
  `;
};

/** Grid resep per provinsi */
const provGrid = p => provRec(p).length
  ? provRec(p).map(card).join('')
  : `<p class="empty">Belum ada resep dari ${esc(p)}. <a href="${R}unggah-resep.html"><b>Unggah resep pertamanya</b></a>.</p>`;

/** Laporan topik forum */
const rps = () => {
  let r = ld('fh_rp', null);
  if (!r) {
    r = [{
      id: 's1',
      tid: 2,
      ttl: 'Pengganti santan untuk rendang?',
      by: 'Raka P.',
      why: 'Berisi tautan promosi produk.',
      d: '2026-11-05',
      st: 'baru'
    }];
    sv('fh_rp', r);
  }
  return r;
};

/** Arahkan ke halaman login dengan query parameter callback */
const goLogin = () => {
  location.href = R + 'masuk.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
};

/* ==========================================================================
   Pembangun Navigasi, Footer, Sidebar Admin & Elemen Bersama
   ========================================================================== */

/** Bangun bilah navigasi utama dan footer */
function buildNav() {
  const L = [
    ['index', 'Beranda'],
    ['daftar-resep', 'Resep'],
    ['isi-kulkas', 'Isi Kulkas'],
    ['resep-nusantara', 'Nusantara'],
    ['forum-diskusi', 'Forum']
  ];

  const cur = {
    'detail-resep': 'daftar-resep',
    'profil-kuliner-provinsi': 'resep-nusantara',
    'detail-topik': 'forum-diskusi'
  }[P] || P;

  const links = L.map(l => `
    <a href="${R}${l[0]}.html"${l[0] === cur ? ' class="on" aria-current="page"' : ''}>${l[1]}</a>
  `).join('');

  const auth = U
    ? `
      <div class="acc">
        <button class="av" id="avb" aria-haspopup="true" aria-expanded="false" aria-label="Menu akun">
          ${esc(U.name.charAt(0).toUpperCase())}
        </button>
        <div class="dd" id="dd" hidden>
          <div class="dn">${esc(U.name)}<small>${esc(U.email)}</small></div>
          <a href="${R}profil.html">Profil</a>
          <a href="${R}resep-saya.html">Resep Saya</a>
          <a href="${R}resep-favorit.html">Resep Favorit</a>
          <a href="${R}unggah-resep.html">Unggah Resep</a>
          ${U.role === 'admin' ? `<a href="${R}admin/dasbor.html">Dasbor Admin</a>` : ''}
          <button id="lo" type="button">Keluar</button>
        </div>
      </div>
    `
    : `
      <a class="btn ghost" href="${R}masuk.html">Masuk</a>
      <a class="btn" href="${R}daftar.html">Daftar</a>
    `;

  $('#nav').innerHTML = `
    <div class="container nb">
      <a class="logo" href="${R}index.html" aria-label="FoodHub, ke beranda">
        <img src="${R}img/logo-foodhub.jpg" alt="FoodHub">
      </a>
      <button class="burger" id="bg" type="button" aria-label="Buka menu" aria-expanded="false">
        ${ic('menu')}
      </button>
      <nav class="nl" id="nl" aria-label="Navigasi utama">
        ${links}
        <div class="na">${auth}</div>
      </nav>
    </div>
  `;

  $('#bg').addEventListener('click', () => {
    const o = $('#nl').classList.toggle('open');
    $('#bg').setAttribute('aria-expanded', o);
  });

  if (U) {
    const b = $('#avb');
    const d = $('#dd');

    b.addEventListener('click', e => {
      e.stopPropagation();
      d.hidden = !d.hidden;
      b.setAttribute('aria-expanded', !d.hidden);
    });

    document.addEventListener('click', e => {
      if (!d.contains(e.target)) {
        d.hidden = true;
        b.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') d.hidden = true;
    });

    $('#lo').addEventListener('click', () => {
      endSess();
      location.href = R + 'index.html';
    });
  }

  $('#foot').innerHTML = `
    <div class="container fb">
      <a href="${R}index.html">
        <img src="${R}img/logo-foodhub.jpg" alt="FoodHub">
      </a>
      <nav aria-label="Tautan footer">
        ${L.map(l => `<a href="${R}${l[0]}.html">${l[1]}</a>`).join('')}
      </nav>
      <small>© 2026 FoodHub · Pradita University</small>
    </div>
  `;
}

/** Bangun layout dashboard panel admin */
function buildAdmin() {
  const L = [
    ['dasbor', 'Dasbor', 'grid'],
    ['moderasi-resep', 'Moderasi Resep', 'check'],
    ['kelola-pengguna', 'Kelola Pengguna', 'users'],
    ['kelola-kategori', 'Kelola Kategori', 'book'],
    ['laporan-forum', 'Laporan Forum', 'flag']
  ];

  $('#side').innerHTML = `
    <a class="logo" href="dasbor.html" aria-label="Dasbor FoodHub">
      <img src="${R}img/logo-foodhub.jpg" alt="FoodHub">
    </a>
    ${L.map(l => `
      <a href="${l[0]}.html"${l[0] === P ? ' class="on" aria-current="page"' : ''}>
        ${ic(l[2])} ${l[1]}
      </a>
    `).join('')}
    <a class="sp" href="${R}index.html">
      ${ic('home' in IC ? 'home' : 'bowl')} Lihat situs
    </a>
    <button type="button" id="alo">
      ${ic('logout')} Keluar
    </button>
  `;

  $('#top').innerHTML = `
    <button class="btn ghost sm sb" id="sbt" type="button" aria-label="Buka menu admin">
      ${ic('menu')}
    </button>
    <strong>Panel Admin</strong>
    <span class="muted">${esc(U.name)}</span>
  `;

  $('#sbt').addEventListener('click', () => $('#side').classList.toggle('open'));
  $('#alo').addEventListener('click', () => {
    endSess();
    location.href = R + 'index.html';
  });
}

/** Bangun tab navigasi profil / resep favorit / resep saya */
function buildTabs() {
  const t = $('#tabs');
  if (!t) return;

  const L = [
    ['profil', 'Profil'],
    ['resep-favorit', 'Resep Favorit'],
    ['resep-saya', 'Resep Saya']
  ];

  t.className = 'tabs';
  t.innerHTML = L.map(l => `
    <a class="chip${l[0] === P ? ' on' : ''}" href="${l[0]}.html">${l[1]}</a>
  `).join('') + `
    <a class="btn sm" href="unggah-resep.html">
      ${ic('plus')} Unggah Resep
    </a>
  `;
}

/** Tampilkan bar status / pesan kesalahan atau sukses */
const bar = (el, m, ok) => {
  el.className = ok ? 'ok' : 'err';
  el.textContent = m;
  el.hidden = false;
};

/** Tampilkan array string sebagai list HTML */
const list = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;


/* ==========================================================================
   Handler Halaman (Page Logics)
   ========================================================================== */

const PG = {
  /** Halaman Beranda (index) */
  index() {
    $('#cats').innerHTML = '<a class="chip on" href="daftar-resep.html">Semua</a>' +
      cats().map(c => `<a class="chip" href="daftar-resep.html?kat=${encodeURIComponent(c)}">${esc(c)}</a>`).join('');

    const top = all()
      .slice()
      .sort((x, y) => ((rat(y) || { a: 0 }).a) - ((rat(x) || { a: 0 }).a))
      .slice(0, 4);

    $('#pop').innerHTML = top.map(card).join('');

    $('#heroForm').addEventListener('submit', e => {
      e.preventDefault();
      location.href = 'daftar-resep.html?q=' + encodeURIComponent($('#q').value.trim());
    });
  },

  /** Halaman Daftar Resep & Pencarian / Filter */
  'daftar-resep'() {
    const f = {
      q: $('#fq'),
      k: $('#fk'),
      w: $('#fw'),
      l: $('#fl')
    };

    f.k.innerHTML = '<option value="">Semua kategori</option>' +
      cats().map(c => `<option>${esc(c)}</option>`).join('');

    f.q.value = qs.get('q') || '';
    f.k.value = qs.get('kat') || '';

    const run = () => {
      const q = f.q.value.trim().toLowerCase();
      const w = +f.w.value;

      const L = all().filter(r =>
        (!q || (r.n + ' ' + r.p + ' ' + r.b.map(i => i[0]).join(' ')).toLowerCase().includes(q)) &&
        (!f.k.value || r.k.includes(f.k.value)) &&
        (!w || (w === 999 ? r.w > 60 : r.w <= w)) &&
        (!f.l.value || r.l === f.l.value)
      );

      $('#cnt').textContent = L.length + ' resep ditemukan';
      $('#rl').innerHTML = L.length
        ? L.map(card).join('')
        : '<p class="empty">Tidak ada resep yang cocok. Ubah kata kunci atau longgarkan filter.</p>';
    };

    Object.values(f).forEach(e => e.addEventListener('input', run));

    $('#fr').addEventListener('click', () => {
      f.q.value = '';
      f.k.value = '';
      f.w.value = '0';
      f.l.value = '';
      run();
    });

    run();
  },

  /** Halaman Detail Resep & Ulasan */
  'detail-resep'() {
    const r = byId(qs.get('id'));
    const box = $('#dr');

    if (!r || (r.st && r.st !== 'disetujui' && !(U && (U.email === r.o || U.role === 'admin')))) {
      box.innerHTML = `
        <div class="empty">
          <h2>Resep tidak ditemukan</h2>
          <p>Resep ini tidak ada atau belum disetujui admin.</p>
          <a class="btn" href="daftar-resep.html">Lihat semua resep</a>
        </div>
      `;
      return;
    }

    document.title = r.n + ' | FoodHub';
    let sv_ = r.s;

    box.innerHTML = `
      <div class="crumb"><a href="index.html">Beranda</a> / <a href="daftar-resep.html">Resep</a> / ${esc(r.n)}</div>
      <div class="dhead">
        ${thumb(r)}
        <div>
          <div class="tags">${tags(r)}</div>
          <h1>${esc(r.n)}</h1>
          <p class="muted">Oleh ${esc(r.u || 'Tim FoodHub')}</p>
          <div class="tiles">
            <div class="tile"><b>${r.w} mnt</b><span>Waktu</span></div>
            <div class="tile"><b>${esc(r.l)}</b><span>Tingkat</span></div>
            <div class="tile"><b id="pt">${r.s}</b><span>Porsi</span></div>
            <div class="tile"><b id="rt"></b><span>Rating</span></div>
          </div>
          <div class="chips">
            <button class="btn" id="fv" type="button"></button>
            <button class="btn ghost" id="sh" type="button">${ic('share')} Bagikan</button>
          </div>
        </div>
      </div>
      <div class="dbody">
        <div>
          <div class="panel">
            <div class="sec-h">
              <h2>Bahan-bahan</h2>
              <div class="stepper">
                <button type="button" id="mn" aria-label="Kurangi porsi">${ic('minus')}</button>
                <b id="sv">${r.s}</b>
                <button type="button" id="pl" aria-label="Tambah porsi">${ic('plus')}</button>
              </div>
            </div>
            <ul class="ing" id="ig">
              ${r.b.map((i, x) => `
                <li>
                  <input type="checkbox" id="b${x}">
                  <label for="b${x}">${esc(i[0])}</label>
                  <span class="am" data-i="${x}"></span>
                </li>
              `).join('')}
            </ul>
            <div class="story">
              <h3>Cerita di balik resep</h3>
              <p>${esc(r.c)}</p>
            </div>
          </div>
        </div>
        <div class="panel">
          <h2>Langkah memasak</h2>
          <ol class="steps">
            ${r.t.map(s => `<li><span>${esc(s)}</span></li>`).join('')}
          </ol>
          <h2>Ulasan dan rating</h2>
          <div id="rf"></div>
          <div id="rl"></div>
        </div>
      </div>
    `;

    const amounts = () => {
      $$('.am').forEach(e => {
        const i = r.b[+e.dataset.i];
        e.textContent = fmt(i[1] * sv_ / r.s) + ' ' + i[2];
      });
      $('#sv').textContent = sv_;
      $('#pt').textContent = sv_;
    };
    amounts();

    $('#mn').addEventListener('click', () => {
      if (sv_ > 1) {
        sv_--;
        amounts();
      }
    });

    $('#pl').addEventListener('click', () => {
      if (sv_ < 50) {
        sv_++;
        amounts();
      }
    });

    const isFav = () => U && (U.fav || []).map(String).includes(String(r.id));
    const favBtn = () => {
      $('#fv').innerHTML = `${ic('heart')} ${isFav() ? 'Tersimpan' : 'Simpan'}`;
      $('#fv').setAttribute('aria-pressed', !!isFav());
    };
    favBtn();

    $('#fv').addEventListener('click', () => {
      if (!U) {
        goLogin();
        return;
      }
      const us = users();
      const x = us.filter(u => u.email === U.email)[0];
      x.fav = x.fav || [];
      const i = x.fav.map(String).indexOf(String(r.id));
      if (i < 0) {
        x.fav.push(r.id);
      } else {
        x.fav.splice(i, 1);
      }
      sv('fh_users', us);
      U = me();
      favBtn();
      toast(i < 0 ? 'Resep disimpan ke favorit.' : 'Resep dihapus dari favorit.');
    });

    $('#sh').addEventListener('click', () => {
      const url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          () => toast('Tautan resep disalin.'),
          () => prompt('Salin tautan:', url)
        );
      } else {
        prompt('Salin tautan:', url);
      }
    });

    const draw = () => {
      const t = rat(r);
      $('#rt').textContent = t ? '★ ' + t.a.toFixed(1) : '-';
      const v = rvAll()[r.id] || [];
      $('#rl').innerHTML = v.length
        ? v.slice().reverse().map(x => `
            <div class="rv">
              <b>${esc(x.u)}</b>
              <span class="gold">${starTxt(x.s)}</span>
              <p>${esc(x.t)}</p>
            </div>
          `).join('')
        : '<p class="muted">Belum ada ulasan. Jadilah yang pertama.</p>';
    };
    draw();

    let val = 0;
    if (!U) {
      $('#rf').innerHTML = `
        <p class="muted">Masuk sebagai member untuk memberi rating dan menulis ulasan.</p>
        <a class="btn sm" href="masuk.html?next=${encodeURIComponent('detail-resep.html' + location.search)}">Masuk</a>
      `;
    } else {
      $('#rf').innerHTML = `
        <div class="fld">
          <label id="rlb">Rating Anda</label>
          <div class="stars" role="group" aria-labelledby="rlb">
            ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-v="${n}" aria-label="${n} bintang">★</button>`).join('')}
          </div>
        </div>
        <div class="fld">
          <label for="rtx">Ulasan</label>
          <textarea id="rtx" placeholder="Bagikan pengalaman memasak resep ini"></textarea>
        </div>
        <div class="err" id="re" hidden></div>
        <button class="btn" id="rs" type="button">Kirim ulasan</button>
      `;

      $$('.stars button').forEach(b => b.addEventListener('click', () => {
        val = +b.dataset.v;
        $$('.stars button').forEach(x => x.classList.toggle('on', +x.dataset.v <= val));
      }));

      $('#rs').addEventListener('click', () => {
        const t = $('#rtx').value.trim();
        if (!val) {
          bar($('#re'), 'Pilih jumlah bintang terlebih dahulu.');
          return;
        }
        if (t.length < 5) {
          bar($('#re'), 'Ulasan minimal 5 karakter.');
          return;
        }
        const a = rvAll();
        (a[r.id] = a[r.id] || []).push({ u: U.name, s: val, t, d: today() });
        sv('fh_rv', a);

        $('#rtx').value = '';
        val = 0;
        $$('.stars button').forEach(x => x.classList.remove('on'));
        $('#re').hidden = true;
        draw();
        toast('Ulasan terkirim.');
      });
    }
  },

  /** Halaman Isi Kulkas (Pencocokan bahan yang dimiliki) */
  'isi-kulkas'() {
    const have = [];
    const norm = s => s.toLowerCase().trim();
    const hit = (b, u) => {
      b = norm(b);
      return b.includes(u) || u.includes(b);
    };

    const ci = $('#ki');
    const chipBox = $('#kc');
    const res = $('#kr');
    const SUG = ['Daging sapi', 'Ayam kampung', 'Santan', 'Bawang merah', 'Cabai merah', 'Kunyit'];

    $('#ks').innerHTML = SUG.map(s => `
      <button type="button" class="chip" data-s="${esc(s)}">${ic('plus')} ${esc(s)}</button>
    `).join('');

    const drawChips = () => {
      chipBox.innerHTML = have.map((h, i) => `
        <span class="chip on">
          ${esc(h)}
          <button type="button" data-x="${i}" aria-label="Hapus ${esc(h)}">${ic('x')}</button>
        </span>
      `).join('');
    };

    const add = v => {
      v = norm(v).replace(/,+$/, '');
      if (!v) return;
      if (v.length < 3) {
        toast('Nama bahan minimal 3 huruf.');
        return;
      }
      if (have.includes(v)) {
        toast('Bahan sudah ditambahkan.');
        return;
      }
      have.push(v);
      ci.value = '';
      drawChips();
      run();
    };

    const run = () => {
      if (!have.length) {
        res.innerHTML = '<p class="empty">Tambahkan minimal satu bahan untuk melihat rekomendasi resep.</p>';
        return;
      }

      let L = all().map(r => {
        const u = utama(r);
        const got = u.filter(i => have.some(h => hit(i[0], h)));
        return {
          r,
          p: Math.round(got.length / u.length * 100),
          miss: u.filter(i => !got.includes(i))
        };
      }).filter(x => x.p > 0);

      if ($('#fk2').checked) L = L.filter(x => x.miss.length <= 2);
      if ($('#fw2').checked) L = L.filter(x => x.r.w <= 30);
      if ($('#fv2').checked) L = L.filter(x => x.r.v);

      L.sort((a, b) => b.p - a.p || a.r.w - b.r.w);

      res.innerHTML = L.length
        ? `
          <h2 class="sec-h">Ditemukan ${L.length} resep untukmu</h2>
          <div class="grid">
            ${L.map(x => `
              <a class="card" href="detail-resep.html?id=${encodeURIComponent(x.r.id)}">
                ${thumb(x.r, `<span class="badge-p">${x.p}% cocok</span>`)}
                <div class="cb">
                  <div class="tags">${tags(x.r)}</div>
                  <h3>${esc(x.r.n)}</h3>
                  <div class="bar" role="img" aria-label="Kecocokan ${x.p} persen">
                    <i style="width:${x.p}%"></i>
                  </div>
                  <p class="sm" style="margin:0">
                    ${x.miss.length ? 'Bahan kurang: ' + esc(x.miss.map(i => i[0]).join(', ')) : 'Semua bahan utama sudah ada'} · ${x.r.w} mnt
                  </p>
                </div>
              </a>
            `).join('')}
          </div>
        `
        : '<p class="empty">Belum ada resep yang cocok. Coba tambah bahan lain atau matikan filter.</p>';
    };

    ci.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        add(ci.value);
      }
    });

    $('#kt').addEventListener('click', () => add(ci.value));
    $('#ks').addEventListener('click', e => {
      const b = e.target.closest('[data-s]');
      if (b) add(b.dataset.s);
    });

    chipBox.addEventListener('click', e => {
      const b = e.target.closest('[data-x]');
      if (b) {
        have.splice(+b.dataset.x, 1);
        drawChips();
        run();
      }
    });

    $('#kf').addEventListener('submit', e => {
      e.preventDefault();
      if (ci.value.trim()) add(ci.value);
      run();
    });

    $$('.opt input').forEach(i => i.addEventListener('change', run));
    run();
  },

  /** Halaman Resep Nusantara (Peta / filter 38 provinsi) */
  'resep-nusantara'() {
    const map = $('#mp');
    let sel = '';

    map.innerHTML = PROVS.map(g => `
      <div class="rg">
        <h3>${esc(g[0])}</h3>
        <div class="pb">
          ${g[1].map(p => {
            const n = provRec(p).length;
            return `
              <button type="button" class="pbn${n ? ' has' : ''}" data-p="${esc(p)}" aria-pressed="false">
                ${esc(p)}${n ? `<b>${n}</b>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');

    const pick = p => {
      sel = p;
      $$('.pbn').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === p));
      $('#pv').innerHTML = provBox(p) + `
        <p><a class="btn sm" href="profil-kuliner-provinsi.html?p=${encodeURIComponent(p)}">Lihat profil lengkap</a></p>
      `;
      $('#pr').innerHTML = provGrid(p);
    };

    map.addEventListener('click', e => {
      const b = e.target.closest('.pbn');
      if (b) pick(b.dataset.p);
    });

    $('#ps').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      $$('.pbn').forEach(b => {
        const p = b.dataset.p;
        b.hidden = !!q && !(p.toLowerCase().includes(q) || provRec(p).some(r => r.n.toLowerCase().includes(q)));
      });
      $$('.rg').forEach(g => {
        g.hidden = !$$('.pbn', g).some(b => !b.hidden);
      });
    });

    const init = qs.get('p');
    pick(PROVS.some(g => g[1].includes(init)) ? init : 'Sumatera Barat');
  },

  /** Halaman Profil Lengkap Kuliner Provinsi */
  'profil-kuliner-provinsi'() {
    const p = qs.get('p');
    const box = $('#pk');

    if (!PROVS.some(g => g[1].includes(p))) {
      box.innerHTML = `
        <div class="empty">
          <h2>Provinsi tidak ditemukan</h2>
          <a class="btn" href="resep-nusantara.html">Kembali ke peta Nusantara</a>
        </div>
      `;
      return;
    }

    document.title = 'Kuliner ' + p + ' | FoodHub';
    box.innerHTML = `
      <div class="crumb"><a href="resep-nusantara.html">Resep Nusantara</a> / ${esc(p)}</div>
      ${provBox(p)}
      <div class="sec-h" style="margin-top:2rem">
        <h2>Masakan khas ${esc(p)}</h2>
      </div>
      <div class="grid">${provGrid(p)}</div>
    `;
  },

  /** Halaman Daftar Forum Diskusi */
  'forum-diskusi'() {
    const topics = () => ld('fh_tp', []).slice().reverse().concat(TOP);
    const cnt = id => (REP[id] || []).length + (ld('fh_rep', {})[id] || []).length;

    const draw = () => {
      $('#tl').innerHTML = topics().map(t => `
        <a class="topic" href="detail-topik.html?id=${encodeURIComponent(t.id)}">
          <h3>${esc(t.j)}</h3>
          <p class="muted">${esc(t.b.length > 120 ? t.b.slice(0, 120) + '…' : t.b)}</p>
          <small class="muted">${esc(t.a)} · ${esc(t.d)} · ${cnt(t.id)} balasan</small>
        </a>
      `).join('');
    };
    draw();

    $('#nt').addEventListener('click', () => {
      $('#tf').hidden = !$('#tf').hidden;
    });

    $('#tf').addEventListener('submit', e => {
      e.preventDefault();
      const j = $('#tj').value.trim();
      const b = $('#tb').value.trim();
      const E = [];

      if (j.length < 5) E.push('Judul topik minimal 5 karakter.');
      if (b.length < 10) E.push('Isi topik minimal 10 karakter.');

      if (E.length) {
        $('#te').innerHTML = list(E);
        $('#te').hidden = false;
        return;
      }

      const a = ld('fh_tp', []);
      a.push({ id: 't' + Date.now(), j, a: U.name, d: today(), b });
      sv('fh_tp', a);

      $('#tf').reset();
      $('#te').hidden = true;
      $('#tf').hidden = true;
      draw();
      toast('Topik berhasil dibuat.');
    });
  },

  /** Halaman Detail Topik Forum & Balasan */
  'detail-topik'() {
    const id = qs.get('id');
    const box = $('#tp');
    const t = TOP.concat(ld('fh_tp', [])).filter(x => String(x.id) === id)[0];

    if (!t) {
      box.innerHTML = `
        <div class="empty">
          <h2>Topik tidak ditemukan</h2>
          <a class="btn" href="forum-diskusi.html">Kembali ke forum</a>
        </div>
      `;
      return;
    }

    document.title = t.j + ' | FoodHub';
    const reps = () => (REP[t.id] || []).concat(ld('fh_rep', {})[t.id] || []);

    const draw = () => {
      box.innerHTML = `
        <div class="crumb"><a href="forum-diskusi.html">Forum</a> / Topik</div>
        <div class="panel">
          <h1 style="font-size:2rem">${esc(t.j)}</h1>
          <p class="muted">${esc(t.a)} · ${esc(t.d)}</p>
          <p>${esc(t.b)}</p>
          <button class="btn ghost sm" type="button" data-rp="topik">${ic('flag')} Laporkan</button>
        </div>
        <h2 style="margin-top:2rem">${reps().length} balasan</h2>
        ${reps().map(x => `
          <div class="panel" style="margin-bottom:.8rem">
            <b>${esc(x.a)}</b> <span class="muted sm">${esc(x.d)}</span>
            <p>${esc(x.t)}</p>
            <button class="btn ghost sm" type="button" data-rp="balasan">${ic('flag')} Laporkan</button>
          </div>
        `).join('') || '<p class="muted">Belum ada balasan.</p>'}
        <form class="formbox" id="rf" novalidate style="margin-top:1.5rem">
          <div class="err" id="re" hidden></div>
          <div class="fld">
            <label for="rt">Balasan Anda</label>
            <textarea id="rt" required></textarea>
          </div>
          <button class="btn" type="submit">${ic('send')} Kirim balasan</button>
        </form>
      `;

      $('#rf').addEventListener('submit', e => {
        e.preventDefault();
        const v = $('#rt').value.trim();
        if (v.length < 5) {
          bar($('#re'), 'Balasan minimal 5 karakter.');
          return;
        }
        const a = ld('fh_rep', {});
        (a[t.id] = a[t.id] || []).push({ a: U.name, t: v, d: today() });
        sv('fh_rep', a);
        draw();
        toast('Balasan terkirim.');
      });

      $$('[data-rp]', box).forEach(b => b.addEventListener('click', () => {
        const why = prompt('Alasan melaporkan ' + b.dataset.rp + ' ini:');
        if (why === null) return;
        if (why.trim().length < 5) {
          toast('Alasan minimal 5 karakter.');
          return;
        }
        const r = rps();
        r.push({
          id: 'r' + Date.now(),
          tid: t.id,
          ttl: t.j,
          by: U.name,
          why: why.trim(),
          d: today(),
          st: 'baru'
        });
        sv('fh_rp', r);
        toast('Laporan terkirim ke admin.');
      }));
    };
    draw();
  },

  /** Halaman Formulir Unggah & Edit Resep */
  'unggah-resep'() {
    const ed = qs.get('edit');
    const old = ed ? byId(ed) : null;
    const f = $('#uf');

    if (ed && (!old || old.o !== U.email)) {
      f.outerHTML = `
        <div class="empty">
          <h2>Resep tidak ditemukan</h2>
          <p>Resep tidak ada atau bukan milik Anda.</p>
          <a class="btn" href="resep-saya.html">Resep Saya</a>
        </div>
      `;
      return;
    }

    const E = f.elements;
    let foto = old ? old.f || '' : '';

    E.kt.innerHTML = cats().map(c => `<option>${esc(c)}</option>`).join('');
    E.pv.innerHTML = '<option value="">Bukan masakan daerah</option>' +
      PROVS.reduce((a, g) => a.concat(g[1]), []).map(p => `<option>${esc(p)}</option>`).join('');

    if (old) {
      $('#ut').textContent = 'Ubah Resep';
      E.nm.value = old.n;
      E.pv.value = old.p;
      E.kt.value = old.k[0] || '';
      E.wk.value = old.w;
      E.lv.value = old.l;
      E.sj.value = old.s;
      E.cr.value = old.c;
      E.bh.value = old.b.map(i => i.join(', ')).join('\n');
      E.lg.value = old.t.join('\n');
      if (foto) {
        const srcFoto = /^(https?:|data:|\/)/i.test(foto) ? foto : R + foto;
        $('#pvw').innerHTML = `<img src="${esc(srcFoto)}" alt="Foto saat ini" style="max-height:140px;border-radius:12px">`;
      }
    }

    E.ft.addEventListener('change', () => {
      const fl = E.ft.files[0];
      if (!fl) return;
      if (!/^image\//.test(fl.type)) {
        toast('File harus berupa gambar.');
        E.ft.value = '';
        return;
      }
      if (fl.size > 250000) {
        toast('Foto maksimal 250 KB untuk versi demo.');
        E.ft.value = '';
        return;
      }
      const rd = new FileReader();
      rd.onload = () => {
        foto = rd.result;
        $('#pvw').innerHTML = `<img src="${foto}" alt="Pratinjau foto" style="max-height:140px;border-radius:12px">`;
      };
      rd.readAsDataURL(fl);
    });

    f.addEventListener('submit', e => {
      e.preventDefault();
      const g = n => E[n].value.trim();
      const Er = [];
      const w = +g('wk');
      const s = +g('sj');

      if (g('nm').length < 3) Er.push('Nama resep minimal 3 karakter.');
      if (!(w >= 1 && w <= 1440)) Er.push('Waktu memasak harus antara 1 dan 1440 menit.');
      if (!(s >= 1 && s <= 50)) Er.push('Jumlah porsi harus antara 1 dan 50.');
      if (g('cr').length < 20) Er.push('Cerita resep minimal 20 karakter.');

      const bh = g('bh').split('\n').map(x => x.trim()).filter(Boolean).map(x => x.split(',').map(y => y.trim()));
      if (bh.length < 2 || bh.some(x => x.length < 3 || !x[0] || !(Number(x[1].replace(',', '.')) > 0) || !x[2])) {
        Er.push('Isi minimal 2 bahan, satu per baris, dengan format: nama, jumlah, satuan (contoh: Telur, 4, butir).');
      }

      const lg = g('lg').split('\n').map(x => x.trim()).filter(Boolean);
      if (lg.length < 2) Er.push('Isi minimal 2 langkah memasak, satu langkah per baris.');

      const eb = $('#ue');
      if (Er.length) {
        eb.innerHTML = list(Er);
        eb.hidden = false;
        eb.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const rec = {
        id: old ? old.id : 'u' + Date.now(),
        n: g('nm'),
        p: g('pv'),
        k: [g('kt')],
        w,
        l: g('lv'),
        s,
        c: g('cr'),
        b: bh.map(x => [x[0], Number(x[1].replace(',', '.')), x.slice(2).join(', ')]),
        t: lg,
        f: foto,
        o: U.email,
        u: U.name,
        st: 'menunggu',
        r: old ? old.r : 0,
        rc: old ? old.rc : 0
      };

      const a = urs();
      if (old) {
        a[a.findIndex(x => String(x.id) === String(old.id))] = rec;
      } else {
        a.push(rec);
      }
      sv('fh_ur', a);
      location.href = 'resep-saya.html?' + (old ? 'edit=1' : 'baru=1');
    });
  },

  /** Halaman Profil Akun Pengguna */
  profil() {
    const fav = (U.fav || []).length;
    const mine = urs().filter(r => r.o === U.email).length;

    $('#pf').innerHTML = `
      <div class="panel">
        <div class="row" style="border:0;padding:0;box-shadow:none">
          <span class="av" style="display:grid;place-items:center;width:64px;height:64px;font-size:1.6rem">
            ${esc(U.name.charAt(0).toUpperCase())}
          </span>
          <div class="grow">
            <h2 style="margin:0">${esc(U.name)}</h2>
            <span class="muted">${esc(U.email)} · ${U.role === 'admin' ? 'Admin' : 'Member'} · bergabung ${esc(U.at || '-')}</span>
          </div>
        </div>
        <div class="stat" style="margin-top:1.2rem">
          <div class="panel"><b>${fav}</b>Resep favorit</div>
          <div class="panel"><b>${mine}</b>Resep diunggah</div>
        </div>
        <form id="nf" novalidate>
          <div class="ok" id="no" hidden></div>
          <div class="err" id="ne" hidden></div>
          <div class="fld">
            <label for="nn">Nama tampilan</label>
            <input id="nn" value="${esc(U.name)}" maxlength="40">
          </div>
          <button class="btn" type="submit">Simpan perubahan</button>
        </form>
      </div>
    `;

    $('#nf').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#nn').value.trim();
      $('#no').hidden = true;
      if (v.length < 3) {
        bar($('#ne'), 'Nama minimal 3 karakter.');
        return;
      }
      const us = users();
      us.filter(u => u.email === U.email)[0].name = v;
      sv('fh_users', us);
      U = me();
      $('#ne').hidden = true;
      bar($('#no'), 'Perubahan tersimpan.', true);
      buildNav();
    });
  },

  /** Halaman Resep Favorit Pengguna */
  'resep-favorit'() {
    const draw = () => {
      const L = (U.fav || []).map(byId).filter(Boolean);
      $('#pf').innerHTML = L.length
        ? `<div class="grid">${L.map(r => `
            <div>
              ${card(r)}
              <button class="btn danger sm" type="button" data-u="${esc(r.id)}" style="margin-top:.6rem">
                ${ic('heart')} Hapus dari favorit
              </button>
            </div>
          `).join('')}</div>`
        : '<p class="empty">Belum ada resep favorit. Buka detail resep lalu tekan Simpan.<br><br><a class="btn" href="daftar-resep.html">Cari resep</a></p>';
    };
    draw();

    $('#pf').addEventListener('click', e => {
      const b = e.target.closest('[data-u]');
      if (!b) return;
      const us = users();
      const x = us.filter(u => u.email === U.email)[0];
      x.fav = (x.fav || []).filter(i => String(i) !== b.dataset.u);
      sv('fh_users', us);
      U = me();
      draw();
      toast('Dihapus dari favorit.');
    });
  },

  /** Halaman Resep yang Diunggah Pengguna Sendiri */
  'resep-saya'() {
    const m = qs.get('baru')
      ? 'Resep berhasil dikirim. Menunggu persetujuan admin sebelum tampil di Daftar Resep.'
      : qs.get('edit')
        ? 'Resep diperbarui dan menunggu moderasi ulang.'
        : '';

    const draw = () => {
      const L = urs().filter(r => r.o === U.email);
      $('#pf').innerHTML = (m ? `<div class="ok">${esc(m)}</div>` : '') +
        (L.length
          ? L.map(r => `
            <div class="row">
              <div class="grow">
                <h3 style="margin:0">${esc(r.n)}</h3>
                <span class="muted sm">${esc(r.p || 'Umum')} · ${r.w} mnt · ${esc(r.l)}</span>
              </div>
              <span class="sts ${esc(r.st)}">${esc(r.st)}</span>
              <a class="btn ghost sm" href="detail-resep.html?id=${encodeURIComponent(r.id)}">Lihat</a>
              <a class="btn ghost sm" href="unggah-resep.html?edit=${encodeURIComponent(r.id)}">${ic('edit')} Edit</a>
              <button class="btn danger sm" type="button" data-d="${esc(r.id)}">${ic('trash')} Hapus</button>
            </div>
          `).join('')
          : '<p class="empty">Anda belum mengunggah resep.<br><br><a class="btn" href="unggah-resep.html">Unggah resep pertama</a></p>');
    };
    draw();

    $('#pf').addEventListener('click', e => {
      const b = e.target.closest('[data-d]');
      if (!b || !confirm('Hapus resep ini secara permanen?')) return;
      sv('fh_ur', urs().filter(r => String(r.id) !== b.dataset.d));
      draw();
      toast('Resep dihapus.');
    });
  },

  /** Halaman Masuk / Login */
  masuk() {
    if (U) {
      location.replace('profil.html');
      return;
    }

    $('#lf').addEventListener('submit', e => {
      e.preventDefault();
      const em = $('#em').value.trim().toLowerCase();
      const pw = $('#pw').value;
      const er = $('#er');

      if (!em || !pw) {
        bar(er, 'Email dan kata sandi wajib diisi.');
        return;
      }

      const u = users().filter(x => x.email === em && x.pass === pw)[0];
      if (!u) {
        bar(er, 'Email atau kata sandi salah.');
        return;
      }

      setSess(u, $('#ing').checked);
      const nx = qs.get('next');
      location.href = nx && /^(admin\/)?[a-z-]+\.html(\?[\w=&%.\-]*)?$/i.test(nx)
        ? nx
        : (u.role === 'admin' ? 'admin/dasbor.html' : 'index.html');
    });
  },

  /** Halaman Registrasi Pengguna Baru */
  daftar() {
    if (U) {
      location.replace('profil.html');
      return;
    }

    $('#df').addEventListener('submit', e => {
      e.preventDefault();
      const nm = $('#dn').value.trim();
      const em = $('#de').value.trim().toLowerCase();
      const pw = $('#dp').value;
      const Er = [];

      if (nm.length < 3) Er.push('Nama minimal 3 karakter.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) Er.push('Format email tidak valid.');
      if (pw.length < 8) Er.push('Kata sandi minimal 8 karakter.');
      if (pw !== $('#dk').value) Er.push('Konfirmasi kata sandi tidak sama.');
      if (!$('#ds').checked) Er.push('Centang persetujuan syarat penggunaan.');

      const us = users();
      if (us.some(x => x.email === em)) Er.push('Email sudah terdaftar. Silakan masuk.');

      if (Er.length) {
        $('#er').innerHTML = list(Er);
        $('#er').hidden = false;
        return;
      }

      const u = { name: nm, email: em, pass: pw, role: 'member', fav: [], at: today() };
      us.push(u);
      sv('fh_users', us);
      setSess(u, false);
      location.href = 'index.html';
    });
  },

  /* ========================================================================
     Handler Panel Admin
     ======================================================================== */

  /** Halaman Dasbor Admin */
  dasbor() {
    const ur = urs();
    const wait = ur.filter(r => r.st === 'menunggu');

    $('#ds').innerHTML = `
      <div class="stat">
        <div class="panel"><b>${all().length}</b>Resep tayang</div>
        <div class="panel"><b>${wait.length}</b>Menunggu moderasi</div>
        <div class="panel"><b>${users().length}</b>Pengguna</div>
        <div class="panel"><b>${rps().filter(x => x.st === 'baru').length}</b>Laporan baru</div>
      </div>
      <h2>Antrean terbaru</h2>
      ${wait.length
        ? wait.slice(0, 5).map(r => `
          <div class="row">
            <div class="grow">
              <b>${esc(r.n)}</b><br>
              <span class="muted sm">oleh ${esc(r.u)}</span>
            </div>
            <a class="btn sm" href="moderasi-resep.html">Tinjau</a>
          </div>
        `).join('')
        : '<p class="empty">Antrean kosong. Semua resep sudah dimoderasi.</p>'}
    `;
  },

  /** Halaman Moderasi Resep Baru */
  'moderasi-resep'() {
    const set = (id, st) => {
      const a = urs();
      a.forEach(r => {
        if (String(r.id) === String(id)) r.st = st;
      });
      sv('fh_ur', a);
      draw();
      toast(st === 'disetujui' ? 'Resep disetujui.' : 'Resep ditolak.');
    };

    const draw = () => {
      const a = urs();
      const w = a.filter(r => r.st === 'menunggu');
      const o = a.filter(r => r.st !== 'menunggu');

      $('#md').innerHTML = `
        <h2>Antrean moderasi (${w.length})</h2>
        ${w.length
          ? w.map(r => `
            <div class="row">
              <div class="grow">
                <b>${esc(r.n)}</b><br>
                <span class="muted sm">oleh ${esc(r.u)} · ${esc(r.p || 'Umum')} · ${r.b.length} bahan, ${r.t.length} langkah</span>
              </div>
              <a class="btn ghost sm" href="${R}detail-resep.html?id=${encodeURIComponent(r.id)}">Pratinjau</a>
              <button class="btn sm" type="button" data-a="disetujui" data-i="${esc(r.id)}">${ic('check')} Setujui</button>
              <button class="btn danger sm" type="button" data-a="ditolak" data-i="${esc(r.id)}">${ic('x')} Tolak</button>
            </div>
          `).join('')
          : '<p class="empty">Tidak ada resep yang menunggu.</p>'}
        <h2 style="margin-top:2rem">Riwayat</h2>
        ${o.length
          ? `
            <div class="tw">
              <table>
                <thead>
                  <tr>
                    <th>Resep</th>
                    <th>Pengunggah</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${o.map(r => `
                    <tr>
                      <td>${esc(r.n)}</td>
                      <td>${esc(r.u)}</td>
                      <td><span class="sts ${esc(r.st)}">${esc(r.st)}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `
          : '<p class="muted">Belum ada riwayat.</p>'}
      `;
    };

    $('#md').addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (b) set(b.dataset.i, b.dataset.a);
    });

    draw();
  },

  /** Halaman Kelola Akun Pengguna */
  'kelola-pengguna'() {
    const draw = () => {
      $('#us').innerHTML = `
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Peran</th>
                <th>Bergabung</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${users().map(u => `
                <tr>
                  <td>${esc(u.name)}</td>
                  <td>${esc(u.email)}</td>
                  <td><span class="sts ${u.role === 'admin' ? 'admin' : 'selesai'}">${esc(u.role)}</span></td>
                  <td>${esc(u.at || '-')}</td>
                  <td>
                    ${u.role === 'admin'
                      ? '<span class="muted sm">Tidak dapat dihapus</span>'
                      : `<button class="btn danger sm" type="button" data-e="${esc(u.email)}">${ic('trash')} Hapus</button>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    $('#us').addEventListener('click', e => {
      const b = e.target.closest('[data-e]');
      if (!b || !confirm('Hapus pengguna ' + b.dataset.e + '?')) return;
      sv('fh_users', users().filter(u => u.email !== b.dataset.e));
      draw();
      toast('Pengguna dihapus.');
    });

    draw();
  },

  /** Halaman Kelola Kategori Resep */
  'kelola-kategori'() {
    const draw = () => {
      $('#kl').innerHTML = cats().map((c, i) => `
        <div class="row">
          <b class="grow">${esc(c)}</b>
          <button class="btn ghost sm" type="button" data-r="${i}">${ic('edit')} Ubah</button>
          <button class="btn danger sm" type="button" data-d="${i}">${ic('trash')} Hapus</button>
        </div>
      `).join('');
    };

    $('#kf').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#kn').value.trim();
      const c = cats();

      if (v.length < 3) {
        bar($('#ke'), 'Nama kategori minimal 3 karakter.');
        return;
      }
      if (c.some(x => x.toLowerCase() === v.toLowerCase())) {
        bar($('#ke'), 'Kategori sudah ada.');
        return;
      }

      c.push(v);
      sv('fh_cats', c);
      $('#kn').value = '';
      $('#ke').hidden = true;
      draw();
      toast('Kategori ditambahkan.');
    });

    $('#kl').addEventListener('click', e => {
      const c = cats();
      const r = e.target.closest('[data-r]');
      const d = e.target.closest('[data-d]');

      if (r) {
        const v = prompt('Nama kategori baru:', c[+r.dataset.r]);
        if (v && v.trim().length >= 3) {
          c[+r.dataset.r] = v.trim();
          sv('fh_cats', c);
          draw();
          toast('Kategori diubah.');
        }
      }

      if (d) {
        if (c.length <= 1) {
          toast('Minimal harus ada satu kategori.');
          return;
        }
        if (confirm('Hapus kategori ini?')) {
          c.splice(+d.dataset.d, 1);
          sv('fh_cats', c);
          draw();
          toast('Kategori dihapus.');
        }
      }
    });

    draw();
  },

  /** Halaman Moderasi Laporan Forum */
  'laporan-forum'() {
    const draw = () => {
      const r = rps();
      $('#lp').innerHTML = r.length
        ? r.map(x => `
          <div class="row">
            <div class="grow">
              <b>${esc(x.ttl)}</b><br>
              <span class="muted sm">dilaporkan ${esc(x.by)} · ${esc(x.d)}</span>
              <p style="margin:.3rem 0 0">${esc(x.why)}</p>
            </div>
            <span class="sts ${esc(x.st)}">${esc(x.st)}</span>
            <a class="btn ghost sm" href="${R}detail-topik.html?id=${encodeURIComponent(x.tid)}">Lihat topik</a>
            ${x.st === 'baru' ? `<button class="btn sm" type="button" data-s="${esc(x.id)}">${ic('check')} Selesai</button>` : ''}
            <button class="btn danger sm" type="button" data-x="${esc(x.id)}">${ic('trash')} Hapus</button>
          </div>
        `).join('')
        : '<p class="empty">Tidak ada laporan.</p>';
    };

    $('#lp').addEventListener('click', e => {
      const s = e.target.closest('[data-s]');
      const x = e.target.closest('[data-x]');
      let r = rps();

      if (s) r.forEach(i => { if (i.id === s.dataset.s) i.st = 'selesai'; });
      if (x) r = r.filter(i => i.id !== x.dataset.x);
      if (s || x) {
        sv('fh_rp', r);
        draw();
        toast('Laporan diperbarui.');
      }
    });

    draw();
  }
};

/* ==========================================================================
   Inisialisasi Aplikasi Saat Memuat Halaman
   ========================================================================== */

if ($('#nav')) buildNav();
if ($('#side')) buildAdmin();
buildTabs();
if (PG[P]) PG[P]();
hydrate(document);

})();
