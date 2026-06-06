-- ================================================================
-- 既有專案升級腳本：把 saves 改成「以名字為主鍵」+ 新增 login_log
-- 用法：Supabase Dashboard → SQL Editor → 貼上整段 → Run（有資料也安全，跑一次即可）
-- 全新專案請改用 supabase_setup.sql
-- ================================================================

-- 1) saves 加上 player_name，並用既有 profiles 回填
alter table saves add column if not exists player_name text;

update saves s
   set player_name = coalesce(p.display_name, 'Guest_' || left(s.user_id::text, 6))
  from profiles p
 where p.id = s.user_id
   and s.player_name is null;

-- 沒有對應 profile 的，補一個名字
update saves
   set player_name = 'Guest_' || left(user_id::text, 6)
 where player_name is null;

alter table saves alter column player_name set not null;

-- 2) 換主鍵：(user_id, slot) → (player_name, slot)
--    若同名同槽有重複，只保留最新的一筆（updated_at 最大；同時間則留 ctid 較大者）
delete from saves s
 where exists (
   select 1 from saves t
    where t.player_name = s.player_name
      and t.slot = s.slot
      and (t.updated_at > s.updated_at
           or (t.updated_at = s.updated_at and t.ctid > s.ctid))
 );

alter table saves drop constraint if exists saves_pkey;
alter table saves add primary key (player_name, slot);

-- 3) user_id 改為可為空（不同裝置的匿名 id 不同；只當紀錄）
alter table saves alter column user_id drop not null;

-- 4) 更新 saves 的 RLS：用名字找 → 大家可讀；有登入就能寫
drop policy if exists "all own saves"      on saves;
drop policy if exists "read saves by name" on saves;
create policy "read saves by name" on saves for select using (true);
drop policy if exists "write saves" on saves;
create policy "write saves" on saves for insert with check (auth.uid() is not null);
drop policy if exists "update saves" on saves;
create policy "update saves" on saves for update using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "delete saves" on saves;
create policy "delete saves" on saves for delete using (auth.uid() is not null);

-- 5) 新增 login_log（誰、什麼時間、用什麼方式登入）
create table if not exists login_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  player_name text not null,
  is_anonymous boolean default true,
  provider text,
  user_agent text,
  logged_in_at timestamptz default now()
);
create index if not exists login_log_time_idx on login_log (logged_in_at desc);
create index if not exists login_log_name_idx on login_log (player_name);

alter table login_log enable row level security;
drop policy if exists "insert login" on login_log;
create policy "insert login" on login_log for insert with check (auth.uid() is not null);

-- 完成後別忘了：Authentication → Providers → 啟用「Anonymous Sign-Ins」
