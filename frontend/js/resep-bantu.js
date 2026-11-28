/* FoodHub - resep-bantu.js
   Fungsi bantu halaman Kelola Resep: validasi foto, baris tabel, dan pengolah isian form.
   Dimuat sebelum admin-resep.js. */
'use strict';

const FORMAT_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

// Aturan sama dengan backend upload.php: JPG/PNG/WebP, maksimal 5 MB
function periksaFoto(file) {
  if (file?.type && !FORMAT_FOTO.includes(file.type)) return 'Format foto harus JPG, PNG, atau WebP.';
  if (file?.size > 5 * 1024 * 1024) return 'Ukuran foto maksimal 5 MB.';
  return '';
}

function barisResep(resep) {
  const tayang = resep.is_published == 1;
  const foto = gambar(resep.image_path || resep.image);
  const gambarMini = foto
    ? `<img class="t-thumb" src="${foto}" alt="${esc(resep.title)}">`
    : '<div class="t-thumb">🍳</div>';
  return `
    <tr>
      <td>${gambarMini}</td>
      <td><strong>${esc(resep.title)}</strong></td>
      <td>${esc((resep.categories || []).join(', ') || '-')}</td>
      <td>${resep.cook_time_minutes || 30} mnt</td>
      <td><span class="sts ${tayang ? 'tayang' : 'sembunyi'}">${tayang ? 'Tayang' : 'Draft'}</span></td>
      <td>
        <div class="aksi-grup">
          <button class="btn sm ${tayang ? 'ghost' : ''}" type="button"
            data-pub="${resep.id}" data-v="${tayang ? 0 : 1}">${tayang ? 'Tarik' : 'Tayang'}</button>
          <button class="btn sm ghost" type="button" data-edit="${resep.id}">Edit</button>
          <button class="btn sm danger" type="button" data-del="${resep.id}">Hapus</button>
        </div>
      </td>
    </tr>`;
}

// Baris teks di textarea diubah menjadi larik; baris kosong dibuang
const barisTeks = id => $('#' + id).value.split('\n').map(b => b.trim()).filter(Boolean);

// Format bahan per baris: "Nama, Jumlah, Satuan"
function ubahBahan(baris) {
  const [nama, jumlah, satuan] = baris.split(',').map(s => s.trim());
  return { name: nama || baris, quantity: Number(jumlah) || 1, unit: satuan || 'secukupnya' };
}