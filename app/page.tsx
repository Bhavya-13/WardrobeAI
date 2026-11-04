import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Depends on the logged-in user (cookies), so it renders per request.
export const instant = false;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/closet" : "/login");
}
