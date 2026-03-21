-- 群組信箱邀請：受邀者須以相同登入信箱接受／拒絕（見 respond_group_email_invite）

create table if not exists public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);

create unique index if not exists group_invitations_pending_unique
  on public.group_invitations (group_id, lower(trim(invited_email)))
  where status = 'pending';

alter table public.group_invitations enable row level security;

-- 僅透過 RPC（security definer）存取；禁止客戶端直接讀寫
create policy group_invitations_deny_all on public.group_invitations
  for all to public using (false) with check (false);

-- ── 列出目前登入者 JWT 信箱的待處理邀請（須與 invited_email 一致）
create or replace function public.list_my_pending_group_invites()
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  invited_email text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    i.id,
    i.group_id,
    g.name,
    i.invited_email,
    i.created_at
  from public.group_invitations i
  join public.groups g on g.id = i.group_id
  where i.status = 'pending'
    and lower(trim(i.invited_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

grant execute on function public.list_my_pending_group_invites() to authenticated;

-- ── 群組建立者發送信箱邀請（儲存小寫 trim）
create or replace function public.create_group_email_invite(p_group_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text;
  v_id uuid;
begin
  if not exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.created_by = auth.uid()
  ) then
    raise exception 'not_group_creator';
  end if;

  v_norm := lower(trim(p_email));
  if v_norm is null or v_norm = '' then
    raise exception 'invalid_email';
  end if;

  if exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id in (select id from public.users where lower(trim(coalesce(email, ''))) = v_norm)
  ) then
    raise exception 'already_member';
  end if;

  if exists (
    select 1 from public.group_invitations gi
    where gi.group_id = p_group_id
      and gi.status = 'pending'
      and lower(trim(gi.invited_email)) = v_norm
  ) then
    raise exception 'already_invited';
  end if;

  insert into public.group_invitations (group_id, invited_email, invited_by, status)
  values (p_group_id, v_norm, auth.uid(), 'pending')
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_group_email_invite(uuid, text) to authenticated;

-- ── 受邀者接受或拒絕（登入信箱須與 invited_email 一致）
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
    insert into public.group_members (group_id, user_id)
    values (inv.group_id, auth.uid())
    on conflict do nothing;
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

grant execute on function public.respond_group_email_invite(uuid, boolean) to authenticated;
