/* ================================================================
 * projectile.js
 * 子彈 / 箭矢 / 火球 / 魔法球 / 魔力子彈
 * kind: 'arrow' | 'fireball' | 'magic' | 'bullet'
 * owner: 'player' | 'tower' | 'enemy'
 * 所有投射物都有發光拖尾和爆炸命中
 * ================================================================ */
class Projectile {
  constructor(x, y, angle, speed, damage, owner, kind = 'arrow', extra = {}) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.angle = angle;
    this.damage = damage;
    this.owner = owner;
    this.kind = kind;
    this.pierce = extra.pierce || 0; // 子彈穿透：剩餘穿透次數
    this.hitSet = new Set();         // 已命中過的敵人，避免重複
    this.radius =
      kind === 'fireball' ? 10 :
      kind === 'magic'    ? 8  :
      kind === 'bullet'   ? 6  : 4;
    this.life =
      kind === 'fireball' ? 1.6 :
      kind === 'bullet'   ? 0.9 : 1.6;
    this.alive = true;
    this.trailTimer = 0;
    this.aoe = extra.aoe || (kind === 'fireball' ? 95 : (kind === 'magic' ? 70 : 0));
    this.spin = 0; // for visuals
    this.color =
      owner === 'enemy'   ? '#ff5a5a' :
      kind === 'fireball' ? '#ff8033' :
      kind === 'magic'    ? '#b06aff' :
      kind === 'bullet'   ? '#ffd86b' :
      '#fff066';
    this.trailColor =
      owner === 'enemy'   ? '#ff8080' :
      kind === 'fireball' ? '#ffaa33' :
      kind === 'magic'    ? '#dca6ff' :
      kind === 'bullet'   ? '#ffd86b' :
      '#fff066';
  }

  detonate(game) {
    if (this.aoe > 0) {
      game.particles.explosion(this.x, this.y, this.aoe);
      game.shake(this.kind === 'fireball' ? 7 : 4, 0.22);
      AudioMgr.explosion();

      if (this.owner === 'enemy') {
        const d = Utils.distance(this.x, this.y, game.player.x, game.player.y);
        if (d < this.aoe + game.player.radius) {
          game.player.takeDamage(this.damage * 0.8);
        }
      } else {
        for (const e of game.enemies) {
          if (!e.alive) continue;
          const d = Utils.distance(this.x, this.y, e.x, e.y);
          if (d < this.aoe + e.radius) {
            const dmg = this.damage * (1 - d / (this.aoe + e.radius) * 0.4);
            e.takeDamage(dmg, game);
            e.applyKnockback(this.x, this.y, 220);
            game.particles.damageText(e.x, e.y - 12, dmg, '#ffaa33');
          }
        }
        if (game.boss && game.boss.alive) {
          const d = Utils.distance(this.x, this.y, game.boss.x, game.boss.y);
          if (d < this.aoe + game.boss.radius) {
            game.boss.takeDamage(this.damage, game);
            game.particles.damageText(game.boss.x, game.boss.y - 12, this.damage, '#ffaa33', true);
          }
        }
      }
    }
  }

  update(dt, game) {
    if (!this.alive) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.spin += dt * 10;
    this.trailTimer -= dt;

    // ===== 拖尾粒子（大幅加強）=====
    if (this.trailTimer <= 0) {
      this.trailTimer = 0.012;
      if (this.kind === 'fireball') {
        game.particles.fire(this.x, this.y, 3);
        if (Utils.chance(0.3)) game.particles.smoke(this.x, this.y, 1, 'rgba(80,40,20,0.4)');
      } else if (this.kind === 'magic') {
        // 旋轉的紫魔法粒子
        const off = this.spin;
        for (let i = 0; i < 2; i++) {
          const a = off + i * Math.PI;
          game.particles.add({
            x: this.x + Math.cos(a) * 6,
            y: this.y + Math.sin(a) * 6,
            vx: 0, vy: 0,
            life: 0.35, max: 0.35, color: this.trailColor,
            size: 4, type: 'fire', grow: -10
          });
        }
      } else if (this.kind === 'bullet') {
        game.particles.bulletTrail(this.x, this.y, this.trailColor);
        // 雙拖尾
        game.particles.add({
          x: this.x + Utils.jitter(2), y: this.y + Utils.jitter(2),
          vx: -this.vx * 0.05, vy: -this.vy * 0.05,
          life: 0.4, max: 0.4, color: this.trailColor,
          size: 4, type: 'fire', grow: -12
        });
      } else if (this.kind === 'arrow') {
        if (this.owner !== 'enemy') {
          game.particles.bulletTrail(this.x, this.y, this.trailColor);
        } else {
          // 敵人箭：紅色暗光
          game.particles.add({
            x: this.x, y: this.y, vx: 0, vy: 0,
            life: 0.18, max: 0.18, color: this.trailColor,
            size: 3, type: 'spark'
          });
        }
      }
    }

    if (this.life <= 0) {
      this.alive = false;
      if (this.aoe > 0) this.detonate(game);
      return;
    }
    if (this.x < 0 || this.x > game.mapW || this.y < 0 || this.y > game.mapH) {
      this.alive = false;
      if (this.aoe > 0) this.detonate(game);
      return;
    }

    // 撞牆
    for (const b of game.buildings) {
      if (!b.alive || !b.solid) continue;
      if (Collision.circleRect(this.x, this.y, this.radius, b.x, b.y, b.w, b.h)) {
        if (this.owner === 'enemy') b.takeDamage(this.damage * 0.5);
        this.alive = false;
        if (this.aoe > 0) this.detonate(game);
        else game.particles.bulletImpact(this.x, this.y, this.color);
        return;
      }
    }

    if (this.owner === 'enemy') {
      if (Collision.circleCircle(this, game.player)) {
        game.player.takeDamage(this.damage);
        this.alive = false;
        if (this.aoe > 0) this.detonate(game);
        else game.particles.blood(this.x, this.y, 6);
        return;
      }
    } else {
      for (const e of game.enemies) {
        if (!e.alive || this.hitSet.has(e)) continue;
        if (Collision.circleCircle(this, e)) {
          e.takeDamage(this.damage, game);
          this.hitSet.add(e);
          game.particles.damageText(e.x, e.y - 10, this.damage, '#fff066');
          AudioMgr.arrowHit();
          // 穿透：若還有 pierce 次數，子彈繼續飛
          if (this.pierce > 0) {
            this.pierce--;
            game.particles.spark(this.x, this.y, 4, this.color);
            // 不結束、不爆炸
            continue;
          }
          this.alive = false;
          if (this.aoe > 0) this.detonate(game);
          else game.particles.bulletImpact(this.x, this.y, this.color);
          return;
        }
      }
      if (game.boss && game.boss.alive && Collision.circleCircle(this, game.boss)) {
        game.boss.takeDamage(this.damage, game);
        game.particles.damageText(game.boss.x, game.boss.y - 10, this.damage, '#fff066', true);
        this.alive = false;
        if (this.aoe > 0) this.detonate(game);
        else game.particles.bulletImpact(this.x, this.y, this.color);
        return;
      }
    }
  }

  draw(ctx, camera) {
    const s = Utils.worldToScreen(this.x, this.y, camera);

    if (this.kind === 'fireball') {
      // 發光光暈
      Utils.drawGlowCircle(ctx, s.x, s.y, 32, '#ffaa33', 0.8);
      // 外火球
      ctx.fillStyle = '#ffd86b';
      ctx.beginPath(); ctx.arc(s.x, s.y, this.radius + 1, 0, Math.PI * 2); ctx.fill();
      // 中層
      ctx.fillStyle = '#ff8030';
      ctx.beginPath(); ctx.arc(s.x, s.y, this.radius - 2, 0, Math.PI * 2); ctx.fill();
      // 核心（白熱）
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, this.radius - 5, 0, Math.PI * 2); ctx.fill();
    } else if (this.kind === 'magic') {
      // 紫魔法球：兩層 + 旋轉小球
      Utils.drawGlowCircle(ctx, s.x, s.y, 26, '#b06aff', 0.7);
      ctx.fillStyle = '#dca6ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, this.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, this.radius * 0.5, 0, Math.PI * 2); ctx.fill();
      // 旋轉光點
      for (let i = 0; i < 3; i++) {
        const a = this.spin + i * (Math.PI * 2 / 3);
        const ox = s.x + Math.cos(a) * (this.radius + 4);
        const oy = s.y + Math.sin(a) * (this.radius + 4);
        ctx.fillStyle = '#fff066';
        ctx.beginPath(); ctx.arc(ox, oy, 2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (this.kind === 'bullet') {
      // 魔力子彈：強光暈 + 旋轉長條核
      Utils.drawGlowCircle(ctx, s.x, s.y, 24, this.trailColor, 0.85);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(this.angle);
      // 外層光條
      ctx.fillStyle = this.trailColor;
      ctx.shadowColor = this.trailColor;
      ctx.shadowBlur = 14;
      ctx.fillRect(-14, -3, 22, 6);
      ctx.shadowBlur = 0;
      // 中層橘黃
      ctx.fillStyle = '#fff066';
      ctx.fillRect(-11, -2, 16, 4);
      // 白熱核心
      ctx.fillStyle = '#fff';
      ctx.fillRect(-8, -1, 10, 2);
      ctx.restore();
    } else {
      // 箭矢：強化版 — 帶光暈 + 流線型
      if (this.owner !== 'enemy') {
        Utils.drawGlowCircle(ctx, s.x, s.y, 16, this.trailColor, 0.6);
      }
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(this.angle);
      // 箭桿
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.owner === 'enemy' ? 4 : 8;
      ctx.fillRect(-8, -1.5, 14, 3);
      ctx.shadowBlur = 0;
      // 箭頭
      ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(3, -4); ctx.lineTo(3, 4);
      ctx.closePath();
      ctx.fill();
      // 羽尾
      ctx.fillStyle = this.owner === 'enemy' ? '#aa3030' : '#aa8030';
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(-12, -3); ctx.lineTo(-10, 0); ctx.lineTo(-12, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
