-- GoGreen 初始 schema（對應 INSTRUCTIONS.md）
-- 於 Supabase SQL Editor 執行或透過 CLI migrate

-- ── 使用者（對應 auth.users）
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null,
  email       text,
  photo_url   text,
  created_at  timestamptz default now()
);

-- ── SDG
create table if not exists public.sdgs (
  id          int primary key,
  label       text not null,
  color       text not null,   -- 標籤底色：官方色 + 8 位 hex 透明度（…18 ≈ 10%）
  text_color  text not null    -- 標籤文字色（深色，確保對比）
);

-- ── 公版清單範本
create table if not exists public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  created_by  uuid references public.users(id),
  is_default  boolean default false,
  created_at  timestamptz default now()
);

-- ── 清單項目
create table if not exists public.checklist_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid references public.checklist_templates(id) on delete cascade,
  title        text not null,
  description  text,
  sdg_ids      int[] not null default '{}',
  points       int not null default 10,
  is_active    boolean default true,
  "order"      int default 0,
  created_at   timestamptz default now()
);

-- ── 自訂行動
create table if not exists public.custom_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.users(id) on delete cascade,
  title        text not null,
  sdg_ids      int[] not null default '{}',
  points       int not null default 10,
  is_favorite  boolean default false,
  created_at   timestamptz default now()
);

-- ── 今日加入的自訂項目（計入 total_items）
create table if not exists public.user_daily_custom_items (
  user_id        uuid not null references public.users(id) on delete cascade,
  date           date not null,
  custom_item_id uuid not null references public.custom_items(id) on delete cascade,
  primary key (user_id, date, custom_item_id)
);

-- ── 群組
create table if not exists public.groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  is_public    boolean default true,
  invite_code  text unique,
  template_id  uuid references public.checklist_templates(id),
  created_by   uuid references public.users(id),
  created_at   timestamptz default now()
);

-- ── 群組成員
create table if not exists public.group_members (
  group_id    uuid references public.groups(id) on delete cascade,
  user_id     uuid references public.users(id) on delete cascade,
  joined_at   timestamptz default now(),
  primary key (group_id, user_id)
);

create unique index if not exists group_members_one_group_per_user
  on public.group_members (user_id);

-- ── 每日打卡
create table if not exists public.daily_checkins (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.users(id) on delete cascade,
  date             date not null,
  item_id          uuid references public.checklist_items(id),
  custom_item_id   uuid references public.custom_items(id),
  photo_url        text,
  checked_at       timestamptz default now(),
  constraint daily_checkins_one_item check (
    (item_id is not null and custom_item_id is null) or
    (item_id is null and custom_item_id is not null)
  ),
  unique (user_id, date, item_id),
  unique (user_id, date, custom_item_id)
);

-- ── 每日統計
create table if not exists public.user_daily_stats (
  user_id           uuid references public.users(id) on delete cascade,
  date              date not null,
  completed_count   int default 0,
  total_items       int default 0,
  raw_score         int default 0,
  sdg_coverage      int default 0,
  normalized_score  numeric default 0,
  streak            int default 0,
  primary key (user_id, date)
);

-- ── 推播訂閱
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now(),
  unique (user_id, endpoint)
);

-- ── 輔助：取得使用者套用的公版 template_id
create or replace function public.get_user_template_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select g.template_id
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
      where gm.user_id = p_user_id
      order by gm.joined_at asc
      limit 1
    ),
    (select id from public.checklist_templates where is_default = true order by created_at asc limit 1)
  );
$$;

-- ── streak tier 加成（與 constants/scoring.ts 對齊）
create or replace function public.streak_tier_bonus(p_streak int)
returns int
language sql
immutable
as $$
  select case
    when p_streak <= 0 then 0
    when p_streak < 7 then 5
    when p_streak < 14 then 15
    when p_streak < 30 then 30
    else 50
  end;
$$;

-- ── 計算連續天數（以 p_date 為終點，每天至少 1 筆打卡）
create or replace function public.compute_streak_days(p_user_id uuid, p_date date)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d date := p_date;
  n int := 0;
  c int;
begin
  loop
    select count(*) into c
    from public.daily_checkins
    where user_id = p_user_id and date = d;
    if c < 1 then
      exit;
    end if;
    n := n + 1;
    d := d - 1;
    if n > 400 then
      exit;
    end if;
  end loop;
  return n;
end;
$$;

