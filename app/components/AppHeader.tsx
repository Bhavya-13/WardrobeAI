import Link from "next/link";
import { signOut } from "@/lib/actions";
import Logo from "./Logo";

const svg = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ClosetIcon() {
  return (
    <svg {...svg} aria-hidden="true">
      <path d="M8.5 3 3 6l1.8 4 2.2-1v11h10V9l2.2 1L21 6l-5.5-3a3.6 3.6 0 0 1-7 0z" />
    </svg>
  );
}

function OutfitsIcon() {
  return (
    <svg {...svg} aria-hidden="true">
      <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" />
      <path d="M18.5 15l.8 2 2 .7-2 .7-.8 2-.8-2-2-.7 2-.7z" />
    </svg>
  );
}

export default function AppHeader({
  name,
  active,
}: {
  name: string;
  active: "closet" | "outfits";
}) {
  const first = name.split(/[\s@]/)[0] || "there";
  const initial = (first[0] ?? "O").toUpperCase();

  const desktopTab = (key: "closet" | "outfits") =>
    `rounded-full px-4 py-2 text-sm transition ${
      active === key
        ? "bg-ink text-cream"
        : "text-ink/60 hover:bg-paper hover:text-ink"
    }`;

  const mobileTab = (key: "closet" | "outfits") =>
    `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
      active === key ? "text-clay" : "text-ink/50"
    }`;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/closet" aria-label="Outfi home">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/closet" className={desktopTab("closet")}>
              Closet
            </Link>
            <Link href="/outfits" className={desktopTab("outfits")}>
              Outfits
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink/60 sm:inline">
              Hi, {first}
            </span>
            <span
              className="grid h-9 w-9 place-items-center rounded-full bg-sage-soft text-sm font-medium"
              aria-hidden="true"
            >
              {initial}
            </span>
            <form action={signOut}>
              <button className="rounded-full px-2 py-2 text-sm text-ink/60 transition hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* phone: tab bar fixed to the bottom, like a real app */}
      <nav
        aria-label="Main"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper/95 backdrop-blur md:hidden"
      >
        <Link href="/closet" className={mobileTab("closet")}>
          <ClosetIcon />
          Closet
        </Link>
        <Link href="/outfits" className={mobileTab("outfits")}>
          <OutfitsIcon />
          Outfits
        </Link>
      </nav>
    </>
  );
}
