import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F6F1EA] p-6 text-center text-[#1F1F1F]">
      <h1 className="text-3xl font-bold">
        Hi, {user.user_metadata.full_name ?? user.email}
      </h1>
      <p className="text-[#1F1F1F]/60">You are signed in to Outfi.</p>
      <form action={signOut}>
        <button className="rounded-xl border border-[#1F1F1F] px-5 py-2 transition hover:bg-[#1F1F1F] hover:text-white">
          Sign out
        </button>
      </form>
    </main>
  );
}
