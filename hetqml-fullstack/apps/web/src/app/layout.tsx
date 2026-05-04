import type { Metadata } from "next";
import "@/styles/hetqml-export.css";
import "@/styles/legacy-overrides.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
