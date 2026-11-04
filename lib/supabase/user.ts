import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
};

type AuthLike = {
  auth: Pick<SupabaseClient["auth"], "getClaims" | "getUser">;
};

// Who is logged in? Checks the signed login token on the server instead of
// asking Supabase over the internet every time, which makes every page faster.
// Falls back to the slower check if the quick one cannot answer.
export async function getSessionUser(
  supabase: AuthLike
): Promise<SessionUser | null> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims as Record<string, unknown> | undefined;
    if (!error && claims && typeof claims.sub === "string") {
      const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
      return {
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : null,
        name: typeof meta.full_name === "string" ? meta.full_name : null,
      };
    }
  } catch {
    // fall through to the slower check
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const full = user.user_metadata?.full_name;
  return {
    id: user.id,
    email: user.email ?? null,
    name: typeof full === "string" ? full : null,
  };
}
