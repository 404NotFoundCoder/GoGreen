-- 完成者名單／照片牆：額外回傳個人頭像（users.photo_url，Google 等 OAuth 寫入）
-- dc.photo_url 仍為該日打卡佐證圖

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
  where dc.date = p_date
    and cu.title = p_title
  order by u.nickname;
$$;

grant execute on function public.rpc_leaderboard_template_item_cell_participants(date, uuid) to anon, authenticated;
grant execute on function public.rpc_leaderboard_custom_title_cell_participants(date, text) to anon, authenticated;

-- Google 常把圖片放在 picture；與 avatar_url 一併寫入 public.users.photo_url
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
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
