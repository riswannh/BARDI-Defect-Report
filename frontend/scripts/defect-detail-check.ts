/**
 * Pemeriksaan logika Problem Detail dua bahasa (`src/lib/api/defect-detail.ts`)
 * TANPA Docker: server tiruan meniru `POST /translate` LibreTranslate, dan DB
 * sementara hanya berisi tabel `translation_cache`.
 *
 * Jalankan dari folder frontend: npx tsx scripts/defect-detail-check.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const state = {
  /** true = layanan terjemahan sengaja dimatikan. */
  down: false,
  calls: 0,
};

async function main() {
  const dbDir = mkdtempSync(join(tmpdir(), "bardi-detail-"));
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
      if (state.down) {
        res.writeHead(503, { "content-type": "text/plain" }).end("down");
        return;
      }
      const body = JSON.parse(raw || "{}") as {
        q?: string | string[];
        source?: string;
      };
      state.calls += 1;
      const q = Array.isArray(body.q) ? body.q : [String(body.q ?? "")];
      const prefix = body.source === "en" ? "ID" : "EN";
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ translatedText: q.map((text) => `${prefix}(${text})`) }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.TRANSLATE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  const { DetailTranslateError, resolveProblemDetail } = await import(
    "../src/lib/api/defect-detail"
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

  // Baru + dua-duanya kosong: tidak ada yang perlu ditulis.
  check((await resolveProblemDetail({})) === null, "dua kolom kosong tidak menulis apa pun");

  // Baru + hanya Inggris: Indonesia diisi otomatis.
  check(
    JSON.stringify(
      await resolveProblemDetail({ problemDetail: "Device does not turn on" })
    ) ===
      JSON.stringify({
        problemDetail: "Device does not turn on",
        problemDetailOriginal: "ID(Device does not turn on)",
      }),
    "Inggris saja -> Indonesia diterjemahkan"
  );

  // Baru + hanya Indonesia: Inggris diisi otomatis.
  check(
    JSON.stringify(
      await resolveProblemDetail({ problemDetailOriginal: "Perangkat tidak menyala" })
    ) ===
      JSON.stringify({
        problemDetail: "EN(Perangkat tidak menyala)",
        problemDetailOriginal: "Perangkat tidak menyala",
      }),
    "Indonesia saja -> Inggris diterjemahkan"
  );

  // Baru + dua bahasa diisi operator: tidak ada terjemahan (hemat & tidak menimpa).
  const before = state.calls;
  check(
    JSON.stringify(
      await resolveProblemDetail({
        problemDetail: "Screen flickers",
        problemDetailOriginal: "Layar berkedip",
      })
    ) ===
      JSON.stringify({
        problemDetail: "Screen flickers",
        problemDetailOriginal: "Layar berkedip",
      }),
    "dua bahasa sudah diisi -> dipakai apa adanya"
  );
  check(state.calls === before, "dua bahasa lengkap tidak memanggil layanan");

  const current = {
    problemDetail: "Battery drains fast",
    problemDetailOriginal: "Baterai cepat habis",
  };

  // Ubah Inggris saja: Indonesia lama diganti terjemahan baru.
  check(
    JSON.stringify(
      await resolveProblemDetail({ problemDetail: "Battery drains very fast", current })
    ) ===
      JSON.stringify({
        problemDetail: "Battery drains very fast",
        problemDetailOriginal: "ID(Battery drains very fast)",
      }),
    "Inggris berubah -> Indonesia ikut diterjemahkan"
  );

  // Ubah Indonesia saja: Inggris ikut diterjemahkan.
  check(
    JSON.stringify(
      await resolveProblemDetail({ problemDetailOriginal: "Baterai bocor", current })
    ) ===
      JSON.stringify({
        problemDetail: "EN(Baterai bocor)",
        problemDetailOriginal: "Baterai bocor",
      }),
    "Indonesia berubah -> Inggris ikut diterjemahkan"
  );

  // Tidak ada perubahan isi (spasi di ujung diabaikan).
  check(
    (await resolveProblemDetail({ problemDetail: "  Battery drains fast  ", current })) === null,
    "isi sama -> tidak ada yang ditulis"
  );

  // Layanan mati: penyimpanan HARUS ditolak (keputusan user 1 Nov 2026).
  state.down = true;
  let failure: unknown = null;
  try {
    await resolveProblemDetail({ problemDetail: "New complaint", current });
  } catch (error) {
    failure = error;
  }
  check(failure instanceof DetailTranslateError, "layanan mati -> DetailTranslateError");
  check(
    (failure as InstanceType<typeof DetailTranslateError>).status === 503,
    "layanan mati -> status 503"
  );

  // Tanpa perubahan, layanan yang mati tidak menghalangi penyimpanan field lain.
  check(
    (await resolveProblemDetail({ problemDetail: current.problemDetail, current })) === null,
    "tanpa perubahan tetap null walau layanan mati"
  );

  server.close();
  console.log(
    `SEMUA LULUS: ${checks} pemeriksaan Problem Detail dua bahasa (server tiruan, cache SQLite)`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
