import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { factories, products, sales } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { GsheetError } from "@/lib/gsheet/auth";
import { batchGetValues, type SheetCell } from "@/lib/gsheet/values";
import { normalizeName, quoteTab } from "@/lib/gsheet/mapping";
import {
  SALES_FIELD_LABEL,
  parseSalesNumber,
  resolveSalesLayout,
  salesRowKey,
  type SalesField,
} from "@/lib/gsheet/sales-mapping";
import { planSalesCell } from "@/lib/gsheet/sales-sync";
import { parseBaseline, type FieldChoice } from "@/lib/gsheet/sync";

/**
 * Sync sales dari tab "Data Penjualan" Google Sheet — SATU ARAH: sheet -> app.
 *
 * Tab itu tabel lebar: satu baris = satu produk (kolom "Official Name" jadi acuan
 * produk, "Factory" jadi pabrik), lalu 12 pasang kolom QTY/Value per bulan. Semua
 * sel datanya rumus (`INDEX('Raw Penjualan'!...)`), jadi sheet-nya read-only —
 * tidak ada kode di sini yang menulis ke sheet, dan tidak boleh ada.
 *
 * Kontrak dengan user:
 * - kunci baris di app: produk + pabrik + bulan (sama dengan unique index `sales`);
 * - bulan yang di sheet masih 0 semua dan app belum punya barisnya dilewati;
 * - baris yang cuma ada di app dibiarkan (tidak pernah ditambahkan ke sheet);
 * - konflik diputuskan PER FIELD (Quantity / Value) lewat popup.
 */

const DEFAULT_SHEET_ID = "1TzJAH7mgIp8OK4l_VsE1GSYAp-IldcyM7TQwmdC8S3U";
const DEFAULT_TAB = "Data Penjualan";

const MAX_CONFLICTS = 300;
const MAX_ISSUES = 50;

function sheetConfig() {
  return {
    id: process.env.GSHEET_ID?.trim() || DEFAULT_SHEET_ID,
    tab: process.env.GSHEET_SALES_TAB?.trim() || DEFAULT_TAB,
  };
}

type Masters = {
  productId: Map<string, number>;
  factoryId: Map<string, number>;
  productName: Map<number, string>;
  factoryName: Map<number, string>;
};

async function loadMasters(): Promise<Masters> {
  const [productRows, factoryRows] = await Promise.all([
    db.select({ id: products.id, name: products.name }).from(products),
    db.select({ id: factories.id, name: factories.name }).from(factories),
  ]);
  return {
    productId: new Map(productRows.map((r) => [normalizeName(r.name), r.id] as const)),
    factoryId: new Map(factoryRows.map((r) => [normalizeName(r.name), r.id] as const)),
    productName: new Map(productRows.map((r) => [r.id, r.name] as const)),
    factoryName: new Map(factoryRows.map((r) => [r.id, r.name] as const)),
  };
}

type Summary = {
  sheetRows: number;
  localRows: number;
  matched: number;
  inserted: number;
  appliedFields: number;
  rowsUpdated: number;
  conflicts: number;
  conflictsResolved: number;
  unchanged: number;
  appOnlyChanges: number;
  onlyInApp: number;
  skipped: number;
  /** Bulan yang di sheet 0 semua dan belum ada barisnya di app. */
  emptyMonths: number;
};

type ConflictField = { field: string; label: string; sheet: string; app: string };
type ConflictRow = {
  rowKey: string;
  label: string;
  sheetRow: number;
  localId: number | null;
  fields: ConflictField[];
};

type Options = {
  defaultChoice?: FieldChoice;
  only?: Map<string, Record<string, FieldChoice>>;
};

