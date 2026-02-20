# Mathis Gallery — Design Specification

> A public gallery webapp to showcase Mathis's paintings and artwork.
> Deployed at **works.mathis.day**

---

## 1. Overview

A responsive webapp where visitors can browse Mathis's artwork in Grid or Timeline views. Admin users (authenticated via Magic Link) can upload, edit, and delete works. Each piece of work supports multiple images with a client-side perspective-correction tool for straightening photos taken at angles.

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router) | Server components, Vercel-native |
| UI library | shadcn/ui + Tailwind CSS | Accessible primitives, easy to theme |
| Auth | Supabase Magic Link | Passwordless, simple |
| Database | Supabase Postgres | Auth + DB + Storage in one platform |
| Image storage | Supabase Storage | Integrated with auth/RLS |
| Perspective correction | Client-side Canvas API | Instant preview, no server cost |
| Image quality | JPEG 80% | Good balance of quality vs. file size |
| Package manager | pnpm | Per project requirement |
| Hosting | Vercel | Per project requirement |

---

## 2. Domain & Deployment

- **Gallery**: `works.mathis.day` — new Vercel project, custom subdomain
- **Main site**: `mathis.day` — existing GitHub Pages site (unchanged)
- **DNS setup**: Add a CNAME record for `works` pointing to `cname.vercel-dns.com`

---

## 3. Data Model

### 3.1 Tables

#### `profiles`

Extends Supabase Auth. Created automatically via trigger on user signup.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | References `auth.users.id` |
| `email` | `text` | From auth |
| `is_admin` | `boolean` | Default `false`, set manually in Supabase |
| `created_at` | `timestamptz` | Default `now()` |

#### `works`

Each piece of artwork.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Default `gen_random_uuid()` |
| `description` | `text` | Optional |
| `created_date` | `date` | When the artwork was created (not the record). Default: current date |
| `cover_image_id` | `uuid` FK → `images.id` | Nullable until images are added |
| `created_at` | `timestamptz` | Record creation timestamp |
| `updated_at` | `timestamptz` | Auto-updated via trigger |

#### `images`

One or more images per work.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Default `gen_random_uuid()` |
| `work_id` | `uuid` FK → `works.id` | ON DELETE CASCADE |
| `storage_path` | `text` | Path in Supabase Storage (final image) |
| `width` | `integer` | Pixel width of the final image |
| `height` | `integer` | Pixel height of the final image |
| `display_order` | `integer` | For ordering images within a work. Default `0` |
| `created_at` | `timestamptz` | |

#### `tags`

Unique tag names.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Default `gen_random_uuid()` |
| `name` | `text` | Unique, lowercased, trimmed |
| `created_at` | `timestamptz` | |

#### `work_tags`

Junction table.

| Column | Type | Notes |
|---|---|---|
| `work_id` | `uuid` FK → `works.id` | ON DELETE CASCADE |
| `tag_id` | `uuid` FK → `tags.id` | ON DELETE CASCADE |
| | | PK on `(work_id, tag_id)` |

### 3.2 Row Level Security (RLS)

| Table | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `works` | Public (anon) | Admin only (`profiles.is_admin = true`) |
| `images` | Public (anon) | Admin only |
| `tags` | Public (anon) | Admin only |
| `work_tags` | Public (anon) | Admin only |
| `profiles` | Own row only | Trigger-managed (no direct writes) |

### 3.3 Indexes

- `works.created_date` DESC — default sort
- `tags.name` — tag lookup and autocomplete
- `work_tags.tag_id` — filter works by tag
- `works` full-text search index on `description` using `tsvector`

### 3.4 Storage Buckets

Bucket: **`artworks`** (public read, admin write via RLS)

```
artworks/
  {work_id}/{image_id}.jpg    ← final image (JPEG 80%), either corrected or uploaded as-is
```

Thumbnails are served on the fly via Supabase Image Transformations URL parameters (e.g., `?width=400&height=400&resize=cover`).

---

## 4. Authentication & Authorization

### 4.1 Flow

1. Admin navigates to login page
2. Enters email address
3. Supabase sends a magic link email
4. Clicking the link redirects to `works.mathis.day/auth/callback`
5. Session is persisted (stays logged in until explicit logout)
6. Admin status is checked via the `profiles.is_admin` column

### 4.2 Admin Management

No admin management UI. To grant admin access:
1. User signs up via magic link (creates a `profiles` row with `is_admin = false`)
2. Go to Supabase Dashboard → Table Editor → `profiles`
3. Set `is_admin = true` for the user

### 4.3 Session Handling

- Use Supabase Auth helpers for Next.js (SSR-compatible)
- Middleware checks auth state for `/admin/*` routes
- Session refresh handled automatically by Supabase client
- Explicit logout button in the admin header

---

## 5. Image Pipeline

### 5.1 Upload Flow

```
User selects image (camera or gallery)
  → User chooses: "Correct Perspective" or "Use As-Is"
  → If correcting:
      → Image loaded into PerspectiveCorrector component
      → User places 4 corner markers on the painting edges
      → Live preview of the corrected rectangle
      → User confirms
      → Canvas exports corrected image as JPEG (80% quality)
  → If skipping:
      → Image re-encoded as JPEG (80% quality) for consistency
  → Final image uploaded to `artworks/{work_id}/{image_id}.jpg`
  → Image record created in `images` table with dimensions
```

