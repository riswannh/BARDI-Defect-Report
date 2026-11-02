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
- Panduan pengguna per modul ada di `docs/` (mis. `docs/TUTORIAL-task-planner.md` untuk
  Rencana Kerja). Bila perilaku UI modul tersebut berubah, perbarui panduannya juga,
  bukan hanya README.
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
  - `src/lib/db/schema.ts` — tabel (auth + factories/products/problems/statuses/defects/sales/purchase_orders + spare_parts/product_spare_parts/spare_part_prices)
  - `src/lib/db/index.ts` — koneksi Drizzle
  - `src/lib/auth.ts` — konfigurasi Better Auth (username plugin, field `isAdmin` & `factoryId`)
  - `src/lib/api/*` — guard role, validasi zod, CRUD, report, Excel
  - `src/app/api/*` — route handlers
- **Aturan akses**: Admin bisa semua; role Pabrik hanya data pabriknya & field `value` dihapus dari
  respons. Untuk PO Product, field yang dihapus lebih banyak — lihat bagian PO Product di bawah.
- **Daftar pabrik (`GET /api/factories`) di-scope untuk role Pabrik**: mereka hanya menerima baris
  pabriknya sendiri. Header memang butuh satu nama pabrik, dan pemilih pabrik hanya ada di halaman
  admin, jadi daftar lengkap tidak perlu bocor. Admin tetap menerima seluruh daftar.
- **Produk dan sparepart punya `sku` (unik per tabel, opsional/nullable)** di samping `name`.
  Master lain hanya nama.
  - Handler master bercabang per tabel di `insertMaster`/`updateMaster` (`master.ts`) supaya
    TypeScript menyempitkan tipe — satu objek nilai gabungan tidak akan lolos type check
    karena hanya `products` dan `spareParts` yang punya kolom `sku`.
  - SKU kosong dinormalkan jadi `null` oleh `normalizeSku()`; beberapa `NULL` tidak bentrok pada
    constraint UNIQUE SQLite, jadi produk tanpa SKU tetap valid.
  - SKU **unik hanya di dalam tabelnya sendiri**: SKU sparepart boleh sama dengan SKU produk, dan
    pesan 409 menyesuaikan tabelnya (`skuOwner()` di `master.ts`).
  - Excel: `template-produk.xlsx`/`produk.xlsx` dan `template-sparepart.xlsx`/`sparepart.xlsx`
    memakai kolom `Nama` + `SKU`; impor melewati baris dengan SKU yang sudah dipakai (termasuk
    bentrok antar-baris di berkas yang sama) dengan alasan "SKU sudah dipakai". Master lain tetap
    satu kolom `Nama`.
- **Excel**: `GET /api/excel/{module}/export`, `POST /api/excel/{module}/import`, `GET /api/excel/{module}/template`
  (module: products, spareparts, problems, factories, defects, sales, users, purchase-orders,
  `prices`, `sparepart-prices`).
  - **Harga Produk / Harga Sparepart** (`prices`, `sparepart-prices`) — kolom `Produk` + `Jenis Harga` +
    `Bulan` + `Tahun` + `Harga`, dan `Sparepart` + `Bulan` + `Tahun` + `Harga`. Impor mencocokkan **nama**
    ke Data Master Produk/Sparepart (`trim().toLowerCase()`); nama tak dikenal **ditolak dengan alasan**,
    master TIDAK dibuat otomatis. `Jenis Harga` kosong → `DEFAULT_PRICE_TYPE`; jenis asing, bulan/tahun
    tidak valid, dan harga bukan angka juga ditolak. Duplikat (produk+jenis+tahun+bulan /
    sparepart+tahun+bulan) dilewati. Impor kedua modul ini **admin saja** (`requireAdmin()`), ekspor dan
    template mengikuti aturan role umum. Setelah impor UI memuat ulang daftar harga
    (`reloadPrices()`; tab Harga Sparepart lewat prop `reloadToken`).
  - **Jebakan SQLite**: `month`/`year` bertipe TEXT, jadi parameter **angka** pada `where year = ?`
    tidak cocok (`eq(productPrices.year, 2027)` gagal) — selalu ikat sebagai string.
- **Google Sheet tab "Big Data" itu READ-ONLY (WAJIB)** — kolom A:H diisi `=ARRAYFORMULA('Raw CX Data'!A1:H)` (sebagian lewat IMPORTRANGE), jadi menulis ke sana merusak feed-nya. Pernah kejadian 24 Sep 2026: uji izin tulis menimpa sel `A1` dan menghapus formulanya (header A:H jadi kosong), harus ditulis ulang manual. **JANGAN menambahkan jalur tulis lain ke sheet ini** — satu-satunya penulisan yang diizinkan adalah kolom **`Problem` (J)**: `records.ts` mencatat setiap perubahan Problem ke `defect_problem_log` (`logProblemChange`), lalu `pushProblemChanges()` di `src/lib/api/gsheet.ts` mengirim nilai terakhir saat sync dan menandai log `pushedAt`/`sheetRow`. `src/lib/gsheet/values.ts` hanya boleh punya `batchUpdateValues()` yang dijaga `assertWritableRange()` (menolak range selain satu kolom di luar A–H). Selebihnya fitur sync tetap **sheet → app**: `src/lib/gsheet/sync.ts` (logika murni, termasuk `planProblemPushes`), `src/lib/api/gsheet.ts` (endpoint admin `/api/defects/gsheet/sync` dan `/resolve`), self-check `npx tsx scripts/gsheet-sync-check.ts`, uji ujung-ke-ujung tanpa Google `npx tsx scripts/problem-push-check.ts`, dan UI `src/components/gsheet-sync-dialog.tsx`. Jangan pernah menguji tulis ke sheet produksi — pakai `fetch` tiruan seperti di `problem-push-check.ts`. Header sheet live sekarang `Status` (dulu `Status Defect`) dan **keduanya diabaikan** sejak 1 Nov 2026: `statusId` sudah tidak ada di `GSHEET_FIELDS`, `SHEET_ALIASES` sudah dihapus dari `src/lib/gsheet/mapping.ts`, dan Status juga hilang dari UI Defect & Data Master (keputusan user "status di google sheet ignored dan status di aplikasi hapus di defect dan di master"). Kolom DB `defects.statusId` sengaja tetap `NOT NULL` (drop kolom = migrasi ulang tabel defect yang pernah menjatuhkan produksi); semua jalur insert mengisinya lewat `defaultStatusId()` di `src/lib/api/defect-status.ts`. Jangan menghidupkan lagi status di sheet/UI tanpa keputusan baru. **Kolom `Pabrik` juga sudah dihapus dari sheet** (1 Nov 2026, alasan user: "pakai patokan yg ada di user management"): `factoryId` keluar dari `GSHEET_FIELDS`/`SHEET_COLUMN`/`FIELD_LABEL`, baris baru mengambil pabrik dari kaitan **produk → pabrik** (`product_factories`, dikelola di User Management › Daftar Pabrik) lewat `masters.productFactory`, dan baris di-skip dengan issue kalau produk belum punya kaitan pabrik — form Defect tetap menampilkan dropdown Pabrik yang terisi otomatis dan masih boleh diubah manual. Kolom formula juga **dikunci di sheet** (Protected ranges A:I + K:M, 1 Nov 2026, dipasang `frontend/scripts/gsheet-protect-formulas.ts`); hanya `Problem` (J) yang terbuka untuk edit manual, jadi jangan menambah proteksi/longgarkan proteksi ke kolom formula. **Kolom `Value` tab ini sudah tidak dibaca** (12 Okt 2026 user memindahkannya ke kolom paling kanan, O): nilai defect dihitung server dari Price List lewat `defectValueFromMaster()` (`src/lib/defect-value.ts`) — dipakai saat insert baris baru DAN untuk menghitung ulang seluruh baris di akhir tiap sync (baris yang nilainya beda diperbarui, jumlahnya dilaporkan sebagai issue "… baris nilainya disesuaikan ke harga Price List"), serta oleh impor Excel defect (`src/lib/api/excel.ts`, kolom `Value` berkas hanya cadangan bila produk belum punya harga). Produk tanpa baris harga → nilai lama dipertahankan (fungsi mengembalikan `null`). Karena itu jangan menambahkan `"value"` kembali ke `GSHEET_FIELDS`/`SHEET_COLUMN`/`FIELD_LABEL` di `src/lib/gsheet/mapping.ts`. Tab **"Data Penjualan"** (sync menu Sales, `src/lib/gsheet/sales-mapping.ts` + `sales-sync.ts`, endpoint `/api/sales/gsheet/sync` & `/resolve`, self-check `npx tsx scripts/gsheet-sales-check.ts`) juga read-only — bentuknya tabel lebar (1 baris = 1 produk, 12 pasang kolom QTY/Value) dan SEMUA sel datanya rumus `=INDEX('Raw Penjualan'!…)`. Aturannya: kunci app = produk + pabrik + bulan, acuan produk kolom **Official Name**, pabrik kolom **Factory**, bulan `"January 2026"` → `Jan`, dan bulan yang di sheet 0 semua TIDAK dibuatkan baris di app (keputusan user). **Nama Problem default saat selnya kosong adalah `-`** (keputusan user 1 Nov 2026, bukan teks "Kosong"): `NAME_DEFAULT.problemId = "-"` + `PROBLEM_ALIASES = { kosong: "-" }` di `src/lib/api/gsheet.ts`, dan impor Excel memakai default yang sama; baris lama bernama "Kosong" sudah di-rename jadi `-` di DB produksi, jadi jangan menghapus alias itu selama sheet lama masih dipakai.
- **Terjemahan Problem Detail: ON-DEMAND lewat Google Sheet user (1 Nov 2026)** — keterangan kendala disimpan dalam DUA bahasa: `defects.problemDetailOriginal` = teks asli Indonesia (dari sheet/operator), `defects.problemDetail` = versi Inggris. **Sync TIDAK menerjemahkan apa pun** dan **simpan defect juga TIDAK menerjemahkan**: yang diketik operator disimpan apa adanya. Versi bahasa lain dimuat saat operator menekan switch **ID/EN** di popup Detail Defect → `POST /api/defects/[id]/translate` (`src/app/api/defects/[id]/translate/route.ts`) → `translateDefectDetail()` di `src/lib/api/defect-detail.ts` → `translateWithSheet()` di `src/lib/translate-sheet.ts`, lalu HASILNYA DISIMPAN ke DB; pembukaan berikutnya langsung dari DB. Modul sheet mencari blok `Indonesia > Inggris` / `Indonesia < Inggris` / `Indonesia > China` / `Indonesia < China` + header `Asli`/`Translate`, menulis teks ke baris kosong pertama kolom A + formula `=GOOGLETRANSLATE(...)` di kolom B (USER_ENTERED), polling B 350 ms sampai 20 detik, lalu SELALU `values:clear` A:B — sheet user tidak boleh ditinggali data. Permintaan diserialkan (satu baris kerja), hasilnya di-cache di `translation_cache` (PK = sha1 16 dari `from\0to\0teks`). Env: `TRANSLATE_SHEET_ID` (default `1hLUyO1T9HdUtHonWGkM0Dpim9BhHs8zYT-M0mLvslSw`), `TRANSLATE_SHEET_TAB` (default `Sheet1`). Hasil yang jelas rusak (kosong, hanya tanda baca, atau error formula `#VALUE!`) ditolak `isUsableTranslation()` dan dicoba ulang sekali. **LibreTranslate sudah TIDAK dipakai**: `src/lib/translate.ts`, route `/api/translate`, service `libretranslate` di kedua compose, dan volume `libretranslate_models` sudah DIHAPUS — jangan menghidupkan lagi tanpa keputusan baru. Kolom `Translate` lama di sheet "Big Data" tetap tidak dibaca (`SHEET_COLUMN.problemDetailOriginal` = `Keterangan Kendala`). Self-check: `npx tsx scripts/translate-sheet-check.ts`.
- **Problem Detail dua bahasa + Edit/Delete di popup** — switch **ID/EN** ada di form defect dan di popup Detail Defect; bahasa awalnya `useLanguage().language` (default `id`), dan tiap kali dialog dibuka ulang komponennya di-remount lewat `key` (`key={editingId ?? "new"}` untuk form, `key={detailDefect?.id ?? "none"}` untuk detail) — JANGAN menyelaraskan bahasa lewat `useEffect`/`setState` di effect, aturan `react-hooks/set-state-in-effect` (React Compiler) menolaknya. Form hanya menyimpan apa yang diketik; kalau `problemDetailOriginal` berubah tanpa `problemDetail` baru, PATCH mengosongkan versi Inggris lama (`staleEnglish` di `src/lib/api/records.ts`) supaya tidak menyesatkan. Tombol **Ubah** dan **Hapus** defect pindah dari kolom aksi tabel ke footer popup Detail Defect (admin); tabel defect tidak punya kolom aksi lagi (`colSpan` baris kosong = 9 admin / 7 non-admin). Popup itu juga dipakai halaman Report — footer hanya muncul kalau `onEdit`/`onDelete` diberikan. Modul Excel membawa kolom tambahan **Keterangan Kendala** (Indonesia) di samping `Problem Detail` (Inggris); impor memakai nilainya apa adanya tanpa terjemahan.
- **Diagnostik klien**: `POST /api/client-errors` (route `src/app/api/client-errors/route.ts`) mencatat
  kegagalan jaringan dari browser ke `<folder database>/client-errors.log`. Hanya user login yang boleh
  menulis dan tiap kolom dipotong panjangnya — tanpa itu siapa pun bisa membanjiri berkas log. (module: products, problems, factories, defects, sales, users, purchase-orders)
