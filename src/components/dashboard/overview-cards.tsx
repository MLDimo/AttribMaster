import { ArrowDownRight, ArrowUpRight, Receipt, TrendingUp, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { TiltCard } from "@/components/effects/tilt-card";
import type { OverviewResponse } from "@/lib/attribution/api-types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
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
}: {
  totals: OverviewResponse["totals"];
  comparisonLabel: string;
}) {
  const isPositive = (totals.revenueChangePct ?? 0) >= 0;
  const changeLabel =
    totals.revenueChangePct === null
      ? null
      : `${isPositive ? "+" : ""}${totals.revenueChangePct.toFixed(1)}%`;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <TiltCard>
        <Card className="gap-3 py-5">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardDescription>Revenu attribué</CardDescription>
            <KpiIcon className="bg-brand-accent/15 text-brand-accent">
              <Wallet className="size-4" />
            </KpiIcon>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {formatCurrency(totals.revenue)}
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

      <TiltCard>
        <Card className="gap-3 py-5">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardDescription>Transactions</CardDescription>
            <KpiIcon className="bg-primary/10 text-primary">
              <Receipt className="size-4" />
            </KpiIcon>
          </CardHeader>
          <CardContent>
            <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {totals.transactions}
            </span>
          </CardContent>
        </Card>
      </TiltCard>

      <TiltCard>
        <Card className="gap-3 py-5">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardDescription>Revenu · {comparisonLabel}</CardDescription>
            <KpiIcon className="bg-muted text-muted-foreground">
              <TrendingUp className="size-4" />
            </KpiIcon>
          </CardHeader>
          <CardContent>
            <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {formatCurrency(totals.previousRevenue)}
            </span>
          </CardContent>
        </Card>
      </TiltCard>
    </div>
  );
}
