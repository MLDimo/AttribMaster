"use client";

import { motion } from "framer-motion";
import { Check, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ParallaxBlob } from "@/components/effects/parallax-blob";
import { TiltCard } from "@/components/effects/tilt-card";
import { MOCK_PROJECT_ID } from "@/lib/attribution/mock-data";
import type { BigQueryDatasetOption, GcpProjectOption } from "@/lib/gcp-oauth/discovery";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Tu as refusé l'accès côté Google. Réessaie si c'était une erreur.",
  missing_code: "Google n'a pas renvoyé de code d'autorisation.",
  token_exchange_failed: "L'échange du code Google a échoué. Réessaie.",
};

export default function ConnectBigQueryPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.id;

  const [checking, setChecking] = useState(true);
  const [oauthDone, setOauthDone] = useState(false);
  const [gcpProjects, setGcpProjects] = useState<GcpProjectOption[]>([]);
  const [selectedGcpProject, setSelectedGcpProject] = useState("");
  const [selectedDataset, setSelectedDataset] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") ? (ERROR_MESSAGES[searchParams.get("error")!] ?? "Une erreur est survenue.") : null
  );

  useEffect(() => {
    if (projectId === MOCK_PROJECT_ID) router.replace(`/projects/${projectId}`);
  }, [projectId, router]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/gcp-projects`)
      .then(async (res) => {
        if (!res.ok) {
          setOauthDone(false);
          return;
        }
        const json: { projects: GcpProjectOption[] } = await res.json();
        setOauthDone(true);
        setGcpProjects(json.projects);
      })
      .finally(() => setChecking(false));
  }, [projectId]);

  const datasetsQuery = useMemo(() => ({ projectId, selectedGcpProject }), [projectId, selectedGcpProject]);
  const [datasetsResult, setDatasetsResult] = useState<{
    query: typeof datasetsQuery;
    datasets: BigQueryDatasetOption[];
  }>({ query: datasetsQuery, datasets: [] });

  useEffect(() => {
    if (!datasetsQuery.selectedGcpProject) return;
    let cancelled = false;
    fetch(`/api/projects/${datasetsQuery.projectId}/gcp-datasets?gcpProjectId=${datasetsQuery.selectedGcpProject}`)
      .then((res) => (res.ok ? res.json() : { datasets: [] }))
      .then((json: { datasets: BigQueryDatasetOption[] }) => {
        if (!cancelled) setDatasetsResult({ query: datasetsQuery, datasets: json.datasets });
      });
    return () => {
      cancelled = true;
    };
  }, [datasetsQuery]);

  const datasets = selectedGcpProject ? datasetsResult.datasets : [];
  const loadingDatasets = Boolean(selectedGcpProject) && datasetsResult.query !== datasetsQuery;

  async function handleConnect() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/connect-bigquery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gcpProjectId: selectedGcpProject, ga4Dataset: selectedDataset }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ? JSON.stringify(json.error) : "Échec de la connexion");
      }
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la connexion");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-b from-muted/40 to-background p-6">
      <ParallaxBlob className="-top-32 -left-32 size-[28rem]" />
      <ParallaxBlob className="-right-40 -bottom-40 size-[32rem]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        className="relative w-full max-w-md"
      >
      <TiltCard>
      <Card className="shadow-xl">
        <CardHeader className="items-center text-center">
          <Image src="/logo-icon.png" alt="" width={40} height={40} className="mb-2 drop-shadow-sm" />
          <CardTitle>Connecter BigQuery</CardTitle>
          <CardDescription>Étape 2 : relie ce projet à ton export GA4 BigQuery</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {checking && <p className="text-sm text-muted-foreground">Vérification...</p>}

          {!checking && !oauthDone && (
            <Button asChild>
              <a href={`/api/gcp-oauth/start?projectId=${projectId}`}>
                Se connecter avec Google
                <ExternalLink className="size-4" />
              </a>
            </Button>
          )}

          {!checking && oauthDone && (
            <>
              <div className="flex items-center gap-2 text-sm text-success">
                <Check className="size-4" />
                Compte Google connecté
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Projet GCP</label>
                <select
                  className="h-9 cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
                  value={selectedGcpProject}
                  onChange={(e) => {
                    setSelectedGcpProject(e.target.value);
                    setSelectedDataset("");
                  }}
                >
                  <option value="">Sélectionner un projet...</option>
                  {gcpProjects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>
                      {p.displayName} ({p.projectId})
                    </option>
                  ))}
                </select>
              </div>

              {selectedGcpProject && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Dataset GA4 (BigQuery)
                  </label>
                  <select
                    className="h-9 cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
                    value={selectedDataset}
                    onChange={(e) => setSelectedDataset(e.target.value)}
                    disabled={loadingDatasets}
                  >
                    <option value="">
                      {loadingDatasets ? "Chargement..." : "Sélectionner un dataset..."}
                    </option>
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.id} {d.likelyGa4Export ? "— export GA4" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button
                onClick={handleConnect}
                disabled={!selectedGcpProject || !selectedDataset || submitting}
              >
                {submitting ? "Connexion..." : "Terminer la connexion"}
              </Button>
            </>
          )}

          <Button variant="ghost" asChild>
            <Link href={`/projects/${projectId}`}>Retour au dashboard</Link>
          </Button>
        </CardContent>
      </Card>
      </TiltCard>
      </motion.div>
    </div>
  );
}
