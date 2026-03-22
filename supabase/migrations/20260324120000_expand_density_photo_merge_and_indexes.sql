-- 各項完成率「展開列」效能：索引 + 單次掃描合併 RPC（密度 + 佐證日），減半往返與重複讀 daily_checkins

-- ── 索引（若已存在同名則略過）
create index if not exists idx_daily_checkins_item_id_date
  on public.daily_checkins (item_id, date)
  where item_id is not null;

create index if not exists idx_daily_checkins_custom_item_id_date
  on public.daily_checkins (custom_item_id, date)
  where custom_item_id is not null;

create index if not exists idx_daily_checkins_user_id_item_id_date
  on public.daily_checkins (user_id, item_id, date)
  where item_id is not null;

create index if not exists idx_custom_items_title
  on public.custom_items (title);

-- ── 全體榜：公版
create or replace function public.rpc_leaderboard_template_item_day_density_and_photo_dates(
  p_start date,
  p_end date,
  p_item_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with base as (
    select
      dc.date::date as d,
      dc.user_id,
      public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls) as has_ev
    from public.daily_checkins dc
    where dc.item_id = p_item_id
      and dc.date >= p_start
      and dc.date <= p_end
  ),
  dens as (
    select d, count(distinct user_id)::bigint as participant_count
    from base
    group by d
  ),
  phot as (
    select distinct d
    from base
    where has_ev
  )
  select jsonb_build_object(
    'density',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('d', d, 'participant_count', participant_count)
          order by d
        )
        from dens
      ),
      '[]'::jsonb
    ),
    'photo_dates',
    coalesce(
      (select jsonb_agg(d order by d) from phot),
      '[]'::jsonb
    )
  );
$$;

-- ── 全體榜：自訂標題
create or replace function public.rpc_leaderboard_custom_title_day_density_and_photo_dates(
  p_start date,
  p_end date,
  p_title text
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with base as (
    select
      dc.date::date as d,
      dc.user_id,
      public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls) as has_ev
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.date >= p_start
      and dc.date <= p_end
      and cu.title = p_title
  ),
  dens as (
    select d, count(*)::bigint as checkin_count
    from base
    group by d
  ),
  phot as (
    select distinct d
    from base
    where has_ev
  )
  select jsonb_build_object(
    'density',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('d', d, 'checkin_count', checkin_count)
          order by d
        )
        from dens
      ),
      '[]'::jsonb
    ),
    'photo_dates',
    coalesce(
      (select jsonb_agg(d order by d) from phot),
      '[]'::jsonb
    )
  );
$$;

-- ── 個人：公版
create or replace function public.rpc_profile_template_item_day_density_and_photo_dates(
  p_start date,
  p_end date,
  p_item_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with base as (
    select
      dc.date::date as d,
      public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls) as has_ev
    from public.daily_checkins dc
    where dc.user_id = auth.uid()
      and dc.item_id = p_item_id
      and dc.date >= p_start
      and dc.date <= p_end
  ),
  dens as (
    select d, 1::bigint as participant_count
    from base
    group by d
  ),
  phot as (
    select distinct d
    from base
    where has_ev
  )
  select jsonb_build_object(
    'density',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('d', d, 'participant_count', participant_count)
          order by d
        )
        from dens
      ),
      '[]'::jsonb
    ),
    'photo_dates',
    coalesce(
      (select jsonb_agg(d order by d) from phot),
      '[]'::jsonb
    )
  );
$$;

-- ── 個人：自訂標題
create or replace function public.rpc_profile_custom_title_day_density_and_photo_dates(
  p_start date,
  p_end date,
  p_title text
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with base as (
    select
      dc.date::date as d,
      public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls) as has_ev
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.user_id = auth.uid()
      and dc.date >= p_start
      and dc.date <= p_end
      and cu.title = p_title
  ),
  dens as (
    select d, count(*)::bigint as checkin_count
    from base
    group by d
  ),
  phot as (
    select distinct d
    from base
    where has_ev
  )
  select jsonb_build_object(
    'density',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('d', d, 'checkin_count', checkin_count)
          order by d
        )
        from dens
      ),
      '[]'::jsonb
    ),
    'photo_dates',
    coalesce(
      (select jsonb_agg(d order by d) from phot),
      '[]'::jsonb
    )
  );
$$;

-- ── 群組：公版
create or replace function public.rpc_group_template_item_day_density_and_photo_dates(
  p_group_id uuid,
  p_start date,
  p_end date,
  p_item_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with guard as (
    select exists (
      select 1
      from public.group_members g
      where g.group_id = p_group_id
        and g.user_id = auth.uid()
    ) as ok
  ),
  base as (
    select
      dc.date::date as d,
      dc.user_id,
      public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls) as has_ev
    from public.daily_checkins dc
    join public.group_members gm on gm.user_id = dc.user_id and gm.group_id = p_group_id
    cross join guard
    where guard.ok
      and dc.item_id = p_item_id
      and dc.date >= p_start
      and dc.date <= p_end
  ),
  dens as (
    select d, count(distinct user_id)::bigint as participant_count
    from base
    group by d
  ),
  phot as (
    select distinct d
    from base
    where has_ev
  )
  select jsonb_build_object(
    'density',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('d', d, 'participant_count', participant_count)
          order by d
        )
        from dens
      ),
      '[]'::jsonb
    ),
    'photo_dates',
    coalesce(
      (select jsonb_agg(d order by d) from phot),
      '[]'::jsonb
    )
  );
$$;

-- ── 群組：自訂標題
create or replace function public.rpc_group_custom_title_day_density_and_photo_dates(
  p_group_id uuid,
  p_start date,
  p_end date,
  p_title text
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with guard as (
    select exists (
      select 1
      from public.group_members g
      where g.group_id = p_group_id
        and g.user_id = auth.uid()
    ) as ok
  ),
  base as (
    select
      dc.date::date as d,
      dc.user_id,
      public.checkin_has_evidence_photo(dc.photo_url, dc.photo_urls) as has_ev
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    join public.group_members gm on gm.user_id = dc.user_id and gm.group_id = p_group_id
    cross join guard
    where guard.ok
      and dc.date >= p_start
      and dc.date <= p_end
      and cu.title = p_title
  ),
  dens as (
    select d, count(*)::bigint as checkin_count
    from base
    group by d
  ),
  phot as (
    select distinct d
    from base
    where has_ev
  )
  select jsonb_build_object(
    'density',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('d', d, 'checkin_count', checkin_count)
          order by d
        )
        from dens
      ),
      '[]'::jsonb
    ),
    'photo_dates',
    coalesce(
      (select jsonb_agg(d order by d) from phot),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.rpc_leaderboard_template_item_day_density_and_photo_dates(date, date, uuid) to anon, authenticated;
grant execute on function public.rpc_leaderboard_custom_title_day_density_and_photo_dates(date, date, text) to anon, authenticated;
grant execute on function public.rpc_profile_template_item_day_density_and_photo_dates(date, date, uuid) to authenticated;
grant execute on function public.rpc_profile_custom_title_day_density_and_photo_dates(date, date, text) to authenticated;
grant execute on function public.rpc_group_template_item_day_density_and_photo_dates(uuid, date, date, uuid) to authenticated;
grant execute on function public.rpc_group_custom_title_day_density_and_photo_dates(uuid, date, date, text) to authenticated;
