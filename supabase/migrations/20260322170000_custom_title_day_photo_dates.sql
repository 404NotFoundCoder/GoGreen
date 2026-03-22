-- 自訂標題密度圖：標示「該日至少一筆打卡含佐證圖」的日期（與人次密度分開查）

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
    and dc.photo_url is not null
    and length(trim(dc.photo_url)) > 0
  order by 1;
$$;

grant execute on function public.rpc_leaderboard_custom_title_day_photo_dates(date, date, text) to anon, authenticated;
