import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rolePermissions, roles, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { roleCreateSchema, roleUpdateSchema } from "@/lib/api/validation";
import {
  MENU_KEYS,
  PABRIK_ROLE_CODE,
  type MenuKey,
  type PermissionEntry,
} from "@/lib/permissions";

type PermissionInput = { menu: MenuKey; read: boolean; write: boolean };

/**
 * Normalisasi matriks dari klien:
 * - write otomatis menyertakan read;
 * - menu khusus admin ("users") tidak pernah disimpan ke role.
 */
function normalizePermissions(input: PermissionInput[]): PermissionEntry[] {
  const byMenu = new Map<MenuKey, PermissionEntry>();
  for (const item of input) {
    if (!MENU_KEYS.includes(item.menu)) continue;
    if (item.menu === "users") continue;
    byMenu.set(item.menu, {
      menu: item.menu,
      read: item.write || item.read,
      write: item.write,
    });
  }
  return MENU_KEYS.filter((menu) => byMenu.has(menu)).map(
    (menu) => byMenu.get(menu) as PermissionEntry
  );
}

async function permissionsByRole(): Promise<
  Record<number, Record<string, { read: boolean; write: boolean }>>
> {
  const rows = await db
    .select({
      roleId: rolePermissions.roleId,
      menu: rolePermissions.menu,
      canRead: rolePermissions.canRead,
      canWrite: rolePermissions.canWrite,
    })
    .from(rolePermissions);

  const result: Record<
    number,
    Record<string, { read: boolean; write: boolean }>
  > = {};
  for (const row of rows) {
    result[row.roleId] ??= {};
    result[row.roleId][row.menu] = {
      read: Boolean(row.canRead) || Boolean(row.canWrite),
      write: Boolean(row.canWrite),
    };
  }
  return result;
}

export async function rolesGET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const [roleRows, matrix, userCounts] = await Promise.all([
    db.select().from(roles).orderBy(asc(roles.id)),
    permissionsByRole(),
    db
      .select({ roleId: user.roleId, total: user.id })
      .from(user)
      .then((rows) => {
        const counts: Record<number, number> = {};
        for (const row of rows) {
          if (row.roleId === null) continue;
          counts[row.roleId] = (counts[row.roleId] ?? 0) + 1;
        }
        return counts;
      }),
  ]);

  return jsonOk(
    roleRows.map((role) => ({
      ...role,
      permissions: matrix[role.id] ?? {},
      userCount: userCounts[role.id] ?? 0,
    }))
  );
}

export async function rolesPOST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = roleCreateSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data role tidak valid.", 422);

  const existing = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, parsed.data.name));
  if (existing.length > 0) return jsonError("Nama role sudah ada.", 409);

  const [created] = await db
    .insert(roles)
    .values({
      name: parsed.data.name,
      description: parsed.data.description,
      // `code` unik di DB tapi tidak dipakai role buatan admin; nilainya hanya
      // penanda unik supaya dua role kustom tidak bentrok.
      code: `custom-${Date.now()}`,
      isSystem: false,
    })
    .returning();

  const permissions = normalizePermissions(parsed.data.permissions);
  if (permissions.length > 0) {
    await db.insert(rolePermissions).values(
      permissions.map((permission) => ({
        roleId: created.id,
        menu: permission.menu,
        canRead: permission.read,
        canWrite: permission.write,
      }))
    );
  }

  return jsonOk({ ...created, permissions }, 201);
}

export async function rolesPATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const roleId = Number(id);
  if (!Number.isInteger(roleId)) return jsonError("Role tidak valid.", 422);

  const parsed = roleUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data role tidak valid.", 422);

  const [current] = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId));
  if (!current) return jsonError("Role tidak ditemukan.", 404);
  if (current.isSystem) {
    return jsonError("Role sistem tidak bisa diubah.", 400);
  }

  if (parsed.data.name && parsed.data.name !== current.name) {
    const duplicate = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, parsed.data.name));
    if (duplicate.some((row) => row.id !== roleId)) {
      return jsonError("Nama role sudah ada.", 409);
    }
  }

  await db
    .update(roles)
    .set({
      name: parsed.data.name ?? current.name,
      description: parsed.data.description ?? current.description,
      updatedAt: new Date(),
    })
    .where(eq(roles.id, roleId));

  if (parsed.data.permissions) {
    const permissions = normalizePermissions(parsed.data.permissions);
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (permissions.length > 0) {
      await db.insert(rolePermissions).values(
        permissions.map((permission) => ({
          roleId,
          menu: permission.menu,
          canRead: permission.read,
          canWrite: permission.write,
        }))
      );
    }
  }

  return jsonOk({ id: roleId });
}

/**
 * Role Pabrik adalah role sistem: aturan Rupiah tersembunyi di-hardcode, jadi
 * role ini tidak boleh dihapus.
 */
export async function rolesDELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const roleId = Number(id);
  if (!Number.isInteger(roleId)) return jsonError("Role tidak valid.", 422);

  const [current] = await db.select().from(roles).where(eq(roles.id, roleId));
  if (!current) return jsonError("Role tidak ditemukan.", 404);
  if (current.isSystem || current.code === PABRIK_ROLE_CODE) {
    return jsonError("Role sistem tidak bisa dihapus.", 400);
  }

  // User pemakai role ini jatuh ke tanpa-akses (perlu diatur ulang admin).
  await db
    .update(user)
    .set({ roleId: null })
    .where(eq(user.roleId, roleId));
  await db.delete(roles).where(eq(roles.id, roleId));

  return jsonOk({ deleted: roleId });
}
