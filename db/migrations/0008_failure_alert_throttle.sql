-- Throttle des alertes email "mise à jour en échec" : on n'alerte pas un
-- propriétaire plus d'une fois tous les 3 jours tant que la panne persiste.
alter table projects add column if not exists last_failure_alert_at timestamptz;
