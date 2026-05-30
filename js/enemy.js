/* ================================================================
 * enemy.js
 * 怪物：8 種
 *   slime, wolf, goblin, skeleton, troll, imp, spider, dark_mage
 * 視波數逐步開放
 * ================================================================ */
const ENEMY_TYPES = {
  slime:    { name: '史萊姆',   hp: 30,  speed: 50,  damage: 6,  radius: 14, exp: 4,  gold: 2,
              color: '#6fdd6f', dark: '#1f6f1f', range: 'melee' },
  wolf:     { name: '野狼',     hp: 50,  speed: 115, damage: 10, radius: 14, exp: 8,  gold: 3,
              color: '#9a8a6a', dark: '#3a2a10', range: 'melee' },
  goblin:   { name: '哥布林',   hp: 65,  speed: 80,  damage: 12, radius: 14, exp: 10, gold: 5,
              color: '#7fb45a', dark: '#1f4a1a', range: 'melee', wallDamage: 2 },
  skeleton: { name: '骷髏弓手', hp: 45,  speed: 55,  damage: 14, radius: 13, exp: 12, gold: 6,
              color: '#e0e0d0', dark: '#5a5a4a', range: 'ranged', attackRange: 300, projectileSpeed: 380 },
  troll:    { name: '巨魔',     hp: 200, speed: 45,  damage: 22, radius: 22, exp: 30, gold: 15,
              color: '#5a8a5a', dark: '#1a3a1a', range: 'melee', wallDamage: 4 },
  imp:      { name: '小惡魔',   hp: 30,  speed: 160, damage: 9,  radius: 12, exp: 9,  gold: 5,
              color: '#d04040', dark: '#601010', range: 'melee' },
  spider:   { name: '毒蜘蛛',   hp: 55,  speed: 95,  damage: 8,  radius: 14, exp: 11, gold: 6,
              color: '#5a2a8a', dark: '#1a0a30', range: 'melee', poison: true },
  dark_mage:{ name: '黑暗法師', hp: 90,  speed: 50,  damage: 18, radius: 15, exp: 18, gold: 10,
              color: '#3a2050', dark: '#1a0a20', range: 'ranged', attackRange: 340, projectileSpeed: 320, magic: true }
};

class Enemy {
  constructor(type, x, y, scale = 1) {
    const cfg = ENEMY_TYPES[type];
    this.type = type;
    this.cfg = cfg;
    this.x = x; this.y = y;
    this.radius = cfg.radius;
    this.maxHp = Math.round(cfg.hp * scale);
    this.hp = this.maxHp;
    this.speed = cfg.speed;
    this.damage = Math.round(cfg.damage * scale);
    this.color = cfg.color;
    this.dark = cfg.dark;
    this.exp = cfg.exp;
    this.gold = cfg.gold;
    this.range = cfg.range;
    this.alive = true;
    this.attackCooldown = 0;
    this.attackRate = type === 'troll' ? 1.4 : (type === 'imp' ? 0.6 : 0.9);
    this.slowTimer = 0;
    this.knockTimer = 0;
    this.knockVX = 0; this.knockVY = 0;
    this.target = null;
    this.hitFlash = 0;
    this.wobble = Math.random() * Math.PI * 2;
  }

  takeDamage(d, game) {
    if (!this.alive) return;
    this.hp -= d;
    this.hitFlash = 0.15;
    game.combo = (game.combo || 0) + 1;
    game.comboTimer = 3.5;
    if (this.hp <= 0) {
      this.alive = false; this.hp = 0;
      const bonus = 1 + Math.min(0.5, (game.combo || 0) * 0.01);
      game.player.gainExp(Math.round(this.exp * bonus), game);
      game.inventory.gold += Math.round(this.gold * bonus);
      game.score += Math.round(20 * bonus);
      game.killCount++;
      game.particles.blood(this.x, this.y, 12);
      game.particles.spark(this.x, this.y, 6, '#ff6666');
      game.particles.damageText(this.x, this.y - 16, `+${Math.round(this.gold * bonus)}g`, '#ffd86b');
      AudioMgr.enemyDie();
    }
  }

  applyKnockback(fromX, fromY, force = 200) {
    const ang = Utils.angle(fromX, fromY, this.x, this.y);
    this.knockVX = Math.cos(ang) * force;
    this.knockVY = Math.sin(ang) * force;
    this.knockTimer = 0.15;
  }

  update(dt, game) {
    if (!this.alive) return;
    this.wobble += dt * 6;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.slowTimer > 0) this.slowTimer -= dt;

