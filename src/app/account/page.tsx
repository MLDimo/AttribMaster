"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/layout/app-shell";
import type { MyAccountInfo } from "@/lib/account/types";

export default function AccountPage() {
  const [account, setAccount] = useState<MyAccountInfo | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { account: MyAccountInfo } | null) => {
        if (json) setAccount(json.account);
      });
  }, []);

  return (
    <AppShell>
      <div className="flex max-w-lg flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Mon compte</CardTitle>
            <CardDescription>Informations de ton compte</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between border-b pb-3 text-sm">
              <span className="text-muted-foreground">Nom</span>
              <span className="font-medium">{account?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{account?.email ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connexion Google</CardTitle>
            <CardDescription>
              Utilisée pour te connecter à AttribMaster avec ton compte Google.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {account?.googleLinked ? (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="size-4" />
                Compte Google connecté
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <XCircle className="size-4" />
                  Aucun compte Google connecté
                </div>
                <Button
                  variant="outline"
                  className="w-fit"
                  onClick={() => signIn("google", { callbackUrl: "/account" })}
                >
                  Connecter mon compte Google
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
