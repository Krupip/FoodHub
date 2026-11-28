/* ==========================================================================
   FoodHub - main.js (Format Petani Kode: Jelas, Deskriptif, Mudah Dipelajari)
   ========================================================================== */
(function () {
  'use strict';

  // 1. Data Halaman & Helper Pemilih Elemen DOM
  const halamanSaatIni = document.body.dataset.page;
  const P = halamanSaatIni;
  const akarFolder = document.body.dataset.root || '';
  const R = akarFolder;
  const hakAksesHalaman = document.body.dataset.access || '';
  const ACC = hakAksesHalaman;
  const parameterUrl = new URLSearchParams(location.search);
  const qs = parameterUrl;

  // Fungsi pembantu memilih elemen (mirip selector Petani Kode)
  const pilihElemen = (pemilih, induk) => (induk || document).querySelector(pemilih);
  const pilihSemuaElemen = (pemilih, induk) => Array.from((induk || document).querySelectorAll(pemilih));
  const $ = pilihElemen;
  const $$ = pilihSemuaElemen;

  // Membersihkan karakter berbahaya untuk mencegah serangan XSS
  const bersihkanTeks = stringTeks => String(stringTeks ?? '').replace(/[&<>"']/g, karakter => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[karakter]));
  const esc = bersihkanTeks;

  // Menampilkan pesan status (sukses atau gagal) pada elemen kotak pesan
  const tampilkanStatus = (elemen, teksPesan, apakahSukses) => {
    elemen.className = apakahSukses ? 'ok' : 'err';
    elemen.textContent = teksPesan;
    elemen.hidden = false;
  };
  const bar = tampilkanStatus;

  // Notifikasi Toast kecil di pojok layar
  function tampilkanToast(teksPesan) {
    let wadahToast = pilihElemen('#toast');
    if (!wadahToast) {
      wadahToast = Object.assign(document.createElement('div'), { id: 'toast' });
      document.body.appendChild(wadahToast);
    }
    wadahToast.textContent = teksPesan;
    wadahToast.className = 'show';
    clearTimeout(wadahToast._timer);
    wadahToast._timer = setTimeout(() => {
      wadahToast.className = '';
    }, 2600);
  }
  const toast = tampilkanToast;

  // 2. Komunikasi API Backend PHP & Keamanan CSRF
  const URL_DASAR_API = (akarFolder ? akarFolder + '../' : '../') + 'backend/api/';
  const BASE = URL_DASAR_API;
  const PESAN_CSRF_ERROR = 'Token CSRF server hilang atau tidak valid. Muat ulang halaman.';
  const CSRF_ERR = PESAN_CSRF_ERROR;
  const PESAN_AUTH_ERROR = 'Respons autentikasi server tidak valid. Silakan coba lagi.';
  const AUTH_ERR = PESAN_AUTH_ERROR;
  const PESAN_SERVER_TIDAK_TERSEDIA = 'Tidak dapat memeriksa sesi. Pastikan backend tersedia.';
  const UNAV_ERR = PESAN_SERVER_TIDAK_TERSEDIA;

  let tokenCsrf = null;
  let csrfToken = null;
  let penggunaAktif = null;
  let U = null;
  let sedangProsesKeluar = false;
  let loggingOut = false;

  // Memeriksa apakah metode HTTP aman (tidak butuh proteksi mutasi CSRF)
  const apakahMetodeAman = metodeHttp => ['GET', 'HEAD', 'OPTIONS'].includes(metodeHttp);
  const isSafe = apakahMetodeAman;

  // Mengambil nama aksi pada parameter URL file auth.php
  const ambilAksiAutentikasi = jalurUrl => {
    const bagianUrl = jalurUrl.split('?');
    if (bagianUrl[0] === 'auth.php') {
      return new URLSearchParams(bagianUrl[1] || '').get('action');
    }
    return null;
  };
  const authAct = ambilAksiAutentikasi;

  // Validasi format respons autentikasi dari server
  const validasiResponsAutentikasi = dataJson => {
    if (!dataJson || typeof dataJson !== 'object' || Array.isArray(dataJson) || 'error' in dataJson) {
      throw new Error(PESAN_AUTH_ERROR);
    }
    return dataJson;
  };
  const authResp = validasiResponsAutentikasi;

  // Validasi struktur objek data user dari respons server
  const validasiDataPengguna = (dataJson, bolehTamu = false) => {
    const dataObjek = validasiResponsAutentikasi(dataJson);
    const profilUser = dataObjek.user;
    if (bolehTamu && profilUser === null) return null;

    const apakahIdValid = profilUser && (
      (Number.isSafeInteger(profilUser.id) && profilUser.id > 0) ||
      (typeof profilUser.id === 'string' && /^[1-9]\d*$/.test(profilUser.id))
    );

    const apakahNamaValid = typeof profilUser?.name === 'string' && profilUser.name.trim().length > 0;
    const apakahEmailValid = typeof profilUser?.email === 'string' && profilUser.email.trim().length > 0;
    const apakahRoleValid = ['member', 'admin'].includes(profilUser?.role);

    if (!apakahIdValid || !apakahNamaValid || !apakahEmailValid || !apakahRoleValid) {
      throw new Error(PESAN_AUTH_ERROR);
    }
    return profilUser;
  };
  const authUser = validasiDataPengguna;

  // Fungsi utama pemanggil API fetch ke backend
  async function fetchApi(jalurUrl, opsiPermintaan = {}) {
    const metodeHttp = (opsiPermintaan.method || 'GET').toUpperCase();
    const namaAksi = ambilAksiAutentikasi(jalurUrl);
    const apakahAksiPublik = metodeHttp === 'POST' && ['login', 'register'].includes(namaAksi);

    const headerPermintaan = { 'Content-Type': 'application/json', ...opsiPermintaan.headers };
    for (const kunciHeader in headerPermintaan) {
      if (kunciHeader.toLowerCase() === 'x-csrf-token') {
        delete headerPermintaan[kunciHeader];
      }
    }

    if (!apakahMetodeAman(metodeHttp) && tokenCsrf) {
      headerPermintaan['X-CSRF-Token'] = tokenCsrf;
    }

    let badanPermintaan = opsiPermintaan.body;
    if (badanPermintaan instanceof FormData) {
      delete headerPermintaan['Content-Type'];
    } else if (badanPermintaan && typeof badanPermintaan === 'object') {
      badanPermintaan = JSON.stringify(badanPermintaan);
    }

    const responsServer = await fetch(URL_DASAR_API + jalurUrl, {
      ...opsiPermintaan,
      method: metodeHttp,
      credentials: 'same-origin',
      headers: headerPermintaan,
      body: badanPermintaan
    });

    const headerCsrfServer = responsServer.headers && typeof responsServer.headers.get === 'function'
      ? responsServer.headers.get('X-CSRF-Token')
      : null;

    const tokenValid = typeof headerCsrfServer === 'string' && /^[0-9a-f]{64}$/.test(headerCsrfServer)
      ? headerCsrfServer
      : null;

    const dataHasilJson = await responsServer.json().catch(() => ({}));

    // Update status sesi & CSRF token berdasarkan respons
    if (responsServer.ok && ((metodeHttp === 'GET' && namaAksi === 'me') || apakahAksiPublik)) {
      tokenCsrf = null;
      csrfToken = null;
      penggunaAktif = null;
      U = null;

      const dataUserSah = validasiDataPengguna(dataHasilJson, namaAksi === 'me');
      if (dataUserSah && !tokenValid) {
        throw new Error(PESAN_CSRF_ERROR);
      }
      penggunaAktif = dataUserSah;
      U = dataUserSah;
      tokenCsrf = dataUserSah ? tokenValid : null;
      csrfToken = tokenCsrf;
    } else if (responsServer.ok && metodeHttp === 'POST' && namaAksi === 'logout') {
      const hasilLogout = validasiResponsAutentikasi(dataHasilJson);
      if (typeof hasilLogout.message !== 'string' || !hasilLogout.message.trim()) {
        throw new Error(PESAN_AUTH_ERROR);
      }
      penggunaAktif = null;
      U = null;
      tokenCsrf = null;
      csrfToken = null;
    } else if (responsServer.status === 401 && !apakahAksiPublik) {
      penggunaAktif = null;
      U = null;
      tokenCsrf = null;
      csrfToken = null;
    } else if (tokenValid) {
      tokenCsrf = tokenValid;
      csrfToken = tokenValid;
    }

    if (!responsServer.ok) {
      const pesanError = new Error(dataHasilJson?.error || 'Terjadi kesalahan sistem.');
      pesanError.status = responsServer.status;
      pesanError.data = dataHasilJson;
      throw pesanError;
    }

    return dataHasilJson;
  }

  // Wrapper fungsi api untuk mutasi data dengan auto-refresh CSRF token
  async function api(jalurUrl, opsiPermintaan = {}) {
    const metode = (opsiPermintaan.method || 'GET').toUpperCase();
    const namaAksi = ambilAksiAutentikasi(jalurUrl);
    const apakahAksiPublik = ['login', 'register'].includes(namaAksi) && metode === 'POST';

    if (!apakahMetodeAman(metode) && !apakahAksiPublik && !tokenCsrf) {
      await fetchApi('auth.php?action=me');
    }
    return fetchApi(jalurUrl, opsiPermintaan);
  }

  // 3. Penyimpanan Cadangan Lokal (Offline Fallback & Migrasi)
  const muatDataLokal = (kunci, nilaiDefault) => {
    try {
      const dataString = localStorage.getItem(kunci);
      return dataString ? JSON.parse(dataString) : nilaiDefault;
    } catch {
      return nilaiDefault;
    }
  };
  const ld = muatDataLokal;

  const simpanDataLokal = (kunci, nilaiObjek) => {
    try {
      localStorage.setItem(kunci, JSON.stringify(nilaiObjek));
    } catch {}
  };
  const sv = simpanDataLokal;

  const bersihkanPenyimpananSesi = () => {
    try { sessionStorage.removeItem('fh_s'); } catch {}
    try { localStorage.removeItem('fh_s'); } catch {}
  };
  const clearAuth = bersihkanPenyimpananSesi;

  const ambilDaftarPenggunaLokal = () => {
    let daftarPengguna = muatDataLokal('fh_users', null);
    if (!daftarPengguna) {
      daftarPengguna = [
        { name: 'Admin FoodHub', email: 'admin@foodhub.id', role: 'admin', fav: [], at: '2026-08-01' },
        { name: 'Raka Pratama', email: 'raka@contoh.id', role: 'member', fav: [1, 2], at: '2026-09-12' },
        { name: 'Nadia Putri', email: 'nadia@contoh.id', role: 'member', fav: [3], at: '2026-10-03' }
      ];
      simpanDataLokal('fh_users', daftarPengguna);
    }
    // Migrasi keamanan: hapus field password dari penyimpanan browser lokal
    if (Array.isArray(daftarPengguna) && daftarPengguna.some(item => 'pass' in item)) {
      daftarPengguna = daftarPengguna.map(({ pass, ...sisaData }) => sisaData);
      simpanDataLokal('fh_users', daftarPengguna);
    }
    return daftarPengguna;
  };
  const users = ambilDaftarPenggunaLokal;

  // 4. Autentikasi Pengguna & Navigasi Halaman
  async function prosesKeluar() {
    if (sedangProsesKeluar) return;
    sedangProsesKeluar = true;
    loggingOut = true;
    pilihSemuaElemen('#lo, #alo').forEach(tombol => { tombol.disabled = true; });

    try {
      const responsLogout = validasiResponsAutentikasi(await api('auth.php?action=logout', { method: 'POST' }));
      if (!responsLogout.message?.trim()) throw new Error(PESAN_AUTH_ERROR);
      penggunaAktif = null;
      U = null;
      bersihkanPenyimpananSesi();
      location.href = akarFolder + 'index.html';
    } catch (error) {
      tampilkanToast('Gagal keluar: ' + (error.message || ''));
    } finally {
      sedangProsesKeluar = false;
      loggingOut = false;
      pilihSemuaElemen('#lo, #alo').forEach(tombol => { tombol.disabled = false; });
    }
  }
  const logout = prosesKeluar;

  // Pengikat form submit dengan perlindungan klik ganda (disable button)
  function pasangEventSubmitForm(elemenForm, fungsiAksi) {
    let sedangSibuk = false;
    elemenForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (sedangSibuk) return;
      sedangSibuk = true;
      pilihSemuaElemen('[type="submit"]', elemenForm).forEach(tombol => { tombol.disabled = true; });

      try {
        await fungsiAksi();
      } finally {
        sedangSibuk = false;
        pilihSemuaElemen('[type="submit"]', elemenForm).forEach(tombol => { tombol.disabled = false; });
      }
    });
  }
  const bindSubmit = pasangEventSubmitForm;

  // Inisialisasi status autentikasi saat halaman dibuka
  async function inisialisasiAutentikasi() {
    const elemenTerlindungi = hakAksesHalaman
      ? pilihSemuaElemen('main, #nav, #side, #top, #foot').map(elemen => ({ elemen, kondisiAwal: elemen.hidden }))
      : [];

    elemenTerlindungi.forEach(({ elemen }) => { elemen.hidden = true; });
    penggunaAktif = null;
    U = null;
    tokenCsrf = null;
    csrfToken = null;
    bersihkanPenyimpananSesi();

    let serverTidakTersedia = false;
    try {
      penggunaAktif = validasiDataPengguna(await api('auth.php?action=me'), true);
      U = penggunaAktif;
    } catch (error) {
      penggunaAktif = null;
      U = null;
      serverTidakTersedia = true;
      tampilkanToast(PESAN_SERVER_TIDAK_TERSEDIA + (error.message === PESAN_CSRF_ERROR ? ' ' + PESAN_CSRF_ERROR : ''));
    }

    const parameterGagal = serverTidakTersedia ? '&auth=unavailable' : '';

    // Cek hak akses untuk halaman member
    if (hakAksesHalaman === 'member' && !penggunaAktif) {
      const namaBerkas = location.pathname.split('/').pop() + location.search;
      location.replace(akarFolder + 'masuk.html?next=' + encodeURIComponent(namaBerkas) + parameterGagal);
      return false;
    }

    // Cek hak akses untuk halaman admin
    if (hakAksesHalaman === 'admin') {
      if (!penggunaAktif) {
        const berkasAdmin = 'admin/' + location.pathname.split('/').pop();
        location.replace(akarFolder + 'masuk.html?next=' + encodeURIComponent(berkasAdmin) + parameterGagal);
        return false;
      }
      if (penggunaAktif.role !== 'admin') {
        location.replace(akarFolder + 'index.html');
        return false;
      }
    }

    if (pilihElemen('#nav')) bangunMenuNavigasi();
    if (pilihElemen('#side')) bangunMenuAdmin();
    elemenTerlindungi.forEach(({ elemen, kondisiAwal }) => { elemen.hidden = kondisiAwal; });
    return true;
  }
  const initAuth = inisialisasiAutentikasi;

  // 5. Pembuat Tampilan Menu Navigasi & Sidebar
  function bangunMenuNavigasi() {
    const daftarMenu = [['index', 'Beranda'], ['daftar-resep', 'Resep'], ['faq', 'FAQ']];
    const halamanCocok = halamanSaatIni === 'detail-resep' ? 'daftar-resep' : halamanSaatIni;

    const tautanNavigasi = daftarMenu.map(([berkas, labelMenu]) =>
      `<a href="${akarFolder}${berkas}.html"${berkas === halamanCocok ? ' class="on"' : ''}>${labelMenu}</a>`
    ).join('');

    const blokAkunUser = penggunaAktif
      ? `<div class="acc"><button class="av" id="avb">${bersihkanTeks(penggunaAktif.name[0].toUpperCase())}</button><div class="dd" id="dd" hidden><div class="dn">${bersihkanTeks(penggunaAktif.name)}<small>${bersihkanTeks(penggunaAktif.email)}</small></div><a href="${akarFolder}profil.html">Profil</a>${penggunaAktif.role === 'admin' ? `<a href="${akarFolder}admin/dasbor.html">Admin</a>` : ''}<button id="lo">Keluar</button></div></div>`
      : `<a class="btn ghost sm" href="${akarFolder}masuk.html">Masuk</a><a class="btn sm" href="${akarFolder}daftar.html">Daftar</a>`;

    pilihElemen('#nav').innerHTML = `<div class="container nb"><a class="logo" href="${akarFolder}index.html">FoodHub</a><nav class="nl">${tautanNavigasi}</nav><div class="na">${blokAkunUser}</div></div>`;

    pilihElemen('#avb')?.addEventListener('click', event => {
      event.stopPropagation();
      const menuDropdown = pilihElemen('#dd');
      if (menuDropdown) menuDropdown.hidden = !menuDropdown.hidden;
    });

    document.addEventListener('click', () => {
      const menuDropdown = pilihElemen('#dd');
      if (menuDropdown) menuDropdown.hidden = true;
    });

    pilihElemen('#lo')?.addEventListener('click', prosesKeluar);
  }

  function bangunMenuAdmin() {
    pilihElemen('#top').innerHTML = `<strong>FoodHub Admin</strong><span class="muted sm">${bersihkanTeks(penggunaAktif?.name || 'Admin')}</span>`;
    pilihElemen('#side').innerHTML = `<a href="dasbor.html" class="on">Dasbor</a><a href="kelola-resep.html">Kelola Resep</a><a href="kelola-pengguna.html">Kelola Pengguna</a><a href="${akarFolder}index.html">Situs</a><button id="alo">Keluar</button>`;
    pilihElemen('#alo')?.addEventListener('click', prosesKeluar);
  }

  // 6. Komponen Kartu Resep & Logika Halaman (PG Object)
  const formatUrlGambar = jalurGambar => {
    if (!jalurGambar) return '';
    return /^(https?:|data:)/.test(jalurGambar) ? jalurGambar : akarFolder + bersihkanTeks(jalurGambar);
  };
  const img = formatUrlGambar;

  const buatKartuResepHtml = dataResep => {
    const urlGambar = formatUrlGambar(dataResep.image_path);
    const gambarHtml = urlGambar ? `<img src="${urlGambar}">` : '';
    const infoMeta = `<span>${dataResep.cook_time_minutes || 30} mnt</span><span>${bersihkanTeks(dataResep.difficulty || 'Sedang')}</span>`;
    return `<a class="card" href="${akarFolder}detail-resep.html?id=${dataResep.id}"><div class="thumb">${gambarHtml}</div><div><h3>${bersihkanTeks(dataResep.title)}</h3><div class="meta">${infoMeta}</div></div></a>`;
  };
  const card = buatKartuResepHtml;

  const PG = {
    // 6.1. Halaman Beranda (Index)
    async index() {
      try {
        const { recipes } = await api('recipes.php?sort=popular&limit=4');
        const elemenPopuler = pilihElemen('#pop');
        if (elemenPopuler) elemenPopuler.innerHTML = recipes.map(buatKartuResepHtml).join('');
      } catch {}
    },

    // 6.2. Halaman Daftar Resep (Katalog & Pencarian)
    async 'daftar-resep'() {
      const inputCari = pilihElemen('#fq');
      const jalankanPencarian = async () => {
        try {
          const kataKunci = encodeURIComponent(inputCari?.value || '');
          const { recipes } = await api('recipes.php?q=' + kataKunci);
          const daftarHasil = pilihElemen('#rl');
          if (daftarHasil) daftarHasil.innerHTML = recipes.map(buatKartuResepHtml).join('');
        } catch {}
      };
      inputCari?.addEventListener('input', jalankanPencarian);
      jalankanPencarian();
    },

    // 6.3. Halaman Detail Resep & Favorit
    async 'detail-resep'() {
      const idResep = parameterUrl.get('id');
      const kotakDetail = pilihElemen('#dr');
      if (!idResep) {
        return kotakDetail.innerHTML = '<div class="empty"><h2>Resep tidak ditemukan</h2><a class="btn" href="daftar-resep.html">Lihat semua</a></div>';
      }

      let dataResep = null;
      try {
        const responsDetail = await api('recipes.php?id=' + encodeURIComponent(idResep));
        dataResep = responsDetail?.recipe;
        if (!dataResep || typeof dataResep.title !== 'string' || !Array.isArray(dataResep.ingredients) || !Array.isArray(dataResep.steps)) {
          throw new Error();
        }
      } catch (error) {
        const apakahTidakDitemukan = error.status === 404 || error.status === 422;
        return kotakDetail.innerHTML = `<div class="empty"><h2>${apakahTidakDitemukan ? 'Resep tidak ditemukan' : 'Gagal memuat resep'}</h2><a class="btn" href="daftar-resep.html">Lihat semua</a></div>`;
      }

      let statusFavorit = Boolean(dataResep.is_favorite);
      const tagKategori = (dataResep.categories || []).map(kat => `<span class="tag">${bersihkanTeks(kat)}</span>`).join(' ');
      const daftarBahan = dataResep.ingredients.map(bahan => `<li>${bersihkanTeks(bahan.name)}</li>`).join('');
      const daftarLangkah = dataResep.steps.map(langkah => `<li>${bersihkanTeks(langkah)}</li>`).join('');

      const ratingFormat = dataResep.avg_rating != null ? Number(dataResep.avg_rating).toFixed(1) : '-';
      const infoRingkas = `<span>Waktu: <b>${dataResep.cook_time_minutes || 30} mnt</b></span><span>Porsi: <b id="sv">${dataResep.servings || 4}</b></span><span>Rating: <b id="rt">★ ${ratingFormat}</b></span>`;

      kotakDetail.innerHTML = `
        <div class="panel">
          <div>${tagKategori}</div>
          <h1>${bersihkanTeks(dataResep.title)}</h1>
          <p class="muted sm">Oleh ${bersihkanTeks(dataResep.author || 'FoodHub')}</p>
          <div class="detail-info">${infoRingkas}</div>
          ${dataResep.story ? `<p>${bersihkanTeks(dataResep.story)}</p>` : ''}
          <button class="btn sm" id="fv" type="button">&hearts; <span id="fvt">${statusFavorit ? 'Tersimpan di Favorit' : 'Simpan ke Favorit'}</span></button>
          <h2>Bahan-bahan</h2>
          <ul>${daftarBahan}</ul>
          <h2>Langkah Memasak</h2>
          <ol>${daftarLangkah}</ol>
        </div>`;

      pilihElemen('#fv')?.addEventListener('click', async () => {
        if (!penggunaAktif) return location.href = akarFolder + 'masuk.html';
        try {
          if (statusFavorit) {
            await api('favorites.php?recipe_id=' + encodeURIComponent(idResep), { method: 'DELETE' });
            statusFavorit = false;
            pilihElemen('#fvt').textContent = 'Simpan ke Favorit';
          } else {
            await api('favorites.php', { method: 'POST', body: { recipe_id: idResep } });
            statusFavorit = true;
            pilihElemen('#fvt').textContent = 'Tersimpan di Favorit';
          }
        } catch (error) {
          tampilkanToast(error.message || 'Gagal.');
        }
      });
    },

    // 6.4. Halaman Profil Pengguna & Resep Favorit
    async profil() {
      let dataProfil = penggunaAktif;
      let daftarFavorit = [];
      try { dataProfil = (await api('profile.php')).user || penggunaAktif; } catch {}
      try { daftarFavorit = (await api('favorites.php')).recipes || []; } catch {}

      pilihElemen('#pf').innerHTML = `
        <h1>Profil Saya</h1>
        <div class="panel">
          <p><strong>${bersihkanTeks(dataProfil.name)}</strong><br>${bersihkanTeks(dataProfil.email)}</p>
          <form id="nf">
            <div class="ok" id="no" hidden></div>
            <div class="err" id="ne" hidden></div>
            <input id="nn" value="${bersihkanTeks(dataProfil.name)}">
            <button class="btn sm" type="submit">Simpan</button>
          </form>
        </div>
        <h2>Favorit (${daftarFavorit.length})</h2>
        <div class="grid">${daftarFavorit.map(buatKartuResepHtml).join('')}</div>`;

      pasangEventSubmitForm(pilihElemen('#nf'), async () => {
        const namaBaru = pilihElemen('#nn').value.trim();
        if (namaBaru.length < 3) return tampilkanStatus(pilihElemen('#ne'), 'Nama min 3 karakter.');
        try {
          const responsSimpan = await api('profile.php', { method: 'POST', body: { name: namaBaru } });
          dataProfil = responsSimpan.user;
          penggunaAktif = responsSimpan.user;
          U = responsSimpan.user;
          tampilkanStatus(pilihElemen('#no'), 'Tersimpan!', true);
        } catch (error) {
          tampilkanStatus(pilihElemen('#ne'), error.message || 'Gagal simpan.');
        }
      });
    },

    // 6.5. Halaman Masuk (Login)
    masuk() {
      if (penggunaAktif) return location.replace(penggunaAktif.role === 'admin' ? 'admin/dasbor.html' : 'profil.html');
      if (parameterUrl.get('auth') === 'unavailable') tampilkanStatus(pilihElemen('#er'), PESAN_SERVER_TIDAK_TERSEDIA);

      pasangEventSubmitForm(pilihElemen('#lf'), async () => {
        const emailMasuk = pilihElemen('#em').value.trim().toLowerCase();
        const kataSandiMasuk = pilihElemen('#pw').value;
        if (!emailMasuk || !kataSandiMasuk) {
          return tampilkanStatus(pilihElemen('#er'), 'Email dan kata sandi wajib diisi.');
        }

        try {
          const responsLogin = await api('auth.php?action=login', {
            method: 'POST',
            body: { email: emailMasuk, password: kataSandiMasuk, remember: pilihElemen('#ing').checked }
          });
          penggunaAktif = validasiDataPengguna(responsLogin);
          U = penggunaAktif;
          bersihkanPenyimpananSesi();

          const halamanTujuan = parameterUrl.get('next');
          location.href = halamanTujuan && /^(admin\/)?[a-z-]+\.html/i.test(halamanTujuan)
            ? halamanTujuan
            : (penggunaAktif.role === 'admin' ? 'admin/dasbor.html' : 'index.html');
        } catch (error) {
          tampilkanStatus(pilihElemen('#er'), error.message || 'Email atau kata sandi salah.');
        }
      });
    },

    // 6.6. Halaman Daftar (Registrasi)
    daftar() {
      if (penggunaAktif) return location.replace('profil.html');

      pasangEventSubmitForm(pilihElemen('#df'), async () => {
        const namaDaftar = pilihElemen('#dn').value.trim();
        const emailDaftar = pilihElemen('#de').value.trim().toLowerCase();
        const sandiDaftar = pilihElemen('#dp').value;
        const daftarPesanError = [];

        if (namaDaftar.length < 3) daftarPesanError.push('Nama min 3 karakter.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDaftar)) daftarPesanError.push('Email tidak valid.');
        if (sandiDaftar.length < 8) daftarPesanError.push('Kata sandi min 8 karakter.');
        if (sandiDaftar !== pilihElemen('#dk').value) daftarPesanError.push('Konfirmasi kata sandi tidak sama.');
        if (!pilihElemen('#ds').checked) daftarPesanError.push('Centang persetujuan syarat.');

        if (daftarPesanError.length) {
          pilihElemen('#er').innerHTML = `<ul>${daftarPesanError.map(pesan => `<li>${bersihkanTeks(pesan)}</li>`).join('')}</ul>`;
          pilihElemen('#er').hidden = false;
          return;
        }

        try {
          const responsDaftar = await api('auth.php?action=register', {
            method: 'POST',
            body: { name: namaDaftar, email: emailDaftar, password: sandiDaftar }
          });
          penggunaAktif = validasiDataPengguna(responsDaftar);
          U = penggunaAktif;
          bersihkanPenyimpananSesi();
          tampilkanToast('Pendaftaran berhasil!');
          location.href = 'index.html';
        } catch (error) {
          pilihElemen('#er').innerHTML = `<p>${bersihkanTeks(error.message || 'Pendaftaran gagal.')}</p>`;
          pilihElemen('#er').hidden = false;
        }
      });
    },

    // 6.7. Halaman Statis & Panel Admin
    faq() {},
    dasbor() {},
    'kelola-resep'() {},
    'moderasi-resep'() {},
    'kelola-pengguna'() {}
  };

  // 7. Inisialisasi Aplikasi Saat Halaman Dimuat
  async function inisialisasiAplikasi() {
    const apakahBerhasil = await inisialisasiAutentikasi();
    if (apakahBerhasil && PG[halamanSaatIni]) {
      const hasilEksekusi = PG[halamanSaatIni]();
      if (hasilEksekusi?.catch) hasilEksekusi.catch(console.error);
    }
  }
  const init = inisialisasiAplikasi;

  // Ekspos objek pengujian untuk pengujian unit otomatis
  globalThis.authTest = {
    api,
    logout,
    init,
    initAuth,
    PG,
    users,
    get user() { return U; }
  };

  init();
})();
