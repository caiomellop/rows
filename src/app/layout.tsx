import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

const geist = localFont({
  src: "../../public/fonts/Geist-Variable.ttf",
  variable: "--font-geist",
  display: "swap",
});

const garamond = localFont({
  src: [
    {
      path: "../../public/fonts/EBGaramond-Variable.ttf",
      style: "normal",
    },
    {
      path: "../../public/fonts/EBGaramond-Italic-Variable.ttf",
      style: "italic",
    },
  ],
  variable: "--font-garamond",
  display: "swap",
});

const figtree = localFont({
  src: "../../public/fonts/Figtree-Variable.ttf",
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rows",
  description: "Portfolio builder with GitHub sync",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${garamond.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-figtree)]">
        {children}
      </body>
    </html>
  );
}
