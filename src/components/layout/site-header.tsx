import Link from "next/link";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";

export async function SiteHeader() {
  const profile = await getCurrentProfile();

  return (
    <header className="border-b-4 border-[var(--border)] bg-[var(--background)] sticky top-0 z-50">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-2xl font-bold font-display uppercase tracking-wider hover:-translate-y-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--border)]">
          <div className="h-8 w-8 relative flex-shrink-0 shadow-[var(--shadow-brutal-sm)]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">
              <rect width="256" height="256" fill="#FFE66D" />
              <rect x="16" y="16" width="224" height="224" fill="#FF6B6B" stroke="black" strokeWidth="16" />
              <path d="M 64 192 V 80 L 128 144 L 192 80 V 192" stroke="black" strokeWidth="24" strokeLinecap="square" strokeLinejoin="miter" fill="none" />
            </svg>
          </div>
          <span className="hidden sm:inline-block mt-1">Mathis Gallery</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {profile?.is_admin ? (
            <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
              Admin
            </Link>
          ) : (
            <Link href="/login" className={buttonVariants({ variant: "outline" })}>
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
