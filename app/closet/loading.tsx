import Logo from "../components/Logo";
import HangerLoader from "../components/HangerLoader";

// Shown the instant you open the Closet, while your items load.
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
        <div className="skeleton h-9 w-44 rounded-xl" />
        <div className="skeleton mt-2 h-4 w-24 rounded-lg" />
        <div className="mt-10">
          <HangerLoader label="Opening your closet..." />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton aspect-square rounded-3xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
