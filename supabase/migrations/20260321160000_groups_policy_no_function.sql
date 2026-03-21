-- 移除 groups.g_select 對 user_is_member_of_group() 的依賴（函式內查 group_members 在巢狀查詢／部分情境仍會觸發遞迴）。
-- 改為純 SQL：公開 OR 建立者本人 OR EXISTS（本人成員列）。
-- gm_select 維持「僅本人列」：auth.uid() = user_id

drop policy if exists g_select on public.groups;

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

drop function if exists public.user_is_member_of_group(uuid);
