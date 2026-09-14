# Spec: PO Product (Backend)

> Modul id: `po-product` · Fase: backend dari halaman `/po` yang sudah ada
> Status: **menunggu review manusia** — belum ada kode yang ditulis untuk spec ini.

## Objective

Menyediakan backend untuk halaman PO Product (`/po`) yang frontendnya sudah selesai
di commit `c8ac561`. Tanpa backend, halaman itu menampilkan keadaan kosong karena
`/api/purchase-orders` belum ada.

**Pengguna:**

- **Admin** — mencatat dan memelihara baris PO: nomor PO, produk (lewat SKU), pabrik,
  quantity, price/pcs (boleh pecahan), currency, keterangan (dipilih dari master).
  Bisa tambah, ubah, hapus, hapus massal, hapus semua, serta impor/ekspor Excel.
  Ia juga mengelola **master keterangan** di Data Master.
- **Pabrik** — membuka halaman yang sama dalam mode baca-saja untuk melihat PO yang
  menyangkut pabriknya: nomor PO, keterangan, nama produk, pabrik, quantity.
  **Tidak boleh** melihat price/pcs, total, maupun currency.

**Kenapa ada:** pencatatan PO masih dilakukan di luar aplikasi. Menyatukannya membuat
PO bisa ditelusuri berdampingan dengan defect dan sales per produk/pabrik.

**Sukses berarti:** admin bisa mencatat satu PO berisi beberapa produk berbeda, total
nilainya benar tanpa dihitung manual, dan role Pabrik bisa memeriksa PO miliknya tanpa
sedikit pun angka harga terekspos.

## Tech Stack

Mengikuti yang sudah berjalan di repo ini — tidak ada teknologi baru:

| Bagian | Teknologi |
|---|---|
| Route handler | Next.js 16 App Router (`src/app/api/purchase-orders/**`) |
| ORM | Drizzle ORM + SQLite (better-sqlite3) |
| Validasi | zod (`src/lib/api/validation.ts`) |
| Auth/guard | Better Auth + `requireUser` / `requireAdmin` / `scopedFactoryId` |
| Excel | SheetJS (`xlsx`) lewat `src/lib/api/excel.ts` |
| Backup | `backupDatabase()` di `src/lib/api/bulk.ts` |

## Commands

Dijalankan dari `frontend/` (di shell ini `npm` harus lewat `cmd /c` karena
`npm.ps1` diblokir execution policy):

```
Dev:        cmd /c "npm run dev"                       # http://localhost:3000
Typecheck:  cmd /c "npx tsc --noEmit"
Lint:       cmd /c "npx eslint"
Schema:     cmd /c "npm run db:push"
Seed:       cmd /c "npm run db:seed"
Backup DB:  node -e "..."    # VACUUM INTO, lihat pola di commit SKU
```

## Project Structure

Tidak ada direktori baru. Berkas yang **disentuh**:

```
frontend/src/lib/db/schema.ts              → tabel keterangan + purchaseOrders
frontend/src/lib/api/validation.ts         → purchaseOrderSchema, keteranganSchema,
                                             CURRENCIES, normalizeCurrency
frontend/src/lib/api/records.ts            → select, kondisi filter, CRUD PO, stripPricing
frontend/src/lib/api/master.ts             → daftar keterangan sebagai master (name unik)
frontend/src/lib/api/excel.ts              → template/impor/ekspor modul purchase-orders
                                             dan keterangan
frontend/src/app/api/purchase-orders/route.ts        → GET, POST, DELETE (hapus semua)
frontend/src/app/api/purchase-orders/[id]/route.ts   → PATCH, DELETE
frontend/src/app/api/purchase-orders/bulk-delete/route.ts → POST
frontend/src/app/api/keterangan/route.ts             → GET, POST, DELETE (hapus semua)
frontend/src/app/api/keterangan/[id]/route.ts        → PATCH, DELETE
frontend/src/app/(dashboard)/master/page.tsx         → tab Keterangan (CRUD)
frontend/src/app/(dashboard)/po/page.tsx             → dropdown & filter keterangan
frontend/src/app/(dashboard)/po/po-form-dialog.tsx   → pilih keterangan dari dropdown
README.md                                  → schema, API, aturan akses
AGENTS.md                                  → catatan modul PO
```

