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
    this.spawnInterval = 0.45;
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

    const count = 8 + (this.current - 1) * 4;
    const ng = game.stats.mode === 'ngplus' ? 1.4 : 1;
    const scale = (1 + (this.current - 1) * 0.14) * ng;

    const pool = ['slime'];
    if (this.current >= 2) pool.push('wolf');
    if (this.current >= 3) { pool.push('goblin'); pool.push('imp'); }
    if (this.current >= 4) pool.push('skeleton');
    if (this.current >= 5) pool.push('spider');
    if (this.current >= 6) pool.push('troll');
    if (this.current >= 7) pool.push('dark_mage');
    // 高波數加入精英怪
    if (this.current >= 6) pool.push('flame_ghost');
    if (this.current >= 8) pool.push('thunder_wolf');
    if (this.current >= 9) pool.push('venom_spider');
    if (this.current >= 11) pool.push('elite_troll');

    for (let i = 0; i < count; i++) {
      this.spawnQueue.push({ type: Utils.pick(pool), scale });
    }
    if (this.isBossWave(this.current)) {
      this.spawnQueue = this.spawnQueue.slice(0, Math.ceil(count * 0.65));
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
    // 技能點：每 3 波才 +1（之前每波都給太多）
    const endedWave = this.current - 1;
    if (endedWave % 3 === 0) game.player.skillPoints += 1;
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
    // 技能點：每 3 波才 +1
    const endedWave = this.current - 1;
    if (endedWave % 3 === 0) game.player.skillPoints += 1;
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
      // 震屏 + 多層紅黑爆閃
      game.shake(22, 0.9);
      game.particles.add({
        x: pos.x, y: pos.y, vx: 0, vy: 0,
        life: 0.7, max: 0.7, color: 'rgba(0,0,0,0.65)',
        size: 600, type: 'flash'
      });
      game.particles.shockRing(pos.x, pos.y, 460, '#ff2030');
      game.particles.shockRing(pos.x, pos.y, 340, '#ff7050');
      game.particles.shockRing(pos.x, pos.y, 220, '#ffd86b');
      game.particles.shockRing(pos.x, pos.y, 120, '#fff');
      // 血爆四射
      for (let i = 0; i < 56; i++) {
        const a = (i / 56) * Math.PI * 2;
        const sp = Utils.randomRange(240, 520);
        game.particles.add({
          x: pos.x, y: pos.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 1.2, max: 1.2, color: Utils.pick(['#ff2030', '#ff7050', '#ffd86b', '#fff']),
          size: Utils.randomRange(5, 10), type: 'fire', grow: -5
        });
      }
      // 黑色從天降下塵土
      game.particles.smoke(pos.x, pos.y, 40, 'rgba(20,5,10,0.85)');
      // 玩家所在位置也加震屏
      game.particles.spark(game.player.x, game.player.y, 24, '#ff8050');
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
