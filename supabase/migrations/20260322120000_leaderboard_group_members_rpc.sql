-- 排行榜：在 gm_select 僅能讀「本人」列的前提下，以 RPC 讀取群組完整成員與各群組列榜所需資料（SECURITY DEFINER）。

-- 單一群組：僅當呼叫者為該群成員時回傳該群所有 user_id（供群組內榜、群組圖表）
create or replace function public.rpc_group_member_user_ids(p_group_id uuid)
returns table(user_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select gm.user_id
  from public.group_members gm
  where gm.group_id = p_group_id
    and exists (
      select 1
      from public.group_members self
      where self.group_id = p_group_id
        and self.user_id = auth.uid()
    );
$$;

-- 各群間榜：已登入使用者取得「所有群組」之成員與群組名稱（與原設計一致：榜單需跨群聚合）
create or replace function public.rpc_leaderboard_group_rows()
returns table(
  group_id uuid,
  user_id uuid,
  group_name text,
  is_public boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select g.id, gm.user_id, g.name, g.is_public
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where auth.uid() is not null;
$$;

grant execute on function public.rpc_group_member_user_ids(uuid) to authenticated;
grant execute on function public.rpc_leaderboard_group_rows() to authenticated;
