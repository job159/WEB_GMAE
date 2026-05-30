# 荒野據點 Survival Outpost

純前端 + Supabase BaaS 的 2D 俯視角生存遊戲。

- 🎮 3 種職業 × 3 個獨家技能
- 🎴 Roguelike 卡牌系統（含技能升級）
- 🐉 3 種誇張造型 Boss
- ☁ 雲端存檔 + 排行榜 + 成就同步
- 👤 匿名 / Discord / Google 三種登入
- 📱 觸控操作 + PWA

線上版：https://job159.github.io/WEB_GMAE/

---

## ⚠ 第一次部署：Supabase 必做的 4 件事

雲端功能依賴 Supabase。請在 Dashboard 完成以下 4 步驟，否則登入會失敗：

### Step 1：在 SQL Editor 跑這段建表 + RLS

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz default now()
);
create table saves (
  user_id uuid not null references auth.users on delete cascade,
  slot smallint not null check (slot >= 0 and slot <= 3),
  data jsonb not null,
  wave int, level int, class_id text, score int, mode text,
  updated_at timestamptz default now(),
  primary key (user_id, slot)
);
create table scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  display_name text not null,
  score int not null check (score >= 0 and score < 10000000),
  wave int not null check (wave between 1 and 15),
  class_id text not null,
  mode text not null check (mode in ('normal','daily','ngplus')),
  daily_seed text,
  duration_sec int,
  created_at timestamptz default now()
);
create index scores_score_idx on scores (score desc);
create index scores_daily_idx on scores (daily_seed, score desc);
create table achievements (
  user_id uuid not null references auth.users on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz default now(),
  primary key (user_id, achievement_id)
);

alter table profiles enable row level security;
alter table saves enable row level security;
alter table scores enable row level security;
alter table achievements enable row level security;

create policy "read all profiles" on profiles for select using (true);
create policy "upsert own profile" on profiles for insert with check (auth.uid() = id);
create policy "update own profile" on profiles for update using (auth.uid() = id);
create policy "all own saves" on saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read all scores" on scores for select using (true);
create policy "insert own scores" on scores for insert with check (auth.uid() = user_id);
create policy "read own achievements" on achievements for select using (auth.uid() = user_id);
create policy "insert own achievements" on achievements for insert with check (auth.uid() = user_id);
```

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

- 啟動時**自動匿名登入**，立即可用雲端
- 存檔同時寫 localStorage + Supabase（背景，失敗不影響）
- 讀檔優先雲端，斷網時退回本地
- 通關自動上傳分數到排行榜
- 解成就自動同步雲端
- 登入 Discord / Google 後跨裝置同步

## 部署

```bash
git add . && git commit -m "cloud" && git push
```

GitHub Pages 約 1 分鐘後更新。
