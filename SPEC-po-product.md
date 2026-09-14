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
frontend/src/lib/api/validation.ts         → purchaseOrderSchema (termasuk poDate),
                                             keteranganSchema, CURRENCIES, normalizeCurrency
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
frontend/src/app/(dashboard)/po/page.tsx             → dropdown & filter keterangan, filter bulan/tahun
frontend/src/app/(dashboard)/po/po-form-dialog.tsx   → pilih keterangan dari dropdown, isian tanggal PO
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
  poDate       text NOT NULL              // TANGGAL PO, diisi manual operator
                                          // format `YYYY-MM-DDTHH:mm` (sama seperti defect)
  productId    integer NOT NULL → products.id
  factoryId    integer NOT NULL → factories.id
  quantity     integer NOT NULL default 0
  pricePerPcs  real    NOT NULL default 0 // BOLEH PECAHAN (mis. USD 12.50)
  value        real    NOT NULL default 0 // = pricePerPcs × quantity
  currency     text NOT NULL default "Rp" // "Rp" | "USD" | "RMB"
  ppn          text NOT NULL default "Non PPN" // "PPN" | "Non PPN", hanya penanda
  keteranganId integer → keterangan.id    // dropdown, bukan teks bebas
  createdAt / updatedAt

  UNIQUE (poNumber, productId)   // SENGAJA TIDAK ADA — lihat "Keputusan 1.3"
  INDEX (factoryId), INDEX (poNumber), INDEX (keteranganId), INDEX (poDate)
