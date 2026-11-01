/**
 * Self-check penerjemah Google Sheet (src/lib/translate-sheet.ts) TANPA
 * jaringan: panggilan Sheets API ditiru `globalThis.fetch`, hasil formula
 * "dihitung" langsung oleh tiruan itu.
 *
 *   npx tsx scripts/translate-sheet-check.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

let checks = 0;
function check(condition: boolean, label: string) {
  assert.ok(condition, label);
  checks += 1;
  console.log(`  ok  ${label}`);
}

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "bardi-sheet-"));
  const file = path.join(dir, "test.db");
  const sqlite = new Database(file);
  sqlite.exec(`
    CREATE TABLE translation_cache (
      hash text PRIMARY KEY NOT NULL,
      sourceText text NOT NULL DEFAULT '',
      translated text NOT NULL DEFAULT '',
      fromLang text NOT NULL DEFAULT 'id',
      toLang text NOT NULL DEFAULT 'en',
      createdAt integer NOT NULL DEFAULT (unixepoch())
    )
  `);
  sqlite.close();

  process.env.DB_FILE_NAME = file;
  process.env.TRANSLATE_SHEET_ID = "sheet-test";
  process.env.TRANSLATE_SHEET_TAB = "Sheet1";
  process.env.TRANSLATE_SHEET_TOKEN = "token-uji";
  process.env.TRANSLATE_SHEET_TIMEOUT_MS = "4000";

  // Isi sheet tiruan: satu blok ID -> EN, header di baris 2, data di baris 3.
  const cells = new Map<number, [string, string]>();
  cells.set(1, ["Indonesia > Inggris", ""]);
  cells.set(2, ["Asli", "Translate"]);
  cells.set(3, ["mati", "dead"]);

  let calls = 0;
  const writes: string[] = [];
  const clears: string[] = [];

  const rangeOf = (url: string) => {
    const raw = url.split("/values/")[1] ?? "";
    return decodeURIComponent(raw.split("?")[0]);
  };
  const bounds = (range: string) => {
    const match = /!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(range);
    if (!match) throw new Error(`Range tak dikenal: ${range}`);
    return {
      col: match[1],
      start: Number(match[2]),
      end: match[3] ? Number(match[4]) : Number(match[2]),
    };
  };

  (globalThis as unknown as { fetch: typeof fetch }).fetch = async (
    input: string | URL | Request,
    init: RequestInit = {}
  ): Promise<Response> => {
    calls += 1;
    const url = String(input);
    const method = (init.method ?? "GET").toUpperCase();
    // URL clear berakhiran `:clear` pada rangenya — buang dulu sebelum diurai.
    const range = rangeOf(url).replace(/:clear$/, "");
    const isClear = method === "POST" && url.includes(":clear");
    const { col, start, end } = bounds(range);

    if (method === "PUT") {
      const body = JSON.parse(String(init.body ?? "{}")) as { values?: string[][] };
      const values = body.values ?? [];
      values.forEach((row, i) => {
        const rowNo = start + i;
        const current = cells.get(rowNo) ?? ["", ""];
        const source = row[0] ?? "";
        // Formula di kolom B "dihitung" seketika oleh tiruan ini.
        const computed = String(row[1] ?? "").includes("GOOGLETRANSLATE")
          ? source.toUpperCase().includes("RUSAK")
            ? "#VALUE!"
            : `EN(${source})`
          : (row[1] ?? "");
        cells.set(rowNo, col === "A" ? [source, computed] : [current[0], computed]);
      });
      writes.push(range);
      return new Response("{}", { status: 200 });
    }

    if (isClear) {
      for (let row = start; row <= end; row += 1) cells.delete(row);
      clears.push(range);
      return new Response("{}", { status: 200 });
    }

    // GET values
    const values: string[][] = [];
    if (col === "A") {
      for (let row = start; row <= end; row += 1) {
        const cell = cells.get(row);
        values.push([cell?.[0] ?? "", cell?.[1] ?? ""]);
      }
    } else {
      for (let row = start; row <= end; row += 1) {
        values.push([cells.get(row)?.[1] ?? ""]);
      }
    }
    return new Response(JSON.stringify({ values }), { status: 200 });
  };

  const { translateWithSheet, SheetTranslateError } = await import(
    "../src/lib/translate-sheet"
  );

  // 1. Terjemahan dasar: teks ditulis ke baris kosong pertama blok ID -> EN.
  const first = await translateWithSheet("  Halo   dunia ", "id", "en");
  check(first === "EN(Halo dunia)", "teks dinormalisasi lalu diterjemahkan");
  check(writes[0] === "'Sheet1'!A4:B4", "baris kerja = baris kosong pertama (A4:B4)");
  check(clears[0] === "'Sheet1'!A4:B4", "sel kerja dikosongkan lagi setelah selesai");
  check((cells.get(4)?.[0] ?? "") === "", "tidak ada sisa teks di sheet");

  // 2. Cache: teks yang sama tidak memanggil sheet lagi.
  const before = calls;
  const second = await translateWithSheet("Halo dunia", "id", "en");
  check(second === first, "hasil kedua sama");
  check(calls === before, "cache dipakai — tidak ada panggilan baru ke sheet");

  const beforeSpace = calls;
  const spaced = await translateWithSheet("Halo dunia", "id", "en");
  check(spaced === first && calls === beforeSpace, "spasi berbeda tetap satu entri cache");

  // 3. Hasil formula rusak (#VALUE!) ditolak, bukan disimpan.
  let invalid: unknown = null;
  try {
    await translateWithSheet("Barang rusak total", "id", "en");
  } catch (error) {
    invalid = error;
  }
  check(
    invalid instanceof SheetTranslateError && invalid.code === "invalid",
    "hasil #VALUE! -> SheetTranslateError invalid"
  );

  // 4. Blok bahasa yang tidak ada di sheet -> error config yang jelas.
  let missing: unknown = null;
  try {
    await translateWithSheet("Mati total", "id", "zh");
  } catch (error) {
    missing = error;
  }
  check(
    missing instanceof SheetTranslateError && missing.code === "config",
    "blok ID -> ZH tidak ada -> SheetTranslateError config"
  );

  // 5. Cache tersimpan di SQLite (bukan hanya di memori).
  const db = new Database(file, { readonly: true });
  const rows = db.prepare("SELECT hash, translated FROM translation_cache").all() as {
    hash: string;
    translated: string;
  }[];
  db.close();
  check(rows.length >= 1, "hasil tersimpan di tabel translation_cache");
  check(
    rows.some((row) => row.translated === "EN(Halo dunia)"),
    "isi cache = terjemahan yang dipakai"
  );

  console.log(
    `SEMUA LULUS: ${checks} pemeriksaan penerjemah Google Sheet (server tiruan, cache SQLite)`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
