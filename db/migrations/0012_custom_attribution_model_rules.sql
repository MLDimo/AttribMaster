-- Règles conditionnelles du modèle d'attribution "Personnalisé" (voir
-- lib/attribution/types.ts CustomModelRule) : tableau JSON
-- [{channelValue, position: "first"|"last", percent}, ...], validé
-- uniquement en app (zod à la frontière API + `computeCustomWeights`) — pas
-- de contrainte DB sur la structure/somme, comme pour le reste des colonnes
-- JSON de ce projet (aucun autre précédent JSONB ici, mais cette liste est
-- toujours lue/écrite d'un bloc, jamais interrogée ligne par ligne : une
-- table dédiée n'apporterait rien).
alter table projects add column if not exists custom_model_rules jsonb not null default '[]'::jsonb;
