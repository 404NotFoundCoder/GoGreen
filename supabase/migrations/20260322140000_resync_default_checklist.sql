-- 將系統公版還原為 migration 20260321000000 之 10 筆 canonical 項目。
-- 背景：
--   1) initial seed 使用 on conflict do nothing，已存在之列不會被新文案覆寫。
--   2) 若有多個 checklist_templates.is_default = true，排行榜 rpc 會合併列出多組「公版」項目。
--   3) 同一預設範本下若曾手動新增其他 item，仍會一併出現。
-- 此 migration：僅保留 UUID …0001 為預設範本、upsert 十筆、停用同範本之非 canonical 項目。

-- 僅允許系統預設範本為 is_default（與 constants/checklist.ts DEFAULT_TEMPLATE_ID 一致）
update public.checklist_templates
set is_default = false
where id <> '00000000-0000-4000-8000-000000000001'::uuid;

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

-- 同範本下非下列 10 個 id 者：停用（保留列與打卡 FK，僅自 UI／排行榜統計隱藏）
update public.checklist_items
set is_active = false
where template_id = '00000000-0000-4000-8000-000000000001'::uuid
  and id not in (
    '00000000-0000-4000-8000-000000000101'::uuid,
    '00000000-0000-4000-8000-000000000102'::uuid,
    '00000000-0000-4000-8000-000000000103'::uuid,
    '00000000-0000-4000-8000-000000000104'::uuid,
    '00000000-0000-4000-8000-000000000105'::uuid,
    '00000000-0000-4000-8000-000000000106'::uuid,
    '00000000-0000-4000-8000-000000000107'::uuid,
    '00000000-0000-4000-8000-000000000108'::uuid,
    '00000000-0000-4000-8000-000000000109'::uuid,
    '00000000-0000-4000-8000-000000000110'::uuid
  );

-- 十筆公版：與 20260321000000_initial.sql 一致；衝突時覆寫文案／排序／分數／SDG
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

-- 無群組使用者：優先使用固定 UUID 之系統預設範本，避免多個 is_default 時挑錯列
create or replace function public.get_user_template_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select g.template_id
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
      where gm.user_id = p_user_id
      order by gm.joined_at asc
      limit 1
    ),
    (
      select id
      from public.checklist_templates
      where id = '00000000-0000-4000-8000-000000000001'::uuid
      limit 1
    ),
    (
      select id
      from public.checklist_templates
      where is_default = true
      order by created_at asc
      limit 1
    )
  );
$$;
