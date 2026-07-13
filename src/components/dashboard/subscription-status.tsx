"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { planById } from "@/lib/billing/plans";
import { isProjectSubscribed } from "@/lib/projects/types";
import type { Project } from "@/lib/projects/types";

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  trialing: "Essai",
  past_due: "Paiement en retard",
  canceled: "Annulé",
  incomplete: "Incomplet",
  incomplete_expired: "Expiré",
  unpaid: "Impayé",
};

function statusColorClass(status: string): string {
  if (status === "active" || status === "trialing") return "text-success";
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") return "text-destructive";
  return "text-muted-foreground";
}

export function SubscriptionStatus({ project }: { project: Project }) {
  const [openingPortal, setOpeningPortal] = useState(false);
  const subscribed = isProjectSubscribed(project);

  async function handleManage() {
    setOpeningPortal(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/billing-portal`, { method: "POST" });
      const json = await res.json();
      if (res.ok) window.location.href = json.url;
    } finally {
      setOpeningPortal(false);
    }
  }

  if (!project.plan || !project.subscription_status) {
    return <span className="text-xs text-muted-foreground">Non abonné</span>;
  }

  const plan = planById(project.plan);

  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>
        Plan : <span className="font-medium text-foreground">{plan.label}</span>{" "}
        {project.billing_interval === "annual" ? "(annuel)" : "(mensuel)"}
      </span>
      <span>
        Statut :{" "}
        <span className={`font-medium ${statusColorClass(project.subscription_status)}`}>
          {STATUS_LABELS[project.subscription_status] ?? project.subscription_status}
        </span>
      </span>
      {subscribed && project.stripe_subscription_id && (
        <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={handleManage} disabled={openingPortal}>
          {openingPortal ? <Loader2 className="size-3.5 animate-spin" /> : "Gérer l'abonnement"}
        </Button>
      )}
    </div>
  );
}