- **PO Product** (`/po`, modul `purchase-orders`) — lihat `SPEC-po-product.md` untuk spec lengkapnya:
  - Tabel `purchase_orders`: `poNumber` (boleh berulang), `poDate` (tanggal PO, DIISI MANUAL, format
    `YYYY-MM-DDTHH:mm`), `productId`, `factoryId`, `quantity`, `pricePerPcs` (real, boleh pecahan),
    `value` (real, = pricePerPcs × quantity), `currency` (Rp/USD/RMB), `ppn`, `keterangan` (teks),
    dan `priceType` (text, notNull, default `"Regional Warehouse"`) = jenis harga master yang dipakai
    baris itu.
  - **TIDAK ADA `UNIQUE`** dan tidak ada validasi duplikat di POST/PATCH — user memutuskan satu PO
    Number boleh diinput berkali-kali termasuk produk yang sama. Jangan tambahkan constraint itu.
  - `value` **selalu dihitung ulang di server**; angka `value` dari klien diabaikan.
  - **Jenis harga di form PO**: dropdown **Jenis Harga** diletakkan DI ATAS dropdown **Harga**; memilih
    jenis mengisi ulang daftar harga dan langsung memilih harga yang cocok. POST memakai
    `normalizePriceType(priceType) ?? DEFAULT_PRICE_TYPE` lalu mencari rujukan lewat
    `findProductPriceId(productId, poDate, priceType)`; PATCH **mencari ulang** rujukan itu bila
    produk/tanggal/jenis berubah dan operator tidak memilih sendiri (jenis tersimpan bila field-nya
    tidak dikirim). Jenis yang belum punya harga di periode itu → rujukan NULL, PO tetap boleh
    disimpan.
  - Role Pabrik: `pricePerPcs`, `value`, `currency`, `ppn`, dan `priceType` dihapus dari respons oleh
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
- **Kaitan produk → pabrik (`product_factories`)** — dikelola di **User Management › Daftar Pabrik**
  (tombol ikon di tiap baris, komponen `users/factory-products-dialog.tsx`, prop `onLink` di
  `master-list.tsx`). `productId` adalah **primary key**, jadi satu produk hanya boleh terikat satu
  pabrik; memilih produk di pabrik lain berarti memindahkannya (server meng-upsert di
  `POST /api/factories/{id}/products` di dalam satu transaksi: hapus kaitan pabrik ini lalu pasang
  yang dicentang). Tujuannya **terbalik dari tebakan awal**: di form **Defect / PO / Sales**, memilih
  produk otomatis mengisi kolom **Pabrik** dari kaitan itu (kalau produk belum punya kaitan, kolom
  Pabrik dibiarkan apa adanya, dan operator tetap boleh mengubahnya manual). Supaya form tidak perlu
  permintaan tambahan, `GET /api/products` sekarang di-left-join ke tabel ini dan ikut mengirim
  `factoryId`.
- **Sparepart (`spare_parts` + `product_spare_parts` + `spare_part_prices`)** — sparepart adalah
  **child dari produk**, tetapi kaitannya **many-to-many**: satu sparepart boleh dipakai beberapa
  produk sekaligus (permintaan eksplisit user). Karena itu `product_spare_parts` ber-PK komposit
  `(productId, sparePartId)` dan **TIDAK ada aturan pindah** seperti `product_factories` —
  mengaitkan di produk B tidak melepasnya dari produk A.
  - Dikelola dari sisi **produk**: tombol ikon di tab Produk (Data Master) membuka
    `master/product-spare-parts-dialog.tsx` (prop `onLink`/`linkLabel`/`linkIcon` di
    `master-list.tsx`), endpoint `GET`/`POST /api/products/{id}/spare-parts`. POST mengganti seluruh
    kaitan produk itu dalam satu transaksi, dan id produk/sparepart asing ditolak **422 sebelum
    transaksi** supaya tidak meledak jadi 500 FOREIGN KEY.
  - Tab **Sparepart** di Data Master tidak punya tombol kaitkan — arah kaitan hanya dari produk,
    supaya tidak menyesatkan. Yang ada tombol **Lihat produk pemakai**
    (`master/sparepart-products-dialog.tsx`) untuk melihat produk mana saja yang memakai satu
    sparepart; datanya dari `productNames` di `GET /api/spare-parts`, jadi tanpa fetch tambahan.
  - Badge "Dipakai juga oleh …" di dialog kaitan produk sudah **dihapus** (permintaan user
    2 Okt 2026): nama produk panjang bikin baris jelek, dan informasi pemakai sekarang ada di
    dialog produk pemakai pada tab Sparepart.
  - Dialog kaitan **hanya memilih** dari master yang sudah ada: `product-spare-parts-dialog.tsx`
    tidak lagi bisa menambah sparepart baru, begitu juga `users/factory-products-dialog.tsx`
    yang tidak lagi bisa menambah produk baru (permintaan user 2 Okt 2026). Master baru dibuat
    lewat tab-nya masing-masing di Data Master.
  - Harga sparepart **global per sparepart per periode** (`spare_part_prices`, unik
    `(sparePartId, year, month)`, tab **Harga Sparepart**, endpoint `/api/spare-part-prices` +
    `/carry-forward`). Logika periode dipakai bersama harga produk lewat
    `src/lib/api/price-period.ts` (`lastPriceBefore`, `carryForwardMessage`) — jangan diduplikasi.
  - `spare_part_prices.sparePartId` sengaja **tanpa cascade** (harga tidak boleh hilang diam-diam):
    menghapus sparepart yang masih punya harga ditolak 409, begitu juga hapus-semua tab Sparepart.
  - Belum masuk form PO/Sales/Defect dan tidak ikut sync Google Sheet — menunggu keputusan baru.
