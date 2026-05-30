/* ================================================================
 * wave.js
 * 波數管理 + Boss 種類 + 卡牌觸發 + NG+ 縮放
 * ================================================================ */
class WaveManager {
  constructor() {
    this.current = 1;
    this.maxWave = 15;
    this.state = 'prepare';
    this.timer = 12;
    this.prepareTime = 12;
    this.spawnQueue = [];
    this.spawnInterval = 0.7;
    this.spawnTimer = 0;
    this.bossSpawned = false;
    this.cardOffered = false;  // 此波結束後是否還沒給過卡牌
  }

  isBossWave(w) { return BOSS_BY_WAVE[w] != null; }

  startWave(game) {
    this.state = 'active';
    this.spawnQueue = [];
    this.bossSpawned = false;
    this.cardOffered = false;
    game.stats.startWave();

    const count = 5 + (this.current - 1) * 3;
    const ng = game.stats.mode === 'ngplus' ? 1.3 : 1;
    const scale = (1 + (this.current - 1) * 0.12) * ng;

    const pool = ['slime'];
    if (this.current >= 2) pool.push('wolf');
    if (this.current >= 3) { pool.push('goblin'); pool.push('imp'); }
    if (this.current >= 4) pool.push('skeleton');
    if (this.current >= 5) pool.push('spider');
    if (this.current >= 6) pool.push('troll');
    if (this.current >= 7) pool.push('dark_mage');

    for (let i = 0; i < count; i++) {
      this.spawnQueue.push({ type: Utils.pick(pool), scale });
    }
    if (this.isBossWave(this.current)) {
      this.spawnQueue = this.spawnQueue.slice(0, Math.ceil(count / 2));
    }
    this.spawnTimer = 0.8;
    Utils.bigToast(`第 ${this.current} 波`);
    AudioMgr.wave();
  }

  finishWave(game) {
    game.stats.endWave();
    if (this.current >= this.maxWave) {
      // 通關
      game.stats.victory = true;
      game.win();
      return;
    }
    // 卡牌觸發（在進入下一波 prepare 前）
    if (!this.cardOffered) {
      this.cardOffered = true;
      game.openCardChoice();   // game.js 內實作
      return;
    }
    this.current++;
    this.state = 'prepare';
    this.timer = this.prepareTime;
    const bonus = 30 + this.current * 5;
    game.inventory.gold += bonus;
    game.stats.recordGoldEarned(bonus);
    game.player.skillPoints += 1;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + 30);
    game.player.mp = Math.min(game.player.maxMp, game.player.mp + 40);
    game.score += 100;
    Utils.bigToast(`第 ${this.current - 1} 波結束 +${bonus} 金`);
    // 自動存檔
    Save.autosave(game);
  }

  // 玩家選完卡牌後呼叫
  afterCardChoice(game) {
    this.current++;
    this.state = 'prepare';
    this.timer = this.prepareTime;
    const bonus = 30 + this.current * 5;
    game.inventory.gold += bonus;
    game.stats.recordGoldEarned(bonus);
    game.player.skillPoints += 1;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + 30);
    game.player.mp = Math.min(game.player.maxMp, game.player.mp + 40);
    game.score += 100;
    Utils.bigToast(`第 ${this.current - 1} 波結束 +${bonus} 金`);
    Save.autosave(game);
  }

  update(dt, game) {
    if (this.state === 'prepare') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave(game);
      return;
    }
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const entry = this.spawnQueue.shift();
        const pos = this.randomSpawnPoint(game);
        game.enemies.push(new Enemy(entry.type, pos.x, pos.y, entry.scale));
        game.particles.shockRing(pos.x, pos.y, 30, '#ff5050');
        this.spawnTimer = this.spawnInterval * (game.isNight ? 0.55 : 1);
      }
    }
    if (this.isBossWave(this.current) && !this.bossSpawned && this.spawnQueue.length === 0) {
      const pos = this.randomSpawnPoint(game, 280);
      const bossType = BOSS_BY_WAVE[this.current];
      game.boss = new Boss(bossType, pos.x, pos.y, this.current);
      this.bossSpawned = true;
      Utils.bigToast(`${game.boss.name} 出現！`);
      AudioMgr.bossSpawn();
      game.shake(10, 0.6);
      game.particles.shockRing(pos.x, pos.y, 140, '#ff5050');
      game.particles.spark(pos.x, pos.y, 40, '#ff8050');
    }
    const enemiesAlive = game.enemies.some(e => e.alive);
    const bossAlive = game.boss && game.boss.alive;
    if (this.spawnQueue.length === 0 && !enemiesAlive && !bossAlive) {
      this.finishWave(game);
    }
  }

  randomSpawnPoint(game, minDist = 360) {
    for (let tries = 0; tries < 30; tries++) {
      const x = Utils.randomRange(40, game.mapW - 40);
      const y = Utils.randomRange(40, game.mapH - 40);
      if (Utils.distance(x, y, game.player.x, game.player.y) >= minDist) {
        return { x, y };
      }
    }
    return { x: 40, y: 40 };
  }
}
