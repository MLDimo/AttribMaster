"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { planById } from "@/lib/billing/plans";
import type { BillingInterval, SubscribablePlanId } from "@/lib/billing/plans";
import type { BillingAccount } from "@/lib/projects/types";

export function SubscribeDialog({
  projectId,
  plan,
  interval,
  open,
  onOpenChange,
}: {
  projectId: string;
  plan: SubscribablePlanId;
  interval: BillingInterval;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [accounts, setAccounts] = useState<BillingAccount[] | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/billing/accounts")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { accounts: BillingAccount[] } | null) => {
        const list = json?.accounts ?? [];
        setAccounts(list);
        if (list.length > 0) {
          setMode("existing");
          setSelectedAccountId(list[0].id);
        } else {
          setMode("new");
        }
      });
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          interval,
          ...(mode === "existing"
            ? { billingAccountId: selectedAccountId }
            : { newBillingAccountName: newAccountName }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Impossible de démarrer le paiement.");
        setSubmitting(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Impossible de démarrer le paiement.");
      setSubmitting(false);
    }
  }

  const planInfo = planById(plan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>S&apos;abonner — {planInfo.label}</DialogTitle>
          <DialogDescription>
            {interval === "monthly"
              ? `${planInfo.monthlyPriceEuros}€/mois + 50€ de frais d'installation`
              : `${(planInfo.monthlyPriceEuros ?? 0) * 12}€/an, facturé annuellement — frais d'installation offerts`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {accounts === null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <>
              {accounts.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label>Compte de facturation</Label>
                  <div className="flex flex-col gap-1.5 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={mode === "existing"}
                        onChange={() => setMode("existing")}
                      />
                      Utiliser un compte existant
                    </label>
                    {mode === "existing" && (
                      <select
                        className="ml-6 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
                      Créer un nouveau compte de facturation
                    </label>
                  </div>
                </div>
              )}

              {mode === "new" && (
                <div className="flex flex-col gap-1.5">
                  {accounts.length === 0 && <Label>Nom du compte de facturation</Label>}
                  <Input
                    autoFocus={accounts.length === 0}
                    placeholder="Ex: Facturation Acme Corp"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    required
                  />
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={submitting || (mode === "new" && !newAccountName.trim())}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : "Continuer vers le paiement"}
              </Button>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
