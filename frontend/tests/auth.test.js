'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

// 1. MUAT main.js (CEK ../js/main.js ATAU ../main.js) & SUNTIK HOOK VM
const mainPath = ['../js/main.js', '../main.js', './main.js'].map(p => path.join(__dirname, p)).find(fs.existsSync);
assert.ok(mainPath, 'File main.js tidak ditemukan');
const src = fs.readFileSync(mainPath, 'utf8').replace(/\r\n/g, '\n'), end = src.lastIndexOf('});');
assert.ok(end > 0, 'Bootstrap DOMContentLoaded pada main.js harus ditemukan');
const testSrc = src.slice(0, end) + '  globalThis.app = { api, get user() { return user; }, get csrf() { return csrf; } };\n});';

// 2. DATA DUMMY & HELPER RESPONS FETCH
const MEMBER = { id: 41, name: 'Member API', email: 'member@foodhub.id', role: 'member' };
const ADMIN = { id: 42, name: 'Admin API', email: 'admin@foodhub.id', role: 'admin' };
const res = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const badJson = () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Bad JSON'); } });

// 3. MOCK DOM MINIMAL SESUAI SELECTOR main.js
class El {
  constructor(tag, id = '') {
    this.tag = tag; this.id = id; this.value = ''; this.content = ''; this.textContent = ''; this.dataset = {};
    this.children = []; this.ev = {}; this._html = ''; this.cls = new Set(); this.parent = null;
    this.classList = { add: c => this.cls.add(c), remove: c => this.cls.delete(c), toggle: (c, f) => f ? this.cls.add(c) : this.cls.delete(c), contains: c => this.cls.has(c) };
  }
  addEventListener(t, fn) { (this.ev[t] ||= []).push(fn); }
  async emit(t, extra = {}) { const e = { target: this, preventDefault() {}, ...extra }; for (const fn of this.ev[t] || []) await fn(e); }
  insertAdjacentHTML(pos, h) {
    const tmp = new El('div'); tmp.innerHTML = h; const host = pos === 'beforebegin' && this.parent ? this.parent : this;
    tmp.children.forEach(c => { c.parent = host; host.children.push(c); }); }
  set innerHTML(h) {
    this._html = h; this.children = [];
    for (const m of h.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
      const c = new El(m[1]); c.parent = this;
      for (const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
        if (a[1] === 'id') c.id = a[2]; else if (a[1] === 'class') a[2].split(' ').forEach(x => x && c.cls.add(x));
        else if (a[1].startsWith('data-')) c.dataset[a[1].slice(5)] = a[2] || ''; else c[a[1]] = a[2] || ''; }
      this.children.push(c); } }
  get innerHTML() { return this._html; }
  querySelectorAll(s) {
    const out = [], walk = n => n.children.forEach(c => { out.push(c); walk(c); }); walk(this);
    return out.filter(c => s.split(',').map(x => x.trim()).some(p =>
      p.startsWith('#') ? c.id === p.slice(1) : p.startsWith('.') ? c.cls.has(p.slice(1)) : p.startsWith('[data-') ? p.slice(6, -1) in c.dataset : c.tag === p)); }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
}

// 4. HARNESS VM UNTUK MENJALANKAN main.js TERISOLASI
async function harness({ ids = [], search = '', csrf = 'tok-init', handler } = {}) {
  const root = new El('body'), reqs = [], docEv = {}, meta = new El('meta'), location = { search, href: '' };
  meta.content = csrf; root.children.push(meta);
  ids.forEach(id => { const el = new El(id.includes('form') ? 'form' : 'div', id); el.parent = root; root.children.push(el); });
  class FormData { constructor(f) { this.d = f?.fields || {}; } append(k, v) { this.d[k] = v; } [Symbol.iterator]() { return Object.entries(this.d)[Symbol.iterator](); } }
  const ctx = { location, URLSearchParams, FormData, alert() {}, confirm: () => true, console,
    document: { body: root, querySelector: s => s.includes('csrf-token') ? meta : root.querySelector(s), querySelectorAll: s => root.querySelectorAll(s), addEventListener: (t, fn) => (docEv[t] ||= []).push(fn) },
    fetch: async (url, opts) => { reqs.push({ url, ...opts }); return handler ? handler(url, opts) : res({ user: null }); } };
  vm.runInNewContext(testSrc, ctx, { filename: 'main.js' });
  for (const fn of docEv.DOMContentLoaded || []) await fn();
  return { app: ctx.app, get: id => root.querySelector('#' + id), reqs, location, setFetch: fn => { handler = fn; } };
}

