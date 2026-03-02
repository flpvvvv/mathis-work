# CLAUDE.md — Mathis Gallery

## Project Overview

Public gallery webapp for Mathis's artwork at **works.mathis.day**. A neo-brutalist visual style with client-side perspective correction for artwork photos.

- **Stack**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS 4, shadcn/ui, Supabase (Auth + Postgres + Storage), TanStack Query, Vercel
- **Design spec**: `docs/plans/2026-02-20-mathis-gallery-design.md`
- **Package manager**: pnpm

## Architecture

- Public gallery at `/` with Grid and Timeline views, infinite scroll, full-text search, tag and date filters
- Work detail at `/works/[id]` with image carousel
- Admin CRUD behind `/admin/*` (protected via middleware + Supabase Magic Link auth)
- Client-side perspective correction for uploaded photos (Canvas API + `perspective-transform`)

## Neo-Brutalist Design Constraints

This project follows a **Playful Brutalism** aesthetic:

- **Typography**: Caprasimo for headings (chunky, playful), Outfit for body text (clean, geometric). Avoid generic fonts like Inter, Roboto.
- **Colors**:
  - Light mode: Warm paper cream (`#FFF8F0`) background
  - Dark mode: Charcoal (`#1A1A2E`) background
  - Accents: Bubblegum Pink (`#FF6B6B`), Electric Cyan (`#4ECDC4`), Sunny Yellow (`#FFE66D`)
- **Shapes & Shadows**: Hard, offset box-shadows (`4px 4px 0px 0px rgba(0,0,0,1)`), thick solid black borders
- **Styling**: `border-2`, `shadow-[var(--shadow-brutal)]`, `rounded-none`, sharp edges
- **Interactions**: CSS-only staggered animations, hard hover states with translate and increased shadows, scale and slight rotation on cards

**IMPORTANT**: Avoid typical "AI slop" corporate aesthetics. No soft 1px shadows, no pastel gradients, no safe minimalism. Bold, striking, and structural.

## Image Pipeline

1. User selects image → rendered on canvas with 4 draggable corner handles
2. `perspective-transform` computes homography matrix to warp selection into flat rectangle
3. Output extracted as 80% JPEG and uploaded to Supabase Storage bucket `artworks`
4. Storage path: `{work_id}/{image_id}.jpg`
5. **No separate thumbnails in Supabase** — Next.js `<Image>` generates responsive srcset with WebP/AVIF negotiation
6. Gallery grid cards: `priority` for first 4 images (above-fold), `loading="lazy"` for rest
7. Work detail images: `quality={70}` with constrained `sizes` to reduce payload

## SEO & Metadata

- `metadataBase: https://works.mathis.day` in root layout
- Root layout uses title template `%s | Mathis Gallery`
- `/works/[id]` uses `generateMetadata` for dynamic OG/Twitter tags, canonical URL, `article:published_time`
- Dynamic OG image at `/opengraph-image` via `next/og` (edge runtime)
- `/login` has `robots: { index: false, follow: false }`
- `robots.ts` disallows `/admin`, `/api/admin`, `/login`; points to `/sitemap.xml`
- `sitemap.ts` lists all works from Supabase (up to 500 per page)
- Meta descriptions: 120–160 characters; titles: ≥30 characters

## Security Headers

Set in both `next.config.ts` and middleware:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `X-DNS-Prefetch-Control: on`

HTTPS enforced by Vercel (308 redirect). Supabase anon key is intentionally public — audit tools flag it as "leaked secret" but this is a false positive.

## Supabase Setup

- Storage bucket `artworks` must exist (public read, admin write via RLS)
- RLS policies: public SELECT on `works`, `images`, `tags`, `work_tags`; admin INSERT/UPDATE/DELETE on all tables
- `profiles` table auto-created via trigger on auth signup; `is_admin` set manually in Dashboard
- Full-text search index on `works.description` using `tsvector` column `description_tsv`

## Conventions

- Tailwind CSS 4 theme variables in `@theme` block within `globals.css`
- Custom animations must be registered in `@theme` (e.g., `--animate-fade-in-up`) for `motion-safe:` variants to work
- JSX string attributes/text do NOT process JS unicode escapes — use actual characters (`…` not `\u2026`)
- `motion-safe:` / `motion-reduce:` for all animations
- `focus-visible:ring-*` on all interactive elements
- Error messages use explicit user-facing copy (see design spec §9)
- Sonner toasts for non-blocking errors; inline confirmation for destructive actions
- Date/number formatting via `Intl.DateTimeFormat` / `Intl.NumberFormat`
- Every public page should export `metadata` (static) or `generateMetadata` (dynamic)
- `use client` where hooks or browser APIs are used; keep layout/page as server components

## Known Issues / Gotchas

- If gallery shows nothing after upload, check that `animate-fade-in-up` is registered in `@theme` (not just standalone CSS)
- If images don't appear in Storage after upload, verify: (1) `artworks` bucket exists, (2) RLS allows admin uploads, (3) user is authenticated
- `getPublicImageUrl` constructs URLs as `{SUPABASE_URL}/storage/v1/object/public/artworks/{storage_path}`
- Squirrel audit reports "meta tags in body" on pages with `generateMetadata` — known Next.js 19 streaming behavior where browser hoists them to `<head>`. Not fixable from app code; browsers handle correctly
- Squirrel audit "leaked secrets" in minified JS — false positives from minified variable names matching patterns (e.g., `addRef`, `disabl`, `hasInt`)
- Local `squirrel audit` against `localhost` flags HTTPS/sitemap domain mismatches — only audit production for accurate scores

## Quality Checks

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Unit/Integration tests: `pnpm test`
- E2E smoke: `pnpm test:e2e`