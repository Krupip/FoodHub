/* FoodHub - main.js (98 baris, rapi & terstruktur) */
(function () {
  "use strict";
  /* 1. HELPER DOM, SANITASI XSS & NOTIFIKASI */
  const P = document.body.dataset.page,
    R = document.body.dataset.root || "",
    ACC = document.body.dataset.access || "",
    qs = new URLSearchParams(location.search),
    $ = (s, r) => (r || document).querySelector(s),
    $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      ),
    bar = (el, msg, ok) => {
      el.className = ok ? "ok" : "err";
      el.textContent = msg;
      el.hidden = false;
    };
  function toast(msg) {
    let t = $("#toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = "show";
    clearTimeout(t._h);
    t._h = setTimeout(() => {
      t.className = "";
    }, 2600);
  }
  /* 2. KOMUNIKASI API & KEAMANAN CSRF */
  const BASE = (R ? R + "../" : "../") + "backend/api/",
    CSRF_ERR = "Token CSRF server hilang atau tidak valid. Muat ulang halaman.",
    AUTH_ERR = "Respons autentikasi server tidak valid. Silakan coba lagi.",
    UNAV_ERR = "Tidak dapat memeriksa sesi. Pastikan backend tersedia.";
  let csrfToken = null,
    U = null;
  const isSafe = (m) => ["GET", "HEAD", "OPTIONS"].includes(m),
    authAct = (p) =>
      p.split("?")[0] === "auth.php"
        ? new URLSearchParams(p.split("?")[1] || "").get("action")
        : null,
    authResp = (d) => {
      if (!d || typeof d !== "object" || Array.isArray(d) || "error" in d)
        throw new Error(AUTH_ERR);
      return d;
    };
  const authUser = (d, guest = false) => {
    const u = authResp(d).user;
    if (guest && u === null) return null;
    const ok =
      u &&
      ((Number.isSafeInteger(u.id) && u.id > 0) ||
        (typeof u.id === "string" && /^[1-9]\d*$/.test(u.id)));
    if (
      !ok ||
      typeof u.name !== "string" ||
      !u.name.trim() ||
      typeof u.email !== "string" ||
      !u.email.trim() ||
      !["member", "admin"].includes(u.role)
    )
      throw new Error(AUTH_ERR);
    return u;
  };
  async function fetchApi(path, opts = {}) {
    const method = (opts.method || "GET").toUpperCase(),
      act = authAct(path),
      pub = method === "POST" && ["login", "register"].includes(act),
      hdrs = { "Content-Type": "application/json", ...opts.headers };
    Object.keys(hdrs).forEach((k) => {
      if (k.toLowerCase() === "x-csrf-token") delete hdrs[k];
    });
    if (!isSafe(method) && csrfToken) hdrs["X-CSRF-Token"] = csrfToken;
    let body = opts.body;
    if (body instanceof FormData) delete hdrs["Content-Type"];
    else if (body && typeof body === "object") body = JSON.stringify(body);
    const res = await fetch(BASE + path, {
        ...opts,
        method,
        credentials: "same-origin",
        headers: hdrs,
        body,
      }),
      hdr =
        res.headers && typeof res.headers.get === "function"
          ? res.headers.get("X-CSRF-Token")
          : null,
      tok = typeof hdr === "string" && /^[0-9a-f]{64}$/.test(hdr) ? hdr : null,
      data = await res.json().catch(() => ({}));
    if (res.ok && ((method === "GET" && act === "me") || pub)) {
      csrfToken = null;
      U = null;
      const user = authUser(data, act === "me");
      if (user && !tok) throw new Error(CSRF_ERR);
      U = user;
      csrfToken = user ? tok : null;
    } else if (res.ok && method === "POST" && act === "logout") {
      const r = authResp(data);
      if (typeof r.message !== "string" || !r.message.trim())
        throw new Error(AUTH_ERR);
      U = null;
      csrfToken = null;
    } else if (res.status === 401 && !pub) {
      U = null;
      csrfToken = null;
    } else if (tok) {
      csrfToken = tok;
    }
    if (!res.ok) {
      const err = new Error(
        (data && data.error) || "Terjadi kesalahan sistem.",
      );
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }
  async function api(path, opts = {}) {
    const m = (opts.method || "GET").toUpperCase();
    if (
      !isSafe(m) &&
      !(["login", "register"].includes(authAct(path)) && m === "POST") &&
      !csrfToken
    )
      await fetchApi("auth.php?action=me");
    return fetchApi(path, opts);
  }
  /* 3. DATA LOKAL (Cadangan Offline localStorage) */
  const ld = (k, d) => {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch (e) {
        return d;
      }
    },
    sv = (k, v) => {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    };
  const DEMO = [
    {
      id: 1,
      n: "Rendang",
      p: "Sumatera Barat",
      k: ["Makanan Berat"],
      w: 180,
      l: "Sulit",
      s: 6,
      r: 5.0,
      f: "img/rendang.jpg",
      c: "Daging sapi rempah.",
    },
    {
      id: 2,
      n: "Soto Lamongan",
      p: "Jawa Timur",
      k: ["Makanan Berat"],
      w: 60,
      l: "Sedang",
      s: 4,
      r: 4.8,
      f: "img/soto-lamongan.jpg",
      c: "Soto ayam kuah kuning.",
    },
    {
      id: 3,
      n: "Gado-Gado",
      p: "DKI Jakarta",
      k: ["Sehat"],
      w: 35,
      l: "Mudah",
      s: 3,
      r: 4.7,
      f: "img/gado-gado.jpg",
      c: "Sayuran saus kacang.",
    },
  ];
  const cats = () => ["Makanan Berat", "Sehat", "Minuman", "Cepat", "Anak Kos"],
    hid = () => ld("fh_hid", []),
    recipesList = () => {
      let l = ld("fh_recipes", null);
      if (!Array.isArray(l) || !l.length) {
        l = DEMO.slice();
        sv("fh_recipes", l);
      }
      return l;
    };
  const all = () => recipesList().filter((r) => !hid().includes(r.id)),
    byId = (id) => recipesList().find((r) => String(r.id) === String(id)),
    users = () => {
      let u = ld("fh_users", null);
      if (!u) {
        u = [
          {
            name: "Admin FoodHub",
            email: "admin@foodhub.id",
            role: "admin",
            fav: [],
            at: "2026-08-01",
          },
          {
            name: "Raka Pratama",
            email: "raka@contoh.id",
            role: "member",
            fav: [1, 2],
            at: "2026-09-12",
          },
          {
            name: "Nadia Putri",
            email: "nadia@contoh.id",
            role: "member",
            fav: [3],
            at: "2026-10-03",
          },
        ];
        sv("fh_users", u);
      }
      if (
        Array.isArray(u) &&
        u.some((x) => Object.prototype.hasOwnProperty.call(x, "pass"))
      ) {
        u = u.map((x) => {
          const c = { ...x };
          delete c.pass;
          return c;
        });
        sv("fh_users", u);
      }
      return u;
    };
  /* 4. AUTENTIKASI & PENJAGA HALAMAN */
  const clearAuth = () => {
    try {
      sessionStorage.removeItem("fh_s");
    } catch (e) {}
    try {
      localStorage.removeItem("fh_s");
    } catch (e) {}
  };
  let loggingOut = false;
  async function logout() {
    if (loggingOut) return;
    loggingOut = true;
    $$("#lo, #alo").forEach((b) => {
      b.disabled = true;
    });
    try {
      const r = authResp(
        await api("auth.php?action=logout", { method: "POST" }),
      );
      if (!r.message?.trim()) throw new Error(AUTH_ERR);
      U = null;
      clearAuth();
      location.href = R + "index.html";
    } catch (e) {
      toast("Gagal keluar: " + (e.message || ""));
    } finally {
      loggingOut = false;
      $$("#lo, #alo").forEach((b) => {
        b.disabled = false;
      });
    }
  }
  function bindSubmit(form, fn) {
    let busy = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      $$('[type="submit"]', form).forEach((b) => {
        b.disabled = true;
      });
      try {
        await fn();
      } finally {
        busy = false;
        $$('[type="submit"]', form).forEach((b) => {
          b.disabled = false;
        });
      }
    });
  }
  async function initAuth() {
    const els = ACC
      ? $$("main, #nav, #side, #top, #foot").map((el) => ({ el, h: el.hidden }))
      : [];
    els.forEach(({ el }) => {
      el.hidden = true;
    });
    U = null;
    csrfToken = null;
    clearAuth();
    let unav = false;
    try {
      U = authUser(await api("auth.php?action=me"), true);
    } catch (e) {
      U = null;
      unav = true;
      toast(UNAV_ERR + (e.message === CSRF_ERR ? " " + CSRF_ERR : ""));
    }
    const nt = unav ? "&auth=unavailable" : "";
    if (ACC === "member" && !U) {
      location.replace(
        R +
          "masuk.html?next=" +
          encodeURIComponent(
            location.pathname.split("/").pop() + location.search,
          ) +
          nt,
      );
      return false;
    }
    if (ACC === "admin") {
      if (!U) {
        location.replace(
          R +
            "masuk.html?next=" +
            encodeURIComponent("admin/" + location.pathname.split("/").pop()) +
            nt,
        );
        return false;
      }
      if (U.role !== "admin") {
        location.replace(R + "index.html");
        return false;
      }
    }
    if ($("#nav")) buildNav();
    if ($("#side")) buildAdmin();
    els.forEach(({ el, h }) => {
      el.hidden = h;
    });
    return true;
  }
  /* 5. KOMPONEN UI BERSAMA */
  const img = (p) =>
    !p ? "" : /^(https?:\/\/|data:image\/)/.test(p) ? p : R + esc(p);
  const card = (r) => {
    const t = esc(r.title || r.n),
      im = img(r.image_path || r.f || ""),
      rt =
        r.avg_rating != null
          ? "★ " + Number(r.avg_rating).toFixed(1)
          : r.r
            ? "★ " + Number(r.r).toFixed(1)
            : "";
    return `<a class="card" href="${R}detail-resep.html?id=${encodeURIComponent(r.id)}"><div class="thumb">${im ? `<img src="${im}" alt="${t}">` : "<span>Foto</span>"}</div><div class="cb"><h3>${t}</h3><div class="meta"><span>${r.cook_time_minutes || r.w || 30} mnt</span><span>${esc(r.difficulty || r.l || "Sedang")}</span>${rt ? `<span>${rt}</span>` : ""}</div></div></a>`;
  };
  function buildNav() {
    const menu = [
        ["index", "Beranda"],
        ["daftar-resep", "Resep"],
        ["faq", "FAQ"],
      ],
      cur = P === "detail-resep" ? "daftar-resep" : P,
      lnk = menu
        .map(
          ([k, lb]) =>
            `<a href="${R}${k}.html"${k === cur ? ' class="on" aria-current="page"' : ""}>${lb}</a>`,
        )
        .join("");
    const auth = U
      ? `<div class="acc"><button class="av" id="avb" aria-haspopup="true" aria-expanded="false">${esc(U.name[0].toUpperCase())}</button><div class="dd" id="dd" hidden><div class="dn">${esc(U.name)}<small>${esc(U.email)}</small></div><a href="${R}profil.html">Profil</a>${U.role === "admin" ? `<a href="${R}admin/dasbor.html">Panel Admin</a>` : ""}<button id="lo" type="button">Keluar</button></div></div>`
      : `<a class="btn ghost sm" href="${R}masuk.html">Masuk</a><a class="btn sm" href="${R}daftar.html">Daftar</a>`;
    $("#nav").innerHTML =
      `<div class="container nb"><a class="logo" href="${R}index.html"><img src="${R}img/logo-foodhub.jpg" alt="FoodHub"><span>FoodHub</span></a><button class="burger" id="bg" aria-label="Buka menu" aria-expanded="false">&#9776;</button><nav class="nl" id="nl">${lnk}</nav><div class="na">${auth}</div></div>`;
    $("#bg").addEventListener("click", () => {
      const o = $("#nl").classList.toggle("open");
      $("#bg").setAttribute("aria-expanded", String(o));
    });
    const av = $("#avb");
    if (av) {
      av.addEventListener("click", (e) => {
        e.stopPropagation();
        $("#dd").hidden = !$("#dd").hidden;
        av.setAttribute("aria-expanded", String(!$("#dd").hidden));
      });
      document.addEventListener("click", () => {
        if ($("#dd")) $("#dd").hidden = true;
        av.setAttribute("aria-expanded", "false");
      });
    }
    $("#lo")?.addEventListener("click", logout);
    if ($("#foot"))
      $("#foot").innerHTML =
        `<div class="container fb"><span>&copy; 2026 FoodHub &middot; Universitas Pradita</span><nav>${menu.map(([k, lb]) => `<a href="${R}${k}.html">${lb}</a>`).join("")}</nav></div>`;
  }
  function buildAdmin() {
    const menu = [
      ["dasbor", "Dasbor"],
      ["kelola-resep", "Kelola Resep"],
      ["kelola-pengguna", "Kelola Pengguna"],
    ];
    $("#top").innerHTML =
      `<strong>FoodHub Admin</strong><span class="muted sm">${esc(U ? U.name : "Admin")}</span>`;
    $("#side").innerHTML =
      menu
        .map(
          ([k, lb]) =>
            `<a href="${k}.html"${k === P ? ' class="on" aria-current="page"' : ""}>${lb}</a>`,
        )
        .join("") +
      `<a class="sp" href="${R}index.html">Lihat Situs</a><button type="button" id="alo">Keluar</button>`;
    $("#alo").addEventListener("click", logout);
  }
  /* 6. LOGIKA TIAP HALAMAN (Publik, Member, Admin) */
  const PG = {
    async index() {
      try {
        const { categories } = await api("categories.php");
        $("#cats").innerHTML =
          '<a class="chip on" href="daftar-resep.html">Semua</a>' +
          categories
            .map(
              (c) =>
                `<a class="chip" href="daftar-resep.html?kat=${encodeURIComponent(c.name)}">${esc(c.name)}</a>`,
            )
            .join("");
      } catch (e) {
        $("#cats").innerHTML =
          '<a class="chip on" href="daftar-resep.html">Semua</a>' +
          cats()
            .map(
              (c) =>
                `<a class="chip" href="daftar-resep.html?kat=${encodeURIComponent(c)}">${esc(c)}</a>`,
            )
            .join("");
      }
      try {
        const { recipes } = await api("recipes.php?sort=popular&limit=4");
        $("#pop").innerHTML = recipes.map(card).join("");
      } catch (e) {
        $("#pop").innerHTML = all().slice(0, 4).map(card).join("");
      }
      $("#heroForm")?.addEventListener("submit", (e) => {
        e.preventDefault();
        location.href =
          "daftar-resep.html?q=" + encodeURIComponent($("#q").value.trim());
      });
    },
    async "daftar-resep"() {
      const f = { q: $("#fq"), k: $("#fk"), w: $("#fw"), l: $("#fl") };
      try {
        const { categories } = await api("categories.php");
        f.k.innerHTML =
          '<option value="">Semua kategori</option>' +
          categories
            .map(
              (c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`,
            )
            .join("");
      } catch (e) {
        f.k.innerHTML =
          '<option value="">Semua kategori</option>' +
          cats()
            .map((c) => `<option>${esc(c)}</option>`)
            .join("");
      }
      f.q.value = qs.get("q") || "";
      f.k.value = qs.get("kat") || "";
      const run = async () => {
        const q = f.q.value.trim(),
          cat = f.k.value,
          w = +f.w.value,
          l = f.l.value;
        try {
          const params = new URLSearchParams({ sort: "popular" });
          if (q) params.set("q", q);
          if (cat) params.set("category", cat);
          if (w === 999) params.set("min_time", 61);
          else if (w) params.set("max_time", w);
          if (l) params.set("difficulty", l.toLowerCase());
          const { recipes } = await api("recipes.php?" + params);
          $("#cnt").textContent = recipes.length + " resep ditemukan";
          $("#rl").innerHTML = recipes.length
            ? recipes.map(card).join("")
            : '<p class="empty">Tidak ada resep yang cocok.</p>';
        } catch (e) {
          const ql = q.toLowerCase(),
            list = all().filter(
              (r) =>
                (!ql || (r.n + " " + (r.p || "")).toLowerCase().includes(ql)) &&
                (!cat || (r.k && r.k.includes(cat))) &&
                (!w || (w === 999 ? r.w > 60 : r.w <= w)) &&
                (!l || r.l.toLowerCase() === l.toLowerCase()),
            );
          $("#cnt").textContent = list.length + " resep ditemukan";
          $("#rl").innerHTML = list.length
            ? list.map(card).join("")
            : '<p class="empty">Tidak ada resep yang cocok.</p>';
        }
      };
      ["input", "change"].forEach((ev) =>
        [f.q, f.k, f.w, f.l].forEach((el) => el.addEventListener(ev, run)),
      );
      $("#fr").addEventListener("click", () => {
        f.q.value = "";
        f.k.value = "";
        f.w.value = "0";
        f.l.value = "";
        run();
      });
      run();
    },
    async "detail-resep"() {
      const id = qs.get("id"),
        box = $("#dr");
      if (!id) {
        box.innerHTML =
          '<div class="empty"><h2>Resep tidak ditemukan</h2><a class="btn" href="daftar-resep.html">Lihat semua resep</a></div>';
        return;
      }
      let r = null;
      try {
        const res = await api("recipes.php?id=" + encodeURIComponent(id));
        r = res && res.recipe;
        if (
          !r ||
          typeof r.title !== "string" ||
          !Array.isArray(r.ingredients) ||
          !Array.isArray(r.steps)
        )
          throw new Error();
      } catch (e) {
        const nf = e.status === 404 || e.status === 422;
        box.innerHTML = `<div class="empty"><h2>${nf ? "Resep tidak ditemukan" : "Gagal memuat resep"}</h2><a class="btn" href="daftar-resep.html">Lihat semua resep</a></div>`;
        return;
      }
      document.title = r.title + " | FoodHub";
      const base = r.servings || 4;
      let porsi = base,
        isFav = !!r.is_favorite;
      const im = img(r.image_path || "");
      box.innerHTML = `<div class="panel"><div>${(r.categories || []).map((k) => `<span class="tag">${esc(k)}</span>`).join(" ")}</div><h1>${esc(r.title)}</h1><p class="muted sm">Oleh ${esc(r.author || "Tim FoodHub")}</p><div class="detail-info"><span>Waktu: <b>${r.cook_time_minutes || 30} mnt</b></span><span>Porsi: <b id="sv">${porsi}</b></span><span>Rating: <b id="rt">★ ${r.avg_rating != null ? Number(r.avg_rating).toFixed(1) : "-"}</b></span></div><div style="display:flex;gap:.5rem;margin:.75rem 0"><button class="btn sm" id="fv" type="button">&hearts; <span id="fvt">${isFav ? "Tersimpan di Favorit" : "Simpan ke Favorit"}</span></button><button class="btn ghost sm" id="sh" type="button">Bagikan</button></div>${im ? `<img style="width:100%;max-height:320px;object-fit:cover;border-radius:8px;margin:.5rem 0" src="${im}" alt="${esc(r.title)}">` : ""}${r.story ? `<p>${esc(r.story)}</p>` : ""}<h2>Bahan-bahan <button class="btn ghost sm" id="mn" type="button">-</button> <b id="sv2">${porsi}</b> <button class="btn ghost sm" id="pl" type="button">+</button></h2><ul style="list-style:none;padding:0">${r.ingredients.map((ing, i) => `<li style="padding:.35rem 0;border-bottom:1px solid #e2e8f0"><input type="checkbox" id="b${i}"> <label for="b${i}">${esc(ing.name)}</label> <span class="am muted sm" data-i="${i}"></span></li>`).join("")}</ul><h2>Langkah Memasak</h2><ol>${r.steps.map((s) => `<li style="margin-bottom:.5rem">${esc(s)}</li>`).join("")}</ol></div>`;
      const tkg = () => {
        $$(".am").forEach((el) => {
          const ing = r.ingredients[+el.dataset.i];
          el.textContent =
            ing.quantity != null && !isNaN(ing.quantity)
              ? `${Math.round(((ing.quantity * porsi) / base) * 100) / 100} ${ing.unit || ""}`.trim()
              : ing.unit || "secukupnya";
        });
        $("#sv").textContent = porsi;
        $("#sv2").textContent = porsi;
      };
      tkg();
      $("#mn").addEventListener("click", () => {
        if (porsi > 1) {
          porsi--;
          tkg();
        }
      });
      $("#pl").addEventListener("click", () => {
        if (porsi < 50) {
          porsi++;
          tkg();
        }
      });
      $("#fv").addEventListener("click", async () => {
        if (!U) {
          location.href =
            R +
            "masuk.html?next=" +
            encodeURIComponent(
              location.pathname.split("/").pop() + location.search,
            );
          return;
        }
        try {
          if (isFav) {
            await api("favorites.php?recipe_id=" + encodeURIComponent(id), {
              method: "DELETE",
            });
            isFav = false;
            $("#fvt").textContent = "Simpan ke Favorit";
            toast("Dihapus dari favorit.");
          } else {
            await api("favorites.php", {
              method: "POST",
              body: { recipe_id: id },
            });
            isFav = true;
            $("#fvt").textContent = "Tersimpan di Favorit";
            toast("Disimpan ke favorit!");
          }
        } catch (e) {
          toast(e.message || "Gagal.");
        }
      });
      $("#sh").addEventListener("click", () => {
        navigator.clipboard?.writeText(location.href);
        toast("Tautan disalin!");
      });
    },
    async profil() {
      let pu = U,
        fav = [];
      try {
        pu = (await api("profile.php")).user || U;
      } catch (e) {}
      try {
        fav = (await api("favorites.php")).recipes || [];
      } catch (e) {
        fav = (U?.fav || []).map(byId).filter(Boolean);
      }
      const render = () => {
        $("#pf").innerHTML =
          `<h1>Profil Saya</h1><div class="panel"><p><strong>${esc(pu.name)}</strong><br><span class="muted sm">${esc(pu.email)}</span></p><form id="nf" novalidate><div class="ok" id="no" hidden></div><div class="err" id="ne" hidden></div><div class="fld"><label for="nn">Nama</label><input id="nn" value="${esc(pu.name)}" maxlength="40"></div><button class="btn sm" type="submit">Simpan</button></form></div><h2 style="margin-top:1.5rem">Resep Favorit <span class="muted sm">(${fav.length})</span></h2>${fav.length ? `<div class="grid">${fav.map((r) => `<div>${card(r)}<button class="btn danger sm" type="button" data-u="${esc(r.id)}" style="margin-top:.4rem;width:100%">Hapus dari Favorit</button></div>`).join("")}</div>` : '<p class="muted">Belum ada favorit. <a href="daftar-resep.html">Cari resep</a></p>'}`;
        bindSubmit($("#nf"), async () => {
          const v = $("#nn").value.trim();
          if (v.length < 3) {
            bar($("#ne"), "Nama min 3 karakter.");
            return;
          }
          try {
            const res = await api("profile.php", {
              method: "POST",
              body: { name: v },
            });
            pu = res.user;
            U = res.user;
            bar($("#no"), "Tersimpan!", true);
            buildNav();
          } catch (err) {
            bar($("#ne"), err.message || "Gagal simpan.");
          }
        });
      };
      render();
      $("#pf").addEventListener("click", async (e) => {
        const b = e.target.closest("[data-u]");
        if (!b) return;
        try {
          await api(
            "favorites.php?recipe_id=" + encodeURIComponent(b.dataset.u),
            { method: "DELETE" },
          );
          fav = fav.filter((r) => String(r.id) !== b.dataset.u);
          render();
          toast("Dihapus dari favorit.");
        } catch (err) {
          toast(err.message || "Gagal.");
        }
      });
    },
    masuk() {
      if (U) {
        location.replace(
          U.role === "admin" ? "admin/dasbor.html" : "profil.html",
        );
        return;
      }
      if (qs.get("auth") === "unavailable") bar($("#er"), UNAV_ERR);
      bindSubmit($("#lf"), async () => {
        const em = $("#em").value.trim().toLowerCase(),
          pw = $("#pw").value,
          er = $("#er");
        if (!em || !pw) {
          bar(er, "Email dan kata sandi wajib diisi.");
          return;
        }
        try {
          const res = await api("auth.php?action=login", {
            method: "POST",
            body: { email: em, password: pw, remember: $("#ing").checked },
          });
          U = authUser(res);
          clearAuth();
          const nx = qs.get("next");
          location.href =
            nx && /^(admin\/)?[a-z-]+\.html(\?[\w=&%.\-]*)?$/i.test(nx)
              ? nx
              : U.role === "admin"
                ? "admin/dasbor.html"
                : "index.html";
        } catch (err) {
          bar(er, err.message || "Email atau kata sandi salah.");
        }
      });
    },
    daftar() {
      if (U) {
        location.replace("profil.html");
        return;
      }
      bindSubmit($("#df"), async () => {
        const nm = $("#dn").value.trim(),
          em = $("#de").value.trim().toLowerCase(),
          pw = $("#dp").value,
          Er = [];
        if (nm.length < 3) Er.push("Nama min 3 karakter.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
          Er.push("Email tidak valid.");
        if (pw.length < 8) Er.push("Kata sandi min 8 karakter.");
        if (pw !== $("#dk").value) Er.push("Konfirmasi kata sandi tidak sama.");
        if (!$("#ds").checked) Er.push("Centang persetujuan syarat.");
        if (Er.length) {
          $("#er").innerHTML =
            `<ul>${Er.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
          $("#er").hidden = false;
          return;
        }
        try {
          const res = await api("auth.php?action=register", {
            method: "POST",
            body: { name: nm, email: em, password: pw },
          });
          U = authUser(res);
          clearAuth();
          toast("Pendaftaran berhasil!");
          location.href = "index.html";
        } catch (err) {
          $("#er").innerHTML =
            `<p>${esc(err.message || "Pendaftaran gagal.")}</p>`;
          $("#er").hidden = false;
        }
      });
    },
    faq() {},
    async dasbor() {
      let st = {
        total_recipes: 0,
        published_recipes: 0,
        hidden_recipes: 0,
        total_users: 0,
      };
      try {
        const res = await api("admin/stats.php");
        if (res && res.stats) st = res.stats;
      } catch (e) {
        const l = recipesList();
        st = {
          total_recipes: l.length,
          published_recipes: l.filter((r) => !hid().includes(r.id)).length,
          hidden_recipes:
            l.length - l.filter((r) => !hid().includes(r.id)).length,
          total_users: users().length,
        };
      }
      if ($("#statTotal")) {
        $("#statTotal").textContent = st.total_recipes;
        $("#statTayang").textContent = st.published_recipes;
        $("#statSembunyi").textContent = st.hidden_recipes;
        $("#statPengguna").textContent = st.total_users;
      }
    },
    async "kelola-resep"() {
      let list = [];
      const form = $("#recipePanel");
      const load = async () => {
        try {
          list = (await api("admin/recipes.php")).recipes || [];
        } catch (e) {
          list = recipesList();
        }
        const tb = $("#resepTableBody");
        if (!tb) return;
        tb.innerHTML = list.length
          ? list
              .map((r) => {
                const pub = r.is_published !== false && !hid().includes(r.id),
                  t = r.title || r.n,
                  im2 = img(r.image_path || r.f || "");
                return `<tr><td>${im2 ? `<img class="t-thumb" src="${im2}" alt="${esc(t)}">` : '<div class="t-thumb"></div>'}</td><td><strong>${esc(t)}</strong></td><td>${(r.categories || r.k || []).map((k) => `<span class="tag">${esc(k)}</span>`).join(" ")}</td><td>${r.cook_time_minutes || r.w || 30} mnt</td><td><span class="sts ${pub ? "disetujui" : "ditolak"}">${pub ? "Tayang" : "Sembunyi"}</span></td><td><button class="btn ghost sm" data-edit="${r.id}">Edit</button> <button class="btn danger sm" data-del="${r.id}">Hapus</button> <button class="btn sm" data-toggle="${r.id}" data-pub="${pub ? 1 : 0}">${pub ? "Sembunyi" : "Tayang"}</button></td></tr>`;
              })
              .join("")
          : '<tr><td colspan="6" class="muted" style="text-align:center">Tidak ada resep.</td></tr>';
      };
      $("#btnTambahResep")?.addEventListener("click", () => {
        $("#recipeForm").reset();
        $("#rf_id").value = "";
        $("#modalTitle").textContent = "Tambah Resep";
        form.hidden = false;
      });
      $("#formCancel")?.addEventListener("click", () => {
        form.hidden = true;
      });
      $("#resepTableBody")?.addEventListener("click", async (e) => {
        const ed = e.target.closest("[data-edit]"),
          dl = e.target.closest("[data-del]"),
          tg = e.target.closest("[data-toggle]");
        if (ed) {
          const r = list.find((x) => x.id === +ed.dataset.edit);
          if (r) {
            $("#rf_id").value = r.id;
            $("#rf_n").value = r.title || r.n || "";
            $("#rf_p").value = r.region || r.p || "";
            $("#rf_w").value = r.cook_time_minutes || r.w || 45;
            $("#rf_l").value = (r.difficulty || r.l || "sedang").toLowerCase();
            $("#rf_s").value = r.servings || r.s || 4;
            $("#rf_c").value = r.story || r.c || "";
            $("#rf_k").value =
              (r.categories && r.categories[0]) || (r.k && r.k[0]) || "";
            $("#rf_b").value = (r.ingredients || [])
              .map((x) =>
                x.name ? `${x.name},${x.quantity || ""},${x.unit || ""}` : x,
              )
              .join("\n");
            $("#rf_t").value = (r.steps || []).join("\n");
            $("#modalTitle").textContent = "Edit Resep";
            form.hidden = false;
          }
        } else if (dl) {
          const r = list.find((x) => x.id === +dl.dataset.del);
          if (!r || !confirm(`Hapus "${r.title || r.n}"?`)) return;
          try {
            await api(
              "admin/recipes.php?id=" + encodeURIComponent(dl.dataset.del),
              { method: "DELETE" },
            );
            toast("Resep dihapus.");
          } catch (err) {
            toast(err.message || "Gagal.");
          }
          load();
        } else if (tg) {
          const pub = tg.dataset.pub === "1";
          try {
            await api(
              "admin/recipes.php?id=" + encodeURIComponent(tg.dataset.toggle),
              { method: "PATCH", body: { is_published: !pub } },
            );
            toast(!pub ? "Resep ditampilkan." : "Resep disembunyikan.");
          } catch (err) {
            const h = hid();
            sv(
              "fh_hid",
              pub
                ? h.concat(+tg.dataset.toggle)
                : h.filter((x) => x !== +tg.dataset.toggle),
            );
          }
          load();
        }
      });
      $("#recipeForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const idV = $("#rf_id").value,
          title = $("#rf_n").value.trim(),
          story = $("#rf_c").value.trim();
        if (!title || !story) {
          toast("Nama dan deskripsi wajib diisi.");
          return;
        }
        const ings = $("#rf_b")
            .value.split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((ln) =>
              ln.includes(",")
                ? (([n, q, u]) => ({
                    name: n,
                    quantity: isNaN(+q) ? null : +q,
                    unit: u || "",
                  }))(ln.split(",").map((x) => x.trim()))
                : { name: ln, quantity: 1, unit: "secukupnya" },
            ),
          payload = {
            title,
            region: $("#rf_p").value.trim() || "Nusantara",
            categories: [$("#rf_k").value],
            cook_time_minutes: +$("#rf_w").value || 30,
            difficulty: $("#rf_l").value,
            servings: +$("#rf_s").value || 4,
            story,
            is_published: true,
            ingredients: ings,
            steps: $("#rf_t")
              .value.split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          },
          rawFile = $("#rf_file")?.files?.[0];
        if (rawFile && rawFile.type.startsWith("image/")) {
          try {
            const fd = new FormData();
            fd.append("image", rawFile);
            const up = await api("admin/upload.php", {
              method: "POST",
              body: fd,
            });
            if (up && up.image_path) payload.image_path = up.image_path;
          } catch (err) {
            toast("Gagal unggah foto: " + (err.message || ""));
            return;
          }
        }
        try {
          if (idV) {
            await api("admin/recipes.php?id=" + encodeURIComponent(idV), {
              method: "PUT",
              body: payload,
            });
            toast("Resep diperbarui!");
          } else {
            await api("admin/recipes.php", { method: "POST", body: payload });
            toast("Resep ditambahkan!");
          }
          form.hidden = true;
          load();
        } catch (err) {
          toast(err.message || "Gagal simpan.");
        }
      });
      load();
    },
    "moderasi-resep"() {
      this["kelola-resep"]();
    },
    async "kelola-pengguna"() {
      const load = async () => {
        let ul = [];
        try {
          ul = (await api("admin/users.php"))?.users || [];
        } catch (e) {
          ul = users();
        }
        const tb = $("#userTableBody");
        if (!tb) return;
        tb.innerHTML = ul.length
          ? ul
              .map(
                (u) =>
                  `<tr><td><b>#${esc(u.id || "-")}</b></td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><span class="sts ${u.role === "admin" ? "admin" : "selesai"}">${esc(u.role)}</span></td><td>${esc((u.created_at || u.at || "-").slice(0, 10))}</td><td>${u.role === "admin" || (U && u.id === U.id) ? '<span class="muted sm">Tidak dapat dihapus</span>' : `<button class="btn danger sm" data-id="${esc(u.id || "")}" data-n="${esc(u.name)}">Hapus</button>`}</td></tr>`,
              )
              .join("")
          : '<tr><td colspan="6" class="muted" style="text-align:center">Tidak ada pengguna.</td></tr>';
      };
      $("#btnTambahPengguna")?.addEventListener("click", () => {
        $("#userForm").reset();
        $("#userFormErr").hidden = true;
        $("#userPanel").hidden = false;
      });
      $("#userCancel")?.addEventListener("click", () => {
        $("#userPanel").hidden = true;
      });
      $("#userTableBody")?.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-id]");
        if (!b || !confirm(`Hapus ${b.dataset.n}?`)) return;
        try {
          await api("admin/users.php?id=" + encodeURIComponent(b.dataset.id), {
            method: "DELETE",
          });
          toast("Pengguna dihapus.");
          load();
        } catch (err) {
          toast(err.message || "Gagal.");
        }
      });
      $("#userForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errBar = $("#userFormErr"),
          name = $("#uf_name").value.trim(),
          email = $("#uf_email").value.trim().toLowerCase(),
          password = $("#uf_password").value;
        if (name.length < 3) {
          bar(errBar, "Nama min 3 karakter.");
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          bar(errBar, "Email tidak valid.");
          return;
        }
        if (password.length < 8) {
          bar(errBar, "Kata sandi min 8 karakter.");
          return;
        }
        try {
          await api("admin/users.php", {
            method: "POST",
            body: { name, email, password },
          });
          $("#userPanel").hidden = true;
          toast("Pengguna ditambahkan!");
          load();
        } catch (err) {
          bar(errBar, err.message || "Gagal.");
        }
      });
      load();
    },
  };
  /* 7. INISIALISASI & EKSPOR TEST */
  async function init() {
    const ok = await initAuth();
    if (!ok) return;
    if (PG[P]) {
      const ret = PG[P]();
      if (ret?.catch) ret.catch(console.error);
    }
  }
  globalThis.authTest = {
    api,
    logout,
    init,
    initAuth,
    PG,
    users,
    get user() {
      return U;
    },
  };
  init();
})();
