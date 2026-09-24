import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { defects, factories, problems, products, statuses } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { defectSchema } from "@/lib/api/validation";
import { GsheetError } from "@/lib/gsheet/auth";
import { batchGetValues, type SheetCell } from "@/lib/gsheet/values";
import {
  FIELD_LABEL,
  GSHEET_FIELDS,
  normalizeCode,
  normalizeName,
  parseSheetNumber,
  parseSheetTimestamp,
  quoteTab,
  resolveHeaderIndex,
  type GsheetField,
  type RowFields,
} from "@/lib/gsheet/mapping";
import {
  baselineFromSheet,
  parseBaseline,
  planRowSync,
  type FieldChoice,
  type DiffField,
  type RowPlan,
} from "@/lib/gsheet/sync";

/**
 * Sync defect dari tab "Big Data" Google Sheet — SATU ARAH: sheet -> app.
 *
 * Kolom A:H tab itu diisi `=ARRAYFORMULA('Raw CX Data'!A1:H)` (dan sebagian dari
 * IMPORTRANGE), jadi sheet-nya read-only: tidak ada kode di sini yang menulis
 * ke sheet, dan tidak boleh ada.
 *
 * Kontrak dengan user:
 * - kunci pencocokan baris: Code Garansi (di app unik);
 * - baris yang cuma ada di sheet ikut masuk ke app; baris yang cuma ada di app
 *   dibiarkan (tidak pernah ditambahkan ke sheet);
 * - konflik diputuskan PER FIELD dan popup hanya muncul kalau kedua sisi berubah
 *   pada field yang sama.
 */

const DEFAULT_SHEET_ID = "1TzJAH7mgIp8OK4l_VsE1GSYAp-IldcyM7TQwmdC8S3U";
const MAX_CONFLICTS = 300;
const MAX_ISSUES = 50;

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
};

type NameField = "problemId" | "statusId" | "factoryId" | "productId";

type Masters = {
  toName: Record<NameField, Map<number, string>>;
  toId: Record<NameField, Map<string, number>>;
};

const isNameField = (field: GsheetField): field is NameField =>
  field === "problemId" || field === "statusId" || field === "factoryId" || field === "productId";

const NAME_FIELDS: NameField[] = ["problemId", "statusId", "factoryId", "productId"];

/** Sel kosong di sheet dipetakan ke master bawaan app (sama seperti jalur impor Excel). */
const NAME_DEFAULT: Partial<Record<NameField, string>> = { problemId: "Kosong", statusId: "Open" };

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
  const [problemRows, statusRows, factoryRows, productRows] = await Promise.all([
    db.select({ id: problems.id, name: problems.name }).from(problems),
    db.select({ id: statuses.id, name: statuses.name }).from(statuses),
    db.select({ id: factories.id, name: factories.name }).from(factories),
    db.select({ id: products.id, name: products.name }).from(products),
  ]);
  const build = (rows: { id: number; name: string }[]) => ({
    toName: new Map(rows.map((r) => [r.id, r.name] as const)),
    toId: new Map(rows.map((r) => [normalizeName(r.name), r.id] as const)),
  });
  const p = build(problemRows);
  const s = build(statusRows);
  const f = build(factoryRows);
  const pr = build(productRows);
  return {
    toName: { problemId: p.toName, statusId: s.toName, factoryId: f.toName, productId: pr.toName },
    toId: { problemId: p.toId, statusId: s.toId, factoryId: f.toId, productId: pr.toId },
  };
}

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

