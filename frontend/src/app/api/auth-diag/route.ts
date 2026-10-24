import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/response";

/**
 * Catatan percobaan login yang GAGAL dari halaman /login.
 *
 * Halaman login tidak punya sesi, jadi endpoint ini sengaja publik — karena itu
 * isinya dibatasi ketat: hanya 4 kB, hanya kolom di bawah, dan password TIDAK
 * PERNAH dikirim maupun dicatat. Hasilnya satu baris JSON per percobaan di
 * `<folder database>/auth-fail.log`:
 *   docker exec bardi-app tail -n 20 /data/auth-fail.log
 *
 * Gunanya: membedakan "username salah ketik/spasi" dari "password salah" tanpa
 * perlu menebak dari layar pengguna.
 */

const MAX_BODY_BYTES = 4 * 1024;
const MAX_LOG_BYTES = 2 * 1024 * 1024;

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string" || value === "") return null;
  return value.slice(0, max);
}

export async function POST(req: NextRequest) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return jsonError("Body terlalu besar.", 413);

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return jsonError("Body bukan JSON.", 400);

  const typed = typeof body.username === "string" ? body.username : "";
  const entry = {
    at: new Date().toISOString(),
    typedLength: typed.length,
    typed: str(typed, 120),
    trimmedLength: typed.trim().length,
    hasOuterSpace: typed !== typed.trim(),
    hasInnerSpace: /\s/.test(typed.trim()),
    nonAscii: /[^\x20-\x7e]/.test(typed) ? typed.replace(/[^\x20-\x7e]/g, "?") : null,
    code: str(body.code, 60),
    status: typeof body.status === "number" ? body.status : null,
    page: str(body.page, 200),
    ip: str(
      req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip"),
      80
    ),
    userAgent: str(req.headers.get("user-agent"), 300),
  };

  const dbFile = process.env.DB_FILE_NAME ?? "sqlite.db";
  const dir = path.dirname(path.resolve(/* turbopackIgnore: true */ dbFile));
  const logPath = path.join(dir, "auth-fail.log");

  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_BYTES) {
      fs.renameSync(logPath, `${logPath}.1`);
    }
    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
  } catch (err) {
    console.error("[auth-fail] gagal menulis log:", err);
    return jsonError("Gagal menyimpan log.", 500);
  }

  console.error(
    `[auth-fail] ${entry.code ?? "-"} dari ${entry.ip ?? "-"} username=${JSON.stringify(entry.typed)}`
  );
  return jsonOk({ logged: true });
}
