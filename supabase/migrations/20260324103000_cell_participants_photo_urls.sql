-- 完成者清單／照片牆：cell_participants 回傳 photo_urls；群組同侶快照 checkins 含 photo_urls

-- ── Leaderboard cell participants（全體榜）
drop function if exists public.rpc_leaderboard_template_item_cell_participants(date, uuid);
drop function if exists public.rpc_leaderboard_custom_title_cell_participants(date, text);

create or replace function public.rpc_leaderboard_template_item_cell_participants(
  p_date date,
  p_item_id uuid
)
returns table (
  user_id uuid,
  nickname text,
  photo_url text,
  photo_urls text[],
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
    dc.photo_urls,
    u.photo_url
  from public.daily_checkins dc
  join public.users u on u.id = dc.user_id
  where dc.date = p_date
    and dc.item_id = p_item_id
  order by u.nickname;
$$;

create or replace function public.rpc_leaderboard_custom_title_cell_participants(
  p_date date,
  p_title text
)
returns table (
  user_id uuid,
  nickname text,
  photo_url text,
  photo_urls text[],
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
    dc.photo_urls,
    u.photo_url
  from public.daily_checkins dc
  join public.custom_items cu on cu.id = dc.custom_item_id
  join public.users u on u.id = dc.user_id
  where dc.date = p_date
    and cu.title = p_title
  order by u.nickname;
$$;

grant execute on function public.rpc_leaderboard_template_item_cell_participants(date, uuid) to anon, authenticated;
grant execute on function public.rpc_leaderboard_custom_title_cell_participants(date, text) to anon, authenticated;

-- ── Group cell participants
drop function if exists public.rpc_group_template_item_cell_participants(uuid, date, uuid);
drop function if exists public.rpc_group_custom_title_cell_participants(uuid, date, text);

create or replace function public.rpc_group_template_item_cell_participants(
  p_group_id uuid,
  p_date date,
  p_item_id uuid
)
returns table (
  user_id uuid,
  nickname text,
  photo_url text,
  photo_urls text[],
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
    dc.photo_urls,
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
  photo_urls text[],
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
    dc.photo_urls,
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

grant execute on function public.rpc_group_template_item_cell_participants(uuid, date, uuid) to authenticated;
grant execute on function public.rpc_group_custom_title_cell_participants(uuid, date, text) to authenticated;

-- ── 同侶某日打卡列：供唯讀清單顯示多張佐證
drop function if exists public.rpc_group_peer_day_snapshot(uuid, uuid, date);

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
            select dc.item_id, dc.custom_item_id, dc.photo_url, dc.photo_urls
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

grant execute on function public.rpc_group_peer_day_snapshot(uuid, uuid, date) to authenticated;
