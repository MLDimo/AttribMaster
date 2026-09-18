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

-- Même correctif que sessions_raw/sessions dans nightly_attribution.sql (voir
-- ses commentaires pour le détail, y compris pourquoi pas de gbraid/wbraid) :
-- un gclid prouve un clic Google Ads réel même quand GA4 classe la session en
-- "google / organic" faute de lien Google Ads <-> GA4. Sans ce même correctif
-- ici, le dénominateur (sessions) resterait sous l'ancienne classification
-- pendant que le numérateur (achats attribués) bascule sur "google / cpc"
-- côté nightly_attribution.sql, faussant le taux de conversion affiché pour
-- les deux canaux.
WITH sessions_raw AS (
  SELECT
    user_pseudo_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
    collected_traffic_source.gclid IS NOT NULL AS is_google_ads_click,
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
    NULLIF(collected_traffic_source.manual_campaign_name, '') AS campaign
  FROM `@project.@ga4_dataset.events_*`
  WHERE _TABLE_SUFFIX = target_date_suffix
    AND event_name = 'session_start'
),

-- Overridé AVANT le GROUP BY (pas dans le SELECT final) pour que deux lignes
-- brutes différentes (ex: "google / organic" et "googleads.g.doubleclick.net
-- / referral", toutes deux avec un gclid) fusionnent en une seule ligne
-- "google / cpc" au lieu de produire deux lignes dupliquées dans la table.
sessions AS (
  SELECT
    user_pseudo_id,
    session_id,
    IF(is_google_ads_click, 'google', source) AS source,
    IF(is_google_ads_click, 'cpc', medium) AS medium,
    IF(is_google_ads_click, NULL, campaign) AS campaign
  FROM sessions_raw
)

INSERT INTO `@project.@dataset.sessions_par_canal`
(event_date, source, medium, campaign, sessions)

SELECT
  @target_date AS event_date,
  source,
  medium,
  campaign,
  COUNT(DISTINCT CONCAT(user_pseudo_id, '-', CAST(session_id AS STRING))) AS sessions
FROM sessions
GROUP BY source, medium, campaign;
