-- Ajoute `entry_url` (page d'atterrissage de la session) au STRUCT
-- `touchpoints` d'une table `attributions_resumees` DÉJÀ EXISTANTE — pour un
-- projet qui se connecte pour la première fois, `create_attributions_table.sql`
-- crée déjà la table avec ce champ, ce script-ci ne le concerne pas.
-- Idempotent (IF NOT EXISTS) : sans risque à ré-exécuter, et sans effet sur
-- les lignes déjà présentes (entry_url y reste NULL tant qu'un backfill ne
-- les recalcule pas).
ALTER TABLE `@project.@dataset.attributions_resumees`
ADD COLUMN IF NOT EXISTS touchpoints.entry_url STRING;
