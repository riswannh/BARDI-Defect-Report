"use client";

import { createContext, useContext, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

export interface AppUser {
  id: string;
  username: string;
  isAdmin: boolean;
  factoryId: number | null;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  const sessionUser = session?.user;
  const user: AppUser | null = sessionUser
    ? {
        id: sessionUser.id,
        username: sessionUser.username ?? sessionUser.name ?? "",
        isAdmin: Boolean(sessionUser.isAdmin),
        factoryId: sessionUser.factoryId ?? null,
      }
    : null;

  const logout = async () => {
    await authClient.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: isPending,
        isAdmin: user?.isAdmin ?? false,
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
