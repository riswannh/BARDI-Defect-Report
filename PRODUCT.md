# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Admin** — satu orang (pemilik proses) yang mengelola master data, user, dan seluruh pabrik. Mengerjakan setup awal, input data dari spreadsheet lama, dan membaca laporan lintas pabrik.

**Staff pabrik (beberapa orang per pabrik)** — dikonfirmasi sebagai pemakai nyata, bukan hanya satu kepala pabrik per lokasi. Tugas harian: mencatat defect dan sales untuk pabriknya sendiri. Saat ini ada 3 pabrik (Jakarta, Surabaya, Bandung); jumlah pastinya belum ditetapkan.

**Kepala pabrik / manajemen** — membaca Report dari HP, sering di luar jam kerja kantor. Bukan pengguna yang menginput data.

**Staf dan pimpinan di China** — dikonfirmasi sebagai pengguna nyata, bukan cadangan. Karena itu kualitas terjemahan 中文 adalah kebutuhan, bukan pelengkap: label harus istilah pabrik yang benar, bukan hasil terjemahan harfiah. Operator di sana juga membaca data yang isinya berbahasa Indonesia (nama produk, problem, status), jadi istilah master data tidak boleh ikut diterjemahkan.

## Product Purpose

Menggantikan pencatatan manual berbasis Google Spreadsheet yang tersebar di banyak file. Data defect dan sales yang tercerai membuat rekap lambat, rawan salah, dan tren per produk maupun per pabrik sulit dilihat.

Aplikasi menyatukan pencatatan, menghasilkan laporan otomatis untuk periode harian/mingguan/bulanan/tahunan/rentang, dan menampilkan perbandingan defect vs sales per produk.

**Ukuran keberhasilan** (dari PRD): staff benar-benar mengisi Data Defect dan Data Sales, sehingga laporan tersaji otomatis tanpa rekap manual. Angka target adopsi belum ditetapkan.

## Positioning

**Kontrol akses ditegakkan di server, bukan disembunyikan di UI.** `scopedFactoryId()` memaksa filter pabrik milik user dan `stripValue()` menghapus kolom `value` dari respons API — jadi role Pabrik tidak bisa melihat nilai IDR meski memanggil API langsung. Kombinasi ini dengan aturan "role Pabrik hanya menu Report" dan impor Excel idempotent (duplikat di-skip, bukan error) adalah hal yang tidak bisa ditiru spreadsheet dan jarang ada di aplikasi internal sederhana.

## Operating Context

- Pencatatan defect harian dengan **timestamp lengkap** (tanggal + jam, input `datetime-local`); sales dicatat **per bulan** (3 huruf, mis. `Jan`) tanpa tahun.
- Migrasi data lama dari spreadsheet lewat **impor Excel**; tersedia unduh **template** per modul.
- Mata uang **IDR**. `Intl.NumberFormat` locale `id-ID`.
- Bahasa UI: **Indonesia (default), English, 中文** — hanya label UI; data dari database tidak diterjemahkan. Ketiganya dipakai sungguhan, termasuk oleh staf di China.
- Teks berbahasa China muncul di UI, jadi komponen harus tahan terhadap **glyph CJK**: font brand (Plus Jakarta Sans) tidak punya karakter China dan akan jatuh ke font sistem — perhatikan line-height, pemotongan teks, dan lebar kolom saat teks 中文 tampil.
- Deploy: Docker Compose, satu file SQLite (`./data/sqlite.db`) via bind mount. Development memakai database yang sama dengan Docker (`DB_FILE_NAME=../data/sqlite.db`).
- Foto/video defect disimpan sebagai **tautan**, bukan upload.
- Setiap perubahan fitur wajib: `npx tsc --noEmit` + `npx eslint` → commit → push ke branch `main`.

## Capabilities and Constraints

Terkonfirmasi dan sudah berjalan:

