-- Outfi Phase 5: outfit generator
-- Run ONCE in Supabase > SQL Editor > New query > Run  (BEFORE you run the new code)

-- 1) New "type" column for items (t-shirt, polo, jeans, shorts, sneakers...)
alter table public.items add column if not exists subtype text;

-- 2) Saved outfits (liked = true / false / null for no opinion)
create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occasion text not null,
  name text,
  reason text,
  item_ids uuid[] not null,
  liked boolean,
  worn_count int not null default 0,
  last_worn_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists outfits_user_created_idx
  on public.outfits (user_id, created_at desc);

alter table public.outfits enable row level security;

create policy "outfits select own" on public.outfits
  for select to authenticated using (user_id = auth.uid());

create policy "outfits insert own" on public.outfits
  for insert to authenticated with check (user_id = auth.uid());

create policy "outfits update own" on public.outfits
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "outfits delete own" on public.outfits
  for delete to authenticated using (user_id = auth.uid());

-- 3) Re-queue your existing tagged items so AI fills in the new "type" field.
--    (Run this only once. It re-tags items that have no type yet.)
update public.items
   set tag_status = 'pending'
 where tag_status = 'done' and subtype is null;