- **Harga produk (`product_prices`)** — master harga per produk per **jenis** per bulan+tahun,
  **selalu Rupiah**, dikelola di tab **Harga Produk** pada Data Master (`/api/product-prices`).
  - **Jenis harga** = 7 nilai tetap, DI-HARDCODE mengikuti kolom spreadsheet user: `Website`,
    `Reseller`, `Key Account`, `Buyback`, `Collection Point`, `Experience Store`,
    `Regional Warehouse`. Didefinisikan di `PRICE_TYPES` (`src/lib/api/validation.ts`) bersama
    `DEFAULT_PRICE_TYPE = "Regional Warehouse"` dan `normalizePriceType()` (nilai tak dikenal/kosong
    → `null`, pemanggil memakai default). Jenis ini **bukan master** — tidak ada tabel, endpoint
    CRUD, maupun tab Data Master untuknya; jangan diubah jadi CRUD tanpa keputusan baru user.
  - Kolom `priceType` (text, notNull, default `"Regional Warehouse"`). Unik pada
    **(productId, priceType, year, month)**: satu produk boleh punya beberapa jenis harga di periode
    yang sama, dan harga lama TIDAK ditimpa — perubahan harga = baris baru untuk periode berikutnya.
    Jadi pesan 409-nya menyebut jenis harganya (`Harga {priceType} produk ini untuk {month}/{year}
    sudah ada…`). Index baru `product_prices_type_idx` pada `(priceType, year, month)`. Baris lama
    otomatis jadi `Regional Warehouse` karena `drizzle-kit push` mengisi default. `month` disimpan
    dua digit (`"01"`..`"12"`) supaya bisa diurutkan sebagai teks.
  - Baris PO menyimpan **rujukan** `productPriceId` (bukan salinan angka), jadi menambah harga baru
    tidak mengubah nilai PO lama. Server mengisi rujukan itu otomatis dari **bulan/tahun `poDate` +
    `priceType`** kalau operator tidak memilih; kalau produk belum punya harga jenis itu di periode
    itu, rujukannya NULL dan **PO tetap boleh disimpan** (Value dikosongkan, ditampilkan `-`).
  - **Value** = `quantity × harga master`, kolom terpisah dari `value`/Total (yang mata uangnya
    bisa USD/RMB). Ikut dihapus untuk role Pabrik bersama `pricePerPcs`/`value`/`currency`/`ppn`/
    `priceType` — lihat `stripPoFinance()`; `productPriceMonth`/`Year` ikut dibuang karena hanya
    bermakna bersama nominalnya.
  - `POST /api/product-prices/carry-forward` menyalin harga dari periode terakhir sebelum periode
    tujuan (bukan hanya bulan tepat sebelumnya) dan melewati yang sudah ada — dipakai untuk
    pergantian bulan tanpa mengetik ulang semua produk. Penyalinannya **per pasangan produk + jenis
    harga** (kunci `${productId}|${priceType}`), jadi harga Website dan harga Reseller sebuah produk
    boleh datang dari periode yang berbeda. `GET /api/product-prices` menerima filter `?type=`.
  - Di UI tab **Harga Produk** (Data Master): kolom **Jenis Harga** ikut tampil, ada filter jenis yang
    memakai `?type=` itu, dan form tambah/ubah memilih jenis dengan default `Regional Warehouse`.
    Error 409 saat menyimpan menyebut jenis harganya, jadi pesan itu diteruskan apa adanya.
  - Menghapus harga yang masih dirujuk baris PO ditolak **409**.
  - **`defects.value` = Harga × Quantity, dihitung di form**: isian **Harga** berisi harga
    satuan (per pcs) dan **Total Value** menampilkan hasil kalinya sebagai preview; total itulah yang
    dikirim ke `defects.value`. Server menyimpannya apa adanya — tidak menghitung ulang dan **tidak
    mengisi `productPriceId`** (kolomnya masih ada demi baris lama, dan ikut dikosongkan begitu baris
    lama disunting). Jenis harga yang dipakai **disimpan di baris itu sendiri** lewat
    `defects.priceType` (text, notNull, default `"Regional Warehouse"`) — jejak audit; mengganti jenis
    di form berarti mengganti baris harga sumbernya. Helper lama
    `defectValueFromPrice`/`findDefectPriceId` sudah dihapus; pola
    `quantity × harga` di server **hanya** untuk PO Product, jangan dihidupkan lagi di jalur defect.
    Di form, `rowToForm()` merekonstruksi Harga dari `value ÷ quantity` — baris impor Excel yang
    nilainya bukan kelipatan qty bisa membulat beberapa rupiah saat disunting.
  - **Aturan memilih harga master** (dipakai form Defect *dan* PO, satu implementasi di
    `src/lib/prices.ts` → `pickProductPrice`): harga **jenis yang sedang dipilih** pada periode
    `YYYY-MM` yang diminta; kalau produk itu belum punya harga jenis tersebut di periode tersebut,
    pakai **harga bulan terdekat sebelumnya jenis yang sama** (jangan jatuh ke jenis lain, dan jangan
    ambil bulan sesudahnya); kalau tanggalnya lebih tua dari semua baris harga, dipakai baris harga
    paling awal. Dipicu saat produk berganti,
    saat **jenis harga berganti**, dan saat timestamp/`poDate` berpindah bulan — di kedua form
    penggantinya adalah **dropdown harga** (bukan isian angka bebas). Jangan kembalikan logika
    cocok-periode yang lama (yang membiarkan pilihan harga sebelumnya menempel saat periode barunya
    kosong).
  - **Susunan field harga di form Defect = form PO** (permintaan user: lebih compact): grid berisi
    **Jenis Harga** (dropdown 7 nilai dari `PRICE_TYPES`), **Harga** (dropdown harga master jenis itu
    + hint `po.valueRwHint`/`po.priceMissing`), dan **Total Value** (kolom baca-saja
    `bg-muted/50 font-medium tabular-nums` + hint `po.totalHint`), semuanya memakai kunci i18n `po.*`
    supaya labelnya benar-benar sama. Urutannya **jenis dulu, baru harga** — memilih jenis mengisi
    ulang daftar sekaligus nilai harganya. Jangan kembali menaruh isian angka bebas atau label lama
    "Harga RW"/"Value RW" di form Defect.
  - **Tombol Tambah selalu membuka form kosong** (Defect). Dulu `openCreate()` membenihi form dari
    entri terakhir lewat `lastEntryRef`, dan itu bocor: setelah mengubah baris dengan pensil, nilai
    baris itu ikut muncul di form Tambah. Membawa produk/pabrik/harga ke entri berikutnya
    sekarang hanya tugas `carryOverForm()` lewat tombol **Simpan & tambah lagi** — jangan pasang lagi
    benih dari entri terakhir di `openCreate()`.
  - `stripValue()` (dipakai Defect & Sales) kini juga membuang `productPrice*` untuk role Pabrik:
    harga satuan bisa dipakai menghitung ulang value, jadi membiarkannya sama saja membocorkan angka
    yang sedang disembunyikan. Ikut dibuang `priceType` — jenis harga hanya bermakna bersama
    nominalnya.
- **Tracing import**: respons import berisi `errors[]` & `skippedDetails[]` (baris, data, alasan) → ditampilkan di dialog `ImportResultDialog`, bisa diunduh CSV, dan dicatat di log server dengan prefix `[import:{module}]`
- **Hapus semua data**: `DELETE /api/{module}` (admin only) — backup otomatis `backup-{module}-{timestamp}.db` dibuat dulu di folder data; master data gagal dihapus (409) jika masih dipakai defect/sales; hapus semua users mengecualikan akun sendiri
- **Import users**: kolom `Nama` (wajib, jatuh ke username bila kosong) dan `Jabatan` (opsional) ada di template; pabrik yang belum ada otomatis dibuat; username boleh berisi spasi (validator custom), email disintesis `<username>@pabrik.local`

