import type { Metadata, Viewport } from "next";
import { Anton, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * GRAVITY typography — deliberately NOT the generic Inter/Geist defaults.
 *  - Anton: heavy condensed display for the wordmark + headings (tournament-poster impact)
 *  - Space Grotesk: characterful geometric grotesk for body
 *  - JetBrains Mono: tabular figures for money, kills, room IDs, stats
 * Each is bound to the CSS variable consumed in globals.css (@theme).
 */
const fontDisplay = Anton({
  variable: "--font-gv-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const fontSans = Space_Grotesk({
  variable: "--font-gv-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-gv-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "GRAVITY — eSports Tournaments & Community",
    template: "%s · GRAVITY",
  },
  description:
    "Run tournaments, compete for cash prize pools, and build communities for the Indian Free Fire, BGMI and PUBG scene.",
  applicationName: "GRAVITY",
  keywords: [
    "esports",
    "tournament",
    "Free Fire",
    "BGMI",
    "PUBG",
    "India",
    "gaming community",
    "prize pool",
  ],
  openGraph: {
    title: "GRAVITY — eSports Tournaments & Community",
    description:
      "Compete for cash prize pools. Run tournaments. Build your community.",
    type: "website",
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#0b0a0c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      // `dark` class lets shadcn .dark snippets work; we are dark-only.
      // data-scroll-behavior smooth is opt-in in Next 16 for SPA nav scroll.
      className={`dark ${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            classNames: {
              toast:
                "!bg-surface-2 !border-line !text-foreground !rounded-lg",
            },
          }}
        />
      </body>
    </html>
  );
}
