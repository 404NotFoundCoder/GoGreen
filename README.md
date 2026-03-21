# 🌿 GoGreen

> 把永續行動變成每天想打開的習慣。

GoGreen 是一個基於聯合國 17 個 SDG 永續發展目標的每日行動檢核 web app。
每天完成公版或自訂的永續行動、累積分數、加入群組，和朋友一起為地球做點什麼。

---

## 功能

- **每日檢核** — 完成公版 10 項永續行動，支援打卡照片上傳
- **自訂行動** — 新增個人永續行為，可標記對應 SDG 目標
- **Streak 系統** — 連續打卡天數累積獎勵加成
- **群組** — 建立公開或私人群組，設定專屬公版清單
- **排行榜** — 全體、群組內、群組 vs 群組，四個維度（總加權 / 分數 / 完成數 / SDG 覆蓋）自由切換
- **個人記錄** — 打卡日曆、SDG 覆蓋分布、分數趨勢

---

## 技術棧

| 層級          | 工具                          |
| ------------- | ----------------------------- |
| 框架          | Next.js 14（App Router）      |
| 資料庫 / 認證 | Supabase（PostgreSQL + Auth） |
| 樣式          | Tailwind CSS                  |
| 狀態管理      | React Context + custom hooks  |
| 儲存          | Supabase Storage              |
| 部署          | Vercel                        |

---

## 本地開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

複製範本並填入你的 Supabase 金鑰：

```bash
cp .env.example .env.local
```

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=        # Supabase 專案 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
```

> 金鑰在 Supabase 後台 → Settings → API 取得。

### 3. 初始化資料庫

在 Supabase SQL Editor 依序執行：

1. `supabase/migrations/001_create_tables.sql` — 建立資料表
2. `supabase/migrations/002_rls.sql` — 設定 Row Level Security
3. `supabase/migrations/003_views.sql` — 建立排行榜 View
4. `supabase/seed.sql` — 寫入 SDG 資料與預設公版清單

### 4. 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

---

## 專案結構

```
gogreen/
├── app/              # Next.js App Router 頁面
├── components/       # UI 元件
├── hooks/            # Custom hooks（業務邏輯）
├── context/          # React Context
├── lib/supabase/     # Supabase 查詢封裝
├── lib/utils/        # 純函式工具
├── constants/        # 全域常數
├── types/            # TypeScript 型別
└── supabase/         # Migration & seed SQL
```

詳細架構說明、資料表設計、分數系統請見 [INSTRUCTIONS.md](./INSTRUCTIONS.md)。

---

## 開發規範

請在開始開發前閱讀 [INSTRUCTIONS.md](./INSTRUCTIONS.md)，內含：

- 架構原則與分層職責
- 分數系統與排行榜設計說明
- Supabase 資料表結構與 RLS
- 設計系統與色盤
- Commit 訊息規範
- Changelog

---

## License

MIT
