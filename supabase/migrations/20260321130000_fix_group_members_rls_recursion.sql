-- 修正 group_members SELECT 政策自我參照造成的 infinite recursion。
-- 原政策：group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
-- 在評估子查詢時會再次套用 gm_select，形成遞迴。

-- 函式內關閉 row_security，確保 Supabase 上內層 SELECT 不會再套用 gm_select（否則仍會遞迴）
create or replace function public.user_is_member_of_group(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
stable
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id = auth.uid()
  );
$$;

grant execute on function public.user_is_member_of_group(uuid) to authenticated;

drop policy if exists g_select on public.groups;

create policy g_select on public.groups for select using (
  is_public = true
  or public.user_is_member_of_group(id)
);

drop policy if exists gm_select on public.group_members;

create policy gm_select on public.group_members for select using (
  auth.uid() = user_id
);
