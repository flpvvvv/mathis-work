import type { Metadata, Viewport } from "next";
import type { PropsWithChildren } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mathis Gallery",
  description: "A public gallery of Mathis\u2019s artwork.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF8F0" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1A2E" },
  ],
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Caprasimo&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <AppProviders>
          <SiteHeader />
          <main id="main-content" className="container-page py-6">
            {children}
          </main>
        </AppProviders>
      </body>
    </html>
  );
}
