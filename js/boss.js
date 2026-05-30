/* ================================================================
 * boss.js
 * 「荒野巨獸」
 * 攻擊：近戰重擊、地震 AOE、衝鋒、召喚小怪、狂暴
 * ================================================================ */
class Boss {
  constructor(x, y, waveNumber) {
    this.x = x; this.y = y;
    this.scale = 1 + (waveNumber - 5) * 0.25;
    this.maxHp = Math.round(600 * this.scale);
    this.hp = this.maxHp;
    this.speed = 65;
    this.damage = Math.round(28 * this.scale);
    this.radius = 38;
    this.alive = true;

    this.attackCooldown = 0;
    this.attackRate = 1.2;
    this.summonCooldown = 6;
    this.slamCooldown = 8;
    this.chargeCooldown = 10;
    this.chargeTimer = 0;  // > 0 表示正在衝鋒
    this.chargeVX = 0; this.chargeVY = 0;

    this.exp = 200;
    this.gold = 200 + waveNumber * 20;
    this.enraged = false;
    this.hitFlash = 0;
    this.wobble = 0;
    this.waveNumber = waveNumber;
    this.spawnAnim = 1.0; // 出場動畫
  }

  takeDamage(d, game) {
    if (!this.alive) return;
    this.hp -= d;
    this.hitFlash = 0.15;
    AudioMgr.bossHit();
    game.shake(3, 0.1);
    if (!this.enraged && this.hp < this.maxHp * 0.35) {
      this.enraged = true;
      this.attackRate *= 0.55;
      this.speed *= 1.5;
      Utils.bigToast('荒野巨獸狂暴！');
      game.particles.shockRing(this.x, this.y, 200, '#ff5050');
      game.particles.spark(this.x, this.y, 40, '#ff8080');
      AudioMgr.bossSpawn();
      game.shake(8, 0.4);
    }
    if (this.hp <= 0) {
      this.alive = false; this.hp = 0;
      game.player.gainExp(this.exp, game);
      game.inventory.gold += this.gold;
      game.score += 500 + this.waveNumber * 50;
      game.particles.explosion(this.x, this.y, 180);
      Utils.bigToast('擊敗荒野巨獸！');
      AudioMgr.victory();
      game.shake(12, 0.6);
    }
  }

  update(dt, game) {
    if (!this.alive) return;
    if (this.spawnAnim > 0) { this.spawnAnim -= dt; return; }
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.wobble += dt * 4;

    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 衝鋒中
    if (this.chargeTimer > 0) {
      this.x += this.chargeVX * dt;
      this.y += this.chargeVY * dt;
      this.chargeTimer -= dt;
      // 擊破建築 / 撞玩家
      for (const b of game.buildings) {
        if (!b.alive || !b.solid) continue;
        if (Collision.circleRect(this.x, this.y, this.radius, b.x, b.y, b.w, b.h)) {
          b.takeDamage(80);
          game.particles.spark(b.x, b.y, 12, '#fff');
        }
      }
      if (dist < this.radius + player.radius + 4) {
        player.takeDamage(this.damage * 1.3);
        this.chargeTimer = 0;
      }
      this.x = Utils.clamp(this.x, this.radius, game.mapW - this.radius);
      this.y = Utils.clamp(this.y, this.radius, game.mapH - this.radius);
      game.particles.smoke(this.x, this.y, 1, 'rgba(200,80,80,0.4)');
      return;
    }

    // 衝鋒冷卻 -> 觸發
    this.chargeCooldown -= dt;
    if (this.chargeCooldown <= 0 && dist > 180 && dist < 600) {
      const ang = Utils.angle(this.x, this.y, player.x, player.y);
      this.chargeVX = Math.cos(ang) * 380;
      this.chargeVY = Math.sin(ang) * 380;
      this.chargeTimer = 0.6;
      this.chargeCooldown = this.enraged ? 6 : 10;
      Utils.toast('Boss 衝鋒！');
      game.particles.shockRing(this.x, this.y, 60, '#ff8080');
      return;
    }

    // 移動
    if (dist > this.radius + player.radius + 6) {
      const ux = dx / dist, uy = dy / dist;
      const sp = this.speed * dt;
      let nx = this.x + ux * sp, ny = this.y + uy * sp;
      for (const b of game.buildings) {
        if (!b.alive || !b.solid) continue;
        if (Collision.circleRect(nx, ny, this.radius, b.x, b.y, b.w, b.h)) {
          b.takeDamage(45 * dt);
          nx = this.x; ny = this.y;
          break;
        }
      }
      this.x = Utils.clamp(nx, this.radius, game.mapW - this.radius);
      this.y = Utils.clamp(ny, this.radius, game.mapH - this.radius);
    }

    // 近戰
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0 && dist < this.radius + player.radius + 12) {
      player.takeDamage(this.damage);
      this.attackCooldown = this.attackRate;
      game.particles.spark(player.x, player.y, 8, '#ff5a5a');
    }

