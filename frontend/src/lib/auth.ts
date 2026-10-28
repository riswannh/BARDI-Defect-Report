import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { db, schema } from "@/lib/db";

export const auth = betterAuth({
  appName: "Portal Produk BARDI",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  // Origin tambahan (mis. alamat LAN saat uji dari HP) — dipisah koma.
  // better-auth menolak POST login dengan 403 bila Origin tidak terdaftar.
  trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      isAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      factoryId: {
        type: "number",
        required: false,
        input: false,
      },
      roleId: {
        type: "number",
        required: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    username({
      minUsernameLength: 3,
      usernameValidator: (value) => /^[a-zA-Z0-9 _.-]+$/.test(value),
    }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
