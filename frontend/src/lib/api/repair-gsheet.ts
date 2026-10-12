import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { problems, productPrices, products, repairs, spareParts } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { DEFAULT_PRICE_TYPE, normalizeDateOnly } from "@/lib/api/validation";
import { GsheetError } from "@/lib/gsheet/auth";
import { batchGetValues, type SheetCell } from "@/lib/gsheet/values";
import { normalizeName } from "@/lib/gsheet/mapping";
import {
  REPAIR_FIELDS,
  REPAIR_FIRST_DATA_ROW,
  REPAIR_HEADER_ROW,
  repairFieldsFromRow,
  resolveSparePart,
  repairSavingValue,
  repairSheetId,
  repairSheetRange,
  repairSheetTab,
  resolveRepairHeaderIndex,
  type RepairField,
  type RepairRowFields,
} from "@/lib/gsheet/repair-mapping";
import { baselineFromSheet } from "@/lib/gsheet/sync";
import { planRepairRow, repairBaseline } from "@/lib/gsheet/repair-sync";
import { pickProductPrice } from "@/lib/prices";
import type { ImportIssue, ImportResult, ProductPrice } from "@/lib/types";

/**
 * Sync satu arah sheet "Data Reparasi" -> app (modul Repair Data).
 *
 * Beda dari sync Defect: tidak ada popup keputusan konflik. Field yang berubah di
 * dua sisi (sheet dan app) DILEWATI dan dilaporkan di daftar "dilewati", sisanya
 * tetap masuk. Saving Value tidak pernah ditimpa sheet — angkanya milik app.
 *
 * Sama seperti sync Defect, sheet TIDAK pernah ditulis (read-only).
 */

// Daftar baris bermasalah ikut dikirim ke dialog sync, jadi plafonnya longgar:
// satu baris = satu keluhan, user butuh daftar lengkap untuk dibetulkan di sheet.
const MAX_ISSUES = 500;

/** Salinan kecil dari `friendly()` di api/gsheet.ts, label log beda modul. */
function friendly(error: unknown, fallback: string) {
  if (error instanceof GsheetError) {
    const status =
      error.code === "header-mismatch"
        ? 409
        : error.code.startsWith("credentials")
          ? 503
          : 502;
    return jsonError(error.message, status);
  }
  console.error("[gsheet:repair]", error);
  return jsonError(fallback, 500);
}

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

type MasterMap = { toId: Map<string, number>; toName: Map<number, string> };

function buildMaster(rows: { id: number; name: string }[]): MasterMap {
  const toId = new Map<string, number>();
  const toName = new Map<number, string>();
  for (const row of rows) {
    const key = normalizeName(row.name);
    if (key && !toId.has(key)) toId.set(key, row.id);
    toName.set(row.id, row.name);
  }
  return { toId, toName };
}

/** Nilai app dalam bentuk canonical yang sama dengan baris sheet. */
function appFieldsFromRow(
  row: typeof repairs.$inferSelect,
  productNames: MasterMap,
  problemNames: MasterMap,
  spareNames: MasterMap
): RepairRowFields {
  const nameOf = (map: MasterMap, id: number | null) =>
    id === null ? "" : (map.toName.get(id) ?? "");
  return {
    claimId: row.claimId,
    date: row.date,
    productId: row.productId ? (productNames.toName.get(row.productId) ?? "") : "",
    quantity: String(row.quantity),
    origin: row.origin,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    resi: row.resi,
    customerIssue: row.customerIssue,
    photoPackageLink: row.photoPackageLink,
    photoCompletenessLink: row.photoCompletenessLink,
    status: row.status,
    startAt: row.startAt,
    finishAt: row.finishAt,
    note: row.note,
    pic: row.pic,
    resolution: row.resolution,
    problemId: nameOf(problemNames, row.problemId),
    sparePart1Id: row.sparePart1Text || nameOf(spareNames, row.sparePart1Id),
    sparePart2Id: row.sparePart2Text || nameOf(spareNames, row.sparePart2Id),
    sparePart3Id: row.sparePart3Text || nameOf(spareNames, row.sparePart3Id),
    noteClosing: row.noteClosing,
  };
}

