"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Global error boundary. Logs the error, shows a friendly recovery screen.
 * Never exposes stack traces to end users (spec §7.8).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this would go to a logger; console keeps it visible in dev.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="font-display text-5xl tracking-tight">
        Something <span className="gv-text-gradient">broke</span>
      </p>
      <p className="max-w-sm text-text-muted">
        An unexpected error occurred. Our team has been notified — try again, or
        head back home.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="gradient" size="lg">
          Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={"/" as never}>Back home</Link>
        </Button>
      </div>
    </div>
  );
}
