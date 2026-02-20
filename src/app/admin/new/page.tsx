import { WorkEditor } from "@/components/admin/work-editor";

export default function AdminNewWorkPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Create New Work</h2>
      <WorkEditor mode="create" />
    </section>
  );
}
