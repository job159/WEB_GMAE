/* ================================================================
 * achievement.js
 * 成就清單 + Meta 跨局資料（永久儲存在 localStorage）
 * ================================================================ */
const ACHIEVEMENTS = [
  { id: 'first_kill',  name: '第一滴血',   desc: '擊殺第一隻敵人',
    check: s => s.totalKills() >= 1 },
  { id: 'kill_50',     name: '荒野殺手',   desc: '擊殺 50 隻敵人',
    check: s => s.totalKills() >= 50 },
  { id: 'kill_200',    name: '屠夫',       desc: '擊殺 200 隻敵人',
    check: s => s.totalKills() >= 200 },
  { id: 'gather_50',   name: '採集者',     desc: '累計採集 50 個資源',
    check: s => s.totalGather() >= 50 },
  { id: 'gather_200',  name: '荒野工匠',   desc: '累計採集 200 個資源',
    check: s => s.totalGather() >= 200 },
  { id: 'build_10',    name: '建築師',     desc: '建造 10 個建築',
    check: s => Object.values(s.buildingsBuilt).reduce((a,b)=>a+b,0) >= 10 },
  { id: 'build_30',    name: '城主',       desc: '建造 30 個建築',
    check: s => Object.values(s.buildingsBuilt).reduce((a,b)=>a+b,0) >= 30 },
  { id: 'rich',        name: '財神到',     desc: '單局擁有 1000 金幣',
    check: (s, g) => g.inventory.gold >= 1000 },
  { id: 'combo_50',    name: '連擊新手',   desc: '達成 50 連擊',
    check: s => s.maxCombo >= 50 },
  { id: 'combo_100',   name: '連擊王',     desc: '達成 100 連擊',
    check: s => s.maxCombo >= 100 },
  { id: 'lvl_15',      name: '崛起',       desc: '等級達 15',
    check: (s, g) => g.player.level >= 15 },
  { id: 'flawless',    name: '無傷一波',   desc: '單波完全無傷',
    check: s => s.flawlessWaves >= 1 },
  { id: 'no_wall_5',   name: '裸防',       desc: '撐過第 5 波且零牆',
    check: (s, g) => g.waveManager.current >= 5 && s.wallsBuilt === 0 },
  { id: 'all_skills',  name: '全能法師',   desc: '單局使用全 6 種主動技能',
    check: s => Object.values(s.skillCasts).every(v => v > 0) },
  { id: 'boss_first',  name: '第一個 Boss', desc: '擊敗第一個 Boss',
    check: s => s.bossKills >= 1 },
  { id: 'boss_all',    name: '屠龍者',     desc: '單局擊敗 3 個 Boss',
    check: s => s.bossKills >= 3 },
  { id: 'win_warrior', name: '戰士之證',   desc: '用戰士通關',
    check: s => s.victory && s.classId === 'warrior' },
  { id: 'win_mage',    name: '法師之證',   desc: '用法師通關',
    check: s => s.victory && s.classId === 'mage' },
  { id: 'win_archer',  name: '弓手之證',   desc: '用弓手通關',
    check: s => s.victory && s.classId === 'archer' },
  { id: 'win_ng',      name: 'NG+ 征服',   desc: '通關 NG+',
    check: s => s.victory && s.mode === 'ngplus' },
  { id: 'win_daily',   name: '今日英雄',   desc: '通關每日挑戰',
    check: s => s.victory && s.mode === 'daily' },
  { id: 'collector',   name: '收藏家',     desc: '解鎖所有其他成就',
    check: (s, g, m) => m.unlocked.length >= ACHIEVEMENTS.length - 1 }
];

const Meta = {
  KEY: 'survival-outpost-meta-v1',
  data: {
    unlocked: [],            // [achievement_id]
    classesPlayed: [],       // [classId]
    classesCleared: [],
    ngPlus: false,
    totalDeaths: 0,
    totalVictories: 0,
    bestWave: 0,
    bestScore: 0,
    totalKills: 0,
    dailyDone: {}            // { '2024-1-15': true }
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) { console.warn('Meta load error', e); }
    return this.data;
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); }
    catch (e) { console.warn('Meta save error', e); }
  },

  // 檢查成就，回傳新解鎖列表
  check(game) {
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (this.data.unlocked.includes(a.id)) continue;
      try {
        if (a.check(game.stats, game, this.data)) {
          this.data.unlocked.push(a.id);
          newly.push(a);
          // 雲端同步
          if (typeof Cloud !== 'undefined' && Cloud.syncAchievement) Cloud.syncAchievement(a.id);
        }
      } catch (e) { /* check failed, skip */ }
    }
    if (newly.length) this.save();
    return newly;
  },

  // 局結算後呼叫
  recordRun(game) {
    if (game.stats.victory) {
      this.data.totalVictories++;
      if (!this.data.classesCleared.includes(game.stats.classId)) {
        this.data.classesCleared.push(game.stats.classId);
      }
      if (game.stats.mode === 'daily') {
        const t = PRNG.todaySeed().label;
        this.data.dailyDone[t] = game.score;
      }
      if (this.data.classesCleared.length >= 1) this.data.ngPlus = true;
    } else {
      this.data.totalDeaths++;
    }
    if (game.waveManager.current > this.data.bestWave) this.data.bestWave = game.waveManager.current;
    if (game.score > this.data.bestScore) this.data.bestScore = game.score;
    this.data.totalKills += game.stats.totalKills();
    if (!this.data.classesPlayed.includes(game.stats.classId)) {
      this.data.classesPlayed.push(game.stats.classId);
    }
    this.save();
  },

  // 重置（debug 用）
  reset() {
    localStorage.removeItem(this.KEY);
    this.data = {
      unlocked: [], classesPlayed: [], classesCleared: [],
      ngPlus: false, totalDeaths: 0, totalVictories: 0,
      bestWave: 0, bestScore: 0, totalKills: 0, dailyDone: {}
    };
  }
};
