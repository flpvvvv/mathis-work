# Mathis Gallery Context & Agent Rules

## Project Overview
Mathis Gallery is a web application that displays paintings and artwork. It is deployed at **works.mathis.day** (with the main site at mathis.day).
- **Tech Stack**: Next.js 15 (App Router), React, Tailwind CSS 4, shadcn/ui, pnpm.
- **Backend & Auth**: Supabase (PostgreSQL + Auth + Storage). Vercel for hosting.
- **Key Features**: 
  - Image uploading with a client-side perspective correction (Canvas + `perspective-transform`) tool.
  - Infinite loading grid/timeline views.
  - Filter by tags, date, search by description.
  - Magic link login for Admins to upload/manage artwork.

## Neo-Brutalist Design Constraints
This project strictly follows a **Playful Brutalism** aesthetic, characterized by:
- **Typography**: Caprasimo for headings (chunky, playful, organic) and Outfit for body text (clean, geometric). Avoid generic fonts like Inter, Roboto, or standard system fonts.
- **Colors & Theming**:
  - High-contrast, thick solid black borders (or white in dark mode).
  - Backgrounds: Warm paper cream (`#FFF8F0`) in light mode; Charcoal (`#1A1A2E`) in dark mode.
  - Accents: Bright, bold colors like Bubblegum Pink (`#FF6B6B`), Electric Cyan (`#4ECDC4`), and Sunny Yellow (`#FFE66D`).
- **Shapes & Shadows**: Hard, offset box-shadows (e.g., `4px 4px 0px 0px rgba(0,0,0,1)`).
- **Interactions**: CSS-only staggered animations, hard hover states that translate and increase shadows, scale and slight rotation on cards.

**IMPORTANT**: Avoid typical "AI slop" corporate aesthetics. No soft 1px shadows, no pastel gradients, no safe minimalism. The design must be bold, striking, and structural.

## Image Perspective Correction Pipeline
The app features an advanced image upload flow specifically designed for capturing artwork with a mobile phone:
1. User selects an image.
2. The image is rendered on a canvas where the user can drag 4 corner handles to define the boundaries of the artwork in the photo.
3. Using `perspective-transform`, a homography matrix is computed to warp the selection into a flat rectangle.
4. The output is extracted as an 80% JPEG and uploaded to Supabase Storage in the `artworks` bucket.
5. All images must be served using Next.js `<Image>` pointing to the Supabase Storage URL, with appropriate transformations.

## General Development Rules
- Prefer using `pnpm`.
- Ensure robust error handling using `sonner` toasts (themed to match Neo-Brutalism).
- Use `tsvector` for Supabase Postgres search and adhere to Row Level Security (RLS) setup.
- Always include `use client` where hooks or browser APIs are used. Keep layout/page components as server components when possible.
