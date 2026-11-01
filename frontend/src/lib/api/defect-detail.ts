import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { defects } from "@/lib/db/schema";
import { SheetTranslateError, translateWithSheet } from "@/lib/translate-sheet";

/**
 * Problem Detail disimpan dalam dua bahasa: `problemDetail` (Inggris) dan
 * `problemDetailOriginal` (Indonesia, teks asli "Keterangan Kendala").
 *
 * Aturan (keputusan user 1 Nov 2026):
 * - Penyimpanan defect TIDAK menerjemahkan apa pun; operator cukup mengisi satu
 *   bahasa dan bahasa lain dimuat saat dibutuhkan.
 * - Saat popup Detail Defect pertama kali diminta bahasa yang belum ada, app
 *   memanggil Google Sheet milik user (lihat lib/translate-sheet.ts), lalu
 *   menyimpannya ke database. Pembukaan berikutnya langsung dari database.
 */
export class DetailTranslateError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "DetailTranslateError";
    this.status = status;
  }
}

export type DefectDetailPair = { problemDetail: string; problemDetailOriginal: string };

/** Ubah kegagalan sheet jadi pesan yang bisa ditindaklanjuti operator. */
function friendly(error: unknown): DetailTranslateError {
  if (error instanceof SheetTranslateError) {
    return new DetailTranslateError(error.message, error.code === "config" ? 503 : 502);
  }
  console.error("[defects:translate]", (error as Error)?.message ?? error);
  return new DetailTranslateError("Penerjemah Google Sheet gagal. Coba lagi sebentar.");
}

/**
 * Lengkapi satu baris defect dengan bahasa yang diminta.
 *
 * `language` adalah bahasa TUJUAN: "en" mengisi `problemDetail` dari teks
 * Indonesia, "id" mengisi `problemDetailOriginal` dari teks Inggris.
 */
export async function translateDefectDetail(
  defectId: number,
  language: "en" | "id"
): Promise<DefectDetailPair & { translated: boolean }> {
  const rows = await db
    .select({
      id: defects.id,
      problemDetail: defects.problemDetail,
      problemDetailOriginal: defects.problemDetailOriginal,
    })
    .from(defects)
    .where(eq(defects.id, defectId));
  const current = rows[0];
  if (!current) throw new DetailTranslateError("Data defect tidak ditemukan.", 404);

  const pair: DefectDetailPair = {
    problemDetail: current.problemDetail ?? "",
    problemDetailOriginal: current.problemDetailOriginal ?? "",
  };

  // Sudah ada: tidak perlu memanggil sheet sama sekali.
  if (language === "en" && pair.problemDetail.trim() !== "") {
    return { ...pair, translated: false };
  }
  if (language === "id" && pair.problemDetailOriginal.trim() !== "") {
    return { ...pair, translated: false };
  }

  const source = language === "en" ? pair.problemDetailOriginal : pair.problemDetail;
  if (source.trim() === "") {
    throw new DetailTranslateError(
      language === "en"
        ? "Baris ini belum punya teks Indonesia untuk diterjemahkan."
        : "Baris ini belum punya teks Inggris untuk diterjemahkan.",
      422
    );
  }

  let translated: string;
  try {
    translated = await translateWithSheet(
      source,
      language === "en" ? "id" : "en",
      language
    );
  } catch (error) {
    throw friendly(error);
  }

  const next: DefectDetailPair =
    language === "en"
      ? { problemDetail: translated, problemDetailOriginal: pair.problemDetailOriginal }
      : { problemDetail: pair.problemDetail, problemDetailOriginal: translated };

  await db.update(defects).set(next).where(eq(defects.id, defectId));
  return { ...next, translated: true };
}
