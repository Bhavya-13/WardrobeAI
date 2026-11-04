import Link from "next/link";
import GoogleButton from "../components/GoogleButton";
import Logo from "../components/Logo";

// Reads the URL (searchParams), so it renders per request.
export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-cream px-5 py-10 text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blush opacity-70 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-sage-soft opacity-90 blur-3xl"
      />

      <div className="card fade-up relative w-full max-w-sm p-8 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-6 font-display text-3xl">Welcome back</h1>
        <p className="mt-2 text-sm text-ink/60">
          Get the fit, skip the fuss.
        </p>

        {error && (
          <p className="mt-5 rounded-xl bg-blush/60 px-4 py-3 text-sm text-ink">
            Sign-in did not finish. Please try again.
          </p>
        )}

        <div className="mt-6 flex justify-center">
          <GoogleButton size="lg" className="w-full" />
        </div>

        <Link
          href="/"
          className="mt-6 inline-block text-sm text-ink/50 hover:text-ink"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
