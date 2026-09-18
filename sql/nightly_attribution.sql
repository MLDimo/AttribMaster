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

WITH sessions_raw AS (
  SELECT
    user_pseudo_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
    MIN(event_timestamp) AS session_start_timestamp,
    LOGICAL_OR(collected_traffic_source.gclid IS NOT NULL) AS is_google_ads_click,
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

-- Un gclid prouve un clic Google Ads réel, quel que soit ce que GA4 a classé
-- par ailleurs : sans le lien Google Ads <-> GA4 (Admin > Product Links), GA4
-- retombe sur "google / organic" malgré l'auto-tagging actif — cas vécu en
-- prod (Maison de la détection : 2452 sessions avec un gclid, 0 classées
-- "google / cpc" par GA4). La vraie campagne n'est alors jamais remontée par
-- GA4 : NULL plutôt que reprendre celle de la classification organique,
-- trompeuse une fois associée à "google / cpc". Pas de gbraid/wbraid (mêmes
-- clics côté app/iOS) : ces champs n'existent pas dans le schéma d'export de
-- tous les clients (constaté en prod), et une référence à un champ STRUCT
-- absent est une erreur BigQuery dure, pas un NULL silencieux.
sessions AS (
  SELECT
    user_pseudo_id,
    session_id,
    session_start_timestamp,
    IF(is_google_ads_click, 'google', source) AS source,
    IF(is_google_ads_click, 'cpc', medium) AS medium,
    IF(is_google_ads_click, NULL, campaign) AS campaign
  FROM sessions_raw
),

-- Page d'atterrissage de chaque session (le "lien d'entrée" affiché par
-- touchpoint dans le dashboard) : le `page_location` du tout premier
-- `page_view` de la session, PAS celui de `session_start` (qui ne porte pas
-- ce paramètre de façon fiable). Un balayage `page_view` séparé plutôt qu'un
-- LEFT JOIN direct sur `sessions` pour ne retenir que le PREMIER par session
-- (ARRAY_AGG + LIMIT 1, la même technique que `touchpoints_per_purchase`
-- ci-dessous plutôt qu'une sous-requête corrélée coûteuse).
entry_pages AS (
  SELECT
    user_pseudo_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
    ARRAY_AGG(
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location')
      IGNORE NULLS
      ORDER BY event_timestamp ASC
      LIMIT 1
    )[SAFE_OFFSET(0)] AS entry_url
  FROM `@project.@ga4_dataset.events_*`
  WHERE _TABLE_SUFFIX BETWEEN lookback_start_suffix AND target_date_suffix
    AND event_name = 'page_view'
  GROUP BY user_pseudo_id, session_id
),

purchases AS (
  SELECT
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id,
    user_pseudo_id,
    -- event_date est STRING côté export GA4 (format YYYYMMDD), à convertir
    -- pour matcher le type DATE de attributions_resumees.event_date.
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
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
        CAST(NULL AS INT64) AS position,
        e.entry_url AS entry_url
      )
      ORDER BY s.session_start_timestamp ASC
    ) AS touchpoints
  FROM purchases p
  JOIN sessions s
    ON s.user_pseudo_id = p.user_pseudo_id
   AND TIMESTAMP_MICROS(s.session_start_timestamp) <= p.event_timestamp
  LEFT JOIN entry_pages e
    ON e.user_pseudo_id = s.user_pseudo_id
   AND e.session_id = s.session_id
  GROUP BY p.transaction_id, p.user_pseudo_id, p.event_date, p.event_timestamp, p.purchase_revenue, p.currency
),

numbered AS (
  SELECT
    * REPLACE (
      ARRAY(
        SELECT AS STRUCT tp.source, tp.medium, tp.campaign, tp.timestamp, off + 1 AS position, tp.entry_url
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
