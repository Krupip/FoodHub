/* FoodHub - publik.js
   Logika halaman umum: beranda, daftar resep, FAQ, masuk, daftar, dan profil.
   Halaman detail resep ada di detail.js. */
'use strict';

// Beranda: tampilkan 4 resep terpopuler
HALAMAN.index = async function () {
  try {
    const { recipes } = await api('recipes.php?sort=popular&limit=4');
    $('#pop').innerHTML = recipes.map(kartuResep).join('');
  } catch (error) {
    $('#pop').innerHTML = kosong('Resep populer belum dapat dimuat.');
  }
};

// Daftar resep: cari berdasarkan nama/bahan, kategori, waktu masak, dan kesulitan
HALAMAN['daftar-resep'] = async function () {
  const kolom = { q: '#fq', category: '#fk', max_time: '#fw', difficulty: '#fd' };
  const awal = {
    q: parameterUrl.get('q') || parameterUrl.get('cari'),
    category: parameterUrl.get('category') || parameterUrl.get('kategori')
  };
  Object.entries(kolom).forEach(([kunci, pemilih]) => {
    const bidang = $(pemilih);
    if (bidang) bidang.value = awal[kunci] || '';
  });
  let penunda = null;
  const cariResep = async () => {
    const query = new URLSearchParams();
    Object.entries(kolom).forEach(([kunci, pemilih]) => {
      const bidang = $(pemilih);
      if (!bidang) return;
      const nilai = bidang.value.trim();
      if (nilai) query.set(kunci, nilai);
    });
    try {
      const { recipes = [] } = await api('recipes.php?' + query);
      const kosongPesan = 'Tidak ada resep yang sesuai dengan pencarian Anda.';
      $('#rl').innerHTML = recipes.length ? recipes.map(kartuResep).join('') : kosong(kosongPesan);
    } catch (error) {
      $('#rl').innerHTML = kosong('Gagal memuat resep.');
    }
  };
  // Ketikan ditunda 300 ms agar server tidak dibanjiri permintaan
  $('#fq').addEventListener('input', () => {
    clearTimeout(penunda);
    penunda = setTimeout(cariResep, 300);
  });
  ['#fk', '#fw', '#fd'].forEach(pemilih => {
    const bidang = $(pemilih);
    if (bidang) bidang.addEventListener('change', cariResep);
  });
  cariResep();
};

// FAQ: hanya satu pertanyaan yang terbuka dalam satu waktu
HALAMAN.faq = function () {
  $$('.faq details').forEach(item => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      $$('.faq details').forEach(lain => { if (lain !== item) lain.open = false; });
    });
  });
};

// Masuk
HALAMAN.masuk = function () {
  if (penggunaAktif) {
    return location.replace(penggunaAktif.role === 'admin' ? 'admin/dasbor.html' : 'profil.html');
  }
  if (parameterUrl.get('auth') === 'unavailable') {
    tampilkanStatus($('#er'), 'Tidak dapat memeriksa sesi. Pastikan backend tersedia.');
  }
  pasangForm($('#lf'), $('#er'), async () => {
    const email = $('#em').value.trim().toLowerCase();
    const sandi = $('#pw').value;
    if (!email || !sandi) return 'Email dan kata sandi wajib diisi.';
    const badan = { email, password: sandi, remember: $('#ing').checked };
    await api('auth.php?action=login', { method: 'POST', body: badan });
    const tujuan = parameterUrl.get('next');
    const tujuanAman = tujuan && /^(admin\/)?[a-z-]+\.html/i.test(tujuan);
    const beranda = penggunaAktif.role === 'admin' ? 'admin/dasbor.html' : 'index.html';
    location.href = tujuanAman ? tujuan : beranda;
  });
};

// Daftar akun baru
HALAMAN.daftar = function () {
  if (penggunaAktif) return location.replace('profil.html');
  pasangForm($('#df'), $('#er'), async () => {
    const nama = $('#dn').value.trim();
    const email = $('#de').value.trim().toLowerCase();
    const sandi = $('#dp').value;
    const galat = [
      nama.length < 3 && 'Nama min 3 karakter.',
      !emailValid(email) && 'Email tidak valid.',
      sandi.length < 8 && 'Kata sandi min 8 karakter.',
      sandi !== $('#dk').value && 'Konfirmasi kata sandi tidak sama.',
      !$('#ds').checked && 'Centang persetujuan syarat.'
    ].filter(Boolean);
    if (galat.length) return galat.join(' ');
    await api('auth.php?action=register', { method: 'POST', body: { name: nama, email, password: sandi } });
    location.href = 'index.html';
  });
};

// Profil: ubah nama dan lihat resep favorit
HALAMAN.profil = async function () {
  let profil = penggunaAktif;
  let favorit = [];
  try { profil = (await api('profile.php')).user || penggunaAktif; } catch (error) { /* pakai data sesi */ }
  try { favorit = (await api('favorites.php')).recipes || []; } catch (error) { /* favorit kosong */ }
  $('#pf').innerHTML = `
    <h1>Profil Saya</h1>
    <div class="panel">
      <p><strong>${esc(profil.name)}</strong><br>${esc(profil.email)}</p>
      <form id="nf">
        <div class="ok" id="no" hidden></div>
        <div class="err" id="ne" hidden></div>
        <div class="baris-form">
          <input id="nn" value="${esc(profil.name)}" maxlength="100" aria-label="Nama">
          <button class="btn sm" type="submit">Simpan</button>
        </div>
      </form>
    </div>
    <h2>Favorit (${favorit.length})</h2>
    <div class="grid">${favorit.map(kartuResep).join('') || kosong('Belum ada resep favorit.')}</div>`;
  pasangForm($('#nf'), $('#ne'), async () => {
    const nama = $('#nn').value.trim();
    if (nama.length < 3) return 'Nama min 3 karakter.';
    penggunaAktif = (await api('profile.php', { method: 'POST', body: { name: nama } })).user;
    tampilkanStatus($('#no'), 'Tersimpan!', true);
    $('#ne').hidden = true;
  });
};