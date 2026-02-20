"use client";

import type { PropsWithChildren } from "react";
import { Toaster } from "sonner";

import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <QueryProvider>
        {children}
        <Toaster 
          richColors 
          toastOptions={{
            style: {
              borderRadius: '0px',
              border: '2px solid var(--border)',
              boxShadow: 'var(--shadow-brutal-sm)',
            }
          }}
        />
      </QueryProvider>
    </ThemeProvider>
  );
}
