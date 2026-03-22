# GoGreen — 開發指南

> 本文件是專案的核心開發規範與活文件。
> **每當新增功能、建立新檔案、調整架構或修改常數，都必須同步更新本文件。**
> **若有重要更動**（例如：資料庫 schema／RLS／migration、使用者可見功能、計分與排行榜規則、認證流程），**一律**在合併前更新本文件對應章節並於 **Changelog** 記錄，避免規格與實作脫節。
> 後人應能只讀這份文件，就理解整個專案的結構、設計決策與脈絡。

---

## 目錄

1. [專案概述](#專案概述)
2. [技術棧選擇與理由](#技術棧選擇與理由)
3. [設計系統](#設計系統)
4. [路由與登入保護（已實作）](#路由與登入保護已實作)
5. [系統功能規格](#系統功能規格)
6. [分數系統設計](#分數系統設計)
7. [排行榜設計](#排行榜設計)
8. [架構原則](#架構原則)
9. [分層職責說明](#分層職責說明)
10. [常數定義規範](#常數定義規範)
11. [資料庫規範（Supabase）](#資料庫規範supabase)
12. [Realtime 規範](#realtime-規範)
13. [PWA 規範](#pwa-規範)
14. [推播通知規範](#推播通知規範)
15. [UI/UX 與多裝置規範](#uiux-與多裝置規範)
16. [開發者文件維護規範](#開發者文件維護規範)
17. [環境變數](#環境變數)
18. [Commit 訊息規範](#commit-訊息規範)
19. [Changelog](#changelog)

---

## 專案概述

**GoGreen** 是一個基於聯合國 17 個 SDG 永續發展目標的每日行動檢核 web app。
使用者每天完成公版行動或自訂行動累積分數，可加入群組與他人互相比較、激勵。

核心價值：把永續行動遊戲化，讓「做環保」變成每天想打開的習慣。

功能仍在規劃與討論中，本文件隨開發推進持續補充。
標示 `[done]` 為已實作、`[planned]` 為確定要做、`[tbd]` 為待決定。

**`[done]` 使用規則（必守）**：功能**大項**僅在該大項底下**所有**子需求皆已實作時，大項標題才可標 `[done]`；否則大項標題改為 **`部分完成`** 或 **`[進行中]`**，並將每一子項分別標上 `[done]` / `[planned]` / `[未實作]`。禁止出現「子項未做完，大項卻 `[done]`」的情況。

---

## 技術棧選擇與理由

| 層級          | 工具                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| 框架          | Next.js 16（App Router）；生產建置使用 `next build --webpack`（與 PWA 相容） |
| UI            | React 19、Tailwind CSS 4                                                     |
| 資料庫 / 認證 | Supabase（PostgreSQL + Auth）                                                |
| 狀態管理      | React Context + `hooks/`                                                     |
| PWA           | `@ducanh2912/next-pwa`（見 [PWA 規範](#pwa-規範)）                           |
| 儲存          | Supabase Storage（`checkin-photos`；已完成項目可上傳／檢視佐證 `[done]`）    |
| 部署          | Vercel（建議）                                                               |

### 為什麼選 Supabase 而非 Firebase

本專案的資料天生是關聯式的（使用者、群組、行動項目、每日打卡），且有以下需求：

- 排行榜需要**多維度同時排序**（分數、完成數、SDG 覆蓋、加權積分）
- 群組間排名需要**聚合計算**（群組平均分）
- 跨表關聯查詢頻繁

以上在 Firestore（NoSQL）都需要大量冗餘存儲才能達成，維護成本高。
Supabase（PostgreSQL）用 SQL View 或單一查詢即可解決，日後擴充也更彈性。

```sql
-- 多維度排行榜範例，單一查詢搞定
SELECT
  u.nickname,
  s.normalized_score,
  s.completed_count,
  s.sdg_coverage,
  RANK() OVER (ORDER BY s.normalized_score DESC) AS score_rank,
  RANK() OVER (ORDER BY s.completed_count DESC)  AS count_rank,
  RANK() OVER (ORDER BY s.sdg_coverage DESC)     AS sdg_rank
FROM user_period_stats s
JOIN users u ON u.id = s.user_id
WHERE s.period = 'week'
```

---

## 設計系統

> ⚠️ 修改任何顏色或設計 token 時，請同步更新此處並在 Changelog 記錄。

### 色盤

GoGreen 使用兩組互補的橄欖綠 / 大地色系，整合成一套完整設計系統。

**底層 UI 色（中性大地調，用於背景、面板、分隔線）**

| Token                 | Hex       | 用途                            |
| --------------------- | --------- | ------------------------------- |
| `--color-bg`          | `#F3F4EF` | 頁面底色                        |
| `--color-surface`     | `#E7E8DC` | 卡片、面板背景                  |
| `--color-surface-mid` | `#CFD5BD` | 輸入框、次要背景、skeleton      |
| `--color-muted`       | `#B3BA98` | 分隔線、border、disabled 狀態   |
| `--color-subtle`      | `#97A177` | 次要文字、輔助標籤、placeholder |

**主色系（飽和橄欖綠，用於互動元素、強調、品牌）**

| Token                    | Hex       | 用途                                 |
| ------------------------ | --------- | ------------------------------------ |
| `--color-primary-light`  | `#E9F5DB` | 完成狀態背景、選中高亮、success 淺色 |
| `--color-primary-pale`   | `#CFE1B9` | hover 背景、tag 背景                 |
| `--color-primary-mid`    | `#B5C99A` | 次要按鈕、非 active 圖示             |
| `--color-primary`        | `#97A97C` | 主要互動元素（勾選、進度條）         |
| `--color-primary-strong` | `#87986A` | 主要按鈕、active 狀態                |
| `--color-primary-dark`   | `#718355` | hover 按鈕、強調 border              |

**文字與通用**

| Token                   | Hex       | 用途                         |
| ----------------------- | --------- | ---------------------------- |
| `--color-ink`           | `#3d4535` | 主要文字（加深以確保對比度） |
| `--color-ink-secondary` | `#5e6b52` | 次要文字、說明文字           |
| `--color-white`         | `#F9F9F6` | Modal、最亮背景              |

### 使用規則

- **禁止任何漸變色（gradient）**，所有背景使用純色
- 文字放在有色背景上時，必須使用同色系的深色（`--color-primary-dark` 或 `--color-ink`），不用純黑
- 互動反饋優先使用 `--color-primary-light` 作為高亮背景
- 卡片統一使用 `--color-surface` 背景 + `--color-muted` border（0.5px）
- 頁面底色固定 `--color-bg`，不在 component 層覆蓋

### CSS Variables 定義位置

所有 token 在 `app/globals.css` 的 `:root` 統一定義：

```css
:root {
  /* 底層 UI 色 */
  --color-bg: #f3f4ef;
  --color-surface: #e7e8dc;
  --color-surface-mid: #cfd5bd;
  --color-muted: #b3ba98;
  --color-subtle: #97a177;

  /* 主色系 */
  --color-primary-light: #e9f5db;
  --color-primary-pale: #cfe1b9;
  --color-primary-mid: #b5c99a;
  --color-primary: #97a97c;
  --color-primary-strong: #87986a;
  --color-primary-dark: #718355;

  /* 文字 */
  --color-ink: #3d4535;
  --color-ink-secondary: #5e6b52;
  --color-white: #f9f9f6;
}
```

### SDG Tag 顏色

**單一來源（前端）：** 畫面上所有 SDG 標籤配色與文案以 **`constants/sdg.ts` 的 `SDG_COLORS`** 為準——背景為聯合國官方色加上 8 位 hex 透明度（`…18` 約 10%），`text` 為對應深色，`label` 為簡短中文。`components/ui/SdgTag.tsx` 預設僅顯示 `SDG N`，傳 **`showLabel`** 可一併顯示中文；`ChecklistStampCard`／`ChecklistRow` 可傳 **`sdgShowLabel`**（預設 `true`）。不套用主色系。

**為什麼資料庫還有 `public.sdgs`？** 目前 **沒有任何 Next.js 程式碼** 向 Supabase 讀取 `sdgs` 來渲染 UI；清單與打卡只存 `sdg_ids`（整數陣列）。表中的 `label`／`color`／`text_color` 是早期 schema／seed 預留，方便在 **SQL、報表、未來後台** 用同一套語意對照；與常數並存會造成「兩份要維護」的負擔。原則：**要改標籤外觀只改 `constants/sdg.ts`**；若希望 DB 與部署後台一致，再手動跑 migration 或之後改為「只從 API 讀 `sdgs`、刪掉常數」擇一即可。

---

## 路由與登入保護（已實作）

| 路徑             | 說明                                      |
| ---------------- | ----------------------------------------- |
| `/`              | 首頁（未登入；玩法說明、**Google 登入 CTA** `HomeGoogleStartButton`）；OAuth 失敗回 **`/?error=auth`** 時由 **`HomeAuthErrorBanner`** 顯示「登入失敗，請重試。」；**已登入**則 **`app/page.tsx` 伺服端 `getUser()`** 與 **`(app)/layout` 同源**，直接 **`redirect('/today')`**（**勿**再用客戶端 `getSession()` 導向，以免與伺服端不一致造成循環）。**無 `/login` 路由。** |
| `/auth/callback` | Supabase OAuth callback：`code` 換取 session 成功則導向 `next`（預設 `/today`）；失敗或無 `code` 則 **`redirect('/?error=auth')`**。 |
| `/today`         | 今日檢核（需登入）；可選 **`?date=yyyy-MM-dd`**（UTC+8 曆日，≤ 今日）由 **`TodayPageClient`** 讀取並餵 **`TodayChecklist`**／**`useTodayChecklist`** |
| `/leaderboard`   | 排行榜：全體／群組內／各群間／個人（需登入） |
| `/groups`        | 群組（需登入）                            |
| `/profile`       | 個人：`ProfileForm`（暱稱）；`ProfileAnalyticsShell`（`LeaderboardPeriodBar`、`ProfileChartsSection`：**五卡**、**分數表＋SDG**、**`ProfileRecordsSection`**〔分頁：各項完成率／每週紀錄、填寫紀錄〕）（需登入） |

**登入保護：** `app/(app)/layout.tsx` 為 Server Component，使用 `lib/supabase/server.ts` 的 `createClient()` 呼叫 `supabase.auth.getUser()`；未登入則 **`redirect('/')`**（首頁）。**未使用** 根目錄 `middleware.ts`（若日後改為 Edge Middleware 保護路由，請同步更新本節）。

**Supabase Dashboard：** Authentication → URL Configuration 之 **Redirect URLs** 須包含 `{SITE_URL}/auth/callback`；**不需**再登記已移除之 `/login`。

**對應程式：**

- **Hooks（`hooks/`）**：`useTodayChecklist`（**參數**：選定曆日 `yyyy-MM-dd`）、`useGlobalLeaderboard`、`useGlobalLeaderboardCharts`、`useGlobalActionCompletionStats`、`useProfileActionCompletionStats`（個人頁各項完成率）、`useGroupMemberLeaderboard`、`useGroupsLeaderboard`、`usePersonalLeaderboard`、`useGroupLeaderboardCharts`、`useGroupPeriodStats`、`useGroups`、`useProfile`（完整檔名見「分層職責說明」）
- **Supabase 封裝（`lib/supabase/`）**：`client.ts`（瀏覽器）、`server.ts`（伺服器）、`checklist.ts`、`stats.ts`、`users.ts`、`groups.ts`、`leaderboard.ts`、`leaderboardAnalytics.ts`

---

## 系統功能規格

### 主畫面 — 今日檢核 `部分完成`

- `[done]` 顯示當日公版行動清單（依使用者範本；群組專屬公版清單規格見「公版清單管理」）
- `[done]` 每項可 toggle 勾選；左側**蓋章互動**：未完成為虛線空圓；點擊完成時 **lucide-react `Leaf`**（與 `BrandMark` logo 同圖示）自上方落下（旋轉／scale 彈跳，約 **280ms**）、同時漣漪（#87986A，約 **380ms**）、8 顆粒子自章心散開（主色隨機，約 **0.32–0.48s**）、整列 **spring** 位移（右 8px → 左 4px → 歸位，約 **320ms**）；完成態背景 `#E9F5DB`、邊框 `#97A97C`、標題 `#718355` 與刪除線由左往右劃滿；再點可取消勾選、還原虛線圓與初始樣式
- `[done]` 完成約一半時頂部**深色膠囊** toast 滑入「🌱 已完成一半！繼續加油」（約 2.5s 後收起）；**全部完成**時：約 **280ms** 後以 **DOM 彩帶**（`confettiFall`，約 60 片）→ 約 **850ms** 後全螢幕慶祝 overlay（`rgba(233,245,219,0.95)`、**`Leaf` 圖示**、`fadeIn`／`bounceIn`／`slideUp`）；overlay 顯示後 **1500ms** 自動關閉，亦可按「太棒了」提前關閉；`prefers-reduced-motion: reduce` 時略過彩帶、直接顯示 overlay；**全完成慶祝（撒花＋overlay）僅在使用者本次勾選／取消後再勾選，剛好由「未全滿」變成「全滿」且 API 成功時觸發**（`fullCompletionCelebrationTick`）；**初次載入若已全完成**則不播放慶祝動畫，僅顯示清單下方「今日全部完成」內聯提示
- `[done]` 頂部統計：進度條軌 `#CFD5BD`、填色 `#87986A`、高度 6px、`width` 過渡 **0.4s** `cubic-bezier(0.34, 1.56, 0.64, 1)`；今日得分數字 bump 動畫；連續天數 tier 徽章底色 `#FAEEDA`、字色 `#854F0B`；**無**右上角「⋯」選單（已移除）
- `[done]` 支援 **`/today?date=yyyy-MM-dd`**（UTC+8 曆日、≤ 今日）：**`app/(app)/today/TodayPageClient.tsx`**（`Suspense` + `useSearchParams`）→ **`TodayChecklist`**／**`useTodayChecklist(selectedDate)`**
- `[done]` 已完成項目可上傳佐證照片（檔案選擇）至 Storage，並寫入 `daily_checkins.photo_url`；可點縮圖或「檢視大圖」以 **`ImageLightbox`** 全螢幕瀏覽（Esc／點背景關閉）
- `[tbd]` 拖曳上傳佐證檔案（目前僅檔案選擇）
- `[done]` **自訂行動與常用收藏**為**單一卡片**（`#gg-custom-favorites-section`）：頂部標題列說明 → 上段「新增項目」（`AddCustomForm` `embedded`）→ 分隔線 → 下段「常用收藏」（`FavoritesPanel` `embedded`、背景略區隔）；避免兩張獨立全寬卡片重複邊框
- `[done]` 每日午夜重置（時區：UTC+8），重置時間定義為常數 `DAILY_RESET_HOUR`

### 公版清單管理 `[planned]`

> **後台／群組管理 UI 尚未實作**（逐筆維護、CSV 上傳）；與「創群時選範本」同列待辦。

公版清單是**群組層級**，每個群組在創群時設定自己的公版清單。
無群組的使用者使用系統預設公版（`checklist_templates` 表中 `is_default = true`）；**seed 行動筆數與文案**以 `supabase/migrations/20260321000000_initial.sql` 為準（目前 **10** 筆 `checklist_items`）。

管理員（群組創建者）可透過兩種方式維護：

1. UI 介面逐筆增刪修
2. CSV / Excel 批次上傳（顯示預覽 → 確認後寫入）

每個 item 欄位：

| 欄位          | 型別    | 說明                                 |
| ------------- | ------- | ------------------------------------ |
| `id`          | uuid    | 主鍵                                 |
| `template_id` | uuid    | 所屬清單範本                         |
| `title`       | text    | 行動標題                             |
| `description` | text    | 說明文字                             |
| `sdg_ids`     | int[]   | 對應 SDG 編號（多選）                |
| `points`      | int     | 完成得分，預設 `DEFAULT_ITEM_POINTS` |
| `is_active`   | boolean | 是否顯示在今日清單                   |
| `order`       | int     | 排序                                 |

### 群組 `部分完成`

- `[done]` 創群時選擇**公開**（任何人可在「公開群組」清單加入）或**私人**（不出現在公開清單；需 **6 碼邀請碼**或**信箱邀請**）
- `[done]` 邀請碼為 6 碼英數字串，唯一不重複，定義於常數 `INVITE_CODE_LENGTH`（`lib/utils/invite.ts` 產生）
- `[done]` **信箱邀請**：建立者輸入對方 Google 登入信箱；受邀者在 `/groups` 頂部「待處理的群組邀請」**接受／拒絕**；比對依 **JWT 之 email**（須與受邀信箱一致）。實作：`group_invitations` 表與 RPC `create_group_email_invite`／`list_my_pending_group_invites`／`respond_group_email_invite`（migration `20260321120000_group_email_invitations.sql`）
- `[done]` **每人僅一個群組**：已加入任一群組時，不可再**建立**、**加入**（公開／邀請碼）或**接受信箱邀請**；須先**退出**。資料庫：`group_members (user_id)` **唯一**（`migration 20260321200000_one_group_per_user.sql`）；RPC `join_public_group`／`join_private_group`／`respond_group_email_invite`（接受時）若已隸屬群組則 `already_in_group`
- `[done]` **RLS／查詢**：`groups.g_select` 為 `is_public OR created_by = auth.uid() OR EXISTS (…group_members…)`（`migration 20260321160000`）；`group_members` 的 SELECT 僅 **`gm_select`**：`auth.uid() = user_id`。**勿**在遠端同時保留舊名 **`"members read"`**（子查詢 `group_members` 自參照）與 **`gm_select`**，否則仍會 **infinite recursion**（`migration 20260321170000` 刪除舊名）。**`listMyGroups`** 勿使用 PostgREST 嵌套 `group_members(..., groups(...))` 單一請求，改為兩次查詢後合併（見 **v0.10.20**）
- `[done]` **操作回饋**：群組相關成功／錯誤以 **`ToastProvider`**（`context/ToastContext.tsx`）底部 toast 提示
- `[未實作]` 創群時設定此群組的公版清單（可從系統預設複製後修改）；目前僅使用系統預設公版範本
- `[done]` 群組間排名（**平均標準化分**等聚合）與 `/leaderboard`「各群間」視角（見「排行榜設計 → 群組 vs 群組」）；進階可改為純 SQL／RPC 對齊 `leaderboard_groups` view

### 認證與使用者 `[done]`

- `[done]` 透過 Google 登入（Supabase Auth）
- `[done]` 新使用者寫入 `public.users`（trigger）；首次進入 App 會跳出**暱稱引導**（可改寫暱稱），完成後不再顯示（`users.onboarding_completed`，見 migration `20260321100000_user_onboarding.sql`）
- `[done]` 使用者可在 `/profile` 修改暱稱（預設為**顯示暱稱**＋**鉛筆**進入編輯，非預設即為輸入框）；暱稱顯示於排行榜與側欄（`ProfileForm`）
- `[done]` 後端仍以 Google 名稱／email 前綴作為初次後備暱稱（見 `handle_new_user`）

### 自訂行動 `[done]`

- `[done]` 使用者可新增個人「永續行為」（今日清單表單）
- `[done]` 可標記對應 SDGs（多選），**自訂 SDG 計入 SDG 覆蓋排名**（與後端統計一致時為 `[done]`）
- `[done]` 完成得分與公版相同（`DEFAULT_ITEM_POINTS`，暫定 10 分）
- `[done]` 今日自訂項目上限為 `MAX_CUSTOM_ITEMS`
- `[done]` ① 今日臨時新增、② 今日新增並收藏 — 表單**直接顯示**勾選「加入今日時，同時加入常用收藏」（**不使用** `<details>` 收合）；資料寫入 `custom_items` + `user_daily_custom_items`（連結今日），打卡後寫入 `daily_checkins`
- `[done]` ③ 直接新增到常用（「僅常用」次要按鈕；不加入今日、僅收藏備用）；主按鈕「加入今日清單」約 **70%** 寬並附 **`Plus`** 圖示，次要鈕約 **30%** 附 **`Bookmark`**
- `[done]` 新增標題輸入時 **比對常用收藏**（與下方「搜尋收藏標題」相同：`includes`）；結果以**與收藏清單相同之卡片列**緊貼於輸入框下方（標題、SDG、已在今日／加入今日、編輯／刪除）；**標題完全相同**列可強調；按「加入今日清單」若同名仍改為 **`linkCustomItemToToday`**（不重複建立）；「僅常用」若同名則阻擋並引導
- `[done]` **編輯**自訂：`updateCustomItem` 更新 `custom_items.title`／`sdg_ids`（同一筆資料），**今日列與常用列同步顯示**；`EditCustomItemDialog` + 今日自訂列／`FavoritesPanel` 之編輯鈕
- `[done]` **常用清單**（`FavoritesPanel`）：加入今日、**依標題搜尋**、**編輯**、**刪除**（`deleteCustomItemById` + `ConfirmDialog`）、收藏上限 `MAX_FAVORITE_ITEMS`（見下表規格）
- `[done]` 今日清單中的自訂列可 **從今日移除**（`unlinkCustomItemFromToday`：刪除當日 `daily_checkins` 與 `user_daily_custom_items`；**不**刪除 `custom_items`；`ConfirmDialog`）

**自訂行動三種狀態（規格；實作進度見上）：**

| 狀態             | 說明                         | 資料操作                                                    |
| ---------------- | ---------------------------- | ----------------------------------------------------------- |
| ① 今日臨時新增   | 加入今日清單，不收藏         | `custom_items`（`is_favorite=false`）+ `daily_checkins`     |
| ② 今日新增並收藏 | 加入今日清單，同時收藏為常用 | `custom_items`（`is_favorite=true`）+ `daily_checkins`      |
| ③ 直接新增到常用 | 不加入今日，只收藏備用       | `custom_items`（`is_favorite=true`），不寫 `daily_checkins` |

**常用清單（規格）：**

- 收藏的行動存放於常用清單，不會自動出現在今日清單
- 需要時從常用清單手動點選加入今日（寫入 `user_daily_custom_items` 連結當日；`custom_items` 不動）
- 常用清單上限為 `MAX_FAVORITE_ITEMS`，暫定 20 個，獨立於今日自訂項目上限
- 前端已支援搜尋、編輯、刪除（見上）；刪除為**永久刪除**該筆 `custom_items` 及關聯打卡／今日連結，需確認對話框；編輯與新增區「比對常用」見上

---

## 分數系統設計

### 每日原始得分

每個行動（公版或自訂）完成得 `DEFAULT_ITEM_POINTS` 分，暫定 **10 分**。
每個 item 存有 `points` 欄位，未來可個別調整。

### 分數（排行榜與每日統計）

- 每日 `user_daily_stats.raw_score` 為當日各完成項 points 加總；**排行榜「分數」維度**為所選期間內**加總**（與個人紀錄一致）。**主列表與統計卡**用語統稱「**分數**」。**總加權專區「分數表」折線圖**之數值為 `raw_score` 之按日／按段彙總，副標與 tooltip 以「**分**」「原始分加總」等與資料欄位對齊，避免與「完成次數」混淆。
- 舊版「標準化分」已不再作為排行榜排序依據；若需完成率語意請參考打卡與模板設定，不在此重複。

### Streak Tier 加成

每日至少完成 1 項即累計連續天數（類似簽到）。

| 連續天數   | 加成 |
| ---------- | ---- |
| 1 – 6 天   | +5   |
| 7 – 13 天  | +15  |
| 14 – 29 天 | +30  |
| 30 天以上  | +50  |

所有 tier 邊界與加成值定義為常數 `STREAK_TIERS`，集中在 `constants/scoring.ts`。

---

## 排行榜設計

四個視角，每個視角均支援時間維度切換：**本週 / 本月 / 至今**。

> **狀態標示**：章節標題的 `[done]`／`[部分完成]` 依「該節**所有**子項是否皆已實作」更新（見文件開頭規則）。先前「群組內／群組 vs 群組」曾標部分完成，**實作已齊**後已改為 `[done]`；「個人記錄」因 streak 專區仍待補，維持 `[部分完成]`。

### 四個排名子 Tab

每個視角內都有四個子 tab，可切換排名依據：

| Tab      | 排名依據                                | 說明                       |
| -------- | --------------------------------------- | -------------------------- |
| 總加權   | 三個維度名次積分加總                    | 綜合表現                   |
| 分數     | 期間內分數加總（各完成項 points）       | `raw_score` 日加總         |
| Streak Tier 加成 | 期間內每日依當日連續天數對應 tier 加分加總（1–6 天 +5、7–13 +15、14–29 +30、≥30 +50） | 與 `streak_tier_bonus`／`getStreakTierBonus` 一致；列表顯示 `5×n日 + …` 拆項 |
| SDG 覆蓋 | 名次依 N+M（N＝期間相異 SDG 數；M＝期間內單日涵蓋最大；`rpc_leaderboard_user_sdg_goals` + `user_daily_stats`） | 兼顧廣度與單日深度 |

**總加權積分計算（線性積分，人少時自然縮小分差）：**

```
第 1 名 → N 積分
第 2 名 → N-1 積分
...
最後一名 → 1 積分

總加權 = 分數維度積分 + Streak Tier 加成維度積分 + SDG 覆蓋維度積分
```

### 全體排行榜

- 所有使用者公開姓名，無隱私選項
- 主列表每頁最多 `LEADERBOARD_LIMIT` 筆（**20**），超過則「上一頁／下一頁」分頁；**名次為全榜名次**（第 2 頁仍顯示第 21 名起）
- **成員頭像**：全體榜與群組內榜**主列表**、以及群組內「**各成員完成項數**」列，優先顯示 **`public.users.photo_url`**（Google 等 OAuth 寫入之頭像 URL）；`lib/supabase/leaderboard.ts` 以 **`fetchUserProfileMap()`**（`select id, nickname, photo_url`）與榜單聚合一併載入，**`UserPeriodAgg.photoUrl`** 供 `LeaderboardShell`／`LeaderboardViz` 使用。無 URL 時維持暱稱首字圓形佔位。
- **前端**：`/leaderboard` 主視角 **全體**；**期間**由 `LeaderboardPeriodBar`（本週／本月／至今）與四子 tab（總加權／分數／Streak Tier 加成／SDG 覆蓋）；**分數表（折線圖）、SDG 分布、公版／自訂行動完成率＋密度圖**僅在子 tab **「總加權」**時載入與顯示（`useGlobalLeaderboardCharts(..., includeWeightedCharts)`）；其餘子 tab 仍載入四格統計卡所需之 **`topByScore`／`topBySdg`／`topHotAction`**（較輕量）。**即時更新**：主列表與分數表／SDG 圖表之 hook 監聽 **`user_daily_stats`**（打卡後通常會刷新 stats）；**`GlobalActionCompletionSection`** 另由 **`useGlobalActionCompletionStats`** 監聽 **`daily_checkins`、`user_daily_custom_items`、`user_daily_stats`**（見 [Realtime 規範](#realtime-規範)）。統計卡標題帶入所選期間；**排序依據旁與每列副文案**依子 Tab 說明；總加權列可顯示三維線性積分拆解（例 3+3+3）
- 統計面板：參與人數、**分數最高**、**SDG 覆蓋最高**（副標 **`N=…（相異）+ M=…（單日最多）＝合計`**）、**熱門行動（第 1 名，打卡次數）**；皆標註所選期間 `[done]`

#### 熱門行動統計卡（資料來源與語意）

- **怎麼算**：`rpc_global_hot_actions`（全體，**`20260321220000_leaderboard_analytics_rpc.sql`**）在 **頁面所選期間**（`p_start`～`p_end`，與榜單期間一致）內，統計 **`daily_checkins` 每一筆完成列**：公版 **`join checklist_items`** 以 **`ci.title`** 分組 `count(*)`；自訂 **`join custom_items`** 以 **`cu.title`** 分組；兩段 **`union all`** 後 **`order by action_count desc limit`**。前端 **`p_limit = 1`**，卡上顯示**第一名標題**與其 **`action_count`**（UI 可寫「次打卡」「完成筆數」等，語意皆為 **打卡列數**，非「分」）。
- **本群**：`rpc_group_hot_actions`（**`20260322180000_group_hot_actions_rpc.sql`**）邏輯同上，但僅計入 **`dc.user_id` 屬該群 `group_members`** 之列；由 **`fetchGroupLeaderboardCharts`**／`useGroupLeaderboardCharts` 呼叫。
- **與「分數表」的區別**：熱門行動是 **期間內依標題聚合的打卡次數**；**分數表** 為 **`raw_score` 按日加總**。兩者資料維度不同，勿把卡上數字當成「分數表上的分」。
- **為什麼畫面上好像沒看到誰在打卡該項**：此卡**不列出使用者**，只顯示全體或本群**合計**。數字可能來自 **其他成員**、**種子／測試資料**、或 **該期間內任一曆日**的歷史 `daily_checkins`（含公版 **`item_id`** 對應之 **`checklist_items.title`**）。若要對照「誰在某格完成」，全體榜 **總加權** 專區 **`GlobalActionCompletionSection`** 可點密度圖格看 **完成者清單**；本群若無同等 UI，須由具權限者查庫或另做產品功能。

- **總加權**專區圖表：**分數表**（`GlobalDailyCompletionBars`，**SVG 折線＋面積**）與 **SDG 行動分布**兩卡皆 **白底**（`bg-[var(--color-white)]`）。**分數表**資料為圖表範圍內使用者之 **`raw_score` 按日／按段加總**（`leaderboardAnalytics.aggregateFromStats`）；**SDG 行動分布**為打卡列 SDG 計次占比；標籤為 **`SDG n`＋中文名** 藥丸（`SDG_COLORS` 淡底深字）；進度條軌道為 **`--color-surface`**，填色為各 SDG 主色。
- **`GlobalActionCompletionSection`**（公版項目／自訂標題完成率＋密度圖）：
  - **期間列**：**今日／本週／本月／自訂** 四欄 **等寬** 同一膠囊列（**自訂**＝日曆圖示＋「自訂」＋ chevron **同一橫列**）。選 **自訂** 且已套用區間時，該欄為**整格淺綠**選中態（無「使用中」小徽章）。
  - **自訂區間**：點第四欄開啟 **`DateRangePickerPanel`**（雙月曆、**拖曳**選起訖；`components/ui/DateRangePickerPanel.tsx`）。面板為 **`absolute` 浮層**（錨在期間列容器內），**不推擠**下方完成率列表。套用後 **`useGlobalActionCompletionStats({ start, end })`**，密度圖版面依 **`resolveHeatmapLayoutForDateRange`**（短區間橫向日格、長區間 GitHub 週欄）。
  - 各列可顯示 **SDG 標籤**（RPC 回傳 `sdg_ids`）；須 **`20260322150000_action_completion_sdg_ids.sql`**。
  - 點密度圖格之彈窗：**完成者清單／照片牆**；佐證圖仍為 `daily_checkins.photo_url`。若已套用 **`20260322163000_leaderboard_cell_participants_avatar.sql`**，RPC 另回傳 **`avatar_url`**（`users.photo_url`）供頭像；**未套用時**前端仍相容，僅無頭像 URL、以首字代替。
  - 基礎 migration：**`20260322123000_leaderboard_action_density_rpcs.sql`**；並見 **`20260322140000_resync_default_checklist.sql`**／**`20260322141000_custom_title_stats_list_days.sql`**／**`20260322142000_custom_title_stats_include_list_only.sql`**。
- **行動完成率公式與「自訂 · 依標題彙總」**（區間＝該卡 **今日／本週／本月** 選擇，非頁首榜單期間）：
  - **公版**：完成率＝打卡人次 ÷（區間天數 × 期間內曾打卡人數）× 100%；項目來自 `is_default` 範本。若 DB 與 seed 文案／筆數脫節（例如曾手動改表、`on conflict do nothing` 未覆寫），可執行 **`20260322140000_resync_default_checklist.sql`** 還原 10 筆 canonical 並收斂單一預設範本。
  - **自訂**：完成率＝該標題之 **打卡次數** ÷ **列入今日清單人日數**（`user_daily_custom_items` 依 `custom_items.title` 彙總之列數）× 100%；須 **`20260322141000_custom_title_stats_list_days.sql`**。**列入清單但該期間尚無打卡**之標題仍會出現一列（完成率 0%），見 **`20260322142000_custom_title_stats_include_list_only.sql`**。**彙總鍵為標題字串**：`custom_item_id` 不同只要 **title 完全相同** 就併成榜上一列（全體跨使用者加總）。**範例**：使用者 A 的「帶環保杯」（`id=…a`）與 B 的「帶環保杯」（`id=…b`）→ 一列，列入人日與打卡為兩邊加總。小明週一、週三各把**自己的一筆**自訂加入今日並各完成打卡，標題皆「跑步」→ 列入人日 +2、打卡 +2。若一為「夜跑」、一為「夜跑 」（多一空白）→ **兩列**（字串不完全相同）。若 Supabase 尚未套用新 RPC，前端會暫以舊欄位「區間天數×曾打卡人數」估算分母並於 UI 提示套用 migration，**避免 NaN**。

### 群組內排行榜 `[done]`

- **成員排名**（四個子 tab）`[done]`：`lib/supabase/leaderboard.fetchGroupMemberLeaderboard`（以 `group_members` **全體成員**為準，無打卡者仍列入 0 分）、`useGroupMemberLeaderboard`、`LeaderboardShell`「群組內」；無群組時提示加入
- 統計面板：群組總分數、**平均 SDG 指標（N+M，成員之和÷人數）**、期間最長 streak（**標註持有者**）、最活躍成員（完成數）`[done]`（`fetchGroupPeriodStats`）；**熱門行動**（第 1 名標題與期間內打卡列數）見上節 **「熱門行動統計卡」**、`rpc_group_hot_actions`（須 **`20260322180000_group_hot_actions_rpc.sql`**）
- 圖表：**本群**每日**分數表**（折線，成員 **`raw_score` 按日加總**）、**本群** SDG 行動分布（`rpc_group_sdg_distribution`）**僅在子 tab「總加權」顯示**；圖表區第一卡目前為 **`bg-[var(--color-surface)]`**、SDG 卡為白底（與全體榜第一卡皆白底略異，可再統一）。**各成員完成項數橫條**（`GroupMemberCountBars`）仍於各子 tab 顯示 `[done]`（需 `20260321230100_group_sdg_distribution_rpc.sql`）
- 成員打卡狀態即時更新（Realtime `user_daily_stats`）`[done]`

### 群組 vs 群組 `[done]`

- **排名邏輯**：群組間以成員期間表現聚合——**平均分數**、**平均 Streak Tier 加成**、**SDG 覆蓋（成員 N+M 於群內平均）**、**總加權**（三維度線性積分，與全體同構）。實作於 **`lib/supabase/leaderboard.fetchGroupsLeaderboard`**
- **前端**：`LeaderboardShell`「各群間」、四子 tab（平均分數／平均 Streak Tier 加成／…）`[done]`
- 統計面板：**四格**——參與群組數、平均原始分領先、SDG 覆蓋最高、平均 Streak Tier 加成最高；**皆與頁面頂部選定之本週／本月／至今一致**（`fetchGroupsLeaderboard(period)`：`user_daily_stats` 與 `rpc_leaderboard_user_sdg_goals` 皆依該 `period` 邊界）`[done]`
- 群組列表：公開/私人 badge、成員數、指標條 `[done]`（**已移除**各群間「前 8」橫條小圖）

### 個人記錄 `[部分完成]`

> **`/profile`**：暱稱（點筆編輯）`[done]`；**分析區**為 `ProfileAnalyticsShell`：`LeaderboardPeriodBar` 選期間 → `ProfileChartsSection`：**五卡**（累計得分、打卡天數、最長 streak、SDG 覆蓋幾項、單日最高 SDG 覆蓋數；資料 **`fetchUserProfileCharts` → `summaryTop`**，與分數表／SDG 區間一致）、**分數表＋SDG 行動分布**（白底 **`lg:grid-cols-2`**，與全體榜總加權區視覺一致）、**`ProfileRecordsSection`**（主實作檔；**`ProfileActionCompletionSection.tsx`** 僅 re-export 同名別名）。**本週／本月**與排行榜期間一致；選 **「至今」** 時五卡與分數表／SDG 為 **今年 1/1～今日**。已移除「我的排行摘要」與首屏 **五階打卡密度熱力**（`fetchUserProfileCharts` 仍回傳 **`heatmapRows`** 供擴充，頁面不繪製）。

**`ProfileRecordsSection`（各項完成率／每週紀錄）** `[done]`

- **分頁**：**各項完成率**、**每週紀錄**；**填寫紀錄**按鈕（＋文字）開啟選日對話框（標題「填寫紀錄」、**去填寫** 進入該日編輯；日期欄可 **`showPicker()`** 整欄點開日曆；僅 **X** 關閉，**不可**點遮罩關閉）。
- **統計區間**（與頁頂 `LeaderboardPeriodBar` **分開**）：今日／本週／本月／自訂；**`getActionCompletionDateBounds`**／**`resolveHeatmapLayoutForActionCompletion`**／**`resolveHeatmapLayoutForDateRange`** 與全體榜 **`GlobalActionCompletionSection`** 同構。
- **各項完成率**：**`useProfileActionCompletionStats`**；RPC **`20260322200000_profile_action_completion_rpcs.sql`**（`rpc_profile_template_item_stats`、`rpc_profile_custom_title_stats`、日密度 `rpc_profile_*_day_density`，僅 **`auth.uid()`**）。展開列為**二元**密度（有打卡 **#849B6D**／無 **白**）；密度區 **`overflow-y-visible`** 避免多餘直向捲軸。點格開「我的完成紀錄」modal（仍可點遮罩關閉，與日彈窗不同）。
- **每週紀錄**：**`fetchUserDailyStatsInRange`** + **`fetchUserDayActivityExtrasInRange`**（`lib/supabase/checklist.ts`：自訂格數、自訂完成數、當日是否有佐證圖）；僅列 **`completed_count > 0`**。整列可點開 **檢視**；**編輯**／**刪除**（**`clearUserCalendarDay`**，確認後清空該日打卡與 `user_daily_custom_items` 連結）。**日彈窗**：內嵌 **`TodayChecklist`** + **`useTodayChecklist(日期)`**；**檢視**＝**`variant="readonly"`**（**`ChecklistStampCard`／`ChecklistRow`** **`readOnly`**：不灰隱、不可勾選，**可**檢視佐證縮圖與大圖）；**編輯**＝互動，底欄 **儲存並關閉**（關閉並 refetch 列表；勾選仍即時寫入 DB）。遮罩淡色 **`rgba(45,52,40,0.22)`**、**不可**點外關閉；標題列 **日期置中**，**上／下一天** 限目前紀錄區間（`chartStart`～`chartEnd`）。

- **`/leaderboard`「個人」視角** `[done]`：`fetchPersonalLeaderboardSnapshot` — 全體／群組內四維度名次表、期間分數加總、期間最佳單日 streak、平均標準化分與完成／SDG；引導至個人資料看近況表
- 統計數字全部顯示**原始值**，不標準化（與榜單標準化分並存於不同區塊）
- **分數表**（`GlobalDailyCompletionBars`）：與全體榜**同粒度規則**（`buildCompletionChartSeries`／`DailyChartMode`），圖表為 **SVG 平滑折線＋面積**；個人資料來源為 **`fetchUserProfileCharts` → `dailyScores`**（單日 **`raw_score`**）。後端仍另建 **`dailyCompletions`**（`completed_count` 系列）供他處擴充，**個人頁折線不讀該序列**。X 軸曆日以 **`M/d`**；圖寬依容器 **`ResizeObserver`** 填滿（點多時最小點距可橫向捲動）。
- 個人 **SDG 行動分布**（長條圖）`[done]`（`rpc_my_sdg_distribution`）
- **附錄（歷史／未掛載）**：個人頁曾於 **`ProfileChartsSection` 首區** 顯示 **五階**打卡密度熱力（`HEAT_BG`、`completed_count/total_items` 比例、本週卡／本月曆／至今 GitHub 欄等），已於 **v0.10.49** 起自頁面移除；若復用可參考 Changelog **v0.10.29～v0.10.33** 與 **`GlobalActionCompletionSection`** 之 **`ActionDensityHeatmap`**。
- Streak 紀錄（**目前連續**／**歷史最長**並列於個人專區）`[planned]`（榜單「個人」視角與 **每週紀錄**表可見期間／單日 streak；尚無獨立 streak 專區）

---

## 架構原則

這份文件不規定每個資料夾裡要有哪些檔案，因為功能仍在演進。
但無論新增什麼功能，都必須遵守以下五個原則。

### 原則一：Page 只負責組裝，不寫邏輯

`app/**/page.tsx` 只做三件事：組合 components、從 context 取值、決定 layout。
計算、資料讀寫、格式轉換一律不寫在 page 層。

```tsx
// ✅ 正確
export default function LeaderboardPage() {
  return (
    <main>
      <LeaderboardTabs />
      <StatPanel />
      <RankList />
    </main>
  );
}

// ❌ 錯誤：不要在 page 裡直接查詢 Supabase 或計算排名
export default function LeaderboardPage() {
  const supabase = createClient();
  const [ranks, setRanks] = useState([]);
  // ...
}
```

### 原則二：業務邏輯集中在 hooks

所有「做什麼事」的邏輯（資料計算、讀寫 Supabase、格式化）放在 `hooks/`。
hooks 可以呼叫 `lib/supabase/` 的封裝函式，但不直接建立 Supabase client。

命名慣例：

- 讀取資料 → `useXxx`（e.g. `useLeaderboard`, `useGroupStats`）
- 操作資料 → `useXxx`（e.g. `useChecklist`, `useCustomItems`）
- UI 狀態 → `useXxx`（e.g. `useDisclosure`, `useConfetti`）

每個 hook 回傳值要明確：`{ data, isLoading, error, ...actions }`

### 原則三：Supabase 操作只在 `lib/supabase/` 裡

禁止在 hooks、components、pages 直接建立 Supabase client 或執行查詢。
所有操作封裝成具名函式放在 `lib/supabase/`，以便統一替換或測試。

```ts
// ✅ lib/supabase/leaderboard.ts
export async function fetchGlobalLeaderboard(
  dimension: "weighted" | "score" | "count" | "sdg",
  period: "week" | "month" | "all",
  limit: number,
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leaderboard_view")
    .select("*")
    .order(dimension, { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// hook 只呼叫封裝好的函式，不直接碰 Supabase
import { fetchGlobalLeaderboard } from "@/lib/supabase/leaderboard";
```

### 原則四：Context 只放跨頁面共享的狀態

Context 不是 Redux，不要把所有狀態都丟進去。
判斷標準：「這個狀態有兩個以上不同層級的元件需要嗎？」才放 Context。

每個 Context 都必須提供對應的 custom hook（`useXxxContext`），
禁止在元件裡直接呼叫 `useContext(XxxContext)`。

```tsx
// ✅ 透過 hook 存取
const { user, nickname } = useUserContext();

// ❌ 不要直接呼叫
const ctx = useContext(UserContext);
```

Context Provider 掛載順序定義在 `app/layout.tsx`，
有依賴關係的 Provider 一律外層先掛。

### 原則五：可能全域調整的值，集中在 `constants/`

不要在元件或 hooks 裡 hard-code 數字、字串、顏色或資料清單。
任何「萬一哪天要改」的值，都定義在 `constants/` 並加上行內註解說明用途。

---

## 分層職責說明

```
app/              → 路由與 layout，組裝元件，不含邏輯
components/       → UI 元件，分功能型（可用 context）與純展示型（只接 props）
hooks/            → 業務邏輯、資料操作、UI 狀態管理（見下「目前檔案」）
context/          → 跨頁面共享的全域狀態（e.g. AuthContext、ToastContext）
lib/supabase/     → Supabase 所有查詢與操作的唯一入口（見下「目前檔案」）
lib/utils/        → 純函式工具（不依賴 Supabase 或 React；e.g. `invite.ts`、`error.ts`、`groupErrors.ts`、`leaderboardPeriod.ts`、`leaderboard.ts`）
constants/        → 全域常數、資料定義（config、scoring、sdg、checklist…）
```

**`hooks/`（目前）：** `useTodayChecklist.ts`、`useGlobalLeaderboard.ts`、`useGlobalLeaderboardCharts.ts`、`useGlobalActionCompletionStats.ts`、`useProfileActionCompletionStats.ts`、`useGroupMemberLeaderboard.ts`、`useGroupsLeaderboard.ts`、`usePersonalLeaderboard.ts`、`useGroupLeaderboardCharts.ts`、`useGroupPeriodStats.ts`、`useGroups.ts`、`useProfile.ts`、`useProfileNickname.ts`

**`lib/supabase/`（目前）：** `client.ts`、`server.ts`、`checklist.ts`（含自訂 CRUD／今日連結／佐證上傳、**`fetchUserDayActivityExtrasInRange`**／**`clearUserCalendarDay`** 等）、`stats.ts`、`users.ts`、`groups.ts`、`leaderboard.ts`、`leaderboardActionHeatmap.ts`、`leaderboardAnalytics.ts`

**元件分兩種：**

功能型元件（Feature Component）放在對應功能資料夾下，可使用 context 和 hooks，
負責把資料接進來再渲染。

純展示型元件（UI Component）通常放在 `components/ui/`，所有資料由 props 傳入，
不依賴任何 context，可在任何地方複用。例：`Skeleton`、`SdgTag`、`ImageLightbox`（佐證大圖）、`ConfirmDialog`（確認移除／刪除）。功能型表單／對話框亦可置於 `components/checklist/`（如 `EditCustomItemDialog`）。

> 新增資料夾或模組時，請在 [Changelog](#changelog) 說明其用途，
> 讓後人不用翻 code 就知道每個資料夾在做什麼。

---

## 常數定義規範

以下是建議的常數分類，**實際檔名調整時請更新本文件**：

- `constants/config.ts` — App 層級設定
- `constants/scoring.ts` — 所有分數與 streak 相關常數
- `constants/checklist.ts` — 系統預設公版清單資料（用於 seed）
- `constants/sdg.ts` — `SDG_COLORS`／`SDG_DEFINITIONS`／`getSdgById`（編號、半透明底、文字色、中文標籤）

命名使用 `SCREAMING_SNAKE_CASE`，並加行內註解：

```ts
// constants/scoring.ts
export const DEFAULT_ITEM_POINTS = 10; // 每個行動（公版或自訂）的預設得分

export const STREAK_TIERS = [
  // streak tier 加成，min = 最低天數
  { min: 1, bonus: 5 },
  { min: 7, bonus: 15 },
  { min: 14, bonus: 30 },
  { min: 30, bonus: 50 },
] as const;

// constants/config.ts
export const LEADERBOARD_LIMIT = 20; // 排行榜主列表每頁筆數（可翻頁）
export const MAX_CUSTOM_ITEMS = 10; // 每日可加入今日清單的自訂項目上限
export const MAX_FAVORITE_ITEMS = 20; // 常用清單收藏上限（獨立於今日自訂上限）
export const CUSTOM_ITEM_MAX_LENGTH = 40; // 自訂項目文字長度上限
export const DAILY_RESET_HOUR = 0; // 每日重置時間（UTC+8 的 0 點）
export const INVITE_CODE_LENGTH = 6; // 群組邀請碼長度
```

> ⚠️ 新增或修改任何常數，請在 [Changelog](#changelog) 記錄常數名稱與新值。

---

## 資料庫規範（Supabase）

### Client 初始化（唯一入口）

```ts
// lib/supabase/client.ts — 瀏覽器端（Client Component 用）
import { createBrowserClient } from "@supabase/ssr";
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

// lib/supabase/server.ts — 伺服器端（Server Component / Route Handler 用）
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export const createClient = () =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookies().getAll() } },
  );
```

禁止在其他地方直接 `createBrowserClient` 或 `createServerClient`，
一律 import 上述封裝。

### 資料表結構

> ⚠️ 每次新增或修改資料表，請同步更新此處並在 Changelog 記錄。

```sql
-- 使用者（對應 auth.users）
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null,
  email       text,
  photo_url   text,
  created_at  timestamptz default now(),
  onboarding_completed boolean not null default false  -- migration 20260321100000_user_onboarding.sql
);

-- SDG 目標（seed 資料，不由 client 寫入；配色與 `constants/sdg.ts` 之 SDG_COLORS 同步）
create table sdgs (
  id          int primary key,    -- 1–17
  label       text not null,      -- 簡短中文（與前端標籤一致）
  color       text not null,      -- 標籤底色（官方色 + 8 位 hex 透明度，約 10%）
  text_color  text not null       -- 標籤文字色（深色）
);

-- 公版清單範本
create table checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  created_by  uuid references users(id),
  is_default  boolean default false,   -- true = 系統預設公版
  created_at  timestamptz default now()
);

-- 清單項目
create table checklist_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid references checklist_templates(id) on delete cascade,
  title        text not null,
  description  text,
  sdg_ids      int[] not null default '{}',
  points       int not null default 10,
  is_active    boolean default true,
  "order"      int default 0,
  created_at   timestamptz default now()
);

-- 使用者自訂行動
create table custom_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete cascade,
  title        text not null,
  sdg_ids      int[] not null default '{}',
  points       int not null default 10,
  is_favorite  boolean default false,  -- true = 已收藏為常用
  created_at   timestamptz default now()
);

-- 群組
create table groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  is_public    boolean default true,
  invite_code  text unique,              -- 6 碼，私人群組必填
  template_id  uuid references checklist_templates(id),
  created_by   uuid references users(id),
  created_at   timestamptz default now()
);

-- 群組成員（每人最多一筆：同一 user_id 僅能隸屬一個群組）
create table group_members (
  group_id    uuid references groups(id) on delete cascade,
  user_id     uuid references users(id) on delete cascade,
  joined_at   timestamptz default now(),
  primary key (group_id, user_id)
);
-- unique index on (user_id) 見 migration 20260321200000 / initial.sql

-- 群組信箱邀請（見 migration 20260321120000_group_email_invitations.sql；受邀 email 小寫 trim 儲存）
create table group_invitations (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  invited_email text not null,
  invited_by    uuid not null references users(id) on delete cascade,
  status        text not null check (status in ('pending','accepted','declined','cancelled')),
  created_at    timestamptz default now()
);
-- 同一群組、同一信箱僅能有一筆 pending（partial unique index）

-- 每日打卡紀錄
create table daily_checkins (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references users(id) on delete cascade,
  date             date not null,                    -- e.g. 2026-03-20
  item_id          uuid references checklist_items(id),
  custom_item_id   uuid references custom_items(id),
  photo_url        text,                             -- Supabase Storage URL
  checked_at       timestamptz default now(),
  constraint daily_checkins_one_item
    check (
      (item_id is not null and custom_item_id is null) or
      (item_id is null and custom_item_id is not null)
    ),
  unique (user_id, date, item_id),
  unique (user_id, date, custom_item_id)
);

-- 今日加入清單的自訂項目（用於計算當日 total_items）
create table user_daily_custom_items (
  user_id        uuid references users(id) on delete cascade,
  date           date not null,
  custom_item_id uuid references custom_items(id) on delete cascade,
  primary key (user_id, date, custom_item_id)
);

-- 使用者每日統計（冗餘存儲，加速排行榜查詢）
-- 每次打卡後由 Supabase Function / trigger 更新
create table user_daily_stats (
  user_id           uuid references users(id) on delete cascade,
  date              date not null,
  completed_count   int default 0,         -- 當日完成項目數（含自訂）
  total_items       int default 0,         -- 當日可完成總項目數
  raw_score         int default 0,         -- 當日原始得分
  sdg_coverage      int default 0,         -- 當日涵蓋 SDG 數
  normalized_score  numeric default 0,     -- (completed/total)*100 + streak bonus
  streak            int default 0,         -- 當日 streak 天數
  primary key (user_id, date)
);
```

### 常用 View（排行榜查詢用）

> View 定義修改時請更新此處並記錄於 Changelog。

```sql
-- 全體排行榜 view（依時間維度聚合）
create view leaderboard_global as
select
  u.id                              as user_id,
  u.nickname,
  -- 累計
  sum(s.raw_score)                  as total_score,
  sum(s.completed_count)            as total_count,
  max(s.sdg_coverage)               as max_sdg_coverage,
  avg(s.normalized_score)           as avg_normalized_score,
  -- 本週（ISO week）
  sum(case when date >= date_trunc('week', now()) then s.raw_score else 0 end)
                                    as weekly_score,
  sum(case when date >= date_trunc('week', now()) then s.completed_count else 0 end)
                                    as weekly_count,
  -- 本月
  sum(case when date >= date_trunc('month', now()) then s.raw_score else 0 end)
                                    as monthly_score,
  max(s.streak)                     as max_streak
from user_daily_stats s
join users u on u.id = s.user_id
group by u.id, u.nickname;

-- 群組排行榜 view
create view leaderboard_groups as
select
  g.id                              as group_id,
  g.name,
  g.is_public,
  count(distinct gm.user_id)        as member_count,
  avg(s.avg_normalized_score)       as avg_score,
  avg(s.total_count)                as avg_count,
  max(s.max_sdg_coverage)           as sdg_coverage
from groups g
join group_members gm on gm.group_id = g.id
join leaderboard_global s on s.user_id = gm.user_id
group by g.id, g.name, g.is_public;
```

### 排行榜／分析用 RPC（SECURITY DEFINER）

跨使用者讀取 `daily_checkins` 或做榜單專用聚合時，以 **RPC** 實作（`security definer`）。**`group_members`** 的 **`gm_select`** 僅允許讀 **本人**列，客戶端若直接 `select` 無法取得同群其他成員，亦無法組出「各群間」完整成員表；**群組內榜、各群間榜、群組圖表**須改呼叫 **`rpc_group_member_user_ids`**／**`rpc_leaderboard_group_rows`**（見下表最後一列）。

**新環境**除 `20260321000000_initial.sql` 外，請依專案需求執行下列檔案（見 `supabase/migrations/`）：

| Migration 檔 | 函式（摘要） |
| --- | --- |
| `20260321220000_leaderboard_analytics_rpc.sql` | `rpc_global_sdg_distribution`、`rpc_global_hot_actions`、`rpc_my_sdg_distribution` |
| `20260321230100_group_sdg_distribution_rpc.sql` | `rpc_group_sdg_distribution`（群組成員期間內 SDG 次數） |
| `20260321231000_leaderboard_user_sdg_goals_rpc.sql` | `rpc_leaderboard_user_sdg_goals`（每位使用者期間相異 SDG，供 SDG 覆蓋維度） |
| `20260322180000_group_hot_actions_rpc.sql` | `rpc_group_hot_actions`（群組成員期間內依標題之熱門行動，與 `rpc_global_hot_actions` 同構） |
| `20260322200000_profile_action_completion_rpcs.sql` | `rpc_profile_template_item_stats`、`rpc_profile_custom_title_stats`、日密度 `rpc_profile_template_item_day_density`／`rpc_profile_custom_title_day_density`（**僅**目前使用者 `auth.uid()`；**`grant execute … to authenticated`**，**非** `anon`；供 **`ProfileRecordsSection`**「各項完成率」列表與展開密度） |
| `20260321232000_leaderboard_user_checkin_split_rpc.sql` | `rpc_leaderboard_user_checkin_split`（公版／自訂打卡次數拆項；`lib/supabase/leaderboard.ts` 使用） |
| `20260322120000_leaderboard_group_members_rpc.sql` | `rpc_group_member_user_ids`（呼叫者須為該群成員，回傳該群**全部** `user_id`）；`rpc_leaderboard_group_rows`（已登入：全表 `group_members` 併 `groups` 名稱／公開旗標，供各群間榜與個人快照） |
| `20260322123000_leaderboard_action_density_rpcs.sql` | 全體「行動完成率／密度」：`rpc_leaderboard_default_template_item_stats`、`rpc_leaderboard_template_item_day_density`、`rpc_leaderboard_template_item_cell_participants`、自訂標題彙總之 `rpc_leaderboard_custom_title_*`（初版；自訂分母後續由下列檔覆寫） |
| `20260322140000_resync_default_checklist.sql` | 僅保留系統預設範本 UUID 為 `is_default`；**upsert 10 筆**公版 `checklist_items`；停用同範本非 canonical 項目；`get_user_template_id` 優先固定預設範本 id |
| `20260322141000_custom_title_stats_list_days.sql` | `rpc_leaderboard_custom_title_stats` 改回傳 **`on_list_days`**（列入今日清單人日）；自訂完成率分母改為列入清單人日（非「區間天數×人數」估算） |
| `20260322142000_custom_title_stats_include_list_only.sql` | `rpc_leaderboard_custom_title_stats` 以 **full outer join** 合併打卡與列入清單；**僅列入、尚未打卡**之標題亦回傳（完成率 0%） |
| `20260322150000_action_completion_sdg_ids.sql` | `rpc_leaderboard_default_template_item_stats`、`rpc_leaderboard_custom_title_stats` 增 **`sdg_ids`**（各項完成率列 SDG 標籤） |
| `20260322163000_leaderboard_cell_participants_avatar.sql` | `rpc_leaderboard_*_cell_participants` 增 **`avatar_url`**（`users.photo_url`）；**`handle_new_user`** 併寫 Google **`picture`**（選用；完成者頭像與佐證 `photo_url` 分欄） |

前端封裝：`lib/supabase/leaderboard.ts`、`leaderboardAnalytics.ts`；**期間起訖**與榜單一致之計算見 `lib/utils/leaderboardPeriod.ts`。

### 開發／測試：清空業務資料並重設公版（`wipe_and_reseed.sql`）

專案提供 **`supabase/scripts/wipe_and_reseed.sql`**，用於在**不刪表、不動 RPC／函式／trigger**的前提下，清空 **`public` 業務表資料列**並重新寫入 **SDG（17 筆）** 與 **系統預設範本 + 10 筆 canonical 公版**（語意與 **`20260321120000_sdgs_tag_colors.sql`**、**`20260322140000_resync_default_checklist.sql`** 對齊）。

**涵蓋表**（與 migrations 內 `public` 業務表一致）：`daily_checkins`、`user_daily_stats`、`user_daily_custom_items`、`push_subscriptions`、`group_invitations`、`group_members`、`groups`、`custom_items`、`checklist_items`、`checklist_templates`、`users`、`sdgs`。若日後 migration **新增** `public` 表，須同步把該表補進腳本內 **`TRUNCATE`** 清單。

**建議執行方式（雲端專案）**

1. Supabase Dashboard → **SQL Editor** → 貼上該檔全文，執行 **`begin;` 至 `commit;`** 整段（含 **`TRUNCATE … CASCADE`** 與後續 **`INSERT`**）。**無法復原**，確認環境後再跑。
2. 執行完後 **`public.users` 為空**，但 **`auth.users` 仍存在** 時，會出現「有登入身分、無 profile 列」的不一致；若仍要用**同一帳號**登入，通常可再登入並依 **`handle_new_user`** 等流程重建 `public.users`（依實際觸發器／App 行為為準）。
3. **選用——連登入帳號一併清空**（開發／測試、**無法復原**）：在上一段 **`COMMIT` 成功後**，**另開一則查詢**執行（勿與主腳本同一批註解掉；檔案末尾註解僅供複製，執行時須去掉 `--`）：
   - 優先：`delete from auth.users;`
   - 若報 FK 錯誤，可再試：`delete from auth.identities;` 後接 `delete from auth.users;`（依 Supabase 版本 schema 可能略有差異）；權限不足時改到 Dashboard → **Authentication** 手動刪除使用者。
4. **不要**把「清空 Auth」當成必跑步驟；**保留帳號**時**不要**執行 `delete from auth.users`。

**本機**若已用 Supabase CLI／Docker：**`npx supabase db reset`** 會整庫重跑 migration 並清空 **Auth**，等同全新環境，通常比手動腳本更徹底。

**未涵蓋**：**Storage**（例如打卡佐證圖）不會被此 SQL 刪除，需至 Storage 另行清理。

### Row Level Security（RLS）

```sql
-- users：任何人可讀，只有本人可寫
alter table users enable row level security;
create policy "public read" on users for select using (true);
create policy "self write" on users for all using (auth.uid() = id);

-- custom_items：只有本人可讀寫
alter table custom_items enable row level security;
create policy "owner only select" on custom_items for select using (auth.uid() = user_id);
create policy "owner only insert" on custom_items for insert with check (auth.uid() = user_id);
create policy "owner only update" on custom_items for update using (auth.uid() = user_id);
create policy "owner only delete" on custom_items for delete using (auth.uid() = user_id);

-- daily_checkins：只有本人可讀寫
alter table daily_checkins enable row level security;
create policy "owner only select" on daily_checkins for select using (auth.uid() = user_id);
create policy "owner only insert" on daily_checkins for insert with check (auth.uid() = user_id);
create policy "owner only update" on daily_checkins for update using (auth.uid() = user_id);
create policy "owner only delete" on daily_checkins for delete using (auth.uid() = user_id);

-- user_daily_stats：任何人可讀（排行榜需要），只有本人可寫
alter table user_daily_stats enable row level security;
create policy "public read" on user_daily_stats for select using (true);
create policy "self insert" on user_daily_stats for insert with check (auth.uid() = user_id);
create policy "self update" on user_daily_stats for update using (auth.uid() = user_id);

-- groups：公開／建立者可讀／成員可讀（勿用會再查 group_members 的函式於 gm_select；勿在 gm_select 政策內自參照）
alter table groups enable row level security;
create policy "public groups readable" on groups for select
  using (
    is_public = true
    or created_by = auth.uid()
    or exists (
      select 1 from group_members gm
      where gm.group_id = groups.id and gm.user_id = auth.uid()
    )
  );
create policy "creator insert" on groups for insert with check (auth.uid() = created_by);
create policy "creator update" on groups for update using (auth.uid() = created_by);
create policy "creator delete" on groups for delete using (auth.uid() = created_by);

-- group_members：SELECT 僅 policy 名稱 gm_select（勿另建舊名 "members read" 子查詢自參照）
alter table group_members enable row level security;
create policy gm_select on group_members for select using (auth.uid() = user_id);
create policy gm_join_public on group_members for insert with check (
  auth.uid() = user_id
  and exists (select 1 from groups g where g.id = group_id and g.is_public = true)
);
create policy gm_creator_insert on group_members for insert with check (
  auth.uid() = user_id
  and exists (select 1 from groups g where g.id = group_id and g.created_by = auth.uid())
);
create policy gm_delete_self on group_members for delete using (auth.uid() = user_id);

-- checklist_items：任何人可讀，只有 template 創建者可寫
alter table checklist_items enable row level security;
create policy "public read" on checklist_items for select using (true);
create policy "template owner insert" on checklist_items for insert with check (
  template_id in (select id from checklist_templates where created_by = auth.uid())
);
create policy "template owner update" on checklist_items for update using (
  template_id in (select id from checklist_templates where created_by = auth.uid())
);
create policy "template owner delete" on checklist_items for delete using (
  template_id in (select id from checklist_templates where created_by = auth.uid())
);
```

### Storage（打卡照片）

bucket 名稱：`checkin-photos`，建立時勾選 **Public bucket**。

上傳路徑規則：`{user_id}/{日期}_{item_id 或 custom_item_id}.{jpg|png}`（實作見 `uploadCheckinPhotoFile`），例如：

```
abc-123-uid/2026-03-21_item-456.jpg
```

第一層資料夾固定為 user_id，Policy 據此限制每人只能操作自己的資料夾。

```sql
-- 允許所有人讀取
create policy "public read"
on storage.objects for select
using ( bucket_id = 'checkin-photos' );

-- 允許已登入用戶上傳自己的照片（路徑第一層必須是自己的 uid）
create policy "authenticated upload"
on storage.objects for insert
with check (
  bucket_id = 'checkin-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 允許已登入用戶刪除自己的照片
create policy "owner delete"
on storage.objects for delete
using (
  bucket_id = 'checkin-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Realtime 規範

主要排行榜區塊已接 Supabase Realtime（見下表）：資料變動時會觸發 refetch，一般**不需手動重整**；各區監聽的表不盡相同（例如主列表依 `user_daily_stats`，行動完成率區另聽打卡與今日自訂連結）。

### 免費版限制

| 項目       | 上限   |
| ---------- | ------ |
| 同時連線數 | 200 個 |
| 每秒訊息數 | 100 則 |
| 頻道數     | 100 個 |

初期人數不多，上述限制完全足夠。

### 開啟 Realtime（Supabase 後台）

在 SQL Editor 執行，將需要監聽的表加入 Realtime publication：

```sql
alter publication supabase_realtime add table daily_checkins;
alter publication supabase_realtime add table user_daily_stats;
alter publication supabase_realtime add table user_daily_custom_items;
```

（`user_daily_custom_items` 用於「各項完成率」自訂列：加入／移出今日清單時即時重抓；若未加入 publication，該區僅在 `daily_checkins`／`user_daily_stats` 變動時更新。）

### 各排行榜視角監聽對象

| 視角         | 監聽的表                             | 說明                       |
| ------------ | ------------------------------------ | -------------------------- |
| 全體排行榜   | `user_daily_stats`                   | 主列表與**分數表**／SDG 圖表：`raw_score` 等彙總變動即觸發 |
| 全體 · 行動完成率區 | `daily_checkins`、`user_daily_custom_items`、`user_daily_stats` | `useGlobalActionCompletionStats`：公版／自訂完成率與密度名單與資料一致 |
| 群組內排行榜 | `user_daily_stats`                   | 成員分數變動即觸發（實作與上表對齊；`daily_checkins` 可另增以縮短觸發路徑） |
| 群組 vs 群組 | `user_daily_stats`                   | 群組平均分即時更新         |
| 個人記錄     | 不需要 Realtime                      | 自己的操作本地更新即可     |

### 前端訂閱寫法

Realtime 訂閱邏輯寫在 `hooks/` 裡，不直接寫在 component 或 page。
訂閱觸發後重新呼叫 `lib/supabase/` 的封裝函式，不在 callback 裡處理資料。

```ts
// hooks/useGroupLeaderboard.ts 範例
export function useGroupLeaderboard(groupId: string) {
  const [data, setData] = useState([]);

  useEffect(() => {
    // 初次載入
    fetchGroupLeaderboard(groupId).then(setData);

    // 訂閱即時更新：群組內任一成員的 user_daily_stats 有變動就重新 fetch
    const channel = supabase
      .channel(`group-leaderboard-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_daily_stats" },
        () => {
          fetchGroupLeaderboard(groupId).then(setData);
        },
      )
      .subscribe();

    // 離開頁面時取消訂閱，避免 memory leak
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  return { data };
}
```

> RLS 會自動過濾 Realtime 推送的資料，使用者只會收到有權限讀取的變動，現有 RLS 設定無需調整。

---

## PWA 規範

GoGreen 實作為 PWA（Progressive Web App），讓使用者可以安裝到手機主畫面，並接收推播通知。

### 套件與設定

本專案使用 **`@ducanh2912/next-pwa`**（相容 Next 15+）。設定集中在根目錄 **`next.config.ts`**：

```ts
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

export default withPWA(nextConfig);
```

- 開發模式預設關閉 PWA，避免快取／service worker 干擾除錯。
- 生產建置請使用 **`npm run build`**（已設為 `next build --webpack`），以相容本套件與既有設定。

### `public/manifest.json`

```json
{
  "name": "GoGreen",
  "short_name": "GoGreen",
  "description": "每天一點永續行動",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F3F4EF",
  "theme_color": "#718355",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

顏色對應設計系統：`background_color` 用 `--color-bg`，`theme_color` 用 `--color-primary-dark`。

### iOS 限制

iOS 使用者需要先將 GoGreen **加到主畫面**，才能接收推播通知（iOS Safari 16.4+）。
首次進入 app 時應顯示引導提示，說明如何加到主畫面。

---

## 推播通知規範

### 通知時機

每天晚上 **8 點整**（台灣時間，UTC+8），固定對所有使用者檢查並發送。

| 情況   | 條件                     | 通知內容                                          |
| ------ | ------------------------ | ------------------------------------------------- |
| 情況 A | 今天完全沒有任何打卡紀錄 | 🌿 今天還沒開始！完成一項行動，保住你的 streak 吧 |
| 情況 B | 今天有打卡但未全部完成   | 🌿 今天還剩 N 項沒完成，繼續加油！                |

情況 B 的 N 為動態數字，由後端計算「總項目數 - 已完成項目數」後帶入通知內容。
若今天已全部完成，不發送任何通知。

### 推播流程

```
① 使用者首次開啟 GoGreen
   → 前端請求通知權限（瀏覽器跳出允許通知彈窗）
   → 使用者同意後產生 push subscription
   → 將 subscription 存入 push_subscriptions 表

② 每天晚上 8 點（UTC 12:00）
   → Supabase Cron 觸發 Edge Function
   → 查詢 daily_checkins，找出今天沒有全部完成的使用者
   → 區分情況 A（完全沒打卡）和情況 B（部分完成）
   → 從 push_subscriptions 取得訂閱資訊
   → 發送對應推播
```

### Supabase Cron 設定

在 SQL Editor 執行：

```sql
select cron.schedule(
  'daily-push-reminder',
  '0 12 * * *',        -- UTC 12:00 = 台灣時間 20:00
  $$
  select net.http_post(
    url := 'https://你的專案id.supabase.co/functions/v1/send-reminder',
    headers := json_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )::jsonb
  );
  $$
);
```

### Edge Function

推播邏輯寫在 `supabase/functions/send-reminder/index.ts`，使用 `web-push` 套件發送。
Edge Function 使用 `SUPABASE_SERVICE_ROLE_KEY` 繞過 RLS 查詢所有使用者打卡狀態。

### 資料表：`push_subscriptions`

> ⚠️ 建立後請同步在 SQL Editor 執行 RLS 設定。

```sql
create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  endpoint    text not null,       -- 推播伺服器地址
  p256dh      text not null,       -- 加密金鑰
  auth        text not null,       -- 驗證金鑰
  created_at  timestamptz default now(),
  unique (user_id, endpoint)       -- 同一使用者同一裝置只存一筆
);

-- RLS
alter table push_subscriptions enable row level security;
create policy "owner only select" on push_subscriptions for select using (auth.uid() = user_id);
create policy "owner only insert" on push_subscriptions for insert with check (auth.uid() = user_id);
create policy "owner only delete" on push_subscriptions for delete using (auth.uid() = user_id);
```

### 環境變數（推播用）

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=    # Web Push 公鑰
VAPID_PRIVATE_KEY=               # Web Push 私鑰（僅限 server-side）
VAPID_MAILTO=                    # e.g. mailto:admin@gogreen.app
```

VAPID 金鑰用 `web-push` 套件產生：

```bash
npx web-push generate-vapid-keys
```

---

## UI/UX 與多裝置規範

> ⚠️ 這是**強制規範**，不是建議。所有頁面與元件都必須在手機、平板、桌面三種裝置上完整可用且美觀。

### 斷點定義

Tailwind 預設斷點，統一使用，不自訂：

| 名稱 | 寬度     | 目標裝置       |
| ---- | -------- | -------------- |
| `sm` | ≥ 640px  | 大手機（橫向） |
| `md` | ≥ 768px  | 平板           |
| `lg` | ≥ 1024px | 桌面           |

開發時優先以**手機版**為主（mobile-first），再往上擴展。

### Layout 行為

| 頁面 / 元件 | 手機                                                                             | 平板             | 桌面                                     |
| ----------- | -------------------------------------------------------------------------------- | ---------------- | ---------------------------------------- |
| 主導航      | 底部 tab bar                                                                     | 底部 tab bar     | 左側 sidebar                             |
| 檢核表      | 單欄列表；清單下**單卡**「自訂行動與常用收藏」（表單與收藏上下分區、`embedded`） | 單欄列表（較寬） | 單欄為主（統計在上）；雙欄為目標 `[tbd]` |
| 排行榜      | 全寬列表                                                                         | 全寬列表         | **全體**：統計卡四格＋列表；**總加權**時再加圖表區（**分數表折線**／SDG／行動密度，**lg: 雙欄**）；**各群間**：四格統計卡（xl 四欄）＋列表，無橫條圖 `[done]` |
| 統計圖表    | 全寬                                                                             | 全寬             | 並排顯示（與上欄對齊）`[done]`             |

### 觸控規範（手機 / 平板）

- 所有可點擊元素最小尺寸 **44 × 44px**（Apple HIG 標準）
- 勾選項目的點擊區域要涵蓋整列，不只是 checkbox 本身
- 支援 swipe 手勢：左右滑動切換排行榜子 tab
- 不使用 hover-only 的互動（手機沒有 hover）

### 動畫與互動規範

- 今日檢核：蓋章落下、漣漪、粒子、整列 spring、分數 bump、半程 toast、全完成 **DOM 彩帶** + overlay 等，定義於 `app/globals.css`（`gg-*` class）與相關元件
- 全部完成慶祝僅在「當次操作剛好打滿」時觸發（見「主畫面 — 今日檢核」）
- 互動動畫宜俐落；多數在 **約 150–450ms** 量級，避免拖長
- **尊重 `prefers-reduced-motion`：** `globals.css` 對 `transition` 與部分動畫縮短／弱化；**勿**對全域 `animation: none !important` 一刀切（會破壞無障礙與蓋章動效細節）。若新增全頁動畫，沿用同一檔案之 reduce 區塊模式

```css
/* 範例：僅示意；實作以 globals.css 為準 */
@media (prefers-reduced-motion: reduce) {
  .gg-stamp-spring,
  .gg-stat-bump {
    animation-duration: 0.2s !important;
  }
}
```

### 質感規範

- 字體：全站主字型 **Noto Sans TC**（`next/font/google`，`app/layout.tsx` 套用於 `body`）；`app/globals.css` 之 `--font-sans` 與之對齊
- 行高：內文 `leading-relaxed`（1.625），標題 `leading-tight`（1.25）
- 圓角：小元件 `rounded-lg`（8px），卡片 `rounded-2xl`（16px），按鈕 `rounded-full`
- 邊框：統一 `0.5px`，顏色使用 `--color-muted`
- 陰影：**不使用**，改用邊框和背景色製造層次感（符合設計系統禁漸變規範）
- 間距：以 4px 為基底單位（Tailwind `space-1` = 4px），元件間距最小 8px

### 空狀態設計

每個列表、圖表、排行榜都必須有空狀態設計（不能只有空白）：

- 排行榜沒有資料 → 顯示「還沒有人上榜，成為第一個！」
- 今日清單全部完成 → 依情境顯示全完成 overlay／內聯「今日全部完成」提示（見今日檢核規格；**非**每次進頁都播動畫）
- 常用清單是空的 → 顯示引導說明（見 `FavoritesPanel` 空狀態）`[done]`
- 常用清單有資料但搜尋無匹配 → 顯示「沒有符合…的收藏」`[done]`

### 載入狀態設計

- 所有從 Supabase 讀取資料的地方都必須有 skeleton loading
- Skeleton 使用 `--color-surface-mid` 做底色，配合 CSS animation 閃爍
- 不使用 spinner（轉圈圈）作為主要 loading 狀態

### 多裝置測試要求

每次新增頁面或元件，**必須**在以下三種尺寸確認顯示正常：

| 測試尺寸 | 對應裝置  |
| -------- | --------- |
| 390px    | iPhone 14 |
| 768px    | iPad      |
| 1440px   | 桌面      |

Chrome DevTools 的裝置模擬器即可，不需要實體裝置。

---

## 開發者文件維護規範

**這份文件是活的，必須跟 code 一起更新。**

**原則：** 任何會影響「資料庫結構／權限」「使用者行為」「API 契約」「分數或排行榜規則」的變更，都視為**重要更動**，必須同步更新本文件（含 Changelog 一筆）；僅修 typo、純重構且不改行為者，可酌情只更新 Changelog 或省略，但請在 PR／commit 說明。

以下情境發生時，請同步修改本文件對應區塊，並在 Changelog 新增一筆紀錄：

| 情境                                           | 應更新的區塊                                      |
| ---------------------------------------------- | ------------------------------------------------- |
| 新增功能模組（新資料夾 / 新頁面）              | 系統功能規格（更新狀態）、分層職責說明、Changelog |
| 新增或修改 constants                           | 常數定義規範、Changelog                           |
| 新增或修改資料表 / View / RLS                  | 資料庫規範 → 對應章節、Changelog                  |
| 修改架構分層（新增 middleware、新 context 等） | 架構原則 或 分層職責說明、Changelog               |
| 新增環境變數                                   | 環境變數、Changelog                               |
| 功能規格有變更（`[tbd]` 決定、分數調整等）     | 系統功能規格 或 分數系統設計、Changelog           |
| 修改顏色 token 或設計規範                      | 設計系統、Changelog                               |
| 修改 Storage bucket 或 Policy                  | 資料庫規範 → Storage、Changelog                   |
| 修改 Realtime 監聽表或訂閱邏輯                 | Realtime 規範、Changelog                          |
| 修改 PWA 設定（manifest、套件）                | PWA 規範、Changelog                               |
| 修改推播通知邏輯或通知內容                     | 推播通知規範、Changelog                           |
| 修改斷點、layout 行為或互動規範                | UI/UX 與多裝置規範、Changelog                     |

**文件目標：** 讓一個從未看過這個 repo 的開發者，只讀這份文件，
就能理解「專案在做什麼」「各層在負責什麼」「要改某個東西該去哪找」「過去為什麼這樣設計」。

---

## 環境變數

在專案根目錄建立 `.env.local`（加入 `.gitignore`，不 commit）：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

伺服器端操作（如 admin 功能、Edge Function）若需要繞過 RLS，另外設定：

```bash
SUPABASE_SERVICE_ROLE_KEY=      # 僅限 server-side，絕對不可 NEXT_PUBLIC_
```

PWA 推播通知需要額外設定 VAPID 金鑰（用 `npx web-push generate-vapid-keys` 產生）：

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # Web Push 公鑰
VAPID_PRIVATE_KEY=              # Web Push 私鑰，僅限 server-side
VAPID_MAILTO=                   # e.g. mailto:admin@gogreen.app
```

Vercel 部署時在 Project Settings → Environment Variables 填入相同欄位。

> 新增環境變數時，請同時更新此處並在 Changelog 記錄。

---

## Commit 訊息規範

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <簡短描述>

[選填] 詳細說明（說明「為什麼這樣改」，未來排查時很有幫助）
```

### Type 對照表

| Type       | 使用時機                                     |
| ---------- | -------------------------------------------- |
| `feat`     | 新增功能                                     |
| `fix`      | 修正 bug                                     |
| `refactor` | 重構（不影響行為）                           |
| `chore`    | 設定、工具、依賴套件、文件維護等非功能性異動 |
| `style`    | 純樣式調整（不影響邏輯）                     |
| `perf`     | 效能優化                                     |
| `test`     | 新增或修改測試                               |
| `docs`     | 只有文件異動（包含 INSTRUCTIONS.md）         |

### Scope 建議

`checklist` / `leaderboard` / `group` / `auth` / `db` / `constants` / `context` / `hooks` / `ui` / `config`

### 範例

```bash
feat(checklist): 新增今日打卡照片上傳功能

feat(group): 實作群組邀請碼加入流程

fix(leaderboard): 修正 streak tier 加成計算錯誤

refactor(hooks): 將 useLeaderboard 拆分為 useGlobalRank 與 useGroupRank
# 拆分原因：兩者查詢邏輯差異大，合在一起難以維護。

chore(db): 新增 user_daily_stats 資料表與 trigger
# 冗餘存儲設計，避免排行榜查詢時即時聚合，見 INSTRUCTIONS.md 資料庫規範。

chore(constants): 調整 STREAK_TIERS，30天以上加成從 40 改為 50

docs: 確立排行榜總加權採線性積分，更新分數系統設計章節

style(ui): 調整 CheckItem 勾選動畫曲線
```

> Commit 訊息中英文皆可，團隊統一即可，但 type / scope 格式請固定。
> 涉及資料表、架構、常數的 commit，body 請說明「為什麼這樣設計」。

---

## Changelog

> 每次異動請在最上方新增一筆，舊紀錄向下保留，不刪除。
>
> 標籤：`[FEAT]` 新功能　`[FIX]` 修正　`[ARCH]` 架構調整　`[CONST]` 常數異動　`[DB]` 資料庫異動　`[DOCS]` 文件更新

---

### [2026-03-23] v0.10.50 — 個人「每週紀錄」分頁、填寫紀錄、`/today?date=` 與文件對齊

- `[FEAT]` **`ProfileRecordsSection`**（**`ProfileActionCompletionSection`** 僅 re-export）：**各項完成率**／**每週紀錄**分頁、共用區間選擇、**填寫紀錄**（選日→**去填寫**）、週表列與日彈窗（檢視唯讀可見佐證、編輯＋**儲存並關閉**、區間內換日、遮罩不可點外關）、**`clearUserCalendarDay`**／**`fetchUserDayActivityExtrasInRange`**
- `[FEAT]` **`/today?date=`**：**`TodayPageClient`**；**`useTodayChecklist(date)`**；**`TodayChecklist`** **`readOnly`**／**`ChecklistStampCard` `readOnly`**（檢視不灰隱）；統計卡移除「⋯」
- `[DOCS]` **本文件**與 **README**：路由表、**個人記錄**整節、`hooks`／`lib/supabase` 表、今日檢核 bullet；**v0.10.34** 沿革 `/profile` 敘述改為 **`ProfileRecordsSection`**（取代已併入之 **`ProfileDailyStats`** 獨立區塊）

### [2026-03-22] v0.10.49 — 個人頁：五卡、分數表／SDG 雙欄、個人各項完成率

- `[FEAT]` **`/profile`**：移除 **`ProfileLeaderboardSummary`**；**`ProfileChartsSection`** 改為頂部 **五卡**（累計得分、打卡天數、最長 streak、SDG 覆蓋幾項、單日最高 SDG 覆蓋數）、**分數表＋SDG** 白底 **`lg:grid-cols-2`**（對齊全體榜）；刪除原**打卡密度／熱力**區塊（後續 **v0.10.50** 以 **`ProfileRecordsSection`** 擴充分頁與每週表）
- `[FEAT]` 個人各項完成率（初版 **`ProfileActionCompletionSection`**，後合併為 **`ProfileRecordsSection`**）：**`useProfileActionCompletionStats`**＋**`20260322200000_profile_action_completion_rpcs.sql`**；密度格 **有打卡綠／無白**（後改深綠 **#849B6D**）
- `[FEAT]` **`fetchUserProfileCharts`** 增 **`summaryTop`** 供五卡
- `[DOCS]` 路由／個人記錄條目與 RPC 表補 **`20260322200000`**

### [2026-03-22] v0.10.48 — 修復首頁與 `/today` 循環跳轉

- `[FIX]` **`app/page.tsx`**：已登入改由**伺服端** `createClient()` + **`getUser()`** 後 **`redirect('/today')`**；刪除 **`HomeAuthRedirect`**（客戶端 **`getSession()`** 與 **`(app)/layout`** 的 **`getUser()`** 不一致時會 **`/` ↔ `/today` 瘋狂跳轉**）
- `[DOCS]` 路由表 **`/`** 列補充說明

### [2026-03-22] v0.10.47 — 移除 `/login` 路由

- `[ARCH]` 刪除 **`app/login/`**（`page.tsx`、`LoginClient.tsx`）；登入僅能於首頁 **`HomeGoogleStartButton`** 觸發 OAuth
- `[DOCS]` 「路由與登入保護」表移除 `/login`；補 **Supabase Redirect URLs** 不需 `/login` 之說明

### [2026-03-22] v0.10.46 — 未登入導向首頁、OAuth 失敗於首頁提示

- `[FEAT]` **`app/(app)/layout.tsx`**：未登入改 **`redirect('/')`**，不再強制 **`/login`**
- `[FEAT]` **`/auth/callback`** 失敗改導 **`/?error=auth`**；新增 **`HomeAuthErrorBanner`**（`Suspense` 包 `useSearchParams`）於首頁顯示「登入失敗，請重試。」
- `[DOCS]` 「路由與登入保護」表與說明同步

### [2026-03-22] v0.10.45 — 資料庫：wipe 腳本說明入 INSTRUCTIONS

- `[DOCS]` **資料庫規範**：新增 **「開發／測試：清空業務資料並重設公版（`wipe_and_reseed.sql`）」**——`TRUNCATE` 範圍、與 migration 對齊、SQL Editor 執行 **`begin`～`commit`**、**選用** `delete from auth.users`（須另開查詢、非必跑）、本機 **`supabase db reset`**、Storage 未清除之提醒

### [2026-03-22] v0.10.44 — 熱門行動文件（資料來源、與分數表區隔）

- `[DOCS]` **熱門行動統計卡**：補 **怎麼算**（`daily_checkins`＋公版／自訂 `title` 聚合、`union all`、`limit 1`）、**本群** `rpc_group_hot_actions`、**與分數表不同維度**、**為何卡上不顯示誰打卡**（聚合／他成員／種子／歷史）；RPC 表補 **`20260322180000_group_hot_actions_rpc.sql`**

### [2026-03-22] v0.10.43 — 分數表折線、原始分彙總、`INSTRUCTIONS` 對齊

- `[FEAT]` **分數表**：`GlobalDailyCompletionBars` 改 **SVG 折線＋面積**；全體／本群 **`aggregateFromStats`** 按日加總 **`raw_score`**（回傳欄位名仍為 `dailyCompletions`，型別註解標明語意）；個人頁改餵 **`dailyScores`**
- `[FEAT]` 圖表寬度 **`ResizeObserver`** 填滿卡片；X 軸 **`M/d`**、每日標籤；文案與 tooltip 統一「**分**」，副標說明「原始分加總」
- `[FEAT]` SDG 行動分布：**白底卡**、藥丸 **`SDG n`＋中文**、軌道 **`--color-surface`**
- `[DOCS]` 本文件：排行榜／個人記錄／Realtime／Layout 表與「分數」維度用語區隔；**v0.10.29** 條目曾記「移除每日分數折線」為當時狀態，現已以分數表折線與 **`raw_score`** 彙總實作

### [2026-03-22] v0.10.42 — 排行榜頭像、完成率日期浮層、文件對齊

- `[FEAT]` **`UserPeriodAgg.photoUrl`**：榜單聚合改 **`fetchUserProfileMap`**（`users.nickname` + **`photo_url`**）；**全體／群組內主列表**與 **`GroupMemberCountBars`** 有 URL 則顯示圓形頭像（`referrerPolicy="no-referrer"`），否則暱稱首字
- `[FIX]` **`GlobalActionCompletionSection`**：**自訂**欄圖示與文字改 **橫排**；日期區間面板改 **`absolute` 浮層**，避免推擠下方版面；自訂選中態移除額外 **ring**（與其他欄視覺一致）
- `[DOCS]` 「全體排行榜」補頭像與 **`GlobalActionCompletionSection`**（四欄、浮層月曆、SDG、完成者 **`avatar_url` 選用 migration**）；RPC 表補 **`20260322150000`**、**`20260322163000`**

### [2026-03-22] v0.10.41 — 總加權圖表卡白底、各項完成率獨立期間

- `[FEAT]` 全體榜總加權專區第一圖表卡改 **白底**（後續 v0.10.43 該卡定名「**分數表**」並改折線圖）；**`GlobalActionCompletionSection`** 內建 **今日／本週／本月** 選擇器（**`ActionCompletionPeriod`**，與頁面頂部榜單期間分離），RPC／密度圖依 **`getActionCompletionDateBounds`**、**`resolveHeatmapLayoutForActionCompletion`**；`leaderboardActionHeatmap` 增 `*ForRange` 與舊 **`LeaderboardPeriod`** 包裝並存；**`useGlobalActionCompletionStats`** 改接 **`ActionCompletionPeriod`**
- `[DOCS]` 全體排行榜「總加權圖表」小節與 Changelog

### [2026-03-22] v0.10.40 — 行動完成率 Realtime、自訂列含「僅列入」

- `[FEAT]` **`useGlobalActionCompletionStats`**：`GlobalActionCompletionSection` 資料改由此 hook 載入；登入時訂閱 **`daily_checkins`、`user_daily_custom_items`、`user_daily_stats`** 並 silent refetch
- `[DB]` **`20260322142000_custom_title_stats_include_list_only.sql`**：`rpc_leaderboard_custom_title_stats` **full outer join** 列入清單與打卡；期間內曾列入今日、尚無打卡之標題亦出列（**0%**）
- `[DOCS]` Realtime：建議將 **`user_daily_custom_items`** 加入 publication；監聽對象表與全體排行榜 bullet 補充「非所有區塊監聽同一張表」之說明

### [2026-03-22] v0.10.39 — 自訂完成率分母、公版 resync、NaN 相容

- `[DB]` **`20260322141000_custom_title_stats_list_days.sql`**：`rpc_leaderboard_custom_title_stats` 回傳 **`on_list_days`**；自訂（依標題）完成率分母＝**列入今日清單人日**（`user_daily_custom_items`）
- `[DB]` **`20260322140000_resync_default_checklist.sql`**：系統預設公版 **10 筆**與單一 `is_default` 範本；停用同範本多餘項目；`get_user_template_id` 優先固定預設範本 UUID
- `[FIX]` **`lib/supabase/leaderboardActionHeatmap`**：自訂統計列 **向下相容舊 RPC**（無 `on_list_days` 時以 `period_days×active_users` 填分母並設 `legacyListDenominator`）；**`safeNonNeg`** 避免 **NaN／undefined** 顯示
- `[FEAT]` **`GlobalActionCompletionSection`**：舊分母時副標提示套用 `20260322141000` migration
- `[DOCS]` 排行榜「行動完成率」小節：公式、**依標題彙總**範例（不同 `custom_item_id`、相同 title 併列）、RPC 表補 **22140000／22141000**

### [2026-03-22] v0.10.38 — 總加權專屬圖表區、行動密度、SDG 卡拆解

- `[FEAT]` 全體統計卡：SDG 覆蓋最高副標改 **`N=…（相異）+ M=…（單日最多）＝合計`**；熱門行動改 **`rpc_global_hot_actions` 僅取第 1 名**（`topHotAction`）
- `[FEAT]` **每日完成柱狀／SDG 分布／行動完成率＋密度圖**僅在 **「總加權」**子 Tab 顯示（柱狀後續於 v0.10.43 改為**分數表折線**）；`fetchGlobalLeaderboardCharts`／`fetchGroupLeaderboardCharts` 支援 **`includeWeightedCharts`**
- `[FEAT]` 移除熱門行動 Top 5 表；改 **`GlobalActionCompletionSection`**（公版＋自訂標題、展開 GitHub／月曆／週視圖密度、點格彈窗＋佐證圖／照片牆）；**`lib/utils/heatmapLayout.ts`** 共用版面
- `[DB]` **`20260322123000_leaderboard_action_density_rpcs.sql`**（與 `20260322120000_leaderboard_group_members_rpc.sql` 檔名區隔）
- `[DOCS]` 全體／群組內排行榜小節、RPC 表、Layout 表、Changelog

### [2026-03-22] v0.10.37 — 各群間四卡、移除橫條圖、SDG 依期間標示

- `[FEAT]` **各群間**統計列改 **四卡**（參與群組數、平均原始分、**依選定時間**之 SDG 覆蓋最高、平均 Streak Tier 加成最高）；卡標題／說明標註 **`periodScopeLabel`**
- `[FEAT]` `fetchGroupsLeaderboard` 回傳 **`topAvgTier`**；移除 **`chartTopByScore`／`chartTopBySdg`**
- `[FEAT]` 刪除各群間「各群組平均分／SDG 覆蓋（前 8）」UI；`LeaderboardViz` 移除 **`GroupsAvgScoreBars`**、**`GroupsSdgBars`**
- `[DOCS]` 「群組 vs 群組」、UI Layout 表與本 Changelog

### [2026-03-22] v0.10.36 — 排行榜主列表分頁（每頁 20）

- `[FEAT]` 全體／群組內／各群間主列表：`pageRankedUsers`／`pageRankedGroups`；`fetch*` 回傳 `page`／`pageSize`／`totalPages`；`LeaderboardShell` 分頁列與觸控友善按鈕
- `[FEAT]` 各群間：統計卡 `topAvgRaw`／`topSdg` 與全榜一致（後續 v0.10.37 改四卡並移除橫條圖）
- `[FEAT]` 群組內：`memberBarRows`（**完成項數**前 12）供小圖，與主列表分頁無關
- `[DOCS]` `LEADERBOARD_LIMIT` 語意、排行榜設計一句與本 Changelog

### [2026-03-22] v0.10.35 — 群組榜在 RLS 下讀齊成員（RPC）

- `[FIX]` `[DB]` **`gm_select` 僅本人列**導致群組內榜只算到自己、各群間榜 **`totalGroups` 等於 1**、私人群組無法從客戶端讀到群名成員表：新增 **`rpc_group_member_user_ids`**、**`rpc_leaderboard_group_rows`**（`20260322120000_leaderboard_group_members_rpc.sql`）
- `[FIX]` `lib/supabase/leaderboard.ts`：`fetchGroupMemberIds` 改走 RPC；`fetchGroupsLeaderboard`／`fetchPersonalLeaderboardSnapshot` 改以 `rpc_leaderboard_group_rows` 組 `membersByGroup` 與群組 meta（不再依賴可被 RLS 截斷的 `group_members`／`groups` 全表 select）
- `[FIX]` `lib/supabase/leaderboardAnalytics.ts`：群組圖表共用 **`fetchGroupMemberIds`**
- `[DOCS]` 「排行榜／分析用 RPC」表與本 Changelog

### [2026-03-22] v0.10.34 — 未 commit 變更與文件對齊

- `[DOCS]` **路由與登入**：`/auth/callback` 失敗時導向（後於 v0.10.46 改為 `/?error=auth`）；`/profile` 路由列改為 `ProfileForm` + `ProfileAnalyticsShell`（`LeaderboardPeriodBar`、`ProfileChartsSection`；後於 v0.10.49 移除 `ProfileLeaderboardSummary`、增完成率區；**v0.10.50** 起 **`ProfileRecordsSection`** 併每週紀錄／填寫紀錄，**`ProfileDailyStats`** 不再獨立掛載）
- `[DOCS]` **分層職責**：`hooks/` 補齊排行榜相關 hook；`lib/utils` 範例補 `leaderboardPeriod.ts`；**資料庫**新增「排行榜／分析用 RPC」表（含 `rpc_leaderboard_user_sdg_goals`、`rpc_leaderboard_user_checkin_split` 等四個 migration 檔）
- `[DOCS]` **README**：本地資料庫步驟補上述四個 RPC migration；功能表「個人資料」一行與實作對齊
- `[FIX]` **`AppShell`**：主內容外層與 page 容器加 **`min-w-0`**，避免 flex 版面橫向溢出
- `[DB]` `20260321000000_initial.sql`：系統預設公版 `checklist_items` seed 改為 **10 筆**（標題／說明／`sdg_ids` 更新）

### [2026-03-21] v0.10.33 — 手機熱力橫向滑動、五階色階

- `[FIX]`「至今」熱力：`md` 以下 **`overflow-x-auto`**、週欄 **`w-3` shrink-0**；`md+` 維持 **`flex-1`** 與卡片同寬
- `[FEAT]` 打卡密度改 **五階**（無／少／一半／多／全完成）：`heatLevel` 依 **`total_items` 完成比例**個人化；圖例改為對應 **`HEAT_BG`** 之語意標籤
- `[DOCS]` **個人記錄**色階與至今手機捲動、本 Changelog

### [2026-03-21] v0.10.32 — 至今熱力圖與同區同寬

- `[FIX]` `ProfileChartsSection`「至今」GitHub 熱力：週欄 **`flex-1` 均分全寬**、`HeatCell` **`fluid`**（`aspect-square`）取代固定 10px，與上方摘要卡／本週／本月同寬
- `[DOCS]` **個人記錄**至今熱力版面一句、本 Changelog

### [2026-03-21] v0.10.31 — 今年完整熱力、摘要卡、統一 tooltip

- `[FEAT]` `getYearEndString`；選「至今」時熱力圖改為 **今年 1/1～12/31** 完整曆格；統計摘要三卡（累計得分、打卡天數、最長 streak）；各視圖方格 **hover** 為 `M/d · N 項完成 · 分`
- `[FIX]` 至今 GitHub 熱力：**月份列與週欄改為同一個 CSS Grid**（`grid-template-columns: 1.25rem repeat(N, minmax(0.75rem, 1fr))`），避免頂列與格子兩段 `flex` 各自 `flex-1` 造成月份標籤與欄位錯位
- `[DOCS]` **個人記錄**打卡密度段落與本 Changelog

### [2026-03-21] v0.10.30 — 打卡密度跑版、今年至今、本週邊框

- `[FIX]` `ProfileChartsSection`：本月 **表頭與格子同寬**（移除格子單獨 `max-w`）；至今熱力區 **`min-w-0` + padding**；本週「今日」改 **ring-inset** 並避免 flex 擠壓（`shrink-0`）
- `[FEAT]` `fetchUserProfileCharts`（`period === "all"`）：圖表／熱力／SDG 區間改為 **今年 1/1～今日**（`getYearStartString`）；`ProfileAnalyticsShell` 補充與榜單「至今」差異說明
- `[DOCS]` **個人記錄**：打卡密度版面約束、至今＝今年至今；本 Changelog

### [2026-03-21] v0.10.29 — 個人打卡密度 UI 與文件

- `[FEAT]` `ProfileChartsSection`：本週改為 **七日卡**（僅 **N 項**）；本月為 **月曆格**（格內顯示項數）；至今為 **GitHub 式小格**＋**頂列月份標籤**（格內不顯示項數）；共用色階圖例
- `[DOCS]` `INSTRUCTIONS.md`：路由／認證／**個人記錄**與 `/profile` 圖表規格與實作對齊；當時移除獨立「每日分數折線」區塊之描述（後續 **v0.10.43** 以總加權／個人 **分數表** 折線與 **`raw_score`** 彙總回補）

### [2026-03-21] v0.10.28 — 排行榜章節狀態標示對齊實作

- `[DOCS]` 「排行榜設計」：群組內／群組 vs 群組改為 `[done]`；個人記錄改為 `[部分完成]`（streak 專區仍 `[planned]`）；補充狀態標示說明段落

### [2026-03-21] v0.10.27 — 排行榜／個人圖表與分析 RPC

- `[DB]` migration `20260321220000`：`rpc_global_sdg_distribution`、`rpc_global_hot_actions`、`rpc_my_sdg_distribution`（SECURITY DEFINER）
- `[FEAT]` `lib/supabase/leaderboardAnalytics`、`leaderboardPeriod`；`fetchGroupPeriodStats`；`fetchUserDailyStatsInRange`；`LeaderboardViz`；`ProfileChartsSection`；`useGlobalLeaderboardCharts`、`useGroupPeriodStats`
- `[FEAT]` 全體：統計四格、每日完成柱狀、SDG 分布、熱門行動（後續 v0.10.38 改總加權專屬圖表區與行動密度；v0.10.43 柱狀改**分數表折線**與 **`raw_score`** 彙總）；群組內／各群間補齊統計與橫條圖
- `[DOCS]` 「排行榜設計」、UI/UX Layout、`lib/supabase` 說明與本 Changelog

### [2026-03-21] v0.10.26 — 排行榜四視角（全體／群組內／各群間／個人）

- `[FEAT]` `lib/supabase/leaderboard`：`fetchGroupMemberLeaderboard`、`fetchGroupsLeaderboard`（群組間平均標準化分等聚合）、`fetchPersonalLeaderboardSnapshot`；`lib/utils/leaderboard`：`rankAllUsers`、`computeWeightedRanksForGroups`
- `[FEAT]` `LeaderboardShell`：主視角切換、時間範圍、子 tab、質感列表（名次色圈、進度條）；`hooks`：`useGroupMemberLeaderboard`、`useGroupsLeaderboard`、`usePersonalLeaderboard`
- `[DOCS]` 「排行榜設計」四視角狀態與本 Changelog

### [2026-03-21] v0.10.25 — 群組 UI：信箱 chips、建立者刪除群組、Toast 置頂

- `[FEAT]` `ToastProvider`：toast 顯示於畫面上方（`fixed top`）
- `[FEAT]` `EmailChipsInput`：受邀信箱以 chip 輸入，Enter／逗號新增，多筆換行；`GroupHub` 串接並以換行合併送 `createGroupEmailInvites`
- `[FEAT]` `GroupHub`：群組下拉選單樣式強化；已達「每人僅一群」時「建立群組」「邀請碼加入」可 **收合**：預設僅顯示鎖頭＋說明，點擊展開預覽停用表單
- `[FEAT]` 建立者於「我的群組」可 **刪除群組**（`DeleteGroupDialog` 須輸入完整群組名）；`lib/supabase/groups.deleteGroup` + `useGroups.deleteGroup`
- `[DOCS]` 本 Changelog

### [2026-03-21] v0.10.24 — 每人僅一群、Toast、多信箱邀請

- `[FEAT]` `group_members (user_id)` 唯一索引；RPC `already_in_group`；`createGroup` 前檢查；`GroupHub` 區塊與邀請接受／公開加入之限制
- `[FEAT]` `ToastProvider` + `useToast`；群組成功／錯誤改為 toast
- `[FEAT]` 信箱邀請：`parseInviteEmails` + `createGroupEmailInvites` 批次；`textarea` 多筆；`select` 樣式（`appearance-none` + `ChevronDown`）
- `[DOCS]` 系統功能規格「群組」、`context`/`lib/utils`、資料表摘要與本 Changelog

### [2026-03-21] v0.10.23 — 公開群組已加入時顯示「已加入」

- `[FEAT]` `GroupHub`：公開群組列若已在「我的群組」中，改顯示 **已加入**（非「加入」按鈕）
- `[DOCS]` 本 Changelog

### [2026-03-21] v0.10.22 — 群組 RLS／查詢與文件對齊

- `[DOCS]` 系統功能規格「群組」、`lib/utils` 說明、**RLS 範例**（`group_members` 政策名與 `gm_join_public`／`gm_creator_insert` 與 `initial.sql` 一致；註明勿與舊 `"members read"` 並存）
- `[DOCS]` 本 Changelog

### [2026-03-21] v0.10.21 — 移除舊名 "members read" 與 gm_select 並存

- `[FIX]` `[DB]` migration `20260321170000`：`drop policy "members read" on group_members`。舊政策為 `group_id IN (SELECT … FROM group_members …)`，與 **`gm_select`** 並存時仍會觸發 **infinite recursion**（與是否已改 listMyGroups 無關）
- `[DOCS]` `supabase/diagnostics/check_group_rls.sql` 註解

### [2026-03-21] v0.10.20 — listMyGroups 拆成兩次查詢（避免 PostgREST 嵌套 RLS 重入）

- `[FIX]` `listMyGroups`：**不再**使用 `group_members` 嵌套 `groups` 單一 select；改為先查 `group_members` 再 `groups.in('id', …)` 合併。否則同一請求內會先評估 `gm_select`、再評估 `groups.g_select`（含 `EXISTS` 查 `group_members`），PostgreSQL 會視為對 `group_members` 政策的 **infinite recursion**（與函式是否已刪除無關）
- `[DOCS]` 本 Changelog

### [2026-03-21] v0.10.19 — groups 政策不再使用 user_is_member_of_group 函式

- `[FIX]` `[DB]` **`groups.g_select`** 改為 `is_public OR created_by = auth.uid() OR EXISTS (…group_members…)`，**刪除** `user_is_member_of_group()`（巢狀查詢／PostgREST embed 時函式內再查 `group_members` 仍可能觸發 **infinite recursion**）。**`created_by`** 確保創私人群後、尚未寫入成員列前仍能讀到群組。migration：`20260321160000_groups_policy_no_function.sql`
- `[DOCS]` RLS 範例與本 Changelog

### [2026-03-21] v0.10.18 — gm_select 僅本人列（終止遞迴）

- `[FIX]` `[DB]` **`gm_select`** 改為**僅** `auth.uid() = user_id`，**移除** `OR user_is_member_of_group(group_id)`（評估他人列時仍會進入函式再查 `group_members` → 遞迴）。是否為成員改由 **`groups.g_select`** 使用 `user_is_member_of_group(id)`；函式內 EXISTS 只命中自己的列。migration：`20260321150000_gm_select_self_only.sql`；診斷用 SQL：`supabase/diagnostics/check_group_rls.sql`
- `[DOCS]` RLS 範例、**群組內排行榜 view** 若需掃全體成員須改 **SECURITY DEFINER**／RPC（見 migration 註解）
- `[DOCS]` 本 Changelog

### [2026-03-21] v0.10.17 — group_members RLS 遞迴（補強）

- `[FIX]` `[DB]` `user_is_member_of_group` 增加 **`SET row_security = off`**（Supabase 上否則函式內 SELECT 仍會套用 RLS）；**`groups.g_select`** 改為 `is_public OR user_is_member_of_group(id)`，**不再**使用 `id IN (SELECT … FROM group_members …)`，避免與 `gm_select` 形成第二條遞迴鏈。補檔：`20260321140000_group_members_rls_supplement.sql`（可重複執行）；`20260321130000`／`initial.sql` 已同步
- `[DOCS]` RLS 範例與本 Changelog

### [2026-03-21] v0.10.16 — 修正 group_members RLS 無限遞迴

- `[FIX]` `[DB]` `gm_select` 改為 `auth.uid() = user_id OR user_is_member_of_group(group_id)`；新增 `user_is_member_of_group(uuid)`（`SECURITY DEFINER`，內部查詢略過 RLS，避免政策內再查 `group_members` 造成 **infinite recursion**）。migration：`20260321130000_fix_group_members_rls_recursion.sql`；`20260321000000_initial.sql` 已同步供新環境
- `[DOCS]` RLS 範例段落與本 Changelog

### [2026-03-21] v0.10.15 — 群組頁錯誤顯示、信箱邀請與待處理邀請

- `[FIX]` `useGroups`：Supabase 錯誤非 `Error` 實例時改以 `toErrorMessage` 解析，避免整頁顯示 `[object Object]`
- `[FEAT]` `group_invitations` + RPC：建立者發送信箱邀請、列出待處理邀請、受邀者接受／拒絕（JWT email 與受邀信箱須一致）
- `[FEAT]` `GroupHub`：待處理邀請區、建立者「以信箱邀請成員」、邀請碼輸入限制長度與字元、公開／私人加入結果訊息；`listMyGroups` 補 `created_by` 以辨識建立者
- `[DOCS]` 「群組」規格、資料表摘要與本 Changelog

### [2026-03-21] v0.10.14 — 輸入一鍵清除、常用連結今日後重置表單

- `[FEAT]` `AddCustomForm`：標題輸入有內容時顯示 **X** 一鍵清除；從即時列表「連結今日」成功後清空標題並重置 SDG／「同時常用」勾選（與新增成功一致）
- `[FEAT]` `FavoritesPanel`：搜尋收藏輸入有內容時顯示 **X** 一鍵清除
- `[DOCS]` 本 Changelog

### [2026-03-21] v0.10.13 — 新增輸入框即時常用列表（同收藏卡片列）

- `[FEAT]` `AddCustomForm`：輸入與搜尋框一體化；即時篩選常用並以與 `FavoritesPanel` 一致之卡片呈現；支援編輯／刪除快捷
- `[DOCS]` 「自訂行動」子項與本 Changelog

### [2026-03-21] v0.10.12 — 新增標題與常用「完全相同」去重

- `[FEAT]` `AddCustomForm`：完全相同時優先提示／使用既有常用；主按鈕改為連結今日；部分符合列表與完全相同區塊分離；placeholder 說明比對邏輯
- `[DOCS]` 「自訂行動」子項與本 Changelog

### [2026-03-21] v0.10.11 — 自訂編輯、表單 UX、常用快速比對

- `[FEAT]` `updateCustomItem`（Supabase）；`EditCustomItemDialog`；今日自訂列／常用列編輯鈕；`AddCustomForm` 直接顯示「同時常用」勾選、主副鈕約 7:3 與圖示、輸入時比對常用並快速加入今日
- `[DOCS]` 「自訂行動」、分層職責、`lib/supabase/checklist` 說明與本 Changelog

### [2026-03-21] v0.10.10 — 自訂／收藏合併單卡、移除手機 V 按鈕

- `[FEAT]` `TodayChecklist`：移除手機 V 形捲動按鈕；`AddCustomForm`／`FavoritesPanel` 支援 **`embedded`**，包於同一 `section#gg-custom-favorites-section`
- `[DOCS]` 「主畫面 — 今日檢核」、**UI/UX → Layout** 檢核表列與 v0.10.9 描述對齊（不再寫 V 形按鈕／雙卡片）

### [2026-03-21] v0.10.9 — 今日檢核 UX 與文件對齊（大圖、區塊順序、收藏管理）

- `[DOCS]` **主畫面 — 今日檢核**：補充 `ImageLightbox` 檢視佐證；拖曳上傳改標 **`[未實作]`**（與檔案選擇／大圖檢視分離，符合大項子項標記規範）。**註：** 後續 UI 已改為單卡合併自訂／收藏並移除 V 按鈕，見 **v0.10.10**
- `[DOCS]` **自訂行動**：`AddCustomForm` 以 `<details>` 收合「常用收藏（選填）」；`FavoritesPanel` 搜尋／刪除；`unlinkCustomItemFromToday`／`deleteCustomItemById` 與 `ConfirmDialog`
- `[DOCS]` **技術棧** Storage 一行、**資料庫 Storage** 路徑說明、**分層職責** `components/ui` 範例、**UI/UX** 檢核表列與**空狀態**搜尋無結果

### [2026-03-21] v0.10.8 — 常用清單、打卡照片、排行榜參與人數、個人近況

- `[FEAT]` 今日檢核：`AddCustomForm` 區分「加入今日」／「僅存入常用」；`FavoritesPanel` 常用收藏與「加入今日」；`useTodayChecklist` 串 `fetchFavoriteCustomItems`／`linkCustomItemToToday`／`uploadCheckinPhotoFile`；`ChecklistStampCard` 外層容器＋已完成時佐證上傳列
- `[FEAT]` 全體排行榜：`fetchGlobalLeaderboard` 回傳 `{ rows, totalParticipants }`，`GlobalLeaderboardPanel` 顯示本期參與人數
- `[FEAT]` `/profile`：`ProfileDailyStats` 近 14 天每日統計表格（`fetchUserDailyStatsRecent`）（**已於後續版本**併入 **`ProfileRecordsSection`「每週紀錄」**＋區間 `fetchUserDailyStatsInRange`，**`ProfileDailyStats` 元件**未再掛載於 shell）
- `[DOCS]` 系統功能規格／排行榜／個人記錄／空狀態與本 Changelog 對齊現況

### [2026-03-21] v0.10.7 — INSTRUCTIONS 補齊與現況對齊

- `[DOCS]` 新增「路由與登入保護」、技術棧（Next 16／React 19／PWA 套件）、`hooks`／`lib/supabase` 檔案清單
- `[DOCS]` 認證與使用者改 `[done]`；`users` 補 `onboarding_completed`；排行榜「群組內／群組 vs 群組／個人記錄」標示 `[planned]` 與現況說明
- `[DOCS]` PWA 改為 `@ducanh2912/next-pwa` + `next.config.ts`；字體 Noto Sans TC；動畫與 `prefers-reduced-motion` 與實作一致；空狀態／Layout 表與實作對齊

### [2026-03-21] v0.10.6 — 資料庫 sdgs 與前端 SDG_COLORS 對齊

- `[DB]` `public.sdgs` 之 `color`／`text_color`／`label` 改為與 `constants/sdg.ts` 一致（半透明底 + 深色字）；新增 migration `20260321120000_sdgs_tag_colors.sql`；初始 seed 同步
- `[DOCS]` 資料庫規範 `sdgs` 欄位說明

### [2026-03-21] v0.10.5 — SDG 標籤配色與顯示模式

- `[FEAT]` `SDG_COLORS`（半透明底＋深色字＋`label`）；`SdgTag` 支援 `showLabel`；`ChecklistStampCard`／`ChecklistRow` 支援 `sdgShowLabel`
- `[DOCS]` 「SDG Tag 顏色」與本 Changelog

### [2026-03-21] v0.10.4 — 全完成慶祝僅限當次操作打滿

- `[FEAT]` `useTodayChecklist` 新增 `fullCompletionCelebrationTick`；僅在 toggle 成功且由未全滿→全滿時遞增；`TodayChecklist` 依此觸發撒花／overlay，**初次讀取已全完成不觸發**
- `[DOCS]` 「主畫面 — 今日檢核」與本 Changelog

### [2026-03-21] v0.10.3 — 蓋章 Leaf／動效加強／文件規範

- `[FEAT]` 今日檢核蓋章與全完成 overlay 改為 **lucide-react `Leaf`**（與 `BrandMark` 一致）；修正 `.gg-stamp-particle-dot` 被重複定義覆寫導致粒子動畫變弱之問題；整體動畫時長縮短、幅度略加大；全完成 overlay **1500ms** 自動關閉；撒花／overlay 進場 **280ms → 850ms**
- `[DOCS]` 文件開頭與「開發者文件維護規範」：訂明 **重要更動（資料庫、功能等）必須更新文件**；Changelog 與「主畫面 — 今日檢核」同步

### [2026-03-21] v0.10.2 — 今日檢核動效對齊參考 HTML

- `[FEAT]` 全完成改為 **DOM 彩帶**（移除 canvas-confetti）；時序 400ms 撒花 → 1100ms overlay；overlay **1000ms** 自動關閉；半程 toast 深色膠囊；統計列字級／進度條／tier 徽章對齊參考稿（`TodayChecklist`、`globals.css`）
- `[FEAT]` 全站主字型改 **Noto Sans TC**（`app/layout.tsx`）
- `[DOCS]` 「主畫面 — 今日檢核」與本 Changelog

### [2026-03-21] v0.10.1 — 今日檢核蓋章與慶祝動效

- `[FEAT]` 今日檢核：每列左側蓋章（落下／漣漪／粒子／列彈跳）、完成樣式與刪除線、半程 toast、全完成 overlay + confetti；頂部進度條與分數彈跳（`ChecklistStampCard`、`TodayChecklist`、`globals.css`）
- `[DOCS]` 本節「主畫面 — 今日檢核」改為反映上述已實作項目

### [2026-03-21] v0.10.0 — 首頁／載入／規格標記

- `[FEAT]` 未登入首頁改版：雙 CTA（「用 Google 開始」與錨點「先看玩法」）、玩法／理念區塊
- `[FEAT]` 首次登入暱稱引導（`onboarding_completed` migration）；`useTodayChecklist` 改為樂觀更新 + 靜默 refetch，減少全頁 skeleton 閃爍
- `[FEAT]` 排行榜 Realtime、群組操作後 refetch 改為 `silent`，避免整塊閃爍
- `[FEAT]` 移除今日檢核「小提示」側欄；`useProfile` / `useGroups` 併入 Auth loading
- `[DOCS]` INSTRUCTIONS：訂明 `[done]` 與子項規則；主畫面／群組／認證／自訂行動改為「部分完成」並補子項標記

### [2026-03-21] v0.9.0 — 核心 App 實作（MVP）

- `[FEAT]` 今日檢核：公版項目勾選、自訂行動（今日加入、SDG 多選、可選收藏）、完成動畫與全部完成 confetti（尊重 `prefers-reduced-motion`）
- `[FEAT]` Google 登入、`/auth/callback`、middleware 保護 `/today`、`/leaderboard`、`/groups`、`/profile`
- `[FEAT]` 全體排行榜：期間（週／月／累計）× 維度（總加權／分數／完成數／SDG 覆蓋）、Realtime 訂閱 `user_daily_stats`
- `[FEAT]` 群組：建立公開／私人（6 碼邀請碼）、加入／退出、RPC `join_public_group`／`join_private_group`
- `[DB]` 新增 `user_daily_custom_items`、觸發器更新 `user_daily_stats`、補充 `group_members` 建立者可加入自己群組之 RLS policy
- `[ARCH]` 分層：`lib/supabase/*`、`hooks/*`、`context/AuthContext`、`AppShell`（手機底欄／桌面側欄）
- `[ARCH]` PWA：`@ducanh2912/next-pwa`；`npm run build` 使用 `--webpack` 以相容 Next 16 預設 Turbopack
- `[DOCS]` 更新 README、本文件功能狀態標記與 Changelog

### [2026-03-21] v0.8.0 — UI/UX 與多裝置規範

- `[ARCH]` 新增「UI/UX 與多裝置規範」章節，為**強制規範**
- `[ARCH]` 確立三個斷點：手機（預設）、平板（md ≥ 768px）、桌面（lg ≥ 1024px），mobile-first 開發
- `[ARCH]` 確立各頁面在三種裝置的 layout 行為（導航、檢核表、排行榜、圖表）
- `[ARCH]` 觸控規範：可點擊元素最小 44×44px，點擊區域涵蓋整列，支援 swipe 切換 tab
- `[ARCH]` 動畫規範：時長 150–400ms，支援 `prefers-reduced-motion`
- `[ARCH]` 質感規範：圓角、邊框、間距、禁用陰影，對應設計系統
- `[ARCH]` 空狀態與 skeleton loading 為必要實作，不得留白或用 spinner
- `[ARCH]` 每次新增頁面必須在 390px / 768px / 1440px 三種尺寸確認

### [2026-03-21] v0.7.0 — PWA 與推播通知規範

- `[FEAT]` 確立 GoGreen 為 PWA，使用 `next-pwa` 套件，`manifest.json` 顏色對應設計系統
- `[FEAT]` 推播通知：每天晚上 8 點（台灣時間）固定發送，區分情況 A（完全未打卡）和情況 B（部分完成）
- `[FEAT]` 情況 A 通知內容：「🌿 今天還沒開始！完成一項行動，保住你的 streak 吧」
- `[FEAT]` 情況 B 通知內容：「🌿 今天還剩 N 項沒完成，繼續加油！」（N 為動態數字）
- `[DB]` 新增 `push_subscriptions` 資料表，儲存使用者推播訂閱資訊，含 RLS
- `[ARCH]` 推播由 Supabase Cron（UTC 12:00）觸發 Edge Function（`supabase/functions/send-reminder`）執行
- `[DOCS]` 新增「PWA 規範」與「推播通知規範」章節
- `[DOCS]` 開發者文件維護規範新增 PWA 和推播通知對應更新規則
- `[CONST]` 環境變數新增：`NEXT_PUBLIC_VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_MAILTO`

### [2026-03-21] v0.6.0 — 自訂行動常用收藏功能

- `[FEAT]` 自訂行動新增三種狀態：今日臨時新增、今日新增並收藏、直接新增到常用
- `[FEAT]` 新增常用清單：收藏的行動不自動出現今日，需手動加入；上限 `MAX_FAVORITE_ITEMS`
- `[FEAT]` 兩個新增入口：從今日清單新增（可選擇順便收藏）、直接在常用清單新增
- `[DB]` `custom_items` 表新增 `is_favorite boolean default false` 欄位
- `[CONST]` 新增 `MAX_FAVORITE_ITEMS=20`，`MAX_CUSTOM_ITEMS` 說明更新為「今日自訂項目上限」

### [2026-03-21] v0.5.0 — 新增 Realtime 規範

- `[FEAT]` 確立所有排行榜視角啟用 Supabase Realtime（全體、群組內、群 vs 群）
- `[DB]` 需將 `daily_checkins` 與 `user_daily_stats` 加入 `supabase_realtime` publication
- `[ARCH]` Realtime 訂閱邏輯統一寫在 `hooks/`，callback 只觸發 refetch，不在其中處理資料
- `[DOCS]` 新增「Realtime 規範」章節，說明免費版限制、各視角監聽對象、前端訂閱範本
- `[DOCS]` 排行榜設計 → 群組內排行榜補充「成員打卡狀態即時更新」說明
- `[DOCS]` 開發者文件維護規範新增 Realtime 與 Storage 對應更新規則

### [2026-03-21] v0.4.0 — 補充 Storage 規範

- `[DB]` 新增 Storage 章節：`checkin-photos` bucket、上傳路徑規則（`{user_id}/{日期}_{item_id}.jpg`）、完整 Policy SQL
- `[DB]` RLS Policy 修正：`insert, update, delete` 拆成獨立 policy，`insert` 改用 `with check`

### [2026-03-21] v0.3.0 — 專案命名與設計系統確立

- `[DOCS]` 專案正式命名為 **GoGreen**，全文件更新
- `[DOCS]` 新增「設計系統」章節，確立完整色盤與使用規則
- `[ARCH]` 色盤整合兩組橄欖綠 / 大地色系：底層 UI 色（`#F3F4EF` – `#97A177`）+ 主色系（`#E9F5DB` – `#718355`）
- `[ARCH]` CSS Variables 統一定義於 `app/globals.css`，禁止 component 層 hard-code 顏色
- `[ARCH]` 明確規範禁止漸變色（gradient），所有背景使用純色

### [2026-03-21] v0.2.0 — 完整系統規格確立

- `[ARCH]` 資料庫從 Firebase 改為 Supabase（PostgreSQL），原因見技術棧章節
- `[DB]` 確立完整資料表結構：`users` / `sdgs` / `checklist_templates` / `checklist_items` / `custom_items` / `groups` / `group_members` / `daily_checkins` / `user_daily_stats`
- `[DB]` 新增 `leaderboard_global` 與 `leaderboard_groups` View，供排行榜查詢使用
- `[DB]` 新增所有資料表的 RLS Policy
- `[FEAT]` 確立排行榜四個視角（全體、群組內、群 vs 群、個人）及四個子 tab（總加權、分數、完成數、SDG 覆蓋）
- `[FEAT]` 確立總加權採線性積分（第 1 名 N 分、第 2 名 N-1 分...），適合初期人數較少的場景
- `[FEAT]` 確立標準化分公式：`(完成項目數 / 總項目數) × 100 + streak tier 加成`
- `[FEAT]` 確立 streak tier 加成：1–6天 +5、7–13天 +15、14–29天 +30、30天+ +50
- `[FEAT]` 自訂行動得分與公版相同（`DEFAULT_ITEM_POINTS`），自訂行動 SDG 計入覆蓋排名
- `[FEAT]` 群組支援公開 / 私人兩種類型，私人群組需邀請碼（6 碼英數）
- `[FEAT]` 群組間排名使用平均標準化分，避免人多群組佔優
- `[CONST]` 新增 `constants/scoring.ts`：`DEFAULT_ITEM_POINTS=10`、`STREAK_TIERS`
- `[CONST]` 新增 `constants/config.ts`：`LEADERBOARD_LIMIT=20`、`MAX_CUSTOM_ITEMS=10`、`CUSTOM_ITEM_MAX_LENGTH=40`、`DAILY_RESET_HOUR=0`、`INVITE_CODE_LENGTH=6`
- `[DOCS]` 新增「技術棧選擇與理由」章節，記錄選用 Supabase 的決策背景

### [2026-03-20] v0.1.0 — 專案初始化

- `[ARCH]` 確立 Next.js App Router 專案分層架構（app / components / hooks / context / lib / constants / types）
- `[ARCH]` 定義五大架構原則（Page 只組裝、邏輯在 hooks、DB 操作封裝、Context 最小化、常數集中）
- `[DOCS]` 建立本開發指南，包含架構原則、commit 規範、文件維護規範

---

_下次更新請在此 section 最上方插入新紀錄，格式參考上方。_
