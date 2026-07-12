import { Crown, Gem, Medal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { planById } from "@/lib/billing/plans";
import { isProjectSubscribed } from "@/lib/projects/types";
import type { PlanId, Project } from "@/lib/projects/types";

const PLAN_BADGE_STYLES: Record<PlanId, { icon: LucideIcon; className: string }> = {
  standard: {
    icon: Medal,
    className: "border-slate-300 bg-gradient-to-br from-slate-100 to-slate-300 text-slate-700",
  },
  pro: {
    icon: Crown,
    className: "border-amber-300 bg-gradient-to-br from-amber-100 to-amber-400 text-amber-900",
  },
  custom: {
    icon: Gem,
    className: "border-sky-300 bg-gradient-to-br from-sky-100 to-indigo-300 text-indigo-900",
  },
};

/** Pastille "Standard/argent · Pro/or · Sur mesure/diamant" — visible seulement si l'abonnement est actif. */
export function PlanBadge({ project }: { project: Project }) {
  if (!isProjectSubscribed(project) || !project.plan) return null;

  const style = PLAN_BADGE_STYLES[project.plan];
  const Icon = style.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shadow-xs ${style.className}`}
    >
      <Icon className="size-3" />
      {planById(project.plan).label}
    </span>
  );
}
