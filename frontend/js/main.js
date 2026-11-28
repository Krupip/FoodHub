// ==========================================================================
// JavaScript Utama FoodHub (~150 baris, sederhana & mudah dipelajari)
// ==========================================================================

// 1. Data contoh resep beserta gambar dari folder img/
var daftarResep = [
  { id: 1, nama: "Rendang Daging", kategori: "Makanan Berat", waktu: "120 menit", foto: "img/rendang.jpg" },
  { id: 2, nama: "Soto Lamongan", kategori: "Makanan Berat", waktu: "45 menit", foto: "img/soto-lamongan.jpg" },
  { id: 3, nama: "Gado-Gado", kategori: "Sehat", waktu: "25 menit", foto: "img/gado-gado.jpg" },
  { id: 4, nama: "Nasi Liwet", kategori: "Makanan Berat", waktu: "40 menit", foto: "img/nasi-liwet.jpg" },
  { id: 5, nama: "Pempek Palembang", kategori: "Cepat", waktu: "35 menit", foto: "img/pempek.jpg" },
  { id: 6, nama: "Es Cendol", kategori: "Minuman", waktu: "20 menit", foto: "img/es-cendol.jpg" }
];

// 2. Fungsi menentukan awalan path folder (kosong untuk frontend/, "../" untuk admin/)
function ambilRoot() {
  return document.body.getAttribute("data-root") || "";
}

// 3. Fungsi menampilkan Header & Navigasi beserta logo FoodHub
function tampilkanNavigasi() {
  var nav = document.getElementById("navigasi") || document.getElementById("nav") || document.getElementById("header-atas");
  if (!nav) return;

  var root = ambilRoot();
  nav.innerHTML =
    '<div class="nav-wrap">' +
      '<a class="brand" href="' + root + 'index.html">' +
        '<img src="' + root + 'img/logo-foodhub.jpg" alt="Logo FoodHub">' +
      '</a>' +
      '<div class="nav-links">' +
        '<a href="' + root + 'index.html">Beranda</a>' +
        '<a href="' + root + 'daftar-resep.html">Daftar Resep</a>' +
        '<a href="' + root + 'faq.html">FAQ</a>' +
        '<a href="' + root + 'masuk.html">Masuk</a>' +
        '<a class="tombol kecil" href="' + root + 'admin/dasbor.html">Admin</a>' +
      '</div>' +
    '</div>';
}

// 4. Fungsi menampilkan Footer di bagian bawah halaman
function tampilkanFooter() {
  var foot = document.getElementById("kaki-halaman") || document.getElementById("foot");
  if (!foot) return;
  foot.innerHTML = "<p>FoodHub &copy; 2026 - Pradita University</p>";
}

// 5. Fungsi menampilkan kartu resep bergambar ke dalam wadah grid
function tampilkanKartuResep(wadahId, data) {
  var wadah = document.getElementById(wadahId);
  if (!wadah) return;

  var html = "";
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    html +=
      '<a class="card" href="detail-resep.html?id=' + r.id + '">' +
        '<img src="' + r.foto + '" alt="' + r.nama + '">' +
        '<div class="card-body">' +
          '<h3>' + r.nama + '</h3>' +
          '<p class="teks-redup kecil">' + r.kategori + ' &bull; ' + r.waktu + '</p>' +
        '</div>' +
      '</a>';
  }
  wadah.innerHTML = html;
}

// 6. Fungsi pencarian sederhana di halaman Beranda
function aturPencarianBeranda() {
  var form = document.getElementById("heroForm");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var kata = document.getElementById("q").value.toLowerCase();
    var hasil = daftarResep.filter(function (item) {
      return item.nama.toLowerCase().indexOf(kata) !== -1;
    });
    tampilkanKartuResep("pop", hasil);
  });
}

