import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";

/**
 * Menampung laporan kegagalan jaringan dari browser (`fetch` hanya memberi
 * `TypeError: Failed to fetch`, jadi detailnya tidak bisa dibaca dari klien).
 *
 * Hasilnya satu baris JSON per kejadian di `<folder database>/client-errors.log`,
 * bisa dibaca dari VPS dengan:
 *   tail -n 20 /opt/bardi/data/client-errors.log
 *
 * Hanya pengguna yang sudah login yang boleh menulis (batas kepercayaan: tanpa
 * itu siapa pun bisa membanjiri berkas log), dan setiap kolom dipotong panjangnya.
 */

const MAX_BODY_BYTES = 64 * 1024;
const MAX_LOG_BYTES = 2 * 1024 * 1024;

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string" || value === "") return null;
  return value.slice(0, max);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return jsonError("Body terlalu besar.", 413);

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return jsonError("Body bukan JSON.", 400);

  const entry = {
    at: new Date().toISOString(),
    user: guard.user.username,
    url: str(body.url, 300),
    method: str(body.method, 10),
    requestBody: str(body.requestBody, 2000),
    errorName: str(body.errorName, 100),
    errorMessage: str(body.errorMessage, 500),
    errorStack: str(body.errorStack, 2000),
    page: str(body.page, 300),
    userAgent: str(req.headers.get("user-agent"), 300),
    online: typeof body.online === "boolean" ? body.online : null,
    attempts: num(body.attempts),
    durationMs: num(body.durationMs),
    protocol: str(body.protocol, 20),
    responseStatus: num(body.responseStatus),
  };

  const dbFile = process.env.DB_FILE_NAME ?? "sqlite.db";
  // `turbopackIgnore` menandai path ini memang dinamis (dari env); tanpa itu
  // Turbopack men-trace seluruh proyek ke output server.
  const dir = path.dirname(path.resolve(/* turbopackIgnore: true */ dbFile));
  const logPath = path.join(dir, "client-errors.log");

  try {
    // Satu berkas bergilir supaya log tidak tumbuh tanpa batas.
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_BYTES) {
      fs.renameSync(logPath, `${logPath}.1`);
    }
    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
  } catch (err) {
    console.error("[client-errors] gagal menulis log:", err);
    return jsonError("Gagal menyimpan log.", 500);
  }

  console.error(
    `[client-errors] ${entry.method} ${entry.url} :: ${entry.errorName}: ${entry.errorMessage}`
  );
  return jsonOk({ logged: true });
}
