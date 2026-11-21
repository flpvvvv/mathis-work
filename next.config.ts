import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

// The optimizer may only fetch from this project's Storage host: a `*.supabase.co`
// wildcard would let any other Supabase project route its images through us.
const supabaseHostname = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Storage paths embed a fresh image UUID and are never rewritten, so a long
    // TTL is safe. The 4h default re-pulled multi-MB originals from Supabase on
    // every variant expiry, which dominated Storage egress.
    minimumCacheTTL: 2_678_400, // 31 days
    // Every width is a distinct optimizer cache entry, and a cold entry costs
    // one full-size original from Storage. The layouts need 256-384 for grid
    // cards, 640-1080 for a single work, 1920 for the viewer at 1x and 3840 for
    // it at 2x; 1200 is the width social cards request. Keep this list to what
    // the `sizes` props actually resolve to — the defaults advertise 15 widths
    // in every srcset and let crawlers multiply the origin fetches.
    deviceSizes: [640, 1080, 1200, 1920, 3840],
    imageSizes: [64, 128, 256, 384],
    qualities: [70, 75, 90],
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname }]
      : [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
