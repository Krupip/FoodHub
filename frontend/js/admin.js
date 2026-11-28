/* FoodHub - admin.js
   Logika halaman admin: dasbor statistik dan kelola pengguna.
   Pengelolaan resep ada di admin-resep.js (dimuat setelah file ini). */
'use strict';

// Memuat data ke dalam tabel; tabel kosong menampilkan pesan
async function muatTabel(tabel, jalur, kunci, buatBaris, pesanKosong) {
  let daftar = [];
  try {
    daftar = (await api(jalur))?.[kunci] || [];
  } catch (error) {
    tampilkanToast(error.message || 'Gagal memuat data.');
  }
  tabel.innerHTML = daftar.map(buatBaris).join('')
    || `<tr><td colspan="6" class="kosong">${pesanKosong}</td></tr>`;
}

// Satu pendengar klik untuk semua tombol di dalam tabel
function aksiTabel(tabel, pemilih, tugas, pesanGagal) {
  tabel.addEventListener('click', async event => {
    const tombol = event.target.closest(pemilih);
    if (tombol) await coba(() => tugas(tombol.dataset), pesanGagal);
  });
}

HALAMAN.dasbor = async function () {
  let statistik = {};
  try {
    statistik = (await api('admin/stats.php')).stats || {};
  } catch (error) {
    tampilkanToast(error.message || 'Gagal memuat statistik dasbor.');
  }
  const kotak = {
    statTotal: 'total_recipes',
    statTayang: 'published_recipes',
    statSembunyi: 'hidden_recipes',
    statPengguna: 'total_users'
  };
  Object.entries(kotak).forEach(([id, kunci]) => {
    $('#' + id).textContent = String(statistik[kunci] ?? 0);
  });
};

// Satu baris tabel pengguna; admin dan akun sendiri tidak boleh dihapus
function barisPengguna(u) {
  const dilindungi = u.role === 'admin' || u.id === penggunaAktif?.id;
  const aksi = dilindungi
    ? '<span class="muted sm">Tidak dapat dihapus</span>'
    : `<button class="btn danger sm" type="button" data-del-u="${u.id}" data-n="${esc(u.name)}">Hapus</button>`;
  return `
    <tr>
      <td><b>#${esc(u.id || '-')}</b></td>
      <td><strong>${esc(u.name)}</strong></td>
      <td>${esc(u.email)}</td>
      <td><span class="sts ${u.role === 'admin' ? 'admin' : 'tayang'}">${esc(u.role)}</span></td>
      <td>${esc(u.created_at ? u.created_at.slice(0, 10) : '-')}</td>
      <td>${aksi}</td>
    </tr>`;
}

HALAMAN['kelola-pengguna'] = async function () {
  const tabel = $('#userTableBody');
  const panel = $('#userPanel');
  const form = $('#userForm');
  const kotakError = $('#userFormErr');
  const muat = () => muatTabel(tabel, 'admin/users.php', 'users', barisPengguna, 'Tidak ada pengguna.');
  $('#btnTambahPengguna').addEventListener('click', () => {
    form.reset();
    kotakError.hidden = true;
    panel.hidden = false;
  });
  $('#userCancel').addEventListener('click', () => { panel.hidden = true; });
  aksiTabel(tabel, '[data-del-u]', async data => {
    if (!confirm(`Hapus pengguna ${data.n}?`)) return;
    await api(urlAdmin('users', data.delU), { method: 'DELETE' });
    tampilkanToast('Pengguna berhasil dihapus.');
    muat();
  }, 'Gagal menghapus pengguna.');
  pasangForm(form, kotakError, async () => {
    const nama = $('#pengguna-nama').value.trim();
    const email = $('#pengguna-email').value.trim().toLowerCase();
    const sandi = $('#pengguna-sandi').value;
    if (nama.length < 3) return 'Nama min 3 karakter.';
    if (!emailValid(email)) return 'Format email tidak valid.';
    if (sandi.length < 8) return 'Kata sandi min 8 karakter.';
    await api('admin/users.php', { method: 'POST', body: { name: nama, email, password: sandi } });
    panel.hidden = true;
    tampilkanToast('Pengguna baru berhasil ditambahkan!');
    muat();
  });
  muat();
};