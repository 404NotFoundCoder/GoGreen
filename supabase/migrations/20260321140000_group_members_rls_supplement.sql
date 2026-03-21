-- 若先前已執行舊版 20260321130000（函式未設 row_security off，或 groups 仍用子查詢 group_members），
-- 請執行本檔；與已更新之 20260321130000 內容等價，可安全重複執行。

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
