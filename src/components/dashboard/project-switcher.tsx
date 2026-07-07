"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isProjectConnected } from "@/lib/projects/types";
import type { Account, Project } from "@/lib/projects/types";

type ProjectSwitcherProps = {
  selectedProjectId: string | null;
  onSelectProject: (project: Project) => void;
};

export function ProjectSwitcher({ selectedProjectId, onSelectProject }: ProjectSwitcherProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function fetchProjects(): Promise<Project[]> {
    const res = await fetch("/api/projects");
    if (!res.ok) return [];
    const json: { projects: Project[] } = await res.json();
    return json.projects;
  }

  useEffect(() => {
    Promise.all([
      fetchProjects().then((projects) => setProjects(projects)),
      fetch("/api/accounts")
        .then((res) => (res.ok ? res.json() : { accounts: [] }))
        .then((json: { accounts: Account[] }) => setAccounts(json.accounts)),
    ]).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      onSelectProject(projects[0]);
    }
  }, [projects, selectedProjectId, onSelectProject]);

  function handleSelect(projectId: string) {
    const project = projects.find((p) => p.id === projectId);
    if (project) onSelectProject(project);
  }

  if (loaded && projects.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">Aucun projet pour l&apos;instant.</p>
        <CreateProjectDialog accounts={accounts} open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="h-9 cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm transition-colors hover:bg-accent"
        value={selectedProjectId ?? ""}
        onChange={(e) => handleSelect(e.target.value)}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
            {!isProjectConnected(project) ? " (non connecté)" : ""}
          </option>
        ))}
      </select>
      <CreateProjectDialog accounts={accounts} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function CreateProjectDialog({
  accounts,
  open,
  onOpenChange,
}: {
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      accountId: formData.get("accountId"),
    };

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ? JSON.stringify(json.error) : "Échec de la création");
      }
      const json: { project: Project } = await res.json();
      onOpenChange(false);
      router.push(`/projects/${json.project.id}/connect`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Nouveau projet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau projet</DialogTitle>
          <DialogDescription>
            Étape 1/2 : donne un nom au projet et choisis le compte propriétaire. La
            connexion BigQuery se fait juste après, via Google.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nom du projet</Label>
            <Input id="name" name="name" required placeholder="Ex: Client Acme" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accountId">Compte</Label>
            <select
              id="accountId"
              name="accountId"
              required
              className="h-9 cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Création..." : "Continuer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
