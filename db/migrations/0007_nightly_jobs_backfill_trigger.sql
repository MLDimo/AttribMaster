-- Autorise trigger_source = 'backfill' : les jobs de rattrapage de tout
-- l'historique GA4 disponible, enfilés une seule fois à la connexion
-- BigQuery d'un projet (distinct de 'cron'/'manual' pour l'observabilité).
alter table nightly_jobs drop constraint if exists nightly_jobs_trigger_source_check;
alter table nightly_jobs add constraint nightly_jobs_trigger_source_check
  check (trigger_source in ('cron', 'manual', 'backfill'));
