import { WorkEditor } from "@/components/admin/work-editor";
import { getTagList } from "@/lib/data/works";

export default async function AdminNewWorkPage() {
  const tags = await getTagList();

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Create New Work</h2>
      <WorkEditor mode="create" availableTags={tags} />
    </section>
  );
}
