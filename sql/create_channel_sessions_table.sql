-- Table résumée du nombre de sessions par canal et par jour, alimentée chaque
-- nuit par nightly_channel_sessions.sql. Sert de dénominateur au taux de
-- conversion par canal (attributions_resumees ne contient QUE les
-- transactions déjà converties, jamais les sessions qui n'ont pas acheté).
CREATE TABLE IF NOT EXISTS `@project.@dataset.sessions_par_canal`
(
  event_date DATE NOT NULL,
  source     STRING NOT NULL,
  medium     STRING NOT NULL,
  campaign   STRING,
  sessions   INT64 NOT NULL
)
PARTITION BY event_date
CLUSTER BY source, medium;
