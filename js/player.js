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
    // 黑靈狂戰士
    this.darkSoulActive = false; this.darkSoulEnd = 0;
    this.frenzyActive = false; this.frenzyEnd = 0;
    // 弓手 冰巨箭
    this.iceArrowActive = false; this.iceArrowEnd = 0;
    // 弓手 爆裂連矢
    this.boomShotActive = false; this.boomShotEnd = 0; this.boomShotRadius = 130;
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
    if (this.darkSoulEnd && now > this.darkSoulEnd) { this.darkSoulActive = false; this.darkSoulEnd = 0; }
    if (this.frenzyEnd && now > this.frenzyEnd) { this.frenzyActive = false; this.frenzyEnd = 0; }
    if (this.iceArrowEnd && now > this.iceArrowEnd) { this.iceArrowActive = false; this.iceArrowEnd = 0; }
    if (this.boomShotEnd && now > this.boomShotEnd) { this.boomShotActive = false; this.boomShotEnd = 0; }

    // 爆裂連矢:周身橘紅火焰
    if (this.boomShotActive && Math.random() < dt * 16) {
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 12;
      game.particles.add({
        x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r,
        vx: Utils.jitter(20), vy: -Utils.randomRange(30, 70),
        life: 0.6, max: 0.6, color: Utils.pick(['#ff5020', '#ff8030', '#ffd86b']),
        size: Utils.randomRange(3, 6), type: 'fire', grow: -5
      });
    }

    // 冰巨箭：周身冰晶霧
    if (this.iceArrowActive && Math.random() < dt * 18) {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 10;
      game.particles.add({
        x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r,
        vx: -Math.sin(a) * 30, vy: Math.cos(a) * 30 - 20,
        life: 0.7, max: 0.7, color: Utils.pick(['#aaccff', '#fff', '#88aaff']),
        size: Utils.randomRange(3, 5), type: 'fire', grow: -3
      });
    }
    if (this.iceArrowActive && Math.random() < dt * 6) {
      game.particles.add({
        x: this.x + Utils.jitter(18), y: this.y + Utils.jitter(18),
        vx: Utils.jitter(20), vy: Utils.jitter(20),
        life: 0.5, max: 0.5, color: '#fff', size: 3,
        type: 'iceShard', angle: Math.random() * Math.PI * 2
      });
    }

    // 黑魂附體：圍繞玩家的黑紫邪氣
    if (this.darkSoulActive && Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2;
      const r = 24;
      game.particles.add({
        x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r,
        vx: -Math.sin(a) * 30, vy: Math.cos(a) * 30 - 20,
        life: 0.6, max: 0.6, color: Utils.pick(['#3a0a3a', '#5a0a5a', '#0a000a']),
        size: Utils.randomRange(3, 5), type: 'fire', grow: -3
      });
    }
    // 狂熱：血紅霧氣
    if (this.frenzyActive && Math.random() < dt * 18) {
      game.particles.add({
        x: this.x + Utils.jitter(20), y: this.y + Utils.jitter(15),
        vx: Utils.jitter(15), vy: -Utils.randomRange(25, 60),
        life: 0.5, max: 0.5, color: Utils.pick(['#cc3030', '#ff3030', '#aa0000']),
        size: Utils.randomRange(3, 5), type: 'fire', grow: -3
      });
    }
    // 狂熱移動殘影（在 moving 變數計算後仍可呼叫）
    if (this.frenzyActive) {
      this.lastTrail -= dt;
      if (this.lastTrail <= 0) {
        this.lastTrail = 0.06;
        game.particles.dashTrail(this.x, this.y, 'rgba(204,48,48,0.35)');
      }
    }

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
    const mpRegen = (this.classMods.mpRegen || 4) + (game.mut?.mpRegenBonus || 0);
    this.mp += dt * mpRegen;
    if (this.mp > this.maxMp) this.mp = this.maxMp;
    // HP 被動回復(來自卡牌)
    if (game.mut?.hpRegenBonus) {
      this.hp += dt * game.mut.hpRegenBonus;
      if (this.hp > this.maxHp) this.hp = this.maxHp;
    }

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

    let sp = this.speed * (this.speedBuffMult || 1) * (this.frenzyActive ? 1.3 : 1);
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
    const atkSpeedMult = (this.classMods.attackSpeedMult || 1) * (game.mut?.attackSpeedMult || 1) * (this.frenzyActive ? 0.5 : 1);
    this.attackCooldown = w.cooldown * atkSpeedMult;
    this.attackEffectTime = 0.15;
    this.swingProgress = 1;
    AudioMgr.swing();
    game.stats.recordWeapon(this.currentWeapon);

    const buff = 1 + (this.attackBuff || 0);
    const invisBoost = (this.invisTimer > 0 && game.mut?.invisBoost) ? 1.8 : 1;
    if (w.type === 'ranged') {
      const sx = this.x + Math.cos(this.facing) * (this.radius + 10);
      const sy = this.y + Math.sin(this.facing) * (this.radius + 10);
      const rngMult = (this.classMods.rangedMult || 1);
      const dmg = (w.damage + this.attack * 0.3) * rngMult * buff * invisBoost;
      // 爆裂連矢:此次發射的所有箭都標記爆炸半徑
      const boomR = this.boomShotActive ? this.boomShotRadius : 0;

      // ===== 法師杖（隕石/焚天/創世）：可怕魔粒子 =====
      if (w.projectileKind && w.projectileKind.startsWith('eldritch')) {
        const p = new Projectile(sx, sy, this.facing, w.projectileSpeed, dmg * 1.4, 'player', w.projectileKind);
        p.pierce = w.projectileKind === 'eldritchVoid' ? 2 : 0;
        game.projectiles.push(p);
        // 杖端閃光（依武器顏色）
        const flashColor = w.projectileKind === 'eldritchVoid' ? '#aa00ff'
                        : w.projectileKind === 'eldritchFire' ? '#ff5030'
                        : '#cc00ff';
        game.particles.muzzleFlash(sx, sy, this.facing, flashColor);
        // 額外觸鬚噴射
        for (let i = 0; i < 6; i++) {
          const a = this.facing + Utils.jitter(0.7);
          const sp2 = Utils.randomRange(100, 200);
          game.particles.add({
            x: sx, y: sy,
            vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2,
            life: 0.5, max: 0.5, color: flashColor,
            size: Utils.randomRange(3, 5), type: 'fire', grow: -6
          });
        }
        game.shake(w.projectileKind === 'eldritchVoid' ? 5 : 3, 0.15);
        AudioMgr.fireball();
        return;
      }
      // ===== 弓手 stormBow：3 連射 =====
      if (w.multiShot) {
        for (let i = 0; i < w.multiShot; i++) {
          const off = (i - (w.multiShot - 1) / 2) * 0.18;
          const ang = this.facing + off;
          const sx2 = this.x + Math.cos(ang) * (this.radius + 10);
          const sy2 = this.y + Math.sin(ang) * (this.radius + 10);
          const p = new Projectile(sx2, sy2, ang, w.projectileSpeed, dmg * 1.2, 'player', 'giantarrow');
          p.radius = 11;
          p.pierce = 1;
          if (w.alwaysIce || this.iceArrowActive) {
            p.iceArrow = true; p.radius = 24; p.pierce = 99; p.freezeOnHit = 2.0;
          }
          if (boomR) p.boomOnHit = boomR;
          game.projectiles.push(p);
          game.particles.muzzleFlash(sx2, sy2, ang, '#88ccff');
        }
        game.shake(5, 0.18);
        AudioMgr.bowShoot();
        return;
      }
      // ===== 弓手 frostBow：自動冰巨箭 =====
      if (w.alwaysIce) {
        const p = new Projectile(sx, sy, this.facing, w.projectileSpeed * 0.85, dmg * 1.8, 'player', 'giantarrow');
        p.iceArrow = true;
        p.radius = 28;
        p.pierce = 99;
        p.freezeOnHit = 2.5;
        if (boomR) p.boomOnHit = boomR;
        game.projectiles.push(p);
        game.particles.muzzleFlash(sx, sy, this.facing, '#aaccff');
        game.particles.add({ x: sx, y: sy, vx:0, vy:0, life:0.3, max:0.3, color:'#fff', size:60, type:'flash' });
        game.shake(7, 0.22);
        AudioMgr.bowShoot();
        AudioMgr.shockwave();
        return;
      }

      if (this.currentWeapon === 'giantbow') {
        // ===== 巨弓射箭 =====
        if (this.iceArrowActive) {
          // 冰巨箭：5 倍大、貫穿、命中凍結 2.5 秒
          const p = new Projectile(sx, sy, this.facing, w.projectileSpeed * 0.82, dmg * 2.4, 'player', 'giantarrow');
          p.iceArrow = true;
          p.radius = 28;
          p.pierce = 99;
          p.freezeOnHit = 2.5;
          if (boomR) p.boomOnHit = boomR;
          game.projectiles.push(p);
          // 出口超強冰爆
          game.particles.muzzleFlash(sx, sy, this.facing, '#aaccff');
          game.particles.add({
            x: sx, y: sy, vx: 0, vy: 0,
            life: 0.4, max: 0.4, color: '#fff', size: 90, type: 'flash'
          });
          // 冰晶四射
          for (let i = 0; i < 14; i++) {
            const a = this.facing + Utils.jitter(0.8);
            const sp = Utils.randomRange(140, 280);
            game.particles.add({
              x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              life: 0.55, max: 0.55, color: '#aaccff',
              size: Utils.randomRange(4, 8), type: 'iceShard', angle: a
            });
          }
          // 前方擴張震波
          game.particles.add({
            x: sx + Math.cos(this.facing) * 30,
            y: sy + Math.sin(this.facing) * 30,
            vx: 0, vy: 0,
            life: 0.5, max: 0.5, color: '#aaccff',
            size: 30, type: 'ring', targetRadius: 130
          });
          game.shake(9, 0.3);
          AudioMgr.bowShoot();
          AudioMgr.shockwave();
        } else {
          // 普通巨箭：1.8 倍大、金色
          const p = new Projectile(sx, sy, this.facing, w.projectileSpeed, dmg * 1.3, 'player', 'giantarrow');
          p.radius = 11;
          p.pierce = 1;
          if (boomR) p.boomOnHit = boomR;
          game.projectiles.push(p);
          game.particles.muzzleFlash(sx, sy, this.facing, '#ffd86b');
          game.particles.spark(sx, sy, 12, '#fff066');
          game.shake(4, 0.13);
          AudioMgr.bowShoot();
        }
      } else {
        // 一般弓箭(其他職業)
        const aspd = game.mut?.arrowSpeed || 1;
        const p = new Projectile(sx, sy, this.facing, w.projectileSpeed * aspd, dmg, 'player', 'arrow');
        if (boomR) p.boomOnHit = boomR;
        game.projectiles.push(p);
        game.particles.muzzleFlash(sx, sy, this.facing, '#fff066');
        game.shake(2, 0.08);
        AudioMgr.bowShoot();
      }
      // 雙生連射:doubleShot 機率多射 1 箭
      if (game.mut?.doubleShot && Math.random() < game.mut.doubleShot) {
        game.schedule(0.05, () => {
          const ang2 = this.facing + Utils.jitter(0.1);
          const sx3 = this.x + Math.cos(ang2) * (this.radius + 10);
          const sy3 = this.y + Math.sin(ang2) * (this.radius + 10);
          const aspd = game.mut?.arrowSpeed || 1;
          const kind = (this.currentWeapon === 'giantbow' || w.multiShot || w.alwaysIce) ? 'giantarrow' : 'arrow';
          const p2 = new Projectile(sx3, sy3, ang2, w.projectileSpeed * aspd, dmg * 0.8, 'player', kind);
          p2.radius = kind === 'giantarrow' ? 10 : 4;
          if (boomR) p2.boomOnHit = boomR;
          if (this.iceArrowActive) { p2.iceArrow = true; p2.radius = 24; p2.freezeOnHit = 2.0; }
          game.projectiles.push(p2);
          game.particles.muzzleFlash(sx3, sy3, ang2, '#fff066');
        });
      }
    } else {
      const melee = (this.classMods.meleeMult || 1);
      const dmg = (w.damage + this.attack) * melee * buff * invisBoost;

      // ===== 巨砍刀衝擊波(揮砍自帶效果)=====
      if (w.shockwave) {
        // 三層巨大劍光(疊出深紅 + 黑 + 白邊)
        game.particles.slashArc(this.x, this.y, this.facing, w.range + 24, '#fff');
        game.particles.slashArc(this.x, this.y, this.facing, w.range + 14, '#cc3030');
        game.particles.slashArc(this.x, this.y, this.facing, w.range, '#1a0a1a');
        // 中央血色爆閃 + 前方雙環
        game.particles.add({
          x: this.x + Math.cos(this.facing) * 20,
          y: this.y + Math.sin(this.facing) * 20,
          vx: 0, vy: 0,
          life: 0.32, max: 0.32, color: 'rgba(255,40,40,0.55)',
          size: 130, type: 'flash'
        });
        game.particles.add({
          x: this.x + Math.cos(this.facing) * 35,
          y: this.y + Math.sin(this.facing) * 35,
          vx: 0, vy: 0,
          life: 0.5, max: 0.5, color: '#cc3030',
          size: 20, type: 'ring', targetRadius: 140
        });
        game.particles.add({
          x: this.x + Math.cos(this.facing) * 35,
          y: this.y + Math.sin(this.facing) * 35,
          vx: 0, vy: 0,
          life: 0.4, max: 0.4, color: '#fff',
          size: 20, type: 'ring', targetRadius: 90
        });
        // 血色火花環(前方扇形)
        for (let i = 0; i < 14; i++) {
          const a = this.facing + Utils.jitter(0.45);
          const sp = Utils.randomRange(160, 360);
          game.particles.add({
            x: this.x, y: this.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 0.5, max: 0.5,
            color: Utils.pick(['#cc3030', '#ff5050', '#5a0a0a', '#fff']),
            size: Utils.randomRange(3, 6), type: 'fire', grow: -5
          });
        }
        // 血滴向前濺射
        for (let i = 0; i < 10; i++) {
          const a = this.facing + Utils.jitter(0.4);
          const sp = Utils.randomRange(120, 280);
          game.particles.add({
            x: this.x, y: this.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
            life: 0.7, max: 0.7,
            color: Utils.pick(['#cc3030', '#5a0a0a', '#aa0000']),
            size: Utils.randomRange(3, 5), type: 'blood', gravity: 200
          });
        }
        game.shake(9, 0.28);   // 從 4 提升到 9
        AudioMgr.shockwave();
        AudioMgr.swing();
      }

      // ===== doomCleaver：每次揮砍噴月牙（被動）=====
      if (w.passiveMoon) {
        const sx2 = this.x + Math.cos(this.facing) * (this.radius + 25);
        const sy2 = this.y + Math.sin(this.facing) * (this.radius + 25);
        const crescentDmg = (50 + this.attack * 1.2) * (game.mut?.skillDmgMult || 1);
        const cres = new Projectile(sx2, sy2, this.facing, 360, crescentDmg, 'player', 'darkmoon');
        cres.pierce = 99;
        game.projectiles.push(cres);
        game.particles.add({
          x: sx2, y: sy2, vx: 0, vy: 0,
          life: 0.3, max: 0.3, color: '#5a0a5a', size: 50, type: 'flash'
        });
        AudioMgr.fireball();
      }

      // ===== 黑魂附體：釋放巨大月牙 =====
      if (this.darkSoulActive) {
        const count = (game.mut?.darkmoonDouble) ? 2 : 1;
        const crescentDmg = (40 + this.attack * 1.0) * (game.mut?.skillDmgMult || 1) * (game.mut?.darkmoonDmg || 1);
        for (let i = 0; i < count; i++) {
          const angOff = count > 1 ? (i === 0 ? -0.2 : 0.2) : 0;
          const ang = this.facing + angOff;
          const sx = this.x + Math.cos(ang) * (this.radius + 25);
          const sy = this.y + Math.sin(ang) * (this.radius + 25);
          const cres = new Projectile(sx, sy, ang, 340, crescentDmg, 'player', 'darkmoon');
          cres.pierce = 99;
          game.projectiles.push(cres);
        }
        // 出口暗紫閃光
        game.particles.add({
          x: this.x + Math.cos(this.facing) * 28,
          y: this.y + Math.sin(this.facing) * 28,
          vx: 0, vy: 0,
          life: 0.3, max: 0.3, color: '#5a0a5a', size: 50, type: 'flash'
        });
        AudioMgr.fireball();
      }

      let hitAny = false;
      // 狂戰士普攻吸血:每命中一隻回 4 HP(bloodCleaver 額外 +6)
      const berserkerLifesteal = this.classId === 'berserker' ? 4 : 0;
      let totalHits = 0;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const d = Utils.distance(this.x, this.y, e.x, e.y);
        if (d > w.range + e.radius) continue;
        const ang = Utils.angle(this.x, this.y, e.x, e.y);
        if (Math.abs(Utils.angleDiff(ang, this.facing)) < w.arc / 2) {
          e.takeDamage(dmg, game);
          e.applyKnockback(this.x, this.y, 220);
          game.particles.spark(e.x, e.y, 8, this.classId === 'berserker' ? '#ff3030' : '#ffd86b');
          // 狂戰士命中爆閃 + 血濺
          if (this.classId === 'berserker') {
            game.particles.add({
              x: e.x, y: e.y, vx: 0, vy: 0,
              life: 0.18, max: 0.18, color: '#fff', size: 30, type: 'flash'
            });
            game.particles.blood(e.x, e.y, 6);
          }
          game.particles.damageText(e.x, e.y - 10, dmg, '#fff');
          AudioMgr.hit();
          hitAny = true;
          totalHits++;
          // bloodCleaver: 擊中回血
          if (w.healOnHit) {
            this.hp = Math.min(this.maxHp, this.hp + w.healOnHit);
            game.particles.add({
              x: this.x, y: this.y - 10, vx: 0, vy: -40,
              life: 0.5, max: 0.5, color: '#ff5050', size: 4, type: 'fire', grow: -3
            });
          }
          // 狂戰士普攻吸血
          if (berserkerLifesteal) {
            this.hp = Math.min(this.maxHp, this.hp + berserkerLifesteal);
          }
        }
      }
      for (const __boss of game.bosses) {
        if (!__boss || !__boss.alive) continue;
        const d = Utils.distance(this.x, this.y, __boss.x, __boss.y);
        if (d > w.range + __boss.radius) continue;
        const ang = Utils.angle(this.x, this.y, __boss.x, __boss.y);
        if (Math.abs(Utils.angleDiff(ang, this.facing)) < w.arc / 2) {
          __boss.takeDamage(dmg, game);
          game.particles.damageText(__boss.x, __boss.y - 10, dmg, '#fff', true);
          if (this.classId === 'berserker') {
            game.particles.add({
              x: __boss.x, y: __boss.y, vx: 0, vy: 0,
              life: 0.2, max: 0.2, color: '#fff', size: 40, type: 'flash'
            });
            this.hp = Math.min(this.maxHp, this.hp + berserkerLifesteal * 2);
          }
          AudioMgr.hit();
          hitAny = true;
          totalHits++;
        }
      }
      // 吸血回血浮字
      if (berserkerLifesteal && totalHits > 0) {
        game.particles.damageText(this.x, this.y - 28, '+' + (totalHits * berserkerLifesteal), '#ff5050');
      }
      // 狂戰士命中震屏(原本只有 2)
      if (hitAny) {
        if (this.classId === 'berserker') game.shake(7 + Math.min(6, totalHits), 0.22);
        else game.shake(2, 0.08);
      }
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
      // 每 2 級才 +1 技能點(之前太多)
      if (this.level % 2 === 0) this.skillPoints++;
      this.maxHp += 5;
      this.hp = this.maxHp;
      this.mp = this.maxMp;
      this.expNeed = Math.round(this.expNeed * 1.5 + 5);
      Utils.bigToast(`LV UP　${this.level}`);
      AudioMgr.levelup();
      game.particles.levelup(this.x, this.y);
      // 等級到達自動解鎖傳說武器
      this.checkAutoUnlock(game);
    }
  }

  // 根據目前等級自動解鎖傳說武器(可重複呼叫,只解鎖一次)
  checkAutoUnlock(game) {
    const tiers = LEGENDARY_WEAPONS[this.classId] || [];
    for (const w of tiers) {
      if (!w.unlockLv) continue;
      if (this.level < w.unlockLv) continue;
      if (this.unlockedWeapons.includes(w.id)) continue;
      this.unlockedWeapons.push(w.id);
      // 自動裝備新武器
      this.currentWeapon = w.id;
      if (game) {
        Utils.bigToast(`解鎖傳說武器:${w.name}!`);
        AudioMgr.victory();
        AudioMgr.bossSpawn();
        // 全屏金色爆閃 + 多層震波
        game.particles.add({
          x: this.x, y: this.y, vx: 0, vy: 0,
          life: 0.8, max: 0.8,
          color: 'rgba(255,216,107,0.75)', size: 500, type: 'flash'
        });
        game.particles.add({
          x: this.x, y: this.y, vx: 0, vy: 0,
          life: 0.7, max: 0.7,
          color: '#fff', size: 300, type: 'flash'
        });
        for (let i = 0; i < 5; i++) {
          game.schedule(i * 0.08, () => {
            game.particles.shockRing(this.x, this.y, 200 + i * 80, i % 2 === 0 ? '#ffd86b' : '#ff8030');
          });
        }
        // 螺旋粒子
        for (let i = 0; i < 60; i++) {
          const t = i / 60;
          const a = t * Math.PI * 8;
          const r = 30 + t * 200;
          game.particles.add({
            x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r,
            vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 30,
            life: 1.5, max: 1.5,
            color: Utils.pick(['#ffd86b', '#ff8030', '#fff']),
            size: Utils.randomRange(4, 8), type: 'fire', grow: -3
          });
        }
        // 上升光柱
        for (let i = 0; i < 20; i++) {
          game.particles.add({
            x: this.x + Utils.jitter(50), y: this.y + Utils.jitter(20),
            vx: Utils.jitter(20), vy: -Utils.randomRange(140, 300),
            life: 1.8, max: 1.8, color: Utils.pick(['#ffd86b', '#fff']),
            size: Utils.randomRange(8, 14), type: 'smoke', grow: 6
          });
        }
        game.shake(20, 0.7);
        // UI 刷新
        if (typeof UI !== 'undefined' && UI.refreshWeaponSlots) {
          UI.refreshWeaponSlots(this.classId);
        }
      }
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
    // 黑魂附體：暗紫巨大光環
    if (this.darkSoulActive) {
      const pulse = (Math.sin(performance.now() / 120) + 1) * 0.5;
      Utils.drawGlowCircle(ctx, s.x, s.y, 50 + pulse * 16, '#5a0a5a', 0.75);
      Utils.drawGlowCircle(ctx, s.x, s.y, 30 + pulse * 8, '#cc3030', 0.5);
      ctx.strokeStyle = `rgba(204,48,48,${0.5 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 36 + pulse * 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 狂熱：血紅光環
    if (this.frenzyActive) {
      const pulse = (Math.sin(performance.now() / 80) + 1) * 0.5;
      Utils.drawGlowCircle(ctx, s.x, s.y, 42 + pulse * 14, '#cc3030', 0.7);
      Utils.drawGlowCircle(ctx, s.x, s.y, 26 + pulse * 6, '#ff3030', 0.5);
    }
    // 冰巨箭：冷光環
    if (this.iceArrowActive) {
      const pulse = (Math.sin(performance.now() / 180) + 1) * 0.5;
      Utils.drawGlowCircle(ctx, s.x, s.y, 50 + pulse * 14, '#aaccff', 0.7);
      Utils.drawGlowCircle(ctx, s.x, s.y, 30 + pulse * 8, '#fff', 0.5);
      ctx.strokeStyle = `rgba(170,204,255,${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 36 + pulse * 10, 0, Math.PI * 2);
      ctx.stroke();
    }
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
    } else if (this.currentWeapon === 'giantbow') {
      // ===== 巨弓（玩家 2x 高、深木紋）=====
      const ice = this.iceArrowActive;
      const bowH = 28;
      // 弓身外層暗色
      ctx.strokeStyle = ice ? '#5a88cc' : '#5a3a10';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(this.radius + 12, 0, bowH, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      // 弓身內層亮色
      ctx.strokeStyle = ice ? '#aaccff' : '#cf9b3a';
      ctx.lineWidth = 3;
      if (ice) { ctx.shadowColor = '#aaccff'; ctx.shadowBlur = 12; }
      ctx.beginPath();
      ctx.arc(this.radius + 12, 0, bowH, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 弓尖（雙端）
      ctx.fillStyle = ice ? '#fff' : '#3a2010';
      ctx.beginPath(); ctx.arc(this.radius + 12, -bowH, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.radius + 12,  bowH, 4, 0, Math.PI * 2); ctx.fill();
      // 弓握把（中央纏布）
      ctx.fillStyle = '#3a2a10';
      ctx.fillRect(this.radius + 8, -5, 8, 10);
      ctx.strokeStyle = '#cf9b3a';
      ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i += 2) {
        ctx.beginPath();
        ctx.moveTo(this.radius + 8, i); ctx.lineTo(this.radius + 16, i);
        ctx.stroke();
      }
      // 弓弦（緊繃直線）
      ctx.strokeStyle = ice ? '#fff' : '#eee';
      ctx.lineWidth = ice ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(this.radius + 12, -bowH); ctx.lineTo(this.radius + 12, bowH);
      ctx.stroke();
      // 冰巨箭附魔時：弓中央漂浮的冰箭預備
      if (ice) {
        ctx.fillStyle = '#aaccff';
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
        ctx.fillRect(this.radius + 14, -2, 18, 4);
        // 箭頭
        ctx.beginPath();
        ctx.moveTo(this.radius + 36, 0);
        ctx.lineTo(this.radius + 30, -4);
        ctx.lineTo(this.radius + 30, 4);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else if (this.currentWeapon === 'meteorStaff' || this.currentWeapon === 'skyburnStaff' || this.currentWeapon === 'genesisStaff') {
      // ===== 法師杖（隕石杖/焚天杖/創世神杖）=====
      const isVoid = this.currentWeapon === 'genesisStaff';
      const isFire = this.currentWeapon === 'skyburnStaff';
      const staffMain = isVoid ? '#1a0030' : isFire ? '#5a2010' : '#3a1f3a';
      const orbOuter = isVoid ? '#5a00aa' : isFire ? '#ff3030' : '#aa00ff';
      const orbCore = isVoid ? '#aa00ff' : isFire ? '#fff' : '#dca6ff';

      // 杖柄（長棍）
      ctx.fillStyle = staffMain;
      ctx.fillRect(this.radius, -3, 30, 6);
      // 杖柄紋
      ctx.fillStyle = orbOuter;
      ctx.fillRect(this.radius + 5, -3, 2, 6);
      ctx.fillRect(this.radius + 15, -3, 2, 6);
      ctx.fillRect(this.radius + 25, -3, 2, 6);

      // 杖頂環
      ctx.strokeStyle = staffMain;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.radius + 36, 0, 10, 0, Math.PI * 2); ctx.stroke();

      // 杖頂魔粒子球
      ctx.shadowColor = orbOuter;
      ctx.shadowBlur = 16;
      ctx.fillStyle = orbOuter;
      ctx.beginPath(); ctx.arc(this.radius + 36, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = orbCore;
      ctx.beginPath(); ctx.arc(this.radius + 36, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // 創世神杖：黑洞中心
      if (isVoid) {
        ctx.fillStyle = '#0a0030';
        ctx.beginPath(); ctx.arc(this.radius + 36, 0, 3, 0, Math.PI * 2); ctx.fill();
      }

      // 杖頂環外圍 3 個小尖刺
      ctx.fillStyle = orbOuter;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + performance.now() / 600;
        const x = this.radius + 36 + Math.cos(a) * 14;
        const y = Math.sin(a) * 14;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (this.currentWeapon === 'cleaver' || this.currentWeapon === 'bloodCleaver' || this.currentWeapon === 'doomCleaver') {
      // ===== 巨砍刀（玩家 3 倍寬，~80px）=====
      const big = this.darkSoulActive || this.currentWeapon === 'doomCleaver';
      const tint = this.currentWeapon === 'bloodCleaver' ? 'blood'
                  : this.currentWeapon === 'doomCleaver' ? 'doom' : 'normal';
      // 柄
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(this.radius - 4, -4, 26, 8);
      ctx.fillStyle = '#1a0a05';
      ctx.fillRect(this.radius - 4, -4, 26, 1);
      ctx.fillRect(this.radius - 4, 3, 26, 1);
      // 護手
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(this.radius + 18, -10, 5, 20);

      // 巨大刀身（80px 長 × 50px 高）
      if (big) {
        ctx.shadowColor = '#cc3030';
        ctx.shadowBlur = 24;
      }
      // 主刀身（黑灰漸層）
      const grad = ctx.createLinearGradient(0, -25, 0, 25);
      grad.addColorStop(0, big ? '#1a0a1a' : '#5a5a5a');
      grad.addColorStop(0.5, big ? '#0a000a' : '#2a2a2a');
      grad.addColorStop(1, big ? '#1a0a1a' : '#5a5a5a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(this.radius + 24, -22);
      ctx.quadraticCurveTo(this.radius + 60, -32, this.radius + 88, -16);
      ctx.lineTo(this.radius + 96, -2);
      ctx.lineTo(this.radius + 90, 14);
      ctx.quadraticCurveTo(this.radius + 60, 26, this.radius + 24, 20);
      ctx.closePath();
      ctx.fill();

      // 刀鋒（亮邊）
      ctx.strokeStyle = big ? '#cc3030' : '#cccccc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.radius + 24, -22);
      ctx.quadraticCurveTo(this.radius + 60, -32, this.radius + 88, -16);
      ctx.lineTo(this.radius + 96, -2);
      ctx.stroke();

      // 中央血槽
      ctx.strokeStyle = big ? '#5a0a0a' : '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.radius + 30, -4);
      ctx.quadraticCurveTo(this.radius + 60, -8, this.radius + 86, -2);
      ctx.stroke();

      // 血漬
      ctx.fillStyle = '#aa0000';
      ctx.beginPath();
      ctx.ellipse(this.radius + 42, -10, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(this.radius + 64, 8, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#660000';
      ctx.beginPath();
      ctx.arc(this.radius + 52, 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.arc(this.radius + 78, -6, 2, 0, Math.PI * 2); ctx.fill();

      // 黑魂附體 額外效果：紅色刀刃發光
      if (big) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ff3030';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.radius + 26, -20);
        ctx.quadraticCurveTo(this.radius + 60, -30, this.radius + 86, -14);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
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
