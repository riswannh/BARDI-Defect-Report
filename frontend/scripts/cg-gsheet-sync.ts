import { runWarrantySync } from "../src/lib/api/warranty-gsheet";

/**
 * Tarik tab "Raw Combine CG" (sheet Data Garansi Produk) ke tabel
 * `warranty_claims` dari baris perintah — dipakai saat pemasangan pertama
 * supaya ribuan baris lama ikut masuk tanpa klik dari browser (butuh
 * kredensial service account).
 *
 *   npx tsx scripts/cg-gsheet-sync.ts
 *
 * Aturan sync sama dengan tombol "Sync Google Sheet" di halaman Claim Garansi:
 * sheet = sumber semua kolom, nilai Rupiah dihitung app dari Price List.
 */

async function main() {
  const { result, summary, tab } = await runWarrantySync();

  console.log(`Tab: ${tab}`);
  console.log(
    `Baris sheet: ${result.totalRows} | masuk: ${result.inserted} | dilewati: ${result.skipped} | gagal: ${result.errors.length}`
  );
  console.log(
    `Ringkasan — baru: ${summary.created} | diperbarui: ${summary.updated} | tetap: ${summary.unchanged} | baris kosong: ${summary.skippedEmpty} | tanpa timestamp: ${summary.skippedNoTimestamp} | dibuang: ${summary.removedNoTimestamp}`
  );
  console.log(
    `Tidak lengkap: ${summary.incompleteRows} | hanya di app: ${summary.onlyInApp}`
  );
  if (summary.unknownProducts.length > 0) {
    console.log("Produk belum ada di Data Master (maks 20):");
    for (const name of summary.unknownProducts) console.log(`- ${name}`);
  }
  if (result.errors.length > 0) {
    console.log("Catatan gagal (maks 20):");
    for (const item of result.errors.slice(0, 20)) {
      console.log(`- baris ${item.row} (${item.key}): ${item.reason}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Sync Google Sheet Claim Garansi gagal:", (error as Error).message);
    process.exit(1);
  });
