// ====== Konfigurasi ======
const REKENING_SENDIRI = "0987654321";
const SALDO_AWAL = 1000000;
const NOMINAL_MIN = 10000;
const NOMINAL_MAX = 5000000;
const BIAYA_ADMIN = 2500;
const LIMIT_HARIAN = 3000000;
const TOPUP_MIN = 10000;
const TOPUP_MAX = 5000000;
const PIN_BENAR = "123456";
const PIN_MAKS_SALAH = 3;
const CATATAN_MAX = 50;
const KUNCI_STORAGE = "minibank-state-v2";

const rekeningTerdaftar = {
  "1234567890": "Budi Santoso",
  "2345678901": "Sari Wulandari",
  "3456789012": "Andi Pratama"
};

// ====== State ======
function dataAwal() {
  return { saldo: SALDO_AWAL, riwayat: [], pinSalah: 0, terkunci: false };
}

function muatState() {
  try {
    const data = JSON.parse(localStorage.getItem(KUNCI_STORAGE));
    if (data && typeof data.saldo === "number" && Array.isArray(data.riwayat)) {
      return Object.assign(dataAwal(), data);
    }
  } catch (e) {
    // abaikan, pakai data awal
  }
  return dataAwal();
}

function simpanState() {
  try {
    localStorage.setItem(KUNCI_STORAGE, JSON.stringify(state));
  } catch (e) {
    // penyimpanan tidak tersedia
  }
}

let state = muatState();
let sedangProses = false;

// ====== Elemen ======
const $ = (id) => document.getElementById(id);
const formTransfer = $("form-transfer");
const formTopup = $("form-topup");
const tombolKirim = $("btn-kirim");

// ====== Helper ======
const formatRupiah = (angka) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(angka);

function hariIni() {
  const d = new Date();
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const hari = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + bulan + "-" + hari;
}

function terpakaiHariIni() {
  return state.riwayat
    .filter((t) => t.jenis === "transfer" && t.tanggal === hariIni())
    .reduce((jumlah, t) => jumlah + t.nominal, 0);
}

function sisaLimit() {
  return Math.max(0, LIMIT_HARIAN - terpakaiHariIni());
}

// Cek format nominal. Mengembalikan { error, nilai }
function cekNominal(mentah) {
  if (mentah === "") return { error: "Nominal wajib diisi." };
  if (!/^-?\d+$/.test(mentah)) {
    return { error: "Nominal harus berupa angka bulat tanpa titik atau huruf." };
  }
  const nilai = Number(mentah);
  if (nilai <= 0) return { error: "Nominal harus lebih dari 0." };
  return { nilai: nilai };
}

function tampilkanPesan(id, pesan, sukses) {
  const el = $(id);
  el.textContent = pesan;
  el.className = "hasil " + (sukses ? "sukses" : "gagal");
}

// ====== Validasi transfer ======
function validasiTransfer(tujuan, nominalMentah, catatan, pin) {
  const error = {};

  if (tujuan === "") {
    error.tujuan = "Rekening tujuan wajib diisi.";
  } else if (!/^\d{10}$/.test(tujuan)) {
    error.tujuan = "Rekening tujuan harus 10 digit angka.";
  } else if (tujuan === REKENING_SENDIRI) {
    error.tujuan = "Tidak bisa transfer ke rekening sendiri.";
  } else if (!rekeningTerdaftar[tujuan]) {
    error.tujuan = "Rekening tujuan tidak terdaftar.";
  }

  const hasil = cekNominal(nominalMentah);
  if (hasil.error) {
    error.nominal = hasil.error;
  } else if (hasil.nilai < NOMINAL_MIN) {
    error.nominal = "Nominal minimal " + formatRupiah(NOMINAL_MIN) + ".";
  } else if (hasil.nilai > NOMINAL_MAX) {
    error.nominal = "Nominal maksimal " + formatRupiah(NOMINAL_MAX) + " per transaksi.";
  } else if (hasil.nilai > sisaLimit()) {
    error.nominal = "Melebihi limit harian. Sisa limit hari ini " + formatRupiah(sisaLimit()) + ".";
  } else if (hasil.nilai + BIAYA_ADMIN > state.saldo) {
    error.nominal =
      "Saldo tidak cukup. Dibutuhkan " + formatRupiah(hasil.nilai + BIAYA_ADMIN) +
      " (termasuk biaya admin), saldo Anda " + formatRupiah(state.saldo) + ".";
  }

  if (catatan.length > CATATAN_MAX) {
    error.catatan = "Catatan maksimal " + CATATAN_MAX + " karakter.";
  }

  if (pin === "") {
    error.pin = "PIN wajib diisi.";
  } else if (!/^\d{6}$/.test(pin)) {
    error.pin = "PIN harus 6 digit angka.";
  }

  return error;
}

