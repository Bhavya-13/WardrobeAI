import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import GoogleButton from "./components/GoogleButton";
import Logo from "./components/Logo";

// Depends on the logged-in user (cookies), so it renders per request.
export const instant = false;

const icon = {
  width: 30,
  height: 30,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ShirtIcon() {
  return (
    <svg {...icon} aria-hidden="true">
      <path d="M8.5 3 3 6l1.8 4 2.2-1v11h10V9l2.2 1L21 6l-5.5-3a3.6 3.6 0 0 1-7 0z" />
    </svg>
  );
}
function PantsIcon() {
  return (
    <svg {...icon} aria-hidden="true">
      <path d="M7 3h10l1.2 18h-4.2l-2-9-2 9H5.8z" />
    </svg>
  );
}
function ShoeIcon() {
  return (
    <svg {...icon} aria-hidden="true">
      <path d="M3 16.5V14c0-1.6 1.3-2.5 3-2.5l3.2-3.7 2.3 2 3 .9c3 .6 6.5 1.4 6.5 4.3v1.5z" />
      <path d="M3 16.5h18" />
    </svg>
  );
}
function GlassesIcon() {
  return (
    <svg {...icon} aria-hidden="true">
      <circle cx="7" cy="14" r="3.6" />
      <circle cx="17" cy="14" r="3.6" />
      <path d="M10.6 13.6h2.8M3.4 13.6 2.5 9M20.6 13.6l.9-4.6" />
    </svg>
  );
}

function Tile({
  label,
  bg,
  children,
}: {
  label: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative grid aspect-square place-items-center rounded-2xl ${bg}`}
    >
      <span className="text-ink/70">{children}</span>
      <span className="absolute bottom-2 left-3 text-[11px] font-medium text-ink/60">
        {label}
      </span>
    </div>
  );
}

// Soft colour glow (a gradient, which is much cheaper for phones than blur)
function Glow({ className, rgb }: { className: string; rgb: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full ${className}`}
      style={{
        background: `radial-gradient(closest-side, rgba(${rgb}, 0.85), rgba(${rgb}, 0))`,
      }}
    />
  );
}

const steps = [
  {
    n: "01",
    title: "Snap your closet",
    body: "Upload photos of your clothes, or take a few mirror selfies and let Outfi pick out each piece for you.",
  },
  {
    n: "02",
    title: "AI sorts it all",
    body: "Every item is labelled by type, colour, pattern and style, so you never have to type a thing.",
  },
  {
    n: "03",
    title: "Get outfits daily",
    body: "Choose the occasion and get fresh looks from clothes you already own, with a reason for each.",
  },
];

const features = [
  {
    title: "Add your closet in minutes",
    body: "A few selfies can add your tops, bottoms, shoes and glasses all at once.",
  },
  {
    title: "Learns your taste",
    body: "Like it, skip it, or mark what you wore. Outfi uses that to style you better next time.",
  },
  {
    title: "Glasses-aware",
    body: "Tell it you wear prescription glasses and every outfit comes with the right pair.",
  },
  {
    title: "Private by default",
    body: "Your photos are stored privately and only you can see them.",
  },
];

export default async function Landing() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (user) redirect("/closet");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-cream text-ink">
      <Glow className="-left-32 -top-32 h-[26rem] w-[26rem]" rgb="240, 213, 201" />
      <Glow className="-right-32 top-32 h-[24rem] w-[24rem]" rgb="220, 229, 219" />

      {/* top bar */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <GoogleButton label="Sign in" tone="light" size="sm" />
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 md:grid-cols-2 md:pb-24 md:pt-14">
        <div className="fade-up">
          <p className="mb-4 inline-block rounded-full bg-paper px-3 py-1 text-xs font-medium text-clay shadow-soft">
            Your personal AI stylist
          </p>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Get the fit,
            <br />
            <span className="italic text-clay">skip the fuss.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink/70">
            Snap your wardrobe once. Outfi turns the clothes you already own
            into outfits you will love, every single day.
          </p>
          <div className="mt-8">
            <GoogleButton size="lg" />
            <p className="mt-3 text-sm text-ink/50">
              Sign in with Google. Your photos are private to you.
            </p>
          </div>
        </div>

        {/* mock outfit card */}
        <div className="fade-up relative mx-auto w-full max-w-sm">
          <div
            aria-hidden="true"
            className="absolute inset-0 -rotate-6 rounded-3xl bg-sand"
          />
          <div className="card relative rotate-2 p-4">
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Olive tee" bg="bg-sage-soft">
                <ShirtIcon />
              </Tile>
              <Tile label="Navy chinos" bg="bg-[#D9DEE8]">
                <PantsIcon />
              </Tile>
              <Tile label="White sneakers" bg="bg-sand">
                <ShoeIcon />
              </Tile>
              <Tile label="Round glasses" bg="bg-blush">
                <GlassesIcon />
              </Tile>
            </div>
            <div className="mt-4 flex items-start justify-between gap-2">
              <p className="font-display text-xl">Sunday brunch</p>
              <span className="chip">Casual day out</span>
            </div>
            <p className="mt-1 text-sm text-ink/60">
              Earthy olive with crisp navy keeps it relaxed but put together.
            </p>
            <div className="mt-4 flex gap-2">
              <span className="btn btn-sm btn-primary">Like</span>
              <span className="btn btn-sm btn-ghost">Wore it</span>
            </div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-12 sm:px-8 md:py-20">
        <h2 className="font-display text-3xl sm:text-4xl">How it works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card p-6">
              <span className="font-display text-3xl italic text-clay">
                {s.n}
              </span>
              <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-12 sm:px-8 md:py-16">
        <h2 className="font-display text-3xl sm:text-4xl">
          Made for real wardrobes
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`rounded-3xl p-6 ${
                i % 3 === 0
                  ? "bg-sage-soft"
                  : i % 3 === 1
                    ? "bg-blush"
                    : "bg-sand"
              }`}
            >
              <h3 className="text-lg font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* closing call to action */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8">
        <div className="rounded-[2rem] bg-ink px-6 py-12 text-center text-cream sm:px-12 sm:py-16">
          <h2 className="font-display text-3xl sm:text-5xl">
            Your best outfit is
            <br />
            <span className="italic text-blush">already in your closet.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-cream/70">
            Start in a couple of minutes. All you need is your phone.
          </p>
          <div className="mt-8 flex justify-center">
            <GoogleButton tone="light" size="lg" />
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 pb-10 text-sm text-ink/50 sm:px-8">
        <Logo className="scale-90 opacity-70" />
        <span>Get the fit, skip the fuss.</span>
      </footer>
    </div>
  );
}
