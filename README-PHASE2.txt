Outfi - Phase 2: bulk photo upload to your closet

1) DATABASE (one time)
   Supabase dashboard > SQL Editor > New query > paste the whole of supabase/phase2.sql > Run.
   It creates the items table, the private "wardrobe" photo bucket, and security rules so
   each user only sees their own photos. If you see "already exists" errors for a policy,
   that part was already created and it is safe to ignore.

2) CODE
   Extract this zip. Copy the CONTENTS of the inner "wardrobe-ai" folder into your project root
   (next to package.json). Overwrite app/page.tsx when asked.
   Your .env.local is NOT in this zip, so it is untouched.

3) TEST LOCALLY
   npm run build      (must finish without errors)
   npm run dev        open http://localhost:3000, log in, click "Add photos"
   Pick several photos at once. They appear in the grid. "Remove" deletes one.

4) PUSH
   git add .
   git commit -m "Phase 2: closet photo upload"
   git push

NOTES
 - Photos are shrunk to max 1280px and saved as JPEG before upload (saves space and AI cost).
 - Files are stored as wardrobe/<user id>/<random>.jpg and shown through 1-hour private links.
 - The items table already has columns for Phase 3 (category, color, pattern, tags...).
