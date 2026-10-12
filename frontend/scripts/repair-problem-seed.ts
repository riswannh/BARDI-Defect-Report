import { db } from "../src/lib/db";
import { problems } from "../src/lib/db/schema";
import { DEFAULT_REPAIR_SHEET_ID } from "../src/lib/gsheet/repair-mapping";
import { batchGetValues, type SheetCell } from "../src/lib/gsheet/values";
import { normalizeName } from "../src/lib/gsheet/mapping";

/**
 * Isi master Problem ("Teknis Device") dari tab Dropdown kolom B sheet Reparasi RFB.
 *
 * Idempotent: nama yang sudah ada dilewati, jadi aman dijalankan berulang.
 * Butuh kredensial service account (GOOGLE_SERVICE_ACCOUNT_FILE / _JSON) dan
 * akses DB — jalankan di server:
 *   npx tsx scripts/repair-problem-seed.ts
 */

const RANGE = "Dropdown!B2:B";

function text(cell: SheetCell | undefined): string {
  return typeof cell === "string" ? cell.trim() : "";
}

async function main() {
  const [range] = await batchGetValues(DEFAULT_REPAIR_SHEET_ID, [RANGE], "UNFORMATTED_VALUE");
  const sheetNames: string[] = [];
  const seen = new Set<string>();
  for (const row of range?.values ?? []) {
    const name = text(row[0]);
    if (!name) continue;
    const key = normalizeName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    sheetNames.push(name);
  }

  const existing = await db.select({ name: problems.name }).from(problems);
  const existingKeys = new Set(existing.map((row) => normalizeName(row.name)));
  const missing = sheetNames.filter((name) => !existingKeys.has(normalizeName(name)));

  if (missing.length > 0) {
    await db.insert(problems).values(missing.map((name) => ({ name }))).onConflictDoNothing();
  }

  console.log(
    `Teknis Device di sheet: ${sheetNames.length} | sudah ada: ${sheetNames.length - missing.length} | ditambahkan: ${missing.length}`
  );
  if (missing.length > 0) console.log(`Ditambahkan: ${missing.join("; ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Gagal mengisi master Teknis Device:", (error as Error).message);
    process.exit(1);
  });
