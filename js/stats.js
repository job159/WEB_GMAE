/* ================================================================
 * stats.js
 * 本局統計，死亡 / 勝利畫面用
 * ================================================================ */
class Stats {
  constructor() {
    this.startTime = performance.now();
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.killsByType = {};
    this.gatherByType = {};
    this.goldEarned = 0;
    this.goldSpent = 0;
    this.skillCasts = { q: 0, r: 0, g: 0, v: 0, x: 0, c: 0 };
    this.buildingsBuilt = {};
    this.maxCombo = 0;
    this.cardsTaken = [];
    this.wallsBuilt = 0;
    this.bossKills = 0;
    this.flawlessWaves = 0;
    this.tookDamageThisWave = false;
    this.victory = false;
    this.classId = null;
    this.mode = 'normal'; // normal | daily | ngplus
    this.weaponsUsed = new Set();
  }

  timePlayed() { return (performance.now() - this.startTime) / 1000; }

  recordKill(type)      { this.killsByType[type] = (this.killsByType[type] || 0) + 1; }
  recordGather(type)    { this.gatherByType[type] = (this.gatherByType[type] || 0) + 1; }
  recordSkill(id)       { if (this.skillCasts[id] != null) this.skillCasts[id]++; }
  recordBuild(type) {
    this.buildingsBuilt[type] = (this.buildingsBuilt[type] || 0) + 1;
    if (type === 'wall_wood' || type === 'wall_stone') this.wallsBuilt++;
  }
  recordDamageDealt(d)  { this.damageDealt += d; }
  recordDamageTaken(d)  { this.damageTaken += d; this.tookDamageThisWave = true; }
  recordGoldEarned(g)   { this.goldEarned += g; }
  recordGoldSpent(g)    { this.goldSpent += g; }
  recordWeapon(w)       { this.weaponsUsed.add(w); }
  recordCard(c)         { this.cardsTaken.push(c); }
  recordCombo(c)        { if (c > this.maxCombo) this.maxCombo = c; }
  startWave()           { this.tookDamageThisWave = false; }
  endWave()             { if (!this.tookDamageThisWave) this.flawlessWaves++; }

  totalKills() {
    return Object.values(this.killsByType).reduce((a, b) => a + b, 0);
  }
  totalGather() {
    return Object.values(this.gatherByType).reduce((a, b) => a + b, 0);
  }

  // 給結算畫面用
  summary() {
    return {
      time: Math.round(this.timePlayed()),
      kills: this.totalKills(),
      bosses: this.bossKills,
      damageDealt: Math.round(this.damageDealt),
      damageTaken: Math.round(this.damageTaken),
      gather: this.totalGather(),
      goldEarned: this.goldEarned,
      goldSpent: this.goldSpent,
      builds: Object.values(this.buildingsBuilt).reduce((a, b) => a + b, 0),
      maxCombo: this.maxCombo,
      flawless: this.flawlessWaves,
      cards: this.cardsTaken.length
    };
  }
}
