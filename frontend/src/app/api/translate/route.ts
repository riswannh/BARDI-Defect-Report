import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { normalizeText, TranslateError, translateTexts } from "@/lib/translate";

/**
 * POST /api/translate — terjemahan lewat LibreTranslate self-host (batas kecil,
 * untuk isian teks di UI dan gelembung chat tiket nanti).
 *
 * Body: { q: string | string[], source?: "id", target?: "en" }
 * Balasan: { translatedText: string | string[] }
 *
 * Sync Google Sheet TIDAK lewat route ini (dia memakai `translateTexts()`
 * langsung supaya tidak lewat HTTP ke dirinya sendiri).
 */

const MAX_ITEMS = 20;
const MAX_CHARS = 6_000;

const pickTexts = (raw: unknown): string[] =>
  (Array.isArray(raw) ? raw : [raw])
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeText(item))
    .filter(Boolean);

export async function POST(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as {
    q?: unknown;
    source?: unknown;
    target?: unknown;
  };
  const raw = body.q;
  const texts = pickTexts(raw);
  if (texts.length === 0) return jsonError("Tidak ada teks yang dikirim.", 422);
  if (texts.length > MAX_ITEMS) return jsonError(`Maksimal ${MAX_ITEMS} teks per permintaan.`, 422);
  if (texts.join("").length > MAX_CHARS) {
    return jsonError(`Maksimal ${MAX_CHARS} karakter per permintaan.`, 422);
  }

  const from = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "id";
  const to = typeof body.target === "string" && body.target.trim() ? body.target.trim() : "en";

  try {
    const { translations } = await translateTexts(texts, { from, to });
    const out = texts.map((text) => translations.get(text) ?? "");
    return jsonOk({ translatedText: Array.isArray(raw) ? out : out[0] });
  } catch (error) {
    if (error instanceof TranslateError) {
      const status = error.code === "invalid" ? 422 : error.code === "rate-limit" ? 429 : 503;
      if (error.code === "unavailable") console.error("[translate]", error.detail ?? error.message);
      return jsonError(error.message, status);
    }
    console.error("[translate]", error);
    return jsonError("Terjemahan gagal.", 500);
  }
}