    if (this.knockTimer > 0) {
      this.x += this.knockVX * dt;
      this.y += this.knockVY * dt;
      this.knockTimer -= dt;
      return;
    }

    const player = game.player;
    const distToPlayer = Utils.distance(this.x, this.y, player.x, player.y);

    let target = player;
    let dx = player.x - this.x;
    let dy = player.y - this.y;
    let blocking = this.findBlockingBuilding(player, game);
    if (blocking) {
      target = blocking;
      dx = blocking.x - this.x;
      dy = blocking.y - this.y;
    }
    this.target = target;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.range === 'ranged') {
      const want = this.cfg.attackRange * 0.7;
      if (distToPlayer < want * 0.8) { dx = -dx; dy = -dy; }
      else if (distToPlayer < want * 1.05 && target === player) { dx = 0; dy = 0; }
    } else {
      const stopDist = target === player ? (this.radius + player.radius - 2)
                                         : (this.radius + Math.max(target.w, target.h) / 2 - 2);
      if (dist < stopDist) { dx = 0; dy = 0; }
    }

    let mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 0.001) {
      const sp = this.speed * (this.slowTimer > 0 ? 0.4 : 1) * dt;
      const ux = dx / mag, uy = dy / mag;
      const nx = this.x + ux * sp;
      const ny = this.y + uy * sp;
      const r = Collision.resolveMove(this, nx, ny, game.buildings, game.mapW, game.mapH);
      this.x = r.x; this.y = r.y;
    }

    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      if (this.range === 'ranged') {
        if (target === player && distToPlayer < this.cfg.attackRange) {
          const ang = Utils.angle(this.x, this.y, player.x, player.y);
          const kind = this.cfg.magic ? 'magic' : 'arrow';
          game.projectiles.push(new Projectile(this.x, this.y, ang, this.cfg.projectileSpeed, this.damage, 'enemy', kind));
          if (kind === 'magic') AudioMgr.fireball();
          else AudioMgr.bowShoot();
          this.attackCooldown = this.attackRate;
        }
      } else {
        if (target === player) {
          if (distToPlayer < this.radius + player.radius + 4) {
            player.takeDamage(this.damage);
            if (this.cfg.poison) player.applyPoison(5, 4);
            this.attackCooldown = this.attackRate;
          }
        } else {
          if (Collision.circleRect(this.x, this.y, this.radius + 4, target.x, target.y, target.w, target.h)) {
            const wallMult = this.cfg.wallDamage || 1;
            target.takeDamage(this.damage * wallMult);
            game.particles.add({
              x: target.x, y: target.y, vx: 0, vy: 0,
              life: 0.15, max: 0.15, color: '#fff', size: 18, type: 'flash'
            });
            this.attackCooldown = this.attackRate;
          }
        }
      }
    }
  }

  findBlockingBuilding(player, game) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.01) return null;
    let nearest = null, nd = Infinity;
    for (const b of game.buildings) {
      if (!b.alive || !b.solid) continue;
      const d = Utils.distance(this.x, this.y, b.x, b.y);
      if (d > dist + 80) continue;
      const t = ((b.x - this.x) * dx + (b.y - this.y) * dy) / (dist * dist);
      if (t < 0 || t > 1) continue;
      const projX = this.x + dx * t;
      const projY = this.y + dy * t;
      const pd = Utils.distance(b.x, b.y, projX, projY);
      if (pd < (Math.max(b.w, b.h) / 2 + this.radius)) {
        if (d < nd) { nearest = b; nd = d; }
      }
    }
    return nearest;
  }

  draw(ctx, camera) {
    if (!this.alive) return;
    const s = Utils.worldToScreen(this.x, this.y, camera);
    const flash = this.hitFlash > 0;
    const bob = Math.sin(this.wobble) * 1.5;

    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + this.radius * 0.85, this.radius * 0.9, this.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    const fill = flash ? '#fff' : this.color;
    ctx.strokeStyle = this.dark;
    ctx.lineWidth = 2;

    if (this.type === 'slime') {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 2 + bob * 0.5, this.radius, this.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x - 4, s.y - 1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x + 4, s.y - 1, 2, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'wolf') {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + bob * 0.3, this.radius, this.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = this.dark;
      ctx.fillRect(s.x - this.radius + 2, s.y - this.radius * 0.7 - 4, 4, 4);
      ctx.fillRect(s.x + this.radius - 6, s.y - this.radius * 0.7 - 4, 4, 4);
      ctx.fillStyle = '#ff0';
      ctx.fillRect(s.x - 5, s.y - 2, 2, 2);
      ctx.fillRect(s.x + 3, s.y - 2, 2, 2);
    } else if (this.type === 'goblin') {
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.arc(s.x, s.y + bob * 0.5, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff0';
      ctx.fillRect(s.x - 5, s.y - 4, 3, 3);
      ctx.fillRect(s.x + 2, s.y - 4, 3, 3);
      // 武器
      ctx.fillStyle = '#888';
      ctx.fillRect(s.x + this.radius - 2, s.y - 8, 2, 14);
    } else if (this.type === 'skeleton') {
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.arc(s.x, s.y + bob * 0.3, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#222';
      ctx.fillRect(s.x - 5, s.y - 4, 3, 4);
      ctx.fillRect(s.x + 2, s.y - 4, 3, 4);
      ctx.fillRect(s.x - 3, s.y + 2, 6, 2);
      ctx.strokeStyle = '#9f6a30'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x + this.radius, s.y, 10, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    } else if (this.type === 'troll') {
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.arc(s.x, s.y + bob * 0.4, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x - 6, s.y + 4, 4, 8);
      ctx.fillRect(s.x + 2, s.y + 4, 4, 8);
      ctx.fillStyle = '#ff0';
      ctx.beginPath(); ctx.arc(s.x - 7, s.y - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x + 7, s.y - 4, 3, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'imp') {
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.arc(s.x, s.y + bob, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // 角
      ctx.fillStyle = this.dark;
      ctx.beginPath();
      ctx.moveTo(s.x - 6, s.y - this.radius);
      ctx.lineTo(s.x - 3, s.y - this.radius - 6);
      ctx.lineTo(s.x - 2, s.y - this.radius);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s.x + 6, s.y - this.radius);
      ctx.lineTo(s.x + 3, s.y - this.radius - 6);
      ctx.lineTo(s.x + 2, s.y - this.radius);
      ctx.fill();
      // 眼睛
      ctx.fillStyle = '#ff0';
      ctx.fillRect(s.x - 4, s.y - 2, 2, 2);
      ctx.fillRect(s.x + 2, s.y - 2, 2, 2);
    } else if (this.type === 'spider') {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, this.radius, this.radius * 0.75, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // 8 隻腳
      ctx.strokeStyle = this.dark; ctx.lineWidth = 1.5;
      const legBob = Math.sin(this.wobble * 2) * 2;
      for (let i = 0; i < 4; i++) {
        const yOff = -6 + i * 4;
        ctx.beginPath();
        ctx.moveTo(s.x - this.radius, s.y + yOff);
        ctx.lineTo(s.x - this.radius - 8, s.y + yOff + legBob);
        ctx.moveTo(s.x + this.radius, s.y + yOff);
        ctx.lineTo(s.x + this.radius + 8, s.y + yOff - legBob);
        ctx.stroke();
      }
      // 眼睛
      ctx.fillStyle = '#f0f';
      ctx.fillRect(s.x - 5, s.y - 3, 2, 2);
      ctx.fillRect(s.x + 3, s.y - 3, 2, 2);
    } else if (this.type === 'dark_mage') {
      // 法袍
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(s.x - this.radius, s.y + this.radius);
      ctx.lineTo(s.x - this.radius * 0.6, s.y - this.radius);
      ctx.lineTo(s.x + this.radius * 0.6, s.y - this.radius);
      ctx.lineTo(s.x + this.radius, s.y + this.radius);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // 罩兜
      ctx.fillStyle = this.dark;
      ctx.beginPath();
      ctx.moveTo(s.x - this.radius * 0.6, s.y - this.radius * 0.4);
      ctx.lineTo(s.x, s.y - this.radius - 4);
      ctx.lineTo(s.x + this.radius * 0.6, s.y - this.radius * 0.4);
      ctx.closePath(); ctx.fill();
      // 紫光眼
      ctx.fillStyle = '#dca6ff';
      ctx.fillRect(s.x - 3, s.y - 4, 6, 2);
      // 浮空法球
      const orbAng = this.wobble;
      const ox = s.x + Math.cos(orbAng) * 14;
      const oy = s.y + Math.sin(orbAng) * 4 - 4;
      Utils.drawGlowCircle(ctx, ox, oy, 12, '#b06aff', 0.7);
      ctx.fillStyle = '#dca6ff';
      ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
    }

    if (this.hp < this.maxHp) {
      Utils.drawHpBar(ctx, s.x - this.radius, s.y - this.radius - 9, this.radius * 2, 4, this.hp / this.maxHp);
    }
  }
}
