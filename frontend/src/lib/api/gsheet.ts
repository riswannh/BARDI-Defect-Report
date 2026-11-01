import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  defectProblemLog,
  defects,
  factories,
  problems,
  productPrices,
  products,
} from "@/lib/db/schema";
import { requireMenu } from "@/lib/api/guard";
import { defaultStatusId } from "@/lib/api/defect-status";
import { defectValueFromMaster } from "@/lib/defect-value";
import { jsonError, jsonOk } from "@/lib/api/response";
import { defectSchema } from "@/lib/api/validation";
import { GsheetError } from "@/lib/gsheet/auth";
import { batchGetValues, batchUpdateValues, type SheetCell } from "@/lib/gsheet/values";
import {
  FIELD_LABEL,
  GSHEET_FIELDS,
  normalizeCode,
  normalizeName,
  parseSheetNumber,
  parseSheetTimestamp,
  shortHash,
  quoteTab,
  resolveHeaderIndex,
  sheetColumnLetter,
  type GsheetField,
  type RowFields,
} from "@/lib/gsheet/mapping";
import {
  baselineFromSheet,
  parseBaseline,
  planProblemPushes,
  planRowSync,
  type FieldChoice,
  type DiffField,
  type ProblemPush,
  type RowPlan,
} from "@/lib/gsheet/sync";

/**
 * Sync defect dengan tab "Big Data" Google Sheet, dua arah tapi sempit.
 *
 * Kolom A:H tab itu diisi `=ARRAYFORMULA('Raw CX Data'!A1:H)` (dan sebagian dari
 * IMPORTRANGE); kolom "Keterangan Kendala" (E), "Pabrik" (K), "Offical Name" (L)
 * juga formula. Blok itu read-only.
 *
 * Satu-satunya kolom yang ditulis aplikasi adalah "Problem" (J): setiap
 * perubahan Problem dari dalam app dicatat di tabel `defect_problem_log`, lalu
 * di awal sync log yang belum terkirim ditulis ke baris sheet yang cocok lewat
 * Code Garansi. Setelah itu baris kembali mengikuti aturan normal (sheet -> app),
 * jadi nilai lain di baris yang sama tetap dari sheet.
 *
 * Kontrak dengan user:
 * - kunci pencocokan baris: Code Garansi (di app unik);
 * - baris yang cuma ada di sheet ikut masuk ke app; baris yang cuma ada di app
 *   dibiarkan (tidak pernah ditambahkan ke sheet);
 * - konflik diputuskan PER FIELD dan popup hanya muncul kalau kedua sisi berubah
 *   pada field yang sama;
 * - kolom "Keterangan Kendala" berisi teks ASLI (Indonesia) dan itulah yang
 *   disimpan app di `problemDetailOriginal`; kolom `Translate` di sheet
 *   DIABAIKAN. Versi Inggrisnya tidak dibuat saat sync: dimuat saat popup
 *   Detail Defect dibuka (lib/translate-sheet.ts) lalu disimpan ke database;
 * - kolom "Problem": app menang sampai nilainya terkirim ke sheet, sesudahnya
 *   sheet yang menang (lihat planProblemPushes).
 */

const DEFAULT_SHEET_ID = "1TzJAH7mgIp8OK4l_VsE1GSYAp-IldcyM7TQwmdC8S3U";
const MAX_CONFLICTS = 300;
const MAX_ISSUES = 50;
/** Batas penulisan Problem per sync supaya request tidak menggantung. */
const MAX_PROBLEM_WRITES_PER_SYNC = 200;

function sheetConfig() {
  return {
    id: process.env.GSHEET_ID?.trim() || DEFAULT_SHEET_ID,
    tab: process.env.GSHEET_TAB?.trim() || "Big Data",
  };
}

