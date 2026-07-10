"use client";

import { Calendar, ChartPie, Check, GitCompare, Pencil, Receipt, Settings2, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/layout/app-shell";
import { AttributionChart } from "@/components/dashboard/attribution-chart";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import type { OverviewResponse } from "@/lib/attribution/api-types";
import { defaultRange } from "@/lib/attribution/date-range";
import type { ComparisonMode } from "@/lib/attribution/date-range";
import { isProjectConnected } from "@/lib/projects/types";
import type { Project } from "@/lib/projects/types";
import type { AttributionModel } from "@/lib/attribution/types";

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
    <Card className="h-fit w-full shrink-0 lg:w-72">
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
      <nav aria-label="Fil d'ariane" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/projects" className="transition-colors hover:text-primary">
          Projets
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-foreground">{project.name}</span>
      </nav>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <ProjectSettingsSidebar project={project} onRenamed={setProject} />

        <div className="flex flex-1 flex-col gap-5">
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

          {!connected && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
                <p>Ce projet n&apos;est pas encore connecté à BigQuery.</p>
                <Button asChild size="sm">
                  <Link href={`/projects/${projectId}/connect`}>Terminer la connexion</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {connected && overview && (
            <OverviewCards totals={overview.totals} comparisonLabel={COMPARISON_LABELS[comparison]} />
          )}

          {connected && (
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
      </div>
    </AppShell>
  );
}