## Konvensi Aplikasi

- Bahasa UI: Indonesia (i18n: Indonesia/English/中文)
- Auth: Better Auth session cookie via `src/lib/auth-client.ts`; frontend fetch API di `src/lib/api-client.ts` + hook `src/lib/use-api.ts`
- Kredensial seed: `admin/admin123`, `pabrik_jkt/pabrik123`, `pabrik_sby/pabrik123`, `pabrik_bdg/pabrik123`
- Value (IDR) hanya tampil untuk role admin (dihapus dari respons API untuk role pabrik)
- Data defect pakai timestamp lengkap (tanggal + jam); data sales per bulan (avg per hari untuk chart harian/mingguan/rentang)
- Halaman Report mengambil data dari `GET /api/report` (recap + buckets + totals dihitung di server)
- **Identitas akun — Nama ≠ Username** (koreksi user, JANGAN disamakan lagi): `user.name` adalah Nama tampilan (teks bebas, mudah berubah), `user.username` adalah kunci login (selalu lowercase, validasi `/^[a-zA-Z0-9 _.-]+$/`). Jangan menyalin salah satu ke yang lain saat buat/edit akun, dan jangan memakai pola `name || username` untuk identitas. `displayUsername` menyimpan ejaan asli username untuk ditampilkan di form.
- **Semua label orang di UI memakai Nama**: header pojok kanan, dropdown header, Filter Pembuat dan Filter Kalender di halaman Tugas (`taskOwnersGET`/`taskCalendarsGET`), snapshot `ownerName`/`actorName` di task & log aktivitas, `updatedByName` dokumen, dan ekspor. Yang butuh kunci login (login, impor, diagnosa) tetap memakai username.
- **Jabatan**: kolom teks bebas `user.jabatan` (`notNull().default("")`), murni tampilan — TIDAK dipakai untuk otorisasi maupun pemetaan role.
- **Profil sendiri**: `GET`/`PATCH /api/profile` (`src/lib/api/profile.ts`, route `src/app/api/profile/route.ts`) untuk Nama, Username, Jabatan. Ganti password lewat endpoint yang sama dan WAJIB menyertakan `currentPassword` — diverifikasi server lewat `auth.api.changePassword({revokeOtherSessions:false})`. Admin mengganti data user lain lewat `PATCH /api/users/[id]`; reset password di sana tidak butuh password lama. Sesi berjalan tidak diputus setelah ganti username/password. Setelah simpan dari halaman `/profile`, panggil `reloadProfile()` dari `useAuth()` supaya header langsung berubah.
- **Multi group role (1 Nov 2026)**: sumber kebenaran tautan user→role adalah tabel `user_roles` (`src/lib/db/schema.ts`), bukan lagi `user.roleId`; kolom `user.roleId` DIPERTAHANKAN hanya sebagai role utama/legacy (dipakai `roleId`/`roleCode` di `SessionUser`). `setUserRoles()` di `src/lib/api/users.ts` adalah satu-satunya penulis tabel itu — jangan insert/delete manual dari handler lain. Izin beberapa role DIGABUNG UNION PALING LONGGAR (baca kalau salah satu role boleh baca, tulis kalau salah satu boleh tulis) di `getSessionUser()`; `hideFinance` menyala kalau salah satu role berkode `pabrik`. Role ganda ditulis lewat `PATCH /api/users/[id]` body `roleIds: number[]`; `roleId` di body masih diterima untuk kompatibilitas.
- **Mention @user (1 Nov 2026)**: dua tempat — deskripsi Task (`task_mentions`, body API `mentionedUserIds`) dan dokumen Docs Tasks (chip HTML `data-type="mention"`). Notifikasi lonceng HANYA dikirim untuk mention BARU (membandingkan versi sebelumnya); menyimpan ulang tanpa menambah mention tidak mengirim notif lagi, dan pelaku tidak menerima notif untuk dirinya sendiri. Semua notifikasi masuk tabel `notifications` lewat `notifyMentions()` (`src/lib/api/notifications.ts`) — jangan insert langsung.
- **@mention di form Task diketik langsung di deskripsi (2 Nov 2026)**: TIDAK ada dropdown/chip "sebut orang" terpisah. Mengetik `@` di Textarea Keterangan memunculkan daftar akun di bawahnya (saring dengan ketikan, panah atas/bawah, Enter/Tab memilih, Escape menutup). Sumber daftarnya WAJIB sama dengan filter pemilik task dan panel kalender (`GET /api/tasks/owners` / `/api/tasks/calendars`, prop `users`). Daftar `mentionedUserIds` yang dikirim DIHITUNG ULANG dari teks lewat `mentionedIdsFromText()` di `src/app/(dashboard)/tasks/task-mentions.ts` — deskripsi adalah sumber kebenaran, jadi menghapus `@Nama` dari teks berarti orang itu tidak lagi disebut. Sebutan yang sudah cocok dengan akun **disorot** lewat lapisan `MentionOverlay` (`src/app/(dashboard)/tasks/mention-overlay.tsx`, `pointer-events-none`, posisi gulir ikut Textarea) supaya orang tahu sebutannya berhasil dipasang; jangan menggantinya dengan chip di luar kolom. Jangan mengganti dengan state chip terpisah atau daftar user bebas (semua akun) tanpa keputusan baru dari user.
- **Daftar `@` di Docs hanya nama akun (2 Nov 2026)**: `fetchItems` di `src/components/rich-text/mention.ts` mengisi `detail` kosong untuk orang, jadi popup tidak lagi menampilkan baris `@username` (baris detail hanya dipakai saran tugas: status · pemilik). Chip di dokumen tetap bawaan Tiptap (`@Nama`) — jangan mengubah `renderHTML` mention untuk menghapus awalan `@`; atribut `data-type`/`data-id`/`data-label`/`data-mention-kind` wajib tetap ada karena dipakai ulang saat dokumen dibaca.
- **Form User — akses dan pabrik (2 Nov 2026)**: kolom **Peran** adalah SATU daftar centang berisi `Admin` + seluruh group role; centang langsung (multiple), tidak ada dropdown "Group role" terpisah atau chip tambah-satu-per-satu — jangan dikembalikan ke pola itu tanpa keputusan baru dari user. Mencentang `Admin` mengosongkan role terpilih dan menonaktifkan daftarnya. Pilihan **Pabrik** hanya dirender bila ada group role berkode `pabrik` (atau namanya mengandung "pabrik"/"factory") yang dicentang; saat role itu dicentang pertama kali dan pabrik belum dipilih, pabrik pertama otomatis dipilih. Saat submit, `factoryId` dikirim `null` kalau admin atau role Pabrik tidak dipilih.
- **Popup `@` di editor Docs juga memakai daftar yang sama (2 Nov 2026)**: `taskMentionsGET` (`src/lib/api/task-mentions.ts`) menyaring akun dengan `taskWriterIds()` — admin + akun yang punya izin TULIS menu `tasks`, dihitung dari `user_roles` DAN kolom lama `user.roleId`. Tujuannya supaya daftar orang di popup `@` Dokumen identik dengan filter pemilik dan panel kalender; jangan mengembalikannya ke "semua user" karena akun Pabrik yang tidak punya akses Rencana Kerja ikut muncul.
- **Hak ubah Task**: `tasksPATCH` memakai `requireMenu("tasks", "read")` (bukan `write`) lalu memeriksa per baris: pemilik task, admin, atau akun yang di-@ di task itu. Akun yang di-@ juga melihat task tersebut di daftar `scope=mine` (`mentionedMe: true`). Jangan mengembalikan gerbang menu ke `write` — akun Pabrik hanya punya baca dan jadi tidak bisa mengubah task yang di-@ kepadanya.
- **Tab Pengaturan Rencana Kerja terbuka untuk SEMUA akun + TIDAK ada tipe bawaan (2 Nov 2026)**: array `tabs` di `src/app/(dashboard)/tasks/page.tsx` TIDAK lagi menyembunyikan `settings` untuk non-admin — tiap akun mengatur warna kalender dan daftar Tipenya sendiri (`TaskSettingsView` memakai `me.id` bila bukan admin), admin memakai pemilih akun. Seeding `DEFAULT_TYPES`/`ensureDefaults()` di `src/lib/api/task-types.ts` DIHAPUS: `task_types` mulai kosong per akun (GET/POST tidak mengisi apa pun), dan form Task menampilkan "Belum ada tipe — tambah di tab Pengaturan" (`tasks.typeEmptyHint`) selama daftar kosong. Jangan menghidupkan lagi tipe contoh — user secara eksplisit menolak daftar pre-made. Daftar tipe tetap per akun, jadi opsi filter Tipe di daftar task digabung per KODE (`typeFilterOptions` di `page.tsx`); jangan menampilkan `types.map(...)` mentah karena nama yang sama muncul sekali per akun.
- **Panjang batang task di Kalender berhenti di tanggal selesai (2 Nov 2026)**: `calendarBarEnd()` (`src/app/(dashboard)/tasks/task-types.ts`) mengembalikan `completedAt` (dipotong ke tanggal) bila status `Selesai` dan selesai SEBELUM `dueDate`, di-clamp tidak lebih awal dari `startDate`; selain itu `dueDate`. Dipakai `layoutWeek()` di `src/app/(dashboard)/tasks/task-calendar.tsx` (filter, urutan, `endIdx`) DAN daftar task per hari pada tampilan Hari — jangan kembali memakai `dueDate` mentah di ketiga tempat itu, karena batang akan kembali memanjang sampai due date padahal task sudah selesai.
- **Task yang menyebut saya tampil di daftar (2 Nov 2026)**: filter bawaan tab Tugas di `src/app/(dashboard)/tasks/page.tsx` TIDAK boleh lagi menyaring `task.userId === user.id` saja. Saat `ownerFilter === null` yang diloloskan adalah pemilik sendiri **ATAU** `task.mentionedMe === true`; begitu pengguna memilih akun (`ownerFilter !== null`, termasuk array kosong = semua akun) pilihannya dipakai apa adanya. Server sudah mengirim task mention lewat `GET /api/tasks?scope=mine`; bug lama membuatnya terbuang di klien sehingga penerima notifikasi tidak menemukan task-nya. Kolom Pembuat (`showOwnerColumn`) tampil bila filter eksplisit atau ada baris mention, dan baris/card memberi badge `tasks.mentionBadge` ("Di-@").
- **Tingkat Kesulitan DIHAPUS, Prioritas TETAP (2 Nov 2026)**: user minta "kesulitan aja yg hapus". Jangan menghidupkan lagi `DIFFICULTIES`/`DIFFICULTY_LABEL_KEYS`, filter kesulitan, kolom "Kesulitan" di ekspor, atau field `difficulty` di UI/API. Kolom DB `tasks.difficulty` tetap `NOT NULL DEFAULT 'Sedang'` (pola sama seperti `defects.statusId`) dan sengaja tidak dibaca/ditulis API, supaya baris lama valid tanpa migrasi.
- **Form Tambah Tugas tidak lagi menanyakan Tanggal Mulai, Status, dan Kemajuan (2 Nov 2026)**: ketiganya diisi server — `startDate` default `todayDateISO()` di `src/lib/api/validation.ts` (zona Asia/Bangkok), `status` `Belum`, `progress` `0`. Saat menyunting, `startDate` TIDAK dikirim (tanggal mulai tugas lama tidak boleh berubah hanya karena disunting); jangan menambahkan kembali tiga isian itu tanpa keputusan baru dari user.

