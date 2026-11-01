import { headers } from "next/headers";
import type { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rolePermissions, roles, userRoles } from "@/lib/db/schema";
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
  /** Nama tampilan (boleh spasi/huruf besar) — yang ditampilkan di UI. */
  name: string;
  /** Kunci login, selalu lowercase. */
  username: string;
  isAdmin: boolean;
  factoryId: number | null;
  /** Role utama (kompatibilitas data lama). */
  roleId: number | null;
  /** Semua group role yang dimiliki user. */
  roleIds: number[];
  /** Kode role utama, dipakai aturan yang membaca satu kode. */
  roleCode: string | null;
  /** Semua kode role user; dicek untuk aturan Pabrik. */
  roleCodes: string[];
  permissions: PermissionMap;
  /**
   * Aturan khusus role Pabrik yang DI-HARDCODE (bukan dari matriks UI):
   * nilai/harga Rupiah tidak boleh ikut terkirim. Kalau user punya beberapa
   * role dan salah satunya Pabrik, nilainya tetap disembunyikan.
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
  const permissions = isAdmin ? fullPermissions() : emptyPermissions();

  // Daftar role: tabel `user_roles` (bisa banyak) + `user.roleId` sebagai role
  // utama. Akun lama yang belum punya baris `user_roles` tetap terbaca.
  const links = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, u.id));
  const roleIds = new Set<number>();
  for (const link of links) roleIds.add(link.roleId);
  if (u.roleId != null) roleIds.add(u.roleId);

  const roleRows =
    roleIds.size > 0
      ? await db
          .select({
            id: roles.id,
            code: roles.code,
            menu: rolePermissions.menu,
            canRead: rolePermissions.canRead,
            canWrite: rolePermissions.canWrite,
          })
          .from(roles)
          .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
          .where(inArray(roles.id, [...roleIds]))
      : [];

  const roleCodes: string[] = [];
  for (const row of roleRows) {
    if (!roleCodes.includes(row.code)) roleCodes.push(row.code);
    if (isAdmin) continue;
    if (isMenuKey(row.menu)) {
      const current = permissions[row.menu];
      permissions[row.menu] = {
        // Gabungan (union): satu role yang mengizinkan sudah cukup.
        read: current.read || Boolean(row.canRead),
        write: current.write || Boolean(row.canWrite),
      };
    }
  }

  // Role utama: `user.roleId` kalau ada, kalau tidak role pertama yang tertaut.
  const primaryRoleId = u.roleId ?? [...roleIds][0] ?? null;
  const primaryCode = primaryRoleId != null
    ? roleRows.find((row) => row.id === primaryRoleId)?.code ?? null
    : null;

  return {
    id: u.id,
    name: u.name,
    username: u.username ?? "",
    isAdmin,
    factoryId: u.factoryId ?? null,
    roleId: primaryRoleId,
    roleIds: [...roleIds],
    roleCode: primaryCode,
    roleCodes,
    permissions,
    hideFinance: !isAdmin && roleCodes.includes(PABRIK_ROLE_CODE),
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