-- ── 重新計算某日 user_daily_stats
create or replace function public.refresh_user_daily_stats(p_user_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template uuid;
  v_total int;
  v_completed int;
  v_raw int;
  v_sdg int;
  v_streak int;
  v_bonus int;
  v_norm numeric;
begin
  v_template := public.get_user_template_id(p_user_id);

  select coalesce(count(*), 0) into v_total
  from public.checklist_items
  where template_id = v_template and is_active = true;

  v_total := v_total + coalesce((
    select count(*) from public.user_daily_custom_items
    where user_id = p_user_id and date = p_date
  ), 0);

  select coalesce(count(*), 0) into v_completed
  from public.daily_checkins
  where user_id = p_user_id and date = p_date;

  select coalesce(sum(
    case
      when dc.item_id is not null then ci.points
      else cu.points
    end
  ), 0) into v_raw
  from public.daily_checkins dc
  left join public.checklist_items ci on ci.id = dc.item_id
  left join public.custom_items cu on cu.id = dc.custom_item_id
  where dc.user_id = p_user_id and dc.date = p_date;

  select coalesce(count(distinct s), 0) into v_sdg
  from (
    select unnest(ci.sdg_ids) as s
    from public.daily_checkins dc
    join public.checklist_items ci on ci.id = dc.item_id
    where dc.user_id = p_user_id and dc.date = p_date
    union
    select unnest(cu.sdg_ids) as s
    from public.daily_checkins dc
    join public.custom_items cu on cu.id = dc.custom_item_id
    where dc.user_id = p_user_id and dc.date = p_date
  ) x;

  v_streak := public.compute_streak_days(p_user_id, p_date);
  v_bonus := public.streak_tier_bonus(v_streak);

  if v_total > 0 then
    v_norm := (v_completed::numeric / v_total::numeric) * 100.0 + v_bonus;
  else
    v_norm := v_bonus;
  end if;

  insert into public.user_daily_stats (
    user_id, date, completed_count, total_items, raw_score, sdg_coverage,
    normalized_score, streak
  )
  values (
    p_user_id, p_date, v_completed, v_total, v_raw, v_sdg, v_norm, v_streak
  )
  on conflict (user_id, date) do update set
    completed_count = excluded.completed_count,
    total_items = excluded.total_items,
    raw_score = excluded.raw_score,
    sdg_coverage = excluded.sdg_coverage,
    normalized_score = excluded.normalized_score,
    streak = excluded.streak;
end;
$$;

create or replace function public.trg_refresh_stats_after_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_user_daily_stats(old.user_id, old.date);
    return old;
  else
    perform public.refresh_user_daily_stats(new.user_id, new.date);
    return new;
  end if;
end;
$$;

drop trigger if exists daily_checkins_refresh_stats on public.daily_checkins;
create trigger daily_checkins_refresh_stats
  after insert or update or delete on public.daily_checkins
  for each row execute function public.trg_refresh_stats_after_checkin();

create or replace function public.trg_refresh_stats_after_daily_custom()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_user_daily_stats(old.user_id, old.date);
    return old;
  else
    perform public.refresh_user_daily_stats(new.user_id, new.date);
    return new;
  end if;
end;
$$;

drop trigger if exists user_daily_custom_refresh on public.user_daily_custom_items;
create trigger user_daily_custom_refresh
  after insert or update or delete on public.user_daily_custom_items
  for each row execute function public.trg_refresh_stats_after_daily_custom();

-- ── 新使用者同步
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, nickname, email, photo_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      '使用者'
    ),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 加入公開群組（每人僅能隸屬一個群組）
create or replace function public.join_public_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.group_members where user_id = auth.uid()) then
    raise exception 'already_in_group';
  end if;
  if not exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.is_public = true
  ) then
    raise exception 'not_public_or_missing';
  end if;
  insert into public.group_members (group_id, user_id)
  values (p_group_id, auth.uid());
end;
$$;

grant execute on function public.join_public_group(uuid) to authenticated;

-- ── 以邀請碼加入私人群組（每人僅能隸屬一個群組）
create or replace function public.join_private_group(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  if exists (select 1 from public.group_members where user_id = auth.uid()) then
    raise exception 'already_in_group';
  end if;
  select id into gid
  from public.groups
  where invite_code = upper(trim(p_code))
    and is_public = false;
  if gid is null then
    raise exception 'invalid_invite';
  end if;
  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid());
  return gid;
end;
$$;

grant execute on function public.join_private_group(text) to authenticated;

