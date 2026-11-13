/* ==========================================================================
   FoodHub - main.js
   Frontend murni. Data contoh disimpan di localStorage agar semua fitur bisa
   dicoba tanpa backend. Saat backend siap, ganti fungsi penyimpanan (ld/sv/users)
   dengan fetch ke API.
   ========================================================================== */

(function () {
  'use strict';

  const B = document.body;
  const P = B.dataset.page;
  const R = B.dataset.root || '';
  const ACC = B.dataset.access || '';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const qs = new URLSearchParams(location.search);

  /** Sanitasi teks string untuk mencegah XSS */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

  /** Muat data dari localStorage */
  const ld = (k, d) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch (e) {
      return d;
    }
  };

  /** Simpan data ke localStorage */
  const sv = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      toast('Penyimpanan peramban penuh.');
    }
  };

  const today = () => new Date().toISOString().slice(0, 10);

  /** Tampilkan notifikasi pop-up (toast) */
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
    t._h = setTimeout(() => {
      t.className = '';
    }, 2600);
  }

  /* ==========================================================================
     Ikon SVG
     ========================================================================== */
  const ICON_FILES = false;
  const IC = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chef: '<path d="M7 19v-4a4 4 0 0 1-.5-7.9 5 5 0 0 1 11 0A4 4 0 0 1 17 15v4z"/><path d="M7 17h10"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6.5 6.5 0 0 1 3 6"/>',
    heart: '<path d="M12 20s-8-4.9-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.1-8 11-8 11z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fridge: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M6 10h12M9 6v1.5M9 13v3"/>',
    map: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    flag: '<path d="M5 21V4h12l-2 4 2 4H5"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
    bowl: '<path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="m8.2 10.8 6.6-3.6M8.2 13.2l6.6 3.6"/>'
  };

  const ic = n => ICON_FILES
    ? `<img class="ic" src="${R}img/icons/${n}.svg" alt="">`
    : `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

  const hydrate = root => $$('[data-ic]', root).forEach(e => {
    e.innerHTML = ic(e.dataset.ic);
  });

  /* ==========================================================================
     Sesi & Pengguna (Data Demo)
     ========================================================================== */
  const sess = () => {
    try {
      const v = sessionStorage.getItem('fh_s') || localStorage.getItem('fh_s');
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  };

  const setSess = (u, keep) => {
    try {
      sessionStorage.removeItem('fh_s');
      localStorage.removeItem('fh_s');
      (keep ? localStorage : sessionStorage).setItem('fh_s', JSON.stringify({ email: u.email }));
    } catch (e) {
      /* abaikan */
    }
  };

  const endSess = () => {
    try {
      sessionStorage.removeItem('fh_s');
      localStorage.removeItem('fh_s');
    } catch (e) {
      /* abaikan */
    }
  };

  function users() {
    let u = ld('fh_users', null);
    if (!u) {
      u = [
        { name: 'Admin FoodHub', email: 'admin@foodhub.id', pass: 'admin123', role: 'admin', fav: [], at: '2026-08-01' },
        { name: 'Raka Pratama', email: 'raka@contoh.id', pass: 'rahasia123', role: 'member', fav: [], at: '2026-09-12' },
        { name: 'Nadia Putri', email: 'nadia@contoh.id', pass: 'rahasia123', role: 'member', fav: [], at: '2026-10-03' }
      ];
      sv('fh_users', u);
    }
    return u;
  }

  const me = () => {
    const s = sess();
    return s ? (users().filter(x => x.email === s.email)[0] || null) : null;
  };

  let U = me();

  /* Proteksi Akses */
  if (ACC === 'member' && !U) {
    location.replace(R + 'masuk.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search));
    return;
  }

  if (ACC === 'admin') {
    if (!U) {
      location.replace(R + 'masuk.html?next=' + encodeURIComponent('admin/' + location.pathname.split('/').pop()));
      return;
    }
    if (U.role !== 'admin') {
      location.replace(R + 'index.html');
      return;
    }
  }

  /* ==========================================================================
     Data Resep Tradisional Indonesia (Lengkap dengan Foto Pinterest)
     ========================================================================== */
  const BASIC = ['garam', 'gula', 'minyak', 'air', 'es batu'];
  const DEFAULT_RECIPES = [
    {
      id: 1,
      n: 'Rendang',
      p: 'Sumatera Barat',
      k: ['Makanan Berat'],
      w: 180,
      l: 'Sulit',
      s: 6,
      r: 5.0,
      rc: 48,
      f: 'img/rendang.jpg',
      u: 'Tim FoodHub',
      c: 'Olahan daging sapi empuk kaya rempah khas Minangkabau yang dimasak perlahan hingga santan mengering dan bumbu meresap sempurna.',
      b: [
        ['Daging sapi', 1000, 'g'],
        ['Santan kental', 1000, 'ml'],
        ['Cabai merah', 150, 'g'],
        ['Bawang merah', 100, 'g'],
        ['Bawang putih', 50, 'g'],
        ['Lengkuas', 40, 'g'],
        ['Serai', 3, 'batang'],
        ['Daun jeruk', 6, 'lembar'],
        ['Kelapa parut sangrai', 100, 'g'],
        ['Garam', 2, 'sdt']
      ],
      t: [
        'Haluskan cabai merah, bawang merah, bawang putih, jahe, dan lengkuas.',
        'Masukkan bumbu halus, serai, daun jeruk, dan santan ke wajan bersama potongan daging.',
        'Masak dengan api sedang sambil sesekali diaduk agar santan tidak pecah hingga mendidih.',
        'Tambahkan kelapa parut sangrai dan garam, lalu kecilkan api dan aduk perlahan hingga mengering kecokelatan.'
      ]
    },
    {
      id: 2,
      n: 'Gulai Itiak',
      p: 'Sumatera Barat',
      k: ['Makanan Berat'],
      w: 120,
      l: 'Sedang',
      s: 4,
      r: 4.9,
      rc: 42,
      f: 'img/gulai-itiak.jpg',
      u: 'Tim FoodHub',
      c: 'Gulai bebek muda khas Koto Gadang Bukittinggi dengan lumuran sambal cabai hijau berlimpah dan santan gurih aromatik.',
      b: [
        ['Bebek muda', 1, 'ekor'],
        ['Cabai hijau keriting', 250, 'g'],
        ['Bawang merah', 10, 'siung'],
        ['Bawang putih', 5, 'siung'],
        ['Lengkuas', 30, 'g'],
        ['Santan kelapa', 600, 'ml'],
        ['Daun kunyit', 1, 'lembar'],
        ['Asam kandis', 2, 'buah'],
        ['Garam', 1.5, 'sdt']
      ],
      t: [
        'Bakar sebentar bebek di atas bara untuk membersihkan bulu halus dan mengurangi lemak berlebih.',
        'Giling kasar cabai hijau keriting, bawang merah, bawang putih, jahe, dan lengkuas.',
        'Tumis bumbu giling bersama daun kunyit dan serai hingga harum semerbak.',
        'Tuang santan dan masukkan potongan bebek serta asam kandis, masak api sedang hingga daging bebek empuk meresap.'
      ]
    },
    {
      id: 3,
      n: 'Sate Padang',
      p: 'Sumatera Barat',
      k: ['Makanan Berat'],
      w: 60,
      l: 'Sedang',
      s: 4,
      r: 4.9,
      rc: 39,
      f: 'img/sate-padang.jpg',
      u: 'Tim FoodHub',
      c: 'Sate lidah dan daging sapi empuk dengan siraman kuah kuning kental kaya rempah kunyit, serai, dan lada gurih pedas.',
      b: [
        ['Daging dan lidah sapi', 500, 'g'],
        ['Tepung beras', 60, 'g'],
        ['Kunyit', 4, 'ruas'],
        ['Bawang merah', 8, 'siung'],
        ['Bawang putih', 4, 'siung'],
        ['Ketumbar sangrai', 1, 'sdm'],
        ['Serai', 2, 'batang'],
        ['Air kaldu rebusan', 800, 'ml'],
        ['Garam', 1.5, 'sdt']
      ],
      t: [
        'Rebus potongan daging dan lidah sapi bersama bumbu rempah halus dan serai hingga empuk, lalu potong dadu.',
        'Tusukkan daging pada tusukan sate bambu, bakar sebentar di atas bara api beraroma asap.',
        'Saring air kaldu rebusan, larutkan tepung beras, lalu masak sambil diaduk cepat hingga kuah meletup-letup kental.',
        'Sajikan sate hangat disiram kuah kuning kental dan taburan bawang goreng renyah.'
      ]
    },
    {
      id: 4,
      n: 'Pempek Kapal Selam',
      p: 'Sumatera Selatan',
      k: ['Makanan Berat', 'Cepat'],
      w: 90,
      l: 'Sedang',
      s: 6,
      r: 4.8,
      rc: 33,
      f: 'img/pempek.jpg',
      u: 'Tim FoodHub',
      c: 'Olahan ikan tenggiri kenyal khas Palembang berisi telur utuh, digoreng garing lalu disajikan dengan cuko pedas manis asam.',
      b: [
        ['Ikan tenggiri giling', 500, 'g'],
        ['Tepung sagu tani', 300, 'g'],
        ['Telur ayam', 4, 'butir'],
        ['Bawang putih', 4, 'siung'],
        ['Gula merah batok', 200, 'g'],
        ['Cabai rawit hijau', 15, 'buah'],
        ['Asam jawa', 30, 'g'],
        ['Air es', 200, 'ml'],
        ['Garam', 1.5, 'sdt']
      ],
      t: [
        'Uleni ikan tenggiri dingin dengan air es dan garam hingga adonan mengembang kenyal.',
        'Campur tepung sagu perlahan bertahap tanpa diuleni terlalu keras.',
        'Bentuk adonan menjadi mangkuk kantong, isi dengan sebutir telur mentah, lalu rekatkan tepi adonan rapat.',
        'Rebus dalam air mendidih hingga mengapung matang, goreng sesaat sebelum disajikan bersama cuko hitam kental.'
      ]
    },
    {
      id: 5,
      n: 'Soto Ayam Lamongan',
      p: 'Jawa Timur',
      k: ['Makanan Berat', 'Anak Kos'],
      w: 60,
      l: 'Sedang',
      s: 4,
      r: 4.8,
      rc: 31,
      f: 'img/soto-lamongan.jpg',
      u: 'Tim FoodHub',
      c: 'Soto ayam berkuah kuning bening gurih segar dengan taburan bubuk koya gurih renyah dari kerupuk udang dan bawang putih.',
      b: [
        ['Ayam kampung', 600, 'g'],
        ['Bawang putih', 6, 'siung'],
        ['Bawang merah', 8, 'siung'],
        ['Kunyit bakar', 3, 'ruas'],
        ['Kemiri sangrai', 4, 'butir'],
        ['Serai', 2, 'batang'],
        ['Daun jeruk', 4, 'lembar'],
        ['Kerupuk udang goreng', 50, 'g'],
        ['Soun seduh', 80, 'g'],
        ['Garam', 2, 'sdt'],
        ['Air', 1800, 'ml']
      ],
      t: [
        'Rebus ayam kampung bersama serai dan daun jeruk hingga kaldu bening terbentuk, suwir daging ayamnya.',
        'Haluskan bawang putih, bawang merah, kunyit, dan kemiri lalu tumis hingga matang harum.',
        'Masukkan bumbu tumis ke dalam kuah kaldu rebusan, bumbui garam, dan didihkan hingga meresap gurih.',
        'Tumbuk kerupuk udang goreng bersama bawang putih goreng untuk bubuk koya, taburkan di atas mangkuk soto hangat.'
      ]
    },
    {
      id: 6,
      n: 'Rawon Daging Sapi',
      p: 'Jawa Timur',
      k: ['Makanan Berat'],
      w: 90,
      l: 'Sedang',
      s: 5,
      r: 4.8,
      rc: 29,
      f: 'img/rawon.jpg',
      u: 'Tim FoodHub',
      c: 'Sup daging sapi khas Jawa Timur berwarna hitam pekat dari kluwek matang, disajikan bersama sambal terasi dan tauge pendek segar.',
      b: [
        ['Daging sapi sandung lamur', 600, 'g'],
        ['Kluwek tua hitam', 5, 'buah'],
        ['Bawang merah', 8, 'siung'],
        ['Bawang putih', 5, 'siung'],
        ['Lengkuas', 3, 'cm'],
        ['Serai', 2, 'batang'],
        ['Daun jeruk purut', 4, 'lembar'],
        ['Tauge pendek segar', 100, 'g'],
        ['Telur asin', 3, 'butir'],
        ['Garam', 2, 'sdt']
      ],
      t: [
        'Rendam isi buah kluwek tua dengan air panas lalu haluskan bersama bawang merah, bawang putih, dan ketumbar.',
        'Tumis bumbu halus kluwek bersama serai, lengkuas, dan daun jeruk hingga aroma khas keluar.',
        'Masukkan potongan daging sapi, aduk hingga berubah warna lalu tuang air kaldu dan masak hingga empuk.',
        'Sajikan rawon hitam gurih dengan taburan tauge pendek mentah, telur asin, dan sambal terasi pedas.'
      ]
    },
    {
      id: 7,
      n: 'Gudeg Jogja',
      p: 'DI Yogyakarta',
      k: ['Makanan Berat'],
      w: 240,
      l: 'Sulit',
      s: 6,
      r: 4.7,
      rc: 24,
      f: 'img/gudeg.jpg',
      u: 'Tim FoodHub',
      c: 'Nangka muda dimasak perlahan berjam-jam dengan santan kental, gula aren murni, dan daun jati hingga cokelat kemerahan manis legit.',
      b: [
        ['Nangka muda cacah', 1000, 'g'],
        ['Santan kental kelapa', 1000, 'ml'],
        ['Gula merah kelapa aren', 150, 'g'],
        ['Bawang merah', 10, 'siung'],
        ['Bawang putih', 6, 'siung'],
        ['Ketumbar bubuk', 1, 'sdm'],
        ['Daun salam segar', 6, 'lembar'],
        ['Lengkuas memarkan', 50, 'g'],
        ['Telur rebus kupas', 6, 'butir'],
        ['Garam', 1.5, 'sdt']
      ],
      t: [
        'Alasi dasar panci dengan daun salam dan potongan lengkuas memar.',
        'Tata nangka muda, telur rebus kupas, bumbu halus bawang dan ketumbar, serta sisiran gula merah.',
        'Tuang santan kelapa perlahan, masak di atas api kecil berjam-jam hingga air santan mengering meresap.',
        'Biarkan gudeg mengendap semalaman agar warna cokelat kemerahan makin pekat dan bumbu manis legit makin mantap.'
      ]
    },
    {
      id: 8,
      n: 'Sate Lilit Bali',
      p: 'Bali',
      k: ['Makanan Berat', 'Cepat'],
      w: 50,
      l: 'Sedang',
      s: 4,
      r: 4.8,
      rc: 22,
      f: 'img/sate-lilit.jpg',
      u: 'Tim FoodHub',
      c: 'Cincangan daging ikan tenggiri lembut berpadu parutan kelapa muda dan rempah base genep khas Bali, dililitkan di batang serai harum.',
      b: [
        ['Daging ikan tenggiri cincang', 500, 'g'],
        ['Kelapa parut setengah tua', 120, 'g'],
        ['Bawang merah', 8, 'siung'],
        ['Bawang putih', 5, 'siung'],
        ['Kencur', 3, 'cm'],
        ['Kunyit bakar', 3, 'cm'],
        ['Cabai rawit merah', 6, 'buah'],
        ['Batang serai segar', 10, 'batang'],
        ['Garam', 1, 'sdt']
      ],
      t: [
        'Haluskan bumbu base genep (bawang, kencur, kunyit, cabai) lalu tumis sebentar sampai harum.',
        'Campur daging ikan cincang, kelapa parut, bumbu tumis, dan garam hingga adonan liat kalis.',
        'Lilitkan adonan pada ujung batang serai segar hingga padat membulat.',
        'Panggang di atas bara api atau wajan datar hingga sate harum kekuningan matang merata.'
      ]
    },
    {
      id: 9,
      n: 'Ayam Betutu',
      p: 'Bali',
      k: ['Makanan Berat'],
      w: 120,
      l: 'Sedang',
      s: 5,
      r: 4.8,
      rc: 25,
      f: 'img/ayam-betutu.jpg',
      u: 'Tim FoodHub',
      c: 'Ayam kampung utuh berbalur rempah bumbu genep komplit pedas gurih, dibungkus daun pisang lalu dipanggang matang meresap.',
      b: [
        ['Ayam kampung utuh', 1, 'ekor'],
        ['Bawang merah cincang', 12, 'siung'],
        ['Bawang putih cincang', 6, 'siung'],
        ['Kencur cincang', 4, 'ruas'],
        ['Kunyit cincang', 3, 'ruas'],
        ['Lengkuas cincang', 4, 'cm'],
        ['Cabai rawit merah iris', 15, 'buah'],
        ['Minyak kelapa murni', 4, 'sdm'],
        ['Daun pisang pembungkus', 3, 'lembar'],
        ['Garam', 2, 'sdt']
      ],
      t: [
        'Campurkan bumbu cincang genep dengan minyak kelapa dan garam hingga merata.',
        'Balurkan bumbu ke seluruh bagian ayam kampung luar dan rongga dalam.',
        'Bungkus rapat ayam berbumbu dengan daun pisang berlapis.',
        'Kukus selama 45 menit lalu panggang hingga bumbu mengering harum dan daging ayam sangat empuk.'
      ]
    },
    {
      id: 10,
      n: 'Papeda Kuah Kuning',
      p: 'Papua',
      k: ['Makanan Berat', 'Sehat'],
      w: 45,
      l: 'Sedang',
      s: 4,
      r: 4.6,
      rc: 16,
      f: 'img/papeda.jpg',
      u: 'Tim FoodHub',
      c: 'Papeda sagu kenyal lembut khas pesisir timur Nusantara disiram sup ikan tongkol kuah kuning beraroma kemangi dan asam jeruk nipis.',
      b: [
        ['Tepung sagu murni', 250, 'g'],
        ['Ikan tongkol segar', 500, 'g'],
        ['Kunyit bakar', 4, 'ruas'],
        ['Bawang merah', 6, 'siung'],
        ['Bawang putih', 4, 'siung'],
        ['Serai memarkan', 2, 'batang'],
        ['Daun kemangi segar', 1, 'ikat'],
        ['Jeruk nipis peras', 2, 'buah'],
        ['Garam', 1.5, 'sdt'],
        ['Air mendidih', 1200, 'ml']
      ],
      t: [
        'Larutkan sagu dengan sedikit air dingin dan perasan jeruk nipis di wadah baskom.',
        'Tuangkan air mendidih sambil diaduk cepat satu arah hingga sagu berubah bening kental elastis.',
        'Tumis bumbu halus kunyit dan serai, tambahkan air kaldu dan potongan ikan tongkol segar.',
        'Masak hingga ikan matang, masukkan daun kemangi dan jeruk nipis, sajikan bersama papeda hangat.'
      ]
    },
    {
      id: 11,
      n: 'Gado-Gado Betawi',
      p: 'DKI Jakarta',
      k: ['Sehat', 'Makanan Berat', 'Cepat'],
      w: 35,
      l: 'Mudah',
      s: 3,
      r: 4.7,
      rc: 20,
      v: 1,
      f: 'img/gado-gado.jpg',
      u: 'Tim FoodHub',
      c: 'Salad tradisional Betawi dari aneka sayuran rebus segar, tahu tempe goreng, disiram saus kacang tanah legit gurih beraroma limau.',
      b: [
        ['Kacang tanah goreng giling', 200, 'g'],
        ['Kentang kukus potong', 2, 'buah'],
        ['Kol iris rebus', 100, 'g'],
        ['Tauge rebus sebentar', 100, 'g'],
        ['Kacang panjang rebus', 100, 'g'],
        ['Tahu dan tempe goreng', 4, 'potong'],
        ['Telur rebus belah dua', 2, 'butir'],
        ['Gula merah aren', 40, 'g'],
        ['Air asam jawa', 2, 'sdm'],
        ['Jeruk limau', 2, 'buah'],
        ['Garam', 1, 'sdt']
      ],
      t: [
        'Haluskan cabai, bawang putih goreng, garam, dan gula merah di atas cobek.',
        'Campur kacang tanah halus dengan air hangat dan asam jawa, uleg hingga menjadi saus kacang kental.',
        'Beri perasan jeruk limau segar pada saus kacang agar wangi.',
        'Tata sayuran rebus, tahu, tempe, dan telur rebus, siramkan saus kacang dan beri taburan emping.'
      ]
    },
    {
      id: 12,
      n: 'Es Cendol Dawet',
      p: 'Jawa Tengah',
      k: ['Minuman', 'Cepat'],
      w: 40,
      l: 'Sedang',
      s: 4,
      r: 4.6,
      rc: 21,
      v: 1,
      f: 'img/es-cendol.jpg',
      u: 'Tim FoodHub',
      c: 'Minuman es tradisional Jawa dengan cendol pandan hijau kenyal, siraman santan gurih segar, dan kinca gula kelapa nangka wangi.',
      b: [
        ['Tepung beras', 120, 'g'],
        ['Air pandan suji', 500, 'ml'],
        ['Santan kelapa matang', 400, 'ml'],
        ['Gula merah aren', 200, 'g'],
        ['Buah nangka matang', 50, 'g'],
        ['Es batu serut', 300, 'g'],
        ['Garam', 0.5, 'sdt']
      ],
      t: [
        'Masak tepung beras dan air pandan sambil diaduk sampai meletup-letup kental bening.',
        'Cetak adonan cendol panas di atas wadah berisi air es.',
        'Rebus gula merah aren bersama potongan nangka harum menjadi sirup kinca manis.',
        'Sajikan cendol dalam gelas bersama sirup kinca, es batu serut, dan siraman santan gurih.'
      ]
    },
    {
      id: 13,
      n: 'Nasi Liwet Solo',
      p: 'Jawa Tengah',
      k: ['Makanan Berat'],
      w: 60,
      l: 'Sedang',
      s: 4,
      r: 4.8,
      rc: 27,
      f: 'img/nasi-liwet.jpg',
      u: 'Tim FoodHub',
      c: 'Nasi gurih harum berbalur santan dan rempah daun salam, disajikan hangat dengan suwiran ayam opor lembut, sayur labu siam, dan areh santan.',
      b: [
        ['Beras pulen', 450, 'g'],
        ['Santan kelapa', 700, 'ml'],
        ['Daun salam segar', 4, 'lembar'],
        ['Serai memarkan', 2, 'batang'],
        ['Daging ayam suwir opor', 200, 'g'],
        ['Labu siam iris korek', 150, 'g'],
        ['Santan areh kental gurih', 100, 'ml'],
        ['Garam', 1.5, 'sdt']
      ],
      t: [
        'Cuci beras bersih, masak bersama santan, daun salam, serai, dan garam hingga santan terserap (aron).',
        'Tutup rapat panci liwet dan masak dengan api kecil hingga nasi tanak pulen beraroma harum gurih.',
        'Masak sayur labu siam kuah santan pedas gurih untuk pendamping.',
        'Sajikan nasi liwet di pincuk daun pisang dengan suwiran ayam opor, sayur labu siam, dan areh santan kental.'
      ]
    },
    {
      id: 14,
      n: 'Soto Makassar',
      p: 'Sulawesi Selatan',
      k: ['Makanan Berat'],
      w: 90,
      l: 'Sedang',
      s: 5,
      r: 4.8,
      rc: 34,
      f: 'img/soto-makassar.jpg',
      u: 'Tim FoodHub',
      c: 'Sup daging sapi khas Makassar berkuah kaldu pekat gurih berbumbu rempah kacang tanah sangrai, disajikan bersama ketupat daun kelapa.',
      b: [
        ['Daging sapi sandung lamur', 700, 'g'],
        ['Kacang tanah sangrai giling halus', 150, 'g'],
        ['Bawang merah', 10, 'siung'],
        ['Bawang putih', 6, 'siung'],
        ['Serai memarkan', 3, 'batang'],
        ['Lengkuas memarkan', 30, 'g'],
        ['Ketumbar sangrai', 1, 'sdm'],
        ['Jintan sangrai', 0.5, 'sdt'],
        ['Air tajin cucian beras', 1800, 'ml'],
        ['Garam', 2, 'sdt']
      ],
      t: [
        'Rebus daging sapi dalam air tajin bersama serai dan lengkuas sampai empuk, potong dadu.',
        'Haluskan bumbu rempah lalu tumis hingga harum semerbak berminyak.',
        'Masukkan bumbu tumisan dan gilingan kacang tanah sangrai ke kuah rebusan daging.',
        'Masak hingga kuah mengental gurih berminyak. Sajikan panas bersama ketupat, irisan daun seledri, dan perasan jeruk nipis.'
      ]
    }
  ];

  /* ==========================================================================
     Helper Data & Fungsi Utilitas
     ========================================================================== */
  const cats = () => ['Makanan Berat', 'Sehat', 'Minuman', 'Cepat', 'Anak Kos'];
  const hid = () => ld('fh_hid', []);
  const recipesList = () => {
    let list = ld('fh_recipes', null);
    if (!list || !Array.isArray(list) || !list.length) {
      list = DEFAULT_RECIPES.slice();
      sv('fh_recipes', list);
    }
    return list;
  };
  const saveRecipes = list => sv('fh_recipes', list);
  const all = () => recipesList().filter(r => !hid().includes(r.id));
  const byId = id => recipesList().filter(r => String(r.id) === String(id))[0];
  const rvAll = () => ld('fh_rv', {});

  const rat = r => {
    const v = rvAll()[r.id] || [];
    const n = (r.rc || 0) + v.length;
    if (!n) return null;
    let s = (r.r || 0) * (r.rc || 0);
    v.forEach(x => { s += x.s; });
    return { a: s / n, n };
  };

  const starTxt = a => '★'.repeat(Math.round(a)) + '☆'.repeat(5 - Math.round(a));
  const hue = id => String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
  const fmt = n => (Math.round(n * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  const tags = r => (r.p ? `<span class="tag r">${esc(r.p)}</span>` : '') + r.k.map(k => `<span class="tag">${esc(k)}</span>`).join('');
  const thumb = r => `<div class="thumb c${hue(r.id)}">${r.f ? `<img src="${R + esc(r.f)}" alt="${esc(r.n)}">` : ic('bowl')}</div>`;

  function card(r) {
    const t = rat(r);
    return `
      <a class="card" href="${R}detail-resep.html?id=${encodeURIComponent(r.id)}">
        ${thumb(r)}
        <div class="cb">
          <h3>${esc(r.n)}</h3>
          ${r.c ? `<p class="desc">${esc(r.c)}</p>` : ''}
          <div class="meta">
            <span>${ic('clock')} ${r.w} mnt</span>
            <span>${esc(r.l)}</span>
            <span class="gold">${t ? '★ ' + t.a.toFixed(1) : 'Belum ada rating'}</span>
          </div>
        </div>
      </a>
    `;
  }

  const goLogin = () => {
    location.href = R + 'masuk.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
  };

  /* ==========================================================================
     Komponen Bersama: Navigasi, Footer, Sidebar Admin & Tabs
     ========================================================================== */
  function buildNav() {
    const L = [
      ['index', 'Beranda'],
      ['daftar-resep', 'Resep'],
      ['faq', 'FAQ']
    ];
    const cur = {
      'detail-resep': 'daftar-resep'
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

  function buildAdmin() {
    const L = [
      ['dasbor', 'Dasbor', 'grid'],
      ['kelola-resep', 'Kelola Resep', 'book'],
      ['kelola-pengguna', 'Kelola Pengguna', 'users']
    ];

    $('#side').innerHTML = `
      <a class="logo" href="dasbor.html" aria-label="Dasbor FoodHub">
        <img src="${R}img/logo-foodhub.jpg" alt="FoodHub">
      </a>
      ${L.map(l => `
        <a href="${l[0]}.html"${(l[0] === P || (l[0] === 'kelola-resep' && P === 'moderasi-resep')) ? ' class="on" aria-current="page"' : ''}>
          ${ic(l[2])} ${l[1]}
        </a>
      `).join('')}
      <a class="sp" href="${R}index.html">${ic('bowl')} Lihat situs</a>
      <button type="button" id="alo">${ic('logout')} Keluar</button>
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

  function buildTabs() {
    const t = $('#tabs');
    if (!t) return;
    t.remove();
  }

  const bar = (el, m, ok) => {
    el.className = ok ? 'ok' : 'err';
    el.textContent = m;
    el.hidden = false;
  };

  const list = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;

  /* ==========================================================================
     Router Logika Halaman (PG)
     ========================================================================== */
  const PG = {
    index() {
      $('#cats').innerHTML = '<a class="chip on" href="daftar-resep.html">Semua</a>' +
        cats().map(c => `<a class="chip" href="daftar-resep.html?kat=${encodeURIComponent(c)}">${esc(c)}</a>`).join('');

      const top = all().slice().sort((x, y) => ((rat(y) || { a: 0 }).a) - ((rat(x) || { a: 0 }).a)).slice(0, 3);
      $('#pop').innerHTML = top.map(card).join('');

      $('#heroForm').addEventListener('submit', e => {
        e.preventDefault();
        location.href = 'daftar-resep.html?q=' + encodeURIComponent($('#q').value.trim());
      });
    },

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
        const L = all().filter(r => {
          const matchQ = !q || (r.n + ' ' + (r.p || '') + ' ' + r.b.map(i => i[0]).join(' ')).toLowerCase().includes(q);
          const matchK = !f.k.value || r.k.includes(f.k.value);
          const matchW = !w || (w === 999 ? r.w > 60 : r.w <= w);
          const matchL = !f.l.value || r.l === f.l.value;
          return matchQ && matchK && matchW && matchL;
        });

        $('#cnt').textContent = `${L.length} resep ditemukan`;
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

    'detail-resep'() {
      const r = byId(qs.get('id'));
      const box = $('#dr');

      if (!r || (hid().includes(r.id) && !(U && U.role === 'admin'))) {
        box.innerHTML = `
          <div class="empty">
            <h2>Resep tidak ditemukan</h2>
            <p>Resep ini tidak ada atau sedang disembunyikan admin.</p>
            <a class="btn" href="daftar-resep.html">Lihat semua resep</a>
          </div>
        `;
        return;
      }

      document.title = r.n + ' | FoodHub';
      let sv_ = r.s;

      box.innerHTML = `
        <div class="crumb">
          <a href="index.html">Beranda</a> / <a href="daftar-resep.html">Resep</a> / ${esc(r.n)}
        </div>

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
          e.textContent = `${fmt(i[1] * sv_ / r.s)} ${i[2]}`;
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
        $('#rt').textContent = t ? `★ ${t.a.toFixed(1)}` : '-';
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
              ${[1, 2, 3, 4, 5].map(n => `
                <button type="button" data-v="${n}" aria-label="${n} bintang">★</button>
              `).join('')}
            </div>
          </div>
          <div class="fld">
            <label for="rtx">Ulasan</label>
            <textarea id="rtx" placeholder="Bagikan pengalaman memasak resep ini"></textarea>
          </div>
          <div class="err" id="re" hidden></div>
          <button class="btn" id="rs" type="button">Kirim ulasan</button>
        `;

        $$('.stars button').forEach(b => {
          b.addEventListener('click', () => {
            val = +b.dataset.v;
            $$('.stars button').forEach(x => x.classList.toggle('on', +x.dataset.v <= val));
          });
        });

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

    profil() {
      const render = () => {
        const favList = (U.fav || []).map(byId).filter(r => r && !hid().includes(r.id));
        $('#pf').innerHTML = `
          <div class="sec-h" style="margin-bottom:1rem">
            <h1>Informasi Profil</h1>
          </div>
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
              <div class="panel">
                <b>${favList.length}</b>Resep tersimpan
              </div>
            </div>

            <form id="nf" novalidate style="margin-top:1.2rem">
              <div class="ok" id="no" hidden></div>
              <div class="err" id="ne" hidden></div>
              <div class="fld">
                <label for="nn">Nama tampilan</label>
                <input id="nn" value="${esc(U.name)}" maxlength="40">
              </div>
              <button class="btn" type="submit">Simpan perubahan</button>
            </form>
          </div>

          <div style="margin-top:2.5rem">
            <div class="sec-h">
              <h2>Resep Favorit</h2>
              <span class="muted sm">${favList.length} resep disimpan</span>
            </div>
            <div id="favGrid">
              ${favList.length
                ? `<div class="grid">${favList.map(r => `
                    <div>
                      ${card(r)}
                      <button class="btn danger sm" type="button" data-u="${esc(r.id)}" style="margin-top:.6rem;width:100%">
                        ${ic('heart')} Hapus dari Favorit
                      </button>
                    </div>
                  `).join('')}</div>`
                : '<p class="empty">Belum ada resep favorit yang disimpan. Buka detail resep lalu tekan Simpan.<br><br><a class="btn" href="daftar-resep.html">Cari resep</a></p>'
              }
            </div>
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
      };

      render();

      $('#pf').addEventListener('click', e => {
        const b = e.target.closest('[data-u]');
        if (!b) return;
        const us = users();
        const x = us.filter(u => u.email === U.email)[0];
        x.fav = (x.fav || []).filter(i => String(i) !== b.dataset.u);
        sv('fh_users', us);
        U = me();
        render();
        toast('Dihapus dari favorit.');
      });
    },

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

    /* ==========================================================================
       Halaman Admin
       ========================================================================== */
    dasbor() {
      $('#ds').innerHTML = `
        <div class="stat">
          <div class="panel"><b>${recipesList().length}</b>Total resep</div>
          <div class="panel"><b>${all().length}</b>Resep tayang</div>
          <div class="panel"><b>${hid().length}</b>Resep disembunyikan</div>
          <div class="panel"><b>${users().length}</b>Pengguna</div>
        </div>
        <div class="row">
          <div class="grow">
            <b>Kelola resep</b><br>
            <span class="muted sm">Tambah, edit, hapus, dan moderasi resep makanan Nusantara.</span>
          </div>
          <a class="btn sm" href="kelola-resep.html">Buka</a>
        </div>
        <div class="row">
          <div class="grow">
            <b>Kelola pengguna</b><br>
            <span class="muted sm">Lihat dan hapus akun member.</span>
          </div>
          <a class="btn sm" href="kelola-pengguna.html">Buka</a>
        </div>
      `;
    },

    'kelola-resep'() {
      const rootEl = $('#kr') || $('#md');
      if (!rootEl) return;

      const draw = () => {
        const list = recipesList();
        const h = hid();

        rootEl.innerHTML = `
          <div class="sec-h" style="margin-bottom:1.2rem">
            <div>
              <h1 style="margin:0">Kelola Resep</h1>
              <p class="muted sm" style="margin:.3rem 0 0">Tambah resep baru, edit resep yang ada, dan hapus resep.</p>
            </div>
            <button class="btn sm" id="btnTambahResep" type="button">
              ${ic('plus')} Tambah Resep
            </button>
          </div>

          <div class="stat">
            <div class="panel"><b>${list.length}</b>Total resep</div>
            <div class="panel"><b>${all().length}</b>Tayang</div>
            <div class="panel"><b>${h.length}</b>Disembunyikan</div>
          </div>

          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th style="width:50px">Foto</th>
                  <th>Nama Resep</th>
                  <th>Asal Daerah</th>
                  <th>Kategori</th>
                  <th>Waktu &amp; Porsi</th>
                  <th>Status</th>
                  <th style="width:240px">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(r => {
                  const x = h.includes(r.id);
                  const imgUrl = r.f ? (R + esc(r.f)) : '';
                  return `
                    <tr>
                      <td>
                        ${imgUrl
                          ? `<img class="t-thumb" src="${imgUrl}" alt="${esc(r.n)}">`
                          : `<div class="t-thumb" style="display:grid;place-items:center">${ic('bowl')}</div>`
                        }
                      </td>
                      <td>
                        <strong>${esc(r.n)}</strong>
                        ${r.c ? `<div class="muted sm" style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.c)}</div>` : ''}
                      </td>
                      <td>${esc(r.p || '-')}</td>
                      <td>${(r.k || []).map(k => `<span class="tag">${esc(k)}</span>`).join(' ')}</td>
                      <td>${r.w} mnt · ${r.s || 4} porsi</td>
                      <td>
                        <span class="sts ${x ? 'ditolak' : 'disetujui'}">
                          ${x ? 'disembunyikan' : 'tayang'}
                        </span>
                      </td>
                      <td>
                        <div class="act-btns">
                          <button class="btn ghost sm" type="button" data-edit="${r.id}" title="Edit resep">
                            ${ic('edit')} Edit
                          </button>
                          <button class="btn danger sm" type="button" data-del="${r.id}" title="Hapus resep">
                            ${ic('trash')} Hapus
                          </button>
                          <button class="btn sm ${x ? '' : 'ghost'}" type="button" data-i="${r.id}" title="${x ? 'Tampilkan' : 'Sembunyikan'}">
                            ${x ? 'Tayang' : 'Sembunyi'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="modal-backdrop" id="recipeModal" hidden>
            <div class="modal-box">
              <div class="modal-h">
                <h2 id="modalTitle">Tambah Resep Baru</h2>
                <button class="modal-close" id="modalClose" type="button">&times;</button>
              </div>
              <form id="recipeForm" novalidate>
                <input type="hidden" id="rf_id">
                
                <div class="fld">
                  <label for="rf_n">Nama Resep *</label>
                  <input id="rf_n" required placeholder="Contoh: Rendang Daging Sapi">
                </div>

                <div class="fld-row">
                  <div class="fld">
                    <label for="rf_p">Asal Daerah</label>
                    <input id="rf_p" placeholder="Contoh: Sumatera Barat">
                  </div>
                  <div class="fld">
                    <label for="rf_k">Kategori</label>
                    <select id="rf_k">
                      <option value="Makanan Berat">Makanan Berat</option>
                      <option value="Sehat">Sehat</option>
                      <option value="Minuman">Minuman</option>
                      <option value="Cepat">Cepat</option>
                      <option value="Anak Kos">Anak Kos</option>
                    </select>
                  </div>
                </div>

                <div class="fld-row">
                  <div class="fld">
                    <label for="rf_w">Waktu Memasak (menit) *</label>
                    <input type="number" id="rf_w" min="1" value="45" required>
                  </div>
                  <div class="fld">
                    <label for="rf_l">Tingkat Kesulitan</label>
                    <select id="rf_l">
                      <option value="Mudah">Mudah</option>
                      <option value="Sedang" selected>Sedang</option>
                      <option value="Sulit">Sulit</option>
                    </select>
                  </div>
                </div>

                <div class="fld-row">
                  <div class="fld">
                    <label for="rf_s">Porsi (orang)</label>
                    <input type="number" id="rf_s" min="1" value="4">
                  </div>
                  <div class="fld">
                    <label for="rf_f">Foto Resep</label>
                    <select id="rf_f">
                      <option value="img/rendang.jpg">Rendang (img/rendang.jpg)</option>
                      <option value="img/gulai-itiak.jpg">Gulai Itiak (img/gulai-itiak.jpg)</option>
                      <option value="img/sate-padang.jpg">Sate Padang (img/sate-padang.jpg)</option>
                      <option value="img/pempek.jpg">Pempek (img/pempek.jpg)</option>
                      <option value="img/soto-lamongan.jpg">Soto Lamongan (img/soto-lamongan.jpg)</option>
                      <option value="img/rawon.jpg">Rawon (img/rawon.jpg)</option>
                      <option value="img/gudeg.jpg">Gudeg (img/gudeg.jpg)</option>
                      <option value="img/sate-lilit.jpg">Sate Lilit (img/sate-lilit.jpg)</option>
                      <option value="img/ayam-betutu.jpg">Ayam Betutu (img/ayam-betutu.jpg)</option>
                      <option value="img/gado-gado.jpg">Gado-Gado (img/gado-gado.jpg)</option>
                      <option value="img/es-cendol.jpg">Es Cendol (img/es-cendol.jpg)</option>
                      <option value="img/nasi-liwet.jpg">Nasi Liwet (img/nasi-liwet.jpg)</option>
                      <option value="img/soto-makassar.jpg">Soto Makassar (img/soto-makassar.jpg)</option>
                      <option value="img/papeda.jpg">Papeda (img/papeda.jpg)</option>
                      <option value="">Tanpa foto (ikon mangkuk)</option>
                    </select>
                  </div>
                </div>

                <div class="fld">
                  <label for="rf_c">Deskripsi Singkat *</label>
                  <textarea id="rf_c" rows="2" required placeholder="Deskripsi singkat tentang cita rasa masakan ini..."></textarea>
                </div>

                <div class="fld">
                  <label for="rf_b">Bahan-Bahan (1 bahan per baris) *</label>
                  <textarea id="rf_b" rows="3" required placeholder="Contoh:&#10;Daging sapi, 500, g&#10;Santan kelapa, 500, ml&#10;Garam, 1, sdt"></textarea>
                  <span class="muted sm">Format: Nama Bahan, Jumlah, Satuan (atau tulis langsung).</span>
                </div>

                <div class="fld">
                  <label for="rf_t">Langkah Memasak (1 langkah per baris) *</label>
                  <textarea id="rf_t" rows="3" required placeholder="Contoh:&#10;Haluskan semua bumbu halus.&#10;Tumis bumbu hingga wangi semerbak.&#10;Masukkan santan dan masak hingga matang merata."></textarea>
                </div>

                <div style="display:flex;gap:.8rem;justify-content:flex-end;margin-top:1.2rem">
                  <button class="btn ghost" type="button" id="modalCancel">Batal</button>
                  <button class="btn" type="submit" id="modalSubmit">Simpan Resep</button>
                </div>
              </form>
            </div>
          </div>
        `;
      };

      const openModal = (recipe) => {
        const modal = $('#recipeModal');
        if (!modal) return;
        const title = $('#modalTitle');
        const form = $('#recipeForm');

        if (recipe) {
          title.textContent = 'Edit Resep: ' + recipe.n;
          $('#rf_id').value = recipe.id;
          $('#rf_n').value = recipe.n || '';
          $('#rf_p').value = recipe.p || '';
          $('#rf_k').value = (recipe.k && recipe.k[0]) ? recipe.k[0] : 'Makanan Berat';
          $('#rf_w').value = recipe.w || 45;
          $('#rf_l').value = recipe.l || 'Sedang';
          $('#rf_s').value = recipe.s || 4;
          $('#rf_f').value = recipe.f || '';
          $('#rf_c').value = recipe.c || '';
          $('#rf_b').value = (recipe.b || []).map(x => Array.isArray(x) ? x.join(', ') : x).join('\n');
          $('#rf_t').value = (recipe.t || []).join('\n');
        } else {
          title.textContent = 'Tambah Resep Baru';
          form.reset();
          $('#rf_id').value = '';
          $('#rf_w').value = 45;
          $('#rf_s').value = 4;
          $('#rf_l').value = 'Sedang';
          $('#rf_k').value = 'Makanan Berat';
          $('#rf_f').value = 'img/rendang.jpg';
        }
        modal.hidden = false;
      };

      const closeModal = () => {
        const modal = $('#recipeModal');
        if (modal) modal.hidden = true;
      };

      rootEl.addEventListener('click', e => {
        if (e.target.closest('#btnTambahResep')) {
          openModal(null);
          return;
        }

        if (e.target.closest('#modalClose') || e.target.closest('#modalCancel')) {
          closeModal();
          return;
        }

        const editBtn = e.target.closest('[data-edit]');
        if (editBtn) {
          const id = +editBtn.dataset.edit;
          const r = byId(id);
          if (r) openModal(r);
          return;
        }

        const delBtn = e.target.closest('[data-del]');
        if (delBtn) {
          const id = +delBtn.dataset.del;
          const r = byId(id);
          if (!r) return;
          if (!confirm(`Apakah Anda yakin ingin menghapus resep "${r.n}"?`)) return;
          const list = recipesList().filter(x => x.id !== id);
          saveRecipes(list);
          draw();
          toast('Resep berhasil dihapus.');
          return;
        }

        const toggleBtn = e.target.closest('[data-i]');
        if (toggleBtn) {
          const id = +toggleBtn.dataset.i;
          const h = hid();
          const x = h.includes(id);
          sv('fh_hid', x ? h.filter(i => i !== id) : h.concat(id));
          draw();
          toast(x ? 'Resep ditampilkan.' : 'Resep disembunyikan.');
          return;
        }
      });

      rootEl.addEventListener('submit', e => {
        if (e.target.id !== 'recipeForm') return;
        e.preventDefault();

        const idVal = $('#rf_id').value;
        const n = $('#rf_n').value.trim();
        const p = $('#rf_p').value.trim();
        const k = [$('#rf_k').value];
        const w = +$('#rf_w').value || 30;
        const l = $('#rf_l').value;
        const s = +$('#rf_s').value || 4;
        const f = $('#rf_f').value.trim();
        const c = $('#rf_c').value.trim();
        const bRaw = $('#rf_b').value.trim();
        const tRaw = $('#rf_t').value.trim();

        if (!n) {
          toast('Nama resep wajib diisi.');
          return;
        }
        if (!c) {
          toast('Deskripsi resep wajib diisi.');
          return;
        }

        const b = bRaw.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
          if (line.includes(',')) {
            const parts = line.split(',').map(x => x.trim());
            return [parts[0], isNaN(+parts[1]) ? parts[1] : +parts[1], parts[2] || ''];
          }
          return [line, 1, 'secukupnya'];
        });

        const t = tRaw.split('\n').map(line => line.trim()).filter(Boolean);

        const list = recipesList();
        if (idVal) {
          const idx = list.findIndex(x => String(x.id) === String(idVal));
          if (idx !== -1) {
            list[idx] = Object.assign({}, list[idx], { n, p, k, w, l, s, f, c, b, t });
            saveRecipes(list);
            toast('Resep berhasil diperbarui!');
          }
        } else {
          const newRecipe = {
            id: Date.now(),
            n,
            p: p || 'Nusantara',
            k,
            w,
            l,
            s,
            r: 5.0,
            rc: 1,
            f,
            u: (U && U.name) ? U.name : 'Admin FoodHub',
            c,
            b: b.length ? b : [['Bahan utama', 1, 'porsi']],
            t: t.length ? t : ['Masak bahan hingga matang dan sajikan hangat.']
          };
          list.unshift(newRecipe);
          saveRecipes(list);
          toast('Resep berhasil ditambahkan!');
        }

        closeModal();
        draw();
      });

      draw();
    },

    'moderasi-resep'() {
      this['kelola-resep']();
    },

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
                        : `<button class="btn danger sm" type="button" data-e="${esc(u.email)}">${ic('trash')} Hapus</button>`
                      }
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
        if (!b || !confirm(`Hapus pengguna ${b.dataset.e}?`)) return;
        sv('fh_users', users().filter(u => u.email !== b.dataset.e));
        draw();
        toast('Pengguna dihapus.');
      });

      draw();
    }
  };

  /* Inisialisasi */
  if ($('#nav')) buildNav();
  if ($('#side')) buildAdmin();
  buildTabs();
  if (PG[P]) PG[P]();
  hydrate(document);
})();
