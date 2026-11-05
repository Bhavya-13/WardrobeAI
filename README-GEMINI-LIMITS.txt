Outfi - skip an AI model that is out of requests (one file changed: lib/gemini.ts)

NO DATABASE CHANGES. No new environment variables.

WHAT YOU ALREADY HAD
 lib/outfits.ts and lib/extract.ts already try the better model (Gemini 3.8 Flash) first and
 fall back to Gemini 3.5 Flash Lite when it is rate-limited. That keeps working unchanged.

WHAT THIS ADDS
 When Google says a model has hit its limit, the app now remembers that for a while and
 skips it straight away. So once the better model's daily 20 requests are used up, outfits
 and photo analysis go to Flash Lite immediately, instead of asking the better model (and
 getting refused) on every single request.
  - daily limit: skipped for up to 3 hours at a time (the daily count resets at midnight
    Pacific time, about 1:30 PM India time)
  - per-minute limit: skipped for the wait time Google gives, or about 60 seconds

INSTALL
 1) Extract the zip, copy the CONTENTS of the inner "wardrobe-ai" folder into your project
    root. Overwrite lib/gemini.ts when asked.
 2) npm run build
 3) git add . / git commit -m "Skip a Gemini model that is out of requests" / git push

NOTES
 - The memory lives in one server instance. A fresh instance asks once, gets refused, and
    remembers. That is why the normal fallback is kept as the safety net.
 - Not tested against a real daily-limit reply from Google. It treats a 429 whose text
    contains "PerDay" as the daily limit; anything else counts as a per-minute limit.
