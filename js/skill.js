/* ================================================================
 * skill.js
 * 被動技能 + 每職業 3 個專屬主動技能
 *   warrior: 狂暴斬擊 / 大地震動 / 血怒之力
 *   mage   : 隕石術   / 冰封新星 / 生命之泉
 *   archer : 箭矢風暴 / 雷霆穿心 / 獵人之擁
 * 卡牌會在 game.mut 上加 flag 來升級技能
 * ================================================================ */
class SkillSystem {
  constructor() {
    this.list = [
      { id: 'atk',   name: '強化攻擊', desc: '+3 攻擊力 / 級',  level: 0, max: 8 },
      { id: 'def',   name: '強化防禦', desc: '+2 防禦力 / 級',  level: 0, max: 8 },
      { id: 'gather',name: '快速採集', desc: '採集傷害 +25% / 級', level: 0, max: 5 },
      { id: 'stam',  name: '體力恢復', desc: '體力回復 +30% / 級', level: 0, max: 5 },
      { id: 'dash',  name: '閃避衝刺', desc: '衝刺距離 +20% / 級', level: 0, max: 5 },
      { id: 'tower', name: '箭塔強化', desc: '箭塔攻擊力 +30% / 級', level: 0, max: 5 },
      { id: 'mp',    name: '魔力護符', desc: '魔力上限 +20 / 級', level: 0, max: 5 },
      { id: 'skill', name: '技能精通', desc: '主動技能傷害 +15% / 級', level: 0, max: 5 },
      { id: 'cd',    name: '冷靜思緒', desc: '主動技能冷卻 -8% / 級', level: 0, max: 4 }
    ];
    this.baseAttack = 10;
    this.baseDefense = 0;
  }
  get(id) { return this.list.find(s => s.id === id); }
  upgrade(id, player) {
    const s = this.get(id);
    if (!s) return false;
    if (s.level >= s.max) { Utils.toast('已滿級'); AudioMgr.deny(); return false; }
    if (player.skillPoints <= 0) { Utils.toast('技能點不足'); AudioMgr.deny(); return false; }
    s.level++;
    player.skillPoints--;
    this.applyAll(player);
    Utils.toast(`${s.name} 升到 ${s.level} 級`);
    AudioMgr.levelup();
    return true;
  }
  applyAll(player) {
    const atk = this.get('atk').level;
    const def = this.get('def').level;
    const mp  = this.get('mp').level;
    player.attack  = player.baseAttack + atk * 3;
    player.defense = player.baseDefense + def * 2;
    player.maxMp = (player.baseMaxMp || 100) + mp * 20 + (player.shopUpgrades?.maxMp || 0) * 20;
    if (player.mp > player.maxMp) player.mp = player.maxMp;
  }
  gatherMultiplier() { return 1 + this.get('gather').level * 0.25; }
  staminaRegenMult() { return 1 + this.get('stam').level * 0.3; }
  dashMult() { return 1 + this.get('dash').level * 0.2; }
  towerMult() { return 1 + this.get('tower').level * 0.3; }
  skillDmgMult() { return 1 + this.get('skill').level * 0.15; }
  cdMult() { return 1 - this.get('cd').level * 0.08; }
}

/* ===== 9 個主動技能（每職業 3 個）===== */
const SKILL_DEFS = {
  // 戰士
  w_slash:  { name: '狂暴斬擊', cost: 25, cd: 5,  desc: '四連旋風斬，前方範圍劍光爆破' },
  w_quake:  { name: '大地震動', cost: 50, cd: 12, desc: '震波擴散 + 八方裂縫，擊飛敵人' },
  w_fury:   { name: '血怒之力', cost: 40, cd: 18, desc: '回 50% HP + 8 秒攻擊力 +30%' },
  // 法師
  m_meteor: { name: '隕石術',   cost: 30, cd: 6,  desc: '五道隕石砸向滑鼠，連環爆炸' },
  m_frost:  { name: '冰封新星', cost: 55, cd: 14, desc: '冰晶四射，凍結 2 秒' },
  m_spring: { name: '生命之泉', cost: 50, cd: 20, desc: '回 60% HP + 治癒陣 3 秒' },
  // 弓手
  a_storm:  { name: '箭矢風暴', cost: 25, cd: 5,  desc: '12 道穿透箭扇形齊射' },
  a_pierce: { name: '雷霆穿心', cost: 50, cd: 10, desc: '雷霆箭直線貫穿全場敵人' },
  a_embrace:{ name: '獵人之擁', cost: 40, cd: 16, desc: '回 40% HP + 3 秒隱身 + 速度 +50%' }
};

