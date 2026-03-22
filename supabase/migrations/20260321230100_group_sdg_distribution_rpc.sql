-- 群組內 SDG 行動分布（依群組成員打卡）

create or replace function public.rpc_group_sdg_distribution(
  p_group_id uuid,
  p_start date,
  p_end date
)
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
      and dc.user_id in (
        select gm.user_id from public.group_members gm where gm.group_id = p_group_id
      )
    union all
    select unnest(cu.sdg_ids) as sdg_id
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.date >= p_start and dc.date <= p_end
      and dc.user_id in (
        select gm.user_id from public.group_members gm where gm.group_id = p_group_id
      )
  ) x
  where x.sdg_id is not null
  group by x.sdg_id
  order by x.sdg_id;
$$;

grant execute on function public.rpc_group_sdg_distribution(uuid, date, date) to authenticated;
