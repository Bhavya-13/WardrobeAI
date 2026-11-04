Outfi - label items while extracting them from photos

NO DATABASE CHANGES. No new environment variables.

INSTALL
 1) Extract the zip, copy the CONTENTS of the inner "wardrobe-ai" folder into your project
    root. Overwrite when asked: lib/gemini.ts, lib/extract.ts, app/closet/SelfieExtractor.tsx
 2) npm run build
 3) npm run dev. Closet > "Add from a photo of me", pick a few photos.
    The review screen now shows each item's colour and type (e.g. "olive green t-shirt").
    After "Add", the cards are labelled immediately: no "Tagging..." wait.
 4) git add . / git commit -m "Label items in the same AI request as photo extraction" / git push

WHAT CHANGED
 - ONE AI request per photo now finds each item AND labels it (type, colour, pattern,
   formality, season, tags, prescription for glasses).
 - Before: 1 request per photo + 1 per item. Example: 10 selfies x 4 items = 50 requests.
   Now: 10 requests. About 80 percent fewer.
 - Items saved with their labels are marked done, source "ai", current tag version, so the
   tagging queue never touches them.
 - Photos added with "Add photos" (single items) still use 1 tagging request each.
 - Labels come from a whole-body photo, so lighting or a partly hidden item can make them
   a little less exact. Tap Edit on any card to fix it.
