import { GSHEET_FIELDS, shortHash, type GsheetField, type RowFields } from "./mapping";

export type DiffField<F extends string = string> = { field: F; sheet: string; app: string };

export type FieldChoice = "sheet" | "app";

/**
 * Hasil perbandingan beberapa field (sheet vs app) memakai baseline hash.
 * - `apply`     : sheet berubah, app belum ikut -> nilainya dipakai di app
 * - `conflicts` : dua-duanya berubah (atau belum pernah disinkron) -> user memilih
 * - `resolved`  : konflik yang sudah diputuskan user di popup
 * - `appOnly`   : app berubah, sheet tidak -> tidak ada yang ditulis ke mana pun
 *                 (sheet read-only); dicatat cuma sebagai informasi
 */
export type FieldPlan<F extends string> = {
  apply: DiffField<F>[];
  conflicts: DiffField<F>[];
  resolved: DiffField<F>[];
  appOnly: DiffField<F>[];
  /** Hash nilai sheet terakhir yang disepakati — pembanding sync berikutnya. */
  baseline: Record<string, string>;
};

/**
 * Aturan inti sync satu arah (sheet -> app), dipakai baris defect (tab "Big Data")
 * maupun sel sales (tab "Data Penjualan").
 *
 * Baseline sebuah field hanya maju kalau field itu sudah sepakat (nilainya sama,
 * sheet menang, app menang, atau user sudah memutuskan). Field yang masih konflik
 * sengaja tidak dicatat, supaya konfliknya muncul lagi di sync berikutnya sampai
 * benar-benar diputuskan.
 */
export function planFields<F extends string>(input: {
  fields: readonly F[];
  sheet: Partial<Record<F, string>>;
  app: Partial<Record<F, string>>;
  baseline: Record<string, string> | null;
  choices?: Record<string, FieldChoice> | null;
  /** Field yang cuma jadi kunci/pembanding, tidak pernah dianggap berubah. */
  ignore?: readonly F[];
}): FieldPlan<F> {
  const { fields, sheet, app, baseline, choices, ignore } = input;
  const plan: FieldPlan<F> = { apply: [], conflicts: [], resolved: [], appOnly: [], baseline: {} };

  for (const field of fields) {
    const sheetValue = sheet[field] ?? "";
    const appValue = app[field] ?? "";
    const sheetHash = shortHash(sheetValue);
    const diff: DiffField<F> = { field, sheet: sheetValue, app: appValue };

    if (ignore?.includes(field) || sheetValue === appValue) {
      plan.baseline[field] = sheetHash;
      continue;
    }

    /** Konflik: kalau user sudah memilih, keputusan itu yang dipakai. */
    const settle = () => {
      const choice = choices?.[field];
      if (!choice) {
        plan.conflicts.push(diff);
        return;
      }
      plan.baseline[field] = sheetHash;
      plan.resolved.push(diff);
      if (choice === "sheet") plan.apply.push(diff);
      else plan.appOnly.push(diff);
    };

    const baseHash = baseline?.[field];
    if (!baseHash) {
      settle();
      continue;
    }

    // Baseline = nilai sheet terakhir yang disepakati, jadi dua arah perubahan
    // bisa dipisahkan: sheet berubah kalau beda dari baseline, app berubah kalau
    // nilai app beda dari baseline.
    const sheetChanged = sheetHash !== baseHash;
    const appChanged = shortHash(appValue) !== baseHash;
    if (sheetChanged && appChanged) {
      settle();
      continue;
    }

    plan.baseline[field] = sheetHash;
    if (sheetChanged) plan.apply.push(diff);
    else plan.appOnly.push(diff);
  }

  return plan;
}

export type RowPlan = FieldPlan<GsheetField> & {
  code: string;
  sheetRow: number;
  localId: number;
};

/** Rencana sync satu baris defect (kunci: Code Garansi). */
export function planRowSync(input: {
  code: string;
  sheetRow: number;
  localId: number;
  sheet: RowFields;
  app: RowFields;
  baseline: Record<string, string> | null;
  choices?: Record<string, FieldChoice> | null;
}): RowPlan {
  const plan = planFields<GsheetField>({
    fields: GSHEET_FIELDS,
    sheet: input.sheet,
    app: input.app,
    baseline: input.baseline,
    choices: input.choices,
    // Code Garansi cuma kunci pencocokan; beda huruf besar/kecil bukan perubahan.
    ignore: ["codeGaransi"],
  });
  return { code: input.code, sheetRow: input.sheetRow, localId: input.localId, ...plan };
}

/** Baseline untuk sel/baris yang baru masuk dari sheet. */
export function baselineFromSheet(
  fields: Partial<Record<string, string | undefined>>,
  fieldList: readonly string[] = GSHEET_FIELDS
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fieldList) out[field] = shortHash(fields[field] ?? "");
  return out;
}

export function parseBaseline(raw: string | null | undefined): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") out[key] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}
