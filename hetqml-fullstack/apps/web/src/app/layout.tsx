import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@/styles/hetqml-export.css";
import "@/styles/legacy-overrides.css";
// Lite skin — unconditional CSS import so it ships in both builds, but
// every selector is scoped under `html[data-lite="true"]`. The attribute
// is only set in lite mode, so the override is a no-op for the full app.
import "@/styles/lite-theme.css";
import { DashboardModeProvider } from "@/lib/dashboardMode/DashboardModeProvider";
import { LiteThemeProvider } from "@/lib/liteTheme/LiteThemeProvider";
import { isLiteMode } from "@/lib/liteMode";
import { KeyboardShortcuts } from "@/components/shell/KeyboardShortcuts";

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
  // `data-lite` lights up lite-theme.css overrides (cool navy / cyan
  // skin, "DEMO · Hugging Face Space" ribbon, lighter typography).
  // isLiteMode() reads NEXT_PUBLIC_LITE_MODE which Next inlines at
  // build time, so the attribute is constant per build.
  const lite = isLiteMode();
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      data-lite={lite ? "true" : undefined}
      // Initial light/dark default — `LiteThemeProvider` mirrors the
      // persisted choice over this once it hydrates from localStorage.
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
            <>
              <KeyboardShortcuts />
              {children}
            </>
          )}
        </DashboardModeProvider>
      </body>
    </html>
  );
}
