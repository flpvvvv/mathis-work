"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function AdminHeader() {
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  async function handleLogout() {
    setShowLogoutConfirm(false);
    await fetch("/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-none border border-[var(--border)] bg-[var(--surface)] p-4">
        <div>
          <h1 className="font-display text-xl font-bold">Admin</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Manage artworks and metadata.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin/new")}
            className={buttonVariants({ variant: "default" })}
          >
            New Work
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className={buttonVariants({ variant: "outline" })}
          >
            Dashboard
          </button>
          <Button variant="ghost" onClick={() => setShowLogoutConfirm(true)}>
            Logout
          </Button>
        </div>
      </header>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Logout"
        description="Are you sure you want to log out?"
        confirmLabel="Logout"
        variant="destructive"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}
