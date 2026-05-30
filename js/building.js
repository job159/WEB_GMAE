/* ================================================================
 * building.js
 * 建築：木牆 / 石牆 / 箭塔 / 篝火 / 工作台 / 陷阱
 * ================================================================ */
const BUILDING_TYPES = {
  wall_wood:  { name: '木牆', w: 40, h: 40, hp: 80,  solid: true,
                cost: { wood: 5 }, color: '#7a4a1f', dark: '#3a230a' },
  wall_stone: { name: '石牆', w: 40, h: 40, hp: 220, solid: true,
                cost: { wood: 2, stone: 6 }, color: '#a0a0a0', dark: '#4f4f4f' },
  tower:      { name: '箭塔', w: 36, h: 36, hp: 120, solid: true, attack: true,
                cost: { wood: 8, stone: 6, iron: 2 }, color: '#5e6f8f', dark: '#1f2540' },
  campfire:   { name: '篝火', w: 32, h: 32, hp: 60,  solid: false, heal: true,
                cost: { wood: 6 }, color: '#d05e2a', dark: '#7a2f10' },
  workbench:  { name: '工作台', w: 44, h: 36, hp: 100, solid: true, bench: true,
                cost: { wood: 10, stone: 4 }, color: '#9f7a3a', dark: '#5a4220' },
  trap:       { name: '陷阱', w: 32, h: 32, hp: 30,  solid: false, trap: true,
                cost: { wood: 4, iron: 1 }, color: '#666', dark: '#222' }
};

class Building {
  constructor(type, x, y, hpOverride = null) {
    const cfg = BUILDING_TYPES[type];
    this.type = type;
    this.cfg = cfg;
    this.x = x; this.y = y;
    this.w = cfg.w; this.h = cfg.h;
    this.maxHp = cfg.hp;
    this.hp = hpOverride != null ? hpOverride : cfg.hp;
    this.solid = !!cfg.solid;
    this.alive = true;

    this.attackCooldown = 0;
    this.attackRate = 1.0;
    this.attackRange = 240;
    this.attackDamage = 14;

    this.healPulse = 0;
    this.trapHitCooldown = 0;
    this.hitFlash = 0;
  }

  takeDamage(d) {
    if (!this.alive) return;
    this.hp -= d;
    this.hitFlash = 0.15;
    if (this.hp <= 0) { this.alive = false; this.hp = 0; }
  }

  update(dt, game) {
    if (!this.alive) return;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    if (this.cfg.attack) {
      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        let nearest = null, nd = this.attackRange;
        for (const e of game.enemies) {
          if (!e.alive) continue;
          const d = Utils.distance(this.x, this.y, e.x, e.y);
          if (d < nd) { nearest = e; nd = d; }
        }
        if (!nearest && game.boss && game.boss.alive) {
          const d = Utils.distance(this.x, this.y, game.boss.x, game.boss.y);
          if (d < this.attackRange) nearest = game.boss;
        }
        if (nearest) {
          const ang = Utils.angle(this.x, this.y, nearest.x, nearest.y);
          const dmg = this.attackDamage * game.skills.towerMult();
          const mx = this.x + Math.cos(ang) * 8;
          const my = this.y - 10 + Math.sin(ang) * 8;
          game.projectiles.push(new Projectile(mx, my, ang, 600, dmg, 'tower', 'arrow'));
          // 塔頂槍口閃光（淡藍）
          game.particles.muzzleFlash(mx, my, ang, '#88ccff');
          this.attackCooldown = this.attackRate;
        }
      }
    }

    if (this.cfg.heal) {
      this.healPulse += dt;
      const d = Utils.distance(this.x, this.y, game.player.x, game.player.y);
      if (d < 100) {
        game.player.hp = Math.min(game.player.maxHp, game.player.hp + 8 * dt);
      }
      // 偶爾噴火粒子
      if (Math.random() < dt * 6) {
        game.particles.add({
          x: this.x + Utils.jitter(6), y: this.y - 4,
          vx: Utils.jitter(10), vy: -Utils.randomRange(20, 50),
          life: 0.5, max: 0.5, color: Utils.pick(['#ffaa33', '#ffd86b', '#ff5020']),
          size: Utils.randomRange(3, 6), type: 'fire', grow: -4
        });
      }
    }

