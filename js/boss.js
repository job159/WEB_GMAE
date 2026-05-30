/* ================================================================
 * boss.js
 * 3 種 Boss：
 *   Wave 5  - 荒野巨獸 BeastBoss（衝鋒、地震、召喚）
 *   Wave 10 - 暗影法師 ShadowMage（瞬移、魔法彈幕、護盾）
 *   Wave 15 - 機械守護者 MechGuardian（多砲、雷射、護甲）
 * 統一 base class
 * ================================================================ */
class Boss {
  constructor(type, x, y, waveNumber) {
    this.type = type;
    this.x = x; this.y = y;
    this.waveNumber = waveNumber;
    this.scale = 1 + Math.floor((waveNumber - 5) / 5) * 0.4;
    this.alive = true;
    this.spawnAnim = 1.0;
    this.hitFlash = 0;
    this.wobble = 0;
    this.enraged = false;

    if (type === 'beast') this.initBeast();
    else if (type === 'mage') this.initMage();
    else if (type === 'mech') this.initMech();
  }

  initBeast() {
    this.name = '荒野巨獸';
    this.maxHp = Math.round(700 * this.scale);
    this.hp = this.maxHp;
    this.speed = 65;
    this.damage = Math.round(28 * this.scale);
    this.radius = 38;
    this.colorBody = '#5a2a40';
    this.colorEye = '#ff5050';
    this.attackCooldown = 0;
    this.attackRate = 1.2;
    this.summonCooldown = 6;
    this.slamCooldown = 8;
    this.chargeCooldown = 10;
    this.chargeTimer = 0;
    this.chargeVX = 0; this.chargeVY = 0;
    this.exp = 200; this.gold = 200 + this.waveNumber * 20;
  }

  initMage() {
    this.name = '暗影法師';
    this.maxHp = Math.round(900 * this.scale);
    this.hp = this.maxHp;
    this.speed = 75;
    this.damage = Math.round(22 * this.scale);
    this.radius = 32;
    this.colorBody = '#3a2050';
    this.colorEye = '#dca6ff';
    this.attackCooldown = 0;
    this.attackRate = 1.5;
    this.teleportCooldown = 5;
    this.barrageCooldown = 7;
    this.shield = 0;
    this.shieldCooldown = 12;
    this.summonCooldown = 8;
    this.orbsAng = 0;
    this.exp = 350; this.gold = 350;
  }

  initMech() {
    this.name = '機械守護者';
    this.maxHp = Math.round(1500 * this.scale);
    this.hp = this.maxHp;
    this.speed = 50;
    this.damage = Math.round(20 * this.scale);
    this.radius = 44;
    this.colorBody = '#444a5a';
    this.colorEye = '#ffaa30';
    this.armor = 0.4; // 受到傷害 -40%
    this.attackCooldown = 0;
    this.attackRate = 0.8;
    this.laserCooldown = 9;
    this.laserCharge = 0; // > 0 表示蓄力中
    this.barrageCooldown = 5;
    this.exp = 500; this.gold = 500;
    this.cannonAng = 0;
  }

  takeDamage(d, game) {
    if (!this.alive) return;
    if (this.type === 'mech' && this.armor) d *= (1 - this.armor);
    if (this.type === 'mage' && this.shield > 0) {
      this.shield -= d;
      game.particles.spark(this.x, this.y, 8, '#dca6ff');
      AudioMgr.deny();
      return;
    }
    this.hp -= d;
    this.hitFlash = 0.15;
    AudioMgr.bossHit();
    game.shake(3, 0.1);
    game.stats.recordDamageDealt(d);

    if (!this.enraged && this.hp < this.maxHp * 0.35) {
      this.enraged = true;
      if (this.type === 'beast') { this.attackRate *= 0.55; this.speed *= 1.5; }
      if (this.type === 'mage') { this.attackRate *= 0.6; }
      if (this.type === 'mech') { this.attackRate *= 0.6; this.laserCooldown = 5; }
      Utils.bigToast(`${this.name} 進入狂暴！`);
      game.particles.shockRing(this.x, this.y, 200, '#ff5050');
      AudioMgr.bossSpawn();
      game.shake(8, 0.4);
    }
    if (this.hp <= 0) {
      this.alive = false; this.hp = 0;
      game.player.gainExp(this.exp, game);
      game.inventory.gold += this.gold;
      game.stats.recordGoldEarned(this.gold);
      game.stats.bossKills++;
      game.score += 500 + this.waveNumber * 50;
      game.particles.explosion(this.x, this.y, 200);
      game.particles.explosion(this.x + 40, this.y - 20, 80);
      game.particles.explosion(this.x - 40, this.y + 20, 80);
      Utils.bigToast(`擊敗 ${this.name}！`);
      AudioMgr.victory();
      game.shake(14, 0.7);
    }
  }

