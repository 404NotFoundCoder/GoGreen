-- 單日打卡：多張佐證 URL（photo_urls）；每日備註（user_daily_notes）
-- 佐證判斷：photo_url 非空 OR photo_urls 非空

alter table public.daily_checkins
  add column if not exists photo_urls text[] default null;

create or replace function public.checkin_has_evidence_photo(
  p_photo_url text,
  p_photo_urls text[]
)
returns boolean
language sql
immutable
as $$
  select
    (coalesce(trim(p_photo_url), '') <> '')
    or (p_photo_urls is not null and cardinality(p_photo_urls) > 0);
$$;

-- ── 各項完成率佐證日 RPC（含 photo_urls）
create or replace function public.rpc_leaderboard_custom_title_day_photo_dates(
  p_start date,
  p_end date,
  p_title text
)
returns table (d date)
language sql
security definer
set search_path = public
stable
as $$
  select distinct dc.date::date
  from public.daily_checkins dc
  join public.custom_items cu on cu.id = dc.custom_item_id
  where dc.date >= p_start
    and dc.date <= p_end
    and cu.title = p_title
    and public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls)
  order by 1;
$$;

create or replace function public.rpc_leaderboard_template_item_day_photo_dates(
  p_start date,
  p_end date,
  p_item_id uuid
)
returns table (d date)
language sql
security definer
set search_path = public
stable
as $$
  select distinct dc.date::date
  from public.daily_checkins dc
  where dc.date >= p_start
    and dc.date <= p_end
    and dc.item_id = p_item_id
    and public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls)
  order by 1;
$$;

create or replace function public.rpc_profile_template_item_day_photo_dates(
  p_start date,
  p_end date,
  p_item_id uuid
)
returns table (d date)
language sql
security definer
set search_path = public
stable
as $$
  select distinct dc.date::date
  from public.daily_checkins dc
  where dc.user_id = auth.uid()
    and dc.date >= p_start
    and dc.date <= p_end
    and dc.item_id = p_item_id
    and public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls)
  order by 1;
$$;

create or replace function public.rpc_profile_custom_title_day_photo_dates(
  p_start date,
  p_end date,
  p_title text
)
returns table (d date)
language sql
security definer
set search_path = public
stable
as $$
  select distinct dc.date::date
  from public.daily_checkins dc
  join public.custom_items cu on cu.id = dc.custom_item_id
  where dc.user_id = auth.uid()
    and dc.date >= p_start
    and dc.date <= p_end
    and cu.title = p_title
    and public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls)
  order by 1;
$$;

create or replace function public.rpc_group_template_item_day_photo_dates(
  p_group_id uuid,
  p_start date,
  p_end date,
  p_item_id uuid
)
returns table (d date)
language sql
security definer
set search_path = public
stable
as $$
  select distinct dc.date::date
  from public.daily_checkins dc
  join public.group_members gm on gm.user_id = dc.user_id and gm.group_id = p_group_id
  where dc.date >= p_start
    and dc.date <= p_end
    and dc.item_id = p_item_id
    and public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls)
    and exists (
      select 1 from public.group_members g2
      where g2.group_id = p_group_id and g2.user_id = auth.uid()
    )
  order by 1;
$$;

create or replace function public.rpc_group_custom_title_day_photo_dates(
  p_group_id uuid,
  p_start date,
  p_end date,
  p_title text
)
returns table (d date)
language sql
security definer
set search_path = public
stable
as $$
  select distinct dc.date::date
  from public.daily_checkins dc
  join public.custom_items cu on cu.id = dc.custom_item_id
  join public.group_members gm on gm.user_id = dc.user_id and gm.group_id = p_group_id
  where dc.date >= p_start
    and dc.date <= p_end
    and cu.title = p_title
    and public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls)
    and exists (
      select 1 from public.group_members g2
      where g2.group_id = p_group_id and g2.user_id = auth.uid()
    )
  order by 1;
$$;

create or replace function public.rpc_group_photo_dates_in_range(
  p_group_id uuid,
  p_start date,
  p_end date
)
returns table (d date)
language sql
security definer
set search_path = public
stable
as $$
  select distinct dc.date
  from public.daily_checkins dc
  join public.group_members gm on gm.user_id = dc.user_id and gm.group_id = p_group_id
  where dc.date >= p_start
    and dc.date <= p_end
    and public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls)
    and exists (
      select 1 from public.group_members g2
      where g2.group_id = p_group_id and g2.user_id = auth.uid()
    )
  order by 1;
$$;

-- ── 每日備註（與清單項目分開）
create table if not exists public.user_daily_notes (
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.user_daily_notes enable row level security;

create policy user_daily_notes_select on public.user_daily_notes
  for select using (auth.uid() = user_id);

create policy user_daily_notes_insert on public.user_daily_notes
  for insert with check (auth.uid() = user_id);

create policy user_daily_notes_update on public.user_daily_notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy user_daily_notes_delete on public.user_daily_notes
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_daily_notes to authenticated;
