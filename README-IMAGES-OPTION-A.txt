Outfi - pictures served from your own site (Option A)

NO DATABASE CHANGES. No new environment variables.

INSTALL
 1) Extract the zip, copy the CONTENTS of the inner "wardrobe-ai" folder into your project
    root. Overwrite when asked: proxy.ts, lib/urlCache.ts, app/closet/page.tsx,
    app/outfits/page.tsx, app/worn/page.tsx
 2) npm run build
 3) npm run dev. Open Closet, then close the tab and open it again: pictures you have
    already seen should appear almost instantly.
 4) git add . / git commit -m "Serve pictures from our own site so they cache" / git push

HOW IT WORKS
 - New route app/api/img/route.ts: checks you are logged in, fetches the picture from
   Supabase with YOUR login, and sends it with "keep for a year".
 - Pages now use permanent addresses like /api/img?p=... instead of asking Supabase for a
   temporary link on every page load (one fewer Supabase call per page).
 - Photos stay private. Another account can never fetch your pictures.

MAKE THE FIRST LOAD FAST: match the Vercel region to your Supabase region
 The first time a picture is seen it travels Supabase -> your site -> your phone. Keep the
 two close together:
   1) Supabase: Project Settings > General > Region
   2) Vercel: your project > Settings > Functions > Function Region
   Common pairs:
     Supabase Mumbai (ap-south-1)              -> Vercel Mumbai (bom1)
     Supabase Singapore (ap-southeast-1)       -> Vercel Singapore (sin1)
     Supabase N. Virginia (us-east-1)          -> Vercel Washington D.C. (iad1) [default]
     Supabase Frankfurt (eu-central-1)         -> Vercel Frankfurt (fra1)
     Supabase London (eu-west-2)               -> Vercel London (lhr1)
   Change the Vercel region, then Redeploy.

NOTES
 - Pictures are kept on each device. A brand-new device downloads them once.
 - If you remove an item, a copy may stay in that device's memory until it is cleared.
   It is only visible on your own device.
