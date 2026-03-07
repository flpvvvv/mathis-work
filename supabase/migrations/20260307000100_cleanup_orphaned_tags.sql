-- Function to delete orphaned tags (tags with no associated works)
create or replace function public.delete_orphaned_tags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete tags that have no work_tags entries
  delete from public.tags
  where not exists (
    select 1 from public.work_tags where work_tags.tag_id = tags.id
  );
  return null;
end;
$$;

-- Trigger to clean up orphaned tags after work_tags delete
-- This fires AFTER DELETE on work_tags (when work is deleted or tag removed)
drop trigger if exists cleanup_orphaned_tags on public.work_tags;
create trigger cleanup_orphaned_tags
after delete on public.work_tags
for each statement
execute function public.delete_orphaned_tags();

-- Also clean up existing orphaned tags immediately
delete from public.tags
where not exists (
  select 1 from public.work_tags where work_tags.tag_id = tags.id
);