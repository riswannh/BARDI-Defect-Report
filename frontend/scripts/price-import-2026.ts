/**
 * Impor SEKALI harga produk 2026 dari spreadsheet "Price List 2026 - Fixed (New)".
 *
 * Bukan fitur sync: skrip CLI yang dijalankan manual (dan hanya sekali) untuk
 * mengganti harga master 2026 bulan Jan/Mei/Jun/Jul/Agu dengan angka dari sheet.
 * Kolom: C Produk, F Website, G Reseller, H Key Account, I Buyback,
 * J Collection Point, K Experience Store, L Regional Warehouse.
 *
 * Pakai: DB_FILE_NAME=<db> GOOGLE_SERVICE_ACCOUNT_FILE=<sa.json> \
 *        npx tsx scripts/price-import-2026.ts [--apply]
 * Tanpa --apply hanya mencetak rencana (dry run, tidak menulis apa pun).
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { productPrices, products } from "@/lib/db/schema";
import { PRICE_TYPES, type PriceType } from "@/lib/api/validation";
import { batchGetValues, getSpreadsheetMeta } from "@/lib/gsheet/values";
import { sqliteClient } from "@/lib/db";

const SHEET_ID = "1S-7VFCW5w8KlyrMq9PcFdsnTHOk4KqBiUsm-3NOrsEY";
const YEAR = "2026";
/** Tab sheet -> bulan dua digit di `product_prices.month`. */
const TABS: { tab: string; month: string }[] = [
  { tab: "PL 26 ( JAN )", month: "01" },
  { tab: "PL 26 ( MEI )", month: "05" },
  { tab: "PL 26 ( JUN )", month: "06" },
  { tab: "PL 26 ( JUL )", month: "07" },
  { tab: "PL 26 ( AGS )", month: "08" },
];
/** Kolom harga F..L sejajar dengan PRICE_TYPES. */
const PRICE_COLUMNS = [5, 6, 7, 8, 9, 10, 11];

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/[^0-9.,-]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