async function runSync(options: Options) {
  const { id: spreadsheetId, tab } = sheetConfig();
  const masters = await loadMasters();
  const q = quoteTab(tab);

  // Baris 1-3: label bulan + sub-header QTY/Value (nilai tampilan, karena label
  // bulannya bisa berupa tanggal). Baris 4 ke bawah: angka asli (UNFORMATTED).
  const [head, body] = await Promise.all([
    batchGetValues(spreadsheetId, [`${q}!A1:ZZ3`], "FORMATTED_VALUE"),
    batchGetValues(spreadsheetId, [`${q}!A4:ZZ`], "UNFORMATTED_VALUE"),
  ]);

  const headRows = head[0]?.values ?? [];
  const layout = resolveSalesLayout(headRows[0] ?? [], headRows[1] ?? []);
  if (layout.missing.length > 0) {
    throw new GsheetError(
      "header-mismatch",
      `Struktur tab "${tab}" tidak sesuai: ${layout.missing.join(", ")}.`,
      layout.missing.join(", ")
    );
  }

  const rows = body[0]?.values ?? [];

  const summary: Summary = {
    sheetRows: 0,
    localRows: 0,
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
    emptyMonths: 0,
  };
  const issues: { row?: number; code?: string; reason: string }[] = [];
  const conflicts: ConflictRow[] = [];

  type Candidate = {
    key: string;
    label: string;
    sheetRow: number;
    productId: number;
    factoryId: number;
    month: string;
    quantity: number;
    value: number;
  };
  const candidates: Candidate[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] as SheetCell[];
    const official = String(row?.[layout.official] ?? "").trim();
    if (!official) continue; // baris "Total" dan baris kosong
    summary.sheetRows += 1;

    const productId = masters.productId.get(normalizeName(official));
    if (productId === undefined) {
      summary.skipped += 1;
      if (issues.length < MAX_ISSUES) {
        issues.push({
          row: i + 4,
          code: official,
          reason: `Produk "${official}" (Official Name) belum ada di Data Master produk.`,
        });
      }
      continue;
    }

    const factoryName = String(row?.[layout.factory] ?? "").trim();
    const factoryId = masters.factoryId.get(normalizeName(factoryName));
    if (factoryId === undefined) {
      summary.skipped += 1;
      if (issues.length < MAX_ISSUES) {
        issues.push({
          row: i + 4,
          code: official,
          reason: `Pabrik "${factoryName}" belum ada di Data Master pabrik.`,
        });
      }
      continue;
    }

    const productLabel = masters.productName.get(productId) ?? official;
    for (const m of layout.months) {
      candidates.push({
        key: salesRowKey(productId, factoryId, m.month),
        label: `${productLabel} · ${m.label}`,
        sheetRow: i + 4,
        productId,
        factoryId,
        month: m.month,
        // Kolom value di app bertipe integer (rupiah), jadi dibulatkan.
        quantity: Math.round(parseSalesNumber(row?.[m.qtyCol])),
        value: Math.round(parseSalesNumber(row?.[m.valCol])),
      });
    }
  }

  const localRows = await db
    .select({
      id: sales.id,
      productId: sales.productId,
      factoryId: sales.factoryId,
      month: sales.month,
      quantity: sales.quantity,
      value: sales.value,
      sheetFields: sales.sheetFields,
    })
    .from(sales);
  summary.localRows = localRows.length;

  const localByKey = new Map(localRows.map((r) => [salesRowKey(r.productId, r.factoryId, r.month), r]));
  const seenKeys = new Set<string>();
  const now = new Date();

  const inserts: (typeof sales.$inferInsert)[] = [];
  const localUpdates = new Map<number, Partial<typeof sales.$inferInsert>>();

  for (const candidate of candidates) {
    seenKeys.add(candidate.key);
    const local = localByKey.get(candidate.key);
    if (local) summary.matched += 1;

    const explicit = options.only?.get(candidate.key);
    const choices: Record<string, FieldChoice> | null =
      explicit ??
      (options.defaultChoice
        ? (Object.fromEntries(
            (["quantity", "value"] as SalesField[]).map((field) => [field, options.defaultChoice as FieldChoice])
          ) as Record<string, FieldChoice>)
        : null);

    const plan = planSalesCell({
      key: candidate.key,
      label: candidate.label,
      sheetRow: candidate.sheetRow,
      sheet: { quantity: candidate.quantity, value: candidate.value },
      app: local
        ? { localId: local.id, quantity: local.quantity, value: local.value }
        : null,
      baseline: local ? parseBaseline(local.sheetFields) : null,
      choices,
    });

    if (plan.empty) {
      summary.emptyMonths += 1;
      continue;
    }

    if (plan.insert) {
      inserts.push({
        productId: candidate.productId,
        factoryId: candidate.factoryId,
        month: candidate.month,
        quantity: plan.insert.quantity,
        value: plan.insert.value,
        sheetFields: JSON.stringify(plan.baseline),
        sheetSyncedAt: now,
      });
      continue;
    }

    const patch: Partial<typeof sales.$inferInsert> = {};
    for (const diff of plan.apply) {
      patch[diff.field as SalesField] = Number.parseInt(diff.sheet || "0", 10) || 0;
    }

    summary.conflictsResolved += plan.resolved.length;
    summary.appOnlyChanges += plan.appOnly.length;

    const baselineJson = JSON.stringify(plan.baseline);
    const baselineChanged =
      baselineJson !== (local?.sheetFields ? JSON.stringify(parseBaseline(local.sheetFields)) : null);
    if (Object.keys(patch).length > 0 && local) {
      summary.appliedFields += Object.keys(patch).length;
      summary.rowsUpdated += 1;
      localUpdates.set(local.id, { ...patch, sheetFields: baselineJson, sheetSyncedAt: now });
    } else if (baselineChanged && local) {
      localUpdates.set(local.id, { sheetFields: baselineJson, sheetSyncedAt: now });
    }

    if (plan.conflicts.length > 0) {
      summary.conflicts += plan.conflicts.length;
      if (conflicts.length < MAX_CONFLICTS) {
        conflicts.push({
          rowKey: plan.key,
          label: plan.label,
          sheetRow: plan.sheetRow,
          localId: plan.localId,
          fields: plan.conflicts.map((f) => ({
            field: f.field,
            label: SALES_FIELD_LABEL[f.field] ?? f.field,
            sheet: f.sheet,
            app: f.app,
          })),
        });
      }
    } else if (plan.apply.length === 0 && plan.appOnly.length === 0) {
      summary.unchanged += 1;
    }
  }

  summary.onlyInApp = localRows.filter((r) => !seenKeys.has(salesRowKey(r.productId, r.factoryId, r.month))).length;

  if (inserts.length > 0) {
    // Driver better-sqlite3 transaksinya sinkron: callback async ditolak.
    db.transaction((tx) => {
      for (const row of inserts) {
        try {
          const done = tx
            .insert(sales)
            .values(row)
            .onConflictDoNothing()
            .returning({ id: sales.id })
            .all();
          if (done.length === 0) {
            summary.skipped += 1;
            if (issues.length < MAX_ISSUES) {
              issues.push({
                code: `${row.productId}/${row.factoryId}/${row.month}`,
                reason: "Baris produk + pabrik + bulan ini sudah ada di app — tidak diimpor ulang.",
              });
            }
          } else {
            summary.inserted += 1;
          }
        } catch (error) {
          summary.skipped += 1;
          if (issues.length < MAX_ISSUES) {
            issues.push({
              code: `${row.productId}/${row.factoryId}/${row.month}`,
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
        tx.update(sales).set(patch).where(eq(sales.id, id)).run();
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

function friendly(error: unknown, fallback: string) {
  if (error instanceof GsheetError) return jsonError(error.message, 502);
  console.error("[gsheet:sales]", error);
  return jsonError(fallback, 500);
}

/** POST /api/sales/gsheet/sync — tarik perubahan sheet ke app (butuh admin). */
export async function salesGsheetSync(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { defaultChoice?: FieldChoice } = {};
  try {
    body = (await req.json()) as { defaultChoice?: FieldChoice };
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
 * POST /api/sales/gsheet/resolve — terapkan pilihan user untuk konflik.
 * Tidak menulis ke sheet; "app" berarti nilai app dipertahankan.
 */
export async function salesGsheetResolve(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = (await req.json().catch(() => ({}))) as {
    defaultChoice?: FieldChoice;
    items?: { rowKey?: string; choices?: Record<string, FieldChoice> }[];
  };
  if (parsed.defaultChoice !== "sheet" && parsed.defaultChoice !== "app" && !parsed.items?.length) {
    return jsonError("Tidak ada pilihan resolusi yang dikirim.", 422);
  }

  const only = new Map<string, Record<string, FieldChoice>>();
  for (const item of parsed.items ?? []) {
    const key = String(item.rowKey ?? "").trim();
    if (!key || !item.choices) continue;
    const choices: Record<string, FieldChoice> = {};
    for (const [field, choice] of Object.entries(item.choices)) {
      if ((field === "quantity" || field === "value") && (choice === "sheet" || choice === "app")) {
        choices[field] = choice;
      }
    }
    if (Object.keys(choices).length > 0) only.set(key, choices);
  }

  try {
    const result = await runSync({ only, defaultChoice: parsed.defaultChoice });
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return friendly(error, "Menyimpan pilihan sync gagal.");
  }
}