Modul Excel `purchase-orders` dan `keterangan` harus terdaftar di `MASTER_MODULES`-nya
`excel.ts` (tabel + nama berkas) agar endpoint `/api/excel/{modul}/{template,import,export}`
bekerja seperti modul lain.

## Code Style

Mengikuti pola `records.ts` yang sudah ada — server adalah sumber kebenaran untuk
angka dan akses:

```ts
// Total dihitung di server; angka dari klien tidak dipercaya.
const [row] = await db
  .insert(purchaseOrders)
  .values({
    poNumber,
    productId,
    factoryId,
    quantity,
    pricePerPcs,
    value: pricePerPcs * quantity,
    currency: normalizeCurrency(currency),
    keterangan,
  })
  .returning();

// Role Pabrik tidak menerima harga, total, maupun mata uang.
function stripPricing<T extends { value?: number; pricePerPcs?: number; currency?: string }>(
  row: T,
  user: SessionUser
): T | Omit<T, "value" | "pricePerPcs" | "currency"> {
  if (user.isAdmin) return row;
  const copy: Record<string, unknown> = { ...row };
  delete copy.value;
  delete copy.pricePerPcs;
  delete copy.currency;
  return copy as Omit<T, "value" | "pricePerPcs" | "currency">;
}
```

Konvensi: pesan error berbahasa Indonesia dan bisa dibaca pengguna; komentar menjelaskan
*kenapa*, bukan *apa*; tipe ketat tanpa `any` (handler master sudah pernah kena masalah
penyempitan tipe — cabang per tabel, jangan satu objek gabungan).

## Testing Strategy

Repo ini **belum punya test runner otomatis** (tidak ada jest/vitest di `package.json`),
dan menambahkannya bukan bagian dari spec ini. Karena itu pembuktian mengikuti Definition
of Done proyek, dengan bukti nyata alih-alih unit test:

| Tingkat | Cara membuktikan |
|---|---|
| Kontrak API | Panggil endpoint langsung dengan sesi admin dan sesi pabrik; periksa status dan bentuk JSON |
| Aturan akses | Bandingkan payload admin vs pabrik: `pricePerPcs`/`value`/`currency` harus **tidak ada** untuk pabrik |
| Integritas data | Query `sqlite.db` setelah operasi: jumlah baris, uniqueness, dan `value` hasil hitung server |
| UI | Halaman `/po` dengan Chrome headless + `playwright-core` (dipasang sementara, dihapus lagi) |
| Statik | `npx tsc --noEmit` dan `npx eslint` bersih |

## Data Model

```ts
keterangan (tabel: keterangan)          // BARU — master untuk dropdown form PO
  id           integer PK auto
  name         text NOT NULL UNIQUE
  createdAt

purchaseOrders (tabel: purchase_orders)
  id           integer PK auto
  poNumber     text NOT NULL              // diinput manual, boleh berulang
  productId    integer NOT NULL → products.id
  factoryId    integer NOT NULL → factories.id
  quantity     integer NOT NULL default 0
  pricePerPcs  real    NOT NULL default 0 // BOLEH PECAHAN (mis. USD 12.50)
  value        real    NOT NULL default 0 // = pricePerPcs × quantity
  currency     text NOT NULL default "Rp" // "Rp" | "USD" | "RMB"
  keteranganId integer → keterangan.id    // dropdown, bukan teks bebas
  createdAt / updatedAt

  UNIQUE (poNumber, productId)   // ← berubah bila Pilihan B diambil; lihat di bawah
  INDEX (factoryId), INDEX (poNumber), INDEX (keteranganId)
```

**`pricePerPcs` dan `value` bertipe `real`** (bukan `integer` seperti `sales.value`),
karena PO memakai USD dan RMB yang butuh 2 angka desimal. Modul Sales/Defect tetap
integer sebab keduanya selalu Rupiah.

**SKU tidak disimpan di tabel ini**: SKU melekat pada `products.sku` dan `productId`
sudah menjadi rujukannya. Menyalin SKU sebagai teks bebas akan membuat dua sumber
kebenaran yang bisa berbeda saat SKU produk diubah. Respons API tetap mengirim `sku`
hasil join supaya tabel dan form bisa menampilkannya.

**Keterangan adalah master, bukan teks.** Ia dikelola seperti master lain (Produk,
Problem, Status) lewat tab baru di halaman Data Master, dan form PO menampilkannya
sebagai dropdown searchable. Baris PO menyimpan `keteranganId`, bukan teksnya — supaya
satu istilah dipakai konsisten dan bisa diubah di satu tempat.