- Modul: Report, Data Sales, Data Defect, Data Master (Produk/Problem/Status/Pabrik), User Management, Login & Hak Akses, Impor/Ekspor Excel, i18n, Docker.
- Role Pabrik **hanya** menu Report; halaman admin diblokir `AdminGuard`.
- Value (IDR) hanya untuk Admin — dihapus di level API untuk role Pabrik, termasuk saat ekspor Excel.
- Deteksi duplikat impor: defect → `codeGaransi`; sales → kombinasi `produk + pabrik + bulan`; master → `name`; user → `username`.
- Hapus-semua-data selalu membuat backup `backup-{module}-{timestamp}.db` lebih dulu; master yang masih dipakai defect/sales gagal dihapus (409); hapus semua user mengecualikan akun sendiri.
- Grafik maksimum 12 kolom; pie top 7 produk + "Lainnya"; grafik sales selalu tahunan.
- Rasio defect/sales: sales 0 + defect > 0 → 100%; keduanya 0 → tanpa rasio.
- Setiap dropdown Select punya kotak pencarian yang langsung fokus saat dibuka.

Batasan teknis yang mengikat:

- **Tidak boleh bergantung pada domain Google atau CDN eksternal saat runtime** — aplikasi diakses dari lingkungan jaringan China. Font saat ini dimuat build-time lewat `next/font/google` sehingga di-*self-host* ke dalam build dan tidak memanggil Google dari browser; ketergantungan ini harus tetap begitu, dan setiap aset atau library baru wajib di-vendor, bukan di-CDN.
- Aplikasi harus jalan di **LAN pabrik** (tanpa internet).
- `@swc/helpers` wajib ada sebagai devDependency.

Belum diputuskan:

- Target jumlah pabrik, user, dan volume data jangka panjang.
- Apakah aplikasi akan diekspos ke domain/IP publik, atau tetap di jaringan internal.

## Brand Commitments

- **Nama**: BARDI Defect Report — label sidebar "Analysis".
- **Warna utama `#46BBC5`**, diambil dari logo perusahaan. Ini komitmen brand, bukan pilihan selera.
- **Font Plus Jakarta Sans** (heading + body). Sudah terpasang; mempertahankannya menghindari penambahan aset baru.
- Logo asli ada di `frontend/public/logo.png` (256×256).
- Dark mode aktif (next-themes); kedua tema harus tetap setara kualitasnya.

## Evidence on Hand

- `PRD.md` — kebutuhan awal; `README.md` — PRD terupdate + dokumentasi implementasi (single source of truth); `AGENTS.md` (+ `frontend/AGENTS.md`) — aturan workflow agent.
- Data seed nyata untuk pengujian: 3 pabrik, 5 produk, 5 problem, 4 status, 7 defect, 21 baris sales, 4 akun (`admin/admin123`, `pabrik_jkt|sby|bdg / pabrik123`).
- `frontend/public/logo.png` — aset brand asli.
- **Tidak ada**: testimoni, studi kasus, benchmark performa, angka adopsi, atau materi marketing. Jangan mengarang bukti semacam itu.

## Product Principles

1. **Input data harus lebih cepat daripada spreadsheet.** Kalau mencatat satu defect tidak lebih cepat dari mengetik di Sheets, staf akan kembali ke Sheets dan produk ini gagal pada ukuran keberhasilannya sendiri.
2. **Keamanan data adalah aturan server.** Apa pun yang tidak boleh dilihat role Pabrik tidak boleh ada di respons API — bukan sekadar disembunyikan dengan CSS.
3. **Impor harus pemaaf dan idempotent.** Data kotor dari spreadsheet lama itu normal: lewati duplikat, laporkan error per baris, jangan pernah menggagalkan seluruh berkas.
4. **Angka harus bisa dipindai dan dibandingkan.** Angka rata kanan, tabular, format IDR konsisten; satu pandangan cukup untuk menilai rasio defect.
5. **Berjalan di lingkungan terbatas.** Tanpa CDN, tanpa domain Google, tetap nyaman di PC pabrik lama dan di HP kepala pabrik.

## Accessibility & Inclusion

- Sebagian pemakai adalah operator pabrik; siapkan **kontras tinggi** dan ukuran target sentuh yang nyaman.
- Aplikasi dipakai dari **HP** (kepala pabrik membaca Report) dan dari **PC lama beresolusi rendah** — layout harus tetap terbaca di keduanya; hindari efek berat dan animasi yang mengganggu.
- Standar formal (WCAG level) belum ditetapkan.
