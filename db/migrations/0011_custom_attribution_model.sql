-- Modèle d'attribution personnalisé (par projet) : répartition du crédit en
-- 3 zones (premier contact / contacts intermédiaires / dernier contact), qui
-- doit toujours sommer à 100 — voir lib/attribution/models.ts (case "custom").
-- Un seul modèle personnalisé par projet (pas de presets multiples nommés) :
-- les 3 colonnes sont soit toutes NULL (non configuré), soit toutes renseignées.
alter table projects add column if not exists custom_model_first_touch_pct smallint;
alter table projects add column if not exists custom_model_middle_pct smallint;
alter table projects add column if not exists custom_model_last_touch_pct smallint;

alter table projects drop constraint if exists custom_model_pct_range;
alter table projects add constraint custom_model_pct_range check (
  (custom_model_first_touch_pct is null or custom_model_first_touch_pct between 0 and 100)
  and (custom_model_middle_pct is null or custom_model_middle_pct between 0 and 100)
  and (custom_model_last_touch_pct is null or custom_model_last_touch_pct between 0 and 100)
);

alter table projects drop constraint if exists custom_model_pct_all_or_none;
alter table projects add constraint custom_model_pct_all_or_none check (
  (custom_model_first_touch_pct is null) = (custom_model_middle_pct is null)
  and (custom_model_middle_pct is null) = (custom_model_last_touch_pct is null)
);

alter table projects drop constraint if exists custom_model_pct_sum_100;
alter table projects add constraint custom_model_pct_sum_100 check (
  custom_model_first_touch_pct is null
  or (custom_model_first_touch_pct + custom_model_middle_pct + custom_model_last_touch_pct = 100)
);
