"use client";

import { Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/layout/app-shell";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { isProjectConnected } from "@/lib/projects/types";
import type { Account, Project } from "@/lib/projects/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function reload() {
    return Promise.all([
      fetch("/api/projects")
        .then((res) => (res.ok ? res.json() : { projects: [] }))
        .then((json: { projects: Project[] }) => setProjects(json.projects)),
      fetch("/api/accounts")
        .then((res) => (res.ok ? res.json() : { accounts: [] }))
        .then((json: { accounts: Account[] }) => setAccounts(json.accounts)),
    ]);
  }

  useEffect(() => {
    reload().finally(() => setLoaded(true));
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

        <div className="flex flex-col gap-2">
          {filteredProjects.map((project) => (
            <Card key={project.id}>
              <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                <Link
                  href={`/projects/${project.id}`}
                  className="flex flex-1 items-center gap-3 text-sm font-medium hover:underline"
                >
                  {project.name}
                  {!isProjectConnected(project) && (
                    <Badge variant="outline">Non connecté</Badge>
                  )}
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={deletingId === project.id}
                  onClick={() => handleDelete(project)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