```

**Tidak ada constraint unik di tabel ini.** User memutuskan (keputusan 1.3) bahwa satu
PO Number boleh diinput berkali-kali, termasuk untuk produk yang sama, tanpa kolom
pembeda. Jadi tidak ada aturan yang menolak baris duplikat — lihat bagian di bawah.

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

### Keputusan — SKU dan Product digabung jadi satu input di form

Di form PO, **SKU Product dan Product bukan dua isian terpisah**. Yang tampil hanya
**satu dropdown bernama Product**, dan yang ditampilkan adalah **nama produk tanpa SKU**.

Yang tersimpan ke database tetap keduanya:

- `purchase_orders.productId` — foreign key ke `products.id` (sumber kebenaran baris PO)
- `products.sku` — melekat pada produknya, ikut terkirim di respons API sebagai `sku`

Jadi SKU tetap ada di database dan tetap bisa dipakai di luar form PO (Data Master,
ekspor Excel, pencarian), tetapi **tidak ditampilkan** di form PO maupun di kolom tabel
halaman PO. Konsekuensinya:

- Label dropdown hanya nama produk; SKU tidak muncul sebagai teks pendamping.
- Kotak pencarian dropdown mencocokkan **nama produk** saja.
- Pencarian di halaman (`search`) tetap boleh mencocokkan `products.sku` — itu pencarian
  lintas kolom, bukan tampilan label.
- `sku` tetap dikirim di respons API PO supaya konsumen lain (mis. ekspor Excel) tidak
  kehilangan informasi; hanya UI form PO yang tidak menampilkannya.

### Keputusan — Timestamp PO diisi manual, bukan waktu input

Ada kolom **Timestamp** di tabel (tepat setelah PO Number) dan isian
**datetime-local** di form. Isinya adalah **tanggal PO** yang diisi operator,
bukan waktu baris itu diinput. Operator memakainya untuk mencatat tanggal PO
diterbitkan atau tanggal kesepakatan dengan pabrik, yang bisa berbeda dari
kapan datanya dimasukkan ke aplikasi.

Konsekuensi teknis:

- Kolom database bernama `poDate` bertipe `text`, format `YYYY-MM-DDTHH:mm` —
  sama persis dengan `defects.timeStamp`, sehingga normalisasi dan tampilan bisa
  memakai helper yang sudah ada (`normalizeTimestamp`, `formatDateTime`).
- Form mengisinya otomatis dengan **waktu sekarang** sebagai default (seperti
  form Defect), tapi operator bisa mengubahnya. `poDate` wajib diisi.
- Filter per bulan dan tahun membaca `poDate`, langsung dari string (bukan lewat
  `Date`) supaya tidak bergeser karena konversi zona waktu.
- `createdAt`/`updatedAt` tetap ada sebagai jejak audit, tetapi **tidak**
  ditampilkan di tabel.

### Keputusan — PPN/Non PPN hanya penanda, dan tidak terlihat oleh Pabrik

Ada dropdown **PPN** di form dengan dua pilihan: `PPN` dan `Non PPN` (default
`Non PPN`). Nilainya **tidak ikut dihitung ke `value`** — Total tetap
`pricePerPcs × quantity`; tidak ada kolom nilai pajak maupun DPP.

- Kolom database `ppn` bertipe `text` dengan default `Non PPN`, dinormalkan
  `normalizePpn()` sehingga variasi penulisan (`ppn`, `non-ppn`, `PPN 11%`) tetap
  diterima.
- **Role Pabrik tidak boleh melihatnya.** Field `ppn` dihapus dari respons API
  bersama `pricePerPcs`/`value`/`currency` oleh `stripPoFinance()`, dan kolomnya
  juga tidak ikut pada ekspor Excel untuk Pabrik. Konsekuensinya: aturan
  penyembunyian PO bukan lagi sekadar "field harga", jadi fungsinya diganti nama
  dari `stripPricing()` menjadi `stripPoFinance()`.
- Kolom tabel dan ekspor admin memuat `PPN` di antara `Quantity` dan `Price/pcs`.

### Keputusan 1.3 — tanpa kolom pembeda (SUDAH DIPUTUSKAN)

User memutuskan: **tidak perlu kolom pembeda**. Satu PO Number boleh diinput berkali-kali,
termasuk dengan produk yang sama, dan sistem tidak menolaknya.

Konsekuensinya yang perlu diketahui:

- **Tidak ada `UNIQUE`** di `purchase_orders`. Duplikat persis (PO Number + produk + qty +
  harga sama) tetap bisa tersimpan sebagai dua baris berbeda; id-nya yang membedakan.
- Tidak ada validasi duplikat di POST maupun PATCH, jadi tidak ada pesan 409 untuk PO.
- Karena tidak ada pembeda, dua baris dengan isi identik tidak bisa dibedakan di tabel
  selain dari id. Kalau operator salah input dua kali, barisnya harus dihapus manual.
- Halaman PO **tidak** melakukan pencegahan duplikat. Kalau nanti dirasa perlu peringatan
  lunak (mis. "PO + produk ini sudah ada, tetap simpan?"), itu perubahan terpisah.

Impor Excel juga mengikuti aturan yang sama: baris tidak dianggap duplikat karena
PO Number-nya sama. Satu-satunya penolakan di impor adalah data yang tidak valid
(produk/pabrik/keterangan tidak ditemukan, qty atau harga bukan angka).

## API Contract

| Method | Path | Akses | Perilaku |
|---|---|---|---|
| GET | `/api/purchase-orders` | user login | daftar + `productName`, `factoryName`, `sku`, `keteranganName`; role Pabrik ter-scope pabriknya dan tanpa price/total/currency |
| POST | `/api/purchase-orders` | admin | tambah; **tanpa** pemeriksaan duplikat (lihat keputusan 1.3); `value` dihitung server |
| PATCH | `/api/purchase-orders/{id}` | admin | ubah; `value` dihitung ulang |
| DELETE | `/api/purchase-orders/{id}` | admin | hapus satu baris |
| DELETE | `/api/purchase-orders` | admin | hapus semua + backup otomatis dulu |
| POST | `/api/purchase-orders/bulk-delete` | admin | `{ ids: number[] }` |
| GET/POST | `/api/keterangan` | GET user login, POST admin | master keterangan (tambah: `name` unik) |
| PATCH/DELETE | `/api/keterangan/{id}` | admin | ubah / hapus (409 bila masih dipakai baris PO) |
| DELETE | `/api/keterangan` | admin | hapus semua + backup |
| GET | `/api/excel/purchase-orders/template` | admin | template kosong |
| POST | `/api/excel/purchase-orders/import` | admin | impor; baris tidak valid dilaporkan, tanpa deteksi duplikat |
| GET | `/api/excel/purchase-orders/export` | admin | ekspor; kolom harga/total/currency hanya untuk admin |
| GET/POST/PATCH/DELETE | `/api/excel/keterangan/{template,import,export}` | admin | Excel untuk master keterangan, mengikuti master lain |

**Filter (GET)** — mengikuti Sales: `factoryId`, `productId`, `search`, ditambah
`keteranganId` serta `month` dan `year` (memakai `poDate`). Role Pabrik:
`scopedFactoryId()` memaksa `factoryId` miliknya, parameter `factoryId` dari klien
diabaikan.

`search` mencocokkan `poNumber`, `keterangan.name`, `products.name`, `products.sku`,
`factories.name`.

**Impor Excel** — tidak ada deteksi duplikat (lihat keputusan 1.3). Baris ditolak hanya
kalau datanya tidak valid: `poNumber` kosong, produk/pabrik/keterangan tidak ditemukan,
atau qty/harga bukan angka. Alasan penolakan menyebut barisnya.

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

- Mengirim `pricePerPcs`, `value`, `currency`, atau `ppn` ke sesi role Pabrik.
- Memakai `requireUser` pada operasi tulis — semua tulis wajib `requireAdmin`.
- Menyimpan SKU sebagai kolom teks di `purchase_orders`.
- Menambahkan `UNIQUE` pada `purchase_orders` — duplikat PO Number memang diizinkan
  (keputusan 1.3).
- Menampilkan SKU sebagai isian atau kolom terpisah di form dan tabel halaman PO
  (keputusan: SKU dan Product digabung jadi satu dropdown Product).
- Menyimpan keterangan sebagai teks bebas di `purchase_orders`; yang disimpan adalah `keteranganId`.
- Menghapus data tanpa backup lebih dulu.
- Melonggarkan pemeriksaan (`@ts-ignore`, `eslint-disable`, tes dihapus) supaya hijau.

## Success Criteria

1. `npx tsc --noEmit` dan `npx eslint` bersih di `frontend/`.
2. **Admin** dapat menambah baris PO lewat `/po`; baris tersimpan dan muncul di tabel.
   Form hanya punya **satu dropdown Product** (tanpa isian SKU terpisah), dan yang
   tersimpan ke database tetap `productId` **beserta** `sku` produknya.
3. Menambah dua baris dengan `poNumber` dan produk yang sama **diterima** — sistem tidak
   menolak duplikat (keputusan 1.3), dan keduanya tersimpan sebagai baris terpisah.
4. `value` di database selalu sama dengan `pricePerPcs × quantity`, termasuk setelah
   PATCH yang hanya mengubah `quantity`, dan **tetap benar untuk harga pecahan**
   (mis. 12.50 × 1.000 = 12.500).
5. **Role Pabrik**: `GET /api/purchase-orders` tidak memuat kunci `pricePerPcs`,
   `value`, `currency`, maupun `ppn` pada baris mana pun, dan hanya memuat baris pabriknya.
6. Halaman `/po` menampilkan data nyata untuk kedua role: admin 8 kolom (PO Number,
   Timestamp, Keterangan, Nama Produk, Pabrik, Quantity, Price/pcs, Total Currency),
   pabrik 6 kolom tanpa price/total/currency dan tanpa tombol tambah/ubah/hapus.
7. **Timestamp PO** tersimpan sesuai yang diisi operator (bukan waktu input), dan
   filter Bulan/Tahun menyaring berdasarkan `poDate` itu. Memilih satu bulan
   menyisakan hanya baris pada bulan tersebut.
8. **Master keterangan** bisa ditambah, diubah, dan dihapus dari Data Master; namanya
   muncul di dropdown form PO; menghapusnya ditolak **409** selama masih dipakai baris PO.
9. Template, impor, dan ekspor Excel bekerja untuk PO **dan** keterangan; impor PO
   hanya menolak baris yang datanya tidak valid, bukan baris yang PO-nya sama.
10. Hapus semua membuat berkas backup `backup-purchase-orders-*.db` lebih dulu.
11. Data lama tidak berubah: `products` 118 baris, `defects` 3.584, `sales` 1.008 tetap utuh.
12. `README.md` dan `AGENTS.md` memuat skema, endpoint, dan aturan akses modul PO.

## Open Questions

**Sudah diputuskan (jangan dibuka lagi tanpa alasan baru):**

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Excel untuk PO | **Ikut** — template, impor, ekspor |
| 2 | Hapus semua + hapus massal | **Ikut**, dengan backup otomatis lebih dulu |
| 3 | Kolom pembeda untuk PO Number yang sama | **Tidak perlu pembeda.** PO Number boleh diinput berkali-kali, termasuk produk yang sama, tanpa validasi duplikat |
| 4 | `keterangan` per baris atau per PO | **Per baris**, dan berupa **master** yang bisa di-CRUD, dipilih lewat dropdown |
| 5 | Price/pcs bilangan bulat? | **Boleh pecahan** — kolom `real`, tampilan 2 desimal untuk USD/RMB |
| 6 | SKU Product sebagai isian terpisah di form | **Tidak.** Digabung jadi satu dropdown Product yang menampilkan nama produk; database tetap menyimpan `productId` dan `sku` |
| 7 | Isi kolom Timestamp | **Tanggal PO yang diisi manual operator** (`poDate`, format `YYYY-MM-DDTHH:mm`), bukan waktu input |
| 8 | Filter per bulan | **Ikut**, memakai `poDate`, dengan tambahan filter tahun |

**Tidak ada pertanyaan yang menghalangi implementasi.** Spec siap masuk fase PLAN
begitu user menyetujui.

**Catatan kecil yang tidak menghalangi (saya putuskan sendiri bila tidak dijawab):**

- **Lebar kolom keterangan.** Kolom Keterangan di tabel dipotong (`max-w-48`) dan nama
  lengkapnya muncul di tooltip. Kalau namanya biasanya panjang, kolomnya bisa dilebarkan
  dengan memangkas filter Produk/Pabrik.
- **Filter Produk/Pabrik.** Frontend menampilkan keduanya (mengikuti Sales) ditambah filter
  Keterangan, sehingga ada empat kontrol filter. Bisa dipangkas bila dianggap terlalu banyak.
