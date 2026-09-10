"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { User } from "@/lib/types";
import { users as mockUsers } from "@/lib/mock-data";

interface AuthContextValue {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "headroom-defect-sales-user";

let currentUser: User | null = null;
const listeners = new Set<() => void>();

function readStorage(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): User | null {
  return currentUser;
}

function getServerSnapshot(): User | null {
  return null;
}

if (typeof window !== "undefined") {
  currentUser = readStorage();
}

function setCurrentUser(user: User | null) {
  currentUser = user;
  if (typeof window !== "undefined") {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  emit();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((username: string, password: string): boolean => {
    const found = mockUsers.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );
    if (!found || !password) return false;
    setCurrentUser(found);
    return true;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAdmin: user?.isAdmin ?? false,
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
