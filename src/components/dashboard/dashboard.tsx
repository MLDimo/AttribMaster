"use client";

import { BarChart3, Calendar, ChartPie, GitCompare, LogOut, Receipt, SlidersHorizontal } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AttributionChart } from "@/components/dashboard/attribution-chart";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { ProjectSwitcher } from "@/components/dashboard/project-switcher";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import type { OverviewResponse } from "@/lib/attribution/api-types";
import type { ComparisonMode } from "@/lib/attribution/date-range";
import { isProjectConnected } from "@/lib/projects/types";
import type { Project } from "@/lib/projects/types";
import type { AttributionModel } from "@/lib/attribution/types";

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const MODEL_LABELS: Record<AttributionModel, string> = {
  linear: "Linéaire",
  u_shape: "U-Shape",
  time_decay: "Time-Decay",
};

export const COMPARISON_LABELS: Record<ComparisonMode, string> = {
  previous_period: "Période précédente",
  last_week: "Semaine dernière",
  last_month: "Mois dernier",
};

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

export function Dashboard() {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [project, setProject] = useState<Project | null>(null);
  const [from, setFrom] = useState(toISODate(weekAgo));
  const [to, setTo] = useState(toISODate(today));
  const [model, setModel] = useState<AttributionModel>("linear");
  const [comparison, setComparison] = useState<ComparisonMode>("previous_period");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);

  const projectId = project?.id ?? null;
  const connected = project ? isProjectConnected(project) : false;

  // Repartir de zéro quand on change de projet (ajustement pendant le rendu,
  // recommandé par React plutôt qu'un setState synchrone dans un effet).
  const [prevProjectId, setPrevProjectId] = useState(projectId);
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    setOverview(null);
  }

  useEffect(() => {
    if (!projectId || !connected) return;
    const params = new URLSearchParams({ projectId, from, to, model, comparison });
    let cancelled = false;
    fetch(`/api/overview?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: OverviewResponse | null) => {
        if (!cancelled && json) setOverview(json);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, connected, from, to, model, comparison]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <h1 className="text-lg leading-tight font-semibold">Attribution Tool</h1>
            <p className="text-xs text-muted-foreground">GA4 · BigQuery · Multi-touch</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProjectSwitcher selectedProjectId={projectId} onSelectProject={setProject} />
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="size-4" />
            Déconnexion
          </Button>
        </div>
      </header>

      <Card className="py-4">
        <CardContent className="flex flex-wrap items-end gap-4 px-4">
          <Field label="Du" icon={<Calendar className="size-3.5" />}>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </Field>
          <Field label="Au" icon={<Calendar className="size-3.5" />}>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </Field>
          <Field label="Modèle d'attribution" icon={<SlidersHorizontal className="size-3.5" />}>
            <select
              className="h-9 cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm transition-colors hover:bg-accent"
              value={model}
              onChange={(e) => setModel(e.target.value as AttributionModel)}
            >
              {Object.entries(MODEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Comparer à" icon={<GitCompare className="size-3.5" />}>
            <select
              className="h-9 cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm transition-colors hover:bg-accent"
              value={comparison}
              onChange={(e) => setComparison(e.target.value as ComparisonMode)}
            >
              {Object.entries(COMPARISON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>

      {!projectId && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Sélectionne ou crée un projet pour voir ses données d&apos;attribution.
          </CardContent>
        </Card>
      )}

      {projectId && !connected && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
            <p>Ce projet n&apos;est pas encore connecté à BigQuery.</p>
            <Button asChild size="sm">
              <Link href={`/projects/${projectId}/connect`}>Terminer la connexion</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {projectId && connected && overview && (
        <OverviewCards totals={overview.totals} comparisonLabel={COMPARISON_LABELS[comparison]} />
      )}

      {projectId && connected && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChartPie className="size-4 text-muted-foreground" />
                Répartition par source
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AttributionChart sources={overview?.topSources ?? []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="size-4 text-muted-foreground" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionsTable projectId={projectId} from={from} to={to} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
