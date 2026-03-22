-- 全體排行榜：公版項目完成率／熱力密度（SECURITY DEFINER；跨使用者讀 daily_checkins）

create or replace function public.rpc_leaderboard_default_template_item_stats(
  p_start date,
  p_end date
)
returns table (
  item_id uuid,
  title text,
  sort_order int,
  period_days int,
  active_users bigint,
  checkin_count bigint,
  achiever_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with d as (
    select (p_end - p_start + 1)::int as period_days
  ),
  participants as (
    select count(distinct user_id)::bigint as u
    from public.user_daily_stats
    where date >= p_start and date <= p_end
  ),
  items as (
    select ci.id, ci.title, coalesce(ci."order", 0)::int as sort_order
    from public.checklist_items ci
    join public.checklist_templates t on t.id = ci.template_id
    where t.is_default = true
      and coalesce(ci.is_active, true) = true
  ),
  c as (
    select dc.item_id, count(*)::bigint as cnt
    from public.daily_checkins dc
    where dc.date >= p_start
      and dc.date <= p_end
      and dc.item_id is not null
    group by dc.item_id
  ),
  ach as (
    select dc.item_id, count(distinct dc.user_id)::bigint as cnt
    from public.daily_checkins dc
    where dc.date >= p_start
      and dc.date <= p_end
      and dc.item_id is not null
    group by dc.item_id
  )
  select
    i.id,
    i.title,
    i.sort_order,
    d.period_days,
    greatest(participants.u, 0::bigint) as active_users,
    coalesce(c.cnt, 0::bigint) as checkin_count,
    coalesce(ach.cnt, 0::bigint) as achiever_count
  from items i
  cross join d
  cross join participants
  left join c on c.item_id = i.id
  left join ach on ach.item_id = i.id
  order by i.sort_order, i.title;
$$;

create or replace function public.rpc_leaderboard_template_item_day_density(
  p_start date,
  p_end date,
  p_item_id uuid
)
returns table (
  d date,
  participant_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select dc.date, count(distinct dc.user_id)::bigint
  from public.daily_checkins dc
  where dc.item_id = p_item_id
    and dc.date >= p_start
    and dc.date <= p_end
  group by dc.date
  order by dc.date;
$$;

create or replace function public.rpc_leaderboard_template_item_cell_participants(
  p_date date,
  p_item_id uuid
)
returns table (
  user_id uuid,
  nickname text,
  photo_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select dc.user_id, coalesce(u.nickname, '—')::text, dc.photo_url
  from public.daily_checkins dc
  join public.users u on u.id = dc.user_id
  where dc.date = p_date
    and dc.item_id = p_item_id
  order by u.nickname;
$$;

-- 自訂行動：依標題彙總（完成率分母採「區間天數 × 曾打卡人數」估算，見前端說明）
create or replace function public.rpc_leaderboard_custom_title_stats(
  p_start date,
  p_end date,
  p_limit int
)
returns table (
  title text,
  period_days int,
  active_users bigint,
  checkin_count bigint,
  achiever_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with d as (
    select (p_end - p_start + 1)::int as period_days
  ),
  cu as (
    select
      cu.title,
      count(*)::bigint as checkin_count,
      count(distinct dc.user_id)::bigint as achiever_count
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.date >= p_start
      and dc.date <= p_end
    group by cu.title
  ),
  participants as (
    select count(distinct user_id)::bigint as u
    from public.user_daily_stats
    where date >= p_start and date <= p_end
  )
  select
    cu.title,
    d.period_days,
    greatest(participants.u, 0::bigint) as active_users,
    cu.checkin_count,
    cu.achiever_count
  from cu
  cross join d
  cross join participants
  order by cu.checkin_count desc
  limit greatest(coalesce(p_limit, 30), 1);
$$;

create or replace function public.rpc_leaderboard_custom_title_day_density(
  p_start date,
  p_end date,
  p_title text
)
returns table (
  d date,
  checkin_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select dc.date, count(*)::bigint
  from public.daily_checkins dc
  join public.custom_items cu on cu.id = dc.custom_item_id
  where dc.date >= p_start
    and dc.date <= p_end
    and cu.title = p_title
  group by dc.date
  order by dc.date;
$$;

create or replace function public.rpc_leaderboard_custom_title_cell_participants(
  p_date date,
  p_title text
)
returns table (
  user_id uuid,
  nickname text,
  photo_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select dc.user_id, coalesce(u.nickname, '—')::text, dc.photo_url
  from public.daily_checkins dc
  join public.custom_items cu on cu.id = dc.custom_item_id
  join public.users u on u.id = dc.user_id
  where dc.date = p_date
    and cu.title = p_title
  order by u.nickname;
$$;

grant execute on function public.rpc_leaderboard_default_template_item_stats(date, date) to anon, authenticated;
grant execute on function public.rpc_leaderboard_template_item_day_density(date, date, uuid) to anon, authenticated;
grant execute on function public.rpc_leaderboard_template_item_cell_participants(date, uuid) to anon, authenticated;
grant execute on function public.rpc_leaderboard_custom_title_stats(date, date, int) to anon, authenticated;
grant execute on function public.rpc_leaderboard_custom_title_day_density(date, date, text) to anon, authenticated;
grant execute on function public.rpc_leaderboard_custom_title_cell_participants(date, text) to anon, authenticated;
