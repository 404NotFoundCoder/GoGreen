-- 群組內熱門行動（依群組成員打卡，與 rpc_global_hot_actions 同構但限成員）

create or replace function public.rpc_group_hot_actions(
  p_group_id uuid,
  p_start date,
  p_end date,
  p_limit int
)
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
      and dc.user_id in (
        select gm.user_id from public.group_members gm where gm.group_id = p_group_id
      )
    group by ci.title
    union all
    select cu.title as label, count(*)::bigint as action_count
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.date >= p_start and dc.date <= p_end
      and dc.user_id in (
        select gm.user_id from public.group_members gm where gm.group_id = p_group_id
      )
    group by cu.title
  ) u
  order by u.action_count desc
  limit p_limit;
$$;

grant execute on function public.rpc_group_hot_actions(uuid, date, date, int) to authenticated;