-- ── Views
create or replace view public.leaderboard_global as
select
  u.id as user_id,
  u.nickname,
  sum(s.raw_score) as total_score,
  sum(s.completed_count) as total_count,
  max(s.sdg_coverage) as max_sdg_coverage,
  avg(s.normalized_score) as avg_normalized_score,
  sum(case when s.date >= date_trunc('week', (now() at time zone 'Asia/Taipei')::date) then s.raw_score else 0 end) as weekly_score,
  sum(case when s.date >= date_trunc('week', (now() at time zone 'Asia/Taipei')::date) then s.completed_count else 0 end) as weekly_count,
  sum(case when s.date >= date_trunc('month', (now() at time zone 'Asia/Taipei')::date) then s.raw_score else 0 end) as monthly_score,
  max(s.streak) as max_streak
from public.user_daily_stats s
join public.users u on u.id = s.user_id
group by u.id, u.nickname;

create or replace view public.leaderboard_groups as
select
  g.id as group_id,
  g.name,
  g.is_public,
  count(distinct gm.user_id) as member_count,
  avg(lg.avg_normalized_score) as avg_score,
  avg(lg.total_count::numeric) as avg_count,
  max(lg.max_sdg_coverage) as sdg_coverage
from public.groups g
join public.group_members gm on gm.group_id = g.id
join public.leaderboard_global lg on lg.user_id = gm.user_id
group by g.id, g.name, g.is_public;

-- ── RLS
alter table public.users enable row level security;
create policy users_select on public.users for select using (true);
create policy users_self on public.users for all using (auth.uid() = id) with check (auth.uid() = id);

alter table public.sdgs enable row level security;
create policy sdgs_read on public.sdgs for select using (true);

alter table public.checklist_templates enable row level security;
create policy ct_read on public.checklist_templates for select using (true);
create policy ct_insert on public.checklist_templates for insert with check (auth.uid() = created_by);
create policy ct_update on public.checklist_templates for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy ct_delete on public.checklist_templates for delete using (auth.uid() = created_by);

alter table public.checklist_items enable row level security;
create policy ci_read on public.checklist_items for select using (true);
create policy ci_insert on public.checklist_items for insert with check (
  exists (
    select 1 from public.checklist_templates t
    where t.id = template_id and t.created_by = auth.uid()
  )
);
create policy ci_update on public.checklist_items for update using (
  exists (
    select 1 from public.checklist_templates t
    where t.id = template_id and t.created_by = auth.uid()
  )
);
create policy ci_delete on public.checklist_items for delete using (
  exists (
    select 1 from public.checklist_templates t
    where t.id = template_id and t.created_by = auth.uid()
  )
);

alter table public.custom_items enable row level security;
create policy cus_select on public.custom_items for select using (auth.uid() = user_id);
create policy cus_insert on public.custom_items for insert with check (auth.uid() = user_id);
create policy cus_update on public.custom_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy cus_delete on public.custom_items for delete using (auth.uid() = user_id);

alter table public.user_daily_custom_items enable row level security;
create policy udc_select on public.user_daily_custom_items for select using (auth.uid() = user_id);
create policy udc_insert on public.user_daily_custom_items for insert with check (auth.uid() = user_id);
create policy udc_delete on public.user_daily_custom_items for delete using (auth.uid() = user_id);

alter table public.daily_checkins enable row level security;
create policy dc_select on public.daily_checkins for select using (auth.uid() = user_id);
create policy dc_insert on public.daily_checkins for insert with check (auth.uid() = user_id);
create policy dc_update on public.daily_checkins for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dc_delete on public.daily_checkins for delete using (auth.uid() = user_id);

alter table public.user_daily_stats enable row level security;
create policy uds_select on public.user_daily_stats for select using (true);
create policy uds_insert on public.user_daily_stats for insert with check (auth.uid() = user_id);
create policy uds_update on public.user_daily_stats for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.groups enable row level security;
create policy g_select on public.groups for select using (
  is_public = true
  or created_by = auth.uid()
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = groups.id
      and gm.user_id = auth.uid()
  )
);
create policy g_insert on public.groups for insert with check (auth.uid() = created_by);
create policy g_update on public.groups for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy g_delete on public.groups for delete using (auth.uid() = created_by);

alter table public.group_members enable row level security;
-- 僅讀本人列；勿在此政策呼叫 user_is_member_of_group(group_id)，否則評估他人列時會遞迴
create policy gm_select on public.group_members for select using (
  auth.uid() = user_id
);
create policy gm_join_public on public.group_members for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.groups g where g.id = group_id and g.is_public = true)
);
create policy gm_creator_insert on public.group_members for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
);
create policy gm_delete_self on public.group_members for delete using (auth.uid() = user_id);

alter table public.push_subscriptions enable row level security;
create policy ps_select on public.push_subscriptions for select using (auth.uid() = user_id);
create policy ps_insert on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy ps_delete on public.push_subscriptions for delete using (auth.uid() = user_id);

