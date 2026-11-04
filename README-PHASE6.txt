Outfi - Phase 6: photo extraction, glasses setting, undoable deletes

ORDER MATTERS
1) DATABASE FIRST
   Supabase > SQL Editor > New query > paste supabase/phase6.sql > Run.
   Adds: is_prescription + deleted_at on items, hidden + deleted_at on outfits, a profiles
   table (glasses setting), and turns existing "accessory" glasses into "eyewear".
   If you add the code BEFORE the SQL, tagging and the closet will fail.

2) CODE
   Extract the zip, copy the CONTENTS of the inner "wardrobe-ai" folder into your project
   root. Overwrite when asked:
     lib/wardrobe.ts, lib/gemini.ts, lib/outfits.ts,
     app/api/outfits/generate/route.ts,
     app/closet/page.tsx, app/closet/ItemGrid.tsx,
     app/outfits/page.tsx, OutfitCard.tsx, OutfitGenerator.tsx
   .env.local is NOT in this zip (untouched).

3) TEST
   npm run build
   npm run dev
   - Closet > "Add from a photo of me": pick a clear full-body mirror photo.
     Untick wrong items, move the "Space around each item" slider, tap Add.
     Your photo is NOT saved; only the crops you add. AI then tags them.
   - Closet > Edit on your glasses: category Eyewear, tick "Prescription".
   - Outfits > Glasses: choose Always. Make 3 outfits: each should include your glasses.
   - Remove an item / Delete or "Not for me" an outfit: no popup, an Undo appears for ~6s.
   - "Hide all outfits I have not liked" clears a batch (with Undo).

4) PUSH
   git add .
   git commit -m "Phase 6: photo extraction, glasses, undo"
   git push

NOTES
 - Removed items are erased for good about 2 minutes later (next time you open Closet).
 - "Not for me" hides an outfit but keeps the dislike so the AI avoids similar looks.
 - Crop margin default is 12% (glasses at least 30%). Tune DEFAULT_MARGIN and
   EYEWEAR_MIN_MARGIN in lib/wardrobe.ts.
 - Free-tier AI limits still apply. If photo analysis says the AI is busy, wait a minute.

NEW FILES
  supabase/phase6.sql
  lib/extract.ts, app/api/extract/route.ts
  app/closet/SelfieExtractor.tsx, app/outfits/OutfitToolbar.tsx
