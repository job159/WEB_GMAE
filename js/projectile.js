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
      kind === 'fireball'      ? 10 :
      kind === 'magic'         ? 8  :
      kind === 'bullet'        ? 6  :
      kind === 'darkmoon'      ? 26 :
      kind === 'giantarrow'    ? 10 :
      kind === 'eldritch'      ? 14 :
      kind === 'eldritchFire'  ? 16 :
      kind === 'eldritchVoid'  ? 22 : 4;
    this.life =
      kind === 'fireball'      ? 1.6 :
      kind === 'bullet'         ? 0.9 :
      kind === 'darkmoon'       ? 0.75 :
      kind === 'giantarrow'     ? 1.7 :
      kind === 'eldritchVoid'   ? 1.4 : 1.6;
    // 衍生屬性
    this.aoeOnHit = (kind === 'eldritchFire') ? 80 : (kind === 'eldritchVoid') ? 130 : 0;
    this.alive = true;
    this.trailTimer = 0;
    this.aoe = extra.aoe || (kind === 'fireball' ? 95 : (kind === 'magic' ? 70 : 0));
    this.spin = 0; // for visuals
    this.color =
      owner === 'enemy'        ? '#ff5a5a' :
      kind === 'fireball'      ? '#ff8033' :
      kind === 'magic'         ? '#b06aff' :
      kind === 'bullet'        ? '#ffd86b' :
      kind === 'darkmoon'      ? '#1a0a1a' :
      kind === 'giantarrow'    ? '#ffd86b' :
      kind === 'eldritch'      ? '#aa00ff' :
      kind === 'eldritchFire'  ? '#ff3030' :
      kind === 'eldritchVoid'  ? '#0a0030' :
      '#fff066';
    this.trailColor =
      owner === 'enemy'        ? '#ff8080' :
      kind === 'fireball'      ? '#ffaa33' :
      kind === 'magic'         ? '#dca6ff' :
      kind === 'bullet'        ? '#ffd86b' :
      kind === 'darkmoon'      ? '#5a0a5a' :
      kind === 'giantarrow'    ? '#ffd86b' :
      kind === 'eldritch'      ? '#cc00ff' :
      kind === 'eldritchFire'  ? '#ff6010' :
      kind === 'eldritchVoid'  ? '#5a00aa' :
      '#fff066';
    // 冰巨箭旗標（外部設定）
    this.iceArrow = false;
    // 冰巨箭命中後凍結秒數
    this.freezeOnHit = 0;
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
        for (const __boss of game.bosses) {
          if (!__boss || !__boss.alive) continue;
          const d = Utils.distance(this.x, this.y, __boss.x, __boss.y);
          if (d < this.aoe + __boss.radius) {
            __boss.takeDamage(this.damage, game);
            game.particles.damageText(__boss.x, __boss.y - 12, this.damage, '#ffaa33', true);
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
      } else if (this.kind === 'darkmoon') {
        // 黑色霧氣拖尾 + 紅光火花
        for (let i = 0; i < 3; i++) {
          game.particles.add({
            x: this.x + Utils.jitter(14), y: this.y + Utils.jitter(14),
            vx: -this.vx * 0.08, vy: -this.vy * 0.08,
            life: 0.5, max: 0.5, color: Utils.pick(['#1a0a1a', '#3a0a3a', '#5a0a5a']),
            size: Utils.randomRange(5, 9), type: 'fire', grow: -8
          });
        }
        if (Utils.chance(0.5)) {
          game.particles.add({
            x: this.x + Utils.jitter(20), y: this.y + Utils.jitter(20),
            vx: Utils.jitter(40), vy: Utils.jitter(40),
            life: 0.3, max: 0.3, color: '#cc3030',
            size: 2, type: 'spark'
          });
        }
      } else if (this.kind === 'eldritch' || this.kind === 'eldritchFire' || this.kind === 'eldritchVoid') {
        // 可怕誇張魔粒子拖尾
        const baseColor = this.trailColor;
        for (let i = 0; i < 4; i++) {
          game.particles.add({
            x: this.x + Utils.jitter(16), y: this.y + Utils.jitter(16),
            vx: -this.vx * 0.06, vy: -this.vy * 0.06,
            life: 0.5, max: 0.5, color: baseColor,
            size: Utils.randomRange(4, 8), type: 'fire', grow: -10
          });
        }
        // 旋轉觸鬚火花
        if (Utils.chance(0.7)) {
          game.particles.add({
            x: this.x + Utils.jitter(20), y: this.y + Utils.jitter(20),
            vx: Utils.jitter(60), vy: Utils.jitter(60),
            life: 0.3, max: 0.3, color: '#fff',
            size: 2, type: 'spark'
          });
        }
        // 神杖：黑洞拖尾
        if (this.kind === 'eldritchVoid') {
          game.particles.add({
            x: this.x, y: this.y, vx: 0, vy: 0,
            life: 0.4, max: 0.4, color: 'rgba(10,0,40,0.6)',
            size: 14, type: 'smoke', grow: 16
          });
        }
        // 焚天杖：火花
        if (this.kind === 'eldritchFire') {
          game.particles.add({
            x: this.x + Utils.jitter(10), y: this.y + Utils.jitter(10),
            vx: 0, vy: -Utils.randomRange(10, 30),
            life: 0.35, max: 0.35, color: '#ff8030',
            size: 4, type: 'fire', grow: -8
          });
        }
      } else if (this.kind === 'giantarrow') {
        if (this.iceArrow) {
          // 冰晶霧氣拖尾
          for (let i = 0; i < 4; i++) {
            game.particles.add({
              x: this.x + Utils.jitter(28), y: this.y + Utils.jitter(28),
              vx: -this.vx * 0.04, vy: -this.vy * 0.04,
              life: 0.6, max: 0.6,
              color: Utils.pick(['#aaccff', '#fff', '#88aaff']),
              size: Utils.randomRange(5, 9), type: 'fire', grow: -10
            });
          }
          // 旋轉冰晶
          if (Utils.chance(0.6)) {
            game.particles.add({
              x: this.x + Utils.jitter(20), y: this.y + Utils.jitter(20),
              vx: Utils.jitter(50), vy: Utils.jitter(50),
              life: 0.45, max: 0.45, color: '#fff',
              size: Utils.randomRange(3, 5), type: 'iceShard',
              angle: Math.random() * Math.PI * 2
            });
          }
        } else {
          // 普通巨箭金色拖尾
          game.particles.bulletTrail(this.x, this.y, '#ffd86b');
          for (let i = 0; i < 2; i++) {
            game.particles.add({
              x: this.x + Utils.jitter(8), y: this.y + Utils.jitter(8),
              vx: 0, vy: 0,
              life: 0.3, max: 0.3, color: '#fff066',
              size: 4, type: 'fire', grow: -10
            });
          }
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
          game.particles.damageText(e.x, e.y - 10, this.damage, this.iceArrow ? '#aaccff' : '#fff066');
          AudioMgr.arrowHit();
          // 冰箭凍結
          if (this.iceArrow || this.freezeOnHit > 0) {
            const dur = this.freezeOnHit || 2.5;
            e.frozenTimer = Math.max(e.frozenTimer || 0, dur);
            e.slowTimer = Math.max(e.slowTimer || 0, dur + 1);
            // 命中冰爆
            game.particles.frostNova(e.x, e.y, 40);
            game.particles.spark(e.x, e.y, 14, '#aaccff');
          }
          // 魔粒子命中 AOE
          if (this.aoeOnHit > 0) {
            const r = this.aoeOnHit;
            const aoeDmg = this.damage * 0.6;
            for (const e2 of game.enemies) {
              if (!e2.alive || this.hitSet.has(e2)) continue;
              if (Utils.distance(this.x, this.y, e2.x, e2.y) < r + e2.radius) {
                e2.takeDamage(aoeDmg, game);
                this.hitSet.add(e2);
              }
            }
            for (const __boss of game.bosses) {
              if (!__boss || !__boss.alive) continue;
              if (Utils.distance(this.x, this.y, __boss.x, __boss.y) < r + __boss.radius) {
                __boss.takeDamage(aoeDmg, game);
              }
            }
            // 視覺
            if (this.kind === 'eldritchFire') {
              game.particles.explosion(this.x, this.y, r);
            } else if (this.kind === 'eldritchVoid') {
              // 黑洞吸收效果
              game.particles.shockRing(this.x, this.y, r, '#5a00aa');
              game.particles.shockRing(this.x, this.y, r * 0.6, '#aa00ff');
              for (let i = 0; i < 24; i++) {
                const a = (i / 24) * Math.PI * 2;
                game.particles.add({
                  x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r,
                  vx: -Math.cos(a) * 200, vy: -Math.sin(a) * 200,
                  life: 0.4, max: 0.4, color: '#aa00ff', size: 4, type: 'spark'
                });
              }
              game.particles.add({
                x: this.x, y: this.y, vx: 0, vy: 0,
                life: 0.5, max: 0.5, color: 'rgba(10,0,30,0.85)',
                size: r, type: 'flash'
              });
            }
            game.shake(this.kind === 'eldritchVoid' ? 9 : 5, 0.25);
          }
          // 爆裂連矢 buff:命中產生大範圍爆炸
          if (this.boomOnHit > 0) {
            const br = this.boomOnHit;
            // 黑紅爆炸視覺
            game.particles.add({
              x: this.x, y: this.y, vx: 0, vy: 0,
              life: 0.4, max: 0.4, color: 'rgba(255,80,30,0.7)',
              size: br * 1.4, type: 'flash'
            });
            game.particles.explosion(this.x, this.y, br);
            game.particles.shockRing(this.x, this.y, br * 1.2, '#ff5020');
            game.particles.shockRing(this.x, this.y, br * 0.8, '#ffd86b');
            // 額外火花環
            for (let k = 0; k < 16; k++) {
              const a = (k / 16) * Math.PI * 2;
              const sp = Utils.randomRange(180, 380);
              game.particles.add({
                x: this.x, y: this.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: 0.5, max: 0.5, color: Utils.pick(['#ffd86b', '#ff8030', '#fff']),
                size: 4, type: 'fire', grow: -5
              });
            }
            game.shake(6, 0.22);
            AudioMgr.explosion();
            const aoeDmg = this.damage * 0.7;
            for (const e2 of game.enemies) {
              if (!e2.alive) continue;
              if (Utils.distance(this.x, this.y, e2.x, e2.y) < br + e2.radius) {
                e2.takeDamage(aoeDmg, game);
                game.particles.damageText(e2.x, e2.y - 10, aoeDmg, '#ffaa33');
              }
            }
            for (const b2 of game.bosses) {
              if (!b2 || !b2.alive) continue;
              if (Utils.distance(this.x, this.y, b2.x, b2.y) < br + b2.radius) {
                b2.takeDamage(aoeDmg * 0.7, game);
              }
            }
          }
          // 穿透
          if (this.pierce > 0) {
            this.pierce--;
            game.particles.spark(this.x, this.y, 4, this.color);
            continue;
          }
          this.alive = false;
          if (this.aoe > 0) this.detonate(game);
          else game.particles.bulletImpact(this.x, this.y, this.iceArrow ? '#aaccff' : this.color);
          return;
        }
      }
      for (const __boss of game.bosses) {
        if (!__boss || !__boss.alive) continue;
        if (Collision.circleCircle(this, __boss)) {
          __boss.takeDamage(this.damage, game);
          game.particles.damageText(__boss.x, __boss.y - 10, this.damage, '#fff066', true);
          this.alive = false;
          if (this.aoe > 0) this.detonate(game);
          else game.particles.bulletImpact(this.x, this.y, this.color);
          // 爆裂連矢:命中爆炸
          if (this.boomOnHit > 0) {
            const br = this.boomOnHit;
            game.particles.explosion(this.x, this.y, br);
            game.shake(6, 0.22);
            for (const e2 of game.enemies) {
              if (!e2.alive) continue;
              if (Utils.distance(this.x, this.y, e2.x, e2.y) < br + e2.radius) {
                e2.takeDamage(this.damage * 0.6, game);
              }
            }
            for (const b2 of game.bosses) {
              if (!b2 || !b2.alive || b2 === __boss) continue;
              if (Utils.distance(this.x, this.y, b2.x, b2.y) < br + b2.radius) {
                b2.takeDamage(this.damage * 0.5, game);
              }
            }
          }
          return;
        }
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
    } else if (this.kind === 'darkmoon') {
      // ===== 巨大黑色月牙 =====
      Utils.drawGlowCircle(ctx, s.x, s.y, 70, '#5a0a5a', 0.8);
      Utils.drawGlowCircle(ctx, s.x, s.y, 45, '#cc3030', 0.5);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(this.angle);
      // 外層黑色厚弧（主體月牙）
      ctx.strokeStyle = '#0a000a';
      ctx.lineWidth = 36;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#cc3030';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(0, 0, 32, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 中層紫色
      ctx.strokeStyle = '#3a0a3a';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.arc(0, 0, 32, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
      // 內層血紅色
      ctx.strokeStyle = '#cc3030';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 32, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
      // 邊緣白熱核心
      ctx.strokeStyle = '#ff8080';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 32, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();
      // 月牙尖端兩個閃光
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#cc3030'; ctx.shadowBlur = 12;
      const tip1x = Math.cos(-Math.PI * 0.45) * 32;
      const tip1y = Math.sin(-Math.PI * 0.45) * 32;
      const tip2x = Math.cos(Math.PI * 0.45) * 32;
      const tip2y = Math.sin(Math.PI * 0.45) * 32;
      ctx.beginPath(); ctx.arc(tip1x, tip1y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tip2x, tip2y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    } else if (this.kind === 'eldritch' || this.kind === 'eldritchFire' || this.kind === 'eldritchVoid') {
      // ===== 可怕誇張魔粒子 =====
      const isVoid = this.kind === 'eldritchVoid';
      const isFire = this.kind === 'eldritchFire';
      const outer = isVoid ? '#5a00aa' : isFire ? '#ff3030' : '#aa00ff';
      const mid   = isVoid ? '#aa00ff' : isFire ? '#ff8030' : '#dca6ff';
      const core  = isVoid ? '#3a0050' : isFire ? '#fff' : '#fff';
      const size  = isVoid ? 22 : isFire ? 16 : 14;

      // 大光暈
      Utils.drawGlowCircle(ctx, s.x, s.y, size * 3.5, outer, 0.9);
      Utils.drawGlowCircle(ctx, s.x, s.y, size * 2,   mid,   0.7);

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(this.spin);

      // 5 條旋轉觸鬚（恐怖質感）
      ctx.strokeStyle = outer;
      ctx.shadowColor = outer;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        const len = size + 6 + Math.sin(this.spin * 4 + i) * 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // 主體環
      ctx.fillStyle = outer;
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mid;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2); ctx.fill();

      // 創世神杖：中央虛空黑洞
      if (isVoid) {
        ctx.fillStyle = '#0a0030';
        ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#aa00ff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.stroke();
      }

      // 兩顆血紅眼睛
      ctx.fillStyle = '#ff0000';
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(-size * 0.25, -size * 0.1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 0.25, -size * 0.1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    } else if (this.kind === 'giantarrow') {
      // ===== 巨大箭矢 =====
      const ice = this.iceArrow;
      const scale = ice ? 4.0 : 1.8;  // 冰巨箭 = 5 倍大、普通巨箭 = 1.8 倍
      const main = ice ? '#aaccff' : '#cf9b3a';
      const accent = ice ? '#fff' : '#ffd86b';
      const tail = ice ? '#88aaff' : '#aa8030';
      const glow = ice ? '#aaccff' : '#ffd86b';

      // 大光暈
      Utils.drawGlowCircle(ctx, s.x, s.y, 30 * scale, glow, 0.75);
      if (ice) Utils.drawGlowCircle(ctx, s.x, s.y, 16 * scale, '#fff', 0.5);

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(this.angle);
      ctx.shadowColor = glow;
      ctx.shadowBlur = ice ? 24 : 14;

      // 箭桿（厚重）
      ctx.fillStyle = main;
      ctx.fillRect(-12 * scale, -2.5 * scale, 20 * scale, 5 * scale);

      // 箭桿暗紋
      ctx.fillStyle = ice ? '#5a88cc' : '#7a3a10';
      ctx.fillRect(-12 * scale, 0, 20 * scale, 1.5 * scale);

      // 箭頭（巨大三角）
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(14 * scale, 0);
      ctx.lineTo(5 * scale, -7 * scale);
      ctx.lineTo(5 * scale, 7 * scale);
      ctx.closePath();
      ctx.fill();
      // 箭頭內側白光
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(11 * scale, 0);
      ctx.lineTo(7 * scale, -3 * scale);
      ctx.lineTo(7 * scale, 3 * scale);
      ctx.closePath();
      ctx.fill();

      // 羽尾（4 片）
      ctx.fillStyle = tail;
      ctx.beginPath();
      ctx.moveTo(-12 * scale, 0);
      ctx.lineTo(-20 * scale, -7 * scale);
      ctx.lineTo(-15 * scale, 0);
      ctx.lineTo(-20 * scale, 7 * scale);
      ctx.closePath();
      ctx.fill();

      // 冰巨箭專屬：冰晶刺
      if (ice) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 5; i++) {
          const ix = -8 * scale + i * 4 * scale;
          // 上方冰刺
          ctx.beginPath();
          ctx.moveTo(ix, -4 * scale);
          ctx.lineTo(ix + 2 * scale, -9 * scale);
          ctx.lineTo(ix + 4 * scale, -4 * scale);
          ctx.closePath(); ctx.fill();
          // 下方冰刺
          ctx.beginPath();
          ctx.moveTo(ix, 4 * scale);
          ctx.lineTo(ix + 2 * scale, 9 * scale);
          ctx.lineTo(ix + 4 * scale, 4 * scale);
          ctx.closePath(); ctx.fill();
        }
        // 箭頭周圍冰光環
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(10 * scale, 0, 5 * scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
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
