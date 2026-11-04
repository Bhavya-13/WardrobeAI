"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A pop-up that always sits on the SCREEN (not at the bottom of the page).
// It is drawn directly inside <body>, so nothing on the page can push it away.
// On phones it slides up as a bottom sheet. The content scrolls inside it and
// the footer (buttons) stays visible.
export default function Modal({
  children,
  footer,
  label,
  onClose,
  maxWidth = "max-w-md",
}: {
  children: ReactNode;
  footer?: ReactNode;
  label: string;
  onClose?: () => void;
  maxWidth?: string;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind stops scrolling
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onClick={() => closeRef.current?.()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`sheet flex max-h-[92dvh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-3xl bg-cream shadow-xl sm:rounded-3xl`}
      >
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
          {children}
        </div>
        {footer && (
          <div className="border-t border-line bg-cream px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
