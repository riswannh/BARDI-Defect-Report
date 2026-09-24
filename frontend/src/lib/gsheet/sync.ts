import { GSHEET_FIELDS, shortHash, type GsheetField, type RowFields } from "./mapping";

export type DiffField = { field: GsheetField; sheet: string; app: string };

export type FieldChoice = "sheet" | "app";

/**
 * Rencana sync satu baris (SATU ARAH: sheet -> app). Keputusan PER FIELD:
 * - `apply`     : sheet berubah, app belum ikut -> nilainya dipakai di app
 * - `conflicts` : dua-duanya berubah (atau belum pernah disinkron) -> user memilih
 * - `resolved`  : konflik yang sudah diputuskan user di popup
 * - `appOnly`   : app berubah, sheet tidak -> tidak ada yang ditulis ke mana pun
 *                 (tab "Big Data" kolom A:H diisi ARRAYFORMULA, jadi read-only);
 *                 dicatat cuma sebagai informasi.
 */
export type RowPlan = {
  code: string;
  sheetRow: number;
  localId: number;
  apply: DiffField[];
  conflicts: DiffField[];
  resolved: DiffField[];
  appOnly: DiffField[];
  /** Hash nilai sheet terakhir yang disepakati — pembanding sync berikutnya. */
  baseline: Record<string, string>;
};

/**
 * Bandingkan satu baris app dengan satu baris sheet memakai baseline hash hasil
 * sync terakhir. Tanpa baseline (baris belum pernah disinkron) perbedaan
 * dianggap konflik: lebih aman bertanya daripada menimpa data.
 *
 * Baseline sebuah field hanya maju kalau field itu sudah sepakat (nilainya sama,
 * sheet menang, app menang, atau user sudah memutuskan). Field yang masih
 * konflik sengaja tidak dicatat, supaya konfliknya muncul lagi di sync berikutnya
 * sampai benar-benar diputuskan.
 */
export function planRowSync(input: {
  code: string;
  sheetRow: number;
  localId: number;
  sheet: RowFields;
  app: RowFields;
  baseline: Record<string, string> | null;
  choices?: Record<string, FieldChoice> | null;
}): RowPlan {
  const { code, sheetRow, localId, sheet, app, baseline, choices } = input;
  const plan: RowPlan = {
    code,
    sheetRow,
    localId,
    apply: [],
    conflicts: [],
    resolved: [],
    appOnly: [],
    baseline: {},
  };

  for (const field of GSHEET_FIELDS) {
    const sheetValue = sheet[field] ?? "";
    const appValue = app[field] ?? "";
    const sheetHash = shortHash(sheetValue);
    const diff: DiffField = { field, sheet: sheetValue, app: appValue };

    // Code Garansi cuma kunci pencocokan; beda huruf besar/kecil bukan perubahan.
    if (field === "codeGaransi" || sheetValue === appValue) {
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

/** Baseline untuk baris yang baru masuk dari sheet. */
export function baselineFromSheet(fields: RowFields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of GSHEET_FIELDS) out[field] = shortHash(fields[field] ?? "");
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