// 5. PENGUJIAN AUTH, CSRF, RESEP, PROFIL, & ADMIN
test('1. me memuat sesi API & fail closed saat API gagal atau JSON rusak', async () => {
  const h = await harness({ handler: () => res({ user: MEMBER, csrf_token: 'tok-me' }) });
  assert.deepEqual(h.app.user, MEMBER); assert.equal(h.app.csrf, 'tok-me');
  assert.equal(h.reqs[0].url, 'api/auth.php?action=me'); assert.equal(h.reqs[0].credentials, 'same-origin');
  for (const fail of [() => { throw new Error('Offline'); }, () => res({ error: 'Err' }, 503), badJson]) assert.equal((await harness({ handler: fail })).app.user, null);
});

test('2. login & register mengirim payload form dan redirect sesuai halaman', async () => {
  const h = await harness({ ids: ['login-form', 'register-form'] });
  h.get('login-form').fields = { email: 'member@foodhub.id', password: '123' };
  h.setFetch(() => res({ user: MEMBER, csrf_token: 'tok-login' })); await h.get('login-form').emit('submit');
  assert.equal(h.reqs.at(-1).url, 'api/auth.php?action=login'); assert.equal(JSON.parse(h.reqs.at(-1).body).email, 'member@foodhub.id'); assert.equal(h.location.href, 'index.html');
  h.get('register-form').fields = { name: 'Baru', email: 'baru@foodhub.id', password: '123' };
  await h.get('register-form').emit('submit');
  assert.equal(h.reqs.at(-1).url, 'api/auth.php?action=register'); assert.equal(h.location.href, 'login.html'); });

test('3. logout mengirim POST + CSRF lalu redirect ke login.html meski gagal', async () => {
  const h = await harness({ ids: ['btn-logout'], handler: () => res({ user: MEMBER, csrf_token: 'tok-a' }) });
  h.setFetch(() => res({ message: 'Keluar' }, 500)); await h.get('btn-logout').emit('click');
  assert.equal(h.reqs.at(-1).url, 'api/auth.php?action=logout'); assert.equal(h.reqs.at(-1).method, 'POST');
  assert.equal(h.reqs.at(-1).headers['X-CSRF-Token'], 'tok-a'); assert.equal(h.location.href, 'login.html'); });

test('4. api() menyertakan CSRF pada mutasi, merotasi token, & melempar error saat gagal', async () => {
  const h = await harness({ csrf: 'tok-1' });
  h.setFetch(() => res({ success: true, csrf_token: 'tok-2' })); await h.app.api('profile.php', 'POST', { name: 'Update' });
  assert.equal(h.reqs.at(-1).headers['X-CSRF-Token'], 'tok-1'); assert.deepEqual(JSON.parse(h.reqs.at(-1).body), { csrf_token: 'tok-1', name: 'Update' }); assert.equal(h.app.csrf, 'tok-2');
  h.setFetch(() => res({ success: false, message: 'Ditolak' }, 403)); await assert.rejects(h.app.api('favorites.php', 'POST', { recipe_id: 7 }), /Ditolak/); });

test('5. detail resep menghitung ulang porsi & memfilter tombol hapus ulasan sesuai role', async () => {
  const h = await harness({ ids: ['recipe-detail', 'ingredients-list', 'btn-favorite'], search: '?id=1',
    handler: u => u.includes('me') ? res({ user: MEMBER }) : u.includes('recipes.php') ? res({ recipe: { id: 1, servings: 2, ingredients: [{ quantity: 100, unit: 'gr', name: 'Daging' }] } })
      : res({ reviews: [{ id: 9, user_id: 41, user_name: 'Member', rating: 5, comment: 'Enak' }, { id: 10, user_id: 99, user_name: 'Lain', rating: 4, comment: 'Oke' }] }) });
  assert.match(h.get('ingredients-list').innerHTML, /100 gr/); await h.get('p-plus').emit('click');
  assert.equal(h.get('porsi-val').textContent, '3 Porsi'); assert.match(h.get('ingredients-list').innerHTML, /150 gr/);
  assert.equal(h.get('rev-list').querySelectorAll('.del-r').length, 1); });

test('6. profil, favorit, & admin memuat data dari endpoint API terkait', async () => {
  const h = await harness({ ids: ['profile-form', 'favorite-recipes', 'stat-recipes', 'admin-recipes-tbody', 'admin-users-tbody'],
    handler: u => u.includes('me') ? res({ user: ADMIN }) : u.includes('profile') ? res({ user: ADMIN })
      : u.includes('stats') ? res({ stats: { total_recipes: 12 } }) : res({ data: [{ id: 1, title: 'Soto', name: 'Admin', email: 'a@b.c', role: 'admin', is_published: 1 }] }) });
  assert.equal(h.get('stat-recipes').textContent, 12); assert.match(h.get('admin-recipes-tbody').innerHTML, /Soto/); assert.match(h.get('admin-users-tbody').innerHTML, /a@b\.c/); });