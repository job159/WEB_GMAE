/* ================================================================
 * wave.js
 * 波數管理：新怪物隨波數開放，更明顯難度曲線
 * ================================================================ */
class WaveManager {
  constructor() {
    this.current = 1;
    this.maxWave = 15;
    this.state = 'prepare';
    this.timer = 15;
    this.prepareTime = 15;
    this.spawnQueue = [];
    this.spawnInterval = 0.7;
    this.spawnTimer = 0;
    this.bossSpawned = false;
  }

  isBossWave(w) { return w % 5 === 0; }

  startWave(game) {
    this.state = 'active';
    this.spawnQueue = [];
    this.bossSpawned = false;

    const count = 5 + (this.current - 1) * 3;
    const scale = 1 + (this.current - 1) * 0.12;

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
    if (this.current >= this.maxWave) {
      game.win();
      return;
    }
    this.current++;
    this.state = 'prepare';
    this.timer = this.prepareTime;
    this.spawnQueue = [];
    const bonus = 30 + this.current * 5;
    game.inventory.gold += bonus;
    game.player.skillPoints += 1;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + 25);
    game.player.mp = Math.min(game.player.maxMp, game.player.mp + 30);
    game.score += 100;
    Utils.bigToast(`第 ${this.current - 1} 波結束 +${bonus} 金`);
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
      game.boss = new Boss(pos.x, pos.y, this.current);
      this.bossSpawned = true;
      Utils.bigToast('荒野巨獸出現！');
      AudioMgr.bossSpawn();
      game.shake(10, 0.6);
      game.particles.shockRing(pos.x, pos.y, 120, '#ff5050');
      game.particles.spark(pos.x, pos.y, 30, '#ff8050');
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
