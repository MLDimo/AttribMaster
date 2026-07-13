"use client";

import { CheckCircle2, CreditCard, XCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/layout/app-shell";
import { StaggerContainer, StaggerItem } from "@/components/effects/motion";
import type { MyAccountInfo } from "@/lib/account/types";
import type { BillingAccountWithProjects } from "@/lib/billing/repository";

export default function AccountPage() {
  const [account, setAccount] = useState<MyAccountInfo | null>(null);
  const [billingAccounts, setBillingAccounts] = useState<BillingAccountWithProjects[] | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { account: MyAccountInfo } | null) => {
        if (json) setAccount(json.account);
      });
    fetch("/api/account/billing-accounts")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { accounts: BillingAccountWithProjects[] } | null) => {
        setBillingAccounts(json?.accounts ?? []);
      });
  }, []);

  return (
    <AppShell>
      <StaggerContainer className="flex max-w-lg flex-col gap-5">
        <StaggerItem>
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
        </StaggerItem>

        <StaggerItem>
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
        </StaggerItem>

        <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              Comptes de facturation
            </CardTitle>
            <CardDescription>
              Comptes utilisés pour tes abonnements, et les projets qui s&apos;y rattachent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {billingAccounts === null ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : billingAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun compte de facturation pour le moment.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {billingAccounts.map((ba) => (
                  <div key={ba.id} className="flex flex-col gap-2 border-b pb-4 text-sm last:border-b-0 last:pb-0">
                    <span className="font-medium">{ba.name}</span>
                    {ba.projects.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Rattaché à aucun projet</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {ba.projects.map((p) => (
                          <Link key={p.id} href={`/projects/${p.id}/manage`}>
                            <Badge variant="secondary" className="transition-colors hover:bg-accent">
                              {p.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </StaggerItem>
      </StaggerContainer>
    </AppShell>
  );
}
