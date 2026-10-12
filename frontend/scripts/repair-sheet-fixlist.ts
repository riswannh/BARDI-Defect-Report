/**
 * Daftar baris sheet "Data Reparasi" yang perlu dibetulkan supaya sync penuh.
 * Keluaran: CSV (pemisah titik koma) ke stdout.
 * Jalankan di dalam kontainer: npx tsx scripts/repair-sheet-fixlist.ts > /tmp/fix.csv
 */
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { batchGetValues, type SheetCell } from "@/lib/gsheet/values";
import { normalizeName } from "@/lib/gsheet/mapping";
import { normalizeDateOnly } from "@/lib/api/validation";
import {
  REPAIR_FIRST_DATA_ROW,
  REPAIR_HEADER_ROW,
  repairFieldsFromRow,
  repairSheetId,
  repairSheetRange,
  repairSheetTab,
  resolveRepairHeaderIndex,
} from "@/lib/gsheet/repair-mapping";

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const csv = (value: unknown) => {
  const raw = String(value ?? "");
  return /[";\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
};

async function main() {
  const tab = repairSheetTab();
  const [first] = await batchGetValues(repairSheetId(), [repairSheetRange(tab)], "UNFORMATTED_VALUE");
  const values = first?.values ?? [];
  const header = (values[0] ?? []).map((cell) => text(cell));
  const resolved = resolveRepairHeaderIndex(header);
  const rows = values
    .slice(REPAIR_FIRST_DATA_ROW - REPAIR_HEADER_ROW)
    .map((cells: SheetCell[], i) => ({ sheetRow: i + REPAIR_FIRST_DATA_ROW, cells: cells ?? [] }));

  const productNames = new Set(
    (await db.select({ name: products.name }).from(products)).map((r) => normalizeName(r.name))
  );

  const out: string[] = [];
  out.push(["Bagian", "Baris sheet", "Claim ID", "Produk", "Quantity", "Tanggal", "Keterangan"].join(";"));

  const noClaim: string[][] = [];
  const noDate: string[][] = [];
  const dupes = new Map<string, { rows: number; qty: number }>();
  const missing = new Map<string, { rows: number; qty: number }>();
  const seen = new Set<string>();

  for (const row of rows) {
    const fields = repairFieldsFromRow(row.cells, resolved.index);
    const qty = Number.parseInt(fields.quantity || "0", 10) || 0;
    const claimId = text(fields.claimId ?? "");
    const product = text(fields.productId ?? "");
    const date = text(fields.date ?? "");

    if (claimId === "") {
      noClaim.push([
        "Tanpa Claim ID",
        String(row.sheetRow),
        "",
        product,
        String(qty),
        date,
        qty > 0 ? "ada unitnya tapi Claim ID kosong" : "baris belum diisi",
      ]);
      continue;
    }
    if (seen.has(claimId)) {
      const entry = dupes.get(claimId) ?? { rows: 0, qty: 0 };
      dupes.set(claimId, { rows: entry.rows + 1, qty: entry.qty + qty });
      continue;
    }
    seen.add(claimId);
    if (!productNames.has(normalizeName(product))) {
      const key = product === "" ? "(sel produk kosong)" : product;
      const entry = missing.get(key) ?? { rows: 0, qty: 0 };
      missing.set(key, { rows: entry.rows + 1, qty: entry.qty + qty });
      continue;
    }
    if (!normalizeDateOnly(date)) {
      noDate.push([
        "Tanggal kosong",
        String(row.sheetRow),
        claimId,
        product,
        String(qty),
        date,
        "tanggal tidak terbaca",
      ]);
    }
  }

  noClaim.forEach((line) => out.push(line.map(csv).join(";")));
  noDate.forEach((line) => out.push(line.map(csv).join(";")));
  [...missing.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .forEach(([name, v]) =>
      out.push(
        [
          "Produk belum ada di Data Master",
          "",
          "",
          name,
          String(v.qty),
          "",
          `${v.rows} baris — tambah produknya atau betulkan nama di sheet`,
        ]
          .map(csv)
          .join(";")
      )
    );
  [...dupes.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .forEach(([claimId, v]) =>
      out.push(
        [
          "Claim ID ganda",
          "",
          claimId,
          "",
          String(v.qty),
          "",
          `${v.rows} baris tambahan dengan Claim ID sama — gabung jadi satu baris atau pakai Claim ID berbeda`,
        ]
          .map(csv)
          .join(";")
      )
    );

  console.log(out.join("\n"));
  console.error(
    `tanpa Claim ID: ${noClaim.length} | tanggal kosong: ${noDate.length} | produk asing: ${missing.size} | Claim ID ganda: ${dupes.size}`
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
