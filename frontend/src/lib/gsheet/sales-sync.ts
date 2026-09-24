import { SALES_FIELDS, type SalesField } from "./sales-mapping";
import { baselineFromSheet, planFields, type FieldChoice, type FieldPlan } from "./sync";

/**
 * Rencana sync satu sel tabel sales: kunci produk + pabrik + bulan, fieldnya
 * Quantity dan Value. Satu baris sheet (produk) melebar jadi sampai 12 rencana.
 */
export type SalesPlan = FieldPlan<SalesField> & {
  key: string;
  label: string;
  sheetRow: number;
  localId: number | null;
  /** Baris baru yang harus dibuat di app (null kalau tidak ada/0 semua). */
  insert: { quantity: number; value: number } | null;
  /** Bulan yang di sheet masih 0 semua dan app belum punya barisnya -> dilewati. */
  empty: boolean;
};

export function planSalesCell(input: {
  key: string;
  label: string;
  sheetRow: number;
  sheet: { quantity: number; value: number };
  app: { localId: number; quantity: number; value: number } | null;
  baseline: Record<string, string> | null;
  choices?: Record<string, FieldChoice> | null;
}): SalesPlan {
  const sheetFields: Record<string, string> = {
    quantity: String(input.sheet.quantity),
    value: String(input.sheet.value),
  };
  const base = {
    key: input.key,
    label: input.label,
    sheetRow: input.sheetRow,
    insert: null as SalesPlan["insert"],
    empty: false,
  };

  if (!input.app) {
    // Keputusan user: bulan yang di sheet masih 0 semua tidak dibuatkan baris.
    const empty = input.sheet.quantity === 0 && input.sheet.value === 0;
    return {
      ...base,
      localId: null,
      insert: empty ? null : { ...input.sheet },
      empty,
      apply: [],
      conflicts: [],
      resolved: [],
      appOnly: [],
      baseline: baselineFromSheet(sheetFields, SALES_FIELDS),
    };
  }

  const plan = planFields<SalesField>({
    fields: SALES_FIELDS,
    sheet: sheetFields,
    app: { quantity: String(input.app.quantity), value: String(input.app.value) },
    baseline: input.baseline,
    choices: input.choices,
  });

  return { ...base, localId: input.app.localId, ...plan };
}