const ActiveSkills = {
  // 取得目前職業在 q/r/v 對應的技能 id
  getSkillId(game, key) {
    const cls = CHAR_CLASSES[game.player.classId];
    return cls?.skills?.[key];
  },

  // 統一 cast 入口
  cast(key, game) {
    const id = this.getSkillId(game, key);
    if (!id) return false;
    const sk = SKILL_DEFS[id];
    if (!sk) return false;
    const player = game.player;
    const costMult = (player.classMods?.skillCostMult || 1);
    const cost = Math.round(sk.cost * costMult);
    const cdMult = (player.classMods?.cdMult || 1) * (game.mut?.cdMult || 1) * game.skills.cdMult();
    if (player.skillCd[key] > 0) { Utils.toast('冷卻中'); AudioMgr.deny(); return false; }
    if (player.mp < cost) { Utils.toast('魔力不足'); AudioMgr.deny(); return false; }
    player.mp -= cost;
    player.skillCd[key] = sk.cd * cdMult;
    game.stats?.recordSkill(key);
    this.castMap[id](game);
    return true;
  },

  // 計算技能傷害倍率
  dmgMult(game) {
    return (game.player.classMods?.skillDmgMult || 1) *
           (game.mut?.skillDmgMult || 1) *
           game.skills.skillDmgMult();
  },

  // ============================================================
  // 戰士 Warrior
  // ============================================================
  castMap: {

    // 狂暴斬擊：4 道（可被 mut.slashExtra 增加）連續弧形劍光
    w_slash(game) {
      const player = game.player;
      const slashes = 4 + (game.mut?.slashExtra || 0);
      const baseRange = 100;
      const baseDmg = (30 + player.attack * 1.0) * ActiveSkills.dmgMult(game);
      for (let i = 0; i < slashes; i++) {
        const delay = i * 0.09;
        const dir = i % 2 === 0 ? 1 : -1;
        const ang = player.facing + dir * (0.2 + i * 0.05);
        const range = baseRange + i * 6;
        const color = i % 2 === 0 ? '#ff5050' : '#ffaa33';
        game.schedule(delay, () => {
          game.particles.slashArc(player.x, player.y, ang, range, color);
          game.particles.spark(player.x, player.y, 14, '#ffaa33');
          // 烈焰劍氣：附加燃燒
          const fire = !!game.mut?.slashFire;
          for (const e of game.enemies) {
            if (!e.alive) continue;
            const d = Utils.distance(player.x, player.y, e.x, e.y);
            if (d > range + e.radius) continue;
            const a = Utils.angle(player.x, player.y, e.x, e.y);
            if (Math.abs(Utils.angleDiff(a, ang)) < 0.5) {
              e.takeDamage(baseDmg, game);
              e.applyKnockback(player.x, player.y, 220);
              if (fire) e.burnTimer = 3, e.burnDps = 12;
              game.particles.damageText(e.x, e.y - 12, baseDmg, '#ff8033');
            }
          }
          if (game.boss && game.boss.alive) {
            const d = Utils.distance(player.x, player.y, game.boss.x, game.boss.y);
            if (d < range + game.boss.radius) {
              const a = Utils.angle(player.x, player.y, game.boss.x, game.boss.y);
              if (Math.abs(Utils.angleDiff(a, ang)) < 0.5) {
                game.boss.takeDamage(baseDmg, game);
                game.particles.damageText(game.boss.x, game.boss.y - 12, baseDmg, '#ff8033', true);
              }
            }
          }
          AudioMgr.swing();
          game.shake(3, 0.08);
        });
      }
      Utils.toast('狂暴斬擊！');
    },

    // 大地震動：以自身為中心 8 方向裂縫 + AOE 擊退
    w_quake(game) {
      const player = game.player;
      const baseRadius = 220 * (1 + (game.mut?.earthSize || 0));
      const baseDmg = (60 + player.attack * 1.2) * ActiveSkills.dmgMult(game);
      // 視覺：3 層震波環 + 8 道裂縫
      game.particles.shockRing(player.x, player.y, baseRadius, '#aa6020');
      game.particles.shockRing(player.x, player.y, baseRadius * 0.7, '#cf9b3a');
      game.particles.shockRing(player.x, player.y, baseRadius * 1.15, '#5a3010');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.random() * 0.2;
        game.particles.groundCrack(player.x, player.y, a, baseRadius);
      }
      // 石塊噴飛
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = Utils.randomRange(140, 320);
        game.particles.add({
          x: player.x, y: player.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
          life: 0.7, max: 0.7, color: '#5a4220',
          size: Utils.randomRange(3, 6), type: 'chip', gravity: 320
        });
      }
      // 塵土
      game.particles.smoke(player.x, player.y, 22, 'rgba(150,100,60,0.55)');
      // 傷害 + 擊退
      for (const e of game.enemies) {
        if (!e.alive) continue;
        if (Utils.distance(player.x, player.y, e.x, e.y) < baseRadius + e.radius) {
          e.takeDamage(baseDmg, game);
          e.applyKnockback(player.x, player.y, 500);
          if (game.mut?.earthCrack) e.burnTimer = 4, e.burnDps = 8;
        }
      }
      if (game.boss && game.boss.alive) {
        const d = Utils.distance(player.x, player.y, game.boss.x, game.boss.y);
        if (d < baseRadius + game.boss.radius) {
          game.boss.takeDamage(baseDmg * 1.2, game);
          game.particles.damageText(game.boss.x, game.boss.y - 12, baseDmg * 1.2, '#aa6020', true);
        }
      }
      AudioMgr.explosion();
      AudioMgr.shockwave();
      game.shake(14, 0.5);
    },

    // 血怒之力：回血 + 攻擊力暫時提升
    w_fury(game) {
      const player = game.player;
      const amt = Math.floor(player.maxHp * 0.5);
      player.hp = Math.min(player.maxHp, player.hp + amt);
      // 攻擊 buff
      const dmgBoost = 0.3 + (game.mut?.furyBoost ? 0.2 : 0);
      const dur = 8 + (game.mut?.furyDur || 0);
      player.attackBuff = (player.attackBuff || 0);
      player.attackBuffEnd = (player.attackBuffEnd || 0);
      player.attackBuff = dmgBoost;
      player.attackBuffEnd = performance.now() / 1000 + dur;
      player.furyAura = dur;
      // 視覺
      game.particles.shockRing(player.x, player.y, 100, '#ff3030');
      game.particles.shockRing(player.x, player.y, 60, '#ff8030');
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        game.particles.add({
          x: player.x + Math.cos(a) * 30,
          y: player.y + Math.sin(a) * 30,
          vx: -Math.sin(a) * 60, vy: Math.cos(a) * 60 - 40,
          life: 1.0, max: 1.0, color: Utils.pick(['#ff3030', '#ff8030', '#ff5050']),
          size: 4, type: 'fire', grow: -4
        });
      }
      game.particles.damageText(player.x, player.y - 24, '+' + amt, '#ff7070', true);
      Utils.bigToast('血怒之力！');
      AudioMgr.heal();
    },

    // ============================================================
    // 法師 Mage
    // ============================================================

    // 隕石術：5 道（+mut）隕石從天而降
    m_meteor(game) {
      const player = game.player;
      const count = 5 + (game.mut?.meteorExtra || 0);
      const cx = Input.mouse.worldX;
      const cy = Input.mouse.worldY;
      const baseDmg = (50 + player.attack * 1.2) * ActiveSkills.dmgMult(game);
      for (let i = 0; i < count; i++) {
        const delay = Utils.randomRange(0.05, 0.55);
        const ang = (i / count) * Math.PI * 2 + Math.random();
        const r = Utils.randomRange(0, 110);
        const tx = cx + Math.cos(ang) * r;
        const ty = cy + Math.sin(ang) * r;
        const sx = tx - 220 + Utils.jitter(40);
        const sy = ty - 480;
        // 目標標記
        game.schedule(delay - 0.02, () => {
          game.particles.add({
            x: tx, y: ty, vx: 0, vy: 0,
            life: 0.3, max: 0.3, color: 'rgba(255,80,40,0.5)',
            size: 70, type: 'flash'
          });
        });
        game.schedule(delay, () => {
          // 流星拖尾線
          game.particles.add({
            x: 0, y: 0, vx: 0, vy: 0,
            life: 0.25, max: 0.25, color: '#ff6020', size: 6,
            type: 'bolt', points: [{ x: sx, y: sy }, { x: tx, y: ty }]
          });
          // 移動中的火球（往目標前進的多顆 fire 粒子）
          for (let j = 0; j < 8; j++) {
            const t = j / 8;
            const px = Utils.lerp(sx, tx, t);
            const py = Utils.lerp(sy, ty, t);
            game.particles.add({
              x: px, y: py, vx: 0, vy: 0,
              life: 0.4 - t * 0.1, max: 0.4,
              color: Utils.pick(['#ff5020', '#ff8030', '#ffd86b']),
              size: 8 - t * 4, type: 'fire', grow: -8
            });
          }
        });
        game.schedule(delay + 0.25, () => {
          // 撞擊
          game.particles.explosion(tx, ty, 80);
          game.shake(4, 0.18);
          AudioMgr.explosion();
          for (const e of game.enemies) {
            if (!e.alive) continue;
            if (Utils.distance(tx, ty, e.x, e.y) < 90 + e.radius) {
              e.takeDamage(baseDmg, game);
              game.particles.damageText(e.x, e.y - 12, baseDmg, '#ffaa33');
            }
          }
          if (game.boss && game.boss.alive) {
            if (Utils.distance(tx, ty, game.boss.x, game.boss.y) < 90 + game.boss.radius) {
              game.boss.takeDamage(baseDmg * 0.8, game);
            }
          }
          // 冰霜烙印：留下冰霜地面
          if (game.mut?.meteorIce) {
            game.iceZones = game.iceZones || [];
            game.iceZones.push({ x: tx, y: ty, radius: 70, life: 4 });
          }
        });
      }
      Utils.toast('隕石術！');
      AudioMgr.fireball();
    },

    // 冰封新星：以自身為中心冰晶四射 + 凍結
    m_frost(game) {
      const player = game.player;
      const radius = 290;
      const baseDmg = (80 + player.attack * 1.0) * ActiveSkills.dmgMult(game);
      const freezeDur = 2 + (game.mut?.freezeExtra || 0);
      // 4 層震波
      game.particles.shockRing(player.x, player.y, radius, '#aaccff');
      game.particles.shockRing(player.x, player.y, radius * 0.55, '#fff');
      game.particles.shockRing(player.x, player.y, radius * 0.85, '#88aaff');
      game.particles.frostNova(player.x, player.y, radius);
      // 中央閃光
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.4, max: 0.4, color: '#fff', size: 80, type: 'flash'
      });
      // 傷害 + 凍結
      for (const e of game.enemies) {
        if (!e.alive) continue;
        if (Utils.distance(player.x, player.y, e.x, e.y) < radius + e.radius) {
          e.takeDamage(baseDmg, game);
          e.frozenTimer = freezeDur;
          e.slowTimer = freezeDur + 1;
          game.particles.damageText(e.x, e.y - 12, baseDmg, '#aaccff');
        }
      }
      if (game.boss && game.boss.alive) {
        const d = Utils.distance(player.x, player.y, game.boss.x, game.boss.y);
        if (d < radius + game.boss.radius) {
          game.boss.takeDamage(baseDmg, game);
          // Boss 不能被完全凍結，但減速
          game.boss.slowTimer = freezeDur * 0.5;
        }
      }
      AudioMgr.shockwave();
      AudioMgr.lightning();
      game.shake(10, 0.4);
      Utils.bigToast('冰封新星！');
    },

    // 生命之泉：回血 + 治癒陣
    m_spring(game) {
      const player = game.player;
      const amt = Math.floor(player.maxHp * 0.6);
      player.hp = Math.min(player.maxHp, player.hp + amt);
      player.mp = Math.min(player.maxMp, player.mp + 50);
      // 治癒區域
      const radius = 80 + (game.mut?.springRadius || 0);
      const dur = 3 + (game.mut?.springDur || 0);
      game.healZones = game.healZones || [];
      game.healZones.push({ x: player.x, y: player.y, radius, life: dur, max: dur });
      // 視覺
      game.particles.runeCircle(player.x, player.y, radius, dur);
      game.particles.heal(player.x, player.y);
      // 向上飄綠光（多）
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const r = 60;
        game.particles.add({
          x: player.x + Math.cos(a) * r,
          y: player.y + Math.sin(a) * r,
          vx: Utils.jitter(15), vy: -Utils.randomRange(60, 130),
          life: 1.4, max: 1.4, color: Utils.pick(['#6fdd6f', '#aaffaa', '#fff']),
          size: 4, type: 'fire', grow: -3
        });
      }
      game.particles.damageText(player.x, player.y - 24, '+' + amt, '#6fdd6f', true);
      Utils.bigToast('生命之泉！');
      AudioMgr.heal();
    },

    // ============================================================
    // 弓手 Archer
    // ============================================================

    // 箭矢風暴：12 道（+mut）扇形齊射
    a_storm(game) {
      const player = game.player;
      const count = 12 + (game.mut?.stormExtra || 0);
      const baseAng = player.facing;
      const spread = Math.PI / 3;
      const dmg = (18 + player.attack * 0.5) * ActiveSkills.dmgMult(game);
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? (i / (count - 1) - 0.5) : 0;
        const ang = baseAng + t * spread;
        const sx = player.x + Math.cos(ang) * (player.radius + 8);
        const sy = player.y + Math.sin(ang) * (player.radius + 8);
        const p = new Projectile(sx, sy, ang, 620, dmg, 'player', 'arrow');
        p.pierce = 1 + (game.mut?.pierceAll || 0);
        game.projectiles.push(p);
      }
      // 大型槍口扇形
      game.particles.muzzleFlash(player.x + Math.cos(baseAng) * 10,
                                  player.y + Math.sin(baseAng) * 10, baseAng, '#ffd86b');
      game.particles.shockRing(player.x, player.y, 40, '#ffd86b');
      AudioMgr.bowShoot();
      AudioMgr.bowShoot();
      game.shake(5, 0.2);
      Utils.toast('箭矢風暴！');
    },

    // 雷霆穿心：超強直線雷箭，貫穿全場
    a_pierce(game) {
      const player = game.player;
      const ang = player.facing;
      const baseDmg = (120 + player.attack * 1.5) *
                      ActiveSkills.dmgMult(game) *
                      (game.mut?.thunderBoost ? 1.5 : 1);
      const sx = player.x + Math.cos(ang) * (player.radius + 10);
      const sy = player.y + Math.sin(ang) * (player.radius + 10);
      // 雷霆超快子彈
      const p = new Projectile(sx, sy, ang, 1500, baseDmg, 'player', 'bullet');
      p.pierce = 99;
      p.color = '#bbeaff';
      p.trailColor = '#88ccff';
      p.life = 1.0;
      p.thunderArrow = true;
      game.projectiles.push(p);
      // 蓄力閃光
      game.particles.add({
        x: sx, y: sy, vx: 0, vy: 0,
        life: 0.3, max: 0.3, color: '#bbeaff', size: 60, type: 'flash'
      });
      game.particles.muzzleFlash(sx, sy, ang, '#bbeaff');
      // 後座光線（從玩家向後散出）
      for (let i = 0; i < 10; i++) {
        const a = ang + Math.PI + Utils.jitter(0.6);
        const sp = Utils.randomRange(150, 250);
        game.particles.add({
          x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.4, max: 0.4, color: '#fff',
          size: 3, type: 'spark'
        });
      }
      AudioMgr.lightning();
      game.shake(10, 0.35);
      Utils.bigToast('雷霆穿心！');
    },

    // 獵人之擁：隱身 + 加速 + 回血
    a_embrace(game) {
      const player = game.player;
      const amt = Math.floor(player.maxHp * 0.4);
      player.hp = Math.min(player.maxHp, player.hp + amt);
      const dur = 3;
      player.invisTimer = dur;
      player.speedBuffEnd = performance.now() / 1000 + dur;
      player.speedBuffMult = 1.5;
      // 葉子漩渦
      game.particles.leafSwirl(player.x, player.y);
      // 綠色閃光
      game.particles.shockRing(player.x, player.y, 80, '#5cdb5c');
      game.particles.shockRing(player.x, player.y, 50, '#aaffaa');
      game.particles.damageText(player.x, player.y - 24, '+' + amt, '#6fdd6f', true);
      AudioMgr.heal();
      Utils.bigToast('獵人之擁！');
    }

  } // end castMap
};