### Keputusan 1.3 — kolom pembeda (BELUM DIPUTUSKAN)

Pertanyaan: bolehkah satu PO Number memuat **produk yang sama** lebih dari sekali?

| | Pilihan A | Pilihan B |
|---|---|---|
| Aturan | Produk sama tidak boleh dobel dalam satu PO | Boleh, asalkan kolom pembeda berbeda |
| Constraint | `UNIQUE (poNumber, productId)` | `UNIQUE (poNumber, productId, <pembeda>)` |
| Kiriman bertahap | Operator membuat PO Number berbeda (`PO-2026-001A`) | Dicatat di baris terpisah dengan pembeda berbeda |
| Tabel & form | Tidak ada kolom tambahan | Bertambah satu kolom (mis. `Tanggal Kirim`) |

Contoh visual kedua pilihan ada di halaman sementara `/demo-kolom-pembeda`
(login sebagai admin) — halaman itu dihapus setelah keputusan diambil.

Kalau Pilihan B, **kolom pembedanya perlu ditentukan**: Tanggal Kirim, Batch,
No. Surat Jalan, atau Nomor Kontainer. Pilihan kolom ini mengubah bentuk tabel,
form, dan kontrak API, jadi harus dikunci sebelum implementasi.

## API Contract

| Method | Path | Akses | Perilaku |
|---|---|---|---|
| GET | `/api/purchase-orders` | user login | daftar + `productName`, `factoryName`, `sku`, `keteranganName`; role Pabrik ter-scope pabriknya dan tanpa price/total/currency |
| POST | `/api/purchase-orders` | admin | tambah; 409 bila `poNumber + productId` sudah ada; `value` dihitung server |
| PATCH | `/api/purchase-orders/{id}` | admin | ubah; 409 pada bentrok yang sama; `value` dihitung ulang |
| DELETE | `/api/purchase-orders/{id}` | admin | hapus satu baris |
| DELETE | `/api/purchase-orders` | admin | hapus semua + backup otomatis dulu |
| POST | `/api/purchase-orders/bulk-delete` | admin | `{ ids: number[] }` |
| GET/POST | `/api/keterangan` | GET user login, POST admin | master keterangan (tambah: `name` unik) |
| PATCH/DELETE | `/api/keterangan/{id}` | admin | ubah / hapus (409 bila masih dipakai baris PO) |
| DELETE | `/api/keterangan` | admin | hapus semua + backup |
| GET | `/api/excel/purchase-orders/template` | admin | template kosong |
| POST | `/api/excel/purchase-orders/import` | admin | impor; baris duplikat dilewati |
| GET | `/api/excel/purchase-orders/export` | admin | ekspor; kolom harga/total/currency hanya untuk admin |
| GET/POST/PATCH/DELETE | `/api/excel/keterangan/{template,import,export}` | admin | Excel untuk master keterangan, mengikuti master lain |

**Filter (GET)** — mengikuti Sales: `factoryId`, `productId`, `search`, ditambah
`keteranganId`. Role Pabrik: `scopedFactoryId()` memaksa `factoryId` miliknya, parameter
`factoryId` dari klien diabaikan.

`search` mencocokkan `poNumber`, `keterangan.name`, `products.name`, `products.sku`,
`factories.name`.

**Deteksi duplikat impor Excel** — baris dianggap duplikat bila `poNumber + produk`
sudah ada, atau bila bentrok dengan baris lain di berkas yang sama (alasan:
"PO + produk sudah ada"). Ini mencegah kegagalan UNIQUE di level database yang
pesannya tidak menyebut baris mana.

## Boundaries

**Always**

- Hitung `value` di server pada POST dan PATCH; jangan pernah memakai angka `value` kiriman klien.
- Jalankan `stripPricing()` pada GET sebelum mengirim respons.
- Paksa scope pabrik lewat `scopedFactoryId()` untuk role Pabrik.
- Panggil `backupDatabase("purchase-orders")` sebelum hapus semua.
- Backup `sqlite.db` manual sebelum `drizzle-kit push` yang menyentuh database produksi.
- Jalankan `npx tsc --noEmit` + `npx eslint` lalu buktikan perilakunya saat berjalan.

**Ask first**

