"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
import { fadeUpVariants } from "@/components/effects/motion";
import { colorForSource, sourceLabel } from "@/lib/attribution/colors";
import type { TransactionsResponse } from "@/lib/attribution/api-types";
import type { Touchpoint } from "@/lib/attribution/types";

function AttributionChain({ touchpoints }: { touchpoints: Touchpoint[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {touchpoints.map((tp, i) => (
        <span key={i} className="flex items-center gap-1">
          <span
            className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: colorForSource(sourceLabel(tp.source, tp.medium)) }}
          >
            {tp.source} / {tp.medium}
          </span>
          {i < touchpoints.length - 1 && <span className="text-muted-foreground">→</span>}
        </span>
      ))}
    </div>
  );
}

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
}: {
  projectId: string;
  from: string;
  to: string;
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

  const [result, setResult] = useState<{
    query: typeof query;
    data: TransactionsResponse | null;
  }>({ query, data: null });

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
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher par ID de transaction..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

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
                <AttributionChain touchpoints={row.touchpoints} />
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatCurrency(row.purchase_revenue, row.currency)}
              </TableCell>
            </MotionTableRow>
          ))}
        </MotionTableBody>
      </Table>

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
