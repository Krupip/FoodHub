/* FoodHub - ulasan.js
   Rating dan ulasan pada halaman detail resep: membaca, mengirim, dan menghapus ulasan.
   Dimuat sebelum detail.js. */
'use strict';

const bintang = nilai => '★'.repeat(nilai) + '☆'.repeat(5 - nilai);

// Daftar ulasan pengguna lain
async function muatUlasan(id) {
  let ulasan = [];
  try {
    ulasan = (await api('reviews.php?recipe_id=' + encodeURIComponent(id))).reviews || [];
  } catch (error) {
    ulasan = [];
  }
  $('#daftarUlasan').innerHTML = ulasan.map(u => `
    <div class="ulasan">
      <b>${esc(u.user_name)}</b>
      <span class="bintang">${bintang(u.rating)}</span>
      <small class="muted">${esc((u.created_at || '').slice(0, 10))}</small>
      ${u.comment ? `<p>${esc(u.comment)}</p>` : ''}
    </div>`).join('') || '<p class="teks-redup">Belum ada ulasan. Jadilah yang pertama!</p>';
}

// Form kirim / hapus ulasan (hanya untuk pengguna yang sudah masuk)
function pasangFormUlasan(id) {
  if (!penggunaAktif) {
    const tautanMasuk = akar + 'masuk.html?next=' + encodeURIComponent('detail-resep.html?id=' + id);
    $('#formUlasan').innerHTML = `<p class="teks-redup"><a href="${tautanMasuk}">Masuk</a> untuk menulis ulasan.</p>`;
    return;
  }
  $('#formUlasan').innerHTML = `
    <form id="uf">
      <div class="err" id="ue" hidden></div>
      <div class="kolom-input">
        <label for="ur">Rating</label>
        <select id="ur">
          <option value="5">★★★★★ (5)</option>
          <option value="4">★★★★ (4)</option>
          <option value="3">★★★ (3)</option>
          <option value="2">★★ (2)</option>
          <option value="1">★ (1)</option>
        </select>
      </div>
      <div class="kolom-input">
        <label for="uk">Komentar (opsional)</label>
        <textarea id="uk" rows="3" maxlength="1000"></textarea>
      </div>
      <button class="btn sm" type="submit">Kirim Ulasan</button>
      <button class="btn sm danger" id="uh" type="button">Hapus Ulasan Saya</button>
    </form>`;
  pasangForm($('#uf'), $('#ue'), async () => {
    const badan = { recipe_id: id, rating: Number($('#ur').value), comment: $('#uk').value.trim() };
    await api('reviews.php', { method: 'POST', body: badan });
    $('#ue').hidden = true;
    tampilkanToast('Ulasan berhasil dikirim.');
    muatUlasan(id);
  });
  $('#uh').addEventListener('click', () => coba(async () => {
    if (!confirm('Hapus ulasan Anda untuk resep ini?')) return;
    await api('reviews.php?recipe_id=' + encodeURIComponent(id), { method: 'DELETE' });
    tampilkanToast('Ulasan dihapus.');
    muatUlasan(id);
  }, 'Gagal menghapus ulasan.'));
}