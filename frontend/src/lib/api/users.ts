import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { account, factories, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { userCreateSchema, userUpdateSchema } from "@/lib/api/validation";

function syntheticEmail(username: string) {
  return `${username.toLowerCase()}@pabrik.local`;
}

export async function createUserAccount(input: {
  username: string;
  password: string;
  isAdmin: boolean;
  factoryId: number | null;
}): Promise<string> {
  const result = await auth.api.signUpEmail({
    body: {
      email: syntheticEmail(input.username),
      password: input.password,
      name: input.username,
      username: input.username,
    },
  });

  await db
    .update(user)
    .set({ isAdmin: input.isAdmin, factoryId: input.factoryId })
    .where(eq(user.id, result.user.id));

  return result.user.id;
}

export async function usersGET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: user.id,
      username: user.username,
      name: user.name,
      isAdmin: user.isAdmin,
      factoryId: user.factoryId,
      factoryName: factories.name,
    })
    .from(user)
    .leftJoin(factories, eq(user.factoryId, factories.id))
    .orderBy(user.createdAt);

  return jsonOk(rows);
}

export async function usersPOST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = userCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonError("Data user tidak valid (password minimal 6 karakter).", 422);
  }

  const { username, password, isAdmin } = parsed.data;
  const factoryId = isAdmin ? null : parsed.data.factoryId ?? null;

  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username));
  if (existing.length > 0) return jsonError("Username sudah ada.", 409);

  try {
    const id = await createUserAccount({
      username,
      password,
      isAdmin,
      factoryId,
    });
    return jsonOk({ id, username, isAdmin, factoryId }, 201);
  } catch {
    return jsonError("Gagal membuat user.", 500);
  }
}

export async function usersPATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const parsed = userUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonError("Data user tidak valid (password minimal 6 karakter).", 422);
  }

  const rows = await db.select().from(user).where(eq(user.id, id));
  if (rows.length === 0) return jsonError("User tidak ditemukan.", 404);
  const current = rows[0];

  const username = parsed.data.username ?? current.username ?? "";
  const isAdmin = parsed.data.isAdmin ?? current.isAdmin;
  const factoryId = isAdmin
    ? null
    : parsed.data.factoryId !== undefined
      ? parsed.data.factoryId
      : current.factoryId;

  if (parsed.data.username && parsed.data.username !== current.username) {
    const duplicate = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, parsed.data.username));
    if (duplicate.some((row) => row.id !== id)) {
      return jsonError("Username sudah ada.", 409);
    }
  }

  await db
    .update(user)
    .set({
      username,
      name: username,
      email: syntheticEmail(username),
      isAdmin,
      factoryId,
      updatedAt: new Date(),
    })
    .where(eq(user.id, id));

  if (parsed.data.password) {
    const authCtx = await auth.$context;
    const hash = await authCtx.password.hash(parsed.data.password);
    await db
      .update(account)
      .set({ password: hash, updatedAt: new Date() })
      .where(
        and(eq(account.userId, id), eq(account.providerId, "credential"))
      );
  }

  return jsonOk({ id, username, isAdmin, factoryId });
}

export async function usersDELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  if (id === guard.user.id) {
    return jsonError("Tidak bisa menghapus akun sendiri.", 400);
  }

  const [row] = await db.delete(user).where(eq(user.id, id)).returning();
  if (!row) return jsonError("User tidak ditemukan.", 404);
  return jsonOk({ deleted: id });
}
