-- 群組內「各項完成率／每週紀錄」：僅限同群成員呼叫；統計與熱力僅含該群成員；peer 日快照供唯讀檢視

-- ── 公版：本群活躍人數、打卡次數、達成人數（僅群成員）
create or replace function public.rpc_group_default_template_item_stats(
  p_group_id uuid,
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
  with guard as (
    select true as ok
    from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
    limit 1
  ),
  member_ids as (
    select gm.user_id
    from public.group_members gm
    where gm.group_id = p_group_id
  ),
  d as (
    select (p_end - p_start + 1)::int as period_days
  ),
  participants as (
    select count(distinct uds.user_id)::bigint as u
    from public.user_daily_stats uds
    join member_ids mi on mi.user_id = uds.user_id
    where uds.date >= p_start and uds.date <= p_end
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
    join member_ids mi on mi.user_id = dc.user_id
    where dc.date >= p_start
      and dc.date <= p_end
      and dc.item_id is not null
    group by dc.item_id
  ),
  ach as (
    select dc.item_id, count(distinct dc.user_id)::bigint as cnt
    from public.daily_checkins dc
    join member_ids mi on mi.user_id = dc.user_id
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
    coalesce(ach.cnt, 0::bigint) as achiever_count,
    i.sdg_ids
  from items i
  cross join d
  cross join participants
  cross join guard
  left join c on c.item_id = i.id
  left join ach on ach.item_id = i.id
  where guard.ok
  order by i.sort_order, i.title;
$$;

-- ── 自訂標題（本群）
create or replace function public.rpc_group_custom_title_stats(
  p_group_id uuid,
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
  with guard as (
    select true as ok
    from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
    limit 1
  ),
  member_ids as (
    select gm.user_id
    from public.group_members gm
    where gm.group_id = p_group_id
  ),
  chk as (
    select
      cu.title,
      count(*)::bigint as checkin_count,
      count(distinct dc.user_id)::bigint as achiever_count
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    join member_ids mi on mi.user_id = dc.user_id
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
    join member_ids mi on mi.user_id = u.user_id
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
  ),
  title_sdgs as (
    select
      z.t as title,
      coalesce(array_agg(distinct z.sid order by z.sid), '{}'::int[]) as sdg_ids
    from (
      select cu.title as t, unnest(coalesce(cu.sdg_ids, '{}'::int[])) as sid
      from public.daily_checkins dc
      join public.custom_items cu on cu.id = dc.custom_item_id
      join member_ids mi on mi.user_id = dc.user_id
      where dc.date >= p_start
        and dc.date <= p_end
      union
      select cu.title, unnest(coalesce(cu.sdg_ids, '{}'::int[]))
      from public.user_daily_custom_items u
      join public.custom_items cu on cu.id = u.custom_item_id
      join member_ids mi on mi.user_id = u.user_id
      where u.date >= p_start
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
  cross join guard
  left join title_sdgs ts on ts.title = m.title
  where guard.ok
    and (m.on_list_days > 0 or m.checkin_count > 0)
  order by m.checkin_count desc, m.on_list_days desc, m.title asc
  limit greatest(coalesce(p_limit, 30), 1);
$$;

create or replace function public.rpc_group_template_item_day_density(
  p_group_id uuid,
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
  join public.group_members gm on gm.user_id = dc.user_id and gm.group_id = p_group_id
  where dc.item_id = p_item_id
    and dc.date >= p_start
    and dc.date <= p_end
    and exists (
      select 1 from public.group_members g2
      where g2.group_id = p_group_id and g2.user_id = auth.uid()
    )
  group by dc.date
  order by dc.date;
$$;

create or replace function public.rpc_group_custom_title_day_density(
  p_group_id uuid,
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
  join public.group_members gm on gm.user_id = dc.user_id and gm.group_id = p_group_id
  where cu.title = p_title
    and dc.date >= p_start
    and dc.date <= p_end
    and exists (
      select 1 from public.group_members g2
      where g2.group_id = p_group_id and g2.user_id = auth.uid()
    )
  group by dc.date
  order by dc.date;
$$;

create or replace function public.rpc_group_template_item_cell_participants(
  p_group_id uuid,
  p_date date,
  p_item_id uuid
)
returns table (
  user_id uuid,
  nickname text,
  photo_url text,
  avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    dc.user_id,
    coalesce(u.nickname, '—')::text,
    dc.photo_url,
    u.photo_url
  from public.daily_checkins dc
  join public.users u on u.id = dc.user_id
  join public.group_members gm on gm.user_id = dc.user_id and gm.group_id = p_group_id
  where dc.date = p_date
    and dc.item_id = p_item_id
    and exists (
      select 1 from public.group_members g2
      where g2.group_id = p_group_id and g2.user_id = auth.uid()
    )
  order by u.nickname;
$$;

create or replace function public.rpc_group_custom_title_cell_participants(
  p_group_id uuid,
  p_date date,
  p_title text
)
returns table (
  user_id uuid,
  nickname text,
  photo_url text,
  avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    dc.user_id,
    coalesce(u.nickname, '—')::text,
    dc.photo_url,
    u.photo_url
  from public.daily_checkins dc
  join public.custom_items cu on cu.id = dc.custom_item_id
  join public.users u on u.id = dc.user_id
  join public.group_members gm on gm.user_id = dc.user_id and gm.group_id = p_group_id
  where dc.date = p_date
    and cu.title = p_title
    and exists (
      select 1 from public.group_members g2
      where g2.group_id = p_group_id and g2.user_id = auth.uid()
    )
  order by u.nickname;
$$;

-- 區間內有佐證圖之日期（本群任一成員）
create or replace function public.rpc_group_photo_dates_in_range(
  p_group_id uuid,
  p_start date,
  p_end date
)
returns table (d date)
language sql
security definer
set search_path = public
stable
as $$
  select distinct dc.date
  from public.daily_checkins dc
  join public.group_members gm on gm.user_id = dc.user_id and gm.group_id = p_group_id
  where dc.date >= p_start
    and dc.date <= p_end
    and dc.photo_url is not null
    and length(trim(dc.photo_url)) > 0
    and exists (
      select 1 from public.group_members g2
      where g2.group_id = p_group_id and g2.user_id = auth.uid()
    )
  order by 1;
$$;

-- 同群成員某日清單快照（JSON）；供唯讀 UI
create or replace function public.rpc_group_peer_day_snapshot(
  p_group_id uuid,
  p_peer_user_id uuid,
  p_date date
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case
    when auth.uid() is null then null::jsonb
    when not exists (
      select 1 from public.group_members
      where group_id = p_group_id and user_id = auth.uid()
    ) then null::jsonb
    when not exists (
      select 1 from public.group_members
      where group_id = p_group_id and user_id = p_peer_user_id
    ) then null::jsonb
    else jsonb_build_object(
      'stats',
      (
        select to_jsonb(s)
        from (
          select
            uds.completed_count,
            uds.total_items,
            uds.raw_score,
            uds.normalized_score,
            uds.streak,
            uds.sdg_coverage
          from public.user_daily_stats uds
          where uds.user_id = p_peer_user_id
            and uds.date = p_date
        ) s
      ),
      'items',
      coalesce(
        (
          select jsonb_agg(to_jsonb(i) order by i.sort_order, i.title)
          from (
            select
              ci.id,
              ci.template_id,
              ci.title,
              ci.description,
              ci.sdg_ids,
              ci.points,
              ci.is_active,
              coalesce(ci."order", 0) as sort_order
            from public.checklist_items ci
            where ci.template_id = public.get_user_template_id(p_peer_user_id)
              and coalesce(ci.is_active, true) = true
          ) i
        ),
        '[]'::jsonb
      ),
      'checkins',
      coalesce(
        (
          select jsonb_agg(to_jsonb(c))
          from (
            select dc.item_id, dc.custom_item_id, dc.photo_url
            from public.daily_checkins dc
            where dc.user_id = p_peer_user_id
              and dc.date = p_date
          ) c
        ),
        '[]'::jsonb
      ),
      'custom_items',
      coalesce(
        (
          select jsonb_agg(to_jsonb(x) order by x.title)
          from (
            select
              cu.id,
              cu.title,
              cu.sdg_ids,
              cu.points,
              cu.is_favorite
            from public.user_daily_custom_items u
            join public.custom_items cu on cu.id = u.custom_item_id
            where u.user_id = p_peer_user_id
              and u.date = p_date
          ) x
        ),
        '[]'::jsonb
      )
    )
  end;
$$;

grant execute on function public.rpc_group_default_template_item_stats(uuid, date, date) to authenticated;
grant execute on function public.rpc_group_custom_title_stats(uuid, date, date, int) to authenticated;
grant execute on function public.rpc_group_template_item_day_density(uuid, date, date, uuid) to authenticated;
grant execute on function public.rpc_group_custom_title_day_density(uuid, date, date, text) to authenticated;
grant execute on function public.rpc_group_template_item_cell_participants(uuid, date, uuid) to authenticated;
grant execute on function public.rpc_group_custom_title_cell_participants(uuid, date, text) to authenticated;
grant execute on function public.rpc_group_photo_dates_in_range(uuid, date, date) to authenticated;
grant execute on function public.rpc_group_peer_day_snapshot(uuid, uuid, date) to authenticated;
