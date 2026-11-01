/**
 * Kunci kolom formula tab "Big Data" supaya hanya kolom `Problem` (J) yang bisa
 * diketik manusia. Kolom A:I dan K:M diisi ARRAYFORMULA/XLOOKUP, jadi kecelakaan
 * ketik di sana bisa merusak feed data garansi.
 *
 * Idempoten: kalau proteksi dengan deskripsi yang sama sudah ada, dilewati.
 * Butuh kunci service account yang punya izin edit pada spreadsheet.
 *
 *   npx tsx scripts/gsheet-protect-formulas.ts          # pasang proteksi
 *   npx tsx scripts/gsheet-protect-formulas.ts --check  # hanya lihat status
 */
import { getAccessToken, serviceAccountEmail } from "../src/lib/gsheet/auth";

const SPREADSHEET_ID = process.env.GSHEET_ID ?? "1TzJAH7mgIp8OK4l_VsE1GSYAp-IldcyM7TQwmdC8S3U";
const TAB = process.env.GSHEET_TAB ?? "Big Data";
const API = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

const RANGES = [
  {
    description: "BARDI: kolom A:I berisi formula (Code Garansi .. Month) — jangan diedit",
    startColumnIndex: 0, // A
    endColumnIndex: 9, // I (eksklusif)
  },
  {
    description: "BARDI: kolom K:M berisi formula (Pabrik, Offical Name, Translate) — jangan diedit",
    startColumnIndex: 10, // K
    endColumnIndex: 13, // M (eksklusif)
  },
];

type Protection = {
  protectedRangeId?: number;
  description?: string;
  range?: { sheetId?: number; startColumnIndex?: number; endColumnIndex?: number };
};

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function main() {
  const checkOnly = process.argv.includes("--check");

  const metaRes = await call(
    `?fields=sheets(properties(sheetId,title),protectedRanges(protectedRangeId,description,range))`
  );
  if (!metaRes.ok) throw new Error(`Gagal membaca metadata (${metaRes.status}): ${await metaRes.text()}`);

  const meta = (await metaRes.json()) as {
    sheets?: { properties: { sheetId: number; title: string }; protectedRanges?: Protection[] }[];
  };
  const tab = meta.sheets?.find((sheet) => sheet.properties.title === TAB);
  if (!tab) throw new Error(`Tab "${TAB}" tidak ditemukan`);
  const sheetId = tab.properties.sheetId;
  const existing = tab.protectedRanges ?? [];

  console.log(`Spreadsheet : ${SPREADSHEET_ID}`);
  console.log(`Tab         : ${TAB} (sheetId ${sheetId})`);
  console.log(`Akses       : ${serviceAccountEmail()}`);
  console.log(`Proteksi    : ${existing.length ? JSON.stringify(existing, null, 1) : "(belum ada)"}\n`);

  const missing = RANGES.filter(
    (wanted) => !existing.some((have) => have.description === wanted.description)
  );
  if (checkOnly) {
    console.log(
      missing.length === 0
        ? "Semua kolom formula sudah terkunci."
        : `Belum terkunci: ${missing.map((item) => item.description).join("; ")}`
    );
    return;
  }
  if (missing.length === 0) {
    console.log("Tidak ada perubahan: proteksi sudah lengkap.");
    return;
  }

  const res = await call(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: missing.map((wanted) => ({
        addProtectedRange: {
          protectedRange: {
            range: {
              sheetId,
              startColumnIndex: wanted.startColumnIndex,
              endColumnIndex: wanted.endColumnIndex,
            },
            description: wanted.description,
            warningOnly: false,
          },
        },
      })),
    }),
  });
  if (!res.ok) throw new Error(`Gagal memasang proteksi (${res.status}): ${await res.text()}`);

  console.log(`Dipasang: ${missing.length} proteksi baru.`);
  for (const wanted of missing) console.log(`- ${wanted.description}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