// 7. Fungsi validasi form Daftar & Masuk
function aturFormAuth() {
  var formDaftar = document.getElementById("form-daftar");
  if (formDaftar) {
    formDaftar.addEventListener("submit", function (event) {
      event.preventDefault();
      var nama = document.getElementById("daftar-nama").value;
      var email = document.getElementById("daftar-email").value;
      var sandi = document.getElementById("daftar-sandi").value;
      var konfirmasi = document.getElementById("daftar-konfirmasi-sandi").value;
      var err = document.getElementById("pesan-error");

      if (nama === "" || email === "" || sandi.length < 8) {
        err.hidden = false;
        err.textContent = "Nama, email, dan sandi (min. 8 karakter) wajib diisi!";
        return;
      }
      if (sandi !== konfirmasi) {
        err.hidden = false;
        err.textContent = "Konfirmasi kata sandi tidak cocok!";
        return;
      }
      err.hidden = true;
      alert("Akun berhasil didaftarkan untuk: " + nama);
    });
  }

  var formMasuk = document.getElementById("lf");
  if (formMasuk) {
    formMasuk.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = document.getElementById("em").value;
      var sandi = document.getElementById("pw").value;
      var err = document.getElementById("er");

      if (email === "" || sandi === "") {
        err.hidden = false;
        err.textContent = "Email dan kata sandi tidak boleh kosong!";
        return;
      }
      err.hidden = true;
      alert("Selamat datang kembali, " + email);
    });
  }
}

// 8. Fungsi buka/tutup form di halaman Admin (Kelola Resep & Pengguna)
function aturHalamanAdmin() {
  var btnResep = document.getElementById("btnTambahResep");
  var panelResep = document.getElementById("recipePanel");
  var batalResep = document.getElementById("formCancel");

  if (btnResep && panelResep) {
    btnResep.addEventListener("click", function () { panelResep.hidden = false; });
  }
  if (batalResep && panelResep) {
    batalResep.addEventListener("click", function () { panelResep.hidden = true; });
  }

  var btnUser = document.getElementById("btnTambahPengguna");
  var panelUser = document.getElementById("userPanel");
  var batalUser = document.getElementById("userCancel");

  if (btnUser && panelUser) {
    btnUser.addEventListener("click", function () { panelUser.hidden = false; });
  }
  if (batalUser && panelUser) {
    batalUser.addEventListener("click", function () { panelUser.hidden = true; });
  }
}

// 9. Fungsi menampilkan detail resep saat kartu diklik (detail-resep.html)
function aturDetailResep() {
  var judul = document.querySelector("h1");
  if (!judul || window.location.pathname.indexOf("detail-resep.html") === -1) return;

  var params = new URLSearchParams(window.location.search);
  var id = Number(params.get("id")) || 1;
  var resep = daftarResep[0];
  for (var i = 0; i < daftarResep.length; i++) {
    if (daftarResep[i].id === id) resep = daftarResep[i];
  }

  var main = document.querySelector("main");
  if (main) {
    main.innerHTML =
      '<div class="container" style="margin-top:1.5rem;">' +
        '<div class="panel">' +
          '<img src="' + resep.foto + '" alt="' + resep.nama + '" style="width:100%;max-height:360px;object-fit:cover;border-radius:8px;border:2px solid #1c1917;margin-bottom:1rem;">' +
          '<h1>' + resep.nama + '</h1>' +
          '<p class="teks-redup">' + resep.kategori + ' &bull; ' + resep.waktu + '</p>' +
          '<p style="margin-top:1rem;"><a class="tombol ghost" href="index.html">&larr; Kembali ke Beranda</a></p>' +
        '</div>' +
      '</div>';
  }
}

// 10. Jalankan semua fungsi saat halaman selesai dimuat
document.addEventListener("DOMContentLoaded", function () {
  tampilkanNavigasi();
  tampilkanFooter();
  tampilkanKartuResep("pop", daftarResep);
  aturPencarianBeranda();
  aturFormAuth();
  aturHalamanAdmin();
  aturDetailResep();
});
