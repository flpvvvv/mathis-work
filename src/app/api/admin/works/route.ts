import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import type { SaveWorkPayload } from "@/lib/admin/work-payload";
import { createWork } from "@/lib/server/admin-works";

export async function POST(request: Request) {
  let payload: SaveWorkPayload;
  try {
    payload = (await request.json()) as SaveWorkPayload;
  } catch {
    return NextResponse.json(
      { message: "Invalid request payload." },
      { status: 400 },
    );
  }

  const result = await createWork(payload);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  revalidatePath("/");

  return NextResponse.json(result.data, { status: 201 });
}
