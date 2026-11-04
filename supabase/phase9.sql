-- Outfi Phase 9: the "Worn" diary (what you wore, when, and where)
-- Run ONCE in Supabase > SQL Editor > New query > Run  (BEFORE you run the new code)

create table if not exists public.outfit_wears (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  outfit_id uuid references public.outfits(id) on delete set null,
  -- a copy of the outfit, so the diary still works if the outfit or items are removed later
  outfit_name text,
  occasion text,
  item_ids uuid[] not null default '{}',
  place text,                              -- "where I wore it"
  worn_on date not null default current_date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists outfit_wears_user_date_idx
  on public.outfit_wears (user_id, worn_on desc, created_at desc);

alter table public.outfit_wears enable row level security;

create policy "wears select own" on public.outfit_wears
  for select to authenticated using (user_id = auth.uid());

create policy "wears insert own" on public.outfit_wears
  for insert to authenticated with check (user_id = auth.uid());

create policy "wears update own" on public.outfit_wears
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "wears delete own" on public.outfit_wears
  for delete to authenticated using (user_id = auth.uid());

-- Your earlier "Wore it" taps become diary entries (one per outfit, no place yet).
insert into public.outfit_wears (user_id, outfit_id, outfit_name, occasion, item_ids, worn_on)
select o.user_id, o.id, o.name, o.occasion, o.item_ids,
       (o.last_worn_at at time zone 'Asia/Kolkata')::date
  from public.outfits o
 where o.worn_count > 0
   and o.last_worn_at is not null
   and o.deleted_at is null
   and not exists (select 1 from public.outfit_wears w where w.outfit_id = o.id);
