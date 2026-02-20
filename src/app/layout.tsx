import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mathis Gallery",
  description: "A public gallery of Mathis's artwork.",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html suppressHydrationWarning lang="en">
      <body className="antialiased">
        <AppProviders>
          <SiteHeader />
          <main className="container-page py-6">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
