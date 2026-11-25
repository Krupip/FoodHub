// 1. KONFIGURASI, SHORTCUT DOM, & STATE
const API = 'api', $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const on = (el, ev, fn) => el?.addEventListener(ev, fn), fObj = f => Object.fromEntries(new FormData(f));
const val = (s, v) => $(s) && ($(s).value = v ?? ''), txt = (s, v) => $(s) && ($(s).textContent = v);
const btn = (c, d, t) => `<button class="btn btn-sm ${c}" data-id="${d}">${t}</button>`;
let csrf = $('meta[name="csrf-token"]')?.content || '', user = null, detail = null, porsi = 1, base = 1, star = 5;

// 2. HELPER FETCH API (Jembatan Frontend <-> Backend PHP + CSRF)
async function api(url, method = 'GET', body) {
  const h = csrf ? { 'X-CSRF-Token': csrf } : {};
  if (body && !(body instanceof FormData)) { h['Content-Type'] = 'application/json'; body = JSON.stringify(csrf ? { csrf_token: csrf, ...body } : body); }
  else if (body instanceof FormData && csrf) body.append('csrf_token', csrf);
  const res = await fetch(`${API}/${url}`, { method, headers: h, body, credentials: 'same-origin' });
  const d = await res.json().catch(() => ({})); if (d.csrf_token) csrf = d.csrf_token;
  if (!res.ok || d.success === false) throw new Error(d.message || 'Request gagal'); return d; }
const put = (u, b, fn) => api(u, 'PUT', b).then(fn), del = (u, fn) => confirm('Hapus?') && api(u, 'DELETE').then(fn);

// 3. HELPER LIST & CETAK KARTU RESEP
const list = r => Array.isArray(r) ? r : (r?.data || r?.recipes || r?.categories || r?.reviews || r?.users || []);
const cards = (el, items, fav) => el && (el.innerHTML = items.length ? items.map(r => `<div class="recipe-card">` +
  `<a href="recipe-detail.html?id=${r.id}"><img src="${r.image || r.image_url || ''}"></a><div class="recipe-card-body">` +
  `<small>${r.category_name || ''} • ${r.cooking_time || '-'} mnt</small><h4><a href="recipe-detail.html?id=${r.id}">${r.title}</a></h4>` +
  `${fav ? btn('rm-fav', r.id, 'Hapus') : ''}</div></div>`).join('') : '<p>Tidak ada resep.</p>');

