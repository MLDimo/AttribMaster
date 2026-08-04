-- Comptage des sessions par canal - script de nuit (incrémental, une exécution
-- = un jour). Contrairement à nightly_attribution.sql (qui ne garde que les
-- sessions ayant mené à un achat, sur une fenêtre de rattrapage), celui-ci
-- compte TOUTES les sessions du jour, quel que soit leur résultat : c'est le
-- dénominateur du taux de conversion par canal.
--
-- Paramètres attendus (query parameters BigQuery) :
--   @target_date DATE -- jour des sessions à compter (généralement hier)
--
-- Source : export GA4 natif vers BigQuery (`events_*`).
-- Destination : `sessions_par_canal` (voir create_channel_sessions_table.sql).
--
-- Idempotent : supprime d'abord les lignes existantes pour @target_date avant
-- de les recalculer.

DECLARE target_date_suffix STRING DEFAULT FORMAT_DATE('%Y%m%d', @target_date);

DELETE FROM `@project.@dataset.sessions_par_canal`
WHERE event_date = @target_date;

INSERT INTO `@project.@dataset.sessions_par_canal`
(event_date, source, medium, campaign, sessions)

SELECT
  @target_date AS event_date,
  COALESCE(
    NULLIF(collected_traffic_source.manual_source, ''),
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source'),
    '(direct)'
  ) AS source,
  COALESCE(
    NULLIF(collected_traffic_source.manual_medium, ''),
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'medium'),
    '(none)'
  ) AS medium,
  NULLIF(collected_traffic_source.manual_campaign_name, '') AS campaign,
  COUNT(DISTINCT CONCAT(
    user_pseudo_id, '-',
    CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING)
  )) AS sessions
FROM `@project.@ga4_dataset.events_*`
WHERE _TABLE_SUFFIX = target_date_suffix
  AND event_name = 'session_start'
GROUP BY source, medium, campaign;
