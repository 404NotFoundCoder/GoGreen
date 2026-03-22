-- 自訂行動（依標題彙總）：納入「期間內曾列入今日清單但尚無打卡」之標題（完成率 0%），
-- 與僅有打卡、列入人日為 0 之異常列一併以 full outer join 合併。

drop function if exists public.rpc_leaderboard_custom_title_stats(date, date, int);

create function public.rpc_leaderboard_custom_title_stats(
  p_start date,
  p_end date,
  p_limit int
)
returns table (
  title text,
  on_list_days bigint,
  checkin_count bigint,
  achiever_count bigint
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
      count(distinct dc.user_id)::bigint as achiever_count
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.date >= p_start
      and dc.date <= p_end
    group by cu.title
  ),
  listed as (
    select
      cu.title,
      count(*)::bigint as on_list_days
    from public.user_daily_custom_items u
    join public.custom_items cu on cu.id = u.custom_item_id
    where u.date >= p_start
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
  )
  select
    m.title,
    m.on_list_days,
    m.checkin_count,
    m.achiever_count
  from merged m
  where m.on_list_days > 0 or m.checkin_count > 0
  order by m.checkin_count desc, m.on_list_days desc, m.title asc
  limit greatest(coalesce(p_limit, 30), 1);
$$;

grant execute on function public.rpc_leaderboard_custom_title_stats(date, date, int) to anon, authenticated;
