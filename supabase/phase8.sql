-- Outfi Phase 8: small preview pictures (makes the closet load much faster)
-- Run ONCE in Supabase > SQL Editor > New query > Run  (BEFORE you run the new code)

alter table public.items add column if not exists thumb_path text;
