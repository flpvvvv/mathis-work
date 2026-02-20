# Mathis Gallery

Public gallery web app for showcasing Mathis's artwork at `works.mathis.day`.

## Tech Stack
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- Supabase (Auth, Postgres, Storage)
- TanStack Query

## Getting Started
1. Install dependencies:
   - `pnpm install`
2. Configure environment:
   - `cp .env.example .env.local`
   - Fill in Supabase values
3. Start development:
   - `pnpm dev`

## Quality Checks
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Unit/Integration tests: `pnpm test`
- E2E smoke: `pnpm test:e2e`

## Deployment Notes
- Vercel + custom domain configuration checklist:
  - `docs/deployment/works-mathis-day-launch-checklist.md`
