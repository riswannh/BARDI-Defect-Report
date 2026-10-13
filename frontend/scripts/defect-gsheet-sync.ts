import { runSync } from "../src/lib/api/gsheet";

/**
 * Tarik tab "Big Data" (sheet Data Garansi Produk) ke tabel `defects` dari baris
 * perintah — untuk pemasangan/penyelarasan angka tanpa harus klik dari browser
 * (butuh kredensial service account di server).
 *
 *   npx tsx scripts/defect-gsheet-sync.ts
 *
 * Aturan sync sama persis dengan tombol "Sync Google Sheet" di halaman Defect,
 * termasuk menghitung ulang `value` semua baris dari Price List (quantity ×
 * harga master bulan timestamp).
 */

async function main() {
  const { summary, issues, conflicts, tab } = await runSync({});

  console.log(`Tab: ${tab}`);
  console.log(
    `Ringkasan — baris diperbarui: ${summary.rowsUpdated} | field masuk: ${summary.appliedFields} | konflik: ${summary.conflicts} | dilewati: ${summary.skipped} | app-only: ${summary.appOnlyChanges}`
  );
  if (conflicts.length > 0) {
    console.log(`Konflik (maks ${conflicts.length}):`);
    for (const item of conflicts.slice(0, 20)) {
      console.log(
        `- baris ${item.sheetRow} (${item.codeGaransi}): ${item.fields.map((f) => f.field).join(", ")}`
      );
    }
  }
  if (issues.length > 0) {
    console.log(`Catatan (maks ${issues.length}):`);
    for (const item of issues.slice(0, 20)) {
      console.log(`- ${item.row ? `baris ${item.row} ` : ""}${item.reason}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Sync Google Sheet Defect gagal:", (error as Error).message);
    process.exit(1);
  });
