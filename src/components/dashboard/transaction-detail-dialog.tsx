"use client";

import { ExternalLink } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { colorForSource } from "@/lib/attribution/colors";
import { channelLabel, type AttributionDimension } from "@/lib/attribution/dimension";
import { computeRowSharePercents } from "@/lib/attribution/models";
import type { AttributionModel, AttributionRow, CustomModelConfig, SourceCredit } from "@/lib/attribution/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(value);
}

function formatPercent(value: number): string {
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`;
}

/** Le domaine est le même sur tous les points de contact d'un même site — n'afficher que le chemin garde la colonne lisible. */
function entryUrlPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search || "/";
  } catch {
    return url;
  }
}

/**
 * Profondeur d'exploration d'une transaction : le détail complet de chaque
 * point de contact (source, support, campagne, page d'entrée), au-delà de ce
 * que la chaîne compacte du tableau peut montrer sans devenir illisible.
 */
export function TransactionDetailDialog({
  transaction,
  open,
  onOpenChange,
  model,
  topSources,
  customModelConfig,
  dimension = "source",
}: {
  transaction: AttributionRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: AttributionModel;
  topSources: SourceCredit[];
  customModelConfig?: CustomModelConfig | null;
  dimension?: AttributionDimension;
}) {
  const shares = transaction
    ? computeRowSharePercents(transaction.touchpoints, model, topSources, dimension, customModelConfig ?? undefined)
    : [];
  const isGlobalShare = model === "markov" || model === "shapley";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {transaction && (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono text-base">{transaction.transaction_id}</DialogTitle>
              <DialogDescription>
                {formatDateTime(transaction.event_timestamp)} ·{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(transaction.purchase_revenue, transaction.currency)}
                </span>{" "}
                · {transaction.touchpoints.length} point{transaction.touchpoints.length > 1 ? "s" : ""} de contact
                {isGlobalShare && " · part globale du canal, pas une décomposition propre à cette transaction"}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Support</TableHead>
                    <TableHead>Campagne</TableHead>
                    <TableHead>Lien d&apos;entrée</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Part</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transaction.touchpoints.map((tp, i) => {
                    const color = colorForSource(channelLabel(tp, dimension));
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                            {tp.source}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{tp.medium}</TableCell>
                        <TableCell className="text-muted-foreground">{tp.campaign ?? "—"}</TableCell>
                        <TableCell className="max-w-40">
                          {tp.entry_url ? (
                            <a
                              href={tp.entry_url}
                              target="_blank"
                              rel="noreferrer"
                              title={tp.entry_url}
                              className="flex items-center gap-1 truncate text-primary hover:underline"
                            >
                              <ExternalLink className="size-3 shrink-0" />
                              <span className="truncate">{entryUrlPath(tp.entry_url)}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(tp.timestamp)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{formatPercent(shares[i])}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
