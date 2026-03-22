# GoGreen

把永續行動變成每天想打開的習慣。

GoGreen 是以聯合國 17 個 SDG 為核心的每日行動檢核 web app：完成公版或自訂行動、累積分數與連續天數、加入群組並在排行榜上互相激勵。

---

## 功能（實作狀態）

| 功能 | 說明 |
| --- | --- |
| 今日檢核 | 公版清單勾選、自訂行動（含 SDG、收藏）、連續天數與每日統計；可 **`/today?date=yyyy-MM-dd`** 檢視／編輯歷史日 |
| Google 登入 | Supabase Auth OAuth，登入後同步 `users`；首次進入 App 可確認暱稱（`onboarding_completed`） |
| 個人資料 | 暱稱；本週／本月／至今 **五卡**、**分數表／SDG**、**各項完成率／每週紀錄**（獨立區間）、**填寫紀錄**（補登他日）；與排行榜頂部期間對齊者僅五卡＋圖表區 |
| 群組 | 建立公開／私人（邀請碼）、加入公開群組、邀請碼加入私人、退出 |
| 全體排行榜 | 本週／本月／至今 × 四維度（總加權／分數／Streak Tier 加成／SDG 覆蓋），Realtime 訂閱 `user_daily_stats` |
| 群組內排行榜 | 成員排名與圖表（「總加權」時）；圖表下方 **群組紀錄**：**各項完成率**（本群彙總，同全體榜概念）、**每週紀錄**（唯讀；依日檢視成員清單，可左右換日） |
| PWA | `next-pwa` + `manifest.json`（正式建置使用 `npm run build --webpack`） |

其餘規格（群組 vs 群組、打卡照片 Storage、推播 Edge Function 等）見 [INSTRUCTIONS.md](./INSTRUCTIONS.md) 中 `[planned]`／`[tbd]` 標記。

---

## 技術棧

| 層級 | 工具 |
| --- | --- |
| 框架 | Next.js 16（App Router） |
| 資料庫／認證 | Supabase（PostgreSQL + Auth） |
| 樣式 | Tailwind CSS 4 |
| 狀態 | React Context + hooks |
| PWA | @ducanh2912/next-pwa |

---

## 本地開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 環境變數

```bash
cp .env.example .env.local
```

在 `.env.local` 填入 Supabase 專案的 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`（Dashboard → Settings → API）。

### 3. 資料庫

在 Supabase **SQL Editor** 執行：

`supabase/migrations/20260321000000_initial.sql`

若需首次登入暱稱引導，另執行 `supabase/migrations/20260321100000_user_onboarding.sql`。

排行榜統計／個人與群組圖表與 SDG 覆蓋排名另需執行（順序不拘，皆 idempotent）：

`20260321220000_leaderboard_analytics_rpc.sql`、`20260321230100_group_sdg_distribution_rpc.sql`、`20260321231000_leaderboard_user_sdg_goals_rpc.sql`、`20260321232000_leaderboard_user_checkin_split_rpc.sql`、`20260322120000_leaderboard_group_members_rpc.sql`、**`20260322123000_leaderboard_action_density_rpcs.sql`**（全體榜各項完成率密度）、**`20260322200000_profile_action_completion_rpcs.sql`**（個人頁「各項完成率」專用 RPC，僅 `authenticated`）、**`20260322310000_group_records_rpcs.sql`**（群組內榜「群組紀錄」區，僅 `authenticated`）等（函式與順序見 [INSTRUCTIONS.md](./INSTRUCTIONS.md)「排行榜／分析用 RPC」）。

完成後於 **Database → Replication**（或 SQL）將 `daily_checkins`、`user_daily_stats` 納入 Realtime publication（語句見 INSTRUCTIONS.md「Realtime 規範」）。

在 **Authentication → Providers** 啟用 **Google**，並將 Redirect URL 設為：

`https://<你的專案>.supabase.co/auth/v1/callback`（Supabase 預設）以及本機 `http://localhost:3000/auth/callback`（若使用本地開發）。

### 4. 啟動

```bash
npm run dev
```

瀏覽 [http://localhost:3000](http://localhost:3000)。

### 5. 正式建置

Next.js 16 預設使用 **Turbopack** 建置，但 `@ducanh2912/next-pwa` 會注入 **webpack** 設定，若直接執行 `next build`（沒加 `--webpack`）會失敗。

請務必使用腳本（已內含 `--webpack`）：

```bash
npm run build
# 或
yarn build
```

**請勿**執行 `npx next build` 或 `yarn next build`（除非自行加上 `--webpack`）。

若終端機出現「multiple lockfiles」警告：你在家目錄 `C:\Users\User\` 另有 `package-lock.json` 時，Next 可能誤判根目錄；本專案已在 `next.config.ts` 設定 `outputFileTracingRoot` / `turbopack.root` 鎖定本 repo。若仍異常，可將家目錄多餘的 lockfile 移開或刪除（確認不是其他專案需要後再動）。

若出現 **`Can't resolve 'tailwindcss' in 'C:\...\Desktop'`**：同樣是根目錄誤判。請在 **go-green 資料夾內** 執行 `npm run dev`（已使用 `--webpack`），並確認 `next.config.ts` 內 `turbopack.resolveAlias` 已存在；根本解法仍是避免在 `C:\Users\User\` 放與本專案無關的 `package-lock.json`。

---

## 專案結構

```
app/                 # 路由與 layout（頁面僅組裝）
components/          # UI 與功能區塊
context/             # Auth 等跨頁狀態
hooks/               # 業務邏輯與資料載入
lib/supabase/        # Supabase 唯一操作入口
lib/utils/           # 純函式（日期、排行榜加權等）
constants/           # 常數與 SDG 定義
supabase/migrations/ # SQL migration
```

完整規範見 [INSTRUCTIONS.md](./INSTRUCTIONS.md)。

---

## License

MIT
