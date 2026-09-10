import { headers } from "next/headers";
import type { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError } from "@/lib/api/response";

export interface SessionUser {
  id: string;
  username: string;
  isAdmin: boolean;
  factoryId: number | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as {
    id: string;
    name: string;
    username?: string | null;
    isAdmin?: boolean | null;
    factoryId?: number | null;
  };
  return {
    id: u.id,
    username: u.username ?? u.name,
    isAdmin: Boolean(u.isAdmin),
    factoryId: u.factoryId ?? null,
  };
}

export type GuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

export async function requireUser(): Promise<GuardResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: jsonError("Unauthorized", 401) };
  return { ok: true, user };
}

export async function requireAdmin(): Promise<GuardResult> {
  const result = await requireUser();
  if (!result.ok) return result;
  if (!result.user.isAdmin) {
    return { ok: false, response: jsonError("Forbidden", 403) };
  }
  return result;
}

/**
 * Role Pabrik terkunci pada pabriknya sendiri.
 * Admin bebas memilih (null = semua pabrik).
 */
export function scopedFactoryId(
  user: SessionUser,
  requested?: number | null
): number | null {
  if (!user.isAdmin) return user.factoryId;
  return requested ?? null;
}
