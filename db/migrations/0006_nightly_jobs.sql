-- File d'attente des runs d'attribution (remplace la boucle séquentielle du
-- cron, qui pouvait se faire tuer par le timeout de la fonction serverless
-- avant d'avoir traité tous les projets). Une ligne = un run "projet + jour".
-- Traitée par claim atomique (SELECT ... FOR UPDATE SKIP LOCKED), ce qui
-- permet d'invoquer le worker plusieurs fois en parallèle sans double
-- traitement.
create table if not exists nightly_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  target_date date not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  trigger_source text not null default 'cron' check (trigger_source in ('cron', 'manual')),
  rows_inserted int,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (project_id, target_date)
);

create index if not exists nightly_jobs_pending_idx on nightly_jobs (created_at) where status = 'pending';
