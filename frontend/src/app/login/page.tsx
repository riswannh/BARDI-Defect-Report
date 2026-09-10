"use client";

import { useEffect, useState } from "react";
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
import { Factory } from "lucide-react";

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
    <div className="relative flex min-h-full flex-1 items-center justify-center bg-muted/40 p-6">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Factory className="size-5" />
          </div>
          <CardTitle className="text-lg">{t("login.title")}</CardTitle>
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
              <p className="text-sm text-destructive">{t("login.error")}</p>
            )}
            <Button type="submit" className="w-full">
              {t("login.submit")}
            </Button>
          </form>

          <div className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium">{t("login.demoAccount")}</p>
            <p>{t("login.demoAdmin")}</p>
            <p>{t("login.demoFactory")}</p>
            <p className="mt-1">{t("login.demoPassword")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
