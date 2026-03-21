-- 每人最多隸屬一個群組（與產品規則一致）；並於 RPC 內先檢查，避免孤兒群組

-- 若已有重複 user_id，只保留最早 joined_at
delete from public.group_members gm
where gm.ctid not in (
  select distinct on (user_id) ctid
  from public.group_members
  order by user_id, joined_at asc nulls last
);

create unique index if not exists group_members_one_group_per_user
  on public.group_members (user_id);

-- 加入公開群組：已加入任一群組則拒絕
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

-- 以邀請碼加入私人
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

-- 信箱邀請：接受時若已在其他群組則拒絕
create or replace function public.respond_group_email_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  jwt_email text;
begin
  select i.* into inv
  from public.group_invitations i
  where i.id = p_invite_id and i.status = 'pending';

  if inv is null then
    raise exception 'invalid_invite';
  end if;

  jwt_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  if jwt_email is null or jwt_email = '' then
    raise exception 'no_email_in_session';
  end if;

  if jwt_email is distinct from lower(trim(inv.invited_email)) then
    raise exception 'email_mismatch';
  end if;

  if p_accept then
    if exists (select 1 from public.group_members where user_id = auth.uid()) then
      raise exception 'already_in_group';
    end if;
    insert into public.group_members (group_id, user_id)
    values (inv.group_id, auth.uid());
    update public.group_invitations
      set status = 'accepted'
      where id = p_invite_id;
  else
    update public.group_invitations
      set status = 'declined'
      where id = p_invite_id;
  end if;
end;
$$;
