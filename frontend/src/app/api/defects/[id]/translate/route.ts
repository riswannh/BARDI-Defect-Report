import type { NextRequest } from "next/server";
import { DetailTranslateError, translateDefectDetail } from "@/lib/api/defect-detail";
import { requireMenu } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";

/**
 * POST /api/defects/[id]/translate — lengkapi Problem Detail bahasa lain.
 *
 * Dipanggil saat operator pertama kali membuka switch bahasa yang belum ada di
 * popup Detail Defect. Hasilnya disimpan ke database, jadi pembukaan berikutnya
 * tidak memanggil Google Sheet lagi.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireMenu("defects", "write");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const body = (await req.json().catch(() => ({}))) as { language?: unknown };
  if (body.language !== "en" && body.language !== "id") {
    return jsonError("Bahasa harus 'en' atau 'id'.", 422);
  }

  try {
    const result = await translateDefectDetail(rowId, body.language);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof DetailTranslateError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
