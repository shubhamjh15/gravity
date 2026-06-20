import { cn } from "@/lib/utils";
import Link from "next/link";

/**
 * GRAVITY wordmark. Display font (Anton) + crimson->ember gradient on the
 * letters, with a small orbiting "dot" accent. Used in nav + footer + auth.
 */
export function Logo({
  className,
  href = "/",
  size = "md",
}: {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  } as const;

  return (
    <Link
      href={href as never}
      aria-label="GRAVITY home"
      className={cn(
        "group inline-flex items-center gap-2 font-display tracking-tight select-none",
        sizes[size],
        className,
      )}
    >
      <span className="relative inline-flex">
        {/* the dot — a small ember planet pulling on the wordmark */}
        <span
          aria-hidden
          className="mr-2 inline-block size-2.5 self-center rounded-full bg-[image:var(--gv-grad-accent)] shadow-glow transition-transform duration-500 group-hover:scale-125"
        />
        <span className="gv-text-gradient leading-none">GRAVITY</span>
      </span>
    </Link>
  );
}
