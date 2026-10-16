import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { productPrices, products, warrantyClaims } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { DEFAULT_PRICE_TYPE, normalizeDateOnly } from "@/lib/api/validation";
import { claimMatchKey } from "@/lib/claim-match";
import { GsheetError } from "@/lib/gsheet/auth";
import { batchGetValues, type SheetCell } from "@/lib/gsheet/values";
import { normalizeCode, normalizeName, parseSheetNumber, parseSheetTimestamp } from "@/lib/gsheet/mapping";
import {
  CG_FIRST_DATA_ROW,
  CG_HEADER_ROW,
  cgCell,
  cgHeaderProblems,
  cgRaw,
  cgSheetId,
  cgSheetRange,
  cgSheetTab,
} from "@/lib/gsheet/cg-mapping";
import { pickProductPrice } from "@/lib/prices";
import type { ImportIssue, ImportResult, ProductPrice } from "@/lib/types";

/**
 * Sync satu arah tab "Raw Combine CG" (sheet "Data Garansi Produk") ke app.
 *
 * Sheet = sumber kebenaran untuk semua kolom isian. Yang dihitung app cuma
 * `value` = jumlah unit × harga Regional Warehouse bulan klaim dari Price List
 * app (keputusan user: JANGAN pakai harga tab "Data Produk" sheet).
 *
 * Baris yang datanya kurang (Claim ID / tanggal / produk tak dikenal / harga
 * belum ada) TETAP masuk dan ditandai `incompleteFields`. Baris yang tidak
 * diimpor hanya baris yang seluruh kolom terpentingnya kosong.
 */
export type WarrantySyncSummary = {
  sheetRows: number;
  localRows: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Baris yang masuk tapi ditandai tidak lengkap. */
  incompleteRows: number;
  /** Baris app yang Claim ID-nya tidak ada lagi di sheet (tidak dihapus). */
  onlyInApp: number;
  /** Contoh nama Official Name yang belum ada di Data Master. */
  unknownProducts: string[];
  /** Baris sheet yang seluruh kolom terpentingnya kosong (tidak diimpor). */
  skippedEmpty: number;
};

const MAX_ISSUES = 500;
const MAX_UNKNOWN = 20;

/** Salinan kecil dari `friendly()` di api/gsheet.ts, label log beda modul. */
function friendly(error: unknown, fallback: string) {
  if (error instanceof GsheetError) {
    const status =
      error.code === "header-mismatch" ? 409 : error.code.startsWith("credentials") ? 503 : 502;
    return jsonError(error.message, status);
  }
  console.error("[gsheet:cg]", error);
  return jsonError(fallback, 500);
}

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

