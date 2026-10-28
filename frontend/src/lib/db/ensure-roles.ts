/**
 * Menyiapkan role bawaan & mengaitkan user lama.
 *
 * Dijalankan setiap container start (`db:seed`) SEBELUM seed data contoh,
 * jadi aman untuk database produksi yang sudah berisi: hanya menambah
 * tabel role bila belum ada dan mengisi `user.roleId` yang masih NULL.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./index";
import { rolePermissions, roles, user } from "./schema";
import { PABRIK_DEFAULT_PERMISSIONS, PABRIK_ROLE_CODE } from "../permissions";

export async function ensureRoles() {
  let pabrik = (
    await db.select().from(roles).where(eq(roles.code, PABRIK_ROLE_CODE)).limit(1)
  )[0];

  if (!pabrik) {
    pabrik = (
      await db
        .insert(roles)
        .values({
          name: "Pabrik",
          code: PABRIK_ROLE_CODE,
          description:
            "Tim pabrik (China): Report & PO read-only, nilai Rupiah disembunyikan.",
          isSystem: true,
        })
        .returning()
    )[0];
    await db.insert(rolePermissions).values(
      PABRIK_DEFAULT_PERMISSIONS.map((permission) => ({
        roleId: pabrik.id,
        menu: permission.menu,
        canRead: permission.read,
        canWrite: permission.write,
      }))
    );
    console.log(`Role Pabrik dibuat (id ${pabrik.id}).`);
  }

  const orphans = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.isAdmin, false), isNull(user.roleId)));

  if (orphans.length > 0) {
    await db
      .update(user)
      .set({ roleId: pabrik.id })
      .where(
        inArray(
          user.id,
          orphans.map((row) => row.id)
        )
      );
    console.log(`${orphans.length} user tanpa role dipindah ke role Pabrik.`);
  }
}