### 5.2 Perspective Correction (Client-side)

**How it works:**

1. Display the uploaded photo on an HTML Canvas
2. Overlay 4 draggable corner handles (initialized near image corners)
3. User drags handles to the 4 corners of the painting in the photo
4. Compute a homography matrix mapping the quadrilateral to a rectangle
5. Render the corrected image on a second canvas in real-time as preview
6. On confirm, export the corrected canvas as a JPEG blob at 80% quality

**Implementation approach:**

- Use the `perspective-transform` package for the homography math
- Two canvases: source (with drag handles) and preview (corrected output)
- Touch-friendly drag handles for mobile use (large hit targets, visual feedback)
- "Reset" button to restart corner placement
- "Skip" button to use the image as-is (re-encoded to JPEG 80% for consistent quality/size)

### 5.3 Image Serving

| Context | Source | Size |
|---|---|---|
| Grid thumbnail | Supabase Image Transform | `?width=400&resize=contain` |
| Timeline thumbnail | Supabase Image Transform | `?width=600&resize=contain` |
| Detail view | Processed image (full) | Original processed dimensions |
| Lightbox / zoom | Processed image (full) | Original processed dimensions |

All images served via Next.js `<Image>` component for automatic `srcset`, lazy loading, and format negotiation.

---

## 6. Frontend Architecture

### 6.1 Routes

| Route | Access | Description |
|---|---|---|
| `/` | Public | Gallery home (Grid/Timeline views) |
| `/works/[id]` | Public | Single work detail with image carousel |
| `/login` | Public | Magic link login form |
| `/auth/callback` | Public | Handles magic link redirect |
| `/admin` | Admin | Admin dashboard — manage works |
| `/admin/new` | Admin | Create a new work (upload, correct, tag) |
| `/admin/works/[id]/edit` | Admin | Edit an existing work |

### 6.2 Gallery Page (`/`)

**Header:**
- Logo + site name
- View mode toggle (Grid / Timeline)
- Theme toggle (dark/light)
- Search bar (expands on tap in mobile)
- Login/Admin button (top right)

**Filter bar (below header):**
- Tag chips — horizontally scrollable, tap to toggle
- Date filter — optional, year/month picker
- Clear filters button

**Grid view:**
- Responsive masonry-style grid (2 cols mobile, 3 tablet, 4-5 desktop)
- Each card: cover image thumbnail, date overlay, tag chips (max 2 + overflow)
- Tap/click opens the work detail page
- Infinite scroll — load 20 works per batch, trigger on scroll near bottom

**Timeline view:**
- Vertical scroll grouped by month/year (e.g., "February 2026")
- Each group: month/year header, then a horizontal scroll strip of thumbnails
- Tapping a thumbnail opens the work detail page
- Lazy load groups as user scrolls down

**Search:**
- Text input searches `description` via Postgres full-text search (`tsvector`)
- Combined with active tag filters and date range
- Debounced input (300ms) triggers search
- Results update in-place in the current view mode

### 6.3 Work Detail Page (`/works/[id]`)

- Full-width image (or carousel if multiple images)
- Swipe between images on mobile, arrow buttons on desktop
- Cover image shown first
- Below the image: created date, description, tag chips
- Admin sees: Edit and Delete buttons
- Back button returns to gallery (preserves scroll position and filters)

### 6.4 Admin — New Work (`/admin/new`)

Step-by-step flow:

1. **Upload images** — drag & drop or tap to select (camera/gallery on mobile). Support multiple images.
2. **Perspective correction** — for each image, show the PerspectiveCorrector. "Skip" option available.
3. **Set details** — date picker (default: today), description text area, tag input with autocomplete.
4. **Pick cover image** — if multiple images, tap one to set as cover. Default: first image.
5. **Save** — uploads images, creates work record, redirects to the new work's detail page.

### 6.5 Admin — Edit Work (`/admin/works/[id]/edit`)

- Same form as "New Work" but pre-filled
- Can add/remove images, re-run perspective correction
- Can change cover image, date, description, tags
- Delete work (with confirmation dialog)

### 6.6 Login Page (`/login`)

- Email input + "Send Magic Link" button
- Success state: "Check your email for the login link"
- Error state: clear error message
- If already logged in, redirect to `/admin`

---

## 7. View Modes

### 7.1 Grid View

- Default view
- Masonry layout using CSS `columns` or a lightweight masonry library
- Cards have a subtle border-radius and shadow
- Hover effect on desktop: slight scale + shadow increase
- Tap feedback on mobile: brief opacity change
- Sorted by `created_date` DESC (newest first)

### 7.2 Timeline View

- Grouped by month and year
- Section headers styled as date markers on a vertical line (left edge)
- Within each month: horizontal scrollable row of thumbnail cards
- The vertical line acts as a visual timeline spine
- Sorted chronologically (newest at top)

### 7.3 View Mode Persistence

