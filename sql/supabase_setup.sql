-- ================================================================
-- 荒野據點 Survival Outpost — Supabase 一鍵建置（全新專案用）
-- 用法：Supabase Dashboard → SQL Editor → 貼上整段 → Run
-- 內容：profiles / saves(以名字為主鍵) / scores / achievements / login_log
-- 既有專案請改用 migration_name_based.sql
-- ================================================================

-- 1) 玩家檔案（OAuth 用 user_id；匿名也會建一筆）
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz default now()
);

-- 2) 雲端存檔：以「玩家名字 + 槽位」為主鍵 → 用名字就能找回（換裝置也行）
create table if not exists saves (
  player_name text not null,
  slot smallint not null check (slot >= 0 and slot <= 3),
  data jsonb not null,
  user_id uuid references auth.users on delete set null,  -- 最後寫入者，僅紀錄用
  wave int, level int, class_id text, score int, mode text,
  updated_at timestamptz default now(),
  primary key (player_name, slot)
);

-- 3) 排行榜
create table if not exists scores (
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
create index if not exists scores_score_idx on scores (score desc);
create index if not exists scores_daily_idx on scores (daily_seed, score desc);

-- 4) 成就
create table if not exists achievements (
  user_id uuid not null references auth.users on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz default now(),
  primary key (user_id, achievement_id)
);

-- 5) 登入紀錄：誰（名字）在什麼時間、用什麼方式登入 → 可匯出 CSV
create table if not exists login_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  player_name text not null,
  is_anonymous boolean default true,
  provider text,                      -- anonymous / discord / google
  user_agent text,
  logged_in_at timestamptz default now()
);
create index if not exists login_log_time_idx on login_log (logged_in_at desc);
create index if not exists login_log_name_idx on login_log (player_name);

-- ================================================================
-- RLS（Row Level Security）
-- ================================================================
alter table profiles     enable row level security;
alter table saves        enable row level security;
alter table scores       enable row level security;
alter table achievements enable row level security;
alter table login_log    enable row level security;

-- profiles：大家可讀；只能改自己的
drop policy if exists "read all profiles" on profiles;
create policy "read all profiles" on profiles for select using (true);
drop policy if exists "upsert own profile" on profiles;
create policy "upsert own profile" on profiles for insert with check (auth.uid() = id);
drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- saves：用名字找 → 大家可讀；只要有登入（含匿名）就能寫
-- ⚠ 注意：name-only 代表「知道名字的人就能讀/覆蓋該存檔」。casual 遊戲可接受；
--   若要更嚴格，見檔尾「加 PIN」說明。
drop policy if exists "all own saves"      on saves;
drop policy if exists "read saves by name" on saves;
create policy "read saves by name" on saves for select using (true);
drop policy if exists "write saves" on saves;
create policy "write saves" on saves for insert with check (auth.uid() is not null);
drop policy if exists "update saves" on saves;
create policy "update saves" on saves for update using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "delete saves" on saves;
create policy "delete saves" on saves for delete using (auth.uid() is not null);

-- scores：大家可讀；只能插入自己的
drop policy if exists "read all scores" on scores;
create policy "read all scores" on scores for select using (true);
drop policy if exists "insert own scores" on scores;
create policy "insert own scores" on scores for insert with check (auth.uid() = user_id);

-- achievements：只能讀 / 寫自己的
drop policy if exists "read own achievements" on achievements;
create policy "read own achievements" on achievements for select using (auth.uid() = user_id);
drop policy if exists "insert own achievements" on achievements;
create policy "insert own achievements" on achievements for insert with check (auth.uid() = user_id);

-- login_log：登入即可寫入一筆；前端不需讀（後台 / SQL Editor 以管理權限查、匯出）
drop policy if exists "insert login" on login_log;
create policy "insert login" on login_log for insert with check (auth.uid() is not null);

-- ================================================================
-- 別忘了：Authentication → Sign In / Providers → 啟用「Anonymous Sign-Ins」
-- 否則匿名登入會失敗、寫不進雲端。
-- ================================================================

-- ----------------------------------------------------------------
-- （選用）想避免同名互相覆蓋 → 幫每個名字加一組 4 位數 PIN：
--   alter table saves     add column if not exists pin text;
--   alter table login_log add column if not exists pin text;
-- 然後前端存/讀檔時一併帶上 pin，並把 saves 的讀取政策改成需要比對 pin。
-- ----------------------------------------------------------------
