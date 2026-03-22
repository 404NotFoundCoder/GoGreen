-- 排行榜分析：全體 SDG 行動次數、熱門行動標題；個人 SDG 分布（僅本人）
-- 需讀取全體 daily_checkins，故使用 SECURITY DEFINER

create or replace function public.rpc_global_sdg_distribution(p_start date, p_end date)
returns table (sdg_id int, action_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select x.sdg_id, count(*)::bigint
  from (
    select unnest(ci.sdg_ids) as sdg_id
    from public.daily_checkins dc
    join public.checklist_items ci on ci.id = dc.item_id
    where dc.date >= p_start and dc.date <= p_end
    union all
    select unnest(cu.sdg_ids) as sdg_id
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.date >= p_start and dc.date <= p_end
  ) x
  where x.sdg_id is not null
  group by x.sdg_id
  order by x.sdg_id;
$$;

create or replace function public.rpc_global_hot_actions(p_start date, p_end date, p_limit int)
returns table (label text, action_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select u.label, u.action_count
  from (
    select ci.title as label, count(*)::bigint as action_count
    from public.daily_checkins dc
    join public.checklist_items ci on ci.id = dc.item_id
    where dc.date >= p_start and dc.date <= p_end
    group by ci.title
    union all
    select cu.title as label, count(*)::bigint as action_count
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.date >= p_start and dc.date <= p_end
    group by cu.title
  ) u
  order by u.action_count desc
  limit p_limit;
$$;

create or replace function public.rpc_my_sdg_distribution(p_start date, p_end date)
returns table (sdg_id int, action_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select x.sdg_id, count(*)::bigint
  from (
    select unnest(ci.sdg_ids) as sdg_id
    from public.daily_checkins dc
    join public.checklist_items ci on ci.id = dc.item_id
    where dc.user_id = auth.uid()
      and dc.date >= p_start and dc.date <= p_end
    union all
    select unnest(cu.sdg_ids) as sdg_id
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.user_id = auth.uid()
      and dc.date >= p_start and dc.date <= p_end
  ) x
  where x.sdg_id is not null
  group by x.sdg_id
  order by x.sdg_id;
$$;

grant execute on function public.rpc_global_sdg_distribution(date, date) to anon, authenticated;
grant execute on function public.rpc_global_hot_actions(date, date, int) to anon, authenticated;
grant execute on function public.rpc_my_sdg_distribution(date, date) to authenticated;
