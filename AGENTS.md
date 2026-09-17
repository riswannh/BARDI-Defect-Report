# AGENTS.md

## Alur Kerja Agent — agent-skills (WAJIB DIBACA SEBELUM MENGERJAKAN FITUR)

Proyek ini memakai paket **`addyosmani/agent-skills`** (25 skill, terpasang di
`.agents/skills/` pada root workspace; disalin ke katalog skill sesi DSH saat boot).

Alur kerjanya mengikuti siklus: **DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP**.
Di DSH tidak ada slash command `/spec` atau `/plan`, jadi **pintu masuknya adalah
mapping intent → skill** di bawah. Kalau sebuah tugas cocok dengan sebuah skill,
skill itu **wajib dijalankan lebih dulu**, bukan diimplementasikan langsung.

| Fase | Tugas | Skill |
|---|---|---|
| Meta | Mulai sesi / bingung skill mana | `using-agent-skills` |
| Define | Permintaan masih kabur | `interview-me`, `grill-me` |
| Define | Baru berupa ide kasar | `idea-refine` |
| Define | Fitur/perubahan baru | `spec-driven-development` |
| Define | Bar belum tertulis | `constraint-driven-development` |
| Plan | Spec sudah ada, perlu dipecah | `planning-and-task-breakdown` |
| Build | Menulis kode (lebih dari satu file) | `incremental-implementation` |
| Build | Pekerjaan UI | `frontend-ui-engineering` |
| Build | Endpoint / kontrak antar modul | `api-and-interface-design` |
| Verify | Menulis atau menjalankan tes | `test-driven-development` |
| Verify | Ada yang rusak / tidak sesuai dugaan | `debugging-and-error-recovery` |
| Review | Sebelum merge | `code-review-and-quality` |
| Review | Kode terlalu rumit | `code-simplification` |
| Review | Menyentuh input pengguna, auth, data | `security-and-hardening` |
| Ship | Commit dan push (selalu) | `git-workflow-and-versioning` |
| Ship | Keputusan arsitektur yang perlu dikenang | `documentation-and-adrs` |
| Ship | Siap deploy | `shipping-and-launch` |

Catatan penting:

- **`browser-testing-with-devtools` belum bisa dipakai** — skill itu butuh Chrome
  DevTools MCP server, dan server itu belum terkonfigurasi di sesi ini. Selama belum
  ada, verifikasi browser dilakukan dengan Chrome headless + `playwright-core`
  (pola yang sudah dipakai proyek ini: instal sementara, screenshot, lalu hapus).
- Skill tambahan yang juga terpasang dan boleh dipakai: `apex`, `impeccable`,
  `make-interfaces-feel-better`, `thermo-nuclear-code-quality-review`, `grilling`.

### Definition of Done (bar proyek ini)

Setiap perubahan wajib lolos bar ini sebelum dianggap selesai. Ini bar tetap —
jangan dinegosiasi ulang per tugas:

**Correctness**
- Kriteria penerimaan tugas terpenuhi.
- Dibuktikan **saat berjalan**, bukan sekadar `tsc` lolos — jalankan aplikasinya dan
  periksa hasilnya (screenshot / respons API / isi database).
- Kasus tepi dan jalur error ikut ditangani, bukan hanya jalur bahagia.

**Quality**
- `npx tsc --noEmit` dan `npx eslint` bersih **di folder `frontend`**.
- Tidak ada kode mati, `console.log` debug, atau blok yang dikomentari.
- Tidak ada `@ts-ignore`, `eslint-disable`, tes yang dihapus, atau assertion yang
  dilonggarkan hanya supaya pemeriksaan hijau. Kalau sebuah pemeriksaan memang harus
  dilonggarkan, tulis alasannya di commit message.
- Perubahan sesuai lingkup tugas; refactor yang tidak diminta jangan ditumpangkan.

**Integration**
- Migrasi database dijalankan dan diverifikasi (proyek ini memakai `drizzle-kit push`);
  **backup dulu** sebelum menyentuh database produksi — lihat catatan SKU sebagai contoh.
- Data lama tetap valid (kolom baru nullable / punya default yang masuk akal).
- Perubahan pada API publik dipertimbangkan dampaknya ke halaman yang memakainya.

**Documentation**
- `README.md` (single source of truth) dan `AGENTS.md` diperbarui bila perilaku,
  skema, atau API berubah.
- Keputusan yang tidak terlihat dari kode dicatat beserta alasannya.

**Ship-readiness**
- Aturan akses ditegakkan **di server**, bukan disembunyikan di UI (ini prinsip inti
  aplikasi: lihat `stripValue` / `stripPoFinance` / `scopedFactoryId`).
