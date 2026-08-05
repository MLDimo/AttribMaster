"use client";

import { Info, Loader2, RotateCcw, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { computeWeights } from "@/lib/attribution/models";
import type { CustomModelConfig, Touchpoint } from "@/lib/attribution/types";

const DEFAULT_CONFIG: CustomModelConfig = { firstTouchPercent: 40, middlePercent: 20, lastTouchPercent: 40 };

type PositionKey = keyof CustomModelConfig;

const POSITIONS: Array<{ key: PositionKey; label: string; color: string; hint: string }> = [
  {
    key: "firstTouchPercent",
    label: "Premier contact",
    color: "var(--chart-1)",
    hint: "La toute première interaction du parcours.",
  },
  {
    key: "middlePercent",
    label: "Contacts intermédiaires",
    color: "var(--chart-2)",
    hint: "Réparti à parts égales entre toutes les interactions entre le premier et le dernier contact.",
  },
  {
    key: "lastTouchPercent",
    label: "Dernier contact",
    color: "var(--chart-3)",
    hint: "L'interaction juste avant l'achat.",
  },
];

/** Parcours factice pour visualiser en direct l'effet des 3 curseurs — jamais envoyé au serveur. */
const PREVIEW_TOUCHPOINTS: Touchpoint[] = [
  { source: "Réseaux sociaux", medium: "paid", campaign: null, timestamp: "2026-07-01T10:00:00Z", position: 0 },
  { source: "Email", medium: "email", campaign: null, timestamp: "2026-07-03T10:00:00Z", position: 1 },
  { source: "Recherche payante", medium: "cpc", campaign: null, timestamp: "2026-07-05T10:00:00Z", position: 2 },
  { source: "Direct", medium: "none", campaign: null, timestamp: "2026-07-06T10:00:00Z", position: 3 },
];

/**
 * Déplacer un curseur rééquilibre proportionnellement les 2 autres (même
 * ratio entre eux) pour que la somme reste TOUJOURS 100 — jamais d'état
 * invalide, donc jamais besoin de bloquer "Enregistrer" avec un message
 * d'erreur de validation. La 3e valeur (jamais celle déplacée) absorbe le
 * reste de l'arrondi pour garantir une somme exacte à l'unité près.
 */
function rebalance(changedKey: PositionKey, rawValue: number, draft: CustomModelConfig): CustomModelConfig {
  const clamped = Math.max(0, Math.min(100, Math.round(rawValue)));
  const [keyB, keyC] = POSITIONS.map((p) => p.key).filter((k) => k !== changedKey) as [PositionKey, PositionKey];
  const oldB = draft[keyB];
  const oldC = draft[keyC];
  const remainingOld = oldB + oldC;
  const remainingNew = 100 - clamped;
  const newB = remainingOld === 0 ? Math.round(remainingNew / 2) : Math.round((remainingNew * oldB) / remainingOld);
  const newC = remainingNew - newB;
  return { ...draft, [changedKey]: clamped, [keyB]: newB, [keyC]: newC };
}

/**
 * Arrondit une liste de poids (somme = 1) en pourcentages entiers qui somment
 * TOUJOURS à exactement 100 (méthode du plus grand reste) : arrondir chaque
 * valeur indépendamment peut faire dériver l'affichage (ex: deux touchpoints
 * à 6.5% arrondis chacun à 7% afficheraient 14% au lieu des 13% réels).
 */
function roundPercentagesTo100(weights: number[]): number[] {
  const raw = weights.map((w) => w * 100);
  const floors = raw.map(Math.floor);
  let remainder = 100 - floors.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] += 1;
    remainder -= 1;
  }
  return result;
}

function configsEqual(a: CustomModelConfig, b: CustomModelConfig): boolean {
  return (
    a.firstTouchPercent === b.firstTouchPercent &&
    a.middlePercent === b.middlePercent &&
    a.lastTouchPercent === b.lastTouchPercent
  );
}

