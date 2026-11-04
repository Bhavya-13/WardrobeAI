Outfi - multi-select for "Add from a photo of me"

NO DATABASE CHANGES. One file changed.

INSTALL
 1) Extract the zip, copy the CONTENTS of the inner "wardrobe-ai" folder into your project
    root (overwrite app/closet/SelfieExtractor.tsx).
 2) npm run build
 3) npm run dev, then Closet > "Add from a photo of me" and select SEVERAL photos
    (on a phone the gallery picker lets you tick many photos).
 4) git add . / git commit -m "Select several photos at once for photo extraction" / git push

HOW IT WORKS
 - Up to 10 photos per batch, analysed 2 at a time with a progress bar.
 - One review screen, grouped per photo, each with "Tick all / Untick all".
 - Untick repeats if the same shirt appears in several photos.
 - Photos that fail or have no clothes are listed in a note; the rest still work.
 - Your photos are never saved. Only the items you add are uploaded.

FREE AI LIMITS
 Each photo is 1 AI request, then each added item needs 1 more request for tagging.
 10 selfies with 4 items each = about 50 requests. If the daily free limit is reached,
 untagged items wait in the queue and finish later.
