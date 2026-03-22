-- 自訂行動（依標題彙總）：完成率分母改為「列入今日清單」人日數（user_daily_custom_items），
-- 分子為該期間內打卡次數。若打卡數大於列入天數（資料異常），分母取兩者較大以免超過 100%。
-- 回傳欄位與舊版不同，需先 drop 再 create。

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
  )
  select
    c.title,
    coalesce(l.on_list_days, 0::bigint) as on_list_days,
    c.checkin_count,
    c.achiever_count
  from chk c
  left join listed l on l.title = c.title
  order by c.checkin_count desc
  limit greatest(coalesce(p_limit, 30), 1);
$$;

grant execute on function public.rpc_leaderboard_custom_title_stats(date, date, int) to anon, authenticated;
