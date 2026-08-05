"use client";

import { Info, ListPlus, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { computeWeights } from "@/lib/attribution/models";
import type { CustomModelConfig, CustomModelRule, CustomModelRulePosition, Touchpoint } from "@/lib/attribution/types";

const DEFAULT_CONFIG: CustomModelConfig = { firstTouchPercent: 40, middlePercent: 20, lastTouchPercent: 40, rules: [] };

type PositionKey = "firstTouchPercent" | "middlePercent" | "lastTouchPercent";

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

const RULE_POSITION_LABELS: Record<CustomModelRulePosition, string> = {
  first: "Premier contact",
  last: "Dernier contact",
};

/**
 * Parcours factice pour visualiser en direct l'effet des curseurs ET des
 * règles — jamais envoyé au serveur. Libellés réalistes (au format
 * "source / support" qu'utilisent les vraies règles) plutôt que des noms
 * génériques : une règle ciblant "google / cpc" a une chance réelle de
 * s'appliquer visiblement ici, pas seulement en production.
 */
const PREVIEW_TOUCHPOINTS: Touchpoint[] = [
  { source: "google", medium: "cpc", campaign: null, timestamp: "2026-07-01T10:00:00Z", position: 0 },
  { source: "newsletter", medium: "email", campaign: null, timestamp: "2026-07-03T10:00:00Z", position: 1 },
  { source: "facebook", medium: "paid", campaign: null, timestamp: "2026-07-05T10:00:00Z", position: 2 },
  { source: "direct", medium: "none", campaign: null, timestamp: "2026-07-06T10:00:00Z", position: 3 },
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

function rulesEqual(a: CustomModelRule[], b: CustomModelRule[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((r, i) => r.channelValue === b[i].channelValue && r.position === b[i].position && r.percent === b[i].percent);
}

function configsEqual(a: CustomModelConfig, b: CustomModelConfig): boolean {
  return (
    a.firstTouchPercent === b.firstTouchPercent &&
    a.middlePercent === b.middlePercent &&
    a.lastTouchPercent === b.lastTouchPercent &&
    rulesEqual(a.rules, b.rules)
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

function JourneyPreview({ config }: { config: CustomModelConfig }) {
  const previewPercents = roundPercentagesTo100(computeWeights(PREVIEW_TOUCHPOINTS, "custom", config, "source"));
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Info className="size-3 shrink-0" />
        Exemple sur un parcours à 4 étapes
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {PREVIEW_TOUCHPOINTS.map((tp, i) => {
          const color = POSITIONS[i === 0 ? 0 : i === PREVIEW_TOUCHPOINTS.length - 1 ? 2 : 1].color;
          const label = `${tp.source} / ${tp.medium}`;
          return (
            <span key={label} className="flex items-center gap-1">
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: color }}
              >
                {label} · {previewPercents[i]}%
              </span>
              {i < PREVIEW_TOUCHPOINTS.length - 1 && <span className="text-muted-foreground">→</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function RulesReadOnlyList({ rules }: { rules: CustomModelRule[] }) {
  if (rules.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <p className="text-xs text-muted-foreground">Règles :</p>
      {rules.map((rule, i) => (
        <p key={i} className="text-xs text-muted-foreground">
          Si le <span className="font-medium text-foreground">{RULE_POSITION_LABELS[rule.position].toLowerCase()}</span>{" "}
          est <span className="font-medium text-foreground">{rule.channelValue}</span> → il reçoit{" "}
          <span className="font-mono font-medium text-foreground">{rule.percent}%</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Onglet "Mon modèle" du panneau d'attribution : construit un modèle "En U"
 * généralisé et configurable (premier / milieu / dernier contact), avec des
 * règles conditionnelles optionnelles ("si CE canal est en 1er/dernier
 * contact, donne-lui X%") — persisté par projet, voir `computeWeights` (case
 * "custom") côté calcul.
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
  const rulesSum = draft.rules.reduce((sum, r) => sum + r.percent, 0);
  const rulesValid = rulesSum <= 100 && draft.rules.every((r) => r.channelValue.trim().length > 0);
  const canSave = isDirty && rulesValid;

  function addRule() {
    setDraft((d) => ({ ...d, rules: [...d.rules, { channelValue: "", position: "first", percent: 10 }] }));
  }
  function updateRule(index: number, patch: Partial<CustomModelRule>) {
    setDraft((d) => ({ ...d, rules: d.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));
  }
  function removeRule(index: number) {
    setDraft((d) => ({ ...d, rules: d.rules.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/custom-model`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, rules: draft.rules.map((r) => ({ ...r, channelValue: r.channelValue.trim() })) }),
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
            <RulesReadOnlyList rules={config.rules} />
            <JourneyPreview config={config} />
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
      <JourneyPreview config={draft} />

      <p className="text-[11px] text-muted-foreground">
        Parcours à une seule interaction : elle reçoit 100 %, quels que soient les curseurs. Parcours à
        2 interactions (pas de milieu) : premier et dernier contact se partagent les 100 % au prorata de
        leurs parts respectives ci-dessus.
      </p>

      <Accordion type="single" collapsible defaultValue={draft.rules.length > 0 ? "rules" : undefined}>
        <AccordionItem value="rules" className="border-none">
          <AccordionTrigger className="py-1 hover:no-underline">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <ListPlus className="size-3.5 text-muted-foreground" />
              Règles avancées (optionnel)
              {draft.rules.length > 0 && <Badge variant="secondary">{draft.rules.length}</Badge>}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-3 pt-1">
              <p className="text-[11px] text-muted-foreground">
                Cible un canal précis en position première ou dernière pour lui donner un % fixe, différent
                du modèle par défaut ci-dessus (ex: &quot;si google / cpc est le premier contact → 70
                %&quot;). Le reste retombe automatiquement sur le modèle par défaut — la somme des règles ne
                doit pas dépasser 100 %.
              </p>

              {draft.rules.map((rule, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                  <select
                    className="h-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent px-2 text-xs"
                    value={rule.position}
                    disabled={saving}
                    onChange={(e) => updateRule(i, { position: e.target.value as CustomModelRulePosition })}
                  >
                    {(Object.entries(RULE_POSITION_LABELS) as Array<[CustomModelRulePosition, string]>).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                  <span className="text-xs text-muted-foreground">est</span>
                  <Input
                    value={rule.channelValue}
                    disabled={saving}
                    onChange={(e) => updateRule(i, { channelValue: e.target.value })}
                    placeholder="ex : google / cpc"
                    className="h-8 min-w-32 flex-1 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={rule.percent}
                    disabled={saving}
                    onChange={(e) =>
                      updateRule(i, { percent: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })
                    }
                    className="h-8 w-16 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0"
                    disabled={saving}
                    onClick={() => removeRule(i)}
                    aria-label="Supprimer cette règle"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center justify-between gap-2">
                <Button size="sm" variant="outline" onClick={addRule} disabled={saving}>
                  <Plus className="size-3.5" />
                  Ajouter une règle
                </Button>
                {draft.rules.length > 0 && (
                  <span className={`text-xs ${rulesSum > 100 ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                    Somme des règles : {rulesSum}%{rulesSum > 100 ? " — dépasse 100 %" : ""}
                  </span>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
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