type LocalRow = {
  id: number;
  code: string;
  fields: RowFields;
  baseline: Record<string, string> | null;
  /** Nilai mentah di app (bukan hasil normalisasi) untuk mendeteksi format lama. */
  rawTimeStamp: string;
  /**
   * Teks asli "Keterangan Kendala" (Indonesia) yang tersimpan di app. Sync
   * membandingkan kolom sheet langsung dengan nilai ini; versi Inggrisnya tidak
   * ikut sync karena dimuat saat Detail Defect dibuka.
   */
  rawProblemDetailOriginal: string;
  /** Nilai mentah lain: dipakai menghitung `value` dari Price List. */
  raw: {
    productId: number;
    quantity: number;
    timeStamp: string;
    priceType: string | null;
    value: number;
  };
};

type NameField = "problemId" | "factoryId" | "productId";

type Masters = {
  toName: Record<NameField, Map<number, string>>;
  toId: Record<NameField, Map<string, number>>;
};

const isNameField = (field: GsheetField): field is NameField =>
  field === "problemId" || field === "factoryId" || field === "productId";

const NAME_FIELDS: NameField[] = ["problemId", "factoryId", "productId"];

/** Sel kosong di sheet dipetakan ke master bawaan app (sama seperti jalur impor Excel). */
const NAME_DEFAULT: Partial<Record<NameField, string>> = { problemId: "Kosong" };

/**
 * Rapikan nama master dari sheet ke ejaan master app (dan isi default untuk sel
 * kosong). Dipakai untuk MEMBANDINGKAN juga, bukan cuma menulis: tanpa ini,
 * " Open " atau "kosong" akan selalu terlihat "beda" dari "Open"/"Kosong".
 */
function canonicalName(masters: Masters, field: NameField, raw: string, fallback?: string): string {
  const value = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!value) return fallback ?? "";
  const id = masters.toId[field].get(normalizeName(value));
  if (id === undefined) return value;
  return masters.toName[field].get(id) ?? value;
}

async function loadMasters(): Promise<Masters> {
  const [problemRows, factoryRows, productRows] = await Promise.all([
    db.select({ id: problems.id, name: problems.name }).from(problems),
    db.select({ id: factories.id, name: factories.name }).from(factories),
    db.select({ id: products.id, name: products.name }).from(products),
  ]);
  const build = (rows: { id: number; name: string }[]) => ({
    toName: new Map(rows.map((r) => [r.id, r.name] as const)),
    toId: new Map(rows.map((r) => [normalizeName(r.name), r.id] as const)),
  });
  const p = build(problemRows);
  const f = build(factoryRows);
  const pr = build(productRows);
  return {
    toName: { problemId: p.toName, factoryId: f.toName, productId: pr.toName },
    toId: { problemId: p.toId, factoryId: f.toId, productId: pr.toId },
  };
}

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

/** Baca tab sheet: header + baris (nomor baris asli ikut disimpan untuk pesan error). */
async function readSheet(spreadsheetId: string, tab: string) {
  // UNFORMATTED_VALUE: sel tanggal di "Big Data" format tampilannya campur
  // ("2026-01-03 13:51:39" vs "9/9/2026 23:10:4"), jadi lebih aman membaca
  // angka serialnya dan mengubahnya sendiri (lihat parseSheetTimestamp).
  const [first] = await batchGetValues(spreadsheetId, [`${quoteTab(tab)}!A1:O`], "UNFORMATTED_VALUE");
  const values = first?.values ?? [];
  if (values.length === 0) throw new GsheetError("empty-sheet", `Tab "${tab}" kosong.`);
  const header = (values[0] ?? []).map((cell) => text(cell));
  const resolved = resolveHeaderIndex(header);
  if (resolved.missing.length > 0) {
    throw new GsheetError(
      "header-mismatch",
      `Kolom wajib tidak ditemukan di tab "${tab}": ${resolved.missing.join(", ")}.`,
      `header: ${header.join(" | ")}`
    );
  }
  const rows = values.slice(1).map((cells, i) => ({
    sheetRow: i + 2,
    cells: cells ?? [],
    code: normalizeCode(text(cells?.[resolved.index.codeGaransi])),
  }));
  return { header, resolved, rows };
}

