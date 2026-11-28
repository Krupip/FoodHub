/* FoodHub - api.js
   Komunikasi dengan API backend PHP, termasuk validasi sesi dan token CSRF.
   Harus dimuat setelah main.js. */
'use strict';

// Memeriksa data pengguna dari server; tamu (user: null) diperbolehkan jika diminta
function validasiPengguna(data, bolehTamu) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || 'error' in data) {
    throw new Error(PESAN_AUTH);
  }
  const u = data.user;
  if (bolehTamu && u === null) return null;
  const idValid = u && /^[1-9]\d*$/.test(String(u.id));
  const isiValid = u && String(u.name || '').trim() && String(u.email || '').trim();
  if (!(idValid && isiValid && ['member', 'admin'].includes(u.role))) {
    throw new Error(PESAN_AUTH);
  }
  return u;
}

async function api(jalur, opsi = {}) {
  const metode = (opsi.method || 'GET').toUpperCase();
  const [berkas, query] = jalur.split('?');
  const aksi = berkas === 'auth.php' ? new URLSearchParams(query || '').get('action') : null;
  const publik = metode === 'POST' && ['login', 'register'].includes(aksi);
  const aman = ['GET', 'HEAD', 'OPTIONS'].includes(metode);
  if (!aman && !publik && !tokenCsrf) await api('auth.php?action=me');
  const header = { 'Content-Type': 'application/json' };
  let badan = opsi.body;
  if (badan instanceof FormData) {
    delete header['Content-Type'];
  } else if (badan && typeof badan === 'object') {
    badan = JSON.stringify(badan);
  }
  if (!aman && tokenCsrf) header['X-CSRF-Token'] = tokenCsrf;
  const respons = await fetch(akar + '../backend/api/' + jalur, {
    ...opsi, method: metode, credentials: 'same-origin', headers: header, body: badan
  });
  const token = respons.headers?.get?.('X-CSRF-Token');
  const tokenValid = /^[0-9a-f]{64}$/.test(token || '') ? token : null;
  const data = await respons.json().catch(() => ({}));
  const cekSesi = (metode === 'GET' && aksi === 'me') || publik;
  if (respons.ok && cekSesi) {
    // Simpan pengguna dan token CSRF dari server
    penggunaAktif = tokenCsrf = null;
    penggunaAktif = validasiPengguna(data, aksi === 'me');
    if (penggunaAktif && !tokenValid) throw new Error(PESAN_CSRF);
    tokenCsrf = penggunaAktif ? tokenValid : null;
  } else if ((respons.ok && aksi === 'logout') || (respons.status === 401 && !publik)) {
    penggunaAktif = tokenCsrf = null;
  } else if (tokenValid) {
    tokenCsrf = tokenValid;
  }
  if (!respons.ok) {
    throw Object.assign(new Error(data?.error || 'Terjadi kesalahan sistem.'), { status: respons.status });
  }
  return data;
}