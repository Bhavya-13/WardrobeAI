-- Outfi Phase 5b: save tags once, re-check safely
-- Run ONCE in Supabase > SQL Editor > New query > Run (BEFORE you run the new code)

alter table public.items
  add column if not exists tagged_at timestamptz,
  add column if not exists tag_version int not null default 0,
  add column if not exists tag_source text not null default 'ai',   -- 'ai' or 'user'
  add column if not exists tag_claimed_at timestamptz;

-- Items that are already tagged count as "tagged now" so they are NOT tagged again.
-- Items without a type (from before Phase 5) get an older version number, so the app
-- quietly re-checks a few of them per visit instead of all at once.
update public.items
   set tagged_at = coalesce(tagged_at, now()),
       tag_version = case when subtype is not null then 2 else 1 end
 where tag_status = 'done' and tag_version = 0;

-- Anything stuck mid-tagging goes back to the queue
update public.items
   set tag_status = 'pending', tag_claimed_at = null
 where tag_status = 'tagging';
