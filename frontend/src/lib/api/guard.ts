import { headers } from "next/headers";
import type { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rolePermissions, roles } from "@/lib/db/schema";
import { jsonError } from "@/lib/api/response";
import {
  can,
  emptyPermissions,
  fullPermissions,
  isMenuKey,
  PABRIK_ROLE_CODE,
  type AccessMode,
  type MenuKey,
  type PermissionMap,
} from "@/lib/permissions";

export interface SessionUser {
  id: string;
  username: string;
  isAdmin: boolean;
  factoryId: number | null;
  roleId: number | null;
  roleCode: string | null;
  permissions: PermissionMap;
  /**
   * Aturan khusus role Pabrik yang DI-HARDCODE (bukan dari matriks UI):
   * nilai/harga Rupiah tidak boleh ikut terkirim.
   */
  hideFinance: boolean;
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
    roleId?: number | null;
  };

  const isAdmin = Boolean(u.isAdmin);
  const roleId = u.roleId ?? null;
  let roleCode: string | null = null;
  const permissions = isAdmin ? fullPermissions() : emptyPermissions();

  if (!isAdmin && roleId !== null) {
    const rows = await db
      .select({
        code: roles.code,
        menu: rolePermissions.menu,
        canRead: rolePermissions.canRead,
        canWrite: rolePermissions.canWrite,
      })
      .from(roles)
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(eq(roles.id, roleId));

    roleCode = rows[0]?.code ?? null;
    for (const row of rows) {
      if (isMenuKey(row.menu)) {
        permissions[row.menu] = {
          read: Boolean(row.canRead),
          write: Boolean(row.canWrite),
        };
      }
    }
  }

  return {
    id: u.id,
    username: u.username ?? u.name,
    isAdmin,
    factoryId: u.factoryId ?? null,
    roleId,
    roleCode,
    permissions,
    hideFinance: !isAdmin && roleCode === PABRIK_ROLE_CODE,
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
 * Penjaga berbasis menu + mode. Super admin selalu lolos; selain itu mengikuti
 * matriks role (`role_permissions`).
 */
export async function requireMenu(
  menu: MenuKey,
  mode: AccessMode = "read"
): Promise<GuardResult> {
  const result = await requireUser();
  if (!result.ok) return result;
  if (!can(result.user.permissions, menu, mode)) {
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
