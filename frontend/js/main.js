// JavaScript Sederhana FoodHub untuk Belajar Pemrograman Web

// 1. Fungsi untuk menampilkan menu navigasi di bagian atas
function tampilkanNavigasi() {
  var tempatNav = document.getElementById("navigasi");
  if (!tempatNav) {
    tempatNav = document.getElementById("nav");
  }
  if (!tempatNav) {
    return;
  }

  tempatNav.innerHTML =
    '<a href="index.html"><b>FoodHub</b></a> | ' +
    '<a href="index.html">Beranda</a> | ' +
    '<a href="daftar-resep.html">Daftar Resep</a> | ' +
    '<a href="faq.html">FAQ</a> | ' +
    '<a href="masuk.html">Masuk</a>';
}

// 2. Fungsi untuk menampilkan bagian bawah (footer)
function tampilkanFooter() {
  var tempatFooter = document.getElementById("kaki-halaman");
  if (!tempatFooter) {
    tempatFooter = document.getElementById("foot");
  }
  if (!tempatFooter) {
    return;
  }

  tempatFooter.innerHTML = "<p>Tugas Pemrograman Web - FoodHub &copy; 2026</p>";
}

// 3. Fungsi untuk mengecek form pendaftaran di halaman daftar.html
function aturFormDaftar() {
  var formDaftar = document.getElementById("form-daftar");
  if (!formDaftar) {
    return;
  }

  formDaftar.addEventListener("submit", function (event) {
    event.preventDefault();

    var nama = document.getElementById("daftar-nama").value;
    var email = document.getElementById("daftar-email").value;
    var sandi = document.getElementById("daftar-sandi").value;
    var konfirmasi = document.getElementById("daftar-konfirmasi-sandi").value;
    var kotakError = document.getElementById("pesan-error");

    if (nama === "" || email === "" || sandi.length < 8) {
      kotakError.hidden = false;
      kotakError.textContent = "Nama, email, dan sandi (minimal 8 karakter) harus diisi!";
      return;
    }

    if (sandi !== konfirmasi) {
      kotakError.hidden = false;
      kotakError.textContent = "Kata sandi dan konfirmasi tidak sama!";
      return;
    }

    kotakError.hidden = true;
    alert("Pendaftaran berhasil! Selamat datang, " + nama);
  });
}

// 4. Fungsi untuk membuka dan menutup form di halaman Admin
function aturFormAdmin() {
  var tombolTambahResep = document.getElementById("btnTambahResep");
  var panelResep = document.getElementById("recipePanel");
  var tombolBatalResep = document.getElementById("formCancel");

  if (tombolTambahResep && panelResep) {
    tombolTambahResep.addEventListener("click", function () {
      panelResep.hidden = false;
    });
  }
  if (tombolBatalResep && panelResep) {
    tombolBatalResep.addEventListener("click", function () {
      panelResep.hidden = true;
    });
  }

  var tombolTambahPengguna = document.getElementById("btnTambahPengguna");
  var panelPengguna = document.getElementById("userPanel");
  var tombolBatalPengguna = document.getElementById("userCancel");

  if (tombolTambahPengguna && panelPengguna) {
    tombolTambahPengguna.addEventListener("click", function () {
      panelPengguna.hidden = false;
    });
  }
  if (tombolBatalPengguna && panelPengguna) {
    tombolBatalPengguna.addEventListener("click", function () {
      panelPengguna.hidden = true;
    });
  }
}

// 5. Jalankan semua fungsi saat halaman selesai dibuka
document.addEventListener("DOMContentLoaded", function () {
  tampilkanNavigasi();
  tampilkanFooter();
  aturFormDaftar();
  aturFormAdmin();
});
