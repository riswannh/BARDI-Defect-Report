import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { factories, roles, user } from "@/lib/db/schema";
import { requireUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { profileUpdateSchema } from "@/lib/api/validation";
import { normalizeUsername, syntheticEmail, usernameTaken } from "@/lib/api/users";

/**
 * Profil akun sendiri: Nama (tampilan), Username (login), Jabatan, dan password.
 * Nama dan username sengaja dua field terpisah — masing-masing hanya menyentuh
 * kolomnya sendiri, tidak ada salin-menyalin.
 */
async function readProfile(userId: string) {
  const [row] = await db
    .select({
      name: user.name,
      username: user.username,
      displayUsername: user.displayUsername,
      jabatan: user.jabatan,
      isAdmin: user.isAdmin,
      roleName: roles.name,
      factoryName: factories.name,
    })
    .from(user)
    .leftJoin(roles, eq(roles.id, user.roleId))
    .leftJoin(factories, eq(factories.id, user.factoryId))
    .where(eq(user.id, userId));

  if (!row) return null;
  return {
    name: row.name,
    username: row.username ?? "",
    displayUsername: row.displayUsername ?? row.username ?? "",
    jabatan: row.jabatan,
    isAdmin: row.isAdmin,
    roleName: row.roleName,
    factoryName: row.factoryName,
  };
}

export async function profileGET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const profile = await readProfile(guard.user.id);
  if (!profile) return jsonError("User tidak ditemukan.", 404);
  return jsonOk(profile);
}

export async function profilePATCH(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const parsed = profileUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonError("Data profil tidak valid.", 422);
  }
  const { name, username, jabatan, currentPassword, newPassword } = parsed.data;

  if (newPassword) {
    if (!currentPassword) {
      return jsonError("Password saat ini wajib diisi.", 422);
    }
    // Better Auth memverifikasi password lama di server sebelum menggantinya.
    try {
      await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: false },
        headers: await headers(),
      });
    } catch {
      return jsonError("Password saat ini salah.", 400);
    }
  }

  const normalized = username ? normalizeUsername(username) : null;
  if (normalized && (await usernameTaken(normalized, guard.user.id))) {
    return jsonError("Username sudah ada.", 409);
  }

  await db
    .update(user)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(jabatan !== undefined ? { jabatan } : {}),
      ...(normalized
        ? {
            username: normalized,
            displayUsername: username?.trim() ?? normalized,
            email: syntheticEmail(normalized),
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(user.id, guard.user.id));

  const profile = await readProfile(guard.user.id);
  return jsonOk(profile);
}
