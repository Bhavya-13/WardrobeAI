Outfi - Get the fit, skip the fuss.
Phase 1: Google login with Supabase

HOW TO INSTALL
1. Extract this zip. Copy the CONTENTS of the inner "wardrobe-ai" folder into your
   project root (the folder that contains package.json). Do not nest another folder.
   - Overwrite app/page.tsx and app/layout.tsx when asked.
   - If you already have a .env.local, back it up first (this one overwrites it).
2. Open Command Prompt in the project root and run:
     npm install @supabase/supabase-js @supabase/ssr
3. Open .env.local and paste your Gemini key after GEMINI_API_KEY= (needed in Phase 3).
4. Run:  npm run dev   then open http://localhost:3000

SUPABASE DASHBOARD (Authentication > URL Configuration)
  Site URL:       http://localhost:3000
  Redirect URLs:  http://localhost:3000/**
                  https://wardrobe-ai-three-ecru.vercel.app/**

VERCEL (Project > Settings > Environment Variables), then Redeploy:
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  GEMINI_API_KEY

GOOGLE CLOUD
  Authorized redirect URI (Clients > your web client):
  https://vuquzzdaeemkxnzilrpt.supabase.co/auth/v1/callback
  Your Gmail must be listed under Audience > Test users.

FILES
  proxy.ts                      keeps sessions fresh, redirects logged-out users to /login
  lib/supabase/client.ts        browser Supabase client
  lib/supabase/server.ts        server Supabase client
  lib/supabase/proxy.ts         session refresh logic used by proxy.ts
  app/layout.tsx                page shell + browser tab title
  app/auth/callback/route.ts    finishes Google login
  app/login/page.tsx            login screen
  app/page.tsx                  home screen (shows signed-in user)
