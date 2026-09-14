# AGENTS.md

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
- **Aturan akses**: Admin bisa semua; role Pabrik hanya data pabriknya & field `value` dihapus dari respons
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
- **Excel**: `GET /api/excel/{module}/export`, `POST /api/excel/{module}/import`, `GET /api/excel/{module}/template` (module: products, problems, statuses, factories, defects, sales, users)
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