function SplitBar({ config }: { config: CustomModelConfig }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full">
      {POSITIONS.map((p) => (
        <div
          key={p.key}
          className="transition-[width] duration-150"
          style={{ width: `${config[p.key]}%`, backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

/**
 * Onglet "Mon modèle" du panneau d'attribution : construit un modèle "En U"
 * généralisé et configurable (premier / milieu / dernier contact), persisté
 * par projet — voir `computeWeights` (case "custom") côté calcul.
 */
export function CustomModelBuilder({
  projectId,
  config,
  canManage,
  onSaved,
}: {
  projectId: string;
  config: CustomModelConfig | null;
  canManage: boolean;
  onSaved: (config: CustomModelConfig | null) => void;
}) {
  const [draft, setDraft] = useState<CustomModelConfig>(config ?? DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un enregistrement/reset réussi change la référence `config` reçue du
  // parent : resynchronise le brouillon local sur cette nouvelle valeur
  // (ajustement pendant le rendu plutôt qu'un setState dans un effet).
  const [lastSyncedConfig, setLastSyncedConfig] = useState(config);
  if (config !== lastSyncedConfig) {
    setLastSyncedConfig(config);
    setDraft(config ?? DEFAULT_CONFIG);
  }

  const isDirty = !config || !configsEqual(draft, config);
  const previewPercents = roundPercentagesTo100(computeWeights(PREVIEW_TOUCHPOINTS, "custom", draft));

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/custom-model`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      const json: { config: CustomModelConfig } = await res.json();
      onSaved(json.config);
    } catch {
      setError("Échec de l'enregistrement — réessaie dans un instant.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/custom-model`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onSaved(null);
    } catch {
      setError("Échec de la réinitialisation — réessaie dans un instant.");
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <div className="flex flex-col gap-4">
        {config ? (
          <>
            <p className="text-xs text-muted-foreground">Modèle personnalisé actif sur ce projet :</p>
            <SplitBar config={config} />
            <div className="flex flex-col gap-1.5 text-sm">
              {POSITIONS.map((p) => (
                <div key={p.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.label}
                  </span>
                  <span className="font-mono font-medium tabular-nums">{config[p.key]}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun modèle personnalisé configuré sur ce projet. Seul un administrateur peut en créer un.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground">
        Choisis comment répartir le crédit d&apos;une vente entre le premier contact, le dernier, et ce
        qu&apos;il y a entre les deux. Les 3 parts se rééquilibrent automatiquement pour toujours sommer à
        100 %.
      </p>

      <div className="flex flex-col gap-4">
        {POSITIONS.map((p) => (
          <div key={p.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                {p.label}
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">{draft[p.key]}%</span>
            </div>
            <Slider
              value={[draft[p.key]]}
              onValueChange={([value]) => setDraft((d) => rebalance(p.key, value, d))}
              max={100}
              step={1}
              trackColor={p.color}
              disabled={saving}
              aria-label={p.label}
            />
            <p className="text-[11px] text-muted-foreground">{p.hint}</p>
          </div>
        ))}
      </div>

      <SplitBar config={draft} />

      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Info className="size-3 shrink-0" />
          Exemple sur un parcours à 4 étapes
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {PREVIEW_TOUCHPOINTS.map((tp, i) => {
            const color = POSITIONS[i === 0 ? 0 : i === PREVIEW_TOUCHPOINTS.length - 1 ? 2 : 1].color;
            return (
              <span key={tp.source} className="flex items-center gap-1">
                <span
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                  style={{ backgroundColor: color }}
                >
                  {tp.source} · {previewPercents[i]}%
                </span>
                {i < PREVIEW_TOUCHPOINTS.length - 1 && <span className="text-muted-foreground">→</span>}
              </span>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Parcours à une seule interaction : elle reçoit 100 %, quels que soient les curseurs. Parcours à
        2 interactions (pas de milieu) : premier et dernier contact se partagent les 100 % au prorata de
        leurs parts respectives ci-dessus.
      </p>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Enregistrer
        </Button>
        {config && (
          <Button size="sm" variant="ghost" onClick={handleReset} disabled={saving}>
            <RotateCcw className="size-3.5" />
            Réinitialiser
          </Button>
        )}
        {!isDirty && config && <span className="text-xs text-success">Enregistré</span>}
      </div>
    </div>
  );
}
