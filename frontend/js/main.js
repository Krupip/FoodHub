/* ==========================================================================
   FoodHub - main.js
   Frontend terhubung ke backend API PHP (MySQL/MariaDB).
   Autentikasi hanya melalui API; fitur lain masih dapat memakai data lokal.
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

  /** Format angka lokalisasi Indonesia */
  const fmt = n => (Math.round(n * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 });
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
     API Client (Fetch ke Backend PHP)
     ========================================================================== */
  const API_BASE = (R ? (R + '../') : '../') + 'backend/api/';

  let csrfToken = null;
  const CSRF_INVALID = 'Token CSRF server hilang atau tidak valid. Muat ulang halaman atau masuk kembali sebelum mencoba lagi.';
  const safeMethod = method => ['GET', 'HEAD', 'OPTIONS'].includes(method);
  const authAction = path => path.split('?')[0] === 'auth.php'
    ? new URLSearchParams(path.split('?')[1] || '').get('action') : null;

  // Refresh memakai fetch helper langsung, bukan api(), agar tidak merekursi mutasi.
  async function api(path, opts = {}) {
    const method = (opts.method || 'GET').toUpperCase();
    const publicAuth = method === 'POST' && ['login', 'register'].includes(authAction(path));
    if (!safeMethod(method) && !publicAuth && !csrfToken) {
      await fetchApi('auth.php?action=me');
    }
    return fetchApi(path, opts);
  }

  async function fetchApi(path, opts = {}) {
    const method = (opts.method || 'GET').toUpperCase();
    const action = authAction(path);
    const publicAuth = method === 'POST' && ['login', 'register'].includes(action);
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    // Token hanya berasal dari header server dan tidak pernah dikirim pada safe methods.
    Object.keys(headers).forEach(key => {
      if (key.toLowerCase() === 'x-csrf-token') delete headers[key];
    });
    if (!safeMethod(method) && csrfToken) headers['X-CSRF-Token'] = csrfToken;
    let body = opts.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      body = JSON.stringify(body);
    }

    const res = await fetch(API_BASE + path, { ...opts, method, credentials: 'same-origin', headers, body });
    const header = res.headers && typeof res.headers.get === 'function' ? res.headers.get('X-CSRF-Token') : null;
    const token = typeof header === 'string' && header.length === 64 && /^[0-9a-f]{64}$/.test(header) ? header : null;
    const data = await res.json().catch(() => ({}));
    if (res.ok && (method === 'GET' && action === 'me' || publicAuth)) {
      // Jangan mempertahankan token identitas lama, termasuk login ulang akun yang sama.
      csrfToken = null;
      U = null;
      const user = authUser(data, action === 'me');
      if (user && !token) throw new Error(CSRF_INVALID);
      U = user;
      csrfToken = user ? token : null;
    } else if (res.ok && method === 'POST' && action === 'logout') {
      const result = authResponse(data);
      if (typeof result.message !== 'string' || !result.message.trim()) throw new Error(AUTH_INVALID);
      U = null;
      csrfToken = null;
    } else if (res.status === 401 && !publicAuth) {
      U = null;
      csrfToken = null;
    } else if (token) {
      // Termasuk 403/501: simpan token baru, tetapi jangan ulangi mutasi otomatis.
      csrfToken = token;
    }
    if (!res.ok) {
      const err = new Error(data && data.error || 'Terjadi kesalahan sistem.');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /* ==========================================================================
     Ikon SVG
     ========================================================================== */
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

  const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
  const hydrate = root => $$('[data-ic]', root).forEach(e => { e.innerHTML = ic(e.dataset.ic); });

  /* ==========================================================================
     Data Cadangan Lokal (Offline Fallback saat API belum berjalan)
     ========================================================================== */
  const ld = (k, d) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  };
  const sv = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  };

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
      is_published: true,
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
      is_published: true,
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
      rc: 37,
      f: 'img/sate-padang.jpg',
      u: 'Tim FoodHub',
      c: 'Sate lidah dan daging sapi berkuah kuning kental kaya rempah, disajikan bersama ketupat hangat dan taburan bawang goreng.',
      is_published: true,
      b: [
        ['Daging dan lidah sapi', 500, 'g'],
        ['Tepung beras', 50, 'g'],
        ['Air kaldu rebusan daging', 500, 'ml'],
        ['Kunyit bakar', 2, 'ruas'],
        ['Serai memarkan', 2, 'batang'],
        ['Ketumbar bubuk', 1, 'sdm'],
        ['Jintan bubuk', 0.5, 'sdt'],
        ['Garam', 1.5, 'sdt']
      ],
      t: [
        'Rebus daging dan lidah sapi dengan bumbu rempah hingga empuk, lalu potong dadu dan tusuk ke lidi sate.',
        'Bakar sate di atas bara api sebentar hingga beraroma wangi khas panggangan.',
        'Larutkan tepung beras dengan air kaldu sisa rebusan yang telah dibumbui kunyit dan rempah.',
        'Masak kuah hingga mendidih dan mengental licin, lalu siramkan melimpah di atas sate hangat.'
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
      rc: 39,
      f: 'img/pempek.jpg',
      u: 'Tim FoodHub',
      c: 'Olahan ikan tenggiri kenyal gurih khas Palembang berisi telur bebek utuh, dinikmati bersama cuko asam pedas manis pekat.',
      is_published: true,
      b: [
        ['Daging ikan tenggiri giling', 500, 'g'],
        ['Tepung sagu / tapioka', 350, 'g'],
        ['Telur bebek untuk isian', 4, 'butir'],
        ['Air es', 250, 'ml'],
        ['Garam halus', 1.5, 'sdm'],
        ['Gula aren hitam', 300, 'g'],
        ['Asam jawa', 50, 'g'],
        ['Bawang putih', 50, 'g'],
        ['Cabai rawit hijau', 30, 'g']
      ],
      t: [
        'Campur ikan tenggiri giling dengan air es dan garam, aduk searah hingga adonan mengental kenyal.',
        'Masukkan tepung sagu bertahap sambil diuleni ringan agar pempek tidak menjadi keras saat matang.',
        'Bentuk adonan menjadi kantong lonjong, masukkan telur bebek mentah, lalu rekatkan rapat ujungnya.',
        'Rebus pempek dalam air mendidih banyak hingga terapung matang, angkat dan tiriskan.',
        'Goreng pempek hingga keemasan lalu sajikan bersama kuah cuko kental pedas asam segar.'
      ]
    },
    {
      id: 5,
      n: 'Soto Lamongan',
      p: 'Jawa Timur',
      k: ['Makanan Berat', 'Anak Kos'],
      w: 60,
      l: 'Sedang',
      s: 4,
      r: 4.8,
      rc: 34,
      f: 'img/soto-lamongan.jpg',
      u: 'Tim FoodHub',
      c: 'Soto ayam berkuah kuning bening gurih khas pesisir Jawa Timur dengan ciri khas taburan bubuk koya renyah gurih.',
      is_published: true,
      b: [
        ['Ayam kampung', 1, 'ekor'],
        ['Kerupuk udang goreng', 5, 'buah'],
        ['Bawang putih goreng', 4, 'siung'],
        ['Serai dan daun salam', 2, 'batang'],
        ['Kunyit dan jahe', 2, 'ruas'],
        ['Soun seduh', 100, 'g'],
        ['Telur rebus', 3, 'butir'],
        ['Tauge pendek', 100, 'g'],
        ['Garam dan merica', 1.5, 'sdt']
      ],
      t: [
        'Rebus ayam bersama serai, daun jeruk, dan daun salam hingga keluar kaldu ayam bening gurih.',
        'Tumis bumbu halus kuning hingga matang berminyak, masukkan ke dalam panci kaldu mendidih.',
        'Angkat ayam, tiriskan, lalu goreng sebentar hingga permukaan berkulit kecokelatan dan suwir-suwir.',
        'Tumbuk halus kerupuk udang bersama bawang putih goreng renyah untuk membuat bubuk koya gurih.',
        'Tata soun, tauge, telur rebus, dan suwiran ayam di mangkuk, siram kuah panas dan beri koya melimpah.'
      ]
    },
    {
      id: 6,
      n: 'Rawon',
      p: 'Jawa Timur',
      k: ['Makanan Berat'],
      w: 90,
      l: 'Sedang',
      s: 5,
      r: 4.9,
      rc: 31,
      f: 'img/rawon.jpg',
      u: 'Tim FoodHub',
      c: 'Sup daging sapi hitam pekat khas Jawa Timur berbumbu rempah kluwek matang yang gurih harum menggugah selera.',
      is_published: true,
      b: [
        ['Daging sapi sandung lamur', 500, 'g'],
        ['Kluwek tua pilihan', 5, 'buah'],
        ['Bawang merah', 8, 'siung'],
        ['Bawang putih', 5, 'siung'],
        ['Serai memarkan', 2, 'batang'],
        ['Daun jeruk purut', 4, 'lembar'],
        ['Tauge pendek segar', 100, 'g'],
        ['Sambal terasi', 2, 'sdm'],
        ['Garam', 1.5, 'sdt']
      ],
      t: [
        'Keluarkan isi kluwek dari cangkangnya, rendam air hangat lalu haluskan bersama bawang dan rempah bumbu.',
        'Tumis bumbu kluwek halus bersama serai dan daun jeruk purut hingga benar-benar harum matang.',
        'Rebus potongan daging sapi sandung lamur hingga empuk meresap, tuang bumbu tumis ke panci kaldu.',
        'Masak api kecil agar kuah hitam meresap kuat ke serat daging sapi.',
        'Sajikan hangat bersama nasi putih, tauge pendek segar, telur asin, dan sambal terasi terpisah.'
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
      rc: 28,
      f: 'img/gudeg.jpg',
      u: 'Tim FoodHub',
      c: 'Olahan nangka muda manis gurih khas Keraton Yogyakarta yang dimasak perlahan berjam-jam dengan santan dan gula aren.',
      is_published: true,
      b: [
        ['Nangka muda cacah kasar', 1000, 'g'],
        ['Gula aren kelapa murni', 250, 'g'],
        ['Santan kental kelapa', 1200, 'ml'],
        ['Daun jati untuk warna alami', 5, 'lembar'],
        ['Ketumbar sangrai', 2, 'sdm'],
        ['Bawang merah', 12, 'siung'],
        ['Bawang putih', 6, 'siung'],
        ['Kemiri sangrai', 6, 'butir'],
        ['Telur rebus', 6, 'butir']
      ],
      t: [
        'Alasi dasar panci tebal dengan daun jati agar gudeg menghasilkan warna cokelat kemerahan alami cantik.',
        'Tata potongan nangka muda, telur rebus, bumbu halus, santan kental, dan gula aren secara merata.',
        'Masak dengan api sangat kecil selama minimal 4 hingga 5 jam hingga kuah santan mengering meresap sempurna.',
        'Sajikan bersama sambal krecek pedas gurih, opor ayam suwir, dan areh santan kental gurih.'
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
      rc: 27,
      f: 'img/sate-lilit.jpg',
      u: 'Tim FoodHub',
      c: 'Cincangan daging ikan tenggiri lembut berpadu parutan kelapa muda dan rempah base genep Bali, dililitkan di batang serai harum.',
      is_published: true,
      b: [
        ['Daging ikan tenggiri cincang', 400, 'g'],
        ['Kelapa parut setengah tua', 150, 'g'],
        ['Batang serai segar tebal', 12, 'batang'],
        ['Bawang merah', 6, 'siung'],
        ['Bawang putih', 4, 'siung'],
        ['Cabai merah keriting', 4, 'buah'],
        ['Kunyit bakar', 2, 'ruas'],
        ['Santan kental', 50, 'ml'],
        ['Garam dan gula kelapa', 1, 'sdt']
      ],
      t: [
        'Haluskan bumbu base genep lalu tumis sebentar dengan sedikit minyak hingga harum berminyak matang.',
        'Campurkan ikan cincang, kelapa parut setengah tua, bumbu tumis, dan santan kental hingga adonan kalis lembut.',
        'Ambil sedikit adonan, tempelkan dan lilitkan padat merata mengelilingi ujung batang serai harum.',
        'Panggang sate lilit di atas pemanggang arang atau wajan datar anti lengket sambil dibalik perlahan hingga matang kecokelatan.'
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
      r: 4.9,
      rc: 29,
      f: 'img/ayam-betutu.jpg',
      u: 'Tim FoodHub',
      c: 'Ayam kampung utuh berbalur rempah bumbu genep komplit pedas gurih, dibungkus daun pisang lalu dipanggang matang meresap.',
      is_published: true,
      b: [
        ['Ayam kampung utuh bersih', 1, 'ekor'],
        ['Bawang merah rajang halus', 15, 'siung'],
        ['Bawang putih cincang', 8, 'siung'],
        ['Cabai rawit merah iris', 20, 'buah'],
        ['Kencur parut', 3, 'ruas'],
        ['Jahe dan lengkuas cincang', 3, 'ruas'],
        ['Kunyit bakar haluskan', 2, 'ruas'],
        ['Minyak kelapa asli', 4, 'sdm'],
        ['Daun pisang untuk membungkus', 3, 'lembar']
      ],
      t: [
        'Tumis campuran bumbu rajang kasar base genep dengan minyak kelapa asli hingga harum semerbak gurih.',
        'Balurkan bumbu tumis secara merata ke seluruh permukaan kulit ayam dan masukkan sebagian bumbu ke rongga dalam ayam.',
        'Bungkus rapat ayam berlapis daun pisang segar dan aluminium foil agar aroma bumbu rempah terkunci.',
        'Kukus ayam selama 45 menit lalu lanjutkan memanggang dalam oven atau bara sekam hingga bumbu mengering meresap.'
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
      rc: 22,
      f: 'img/papeda.jpg',
      u: 'Tim FoodHub',
      c: 'Papeda sagu kenyal lembut khas pesisir timur Nusantara disiram sup ikan tongkol kuah kuning beraroma kemangi dan asam jeruk nipis.',
      is_published: true,
      b: [
        ['Tepung sagu murni basah', 200, 'g'],
        ['Ikan tongkol segar potong', 500, 'g'],
        ['Air mendidih untuk menyiram sagu', 600, 'ml'],
        ['Kunyit segar haluskan', 3, 'ruas'],
        ['Kemangi segar', 2, 'ikat'],
        ['Jeruk nipis peras', 2, 'buah'],
        ['Cabai rawit utuh', 8, 'buah'],
        ['Bawang merah dan bawang putih', 6, 'siung'],
        ['Garam', 1.5, 'sdt']
      ],
      t: [
        'Larutkan tepung sagu dengan air dingin sedikit, lalu siram air mendidih mendidih sambil diaduk cepat searah hingga menjadi bubur bening kenyal.',
        'Tumis bumbu kuning hingga harum, tuangkan air kaldu dan masukkan potongan ikan tongkol segar.',
        'Masak ikan kuah kuning hingga matang, masukkan cabai rawit utuh, daun kemangi segar, dan perasan air jeruk nipis sesaat sebelum diangkat.',
        'Sajikan papeda kenyal dengan cara digulung memakai sumpit lalu siramkan kuah kuning ikan hangat melimpah.'
      ]
    },
    {
      id: 11,
      n: 'Gado-Gado',
      p: 'DKI Jakarta',
      k: ['Sehat', 'Makanan Berat', 'Cepat'],
      w: 35,
      l: 'Mudah',
      s: 3,
      r: 4.7,
      rc: 26,
      f: 'img/gado-gado.jpg',
      u: 'Tim FoodHub',
      c: 'Salad tradisional Betawi dari aneka sayuran rebus segar, tahu tempe goreng, disiram saus kacang tanah legit gurih beraroma limau.',
      is_published: true,
      b: [
        ['Kacang tanah goreng giling halus', 250, 'g'],
        ['Gula merah aren sisir', 50, 'g'],
        ['Santan encer matang', 200, 'ml'],
        ['Kangkung dan tauge rebus', 150, 'g'],
        ['Kacang panjang potong rebus', 100, 'g'],
        ['Tahu dan tempe goreng potong', 150, 'g'],
        ['Telur rebus belah dua', 2, 'butir'],
        ['Jeruk limau peras', 2, 'buah'],
        ['Kerupuk emping melinjo', 50, 'g']
      ],
      t: [
        'Masak kacang giling bersama santan encer, gula aren sisir, cabai, dan garam hingga meletup kental berminyak wangi.',
        'Beri perasan air jeruk limau harum ke dalam saus kacang hangat untuk aroma segar khas Betawi.',
        'Tata aneka sayuran rebus, kentang rebus, potongan tahu, dan tempe goreng renyah di piring saji lebar.',
        'Siram saus kacang melimpah di atas sayuran lalu taburi bawang goreng garing dan kerupuk emping renyah.'
      ]
    },
    {
      id: 12,
      n: 'Es Cendol',
      p: 'Jawa Tengah',
      k: ['Minuman', 'Cepat'],
      w: 40,
      l: 'Sedang',
      s: 4,
      r: 4.9,
      rc: 33,
      f: 'img/es-cendol.jpg',
      u: 'Tim FoodHub',
      c: 'Minuman es tradisional Jawa dengan cendol pandan hijau kenyal, siraman santan gurih segar, dan kinca gula kelapa nangka wangi.',
      is_published: true,
      b: [
        ['Tepung beras dan tepung hunkwe', 100, 'g'],
        ['Air daun pandan suji harum', 500, 'ml'],
        ['Gula merah aren kelapa', 250, 'g'],
        ['Santan kelapa segar rebus', 400, 'ml'],
        ['Nangka matang potong dadu', 5, 'butir'],
        ['Es batu serut secukupnya', 300, 'g'],
        ['Garam halus', 0.5, 'sdt']
      ],
      t: [
        'Masak larutan tepung beras dan sari pandan suji sambil diaduk rapat hingga mengental meletup bening kenyal.',
        'Cetak adonan hangat di atas saringan cendol langsung ke dalam wadah berisi air es agar cendol memadat kenyal.',
        'Rebus gula aren bersama daun pandan wangi dan potongan buah nangka hingga menjadi sirup kinca kental harum.',
        'Rebus santan segar dengan sejumput garam dan daun pandan hingga matang wangi lalu dinginkan.',
        'Susun sirup gula merah nangka, cendol pandan hijau, es serut dingin, lalu siram santan gurih di atasnya.'
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
      rc: 25,
      f: 'img/nasi-liwet.jpg',
      u: 'Tim FoodHub',
      c: 'Nasi gurih harum berbalur santan dan rempah daun salam, disajikan hangat dengan suwiran ayam opor lembut, sayur labu siam, dan areh santan.',
      is_published: true,
      b: [
        ['Beras pulen cuci bersih', 500, 'g'],
        ['Santan kelapa gurih', 750, 'ml'],
        ['Serai memarkan', 2, 'batang'],
        ['Daun salam segar', 4, 'lembar'],
        ['Ayam suwir opor gurih', 200, 'g'],
        ['Labu siam iris korek api tumis', 200, 'g'],
        ['Areh santan kental putih', 100, 'ml'],
        ['Garam', 1.5, 'sdt']
      ],
      t: [
        'Masak beras bersama santan, serai memarkan, daun salam harum, dan garam di panci tebal atau rice cooker hingga nasi tanak gurih.',
        'Masak tumis sayur labu siam pedas gurih berkuah santan encer hingga empuk meresap.',
        'Rebus santan kental dengan sedikit garam di api sangat kecil hingga menghasilkan gumpalan minyak areh gurih.',
        'Pincuk daun pisang, beri nasi liwet hangat, beri sayur labu siam, suwiran ayam opor lembut, dan siraman sesendok areh gurih.'
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
      r: 4.9,
      rc: 30,
      f: 'img/soto-makassar.jpg',
      u: 'Tim FoodHub',
      c: 'Sup daging sapi khas Makassar berkuah kaldu pekat gurih berbumbu rempah kacang tanah sangrai, disajikan bersama ketupat daun kelapa.',
      is_published: true,
      b: [
        ['Daging sapi sengkel dan babat', 600, 'g'],
        ['Kacang tanah sangrai giling halus', 150, 'g'],
        ['Air cucian beras putih (tajin)', 1500, 'ml'],
        ['Serai dan lengkuas memarkan', 3, 'batang'],
        ['Ketumbar dan jintan sangrai', 2, 'sdm'],
        ['Bawang merah dan bawang putih', 10, 'siung'],
        ['Kayu manis dan cengkih', 2, 'butir'],
        ['Garam dan gula', 1.5, 'sdt']
      ],
      t: [
        'Rebus daging sapi dalam air tajin (cucian beras) bersama serai dan lengkuas hingga daging empuk dan kaldu mengental gurih.',
        'Haluskan bumbu rempah aromatik lalu tumis hingga harum berminyak dan matang sempurna.',
        'Tuangkan bumbu tumis ke dalam panci rebusan kaldu daging, lalu masukkan kacang tanah sangrai giling halus.',
        'Aduk perlahan hingga kuah mengental kecokelatan gurih pekat beraroma khas Coto Makassar.',
        'Potong dadu daging sapi empuk, tata di mangkuk, siram kuah panas mendidih, beri daun bawang, seledri, dan perasan jeruk nipis.'
      ]
    }
  ];

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
  const byId = id => recipesList().find(r => String(r.id) === String(id));
  const rvAll = () => ld('fh_rv', {});
  const rat = r => {
    const v = rvAll()[r.id] || [];
    const n = (r.rc || 0) + v.length;
    if (!n) return null;
    let s = (r.r || 0) * (r.rc || 0);
    v.forEach(x => { s += x.s; });
    return { a: s / n, n };
  };

  /* Migrasi identitas lokal lama; sesi kini hanya dikelola server. */
  const clearLegacyAuth = () => {
    try { sessionStorage.removeItem('fh_s'); } catch (e) {}
    try { localStorage.removeItem('fh_s'); } catch (e) {}
  };
  const users = () => {
    let u = ld('fh_users', null);
    if (!u) {
      u = [
        { name: 'Admin FoodHub', email: 'admin@foodhub.id', role: 'admin', fav: [], at: '2026-08-01' },
        { name: 'Raka Pratama', email: 'raka@contoh.id', role: 'member', fav: [1, 2], at: '2026-09-12' },
        { name: 'Nadia Putri', email: 'nadia@contoh.id', role: 'member', fav: [3], at: '2026-10-03' }
      ];
      sv('fh_users', u);
    }
    // Hapus hanya password demo lama, tanpa membuang akun atau data fitur lokal.
    if (Array.isArray(u) && u.some(x => Object.prototype.hasOwnProperty.call(x, 'pass'))) {
      u = u.map(x => {
        const user = { ...x };
        delete user.pass;
        return user;
      });
      sv('fh_users', u);
    }
    return u;
  };

  let U = null;
  const AUTH_INVALID = 'Respons autentikasi server tidak valid. Silakan coba lagi.';
  const AUTH_UNAVAILABLE = 'Tidak dapat memeriksa sesi. Pastikan backend tersedia, lalu coba masuk lagi.';

  function authResponse(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || 'error' in data) {
      throw new Error(AUTH_INVALID);
    }
    return data;
  }

  function authUser(data, allowGuest = false) {
    const user = authResponse(data).user;
    if (allowGuest && user === null) return null;
    const validId = user && (Number.isSafeInteger(user.id) && user.id > 0 ||
      typeof user.id === 'string' && /^[1-9]\d*$/.test(user.id));
    if (!validId || typeof user.name !== 'string' || !user.name.trim() ||
        typeof user.email !== 'string' || !user.email.trim() ||
        !['member', 'admin'].includes(user.role)) {
      throw new Error(AUTH_INVALID);
    }
    return user;
  }

  let loggingOut = false;
  async function logout() {
    if (loggingOut) return;
    loggingOut = true;
    const buttons = $$('#lo, #alo');
    buttons.forEach(button => { button.disabled = true; });
    try {
      const res = authResponse(await api('auth.php?action=logout', { method: 'POST' }));
      if (typeof res.message !== 'string' || !res.message.trim()) throw new Error(AUTH_INVALID);
      U = null;
      clearLegacyAuth();
      location.href = R + 'index.html';
    } catch (err) {
      toast('Gagal keluar. ' + (err.message || 'Silakan coba lagi.'));
    } finally {
      loggingOut = false;
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  function bindAuthSubmit(form, submit) {
    let pending = false;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (pending) return;
      pending = true;
      const buttons = $$('[type="submit"]', form);
      buttons.forEach(button => { button.disabled = true; });
      try {
        await submit();
      } finally {
        pending = false;
        buttons.forEach(button => { button.disabled = false; });
      }
    });
  }

  /* ==========================================================================
     Tampilan Kartu Resep (Sesuai Foto 1: 3 kartu sebaris, foto 240px, deskripsi)
     ========================================================================== */
  function card(r) {
    const title = esc(r.title || r.n);
    const desc = esc(r.story || r.c || '');
    const time = r.cook_time_minutes || r.w || 30;
    const diff = esc(r.difficulty ? (r.difficulty.charAt(0).toUpperCase() + r.difficulty.slice(1)) : (r.l || 'Sedang'));
    const ratingVal = r.avg_rating != null ? r.avg_rating : (rat(r) ? rat(r).a : null);
    const ratingTxt = ratingVal ? ('★ ' + Number(ratingVal).toFixed(1)) : 'Belum ada rating';
    const imgFile = r.image_path || r.f || '';
    const imgUrl = imgFile ? (R + esc(imgFile)) : '';

    return `
      <a class="card" href="${R}detail-resep.html?id=${encodeURIComponent(r.id)}">
        <div class="thumb">
          ${imgUrl ? `<img src="${imgUrl}" alt="${title}">` : ic('bowl')}
        </div>
        <div class="cb">
          <h3>${title}</h3>
          ${desc ? `<p class="desc">${desc}</p>` : ''}
          <div class="meta">
            <span>${ic('clock')} ${time} mnt</span>
            <span>${diff}</span>
            <span class="gold">${ratingTxt}</span>
          </div>
        </div>
      </a>
    `;
  }

  const goLogin = () => {
    location.href = R + 'masuk.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
  };

  /* ==========================================================================
     Komponen Bersama: Navigasi, Footer, Sidebar Admin
     ========================================================================== */
  function buildNav() {
    const L = [
      ['index', 'Beranda'],
      ['daftar-resep', 'Resep'],
      ['faq', 'FAQ']
    ];
    const cur = { 'detail-resep': 'daftar-resep' }[P] || P;

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
        <a class="logo" href="${R}index.html" aria-label="Beranda FoodHub">
          <img src="${R}img/logo-foodhub.jpg" alt="FoodHub">
        </a>
        <button class="burger" id="bg" aria-label="Buka menu navigasi" aria-expanded="false">
          ${ic('menu')}
        </button>
        <nav class="nl" id="nl" aria-label="Navigasi utama">${links}</nav>
        <div class="na">${auth}</div>
      </div>
    `;

    $('#bg').addEventListener('click', () => {
      const open = $('#nl').classList.toggle('open');
      $('#bg').setAttribute('aria-expanded', String(open));
    });

    const av = $('#avb');
    if (av) {
      av.addEventListener('click', e => {
        e.stopPropagation();
        const d = $('#dd');
        const open = !d.hidden;
        d.hidden = open;
        av.setAttribute('aria-expanded', String(!open));
      });
      document.addEventListener('click', () => {
        const d = $('#dd');
        if (d) d.hidden = true;
        if (av) av.setAttribute('aria-expanded', 'false');
      });
    }

    const lo = $('#lo');
    if (lo) lo.addEventListener('click', logout);

    buildFoot();
  }

  function buildFoot() {
    const f = $('#foot');
    if (!f) return;
    const L = [
      ['index', 'Beranda'],
      ['daftar-resep', 'Resep'],
      ['faq', 'FAQ']
    ];
    f.innerHTML = `
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
      <span class="muted">${esc(U ? U.name : 'Admin')}</span>
    `;

    $('#sbt').addEventListener('click', () => $('#side').classList.toggle('open'));
    $('#alo').addEventListener('click', logout);
  }

  function buildTabs() {
    const t = $('#tabs');
    if (t) t.remove();
  }

  const bar = (el, m, ok) => {
    el.className = ok ? 'ok' : 'err';
    el.textContent = m;
    el.hidden = false;
  };

  const list = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;

  /* ==========================================================================
     Inisialisasi Sesi & Proteksi Akses
     ========================================================================== */
  async function initAuth() {
    const protectedContent = ACC ? $$('main, #nav, #side, #top, #foot').map(el => ({ el, hidden: el.hidden })) : [];
    protectedContent.forEach(({ el }) => { el.hidden = true; });
    U = null;
    csrfToken = null;
    clearLegacyAuth();
    let unavailable = false;
    try {
      U = authUser(await api('auth.php?action=me'), true);
    } catch (e) {
      U = null;
      unavailable = true;
      toast(AUTH_UNAVAILABLE + (e.message === CSRF_INVALID ? ' ' + CSRF_INVALID : ''));
    }
    // Teruskan notifikasi setelah redirect tanpa menyimpan identitas di browser.
    const notice = unavailable ? '&auth=unavailable' : '';

    if (ACC === 'member' && !U) {
      location.replace(R + 'masuk.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search) + notice);
      return false;
    }

    if (ACC === 'admin') {
      if (!U) {
        location.replace(R + 'masuk.html?next=' + encodeURIComponent('admin/' + location.pathname.split('/').pop()) + notice);
        return false;
      }
      if (U.role !== 'admin') {
        location.replace(R + 'index.html');
        return false;
      }
    }

    if ($('#nav')) buildNav();
    if ($('#side')) buildAdmin();
    protectedContent.forEach(({ el, hidden }) => { el.hidden = hidden; });
    return true;
  }

  /* ==========================================================================
     Router Logika Halaman (PG) Mengambil Data dari API
     ========================================================================== */
  const PG = {
    async index() {
      // Kategori
      try {
        const { categories } = await api('categories.php');
        $('#cats').innerHTML = '<a class="chip on" href="daftar-resep.html">Semua</a>' +
          categories.map(c => `<a class="chip" href="daftar-resep.html?kat=${encodeURIComponent(c.name)}">${esc(c.name)}</a>`).join('');
      } catch (e) {
        $('#cats').innerHTML = '<a class="chip on" href="daftar-resep.html">Semua</a>' +
          cats().map(c => `<a class="chip" href="daftar-resep.html?kat=${encodeURIComponent(c)}">${esc(c)}</a>`).join('');
      }

      // Resep Populer (3 kartu dalam 1 baris sesuai Foto 1)
      try {
        const { recipes } = await api('recipes.php?sort=popular&limit=3');
        $('#pop').innerHTML = recipes.map(card).join('');
      } catch (e) {
        const top = all().slice().sort((x, y) => ((rat(y) || { a: 0 }).a) - ((rat(x) || { a: 0 }).a)).slice(0, 3);
        $('#pop').innerHTML = top.map(card).join('');
      }

      $('#heroForm')?.addEventListener('submit', e => {
        e.preventDefault();
        location.href = 'daftar-resep.html?q=' + encodeURIComponent($('#q').value.trim());
      });
    },

    async 'daftar-resep'() {
      const f = {
        q: $('#fq'),
        k: $('#fk'),
        w: $('#fw'),
        l: $('#fl')
      };

      try {
        const { categories } = await api('categories.php');
        f.k.innerHTML = '<option value="">Semua kategori</option>' +
          categories.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
      } catch (e) {
        f.k.innerHTML = '<option value="">Semua kategori</option>' +
          cats().map(c => `<option>${esc(c)}</option>`).join('');
      }

      f.q.value = qs.get('q') || '';
      f.k.value = qs.get('kat') || '';

      const run = async () => {
        const q = f.q.value.trim();
        const cat = f.k.value;
        const w = +f.w.value;
        const l = f.l.value;

        try {
          const params = new URLSearchParams();
          if (q) params.set('q', q);
          if (cat) params.set('category', cat);
          if (w && w !== 999) params.set('max_time', w);
          if (l) params.set('difficulty', l.toLowerCase());
          params.set('sort', 'popular');

          const { recipes } = await api('recipes.php?' + params.toString());
          $('#cnt').textContent = `${recipes.length} resep ditemukan`;
          $('#rl').innerHTML = recipes.length
            ? recipes.map(card).join('')
            : '<p class="empty">Tidak ada resep yang cocok. Ubah kata kunci atau longgarkan filter.</p>';
        } catch (e) {
          const ql = q.toLowerCase();
          const L = all().filter(r => {
            const matchQ = !ql || (r.n + ' ' + (r.p || '') + ' ' + (r.b || []).map(i => Array.isArray(i) ? i[0] : (i.name || '')).join(' ')).toLowerCase().includes(ql);
            const matchK = !cat || (r.k && r.k.includes(cat));
            const matchW = !w || (w === 999 ? r.w > 60 : r.w <= w);
            const matchL = !l || (r.l && r.l.toLowerCase() === l.toLowerCase());
            return matchQ && matchK && matchW && matchL;
          });

          $('#cnt').textContent = `${L.length} resep ditemukan`;
          $('#rl').innerHTML = L.length
            ? L.map(card).join('')
            : '<p class="empty">Tidak ada resep yang cocok. Ubah kata kunci atau longgarkan filter.</p>';
        }
      };

      ['input', 'change'].forEach(ev => {
        f.q.addEventListener(ev, run);
        f.k.addEventListener(ev, run);
        f.w.addEventListener(ev, run);
        f.l.addEventListener(ev, run);
      });

      $('#fr').addEventListener('click', () => {
        f.q.value = '';
        f.k.value = '';
        f.w.value = '0';
        f.l.value = '';
        run();
      });

      run();
    },

    faq() {
      const chips = $$('#faqFilter .chip');
      const groups = $$('.faq-group');
      const modal = $('#modalFaq');
      const form = $('#formTambahFaq');
      const btnBuka = $('#btnBukaModalFaq');
      const btnTutup = $('#btnTutupFaq');
      const btnBatal = $('#btnBatalFaq');

      const FAQ_KEY = 'fh_custom_faqs';
      const getCustomFaqs = () => ld(FAQ_KEY, []);
      const saveCustomFaqs = list => sv(FAQ_KEY, list);

      const renderCustomFaqs = () => {
        const list = getCustomFaqs();
        $$('.faq-custom-container').forEach(c => { c.innerHTML = ''; });

        list.forEach(item => {
          const container = $(`[data-custom-group="${item.group}"]`);
          if (!container) return;

          const details = document.createElement('details');
          details.className = 'faq-item-custom';
          details.innerHTML = `
            <summary>
              <span>${esc(item.q)}</span>
            </summary>
            <div>
              <p>${esc(item.a)}</p>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.8rem;padding-top:.5rem;border-top:1px dashed var(--line);font-size:.82rem">
                <span class="muted"><span class="tag" style="font-size:.7rem;padding:.1em .5em">Kustom</span> Ditambahkan langsung</span>
                <button type="button" class="btn danger sm" data-del-faq="${item.id}" style="padding:.2rem .6rem;font-size:.78rem">
                  ${ic('trash')} Hapus
                </button>
              </div>
            </div>
          `;
          container.appendChild(details);
        });
      };

      const openModal = () => {
        if (!modal) return;
        const activeChip = $('#faqFilter .chip.on');
        const activeCat = activeChip ? activeChip.dataset.cat : 'all';
        if (activeCat && activeCat !== 'all' && $('#faqKat')) {
          $('#faqKat').value = activeCat;
        }
        form?.reset();
        modal.hidden = false;
        $('#faqTanya')?.focus();
      };

      const closeModal = () => {
        if (modal) modal.hidden = true;
      };

      if (btnBuka) btnBuka.addEventListener('click', openModal);
      if (btnTutup) btnTutup.addEventListener('click', closeModal);
      if (btnBatal) btnBatal.addEventListener('click', closeModal);
      if (modal) {
        modal.addEventListener('click', e => {
          if (e.target === modal) closeModal();
        });
      }

      if (form) {
        form.addEventListener('submit', e => {
          e.preventDefault();
          const q = $('#faqTanya').value.trim();
          const a = $('#faqJawab').value.trim();
          const group = $('#faqKat').value;

          if (!q || !a) {
            toast('Pertanyaan dan jawaban wajib diisi.');
            return;
          }

          const current = getCustomFaqs();
          const newFaq = {
            id: Date.now(),
            group,
            q,
            a,
            created_at: new Date().toISOString()
          };
          current.push(newFaq);
          saveCustomFaqs(current);

          renderCustomFaqs();
          closeModal();
          toast('Pertanyaan FAQ baru berhasil ditambahkan!');

          const activeChip = $('#faqFilter .chip.on');
          if (activeChip && activeChip.dataset.cat !== 'all' && activeChip.dataset.cat !== group) {
            const targetChip = $(`#faqFilter .chip[data-cat="${group}"]`);
            if (targetChip) targetChip.click();
          }
        });
      }

      document.addEventListener('click', e => {
        const delBtn = e.target.closest('[data-del-faq]');
        if (!delBtn) return;
        const id = +delBtn.dataset.delFaq;
        if (!confirm('Apakah Anda yakin ingin menghapus pertanyaan ini?')) return;

        const current = getCustomFaqs();
        saveCustomFaqs(current.filter(x => x.id !== id));
        renderCustomFaqs();
        toast('Pertanyaan FAQ berhasil dihapus.');
      });

      if (chips.length) {
        chips.forEach(btn => {
          btn.addEventListener('click', () => {
            chips.forEach(b => b.classList.remove('on'));
            btn.classList.add('on');
            const cat = btn.dataset.cat;
            groups.forEach(g => {
              g.hidden = !(cat === 'all' || g.dataset.group === cat);
            });
          });
        });
      }

      renderCustomFaqs();
    },

    async 'detail-resep'() {
      const id = qs.get('id');
      const box = $('#dr');
      if (!id) {
        box.innerHTML = '<div class="empty"><h2>Resep tidak ditemukan</h2><a class="btn" href="daftar-resep.html">Lihat semua resep</a></div>';
        return;
      }

      let r = null;
      try {
        const res = await api('recipes.php?id=' + encodeURIComponent(id));
        r = res.recipe;
      } catch (e) {
        r = byId(id);
      }

      if (!r) {
        box.innerHTML = '<div class="empty"><h2>Resep tidak ditemukan</h2><a class="btn" href="daftar-resep.html">Lihat semua resep</a></div>';
        return;
      }

      const title = r.title || r.n;
      document.title = title + ' | FoodHub';
      let sv_ = r.servings || r.s || 4;
      const baseServings = r.servings || r.s || 4;
      const ingredients = r.ingredients || (r.b || []).map(x => Array.isArray(x) ? { name: x[0], quantity: x[1], unit: x[2] } : x);
      const steps = r.steps || r.t || [];
      const reviews = r.reviews || (rvAll()[r.id] || []).map(v => ({ user_name: v.u || 'Pengguna', rating: v.s, comment: v.c, created_at: v.at }));
      const story = r.story || r.c || '';
      const cookTime = r.cook_time_minutes || r.w || 30;
      const diff = r.difficulty ? (r.difficulty.charAt(0).toUpperCase() + r.difficulty.slice(1)) : (r.l || 'Sedang');
      const author = r.author || r.u || 'Tim FoodHub';
      const categories = r.categories || r.k || [];
      let isFav = !!r.is_favorite;

      box.innerHTML = `
        <div class="crumb">
          <a href="index.html">Beranda</a> / <a href="daftar-resep.html">Resep</a> / ${esc(title)}
        </div>

        <div class="dhead">
          ${card({ ...r, n: title, story, c: story }).match(/<div class="thumb[\s\S]*?<\/div>/)?.[0] || thumb(r)}
          <div>
            <div class="tags">
              ${r.region ? `<span class="tag r">${esc(r.region)}</span>` : (r.p ? `<span class="tag r">${esc(r.p)}</span>` : '')}
              ${categories.map(k => `<span class="tag">${esc(k)}</span>`).join('')}
            </div>
            <h1>${esc(title)}</h1>
            <p class="muted">Oleh ${esc(author)}</p>
            <div class="tiles">
              <div class="tile"><b>${cookTime} mnt</b><span>Waktu</span></div>
              <div class="tile"><b>${esc(diff)}</b><span>Tingkat</span></div>
              <div class="tile"><b id="pt">${sv_}</b><span>Porsi</span></div>
              <div class="tile"><b id="rt">★ ${r.avg_rating != null ? Number(r.avg_rating).toFixed(1) : (rat(r)?.a.toFixed(1) || '-')}</b><span>Rating</span></div>
            </div>
            <div class="chips">
              <button class="btn" id="fv" type="button">
                ${ic('heart')} <span id="fvt">${isFav ? 'Tersimpan di Favorit' : 'Simpan ke Favorit'}</span>
              </button>
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
                  <b id="sv">${sv_}</b>
                  <button type="button" id="pl" aria-label="Tambah porsi">${ic('plus')}</button>
                </div>
              </div>
              <ul class="ing" id="ig">
                ${ingredients.map((ing, idx) => `
                  <li>
                    <input type="checkbox" id="b${idx}">
                    <label for="b${idx}">${esc(ing.name || ing[0])}</label>
                    <span class="am" data-i="${idx}"></span>
                  </li>
                `).join('')}
              </ul>
              ${story ? `
                <div class="story">
                  <h3>Cerita di balik resep</h3>
                  <p>${esc(story)}</p>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="panel">
            <h2>Langkah memasak</h2>
            <ol class="steps">
              ${steps.map(s => `<li><span>${esc(s)}</span></li>`).join('')}
            </ol>

            <h2 style="margin-top:2rem">Ulasan dan rating</h2>
            <div id="rf">
              ${U ? `
                <form id="rvForm" style="margin-bottom:1.5rem">
                  <div class="err" id="re" hidden></div>
                  <div class="fld">
                    <label>Beri rating</label>
                    <div class="stars">
                      ${[1, 2, 3, 4, 5].map(v => `<button type="button" data-val="${v}">★</button>`).join('')}
                    </div>
                  </div>
                  <div class="fld">
                    <label for="rc">Ulasan Anda</label>
                    <textarea id="rc" rows="2" placeholder="Bagikan pengalaman memasak Anda..."></textarea>
                  </div>
                  <button class="btn sm" type="submit">Kirim Ulasan</button>
                </form>
              ` : `
                <p class="muted sm"><a href="masuk.html?next=detail-resep.html?id=${encodeURIComponent(id)}"><b>Masuk</b></a> untuk memberikan ulasan dan rating.</p>
              `}
            </div>
            <div id="rl">
              ${reviews.length ? reviews.map(rv => `
                <div class="rev">
                  <div style="display:flex;justify-content:space-between;margin-bottom:.3rem">
                    <strong>${esc(rv.user_name || rv.name || 'Pengguna')}</strong>
                    <span class="gold">★ ${rv.rating || rv.s}</span>
                  </div>
                  <p style="margin:0;font-size:.92rem">${esc(rv.comment || rv.c || '')}</p>
                  <small class="muted">${esc((rv.created_at || rv.at || '').slice(0, 10))}</small>
                </div>
              `).join('') : '<p class="empty" style="padding:1rem 0">Belum ada ulasan untuk resep ini.</p>'}
            </div>
          </div>
        </div>
      `;

      // Kalkulator porsi dinamis
      const updateAmounts = () => {
        $$('.am').forEach(el => {
          const ing = ingredients[+el.dataset.i];
          const qty = ing.quantity != null ? ing.quantity : ing[1];
          const unit = ing.unit || ing[2] || '';
          if (qty != null && !isNaN(qty)) {
            el.textContent = `${fmt(qty * sv_ / baseServings)} ${unit}`.trim();
          } else {
            el.textContent = unit || 'secukupnya';
          }
        });
        $('#sv').textContent = sv_;
        $('#pt').textContent = sv_;
      };
      updateAmounts();

      $('#mn').addEventListener('click', () => { if (sv_ > 1) { sv_--; updateAmounts(); } });
      $('#pl').addEventListener('click', () => { if (sv_ < 50) { sv_++; updateAmounts(); } });

      // Simpan ke favorit
      $('#fv').addEventListener('click', async () => {
        if (!U) { goLogin(); return; }
        try {
          if (isFav) {
            await api('favorites.php?recipe_id=' + encodeURIComponent(id), { method: 'DELETE' });
            isFav = false;
            $('#fvt').textContent = 'Simpan ke Favorit';
            toast('Resep dihapus dari favorit.');
          } else {
            await api('favorites.php', { method: 'POST', body: { recipe_id: id } });
            isFav = true;
            $('#fvt').textContent = 'Tersimpan di Favorit';
            toast('Resep disimpan ke favorit!');
          }
        } catch (e) {
          toast(e.message || 'Gagal mengubah favorit.');
        }
      });

      // Bagikan
      $('#sh').addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(location.href);
          toast('Tautan resep disalin ke papan klip!');
        } else {
          toast('Tautan: ' + location.href);
        }
      });

      // Bintang ulasan
      let selectedStars = 5;
      $$('.stars button').forEach((btn, idx) => {
        if (idx === 4) btn.classList.add('on');
        btn.addEventListener('click', () => {
          selectedStars = idx + 1;
          $$('.stars button').forEach((b, i) => b.classList.toggle('on', i <= idx));
        });
      });

      $('#rvForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const comment = $('#rc').value.trim();
        try {
          await api('reviews.php', {
            method: 'POST',
            body: { recipe_id: id, rating: selectedStars, comment }
          });
          toast('Ulasan berhasil dikirim!');
          location.reload();
        } catch (err) {
          bar($('#re'), err.message || 'Gagal mengirim ulasan.');
        }
      });
    },

    async profil() {
      let profileUser = U;
      try {
        const res = await api('profile.php');
        profileUser = res.user || U;
      } catch (e) {}

      let favList = [];
      try {
        const res = await api('favorites.php');
        favList = res.recipes || [];
      } catch (e) {
        favList = (U && U.fav ? U.fav : []).map(byId).filter(r => r && !hid().includes(r.id));
      }

      const render = () => {
        $('#pf').innerHTML = `
          <div class="sec-h" style="margin-bottom:1rem">
            <h1>Informasi Profil</h1>
          </div>
          <div class="panel">
            <div class="row" style="border:0;padding:0;box-shadow:none">
              <span class="av" style="display:grid;place-items:center;width:64px;height:64px;font-size:1.6rem">
                ${esc(profileUser.name.charAt(0).toUpperCase())}
              </span>
              <div class="grow">
                <h2 style="margin:0">${esc(profileUser.name)}</h2>
                <span class="muted">${esc(profileUser.email)} · ${profileUser.role === 'admin' ? 'Admin' : 'Member'} · bergabung ${esc((profileUser.created_at || profileUser.at || '-').slice(0, 10))}</span>
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
                <input id="nn" value="${esc(profileUser.name)}" maxlength="40">
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

        $('#nf').addEventListener('submit', async e => {
          e.preventDefault();
          const v = $('#nn').value.trim();
          $('#no').hidden = true;
          if (v.length < 3) {
            bar($('#ne'), 'Nama minimal 3 karakter.');
            return;
          }
          try {
            const res = await api('profile.php', {
              method: 'POST',
              body: { name: v }
            });
            profileUser = res.user;
            U = res.user;
            bar($('#no'), 'Perubahan tersimpan.', true);
            buildNav();
          } catch (err) {
            bar($('#ne'), err.message || 'Gagal menyimpan perubahan.');
          }
        });
      };

      render();

      $('#pf').addEventListener('click', async e => {
        const b = e.target.closest('[data-u]');
        if (!b) return;
        const id = +b.dataset.u;
        try {
          await api('favorites.php?recipe_id=' + encodeURIComponent(id), { method: 'DELETE' });
          favList = favList.filter(r => r.id !== id);
          render();
          toast('Resep dihapus dari favorit.');
        } catch (err) {
          toast(err.message || 'Gagal menghapus favorit.');
        }
      });
    },

    masuk() {
      if (U) {
        location.replace(U.role === 'admin' ? 'admin/dasbor.html' : 'profil.html');
        return;
      }
      if (qs.get('auth') === 'unavailable') bar($('#er'), AUTH_UNAVAILABLE);
      bindAuthSubmit($('#lf'), async () => {
        const em = $('#em').value.trim().toLowerCase();
        const pw = $('#pw').value;
        const er = $('#er');

        if (!em || !pw) {
          bar(er, 'Email dan kata sandi wajib diisi.');
          return;
        }

        try {
          const res = await api('auth.php?action=login', {
            method: 'POST',
            body: { email: em, password: pw, remember: $('#ing').checked }
          });
          U = authUser(res);
          clearLegacyAuth();
          const nx = qs.get('next');
          location.href = nx && /^(admin\/)?[a-z-]+\.html(\?[\w=&%.\-]*)?$/i.test(nx)
            ? nx
            : (U.role === 'admin' ? 'admin/dasbor.html' : 'index.html');
        } catch (err) {
          bar(er, err.message || 'Email atau kata sandi salah.');
        }
      });
    },

    daftar() {
      if (U) {
        location.replace('profil.html');
        return;
      }
      bindAuthSubmit($('#df'), async () => {
        const nm = $('#dn').value.trim();
        const em = $('#de').value.trim().toLowerCase();
        const pw = $('#dp').value;
        const Er = [];

        if (nm.length < 3) Er.push('Nama minimal 3 karakter.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) Er.push('Format email tidak valid.');
        if (pw.length < 8) Er.push('Kata sandi minimal 8 karakter.');
        if (pw !== $('#dk').value) Er.push('Konfirmasi kata sandi tidak sama.');
        if (!$('#ds').checked) Er.push('Centang persetujuan syarat penggunaan.');

        if (Er.length) {
          $('#er').innerHTML = list(Er);
          $('#er').hidden = false;
          return;
        }

        try {
          const res = await api('auth.php?action=register', {
            method: 'POST',
            body: { name: nm, email: em, password: pw }
          });
          U = authUser(res);
          clearLegacyAuth();
          toast('Pendaftaran berhasil!');
          location.href = 'index.html';
        } catch (err) {
          $('#er').innerHTML = `<p>${esc(err.message || 'Pendaftaran gagal.')}</p>`;
          $('#er').hidden = false;
        }
      });
    },

    /* ==========================================================================
       Halaman Admin (Terhubung ke api/admin/recipes.php)
       ========================================================================== */
    async dasbor() {
      let list = [];
      try {
        const res = await api('admin/recipes.php');
        list = res.recipes || [];
      } catch (e) {
        list = recipesList();
      }
      const total = list.length;
      const tayang = list.filter(r => r.is_published !== false && !hid().includes(r.id)).length;
      const hidden = total - tayang;

      $('#ds').innerHTML = `
        <div class="stat">
          <div class="panel"><b>${total}</b>Total resep</div>
          <div class="panel"><b>${tayang}</b>Resep tayang</div>
          <div class="panel"><b>${hidden}</b>Resep disembunyikan</div>
          <div class="panel"><b>${users().length}</b>Pengguna</div>
        </div>
        <div class="row">
          <div class="grow">
            <b>Kelola resep</b><br>
            <span class="muted sm">Tambah, edit, hapus, dan moderasi (sembunyi/tayang) resep.</span>
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

    async 'kelola-resep'() {
      const rootEl = $('#kr') || $('#md');
      if (!rootEl) return;

      let list = [];
      const loadData = async () => {
        try {
          const res = await api('admin/recipes.php');
          list = res.recipes || [];
        } catch (e) {
          list = recipesList();
        }
        draw();
      };

      const draw = () => {
        const total = list.length;
        const tayang = list.filter(r => r.is_published !== false && !hid().includes(r.id)).length;
        const hidden = total - tayang;

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
            <div class="panel"><b>${total}</b>Total resep</div>
            <div class="panel"><b>${tayang}</b>Tayang</div>
            <div class="panel"><b>${hidden}</b>Disembunyikan</div>
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
                  const isPub = r.is_published !== false && !hid().includes(r.id);
                  const title = r.title || r.n;
                  const region = r.region || r.p || '-';
                  const catsList = (r.categories || r.k || []);
                  const time = r.cook_time_minutes || r.w || 30;
                  const servings = r.servings || r.s || 4;
                  const imgUrl = (r.image_path || r.f) ? (R + esc(r.image_path || r.f)) : '';
                  const desc = r.story || r.c || '';

                  return `
                    <tr>
                      <td>
                        ${imgUrl
                          ? `<img class="t-thumb" src="${imgUrl}" alt="${esc(title)}">`
                          : `<div class="t-thumb" style="display:grid;place-items:center">${ic('bowl')}</div>`
                        }
                      </td>
                      <td>
                        <strong>${esc(title)}</strong>
                        ${desc ? `<div class="muted sm" style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(desc)}</div>` : ''}
                      </td>
                      <td>${esc(region)}</td>
                      <td>${catsList.map(k => `<span class="tag">${esc(k)}</span>`).join(' ')}</td>
                      <td>${time} mnt · ${servings} porsi</td>
                      <td>
                        <span class="sts ${isPub ? 'disetujui' : 'ditolak'}">
                          ${isPub ? 'tayang' : 'disembunyikan'}
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
                          <button class="btn sm ${isPub ? 'ghost' : ''}" type="button" data-toggle="${r.id}" data-pub="${isPub ? '1' : '0'}" title="${isPub ? 'Sembunyikan' : 'Tampilkan'}">
                            ${isPub ? 'Sembunyi' : 'Tayang'}
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
                      <option value="mudah">Mudah</option>
                      <option value="sedang" selected>Sedang</option>
                      <option value="sulit">Sulit</option>
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

      const openModal = async (recipe) => {
        const modal = $('#recipeModal');
        if (!modal) return;
        const title = $('#modalTitle');
        const form = $('#recipeForm');

        if (recipe) {
          title.textContent = 'Edit Resep: ' + (recipe.title || recipe.n);
          $('#rf_id').value = recipe.id;
          $('#rf_n').value = recipe.title || recipe.n || '';
          $('#rf_p').value = recipe.region || recipe.p || '';
          $('#rf_k').value = (recipe.categories && recipe.categories[0]) ? recipe.categories[0] : ((recipe.k && recipe.k[0]) ? recipe.k[0] : 'Makanan Berat');
          $('#rf_w').value = recipe.cook_time_minutes || recipe.w || 45;
          $('#rf_l').value = (recipe.difficulty || recipe.l || 'sedang').toLowerCase();
          $('#rf_s').value = recipe.servings || recipe.s || 4;
          $('#rf_f').value = recipe.image_path || recipe.f || '';
          $('#rf_c').value = recipe.story || recipe.c || '';

          let ingredients = recipe.ingredients || recipe.b || [];
          let steps = recipe.steps || recipe.t || [];
          if (!ingredients.length || !steps.length) {
            try {
              const res = await api('admin/recipes.php?id=' + encodeURIComponent(recipe.id));
              if (res.recipe) {
                ingredients = res.recipe.ingredients || ingredients;
                steps = res.recipe.steps || steps;
              }
            } catch (e) {}
          }
          $('#rf_b').value = ingredients.map(x => typeof x === 'object' && x.name ? `${x.name}, ${x.quantity || ''}, ${x.unit || ''}` : (Array.isArray(x) ? x.join(', ') : x)).join('\n');
          $('#rf_t').value = steps.join('\n');
        } else {
          title.textContent = 'Tambah Resep Baru';
          form.reset();
          $('#rf_id').value = '';
          $('#rf_w').value = 45;
          $('#rf_s').value = 4;
          $('#rf_l').value = 'sedang';
          $('#rf_k').value = 'Makanan Berat';
          $('#rf_f').value = 'img/rendang.jpg';
        }
        modal.hidden = false;
      };

      const closeModal = () => {
        const modal = $('#recipeModal');
        if (modal) modal.hidden = true;
      };

      rootEl.addEventListener('click', async e => {
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
          const r = list.find(x => x.id === id);
          if (r) openModal(r);
          return;
        }
        const delBtn = e.target.closest('[data-del]');
        if (delBtn) {
          const id = +delBtn.dataset.del;
          const r = list.find(x => x.id === id);
          if (!r) return;
          if (!confirm(`Apakah Anda yakin ingin menghapus resep "${r.title || r.n}"?`)) return;
          try {
            await api('admin/recipes.php?id=' + encodeURIComponent(id), { method: 'DELETE' });
            toast('Resep berhasil dihapus.');
          } catch (err) {
            toast(err.message || 'Resep dihapus.');
          }
          loadData();
          return;
        }
        const toggleBtn = e.target.closest('[data-toggle]');
        if (toggleBtn) {
          const id = +toggleBtn.dataset.toggle;
          const currentPub = toggleBtn.dataset.pub === '1';
          try {
            await api('admin/recipes.php?id=' + encodeURIComponent(id), {
              method: 'PATCH',
              body: { is_published: !currentPub }
            });
            toast(!currentPub ? 'Resep ditampilkan.' : 'Resep disembunyikan.');
          } catch (err) {
            const h = hid();
            sv('fh_hid', currentPub ? h.concat(id) : h.filter(x => x !== id));
            toast(!currentPub ? 'Resep ditampilkan.' : 'Resep disembunyikan.');
          }
          loadData();
          return;
        }
      });

      rootEl.addEventListener('submit', async e => {
        if (e.target.id !== 'recipeForm') return;
        e.preventDefault();

        const idVal = $('#rf_id').value;
        const title = $('#rf_n').value.trim();
        const region = $('#rf_p').value.trim();
        const categories = [$('#rf_k').value];
        const cook_time_minutes = +$('#rf_w').value || 30;
        const difficulty = $('#rf_l').value;
        const servings = +$('#rf_s').value || 4;
        const image_path = $('#rf_f').value.trim();
        const story = $('#rf_c').value.trim();
        const bRaw = $('#rf_b').value.trim();
        const tRaw = $('#rf_t').value.trim();

        if (!title) { toast('Nama resep wajib diisi.'); return; }
        if (!story) { toast('Deskripsi resep wajib diisi.'); return; }

        const ingredients = bRaw.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
          if (line.includes(',')) {
            const p = line.split(',').map(x => x.trim());
            return { name: p[0], quantity: isNaN(+p[1]) ? null : +p[1], unit: p[2] || '' };
          }
          return { name: line, quantity: 1, unit: 'secukupnya' };
        });
        const steps = tRaw.split('\n').map(line => line.trim()).filter(Boolean);

        const payload = {
          title,
          region: region || 'Nusantara',
          categories,
          cook_time_minutes,
          difficulty,
          servings,
          image_path,
          story,
          is_published: true,
          ingredients,
          steps
        };

        try {
          if (idVal) {
            await api('admin/recipes.php?id=' + encodeURIComponent(idVal), {
              method: 'PUT',
              body: payload
            });
            toast('Resep berhasil diperbarui!');
          } else {
            await api('admin/recipes.php', {
              method: 'POST',
              body: payload
            });
            toast('Resep berhasil ditambahkan!');
          }
        } catch (err) {
          toast(err.message || 'Gagal menyimpan resep.');
        }

        closeModal();
        loadData();
      });

      loadData();
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

  /* ==========================================================================
     Inisialisasi Aplikasi
     ========================================================================== */
  async function init() {
    const ok = await initAuth();
    if (!ok) return;
    buildTabs();
    if (PG[P]) {
      const ret = PG[P]();
      if (ret && ret.catch) ret.catch(console.error);
    }
    hydrate(document);
  }

  init();
})();
