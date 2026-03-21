-- 在 Supabase → SQL Editor 執行，檢查「目前遠端」政策是否與專案一致（勿改資料）
-- 若專案與 .env.local 的 NEXT_PUBLIC_SUPABASE_URL 不是同一個，這裡看到的會「成功」但 App 仍錯。

-- 0) 最簡：列出 public.group_members 所有政策（PostgreSQL 15+）
-- 「SELECT」應只有一條（gm_select）；若仍有 "members read" 且 qual 含子查詢 group_members → 請 drop（見 migration 20260321170000）
select * from pg_policies
where schemaname = 'public' and tablename = 'group_members';

-- 1) group_members 上所有 RLS 政策（應只有一個 gm_select，且 USING 僅 auth.uid() = user_id）
select
  pol.polname as policy_name,
  pol.polcmd as cmd,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expr
from pg_policy pol
join pg_class cls on cls.oid = pol.polrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and cls.relname = 'group_members'
order by pol.polname;

-- 2) groups 的 g_select（應含 user_is_member_of_group(id)，不要用子查詢 group_members）
select
  pol.polname,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expr
from pg_policy pol
join pg_class cls on cls.oid = pol.polrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and cls.relname = 'groups'
  and pol.polname = 'g_select';

-- 3) user_is_member_of_group 應已刪除（若仍存在，請執行 20260321160000_groups_policy_no_function.sql）
select
  p.proname,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'user_is_member_of_group';
