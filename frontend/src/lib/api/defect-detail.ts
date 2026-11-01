import { TranslateError, normalizeText, translateTexts } from "@/lib/translate";

/**
 * Problem Detail disimpan dalam dua bahasa: `problemDetail` (Inggris) dan
 * `problemDetailOriginal` (Indonesia, teks asli "Keterangan Kendala").
 *
 * Aturan (keputusan user 1 Nov 2026):
 * - Operator cukup mengetik di satu bahasa; bahasa lainnya diisi otomatis lewat
 *   LibreTranslate saat menyimpan.
 * - Kalau layanan terjemahan mati, PENYIMPANAN DITOLAK. Layanan itu selalu
 *   dinyalakan di VPS, jadi kegagalan dianggap gangguan yang harus kelihatan.
 * - Kalau operator mengubah kedua bahasa, keduanya dipakai apa adanya (tidak
 *   ditimpa terjemahan).
 */
export class DetailTranslateError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "DetailTranslateError";
    this.status = status;
  }
}

type DetailPair = { problemDetail: string; problemDetailOriginal: string };

async function translateOne(
  text: string,
  from: "id" | "en",
  to: "id" | "en"
): Promise<string> {
  try {
    // Kunci `translations` memakai teks yang sudah dinormalisasi.
    const key = normalizeText(text);
    const { translations } = await translateTexts([key], { from, to });
    return translations.get(key) ?? "";
  } catch (error) {
    if (error instanceof TranslateError) {
      throw new DetailTranslateError(
        error.code === "rate-limit"
          ? "Layanan terjemahan sedang sibuk. Coba simpan lagi sebentar lagi."
          : "Layanan terjemahan tidak tersedia. Coba simpan lagi sebentar lagi.",
        error.code === "rate-limit" ? 429 : 503
      );
    }
    throw new DetailTranslateError(
      "Layanan terjemahan tidak tersedia. Coba simpan lagi sebentar lagi."
    );
  }
}

/**
 * Tentukan isi kedua kolom Problem Detail untuk satu penyimpanan.
 *
 * Mengembalikan `null` kalau tidak ada perubahan yang perlu ditulis, atau
 * `{ problemDetail, problemDetailOriginal }` kalau salah satu/keduanya berubah.
 * Melempar `DetailTranslateError` bila terjemahan dibutuhkan tapi gagal.
 */
export async function resolveProblemDetail(input: {
  problemDetail?: string;
  problemDetailOriginal?: string;
  current?: DetailPair;
}): Promise<DetailPair | null> {
  const current = input.current ?? { problemDetail: "", problemDetailOriginal: "" };
  const enProvided = input.problemDetail !== undefined;
  const idProvided = input.problemDetailOriginal !== undefined;
  const nextEn = (enProvided ? input.problemDetail! : current.problemDetail).trim();
  const nextId = (
    idProvided ? input.problemDetailOriginal! : current.problemDetailOriginal
  ).trim();

  const enChanged = enProvided && nextEn !== current.problemDetail;
  const idChanged = idProvided && nextId !== current.problemDetailOriginal;
  if (!enChanged && !idChanged) return null;

  if (enChanged && idChanged) {
    return { problemDetail: nextEn, problemDetailOriginal: nextId };
  }

  if (enChanged) {
    if (!nextEn) return { problemDetail: "", problemDetailOriginal: nextId };
    const translated = await translateOne(nextEn, "en", "id");
    if (!translated) {
      throw new DetailTranslateError(
        "Layanan terjemahan tidak bisa menerjemahkan Problem Detail ini.",
        422
      );
    }
    return { problemDetail: nextEn, problemDetailOriginal: translated };
  }

  if (!nextId) return { problemDetail: nextEn, problemDetailOriginal: "" };
  const translated = await translateOne(nextId, "id", "en");
  if (!translated) {
    throw new DetailTranslateError(
      "Layanan terjemahan tidak bisa menerjemahkan Problem Detail ini.",
      422
    );
  }
  return { problemDetail: translated, problemDetailOriginal: nextId };
}
