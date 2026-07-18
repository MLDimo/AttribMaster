-- Rate limiting générique par clé (ex: "cpr:<ip>" pour le formulaire plan sur
-- mesure, "signup:<ip>" pour l'inscription) : compteur par fenêtre glissante.
create table if not exists rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);
