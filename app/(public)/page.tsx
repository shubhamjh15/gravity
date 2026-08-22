import { Hero } from "@/components/gravity/landing/hero";
import { getPlatformStats } from "@/lib/data/platform-stats";
import { GamesStrip } from "@/components/gravity/landing/games-strip";
import { Surfaces } from "@/components/gravity/landing/surfaces";
import { HowItWorks } from "@/components/gravity/landing/how-it-works";
import { FinalCta } from "@/components/gravity/landing/final-cta";

/**
 * GRAVITY landing page. Server component composing the cinematic sections;
 * each section owns its own client-side GSAP/Framer animation.
 */
export default async function HomePage() {
  const stats = await getPlatformStats();

  return (
    <>
      <Hero stats={stats} />
      <GamesStrip />
      <Surfaces />
      <HowItWorks />
      <FinalCta />
    </>
  );
}
