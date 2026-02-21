import type { MetadataRoute } from "next";

import { getWorksPage } from "@/lib/data/works";

const SITE_URL = "https://works.mathis.day";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    const { items } = await getWorksPage({ page: 1, pageSize: 500 });
    for (const work of items) {
      entries.push({
        url: `${SITE_URL}/works/${work.id}`,
        lastModified: new Date(work.updated_at),
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  } catch {
    // Sitemap still returns the homepage if DB is unavailable
  }

  return entries;
}
