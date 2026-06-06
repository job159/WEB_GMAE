# 荒野據點 Survival Outpost

純前端 + Supabase BaaS 的 2D 俯視角生存遊戲。

- 🎮 3 種職業 × 3 個獨家技能
- 🎴 Roguelike 卡牌系統（含技能升級）
- 🐉 3 種誇張造型 Boss
- ☁ 雲端存檔 + 排行榜 + 成就同步
- 👤 匿名（輸入名字找存檔）/ Discord / Google 三種登入
- 📱 觸控操作 + PWA

線上版：https://job159.github.io/WEB_GMAE/

---

## ⚠ 第一次部署：Supabase 必做的 4 件事

雲端功能依賴 Supabase。請在 Dashboard 完成以下 4 步驟，否則登入會失敗：

### Step 1：在 SQL Editor 跑建表 + RLS

把 [`sql/supabase_setup.sql`](sql/supabase_setup.sql) 整段貼進 **SQL Editor → Run** 即可。
（已部署過舊版的，改跑 [`sql/migration_name_based.sql`](sql/migration_name_based.sql) 升級。）

建立的表：

| 表 | 主鍵 | 說明 |
|----|------|------|
| `profiles` | `id`(user_id) | 玩家檔案 |
| `saves` | `(player_name, slot)` | **存檔以名字為主鍵 → 用名字找回** |
| `scores` | `id` | 排行榜 |
| `achievements` | `(user_id, achievement_id)` | 成就 |
| `login_log` | `id` | **誰、什麼時間、用什麼方式登入（可匯出 CSV）** |

### Step 2：啟用 Anonymous Sign-Ins

**Authentication → Sign In / Providers → Anonymous Sign-Ins → Enable**

### Step 3：設定 Site URL & Redirect URLs（OAuth 必需）

**Authentication → URL Configuration**

- **Site URL**：`https://job159.github.io/WEB_GMAE/`
- **Redirect URLs**（按 Add URL 加 4 條）：
  ```
  https://job159.github.io/WEB_GMAE/**
  http://localhost:5500/**
  http://127.0.0.1:5500/**
  http://localhost:5173/**
  ```
  雙星號 `**` 是萬用字元。漏這步會出現「Redirect URL not allowed」。

### Step 4：啟用 Discord / Google OAuth

#### Discord
1. https://discord.com/developers/applications → New Application
2. **OAuth2 → Redirects → Add**：`https://ifdpokqieznddirqxubq.supabase.co/auth/v1/callback`
3. **OAuth2 → Reset Secret** 取得 Client Secret
4. 回 Supabase **Authentication → Providers → Discord → Enable**，貼 Client ID + Secret

#### Google
1. https://console.cloud.google.com → 新專案
2. **APIs & Services → OAuth consent screen → Configure**（External）
3. **Credentials → Create OAuth Client ID → Web application**
4. Authorized redirect URI：`https://ifdpokqieznddirqxubq.supabase.co/auth/v1/callback`
5. 取得 Client ID/Secret 貼進 Supabase **Authentication → Providers → Google**

---

## 玩法操作

| 鍵 | 功能 |
|----|------|
| WASD | 移動 |
| 滑鼠左鍵 | 攻擊 |
| Space | 衝刺 |
| E | 採集 |
| 1 / 2 / 3 | 切換武器 |
| Q / R / V | 職業專屬 3 技能 |
| B | 建築選單 |
| T | 被動技能面板 |
| N | 商店（準備時段） |
| P | 暫停 / Esc 關閉面板 |
| F / L | 存 / 讀檔 |

## 雲端機制（重點）

- 啟動時**自動匿名登入**；不是 Discord / Google 登入時，主選單會跳出**輸入名字**
- 匿名玩家的**存檔以「名字 + 槽位」存到雲端** → 換裝置輸入同一個名字就能找回
- 存檔同時寫 localStorage + Supabase（背景，失敗不影響）；讀檔優先雲端，斷網退回本地
- 每次登入會寫一筆 `login_log`（名字 / 時間 / 方式）
- 通關自動上傳分數到排行榜；解成就自動同步雲端
- 登入 Discord / Google 後跨裝置同步，且存檔私有不會被同名覆蓋

> ⚠ **name-only 的取捨**：匿名存檔只用名字當鑰匙，代表**知道名字的人就能讀／覆蓋該存檔**（兩個都叫「小明」會共用）。
> casual 遊戲可接受；要更嚴格可加 4 位數 PIN（見 `sql/supabase_setup.sql` 檔尾說明），或直接用 Discord / Google 登入。

## 匯出登入紀錄 CSV

想看「哪個匿名玩家、什麼時間登入」：

1. Supabase Dashboard → **SQL Editor**
2. 貼上 [`sql/export_logins.sql`](sql/export_logins.sql) → **Run**
3. 結果區右上角 **Download CSV**

（或 **Table Editor → `login_log` → Export → Export as CSV** 直接匯出整張表。）

## 部署

```bash
git add . && git commit -m "cloud" && git push
```

GitHub Pages 約 1 分鐘後更新。
