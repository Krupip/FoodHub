/* FoodHub - main.js */
(function () {
  'use strict'; const P = document.body.dataset.page, R = document.body.dataset.root || '', ACC = document.body.dataset.access || '';
  const qs = new URLSearchParams(location.search); const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bar = (el, msg, ok) => { el.className = ok ? 'ok' : 'err'; el.textContent = msg; el.hidden = false; };
  function toast(msg) { let t = $('#toast') || Object.assign(document.createElement('div'), { id: 'toast' }); if (!t.parentElement) document.body.appendChild(t);
    t.textContent = msg; t.className = 'show'; clearTimeout(t._h); t._h = setTimeout(() => { t.className = ''; }, 2600); }
  const BASE = (R ? R + '../' : '../') + 'backend/api/', CSRF_ERR = 'Token CSRF server hilang atau tidak valid. Muat ulang halaman.';
  const AUTH_ERR = 'Respons autentikasi server tidak valid. Silakan coba lagi.', UNAV_ERR = 'Tidak dapat memeriksa sesi. Pastikan backend tersedia.';
  let csrfToken = null, U = null, loggingOut = false; const isSafe = m => ['GET', 'HEAD', 'OPTIONS'].includes(m);
  const authAct = p => p.split('?')[0] === 'auth.php' ? new URLSearchParams(p.split('?')[1] || '').get('action') : null;
  const authResp = d => { if (!d || typeof d !== 'object' || Array.isArray(d) || 'error' in d) throw new Error(AUTH_ERR); return d; };
  const authUser = (d, guest = false) => { const u = authResp(d).user; if (guest && u === null) return null;
    const ok = u && ((Number.isSafeInteger(u.id) && u.id > 0) || (typeof u.id === 'string' && /^[1-9]\d*$/.test(u.id)));
    if (!ok || !u.name?.trim() || !u.email?.trim() || !['member', 'admin'].includes(u.role)) throw new Error(AUTH_ERR); return u; }; async function fetchApi(path, opts = {}) {
    const method = (opts.method || 'GET').toUpperCase(), act = authAct(path), pub = method === 'POST' && ['login', 'register'].includes(act);
    const hdrs = { 'Content-Type': 'application/json', ...opts.headers }; for (const k in hdrs) { if (k.toLowerCase() === 'x-csrf-token') delete hdrs[k]; }
    if (!isSafe(method) && csrfToken) hdrs['X-CSRF-Token'] = csrfToken;
    let body = opts.body; if (body instanceof FormData) delete hdrs['Content-Type']; else if (body && typeof body === 'object') body = JSON.stringify(body);
    const res = await fetch(BASE + path, { ...opts, method, credentials: 'same-origin', headers: hdrs, body }); const hdr = res.headers && typeof res.headers.get === 'function' ? res.headers.get('X-CSRF-Token') : null;
    const tok = typeof hdr === 'string' && /^[0-9a-f]{64}$/.test(hdr) ? hdr : null, data = await res.json().catch(() => ({}));
    if (res.ok && ((method === 'GET' && act === 'me') || pub)) { csrfToken = null; U = null; const user = authUser(data, act === 'me'); if (user && !tok) throw new Error(CSRF_ERR);
      U = user; csrfToken = user ? tok : null; } else if (res.ok && method === 'POST' && act === 'logout') {
      if (typeof authResp(data).message !== 'string' || !data.message.trim()) throw new Error(AUTH_ERR); U = null; csrfToken = null;
    } else if (res.status === 401 && !pub) { U = null; csrfToken = null; } else if (tok) { csrfToken = tok; }
    if (!res.ok) { const err = new Error(data?.error || 'Terjadi kesalahan sistem.'); err.status = res.status; err.data = data; throw err; } return data; }
  async function api(path, opts = {}) { const m = (opts.method || 'GET').toUpperCase();
    if (!isSafe(m) && !(['login', 'register'].includes(authAct(path)) && m === 'POST') && !csrfToken) await fetchApi('auth.php?action=me'); return fetchApi(path, opts); }
  const ld = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }; const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const clearAuth = () => { try { sessionStorage.removeItem('fh_s'); } catch {} try { localStorage.removeItem('fh_s'); } catch {} };
  const users = () => { let u = ld('fh_users', null); if (!u) { u = [{ name: 'Admin FoodHub', email: 'admin@foodhub.id', role: 'admin', fav: [], at: '2026-08-01' },
           { name: 'Raka Pratama', email: 'raka@contoh.id', role: 'member', fav: [1, 2], at: '2026-09-12' },
           { name: 'Nadia Putri', email: 'nadia@contoh.id', role: 'member', fav: [3], at: '2026-10-03' }]; sv('fh_users', u);
    } if (Array.isArray(u) && u.some(x => 'pass' in x)) { u = u.map(({ pass, ...r }) => r); sv('fh_users', u); } return u; };
  async function logout() { if (loggingOut) return; loggingOut = true; $$('#lo, #alo').forEach(b => { b.disabled = true; }); try { const r = authResp(await api('auth.php?action=logout', { method: 'POST' }));
      if (!r.message?.trim()) throw new Error(AUTH_ERR); U = null; clearAuth(); location.href = R + 'index.html'; } catch (e) { toast('Gagal keluar: ' + (e.message || '')); }
    finally { loggingOut = false; $$('#lo, #alo').forEach(b => { b.disabled = false; }); } } function bindSubmit(form, fn) { let busy = false; form.addEventListener('submit', async e => {
      e.preventDefault(); if (busy) return; busy = true; $$('[type="submit"]', form).forEach(b => { b.disabled = true; });
      try { await fn(); } finally { busy = false; $$('[type="submit"]', form).forEach(b => { b.disabled = false; }); } }); }
  async function initAuth() { const els = ACC ? $$('main, #nav, #side, #top, #foot').map(el => ({ el, h: el.hidden })) : [];
    els.forEach(({ el }) => { el.hidden = true; }); U = null; csrfToken = null; clearAuth(); let unav = false; try { U = authUser(await api('auth.php?action=me'), true); }
    catch (e) { U = null; unav = true; toast(UNAV_ERR + (e.message === CSRF_ERR ? ' ' + CSRF_ERR : '')); } const nt = unav ? '&auth=unavailable' : '';
    if (ACC === 'member' && !U) { location.replace(R + 'masuk.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search) + nt); return false; }
    if (ACC === 'admin') { if (!U) { location.replace(R + 'masuk.html?next=' + encodeURIComponent('admin/' + location.pathname.split('/').pop()) + nt); return false; }
      if (U.role !== 'admin') { location.replace(R + 'index.html'); return false; } } if ($('#nav')) buildNav(); if ($('#side')) buildAdmin(); els.forEach(({ el, h }) => { el.hidden = h; }); return true; }
  function buildNav() { const menu = [['index', 'Beranda'], ['daftar-resep', 'Resep'], ['faq', 'FAQ']], cur = P === 'detail-resep' ? 'daftar-resep' : P;
    const lnk = menu.map(([k, lb]) => `<a href="${R}${k}.html"${k === cur ? ' class="on"' : ''}>${lb}</a>`).join('');
    const uBox = U ? `<div class="acc"><button class="av" id="avb">${esc(U.name[0].toUpperCase())}</button>` + `<div class="dd" id="dd" hidden><div class="dn">${esc(U.name)}<small>${esc(U.email)}</small></div>` +
      `<a href="${R}profil.html">Profil</a>${U.role === 'admin' ? `<a href="${R}admin/dasbor.html">Admin</a>` : ''}` +
      `<button id="lo">Keluar</button></div></div>` : `<a class="btn ghost sm" href="${R}masuk.html">Masuk</a><a class="btn sm" href="${R}daftar.html">Daftar</a>`;
    $('#nav').innerHTML = `<div class="container nb"><a class="logo" href="${R}index.html">FoodHub</a><nav class="nl">${lnk}</nav><div class="na">${uBox}</div></div>`;
    $('#avb')?.addEventListener('click', e => { e.stopPropagation(); $('#dd').hidden = !$('#dd').hidden; });
    document.addEventListener('click', () => { if ($('#dd')) $('#dd').hidden = true; }); $('#lo')?.addEventListener('click', logout); }
  function buildAdmin() { $('#top').innerHTML = `<strong>FoodHub Admin</strong><span class="muted sm">${esc(U?.name || 'Admin')}</span>`;
    $('#side').innerHTML = `<a href="dasbor.html" class="on">Dasbor</a><a href="kelola-resep.html">Kelola Resep</a>` +
      `<a href="kelola-pengguna.html">Kelola Pengguna</a><a href="${R}index.html">Situs</a><button id="alo">Keluar</button>`; $('#alo')?.addEventListener('click', logout); }
  const img = p => !p ? '' : (/^(https?:|data:)/.test(p) ? p : R + esc(p));
  const card = r => `<a class="card" href="${R}detail-resep.html?id=${r.id}"><div class="thumb">${img(r.image_path) ? `<img src="${img(r.image_path)}">` : ''}</div>` +
    `<div><h3>${esc(r.title)}</h3><div class="meta"><span>${r.cook_time_minutes || 30} mnt</span><span>${esc(r.difficulty || 'Sedang')}</span></div></div></a>`;
  const PG = { async index() { try { const { recipes } = await api('recipes.php?sort=popular&limit=4'); $('#pop').innerHTML = recipes.map(card).join(''); } catch {} },
    async 'daftar-resep'() { const q = $('#fq'), run = async () => { try { const { recipes } = await api('recipes.php?q=' + encodeURIComponent(q?.value || '')); $('#rl').innerHTML = recipes.map(card).join(''); } catch {} }; q?.addEventListener('input', run); run(); },
    async 'detail-resep'() { const id = qs.get('id'), box = $('#dr');
      if (!id) return box.innerHTML = '<div class="empty"><h2>Resep tidak ditemukan</h2><a class="btn" href="daftar-resep.html">Lihat semua</a></div>'; let r = null; try {
        const res = await api('recipes.php?id=' + encodeURIComponent(id)); r = res?.recipe;
        if (!r || typeof r.title !== 'string' || !Array.isArray(r.ingredients) || !Array.isArray(r.steps)) throw new Error(); } catch (e) { const nf = e.status === 404 || e.status === 422;
        return box.innerHTML = `<div class="empty"><h2>${nf ? 'Resep tidak ditemukan' : 'Gagal memuat resep'}</h2><a class="btn" href="daftar-resep.html">Lihat semua</a></div>`;
      } let isFav = !!r.is_favorite; const cats = (r.categories || []).map(k => `<span class="tag">${esc(k)}</span>`).join(' ');
      const ings = r.ingredients.map(i => `<li>${esc(i.name)}</li>`).join(''), steps = r.steps.map(s => `<li>${esc(s)}</li>`).join('');
      const info = `<span>Waktu: <b>${r.cook_time_minutes || 30} mnt</b></span><span>Porsi: <b id="sv">${r.servings || 4}</b></span><span>Rating: <b id="rt">★ ${r.avg_rating != null ? Number(r.avg_rating).toFixed(1) : '-'}</b></span>`;
      box.innerHTML = `<div class="panel"><div>${cats}</div><h1>${esc(r.title)}</h1><p class="muted sm">Oleh ${esc(r.author || 'FoodHub')}</p>` +
        `<div class="detail-info">${info}</div>${r.story ? `<p>${esc(r.story)}</p>` : ''}` +
        `<button class="btn sm" id="fv" type="button">&hearts; <span id="fvt">${isFav ? 'Tersimpan di Favorit' : 'Simpan ke Favorit'}</span></button>` +
        `<h2>Bahan-bahan</h2><ul>${ings}</ul><h2>Langkah Memasak</h2><ol>${steps}</ol></div>`; $('#fv')?.addEventListener('click', async () => { if (!U) return location.href = R + 'masuk.html'; try {
          if (isFav) { await api('favorites.php?recipe_id=' + encodeURIComponent(id), { method: 'DELETE' }); isFav = false; $('#fvt').textContent = 'Simpan ke Favorit'; }
          else { await api('favorites.php', { method: 'POST', body: { recipe_id: id } }); isFav = true; $('#fvt').textContent = 'Tersimpan di Favorit'; }
        } catch (e) { toast(e.message || 'Gagal.'); } }); }, async profil() {
      let pu = U, fav = []; try { pu = (await api('profile.php')).user || U; } catch {} try { fav = (await api('favorites.php')).recipes || []; } catch {}
      $('#pf').innerHTML = `<h1>Profil Saya</h1><div class="panel"><p><strong>${esc(pu.name)}</strong><br>${esc(pu.email)}</p>` +
        `<form id="nf"><div class="ok" id="no" hidden></div><div class="err" id="ne" hidden></div><input id="nn" value="${esc(pu.name)}"><button class="btn sm" type="submit">Simpan</button></form></div>` +
        `<h2>Favorit (${fav.length})</h2><div class="grid">${fav.map(card).join('')}</div>`; bindSubmit($('#nf'), async () => {
        const v = $('#nn').value.trim(); if (v.length < 3) return bar($('#ne'), 'Nama min 3 karakter.');
        try { const res = await api('profile.php', { method: 'POST', body: { name: v } }); pu = res.user; U = res.user; bar($('#no'), 'Tersimpan!', true); }
        catch (err) { bar($('#ne'), err.message || 'Gagal simpan.'); } }); }, masuk() { if (U) return location.replace(U.role === 'admin' ? 'admin/dasbor.html' : 'profil.html');
      if (qs.get('auth') === 'unavailable') bar($('#er'), UNAV_ERR); bindSubmit($('#lf'), async () => { const em = $('#em').value.trim().toLowerCase(), pw = $('#pw').value;
        if (!em || !pw) return bar($('#er'), 'Email dan kata sandi wajib diisi.'); try {
          const res = await api('auth.php?action=login', { method: 'POST', body: { email: em, password: pw, remember: $('#ing').checked } }); U = authUser(res); clearAuth(); const nx = qs.get('next');
          location.href = nx && /^(admin\/)?[a-z-]+\.html/i.test(nx) ? nx : (U.role === 'admin' ? 'admin/dasbor.html' : 'index.html');
        } catch (err) { bar($('#er'), err.message || 'Email atau kata sandi salah.'); } }); }, daftar() { if (U) return location.replace('profil.html'); bindSubmit($('#df'), async () => {
        const nm = $('#dn').value.trim(), em = $('#de').value.trim().toLowerCase(), pw = $('#dp').value, Er = [];
        if (nm.length < 3) Er.push('Nama min 3 karakter.'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) Er.push('Email tidak valid.');
        if (pw.length < 8) Er.push('Kata sandi min 8 karakter.'); if (pw !== $('#dk').value) Er.push('Konfirmasi kata sandi tidak sama.'); if (!$('#ds').checked) Er.push('Centang persetujuan syarat.');
        if (Er.length) { $('#er').innerHTML = `<ul>${Er.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; $('#er').hidden = false; return; } try {
          const res = await api('auth.php?action=register', { method: 'POST', body: { name: nm, email: em, password: pw } }); U = authUser(res); clearAuth(); toast('Pendaftaran berhasil!'); location.href = 'index.html';
        } catch (err) { $('#er').innerHTML = `<p>${esc(err.message || 'Pendaftaran gagal.')}</p>`; $('#er').hidden = false; } });
    }, faq() {}, dasbor() {}, 'kelola-resep'() {}, 'moderasi-resep'() {}, 'kelola-pengguna'() {} };
  async function init() { const ok = await initAuth(); if (ok && PG[P]) { const r = PG[P](); if (r?.catch) r.catch(console.error); } }
  globalThis.authTest = { api, logout, init, initAuth, PG, users, get user() { return U; } };
  init();
})();
