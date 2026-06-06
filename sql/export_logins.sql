-- ================================================================
-- 匯出「誰在什麼時間登入」成 CSV
-- 用法：Supabase Dashboard → SQL Editor → 貼上 → Run
--       → 結果區右上角點「Download CSV」即可下載
-- ================================================================

select
  player_name                                          as "玩家名字",
  case when is_anonymous then '匿名' else provider end as "登入方式",
  to_char(logged_in_at, 'YYYY-MM-DD HH24:MI:SS')       as "登入時間",
  user_id                                              as "帳號ID",
  user_agent                                           as "裝置"
from login_log
order by logged_in_at desc;

-- ----------------------------------------------------------------
-- 其他常用查詢：
--
-- 只看某一天：
--   ... where logged_in_at::date = '2026-06-06' ...
--
-- 每個名字登入幾次、最後一次什麼時候：
--   select player_name 玩家名字,
--          count(*) 登入次數,
--          to_char(max(logged_in_at), 'YYYY-MM-DD HH24:MI:SS') 最後登入
--   from login_log group by player_name order by 登入次數 desc;
--
-- 只看匿名玩家：
--   ... where is_anonymous = true ...
-- ----------------------------------------------------------------
