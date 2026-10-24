import type { PropsWithChildren } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: PropsWithChildren) {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <AdminHeader />
      {children}
    </div>
  );
}
