"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { apiGet } from "@/lib/api-client";
import { homeHref, type PermissionMap } from "@/lib/permissions";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /** Halaman pertama yang boleh dibuka role akun ini. */
  const goHome = useCallback(async () => {
    try {
      const profile = await apiGet<{ permissions: PermissionMap }>("/api/me");
      router.replace(homeHref(profile.permissions) ?? "/report");
    } catch {
      router.replace("/report");
    }
  }, [router]);

  useEffect(() => {
    if (!isPending && session?.user) {
      void goHome();
    }
  }, [isPending, session, goHome]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Username dirapikan dulu: spasi/newline sisa salin-tempel bikin
    // better-auth menjawab "Invalid username or password" walau akunnya ada.
    const typed = username;
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError(true);
      return;
    }
    if (cleanUsername !== username) setUsername(cleanUsername);
    setSubmitting(true);
    setError(false);
    const { error: signInError } = await authClient.signIn.username({
      username: cleanUsername,
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError(true);
      // Jejak untuk operator: apa yang benar-benar diketik (password tidak ikut).
      void fetch("/api/auth-diag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: typed,
          code: signInError.code,
          status: signInError.status,
          page: "/login",
        }),
      }).catch(() => {});
      return;
    }
    await goHome();
  }

  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-[oklch(0.97_0.02_205)] via-background to-[oklch(0.94_0.035_207)] p-6 dark:from-[oklch(0.2_0.03_214)] dark:via-background dark:to-[oklch(0.23_0.04_212)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-80 rounded-full bg-[oklch(0.731_0.104_203.2/0.28)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -bottom-32 size-96 rounded-full bg-[oklch(0.648_0.1_209.8/0.22)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[oklch(0.816_0.084_204.3/0.16)] blur-3xl"
      />

      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      <Card className="relative w-full max-w-sm gap-5 rounded-2xl shadow-2xl shadow-[oklch(0.648_0.1_209.8/0.18)] ring-1 ring-foreground/8 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center overflow-hidden bg-white shadow-lg shadow-[oklch(0.648_0.1_209.8/0.25)] ring-1 ring-primary/15">
            <Image
              src="/logo.png"
              alt="Logo"
              width={64}
              height={64}
              className="size-16 object-cover"
              priority
            />
          </div>
          <CardTitle className="mt-2 text-xl font-semibold">
            {t("login.title")}
          </CardTitle>
          <CardDescription>{t("login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">{t("common.username")}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={() => setUsername((value) => value.trim())}
                placeholder={t("common.username")}
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("common.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={t(
                    showPassword ? "login.hidePassword" : "login.showPassword"
                  )}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t("login.error")}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t("common.loading") : t("login.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
