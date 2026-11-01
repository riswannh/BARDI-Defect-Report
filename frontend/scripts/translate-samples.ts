/**
 * Uji MUTU terjemahan id -> en pada data nyata: mengambil sampel acak
 * `defects.problemDetail` dari database, menerjemahkannya lewat LibreTranslate
 * self-host, lalu mencetak pasangan asli/terjemahan supaya bisa dinilai manusia.
 *
 * Tidak bisa jalan tanpa layanan terjemahan (Docker). Jalankan di VPS setelah
 * `docker compose up -d`, atau di mesin dev yang service `libretranslate`-nya hidup:
 *
 *   npx tsx scripts/translate-samples.ts          # 20 sampel dari ../data/sqlite.db
 *   npx tsx scripts/translate-samples.ts 40       # 40 sampel
 *   TRANSLATE_URL=http://localhost:5000 npx tsx scripts/translate-samples.ts
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const count = Math.min(Math.max(Number(process.argv[2]) || 20, 1), 200);
  const dbFile = process.env.DB_FILE_NAME || join("..", "data", "sqlite.db");
  if (!existsSync(dbFile)) {
    console.error(`Database tidak ditemukan: ${dbFile}`);
    process.exit(1);
  }
  // Koneksi app (lib/db) dibuka saat modul di-import, jadi env harus diset dulu.
  process.env.DB_FILE_NAME = dbFile;

  const { normalizeText, translateEndpoint, translateTexts } = await import("../src/lib/translate");

  const sqlite = new Database(dbFile, { readonly: false });
  // Tabel cache mungkin belum dibuat kalau `db:push` belum dijalankan di sini.
  sqlite
    .prepare(
      `CREATE TABLE IF NOT EXISTS translation_cache (
         hash text PRIMARY KEY NOT NULL,
         sourceText text NOT NULL,
         translated text NOT NULL,
         fromLang text DEFAULT 'id' NOT NULL,
         toLang text DEFAULT 'en' NOT NULL,
         createdAt integer DEFAULT (unixepoch()) NOT NULL
       )`
    )
    .run();

  const rows = sqlite
    .prepare(
      `SELECT problemDetail FROM defects
        WHERE length(trim(problemDetail)) > 3
        GROUP BY problemDetail
        ORDER BY RANDOM()
        LIMIT ?`
    )
    .all(count) as { problemDetail: string }[];
  sqlite.close();

  const samples = [...new Set(rows.map((row) => normalizeText(row.problemDetail)))].filter(Boolean);
  if (samples.length === 0) {
    console.error("Tidak ada contoh problemDetail di database ini.");
    process.exit(1);
  }

  console.log(`Layanan: ${translateEndpoint()}`);
  console.log(
    `Sampel : ${samples.length} teks (${samples.reduce((n, s) => n + s.length, 0)} karakter)\n`
  );

  const started = Date.now();
  const { translations, requested, cached } = await translateTexts(samples);
  const elapsed = Date.now() - started;

  samples.forEach((source, index) => {
    console.log(`${String(index + 1).padStart(2, "0")}. ${source}`);
    console.log(`    -> ${translations.get(source) ?? "(kosong)"}`);
  });

  console.log(
    `\nSelesai: ${samples.length} teks, ${requested} diterjemahkan, ${cached} dari cache, ${elapsed} ms`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
