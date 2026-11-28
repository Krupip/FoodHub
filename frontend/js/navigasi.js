/* FoodHub - navigasi.js
   Pemeriksaan sesi login, pembatasan halaman, menu navigasi, dan footer.
   Harus dimuat setelah main.js dan api.js. */
'use strict';

const keluar = () => coba(async () => {
  await api('auth.php?action=logout', { method: 'POST' });
  location.href = akar + 'index.html';
}, 'Gagal keluar.');

// Membuat deretan tautan menu; tautan halaman aktif diberi kelas "on"
function buatTautan(daftar, aktif, awalan) {
  return daftar.map(([berkas, label]) => {
    const kelas = berkas === aktif ? ' class="on"' : '';
    return `<a href="${awalan}${berkas}.html"${kelas}>${label}</a>`;
  }).join('');
}

const logoSitus = `
  <a class="logo" href="${akar}index.html">
    <img src="${akar}img/logo-foodhub.png" alt="FoodHub">
  </a>`;

// Mengembalikan true jika server tidak bisa dihubungi
async function periksaSesi() {
  try {
    penggunaAktif = validasiPengguna(await api('auth.php?action=me'), true);
    return false;
  } catch (error) {
    penggunaAktif = null;
    tampilkanToast('Tidak dapat memeriksa sesi. Pastikan backend tersedia.');
    return true;
  }
}

// Bagian kanan navbar: avatar + dropdown jika sudah masuk, tombol Masuk/Daftar jika tamu
function buatMenuAkun(u) {
  if (!u) {
    return `
      <a class="btn ghost sm" href="${akar}masuk.html">Masuk</a>
      <a class="btn sm" href="${akar}daftar.html">Daftar</a>`;
  }
  const tautanAdmin = u.role === 'admin' ? `<a href="${akar}admin/dasbor.html">Admin</a>` : '';
  return `
    <div class="acc">
      <button class="av" id="avb" type="button">${esc(u.name[0].toUpperCase())}</button>
      <div class="dd" id="dd" hidden>
        <div class="dn">${esc(u.name)}<small>${esc(u.email)}</small></div>
        <a href="${akar}profil.html">Profil</a>
        ${tautanAdmin}
        <button id="lo" type="button">Keluar</button>
      </div>
    </div>`;
}

function gambarNavbarPublik() {
  const menu = [['index', 'Beranda'], ['daftar-resep', 'Resep'], ['faq', 'FAQ']];
  const aktif = halaman === 'detail-resep' ? 'daftar-resep' : halaman;
  $('#nav').innerHTML = `
    <div class="container nb">
      ${logoSitus}
      <nav class="nl">${buatTautan(menu, aktif, akar)}</nav>
      <div class="na">${buatMenuAkun(penggunaAktif)}</div>
    </div>`;
  $('#avb')?.addEventListener('click', event => {
    event.stopPropagation();
    $('#dd').hidden = !$('#dd').hidden;
  });
  document.addEventListener('click', () => {
    if ($('#dd')) $('#dd').hidden = true;
  });
  $('#lo')?.addEventListener('click', keluar);
}

function gambarNavbarAdmin() {
  const menu = [['dasbor', 'Dasbor'], ['kelola-resep', 'Kelola Resep'], ['kelola-pengguna', 'Kelola Pengguna']];
  $('#header-atas').innerHTML = `
    <div class="container nb">
      ${logoSitus}
      <span class="muted sm">Halo, ${esc(penggunaAktif?.name || 'Admin')}</span>
    </div>`;
  $('#menu-samping').innerHTML = `
    <div class="container nb">
      ${buatTautan(menu, halaman, '')}
      <a href="${akar}index.html">Lihat Situs</a>
      <button id="alo" type="button">Keluar</button>
    </div>`;
  $('#alo').addEventListener('click', keluar);
}

// Footer yang kosong di HTML diisi hak cipta standar
function isiFooter() {
  const footer = $('#foot');
  if (!footer || footer.innerHTML.trim()) return;
  footer.innerHTML = `
    <div class="container">
      <p>&copy; 2026 <strong>FoodHub</strong> &bull; Platform Resep Makanan Digital Nusantara.</p>
    </div>`;
}

// Mengembalikan true bila halaman boleh dilanjutkan
async function mulaiNavigasi() {
  const serverGagal = await periksaSesi();
  const berkas = location.pathname.split('/').pop();
  const tujuan = (hakAkses === 'admin' ? 'admin/' : '') + berkas + location.search;
  if (hakAkses && !penggunaAktif) {
    const tambahan = serverGagal ? '&auth=unavailable' : '';
    location.replace(akar + 'masuk.html?next=' + encodeURIComponent(tujuan) + tambahan);
    return false;
  }
  if (hakAkses === 'admin' && penggunaAktif.role !== 'admin') {
    location.replace(akar + 'index.html');
    return false;
  }
  if ($('#nav')) gambarNavbarPublik();
  if ($('#menu-samping')) gambarNavbarAdmin();
  isiFooter();
  return true;
}