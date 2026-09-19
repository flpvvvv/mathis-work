-- Supabase's storage advisor suggests dropping the blanket `artworks_public_read` policy because
-- objects in a public bucket are already served from /storage/v1/object/public/... without RLS.
-- That holds for reads only. Storage still authorises every write with RLS under the caller's
-- role, and its writes read columns back:
--
--   upload (x-upsert: true) -> INSERT INTO storage.objects (...) ON CONFLICT ... DO UPDATE ... RETURNING *
--   delete                  -> DELETE FROM storage.objects WHERE ... RETURNING *
--
-- Postgres applies SELECT policies to `ON CONFLICT DO UPDATE` and to any statement whose
-- RETURNING clause reads relation columns, so without a SELECT policy admin uploads fail with
-- "new row violates row-level security policy" and deletes silently remove 0 rows (leaving
-- orphaned files in the bucket). Public reads stay policy-free; writes need this admin-scoped
-- SELECT policy instead of the anon one, which also stops anonymous bucket listing.

drop policy if exists "artworks_public_read" on storage.objects;
drop policy if exists "artworks_admin_read" on storage.objects;

create policy "artworks_admin_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'artworks'
  and public.is_admin(auth.uid())
);
