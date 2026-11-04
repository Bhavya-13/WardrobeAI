Outfi - Phase 5b: tag once, re-check safely

1) DATABASE FIRST
   Supabase > SQL Editor > New query > paste supabase/phase5b.sql > Run.
   (Run it before adding the code.)

2) CODE
   Extract the zip, copy the CONTENTS of the inner "wardrobe-ai" folder into your project
   root. Overwrite when asked: lib/wardrobe.ts, app/api/tag/route.ts,
   app/closet/Tagger.tsx, app/closet/page.tsx, app/closet/ItemGrid.tsx

3) TEST
   npm run build
   npm run dev
   Reload /closet several times. Items marked "done" must NOT show "Tagging..." again.

HOW IT WORKS NOW
 - Tags are saved once (tag_status = done, with tagged_at and tag_version).
 - A "claim" stops two requests (reloads, two tabs) from tagging the same photo at once,
   which used to waste your free daily AI quota.
 - Free-tier limits no longer lose work: the item goes back in the queue.
 - Re-checks (add/remove/fix tags) happen only when:
     a) an AI tag is older than RECHECK_DAYS (90), or
     b) TAG_VERSION in lib/wardrobe.ts was raised because the prompt improved.
   At most RECHECK_BATCH (5) items per page visit, and only when nothing is waiting.
 - Tags you fixed with Edit are marked tag_source = user and are never overwritten.

TUNE IT: edit TAG_VERSION, RECHECK_DAYS, RECHECK_BATCH in lib/wardrobe.ts.
