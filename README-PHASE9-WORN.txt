Outfi - Phase 9: the Worn diary (what you wore, when and where)

1) DATABASE FIRST
   Supabase > SQL Editor > New query > paste supabase/phase9.sql > Run.
   It creates the outfit_wears table and turns your earlier "Wore it" taps into diary entries.
   If you add the code first, the Worn tab and "Wore it" will error.

2) CODE
   Extract the zip, copy the CONTENTS of the inner "wardrobe-ai" folder into your project
   root. Overwrite when asked: app/components/AppHeader.tsx, app/outfits/OutfitCard.tsx,
   app/outfits/page.tsx

3) TEST
   npm run build
   npm run dev
   - Outfits > "Wore it": a box asks "Where did you wear it?" (type a place, or tap one you
     used before, pick the date, Save to diary).
   - New "Worn" tab (bottom bar on phones): your diary, grouped by month, newest first.
   - On a diary entry: Edit / Add place, Wear again, and the bin icon (with Undo).

4) git add . / git commit -m "Phase 9: Worn diary with where-I-wore-it" / git push

NOTES
 - Leaving the place empty is fine.
 - You can log an earlier day (date box), but not a future day.
 - The diary keeps a copy of each outfit, so entries stay even if you later delete the outfit
   or some of its clothes (removed items just show no picture).
 - "Wear again" also updates the outfit's wear counter and "recently worn" memory, so future
   outfit suggestions avoid repeating what you just wore.
