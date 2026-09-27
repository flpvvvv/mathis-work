import { NextResponse } from "next/server";

import { getGalleryStats } from "@/lib/data/stats";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const tags = (url.searchParams.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const data = await getGalleryStats({ query, from, to, tags });

  return NextResponse.json(data);
}
