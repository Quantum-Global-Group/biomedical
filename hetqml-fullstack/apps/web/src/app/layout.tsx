import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "@/styles/hetqml-export.css";
import "@/styles/legacy-overrides.css";
// Full (non-lite) research chrome — typography + sidebar refinements.
import "@/styles/dashboard-research.css";
// Lite skin — every selector is scoped under `html[data-lite="true"]`.
import "@/styles/lite-theme.css";
import { DashboardModeProvider } from "@/lib/dashboardMode/DashboardModeProvider";
import { AppThemeProvider } from "@/lib/appTheme/AppThemeProvider";
import { LiteThemeProvider } from "@/lib/liteTheme/LiteThemeProvider";
import { isLiteMode } from "@/lib/liteMode";
import { siteDescription, siteTitle } from "@/lib/branding";
import { KeyboardShortcuts } from "@/components/shell/KeyboardShortcuts";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: siteTitle(),
  description: siteDescription(),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lite = isLiteMode();
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${jetbrainsMono.variable} ${sourceSerif.variable}`}
      data-lite={lite ? "true" : undefined}
      data-lite-theme={lite ? "light" : undefined}
    >
      <body>
        <DashboardModeProvider>
          {lite ? (
            <LiteThemeProvider>
              <KeyboardShortcuts />
              {children}
            </LiteThemeProvider>
          ) : (
            <AppThemeProvider>
              <KeyboardShortcuts />
              {children}
            </AppThemeProvider>
          )}
        </DashboardModeProvider>
      </body>
    </html>
  );
}
