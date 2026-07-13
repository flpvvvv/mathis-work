import Link from "next/link";
import type { PropsWithChildren } from "react";

import { requireAdmin } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";

export default async function AdminLayout({ children }: PropsWithChildren) {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-none border border-[var(--border)] bg-[var(--surface)] p-4">
        <div>
          <h1 className="text-xl font-bold">Admin</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Manage artworks and metadata.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/new"
            className={buttonVariants({ variant: "default" })}
          >
            New Work
          </Link>
          <Link
            href="/admin"
            className={buttonVariants({ variant: "outline" })}
          >
            Dashboard
          </Link>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className={buttonVariants({ variant: "ghost" })}
            >
              Logout
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
