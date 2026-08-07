-- Export nocturne vers Google Sheets (voir lib/google-sheets/client.ts) :
-- l'utilisateur colle l'URL de sa feuille, le script de nuit y réécrit les
-- transactions des 90 derniers jours (même fenêtre que le rattrapage
-- d'attribution) à chaque exécution — un remplacement complet, pas un ajout,
-- pour rester idempotent.
alter table projects add column if not exists export_google_sheet_url text;
-- Renseigné par le script de nuit à chaque tentative (succès ou échec) :
-- permet d'afficher un état ("dernière synchro" / "erreur") dans /manage
-- sans dépendre des logs serveur.
alter table projects add column if not exists export_google_sheet_last_synced_at timestamptz;
alter table projects add column if not exists export_google_sheet_last_error text;