export async function runWarrantySync(): Promise<{
  result: ImportResult;
  summary: WarrantySyncSummary;
  tab: string;
}> {
  const spreadsheetId = cgSheetId();
  const tab = cgSheetTab();

  const [first] = await batchGetValues(spreadsheetId, [cgSheetRange(tab)], "UNFORMATTED_VALUE");
  const values = first?.values ?? [];
  if (values.length === 0) {
    throw new GsheetError("empty-sheet", `Tab "${tab}" kosong atau header tidak ada.`);
  }
  // Range mulai di baris tajuk (A1), jadi baris pertama hasil baca = tajuk.
  const header = values[0] ?? [];
  const problems = cgHeaderProblems(header);
  if (problems.length > 0) {
    throw new GsheetError(
      "header-mismatch",
      `Kolom tab "${tab}" tidak seperti yang diharapkan: ${problems.join(", ")}.`,
      `header: ${header.map((cell) => text(cell)).join(" | ")}`
    );
  }

  const rows = values
    .slice(CG_FIRST_DATA_ROW - CG_HEADER_ROW)
    .map((cells: SheetCell[], i) => ({ sheetRow: i + CG_FIRST_DATA_ROW, cells: cells ?? [] }));

  const [productRows, priceRows, appRows] = await Promise.all([
    db.select({ id: products.id, name: products.name }).from(products),
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
    db.select().from(warrantyClaims),
  ]);

  const productByName = new Map<string, number>();
  for (const row of productRows) {
    const key = normalizeName(row.name);
    if (key && !productByName.has(key)) productByName.set(key, row.id);
  }
  const prices = priceRows as ProductPrice[];

  // Kunci baris bisa muncul lebih dari sekali (Claim ID boleh ganda), jadi tiap
  // kunci menyimpan antrean baris app yang belum dipasangkan.
  const appByKey = new Map<string, (typeof warrantyClaims.$inferSelect)[]>();
  for (const row of appRows) {
    const key = claimMatchKey(row.claimId, row.date, row.productId);
    const queue = appByKey.get(key);
    if (queue) queue.push(row);
    else appByKey.set(key, [row]);
  }

  const now = new Date();
  const errors: ImportIssue[] = [];
  const skippedDetails: ImportIssue[] = [];
  const inserts: { sheetRow: number; values: typeof warrantyClaims.$inferInsert }[] = [];
  const updates = new Map<number, Partial<typeof warrantyClaims.$inferInsert>>();
  const consumed = new Set<number>();
  const unknownProducts: string[] = [];
  const summary: WarrantySyncSummary = {
    sheetRows: rows.length,
    localRows: appRows.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    incompleteRows: 0,
    onlyInApp: 0,
    unknownProducts,
    skippedEmpty: 0,
  };

  const note = (list: ImportIssue[], row: number, key: string, reason: string) => {
    if (list.length < MAX_ISSUES) list.push({ row, key, reason });
  };

  for (const { sheetRow, cells } of rows) {
    const claimId = normalizeCode(cgCell(cells, "claimId"));
    const timeStamp = parseSheetTimestamp(cgRaw(cells, "timestamp"));
    const date = normalizeDateOnly(timeStamp.slice(0, 10));
    const officialName = text(cgCell(cells, "officialName"));
    const status = text(cgCell(cells, "status"));
    const rawQuantity = cgRaw(cells, "quantity");

    // Baris benar-benar kosong (sisa baris kosong di ujung tab) dilewati.
    if (!claimId && !timeStamp && !officialName && !status && !rawQuantity) {
      summary.skippedEmpty += 1;
      continue;
    }

    const incomplete: string[] = [];
    if (!claimId) incomplete.push("claimId");
    if (!date) incomplete.push("date");

    const productId = officialName ? (productByName.get(normalizeName(officialName)) ?? null) : null;
    if (!productId) {
      incomplete.push("product");
      if (officialName && !unknownProducts.includes(officialName)) {
        if (unknownProducts.length < MAX_UNKNOWN) unknownProducts.push(officialName);
      }
    }

    const quantity = Math.max(1, Math.round(parseSheetNumber(rawQuantity) || 1));
    const period = timeStamp.slice(0, 7);
    const price =
      productId && /^\d{4}-\d{2}$/.test(period)
        ? pickProductPrice(prices, productId, period, DEFAULT_PRICE_TYPE)
        : null;
    if (productId && !price) incomplete.push("price");

    const values = {
      claimId,
      date,
      month: date.slice(0, 7),
      timeStamp,
      customerName: text(cgCell(cells, "name")),
      customerPhone: text(cgCell(cells, "phone")),
      customerEmail: text(cgCell(cells, "email")),
      city: text(cgCell(cells, "city")),
      courier: text(cgCell(cells, "courier")),
      resiUnit: text(cgCell(cells, "resiUnit")),
      resi: text(cgCell(cells, "resi")),
      productForm: text(cgCell(cells, "productForm")),
      officialName,
      productId,
      quantity,
      status,
      sla: text(cgCell(cells, "sla")),
      pic: text(cgCell(cells, "pic")),
      note: text(cgCell(cells, "note")),
      value: price ? Math.round(quantity * price.price) : 0,
      priceType: DEFAULT_PRICE_TYPE,
      productPriceId: price?.id ?? null,
      incompleteFields: incomplete.join(","),
      sheetSyncedAt: now,
      updatedAt: now,
    } satisfies typeof warrantyClaims.$inferInsert;

    if (incomplete.length > 0) {
      summary.incompleteRows += 1;
      note(
        skippedDetails,
        sheetRow,
        claimId || officialName,
        `Ditandai tidak lengkap: ${incomplete.join(", ")}.`
      );
    }

    const key = claimMatchKey(claimId, date, productId);
    const queue = appByKey.get(key);
    const local = queue && queue.length > 0 ? queue.shift() : undefined;
    if (!local) {
      inserts.push({ sheetRow, values });
      continue;
    }
    consumed.add(local.id);

    const patch: Partial<typeof warrantyClaims.$inferInsert> = {};
    let changed = false;
    for (const [field, next] of Object.entries(values)) {
      // Dua kolom ini cuma jejak sync (selalu berubah tiap sync), jadi tidak
      // dihitung sebagai perubahan data.
      if (field === "sheetSyncedAt" || field === "updatedAt") continue;
      const before = (local as Record<string, unknown>)[field];
      if (before !== next) changed = true;
      patch[field as keyof typeof values] = next as never;
    }
    if (!changed) {
      summary.unchanged += 1;
      continue;
    }
    updates.set(local.id, patch);
  }

  if (inserts.length > 0) {
    // Driver better-sqlite3 transaksinya sinkron: callback async ditolak.
    db.transaction((tx) => {
      for (const { sheetRow, values: row } of inserts) {
        try {
          const done = tx.insert(warrantyClaims).values(row).returning({ id: warrantyClaims.id }).all();
          if (done.length === 0) {
            note(errors, sheetRow, row.claimId, "Baris tidak tersimpan ke app.");
          } else {
            summary.created += 1;
          }
        } catch (error) {
          note(
            errors,
            sheetRow,
            row.claimId,
            `Gagal menyimpan baris dari sheet: ${(error as Error).message.slice(0, 120)}`
          );
        }
      }
    });
  }
  if (updates.size > 0) {
    db.transaction((tx) => {
      for (const [id, patch] of updates) {
        tx.update(warrantyClaims).set(patch).where(eq(warrantyClaims.id, id)).run();
      }
    });
    summary.updated = updates.size;
  }

  for (const row of appRows) {
    if (!consumed.has(row.id)) summary.onlyInApp += 1;
  }

  const result: ImportResult = {
    module: "cg-sync",
    totalRows: rows.length,
    inserted: summary.created + summary.updated,
    skipped: summary.unchanged + summary.skippedEmpty,
    errors,
    skippedDetails,
  };

  return { result, summary, tab };
}

/** POST /api/warranty-claims/gsheet/sync — tarik tab "Raw Combine CG" (admin saja). */
export async function warrantyClaimsGsheetSync() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { result, summary, tab } = await runWarrantySync();
    return jsonOk({ ok: true, result, summary, tab });
  } catch (error) {
    return friendly(error, "Sync Google Sheet Claim Garansi gagal.");
  }
}
