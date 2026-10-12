import {
  REPAIR_FIELDS,
  type RepairField,
  type RepairRowFields,
} from "./repair-mapping";
import { baselineFromSheet, parseBaseline, planFields, type DiffField } from "./sync";

/**
 * Aksi sync untuk satu baris repair.
 *
 * - `insert`     : Claim ID belum ada di app -> baris dibuat dari sheet
 * - `update`     : ada field yang berubah di sheet dan belum disentuh di app
 * - `keep-local` : app dan sheet dua-duanya berubah -> nilai app dipertahankan
 *                  (tanpa popup keputusan seperti modul Defect)
 * - `skip`       : tidak ada beda, atau app lebih baru
 */
export type RepairAction = "insert" | "update" | "keep-local" | "skip";

export type RepairRowPlan = {
  action: RepairAction;
  /** Field yang diambil dari sheet. */
  apply: RepairField[];
  /** Field yang berubah di dua sisi; nilai app yang dipakai. */
  conflicts: RepairField[];
  /** Semua field yang nilainya beda antara sheet dan app. */
  changed: RepairField[];
  baseline: Record<string, string>;
};

/**
 * Rencana sync satu baris repair (kunci: Claim ID).
 *
 * Aturan intinya sama dengan modul Defect (`planFields`), tapi tanpa popup
 * konflik: field yang bentrok dilewati dan dilaporkan, sisanya tetap masuk.
 */
export function planRepairRow(input: {
  sheet: RepairRowFields;
  /** Nilai app saat ini; `null` kalau Claim ID belum ada di app. */
  app: RepairRowFields | null;
  baseline: Record<string, string> | null;
}): RepairRowPlan {
  const { sheet, app, baseline } = input;

  if (!app) {
    return {
      action: "insert",
      apply: [...REPAIR_FIELDS],
      conflicts: [],
      changed: [...REPAIR_FIELDS],
      baseline: baselineFromSheet(sheet, REPAIR_FIELDS),
    };
  }

  // `claimId` cuma kunci pencocokan, jadi beda huruf besar/kecil bukan perubahan.
  const plan = planFields<RepairField>({
    fields: REPAIR_FIELDS,
    sheet,
    app,
    baseline,
    ignore: ["claimId"],
  });

  /**
   * Kolom app yang masih KOSONG tidak pernah dianggap "sudah diubah manusia":
   * isian yang dulu terlanjur dikosongkan (sparepart / Teknis Device yang belum
   * ada di Data Master) boleh diisi ulang oleh sheet.
   */
  const fillable = (diff: DiffField<RepairField>) => diff.app === "" && diff.sheet !== "";

  const apply = [
    ...new Set([
      ...plan.apply.map((diff) => diff.field),
      ...plan.appOnly.filter(fillable).map((diff) => diff.field),
      ...plan.conflicts.filter(fillable).map((diff) => diff.field),
    ]),
  ];
  const conflicts = plan.conflicts.filter((diff) => !fillable(diff)).map((diff) => diff.field);
  const changed = [...new Set([...apply, ...conflicts])];

  let action: RepairAction = "skip";
  if (apply.length > 0) action = "update";
  else if (conflicts.length > 0) action = "keep-local";

  return { action, apply, conflicts, changed, baseline: plan.baseline };
}

/** Baseline tersimpan dari baris app (kolom `sheetFields`). */
export const repairBaseline = (raw: string | null | undefined) => parseBaseline(raw);
