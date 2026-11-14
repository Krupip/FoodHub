'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8').replace(/\r\n/g, '\n');
const bootstrap = '  init();\n})();';
assert.ok(source.includes(bootstrap), 'Bootstrap main.js harus dikenali oleh harness');
// Expose internals only inside the VM; production has no test hooks.
const testSource = source.replace(bootstrap, `  globalThis.authTest = {
    init, initAuth, PG, users, get user() { return U; }
  };
})();`);

const MEMBER = { id: 41, name: 'Member API', email: 'admin@foodhub.id', role: 'member' };
const ADMIN = { id: 42, name: 'Admin API', email: 'admin@foodhub.id', role: 'admin' };
const LOCAL_USERS = [{ name: 'Admin Lokal', email: 'admin@foodhub.id', role: 'admin', pass: 'admin123', fav: [7], at: '2026-01-01' }];

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}
function invalidJSON() {
  return { ok: true, status: 200, json: async () => { throw new SyntaxError('Invalid JSON'); } };
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function storage(initial) {
  const values = new Map(Object.entries(initial));
  return {
    reads: [], writes: [],
    getItem(key) { this.reads.push(key); return values.get(key) ?? null; },
    setItem(key, value) { this.writes.push(key); values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    peek(key) { return values.get(key) ?? null; }
  };
}

// Minimal DOM for the existing selectors, generated nav/sidebar, and auth forms.
function mockDOM(dataset, adminLayout) {
  const nodes = [];
  class Element {
    constructor(tagName, attrs = {}) {
      this.tagName = tagName.toLowerCase();
      this.id = attrs.id || '';
      this.type = attrs.type || '';
      this.value = attrs.value || '';
      this.dataset = {};
      this.hidden = 'hidden' in attrs;
      this.disabled = false;
      this.checked = false;
      this.className = '';
      this.textContent = '';
      this.children = [];
      this.listeners = new Map();
      this._html = '';
      nodes.push(this);
      this.classList = { toggle: name => {
        const classes = new Set(this.className.split(' ').filter(Boolean));
        if (classes.has(name)) classes.delete(name); else classes.add(name);
        this.className = [...classes].join(' ');
        return classes.has(name);
      } };
    }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    async emit(type) {
      const event = { target: this, preventDefault() {}, stopPropagation() {} };
      await Promise.all((this.listeners.get(type) || []).map(listener => listener(event)));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
      const descendants = [];
      const collect = el => el.children.forEach(child => { descendants.push(child); collect(child); });
      collect(this);
      const selectors = selector.split(',').map(part => part.trim());
      return descendants.filter(el => selectors.some(part => {
        if (part.startsWith('#')) return el.id === part.slice(1);
        if (part === '[type="submit"]') return el.type === 'submit';
        if (part === '[data-ic]') return false;
        return el.tagName === part;
      }));
    }
    set innerHTML(html) {
      this._html = html;
      this.children = [];
      for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
        const attrs = {};
        for (const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = attr[2] || '';
        this.appendChild(new Element(match[1], attrs));
      }
    }
    get innerHTML() { return this._html; }
  }
  const body = new Element('body');
  body.dataset = dataset;
  const add = (tag, id, parent = body, attrs = {}) => parent.appendChild(new Element(tag, { id, ...attrs }));
  if (adminLayout) {
    add('aside', 'side');
    add('header', 'top');
  } else {
    add('header', 'nav');
    add('footer', 'foot');
  }
  const main = add('main', 'main');
  add('div', 'pf', main);
  add('div', 'ds', main);
  add('div', 'er', main, { hidden: '' });
  const loginForm = add('form', 'lf', main);
  for (const id of ['em', 'pw', 'ing']) add('input', id, loginForm);
  add('button', 'login-submit', loginForm, { type: 'submit' });
  const registerForm = add('form', 'df', main);
  for (const id of ['dn', 'de', 'dp', 'dk', 'ds-agree']) add('input', id, registerForm);
  // In the real registration page, ds is the agreement checkbox, not admin stats.
  if (dataset.page === 'daftar') {
    main.children.find(el => el.id === 'ds').id = 'admin-stats-unused';
    registerForm.querySelector('#ds-agree').id = 'ds';
  }
  add('button', 'register-submit', registerForm, { type: 'submit' });
  const document = {
    body,
    querySelector: selector => body.querySelector(selector),
    querySelectorAll: selector => body.querySelectorAll(selector),
    createElement: tag => new Element(tag),
    addEventListener() {}
  };
  return { document, get: id => document.querySelector('#' + id) };
}

function harness({ page = 'auth-test', access = '', root = '', search = '', fetch: fetchHandler, adminLayout = access === 'admin' } = {}) {
  const dom = mockDOM({ page, access, root }, adminLayout);
  const local = storage({ fh_s: JSON.stringify({ email: 'admin@foodhub.id' }), fh_users: JSON.stringify(LOCAL_USERS), fh_faq: '["tetap"]' });
  const session = storage({ fh_s: JSON.stringify({ email: 'admin@foodhub.id' }), other: 'tetap' });
  const requests = [];
  const location = {
    pathname: '/FoodHub/frontend/' + (adminLayout ? 'admin/' : '') + page + '.html',
    search, href: '', replacements: [],
    replace(url) { this.replacements.push(url); }
  };
  let handler = fetchHandler || (() => response({ user: null }));
  const context = {
    document: dom.document, location, localStorage: local, sessionStorage: session,
    URLSearchParams, FormData: class FormData {}, console,
    setTimeout: () => 1, clearTimeout() {},
    fetch: async (url, opts) => {
      requests.push({ url, ...opts });
      return handler(new URL(url, 'https://foodhub.test/frontend/').searchParams.get('action'), opts, url);
    }
  };
  vm.runInNewContext(testSource, context, { filename: 'main.js' });
  return {
    app: context.authTest, ...dom, local, session, requests, location,
    setFetch(next) { handler = next; }
  };
}
function assertNoLocalAuth(h) {
  assert.equal(h.local.peek('fh_s'), null);
  assert.equal(h.session.peek('fh_s'), null);
  assert.equal(h.local.peek('fh_users'), JSON.stringify(LOCAL_USERS));
  assert.equal(h.local.peek('fh_faq'), '["tetap"]');
  assert.equal(h.session.peek('other'), 'tetap');
  assert.deepEqual(h.local.reads, [], 'Auth tidak boleh membaca data pengguna lokal');
  assert.deepEqual(h.session.reads, []);
  assert.deepEqual(h.local.writes, [], 'Auth tidak boleh menyimpan identitas lokal');
  assert.deepEqual(h.session.writes, []);
}
function fillLogin(h, remember = false) {
  h.get('em').value = '  ADMIN@FOODHUB.ID  ';
  h.get('pw').value = 'admin123';
  h.get('ing').checked = remember;
}
function fillRegister(h) {
  h.get('dn').value = '  Nama Baru  ';
  h.get('de').value = '  ADMIN@FOODHUB.ID  ';
  h.get('dp').value = 'password-baru';
  h.get('dk').value = 'password-baru';
  h.get('ds').checked = true;
}

const brokenResponses = [
  ['JSON rusak', invalidJSON],
  ['null', () => response(null)],
  ['array', () => response([])],
  ['user hilang', () => response({})],
  ['user tidak lengkap', () => response({ user: { role: 'admin' } })],
  ['id tidak valid', () => response({ user: { ...MEMBER, id: 0 } })],
  ['nama bukan string', () => response({ user: { ...MEMBER, name: 123 } })],
  ['email kosong', () => response({ user: { ...MEMBER, email: '' } })],
  ['role tidak dikenal', () => response({ user: { ...MEMBER, role: 'superadmin' } })],
  ['payload error pada HTTP 200', () => response({ user: ADMIN, error: 'Tidak sah' })]
];
const requestFailures = [
  ['jaringan', () => { throw new Error('API unavailable'); }],
  ['HTTP error', () => response({ error: 'Layanan tidak tersedia.' }, 503)]
];

test('me sukses memakai identitas/peran API saja dan membersihkan fh_s tanpa menyentuh data pengguna lokal', async () => {
  const h = harness({ fetch: () => response({ user: MEMBER }) });
  assert.equal(await h.app.initAuth(), true);
  assert.equal(h.app.user, MEMBER);
  assert.match(h.get('nav').innerHTML, /Member API/);
  assert.doesNotMatch(h.get('nav').innerHTML, /Admin Lokal|Dasbor Admin/);
  assert.equal(h.requests[0].url, '../backend/api/auth.php?action=me');
  assert.equal(h.requests[0].method || 'GET', 'GET');
  assert.equal(h.requests[0].credentials, 'same-origin');
  assertNoLocalAuth(h);
});

test('me user:null tetap tamu meski fh_s menunjuk admin lokal', async () => {
  const h = harness();
  assert.equal(await h.app.initAuth(), true);
  assert.equal(h.app.user, null);
  assert.match(h.get('nav').innerHTML, />Masuk</);
  assert.doesNotMatch(h.get('nav').innerHTML, /Admin Lokal|id="lo"/);
  assertNoLocalAuth(h);
});

test('me gagal atau rusak fail closed dan memberi notifikasi', async t => {
  for (const [name, reply] of [...requestFailures, ...brokenResponses]) {
    await t.test(name, async () => {
      const h = harness({ fetch: reply });
      assert.equal(await h.app.initAuth(), true);
      assert.equal(h.app.user, null);
      assert.match(h.get('toast').textContent, /Tidak dapat memeriksa sesi/);
      assert.match(h.get('nav').innerHTML, />Masuk</);
      assertNoLocalAuth(h);
    });
  }
});

test('pembersihan storage independen ketika sessionStorage diblokir', async () => {
  const h = harness();
  h.session.removeItem = () => { throw new Error('Storage blocked'); };
  await h.app.initAuth();
  assert.equal(h.local.peek('fh_s'), null);
  assert.equal(h.app.user, null);
});

test('konten member/admin tersembunyi saat me pending, ditolak tanpa menjalankan router', async t => {
  for (const access of ['member', 'admin']) {
    for (const failed of [false, true]) {
      await t.test(access + (failed ? ' API gagal' : ' tamu'), async () => {
        const pending = deferred();
        const page = access === 'admin' ? 'dasbor' : 'profil';
        const h = harness({ page, access, search: '?tab=favorit', fetch: () => pending.promise, root: access === 'admin' ? '../' : '' });
        const initialized = h.app.init();
        assert.equal(h.get('main').hidden, true);
        assert.equal(h.get(access === 'admin' ? 'side' : 'nav').hidden, true);
        pending.resolve(failed ? response({ error: 'Backend mati' }, 503) : response({ user: null }));
        await initialized;
        assert.equal(h.app.user, null);
        assert.equal(h.get('main').hidden, true);
        assert.equal(h.get(access === 'admin' ? 'ds' : 'pf').innerHTML, '');
        assert.equal(h.requests.length, 1, 'Router profil/admin tidak boleh memanggil API lanjutan');
        const target = new URL(h.location.replacements[0], 'https://foodhub.test/frontend/');
        assert.equal(target.searchParams.get('next'), access === 'admin' ? 'admin/dasbor.html' : 'profil.html?tab=favorit');
        assert.equal(target.searchParams.get('auth'), failed ? 'unavailable' : null);
        if (failed) assert.match(h.get('toast').textContent, /Tidak dapat memeriksa sesi/);
        assertNoLocalAuth(h);
      });
    }
  }
});

test('me memakai role terbaru, bukan role admin akun lokal', async () => {
  const h = harness({ access: 'admin', page: 'dasbor', root: '../', fetch: () => response({ user: MEMBER }) });
  await h.app.init();
  assert.equal(h.app.user.role, 'member');
  assert.deepEqual(h.location.replacements, ['../index.html']);
  assert.equal(h.get('main').hidden, true);
  assert.equal(h.get('side').innerHTML, '');
  assert.equal(h.requests.length, 1);
  assertNoLocalAuth(h);
});

test('member dan admin sah membuka konten yang sesuai setelah me', async t => {
  for (const [access, user] of [['member', MEMBER], ['member', ADMIN], ['admin', ADMIN]]) {
    await t.test(access + '/' + user.role, async () => {
      const h = harness({ access, fetch: () => response({ user }), root: access === 'admin' ? '../' : '' });
      await h.app.initAuth();
      assert.equal(h.get('main').hidden, false);
      assert.equal(h.get(access === 'admin' ? 'side' : 'nav').hidden, false);
      assert.deepEqual(h.location.replacements, []);
      assert.equal(h.app.user, user);
      assertNoLocalAuth(h);
    });
  }
});

test('notifikasi me gagal tetap muncul di form login setelah redirect', async () => {
  const h = harness({ page: 'masuk', search: '?next=profil.html&auth=unavailable' });
  await h.app.init();
  assert.equal(h.get('er').hidden, false);
  assert.match(h.get('er').textContent, /Tidak dapat memeriksa sesi/);
});

test('logout nav/sidebar menunggu API, mencegah klik ganda, lalu mencabut identitas frontend', async t => {
  for (const adminLayout of [false, true]) {
    await t.test(adminLayout ? 'sidebar admin' : 'nav member', async () => {
      const pending = deferred();
      const user = adminLayout ? ADMIN : MEMBER;
      const h = harness({ access: adminLayout ? 'admin' : 'member', root: adminLayout ? '../' : '', fetch: action => action === 'me' ? response({ user }) : pending.promise });
      await h.app.initAuth();
      const button = h.get(adminLayout ? 'alo' : 'lo');
      const clicked = button.emit('click');
      assert.equal(button.disabled, true);
      assert.equal(h.app.user, user);
      assert.equal(h.location.href, '');
      await button.emit('click');
      assert.equal(h.requests.length, 2, 'Hanya satu request logout');
      const request = h.requests[1];
      assert.equal(request.method, 'POST');
      assert.equal(request.headers['Content-Type'], 'application/json');
      assert.equal(request.credentials, 'same-origin');
      assert.equal(request.body, undefined);
      assert.equal(request.url, (adminLayout ? '../../' : '../') + 'backend/api/auth.php?action=logout');
      pending.resolve(response({ message: 'Berhasil keluar.' }));
      await clicked;
      assert.equal(h.app.user, null);
      assert.equal(h.location.href, (adminLayout ? '../' : '') + 'index.html');
      assertNoLocalAuth(h);
    });
  }
});

test('logout gagal/rusak tidak false-success dan dapat dicoba ulang', async t => {
  const failures = [...requestFailures, ['JSON rusak', invalidJSON], ['null', () => response(null)], ['message hilang', () => response({})], ['message kosong', () => response({ message: '' })], ['message salah tipe', () => response({ message: true })], ['error HTTP 200', () => response({ message: 'Berhasil keluar.', error: 'Gagal' })]];
  for (const adminLayout of [false, true]) {
    for (const [name, fail] of failures) {
      await t.test((adminLayout ? 'admin ' : 'member ') + name, async () => {
        const user = adminLayout ? ADMIN : MEMBER;
        const h = harness({ adminLayout, fetch: () => response({ user }) });
        await h.app.initAuth();
        h.setFetch(fail);
        const button = h.get(adminLayout ? 'alo' : 'lo');
        await button.emit('click');
        assert.equal(h.app.user, user);
        assert.equal(h.location.href, '');
        assert.deepEqual(h.location.replacements, []);
        assert.equal(button.disabled, false);
        assert.match(h.get('toast').textContent, /Gagal keluar/);
        assertNoLocalAuth(h);
        h.setFetch(() => response({ message: 'Berhasil keluar.' }));
        await button.emit('click');
        assert.equal(h.app.user, null);
        assert.equal(h.location.href, 'index.html');
      });
    }
  }
});

test('login mengirim remember boolean dan memakai user API tanpa identitas lokal', async t => {
  for (const remember of [false, true]) {
    await t.test('remember=' + remember, async () => {
      const h = harness({ page: 'masuk' });
      await h.app.initAuth();
      h.app.PG.masuk();
      fillLogin(h, remember);
      h.setFetch(() => response({ user: MEMBER }));
      await h.get('lf').emit('submit');
      assert.deepEqual(JSON.parse(h.requests[1].body), { email: 'admin@foodhub.id', password: 'admin123', remember });
      assert.equal(h.requests[1].method, 'POST');
      assert.equal(h.requests[1].url, '../backend/api/auth.php?action=login');
      assert.equal(h.app.user, MEMBER);
      assert.equal(h.location.href, 'index.html');
      assertNoLocalAuth(h);
    });
  }
});

test('login mempertahankan next lokal terbatas dan default redirect sesuai role', async t => {
  for (const [next, user, expected] of [
    ['profil.html?tab=favorit', MEMBER, 'profil.html?tab=favorit'],
    ['admin/dasbor.html', ADMIN, 'admin/dasbor.html'],
    ['https://evil.test', MEMBER, 'index.html'],
    ['//evil.test', MEMBER, 'index.html'],
    ['../admin/dasbor.html', MEMBER, 'index.html'],
    ['', ADMIN, 'admin/dasbor.html']
  ]) {
    await t.test(next || 'default admin', async () => {
      const h = harness({ page: 'masuk', search: '?next=' + encodeURIComponent(next) });
      await h.app.initAuth();
      h.app.PG.masuk();
      fillLogin(h);
      h.setFetch(() => response({ user }));
      await h.get('lf').emit('submit');
      assert.equal(h.location.href, expected);
    });
  }
});

test('registrasi hanya mengandalkan API, meski email sudah ada di demo lokal', async () => {
  const h = harness({ page: 'daftar' });
  await h.app.initAuth();
  h.app.PG.daftar();
  fillRegister(h);
  h.setFetch(() => response({ user: MEMBER }, 201));
  await h.get('df').emit('submit');
  assert.deepEqual(JSON.parse(h.requests[1].body), { name: 'Nama Baru', email: 'admin@foodhub.id', password: 'password-baru' });
  assert.equal(h.requests[1].method, 'POST');
  assert.equal(h.requests[1].url, '../backend/api/auth.php?action=register');
  assert.equal(h.app.user, MEMBER);
  assert.equal(h.location.href, 'index.html');
  assert.equal(h.get('toast').textContent, 'Pendaftaran berhasil!');
  assertNoLocalAuth(h);
});

test('login/registrasi menolak API gagal atau user rusak tanpa sukses lokal', async t => {
  const failures = [...requestFailures, ...brokenResponses, ['user:null', () => response({ user: null })], ['error validasi', () => response({ error: 'Email sudah terdaftar.' }, 422)]];
  for (const page of ['masuk', 'daftar']) {
    for (const [name, fail] of failures) {
      await t.test(page + ' ' + name, async () => {
        const h = harness({ page });
        await h.app.initAuth();
        h.app.PG[page]();
        if (page === 'masuk') fillLogin(h); else fillRegister(h);
        h.setFetch(fail);
        await h.get(page === 'masuk' ? 'lf' : 'df').emit('submit');
        assert.equal(h.requests.length, 2, 'Request auth tetap dikirim, tanpa mencocokkan akun demo');
        assert.equal(h.app.user, null);
        assert.equal(h.location.href, '');
        assert.equal(h.get('er').hidden, false);
        assert.ok(h.get('er').textContent || h.get('er').innerHTML);
        assert.equal(h.get('toast'), null, 'Tidak ada notifikasi sukses');
        if (name === 'error validasi') assert.match(h.get('er').textContent + h.get('er').innerHTML, /Email sudah terdaftar/);
        assertNoLocalAuth(h);
      });
    }
  }
});

test('submit login/registrasi ganda dicegah dan form bisa dicoba lagi setelah gagal', async t => {
  for (const page of ['masuk', 'daftar']) {
    await t.test(page, async () => {
      const h = harness({ page });
      await h.app.initAuth();
      h.app.PG[page]();
      if (page === 'masuk') fillLogin(h); else fillRegister(h);
      const pending = deferred();
      h.setFetch(() => pending.promise);
      const form = h.get(page === 'masuk' ? 'lf' : 'df');
      const button = h.get(page === 'masuk' ? 'login-submit' : 'register-submit');
      const submitted = form.emit('submit');
      assert.equal(button.disabled, true);
      await form.emit('submit');
      assert.equal(h.requests.length, 2);
      assert.equal(h.location.href, '');
      pending.resolve(response({ error: 'Coba lagi.' }, 503));
      await submitted;
      assert.equal(button.disabled, false);
      h.setFetch(() => response({ user: MEMBER }, page === 'daftar' ? 201 : 200));
      await form.emit('submit');
      assert.equal(h.requests.length, 3);
      assert.equal(h.app.user, MEMBER);
    });
  }
});

test('validasi form lokal tetap berjalan tanpa mengautentikasi pengguna', async t => {
  for (const page of ['masuk', 'daftar']) {
    await t.test(page, async () => {
      const h = harness({ page });
      await h.app.initAuth();
      h.app.PG[page]();
      await h.get(page === 'masuk' ? 'lf' : 'df').emit('submit');
      assert.equal(h.requests.length, 1);
      assert.equal(h.app.user, null);
      assert.equal(h.get('er').hidden, false);
      assert.equal(h.get(page === 'masuk' ? 'login-submit' : 'register-submit').disabled, false);
    });
  }
});

test('migrasi demo membuang hanya pass, mempertahankan akun/favorit/metadata', () => {
  const h = harness();
  const users = h.app.users();
  const { pass, ...expected } = LOCAL_USERS[0];
  assert.equal(users.length, 1);
  assert.deepEqual(JSON.parse(h.local.peek('fh_users')), [expected]);
  assert.equal(Object.hasOwn(users[0], 'pass'), false);
  assert.equal(h.app.user, null);
});

test('seed pengguna demo baru tidak berisi password', () => {
  const h = harness();
  h.local.removeItem('fh_users');
  const users = h.app.users();
  assert.equal(users.length, 3);
  assert.ok(users.every(user => !Object.hasOwn(user, 'pass')));
  assert.equal(h.app.user, null);
});
