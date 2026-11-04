Outfi - Phase 5: outfit generator (weather skipped for now)

ORDER MATTERS
1) DATABASE FIRST
   Supabase > SQL Editor > New query > paste supabase/phase5.sql > Run.
   Adds the "type" column, the outfits table (with security rules), and re-queues your
   existing items so AI fills in their type (shorts vs trousers, polo vs shirt...).
   If you add the code BEFORE running the SQL, tagging will fail.

2) CODE
   Extract the zip and copy the CONTENTS of the inner "wardrobe-ai" folder into your
   project root (next to package.json). Overwrite when asked:
     app/closet/page.tsx, app/closet/ItemGrid.tsx, lib/gemini.ts
   .env.local is NOT in this zip (untouched).

3) TEST
   npm run build
   npm run dev
   - Open Closet: items show "Tagging..." again briefly (adding their type).
   - Tap "Edit" on any card to fix a wrong label.
   - Open Outfits: pick an occasion, tap "Make 3 outfits".
   - Try Like / Not for me / Wore it. Future outfits learn from these.

4) PUSH
   git add .
   git commit -m "Phase 5: outfit generator"
   git push

OPTIONAL .env.local lines
   GEMINI_OUTFIT_MODEL=gemini-3.8-flash     (smarter model for outfits; default shown)
   GEMINI_MODEL=gemini-3.5-flash-lite       (cheap model for tagging; default shown)
If the outfit model is busy, the app automatically falls back to the tagging model.

NEW FILES
  supabase/phase5.sql
  lib/wardrobe.ts, lib/outfits.ts, lib/actions.ts
  app/components/AppHeader.tsx
  app/api/outfits/generate/route.ts
  app/outfits/page.tsx, OutfitGenerator.tsx, OutfitCard.tsx
CHANGED
  lib/gemini.ts, app/closet/page.tsx, app/closet/ItemGrid.tsx
