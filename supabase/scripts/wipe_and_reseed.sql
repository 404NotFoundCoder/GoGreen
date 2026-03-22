-- =============================================================================
-- 清空 public 業務資料並還原 SDG + 系統預設公版（10 筆 canonical）
--
-- 對照範圍：與 `supabase/migrations/*.sql` 內 **public 業務表**一致，亦涵蓋你從
-- Dashboard 匯出之 12 表（checklist_items / checklist_templates / custom_items /
-- daily_checkins / group_invitations / group_members / groups /
-- push_subscriptions / sdgs / user_daily_custom_items / user_daily_stats / users）。
-- 若日後 migration 新增 public 表，請同步補進下方 TRUNCATE 清單。
--
-- 適用：本機 Supabase / 雲端專案 SQL Editor（須具足夠權限）。
-- 無法復原，執行前請確認環境。
--
-- 本機「整庫重跑 migration」更簡單：專案根目錄執行
--   npx supabase db reset
-- （會一併清空 auth，等同全新環境。）
--
-- 本腳本做完後：
--   - 打卡、群組、自訂行動、public.users 等皆空
--   - auth.users 仍存在 → 登入會出現「有 Auth、無 profile」不一致
--   請接著執行下方「選用：清空登入帳號」或到 Dashboard → Authentication 刪除使用者。
-- =============================================================================

begin;

truncate table
  public.daily_checkins,
  public.user_daily_stats,
  public.user_daily_custom_items,
  public.push_subscriptions,
  public.group_invitations,
  public.group_members,
  public.groups,
  public.custom_items,
  public.checklist_items,
  public.checklist_templates,
  public.users,
  public.sdgs
restart identity cascade;

-- SDG（與 migrations 20260321120000_sdgs_tag_colors 一致）
insert into public.sdgs (id, label, color, text_color) values
  (1, '消除貧窮', '#E5243B18', '#8b0012'),
  (2, '消除飢餓', '#DDA63A18', '#7a4f00'),
  (3, '健康與福祉', '#4C9F3818', '#1e5015'),
  (4, '優質教育', '#C5192D18', '#7a0010'),
  (5, '性別平等', '#FF3A2118', '#991500'),
  (6, '淨水及衛生', '#26BDE218', '#084d6d'),
  (7, '潔淨能源', '#FCC30B18', '#6b4e00'),
  (8, '尊嚴就業', '#A2194218', '#5c0020'),
  (9, '產業創新', '#FD692518', '#8b3000'),
  (10, '減少不平等', '#DD136718', '#7a0035'),
  (11, '永續城鄉', '#FD9D2418', '#7a3d00'),
  (12, '責任消費', '#BF8B2E18', '#5c3a00'),
  (13, '氣候行動', '#3F7E4418', '#1a3d1e'),
  (14, '保育海洋', '#0A97D918', '#084d6d'),
  (15, '保育陸域', '#56C02B18', '#265c0a'),
  (16, '和平正義', '#00689D18', '#003d5c'),
  (17, '全球夥伴', '#19486A18', '#0d2a40')
on conflict (id) do update set
  label = excluded.label,
  color = excluded.color,
  text_color = excluded.text_color;

-- 系統預設範本 + 10 筆公版（與 20260322140000_resync_default_checklist.sql 一致）
insert into public.checklist_templates (id, title, created_by, is_default)
values (
  '00000000-0000-4000-8000-000000000001',
  '系統預設永續行動',
  null,
  true
)
on conflict (id) do update set
  title = excluded.title,
  is_default = true;

insert into public.checklist_items (id, template_id, title, description, sdg_ids, points, "order", is_active)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', '減少剩食，吃多少買/煮多少', '減少食物浪費是負責任消費的核心。同時，珍惜糧食也有助於全球糧食資源的重新分配與永續利用。', array[2,12]::int[], 10, 1, true),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', '確認包裝可回收，確實垃圾分類', '確實的垃圾分類與回收能減少資源消耗，落實循環經濟，同時也能減少廢棄物處理過程中所產生的溫室氣體。', array[12,13]::int[], 10, 2, true),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', '自備水壺，減少使用瓶裝水', '拒絕一次性塑膠產品能直接減少塑膠垃圾的產生，進而降低塑膠微粒流入海洋、危害海洋生態的風險。', array[12,14]::int[], 10, 3, true),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', '用餐自備環保餐具', '減少一次性免洗餐具的依賴，是負責任消費的展現，並能保護陸域與海洋環境。', array[12,14]::int[], 10, 4, true),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', '離開房間隨手關燈關電器', '節約能源能降低對化石燃料的依賴，提高能源使用效率，是減緩全球暖化、落實氣候行動最直接的方法。', array[7,13]::int[], 10, 5, true),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', '淋浴代替泡澡，刷牙時關水', '珍惜水資源，避免不必要的浪費，有助於確保所有人都能享有水資源及其永續管理。', array[6]::int[], 10, 6, true),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', '優先步行、騎車或搭大眾運輸', '使用低碳交通工具能減少城市空氣污染和碳排放，打造永續城市；同時，步行和騎車也能促進自身健康。', array[3,11,13]::int[], 10, 7, true),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', '短距離移動不依賴私人汽機車', '減少燃油車輛的使用，直接有助於降低溫室氣體排放，並改善城市交通與空氣品質。', array[11,13]::int[], 10, 8, true),
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000001', '爬樓梯取代搭電梯', '爬樓梯不僅是一種能增進心肺功能的日常運動，也能節省電梯運作所消耗的電力。', array[3,7]::int[], 10, 9, true),
  ('00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000000001', '自備購物袋，不使用塑膠袋', '從源頭減量是最好的環保。減少塑膠袋使用能大幅降低環境負擔，避免野生動物誤食，保護陸地與海洋的生態系統。', array[12,14,15]::int[], 10, 10, true)
on conflict (id) do update set
  template_id = excluded.template_id,
  title = excluded.title,
  description = excluded.description,
  sdg_ids = excluded.sdg_ids,
  points = excluded.points,
  "order" = excluded."order",
  is_active = excluded.is_active;

commit;

-- -----------------------------------------------------------------------------
-- 選用：連 Supabase Auth 帳號一併清空（開發／測試用，無法復原）
-- 請在上一段 COMMIT 成功後，另開一區塊執行；若權限不足請用 Dashboard。
--
-- delete from auth.users;
--
-- 若報 FK 錯誤，可改試（依 Supabase 版本 schema 可能略有差異）：
-- delete from auth.identities;
-- delete from auth.users;
-- -----------------------------------------------------------------------------
