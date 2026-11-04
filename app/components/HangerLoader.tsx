// The Outfi hanger, swinging. Used as the loading sign everywhere.

export function HangerSpinner({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`hanger-swing ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 7.5a2.2 2.2 0 1 0-2.2-2.2" />
      <path d="M12 7.5v1.6L3.4 15a1.2 1.2 0 0 0 .7 2.2h15.8a1.2 1.2 0 0 0 .7-2.2L12 9.1" />
    </svg>
  );
}

export default function HangerLoader({
  size = 56,
  label,
  className = "",
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center gap-3 ${className}`}
    >
      <HangerSpinner size={size} className="text-clay" />
      {label ? (
        <p className="text-sm text-ink/60">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
