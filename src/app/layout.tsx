import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";
import { Navbar } from "@/components/Navbar";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

/**
 * Sections 03/04 type (user's Figma "Drone Website"): Inter Tight (variable, 400/500 used) and DM Mono Regular, Latin
 * subsets self-hosted from Google Fonts (OFL) because next/font/google failed to fetch on the Vercel build machine.
 */
const interTight = localFont({ src: "./fonts/InterTight-latin-var.woff2", weight: "100 900", variable: "--font-inter-tight", display: "swap" });
const dmMono = localFont({ src: "./fonts/DMMono-Regular-latin.woff2", weight: "400", variable: "--font-dm-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Raven — medical delivery drone concept",
  description:
    "The road goes around. Raven goes over. A medical delivery drone concept exploring a direct air link from a regional health centre to remote hill clinics.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${interTight.variable} ${dmMono.variable}`}>
      <body className="antialiased">
        <SmoothScroll>
          <Navbar />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
