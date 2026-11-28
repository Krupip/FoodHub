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
    if (pilihElemen('#side') || pilihElemen('#menu-samping')) bangunMenuAdmin();
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

    pilihElemen('#nav').innerHTML = `<div class="container nb"><a class="logo" href="${akarFolder}index.html"><img src="${akarFolder}img/logo-foodhub.png" alt="FoodHub"></a><nav class="nl">${tautanNavigasi}</nav><div class="na">${blokAkunUser}</div></div>`;

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
    const elemenHeaderAtas = pilihElemen('#top') || pilihElemen('#header-atas');
    if (elemenHeaderAtas) {
      elemenHeaderAtas.innerHTML = `<div class="container nb"><a class="logo" href="${akarFolder}index.html"><img src="${akarFolder}img/logo-foodhub.png" alt="FoodHub" style="height:32px;"></a><span class="muted sm">Halo, ${bersihkanTeks(penggunaAktif?.name || 'Admin')}</span></div>`;
    }
    const elemenMenuSamping = pilihElemen('#side') || pilihElemen('#menu-samping');
    if (elemenMenuSamping) {
      const tautanSide = [
        ['dasbor.html', 'dasbor', 'Dasbor'],
        ['kelola-resep.html', 'kelola-resep', 'Kelola Resep'],
        ['kelola-pengguna.html', 'kelola-pengguna', 'Kelola Pengguna']
      ].map(([berkas, halaman, label]) =>
        `<a href="${berkas}"${halamanSaatIni === halaman ? ' class="on"' : ''}>${label}</a>`
      ).join('');

      elemenMenuSamping.innerHTML = `<div class="container nb" style="justify-content:flex-start;gap:0.6rem;">${tautanSide}<a href="${akarFolder}index.html">Lihat Situs</a><button id="alo" style="margin-left:auto;">Keluar</button></div>`;
      pilihElemen('#alo')?.addEventListener('click', prosesKeluar);
    }
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
      
      const takaranDasarPorsi = Number(dataResep.servings) || 4;
      let porsiSekarang = takaranDasarPorsi;

      const formatBahanHtml = (daftarBahan, porsiPengali, porsiDasar) => {
        return daftarBahan.map(bahan => {
          let jumlahTeks = '';
          if (bahan.quantity != null && !isNaN(bahan.quantity)) {
            const jumlahTerkalkulasi = (Number(bahan.quantity) * porsiPengali) / porsiDasar;
            const jumlahBulat = Math.round(jumlahTerkalkulasi * 10) / 10;
            jumlahTeks = `<b>${jumlahBulat}</b> ${bersihkanTeks(bahan.unit || '')} `;
          } else if (bahan.unit) {
            jumlahTeks = `${bersihkanTeks(bahan.unit)} `;
          }
          return `<li>${jumlahTeks}${bersihkanTeks(bahan.name)}</li>`;
        }).join('');
      };

      const daftarLangkah = dataResep.steps.map(langkah => `<li>${bersihkanTeks(langkah)}</li>`).join('');
      const ratingFormat = dataResep.avg_rating != null ? Number(dataResep.avg_rating).toFixed(1) : '-';

      const renderKontenDetail = () => {
        const infoRingkas = `
          <span>Waktu: <b>${dataResep.cook_time_minutes || 30} mnt</b></span>
          <span style="display:inline-flex;align-items:center;gap:0.4rem;">
            Porsi: 
            <button type="button" id="btnPorsiMinus" class="btn sm ghost" style="padding:0.15rem 0.55rem;font-size:0.9rem;border-radius:99px;" ${porsiSekarang <= 1 ? 'disabled' : ''}>&minus;</button>
            <b id="sv">${porsiSekarang}</b>
            <button type="button" id="btnPorsiPlus" class="btn sm ghost" style="padding:0.15rem 0.55rem;font-size:0.9rem;border-radius:99px;">&plus;</button>
          </span>
          <span>Rating: <b id="rt">★ ${ratingFormat}</b></span>`;

        kotakDetail.innerHTML = `
          <div class="panel">
            <div>${tagKategori}</div>
            <h1 style="margin:0.5rem 0;">${bersihkanTeks(dataResep.title)}</h1>
            <p class="muted sm">Oleh ${bersihkanTeks(dataResep.author || 'FoodHub')}</p>
            <div class="detail-info">${infoRingkas}</div>
            ${dataResep.story ? `<p style="line-height:1.7;">${bersihkanTeks(dataResep.story)}</p>` : ''}
            <button class="btn sm" id="fv" type="button" style="margin-bottom:1.5rem;">&hearts; <span id="fvt">${statusFavorit ? 'Tersimpan di Favorit' : 'Simpan ke Favorit'}</span></button>
            <h2>Bahan-bahan (${porsiSekarang} porsi)</h2>
            <ul id="daftarBahanList" style="line-height:1.8;">${formatBahanHtml(dataResep.ingredients, porsiSekarang, takaranDasarPorsi)}</ul>
            <h2 style="margin-top:1.5rem;">Langkah Memasak</h2>
            <ol style="line-height:1.8;">${daftarLangkah}</ol>
          </div>`;

        pilihElemen('#btnPorsiMinus')?.addEventListener('click', () => {
          if (porsiSekarang > 1) {
            porsiSekarang--;
            renderKontenDetail();
          }
        });

        pilihElemen('#btnPorsiPlus')?.addEventListener('click', () => {
          porsiSekarang++;
          renderKontenDetail();
        });

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
      };

      renderKontenDetail();
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
    faq() {
      const semuaDetails = pilihSemuaElemen('.faq details');
      semuaDetails.forEach(detailEl => {
        detailEl.addEventListener('toggle', () => {
          if (detailEl.open) {
            semuaDetails.forEach(el => {
              if (el !== detailEl) el.open = false;
            });
          }
        });
      });
    },

    async dasbor() {
      let statistik = { total_recipes: 0, published_recipes: 0, hidden_recipes: 0, total_users: 0 };
      try {
        const responsStatistik = await api('admin/stats.php');
        if (responsStatistik && responsStatistik.stats) {
          statistik = responsStatistik.stats;
        }
      } catch (error) {
        statistik.total_recipes = 14;
        statistik.published_recipes = 14;
        statistik.hidden_recipes = 0;
        statistik.total_users = 3;
      }

      const totalEl = pilihElemen('#statTotal');
      const tayangEl = pilihElemen('#statTayang');
      const sembunyiEl = pilihElemen('#statSembunyi');
      const penggunaEl = pilihElemen('#statPengguna');

      if (totalEl) totalEl.textContent = String(statistik.total_recipes);
      if (tayangEl) tayangEl.textContent = String(statistik.published_recipes);
      if (sembunyiEl) sembunyiEl.textContent = String(statistik.hidden_recipes);
      if (penggunaEl) penggunaEl.textContent = String(statistik.total_users);
    },

    async 'kelola-resep'() {
      const tabelResep = pilihElemen('#resepTableBody');
      const panelForm = pilihElemen('#recipePanel');
      const formResep = pilihElemen('#recipeForm');
      const tombolTambah = pilihElemen('#btnTambahResep');
      const tombolBatal = pilihElemen('#formCancel');

      let daftarResep = [];
      const muatResep = async () => {
        try {
          const res = await api('admin/recipes.php');
          daftarResep = res?.recipes || [];
        } catch {
          daftarResep = [];
        }
        if (!tabelResep) return;
        if (!daftarResep.length) {
          tabelResep.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:1.5rem;">Belum ada resep.</td></tr>';
          return;
        }
        tabelResep.innerHTML = daftarResep.map(resep => {
          const tayang = resep.is_published == 1;
          const urlFoto = formatUrlGambar(resep.image_path || resep.image);
          return `
            <tr>
              <td>${urlFoto ? `<img class="t-thumb" src="${urlFoto}" alt="${bersihkanTeks(resep.title)}">` : '<div class="t-thumb" style="display:grid;place-items:center;background:#e7e5e4;">🍳</div>'}</td>
              <td><strong>${bersihkanTeks(resep.title)}</strong></td>
              <td>${bersihkanTeks(resep.category_name || '-')}</td>
              <td>${resep.cook_time_minutes || 30} mnt</td>
              <td><span class="sts ${tayang ? 'tayang' : 'sembunyi'}">${tayang ? 'Tayang' : 'Draft'}</span></td>
              <td>
                <div class="aksi-grup">
                  <button class="btn-aksi ${tayang ? 'tarik' : 'tayang'}" type="button" data-pub="${resep.id}" data-v="${tayang ? 0 : 1}">${tayang ? 'Tarik' : 'Tayang'}</button>
                  <button class="btn-aksi edit" type="button" data-edit="${resep.id}">Edit</button>
                  <button class="btn-aksi hapus" type="button" data-del="${resep.id}">Hapus</button>
                </div>
              </td>
            </tr>`;
        }).join('');
      };

      tombolTambah?.addEventListener('click', () => {
        if (formResep) formResep.reset();
        const inputId = pilihElemen('#resep-id');
        if (inputId) inputId.value = '';
        const modalTitle = pilihElemen('#modalTitle');
        if (modalTitle) modalTitle.textContent = 'Tambah Resep Baru';
        if (panelForm) panelForm.hidden = false;
      });

      tombolBatal?.addEventListener('click', () => {
        if (panelForm) panelForm.hidden = true;
      });

      tabelResep?.addEventListener('click', async event => {
        const btnDel = event.target.closest('[data-del]');
        if (btnDel) {
          const id = btnDel.dataset.del;
          if (!confirm('Hapus resep ini?')) return;
          try {
            await api('admin/recipes.php?id=' + encodeURIComponent(id), { method: 'DELETE' });
            tampilkanToast('Resep dihapus.');
            muatResep();
          } catch (err) {
            tampilkanToast(err.message || 'Gagal menghapus.');
          }
          return;
        }

        const btnPub = event.target.closest('[data-pub]');
        if (btnPub) {
          const id = btnPub.dataset.pub;
          const status = Number(btnPub.dataset.v);
          try {
            await api('admin/recipes.php?id=' + encodeURIComponent(id), {
              method: 'PATCH',
              body: { is_published: status }
            });
            tampilkanToast('Status resep diperbarui.');
            muatResep();
          } catch (err) {
            tampilkanToast(err.message || 'Gagal memperbarui status.');
          }
          return;
        }

        const btnEdit = event.target.closest('[data-edit]');
        if (btnEdit) {
          const id = btnEdit.dataset.edit;
          try {
            const data = (await api('recipes.php?id=' + encodeURIComponent(id)))?.recipe;
            if (data && panelForm) {
              const modalTitle = pilihElemen('#modalTitle');
              if (modalTitle) modalTitle.textContent = 'Edit Resep';
              if (pilihElemen('#resep-id')) pilihElemen('#resep-id').value = data.id || '';
              if (pilihElemen('#resep-nama')) pilihElemen('#resep-nama').value = data.title || '';
              if (pilihElemen('#resep-daerah')) pilihElemen('#resep-daerah').value = data.region || '';
              if (pilihElemen('#resep-waktu')) pilihElemen('#resep-waktu').value = data.cook_time_minutes || 30;
              if (pilihElemen('#resep-porsi')) pilihElemen('#resep-porsi').value = data.servings || 4;
              if (pilihElemen('#resep-kesulitan')) pilihElemen('#resep-kesulitan').value = data.difficulty || 'sedang';
              if (pilihElemen('#resep-deskripsi')) pilihElemen('#resep-deskripsi').value = data.story || '';
              if (pilihElemen('#resep-bahan')) {
                pilihElemen('#resep-bahan').value = (data.ingredients || []).map(b => `${b.name || ''}, ${b.quantity || ''}, ${b.unit || ''}`).join('\n');
              }
              if (pilihElemen('#resep-langkah')) {
                pilihElemen('#resep-langkah').value = (data.steps || []).join('\n');
              }
              panelForm.hidden = false;
            }
          } catch (err) {
            tampilkanToast(err.message || 'Gagal memuat resep.');
          }
        }
      });

      formResep?.addEventListener('submit', async event => {
        event.preventDefault();
        const id = pilihElemen('#resep-id')?.value;
        const title = pilihElemen('#resep-nama')?.value.trim();
        const story = pilihElemen('#resep-deskripsi')?.value.trim();
        if (!title || !story) return tampilkanToast('Nama dan deskripsi resep wajib diisi.');

        const bodyData = {
          title,
          story,
          region: pilihElemen('#resep-daerah')?.value.trim(),
          category: pilihElemen('#resep-kategori')?.value,
          cook_time_minutes: Number(pilihElemen('#resep-waktu')?.value) || 30,
          difficulty: pilihElemen('#resep-kesulitan')?.value || 'sedang',
          servings: Number(pilihElemen('#resep-porsi')?.value) || 4,
          ingredients: (pilihElemen('#resep-bahan')?.value || '').split('\n').map(b => b.trim()).filter(Boolean).map(line => {
            const parts = line.split(',').map(s => s.trim());
            return { name: parts[0] || line, quantity: Number(parts[1]) || 1, unit: parts[2] || 'secukupnya' };
          }),
          steps: (pilihElemen('#resep-langkah')?.value || '').split('\n').map(s => s.trim()).filter(Boolean)
        };

        try {
          if (id) {
            await api('admin/recipes.php?id=' + encodeURIComponent(id), { method: 'PUT', body: bodyData });
            tampilkanToast('Resep berhasil diubah!');
          } else {
            await api('admin/recipes.php', { method: 'POST', body: bodyData });
            tampilkanToast('Resep berhasil ditambahkan!');
          }
          if (panelForm) panelForm.hidden = true;
          muatResep();
        } catch (err) {
          tampilkanToast(err.message || 'Gagal menyimpan resep.');
        }
      });

      muatResep();
    },

    'moderasi-resep'() {},

    async 'kelola-pengguna'() {
      const tabelUser = pilihElemen('#userTableBody');
      const panelUser = pilihElemen('#userPanel');
      const formUser = pilihElemen('#userForm');
      const tombolTambah = pilihElemen('#btnTambahPengguna');
      const tombolBatal = pilihElemen('#userCancel');
      const errBar = pilihElemen('#userFormErr');

      let daftarPengguna = [];
      const muatPengguna = async () => {
        try {
          const res = await api('admin/users.php');
          daftarPengguna = res?.users || [];
        } catch {
          daftarPengguna = [];
        }
        if (!tabelUser) return;
        if (!daftarPengguna.length) {
          tabelUser.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:1.5rem;">Tidak ada pengguna.</td></tr>';
          return;
        }
        tabelUser.innerHTML = daftarPengguna.map(u => `
          <tr>
            <td><b>#${bersihkanTeks(u.id || '-')}</b></td>
            <td><strong>${bersihkanTeks(u.name)}</strong></td>
            <td>${bersihkanTeks(u.email)}</td>
            <td><span class="sts ${u.role === 'admin' ? 'admin' : 'tayang'}">${bersihkanTeks(u.role)}</span></td>
            <td>${bersihkanTeks(u.created_at ? u.created_at.slice(0, 10) : '-')}</td>
            <td>
              ${u.role === 'admin' || (penggunaAktif && u.id === penggunaAktif.id)
                ? '<span class="muted sm">Tidak dapat dihapus</span>'
                : `<button class="btn danger sm" type="button" data-del-u="${u.id}" data-n="${bersihkanTeks(u.name)}">Hapus</button>`}
            </td>
          </tr>`).join('');
      };

      tombolTambah?.addEventListener('click', () => {
        if (formUser) formUser.reset();
        if (errBar) { errBar.hidden = true; errBar.textContent = ''; }
        if (panelUser) panelUser.hidden = false;
      });

      tombolBatal?.addEventListener('click', () => {
        if (panelUser) panelUser.hidden = true;
      });

      tabelUser?.addEventListener('click', async event => {
        const btnDel = event.target.closest('[data-del-u]');
        if (!btnDel) return;
        const id = btnDel.dataset.delU;
        const nama = btnDel.dataset.n;
        if (!confirm(`Hapus pengguna ${nama}?`)) return;
        try {
          await api('admin/users.php?id=' + encodeURIComponent(id), { method: 'DELETE' });
          tampilkanToast('Pengguna berhasil dihapus.');
          muatPengguna();
        } catch (err) {
          tampilkanToast(err.message || 'Gagal menghapus pengguna.');
        }
      });

      formUser?.addEventListener('submit', async event => {
        event.preventDefault();
        const nama = pilihElemen('#pengguna-nama')?.value.trim() || pilihElemen('#uf_name')?.value.trim();
        const email = (pilihElemen('#pengguna-email')?.value.trim() || pilihElemen('#uf_email')?.value.trim() || '').toLowerCase();
        const sandi = pilihElemen('#pengguna-sandi')?.value || pilihElemen('#uf_password')?.value;

        if (!nama || nama.length < 3) {
          tampilkanStatus(errBar, 'Nama min 3 karakter.');
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          tampilkanStatus(errBar, 'Format email tidak valid.');
          return;
        }
        if (!sandi || sandi.length < 8) {
          tampilkanStatus(errBar, 'Kata sandi min 8 karakter.');
          return;
        }

        try {
          await api('admin/users.php', {
            method: 'POST',
            body: { name: nama, email, password: sandi }
          });
          if (panelUser) panelUser.hidden = true;
          tampilkanToast('Pengguna baru berhasil ditambahkan!');
          muatPengguna();
        } catch (err) {
          tampilkanStatus(errBar, err.message || 'Gagal menambahkan pengguna.');
        }
      });

      muatPengguna();
    }
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
