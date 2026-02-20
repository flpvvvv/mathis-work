import { NextResponse } from "next/server";

import { getWorksPage } from "@/lib/data/works";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const query = url.searchParams.get("query") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const tagsParam = url.searchParams.get("tags") ?? "";
  const tags = tagsParam
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const data = await getWorksPage({
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    filters: {
      query,
      from,
      to,
      tags,
    },
  });

  return NextResponse.json(data);
}
