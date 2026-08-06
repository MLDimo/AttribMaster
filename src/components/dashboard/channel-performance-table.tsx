"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { colorForSource } from "@/lib/attribution/colors";
import type { ChannelPerformance, ChannelPerformanceBreakdown } from "@/lib/attribution/channel-performance";

const BREAKDOWN_LABELS: Record<ChannelPerformanceBreakdown, string> = {
  medium: "Support",
  campaign: "Campagne",
};

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

function rowKey(row: ChannelPerformance): string {
  return [row.channel, row.medium ?? "", row.campaign ?? ""].join("|");
}

export function ChannelPerformanceTable({
  data,
  currencies = ["EUR"],
  breakdown = [],
  availableToAdd = [],
  onAddBreakdown,
  onRemoveBreakdown,
}: {
  data: ChannelPerformance[];
  currencies?: string[];
  /** Colonnes de ventilation actives, ex: ["campaign"] pour une ligne par canal × campagne. */
  breakdown?: ChannelPerformanceBreakdown[];
  /** Colonnes que le "+" propose d'ajouter (déjà filtrées : ni déjà ajoutées, ni redondantes avec "Regrouper par"). */
  availableToAdd?: ChannelPerformanceBreakdown[];
  onAddBreakdown?: (column: ChannelPerformanceBreakdown) => void;
  onRemoveBreakdown?: (column: ChannelPerformanceBreakdown) => void;
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
              <TableHead>
                <span className="flex items-center gap-1">
                  Canal
                  {availableToAdd.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Ajouter une colonne de ventilation"
                          className="flex size-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <Plus className="size-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-44 p-1">
                        <div className="flex flex-col">
                          {availableToAdd.map((column) => (
                            <PopoverClose key={column} asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="justify-start"
                                onClick={() => onAddBreakdown?.(column)}
                              >
                                {BREAKDOWN_LABELS[column]}
                              </Button>
                            </PopoverClose>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </span>
              </TableHead>
              {breakdown.map((column) => (
                <TableHead key={column}>
                  <span className="flex items-center gap-1">
                    {BREAKDOWN_LABELS[column]}
                    <button
                      type="button"
                      aria-label={`Retirer la colonne ${BREAKDOWN_LABELS[column]}`}
                      onClick={() => onRemoveBreakdown?.(column)}
                      className="flex size-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                </TableHead>
              ))}
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Taux de conversion</TableHead>
              <TableHead className="text-right">Panier moyen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={rowKey(row)}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorForSource(row.channel) }}
                    />
                    <span className="max-w-48 truncate">{row.channel}</span>
                  </span>
                </TableCell>
                {breakdown.map((column) => (
                  <TableCell key={column} className="max-w-40 truncate text-muted-foreground">
                    {row[column] ?? "—"}
                  </TableCell>
                ))}
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
