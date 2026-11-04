// Outfi wordmark with a small hanger mark.
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-cream">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 7.5a2.2 2.2 0 1 0-2.2-2.2" />
          <path d="M12 7.5v1.6L3.4 15a1.2 1.2 0 0 0 .7 2.2h15.8a1.2 1.2 0 0 0 .7-2.2L12 9.1" />
        </svg>
      </span>
      <span className="font-display text-2xl leading-none tracking-tight">
        Outfi
      </span>
    </span>
  );
}
