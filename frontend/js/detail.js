/* FoodHub - detail.js
   Halaman detail resep: takaran bahan sesuai porsi dan tombol favorit.
   Bagian rating/ulasan ada di ulasan.js. */
'use strict';

const buatDaftar = (items, isi) => items.map(item => `<li>${isi(item)}</li>`).join('');

// Kerangka halaman detail; bagian dinamis (bahan, porsi, ulasan) diisi fungsi lain
function kerangkaDetail(resep) {
  const rating = resep.avg_rating != null ? Number(resep.avg_rating).toFixed(1) : '-';
  const kategori = (resep.categories || []).map(k => `<span class="tag">${esc(k)}</span>`).join(' ');
  const foto = gambar(resep.image_path);
  return `
    <div class="panel">
      <div>${kategori}</div>
      <h1>${esc(resep.title)}</h1>
      ${foto
        ? `<img class="foto-detail" src="${foto}" alt="Foto ${esc(resep.title)}" loading="eager">`
        : '<div class="foto-detail foto-detail-kosong" role="img" aria-label="Foto resep belum tersedia">Foto resep belum tersedia</div>'}
      <p class="muted sm">Oleh ${esc(resep.author || 'FoodHub')}</p>
      <div class="detail-info">
        <span>Waktu: <b>${resep.cook_time_minutes || 30} mnt</b></span>
        <span>Porsi: <b id="sv"></b></span>
        <span>Rating: <b>★ ${rating}</b></span>
      </div>
      ${resep.story ? `<p>${esc(resep.story)}</p>` : ''}
      <button class="btn sm" id="fv" type="button">&hearts; <span id="fvt"></span></button>
      <h2>Bahan-bahan</h2>
      <div class="atur-porsi">
        <span>Atur Porsi:</span>
        <button class="btn sm ghost" id="btnMinus" type="button">−</button>
        <b id="porsiDisplay"></b>
        <button class="btn sm ghost" id="btnPlus" type="button">+</button>
      </div>
      <ul id="bahanList"></ul>
      <h2>Langkah Memasak</h2>
      <ol>${buatDaftar(resep.steps, esc)}</ol>
    </div>
    <div class="panel" id="ulasan"></div>`;
}

// Porsi dan tombol favorit
function pasangPorsiFavorit(resep, id) {
  const tujuanMasuk = akar + 'masuk.html?next=' + encodeURIComponent('detail-resep.html?id=' + id);
  const porsiAwal = resep.servings || 4;
  let porsi = porsiAwal;
  let favorit = Boolean(resep.is_favorite);
  const tampilkan = () => {
    // Jumlah bahan dikali (porsi sekarang / porsi awal)
    $('#bahanList').innerHTML = buatDaftar(resep.ingredients, bahan => {
      const hitung = bahan.quantity * porsi / porsiAwal;
      const jumlah = bahan.quantity != null ? Math.round(hitung * 10) / 10 : '';
      const satuan = bahan.unit ? ' ' + esc(bahan.unit) : '';
      const takaran = jumlah ? `<strong>${jumlah}${satuan}</strong> ` : '';
      return takaran + esc(bahan.name);
    });
    $('#porsiDisplay').textContent = $('#sv').textContent = porsi;
    $('#fvt').textContent = favorit ? 'Tersimpan di Favorit' : 'Simpan ke Favorit';
  };
  $('#btnPlus').addEventListener('click', () => { porsi++; tampilkan(); });
  $('#btnMinus').addEventListener('click', () => { if (porsi > 1) { porsi--; tampilkan(); } });
  $('#fv').addEventListener('click', async () => {
    if (!penggunaAktif) return (location.href = tujuanMasuk);
    await coba(async () => {
      const jalur = 'favorites.php' + (favorit ? '?recipe_id=' + encodeURIComponent(id) : '');
      await api(jalur, favorit ? { method: 'DELETE' } : { method: 'POST', body: { recipe_id: id } });
      favorit = !favorit;
      tampilkan();
    }, 'Gagal memperbarui favorit.');
  });
  tampilkan();
}

HALAMAN['detail-resep'] = async function () {
  const id = parameterUrl.get('id');
  const tampilkanKosong = judul => {
    $('#dr').innerHTML = `
      <div class="empty">
        <h2>${judul}</h2>
        <a class="btn" href="daftar-resep.html">Lihat semua</a>
      </div>`;
  };
  let resep;
  try {
    resep = (await api('recipes.php?id=' + encodeURIComponent(id)))?.recipe;
    if (!resep || !Array.isArray(resep.ingredients) || !Array.isArray(resep.steps)) throw new Error();
  } catch (error) {
    const tidakAda = !id || [404, 422].includes(error.status);
    return tampilkanKosong(tidakAda ? 'Resep tidak ditemukan' : 'Gagal memuat resep');
  }
  $('#dr').innerHTML = kerangkaDetail(resep);
  $('#ulasan').innerHTML = '<h2>Ulasan</h2><div id="formUlasan"></div><div id="daftarUlasan"></div>';
  pasangPorsiFavorit(resep, id);
  pasangFormUlasan(id);
  muatUlasan(id);
};