// 4. INISIALISASI FITUR SAAT HALAMAN SELESAI DIMUAT
document.addEventListener('DOMContentLoaded', async () => {
  // A. AUTH: Cek sesi user, form login/register, & logout (auth.php)
  try { const r = await api('auth.php?action=me'); user = r.user || r.data || null; } catch {}
  ['login', 'register'].forEach(a => on($(`#${a}-form`), 'submit', async e => {
    e.preventDefault(); await api(`auth.php?action=${a}`, 'POST', fObj(e.target)); location.href = a === 'login' ? 'index.html' : 'login.html'; }));
  on($('#btn-logout'), 'click', async e => { e.preventDefault(); await api('auth.php?action=logout', 'POST').catch(() => {}); location.href = 'login.html'; });

  // B. BERANDA & DAFTAR RESEP: Cari, chip kategori, & filter (categories.php, recipes.php)
  const cats = list(await api('categories.php').catch(() => [])), feat = $('#featured-recipes'), chips = $('#category-chips'), grid = $('#recipes-grid');
  on($('#btn-home-search'), 'click', () => location.href = `recipes.html?q=${encodeURIComponent($('#home-search-input')?.value || '')}`);
  if (chips && cats.length) { // Tombol chip kategori beranda
    chips.innerHTML = `<button class="chip active" data-c="">Semua</button>` + cats.map(c => `<button class="chip" data-c="${c.id}">${c.name}</button>`).join('');
    on(chips, 'click', async e => { const b = e.target.closest('.chip'); if (!b) return; $$('.chip', chips).forEach(x => x.classList.remove('active'));
      b.classList.add('active'); cards(feat, list(await api(b.dataset.c ? `recipes.php?category=${b.dataset.c}` : 'recipes.php?sort=popular&limit=4'))); }); }
  if (feat) cards(feat, list(await api('recipes.php?sort=popular&limit=4')));
  if (grid) { // Filter pencarian, kategori, waktu, kesulitan, & reset
    const p = new URLSearchParams(location.search), q = $('#search-input'), cat = $('#filter-category'), tm = $('#filter-time'), df = $('#filter-difficulty');
    if (cat) cat.innerHTML = `<option value="">Semua Kategori</option>` + cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    val('#search-input', p.get('q')); val('#filter-category', p.get('category'));
    const load = async () => { const qs = new URLSearchParams(); [['q', q], ['category', cat], ['max_time', tm], ['difficulty', df]]
      .forEach(([k, el]) => el?.value && qs.set(k, el.value)); cards(grid, list(await api(`recipes.php?${qs}`))); };
    [q, cat, tm, df].forEach(el => on(el, el === q ? 'input' : 'change', load));
    on($('#btn-reset-filter'), 'click', () => { [q, cat, tm, df].forEach(el => el && (el.value = '')); load(); }); load(); }

  // C. DETAIL RESEP: Porsi (+/-), favorit, & ulasan (recipes.php, favorites.php, reviews.php)
  const box = $('#recipe-detail'), id = new URLSearchParams(location.search).get('id');
  if (box && id) {
    const res = await api(`recipes.php?id=${id}`); detail = res.recipe || res.data || res; base = porsi = Math.max(1, parseInt(detail.servings) || 1);
    const renderIng = () => { txt('#porsi-val', `${porsi} Porsi`); // Hitung ulang takaran bahan
      $('#ingredients-list').innerHTML = (detail.ingredients || []).map(i => `<li class="ingredient-item">` +
        `<span class="ing-measure">${i.quantity > 0 ? +(i.quantity * porsi / base).toFixed(2) + ' ' + (i.unit || '') : 'Secukupnya'}</span><span>${i.name}</span></li>`).join(''); };
    $('#ingredients-list')?.insertAdjacentHTML('beforebegin', `<div class="servings-control"><button id="p-min" class="servings-btn">−</button><strong id="porsi-val"></strong><button id="p-plus" class="servings-btn">+</button></div>`);
    renderIng(); on($('#p-min'), 'click', () => porsi > 1 && (porsi--, renderIng())); on($('#p-plus'), 'click', () => (porsi++, renderIng()));
    on($('#btn-favorite'), 'click', async e => { const f = await api('favorites.php', 'POST', { recipe_id: id }); e.target.textContent = f.is_favorite ? '♥ Tersimpan' : '♡ Favorit'; });
    box.insertAdjacentHTML('beforeend', `<section class="reviews-section"><h3>Ulasan (<span id="avg-r">0</span> ★)</h3><form id="rev-form"><div class="star-picker">` +
      `${[1,2,3,4,5].map(n => `<button type="button" data-s="${n}" class="active">★</button>`).join('')}</div><textarea id="rev-txt" required></textarea><button class="btn btn-primary btn-sm">Kirim</button></form><div id="rev-list"></div></section>`);
    on($('.star-picker'), 'click', e => e.target.dataset.s && (star = +e.target.dataset.s, $$('.star-picker button').forEach(b => b.classList.toggle('active', +b.dataset.s <= star))));
    const loadRev = async () => { const revs = list(await api(`reviews.php?recipe_id=${id}`)); // Muat ulasan & rating
      txt('#avg-r', revs.length ? (revs.reduce((a, b) => a + +b.rating, 0) / revs.length).toFixed(1) : '0');
      $('#rev-list').innerHTML = revs.map(v => `<div class="review-item"><b>${v.user_name || 'User'}</b> (${'★'.repeat(v.rating)}) ` +
        `${user && (user.role === 'admin' || user.id == v.user_id) ? btn('btn-danger del-r', v.id, 'Hapus') : ''}<p>${v.comment}</p></div>`).join(''); };
    on($('#rev-form'), 'submit', async e => { e.preventDefault(); await api('reviews.php', 'POST', { recipe_id: id, rating: star, comment: $('#rev-txt').value }); val('#rev-txt', ''); loadRev(); });
    on($('#rev-list'), 'click', e => e.target.classList.contains('del-r') && del(`reviews.php?id=${e.target.dataset.id}`, loadRev)); loadRev(); }

  // D. PROFIL & ADMIN: Profil, favorit, statistik, kelola resep/foto, & kelola user
  if ($('#profile-form')) { val('#profile-form [name="name"]', (await api('profile.php')).user?.name); // Ubah profil
    on($('#profile-form'), 'submit', async e => { e.preventDefault(); await api('profile.php', 'POST', fObj(e.target)); alert('Tersimpan'); }); }
  if ($('#favorite-recipes')) { const loadFav = async () => cards($('#favorite-recipes'), list(await api('favorites.php')), true); // Favorit
    on($('#favorite-recipes'), 'click', e => e.target.classList.contains('rm-fav') && api('favorites.php', 'POST', { recipe_id: e.target.dataset.id, action: 'remove' }).then(loadFav)); loadFav(); }
  if ($('[data-stat], #stat-recipes')) { const st = (await api('admin/stats.php')).stats || await api('admin/stats.php'); // Statistik
    ['recipes', 'users', 'categories', 'reviews'].forEach(k => { const v = st[`total_${k}`] ?? st[k] ?? 0; txt(`#stat-${k}`, v); $$(`[data-stat="${k}"]`).forEach(el => el.textContent = v); }); }
  const rBody = $('#admin-recipes-tbody'), uBody = $('#admin-users-tbody');
  if (rBody) { // Admin: Kelola Resep CRUD & Upload Foto (admin/recipes.php, admin/upload.php)
    document.body.insertAdjacentHTML('beforeend', `<div id="r-modal" class="modal-backdrop"><div class="modal-dialog"><form id="r-form">` +
      `<input type="hidden" name="id"><input type="hidden" name="image" id="r-img"><input name="title" placeholder="Judul" required><input name="category_id" placeholder="ID Kategori" required>` +
      `<input type="number" name="cooking_time" value="30"><input type="number" name="servings" value="2"><select name="difficulty"><option>Mudah</option><option>Sedang</option></select>` +
      `<input type="file" id="r-file"><textarea name="ingredients_json" placeholder='[{"quantity":2,"unit":"sdm","name":"Gula"}]'></textarea>` +
      `<button class="btn btn-primary">Simpan</button> <button type="button" class="btn" onclick="$('#r-modal').classList.remove('open')">Tutup</button></form></div></div>`);
    const loadR = async () => rBody.innerHTML = list(await api('admin/recipes.php')).map(r => `<tr><td><img class="table-thumb" src="${r.image || ''}"></td><td>${r.title}</td><td>${r.category_name || '-'}</td>` +
      `<td><span class="badge ${r.is_published == 1 ? 'badge-success' : 'badge-warning'}">${r.is_published == 1 ? 'Tayang' : 'Draft'}</span></td>` +
      `<td><button class="btn btn-sm r-pub" data-id="${r.id}" data-p="${r.is_published}">${r.is_published == 1 ? 'Tarik' : 'Tayang'}</button> ${btn('r-edit', r.id, 'Edit')} ${btn('btn-danger r-del', r.id, 'Hapus')}</td></tr>`).join('');
    on($('#btn-add-recipe'), 'click', () => { $('#r-form').reset(); val('#r-form [name="id"]', ''); $('#r-modal').classList.add('open'); });
    on($('#r-file'), 'change', async e => { const fd = new FormData(); fd.append('image', e.target.files[0]); val('#r-img', (await api('admin/upload.php', 'POST', fd)).url); alert('Foto terunggah'); });
    on($('#r-form'), 'submit', async e => { e.preventDefault(); const d = fObj(e.target); try { d.ingredients = JSON.parse(d.ingredients_json || '[]'); } catch { d.ingredients = []; } await api('admin/recipes.php', d.id ? 'PUT' : 'POST', d); $('#r-modal').classList.remove('open'); loadR(); });
    on(rBody, 'click', async e => { const id = e.target.dataset.id; if (!id) return; if (e.target.classList.contains('r-del')) del(`admin/recipes.php?id=${id}`, loadR);
      if (e.target.classList.contains('r-pub')) put('admin/recipes.php', { id, is_published: e.target.dataset.p == 1 ? 0 : 1 }, loadR);
      if (e.target.classList.contains('r-edit')) { const d = (await api(`recipes.php?id=${id}`)).recipe || {}; ['id', 'title', 'category_id', 'cooking_time', 'servings', 'difficulty', 'image'].forEach(k => val(`#r-form [name="${k}"]`, d[k])); val('#r-form [name="ingredients_json"]', JSON.stringify(d.ingredients || [])); $('#r-modal').classList.add('open'); } }); loadR(); }
  if (uBody) { // Admin: Kelola Pengguna (admin/users.php)
    const loadU = async () => uBody.innerHTML = list(await api('admin/users.php')).map((u, i) => `<tr><td>${i + 1}</td><td>${u.name}</td><td>${u.email}</td><td><select class="u-role" data-id="${u.id}"><option value="user">User</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select></td><td><button class="btn btn-sm u-stat" data-id="${u.id}" data-a="${u.is_active ?? 1}">${(u.is_active ?? 1) == 1 ? 'Nonaktifkan' : 'Aktifkan'}</button> ${btn('btn-danger u-del', u.id, 'Hapus')}</td></tr>`).join('');
    on(uBody, 'change', e => e.target.classList.contains('u-role') && put('admin/users.php', { id: e.target.dataset.id, role: e.target.value }));
    on(uBody, 'click', e => { const id = e.target.dataset.id; if (!id) return; if (e.target.classList.contains('u-stat')) put('admin/users.php', { id, is_active: e.target.dataset.a == 1 ? 0 : 1 }, loadU); if (e.target.classList.contains('u-del')) del(`admin/users.php?id=${id}`, loadU); }); loadU(); }
});