    if (this.cfg.trap) {
      this.trapHitCooldown -= dt;
      if (this.trapHitCooldown <= 0) {
        for (const e of game.enemies) {
          if (!e.alive) continue;
          if (Collision.circleRect(e.x, e.y, e.radius, this.x, this.y, this.w, this.h)) {
            e.takeDamage(18, game);
            e.slowTimer = 1.0;
            game.particles.spark(e.x, e.y, 6, '#aaaaaa');
            game.particles.damageText(e.x, e.y - 12, 18, '#ddd');
            this.takeDamage(6);
            this.trapHitCooldown = 0.6;
            break;
          }
        }
      }
    }
  }

  draw(ctx, camera) {
    if (!this.alive) return;
    const s = Utils.worldToScreen(this.x, this.y, camera);
    const cfg = this.cfg;

    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(s.x - this.w / 2 + 3, s.y - this.h / 2 + 4, this.w, this.h);

    const base = this.hitFlash > 0 ? '#fff' : cfg.color;
    // 漸層
    const grad = ctx.createLinearGradient(s.x, s.y - this.h / 2, s.x, s.y + this.h / 2);
    grad.addColorStop(0, base);
    grad.addColorStop(1, cfg.dark);
    ctx.fillStyle = grad;
    ctx.fillRect(s.x - this.w / 2, s.y - this.h / 2, this.w, this.h);
    ctx.strokeStyle = cfg.dark;
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - this.w / 2, s.y - this.h / 2, this.w, this.h);

    if (this.type === 'wall_wood') {
      // 木紋
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - this.w/2, s.y - 4); ctx.lineTo(s.x + this.w/2, s.y - 4);
      ctx.moveTo(s.x - this.w/2, s.y + 6); ctx.lineTo(s.x + this.w/2, s.y + 6);
      ctx.stroke();
    } else if (this.type === 'wall_stone') {
      // 石磚紋
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x - this.w/2 + 4, s.y - this.h/2 + 4, this.w - 8, this.h/2 - 4);
      ctx.strokeRect(s.x - this.w/2 + 4, s.y, this.w - 8, this.h/2 - 4);
    } else if (this.type === 'tower') {
      ctx.fillStyle = '#1f2540';
      ctx.beginPath();
      ctx.moveTo(s.x - 16, s.y - this.h / 2);
      ctx.lineTo(s.x + 16, s.y - this.h / 2);
      ctx.lineTo(s.x, s.y - this.h / 2 - 12);
      ctx.closePath();
      ctx.fill();
      // 攻擊範圍微光
      ctx.fillStyle = 'rgba(120,160,255,0.05)';
      ctx.beginPath(); ctx.arc(s.x, s.y, this.attackRange, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(120,160,255,0.15)';
      ctx.beginPath(); ctx.arc(s.x, s.y, this.attackRange, 0, Math.PI * 2); ctx.stroke();
    } else if (this.type === 'campfire') {
      // 木頭基底
      ctx.fillStyle = '#3a2008';
      ctx.fillRect(s.x - 12, s.y + 6, 24, 6);
      // 火焰
      const wob = Math.sin(this.healPulse * 8) * 2;
      Utils.drawGlowCircle(ctx, s.x, s.y, 26, '#ffaa33', 0.5);
      ctx.fillStyle = '#ffaa33';
      ctx.beginPath();
      ctx.moveTo(s.x - 8 + wob, s.y);
      ctx.lineTo(s.x + 8 + wob, s.y);
      ctx.lineTo(s.x + wob, s.y - 18);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(s.x - 4 + wob, s.y - 2);
      ctx.lineTo(s.x + 4 + wob, s.y - 2);
      ctx.lineTo(s.x + wob, s.y - 12);
      ctx.closePath(); ctx.fill();
    } else if (this.type === 'workbench') {
      ctx.fillStyle = '#5a4220';
      ctx.fillRect(s.x - 16, s.y - 6, 32, 4);
      // 鐵砧
      ctx.fillStyle = '#888';
      ctx.fillRect(s.x - 8, s.y, 16, 4);
    } else if (this.type === 'trap') {
      // 釘刺
      ctx.strokeStyle = '#dadada';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x - 10, s.y + 10); ctx.lineTo(s.x - 4, s.y - 10);
      ctx.moveTo(s.x, s.y + 10);      ctx.lineTo(s.x, s.y - 10);
      ctx.moveTo(s.x + 10, s.y + 10); ctx.lineTo(s.x + 4, s.y - 10);
      ctx.stroke();
      // 紅斑（血）
      ctx.fillStyle = 'rgba(150,30,30,0.4)';
      ctx.fillRect(s.x - 8, s.y + 6, 16, 4);
    }

    if (this.hp < this.maxHp) {
      Utils.drawHpBar(ctx, s.x - 22, s.y - this.h / 2 - 8, 44, 4, this.hp / this.maxHp);
    }
  }
}
