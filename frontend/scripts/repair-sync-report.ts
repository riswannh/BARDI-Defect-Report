import { writeFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { problems, products, spareParts } from "../src/lib/db/schema";
import { batchGetValues } from "../src/lib/gsheet/values";
import { normalizeName } from "../src/lib/gsheet/mapping";
import {
  DEFAULT_REPAIR_TAB,
  repairFieldsFromRow,
  repairSheetId,
  repairSheetRange,
  resolveRepairHeaderIndex,
} from "../src/lib/gsheet/repair-mapping";

/**
 * Daftar baris tab "Data Reparasi" yang tidak bisa masuk bersih ke aplikasi,
 * supaya bisa dibetulkan langsung di Google Sheet.
 *
 *   npx tsx scripts/repair-sync-report.ts [berkas-keluaran.csv]
 *
 * Alasan yang mungkin: produk belum ada di Data Master, tanggal kosong, tanpa
 * Claim ID, Claim ID kembar di sheet, Teknis Device / Sparepart tak dikenal.
 */

const OUT = process.argv[2] ?? "/tmp/repair-sync-gagal.csv";

function nameSet(rows: { name: string }[]): Set<string> {
  return new Set(rows.map((row) => normalizeName(row.name)));
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

async function main() {
  const tab = DEFAULT_REPAIR_TAB;
  const [first] = await batchGetValues(
    repairSheetId(),
    [repairSheetRange(tab)],
    "UNFORMATTED_VALUE"
  );
  const values = first?.values ?? [];
  const header = (values[0] ?? []).map((cell) => (cell == null ? "" : String(cell)));
  const { index } = resolveRepairHeaderIndex(header);

  const productNames = nameSet(db.select({ name: products.name }).from(products).all());
  const problemNames = nameSet(db.select({ name: problems.name }).from(problems).all());
  const spareNames = nameSet(db.select({ name: spareParts.name }).from(spareParts).all());

  const lines = ["Baris Sheet,Claim ID,Tanggal,Nama Produk di Sheet,Alasan"];
  const claimSeen = new Set<string>();
  let total = 0;
  let issues = 0;

  values.slice(2).forEach((cells, i) => {
    const sheetRow = i + 5;
    const fields = repairFieldsFromRow(cells, index);
    const reasons: string[] = [];

    if (!fields.claimId) {
      reasons.push("Tanpa Claim ID");
    } else if (claimSeen.has(fields.claimId)) {
      reasons.push("Claim ID kembar di sheet (baris pertama yang dipakai)");
    } else {
      claimSeen.add(fields.claimId);
    }

    if (!fields.date) reasons.push("Tanggal kosong/tidak dikenali");

    const productName = (fields.productId ?? "").trim();
    if (!productName) reasons.push("Nama produk kosong");
    else if (!productNames.has(normalizeName(productName)))
      reasons.push("Produk belum ada di Data Master");

    const problemName = (fields.problemId ?? "").trim();
    if (problemName && !problemNames.has(normalizeName(problemName)))
      reasons.push("Teknis Device belum ada di Data Master (nilainya dikosongkan)");

    for (const key of ["sparePart1Id", "sparePart2Id", "sparePart3Id"] as const) {
      const spareName = (fields[key] ?? "").trim();
      if (spareName && !spareNames.has(normalizeName(spareName)))
        reasons.push(`Sparepart belum ada di Data Master: ${spareName} (dikosongkan)`);
    }

    total += 1;
    if (reasons.length === 0) return;
    issues += 1;
    lines.push(
      [
        String(sheetRow),
        fields.claimId ?? "",
        fields.date ?? "",
        productName,
        reasons.join("; "),
      ]
        .map((cell) => csvCell(cell))
        .join(",")
    );
  });

  writeFileSync(OUT, `${lines.join("\n")}\n`, "utf8");
  console.log(`Baris sheet diperiksa: ${total} | baris bermasalah: ${issues}`);
  console.log(`Berkas: ${OUT}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Laporan sync gagal:", (error as Error).message);
    process.exit(1);
  });
