"use client";

import { motion } from "framer-motion";
import { Download, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  MotionTableBody,
  MotionTableRow,
} from "@/components/ui/table";
import { AttributionChain } from "@/components/dashboard/attribution-chain";
import { fadeUpVariants } from "@/components/effects/motion";
import type { TransactionsResponse } from "@/lib/attribution/api-types";
import type { AttributionModel, SourceCredit } from "@/lib/attribution/types";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

type SortColumn = "purchase_revenue" | "event_timestamp";

function SortIcon({ column, sortBy, sortDir }: { column: SortColumn; sortBy: SortColumn; sortDir: "asc" | "desc" }) {
  if (sortBy !== column) return <ArrowUpDown className="size-3.5 text-muted-foreground/50" />;
  return sortDir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
}

export function TransactionsTable({
  projectId,
  from,
  to,
  model,
  topSources,
  selectedSource,
}: {
  projectId: string;
  from: string;
  to: string;
  model: AttributionModel;
  topSources: SourceCredit[];
  selectedSource?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortColumn>("event_timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Revenir à la page 1 dès que le filtre change (ajustement pendant le rendu,
  // recommandé par React plutôt qu'un setState synchrone dans un effet).
  const [prevFilters, setPrevFilters] = useState({ search, from, to, projectId });
  if (
    prevFilters.search !== search ||
    prevFilters.from !== from ||
    prevFilters.to !== to ||
    prevFilters.projectId !== projectId
  ) {
    setPrevFilters({ search, from, to, projectId });
    setPage(1);
  }

  const query = useMemo(
    () => ({ projectId, from, to, search, page, sortBy, sortDir }),
    [projectId, from, to, search, page, sortBy, sortDir]
  );

  // `query` initialisé à `null` (jamais égal à la vraie query calculée au premier
  // rendu) pour que `loading` démarre à `true` : sinon le tableau affichait
  // "Aucune transaction trouvée" pendant l'instant où la requête BigQuery est
  // encore en vol, avant que la vraie réponse (potentiellement non vide)
  // n'arrive.
  const [result, setResult] = useState<{
    query: typeof query | null;
    data: TransactionsResponse | null;
  }>({ query: null, data: null });

  useEffect(() => {
    const params = new URLSearchParams({
      projectId: query.projectId,
      from: query.from,
      to: query.to,
      page: String(query.page),
      pageSize: "20",
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });
    if (query.search) params.set("search", query.search);

    let cancelled = false;
    fetch(`/api/transactions?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: TransactionsResponse | null) => {
        if (!cancelled) setResult({ query, data: json });
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  const loading = result.query !== query;
  const data = result.data;

  function toggleSort(column: SortColumn) {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4" data-testid="transactions-table">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par ID de transaction..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/api/transactions/export?${new URLSearchParams({
              projectId,
              from,
              to,
              ...(search.trim() ? { search: search.trim() } : {}),
            }).toString()}`}
            download
          >
            <Download className="size-4" />
            Exporter CSV
          </a>
        </Button>
      </div>

      {/* Mobile : liste de cartes (une table à 4 colonnes ne tient pas sur un petit écran
          sans perdre le contexte ID/date en scrollant vers le montant). */}
      <div className="flex flex-col gap-2 sm:hidden">
        {!loading && data?.rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucune transaction trouvée.</p>
        )}
        {data?.rows.map((row) => (
          <motion.div
            key={row.transaction_id}
            initial="hidden"
            animate="show"
            variants={fadeUpVariants}
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">{row.transaction_id}</span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {formatCurrency(row.purchase_revenue, row.currency)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{formatDate(row.event_timestamp)}</span>
            <AttributionChain
              touchpoints={row.touchpoints}
              model={model}
              topSources={topSources}
              selectedSource={selectedSource}
            />
          </motion.div>
        ))}
      </div>

      {/* Desktop/tablette : table classique. */}
      <div className="hidden sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transaction</TableHead>
            <TableHead
              className="cursor-pointer select-none hover:text-foreground"
              onClick={() => toggleSort("event_timestamp")}
            >
              <span className="flex items-center gap-1">
                Date <SortIcon column="event_timestamp" sortBy={sortBy} sortDir={sortDir} />
              </span>
            </TableHead>
            <TableHead>Chaîne d&apos;attribution</TableHead>
            <TableHead
              className="cursor-pointer select-none hover:text-foreground"
              onClick={() => toggleSort("purchase_revenue")}
            >
              <span className="flex items-center justify-end gap-1">
                Montant <SortIcon column="purchase_revenue" sortBy={sortBy} sortDir={sortDir} />
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <MotionTableBody
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.04 } } }}
        >
          {!loading && data?.rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Aucune transaction trouvée.
              </TableCell>
            </TableRow>
          )}
          {data?.rows.map((row) => (
            <MotionTableRow key={row.transaction_id} variants={fadeUpVariants}>
              <TableCell className="font-mono text-xs">{row.transaction_id}</TableCell>
              <TableCell>{formatDate(row.event_timestamp)}</TableCell>
              <TableCell className="max-w-md whitespace-normal">
                <AttributionChain
              touchpoints={row.touchpoints}
              model={model}
              topSources={topSources}
              selectedSource={selectedSource}
            />
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatCurrency(row.purchase_revenue, row.currency)}
              </TableCell>
            </MotionTableRow>
          ))}
        </MotionTableBody>
      </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.total ?? 0} transaction(s)</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
            Précédent
          </Button>
          <span className="font-mono tabular-nums">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
