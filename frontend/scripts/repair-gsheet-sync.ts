import { runRepairSync } from "../src/lib/api/repair-gsheet";

/**
 * Tarik tab "Data Reparasi" (sheet Reparasi RFB) ke tabel `repairs` dari baris
 * perintah — dipakai sekali saat pemasangan pertama supaya 5.145 baris lama ikut
 * masuk tanpa harus klik dari browser (butuh kredensial service account).
 *
 *   npx tsx scripts/repair-gsheet-sync.ts
 *
 * Aturan sync sama persis dengan tombol "Sync Google Sheet" di halaman Repair
 * Data: baris baru ditambah, perubahan sheet menimpa nilai app yang belum
 * diubah, dan nilai Saving Value di app tidak pernah ditimpa.
 */

async function main() {
  const { result, summary, tab } = await runRepairSync();

  console.log(`Tab: ${tab}`);
  console.log(
    `Baris sheet: ${result.totalRows} | masuk: ${result.inserted} | dilewati: ${result.skipped} | gagal: ${result.errors.length}`
  );
  console.log(
    `Ringkasan — baru: ${summary.created} | diperbarui: ${summary.updated} | tetap: ${summary.unchanged} | app dipertahankan: ${summary.keepLocal}`
  );
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
    console.error("Sync Google Sheet Repair gagal:", (error as Error).message);
    process.exit(1);
  });
