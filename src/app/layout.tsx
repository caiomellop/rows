import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

// Type roles (see docs/landing-design-spec.md §1):
// EB Garamond: every heading. Geist: wordmark + subtitles/eyebrows. Figtree: everything else.
// Self-hosted variable fonts in src/fonts (WOFF2, subset to Latin + Latin Extended).
const garamond = localFont({
  variable: "--font-garamond",
  src: [
    { path: "../fonts/EBGaramond-VariableFont_wght.woff2", weight: "400 800", style: "normal" },
    { path: "../fonts/EBGaramond-Italic-VariableFont_wght.woff2", weight: "400 800", style: "italic" },
  ],
  fallback: ["Georgia", "serif"],
});

const geist = localFont({
  variable: "--font-geist-sans",
  src: [{ path: "../fonts/Geist-VariableFont_wght.woff2", weight: "100 900", style: "normal" }],
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const figtree = localFont({
  variable: "--font-figtree",
  src: [
    { path: "../fonts/Figtree-VariableFont_wght.woff2", weight: "300 900", style: "normal" },
    { path: "../fonts/Figtree-Italic-VariableFont_wght.woff2", weight: "300 900", style: "italic" },
  ],
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://rows.so"),
  title: "Rows",
  description: "Portfolio builder with GitHub sync",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${garamond.variable} ${geist.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
