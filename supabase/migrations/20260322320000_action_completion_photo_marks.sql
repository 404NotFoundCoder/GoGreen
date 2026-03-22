-- 各項完成率：公版項目之「該日至少一筆打卡含佐證圖」日期（與人次密度分開查）

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
    and dc.photo_url is not null
    and length(trim(dc.photo_url)) > 0
  order by 1;
$$;

grant execute on function public.rpc_leaderboard_template_item_day_photo_dates(date, date, uuid) to anon, authenticated;

-- 個人：公版項目
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
    and dc.photo_url is not null
    and length(trim(dc.photo_url)) > 0
  order by 1;
$$;

grant execute on function public.rpc_profile_template_item_day_photo_dates(date, date, uuid) to authenticated;

-- 個人：自訂標題（勿用全體榜 RPC，避免混入他人日期）
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
    and dc.photo_url is not null
    and length(trim(dc.photo_url)) > 0
  order by 1;
$$;

grant execute on function public.rpc_profile_custom_title_day_photo_dates(date, date, text) to authenticated;

-- 群組：公版項目
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
    and dc.photo_url is not null
    and length(trim(dc.photo_url)) > 0
    and exists (
      select 1 from public.group_members g2
      where g2.group_id = p_group_id and g2.user_id = auth.uid()
    )
  order by 1;
$$;

grant execute on function public.rpc_group_template_item_day_photo_dates(uuid, date, date, uuid) to authenticated;

-- 群組：自訂標題
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
    and dc.photo_url is not null
    and length(trim(dc.photo_url)) > 0
    and exists (
      select 1 from public.group_members g2
      where g2.group_id = p_group_id and g2.user_id = auth.uid()
    )
  order by 1;
$$;

grant execute on function public.rpc_group_custom_title_day_photo_dates(uuid, date, date, text) to authenticated;
