import { notFound } from "next/navigation";

import { WorkEditor } from "@/components/admin/work-editor";
import { getWorkById } from "@/lib/data/works";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditWorkPage({ params }: Props) {
  const { id } = await params;
  const work = await getWorkById(id);

  if (!work) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Edit Work</h2>
      <WorkEditor mode="edit" work={work} />
    </section>
  );
}