- View mode choice stored in `localStorage`
- Defaults to Grid on first visit
- Toggle is a segmented control in the header

---

## 8. Design System

### 8.1 Visual Direction

**Warm & playful** — friendly and inviting, celebrating a child's creativity without being childish. Clean layouts let the artwork be the star.

### 8.2 Color Palette

| Role | Light Mode | Dark Mode |
|---|---|---|
| Background | Warm cream `#FFF8F0` | Charcoal `#1A1A2E` |
| Surface | White `#FFFFFF` | Dark slate `#242440` |
| Primary | Coral `#FF6B6B` | Coral `#FF6B6B` |
| Secondary | Soft teal `#4ECDC4` | Soft teal `#4ECDC4` |
| Accent | Golden yellow `#FFE66D` | Golden yellow `#FFE66D` |
| Text primary | Dark brown `#2D2D2D` | Warm white `#F5F0EB` |
| Text secondary | Medium brown `#6B5B4F` | Muted cream `#B8AFA6` |
| Border | Light tan `#E8DDD3` | Dark border `#3A3A5C` |

### 8.3 Typography

- **Headings**: Nunito (Google Fonts) — rounded, friendly, playful
- **Body**: Inter (Google Fonts) — clean, highly readable
- **Scale**: fluid type using `clamp()` for responsive sizing

### 8.4 Spacing & Layout

- 8px base grid
- Content max-width: 1280px (centered)
- Mobile padding: 16px
- Card border-radius: 12px
- Consistent shadow: `0 2px 8px rgba(0,0,0,0.08)` (light), `0 2px 8px rgba(0,0,0,0.3)` (dark)

### 8.5 Logo

AI-generated creative logo fitting the warm & playful aesthetic. Used in the header and as favicon. Should work at small sizes (favicon 32x32) and larger (header ~40px height).

### 8.6 Dark/Light Mode

- Toggle button in the header (sun/moon icon)
- Default: follows system preference via `prefers-color-scheme`
- User override stored in `localStorage`
- Tailwind `dark:` variant classes for all themed elements

---

## 9. Error Handling

All errors display explicit user-facing messages per the requirement:

| Scenario | Message |
|---|---|
| Image upload fails | "Failed to upload image. Please try again." |
| Work save fails | "Could not save the work. Please check your connection and try again." |
| Magic link send fails | "Failed to send login link. Please check your email address." |
| Auth session expired | "Your session has expired. Please log in again." |
| Work not found | "This work could not be found. It may have been removed." |
| Network error | "Connection lost. Please check your internet and try again." |
| Permission denied | "You don't have permission to perform this action." |
| Image too large | "Image is too large. Please use an image under 20MB." |
| Perspective correction fails | "Could not process the image. Please try again or skip correction." |

Implementation:
- Use a global toast/notification system (shadcn/ui `Sonner` or `Toast`)
- Errors are non-blocking toasts for recoverable errors
- Full-page error states for 404 / critical failures
- All API calls wrapped in try/catch with user-friendly messages

---

## 10. Performance

### 10.1 Lazy Loading

- Infinite scroll on the gallery: load 20 works per batch
- `IntersectionObserver` triggers next batch when user nears the bottom
- Images use native `loading="lazy"` via Next.js `<Image>`
- Skeleton placeholders shown while images load

### 10.2 Image Optimization

- All processed images stored as JPEG at 80% quality
- Thumbnails served via Supabase Image Transformations (no pre-generation needed)
- Next.js `<Image>` generates responsive `srcset` and serves modern formats (WebP/AVIF) when supported
- Blur placeholder generated from a tiny base64 thumbnail (stored in `images` table or generated at build time)

### 10.3 Caching

- Supabase Storage assets served with CDN caching headers
- Next.js static generation for public gallery pages where practical
- Client-side: React Query for data caching and deduplication
- `stale-while-revalidate` pattern for gallery data

---

## 11. Tech Stack Summary

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI components | shadcn/ui |
| Styling | Tailwind CSS 4 |
| Auth | Supabase Auth (Magic Link) |
| Database | Supabase Postgres |
| Storage | Supabase Storage |
| Data fetching | React Query (TanStack Query) |
| Image correction | HTML Canvas + `perspective-transform` |
| Hosting | Vercel |
| Package manager | pnpm |
| Linting | ESLint + Prettier |

---

## 12. Scope Boundaries

### In scope (v1)

- Public gallery with Grid and Timeline views
- Admin CRUD for works (upload, edit, delete)
- Client-side perspective correction
- Multi-image support per work with cover image selection
- Tag management with autocomplete
- Full-text search on descriptions + tag/date filtering
- Infinite scroll with lazy loading
- Magic Link authentication
- Dark/light theme
- Responsive design (mobile-first)
- Logo and favicon
- Error messages for all failure states
- AGENTS.md for Cursor context

### Out of scope (future)

- PWA / offline support
- Social sharing / Open Graph previews (could add later)
- Comments or likes from visitors
- Batch upload
- Image editing beyond perspective correction (crop, rotate, filters)
- Multi-language support
- Analytics dashboard
- Email notifications
