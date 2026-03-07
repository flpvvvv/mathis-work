import { notFound } from "next/navigation";

import { WorkEditor } from "@/components/admin/work-editor";
import { getTagList, getWorkById } from "@/lib/data/works";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditWorkPage({ params }: Props) {
  const { id } = await params;
  const [work, tags] = await Promise.all([getWorkById(id), getTagList()]);

  if (!work) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Edit Work</h2>
      <WorkEditor mode="edit" work={work} availableTags={tags} />
    </section>
  );
}
