-- Ajoute le support de la connexion par email + mot de passe, en plus du
-- login Google existant. Nullable car les comptes créés via Google n'ont
-- pas de mot de passe.
alter table users add column if not exists password_hash text;
