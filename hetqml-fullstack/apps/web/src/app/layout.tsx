import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@/styles/hetqml-export.css";
import "@/styles/legacy-overrides.css";
import { DashboardModeProvider } from "@/lib/dashboardMode/DashboardModeProvider";

// Self-hosted, subset, swap fallback so first paint uses the local fallback
// and there is zero CLS when the webfont arrives. Exposed as CSS variables
// so hetqml-export.css can opt in via `font-family: var(--font-sans), …`.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Hetionet · QML",
  description:
    "Define an investigation, produce evidence, and validate quantum/classical model runs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <DashboardModeProvider>{children}</DashboardModeProvider>
      </body>
    </html>
  );
}