function tampilkanErrorTransfer(error) {
  $("err-tujuan").textContent = error.tujuan || "";
  $("err-nominal").textContent = error.nominal || "";
  $("err-catatan").textContent = error.catatan || "";
  $("err-pin").textContent = error.pin || "";
}

// ====== Tampilan ======
function render() {
  $("saldo").textContent = formatRupiah(state.saldo);
  $("limit").textContent =
    "Sisa limit transfer hari ini: " + formatRupiah(sisaLimit()) +
    " dari " + formatRupiah(LIMIT_HARIAN) +
    (state.terkunci ? " | Transfer terkunci" : "");
  renderRiwayat();
}

function renderRiwayat() {
  const daftar = $("riwayat");
  daftar.innerHTML = "";
  $("err-filter").textContent = "";

  const kata = $("cari").value.trim().toLowerCase();
  const jenis = $("jenis").value;
  const dari = $("dari").value;
  const sampai = $("sampai").value;

  if (dari && sampai && dari > sampai) {
    $("err-filter").textContent = "Tanggal awal tidak boleh setelah tanggal akhir.";
    return;
  }

  const hasil = state.riwayat.filter((t) => {
    if (jenis !== "semua" && t.jenis !== jenis) return false;
    if (dari && t.tanggal < dari) return false;
    if (sampai && t.tanggal > sampai) return false;
    if (kata) {
      const teks = ((t.nama || "Top up saldo") + " " + (t.tujuan || "") + " " + (t.catatan || "")).toLowerCase();
      if (!teks.includes(kata)) return false;
    }
    return true;
  });

  if (hasil.length === 0) {
    const kosong = document.createElement("li");
    kosong.className = "kosong";
    kosong.textContent =
      state.riwayat.length === 0
        ? "Belum ada transaksi. Kirim transfer pertama Anda di atas."
        : "Tidak ada transaksi yang cocok dengan filter.";
    daftar.appendChild(kosong);
    return;
  }

  hasil.forEach((trx) => {
    const li = document.createElement("li");
    const kiri = document.createElement("div");
    const judul = document.createElement("strong");
    const meta = document.createElement("span");
    const jumlah = document.createElement("span");
    jumlah.className = "jumlah";

    if (trx.jenis === "topup") {
      judul.textContent = "Top up saldo";
      meta.textContent = trx.waktu;
      jumlah.textContent = "+" + formatRupiah(trx.nominal);
      jumlah.classList.add("masuk");
    } else {
      judul.textContent = trx.nama + " (" + trx.tujuan + ")";
      meta.textContent =
        trx.waktu + " | biaya admin " + formatRupiah(trx.biaya) +
        (trx.catatan ? " | " + trx.catatan : "");
      jumlah.textContent = "-" + formatRupiah(trx.nominal);
    }

    kiri.appendChild(judul);
    kiri.appendChild(meta);
    li.appendChild(kiri);
    li.appendChild(jumlah);
    daftar.appendChild(li);
  });
}

