/* ================================================================
 * player.js
 * 玩家：移動、攻擊、採集、衝刺、升級、飢餓、Mana、主動技能、中毒、商店升級
 * ================================================================ */
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 14;

    this.baseAttack = 10;
    this.baseDefense = 0;
    this.baseMaxHp = 100;
    this.baseMaxMp = 100;

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
    this.attackCooldown = 0;
    this.facing = 0;
    this.attackEffectTime = 0;
    this.gatherCooldown = 0;
    this.invuln = 0;

    this.poisonTimer = 0;
    this.poisonDps = 0;

    // 主動技能冷卻
    this.skillCd = { q: 0, r: 0, g: 0, v: 0, x: 0, c: 0 };

    // 永久強化（從商店買）
    this.shopUpgrades = { maxHp: 0, maxMp: 0, attack: 0, defense: 0 };

    this.walkPhase = 0;
    this.lastTrail = 0;
  }

  applyShopUpgrades() {
    this.baseMaxHp = 100 + this.shopUpgrades.maxHp * 20;
    this.baseMaxMp = 100 + this.shopUpgrades.maxMp * 20;
    this.maxHp = this.baseMaxHp;
    this.baseAttack = 10 + this.shopUpgrades.attack * 5;
    this.baseDefense = 0 + this.shopUpgrades.defense * 3;
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
    if (this.invuln > 0) this.invuln -= dt;
    for (const k of Object.keys(this.skillCd)) {
      if (this.skillCd[k] > 0) this.skillCd[k] -= dt;
    }

    // 飢餓
    this.hunger -= dt * 0.6;
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

    // 體力回復
    if (this.dashTime <= 0) {
      this.stamina += dt * 12 * game.skills.staminaRegenMult();
      if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
    }
    // 魔力回復
    this.mp += dt * 4;
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
      this.walkPhase += dt * 10;
    }

    // 衝刺
    if (Input.wasPressed(' ') && this.stamina >= 25 && this.dashCooldown <= 0 && moving) {
      this.dashTime = 0.18 * game.skills.dashMult();
      this.dashCooldown = 0.6;
      this.stamina -= 25;
      AudioMgr.swing();
    }

    let sp = this.speed;
    if (this.dashTime > 0) {
      sp = this.dashSpeed;
      this.dashTime -= dt;
      // 衝刺殘影
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

    // 攻擊
    if (Input.mouse.down && this.attackCooldown <= 0) {
      this.doAttack(game);
    }

    // 採集
    if (Input.isDown('e') && this.gatherCooldown <= 0) {
      this.doGather(game);
    }

    // 主動技能
    if (Input.wasPressed('q')) ActiveSkills.cast('q', game);
    if (Input.wasPressed('r') && game.state === 'playing') ActiveSkills.cast('r', game);
    if (Input.wasPressed('g')) ActiveSkills.cast('g', game);
    if (Input.wasPressed('v')) ActiveSkills.cast('v', game);
    if (Input.wasPressed('x')) ActiveSkills.cast('x', game);
    if (Input.wasPressed('c')) ActiveSkills.cast('c', game);
  }

  doAttack(game) {
    const w = WEAPONS[this.currentWeapon];
    if (this.stamina < w.staminaCost) { Utils.toast('體力不足'); AudioMgr.deny(); return; }
    this.stamina -= w.staminaCost;
    this.attackCooldown = w.cooldown;
    this.attackEffectTime = 0.15;
    AudioMgr.swing();

    if (w.type === 'ranged') {
      const sx = this.x + Math.cos(this.facing) * (this.radius + 6);
      const sy = this.y + Math.sin(this.facing) * (this.radius + 6);
      game.projectiles.push(new Projectile(sx, sy, this.facing, w.projectileSpeed, w.damage + this.attack * 0.3, 'player', 'arrow'));
      // 槍口閃光
      game.particles.muzzleFlash(sx, sy, this.facing, '#fff066');
      // 後座輕震
      game.shake(2, 0.08);
      AudioMgr.bowShoot();
    } else {
      const dmg = w.damage + this.attack;
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
  }

  takeDamage(d) {
    if (this.invuln > 0) return;
    const final = Math.max(1, d - this.defense);
    this.hp -= final;
    this.invuln = 0.4;
    AudioMgr.playerHurt();
    if (window.GAME) {
      GAME.particles.blood(this.x, this.y, 6);
      GAME.particles.damageText(this.x, this.y - 16, final, '#ff5050', true);
      GAME.shake(3, 0.15);
      GAME.combo = 0;
    }
    if (this.hp <= 0) this.hp = 0;
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

  draw(ctx, camera) {
    const s = Utils.worldToScreen(this.x, this.y, camera);

    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + this.radius * 0.8, this.radius * 0.9, this.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 衝刺光暈
    if (this.dashTime > 0) {
      Utils.drawGlowCircle(ctx, s.x, s.y, 28, '#88ccff', 0.6);
    }
    // 中毒光暈
    if (this.poisonTimer > 0) {
      Utils.drawGlowCircle(ctx, s.x, s.y, 22, '#a050ff', 0.4);
    }

    // 走路上下擺動
    const bob = Math.sin(this.walkPhase) * 1.2;

    // 身體（藍色圓 + 高光）
    const blink = this.invuln > 0 && Math.floor(this.invuln * 25) % 2 === 0;
    ctx.fillStyle = blink ? '#fff' : '#3aa3ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y + bob, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#16345f';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(s.x - 4, s.y - 5 + bob, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 朝向 + 武器
    const wcfg = WEAPONS[this.currentWeapon];
    ctx.strokeStyle = wcfg.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + bob);
    ctx.lineTo(s.x + Math.cos(this.facing) * (this.radius + 10),
               s.y + Math.sin(this.facing) * (this.radius + 10) + bob);
    ctx.stroke();

    // 武器尖端
    const tx = s.x + Math.cos(this.facing) * (this.radius + 14);
    const ty = s.y + Math.sin(this.facing) * (this.radius + 14) + bob;
    ctx.fillStyle = wcfg.color;
    ctx.beginPath();
    ctx.arc(tx, ty, 3, 0, Math.PI * 2);
    ctx.fill();

    // 近戰扇形特效
    if (this.attackEffectTime > 0 && wcfg.type === 'melee') {
      const t = this.attackEffectTime / 0.15;
      ctx.strokeStyle = `rgba(255,255,255,${t})`;
      ctx.lineWidth = 6 * t;
      ctx.beginPath();
      ctx.arc(s.x, s.y + bob, wcfg.range,
              this.facing - wcfg.arc / 2, this.facing + wcfg.arc / 2);
      ctx.stroke();
      // 內層
      ctx.strokeStyle = wcfg.color;
      ctx.lineWidth = 3 * t;
      ctx.stroke();
    }

    // 頭頂血/魔/體力
    const bx = s.x - 22, by = s.y - this.radius - 14;
    Utils.drawHpBar(ctx, bx, by, 44, 4, this.hp / this.maxHp, '#5dd55d', '#5b1d1d');
    Utils.drawHpBar(ctx, bx, by + 5, 44, 3, this.mp / this.maxMp, '#6aa6ff', '#1a2a5a');
    Utils.drawHpBar(ctx, bx, by + 9, 44, 2, this.stamina / this.maxStamina, '#4ac8ff', '#1a3a5a');
  }
}
