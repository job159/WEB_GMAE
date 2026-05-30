/* ================================================================
 * resource.js
 * 樹木、石頭、鐵礦、草叢、寶箱
 * 採集會噴出對應粒子
 * ================================================================ */
const RESOURCE_TYPES = {
  tree:  { color: '#3c8c3c', dark: '#1f4f1f', hp: 24, radius: 16, gatherTime: 0.40,
           rewardKey: 'wood',  rewardAmount: [2, 4], respawn: 30, label: '樹' },
  rock:  { color: '#8a8a8a', dark: '#4f4f4f', hp: 32, radius: 16, gatherTime: 0.45,
           rewardKey: 'stone', rewardAmount: [2, 3], respawn: 45, label: '石' },
  iron:  { color: '#b8a070', dark: '#604f30', hp: 48, radius: 16, gatherTime: 0.55,
           rewardKey: 'iron',  rewardAmount: [1, 2], respawn: 60, label: '鐵' },
  bush:  { color: '#5cab3f', dark: '#2f5c20', hp: 8,  radius: 12, gatherTime: 0.25,
           rewardKey: 'food',  rewardAmount: [1, 2], respawn: 25, label: '草' },
  chest: { color: '#cf9b3a', dark: '#6f4a10', hp: 6,  radius: 14, gatherTime: 0.30,
           rewardKey: 'mix',   rewardAmount: [0, 0], respawn: 0,  label: '箱' }
};

class ResourceNode {
  constructor(type, x, y) {
    const cfg = RESOURCE_TYPES[type];
    this.type = type;
    this.cfg = cfg;
    this.x = x; this.y = y;
    this.radius = cfg.radius;
    this.maxHp = cfg.hp;
    this.hp = cfg.hp;
    this.alive = true;
    this.respawnTimer = 0;
    this.hitFlash = 0;
    this.wob = 0;
  }

  hit(damage, game) {
    if (!this.alive) return;
    this.hp -= damage;
    this.hitFlash = 0.15;
    this.wob = 0.3;
    AudioMgr.gather();

    if (this.type === 'tree') game.particles.leaves(this.x, this.y - 4, 4);
    else if (this.type === 'rock' || this.type === 'iron') game.particles.rockChip(this.x, this.y, 3);
    else if (this.type === 'bush') game.particles.spark(this.x, this.y, 4, '#7fdb50');
    else if (this.type === 'chest') game.particles.spark(this.x, this.y, 6, '#ffd86b');

    if (this.hp <= 0) this.collect(game);
  }

  collect(game) {
    this.alive = false;
    this.respawnTimer = this.cfg.respawn;

    if (this.cfg.rewardKey === 'mix') {
      const g = Utils.randomInt(20, 50);
      game.inventory.gold += g;
      game.inventory.wood += Utils.randomInt(2, 6);
      game.inventory.stone += Utils.randomInt(1, 4);
      if (Utils.chance(0.6)) game.inventory.iron += Utils.randomInt(1, 2);
      if (Utils.chance(0.4)) {
        const h = 30;
        game.player.hp = Math.min(game.player.maxHp, game.player.hp + h);
        game.particles.damageText(game.player.x, game.player.y - 30, '+' + h, '#6fdd6f');
        Utils.toast(`寶箱：+${g}金 + 補血 ${h}！`);
      } else {
        Utils.toast(`寶箱：+${g} 金 + 材料`);
      }
      game.particles.spark(this.x, this.y, 30, '#ffd86b');
      game.score += 30;
    } else {
      const [a, b] = this.cfg.rewardAmount;
      const amt = Utils.randomInt(a, b);
      game.inventory[this.cfg.rewardKey] += amt;
      if (this.cfg.rewardKey === 'food') {
        game.player.hunger = Math.min(100, game.player.hunger + amt * 8);
      }
      game.particles.damageText(this.x, this.y - 20, `+${amt} ${this.cfg.label}`, '#ffd86b');
      game.score += 2;
    }
  }

  update(dt, game) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.wob > 0) this.wob -= dt;
    if (!this.alive) {
      if (this.cfg.respawn === 0) return;
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        if (Collision.canPlaceBuilding(this.x, this.y, this.radius * 2, this.radius * 2, game)) {
          this.alive = true;
          this.hp = this.maxHp;
          game.particles.spark(this.x, this.y, 8, '#5cdb5c');
        } else {
          this.respawnTimer = 5;
        }
      }
    }
  }

  draw(ctx, camera) {
    if (!this.alive) return;
    const s = Utils.worldToScreen(this.x, this.y, camera);
    const wobOff = this.wob > 0 ? Math.sin(this.wob * 40) * 2 : 0;

    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + this.radius * 0.7, this.radius * 0.8, this.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    const baseColor = this.hitFlash > 0 ? '#fff' : this.cfg.color;

    if (this.type === 'tree') {
      ctx.fillStyle = '#5b3a1a';
      ctx.fillRect(s.x - 4 + wobOff, s.y - 2, 8, 14);
      // 樹冠（兩層）
      ctx.fillStyle = this.cfg.dark;
      ctx.beginPath(); ctx.arc(s.x + wobOff, s.y - 6, this.radius + 1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = baseColor;
      ctx.beginPath(); ctx.arc(s.x + wobOff, s.y - 7, this.radius - 1, 0, Math.PI * 2); ctx.fill();
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(s.x - 4 + wobOff, s.y - 12, this.radius * 0.4, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'rock') {
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.moveTo(s.x - this.radius, s.y + this.radius / 2);
      ctx.lineTo(s.x - this.radius / 2, s.y - this.radius);
      ctx.lineTo(s.x + this.radius / 2, s.y - this.radius);
      ctx.lineTo(s.x + this.radius, s.y + this.radius / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = this.cfg.dark;
      ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(s.x - 4, s.y - 8, 6, 3);
    } else if (this.type === 'iron') {
      ctx.fillStyle = baseColor;
      ctx.beginPath(); ctx.arc(s.x, s.y, this.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a3a10';
      ctx.fillRect(s.x - 6, s.y - 4, 4, 4);
      ctx.fillRect(s.x + 2, s.y, 4, 4);
      ctx.strokeStyle = this.cfg.dark;
      ctx.stroke();
      // 金屬光澤
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(s.x - 8, s.y - 8, 4, 2);
    } else if (this.type === 'bush') {
      ctx.fillStyle = baseColor;
      ctx.beginPath(); ctx.arc(s.x, s.y, this.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d04040';
      ctx.beginPath(); ctx.arc(s.x - 4, s.y - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x + 3, s.y + 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x + 4, s.y - 4, 2, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'chest') {
      // 寶箱 + 發光描邊
      Utils.drawGlowCircle(ctx, s.x, s.y, 30, '#ffd86b', 0.35);
      ctx.fillStyle = baseColor;
      ctx.fillRect(s.x - this.radius, s.y - this.radius * 0.7, this.radius * 2, this.radius * 1.4);
      ctx.strokeStyle = this.cfg.dark;
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - this.radius, s.y - this.radius * 0.7, this.radius * 2, this.radius * 1.4);
      ctx.fillStyle = '#ffd86b';
      ctx.fillRect(s.x - 3, s.y - 2, 6, 5);
    }

    if (this.hp < this.maxHp) {
      Utils.drawHpBar(ctx, s.x - 16, s.y - this.radius - 10, 32, 4, this.hp / this.maxHp);
    }
  }
}
