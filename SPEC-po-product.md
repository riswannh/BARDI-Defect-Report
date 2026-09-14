# Spec: PO Product (Backend)

> Modul id: `po-product` · Fase: backend dari halaman `/po` yang sudah ada
> Status: **menunggu review manusia** — belum ada kode yang ditulis untuk spec ini.

## Objective

Menyediakan backend untuk halaman PO Product (`/po`) yang frontendnya sudah selesai
di commit `c8ac561`. Tanpa backend, halaman itu menampilkan keadaan kosong karena
`/api/purchase-orders` belum ada.

**Pengguna:**

- **Admin** — mencatat dan memelihara baris PO: nomor PO, produk (lewat SKU), pabrik,
  quantity, price/pcs, currency, keterangan. Bisa tambah, ubah, hapus, hapus massal,
  hapus semua, serta impor/ekspor Excel.
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
frontend/src/lib/db/schema.ts              → tabel purchaseOrders
frontend/src/lib/api/validation.ts         → purchaseOrderSchema, CURRENCIES, normalizeCurrency
frontend/src/lib/api/records.ts            → select, kondisi filter, CRUD PO, stripPricing
frontend/src/lib/api/excel.ts              → template/impor/ekspor modul purchase-orders
frontend/src/app/api/purchase-orders/route.ts        → GET, POST, DELETE (hapus semua)
frontend/src/app/api/purchase-orders/[id]/route.ts   → PATCH, DELETE
frontend/src/app/api/purchase-orders/bulk-delete/route.ts → POST
README.md                                  → schema, API, aturan akses
AGENTS.md                                  → catatan modul PO
```

Modul Excel `purchase-orders` harus terdaftar di `MASTER_MODULES`-nya `excel.ts`
(tabel + nama berkas) agar tiga endpoint `/api/excel/purchase-orders/{template,import,export}`
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
purchaseOrders (tabel: purchase_orders)
  id           integer PK auto
  poNumber     text NOT NULL              // diinput manual, boleh berulang
  productId    integer NOT NULL → products.id
  factoryId    integer NOT NULL → factories.id
  quantity     integer NOT NULL default 0
  pricePerPcs  integer NOT NULL default 0
  value        integer NOT NULL default 0 // = pricePerPcs × quantity
  currency     text NOT NULL default "Rp" // "Rp" | "USD" | "RMB"
  keterangan   text NOT NULL default ""
  createdAt / updatedAt

  UNIQUE (poNumber, productId)   // PO sama boleh banyak produk; produk sama tidak boleh dobel
  INDEX (factoryId), INDEX (poNumber)
```

SKU **tidak** disimpan di tabel ini: SKU melekat pada `products.sku` dan `productId`
sudah menjadi rujukannya. Menyalin SKU sebagai teks bebas akan membuat dua sumber
kebenaran yang bisa berbeda saat SKU produk diubah. Respons API tetap mengirim `sku`
hasil join supaya tabel dan form bisa menampilkannya.

## API Contract

| Method | Path | Akses | Perilaku |
|---|---|---|---|
| GET | `/api/purchase-orders` | user login | daftar + `productName`, `factoryName`, `sku`; role Pabrik ter-scope pabriknya dan tanpa price/total/currency |
| POST | `/api/purchase-orders` | admin | tambah; 409 bila `poNumber + productId` sudah ada; `value` dihitung server |
| PATCH | `/api/purchase-orders/{id}` | admin | ubah; 409 pada bentrok yang sama; `value` dihitung ulang |
| DELETE | `/api/purchase-orders/{id}` | admin | hapus satu baris |
| DELETE | `/api/purchase-orders` | admin | hapus semua + backup otomatis dulu |
| POST | `/api/purchase-orders/bulk-delete` | admin | `{ ids: number[] }` |
| GET | `/api/excel/purchase-orders/template` | admin | template kosong |
| POST | `/api/excel/purchase-orders/import` | admin | impor; baris duplikat dilewati |
| GET | `/api/excel/purchase-orders/export` | admin | ekspor; kolom harga/total/currency hanya untuk admin |

**Filter (GET)** — mengikuti Sales: `factoryId`, `productId`, `search`, ditambah
`keterangan`. Role Pabrik: `scopedFactoryId()` memaksa `factoryId` miliknya, parameter
`factoryId` dari klien diabaikan.

`search` mencocokkan `poNumber`, `keterangan`, `products.name`, `products.sku`,
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
- Menghapus data tanpa backup lebih dulu.
- Melonggarkan pemeriksaan (`@ts-ignore`, `eslint-disable`, tes dihapus) supaya hijau.

## Success Criteria

1. `npx tsc --noEmit` dan `npx eslint` bersih di `frontend/`.
2. **Admin** dapat menambah baris PO lewat `/po`; baris tersimpan dan muncul di tabel.
3. Menambah baris dengan `poNumber + produk` yang sama ditolak **409** dengan pesan
   berbahasa Indonesia; `poNumber` sama dengan produk berbeda **diterima**.
4. `value` di database selalu sama dengan `pricePerPcs × quantity`, termasuk setelah
   PATCH yang hanya mengubah `quantity`.
5. **Role Pabrik**: `GET /api/purchase-orders` tidak memuat kunci `pricePerPcs`,
   `value`, maupun `currency` pada baris mana pun, dan hanya memuat baris pabriknya.
6. Halaman `/po` menampilkan data nyata untuk kedua role: admin 7 kolom, pabrik 5 kolom
   tanpa tombol tambah/ubah/hapus.
7. Template, impor, dan ekspor Excel bekerja; impor melewati duplikat dengan alasan yang
   bisa dibaca dan melaporkan barisnya.
8. Hapus semua membuat berkas backup `backup-purchase-orders-*.db` lebih dulu.
9. Data lama tidak berubah: `products` 118 baris, `defects` 3.584, `sales` 1.008 tetap utuh.
10. `README.md` dan `AGENTS.md` memuat skema, endpoint, dan aturan akses modul PO.

## Open Questions

1. **Excel untuk PO**: ikut atau tidak? Spec ini **mengikutkan** karena frontend sudah
   memanggil ketiga endpoint itu dan konvensi repo ini memberi Excel ke setiap modul CRUD.
   Kalau tidak perlu, tiga endpoint itu dihapus dari lingkup dan tombolnya dilepas dari UI.
2. **Hapus semua + hapus massal**: frontend juga sudah menyiapkannya. Spec ini mengikutkan.
   Kalau PO dianggap data arsip yang tidak boleh dihapus massal, katakan sekarang.
3. **Uniqueness**: `poNumber + productId`. Kalau satu PO boleh memuat produk yang sama dua
   kali (mis. dua tanggal kirim berbeda), constraint ini harus dilonggarkan — dan tabel
   perlu kolom pembeda.
4. **`keterangan` per baris**: spec ini memperlakukannya sebagai milik baris. Kalau
   sebenarnya milik PO Number (satu keterangan untuk semua barisnya), bentuk tabelnya
   berbeda dan frontend perlu menyesuaikan.
5. **Desimal pada price/pcs**: saat ini `integer`. Kalau harga PO bisa pecahan
   (mis. USD 12,50), kolomnya harus berubah sebelum data masuk.
