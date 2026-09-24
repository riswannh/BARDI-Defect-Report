import { GsheetError, getAccessToken } from "./auth";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

/** Nilai sel apa adanya seperti yang tampil di sheet (angka/teks sudah diformat Sheets). */
export type SheetCell = string | number | boolean | null;
export type SheetValues = SheetCell[][];

type ErrorBody = {
  error?: { code?: number; message?: string; status?: string; errors?: { reason?: string }[] };
};

/** Terjemahkan kegagalan Google jadi pesan yang bisa ditindaklanjuti operator. */
async function fail(res: Response, what: string): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as ErrorBody;
  const reason = body.error?.errors?.[0]?.reason ?? body.error?.status ?? String(res.status);
  const raw = body.error?.message ?? "";
  let message = `Gagal ${what} ke Google Sheet (${reason}).`;
  if (reason === "SERVICE_DISABLED" || raw.includes("has not been used in project")) {
    message = "Google Sheets API belum diaktifkan di project service account tersebut.";
  } else if (res.status === 401) {
    message = "Kredensial service account ditolak Google.";
  } else if (res.status === 403) {
    message = "Service account belum diberi akses ke spreadsheet ini (share sebagai Viewer).";
  } else if (res.status === 404) {
    message = "Spreadsheet atau tab-nya tidak ditemukan. Cek GSHEET_ID dan GSHEET_TAB.";
  } else if (res.status === 429 || res.status >= 500) {
    message = "Google sedang menolak/mengalami gangguan. Coba sync lagi sebentar.";
  }
  throw new GsheetError("google-api", message, `${reason}: ${raw}`.slice(0, 300));
}

async function call(
  path: string,
  init: RequestInit & { what: string }
): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const { what, ...rest } = init;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      ...(rest.headers ?? {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) await fail(res, what);
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

/** Metadata ringkas: judul + daftar tab (untuk memastikan tab "Big Data" ada). */
export async function getSpreadsheetMeta(spreadsheetId: string) {
  const body = await call(
    `/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties`,
    { method: "GET", what: "membaca info spreadsheet" }
  );
  const props = body.properties as { title?: string } | undefined;
  const sheets = (body.sheets ?? []) as { properties?: { title?: string; sheetId?: number } }[];
  return {
    title: props?.title ?? "",
    tabs: sheets.map((s) => s.properties?.title ?? "").filter(Boolean),
  };
}

/**
 * Baca beberapa range sekaligus; default nilai seperti yang tampil di sheet.
 *
 * Modul ini sengaja TIDAK punya fungsi tulis: tab "Big Data" kolom A:H diisi
 * ARRAYFORMULA dari tab lain, jadi menulis ke sana merusak formula (pernah
 * terjadi dan harus dipulihkan manual).
 */
export async function batchGetValues(
  spreadsheetId: string,
  ranges: string[],
  valueRenderOption: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA" = "FORMATTED_VALUE"
): Promise<{ range: string; values: SheetValues }[]> {
  if (ranges.length === 0) return [];
  const query = new URLSearchParams({ valueRenderOption, majorDimension: "ROWS" });
  for (const range of ranges) query.append("ranges", range);
  const body = await call(
    `/${encodeURIComponent(spreadsheetId)}/values:batchGet?${query.toString()}`,
    { method: "GET", what: "membaca data" }
  );
  const valueRanges = (body.valueRanges ?? []) as { range?: string; values?: SheetValues }[];
  return valueRanges.map((vr) => ({ range: vr.range ?? "", values: vr.values ?? [] }));
}
