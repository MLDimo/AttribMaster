"use client";

import { Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppShell } from "@/components/layout/app-shell";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { isProjectConnected } from "@/lib/projects/types";
import type { Account, Project } from "@/lib/projects/types";

const HOUR_MS = 60 * 60 * 1000;

type DataStatus = "fresh" | "stale" | "dead";

function dataStatus(lastDataAt: string | null): DataStatus {
  if (!lastDataAt) return "dead";
  const ageHours = (Date.now() - new Date(lastDataAt).getTime()) / HOUR_MS;
  if (ageHours < 24) return "fresh";
  if (ageHours < 72) return "stale";
  return "dead";
}

const STATUS_STYLES: Record<DataStatus, { dot: string; label: string; text: string }> = {
  fresh: { dot: "bg-success", label: "Données à jour (moins de 24h)", text: "À jour" },
  stale: { dot: "bg-amber-500", label: "Pas de données depuis au moins 24h", text: "24h+" },
  dead: { dot: "bg-destructive", label: "Pas de données depuis 3 jours ou plus", text: "3j+" },
};

function StatusDot({ status }: { status: DataStatus }) {
  const { dot, label, text } = STATUS_STYLES[status];
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title={label}>
      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lastDataById, setLastDataById] = useState<Record<string, string | null>>({});
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function reload() {
    const [projectsList] = await Promise.all([
      fetch("/api/projects")
        .then((res) => (res.ok ? res.json() : { projects: [] }))
        .then((json: { projects: Project[] }) => json.projects),
      fetch("/api/accounts")
        .then((res) => (res.ok ? res.json() : { accounts: [] }))
        .then((json: { accounts: Account[] }) => setAccounts(json.accounts)),
    ]);
    setProjects(projectsList);

    const connected = projectsList.filter(isProjectConnected);
    const statuses = await Promise.all(
      connected.map((project) =>
        fetch(`/api/projects/${project.id}/status`)
          .then((res) => (res.ok ? res.json() : { lastDataAt: null }))
          .then((json: { lastDataAt: string | null }) => [project.id, json.lastDataAt] as const)
      )
    );
    setLastDataById(Object.fromEntries(statuses));
  }

  useEffect(() => {
    async function run() {
      await reload();
      setLoaded(true);
    }
    void run();
  }, []);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(query));
  }, [projects, search]);

  async function handleDelete(project: Project) {
    if (!window.confirm(`Supprimer le projet "${project.name}" ? Cette action est irréversible.`)) {
      return;
    }
    setDeletingId(project.id);
    try {
      await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      await reload();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un projet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <CreateProjectDialog accounts={accounts} />
        </div>

        {loaded && projects.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucun projet pour l&apos;instant. Crée ton premier projet pour commencer.
            </CardContent>
          </Card>
        )}

        {loaded && projects.length > 0 && filteredProjects.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucun projet ne correspond à &quot;{search}&quot;.
            </CardContent>
          </Card>
        )}

        {filteredProjects.length > 0 && (
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projet</TableHead>
                    <TableHead>Projet BigQuery</TableHead>
                    <TableHead>Dataset</TableHead>
                    <TableHead>Données</TableHead>
                    <TableHead className="w-9" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => {
                    const connected = isProjectConnected(project);
                    return (
                      <TableRow key={project.id}>
                        <TableCell>
                          <Link
                            href={`/projects/${project.id}`}
                            className="flex items-center gap-2 font-medium hover:underline"
                          >
                            {project.name}
                            {!connected && <Badge variant="outline">Non connecté</Badge>}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {project.gcp_project_id ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {project.ga4_dataset ?? "—"}
                        </TableCell>
                        <TableCell>
                          {connected ? (
                            <StatusDot status={dataStatus(lastDataById[project.id] ?? null)} />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Supprimer ${project.name}`}
                            disabled={deletingId === project.id}
                            onClick={() => handleDelete(project)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
