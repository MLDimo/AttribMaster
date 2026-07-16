-- Anti brute-force sur le login par mot de passe : compteur d'échecs par
-- email, verrouillage temporaire après trop de tentatives. Une ligne par
-- email attaqué, supprimée au premier login réussi.
create table if not exists login_throttle (
  email text primary key,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
