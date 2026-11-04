Outfi - Get the fit, skip the fuss.
Phase 1: Google login with Supabase  (v2: fixes the Vercel build error)

WHAT CHANGED IN v2
  app/page.tsx now has:  export const instant = false;
  This tells Next.js 16 (Cache Components is ON in your next.config.ts) that the home
  page is per-user and may render per request. Without it, "next build" fails with
  "Error occurred prerendering page /".

HOW TO INSTALL
1. Extract this zip. Copy the CONTENTS of the inner "wardrobe-ai" folder into your
   project root (the folder that contains package.json). Do not nest another folder.
   - Overwrite app/page.tsx and app/layout.tsx when asked.
   - If you already have a .env.local, back it up first (this one overwrites it).
2. Open Command Prompt in the project root and run:
     npm install
     npm run build        <- must finish without errors BEFORE you push
3. Then:  npm run dev   and open http://localhost:3000
4. Push:  git add .  /  git commit -m "Fix build"  /  git push

FALLBACK if build still fails on Cache Components:
  Open next.config.ts and delete the two lines:
     cacheComponents: true,
     partialPrefetching: true,
  then run npm run build again.

SUPABASE DASHBOARD (Authentication > URL Configuration)
  Site URL:       http://localhost:3000
  Redirect URLs:  http://localhost:3000/**
                  https://wardrobe-ai-three-ecru.vercel.app/**

VERCEL (Project > Settings > Environment Variables), then Redeploy:
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  GEMINI_API_KEY

GOOGLE CLOUD
  Authorized redirect URI: https://vuquzzdaeemkxnzilrpt.supabase.co/auth/v1/callback
  Your Gmail must be listed under Audience > Test users.
