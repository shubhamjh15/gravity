import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * <SectionHeading> — the repeated "eyebrow + giant display title + lead" block.
 * One component so every section header looks identical. Eyebrow uses the
 * crimson accent + mono tracking; title uses the display font.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  className,
  as: Title = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <span className="inline-flex items-center gap-2 font-mono text-xs font-medium tracking-[0.2em] text-crimson-400 uppercase">
          <span aria-hidden className="h-px w-6 bg-crimson-500/60" />
          {eyebrow}
        </span>
      ) : null}
      <Title
        className={cn(
          "font-display text-4xl leading-[0.95] tracking-tight text-balance sm:text-5xl lg:text-6xl",
        )}
      >
        {title}
      </Title>
      {lead ? (
        <p
          className={cn(
            "max-w-2xl text-base text-text-muted sm:text-lg",
            align === "center" && "mx-auto",
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}