## Frontend (Base UI) — JEBAKAN YANG SUDAH TERJADI

Ditulis dari bug nyata, bukan teori. Baca sebelum menyentuh `src/components/ui/` atau form.

- **Formulir TIDAK boleh mengosongkan isian saat penyimpanan gagal.** `onAdd`/`onRename` pada
  `MasterList` mengembalikan `false` bila gagal dan baris tetap dalam mode edit, sehingga teks yang
  sudah diketik tinggal disimpan ulang. Handler di halaman master (`addItem`/`renameItem`) meneruskan
  hasil itu sebagai `true`/`false`. Sebelumnya satu kegagalan jaringan menghapus SKU yang baru diketik.
- **Kegagalan jaringan ditangani sekali di `src/lib/api-client.ts`**, jangan diulang di tiap halaman:
  GET/PATCH diulang sampai 3 percobaan (POST/DELETE/upload tidak, supaya data tidak tergandakan),
  dan `TypeError: Failed to fetch` diterjemahkan di sana menjadi pesan yang jelas. **Pemuatan daftar
  WAJIB lewat `useApi`** (`src/lib/use-api.ts`) supaya ikut diulang — jangan pakai `fetch` mentah di
  halaman. Catatan lengkap ada di README bagian "Failed to fetch" saat menyimpan.
- **Halaman Data Master: `activeCount` harus memuat SEMUA tab.** Rantai ternary-nya dulu melewatkan
  `prices`, sehingga jumlah halaman dihitung dari `statuses` (1 baris di produksi) dan tombol
  "Berikutnya" di tab Harga Produk tidak pernah bisa pindah halaman. Setiap kali menambah tab baru,
  tambahkan juga ke `activeCount` di `src/app/(dashboard)/master/page.tsx` — dan isinya harus daftar
  yang SUDAH disaring (`filteredProducts`, `filteredProblems`, `filteredPrices`, `filteredSpareParts`),
  bukan daftar mentah, supaya paging ikut hasil pencarian di tiap tab. Tab `sparepart-prices`
  menghitung pagingnya sendiri, jadi cabang terakhir boleh `0` (sejak tab Status dihapus 1 Nov 2026).

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
- **Lebar popup Select mengikuti isi, bukan lebar trigger** (permintaan user): className popup
  di `src/components/ui/select.tsx` memakai
  `w-max min-w-[max(9rem,var(--anchor-width))] max-w-(--available-width)` tanpa
  `overflow-x-hidden`, dan `SelectPrimitive.ItemText` memakai `whitespace-normal` supaya
  nama pabrik/produk panjang membungkus alih-alih terpotong. `--available-width` disediakan
  Base UI (`@base-ui/react/utils/CommonPositionerCssVars`). Trigger TETAP `whitespace-nowrap`
  + `min-w-0` (elipsis di trigger memang diinginkan).
