import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// api/img is skipped: the picture route checks your login itself, and skipping the
// proxy keeps each picture request as fast as possible.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/img|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
