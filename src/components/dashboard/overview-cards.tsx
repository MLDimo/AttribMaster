import { AlertTriangle, ArrowDownRight, ArrowUpRight, Receipt, TrendingUp, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/effects/animated-number";
import { StaggerContainer, StaggerItem } from "@/components/effects/motion";
import { TiltCard } from "@/components/effects/tilt-card";
import type { OverviewResponse } from "@/lib/attribution/api-types";

function makeCurrencyFormatter(currencies: string[]): (value: number) => string {
  // Une seule devise : on l'affiche. Plusieurs : montant brut sans symbole,
  // accompagné de l'avertissement (les totaux ne sont pas homogènes).
  if (currencies.length === 1) {
    const formatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: currencies[0] });
    return (value) => formatter.format(value);
  }
  const formatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
  return (value) => formatter.format(value);
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("fr-FR");
}

function KpiIcon({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div className={`flex size-9 items-center justify-center rounded-lg ${className}`}>
      {children}
    </div>
  );
}

export function OverviewCards({
  totals,
  comparisonLabel,
  currencies = ["EUR"],
}: {
  totals: OverviewResponse["totals"];
  comparisonLabel: string;
  currencies?: string[];
}) {
  const formatCurrency = makeCurrencyFormatter(currencies);
  const isPositive = (totals.revenueChangePct ?? 0) >= 0;
  const changeLabel =
    totals.revenueChangePct === null
      ? null
      : `${isPositive ? "+" : ""}${totals.revenueChangePct.toFixed(1)}%`;

  return (
    <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="overview-cards">
      {currencies.length > 1 && (
        <div
          role="alert"
          className="col-span-full flex items-start gap-2.5 rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-4 py-2.5 text-sm text-muted-foreground"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-accent" />
          <span>
            Plusieurs devises détectées sur la période ({currencies.join(", ")}) : les totaux
            additionnent des montants de devises différentes sans conversion et ne sont donc pas
            directement interprétables.
          </span>
        </div>
      )}
      <StaggerItem className="h-full">
      <TiltCard className="h-full">
        <Card className="h-full gap-3 py-5">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardDescription>Revenu attribué</CardDescription>
            <KpiIcon className="bg-brand-accent/15 text-brand-accent">
              <Wallet className="size-4" />
            </KpiIcon>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
              <AnimatedNumber value={totals.revenue} format={formatCurrency} />
            </span>
            {changeLabel && (
              <Badge variant={isPositive ? "success" : "destructive"} className="w-fit">
                {isPositive ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {changeLabel} vs {comparisonLabel.toLowerCase()}
              </Badge>
            )}
          </CardContent>
        </Card>
      </TiltCard>
      </StaggerItem>

      <StaggerItem className="h-full">
      <TiltCard className="h-full">
        <Card className="h-full gap-3 py-5">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardDescription>Transactions</CardDescription>
            <KpiIcon className="bg-primary/10 text-primary">
              <Receipt className="size-4" />
            </KpiIcon>
          </CardHeader>
          <CardContent>
            <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
              <AnimatedNumber value={totals.transactions} format={formatCount} />
            </span>
          </CardContent>
        </Card>
      </TiltCard>
      </StaggerItem>

      <StaggerItem className="h-full">
      <TiltCard className="h-full">
        <Card className="h-full gap-3 py-5">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardDescription>Revenu · {comparisonLabel}</CardDescription>
            <KpiIcon className="bg-muted text-muted-foreground">
              <TrendingUp className="size-4" />
            </KpiIcon>
          </CardHeader>
          <CardContent>
            <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
              <AnimatedNumber value={totals.previousRevenue} format={formatCurrency} />
            </span>
          </CardContent>
        </Card>
      </TiltCard>
      </StaggerItem>
    </StaggerContainer>
  );
}
