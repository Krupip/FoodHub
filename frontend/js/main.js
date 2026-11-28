/* FoodHub - main.js
   Inti aplikasi: data halaman, fungsi bantu, komunikasi API, dan penjalan halaman.
   Gaya Petani Kode: nama deskriptif, komentar jelas, kode rata kiri ke bawah. */
'use strict';

// 1. Data halaman dan status yang dipakai bersama semua file JS
const { page: halaman, root: akar = '', access: hakAkses = '' } = document.body.dataset;
const parameterUrl = new URLSearchParams(location.search);
const PESAN_AUTH = 'Respons autentikasi server tidak valid. Silakan coba lagi.';
const PESAN_CSRF = 'Token CSRF server hilang atau tidak valid. Muat ulang halaman.';
let tokenCsrf = null;
let penggunaAktif = null;
const HALAMAN = {};

// 2. Fungsi bantu umum
const $ = pemilih => document.querySelector(pemilih);
const $$ = pemilih => Array.from(document.querySelectorAll(pemilih));
const emailValid = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const urlAdmin = (berkas, id) => 'admin/' + berkas + '.php?id=' + encodeURIComponent(id);

// Mengamankan teks agar tidak terbaca sebagai HTML
function esc(teks) {
  const pengganti = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(teks ?? '').replace(/[&<>"']/g, huruf => pengganti[huruf]);
}

function gambar(path) {
  if (!path) return '';
  if (/^(https?:|data:)/.test(path)) return path;
  return akar + esc(path);
}

function kosong(teks) {
  return `<div class="panel empty"><p class="teks-redup">${teks}</p></div>`;
}

function tampilkanStatus(elemen, teks, sukses) {
  elemen.className = sukses ? 'ok' : 'err';
  elemen.textContent = teks;
  elemen.hidden = false;
}

// Notifikasi kecil di pojok layar
function tampilkanToast(teks) {
  let toast = $('#toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = teks;
  toast.className = 'show';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toast.className = ''; }, 2600);
}

// Menjalankan tugas async; jika gagal, pesan error tampil sebagai toast
async function coba(tugas, pesan) {
  try {
    await tugas();
  } catch (error) {
    tampilkanToast(error.message || pesan);
  }
}

// Kartu resep dipakai di beranda, daftar resep, dan profil
function kartuResep(resep) {
  const foto = gambar(resep.image_path);
  const tag = foto ? `<img src="${foto}" alt="${esc(resep.title)}">` : '';
  return `
    <a class="card" href="${akar}detail-resep.html?id=${resep.id}">
      <div class="thumb">${tag}</div>
      <div>
        <h3>${esc(resep.title)}</h3>
        <div class="meta">
          <span>${resep.cook_time_minutes || 30} mnt</span>
          <span>${esc(resep.difficulty || 'sedang')}</span>
        </div>
      </div>
    </a>`;
}

// Mengikat form: tugas() mengembalikan teks error bila data tidak valid; klik ganda dicegah
function pasangForm(form, kotak, tugas) {
  let sibuk = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sibuk) return;
    sibuk = true;
    try {
      const galat = await tugas();
      if (galat) tampilkanStatus(kotak, galat);
    } catch (error) {
      tampilkanStatus(kotak, error.message || 'Terjadi kesalahan.');
    }
    sibuk = false;
  });
}

// 3. Menjalankan logika halaman yang sesuai atribut data-page di <body>
async function mulai() {
  const boleh = await mulaiNavigasi();
  if (!boleh || !HALAMAN[halaman]) return;
  try {
    await HALAMAN[halaman]();
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', mulai);