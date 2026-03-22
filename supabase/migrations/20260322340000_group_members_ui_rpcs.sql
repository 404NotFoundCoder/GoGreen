-- 群組頁：成員人數／頭貼暱稱預覽（公開群組任何人可看名單；私人僅成員可看）、群主剔除成員

create or replace function public.rpc_group_member_count(p_group_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select case
    when exists (
      select 1 from public.groups g
      where g.id = p_group_id and g.is_public = true
    ) then (
      select count(*)::int from public.group_members where group_id = p_group_id
    )
    when exists (
      select 1 from public.group_members gm
      where gm.group_id = p_group_id and gm.user_id = auth.uid()
    ) then (
      select count(*)::int from public.group_members where group_id = p_group_id
    )
    else null::integer
  end;
$$;

grant execute on function public.rpc_group_member_count(uuid) to authenticated;

create or replace function public.rpc_group_members_preview(p_group_id uuid)
returns table (
  user_id uuid,
  nickname text,
  photo_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select u.id, u.nickname, u.photo_url
  from public.groups g
  inner join public.group_members gm on gm.group_id = g.id
  inner join public.users u on u.id = gm.user_id
  where g.id = p_group_id
    and (
      g.is_public = true
      or exists (
        select 1 from public.group_members g2
        where g2.group_id = g.id and g2.user_id = auth.uid()
      )
    )
  order by gm.joined_at asc nulls last, u.nickname asc nulls last;
$$;

grant execute on function public.rpc_group_members_preview(uuid) to authenticated;

create or replace function public.rpc_owner_remove_group_member(
  p_group_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id = auth.uid() then
    raise exception 'cannot_remove_self';
  end if;
  if not exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.created_by = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;
  delete from public.group_members
  where group_id = p_group_id and user_id = p_user_id;
end;
$$;

grant execute on function public.rpc_owner_remove_group_member(uuid, uuid) to authenticated;
