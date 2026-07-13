"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomPlanDialog } from "@/components/billing/custom-plan-dialog";
import { SubscribeDialog } from "@/components/billing/subscribe-dialog";
import { PLANS, SETUP_FEE_EUROS } from "@/lib/billing/plans";
import type { BillingInterval, SubscribablePlanId } from "@/lib/billing/plans";

export function PlanPicker({ projectId }: { projectId: string }) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [subscribePlan, setSubscribePlan] = useState<SubscribablePlanId | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-1 self-center rounded-full border bg-muted/50 p-1 text-sm">
        {(["monthly", "annual"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setInterval(value)}
            className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
              interval === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {value === "monthly" ? "Mensuel" : "Annuel"}
          </button>
        ))}
        {interval === "annual" && (
          <span className="mr-1.5 rounded-full bg-success/15 px-2 py-1 text-xs font-medium text-success">
            Frais d&apos;installation offerts
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{plan.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div>
                {plan.selfServe ? (
                  <>
                    <span className="font-mono text-2xl font-semibold tabular-nums">
                      {interval === "monthly" ? plan.monthlyPriceEuros : (plan.monthlyPriceEuros ?? 0) * 12}€
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {interval === "monthly" ? " / mois" : " / an"}
                    </span>
                    {interval === "monthly" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        + {SETUP_FEE_EUROS}€ d&apos;installation en option (setup BigQuery + projet)
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-mono text-2xl font-semibold tabular-nums">
                      À partir de {plan.fromPriceEuros}€
                    </span>
                    <span className="text-sm text-muted-foreground"> / mois</span>
                  </>
                )}
              </div>

              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                {plan.sessionLimitLabel}
              </p>

              <div className="mt-auto">
                {plan.selfServe ? (
                  <Button className="w-full" onClick={() => setSubscribePlan(plan.id as SubscribablePlanId)}>
                    S&apos;abonner
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setCustomOpen(true)}>
                    Nous contacter
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {subscribePlan && (
        <SubscribeDialog
          projectId={projectId}
          plan={subscribePlan}
          interval={interval}
          open={subscribePlan !== null}
          onOpenChange={(open) => !open && setSubscribePlan(null)}
        />
      )}
      <CustomPlanDialog projectId={projectId} open={customOpen} onOpenChange={setCustomOpen} />
    </div>
  );
}