function sheetFieldsFromRow(cells: SheetCell[], index: Record<GsheetField, number>): RowFields {
  const out: RowFields = {};
  for (const field of GSHEET_FIELDS) {
    const raw = cells[index[field]];
    if (field === "quantity") out[field] = String(parseSheetNumber(raw));
    else if (field === "timeStamp") out[field] = parseSheetTimestamp(raw);
    else out[field] = raw === null || raw === undefined ? "" : text(raw);
  }
  return out;
}

/** Nilai app dalam bentuk canonical (nama master, bukan id) supaya bisa dibandingkan dengan sheet. */
function localFieldsFromRow(
  row: {
    codeGaransi: string;
    timeStamp: string;
    photosLink: string | null;
    videosLink: string | null;
    problemId: number;
    problemDetailOriginal: string | null;
    productId: number;
    quantity: number;
    factoryId: number;
    value: number;
  },
  masters: Masters
): RowFields {
  return {
    codeGaransi: row.codeGaransi,
    timeStamp: parseSheetTimestamp(row.timeStamp),
    photosLink: row.photosLink ?? "",
    videosLink: row.videosLink ?? "",
    problemId: masters.toName.problemId.get(row.problemId) ?? "",
    problemDetailOriginal: row.problemDetailOriginal ?? "",
    productId: masters.toName.productId.get(row.productId) ?? "",
    quantity: String(row.quantity ?? 0),
    factoryId: masters.toName.factoryId.get(row.factoryId) ?? "",
  };
}

async function loadLocalRows(masters: Masters): Promise<LocalRow[]> {
  const rows = await db
    .select({
      id: defects.id,
      codeGaransi: defects.codeGaransi,
      timeStamp: defects.timeStamp,
      photosLink: defects.photosLink,
      videosLink: defects.videosLink,
      problemId: defects.problemId,
      problemDetailOriginal: defects.problemDetailOriginal,
      productId: defects.productId,
      quantity: defects.quantity,
      factoryId: defects.factoryId,
      priceType: defects.priceType,
      value: defects.value,
      sheetFields: defects.sheetFields,
    })
    .from(defects);
  return rows.map((row) => ({
    id: row.id,
    code: normalizeCode(row.codeGaransi),
    fields: localFieldsFromRow(row, masters),
    baseline: parseBaseline(row.sheetFields),
    /** Nilai mentah di app (bukan hasil normalisasi) untuk mendeteksi format lama. */
    rawTimeStamp: row.timeStamp,
    rawProblemDetailOriginal: row.problemDetailOriginal ?? "",
    raw: {
      productId: row.productId,
      quantity: row.quantity,
      timeStamp: row.timeStamp,
      priceType: row.priceType,
      value: row.value,
    },
  }));
}

function friendly(error: unknown, fallback: string) {
  if (error instanceof GsheetError) {
    const status = error.code === "header-mismatch" ? 409 : error.code.startsWith("credentials") ? 503 : 502;
    return jsonError(error.message, status);
  }
  console.error("[gsheet:sync]", error);
  return jsonError(fallback, 500);
}

/**
 * Kirim perubahan Problem (dari app) ke kolom "Problem" (J) sheet.
 *
 * Dipanggil di awal sync, SEBELUM baris dibaca ulang. Nama kolomnya dihitung
 * dari header yang benar-benar ada (`sheet.resolved.index.problemId`), jadi
 * tidak pernah menulis ke kolom formula. Baris yang nilainya sudah sama cuma
 * ditandai terkirim supaya tidak ada request sia-sia; baris yang gagal ditulis
 * tetap menunggu dan dilaporkan sebagai "pending" di ringkasan sync.
 */
