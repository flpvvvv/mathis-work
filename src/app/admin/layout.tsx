import type { PropsWithChildren } from "react";

import { requireAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";

export default async function AdminLayout({ children }: PropsWithChildren) {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <AdminHeader />
      {children}
    </div>
  );
}
