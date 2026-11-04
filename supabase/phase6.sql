-- Outfi Phase 6: selfie extraction, eyewear + glasses setting, undoable deletes
-- Run ONCE in Supabase > SQL Editor > New query > Run  (BEFORE you run the new code)

-- 1) Items: prescription flag (for glasses) + soft delete (for Undo)
alter table public.items add column if not exists is_prescription boolean;
alter table public.items add column if not exists deleted_at timestamptz;

-- 2) Outfits: "Not for me" hides, delete is undoable
alter table public.outfits add column if not exists hidden boolean not null default false;
alter table public.outfits add column if not exists deleted_at timestamptz;

-- 3) Small profile table (glasses setting now, more preferences later)
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  glasses_mode text not null default 'sometimes'
    check (glasses_mode in ('always', 'sometimes', 'never')),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles select own" on public.profiles
  for select to authenticated using (user_id = auth.uid());

create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (user_id = auth.uid());

create policy "profiles update own" on public.profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4) Turn existing glasses photos (tagged "accessory") into "eyewear"
update public.items
   set category = 'eyewear'
 where category = 'accessory'
   and (tags && array['glasses', 'eyeglasses', 'sunglasses', 'spectacles']::text[]
        or subtype in ('glasses', 'eyeglasses', 'sunglasses', 'spectacles'));