- **Urutan pilihan dropdown = abjad nama** (permintaan user: "sort berdasarkan abjad untuk
  urutan semua drop down"). Sumbernya diurutkan sekali di API, bukan di tiap halaman:
  `listMasterRows()` di `src/lib/api/master.ts` memakai `orderBy(asc(table.name))` (produk,
  pabrik, problem, sparepart — sekaligus mengurutkan tab Data Master), dan
  `src/app/api/products/route.ts` serta `src/app/api/spare-parts/route.ts` juga `asc(name)`.
  Daftar nilai tetap di kode diurutkan di konstanta/halaman: `ORIGIN_LABELS`,
  `STATUS_LABELS`, `RESOLUTION_LABELS`, `PIC_VALUES` di `src/app/(dashboard)/repairs/*`, dan
  `[...KETERANGAN_OPTIONS].sort()` di halaman/form PO. **Yang SENGAJA tidak diabjadkan**:
  bulan, tahun, jumlah baris per halaman, jenis/periodisasi harga, tahap tiket, peran pengguna,
  dan pemilih tipe periode (Bulanan/Mingguan/Harian) — semuanya urutan kronologis/alur kerja.
  Label item yang sama juga dipakai `SelectSearch` di popup, jadi jangan mengurutkan ulang di
  render per halaman.
- **Dialog yang isinya lebih tinggi dari layar ponsel WAJIB punya batas tinggi + area gulir
  sendiri.** `DialogContent` di `src/components/ui/dialog.tsx` adalah popup `fixed` yang
  dipusatkan; tanpa `max-h` isinya terpotong di atas/bawah, `overflow-y` tetap `visible` sehingga
  TIDAK bisa digulir, sementara halaman di belakangnya terkunci `overflow: hidden` oleh Base UI.
  Gejala yang dilaporkan user: "tampilan gk bisa di scroll" di HP. Pola yang dipakai:
  `max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain` (form Defect dan popup Detail
  Defect memakainya sejak 1 Nov 2026). `100dvh` supaya address bar ponsel ikut dihitung,
  `overscroll-contain` supaya gulir tidak merembet ke halaman. Jangan menaruh batas tinggi hanya
  di elemen dalam (`<dl>`, list) karena header/footer dialog tetap ikut terpotong.
- **Form Defect: `initialFocus` hanya untuk mode TAMBAH.** Di `defect-form-dialog.tsx`
  `initialFocus={isEditing ? false : codeInputRef}`. Dulu selalu `codeInputRef`, jadi tiap kali
  mengubah defect kursor langsung melompat ke isian Code Garansi dan (di ponsel) keyboard muncul
  menutupi bagian atas form. Mode ubah tidak boleh memfokuskan isian apa pun.
- **`onOpenChange` pada `Dialog` bukan tempat untuk navigasi.** Di halaman Sales dulu
  `open === false` memanggil `advanceEdit()`, yang langsung `return` ketika antrean
  edit kosong — akibatnya dialog form TAMBAH **tidak bisa ditutup sama sekali** (klik X
  maupun Escape tidak bereaksi), dan pada mode edit X berpindah ke baris antrean
  berikutnya alih-alih menutup. Pindah antrean hanya untuk SETELAH SIMPAN berhasil.
  (Halaman Defects memakai pola serupa tapi aman karena antrean editnya berisi satu
  baris; perilaku "X lanjut ke data berikutnya" di sana memang disengaja.)
- **Dialog dua tab: tinggi panel disamakan dengan MENGUKUR isi tab pertama, dan pembungkusnya
  tidak boleh `flex-1`.** `TaskDetailDialog` di `src/app/(dashboard)/tasks/task-dialogs.tsx`
  mengukur tinggi isi tab Informasi lewat `ResizeObserver` (`panelHeight`), lalu angka itu dipakai
  sebagai `height` pembungkus `[data-detail-panels]` yang dipakai bersama kedua tab; daftar log
  menggulir di dalam panelnya sendiri. Jangan menambahkan `flex-1` pada pembungkus itu: `flex-1`
  memasang `flex-basis: 0%` yang MENGALAHKAN `height` inline, sehingga tab Log melebar mengikuti
  isinya (641px) dan dialog mentok `max-h-[85vh]` (850px) — persis keluhan "tinggi card tidak sama".
  Keterangan task di tab Informasi tetap dipangkas `line-clamp-3` (perilaku lama), jadi tingginya
  terbatas dan dialog tidak pernah memaksa menggulir seluruh isi.
- **Halaman Tasks: "Riwayat Aktivitas" bukan tab halaman lagi (1 Nov 2026).** Tab `value="log"`
  sudah dihapus dari array `tabs` di `src/app/(dashboard)/tasks/page.tsx`; aksesnya sekarang
  lewat ikon `History` di DERETAN AKSI `PageHeader` (anak pertama `div.flex flex-wrap`, tepat di
  kiri tombol "Tambah Tugas"), `variant="outline" size="icon-sm"` (`28px`, sebaris dengan tombol
  `size="sm"`), `aria-label`/`title` = `tasks.tabLog`, yang membuka `Dialog` berisi
  `<TaskLogList taskId={null} showTask scrollable />`. Jangan menambahkan kembali tab `log`:
  isinya duplikat dengan dialog ini. Jangan pula menaruh ikon itu di baris tab: dua percobaan
  (tombol terpisah di kanan `TabsList`, lalu di dalam pill tab) sama-sama dinilai jelek karena
  ikon tunggal menggantung di ujung segmented control; header adalah tempat yang disetujui.
  Penting: `TaskLogList` harus jadi ANAK LANGSUNG `DialogContent` (`flex max-h-[85vh] flex-col`,
  `sm:max-w-2xl`) — kalau dibungkus `div` ber-`overflow-y-auto` lagi, gulirnya pindah ke pembungkus
  dan `[data-log-scroll]` (satu-satunya elemen yang boleh menggulir, diukur skrip uji) berhenti
  jadi scroller.
- **Kumpulan kode jenis task WAJIB di-dedupe.** Tabel `task_types` menyimpan baris default
  per user, jadi `task`/`bug`/`feature`/`subtask` muncul berkali-kali. `TaskSummary` di
  `src/app/(dashboard)/tasks/task-views.tsx` membangun `typeCodes` lewat `new Set([...])`
  (master dulu, lalu kode lama dari data); tanpa dedupe kartu "Jenis pekerjaan" menampilkan
  baris kembar dan React melempar "Encountered two children with the same key".
- **Halaman dilindungi `AuthGuard` DAN `src/proxy.ts`.** `proxy.ts` (pengganti
  `middleware.ts` di Next.js 16) memeriksa keberadaan cookie sesi **sebelum halaman
  dirender**; tanpa itu pengguna melihat kedipan halaman Report dulu, baru dilempar ke
  `/login`. Penting: proxy ini hanya memeriksa **keberadaan** cookie, bukan
  memvalidasinya — jadi ia murni perbaikan UX, dan validasi sesungguhnya tetap di
  `AuthGuard` + `requireUser`/`requireAdmin` pada setiap route API. Jangan menjadikan
  proxy sebagai satu-satunya penjaga akses.
- `useApi` mengosongkan data saat URL berubah (loading) — untuk daftar yang harus
  stabil (mis. pabrik di Report), fetch terpisah dari endpoint master.

### Mading Dokumentasi (tab Docs Tasks, 1 Nov 2026)

Tab `Dokumentasi` di halaman Tasks bukan lagi textarea polos: papan kartu catatan tim
(MOM, TODO, info) dengan editor kaya Tiptap dan mention `@` untuk orang maupun task.

- Komponen: `src/app/(dashboard)/tasks/task-docs-view.tsx` (papan, dialog baca, hapus),
  `task-docs-editor.tsx` (dialog tulis/edit), dan `src/components/rich-text/`
  (`rich-text-editor.tsx`, `rich-text-toolbar.tsx`, `rich-text-content.tsx`, `plain.ts`,
  `sanitize.ts`, `mention.ts`, `mention-list.tsx`, `mention-popup.tsx`).
- Simpan ke `task_docs`: `body` = teks polos (cadangan/pencarian) dan `bodyHtml` = HTML
  editor. Kolom `pinned` (sematan) dipakai untuk menaruh catatan di atas. Kolom `label`
  MASIH ADA di skema/API tetapi **tidak dipakai UI** (user minta isian hanya Judul dan
  Isi, 1 Nov 2026) — jangan munculkan lagi kotak/filter label tanpa keputusan baru.
  Urutan daftar `pinned desc, updatedAt desc`.
- Pustaka editor: `@tiptap/*` **3.32.2** + `dompurify` 3.4.17. `@tiptap/starter-kit@3`
  sudah memuat link, underline, strike, blockquote, dan daftar, jadi jangan menambah
  paket extension untuk itu. Ukuran & warna huruf memakai `TextStyleKit` dari
  `@tiptap/extension-text-style` (punya `FontSize`/`Color`/`FontFamily`) — paket
  `@tiptap/extension-font-family` dan `@tiptap/extension-color` sengaja TIDAK dipakai.
- Popup mention WAJIB di-mount lewat `props.mount(container)` milik `@tiptap/suggestion`
  (bukan render di dalam dialog): dialog Base UI memakai portal + focus trap, jadi popup
  di dalamnya tidak bisa diposisikan/terfokus dengan benar. Batas tinggi daftar `max-h-72`
  supaya tidak keluar layar saat user banyak.
- Di `mention-popup.tsx` tombol Escape harus `event.stopPropagation()` sebelum
  mengembalikan `false`: plugin suggestion sudah menutup popup sendiri, dan tanpa
  stopPropagation event merambat ke dialog sehingga dialog catatan ikut tertutup dan
  draf hilang.
- HTML pembaca disaring `sanitizeRichText()` (DOMPurify) yang hanya berjalan di klien
  (`typeof window === "undefined"` → `""`), karena isi dokumen baru dirender setelah
  dialog dibuka; jangan memindahkannya ke server tanpa memikirkan hydration.
- Chip mention task menyimpan `data-id`; klik chip di editor MAUPUN pembaca memanggil
  `onOpenTask(id)` → dialog Rincian Tugas terbuka di atasnya. Karena itu
  `GET /api/tasks/{id}` ditambahkan (`tasksGET_ONE`) dan boleh dibaca siapa pun yang
  punya akses baca menu Tasks.
- Endpoint pendukung: `GET /api/task-docs`, `POST /api/task-docs`,
  `PATCH|DELETE /api/task-docs/{id}`, `GET /api/tasks/mentions?q=` (maks 8 orang + 8 task).

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
- Tabel **rekap per produk** punya kolom **Replacement** dan **Selisih Defect** sebelum kolom rasio
  (kunci i18n `report.selisihDefect`, tepat sesudah Replacement). `replacementQty` per produk
  dijumlahkan `summarizeByProduct()` (`analytics.ts`) dari daftar PO Replacement yang sama dengan
  kartu — jumlah seluruh `recap[].replacementQty` harus sama dengan `totals.replacementQty`.
  Angka selisih **tidak dikirim server**: klien menghitung `replacementQty − defectQty`
  (`RecapSortKey` `selisihDefect` ditangani khusus di `sortRecap`), warnanya dari `selisihTextClass()`
  (`report-charts.tsx`) — plus (Replacement lebih banyak) hijau, minus (defect belum tertutup
  Replacement) merah, nol abu-abu.
- Ringkasan KPI halaman Report **bukan kartu bersarang lagi** sejak 18 Okt 2026: `kpi-rows.tsx`
  menyusun 6 topik sebagai **grid 3 kolom** (`KpiGrid`: `grid-cols-1 md:grid-cols-3 gap-6`), tiap
  topik satu kartu putih berelevasi tipis (`KpiGroup`: `rounded-2xl border border-slate-100 bg-white
  p-5` + `shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_1px_3px_-1px_rgba(0,0,0,0.03)]`, judul `text-xs`
  kapital `mb-4`). Di dalam kartu, tiap angka satu baris `KpiItem` dengan **label kiri – angka kanan**
  (`flex items-center justify-between`), dipisah garis 1 px `border-slate-50 py-2.5
  last:border-none` supaya angka besar tidak memaksa kolom melebar. Warna angka selisih/sisa dari
  `selisihTone()` (`kpi-rows.tsx`): minus `text-rose-600`, plus `text-emerald-600`, nol abu netral;
  angka rasio tetap `ratioTextClass()` (aman hijau, warning amber). Nilai selalu `font-extrabold`.
  Komponen `summary-section.tsx` (kartu di dalam section berbingkai) sudah DIHAPUS;
  `components/summary-card.tsx` tetap dipakai halaman lain. Angka Rupiah diringkas
  `formatCompactIDR()` ("Rp 1,56 M") dan angka penuh selalu ada di atribut `title` item
  (`formatIDR()`) supaya bisa dibaca lewat hover tanpa menyesaki layar. Kartu **Nilai Replacement**
  (`report.replacementValue`, admin saja) = `totals.replacementRwValue`, yaitu Value PO Replacement
  = Σ (quantity × harga master) dalam Rupiah. Kartu **Selisih Defect Quantity** (`report.selisihQty`)
  dan **Selisih Defect Value** (`report.selisihValue`, admin saja) memakai `totalSelisih()`
  (`report-data.ts`): menjumlahkan **hanya baris rekap yang minus** (`Replacement − Defect` per
  produk, qty dan Value), produk surplus TIDAK mengurangi totalnya — contoh acuan user pabrik
  Yundu: 6 produk minus (−109 −340 −90 −28 −21 −12) = **−600**, sedangkan +582/+75/+7 diabaikan.
  Jadi kartu dan kolom rekap searah, nilainya selalu ≤ 0, dan warnanya merah lewat
  `selisihTextClass()` (plus = Replacement lebih banyak = hijau, minus = defect belum tertutup =
  merah, nol abu-abu). Keterangan kecil di bawah angkanya menyebut aturannya
  (`report.selisihQtyDesc` = "Hanya baris minus: Replacement − Qty Defect", `report.selisihValueDesc`
  = "Hanya baris minus: Nilai Replacement − Nilai Defect", `report.replacementValueDesc` =
  "Value: qty × harga master"). Angka bertanda plus kalau positif (`formatSelisih()`), dan
  `recap[].replacementRwValue` dihitung `summarizeByProduct()` dari PO Replacement yang sama.
  Nama identifier lama (`replacementRwValue`, `rwPrice`, dst.) sengaja TIDAK diganti — hanya label
  yang dibaca pengguna yang berubah.

- **Allowance Defect** (kartu `report.allowance`, admin saja, ditambahkan 2 Okt 2026) = Limit tahunan
  dalam Rupiah dikurangi **Nilai Defect** hasil filter yang sedang aktif — **kecuali filter pabrik**:
  kartu ini SELALU memakai nilai defect seluruh pabrik (field admin-only `totals.allowanceDefectValue`,
  dihitung dari `periodDefects` = defect periode filter tanpa saringan pabrik), jadi memilih pabrik tidak
  mengubah angka Sisa Allowance (permintaan user 18 Okt 2026). Query defect di `/api/report` karena itu
  TIDAK menyaring pabrik di SQL; filter pabrik diterapkan setelah periode (`filteredDefects`). Limitnya master tersendiri:
  tabel `defect_allowances` (`year` TEXT unik 4 angka + `limitValue` real, **satu limit per tahun**,
  tahun yang sama = 409 `Limit allowance {year} sudah ada. Ubah baris itu.`), endpoint
  `/api/defect-allowances` (GET/POST) + `/api/defect-allowances/[id]` (PATCH/DELETE), **semua
  requireAdmin** — role non-admin tidak menerima field `allowance`/`allowanceYear` sama sekali di
  `/api/report` (pola sama seperti angka Rupiah lain). Dikelola di tab **Allowance Defect** pada Data
  Master (`src/app/(dashboard)/master/allowance-tab.tsx`, input tahun + Limit Rupiah; titik ribuan
  dibuang sebelum dikirim, kolom "Per bulan" = `limitValue / 12` untuk gambaran saja).
  Limit diprorata mengikuti filter Report — SATU sumber aturan di `src/lib/allowance.ts`
  (`prorationFactor`): `yearly` = penuh, `monthly` = ÷12 (bulan "all" = penuh), `weekly` = ÷(12 × 4.33),
  `daily` = ÷365, `custom` = jumlah hari inklusif ÷365 (batas tanggal kosong dilengkapi ke ujung tahun).
  Tahun limit yang dipakai = tahun filter; kalau filter tidak memuat tahun (mis. rentang 2025–2027)
  dipakai **tahun terbaru** yang punya limit (`allowanceYearFor`). Kalau tahun itu belum diisi, kartu
  menampilkan `-` + keterangan `report.allowanceMissing` (tahun berapa yang perlu diisi) — nilai tidak
  pernah jatuh ke 0 diam-diam. Kartu non-admin tidak dirender. Self-check aturan prorata:
  `cmd /c "npx tsx scripts/allowance-check.ts"` (dijalankan dari `frontend/`).

- **Repair Value** (kartu `report.repairValue`, admin saja, ditambahkan 12 Okt 2026) = Σ kolom `value`
  (Saving Value) baris Repair Data yang statusnya sudah selesai — HANYA `"Done Kirim"` dan
  `"Done Repair"` — DAN kolom Penyelesaian (`resolution`) apa pun **kecuali** `"Replacement Produk Baru"`
  (keputusan user 13 Okt 2026). Pencocokan lewat `countsForRepairValue()` di `src/lib/repair-value.ts`
  (tanpa peduli huruf besar-kecil/spasi, satu-satunya tempat aturan ini; `isRepairDone()` untuk syarat
  status saja). Baris ikut dihitung kalau `repairs.date` (`YYYY-MM-DD`) cocok filter periode yang sama
  seperti defect (`matchesDefectPeriod`). `/api/report` mengirim `totals.repairValue` + `totals.repairQty`
  (jumlah baris) — Rupiah (`repairValue`) **hanya ke admin**, `repairQty` juga dikirim ke role Pabrik
  (keputusan user 18 Okt 2026). Kartu ikut filter pabrik: baris Repair tidak menyimpan pabrik, jadi
  `/api/report` memakai kaitan `product_factories` (produk → pabrik) — `factory !== null` berarti hanya
  baris yang `productId`-nya milik pabrik itu (admin memilih pabrik di filter, akun Pabrik dipaksa
  `scopedFactoryId()`), sedangkan "Semua Pabrik" menghitung semua baris. Akun Pabrik melihat kartu
  **Qty saja**; item Value tidak dirender (jangan kirim Rupiah ke Pabrik).
  Self-check aturan: `cmd /c "npx tsx scripts/repair-check.ts"` (dijalankan dari `frontend/`).

- **Claim Garansi BARDI** (section `report.claimSection` di Report, **admin saja**, ditambahkan
  18 Okt 2026) = dua kartu dari tabel `warranty_claims`: **Total Claim ID Quantity** (Σ `quantity`) dan
  **Total Claim ID Value** (Σ `value`). Baris berstatus **"Belum Ada Data"** dan **"CLOSED"** TIDAK
  dihitung (keputusan user); aturannya satu-satunya di `countsForClaimSummary()` +
  `summarizeClaims()` (`src/lib/claim-summary.ts`), pencocokan periode lewat `matchesDefectPeriod`
  atas `warranty_claims.date`. `/api/report` mengirim `totals.claimQty`/`claimValue`/`claimRows`
  **hanya ke admin** (cabang non-admin tidak memuatnya dan sectionnya tidak dirender).
  Self-check: `cmd /c "npx tsx scripts/claim-summary-check.ts"` (dijalankan dari `frontend/`).

- **Repair Data** (menu `/repairs`, **admin saja**, ditambahkan 11 Okt 2026) = cermin tab "Data Reparasi"
  sheet Reparasi RFB (`REPAIR_GSHEET_ID`, default sudah ada di kode). Tabel `repairs`, identitas baris =
  `claimId` + `date` + `productId` (`repairMatchKey()` di `src/lib/repair-match.ts`) — **`claimId` TIDAK
  unik**: satu CLAIM ID boleh dipakai beberapa baris selama tanggal/produknya beda (keputusan user
  12 Okt 2026, dulu UNIQUE dan baris ganda dilewati). Endpoint `/api/repairs` (GET/POST),
  `/api/repairs/[id]` (PATCH/DELETE), `/api/repairs/bulk-delete`, `DELETE /api/repairs`,
  `POST /api/repairs/gsheet/sync`, plus Excel `repairs` — **semuanya `requireAdmin()`** karena
  `value` (Saving Value) memuat Rupiah; role Pabrik tidak menerima data ini sama sekali.
  - **Kolom Pabrik** (permintaan user 18 Okt 2026): baris repair tidak menyimpan pabrik, jadi
    `listRepairRows()` men-join `product_factories` → `factories` dan mengirim `factoryId`/`factoryName`
    (NULL kalau produk belum dikaitkan). Halaman `/repairs` menampilkan kolom Pabrik, punya dropdown
    filter pabrik, dan kotak pencarian ikut mencocokkan nama pabrik; `/api/repairs?factoryId=` didukung
    untuk pemakaian lain.
  - Saving Value = `quantity × harga RW` bulan tanggal baris (`resolveRepairPrice` +
    `pickProductPrice`, `DEFAULT_PRICE_TYPE`); dihitung server saat create dan hanya dipakai kalau
    klien mengirim 0/kosong. `month` selalu diturunkan dari `date` (`repairMonth()`) — kolom Bulan di
    sheet isinya campur (serial + teks), jadi TIDAK pernah dibaca.
  - Sync satu arah sheet → app: header dibaca dari **baris 3**, data dari **baris 5**, kolom dicocokkan
    per NAMA header (`src/lib/gsheet/repair-mapping.ts`, dua kolom bernama "Note" dibedakan lewat alias
    `noteClosing`), nilai dibaca `UNFORMATTED_VALUE`. Aturan konflik memakai `planFields`
    (`src/lib/gsheet/repair-sync.ts`): sheet berubah & app belum → timpa; dua-duanya berubah → **nilai app
    dipertahankan** dan dilaporkan sebagai "dilewati" (TANPA dialog `/resolve` seperti Defect — itu
    upgrade path kalau nanti dibutuhkan); `value` tidak pernah ikut ditimpa.
  - Nama Produk / Teknis Device / Sparepart dicocokkan ke master; yang tidak ketemu **tidak** dibuat
    otomatis: **produk → `productId` dibiarkan NULL tapi barisnya tetap masuk** (ditandai tidak lengkap),
    teknis device → kolom dikosongkan, **sparepart → teksnya disimpan
    apa adanya** di `sparePart1Text`/`sparePart2Text`/`sparePart3Text` (`resolveSparePart()` di
    `src/lib/gsheet/repair-mapping.ts`; `sparePartNId` dibiarkan kosong) dan tetap dilaporkan sebagai
    catatan di `ImportResult`. JANGAN mengosongkan nama sparepart yang belum ada di master — permintaan
    user 12 Okt 2026. Teks diisi juga saat sparepart ketemu di master (nama kanoniknya), jadi nama selalu
    bisa dibaca dari `sparePartNText` dan id hanya penunjuk ke master. Daftar Teknis Device bisa
    dilengkapi dari `Dropdown!B` lewat
    `cmd /c "npx tsx scripts/repair-problem-seed.ts"` (idempotent; sengaja BUKAN di `src/lib/db/seed.ts`
    yang hanya mengisi DB kosong).
  - **Baris tidak lengkap TETAP diimpor, cuma ditandai** (permintaan user 12 Okt 2026): Claim ID kosong,
    produk belum ada di Data Master, dan tanggal kosong disimpan di kolom `repairs.incompleteFields`
    (daftar kunci dipisah koma: `claimId`, `product`, `date`) dan ditampilkan sebagai tanda "Tidak
    lengkap" di daftar + keterangan di dialog detail (`repair-incomplete.ts` menerjemahkan kuncinya).
    HANYA baris yang **semua kolomnya kosong** yang tidak dimasukkan, dan itulah satu-satunya isi laporan
    "baris tidak masuk" di dialog sync. JANGAN menghidupkan lagi aturan lama "baris dilewati" untuk data
    tidak lengkap. Kunci pencocokan tetap `repairMatchKey()` sehingga sync ulang TIDAK menggandakan baris
    (produk NULL cocok dengan NULL). Tanda ikut diperbarui saat sync/impor, jadi hilang sendiri setelah
    sheet atau Data Master dibetulkan.
  - Impor Excel `repairs` (`importRepairs`) memakai aturan yang sama: baris tidak lengkap masuk bertanda,
    hanya baris yang semua kolom terpetakannya kosong yang dilewati ("Semua kolom kosong — tidak ada data
    untuk diimpor."), upsert lewat `repairMatchKey()`. **Jebakan lama**: kolom "Saving Value" dan
    "Jenis Harga" di berkas impor DIABAIKAN (`at("value")`/`at("priceType")` bukan anggota
    `REPAIR_FIELDS`) — `value` selalu dihitung `quantity × harga RW`. Kalau operator perlu memaksa nilai
    dari berkas, itu perubahan terpisah.
  - Dropdown Asal/Status/PIC/Penyelesaian di-hardcode di `src/lib/api/validation.ts` (pola
    `KETERANGAN_OPTIONS`), bukan tabel master. Self-check pemetaan + aturan sync:
    `cmd /c "npx tsx scripts/repair-check.ts"`.
  - Baris yang datanya kurang (produk belum ada di Data Master, tanggal kosong, Claim ID kosong/ganda)
    bisa didaftar per baris sheet untuk dibetulkan di Google Sheet:
    `cmd /c "npx tsx scripts/repair-sync-report.ts <berkas.csv>"` (butuh kredensial service account,
    jalan juga di dalam container produksi); `scripts/repair-sheet-fixlist.ts` mencetak daftar serupa
    (kolom "Semua kolom kosong" = satu-satunya yang tidak diimpor).

### Claim Garansi BARDI (`/claim-garansi`, admin saja)

- Cermin tab **"Raw Combine CG"** sheet **Data Garansi Produk** (`CG_GSHEET_ID`,
  `DEFAULT_CG_SHEET_ID` di `src/lib/gsheet/cg-mapping.ts`), ditambahkan 17 Okt 2026. Tabel
  `warranty_claims`; **baca-saja** — tidak ada POST/PATCH/DELETE, satu-satunya sumber data = sync.
- **Nama produk dipatok dari kolom AC "Official Name"** (bukan nama pilihan pelanggan di kolom N atau
  deskripsi masalah) — permintaan user. Kolom yang dibaca dipetakan 0-based di `CG_COLUMNS`
  (`cg-mapping.ts`); kalau urutan kolom sheet bergeser, `cgHeaderProblems()` menolak sync dengan pesan
  `kolom 29 harus "Official Name"`, jadi sync gagal terang-terangan, bukan diam-diam membaca kolom kosong.
- **Nilai = Jumlah unit (kolom R) × harga Regional Warehouse dari Price List APP** (`pickProductPrice`,
  aturan yang sama dengan Defect/Repair: bulan klaim, kalau tidak ada → bulan terdekat sebelumnya).
  **JANGAN** memakai harga tab "Data Produk" di sheet itu (keputusan user: "pakai harga yg ada di app").
  Produk yang belum ada di Data Master → `productId` NULL dan ditandai `incompleteFields: "product"`.
- **Jumlah unit (kolom R) mengikuti sheet APA ADANYA, termasuk 0** (keputusan user 18 Okt 2026:
  "ikutin sheet aja jadi 0 ya") — dulu sync memaksa `Math.max(1, …)` sehingga 5 baris ber-R `0`
  membuat Total Unit app 9.670 sementara sheet 9.665.
- **Baris tanpa Timestamp kolom B TIDAK diimpor** (permintaan user, 18 Okt 2026) dan baris app lama yang
  `timeStamp`-nya kosong ikut DIHAPUS saat sync; keduanya dihitung di `summary.skippedNoTimestamp` /
  `summary.removedNoTimestamp` dan tampil di dialog hasil sync. Karena itu `date` selalu terisi dan
  tanda `incompleteFields: "date"` tidak lagi muncul di baris baru.
- Jangan pakai `cgCell()` untuk kolom Timestamp/Jumlah: itu men-`String()` nilai lebih dulu sehingga
  serial tanggal Google (`46023.402…`) tidak lagi dikenali `parseSheetTimestamp()`; pakai `cgRaw()`.
  Gejalanya: semua `date`/`timeStamp` kosong dan `value` 0 di seluruh tabel.
- **Kolom Pabrik** (permintaan user 18 Okt 2026): diambil dari kaitan `product_factories` → `factories`
  (`factoryId`/`factoryName`, NULL kalau produk belum dikaitkan), bukan kolom sheet. Halaman
  `/claim-garansi` menampilkannya sebagai kolom + dropdown filter pabrik, dan pencarian ikut mencocokkan
  nama pabrik. `GET /api/warranty-claims?factoryId=` juga didukung.
- Kartu **Claim Garansi BARDI** di halaman Report ikut filter pabrik dengan cara yang sama (daftar produk
  pabrik itu dari `product_factories`); "Semua Pabrik" menghitung semua baris.
- Perbandingan "berubah/tidak" saat sync **wajib** melewati `sheetSyncedAt`/`updatedAt` (selalu beda
  karena presisi detik vs milidetik) — tanpa itu tiap sync melaporkan "diperbarui: 7.996".
- Identitas baris = `claimMatchKey(claimId, date, productId)` dari `src/lib/claim-match.ts` (dipakai
  bersama modul Repair lewat `src/lib/repair-match.ts`): Claim ID boleh ganda, yang kembar persis
  (claim + tanggal + produk) yang di-upsert.
- Perintah: `cmd /c "npx tsx scripts/cg-gsheet-sync.ts"` (butuh kredensial service account, jalan juga
  di dalam container produksi) dan self-check `cmd /c "npx tsx scripts/cg-check.ts"`.

### Aturan alur input defect

- Timestamp entri baru = waktu sekarang (`localDateTimeValue()`), bukan konstanta.
- **Simpan & tambah lagi**: Produk + Pabrik dibawa ke entri berikutnya,
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
