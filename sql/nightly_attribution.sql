-- Moteur d'attribution - script de nuit (incrémental, une exécution = un jour).
--
-- Paramètres attendus (query parameters BigQuery) :
--   @target_date    DATE   -- jour des achats à traiter (généralement hier)
--   @lookback_days  INT64  -- fenêtre de rattrapage des sessions précédant l'achat
--
-- Source : export GA4 natif vers BigQuery (`events_*` / `events_intraday_*`).
-- Destination : `attributions_resumees` (voir create_attributions_table.sql).
--
-- Le script est idempotent : il supprime d'abord les lignes existantes pour
-- @target_date avant de les recalculer, ce qui permet de relancer en toute
-- sécurité sans dupliquer les transactions.

DECLARE target_date_suffix STRING DEFAULT FORMAT_DATE('%Y%m%d', @target_date);
DECLARE lookback_start_suffix STRING DEFAULT FORMAT_DATE(
  '%Y%m%d', DATE_SUB(@target_date, INTERVAL @lookback_days DAY)
);

DELETE FROM `@project.@dataset.attributions_resumees`
WHERE event_date = @target_date;

INSERT INTO `@project.@dataset.attributions_resumees`
(transaction_id, user_pseudo_id, event_date, event_timestamp, purchase_revenue, currency, source_path, touchpoints)

WITH sessions AS (
  SELECT
    user_pseudo_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
    MIN(event_timestamp) AS session_start_timestamp,
    ANY_VALUE(COALESCE(
      NULLIF(collected_traffic_source.manual_source, ''),
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source'),
      '(direct)'
    )) AS source,
    ANY_VALUE(COALESCE(
      NULLIF(collected_traffic_source.manual_medium, ''),
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'medium'),
      '(none)'
    )) AS medium,
    ANY_VALUE(COALESCE(
      NULLIF(collected_traffic_source.manual_campaign_name, ''),
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'campaign')
    )) AS campaign
  FROM `@project.@ga4_dataset.events_*`
  WHERE _TABLE_SUFFIX BETWEEN lookback_start_suffix AND target_date_suffix
    AND event_name = 'session_start'
  GROUP BY user_pseudo_id, session_id
),

purchases AS (
  SELECT
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id,
    user_pseudo_id,
    event_date,
    TIMESTAMP_MICROS(event_timestamp) AS event_timestamp,
    ecommerce.purchase_revenue AS purchase_revenue,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'currency') AS currency
  FROM `@project.@ga4_dataset.events_*`
  WHERE _TABLE_SUFFIX = target_date_suffix
    AND event_name = 'purchase'
    AND ecommerce.transaction_id IS NOT NULL
),

touchpoints_per_purchase AS (
  SELECT
    p.transaction_id,
    p.user_pseudo_id,
    p.event_date,
    p.event_timestamp,
    p.purchase_revenue,
    p.currency,
    ARRAY_AGG(
      STRUCT(
        s.source AS source,
        s.medium AS medium,
        s.campaign AS campaign,
        TIMESTAMP_MICROS(s.session_start_timestamp) AS timestamp,
        CAST(NULL AS INT64) AS position
      )
      ORDER BY s.session_start_timestamp ASC
    ) AS touchpoints
  FROM purchases p
  JOIN sessions s
    ON s.user_pseudo_id = p.user_pseudo_id
   AND TIMESTAMP_MICROS(s.session_start_timestamp) <= p.event_timestamp
  GROUP BY p.transaction_id, p.user_pseudo_id, p.event_date, p.event_timestamp, p.purchase_revenue, p.currency
),

numbered AS (
  SELECT
    * REPLACE (
      ARRAY(
        SELECT AS STRUCT tp.source, tp.medium, tp.campaign, tp.timestamp, off + 1 AS position
        FROM UNNEST(touchpoints) AS tp WITH OFFSET off
      ) AS touchpoints
    )
  FROM touchpoints_per_purchase
)

SELECT
  transaction_id,
  user_pseudo_id,
  event_date,
  event_timestamp,
  purchase_revenue,
  currency,
  (
    SELECT STRING_AGG(CONCAT(t.source, ' / ', t.medium), ' > ' ORDER BY t.position ASC)
    FROM UNNEST(touchpoints) AS t
  ) AS source_path,
  touchpoints
FROM numbered;