  update(dt, game) {
    if (!this.alive) return;
    if (this.spawnAnim > 0) { this.spawnAnim -= dt; return; }
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.wobble += dt * 4;

    if (this.type === 'beast') this.updateBeast(dt, game);
    else if (this.type === 'mage') this.updateMage(dt, game);
    else if (this.type === 'mech') this.updateMech(dt, game);
  }

  // ====== 荒野巨獸 ======
  updateBeast(dt, game) {
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.chargeTimer > 0) {
      this.x += this.chargeVX * dt;
      this.y += this.chargeVY * dt;
      this.chargeTimer -= dt;
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

    this.chargeCooldown -= dt;
    if (this.chargeCooldown <= 0 && dist > 180 && dist < 600) {
      const ang = Utils.angle(this.x, this.y, player.x, player.y);
      this.chargeVX = Math.cos(ang) * 380;
      this.chargeVY = Math.sin(ang) * 380;
      this.chargeTimer = 0.6;
      this.chargeCooldown = this.enraged ? 6 : 10;
      Utils.toast('巨獸衝鋒！');
      game.particles.shockRing(this.x, this.y, 60, '#ff8080');
      return;
    }

    if (dist > this.radius + player.radius + 6) {
      const ux = dx / dist, uy = dy / dist;
      const sp = this.speed * dt;
      let nx = this.x + ux * sp, ny = this.y + uy * sp;
      for (const b of game.buildings) {
        if (!b.alive || !b.solid) continue;
        if (Collision.circleRect(nx, ny, this.radius, b.x, b.y, b.w, b.h)) {
          b.takeDamage(45 * dt); nx = this.x; ny = this.y; break;
        }
      }
      this.x = Utils.clamp(nx, this.radius, game.mapW - this.radius);
      this.y = Utils.clamp(ny, this.radius, game.mapH - this.radius);
    }

    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0 && dist < this.radius + player.radius + 12) {
      player.takeDamage(this.damage);
      this.attackCooldown = this.attackRate;
      game.particles.spark(player.x, player.y, 8, '#ff5a5a');
    }

    this.slamCooldown -= dt;
    if (this.slamCooldown <= 0 && dist < 280) {
      const r = 180;
      game.particles.shockRing(this.x, this.y, r, '#ffaa33');
      game.particles.shockRing(this.x, this.y, r * 0.7, '#fff');
      game.particles.spark(this.x, this.y, 30, '#ffd86b');
      if (dist < r + player.radius) player.takeDamage(this.damage * 0.7);
      for (const b of game.buildings) {
        if (!b.alive) continue;
        if (Utils.distance(this.x, this.y, b.x, b.y) < r) b.takeDamage(50);
      }
      this.slamCooldown = this.enraged ? 5 : 8;
      AudioMgr.explosion();
      game.shake(7, 0.3);
    }

