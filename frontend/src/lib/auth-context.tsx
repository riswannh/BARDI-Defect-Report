"use client";

import { createContext, useContext, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { useApi } from "@/lib/use-api";
import {
  can as hasAccess,
  emptyPermissions,
  type AccessMode,
  type MenuKey,
  type PermissionMap,
} from "@/lib/permissions";

export interface AppUser {
  id: string;
  /** Nama tampilan dari sesi (sumber cepat sebelum `/api/me` menjawab). */
  name: string;
  username: string;
  isAdmin: boolean;
  factoryId: number | null;
}

/** Ringkasan akun + hak akses dari `/api/me`. */
export interface MeProfile {
  /** Nama tampilan (boleh spasi/huruf besar) — yang dipakai di UI. */
  name: string;
  /** Kunci login, selalu lowercase. */
  username: string;
  /** Ejaan username asli seperti diketik user. */
  displayUsername: string;
  /** Jabatan/posisi, teks bebas (boleh kosong). */
  jabatan: string;
  roleId: number | null;
  roleCode: string | null;
  roleName: string | null;
  hideFinance: boolean;
  permissions: PermissionMap;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  profile: MeProfile | null;
  /** true selama `/api/me` belum menjawab — penjaga menu menunggu ini. */
  profileLoading: boolean;
  roleName: string | null;
  hideFinance: boolean;
  can: (menu: MenuKey, mode?: AccessMode) => boolean;
  /** Muat ulang `/api/me` setelah profil sendiri disimpan. */
  reloadProfile: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NO_PERMISSIONS = emptyPermissions();

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  // `?u=` membuat useApi memuat ulang saat akun berganti tanpa reload penuh
  // (sign-out lalu sign-in di tab yang sama) — tanpa itu menu sempat memakai
  // hak akses akun sebelumnya.
  const { data: profile, reload: reloadProfile } = useApi<MeProfile>(
    session?.user ? `/api/me?u=${session.user.id}` : null
  );

  const sessionUser = session?.user;
  const user: AppUser | null = sessionUser
    ? {
        id: sessionUser.id,
        name: sessionUser.name ?? "",
        username: sessionUser.username ?? "",
        isAdmin: Boolean(sessionUser.isAdmin),
        factoryId: sessionUser.factoryId ?? null,
      }
    : null;

  const permissions = profile?.permissions ?? NO_PERMISSIONS;

  const logout = async () => {
    await authClient.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: isPending,
        isAdmin: user?.isAdmin ?? false,
        profile,
        profileLoading: Boolean(user) && !profile,
        roleName: profile?.roleName ?? null,
        hideFinance: profile?.hideFinance ?? false,
        can: (menu, mode = "read") => hasAccess(permissions, menu, mode),
        reloadProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
