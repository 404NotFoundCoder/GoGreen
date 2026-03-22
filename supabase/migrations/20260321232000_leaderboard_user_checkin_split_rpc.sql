-- 排行榜列：期間內每位使用者公版／自訂打卡次數（SECURITY DEFINER）

create or replace function public.rpc_leaderboard_user_checkin_split(p_start date, p_end date)
returns table (user_id uuid, template_count bigint, custom_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    dc.user_id,
    count(*) filter (where dc.item_id is not null)::bigint as template_count,
    count(*) filter (where dc.custom_item_id is not null)::bigint as custom_count
  from public.daily_checkins dc
  where dc.date >= p_start and dc.date <= p_end
  group by dc.user_id;
$$;

grant execute on function public.rpc_leaderboard_user_checkin_split(date, date) to anon, authenticated;
