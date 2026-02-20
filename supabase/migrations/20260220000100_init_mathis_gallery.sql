create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  description text,
  created_date date not null default current_date,
  cover_image_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  storage_path text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  constraint tags_name_normalized check (name = lower(btrim(name)))
);

create table if not exists public.work_tags (
  work_id uuid not null references public.works (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (work_id, tag_id)
);

alter table public.works
  add constraint works_cover_image_fk
  foreign key (cover_image_id)
  references public.images (id)
  on delete set null;

alter table public.works
  add column if not exists description_tsv tsvector
    generated always as (to_tsvector('simple', coalesce(description, ''))) stored;

create index if not exists works_created_date_desc_idx
  on public.works (created_date desc);
create index if not exists tags_name_idx
  on public.tags (name);
create index if not exists work_tags_tag_id_idx
  on public.work_tags (tag_id);
create index if not exists images_work_id_display_order_idx
  on public.images (work_id, display_order);
create index if not exists works_description_tsv_idx
  on public.works using gin (description_tsv);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger set_works_updated_at
before update on public.works
for each row
execute function public.set_updated_at();

create or replace function public.ensure_cover_image_is_in_work()
returns trigger
language plpgsql
as $$
begin
  if new.cover_image_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.images i
    where i.id = new.cover_image_id
      and i.work_id = new.id
  ) then
    raise exception 'cover_image_id must reference an image belonging to the same work';
  end if;

  return new;
end;
$$;

create trigger ensure_cover_image_in_work
before insert or update on public.works
for each row
execute function public.ensure_cover_image_is_in_work();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, coalesce(new.email, ''), false)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = user_id
      and p.is_admin = true
  );
$$;

grant execute on function public.is_admin(uuid) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.works enable row level security;
alter table public.images enable row level security;
alter table public.tags enable row level security;
alter table public.work_tags enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "works_select_public"
on public.works
for select
to anon, authenticated
using (true);

create policy "works_admin_insert"
on public.works
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "works_admin_update"
on public.works
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "works_admin_delete"
on public.works
for delete
to authenticated
using (public.is_admin(auth.uid()));

create policy "images_select_public"
on public.images
for select
to anon, authenticated
using (true);

create policy "images_admin_insert"
on public.images
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "images_admin_update"
on public.images
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "images_admin_delete"
on public.images
for delete
to authenticated
using (public.is_admin(auth.uid()));

create policy "tags_select_public"
on public.tags
for select
to anon, authenticated
using (true);

create policy "tags_admin_insert"
on public.tags
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "tags_admin_update"
on public.tags
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "tags_admin_delete"
on public.tags
for delete
to authenticated
using (public.is_admin(auth.uid()));

create policy "work_tags_select_public"
on public.work_tags
for select
to anon, authenticated
using (true);

create policy "work_tags_admin_insert"
on public.work_tags
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "work_tags_admin_update"
on public.work_tags
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "work_tags_admin_delete"
on public.work_tags
for delete
to authenticated
using (public.is_admin(auth.uid()));

insert into storage.buckets (id, name, public)
values ('artworks', 'artworks', true)
on conflict (id) do update set public = excluded.public;

alter table storage.objects enable row level security;

create policy "artworks_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'artworks');

create policy "artworks_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'artworks'
  and public.is_admin(auth.uid())
);

create policy "artworks_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'artworks'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'artworks'
  and public.is_admin(auth.uid())
);

create policy "artworks_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'artworks'
  and public.is_admin(auth.uid())
);