    // 地震
    this.slamCooldown -= dt;
    if (this.slamCooldown <= 0 && dist < 280) {
      // AOE
      const r = 180;
      game.particles.shockRing(this.x, this.y, r, '#ffaa33');
      game.particles.spark(this.x, this.y, 30, '#ffd86b');
      if (dist < r + player.radius) player.takeDamage(this.damage * 0.7);
      for (const b of game.buildings) {
        if (!b.alive) continue;
        if (Utils.distance(this.x, this.y, b.x, b.y) < r) b.takeDamage(50);
      }
      this.slamCooldown = this.enraged ? 5 : 8;
      AudioMgr.explosion();
      game.shake(6, 0.3);
    }

    // 召喚
    this.summonCooldown -= dt;
    if (this.summonCooldown <= 0) {
      const summons = this.enraged ? ['imp', 'imp', 'spider'] : ['slime', 'slime'];
      for (const t of summons) {
        const ang = Math.random() * Math.PI * 2;
        const r = 60 + Math.random() * 40;
        const ex = this.x + Math.cos(ang) * r;
        const ey = this.y + Math.sin(ang) * r;
        game.enemies.push(new Enemy(t, ex, ey, 1));
        game.particles.shockRing(ex, ey, 30, '#aa44ff');
      }
      this.summonCooldown = this.enraged ? 4 : 7;
      Utils.toast('Boss 召喚小怪！');
    }
  }

  draw(ctx, camera) {
    if (!this.alive) return;
    const s = Utils.worldToScreen(this.x, this.y, camera);
    const bob = Math.sin(this.wobble) * 2;
    const scale = this.spawnAnim > 0 ? Utils.lerp(1.4, 1, 1 - this.spawnAnim) : 1;

    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + this.radius * 0.85, this.radius * 1.1, this.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 發光
    Utils.drawGlowCircle(ctx, s.x, s.y, this.radius * 1.8,
      this.enraged ? 'rgba(255,80,40,0.5)' : 'rgba(120,20,60,0.4)', 0.6);

    ctx.save();
    ctx.translate(s.x, s.y + bob);
    ctx.scale(scale, scale);

    // 身體
    const fill = this.hitFlash > 0 ? '#fff'
              : this.enraged ? '#cc2030' : '#5a2a40';
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0a10';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 鋸齒外殼
    ctx.fillStyle = '#2a0a14';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * this.radius;
      const y = Math.sin(a) * this.radius;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
      ctx.lineTo(x + Math.cos(a + 0.2) * 4, y + Math.sin(a + 0.2) * 4);
      ctx.closePath();
      ctx.fill();
    }

    // 眼睛
    ctx.fillStyle = this.enraged ? '#ffea00' : '#ff5050';
    ctx.beginPath(); ctx.arc(-10, -8, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -8, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-10, -8, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -8, 2, 0, Math.PI * 2); ctx.fill();

    // 獠牙
    ctx.fillStyle = '#fff';
    ctx.fillRect(-12, 8, 5, 12);
    ctx.fillRect(7, 8, 5, 12);

    ctx.restore();

    // 出場光環
    if (this.spawnAnim > 0) {
      const a = 1 - this.spawnAnim;
      ctx.strokeStyle = `rgba(255,80,40,${1 - a})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.radius + 30 * a, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawHpBarUI(ctx, canvasW) {
    const w = canvasW * 0.7;
    const x = (canvasW - w) / 2;
    const y = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    Utils.roundRect(ctx, x - 6, y - 6, w + 12, 32, 6); ctx.fill();
    ctx.fillStyle = '#330000';
    Utils.roundRect(ctx, x, y, w, 20, 10); ctx.fill();
    const grad = ctx.createLinearGradient(x, y, x, y + 20);
    if (this.enraged) {
      grad.addColorStop(0, '#ffd86b');
      grad.addColorStop(1, '#ff5020');
    } else {
      grad.addColorStop(0, '#ff8080');
      grad.addColorStop(1, '#a01a1a');
    }
    ctx.fillStyle = grad;
    Utils.roundRect(ctx, x, y, w * (this.hp / this.maxHp), 20, 10); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    Utils.roundRect(ctx, x, y, w, 20, 10); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    Utils.strokeText(ctx, `荒野巨獸　${Math.ceil(this.hp)} / ${this.maxHp}` + (this.enraged ? '　〔狂暴〕' : ''),
                     x + w / 2, y + 15, '#fff', '#000', 3);
    ctx.textAlign = 'left';
  }
}
