Outfi - Phase 3a: AI tagging with Gemini

1) ADD YOUR GEMINI KEY (do this first)
   Get a free key at aistudio.google.com/api-keys, then open your project's .env.local
   and add (never put this in chat or in code):
       GEMINI_API_KEY=your-key-here
   Optional (default is already gemini-3.5-flash-lite):
       GEMINI_MODEL=gemini-3.5-flash-lite
   Also add GEMINI_API_KEY in Vercel > Settings > Environment Variables, then Redeploy.
   Restart "npm run dev" after editing .env.local.

2) CODE
   Extract this zip and copy the CONTENTS of the inner "wardrobe-ai" folder into your
   project root (next to package.json). Overwrite app/closet/page.tsx and
   app/closet/ItemGrid.tsx when asked. No database changes are needed.

3) TEST
   npm run build
   npm run dev
   Open /closet. Your existing photos show "Tagging..." and AI fills in category, color,
   pattern, formality, season and tags. New uploads are tagged automatically.
   Free tier is rate limited, so ~40 photos take a few minutes. If it pauses, press
   the "Tag N items with AI" button to continue.

4) PUSH
   git add .
   git commit -m "Phase 3a: AI tagging"
   git push

NEW FILES
   lib/gemini.ts              talks to Gemini (server only)
   app/api/tag/route.ts       tags one item, saves result
   app/closet/Tagger.tsx      runs tagging in the background, handles rate limits
CHANGED
   app/closet/page.tsx, app/closet/ItemGrid.tsx
