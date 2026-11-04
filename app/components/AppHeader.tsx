import Link from "next/link";
import { signOut } from "@/lib/actions";

export default function AppHeader({
  name,
  active,
}: {
  name: string;
  active: "closet" | "outfits";
}) {
  const tab = (key: "closet" | "outfits") =>
    `rounded-xl px-4 py-2 text-sm transition ${
      active === key
        ? "bg-[#1F1F1F] text-white"
        : "border border-[#1F1F1F]/30 hover:border-[#1F1F1F]"
    }`;

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Outfi</h1>
        <p className="text-sm text-[#1F1F1F]/60">Hi, {name}</p>
      </div>
      <nav className="flex flex-wrap items-center gap-2">
        <Link href="/closet" className={tab("closet")}>
          Closet
        </Link>
        <Link href="/outfits" className={tab("outfits")}>
          Outfits
        </Link>
        <form action={signOut}>
          <button className="rounded-xl border border-[#1F1F1F]/30 px-4 py-2 text-sm transition hover:border-[#1F1F1F]">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
