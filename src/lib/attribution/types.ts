export type Touchpoint = {
  source: string;
  medium: string;
  campaign: string | null;
  timestamp: string;
  position: number;
  /** Page d'atterrissage de la session (premier `page_view`) — null pour les transactions calculées avant l'ajout de ce champ, ou une session sans page_view exploitable. */
  entry_url: string | null;
};

export type AttributionRow = {
  transaction_id: string;
  user_pseudo_id: string;
  event_date: string;
  event_timestamp: string;
  purchase_revenue: number;
  currency: string;
  source_path: string;
  touchpoints: Touchpoint[];
};

export type AttributionModel =
  | "last_click"
  | "linear"
  | "time_decay"
  | "u_shape"
  | "markov"
  | "shapley"
  | "custom";

/** Une règle ne peut cibler que le premier ou le dernier contact : ce sont les
 * deux seules positions qui désignent un touchpoint UNIQUE par transaction
 * (le "milieu" peut en désigner 0, 1 ou plusieurs, ce qui rendrait une règle
 * ambiguë — voir `computeCustomWeights`). */
export type CustomModelRulePosition = "first" | "last";

/**
 * Règle conditionnelle : "si le [premier/dernier] contact est CE canal, lui
 * donner X %". Le canal est comparé au libellé `channelLabel(touchpoint,
 * dimension)` de la dimension active au moment du calcul (Source/Support/
 * Campagne) — une règle écrite pour une dimension ne matche plus si on
 * regroupe autrement ensuite (repli silencieux sur le modèle par défaut,
 * jamais une erreur).
 */
export type CustomModelRule = {
  channelValue: string;
  position: CustomModelRulePosition;
  percent: number;
};

/**
 * Poids (en %, somme = 100) du modèle par défaut : premier contact /
 * contacts intermédiaires (répartis à parts égales entre eux) / dernier
 * contact — voir `computeWeights` (case "custom") pour les cas limites
 * (parcours à 1 ou 2 touchpoints). `rules` permet de surcharger ce défaut
 * pour un canal précis en position première/dernière ; leur somme doit
 * rester ≤ 100 (le reste retombe sur le modèle par défaut ci-dessus).
 */
export type CustomModelConfig = {
  firstTouchPercent: number;
  middlePercent: number;
  lastTouchPercent: number;
  rules: CustomModelRule[];
};

export type SourceCredit = {
  source: string;
  revenue: number;
  share: number;
};
