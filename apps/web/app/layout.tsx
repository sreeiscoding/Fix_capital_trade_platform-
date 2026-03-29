import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans, Inconsolata } from "next/font/google";
import type { Metadata } from "next";
import { AppProviders } from "./components/providers/app-providers";
import { ScrollRevealManager } from "./components/providers/scroll-reveal-manager";
import "./globals.css";

const fontSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap"
});

const fontSecondary = Inconsolata({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-secondary",
  display: "swap"
});

const fontHeading = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-heading",
  display: "swap"
});

export const metadata: Metadata = {
  title: "FixCapital",
  description: "Copy trading, no-code bots, and AI trading analytics on top of Deriv."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${fontSans.variable} ${fontMono.variable} ${fontSecondary.variable} ${fontHeading.variable}`}>
        <AppProviders>
          <ScrollRevealManager />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
