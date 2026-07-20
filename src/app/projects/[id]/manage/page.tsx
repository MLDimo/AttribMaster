"use client";

import { CreditCard, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/layout/app-shell";
import { PlanPicker } from "@/components/billing/plan-picker";
import { ProjectMembers } from "@/components/dashboard/project-members";
import { RefreshDataButton } from "@/components/dashboard/refresh-data-button";
import { SubscriptionStatus } from "@/components/dashboard/subscription-status";
import { FadeIn } from "@/components/effects/motion";
import { isProjectConnected, isProjectSubscribed } from "@/lib/projects/types";
import type { Project } from "@/lib/projects/types";

export default function ManageProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json: { project: Project; canManage: boolean } = await res.json();
        // Page réservée à la gestion (renommer, données, collaborateurs,
        // abonnement) : un accès en lecture seule (démo ou collaborateur
        // project_members) n'a rien à y faire — retour au dashboard.
        if (!json.canManage) {
          router.replace(`/projects/${projectId}`);
          return;
        }
        setProject(json.project);
      });
  }, [projectId, router]);

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
        <Link href={`/projects/${projectId}`} className="transition-colors hover:text-primary">
          {project.name}
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-foreground">Gérer</span>
      </nav>

      <div className="flex max-w-2xl flex-col gap-5">
        {isProjectConnected(project) && isProjectSubscribed(project) && (
          <FadeIn>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="size-4 text-muted-foreground" />
                  Données
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RefreshDataButton projectId={project.id} onDone={() => {}} />
              </CardContent>
            </Card>
          </FadeIn>
        )}

        <FadeIn delay={0.02}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                Collaborateurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectMembers projectId={project.id} />
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-4 text-muted-foreground" />
                Abonnement
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <SubscriptionStatus project={project} />
              {!isProjectSubscribed(project) && <PlanPicker projectId={project.id} />}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </AppShell>
  );
}
