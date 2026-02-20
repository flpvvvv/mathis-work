# works.mathis.day Launch Checklist

## 1) Project Setup
- [x] Create Supabase project for Mathis Gallery
- [x] Create Vercel project from this repository
- [x] Set production domain to `works.mathis.day`

## 2) Database + Storage
- [x] Run Supabase migration in `supabase/migrations/20260220000100_init_mathis_gallery.sql`
- [x] Confirm tables exist: `profiles`, `works`, `images`, `tags`, `work_tags`
- [x] Confirm bucket exists: `artworks` (public read)
- [x] Confirm RLS policies are enabled and active

## 3) Auth + Admin Access
- [x] In Supabase Auth settings, include callback URL: `https://works.mathis.day/auth/callback`
- [ ] Sign in once with magic link to create a `profiles` row
- [ ] Set `profiles.is_admin = true` manually for admin account(s)

## 4) Environment Variables
Set these in Vercel (Project Settings -> Environment Variables):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 5) DNS
- [x] In DNS provider, add CNAME:
  - Name: `works`
  - Target: `cname.vercel-dns.com`
- [x] Verify Vercel domain status is valid and SSL issued

## 6) Verification (Pre-Launch)
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm test:e2e` (smoke path)

## 7) Smoke Test (Production)
- [ ] Public page loads at `https://works.mathis.day`
- [ ] Grid and Timeline toggle both render data
- [ ] Search, tag filtering, and date filtering return expected results
- [ ] Work detail opens and back navigation preserves gallery state
- [ ] Login sends magic link
- [ ] Admin can create work with image upload
- [ ] Perspective correction flow works on mobile + desktop
- [ ] Admin can edit and delete work

## 8) Design & Brand Verification
- [ ] Inline SVG Logo renders correctly
- [ ] Favicon is properly configured in layout and loaded by browser
- [ ] Neo-brutalist theme toggle works (dark/light mode)
- [ ] CSS-only animations trigger on grid scroll

## 9) Post-Launch
- [ ] Add at least one backup admin account
- [ ] Monitor Vercel logs for 24 hours
- [ ] Monitor Supabase logs for auth/storage policy errors
