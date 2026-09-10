"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
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
  const { login, user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace("/report");
    }
  }, [user, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = login(username, password);
    if (!ok) {
      setError(true);
      return;
    }
    router.replace("/report");
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

      <Card className="animate-fade-in-up relative w-full max-w-sm gap-5 rounded-2xl shadow-2xl shadow-[oklch(0.648_0.1_209.8/0.18)] ring-1 ring-foreground/8 backdrop-blur-sm">
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
          <CardTitle className="text-gradient-brand mt-2 text-xl font-semibold">
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
                placeholder="admin"
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("common.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="animate-fade-in-soft rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t("login.error")}
              </p>
            )}
            <Button type="submit" className="w-full">
              {t("login.submit")}
            </Button>
          </form>

          <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              {t("login.demoAccount")}
            </p>
            <p>{t("login.demoAdmin")}</p>
            <p>{t("login.demoFactory")}</p>
            <p className="mt-1">{t("login.demoPassword")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
