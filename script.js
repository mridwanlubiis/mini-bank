// ---------- Pengaturan aturan (ubah di sini jika aturan berubah) ----------
const RULES = {
    namaMin: 3,  namaMax: 50,
    emailMax: 100,
    hpMin: 10,   hpMax: 13,
    pwMin: 8,    pwMax: 20
  };
  const STORAGE_KEY = "registrasi_users";
  
  // ---------- Helper ----------
  const $ = (id) => document.getElementById(id);
  const form = $("register-form");
  const names = ["nama", "email", "hp", "password", "konfirmasi"];
  const touched = new Set(); // kolom yang sudah disentuh/di-submit
  
  // ---------- Validator: kembalikan "" jika valid, atau pesan error ----------
  const validators = {
    nama(value) {
      const v = value.trim();
      if (!v) return "Nama wajib diisi";
      if (!/^[A-Za-z ]+$/.test(v)) return "Nama hanya boleh berisi huruf dan spasi";
      if (v.length < RULES.namaMin) return "Nama minimal " + RULES.namaMin + " karakter";
      if (v.length > RULES.namaMax) return "Nama maksimal " + RULES.namaMax + " karakter";
      return "";
    },
  
    email(value) {
      const v = value.trim();
      if (!v) return "Email wajib diisi";
      if (v.length > RULES.emailMax) return "Email maksimal " + RULES.emailMax + " karakter";
      if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v)) return "Format email tidak valid";
      return "";
    },
  
    hp(value) {
      const v = value.trim();
      if (!v) return "Nomor HP wajib diisi";
      if (!/^\+?\d+$/.test(v)) return "Nomor HP hanya boleh berisi angka";
      if (!(v.startsWith("08") || v.startsWith("+62"))) return "Nomor HP harus diawali 08 atau +62";
      const digits = v.replace("+", "").length; // tanda + tidak dihitung
      if (digits < RULES.hpMin || digits > RULES.hpMax) {
        return "Nomor HP harus " + RULES.hpMin + "-" + RULES.hpMax + " digit";
      }
      return "";
    },
  
    password(value) {
      if (!value) return "Password wajib diisi";
      if (value.length < RULES.pwMin) return "Password minimal " + RULES.pwMin + " karakter";
      if (value.length > RULES.pwMax) return "Password maksimal " + RULES.pwMax + " karakter";
      if (!/[A-Z]/.test(value)) return "Password harus mengandung minimal 1 huruf besar";
      if (!/[0-9]/.test(value)) return "Password harus mengandung minimal 1 angka";
      return "";
    },
  
    konfirmasi(value) {
      if (!value) return "Konfirmasi password wajib diisi";
      if (value !== $("password").value) return "Konfirmasi password tidak sama dengan password";
      return "";
    }
  };
  
  // ---------- Tampilkan / sembunyikan pesan error pada satu kolom ----------
  function render(name, msg) {
    const input = $(name);
    const wrap = input.closest(".field");
    const show = touched.has(name);
    $(name + "-error").textContent = show ? msg : "";
    wrap.classList.toggle("invalid", show && !!msg);
    wrap.classList.toggle("valid", show && !msg);
    input.setAttribute("aria-invalid", show && !!msg ? "true" : "false");
  }
  
  function validateField(name) {
    const msg = validators[name]($(name).value);
    render(name, msg);
    return msg;
  }
  
  // ---------- Checklist syarat password ----------
  function updateChecklist() {
    const v = $("password").value;
    const met = {
      length: v.length >= RULES.pwMin && v.length <= RULES.pwMax,
      upper: /[A-Z]/.test(v),
      digit: /[0-9]/.test(v)
    };
    document.querySelectorAll("#password-rules li").forEach((li) => {
      li.classList.toggle("met", met[li.dataset.rule]);
    });
  }
  
  // ---------- Event: ketik dan keluar dari kolom ----------
  names.forEach((name) => {
    const input = $(name);
  
    input.addEventListener("input", () => {
      if (touched.has(name)) validateField(name);
      if (name === "password") {
        updateChecklist();
        // konfirmasi perlu dicek ulang saat password berubah
        if (touched.has("konfirmasi")) validateField("konfirmasi");
      }
    });
  
    input.addEventListener("blur", () => {
      touched.add(name);
      validateField(name);
    });
  });
  
  // ---------- Tombol tampilkan / sembunyikan password ----------
  document.querySelectorAll(".toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $(btn.dataset.target);
      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      btn.textContent = hidden ? "Sembunyikan" : "Tampilkan";
      btn.setAttribute("aria-pressed", String(hidden));
    });
  });
  
  // ---------- Penyimpanan (localStorage) ----------
  function loadUsers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    } catch (e) { /* abaikan jika penyimpanan tidak tersedia */ }
  }
  
  function renderUsers() {
    const users = loadUsers();
    $("data-title").textContent = "Data tersimpan (" + users.length + ")";
    const body = $("data-body");
    body.textContent = "";
  
    if (users.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = "Belum ada data. Daftar dulu lewat form di atas.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
  
    users.forEach((u) => {
      const tr = document.createElement("tr");
      [u.nama, u.email, u.hp, new Date(u.waktu).toLocaleString("id-ID")].forEach((text) => {
        const td = document.createElement("td");
        td.textContent = text; // textContent supaya aman dari injeksi HTML
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }
  
  // ---------- Reset form ----------
  function resetForm() {
    form.reset();
    touched.clear();
    names.forEach((n) => render(n, ""));
    updateChecklist();
    $("summary").hidden = true;
    document.querySelectorAll(".toggle").forEach((btn) => {
      $(btn.dataset.target).type = "password";
      btn.textContent = "Tampilkan";
      btn.setAttribute("aria-pressed", "false");
    });
  }
  
  // ---------- Submit ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
  
    names.forEach((n) => touched.add(n));
    const invalid = names.filter((n) => validateField(n));
  
    if (invalid.length > 0) {
      const summary = $("summary");
      summary.textContent = "Ada " + invalid.length + " kolom yang belum sesuai. Perbaiki lalu klik Daftar lagi.";
      summary.hidden = false;
      $(invalid[0]).focus();
      return;
    }
    $("summary").hidden = true;
  
    // Cek email duplikat (tidak membedakan huruf besar/kecil)
    const email = $("email").value.trim();
    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      touched.add("email");
      render("email", "Email sudah terdaftar. Gunakan email lain.");
      $("email").focus();
      return;
    }
  
    // Simpan data (password sengaja TIDAK disimpan)
    const user = {
      nama: $("nama").value.trim(),
      email: email,
      hp: $("hp").value.trim(),
      waktu: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
    renderUsers();
  
    $("out-nama").textContent = user.nama;
    $("out-email").textContent = user.email;
    $("out-hp").textContent = user.hp;
    $("form-view").hidden = true;
    $("success-view").hidden = false;
  });
  
  // ---------- Tombol lain ----------
  $("btn-reset").addEventListener("click", resetForm);
  
  $("btn-again").addEventListener("click", () => {
    resetForm();
    $("success-view").hidden = true;
    $("form-view").hidden = false;
    $("nama").focus();
  });
  
  $("btn-clear").addEventListener("click", () => {
    if (confirm("Hapus semua data tersimpan?")) {
      saveUsers([]);
      renderUsers();
    }
  });
  
  // ---------- Awal ----------
  updateChecklist();
  renderUsers();