async function pushProblemChanges(input: {
  spreadsheetId: string;
  tab: string;
  sheet: Awaited<ReturnType<typeof readSheet>>;
  masters: Masters;
}): Promise<{ sent: ProblemPush[]; pending: number }> {
  const logs = await db
    .select()
    .from(defectProblemLog)
    .where(isNull(defectProblemLog.pushedAt))
    .orderBy(defectProblemLog.id);
  if (logs.length === 0) return { sent: [], pending: 0 };

  const plan = planProblemPushes({
    logs: logs.map((log) => ({
      id: log.id,
      code: log.codeGaransi,
      problemId: log.toProblemId,
      name: input.masters.toName.problemId.get(log.toProblemId) ?? log.toName,
    })),
    rows: input.sheet.rows
      .filter((row) => row.code)
      .map((row) => ({
        code: row.code,
        sheetRow: row.sheetRow,
        problem: text(row.cells[input.sheet.resolved.index.problemId]),
      })),
    limit: MAX_PROBLEM_WRITES_PER_SYNC,
  });

  const now = new Date();
  const markPushed = (items: ProblemPush[]) => {
    for (const item of items) {
      db.update(defectProblemLog)
        .set({ pushedAt: now, sheetRow: item.sheetRow, error: "" })
        .where(inArray(defectProblemLog.id, item.logIds))
        .run();
    }
  };

  // Sheet sudah bernilai sama: tandai terkirim tanpa request.
  markPushed(plan.already);

  let failed = 0;
  if (plan.writes.length > 0) {
    const column = sheetColumnLetter(input.sheet.resolved.index.problemId);
    try {
      await batchUpdateValues(
        input.spreadsheetId,
        plan.writes.map((push) => ({
          range: `${quoteTab(input.tab)}!${column}${push.sheetRow}`,
          values: [[push.name]],
        }))
      );
      markPushed(plan.writes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menulis ke sheet";
      const ids = plan.writes.flatMap((push) => push.logIds);
      if (ids.length > 0) {
        db.update(defectProblemLog)
          .set({ error: message.slice(0, 300) })
          .where(inArray(defectProblemLog.id, ids))
          .run();
      }
      console.error("[gsheet:problem-push]", message);
      failed = plan.writes.length;
    }
  }

  return {
    sent: failed > 0 ? plan.already : [...plan.already, ...plan.writes],
    pending: plan.queued + plan.missing.length + failed,
  };
}

export type ConflictRow = {
  codeGaransi: string;
  sheetRow: number;
  localId: number;
  fields: { field: GsheetField; label: string; sheet: string; app: string }[];
};

const toConflict = (plan: RowPlan): ConflictRow => ({
  codeGaransi: plan.code,
  sheetRow: plan.sheetRow,
  localId: plan.localId,
  fields: plan.conflicts.map((f) => ({
    field: f.field,
    label: FIELD_LABEL[f.field],
    sheet: f.sheet,
    app: f.app,
  })),
});

/**
 * Jalankan sync satu arah. `only` + `defaultChoice` dipakai route resolve untuk
 * menerapkan pilihan user pada konflik yang sudah terdeteksi.
 */
export async function runSync(options: {
  defaultChoice?: "sheet" | "app";
  only?: Map<string, Record<string, "sheet" | "app">>;
}) {
  const { id: spreadsheetId, tab } = sheetConfig();
  const masters = await loadMasters();
  const sheet = await readSheet(spreadsheetId, tab);
  const localRows = await loadLocalRows(masters);
  // Price List dipakai menghitung `value` tiap defect (kolom "Value" di sheet
  // tidak lagi dibaca) — lihat defectValueFromMaster.
  const priceRows = await db.select().from(productPrices);
  const localByCode = new Map(localRows.map((row) => [row.code, row]));

  // Kirim dulu perubahan Problem dari app, lalu pakai nilai barunya saat
  // membandingkan supaya baris yang barusan dikirim tidak terlihat "berubah di
  // dua sisi" (dan tidak memunculkan konflik palsu).
  const problemPush = await pushProblemChanges({ spreadsheetId, tab, sheet, masters });
  for (const push of problemPush.sent) {
    const sheetRow = sheet.rows.find((row) => row.code === push.code);
    if (sheetRow) sheetRow.cells[sheet.resolved.index.problemId] = push.name;
    const local = localByCode.get(push.code);
    if (local) local.fields.problemId = push.name;
  }

  const summary = {
    sheetRows: sheet.rows.length,
    localRows: localRows.length,
    matched: 0,
    inserted: 0,
    appliedFields: 0,
    rowsUpdated: 0,
    conflicts: 0,
    conflictsResolved: 0,
    unchanged: 0,
    appOnlyChanges: 0,
    onlyInApp: 0,
    skipped: 0,
    problemsPushed: problemPush.sent.length,
    problemsPushPending: problemPush.pending,
  };
  const issues: { row?: number; code?: string; reason: string }[] = [];
  const conflicts: ConflictRow[] = [];
  /** Timestamp lama yang formatnya tidak dikenali dan diperbaiki otomatis. */
  let repairedTimestamps = 0;
  const now = new Date();

  const localUpdates = new Map<number, Partial<typeof defects.$inferInsert>>();
  const inserts: (typeof defects.$inferInsert)[] = [];
  const pendingInsertCodes = new Set<string>();
  const seenCodes = new Set<string>();

  for (const row of sheet.rows) {
    if (!row.code) continue;
    seenCodes.add(row.code);
    const sheetFields = sheetFieldsFromRow(row.cells, sheet.resolved.index);
    // Format timestamp yang tidak dikenal jangan ditulis asal-asalan — lebih baik
    // dilaporkan supaya kelihatan daripada menyimpan jam yang salah.
    const rawTimestamp = row.cells[sheet.resolved.index.timeStamp];
    if (!sheetFields.timeStamp && String(rawTimestamp ?? "").trim() !== "") {
      if (issues.length < MAX_ISSUES) {
        issues.push({
          row: row.sheetRow,
          code: row.code,
          reason: `Time Stamp "${String(rawTimestamp).slice(0, 40)}" formatnya tidak dikenali.`,
        });
      }
    }
    for (const field of NAME_FIELDS) {
      sheetFields[field] = canonicalName(masters, field, sheetFields[field] ?? "", NAME_DEFAULT[field]);
    }
    const local = localByCode.get(row.code);

    if (!local) {
      // Baris hanya ada di sheet -> masuk ke app. Baris hanya di app dibiarkan.
      const insertQuantity = Number.parseInt(sheetFields.quantity || "0", 10) || 0;
      const insertProductId =
        masters.toId.productId.get(normalizeName(sheetFields.productId ?? "")) ?? null;
      // Nilai defect dihitung dari Price List (bulan timestamp), bukan kolom
      // "Value" di sheet; produk tanpa harga -> 0 supaya barisnya tetap masuk.
      const insertValue =
        defectValueFromMaster(priceRows, {
          productId: insertProductId,
          quantity: insertQuantity,
          timeStamp: sheetFields.timeStamp ?? "",
          priceType: null,
        }) ?? 0;
      const parsed = defectSchema.safeParse({
        codeGaransi: sheetFields.codeGaransi || row.code,
        timestamp: sheetFields.timeStamp,
        photosLink: sheetFields.photosLink,
        videosLink: sheetFields.videosLink,
        problemId: masters.toId.problemId.get(normalizeName(sheetFields.problemId ?? "")),
        problemDetailOriginal: sheetFields.problemDetailOriginal,
        productId: insertProductId ?? undefined,
        quantity: insertQuantity,
        factoryId: masters.toId.factoryId.get(normalizeName(sheetFields.factoryId ?? "")),
        value: insertValue,
      });
      if (!parsed.success) {
        summary.skipped += 1;
        if (issues.length < MAX_ISSUES) {
          issues.push({
            row: row.sheetRow,
            code: row.code,
            reason: `Data sheet belum lengkap untuk app (${parsed.error.issues
              .map((i) => i.path.join("."))
              .join(", ")}).`,
          });
        }
        continue;
      }
      const { timestamp, ...rest } = parsed.data;
      const insertCode = normalizeCode(rest.codeGaransi);
      if (pendingInsertCodes.has(insertCode)) {
        // Sheet boleh punya Code Garansi ganda; di app kolomnya unik.
        summary.skipped += 1;
        if (issues.length < MAX_ISSUES) {
          issues.push({
            row: row.sheetRow,
            code: insertCode,
            reason: "Code Garansi ini sudah ada di baris sheet lain — hanya baris pertama yang dipakai.",
          });
        }
        continue;
      }
      pendingInsertCodes.add(insertCode);
      inserts.push({
        ...rest,
        // Teks asli "Keterangan Kendala" (Indonesia) dari sheet. Versi Inggrisnya
        // sengaja dibiarkan kosong: dimuat saat popup Detail Defect dibuka.
        problemDetailOriginal: sheetFields.problemDetailOriginal,
        statusId: await defaultStatusId(),
        timeStamp: timestamp,
        productPriceId: null,
        value: insertValue,
        sheetFields: JSON.stringify(baselineFromSheet(sheetFields)),
        sheetSyncedAt: now,
      });
      continue;
    }

    summary.matched += 1;
    // Pilihan user (per field) menang atas default "semua dari sheet/app".
    const explicit = options.only?.get(row.code);
    const choices: Record<GsheetField, FieldChoice> | null =
      explicit ??
      (options.defaultChoice
        ? (Object.fromEntries(
            GSHEET_FIELDS.map((field) => [field, options.defaultChoice as FieldChoice])
          ) as Record<GsheetField, FieldChoice>)
        : null);
    /**
     * Baris lama: baseline-nya dibuat waktu app masih membandingkan versi
     * Inggris kolom ini, jadi tidak punya kunci `problemDetailOriginal`. Isi
     * dengan teks app sekarang supaya perubahan di sheet terbaca sebagai "sheet
     * berubah" (bukan konflik) — tanpa ini 4.281 baris langsung jadi konflik.
     */
    if (local.baseline && local.baseline.problemDetailOriginal === undefined) {
      local.baseline.problemDetailOriginal = shortHash(local.fields.problemDetailOriginal ?? "");
    }

    const plan = planRowSync({
      code: row.code,
      sheetRow: row.sheetRow,
      localId: local.id,
      sheet: sheetFields,
      app: local.fields,
      baseline: local.baseline,
      choices,
    });

    const patch: Partial<typeof defects.$inferInsert> = {};
    let applied = 0;

    const applyFromSheet = (diff: DiffField<GsheetField>) => {
      const field = diff.field;
      if (field === "quantity") {
        patch[field] = Number.parseInt(diff.sheet || "0", 10) || 0;
      } else if (field === "timeStamp") {
        patch.timeStamp = diff.sheet;
      } else if (isNameField(field)) {
        const id = masters.toId[field].get(normalizeName(diff.sheet));
        if (id === undefined) {
          summary.skipped += 1;
          if (issues.length < MAX_ISSUES) {
            issues.push({
              row: row.sheetRow,
              code: row.code,
              reason: `Nama "${diff.sheet}" untuk ${FIELD_LABEL[field]} belum ada di Data Master app.`,
            });
          }
          return;
        }
        patch[field] = id;
      } else {
        // Kolom teks di tabel defects semuanya notNull default "" — kosong berarti "".
        patch[field] = diff.sheet;
      }
      applied += 1;
    };

    // Perbaikan otomatis: nilai app yang TIDAK berbentuk baku (YYYY-MM-DDTHH:mm)
    // pasti bukan hasil edit operator — form app selalu menulis format itu.
    // Sisanya adalah data yang tersimpan waktu parser timestamp masih salah
    // (mis. "9/9/2026T23:10:4"), jadi diratakan dari sheet tanpa perlu ditanya.
    const storedStamp = local.rawTimeStamp ?? "";
    if (storedStamp && sheetFields.timeStamp && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(storedStamp)) {
      plan.apply = plan.apply.filter((d) => d.field !== "timeStamp");
      plan.conflicts = plan.conflicts.filter((d) => d.field !== "timeStamp");
      plan.baseline.timeStamp = shortHash(sheetFields.timeStamp);
      plan.apply.push({ field: "timeStamp", sheet: sheetFields.timeStamp, app: storedStamp });
      repairedTimestamps += 1;
    }

    for (const diff of plan.apply) applyFromSheet(diff);

    /**
     * Teks asli "Keterangan Kendala" (Indonesia) mengikuti sheet apa adanya.
     *
     * Kalau nilainya berubah, versi Inggris hasil terjemahan lama tidak berlaku
     * lagi: dikosongkan, lalu dimuat ulang saat popup Detail Defect dibuka
     * (penerjemahan tidak lagi dilakukan saat sync).
     */
    const originalChanged =
      patch.problemDetailOriginal !== undefined &&
      patch.problemDetailOriginal !== local.rawProblemDetailOriginal;
    if (originalChanged) {
      patch.problemDetail = "";
    }

    // Konflik yang sudah diputuskan (termasuk pilihan "pakai app": nilai app
    // dipertahankan, tidak ada yang ditulis ke sheet karena sheet read-only).
    summary.conflictsResolved += plan.resolved.length;
    summary.appOnlyChanges += plan.appOnly.length;

    const baselineJson = JSON.stringify(plan.baseline);
    const baselineChanged = baselineJson !== (local.baseline ? JSON.stringify(local.baseline) : null);
    if (applied > 0) {
      summary.appliedFields += applied;
      summary.rowsUpdated += 1;
      localUpdates.set(local.id, { ...patch, sheetFields: baselineJson, sheetSyncedAt: now });
    } else if (baselineChanged || originalChanged) {
      localUpdates.set(local.id, { ...patch, sheetFields: baselineJson, sheetSyncedAt: now });
    }

    if (plan.conflicts.length > 0) {
      summary.conflicts += plan.conflicts.length;
      if (conflicts.length < MAX_CONFLICTS) conflicts.push(toConflict(plan));
    } else if (plan.apply.length === 0 && plan.appOnly.length === 0) {
      summary.unchanged += 1;
    }
  }

  if (repairedTimestamps > 0) {
    issues.unshift({
      reason: `${repairedTimestamps} baris dengan timestamp format lama diperbaiki otomatis dari sheet.`,
    });
  }

  summary.onlyInApp = localRows.filter((row) => !seenCodes.has(row.code)).length;

  if (problemPush.pending > 0) {
    issues.unshift({
      reason: `${problemPush.pending} perubahan Problem belum terkirim ke Google Sheet — dicoba lagi sync berikutnya.`,
    });
  }

  // Nilai defect selalu diturunkan dari Price List (quantity × harga bulan
  // timestamp), jadi baris yang masih memakai harga lama ikut disesuaikan setiap
  // sync — termasuk barisnya sendiri tidak berubah di sheet. Baris yang produknya
  // belum punya harga dibiarkan apa adanya supaya tidak ada angka yang hilang.
  let valueAdjusted = 0;
  for (const row of localRows) {
    const next = defectValueFromMaster(priceRows, row.raw);
    if (next === null || next === row.raw.value) continue;
    localUpdates.set(row.id, { ...(localUpdates.get(row.id) ?? {}), value: next });
    valueAdjusted += 1;
  }
  if (valueAdjusted > 0) {
    issues.unshift({
      reason: `${valueAdjusted} baris nilainya disesuaikan ke harga Price List (quantity × harga).`,
    });
  }

  if (inserts.length > 0) {
    // Driver better-sqlite3 transaksinya sinkron: callback async ditolak.
    db.transaction((tx) => {
      for (const row of inserts) {
        try {
          // onConflictDoNothing: kalau barisnya sudah ada (mis. dibuat operator
          // saat sync berjalan), jangan gagalkan seluruh sync.
          const done = tx
            .insert(defects)
            .values(row)
            .onConflictDoNothing()
            .returning({ id: defects.id })
            .all();
          if (done.length === 0) {
            summary.skipped += 1;
            if (issues.length < MAX_ISSUES) {
              issues.push({
                code: String(row.codeGaransi ?? ""),
                reason: "Baris sudah ada di app (Code Garansi sama) — tidak diimpor ulang.",
              });
            }
          } else {
            summary.inserted += 1;
          }
        } catch (error) {
          summary.skipped += 1;
          if (issues.length < MAX_ISSUES) {
            issues.push({
              code: String(row.codeGaransi ?? ""),
              reason: `Gagal menyimpan baris dari sheet: ${(error as Error).message.slice(0, 120)}`,
            });
          }
        }
      }
    });
  }
  if (localUpdates.size > 0) {
    db.transaction((tx) => {
      for (const [id, patch] of localUpdates) {
        tx.update(defects).set(patch).where(eq(defects.id, id)).run();
      }
    });
  }

  // Baris yang teks Indonesianya ada tapi Inggrisnya belum (dimuat on-demand
  // saat Detail Defect dibuka). Dihitung sekali di akhir, bukan per baris.
  const awaitingRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(defects)
    .where(and(ne(defects.problemDetailOriginal, ""), eq(defects.problemDetail, "")));
  const awaitingTranslation = Number(awaitingRows[0]?.total ?? 0);

  return {
    summary: {
      ...summary,
      /** Baris dengan teks Indonesia tapi belum punya teks Inggris. */
      awaitingTranslation,
      /** Code Garansi + Problem yang barusan ditulis ke sheet (untuk laporan). */
      pushedProblems: problemPush.sent.map((push) => ({ code: push.code, name: push.name })),
    },
    conflicts,
    issues,
    conflictsTruncated: summary.conflicts > conflicts.length,
    tab,
  };
}

/** POST /api/defects/gsheet/sync — tarik perubahan sheet ke app (butuh admin). */
export async function defectsGsheetSync(req: NextRequest) {
  const guard = await requireMenu("defects", "write");
  if (!guard.ok) return guard.response;

  let body: { defaultChoice?: "sheet" | "app" } = {};
  try {
    body = (await req.json()) as { defaultChoice?: "sheet" | "app" };
  } catch {
    body = {};
  }
  if (body.defaultChoice !== undefined && body.defaultChoice !== "sheet" && body.defaultChoice !== "app") {
    return jsonError("Pilihan harus 'sheet' atau 'app'.", 422);
  }

  try {
    const result = await runSync({ defaultChoice: body.defaultChoice });
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return friendly(error, "Sync Google Sheet gagal.");
  }
}

/**
 * POST /api/defects/gsheet/resolve — terapkan pilihan user untuk konflik.
 * Tidak menulis ke sheet; "app" berarti nilai app dipertahankan.
 */
export async function defectsGsheetResolve(req: NextRequest) {
  const guard = await requireMenu("defects", "write");
  if (!guard.ok) return guard.response;

  const parsed = (await req.json().catch(() => ({}))) as {
    defaultChoice?: "sheet" | "app";
    items?: { rowKey?: string; codeGaransi?: string; choices?: Record<string, "sheet" | "app"> }[];
  };
  if (parsed.defaultChoice !== "sheet" && parsed.defaultChoice !== "app" && !parsed.items?.length) {
    return jsonError("Tidak ada pilihan resolusi yang dikirim.", 422);
  }

  const only = new Map<string, Record<string, "sheet" | "app">>();
  for (const item of parsed.items ?? []) {
    // rowKey dipakai dialog bersama (dipakai juga modul sales); codeGaransi nama lama.
    const code = normalizeCode(item.rowKey ?? item.codeGaransi ?? "");
    if (!code || !item.choices) continue;
    const choices: Record<string, "sheet" | "app"> = {};
    for (const [field, choice] of Object.entries(item.choices)) {
      if (choice === "sheet" || choice === "app") choices[field] = choice;
    }
    if (Object.keys(choices).length > 0) only.set(code, choices);
  }

  try {
    const result = await runSync({
      defaultChoice: parsed.defaultChoice,
      only: only.size > 0 ? only : undefined,
    });
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return friendly(error, "Menyelesaikan konflik gagal.");
  }
}
