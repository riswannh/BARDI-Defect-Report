/**
 * Probe READ-ONLY kredensial + akses Google Sheet sebelum fitur sync dipakai.
 *   GOOGLE_SERVICE_ACCOUNT_FILE=<path sa.json> npx tsx scripts/gsheet-probe.ts
 *
 * Tidak ada kode tulis di sini — tab "Big Data" kolom A:H diisi ARRAYFORMULA,
 * jadi jangan pernah menulis ke sheet lewat skrip apa pun.
 */
import { serviceAccountEmail, GsheetError } from "../src/lib/gsheet/auth";
import { batchGetValues, getSpreadsheetMeta } from "../src/lib/gsheet/values";

const SHEET_ID =
  process.env.GSHEET_ID ?? "1TzJAH7mgIp8OK4l_VsE1GSYAp-IldcyM7TQwmdC8S3U";
const TAB = process.env.GSHEET_TAB ?? "Big Data";

(async () => {
  try {
    console.log("service account:", serviceAccountEmail());
    const meta = await getSpreadsheetMeta(SHEET_ID);
    console.log("judul spreadsheet:", meta.title);
    console.log("jumlah tab:", meta.tabs.length, meta.tabs.includes(TAB) ? `(ada "${TAB}")` : `(TAB "${TAB}" TIDAK ADA)`);

    const [head] = await batchGetValues(SHEET_ID, [`'${TAB}'!A1:O1`]);
    console.log("header:", JSON.stringify(head?.values?.[0] ?? []));
    const [sample] = await batchGetValues(SHEET_ID, [`'${TAB}'!A2:O2`]);
    console.log("baris 2:", JSON.stringify(sample?.values?.[0] ?? []).slice(0, 220));
    const [formula] = await batchGetValues(SHEET_ID, [`'${TAB}'!A1:A1`], "FORMULA");
    console.log("A1 (formula sumber kolom A:H):", JSON.stringify(formula?.values?.[0]?.[0] ?? ""));
    console.log("\nHASIL: akses baca OK (mode read-only).");
  } catch (err) {
    if (err instanceof GsheetError) {
      console.log(`\nHASIL: GAGAL [${err.code}] ${err.message}`);
      if (err.detail) console.log("detail:", err.detail);
    } else {
      console.log("\nHASIL: GAGAL tak terduga:", (err as Error).message);
    }
    process.exitCode = 1;
  }
})();
