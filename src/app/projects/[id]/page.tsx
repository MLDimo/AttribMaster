"use client";

import { Calendar, ChartPie, Check, GitCompare, Pencil, Receipt, Settings2, SlidersHorizontal, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { AttributionChart } from "@/components/dashboard/attribution-chart";
import { AttributionModelsGuide } from "@/components/dashboard/attribution-models-guide";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { RefreshDataButton } from "@/components/dashboard/refresh-data-button";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { FadeIn } from "@/components/effects/motion";
import type { OverviewResponse } from "@/lib/attribution/api-types";
import { defaultRange } from "@/lib/attribution/date-range";
import type { ComparisonMode } from "@/lib/attribution/date-range";
import { isProjectConnected, isProjectSubscribed } from "@/lib/projects/types";
import type { Project } from "@/lib/projects/types";
import type { AttributionModel } from "@/lib/attribution/types";

const MODEL_LABELS: Record<AttributionModel, string> = {
  last_click: "Last Click",
  linear: "Linéaire",
  time_decay: "Croissant",
  u_shape: "En U",
  markov: "Chaînes de Markov",
  shapley: "Valeur de Shapley",
};

export const COMPARISON_LABELS: Record<ComparisonMode, string> = {
  previous_period: "Période précédente",
  last_week: "Semaine dernière",
  last_month: "Mois dernier",
  previous_year: "Année précédente (N-1)",
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

function ProjectSettingsSidebar({
  project,
  onRenamed,
}: {
  project: Project;
  onRenamed: (project: Project) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const connected = isProjectConnected(project);

  async function handleSaveName() {
    if (!name.trim() || name === project.name) {
      setEditingName(false);
      setName(project.name);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const json: { project: Project } = await res.json();
        onRenamed(json.project);
      }
    } finally {
      setSaving(false);
      setEditingName(false);
    }
  }

  return (
    <Card className="h-fit w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="size-4 text-muted-foreground" />
          Paramètres du projet
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Nom</span>
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                disabled={saving}
              />
              <Button size="sm" aria-label="Enregistrer le nom" onClick={handleSaveName} disabled={saving}>
                <Check className="size-4" />
              </Button>
            </div>
          ) : (
            <button
              className="group flex items-center gap-1.5 text-left font-medium transition-colors hover:text-primary"
              onClick={() => setEditingName(true)}
            >
              {project.name}
              <Pencil className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5 border-t pt-4">
          <span className="text-xs font-medium text-muted-foreground">Connexion BigQuery</span>
          {connected ? (
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>
                Projet GCP : <span className="font-medium text-foreground">{project.gcp_project_id}</span>
              </span>
              <span>
                Dataset GA4 : <span className="font-medium text-foreground">{project.ga4_dataset}</span>
              </span>
              <span>
                Dataset attribution :{" "}
                <span className="font-medium text-foreground">{project.bigquery_dataset}</span>
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Non connecté</span>
          )}
          <Button variant="outline" size="sm" className="mt-2 w-fit" asChild>
            <Link href={`/projects/${project.id}/connect`}>
              {connected ? "Changer la connexion" : "Connecter BigQuery"}
            </Link>
          </Button>
        </div>

        <div className="border-t pt-4">
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <Link href={`/projects/${project.id}/manage`}>
              <UsersRound className="size-4" />
              Gérer le projet
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [{ from, to }, setRange] = useState(defaultRange());
  const [model, setModel] = useState<AttributionModel>("linear");
  const [comparison, setComparison] = useState<ComparisonMode>("previous_period");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Une source sélectionnée n'a plus de sens si la période/le modèle change
  // (ajustement pendant le rendu plutôt qu'un setState synchrone dans un effet).
  const [prevSourceFilters, setPrevSourceFilters] = useState({ from, to, model });
  if (prevSourceFilters.from !== from || prevSourceFilters.to !== to || prevSourceFilters.model !== model) {
    setPrevSourceFilters({ from, to, model });
    setSelectedSource(null);
  }

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json: { project: Project } = await res.json();
        setProject(json.project);
      });
  }, [projectId]);

  const connected = project ? isProjectConnected(project) : false;
  const subscribed = project ? isProjectSubscribed(project) : false;
  const usable = connected && subscribed;

  useEffect(() => {
    if (!projectId || !usable) return;
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
  }, [projectId, usable, from, to, model, comparison, refreshTick]);

  if (notFound) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Ce projet n&apos;existe pas ou tu n&apos;y as pas accès.{" "}
            <Link href="/projects" className="font-medium text-primary transition-colors hover:text-primary/70">
              Retour à la liste des projets
            </Link>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (!project) {
    return <AppShell>{null}</AppShell>;
  }

  return (
    <AppShell>
      <nav aria-label="Fil d'ariane" className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Link href="/projects" className="transition-colors hover:text-primary">
            Projets
          </Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-foreground">{project.name}</span>
        </div>
        {usable && (
          <RefreshDataButton projectId={projectId} onDone={() => setRefreshTick((t) => t + 1)} />
        )}
      </nav>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <FadeIn>
          <div className="flex w-full shrink-0 flex-col gap-5 lg:w-72">
            <ProjectSettingsSidebar project={project} onRenamed={setProject} />
            <AttributionModelsGuide />
          </div>
        </FadeIn>

        <div className="flex flex-1 flex-col gap-5">
          <FadeIn delay={0.05}>
          <Card className="py-4">
            <CardContent className="flex flex-wrap items-end gap-4 px-4">
              <Field label="Période" icon={<Calendar className="size-3.5" />}>
                <DateRangePicker
                  from={from}
                  to={to}
                  onChange={(nextFrom, nextTo) => setRange({ from: nextFrom, to: nextTo })}
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
          </FadeIn>

          {!connected && (
            <FadeIn delay={0.1}>
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
                <p>Ce projet n&apos;est pas encore connecté à BigQuery.</p>
                <Button asChild size="sm">
                  <Link href={`/projects/${projectId}/connect`}>Terminer la connexion</Link>
                </Button>
              </CardContent>
            </Card>
            </FadeIn>
          )}

          {!subscribed && (
            <FadeIn delay={0.12}>
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
                <p>Ce projet n&apos;a pas d&apos;abonnement actif.</p>
                <Button asChild size="sm">
                  <Link href={`/projects/${projectId}/manage`}>Gérer l&apos;abonnement</Link>
                </Button>
              </CardContent>
            </Card>
            </FadeIn>
          )}

          {usable && !overview && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="gap-3 py-5">
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="size-9 rounded-lg" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-7 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {usable && overview && (
            <OverviewCards totals={overview.totals} comparisonLabel={COMPARISON_LABELS[comparison]} />
          )}

          {usable && (
            <>
              <FadeIn delay={0.15}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChartPie className="size-4 text-muted-foreground" />
                    Répartition par source
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {overview ? (
                    <AttributionChart
                      sources={overview.topSources}
                      selectedSource={selectedSource}
                      onSelectSource={setSelectedSource}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                      <Skeleton className="size-64 shrink-0 rounded-full" />
                      <div className="flex w-full flex-col gap-3">
                        {[0, 1, 2].map((i) => (
                          <Skeleton key={i} className="h-5 w-full" />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              </FadeIn>

              <FadeIn delay={0.2}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="size-4 text-muted-foreground" />
                    Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TransactionsTable
                    projectId={projectId}
                    from={from}
                    to={to}
                    model={model}
                    topSources={overview?.topSources ?? []}
                    selectedSource={selectedSource}
                  />
                </CardContent>
              </Card>
              </FadeIn>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