/** Baca tab sheet: header + baris (nomor baris asli ikut disimpan untuk pesan error). */
async function readSheet(spreadsheetId: string, tab: string) {
  const [first] = await batchGetValues(spreadsheetId, [`${quoteTab(tab)}!A1:O`]);
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
    if (field === "quantity" || field === "value") out[field] = String(parseSheetNumber(raw));
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
    problemDetail: string | null;
    productId: number;
    quantity: number;
    statusId: number;
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
    problemDetail: row.problemDetail ?? "",
    productId: masters.toName.productId.get(row.productId) ?? "",
    quantity: String(row.quantity ?? 0),
    statusId: masters.toName.statusId.get(row.statusId) ?? "",
    factoryId: masters.toName.factoryId.get(row.factoryId) ?? "",
    value: String(row.value ?? 0),
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
      problemDetail: defects.problemDetail,
      productId: defects.productId,
      quantity: defects.quantity,
      statusId: defects.statusId,
      factoryId: defects.factoryId,
      value: defects.value,
      sheetFields: defects.sheetFields,
    })
    .from(defects);
  return rows.map((row) => ({
    id: row.id,
    code: normalizeCode(row.codeGaransi),
    fields: localFieldsFromRow(row, masters),
    baseline: parseBaseline(row.sheetFields),
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
async function runSync(options: {
  defaultChoice?: "sheet" | "app";
  only?: Map<string, Record<string, "sheet" | "app">>;
}) {
  const { id: spreadsheetId, tab } = sheetConfig();
  const masters = await loadMasters();
  const sheet = await readSheet(spreadsheetId, tab);
  const localRows = await loadLocalRows(masters);
  const localByCode = new Map(localRows.map((row) => [row.code, row]));

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
  };
  const issues: { row?: number; code?: string; reason: string }[] = [];
  const conflicts: ConflictRow[] = [];
  const now = new Date();

  const localUpdates = new Map<number, Partial<typeof defects.$inferInsert>>();
  const inserts: (typeof defects.$inferInsert)[] = [];
  const pendingInsertCodes = new Set<string>();
  const seenCodes = new Set<string>();

  for (const row of sheet.rows) {
    if (!row.code) continue;
    seenCodes.add(row.code);
    const sheetFields = sheetFieldsFromRow(row.cells, sheet.resolved.index);
    for (const field of NAME_FIELDS) {
      sheetFields[field] = canonicalName(masters, field, sheetFields[field] ?? "", NAME_DEFAULT[field]);
    }
    const local = localByCode.get(row.code);

    if (!local) {
      // Baris hanya ada di sheet -> masuk ke app. Baris hanya di app dibiarkan.
      const parsed = defectSchema.safeParse({
        codeGaransi: sheetFields.codeGaransi || row.code,
        timestamp: sheetFields.timeStamp,
        photosLink: sheetFields.photosLink,
        videosLink: sheetFields.videosLink,
        problemId: masters.toId.problemId.get(normalizeName(sheetFields.problemId ?? "")),
        problemDetail: sheetFields.problemDetail,
        productId: masters.toId.productId.get(normalizeName(sheetFields.productId ?? "")),
        quantity: Number.parseInt(sheetFields.quantity || "0", 10) || 0,
        statusId: masters.toId.statusId.get(normalizeName(sheetFields.statusId ?? "")),
        factoryId: masters.toId.factoryId.get(normalizeName(sheetFields.factoryId ?? "")),
        value: Number.parseInt(sheetFields.value || "0", 10) || 0,
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
        timeStamp: timestamp,
        productPriceId: null,
        value: parsed.data.value ?? 0,
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
      if (field === "quantity" || field === "value") {
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

    for (const diff of plan.apply) applyFromSheet(diff);

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
    } else if (baselineChanged) {
      localUpdates.set(local.id, { sheetFields: baselineJson, sheetSyncedAt: now });
    }

    if (plan.conflicts.length > 0) {
      summary.conflicts += plan.conflicts.length;
      if (conflicts.length < MAX_CONFLICTS) conflicts.push(toConflict(plan));
    } else if (plan.apply.length === 0 && plan.appOnly.length === 0) {
      summary.unchanged += 1;
    }
  }

  summary.onlyInApp = localRows.filter((row) => !seenCodes.has(row.code)).length;

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

  return {
    summary,
    conflicts,
    issues,
    conflictsTruncated: summary.conflicts > conflicts.length,
    tab,
  };
}

/** POST /api/defects/gsheet/sync — tarik perubahan sheet ke app (butuh admin). */
export async function defectsGsheetSync(req: NextRequest) {
  const guard = await requireAdmin();
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
  const guard = await requireAdmin();
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
