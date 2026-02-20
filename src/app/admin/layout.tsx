import Link from "next/link";
import type { PropsWithChildren } from "react";

import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: PropsWithChildren) {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div>
          <h1 className="text-xl font-bold">Admin</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Manage artworks and metadata.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            className="inline-flex h-10 items-center rounded-md border border-[var(--border)] px-4 text-sm"
            href="/admin"
          >
            Dashboard
          </Link>
          <Link
            className="inline-flex h-10 items-center rounded-md border border-[var(--border)] px-4 text-sm"
            href="/admin/new"
          >
            New Work
          </Link>
          <form action="/auth/logout" method="post">
            <button
              className="inline-flex h-10 items-center rounded-md border border-[var(--border)] px-4 text-sm"
              type="submit"
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
