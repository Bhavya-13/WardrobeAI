Outfi - Phase 8: pop-up position fix, speed, loading animations

1) DATABASE FIRST (one tiny line)
   Supabase > SQL Editor > New query > paste supabase/phase8.sql > Run.
   If you add the code first, the closet page will error.

2) CODE
   Extract the zip, copy the CONTENTS of the inner "wardrobe-ai" folder into your project
   root. Overwrite when asked.

3) TEST
   npm run build
   npm run dev
   Open it on your phone. Check:
   - Closet > "Add from a photo of me": the review sheet appears on screen at once.
   - The swinging hanger shows while pages load and while the AI works.
   - Closet, Outfits and filters feel quick. First visit after this update makes small
     preview pictures for your older items in the background (a few per visit).

4) git add . / git commit -m "Phase 8: fix pop-up position, faster pages, hanger loader" / git push

THE POP-UP BUG
 The page fade-in animation left a transform on the page container. A transform makes
 "fixed" pop-ups position against the page instead of the screen, so on a phone the sheet
 sat at the very bottom. Fixed two ways: the animation no longer leaves a transform, and
 pop-ups now draw directly on the screen (Modal.tsx).

SPEED CHANGES
 - Small preview pictures (about 30 KB) for grids and cards instead of full photos.
 - Picture links are reused for ~45 minutes so the phone keeps pictures in memory.
 - Login check uses the signed token (no extra internet round trip per page).
 - Page data is requested in parallel; clean-up of removed items runs after the page loads.
 - Taps (like, wore it, edit, remove) update instantly and save in the background.
 - Lighter shadows, no blur on phones, a lighter heading font.
 - Dragging the crop slider draws small previews after a short pause.
 - Instant loading screens for Closet and Outfits.
