-- Outfi Phase 2: wardrobe items table + private photo storage
-- Run this ONCE in Supabase > SQL Editor > New query > Run

-- 1) Items table (columns for Phase 3 auto-tagging are included now)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  image_path text not null,
  category text,
  color text,
  pattern text,
  formality text,
  season text,
  tags text[] not null default '{}',
  tag_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists items_user_created_idx
  on public.items (user_id, created_at desc);

-- 2) Row Level Security: each user can only touch their own rows
alter table public.items enable row level security;

create policy "items select own" on public.items
  for select to authenticated using (user_id = auth.uid());

create policy "items insert own" on public.items
  for insert to authenticated with check (user_id = auth.uid());

create policy "items update own" on public.items
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "items delete own" on public.items
  for delete to authenticated using (user_id = auth.uid());

-- 3) Private storage bucket for photos (5 MB max, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe', 'wardrobe', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- 4) Storage rules: files live under a folder named after the user's id
create policy "wardrobe read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "wardrobe upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "wardrobe delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
