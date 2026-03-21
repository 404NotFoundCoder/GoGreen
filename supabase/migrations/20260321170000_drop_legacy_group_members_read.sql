-- 舊版文件曾用 policy 名稱 "members read"，USING 為 group_id IN (SELECT … FROM group_members …)，
-- 會自我參照造成 infinite recursion。
-- 若與 gm_select 並存，PostgreSQL 仍會評估到這條政策 → 錯誤依舊。
-- 請只保留 gm_select（auth.uid() = user_id），或改為 SECURITY DEFINER 函式版本（擇一，勿重複 SELECT 政策）。

drop policy if exists "members read" on public.group_members;
