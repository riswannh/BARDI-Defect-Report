import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export type ServiceAccount = { client_email: string; private_key: string };

/** Error dengan kode supaya route bisa menerjemahkan pesan yang jelas untuk user. */
export class GsheetError extends Error {
  code: string;
  detail?: string;

  constructor(code: string, message: string, detail?: string) {
    super(message);
    this.name = "GsheetError";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Kredensial diambil dari GOOGLE_SERVICE_ACCOUNT_JSON (JSON mentah atau base64)
 * atau dari berkas yang ditunjuk GOOGLE_SERVICE_ACCOUNT_FILE.
 */
export function loadServiceAccount(): ServiceAccount {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim();
  let raw: string | undefined;
  if (inline) {
    raw = inline.startsWith("{") ? inline : Buffer.from(inline, "base64").toString("utf8");
  } else if (file) {
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      throw new GsheetError(
        "credentials-missing",
        "Berkas kredensial Google tidak terbaca di server.",
        file
      );
    }
  }
  if (!raw) {
    throw new GsheetError(
      "credentials-missing",
      "Kredensial Google belum dipasang. Set GOOGLE_SERVICE_ACCOUNT_FILE (atau GOOGLE_SERVICE_ACCOUNT_JSON) di server."
    );
  }
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
  } catch {
    throw new GsheetError("credentials-invalid", "Isi kredensial Google bukan JSON yang valid.");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new GsheetError(
      "credentials-invalid",
      "Kredensial Google tidak punya client_email / private_key."
    );
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

const b64url = (input: string) => Buffer.from(input, "utf8").toString("base64url");

type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

/** Tukar JWT service account jadi access token (dengan cache sampai ~55 menit). */
export async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${signer.sign(sa.private_key).toString("base64url")}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new GsheetError(
      "auth-failed",
      "Google menolak kredensial service account.",
      `${body.error ?? res.status}: ${body.error_description ?? ""}`.slice(0, 300)
    );
  }
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

/** Alamat email service account — dipakai untuk instruksi "share sheet ke email ini". */
export function serviceAccountEmail(): string {
  return loadServiceAccount().client_email;
}