async function main() {
  const apply = process.argv.includes("--apply");

  const meta = await getSpreadsheetMeta(SHEET_ID);
  const hilang = TABS.filter((t) => !meta.tabs.includes(t.tab)).map((t) => t.tab);
  if (hilang.length) throw new Error(`Tab tidak ada di spreadsheet: ${hilang.join(", ")}`);

  const master = await db
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products);
  const bySku = new Map<string, number>();
  const byName = new Map<string, number[]>();
  const namaId = new Map<number, string>();
  for (const row of master) {
    if (row.sku && String(row.sku).trim()) bySku.set(norm(row.sku), row.id);
    const key = norm(row.name);
    byName.set(key, [...(byName.get(key) ?? []), row.id]);
    namaId.set(row.id, row.name);
  }

  const ranges = TABS.map((t) => `'${t.tab}'!A3:L`);
  const values = await batchGetValues(SHEET_ID, ranges, "UNFORMATTED_VALUE");

  type Rencana = { productId: number; month: string; priceType: PriceType; price: number };
  const rencana: Rencana[] = [];
  const laporan: string[] = [];
  const skuBeda: string[] = [];
  const perJenis = new Map<string, number>();
  const produkSheet = new Set<number>();

  values.forEach((vr, index) => {
    const { tab, month } = TABS[index];
    const rows = vr.values ?? [];
    let baris = 0;
    let terpakai = 0;
    const gagal: string[] = [];
    const kosong: string[] = [];
    let judul = 0;
    for (const row of rows) {
      const nama = String(row[2] ?? "").trim();
      if (!nama) continue;
      const sku = norm(row[0]);
      // Baris judul seri ("Electrical Series", "Discontinued", …): nama terisi
      // tapi tanpa SKU dan tanpa satu pun harga — bukan produk.
      if (!sku && PRICE_COLUMNS.every((i) => toNumber(row[i]) === null)) {
        judul += 1;
        continue;
      }
      baris += 1;
      // NAMA didahulukan: kolom SKU di sheet kadang salah salin (baris "Smart
      // Breaker" memakai SKU milik "Smart Portable Plug"), jadi SKU hanya dipakai
      // kalau namanya tidak ada di Data Master.
      const kandidat = byName.get(norm(nama)) ?? [];
      let id: number | undefined;
      if (kandidat.length === 1) {
        id = kandidat[0];
        const dariSku = sku ? bySku.get(sku) : undefined;
        if (dariSku && dariSku !== id) {
          skuBeda.push(`${nama} — SKU sheet ${row[0]} milik "${namaId.get(dariSku) ?? `#${dariSku}`}"; nama yang dipakai`);
        }
      } else if (kandidat.length > 1) {
        gagal.push(`${nama} — nama ganda di Data Master, tidak aman dipilih otomatis`);
        continue;
      } else if (sku) {
        id = bySku.get(sku);
      }
      if (!id) {
        gagal.push(`${nama}${sku ? ` (SKU ${row[0]})` : ""} — produk tidak ada di Data Master`);
        continue;
      }
      produkSheet.add(id);
      let adaHarga = false;
      PRICE_TYPES.forEach((priceType, i) => {
        const price = toNumber(row[PRICE_COLUMNS[i]]);
        if (price === null || price <= 0) return;
        adaHarga = true;
        rencana.push({ productId: id, month, priceType, price });
        const k = `${month}|${priceType}`;
        perJenis.set(k, (perJenis.get(k) ?? 0) + 1);
      });
      if (adaHarga) terpakai += 1;
      else kosong.push(`${nama} — semua kolom harga kosong`);
    }
    laporan.push(
      [
        `${tab} (bulan ${month}): ${baris} baris produk, ${terpakai} terpakai, ${judul} baris judul seri dilewati`,
        gagal.length ? `  produk dilewati (${gagal.length}):\n    ${gagal.join("\n    ")}` : "  produk dilewati: 0",
        kosong.length ? `  tanpa harga: ${kosong.join("; ")}` : "  tanpa harga: 0",
      ].join("\n")
    );
  });

  const bulan = TABS.map((t) => t.month);
  const sekarang = await db
    .select({
      id: productPrices.id,
      productId: productPrices.productId,
      month: productPrices.month,
      priceType: productPrices.priceType,
      price: productPrices.price,
    })
    .from(productPrices)
    .where(and(eq(productPrices.year, YEAR), inArray(productPrices.month, bulan)));

  const key = (productId: number, month: string, priceType: string) => `${productId}|${month}|${priceType}`;
  const petaSekarang = new Map(sekarang.map((row) => [key(row.productId, row.month, row.priceType), row]));
  const petaRencana = new Map<string, Rencana>();
  for (const item of rencana) petaRencana.set(key(item.productId, item.month, item.priceType), item);
  console.log(`\nBaris harga unik setelah duplikat dibuang: ${petaRencana.size} (dari ${rencana.length} baris sheet)`);

  let baru = 0;
  let diubah = 0;
  let tetap = 0;
  for (const [k, item] of petaRencana) {
    const ada = petaSekarang.get(k);
    if (!ada) baru += 1;
    else if (Math.abs(ada.price - item.price) > 0.001) diubah += 1;
    else tetap += 1;
  }
  const usang = sekarang.filter((row) => !petaRencana.has(key(row.productId, row.month, row.priceType)));

  const namaProduk = new Map(master.map((row) => [row.id, row.name]));
  const namaProdukRingkas = new Map(master.map((row) => [row.id, row.name.replace(/^BARDI\s+/i, "")]));

  // Satu (produk, bulan, jenis) hanya boleh muncul sekali: tab sheet kadang
  // memuat produk yang sama dua kali (mis. di bagian "Discontinued").
  const hitung = new Map<string, number>();
  for (const item of rencana) {
    const k = key(item.productId, item.month, item.priceType);
    hitung.set(k, (hitung.get(k) ?? 0) + 1);
  }
  const dobel = [...hitung.entries()].filter(([, n]) => n > 1);
  if (dobel.length) {
    console.log(`\nDUPLIKAT di sheet (${dobel.length} kunci) — harga terakhir di tab yang dipakai:`);
    for (const [k, n] of dobel.slice(0, 40)) {
      const [productId, month, priceType] = k.split("|");
      console.log(`  ${namaProdukRingkas.get(Number(productId)) ?? productId} | ${month} ${priceType} | ${n} baris`);
    }
    if (dobel.length > 40) console.log(`  … dan ${dobel.length - 40} kunci lagi`);
  }
  const refCount = new Map<number, number>();
  const refRows = sqliteClient
    .prepare(
      `select productPriceId as id, count(*) as n from repairs where productPriceId is not null group by productPriceId
       union all select productPriceId, count(*) from purchase_orders where productPriceId is not null group by productPriceId
       union all select productPriceId, count(*) from defects where productPriceId is not null group by productPriceId`
    )
    .all() as { id: number; n: number }[];
  for (const row of refRows) refCount.set(row.id, (refCount.get(row.id) ?? 0) + row.n);

  console.log(laporan.join("\n"));
  const skuUnik = [...new Set(skuBeda)];
  console.log(`\nSKU di sheet tidak cocok dengan produk bernama sama (${skuUnik.length} baris, nama yang dipakai):`);
  for (const item of skuUnik.slice(0, 30)) console.log(`  ${item}`);
  if (skuUnik.length > 30) console.log(`  … dan ${skuUnik.length - 30} baris lagi`);
  console.log(`\nTotal baris harga yang akan ditulis: ${rencana.length}`);
  console.log(`Harga 2026 yang ada sekarang (Jan/Mei/Jun/Jul/Agu): ${sekarang.length}`);
  console.log(`  baru: ${baru} | diubah: ${diubah} | tetap sama: ${tetap}`);
  console.log(`\nHarga yang BERUBAH (${diubah} baris):`);
  for (const [k, item] of petaRencana) {
    const ada = petaSekarang.get(k);
    if (!ada || Math.abs(ada.price - item.price) <= 0.001) continue;
    console.log(
      `  ${namaProdukRingkas.get(item.productId) ?? `#${item.productId}`} | ${item.month} ${item.priceType} | Rp ${ada.price.toLocaleString("id-ID")} -> Rp ${item.price.toLocaleString("id-ID")}`
    );
  }
  console.log(`\nBaris baru per bulan/jenis:`);
  for (const [k, n] of [...perJenis.entries()].sort()) console.log(`  ${k}: ${n}`);
  console.log(`\nMasih ada di app tapi TIDAK ada di sheet (${usang.length} baris):`);
  for (const row of usang.slice(0, 40)) {
    const ref = refCount.get(row.id) ?? 0;
    console.log(
      `  ${namaProduk.get(row.productId) ?? `#${row.productId}`} | ${row.month} ${row.priceType} | Rp ${row.price.toLocaleString("id-ID")} | dipakai ${ref} baris transaksi`
    );
  }
  if (usang.length > 40) console.log(`  … dan ${usang.length - 40} baris lagi`);
  const usangTerpakai = usang.filter((row) => (refCount.get(row.id) ?? 0) > 0).length;
  console.log(`  ringkas: ${usang.length - usangTerpakai} baris tidak dirujuk transaksi, ${usangTerpakai} baris masih dirujuk`);

  if (!apply) {
    console.log("\nDRY RUN — tidak ada yang ditulis. Tambahkan --apply untuk menyimpan.");
    return;
  }

  const hasil = db.transaction((tx) => {
    let insert = 0;
    let update = 0;
    for (const item of petaRencana.values()) {
      const ada = petaSekarang.get(key(item.productId, item.month, item.priceType));
      if (ada) {
        if (Math.abs(ada.price - item.price) > 0.001) {
          tx.update(productPrices)
            .set({ price: item.price, updatedAt: new Date() })
            .where(eq(productPrices.id, ada.id))
            .run();
          update += 1;
        }
      } else {
        tx.insert(productPrices)
          .values({
            productId: item.productId,
            month: item.month,
            year: YEAR,
            priceType: item.priceType,
            price: item.price,
          })
          .run();
        insert += 1;
      }
    }
    // Baris lama yang tidak dirujuk transaksi apa pun boleh dibuang supaya
    // tidak ada harga salah yang tertinggal; yang masih dirujuk dibiarkan.
    let hapus = 0;
    for (const row of usang) {
      if ((refCount.get(row.id) ?? 0) > 0) continue;
      tx.delete(productPrices).where(eq(productPrices.id, row.id)).run();
      hapus += 1;
    }
    return { insert, update, hapus };
  });

  console.log(`\nSELESAI — baris baru: ${hasil.insert} | diperbarui: ${hasil.update} | dibuang: ${hasil.hapus}`);
  console.log(`Produk master yang tersentuh: ${produkSheet.size} dari ${master.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("GAGAL:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