-- ── Seed：SDG（與 constants/sdg.ts 之 SDG_COLORS 一致；color 為半透明底、text_color 為深色字）
insert into public.sdgs (id, label, color, text_color) values
  (1, '消除貧窮', '#E5243B18', '#8b0012'),
  (2, '消除飢餓', '#DDA63A18', '#7a4f00'),
  (3, '健康與福祉', '#4C9F3818', '#1e5015'),
  (4, '優質教育', '#C5192D18', '#7a0010'),
  (5, '性別平等', '#FF3A2118', '#991500'),
  (6, '淨水及衛生', '#26BDE218', '#084d6d'),
  (7, '潔淨能源', '#FCC30B18', '#6b4e00'),
  (8, '尊嚴就業', '#A2194218', '#5c0020'),
  (9, '產業創新', '#FD692518', '#8b3000'),
  (10, '減少不平等', '#DD136718', '#7a0035'),
  (11, '永續城鄉', '#FD9D2418', '#7a3d00'),
  (12, '責任消費', '#BF8B2E18', '#5c3a00'),
  (13, '氣候行動', '#3F7E4418', '#1a3d1e'),
  (14, '保育海洋', '#0A97D918', '#084d6d'),
  (15, '保育陸域', '#56C02B18', '#265c0a'),
  (16, '和平正義', '#00689D18', '#003d5c'),
  (17, '全球夥伴', '#19486A18', '#0d2a40')
on conflict (id) do nothing;

-- ── 系統預設公版 + 範例項目（constants/checklist.ts 可同步）
insert into public.checklist_templates (id, title, created_by, is_default)
values (
  '00000000-0000-4000-8000-000000000001',
  '系統預設永續行動',
  null,
  true
)
on conflict (id) do nothing;

insert into public.checklist_items (id, template_id, title, description, sdg_ids, points, "order")
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', '減少剩食，吃多少買/煮多少', '減少食物浪費是負責任消費的核心。同時，珍惜糧食也有助於全球糧食資源的重新分配與永續利用。', array[2,12]::int[], 10, 1),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', '確認包裝可回收，確實垃圾分類', '確實的垃圾分類與回收能減少資源消耗，落實循環經濟，同時也能減少廢棄物處理過程中所產生的溫室氣體。', array[12,13]::int[], 10, 2),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', '自備水壺，減少使用瓶裝水', '拒絕一次性塑膠產品能直接減少塑膠垃圾的產生，進而降低塑膠微粒流入海洋、危害海洋生態的風險。', array[12,14]::int[], 10, 3),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', '用餐自備環保餐具', '減少一次性免洗餐具的依賴，是負責任消費的展現，並能保護陸域與海洋環境。', array[12,14]::int[], 10, 4),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', '離開房間隨手關燈關電器', '節約能源能降低對化石燃料的依賴，提高能源使用效率，是減緩全球暖化、落實氣候行動最直接的方法。', array[7,13]::int[], 10, 5),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', '淋浴代替泡澡，刷牙時關水', '珍惜水資源，避免不必要的浪費，有助於確保所有人都能享有水資源及其永續管理。', array[6]::int[], 10, 6),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', '優先步行、騎車或搭大眾運輸', '使用低碳交通工具能減少城市空氣污染和碳排放，打造永續城市；同時，步行和騎車也能促進自身健康。', array[3,11,13]::int[], 10, 7),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', '短距離移動不依賴私人汽機車', '減少燃油車輛的使用，直接有助於降低溫室氣體排放，並改善城市交通與空氣品質。', array[11,13]::int[], 10, 8),
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000001', '爬樓梯取代搭電梯', '爬樓梯不僅是一種能增進心肺功能的日常運動，也能節省電梯運作所消耗的電力。', array[3,7]::int[], 10, 9),
  ('00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000000001', '自備購物袋，不使用塑膠袋', '從源頭減量是最好的環保。減少塑膠袋使用能大幅降低環境負擔，避免野生動物誤食，保護陸地與海洋的生態系統。', array[12,14,15]::int[], 10, 10)
on conflict (id) do nothing;

grant execute on function public.get_user_template_id(uuid) to authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.sdgs to anon, authenticated;
grant select on public.checklist_templates to anon, authenticated;
grant select on public.checklist_items to anon, authenticated;
grant select on public.leaderboard_global to anon, authenticated;
grant select on public.leaderboard_groups to anon, authenticated;

-- Realtime：於 Supabase Dashboard → SQL 手動執行（見 INSTRUCTIONS.md）
-- alter publication supabase_realtime add table public.daily_checkins;
-- alter publication supabase_realtime add table public.user_daily_stats;
-- alter publication supabase_realtime add table public.user_daily_custom_items;
