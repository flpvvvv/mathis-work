import { NextResponse } from "next/server";

import type { SaveWorkPayload } from "@/lib/admin/work-payload";
import { deleteWork, updateWork } from "@/lib/server/admin-works";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  let payload: SaveWorkPayload;
  try {
    payload = (await request.json()) as SaveWorkPayload;
  } catch {
    return NextResponse.json(
      { message: "Invalid request payload." },
      { status: 400 },
    );
  }

  const result = await updateWork(id, payload);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json(result.data);
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const result = await deleteWork(id);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
