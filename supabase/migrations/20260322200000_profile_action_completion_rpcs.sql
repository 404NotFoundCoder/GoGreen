-- 個人頁「各項完成率」：僅統計 auth.uid()，供 Profile 與全體榜 RPC 分離

create or replace function public.rpc_profile_template_item_stats(
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
  achiever_count bigint,
  sdg_ids int[]
)
language sql
security definer
set search_path = public
stable
as $$
  with d as (
    select (p_end - p_start + 1)::int as period_days
  ),
  items as (
    select
      ci.id,
      ci.title,
      coalesce(ci."order", 0)::int as sort_order,
      coalesce(ci.sdg_ids, '{}'::int[]) as sdg_ids
    from public.checklist_items ci
    join public.checklist_templates t on t.id = ci.template_id
    where t.is_default = true
      and coalesce(ci.is_active, true) = true
  ),
  c as (
    select dc.item_id, count(*)::bigint as cnt
    from public.daily_checkins dc
    where dc.user_id = auth.uid()
      and dc.date >= p_start
      and dc.date <= p_end
      and dc.item_id is not null
    group by dc.item_id
  )
  select
    i.id,
    i.title,
    i.sort_order,
    d.period_days,
    1::bigint as active_users,
    coalesce(c.cnt, 0::bigint) as checkin_count,
    case when coalesce(c.cnt, 0::bigint) > 0 then 1::bigint else 0::bigint end as achiever_count,
    i.sdg_ids
  from items i
  cross join d
  left join c on c.item_id = i.id
  order by i.sort_order, i.title;
$$;

grant execute on function public.rpc_profile_template_item_stats(date, date) to authenticated;

create or replace function public.rpc_profile_custom_title_stats(
  p_start date,
  p_end date,
  p_limit int
)
returns table (
  title text,
  on_list_days bigint,
  checkin_count bigint,
  achiever_count bigint,
  sdg_ids int[]
)
language sql
security definer
set search_path = public
stable
as $$
  with chk as (
    select
      cu.title,
      count(*)::bigint as checkin_count,
      1::bigint as achiever_count
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.user_id = auth.uid()
      and dc.date >= p_start
      and dc.date <= p_end
    group by cu.title
  ),
  listed as (
    select
      cu.title,
      count(*)::bigint as on_list_days
    from public.user_daily_custom_items u
    join public.custom_items cu on cu.id = u.custom_item_id
    where u.user_id = auth.uid()
      and u.date >= p_start
      and u.date <= p_end
    group by cu.title
  ),
  merged as (
    select
      coalesce(l.title, c.title) as title,
      coalesce(l.on_list_days, 0::bigint) as on_list_days,
      coalesce(c.checkin_count, 0::bigint) as checkin_count,
      coalesce(c.achiever_count, 0::bigint) as achiever_count
    from listed l
    full outer join chk c on c.title = l.title
  ),
  title_sdgs as (
    select
      z.t as title,
      coalesce(array_agg(distinct z.sid order by z.sid), '{}'::int[]) as sdg_ids
    from (
      select cu.title as t, unnest(coalesce(cu.sdg_ids, '{}'::int[])) as sid
      from public.daily_checkins dc
      join public.custom_items cu on cu.id = dc.custom_item_id
      where dc.user_id = auth.uid()
        and dc.date >= p_start
        and dc.date <= p_end
      union
      select cu.title, unnest(coalesce(cu.sdg_ids, '{}'::int[]))
      from public.user_daily_custom_items u
      join public.custom_items cu on cu.id = u.custom_item_id
      where u.user_id = auth.uid()
        and u.date >= p_start
        and u.date <= p_end
    ) z
    group by z.t
  )
  select
    m.title,
    m.on_list_days,
    m.checkin_count,
    m.achiever_count,
    coalesce(ts.sdg_ids, '{}'::int[]) as sdg_ids
  from merged m
  left join title_sdgs ts on ts.title = m.title
  where m.on_list_days > 0 or m.checkin_count > 0
  order by m.checkin_count desc, m.on_list_days desc, m.title asc
  limit greatest(coalesce(p_limit, 30), 1);
$$;

grant execute on function public.rpc_profile_custom_title_stats(date, date, int) to authenticated;

create or replace function public.rpc_profile_template_item_day_density(
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
  select dc.date, 1::bigint
  from public.daily_checkins dc
  where dc.user_id = auth.uid()
    and dc.item_id = p_item_id
    and dc.date >= p_start
    and dc.date <= p_end
  group by dc.date
  order by dc.date;
$$;

grant execute on function public.rpc_profile_template_item_day_density(date, date, uuid) to authenticated;

create or replace function public.rpc_profile_custom_title_day_density(
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
  where dc.user_id = auth.uid()
    and cu.title = p_title
    and dc.date >= p_start
    and dc.date <= p_end
  group by dc.date
  order by dc.date;
$$;

grant execute on function public.rpc_profile_custom_title_day_density(date, date, text) to authenticated;