- Ada jalur balik: pekerjaan di-commit terpisah supaya bisa di-revert.
- **Menunggu persetujuan manusia** sebelum dianggap selesai untuk perubahan besar.

## Git Workflow (WAJIB)

Setiap selesai mengerjakan perubahan fitur, commit dan push ke git:

1. Jalankan pengecekan di folder `frontend`:
   - `npx tsc --noEmit`
   - `npx eslint`
2. `git add -A`
3. `git commit -m "<pesan deskriptif>"`
4. `git push`

- Repo: https://github.com/riswannh/BARDI-Defect-Report (branch: `main`)
- Gunakan pesan commit yang jelas dan deskriptif.
- Jangan commit file yang di-ignore (`node_modules`, `.next`, settings lokal `.claude`).
- **Shell**: `npm.ps1` diblokir execution policy — jalankan npm lewat `cmd /c`.
  Untuk pesan commit multi-baris pakai `git commit -F <file>`, karena `git commit -m`
  dengan pesan multi-baris pecah bila ada baris diawali `-`.

## Tools

Jika `git` atau `gh` tidak dikenali di PATH, pakai path lengkap:

- Git: `C:\Program Files\Git\cmd\git.exe`
- GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe`

## Alur Kerja: Development vs Docker (PENTING)

- **Development (default)**: jalankan `npm run dev` di folder `frontend/`. **JANGAN** build image Docker setiap ada perubahan — build memakan waktu lama.
- **Docker**: hanya build/up saat semua fitur sudah final atau siap deploy: `docker compose up -d --build`.
- Development memakai database yang sama dengan Docker: `frontend/.env` → `DB_FILE_NAME=../data/sqlite.db`
- Jangan jalankan dev server dan container Docker bersamaan (port 3000 bentrok) — stop salah satu.

## Docker

- `docker compose up -d --build` — build & jalankan app di http://localhost:3000
- `docker compose logs -f` — lihat log; `docker compose down` — stop
- Data SQLite tersimpan di `./data/sqlite.db` (bind mount, tidak di-commit)
- Env root `.env` (contoh: `.env.example`): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- Saat start container menjalankan `drizzle-kit push --force` + seed (idempotent) lalu `next start`
- Dockerfile di `frontend/Dockerfile` (image `bardi-defect-report:latest`)

## Struktur Project

- `PRD.md` — dokumen kebutuhan produk (Web Analisa Defect dan Sales Produk)
- `frontend/` — aplikasi Next.js 16 (App Router, Tailwind v4, Base UI, Recharts)

## Backend (di `frontend/`)

- **Stack**: Next.js Route Handlers + Drizzle ORM + SQLite (better-sqlite3) + Better Auth + SheetJS (xlsx)
- **Env** (`.env`, tidak di-commit): `DB_FILE_NAME`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- **Perintah**:
  - `npm run db:push` — sinkronkan schema ke SQLite
  - `npm run db:seed` — isi data awal (idempotent, skip jika sudah ada data)
- **Kredensial seed**: `admin/admin123`, `pabrik_jkt/pabrik123`, `pabrik_sby/pabrik123`, `pabrik_bdg/pabrik123`
- **Struktur**:
  - `src/lib/db/schema.ts` — tabel (auth + factories/products/problems/statuses/defects/sales)
  - `src/lib/db/index.ts` — koneksi Drizzle
  - `src/lib/auth.ts` — konfigurasi Better Auth (username plugin, field `isAdmin` & `factoryId`)
  - `src/lib/api/*` — guard role, validasi zod, CRUD, report, Excel
  - `src/app/api/*` — route handlers
- **Aturan akses**: Admin bisa semua; role Pabrik hanya data pabriknya & field `value` dihapus dari
  respons. Untuk PO Product, field yang dihapus lebih banyak — lihat bagian PO Product di bawah.
- **Daftar pabrik (`GET /api/factories`) di-scope untuk role Pabrik**: mereka hanya menerima baris
  pabriknya sendiri. Header memang butuh satu nama pabrik, dan pemilih pabrik hanya ada di halaman
  admin, jadi daftar lengkap tidak perlu bocor. Admin tetap menerima seluruh daftar.
- **Produk punya `sku` (unik, opsional/nullable)** di samping `name`. Master lain hanya nama.
  - Handler master bercabang per tabel di `insertMaster`/`updateMaster` (`master.ts`) supaya
    TypeScript menyempitkan tipe — satu objek nilai gabungan tidak akan lolos type check
    karena hanya `products` yang punya kolom `sku`.
  - SKU kosong dinormalkan jadi `null` oleh `normalizeSku()`; beberapa `NULL` tidak bentrok pada
    constraint UNIQUE SQLite, jadi produk tanpa SKU tetap valid.
  - Excel: `template-produk.xlsx` dan ekspor `produk.xlsx` memakai kolom `Nama` + `SKU`;
    impor melewati baris dengan SKU yang sudah dipakai (termasuk bentrok antar-baris di berkas
    yang sama) dengan alasan "SKU sudah dipakai". Master lain tetap satu kolom `Nama`.
- **Excel**: `GET /api/excel/{module}/export`, `POST /api/excel/{module}/import`, `GET /api/excel/{module}/template` (module: products, problems, statuses, factories, defects, sales, users, purchase-orders)
- **PO Product** (`/po`, modul `purchase-orders`) — lihat `SPEC-po-product.md` untuk spec lengkapnya:
  - Tabel `purchase_orders`: `poNumber` (boleh berulang), `poDate` (tanggal PO, DIISI MANUAL, format
    `YYYY-MM-DDTHH:mm`), `productId`, `factoryId`, `quantity`, `pricePerPcs` (real, boleh pecahan),
    `value` (real, = pricePerPcs × quantity), `currency` (Rp/USD/RMB), `ppn`, `keterangan` (teks).
  - **TIDAK ADA `UNIQUE`** dan tidak ada validasi duplikat di POST/PATCH — user memutuskan satu PO
    Number boleh diinput berkali-kali termasuk produk yang sama. Jangan tambahkan constraint itu.
  - `value` **selalu dihitung ulang di server**; angka `value` dari klien diabaikan.
  - Role Pabrik: `pricePerPcs`, `value`, `currency`, dan `ppn` dihapus dari respons oleh
    `stripPoFinance()`, dan `scopedFactoryId()` memaksa filter pabriknya. Halaman memakai
    **AuthGuard** (bukan AdminGuard) supaya Pabrik bisa membukanya read-only.
  - `ppn` berisi `PPN` atau `Non PPN` (dinormalkan `normalizePpn()`), **hanya penanda** dan
    TIDAK ikut dihitung ke `value`. Kolomnya hanya tampil untuk admin, juga di ekspor Excel.
  - SKU **tidak** disimpan di baris PO (melekat pada `products.sku`); form menampilkan satu dropdown
    Product berisi nama produk saja, tanpa isian SKU terpisah.
  - Keterangan **bukan master** dan tidak punya tabel/API/tab sendiri: ketiga nilainya di-hardcode di
    `KETERANGAN_OPTIONS` (`validation.ts`) — `Product Order`, `Sparepart Order`, `Replacement` — dan
    baris PO menyimpannya sebagai **teks** `keterangan` (default `Product Order`). Nilai di luar daftar
    dinormalkan ke default saat POST/PATCH; pada impor Excel barisnya ditolak dengan alasan.
    Jangan menghidupkan lagi tabel/CRUD keterangan tanpa keputusan baru dari user.
  - Filter: `factoryId`, `productId`, `keterangan` (teks), `month`, `year` (memakai `poDate`), `search`.
- **JEBAKAN zod yang pernah merusak data**: `schema.partial()` TIDAK melepas `.default()`. Pola
  `z.object({ quantity: z.coerce.number().default(0) }).partial()` tetap mengisi `0` untuk field
  yang tidak dikirim, sehingga PATCH satu field menulis `0` ke field berdefault lainnya — pernah
  menghapus `quantity` dan `value` sebuah defect hanya karena problemDetail-nya diubah. Karena itu
  schema update dibangun lewat `buildUpdate(fields)` di `validation.ts`, yang memasang `.optional()`
  di luar transform dan tanpa default. Jangan kembali memakai `SomeSchema.partial()` untuk update.
- **Harga produk (`product_prices`)** — master harga per produk per bulan+tahun, **selalu Rupiah**,
  dikelola di tab **Harga Produk** pada Data Master (`/api/product-prices`). Unik pada
  `(productId, year, month)`: harga lama TIDAK ditimpa, perubahan harga = baris baru untuk periode
  berikutnya. `month` disimpan dua digit (`"01"`..`"12"`) supaya bisa diurutkan sebagai teks.
  - Baris PO menyimpan **rujukan** `productPriceId` (bukan salinan angka), jadi menambah harga baru
    tidak mengubah nilai PO lama. Server mengisi rujukan itu otomatis dari bulan/tahun `poDate`
    kalau operator tidak memilih; kalau produk belum punya harga di periode itu, rujukannya NULL dan
    **PO tetap boleh disimpan** (Value RW dikosongkan, ditampilkan `-`).
  - **Value RW** = `quantity × harga master`, kolom terpisah dari `value`/Total (yang mata uangnya
    bisa USD/RMB). Ikut dihapus untuk role Pabrik bersama `pricePerPcs`/`value`/`currency`/`ppn` —
    lihat `stripPoFinance()`; `productPriceMonth`/`Year` ikut dibuang karena hanya bermakna bersama
    nominalnya.
  - `POST /api/product-prices/carry-forward` menyalin harga dari periode terakhir sebelum periode
    tujuan (bukan hanya bulan tepat sebelumnya) dan melewati yang sudah ada — dipakai untuk
    pergantian bulan tanpa mengetik ulang semua produk.
  - Menghapus harga yang masih dirujuk baris PO ditolak **409**.
- **Tracing import**: respons import berisi `errors[]` & `skippedDetails[]` (baris, data, alasan) → ditampilkan di dialog `ImportResultDialog`, bisa diunduh CSV, dan dicatat di log server dengan prefix `[import:{module}]`
- **Hapus semua data**: `DELETE /api/{module}` (admin only) — backup otomatis `backup-{module}-{timestamp}.db` dibuat dulu di folder data; master data gagal dihapus (409) jika masih dipakai defect/sales; hapus semua users mengecualikan akun sendiri
- **Import users**: pabrik yang belum ada otomatis dibuat; username boleh berisi spasi (validator custom), email disintesis `<username>@pabrik.local`

## Konvensi Aplikasi

- Bahasa UI: Indonesia (i18n: Indonesia/English/中文)
- Auth: Better Auth session cookie via `src/lib/auth-client.ts`; frontend fetch API di `src/lib/api-client.ts` + hook `src/lib/use-api.ts`
- Kredensial seed: `admin/admin123`, `pabrik_jkt/pabrik123`, `pabrik_sby/pabrik123`, `pabrik_bdg/pabrik123`
- Value (IDR) hanya tampil untuk role admin (dihapus dari respons API untuk role pabrik)
- Data defect pakai timestamp lengkap (tanggal + jam); data sales per bulan (avg per hari untuk chart harian/mingguan/rentang)
- Halaman Report mengambil data dari `GET /api/report` (recap + buckets + totals dihitung di server)

## Frontend (Base UI) — JEBAKAN YANG SUDAH TERJADI

Ditulis dari bug nyata, bukan teori. Baca sebelum menyentuh `src/components/ui/` atau form.

- **JANGAN memberi `key` yang berubah mengikuti status buka/tutup pada daftar item
  Select.** `SelectSearch` di `src/components/ui/select.tsx` pernah memakai
  `key={open ? "open" : "closed"}`. Saat popup ditutup, daftar item di-unmount,
  Base UI melaporkan peta item kosong lewat `SelectPositioner.onMapChange`, dan
  nilai yang baru dipilih **direset ke null**. Gejalanya: `onValueChange` dipanggil
  dua kali (`"2"` lalu `null`), trigger menampilkan teks `null`, dan data tidak
  pernah tersimpan. Bug ini membuat semua dropdown di form tidak bisa diisi.
  Kotak pencarian tetap ter-reset sendiri karena di-unmount bersama popup.
- **Jangan meng-unmount item Select saat memfilter** — pakai class `hidden`
  (lihat `SelectSearch`). Meng-unmount item memicu reset nilai yang sama.
- `Select.Value` menampilkan nilai mentah kecuali `Select.Root` diberi prop
  `items` (value + label).
- Saat popup terbuka, Base UI menangkap tombol karakter (typeahead); input
  pencarian perlu `event.stopPropagation()` untuk `event.key.length === 1`.
- `DropdownMenuLabel` harus dibungkus `DropdownMenuGroup`.
- **`DialogContent` jangan dibiarkan memakai kolom grid `auto`.** Popup-nya memakai
  `grid`; tanpa kolom eksplisit kolomnya `auto`, sehingga melebar mengikuti isi yang
  tidak bisa membungkus — `SelectTrigger` ber-`whitespace-nowrap` dengan nama pabrik
  panjang membuat isi dialog **meluber keluar kartu** (dialog 448px, isinya 499px).
  Gejala yang dilaporkan di halaman Sales: "kartu tidak full dan text box offset".
  Perbaikannya `grid-cols-1` + `min-w-0` di popup, ditambah `min-w-0` pada
  `SelectTrigger` dan `SelectValue` supaya teks panjang menyusut lalu terpotong
  elipsis. Jangan dihapus tanpa menggantinya dengan pengunci lebar lain.
- **`onOpenChange` pada `Dialog` bukan tempat untuk navigasi.** Di halaman Sales dulu
  `open === false` memanggil `advanceEdit()`, yang langsung `return` ketika antrean
  edit kosong — akibatnya dialog form TAMBAH **tidak bisa ditutup sama sekali** (klik X
  maupun Escape tidak bereaksi), dan pada mode edit X berpindah ke baris antrean
  berikutnya alih-alih menutup. Pindah antrean hanya untuk SETELAH SIMPAN berhasil.
  (Halaman Defects memakai pola serupa tapi aman karena antrean editnya berisi satu
  baris; perilaku "X lanjut ke data berikutnya" di sana memang disengaja.)
- `useApi` mengosongkan data saat URL berubah (loading) — untuk daftar yang harus
  stabil (mis. pabrik di Report), fetch terpisah dari endpoint master.

### Struktur halaman Defect

`src/app/(dashboard)/defects/` sengaja dipecah; jangan dikembalikan jadi satu file:

- `page.tsx` — data, filter, paging, seleksi, handler API
- `defect-form-dialog.tsx` — dialog tambah/ubah (autofocus, Ctrl+Enter, simpan & tambah lagi)
- `defect-detail-dialog.tsx` — dialog detail read-only
- `defect-form.ts` — tipe, `emptyForm()`, `carryOverForm()`, saran kode garansi

### Struktur halaman Report

`src/app/(dashboard)/report/` juga dipecah:

- `page.tsx` — filter periode, kartu ringkasan, tabel rekap, penyusun grafik
- `report-charts.tsx` — potongan grafik bersama: `MetricBarChart` (batang defect/sales,
  qty/value), `PieWithLegend`, `ChartPairCard`, `RatioBadge`, `buildPieData`,
  `PIE_COLORS`. Empat kartu grafik halaman ini dulu ditulis ulang hampir identik;
  perubahan grafik cukup dilakukan di sini.
- `report-data.ts` — tipe `ReportResponse`/`RecapRow`, `sortRecap()`,
  `defectSalesRatio()`
- `product-detail-dialog.tsx` — dialog detail per produk; menghitung sendiri data
  turunannya dari respons `/api/report`

Catatan perilaku Report yang harus dijaga:

- Grafik **sales selalu tahunan** (12 bulan) dan pie-nya memakai `salesYearlyRecap`,
  terlepas dari periode yang dipilih.
- Grafik defect memakai `buckets` (mengikuti periode) dan pie-nya memakai `recap`.
- Ringkasan, bucket, dan total dihitung **di server** (`GET /api/report`) — jangan
  pindahkan perhitungan itu ke klien.
- Daftar pabrik diambil dari `/api/factories`, bukan dari respons report, supaya
  dropdown tidak berkedip kosong setiap periode berganti.
- Kartu **Replacement** menghitung **qty PO berketerangan `Replacement`** pada periode terpilih.
  Datanya dari `GET /api/report` (`totals.replacementQty` dan `replacementPos`), dicocokkan dengan
  `matchesDefectPeriod` karena `poDate` berformat sama dengan timestamp defect. Role Pabrik menerima
  qty-nya tetapi baris PO-nya tanpa `pricePerPcs`/`value`/`currency`.

### Aturan alur input defect

- Timestamp entri baru = waktu sekarang (`localDateTimeValue()`), bukan konstanta.
- **Simpan & tambah lagi**: Produk + Pabrik + Status dibawa ke entri berikutnya,
  sisanya dikosongkan. Tanpa ini operator mengulang pilihan yang sama tiap entri.
- Saran kode garansi (`suggestNextCode`) membaca prefiks dari **kode yang sudah ada
  di pabrik itu** (mis. `WJKT-`), bukan dari nama pabrik — nama "Pabrik Jakarta"
  akan menghasilkan `WPAB-` yang tidak cocok dengan riwayat data.
- Menutup dialog yang masih berisi isian harus dikonfirmasi (`ConfirmDialog`).

### Layout responsif

- `Sidebar` tetap (240px) hanya tampil di `lg` ke atas. Di bawah itu navigasi
  pindah ke `Sheet` (`src/components/ui/sheet.tsx`) yang dibuka tombol menu di
  header. Sebelumnya sidebar memakan ~61% lebar HP 390px sehingga konten tidak terbaca.
- Halaman dashboard wajib bebas overflow horizontal di 390px.
