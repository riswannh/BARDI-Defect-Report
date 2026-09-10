"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
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
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      router.replace("/report");
    }
  }, [user, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = login(username, password);
    if (!ok) {
      setError("Username atau password salah.");
      return;
    }
    router.replace("/report");
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Factory className="size-5" />
          </div>
          <CardTitle className="text-lg">Defect &amp; Sales Analysis</CardTitle>
          <CardDescription>
            Masuk dengan username dan password Anda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full">
              Masuk
            </Button>
          </form>

          <div className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium">Demo account:</p>
            <p>Admin — username <code>admin</code></p>
            <p>Pabrik — username <code>pabrik_jkt</code></p>
            <p className="mt-1">Password bebas (tidak kosong).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
