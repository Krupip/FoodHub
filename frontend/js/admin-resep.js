/* FoodHub - admin-resep.js
   Halaman Kelola Resep: form tambah/edit, unggah foto, tayang/tarik, dan hapus.
   Dimuat setelah admin.js (muatTabel, aksiTabel) dan resep-bantu.js. */
'use strict';

HALAMAN['kelola-resep'] = async function () {
  const tabel = $('#resepTableBody');
  const panel = $('#recipePanel');
  const form = $('#recipeForm');
  const tombolSimpan = $('#resep-simpan');
  const inputFoto = $('#resep-foto');
  const pratinjau = $('#resep-foto-pratinjau');
  const infoFoto = $('#resep-foto-info');
  let pathFoto = '';        // path foto yang tersimpan di server (dikirim ulang saat edit)
  let urlSementara = null;  // URL sementara file baru; dilepas agar memori tidak bocor
  let tayangSaatEdit = true;

  const aturFoto = (url, info, lokal) => {
    if (urlSementara) URL.revokeObjectURL(urlSementara);
    urlSementara = lokal ? url : null;
    if (url) pratinjau.src = url; else pratinjau.removeAttribute('src');
    pratinjau.hidden = !url;
    infoFoto.textContent = info;
  };
  const fotoLama = () => aturFoto(
    gambar(pathFoto),
    pathFoto ? 'Foto saat ini. Pilih file baru untuk menggantinya.' : 'Belum ada foto dipilih.',
    false
  );
  const bukaForm = (judul, foto = '', tayang = true) => {
    form.reset();
    $('#resep-id').value = '';  // input hidden tidak ikut dikosongkan oleh reset()
    $('#modalTitle').textContent = judul;
    pathFoto = foto;
    tayangSaatEdit = tayang;
    fotoLama();
    panel.hidden = false;
  };
  const muat = () => muatTabel(tabel, 'admin/recipes.php', 'recipes', barisResep, 'Belum ada resep.');

  inputFoto.addEventListener('change', () => {
    const file = inputFoto.files?.[0];
    const pesan = periksaFoto(file);
    if (pesan) {
      inputFoto.value = '';
      tampilkanToast(pesan);
    }
    if (!file || pesan) return fotoLama();
    aturFoto(URL.createObjectURL(file), `${file.name} (${(file.size / 1048576).toFixed(2)} MB)`, true);
  });

  aksiTabel(tabel, '[data-del]', async data => {
    if (!confirm('Hapus resep ini?')) return;
    await api(urlAdmin('recipes', data.del), { method: 'DELETE' });
    tampilkanToast('Resep dihapus.');
    muat();
  }, 'Gagal menghapus.');

  aksiTabel(tabel, '[data-pub]', async data => {
    // Backend mewajibkan is_published bertipe boolean, bukan angka 0/1
    await api(urlAdmin('recipes', data.pub), { method: 'PATCH', body: { is_published: data.v === '1' } });
    tampilkanToast('Status resep diperbarui.');
    muat();
  }, 'Gagal memperbarui status.');

  aksiTabel(tabel, '[data-edit]', async data => {
    // Endpoint admin dipakai agar resep draft (disembunyikan) tetap bisa diedit
    const resep = (await api(urlAdmin('recipes', data.edit)))?.recipe;
    if (!resep) return;
    bukaForm('Edit Resep', resep.image_path || '', resep.is_published !== false);
    const teksBahan = (resep.ingredients || [])
      .map(b => `${b.name || ''}, ${b.quantity || ''}, ${b.unit || ''}`)
      .join('\n');
    const isian = {
      'resep-id': resep.id || '',
      'resep-nama': resep.title || '',
      'resep-daerah': resep.region || '',
      'resep-waktu': resep.cook_time_minutes || 30,
      'resep-porsi': resep.servings || 4,
      'resep-kesulitan': resep.difficulty || 'sedang',
      'resep-deskripsi': resep.story || '',
      'resep-bahan': teksBahan,
      'resep-langkah': (resep.steps || []).join('\n')
    };
    Object.entries(isian).forEach(([id, nilai]) => { $('#' + id).value = nilai; });
    if (resep.categories?.length) $('#resep-kategori').value = resep.categories[0];
  }, 'Gagal memuat resep.');

  $('#btnTambahResep').addEventListener('click', () => bukaForm('Tambah Resep Baru'));
  $('#formCancel').addEventListener('click', () => { bukaForm(''); panel.hidden = true; });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const judul = $('#resep-nama').value.trim();
    const cerita = $('#resep-deskripsi').value.trim();
    const file = inputFoto.files?.[0] || null;
    const id = $('#resep-id').value;
    if (!judul || !cerita) return tampilkanToast('Nama dan deskripsi resep wajib diisi.');
    if (periksaFoto(file)) return tampilkanToast(periksaFoto(file));
    const data = {
      title: judul,
      story: cerita,
      region: $('#resep-daerah').value.trim(),
      categories: [$('#resep-kategori').value].filter(Boolean),
      cook_time_minutes: Number($('#resep-waktu').value) || 30,
      difficulty: $('#resep-kesulitan').value || 'sedang',
      servings: Number($('#resep-porsi').value) || 4,
      steps: barisTeks('resep-langkah'),
      ingredients: barisTeks('resep-bahan').map(ubahBahan),
      image_path: pathFoto,        // tanpa foto baru, foto lama tetap dipakai
      is_published: tayangSaatEdit // status tayang tidak berubah saat edit
    };
    tombolSimpan.disabled = true;
    tombolSimpan.textContent = 'Menyimpan...';
    await coba(async () => {
      if (file) {
        const unggahan = new FormData();
        unggahan.append('image', file);
        data.image_path = (await api('admin/upload.php', { method: 'POST', body: unggahan })).image_path;
      }
      await api(id ? urlAdmin('recipes', id) : 'admin/recipes.php', { method: id ? 'PUT' : 'POST', body: data });
      tampilkanToast(id ? 'Resep berhasil diubah!' : 'Resep berhasil ditambahkan!');
      bukaForm('');
      panel.hidden = true;
      muat();
    }, 'Gagal menyimpan resep.');
    tombolSimpan.disabled = false;
    tombolSimpan.textContent = 'Simpan Resep';
  });
  muat();
};