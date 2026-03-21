-- 根本原因：gm_select 含「OR user_is_member_of_group(group_id)」時，評估「他人」成員列會再進入函式 → 再查 group_members → 再套用 gm_select → 無限遞迴。
-- Supabase 上即使函式設 SET row_security = off，仍可能與預期不符。
-- 解法：group_members 的 SELECT 僅允許讀「本人」列；groups 可讀性改由 groups.g_select 之 EXISTS（見 20260321160000）。
-- 注意：依 group_members 掃全體成員的 view（如 leaderboard_groups）在 RLS 下每位使用者只會看到自己那一列；群組內榜 UI 若需完整成員，應改 SECURITY DEFINER view／RPC。

drop policy if exists gm_select on public.group_members;

create policy gm_select on public.group_members for select using (
  auth.uid() = user_id
);
