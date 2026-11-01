/**
 * Pemeriksaan klien terjemahan (src/lib/translate.ts) TANPA Docker: sebuah
 * server tiruan meniru `POST /translate` milik LibreTranslate di 127.0.0.1,
 * jadi kontrak HTTP, cache SQLite, pembagian batch, dan perilaku saat layanan
 * mati bisa diuji di mesin dev yang Docker-nya tidak jalan.
 *
 * Jalankan dari folder frontend: npx tsx scripts/translate-check.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Mode = "ok" | "fail" | "partial" | "rate";

const state = {
  mode: "ok" as Mode,
  /** Body q setiap permintaan yang masuk — untuk memastikan isi & urutannya. */
  requests: [] as string[][],
};

async function main() {
  // DB sementara: tabel translation_cache dibuat manual di bawah, jadi data dev
  // (../data/sqlite.db) tidak tersentuh.
  const dbDir = mkdtempSync(join(tmpdir(), "bardi-translate-"));
  process.env.DB_FILE_NAME = join(dbDir, "check.db");

  const server = createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/translate") {
      res.writeHead(404).end();
      return;
    }
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      raw += chunk;
    });
    req.on("end", () => {
      const body = JSON.parse(raw || "{}") as { q?: string | string[] };
      const q = Array.isArray(body.q) ? body.q : [String(body.q ?? "")];
      state.requests.push(q);

      if (state.mode === "fail") {
        res.writeHead(503, { "content-type": "text/plain" }).end("down");
        return;
      }
      if (state.mode === "rate") {
        res.writeHead(429, { "content-type": "text/plain" }).end("slow down");
        return;
      }
      const translated = q.map((text) => `EN(${text})`);
      if (state.mode === "partial") translated.pop();
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ translatedText: translated }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.TRANSLATE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  const { translateEndpoint, translateTexts, normalizeText, TranslateError } = await import(
    "../src/lib/translate"
  );
  const { sqliteClient } = await import("../src/lib/db");

  sqliteClient.exec(`
    CREATE TABLE IF NOT EXISTS translation_cache (
      hash text PRIMARY KEY NOT NULL,
      sourceText text NOT NULL,
      translated text NOT NULL,
      fromLang text DEFAULT 'id' NOT NULL,
      toLang text DEFAULT 'en' NOT NULL,
      createdAt integer DEFAULT (unixepoch()) NOT NULL
    )
  `);

  let checks = 0;
  const check = (condition: unknown, message: string) => {
    assert.ok(condition, message);
    checks += 1;
  };

  // Endpoint: env dipakai apa adanya, hanya garis miring di ujung yang dibuang.
  check(translateEndpoint() === process.env.TRANSLATE_URL!.replace(/\/+$/, ""), "TRANSLATE_URL dipakai");

  check(
    normalizeText("  Suara   speaker \n tidak jelas ") === "Suara speaker tidak jelas",
    "teks dinormalkan"
  );

  // 1. Terjemahan pertama benar-benar memanggil layanan, lalu tersimpan di cache.
  const first = await translateTexts(["Produk tidak mau menyala"]);
  check(
    first.translations.get("Produk tidak mau menyala") === "EN(Produk tidak mau menyala)",
    "hasil diterjemahkan"
  );
  check(first.requested === 1 && first.cached === 0, "permintaan pertama: 1 diminta, 0 dari cache");
  check(state.requests.length === 1 && state.requests[0][0] === "Produk tidak mau menyala", "isi q benar");

  // 2. Teks yang sama tidak dikirim lagi.
  const second = await translateTexts(["Produk tidak mau menyala"]);
  check(second.requested === 0 && second.cached === 1, "teks sama dilayani cache");
  check(state.requests.length === 1, "tidak ada permintaan tambahan");

  // 3. Beda spasi/enter tidak memecah cache.
  const spaced = await translateTexts(["  Produk   tidak mau menyala\n"]);
  check(spaced.cached === 1 && spaced.requested === 0, "spasi berbeda tetap satu entri cache");
  check(state.requests.length === 1, "spasi berbeda tidak memanggil layanan");

  // 4. Teks ganda dalam satu permintaan hanya dikirim sekali.
  const dup = await translateTexts(["Suara putus", "Suara putus", "Suara putus"]);
  check(dup.requested === 1, "duplikat dalam satu panggilan dikirim sekali");
  check(state.requests.at(-1)!.length === 1, "batch hanya berisi satu teks unik");

  // 5. Lebih dari 25 teks dipecah jadi beberapa permintaan.
  state.requests.length = 0;
  const many = Array.from({ length: 30 }, (_, i) => `Kendala nomor ${i + 1}`);
  const batched = await translateTexts(many);
  check(batched.requested === 30, "30 teks semuanya diterjemahkan");
  check(state.requests.length === 2, "30 teks dipecah jadi 2 permintaan");
  check(state.requests[0].length === 25 && state.requests[1].length === 5, "batch 25 + 5");
  check(batched.translations.get("Kendala nomor 30") === "EN(Kendala nomor 30)", "urutan hasil terjaga");

  // 6. Cache bertahan antar panggilan (dibaca dari SQLite, bukan memori).
  state.requests.length = 0;
  const reused = await translateTexts(many.slice(0, 5));
  check(reused.cached === 5 && reused.requested === 0, "cache SQLite dipakai lagi");
  check(state.requests.length === 0, "tidak ada permintaan untuk teks yang sudah ada");

  // 7. Layanan mati: dua percobaan, lalu TranslateError "unavailable".
  state.mode = "fail";
  state.requests.length = 0;
  await assert.rejects(
    () => translateTexts(["Teks yang belum pernah diterjemahkan"]),
    (error: unknown) => error instanceof TranslateError && error.code === "unavailable",
    "layanan mati -> TranslateError unavailable"
  );
  checks += 1;
  check(state.requests.length === 2, "gangguan 5xx diulang sekali");

  // 8. Hasil tidak lengkap ditolak (jangan menyimpan terjemahan setengah jadi).
  state.mode = "partial";
  state.requests.length = 0;
  await assert.rejects(
    () => translateTexts(["Hasil terpotong"]),
    (error: unknown) => error instanceof TranslateError && error.code === "invalid",
    "hasil tidak lengkap -> TranslateError invalid"
  );
  checks += 1;
  check(state.requests.length === 1, "hasil tidak lengkap tidak diulang");

  // 9. 429 tidak diulang dan tidak disimpan.
  state.mode = "rate";
  state.requests.length = 0;
  await assert.rejects(
    () => translateTexts(["Kena batas"]),
    (error: unknown) => error instanceof TranslateError && error.code === "rate-limit",
    "429 -> TranslateError rate-limit"
  );
  checks += 1;
  check(state.requests.length === 1, "429 tidak diulang");

  // Terjemahan yang gagal tidak boleh meninggalkan baris setengah jadi di cache.
  state.mode = "ok";
  state.requests.length = 0;
  const retry = await translateTexts(["Hasil terpotong"]);
  check(retry.requested === 1, "teks gagal tadi dicoba lagi (tidak tercache)");

  server.close();
  console.log(`SEMUA LULUS: ${checks} pemeriksaan klien terjemahan (server tiruan, cache SQLite)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
