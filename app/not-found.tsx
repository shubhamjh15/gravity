import Link from "next/link";
import { Logo } from "@/components/gravity/logo";
import { AuroraBackground } from "@/components/gravity/aurora-background";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 text-center">
      <AuroraBackground />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <Logo size="lg" />
        <p className="font-display text-[24vw] leading-none sm:text-[160px]">
          <span className="gv-text-gradient">404</span>
        </p>
        <p className="max-w-sm text-text-muted">
          This page dropped out of the lobby. Let&apos;s get you back to the
          arena.
        </p>
        <div className="flex gap-3">
          <Button asChild variant="gradient" size="lg">
            <Link href={"/" as never}>Back home</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={"/events" as never}>Browse tournaments</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
