"use client";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const signIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#F6F1EA] p-6 text-center text-[#1F1F1F]">
      <h1 className="text-5xl font-bold tracking-tight">Outfi</h1>
      <p className="text-xl font-medium">Get the fit, skip the fuss.</p>
      <p className="max-w-sm text-sm text-[#1F1F1F]/60">
        Turn the clothes you already own into outfits you'll love.
      </p>
      <button
        onClick={signIn}
        className="rounded-xl bg-[#1F1F1F] px-6 py-3 text-white transition hover:opacity-90"
      >
        Continue with Google
      </button>
    </main>
  );
}
