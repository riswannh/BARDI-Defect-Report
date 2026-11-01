import {
  GSHEET_FIELDS,
  normalizeCode,
  normalizeName,
  shortHash,
  type GsheetField,
  type RowFields,
} from "./mapping";

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

/**
 * Kunci baseline tambahan untuk teks ASLI kolom "Keterangan Kendala" (bahasa
 * Indonesia). `problemDetail` sendiri menyimpan hash versi INGGRIS-nya, karena
 * itulah yang tersimpan di app.
 */
export const PROBLEM_DETAIL_SOURCE = "problemDetailSource";

export type ProblemDetailAction = "translate" | "adopt" | "skip";

export type ProblemDetailPlan = {
  action: ProblemDetailAction;
  /** Hash teks asli sheet — dicatat supaya sync berikutnya tahu teksnya berubah. */
  sourceHash: string;
};

/**
 * Aturan kolom teks kendala (Indonesia -> Inggris), satu-satunya field yang
 * tidak boleh dibandingkan apa adanya antara sheet dan app.
 *
 * - teks sheet kosong            -> tidak ada yang perlu diterjemahkan;
 * - belum pernah sync (baseline  -> terjemahkan (nilainya dipakai kalau user
 *   null, mis. baris dari impor)    memilih "pakai sheet");
 * - baris lama tanpa kunci sumber -> ADOPSI: nilai app dipertahankan (data lama
 *   TIDAK di-backfill, sesuai keputusan user) dan teks asli sekarang dicatat
 *   sebagai patokan. Terjemahan baru jalan kalau teks sheet-nya berubah;
 * - kunci sumber ada tapi beda    -> teks sheet berubah, terjemahkan ulang;
 * - kunci sumber sama             -> tidak berubah, jangan terjemahkan lagi.
 *
 * Baris yang app-nya masih kosong (terjemahan sync sebelumnya gagal) tidak
 * pernah diadopsi, supaya sync berikutnya mencoba menerjemahkan lagi.
 */
export function planProblemDetail(input: {
  sheetText: string;
  appText: string;
  baseline: Record<string, string> | null;
}): ProblemDetailPlan {
  const sheetText = input.sheetText ?? "";
  const sourceHash = shortHash(sheetText);
  if (!sheetText) return { action: "skip", sourceHash };
  if (!input.baseline) return { action: "translate", sourceHash };
  const known = input.baseline[PROBLEM_DETAIL_SOURCE];
  if (known === undefined) {
    return { action: input.appText.trim() ? "adopt" : "translate", sourceHash };
  }
  return { action: known === sourceHash ? "skip" : "translate", sourceHash };
}

/**
 * Satu perubahan Problem yang siap dikirim ke sheet. `logIds` bisa lebih dari
 * satu kalau operator mengubah Problem berkali-kali sebelum sync berikutnya —
 * yang dikirim cukup nilai terakhir, tapi semua log ikut ditandai terkirim.
 */
export type ProblemPush = {
  code: string;
  sheetRow: number;
  problemId: number;
  /** Nama Problem terbaru dari master (fallback: nama saat perubahan dicatat). */
  name: string;
  logIds: number[];
};

export type ProblemLogEntry = {
  id: number;
  code: string;
  problemId: number;
  name: string;
};

export type ProblemPushPlan = {
  /** Ditulis ke kolom "Problem" di sheet. */
  writes: ProblemPush[];
  /** Sheet sudah bernilai sama → cukup ditandai terkirim, tanpa menulis. */
  already: ProblemPush[];
  /** Code Garansi tidak ada di sheet, jadi tidak ada baris yang bisa ditulis. */
  missing: { code: string; logIds: number[] }[];
  /** Melewati batas per-sync; tetap menunggu sync berikutnya. */
  queued: number;
};

/**
 * Rencana pengiriman perubahan Problem (app -> sheet), tanpa efek samping.
 *
 * Tempel di sini (bukan di api/gsheet.ts) supaya bisa diuji tanpa Google sama
 * sekali. Aturannya:
 * - log dipakai per Code Garansi, nilai TERAKHIR yang menang;
 * - kalau sheet sudah berisi nama yang sama, tidak perlu menulis apa pun;
 * - kalau barisnya tidak ada di sheet, log dilaporkan `missing` dan dibiarkan
 *   menunggu (tidak dihapus) supaya ketahuan saat sync berikutnya;
 * - sisanya ditulis sebanyak `limit` per sync, lebihnya ditunda.
 */
export function planProblemPushes(input: {
  logs: ProblemLogEntry[];
  rows: { code: string; sheetRow: number; problem: string }[];
  limit: number;
}): ProblemPushPlan {
  const latest = new Map<string, { entry: ProblemLogEntry; ids: number[] }>();
  for (const log of input.logs) {
    const code = normalizeCode(log.code);
    const current = latest.get(code);
    if (!current) {
      latest.set(code, { entry: log, ids: [log.id] });
      continue;
    }
    current.ids.push(log.id);
    // Nilai terakhir menang walau urutan id di input tidak rapi.
    if (log.id >= current.entry.id) current.entry = log;
  }

  const rows = new Map<string, { sheetRow: number; problem: string }>();
  for (const row of input.rows) rows.set(normalizeCode(row.code), row);

  const plan: ProblemPushPlan = { writes: [], already: [], missing: [], queued: 0 };
  for (const [code, { entry, ids }] of latest) {
    const row = rows.get(code);
    if (!row) {
      plan.missing.push({ code, logIds: ids });
      continue;
    }
    const push: ProblemPush = {
      code,
      sheetRow: row.sheetRow,
      problemId: entry.problemId,
      name: entry.name,
      logIds: ids,
    };
    if (normalizeName(row.problem) === normalizeName(entry.name)) {
      plan.already.push(push);
    } else if (plan.writes.length < input.limit) {
      plan.writes.push(push);
    } else {
      plan.queued += 1;
    }
  }
  return plan;
}
