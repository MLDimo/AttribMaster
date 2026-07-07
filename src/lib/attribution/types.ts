export type Touchpoint = {
  source: string;
  medium: string;
  campaign: string | null;
  timestamp: string;
  position: number;
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

export type AttributionModel = "linear" | "u_shape" | "time_decay";

export type SourceCredit = {
  source: string;
  revenue: number;
  share: number;
};
