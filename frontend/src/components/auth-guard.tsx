"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const emptySubscribe = () => () => {};

function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const mounted = useMounted();
  const router = useRouter();

  useEffect(() => {
    if (mounted && !user) {
      router.replace("/login");
    }
  }, [mounted, user, router]);

  if (!mounted || !user) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Memuat…
      </div>
    );
  }

  return <>{children}</>;
}
