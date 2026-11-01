/**
 * Uji ujung-ke-ujung "kirim Problem ke sheet" TANPA menyentuh Google:
 * `fetch` global diganti server tiruan, DB memakai salinan sekali pakai.
 *
 * Butuh salinan DB produksi + kunci service account (hanya untuk tanda tangan
 * JWT; semua panggilan jaringan di-intersep). Bila tidak ada, uji dilewati.
 * Jalankan: npx tsx scripts/problem-push-check.ts
 */
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SOURCE_DB =
  process.env.PROBLEM_PUSH_DB ??
  "C:/Users/bardi/AppData/Local/Temp/bardi-verify/prod-defectvalue.db";
const SA_FILE =
  process.env.PROBLEM_PUSH_SA ?? "C:/Users/bardi/AppData/Local/Temp/bardi-verify/gsheet-sa.json";

async function main() {
  if (!existsSync(SOURCE_DB) || !existsSync(SA_FILE)) {
    console.log("DILEWATI: butuh PROBLEM_PUSH_DB dan PROBLEM_PUSH_SA (salinan DB + kunci SA).");
    return;
  }
  const dir = mkdtempSync(path.join(tmpdir(), "problem-push-"));
  const dbFile = path.join(dir, "test.db");
  copyFileSync(SOURCE_DB, dbFile);
  process.env.DB_FILE_NAME = dbFile;
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE = SA_FILE;
  delete process.env.GSHEET_ID;
  delete process.env.GSHEET_TAB;

  const { db, sqliteClient } = await import("../src/lib/db");
  const { defects, problems, defectProblemLog } = await import("../src/lib/db/schema");
  const { runSync } = await import("../src/lib/api/gsheet");
  const { eq } = await import("drizzle-orm");

  sqliteClient.exec(`create table if not exists defect_problem_log (
    id integer primary key autoincrement,
    defectId integer not null,
    codeGaransi text not null,
    fromProblemId integer,
    fromName text default '',
    toProblemId integer not null,
    toName text default '',
    actor text default '',
    changedAt integer not null default (unixepoch()),
    pushedAt integer,
    sheetRow integer,
    error text default ''
  )`);

  const [defect] = db
    .select({
      id: defects.id,
      code: defects.codeGaransi,
      timeStamp: defects.timeStamp,
      problemDetail: defects.problemDetail,
      problemId: defects.problemId,
      quantity: defects.quantity,
    })
    .from(defects)
    .limit(1)
    .all();
  assert.ok(defect, "DB salinan harus berisi defect");

  const [problemRow] = db
    .select({ id: problems.id, name: problems.name })
    .from(problems)
    .where(eq(problems.id, defect.problemId))
    .all();
  const [target] = db
    .select({ id: problems.id, name: problems.name })
    .from(problems)
    .where(eq(problems.name, "Not Clear"))
    .all();
  assert.ok(target && target.name !== problemRow.name, "butuh dua Problem berbeda");

  const header = [
    "Code Garansi",
    "Time Stamp",
    "Foto Kendala",
    "Video Kendala",
    "Keterangan Kendala",
    "Produk",
    "Quantity",
    "Status",
    "Month",
    "Problem",
    "Pabrik",
    "Offical Name",
    "Translate",
  ];

  let sheetProblem = problemRow.name;
  const sheetRow = () => [
    defect.code,
    defect.timeStamp,
    "",
    "",
    defect.problemDetail,
    "x",
    defect.quantity,
    "Penggantian Produk Baru",
    "Jan",
    sheetProblem,
    "x",
    "x",
    "x",
  ];

  const writes: { range: string; values: string[][] }[] = [];
  let reads = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "test", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("values:batchGet")) {
      reads += 1;
      return new Response(
        JSON.stringify({ valueRanges: [{ range: "Big Data!A1:O", values: [header, sheetRow()] }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (url.includes("values:batchUpdate")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        data: { range: string; values: string[][] }[];
      };
      writes.push(...body.data);
      return new Response(JSON.stringify({ totalUpdatedCells: body.data.length }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`URL tak terduga: ${url}`);
  }) as typeof fetch;

  // Ubah Problem di app + catat log (persis yang dilakukan defectsPATCH).
  db.update(defects).set({ problemId: target.id }).where(eq(defects.id, defect.id)).run();
  db.insert(defectProblemLog)
    .values({
      defectId: defect.id,
      codeGaransi: defect.code,
      fromProblemId: defect.problemId,
      fromName: problemRow.name,
      toProblemId: target.id,
      toName: target.name,
      actor: "test",
    })
    .run();

  const first = await runSync({});
  assert.equal(first.summary.problemsPushed, 1, "satu baris dikirim");
  assert.equal(first.summary.problemsPushPending, 0, "tidak ada yang tertunda");
  assert.equal(writes.length, 1, "satu sel ditulis");
  assert.equal(writes[0].range, "'Big Data'!J2", "hanya kolom Problem baris 2");
  assert.deepEqual(writes[0].values, [[target.name]]);

  const log1 = db.select().from(defectProblemLog).all()[0];
  assert.ok(log1.pushedAt, "log ditandai terkirim");
  assert.equal(log1.sheetRow, 2, "nomor baris sheet dicatat");
  assert.equal(log1.error, "");

  // Sync kedua: sheet sudah berisi nilai baru -> tidak ada penulisan lagi.
  sheetProblem = target.name;
  writes.length = 0;
  const second = await runSync({});
  assert.equal(second.summary.problemsPushed, 0);
  assert.equal(writes.length, 0, "tidak menulis ulang");

  // Kegagalan jaringan: log tetap menunggu dan dilaporkan.
  db.insert(defectProblemLog)
    .values({
      defectId: defect.id,
      codeGaransi: defect.code,
      fromProblemId: target.id,
      fromName: target.name,
      toProblemId: problemRow.id,
      toName: problemRow.name,
      actor: "test",
    })
    .run();
  sheetProblem = target.name;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("values:batchUpdate")) {
      return new Response(JSON.stringify({ error: { message: "boom", status: "UNAVAILABLE" } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;
  const third = await runSync({});
  assert.equal(third.summary.problemsPushed, 0, "gagal tulis -> tidak ada yang ditandai");
  assert.equal(third.summary.problemsPushPending, 1, "dilaporkan menunggu");
  assert.ok(
    third.issues.some((issue) => issue.reason.includes("belum terkirim")),
    "alasan muncul di laporan sync"
  );
  const pending = db.select().from(defectProblemLog).all().at(-1);
  assert.equal(pending?.pushedAt, null, "log gagal tetap menunggu");

  console.log(
    JSON.stringify(
      {
        ok: true,
        reads,
        first: { pushed: first.summary.problemsPushed, range: writes[0]?.range ?? "'Big Data'!J2" },
        failedWrite: { pending: third.summary.problemsPushPending },
      },
      null,
      1
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
