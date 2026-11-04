Outfi - Phase 7: new look (landing page, colours, phone-friendly layout)

NO DATABASE CHANGES. No new environment variables.

INSTALL
 1) Extract the zip, copy the CONTENTS of the inner "wardrobe-ai" folder into your project
    root. Overwrite when asked (app/globals.css, app/layout.tsx, app/page.tsx, ...).
 2) npm run build
 3) npm run dev  and open it on your laptop AND your phone.
 4) git add . / git commit -m "Phase 7: new design" / git push

WHAT CHANGED
 - Landing page at "/" for visitors (hero, how it works, features, sign-in).
   Logged-in users are sent straight to /closet.
 - New sign-in page, warm cream / terracotta / sage / blush colours, serif headings
   (Fraunces) with Geist for body text.
 - Phone: bottom tab bar (Closet / Outfits), bigger tap targets, text boxes at 16px so
   iPhones do not zoom, bottom-sheet pop-ups, swipeable filter pills.
 - Closet: filter pills (Tops, Bottoms, Shoes, Eyewear...), nicer cards, tagging banner.
 - Outfits: swipeable occasion pills, photo mosaic cards, heart Like button.
 - lib/supabase/proxy.ts now lets visitors see "/" without logging in.

TUNE THE COLOURS
 Open app/globals.css. The palette is at the top (:root). Change a hex value and the whole
 app updates:
   --cream  page background      --ink   text and main buttons
   --clay   terracotta accent    --sage  calm green accent
   --blush  warm pink accent     --sand  chips and soft fills

IF "next build" SAYS IT CANNOT LOAD THE Fraunces FONT
 It needs internet during the build. Check your connection and retry.