// ====== Transfer ======
formTransfer.addEventListener("submit", (event) => {
  event.preventDefault();
  if (sedangProses) return;

  tampilkanPesan("hasil", "", true);

  if (state.terkunci) {
    tampilkanPesan("hasil", "Transfer terkunci karena PIN salah " + PIN_MAKS_SALAH + " kali. Gunakan Reset data untuk membuka.", false);
    return;
  }

  const tujuan = $("tujuan").value.trim();
  const nominalMentah = $("nominal").value.trim();
  const catatan = $("catatan").value.trim();
  const pin = $("pin").value;

  const error = validasiTransfer(tujuan, nominalMentah, catatan, pin);
  tampilkanErrorTransfer(error);

  if (Object.keys(error).length > 0) {
    tampilkanPesan("hasil", "Transfer gagal. Periksa kolom yang bertanda merah.", false);
    return;
  }

  // Cek PIN
  if (pin !== PIN_BENAR) {
    state.pinSalah += 1;
    if (state.pinSalah >= PIN_MAKS_SALAH) state.terkunci = true;
    simpanState();
    render();
    $("pin").value = "";
    tampilkanPesan(
      "hasil",
      state.terkunci
        ? "PIN salah " + PIN_MAKS_SALAH + " kali. Transfer terkunci."
        : "PIN salah. Sisa percobaan: " + (PIN_MAKS_SALAH - state.pinSalah) + ".",
      false
    );
    return;
  }

  sedangProses = true;
  tombolKirim.disabled = true;
  tombolKirim.textContent = "Memproses...";

  // Simulasi waktu proses server (1 detik)
  setTimeout(() => {
    const nominal = Number(nominalMentah);

    state.saldo -= nominal + BIAYA_ADMIN;
    state.pinSalah = 0;
    state.riwayat.unshift({
      jenis: "transfer",
      tujuan: tujuan,
      nama: rekeningTerdaftar[tujuan],
      nominal: nominal,
      biaya: BIAYA_ADMIN,
      catatan: catatan,
      waktu: new Date().toLocaleString("id-ID"),
      tanggal: hariIni()
    });
    simpanState();
    render();

    tampilkanPesan(
      "hasil",
      "Transfer " + formatRupiah(nominal) + " ke " + rekeningTerdaftar[tujuan] +
        " berhasil. Biaya admin " + formatRupiah(BIAYA_ADMIN) + ".",
      true
    );
    formTransfer.reset();

    sedangProses = false;
    tombolKirim.disabled = false;
    tombolKirim.textContent = "Kirim transfer";
  }, 1000);
});

// ====== Top up ======
formTopup.addEventListener("submit", (event) => {
  event.preventDefault();
  $("err-topup").textContent = "";
  tampilkanPesan("hasil-topup", "", true);

  const hasil = cekNominal($("topup-nominal").value.trim());
  let pesan = hasil.error || "";

  if (!pesan && hasil.nilai < TOPUP_MIN) {
    pesan = "Top up minimal " + formatRupiah(TOPUP_MIN) + ".";
  } else if (!pesan && hasil.nilai > TOPUP_MAX) {
    pesan = "Top up maksimal " + formatRupiah(TOPUP_MAX) + " per transaksi.";
  }

  if (pesan) {
    $("err-topup").textContent = pesan;
    return;
  }

  state.saldo += hasil.nilai;
  state.riwayat.unshift({
    jenis: "topup",
    nominal: hasil.nilai,
    waktu: new Date().toLocaleString("id-ID"),
    tanggal: hariIni()
  });
  simpanState();
  render();
  tampilkanPesan("hasil-topup", "Top up " + formatRupiah(hasil.nilai) + " berhasil.", true);
  formTopup.reset();
});

// ====== Filter dan reset ======
["cari", "jenis", "dari", "sampai"].forEach((id) => {
  $(id).addEventListener("input", renderRiwayat);
  $(id).addEventListener("change", renderRiwayat);
});

$("btn-reset").addEventListener("click", () => {
  if (sedangProses) return;
  state = dataAwal();
  simpanState();
  tampilkanErrorTransfer({});
  $("err-topup").textContent = "";
  tampilkanPesan("hasil", "", true);
  tampilkanPesan("hasil-topup", "", true);
  formTransfer.reset();
  formTopup.reset();
  $("cari").value = "";
  $("jenis").value = "semua";
  $("dari").value = "";
  $("sampai").value = "";
  render();
});

render();