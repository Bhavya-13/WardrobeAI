import Logo from "../components/Logo";
import HangerLoader from "../components/HangerLoader";

// Shown the instant you open Outfits, while your outfits load.
export default function Loading() {
  return (
    <div className="min-h-screen bg-cream pb-28 text-ink">
      <header className="border-b border-line bg-cream">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="skeleton h-9 w-9 rounded-full" />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="skeleton h-9 w-36 rounded-xl" />
        <div className="skeleton mt-2 h-4 w-56 rounded-lg" />
        <div className="skeleton mt-6 h-40 rounded-3xl" />
        <div className="mt-10">
          <HangerLoader label="Getting your outfits..." />
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton h-72 rounded-3xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
