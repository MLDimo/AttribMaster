-- Table résumée d'attribution, alimentée chaque nuit par le script d'attribution.
-- Partitionnée par event_date pour limiter le volume scanné par l'API et les
-- requêtes incrémentales du script de nuit.
CREATE TABLE IF NOT EXISTS `@project.@dataset.attributions_resumees`
(
  transaction_id   STRING NOT NULL,
  user_pseudo_id   STRING NOT NULL,
  event_date       DATE NOT NULL,
  event_timestamp  TIMESTAMP NOT NULL,
  purchase_revenue FLOAT64 NOT NULL,
  currency         STRING,
  source_path      STRING NOT NULL,
  touchpoints      ARRAY<STRUCT<
    source     STRING,
    medium     STRING,
    campaign   STRING,
    timestamp  TIMESTAMP,
    position   INT64
  >>
)
PARTITION BY event_date
CLUSTER BY transaction_id, user_pseudo_id;
