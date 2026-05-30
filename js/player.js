/* ================================================================
 * player.js
 * 玩家 + 職業 + Mutations (g.mut) + 細緻動畫
 * ================================================================ */
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 14;

    this.classId = 'warrior';
    this.classMods = {};

    this.baseMaxHp = 100;
    this.baseMaxMp = 100;
    this.baseAttack = 10;
    this.baseDefense = 0;

    this.maxHp = 100; this.hp = 100;
    this.maxMp = 100; this.mp = 100;
    this.maxStamina = 100; this.stamina = 100;
    this.maxHunger = 100; this.hunger = 100;

    this.attack = 10;
    this.defense = 0;
    this.speed = 200;
    this.dashSpeed = 560;
    this.dashTime = 0;
    this.dashCooldown = 0;

    this.level = 1;
    this.exp = 0;
    this.expNeed = 20;
    this.skillPoints = 0;

    this.currentWeapon = 'axe';
    this.unlockedWeapons = ['axe', 'sword', 'bow'];
    this.attackCooldown = 0;
    this.facing = 0;
    this.attackEffectTime = 0;
    this.gatherCooldown = 0;
    this.invuln = 0;

    this.poisonTimer = 0;
    this.poisonDps = 0;

    this.skillCd = { q: 0, r: 0, v: 0 };
    // 暫時 buff
    this.attackBuff = 0; this.attackBuffEnd = 0;
    this.invisTimer = 0;
    this.speedBuffMult = 1; this.speedBuffEnd = 0;
    this.furyAura = 0;
    this.shopUpgrades = { maxHp: 0, maxMp: 0, attack: 0, defense: 0 };

    this.walkPhase = 0;
    this.lastTrail = 0;
    this.swingAng = 0;
    this.swingProgress = 0;
  }

  applyClass(id) {
    const cls = CHAR_CLASSES[id];
    if (!cls) return;
    this.classId = id;
    this.classMods = cls.starting.mods || {};
    this.maxHp = cls.starting.maxHp;
    this.hp = cls.starting.maxHp;
    this.maxMp = cls.starting.maxMp;
    this.mp = cls.starting.maxMp;
    this.maxStamina = cls.starting.maxStamina;
    this.stamina = cls.starting.maxStamina;
    this.maxHunger = cls.starting.maxHunger;
    this.hunger = cls.starting.maxHunger;
    this.baseAttack = cls.starting.baseAttack;
    this.baseDefense = cls.starting.baseDefense;
    this.speed = cls.starting.speed;
    this.currentWeapon = cls.starting.weapon;
  }

  applyShopUpgrades() {
    this.baseMaxHp = 100 + this.shopUpgrades.maxHp * 20;
    this.baseMaxMp = 100 + this.shopUpgrades.maxMp * 20;
    this.maxHp += this.shopUpgrades.maxHp * 20;
    this.baseAttack += this.shopUpgrades.attack * 5;
    this.baseDefense += this.shopUpgrades.defense * 3;
  }

  applyPoison(dps, dur) {
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonTimer = Math.max(this.poisonTimer, dur);
  }

  update(dt, game) {
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.gatherCooldown > 0) this.gatherCooldown -= dt;
    if (this.attackEffectTime > 0) this.attackEffectTime -= dt;
    if (this.swingProgress > 0) this.swingProgress -= dt * 6;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.invisTimer > 0) this.invisTimer -= dt;
    if (this.furyAura > 0) this.furyAura -= dt;
    for (const k of Object.keys(this.skillCd)) if (this.skillCd[k] > 0) this.skillCd[k] -= dt;

    // buff 過期
    const now = performance.now() / 1000;
    if (this.attackBuffEnd && now > this.attackBuffEnd) { this.attackBuff = 0; this.attackBuffEnd = 0; }
    if (this.speedBuffEnd && now > this.speedBuffEnd) { this.speedBuffMult = 1; this.speedBuffEnd = 0; }

    // 飢餓（受 mut.hungerMult 影響）
    const hgMult = (game.mut?.hungerMult) || 1;
    this.hunger -= dt * 0.6 * hgMult;
    if (this.hunger < 0) this.hunger = 0;
    if (this.hunger <= 0) this.hp -= dt * 2;

    // 中毒
    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      this.hp -= this.poisonDps * dt;
      if (Math.random() < dt * 6) {
        game.particles.add({
          x: this.x + Utils.jitter(10), y: this.y - 4,
          vx: Utils.jitter(8), vy: -Utils.randomRange(20, 40),
          life: 0.5, max: 0.5, color: '#a050ff',
          size: Utils.randomRange(2, 4), type: 'fire', grow: -3
        });
      }
    }

    // 體力 / 魔力
    if (this.dashTime <= 0) {
      this.stamina += dt * 12 * game.skills.staminaRegenMult();
      if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
    }
    const mpRegen = (this.classMods.mpRegen || 4);
    this.mp += dt * mpRegen;
    if (this.mp > this.maxMp) this.mp = this.maxMp;

    // 移動
    let dx = 0, dy = 0;
    if (Input.isDown('w')) dy -= 1;
    if (Input.isDown('s')) dy += 1;
    if (Input.isDown('a')) dx -= 1;
    if (Input.isDown('d')) dx += 1;
    const moving = (dx !== 0 || dy !== 0);
    if (moving) {
      const mag = Math.sqrt(dx * dx + dy * dy);
      dx /= mag; dy /= mag;
      this.walkPhase += dt * 11;
    }

    if (Input.wasPressed(' ') && this.stamina >= 25 && this.dashCooldown <= 0 && moving) {
      this.dashTime = 0.18 * game.skills.dashMult();
      this.dashCooldown = 0.6;
      this.stamina -= 25;
      AudioMgr.swing();
    }

    let sp = this.speed * (this.speedBuffMult || 1);
    if (this.dashTime > 0) {
      sp = this.dashSpeed;
      this.dashTime -= dt;
      this.lastTrail -= dt;
      if (this.lastTrail <= 0) {
        this.lastTrail = 0.03;
        game.particles.dashTrail(this.x, this.y, 'rgba(120,200,255,0.5)');
      }
    }
    const nx = this.x + dx * sp * dt;
    const ny = this.y + dy * sp * dt;
    const r = Collision.resolveMove(this, nx, ny, game.buildings, game.mapW, game.mapH);
    this.x = r.x; this.y = r.y;

    this.facing = Utils.angle(this.x, this.y, Input.mouse.worldX, Input.mouse.worldY);

    if (Input.mouse.down && this.attackCooldown <= 0) this.doAttack(game);
    if (Input.isDown('e') && this.gatherCooldown <= 0) this.doGather(game);

    if (Input.wasPressed('q')) ActiveSkills.cast('q', game);
    if (Input.wasPressed('r') && game.state === 'playing') ActiveSkills.cast('r', game);
    if (Input.wasPressed('v')) ActiveSkills.cast('v', game);
  }

  doAttack(game) {
    const w = WEAPONS[this.currentWeapon];
    if (this.stamina < w.staminaCost) { Utils.toast('體力不足'); AudioMgr.deny(); return; }
    this.stamina -= w.staminaCost;
    const atkSpeedMult = (this.classMods.attackSpeedMult || 1) * (game.mut?.attackSpeedMult || 1);
    this.attackCooldown = w.cooldown * atkSpeedMult;
    this.attackEffectTime = 0.15;
    this.swingProgress = 1;
    AudioMgr.swing();
    game.stats.recordWeapon(this.currentWeapon);

    const buff = 1 + (this.attackBuff || 0);
    const invisBoost = (this.invisTimer > 0 && game.mut?.invisBoost) ? 1.8 : 1;
    if (w.type === 'ranged') {
      const sx = this.x + Math.cos(this.facing) * (this.radius + 6);
      const sy = this.y + Math.sin(this.facing) * (this.radius + 6);
      const rngMult = (this.classMods.rangedMult || 1);
      const dmg = (w.damage + this.attack * 0.3) * rngMult * buff * invisBoost;
      game.projectiles.push(new Projectile(sx, sy, this.facing, w.projectileSpeed, dmg, 'player', 'arrow'));
      game.particles.muzzleFlash(sx, sy, this.facing, '#fff066');
      game.shake(2, 0.08);
      AudioMgr.bowShoot();
    } else {
      const melee = (this.classMods.meleeMult || 1);
      const dmg = (w.damage + this.attack) * melee * buff * invisBoost;
      let hitAny = false;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const d = Utils.distance(this.x, this.y, e.x, e.y);
        if (d > w.range + e.radius) continue;
        const ang = Utils.angle(this.x, this.y, e.x, e.y);
        if (Math.abs(Utils.angleDiff(ang, this.facing)) < w.arc / 2) {
          e.takeDamage(dmg, game);
          e.applyKnockback(this.x, this.y, 180);
          game.particles.spark(e.x, e.y, 6, '#ffd86b');
          game.particles.damageText(e.x, e.y - 10, dmg, '#fff');
          AudioMgr.hit();
          hitAny = true;
        }
      }
      if (game.boss && game.boss.alive) {
        const d = Utils.distance(this.x, this.y, game.boss.x, game.boss.y);
        if (d <= w.range + game.boss.radius) {
          const ang = Utils.angle(this.x, this.y, game.boss.x, game.boss.y);
          if (Math.abs(Utils.angleDiff(ang, this.facing)) < w.arc / 2) {
            game.boss.takeDamage(dmg, game);
            game.particles.damageText(game.boss.x, game.boss.y - 10, dmg, '#fff', true);
            AudioMgr.hit();
            hitAny = true;
          }
        }
      }
      if (hitAny) game.shake(2, 0.08);
    }
  }

  doGather(game) {
    const w = WEAPONS[this.currentWeapon];
    let nearest = null, nd = 42;
    for (const r of game.resources) {
      if (!r.alive) continue;
      const d = Utils.distance(this.x, this.y, r.x, r.y);
      if (d - r.radius < nd) { nearest = r; nd = d - r.radius; }
    }
    if (!nearest) return;
    if (this.stamina < 2) { Utils.toast('體力不足'); return; }
    this.stamina -= 2;
    this.gatherCooldown = nearest.cfg.gatherTime;
    let dmg = 6 * game.skills.gatherMultiplier();
    const bonus = w.gatherBonus[nearest.type];
    if (bonus) dmg *= bonus;
    nearest.hit(dmg, game);
    if (nearest.alive === false) game.stats.recordGather(nearest.type);
  }

  takeDamage(d) {
    if (this.invuln > 0) return;
    const final = Math.max(1, d - this.defense);
    this.hp -= final;
    this.invuln = 0.4;
    AudioMgr.playerHurt();
    if (window.GAME) {
      GAME.stats.recordDamageTaken(final);
      GAME.particles.blood(this.x, this.y, 6);
      GAME.particles.damageText(this.x, this.y - 16, final, '#ff5050', true);
      GAME.shake(3, 0.15);
      GAME.combo = 0;
    }
    if (this.hp <= 0) {
      // 不死鳥變異
      if (window.GAME && GAME.mut?.phoenix > 0) {
        GAME.mut.phoenix--;
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.invuln = 2.5;
        Utils.bigToast('不死鳥之魂！');
        AudioMgr.victory();
        GAME.particles.shockRing(this.x, this.y, 160, '#ff8030');
        GAME.particles.spark(this.x, this.y, 50, '#ffd86b');
        return;
      }
      this.hp = 0;
    }
  }

  gainExp(amount, game) {
    this.exp += amount;
    while (this.exp >= this.expNeed) {
      this.exp -= this.expNeed;
      this.level++;
      this.skillPoints++;
      this.maxHp += 5;
      this.hp = this.maxHp;
      this.mp = this.maxMp;
      this.expNeed = Math.round(this.expNeed * 1.5 + 5);
      Utils.bigToast(`LV UP　${this.level}`);
      AudioMgr.levelup();
      game.particles.levelup(this.x, this.y);
    }
  }

  // ===== 美化的角色繪製：身體 + 雙臂 + 雙腿 + 武器 + 走路擺動 =====
  draw(ctx, camera) {
    const s = Utils.worldToScreen(this.x, this.y, camera);
    const cls = CHAR_CLASSES[this.classId];
    const cMain = cls?.color || '#3aa3ff';
    const cAccent = cls?.accent || '#88ccff';

    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + this.radius * 0.85, this.radius * 0.95, this.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.dashTime > 0) Utils.drawGlowCircle(ctx, s.x, s.y, 30, '#88ccff', 0.6);
    if (this.poisonTimer > 0) Utils.drawGlowCircle(ctx, s.x, s.y, 22, '#a050ff', 0.4);
    // 血怒紅色脈動光環
    if (this.furyAura > 0) {
      const pulse = (Math.sin(performance.now() / 100) + 1) * 0.5;
      Utils.drawGlowCircle(ctx, s.x, s.y, 40 + pulse * 12, '#ff3030', 0.65);
      ctx.strokeStyle = `rgba(255,80,80,${0.5 + pulse * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 28 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 隱身：半透明
    let invisAlpha = 1;
    if (this.invisTimer > 0) {
      invisAlpha = 0.35;
      Utils.drawGlowCircle(ctx, s.x, s.y, 28, '#5cdb5c', 0.5);
    }
    ctx.save();
    ctx.globalAlpha = invisAlpha;

    const bob = Math.sin(this.walkPhase) * 1.5;
    const legSwing = Math.sin(this.walkPhase) * 4;
    const blink = this.invuln > 0 && Math.floor(this.invuln * 25) % 2 === 0;

    // 雙腿
    ctx.strokeStyle = '#16345f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x - 4, s.y + 6);
    ctx.lineTo(s.x - 4 + legSwing * 0.3, s.y + this.radius + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s.x + 4, s.y + 6);
    ctx.lineTo(s.x + 4 - legSwing * 0.3, s.y + this.radius + 4);
    ctx.stroke();

    // 身體（圓形 + 漸層）
    const grad = ctx.createLinearGradient(s.x, s.y - this.radius, s.x, s.y + this.radius);
    grad.addColorStop(0, blink ? '#fff' : cAccent);
    grad.addColorStop(1, blink ? '#ccc' : cMain);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y + bob, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#16345f';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 臉部高光
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(s.x - 4, s.y - 5 + bob, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛（朝滑鼠方向偏移）
    const eyeOff = 3;
    const eyeX = Math.cos(this.facing) * 2;
    const eyeY = Math.sin(this.facing) * 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.x - eyeOff, s.y - 2 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x + eyeOff, s.y - 2 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(s.x - eyeOff + eyeX, s.y - 2 + bob + eyeY, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x + eyeOff + eyeX, s.y - 2 + bob + eyeY, 1.5, 0, Math.PI * 2); ctx.fill();

    // 武器（朝向滑鼠，揮砍時微擺動）
    const wcfg = WEAPONS[this.currentWeapon];
    const swingArc = this.swingProgress > 0 ? Math.sin(this.swingProgress * Math.PI) * 0.5 : 0;
    const armAng = this.facing + swingArc;
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    ctx.rotate(armAng);
    // 手臂
    ctx.strokeStyle = cAccent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(this.radius + 4, 0);
    ctx.stroke();
    // 武器外型
    if (this.currentWeapon === 'sword') {
      ctx.fillStyle = '#dcdcdc';
      ctx.fillRect(this.radius + 4, -2, 18, 4);
      ctx.fillStyle = '#999';
      ctx.fillRect(this.radius + 22, -3, 4, 6);
      // 握把
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(this.radius + 2, -3, 4, 6);
    } else if (this.currentWeapon === 'axe') {
      // 斧柄
      ctx.fillStyle = '#7a4a1f';
      ctx.fillRect(this.radius, -1.5, 18, 3);
      // 斧頭
      ctx.fillStyle = '#dcdcdc';
      ctx.beginPath();
      ctx.moveTo(this.radius + 14, -7);
      ctx.lineTo(this.radius + 22, -3);
      ctx.lineTo(this.radius + 22, 3);
      ctx.lineTo(this.radius + 14, 7);
      ctx.closePath(); ctx.fill();
    } else if (this.currentWeapon === 'bow') {
      ctx.strokeStyle = '#9f6a30';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.radius + 6, 0, 10, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      // 弦
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.radius + 6, -10); ctx.lineTo(this.radius + 6, 10);
      ctx.stroke();
    }
    ctx.restore();

    // 揮砍扇形特效
    if (this.attackEffectTime > 0 && wcfg.type === 'melee') {
      const t = this.attackEffectTime / 0.15;
      ctx.strokeStyle = `rgba(255,255,255,${t})`;
      ctx.lineWidth = 6 * t;
      ctx.beginPath();
      ctx.arc(s.x, s.y + bob, wcfg.range, this.facing - wcfg.arc / 2, this.facing + wcfg.arc / 2);
      ctx.stroke();
      ctx.strokeStyle = wcfg.color;
      ctx.lineWidth = 3 * t;
      ctx.stroke();
    }

    ctx.restore(); // 對應隱身 ctx.save() (line where globalAlpha was set)
    // 頭頂血/魔/體力（不受隱身影響）
    const bx = s.x - 22, by = s.y - this.radius - 16;
    Utils.drawHpBar(ctx, bx, by, 44, 4, this.hp / this.maxHp, '#5dd55d', '#5b1d1d');
    Utils.drawHpBar(ctx, bx, by + 5, 44, 3, this.mp / this.maxMp, '#6aa6ff', '#1a2a5a');
    Utils.drawHpBar(ctx, bx, by + 9, 44, 2, this.stamina / this.maxStamina, '#4ac8ff', '#1a3a5a');
  }
}
