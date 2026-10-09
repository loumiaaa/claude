-- Plateforme de suivi - Lamia : base de données de la synchronisation.
-- À coller une seule fois dans Supabase → SQL Editor → New query → Run.
-- Chaque compte ne voit et ne modifie QUE ses propres données (RLS).

create table if not exists public.lamia_data (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  doc        jsonb       not null,
  revision   bigint      not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.lamia_backups (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  doc        jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.lamia_data    enable row level security;
alter table public.lamia_backups enable row level security;

drop policy if exists "lamia_data proprietaire" on public.lamia_data;
create policy "lamia_data proprietaire" on public.lamia_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "lamia_backups proprietaire" on public.lamia_backups;
create policy "lamia_backups proprietaire" on public.lamia_backups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
