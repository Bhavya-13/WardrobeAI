Outfi - clear reasons when a photo cannot be analysed, plus a more forgiving scanner

NO DATABASE CHANGES. No new environment variables.

INSTALL
 1) Extract the zip, copy the CONTENTS of the inner "wardrobe-ai" folder into your project
    root. Overwrite when asked: lib/gemini.ts, lib/extract.ts, app/api/extract/route.ts,
    app/closet/SelfieExtractor.tsx
 2) npm run build
 3) npm run dev. Closet > "Add from a photo of me" with a few photos.
 4) git add . / git commit -m "Explain why a photo failed, retry button, more forgiving scan" / git push

WHAT YOU SEE NOW WHEN A PHOTO FAILS
 Each failed photo is listed with a plain reason and what to do, plus a "Try again" button:
   - AI busy / free limit        -> wait a minute, Try again
   - AI declined (safety)        -> try another photo
   - answer cut off / unreadable -> Try again
   - no clothes seen             -> use a clearer full-body photo (or Try again)
   - saw items but no positions  -> Try again
   - browser cannot open it      -> usually iPhone HEIC; share as JPEG or screenshot
   - service not set up          -> check GEMINI_API_KEY / model names
 A small grey line shows the technical detail when there is one. If a CLEAR photo keeps
 failing, send me that grey line and the reason text.

WHAT WAS FIXED UNDER THE HOOD
 - The AI now has room for a longer answer (the labels made answers bigger, which could cut
   them off).
 - Boxes are accepted in slightly different shapes instead of being thrown away.
 - Smaller items (like glasses in a full-body photo) are no longer dropped as too small.
 - If the first AI model finds nothing, the second one gets a go before giving up.
 - The reason for an empty result is reported instead of a vague "no clothes found".
