-- 排行榜列：依期間彙總每位使用者曾涵蓋的 SDG 編號（讀取全體 checkins，SECURITY DEFINER）

create or replace function public.rpc_leaderboard_user_sdg_goals(p_start date, p_end date)
returns table (user_id uuid, sdg_ids int[])
language sql
security definer
set search_path = public
stable
as $$
  with x as (
    select dc.user_id, unnest(ci.sdg_ids) as sdg_id
    from public.daily_checkins dc
    join public.checklist_items ci on ci.id = dc.item_id
    where dc.date >= p_start and dc.date <= p_end
    union all
    select dc.user_id, unnest(cu.sdg_ids) as sdg_id
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.date >= p_start and dc.date <= p_end
  )
  select x.user_id, coalesce(array_agg(distinct x.sdg_id order by x.sdg_id), '{}')::int[] as sdg_ids
  from x
  where x.sdg_id is not null
  group by x.user_id;
$$;

grant execute on function public.rpc_leaderboard_user_sdg_goals(date, date) to anon, authenticated;
