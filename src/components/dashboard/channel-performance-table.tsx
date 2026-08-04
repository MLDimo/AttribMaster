"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { colorForSource } from "@/lib/attribution/colors";
import type { ChannelPerformance } from "@/lib/attribution/channel-performance";

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number | null, currencies: string[]): string {
  if (value === null) return "—";
  const currency = currencies.length === 1 ? currencies[0] : "EUR";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function ChannelPerformanceTable({
  data,
  currencies = ["EUR"],
}: {
  data: ChannelPerformance[];
  currencies?: string[];
}) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Aucune donnée pour cette période.</p>;
  }

  const hasAnySessions = data.some((row) => row.sessions > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Taux de conversion</TableHead>
              <TableHead className="text-right">Panier moyen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.channel}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorForSource(row.channel) }}
                    />
                    <span className="max-w-48 truncate">{row.channel}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.sessions.toLocaleString("fr-FR")}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.transactions.toLocaleString("fr-FR")}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatPercent(row.conversionRate)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCurrency(row.avgOrderValue, currencies)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!hasAnySessions && (
        <p className="text-xs text-muted-foreground">
          Taux de conversion indisponible : aucune session comptée sur cette période pour l&apos;instant
          (le calcul tourne chaque nuit — les nouvelles connexions BigQuery ont besoin d&apos;un premier
          cycle avant de voir ce chiffre apparaître).
        </p>
      )}
    </div>
  );
}