- Menambah dependensi baru (spec ini tidak butuh satupun).
- Mengubah tabel yang sudah ada (`products`, `sales`, `defects`, …).
- Memasukkan PO ke halaman Report atau mengubah perhitungan Report.
- Mengubah aturan akses role Pabrik di modul lain.
- Menambah endpoint di luar daftar kontrak di atas.

**Never**

- Mengirim `pricePerPcs`, `value`, atau `currency` ke sesi role Pabrik.
- Memakai `requireUser` pada operasi tulis — semua tulis wajib `requireAdmin`.
- Menyimpan SKU sebagai kolom teks di `purchase_orders`.
- Menyimpan keterangan sebagai teks bebas di `purchase_orders`; yang disimpan adalah `keteranganId`.
- Menghapus data tanpa backup lebih dulu.
- Melonggarkan pemeriksaan (`@ts-ignore`, `eslint-disable`, tes dihapus) supaya hijau.

## Success Criteria

1. `npx tsc --noEmit` dan `npx eslint` bersih di `frontend/`.
2. **Admin** dapat menambah baris PO lewat `/po`; baris tersimpan dan muncul di tabel.
3. Menambah baris dengan `poNumber + produk` yang sama ditolak **409** dengan pesan
   berbahasa Indonesia; `poNumber` sama dengan produk berbeda **diterima**.
   *(Bila Pilihan B diambil, aturannya berubah menjadi: boleh selama pembedanya berbeda.)*
4. `value` di database selalu sama dengan `pricePerPcs × quantity`, termasuk setelah
   PATCH yang hanya mengubah `quantity`, dan **tetap benar untuk harga pecahan**
   (mis. 12.50 × 1.000 = 12.500).
5. **Role Pabrik**: `GET /api/purchase-orders` tidak memuat kunci `pricePerPcs`,
   `value`, maupun `currency` pada baris mana pun, dan hanya memuat baris pabriknya.
6. Halaman `/po` menampilkan data nyata untuk kedua role: admin 7 kolom, pabrik 5 kolom
   tanpa tombol tambah/ubah/hapus.
7. **Master keterangan** bisa ditambah, diubah, dan dihapus dari Data Master; namanya
   muncul di dropdown form PO; menghapusnya ditolak **409** selama masih dipakai baris PO.
8. Template, impor, dan ekspor Excel bekerja untuk PO **dan** keterangan; impor PO
   melewati duplikat dengan alasan yang bisa dibaca dan melaporkan barisnya.
9. Hapus semua membuat berkas backup `backup-purchase-orders-*.db` lebih dulu.
10. Data lama tidak berubah: `products` 118 baris, `defects` 3.584, `sales` 1.008 tetap utuh.
11. `README.md` dan `AGENTS.md` memuat skema, endpoint, dan aturan akses modul PO.

## Open Questions

**Sudah diputuskan (jangan dibuka lagi tanpa alasan baru):**

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Excel untuk PO | **Ikut** — template, impor, ekspor |
| 2 | Hapus semua + hapus massal | **Ikut**, dengan backup otomatis lebih dulu |
| 4 | `keterangan` per baris atau per PO | **Per baris**, dan berupa **master** yang bisa di-CRUD, dipilih lewat dropdown |
| 5 | Price/pcs bilangan bulat? | **Boleh pecahan** — kolom `real`, tampilan 2 desimal untuk USD/RMB |

**Masih terbuka — menghalangi implementasi:**

1. **Kolom pembeda (keputusan 1.3).** Boleh tidaknya produk yang sama muncul dua kali
   dalam satu PO Number. Kalau boleh, kolom pembedanya apa (Tanggal Kirim / Batch /
   No. Surat Jalan / Nomor Kontainer). Contoh visual: `/demo-kolom-pembeda`.
   Ini mengubah constraint UNIQUE, bentuk tabel, form, dan kontrak API — jadi harus
   dikunci lebih dulu.

**Catatan kecil yang tidak menghalangi (akan saya putuskan sendiri bila tidak dijawab):**

- **Lebar kolom keterangan.** Kolom Keterangan di tabel dipotong (`max-w-48`) dan nama
  lengkapnya muncul di tooltip. Kalau namanya biasanya panjang, kolomnya bisa dilebarkan
  dengan memangkas filter Produk/Pabrik.
- **Filter Produk/Pabrik.** Frontend sekarang menampilkan keduanya (mengikuti Sales)
  ditambah filter Keterangan, sehingga ada empat kontrol filter. Bisa dipangkas bila
  dianggap terlalu banyak.
