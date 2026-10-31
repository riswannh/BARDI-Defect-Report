"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";
import { apiPatch } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";
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

interface ProfileData {
  name: string;
  /** Kunci login (lowercase). */
  username: string;
  /** Ejaan username asli seperti diketik user. */
  displayUsername: string;
  jabatan: string;
  isAdmin: boolean;
  roleName: string | null;
  factoryName: string | null;
}

const EMPTY_PASSWORD_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ProfilePage() {
  const { t } = useLanguage();
  const { reloadProfile } = useAuth();
  const { data, reload } = useApi<ProfileData>("/api/profile");

  // Draf hanya menyimpan yang sudah diketik, sisanya mengikuti data server —
  // jadi form tetap benar walau jawaban `/api/profile` datang belakangan.
  const [identityDraft, setIdentityDraft] = useState<
    Partial<Pick<ProfileData, "name" | "displayUsername" | "jabatan">>
  >({});
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const name = identityDraft.name ?? data?.name ?? "";
  const username = identityDraft.displayUsername ?? data?.displayUsername ?? "";
  const jabatan = identityDraft.jabatan ?? data?.jabatan ?? "";

  async function saveIdentity(e: React.FormEvent) {
    e.preventDefault();
    if (savingIdentity) return;
    setSavingIdentity(true);
    try {
      await apiPatch("/api/profile", {
        name: name.trim(),
        username: username.trim(),
        jabatan: jabatan.trim(),
      });
      setIdentityDraft({});
      reload();
      reloadProfile();
      toast.success(t("profile.identitySaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSavingIdentity(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (savingPassword) return;
    if (passwordForm.newPassword.length < 6) {
      toast.error(t("profile.passwordMinLength"));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t("profile.passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    try {
      await apiPatch("/api/profile", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(EMPTY_PASSWORD_FORM);
      toast.success(t("profile.passwordSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("profile.title")} description={t("profile.description")} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("profile.identityTitle")}</CardTitle>
            <CardDescription>{t("profile.identityDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveIdentity} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-name">{t("common.name")}</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) =>
                    setIdentityDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  autoComplete="name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-username">{t("common.username")}</Label>
                <Input
                  id="profile-username"
                  value={username}
                  onChange={(e) =>
                    setIdentityDraft((d) => ({
                      ...d,
                      displayUsername: e.target.value,
                    }))
                  }
                  autoComplete="username"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  {t("profile.usernameHint")}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-jabatan">{t("common.jabatan")}</Label>
                <Input
                  id="profile-jabatan"
                  value={jabatan}
                  onChange={(e) =>
                    setIdentityDraft((d) => ({ ...d, jabatan: e.target.value }))
                  }
                  placeholder={t("profile.jabatanPlaceholder")}
                />
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">
                    {t("profile.roleLabel")}
                  </dt>
                  <dd className="truncate font-medium">
                    {data?.isAdmin
                      ? t("common.admin")
                      : (data?.roleName ?? t("users.noRole"))}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">
                    {t("profile.factoryLabel")}
                  </dt>
                  <dd className="truncate font-medium">
                    {data?.isAdmin ? t("header.allFactories") : (data?.factoryName ?? "-")}
                  </dd>
                </div>
              </dl>

              <div className="flex justify-end">
                <Button type="submit" disabled={savingIdentity || !data}>
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("profile.passwordTitle")}</CardTitle>
            <CardDescription>{t("profile.passwordDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-current-password">
                  {t("profile.currentPassword")}
                </Label>
                <Input
                  id="profile-current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({
                      ...f,
                      currentPassword: e.target.value,
                    }))
                  }
                  autoComplete="current-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-new-password">
                  {t("profile.newPassword")}
                </Label>
                <Input
                  id="profile-new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({
                      ...f,
                      newPassword: e.target.value,
                    }))
                  }
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-confirm-password">
                  {t("profile.confirmPassword")}
                </Label>
                <Input
                  id="profile-confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({
                      ...f,
                      confirmPassword: e.target.value,
                    }))
                  }
                  autoComplete="new-password"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={
                    savingPassword ||
                    !passwordForm.currentPassword ||
                    !passwordForm.newPassword
                  }
                >
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