export type RepairSyncSummary = {
  sheetRows: number;
  localRows: number;
  created: number;
  updated: number;
  unchanged: number;
  keepLocal: number;
  skippedRows: number;
  /** Baris yang ada di app tapi Claim ID-nya tidak ada lagi di sheet. */
  onlyInApp: number;
};

export async function runRepairSync(): Promise<{
  result: ImportResult;
  summary: RepairSyncSummary;
  tab: string;
}> {
  const spreadsheetId = repairSheetId();
  const tab = repairSheetTab();

  const [first] = await batchGetValues(
    spreadsheetId,
    [repairSheetRange(tab)],
    "UNFORMATTED_VALUE"
  );
  const values = first?.values ?? [];
  if (values.length === 0) {
    throw new GsheetError("empty-sheet", `Tab "${tab}" kosong atau header tidak ada.`);
  }
  // Range sudah mulai di baris header (A3), jadi baris pertama hasil baca = header.
  const header = (values[0] ?? []).map((cell) => text(cell));
  const resolved = resolveRepairHeaderIndex(header);
  if (resolved.missing.length > 0) {
    // Sengaja ketat: kolom yang tidak ketemu akan terbaca kosong dan bisa
    // menghapus nilai yang sudah ada di app.
    throw new GsheetError(
      "header-mismatch",
      `Kolom berikut tidak ditemukan di tab "${tab}": ${resolved.missing.join(", ")}.`,
      `header: ${header.join(" | ")}`
    );
  }

  const rows = values
    .slice(REPAIR_FIRST_DATA_ROW - REPAIR_HEADER_ROW)
    .map((cells: SheetCell[], i) => ({
      sheetRow: i + REPAIR_FIRST_DATA_ROW,
      cells: cells ?? [],
    }));

  const [productRows, problemRows, spareRows, priceRows, appRows] = await Promise.all([
    db.select({ id: products.id, name: products.name }).from(products),
    db.select({ id: problems.id, name: problems.name }).from(problems),
    db.select({ id: spareParts.id, name: spareParts.name }).from(spareParts),
    db
      .select({
        id: productPrices.id,
        productId: productPrices.productId,
        price: productPrices.price,
        priceType: productPrices.priceType,
        month: productPrices.month,
        year: productPrices.year,
      })
      .from(productPrices)
      .where(eq(productPrices.priceType, DEFAULT_PRICE_TYPE)),
    db.select().from(repairs),
  ]);

  const productNames = buildMaster(productRows);
  const problemNames = buildMaster(problemRows);
  const spareNames = buildMaster(spareRows);
  const prices = priceRows as ProductPrice[];
  const priceOf = (productId: number, date: string) =>
    pickProductPrice(prices, productId, date.slice(0, 7), DEFAULT_PRICE_TYPE);

  const appByClaim = new Map<string, typeof repairs.$inferSelect>();
  for (const row of appRows) appByClaim.set(row.claimId, row);

  const now = new Date();
  /** Baris yang tidak jadi masuk sama sekali. */
  const errors: ImportIssue[] = [];
  /** Baris yang masuk tapi ada bagiannya yang tidak bisa dipakai apa adanya. */
  const skippedDetails: ImportIssue[] = [];
  const inserts: { sheetRow: number; values: typeof repairs.$inferInsert }[] = [];
  const updates = new Map<number, Partial<typeof repairs.$inferInsert>>();
  const summary: RepairSyncSummary = {
    sheetRows: rows.length,
    localRows: appRows.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    keepLocal: 0,
    skippedRows: 0,
    onlyInApp: 0,
  };

  const note = (list: ImportIssue[], row: number, key: string, reason: string) => {
    if (list.length < MAX_ISSUES) list.push({ row, key, reason });
  };

  /** Claim ID pertama yang dipakai di sheet, untuk mendeteksi baris ganda. */
  const claimedAt = new Map<string, number>();

  for (const { sheetRow, cells } of rows) {
    const sheetFields = repairFieldsFromRow(cells, resolved.index);
    const claimId = sheetFields.claimId ?? "";
    const blank = cells.every((cell) => text(cell) === "");
    if (!claimId) {
      if (!blank) {
        note(errors, sheetRow, "", "Claim ID di sheet kosong — baris dilewati.");
        summary.skippedRows += 1;
      }
      continue;
    }
    const firstRow = claimedAt.get(claimId);
    if (firstRow !== undefined) {
      note(
        errors,
        sheetRow,
        claimId,
        `Claim ID sudah dipakai baris ${firstRow} di sheet — baris ini dilewati (data baris pertama yang masuk).`
      );
      summary.skippedRows += 1;
      continue;
    }
    claimedAt.set(claimId, sheetRow);

    const productId = productNames.toId.get(normalizeName(sheetFields.productId ?? ""));
    const date = normalizeDateOnly(sheetFields.date ?? "");
    if (productId === undefined) {
      note(
        errors,
        sheetRow,
        claimId,
        `Produk "${sheetFields.productId ?? ""}" belum ada di Data Master — baris dilewati.`
      );
      summary.skippedRows += 1;
      continue;
    }
    if (!date) {
      note(errors, sheetRow, claimId, "Tanggal di sheet kosong/tidak dikenali — baris dilewati.");
      summary.skippedRows += 1;
      continue;
    }

    const problemId = sheetFields.problemId
      ? (problemNames.toId.get(normalizeName(sheetFields.problemId)) ?? null)
      : null;
    if (sheetFields.problemId && problemId === null) {
      note(
        skippedDetails,
        sheetRow,
        claimId,
        `Teknis Device "${sheetFields.problemId}" belum ada di Data Master — dikosongkan.`
      );
    }
    const spares = [sheetFields.sparePart1Id, sheetFields.sparePart2Id, sheetFields.sparePart3Id].map(
      (name, i) => {
        const resolved = resolveSparePart(name ?? "", spareNames.toId);
        if (resolved.text && resolved.id === null) {
          note(
            skippedDetails,
            sheetRow,
            claimId,
            `Sparepart ${i + 1} "${resolved.text}" belum ada di Data Master — teksnya disimpan apa adanya.`
          );
        }
        return resolved;
      }
    );
    const spareIds = spares.map((item) => item.id);
    const spareTexts = spares.map((item) => item.text);

    const quantity = Number.parseInt(sheetFields.quantity || "0", 10) || 0;
    const price = priceOf(productId, date);
    const local = appByClaim.get(claimId);
    const plan = planRepairRow({
      sheet: sheetFields,
      app: local ? appFieldsFromRow(local, productNames, problemNames, spareNames) : null,
      baseline: local ? repairBaseline(local.sheetFields) : null,
    });

    if (plan.action === "insert") {
      inserts.push({
        sheetRow,
        values: {
          claimId,
          date,
          month: date.slice(0, 7),
          productId,
          quantity,
          value: repairSavingValue(quantity, price?.price ?? 0),
          priceType: DEFAULT_PRICE_TYPE,
          productPriceId: price?.id ?? null,
          origin: sheetFields.origin ?? "",
          customerName: sheetFields.customerName ?? "",
          customerPhone: sheetFields.customerPhone ?? "",
          resi: sheetFields.resi ?? "",
          customerIssue: sheetFields.customerIssue ?? "",
          photoPackageLink: sheetFields.photoPackageLink ?? "",
          photoCompletenessLink: sheetFields.photoCompletenessLink ?? "",
          status: sheetFields.status ?? "",
          startAt: sheetFields.startAt ?? "",
          finishAt: sheetFields.finishAt ?? "",
          note: sheetFields.note ?? "",
          pic: sheetFields.pic ?? "",
          resolution: sheetFields.resolution ?? "",
          problemId,
          sparePart1Id: spareIds[0],
          sparePart2Id: spareIds[1],
          sparePart3Id: spareIds[2],
          sparePart1Text: spareTexts[0],
          sparePart2Text: spareTexts[1],
          sparePart3Text: spareTexts[2],
          noteClosing: sheetFields.noteClosing ?? "",
          sheetFields: JSON.stringify(baselineFromSheet(sheetFields, REPAIR_FIELDS)),
          sheetSyncedAt: now,
        },
      });
      continue;
    }

    if (!local) continue;

    if (plan.action === "keep-local") {
      summary.keepLocal += 1;
      note(
        skippedDetails,
        sheetRow,
        claimId,
        `Sheet dan app dua-duanya berubah (${plan.conflicts.join(", ")}) — nilai app dipertahankan.`
      );
      continue;
    }
    if (plan.action === "skip") {
      summary.unchanged += 1;
      // Baseline tetap disimpan supaya perubahan berikutnya terdeteksi.
      const baselineJson = JSON.stringify(plan.baseline);
      if (baselineJson !== local.sheetFields) {
        updates.set(local.id, { sheetFields: baselineJson, sheetSyncedAt: now });
      }
      continue;
    }

    const patch: Partial<typeof repairs.$inferInsert> = {};
    let productChanged = false;
    const applyField = (field: RepairField, value: string) => {
      switch (field) {
        case "claimId":
          return; // kunci pencocokan
        case "date":
          patch.date = value;
          patch.month = value.slice(0, 7);
          return;
        case "productId":
          patch.productId = productId;
          productChanged = true;
          return;
        case "quantity":
          patch.quantity = Number.parseInt(value || "0", 10) || 0;
          return;
        case "problemId":
          patch.problemId = problemId;
          return;
        case "sparePart1Id":
          patch.sparePart1Id = spareIds[0];
          patch.sparePart1Text = spareTexts[0];
          return;
        case "sparePart2Id":
          patch.sparePart2Id = spareIds[1];
          patch.sparePart2Text = spareTexts[1];
          return;
        case "sparePart3Id":
          patch.sparePart3Id = spareIds[2];
          patch.sparePart3Text = spareTexts[2];
          return;
        default:
          patch[field] = value;
      }
    };
    for (const field of plan.apply) applyField(field, sheetFields[field] ?? "");

    const nextQuantity = patch.quantity ?? local.quantity;
    const nextDate = patch.date ?? local.date;
    if (productChanged || patch.quantity !== undefined || patch.date !== undefined) {
      const nextPrice = priceOf(productId, nextDate);
      patch.value = repairSavingValue(nextQuantity, nextPrice?.price ?? 0);
      patch.productPriceId = nextPrice?.id ?? null;
    }

    updates.set(local.id, {
      ...patch,
      sheetFields: JSON.stringify(plan.baseline),
      sheetSyncedAt: now,
    });
    summary.updated += 1;
  }

  if (inserts.length > 0) {
    // Driver better-sqlite3 transaksinya sinkron: callback async ditolak.
    db.transaction((tx) => {
      for (const { sheetRow, values: row } of inserts) {
        try {
          const done = tx
            .insert(repairs)
            .values(row)
            .onConflictDoNothing()
            .returning({ id: repairs.id })
            .all();
          if (done.length === 0) {
            summary.skippedRows += 1;
            note(
              errors,
              sheetRow,
              String(row.claimId ?? ""),
              "Baris sudah ada di app (Claim ID sama) — tidak diimpor ulang."
            );
          } else {
            summary.created += 1;
          }
        } catch (error) {
          summary.skippedRows += 1;
          note(
            errors,
            sheetRow,
            String(row.claimId ?? ""),
            `Gagal menyimpan baris dari sheet: ${(error as Error).message.slice(0, 120)}`
          );
        }
      }
    });
  }
  if (updates.size > 0) {
    db.transaction((tx) => {
      for (const [id, patch] of updates) {
        tx.update(repairs).set(patch).where(eq(repairs.id, id)).run();
      }
    });
  }

  const result: ImportResult = {
    module: "repair-sync",
    totalRows: rows.length,
    // "Masuk" = baris yang ditulis ke app: baru dibuat + diperbarui.
    inserted: summary.created + summary.updated,
    skipped: summary.unchanged + summary.keepLocal,
    errors,
    skippedDetails,
  };

  // Baris yang masih ada di app tapi Claim ID-nya sudah tidak ada di sheet.
  for (const row of appRows) {
    if (!claimedAt.has(row.claimId)) summary.onlyInApp += 1;
  }

  return { result, summary, tab };
}

/** POST /api/repairs/gsheet/sync — tarik perubahan sheet ke app (admin saja). */
export async function repairsGsheetSync() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { result, summary, tab } = await runRepairSync();
    return jsonOk({ ok: true, result, summary, tab });
  } catch (error) {
    return friendly(error, "Sync Google Sheet Repair gagal.");
  }
}