    this.summonCooldown -= dt;
    if (this.summonCooldown <= 0) {
      const summons = this.enraged ? ['imp', 'imp', 'spider'] : ['slime', 'slime'];
      for (const t of summons) {
        const ang = Math.random() * Math.PI * 2;
        const r = 60 + Math.random() * 40;
        game.enemies.push(new Enemy(t, this.x + Math.cos(ang) * r, this.y + Math.sin(ang) * r, 1));
        game.particles.shockRing(this.x + Math.cos(ang) * r, this.y + Math.sin(ang) * r, 30, '#aa44ff');
      }
      this.summonCooldown = this.enraged ? 4 : 7;
      Utils.toast('Boss 召喚小怪！');
    }
  }

  // ====== 暗影法師 ======
  updateMage(dt, game) {
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.orbsAng += dt * 2;

    if (this.shield > 0) this.shield -= dt * 5;

    // 想保持距離 280
    const want = 280;
    if (dist < want * 0.85) {
      const ux = -dx / dist, uy = -dy / dist;
      this.x = Utils.clamp(this.x + ux * this.speed * dt, this.radius, game.mapW - this.radius);
      this.y = Utils.clamp(this.y + uy * this.speed * dt, this.radius, game.mapH - this.radius);
    } else if (dist > want * 1.2) {
      const ux = dx / dist, uy = dy / dist;
      this.x = Utils.clamp(this.x + ux * this.speed * dt, this.radius, game.mapW - this.radius);
      this.y = Utils.clamp(this.y + uy * this.speed * dt, this.radius, game.mapH - this.radius);
    }

    // 瞬移
    this.teleportCooldown -= dt;
    if (this.teleportCooldown <= 0) {
      // 瞬移到玩家周圍 250 距離的隨機點
      const ang = Math.random() * Math.PI * 2;
      const r = 260;
      const tx = Utils.clamp(player.x + Math.cos(ang) * r, this.radius, game.mapW - this.radius);
      const ty = Utils.clamp(player.y + Math.sin(ang) * r, this.radius, game.mapH - this.radius);
      game.particles.shockRing(this.x, this.y, 60, '#dca6ff');
      game.particles.spark(this.x, this.y, 30, '#b06aff');
      this.x = tx; this.y = ty;
      game.particles.shockRing(tx, ty, 60, '#dca6ff');
      game.particles.spark(tx, ty, 30, '#b06aff');
      AudioMgr.shockwave();
      this.teleportCooldown = this.enraged ? 3 : 6;
    }

    // 護盾
    this.shieldCooldown -= dt;
    if (this.shieldCooldown <= 0 && this.shield <= 0) {
      this.shield = 200;
      this.shieldCooldown = 18;
      Utils.toast('法師展開護盾！');
      game.particles.shockRing(this.x, this.y, 80, '#dca6ff');
    }

    // 攻擊
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      const ang = Utils.angle(this.x, this.y, player.x, player.y);
      game.projectiles.push(new Projectile(this.x, this.y, ang, 380, this.damage, 'enemy', 'magic'));
      AudioMgr.fireball();
      this.attackCooldown = this.attackRate;
    }

    // 彈幕
    this.barrageCooldown -= dt;
    if (this.barrageCooldown <= 0) {
      const n = this.enraged ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        game.projectiles.push(new Projectile(this.x, this.y, ang, 320, this.damage * 0.6, 'enemy', 'magic'));
      }
      game.particles.shockRing(this.x, this.y, 40, '#b06aff');
      AudioMgr.fireball();
      this.barrageCooldown = this.enraged ? 5 : 8;
      Utils.toast('法師釋放彈幕！');
    }

    // 召喚
    this.summonCooldown -= dt;
    if (this.summonCooldown <= 0) {
      for (let i = 0; i < 2; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = 60 + Math.random() * 30;
        game.enemies.push(new Enemy('dark_mage', this.x + Math.cos(ang) * r, this.y + Math.sin(ang) * r, 0.8));
        game.particles.shockRing(this.x + Math.cos(ang) * r, this.y + Math.sin(ang) * r, 25, '#b06aff');
      }
      this.summonCooldown = 10;
    }
  }

  // ====== 機械守護者 ======
  updateMech(dt, game) {
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.cannonAng = Utils.angle(this.x, this.y, player.x, player.y);

    // 慢慢追擊
    if (dist > this.radius + player.radius + 100) {
      const ux = dx / dist, uy = dy / dist;
      this.x = Utils.clamp(this.x + ux * this.speed * dt, this.radius, game.mapW - this.radius);
      this.y = Utils.clamp(this.y + uy * this.speed * dt, this.radius, game.mapH - this.radius);
    }

    // 雷射蓄力 + 發射
    if (this.laserCharge > 0) {
      this.laserCharge -= dt;
      // 蓄力火花
      game.particles.spark(this.x + Math.cos(this.cannonAng) * 30,
                           this.y + Math.sin(this.cannonAng) * 30, 1, '#ffd86b');
      if (this.laserCharge <= 0) {
        // 發射雷射：沿著 cannonAng 方向，500 長
        const len = 500;
        const ex = this.x + Math.cos(this.cannonAng) * len;
        const ey = this.y + Math.sin(this.cannonAng) * len;
        game.particles.chainBolt(this.x, this.y, ex, ey, '#ffd86b');
        // 對玩家檢測：點到線段距離
        const px = player.x - this.x;
        const py = player.y - this.y;
        const t = Utils.clamp((px * Math.cos(this.cannonAng) + py * Math.sin(this.cannonAng)) / len, 0, 1);
        const ppx = this.x + Math.cos(this.cannonAng) * len * t;
        const ppy = this.y + Math.sin(this.cannonAng) * len * t;
        if (Utils.distance(ppx, ppy, player.x, player.y) < player.radius + 16) {
          player.takeDamage(this.damage * 1.5);
        }
        // 對建築
        for (const b of game.buildings) {
          if (!b.alive) continue;
          const bx = b.x - this.x;
          const by = b.y - this.y;
          const bt = Utils.clamp((bx * Math.cos(this.cannonAng) + by * Math.sin(this.cannonAng)) / len, 0, 1);
          const bpx = this.x + Math.cos(this.cannonAng) * len * bt;
          const bpy = this.y + Math.sin(this.cannonAng) * len * bt;
          if (Utils.distance(bpx, bpy, b.x, b.y) < Math.max(b.w, b.h) / 2 + 12) b.takeDamage(80);
        }
        AudioMgr.lightning();
        game.shake(8, 0.3);
      }
    } else {
      this.laserCooldown -= dt;
      if (this.laserCooldown <= 0) {
        this.laserCharge = 1.2;
        this.laserCooldown = this.enraged ? 6 : 10;
        Utils.toast('機械守護者蓄力雷射！');
      }
    }

    // 多砲齊射
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0 && dist < 500) {
      game.projectiles.push(new Projectile(this.x, this.y, this.cannonAng, 480, this.damage, 'enemy', 'arrow'));
      AudioMgr.bowShoot();
      this.attackCooldown = this.attackRate;
    }
    this.barrageCooldown -= dt;
    if (this.barrageCooldown <= 0) {
      // 3 連射
      for (let i = -1; i <= 1; i++) {
        const ang = this.cannonAng + i * 0.2;
        game.projectiles.push(new Projectile(this.x, this.y, ang, 460, this.damage * 0.7, 'enemy', 'arrow'));
      }
      AudioMgr.bowShoot();
      this.barrageCooldown = this.enraged ? 2.5 : 4;
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

    // 通用發光
    const glowColor = this.enraged ? 'rgba(255,80,40,0.5)' :
                      this.type === 'mage' ? 'rgba(176,106,255,0.5)' :
                      this.type === 'mech' ? 'rgba(255,170,48,0.5)' :
                      'rgba(120,20,60,0.45)';
    Utils.drawGlowCircle(ctx, s.x, s.y, this.radius * 1.9, glowColor, 0.7);

    ctx.save();
    ctx.translate(s.x, s.y + bob);
    ctx.scale(scale, scale);

    if (this.type === 'beast') this.drawBeast(ctx);
    else if (this.type === 'mage') this.drawMage(ctx);
    else if (this.type === 'mech') this.drawMech(ctx);

    ctx.restore();

    // 護盾
    if (this.type === 'mage' && this.shield > 0) {
      ctx.strokeStyle = 'rgba(220,166,255,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y + bob, this.radius + 14 + Math.sin(this.wobble * 3) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 雷射蓄力線
    if (this.type === 'mech' && this.laserCharge > 0) {
      const ex = s.x + Math.cos(this.cannonAng) * 500;
      const ey = s.y + Math.sin(this.cannonAng) * 500;
      ctx.strokeStyle = `rgba(255,216,107,${0.3 + (1 - this.laserCharge / 1.2) * 0.7})`;
      ctx.lineWidth = 2 + (1 - this.laserCharge / 1.2) * 4;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + bob); ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    if (this.spawnAnim > 0) {
      const a = 1 - this.spawnAnim;
      ctx.strokeStyle = this.enraged ? `rgba(255,80,40,${1 - a})` : `rgba(255,160,80,${1 - a})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.radius + 40 * a, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawBeast(ctx) {
    const fill = this.hitFlash > 0 ? '#fff' : (this.enraged ? '#cc2030' : this.colorBody);
    const eyeColor = this.enraged ? '#ffea00' : '#ff5050';

    // 6 條觸鬚（背後）
    ctx.strokeStyle = this.colorBody;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const baseAng = i * Math.PI / 3 + Math.PI / 6;
      const wob = Math.sin(this.wobble * 2 + i) * 0.4;
      const len = this.radius + 32;
      const px = Math.cos(baseAng + wob) * len;
      const py = Math.sin(baseAng + wob) * len;
      const mx = Math.cos(baseAng + wob * 0.5) * (this.radius + 14);
      const my = Math.sin(baseAng + wob * 0.5) * (this.radius + 14);
      ctx.beginPath();
      ctx.moveTo(Math.cos(baseAng) * this.radius, Math.sin(baseAng) * this.radius);
      ctx.quadraticCurveTo(mx, my, px, py);
      ctx.stroke();
      // 觸鬚尖端發光
      ctx.fillStyle = eyeColor;
      ctx.shadowColor = eyeColor; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 主體
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a0a10'; ctx.lineWidth = 3; ctx.stroke();

    // 16 鋸齒
    ctx.fillStyle = '#2a0a14';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
      ctx.lineTo(Math.cos(a) * (this.radius + 12), Math.sin(a) * (this.radius + 12));
      ctx.lineTo(Math.cos(a + 0.15) * (this.radius + 6), Math.sin(a + 0.15) * (this.radius + 6));
      ctx.closePath(); ctx.fill();
    }

    // 5 尖刺王冠（上方）
    ctx.fillStyle = '#1a0a10';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.32;
      const baseR = this.radius;
      const tipR = this.radius + 28;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.12) * baseR, Math.sin(a - 0.12) * baseR);
      ctx.lineTo(Math.cos(a + 0.12) * baseR, Math.sin(a + 0.12) * baseR);
      ctx.lineTo(Math.cos(a) * tipR, Math.sin(a) * tipR);
      ctx.closePath(); ctx.fill();
      // 尖刺尖端紅光
      ctx.fillStyle = eyeColor;
      ctx.beginPath(); ctx.arc(Math.cos(a) * tipR, Math.sin(a) * tipR, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0a10';
    }

    // 4 隻眼睛（2 大 + 2 小）
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(-12, -8, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -8, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-24, -2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(24, -2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // 瞳孔
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-12, -8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-24, -2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(24, -2, 2, 0, Math.PI * 2); ctx.fill();

    // 嘴巴張開（露獠牙）
    ctx.fillStyle = '#1a0000';
    ctx.beginPath();
    ctx.ellipse(0, 14, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a0010';
    ctx.lineWidth = 2; ctx.stroke();
    // 上排尖牙
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
      const tx = -12 + i * 6;
      ctx.beginPath();
      ctx.moveTo(tx - 1.5, 7); ctx.lineTo(tx + 1.5, 7); ctx.lineTo(tx, 14);
      ctx.closePath(); ctx.fill();
    }
    // 下排尖牙
    for (let i = 0; i < 5; i++) {
      const tx = -12 + i * 6;
      ctx.beginPath();
      ctx.moveTo(tx - 1.5, 21); ctx.lineTo(tx + 1.5, 21); ctx.lineTo(tx, 14);
      ctx.closePath(); ctx.fill();
    }
  }

  drawMage(ctx) {
    const fill = this.hitFlash > 0 ? '#fff' : this.colorBody;

    // 背後魔法漩渦（深紫）
    ctx.save();
    ctx.rotate(this.orbsAng * 0.5);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.fillStyle = `rgba(176,106,255,${0.08 + (i % 2) * 0.06})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, this.radius + 50, a, a + Math.PI / 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 地面符文圈（俯視壓扁）
    ctx.save();
    ctx.rotate(-this.orbsAng);
    ctx.strokeStyle = '#dca6ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#b06aff'; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, this.radius + 12, this.radius + 36, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, this.radius + 12, this.radius + 24, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 符文記號 6 個
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const x = Math.cos(a) * (this.radius + 30);
      const y = Math.sin(a) * 14 + this.radius + 12;
      ctx.fillStyle = '#dca6ff';
      ctx.beginPath();
      ctx.moveTo(x - 4, y); ctx.lineTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4);
      ctx.closePath(); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // 能量翅膀（半透明）
    ctx.fillStyle = 'rgba(176,106,255,0.45)';
    ctx.strokeStyle = '#dca6ff';
    ctx.lineWidth = 1.5;
    // 左翅
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.5, -this.radius * 0.3);
    ctx.quadraticCurveTo(-this.radius * 2.8, -this.radius * 1.8, -this.radius * 2.2, this.radius * 0.4);
    ctx.quadraticCurveTo(-this.radius * 1.5, -this.radius * 0.2, -this.radius * 0.5, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 右翅
    ctx.beginPath();
    ctx.moveTo(this.radius * 0.5, -this.radius * 0.3);
    ctx.quadraticCurveTo(this.radius * 2.8, -this.radius * 1.8, this.radius * 2.2, this.radius * 0.4);
    ctx.quadraticCurveTo(this.radius * 1.5, -this.radius * 0.2, this.radius * 0.5, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // 翅膀羽筋
    ctx.strokeStyle = 'rgba(220,166,255,0.7)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.5, -this.radius * 0.3);
      ctx.lineTo(-this.radius * (1 + t * 1.5), -this.radius * (1 - t * 1.5));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.radius * 0.5, -this.radius * 0.3);
      ctx.lineTo(this.radius * (1 + t * 1.5), -this.radius * (1 - t * 1.5));
      ctx.stroke();
    }

    // 法袍
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-this.radius, this.radius);
    ctx.lineTo(-this.radius * 0.6, -this.radius);
    ctx.lineTo(this.radius * 0.6, -this.radius);
    ctx.lineTo(this.radius, this.radius);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1a0a30'; ctx.lineWidth = 3; ctx.stroke();
    // 法袍符文裝飾
    ctx.fillStyle = '#dca6ff';
    ctx.fillRect(-3, 0, 6, 1);
    ctx.fillRect(-2, 10, 4, 1);

    // 罩兜
    ctx.fillStyle = '#1a0a30';
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.7, -this.radius * 0.3);
    ctx.lineTo(0, -this.radius - 8);
    ctx.lineTo(this.radius * 0.7, -this.radius * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#dca6ff';
    ctx.lineWidth = 1; ctx.stroke();

    // 罩兜下 4 顆紫光眼
    ctx.fillStyle = '#dca6ff';
    ctx.shadowColor = '#dca6ff'; ctx.shadowBlur = 10;
    ctx.fillRect(-9, -10, 3, 4);
    ctx.fillRect(-4, -8, 3, 4);
    ctx.fillRect(1, -8, 3, 4);
    ctx.fillRect(6, -10, 3, 4);
    ctx.shadowBlur = 0;

    // 6 顆法球分 2 層
    // 內層 3 顆
    for (let i = 0; i < 3; i++) {
      const a = this.orbsAng + i * (Math.PI * 2 / 3);
      const ox = Math.cos(a) * (this.radius + 22);
      const oy = Math.sin(a) * (this.radius + 22);
      Utils.drawGlowCircle(ctx, ox, oy, 18, '#b06aff', 0.85);
      ctx.fillStyle = '#dca6ff';
      ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ox, oy, 2, 0, Math.PI * 2); ctx.fill();
    }
    // 外層 3 顆反向旋轉
    for (let i = 0; i < 3; i++) {
      const a = -this.orbsAng * 1.3 + i * (Math.PI * 2 / 3) + Math.PI / 3;
      const ox = Math.cos(a) * (this.radius + 50);
      const oy = Math.sin(a) * (this.radius + 50);
      Utils.drawGlowCircle(ctx, ox, oy, 13, '#ff66ff', 0.75);
      ctx.fillStyle = '#ffcaff';
      ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawMech(ctx) {
    const fill = this.hitFlash > 0 ? '#fff' : this.colorBody;
    const eye = this.enraged ? '#ff3030' : this.colorEye;
    const pulse = (Math.sin(this.wobble * 4) + 1) * 0.5;

    // 4 隻機械腳
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const x1 = Math.cos(a) * (this.radius - 4);
      const y1 = Math.sin(a) * (this.radius - 4);
      const x2 = Math.cos(a) * (this.radius + 28);
      const y2 = Math.sin(a) * (this.radius + 28);
      const mx = Math.cos(a) * (this.radius + 14) + Math.sin(this.wobble * 2 + i) * 3;
      const my = Math.sin(a) * (this.radius + 14) + Math.cos(this.wobble * 2 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();
      // 關節
      ctx.fillStyle = '#444';
      ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill();
      // 腳掌
      ctx.fillStyle = '#666';
      ctx.beginPath(); ctx.arc(x2, y2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = eye;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x2, y2, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 6;
    }

    // 六邊形主體
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const x = Math.cos(a) * this.radius;
      const y = Math.sin(a) * this.radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1a1f2a'; ctx.lineWidth = 3; ctx.stroke();

    // 內部裝甲線（中央向 6 邊）
    ctx.strokeStyle = '#1a1f2a'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * this.radius * 0.85, Math.sin(a) * this.radius * 0.85);
      ctx.stroke();
    }

    // 能量發光紋路
    ctx.strokeStyle = `rgba(255,170,48,${0.4 + pulse * 0.6})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * this.radius * 0.2, Math.sin(a) * this.radius * 0.2);
      ctx.lineTo(Math.cos(a) * this.radius * 0.65, Math.sin(a) * this.radius * 0.65);
      ctx.stroke();
    }

    // 3 個獨立旋轉砲管
    for (let i = 0; i < 3; i++) {
      const baseA = this.cannonAng + i * Math.PI * 2 / 3;
      const cx = Math.cos(baseA) * (this.radius + 6);
      const cy = Math.sin(baseA) * (this.radius + 6);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(baseA);
      // 砲管底座
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = eye; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
      // 砲管
      ctx.fillStyle = '#222';
      ctx.fillRect(0, -5, 22, 10);
      ctx.fillStyle = '#555';
      ctx.fillRect(2, -3, 18, 6);
      // 砲口紅光
      ctx.fillStyle = eye;
      ctx.beginPath(); ctx.arc(22, 0, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // 中央能量核心
    const coreSize = 10 + pulse * 5;
    Utils.drawGlowCircle(ctx, 0, 0, 36, eye, 0.6 + pulse * 0.4);
    ctx.fillStyle = eye;
    ctx.shadowColor = eye; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(0, 0, coreSize, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, coreSize * 0.4, 0, Math.PI * 2); ctx.fill();
    // 核心十字
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-coreSize, 0); ctx.lineTo(coreSize, 0);
    ctx.moveTo(0, -coreSize); ctx.lineTo(0, coreSize);
    ctx.stroke();

    // 上方護盾發射器（旋轉）
    ctx.save();
    ctx.rotate(-this.wobble * 1.5);
    ctx.fillStyle = '#444';
    ctx.fillRect(-4, -this.radius - 22, 8, 14);
    ctx.fillStyle = eye;
    ctx.shadowColor = eye; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(0, -this.radius - 24, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 6 個鉚釘
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const x = Math.cos(a) * (this.radius - 10);
      const y = Math.sin(a) * (this.radius - 10);
      ctx.fillStyle = '#aaa';
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawHpBarUI(ctx, canvasW) {
    const w = canvasW * 0.72;
    const x = (canvasW - w) / 2;
    const y = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    Utils.roundRect(ctx, x - 6, y - 6, w + 12, 38, 6); ctx.fill();
    ctx.fillStyle = '#330000';
    Utils.roundRect(ctx, x, y, w, 22, 11); ctx.fill();
    const grad = ctx.createLinearGradient(x, y, x, y + 22);
    if (this.enraged) {
      grad.addColorStop(0, '#ffd86b'); grad.addColorStop(1, '#ff5020');
    } else if (this.type === 'mage') {
      grad.addColorStop(0, '#dca6ff'); grad.addColorStop(1, '#5a30a0');
    } else if (this.type === 'mech') {
      grad.addColorStop(0, '#ffd86b'); grad.addColorStop(1, '#9f6a30');
    } else {
      grad.addColorStop(0, '#ff8080'); grad.addColorStop(1, '#a01a1a');
    }
    ctx.fillStyle = grad;
    Utils.roundRect(ctx, x, y, w * (this.hp / this.maxHp), 22, 11); ctx.fill();
    if (this.shield > 0) {
      ctx.fillStyle = 'rgba(220,166,255,0.7)';
      Utils.roundRect(ctx, x, y, w * Math.min(1, this.shield / 200), 22, 11); ctx.fill();
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    Utils.roundRect(ctx, x, y, w, 22, 11); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    const label = `${this.name}　${Math.ceil(this.hp)} / ${this.maxHp}` +
                  (this.enraged ? '　〔狂暴〕' : '') +
                  (this.shield > 0 ? `　〔護盾 ${Math.ceil(this.shield)}〕` : '');
    Utils.strokeText(ctx, label, x + w / 2, y + 16, '#fff', '#000', 3);
    ctx.textAlign = 'left';
  }
}

// 對應每個 Boss 波
const BOSS_BY_WAVE = { 5: 'beast', 10: 'mage', 15: 'mech' };
