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
  a_ice:    { name: '冰巨箭',   cost: 80, cd: 35, desc: '14 秒附魔：普攻變 5 倍大冰巨箭、命中凍結 2.5 秒' },
  a_pierce: { name: '雷霆穿心', cost: 50, cd: 10, desc: '（已替換）' },
  a_embrace:{ name: '獵人之擁', cost: 40, cd: 16, desc: '回 40% HP + 3 秒隱身 + 速度 +50%' },
  // 黑靈狂戰士
  b_darksoul: { name: '黑魂附體', cost: 35, cd: 12, desc: '8 秒附魔：每次揮砍釋放巨大黑色月牙' },
  b_frenzy:   { name: '狂熱',     cost: 40, cd: 14, desc: '6 秒攻速 +50%、移速 +30%' },
  b_recovery: { name: '血祭斬擊', cost: 50, cd: 14, desc: '前方近半屏幕巨型扇形斬,擊殺回血' }
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

    // 狂暴斬擊:6 道(可被 mut.slashExtra 增加)連續弧形劍光,光更亮、震波更大
    w_slash(game) {
      const player = game.player;
      const slashes = 6 + (game.mut?.slashExtra || 0);
      const baseRange = 140;
      const baseDmg = (38 + player.attack * 1.15) * ActiveSkills.dmgMult(game);
      // 中央爆閃
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.3, max: 0.3, color: 'rgba(255,80,80,0.7)',
        size: 140, type: 'flash'
      });
      game.particles.shockRing(player.x, player.y, 160, '#ff5050');
      for (let i = 0; i < slashes; i++) {
        const delay = i * 0.07;
        const dir = i % 2 === 0 ? 1 : -1;
        const ang = player.facing + dir * (0.18 + i * 0.05);
        const range = baseRange + i * 8;
        const color = i % 2 === 0 ? '#ff5050' : '#ffaa33';
        game.schedule(delay, () => {
          game.particles.slashArc(player.x, player.y, ang, range, color);
          game.particles.slashArc(player.x, player.y, ang, range * 0.7, '#fff');
          game.particles.spark(player.x, player.y, 18, '#ffaa33');
          // 從玩家向斬擊方向噴火花
          for (let j = 0; j < 6; j++) {
            const a2 = ang + Utils.jitter(0.35);
            const sp = Utils.randomRange(200, 380);
            game.particles.add({
              x: player.x, y: player.y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp,
              life: 0.4, max: 0.4, color: color, size: 4, type: 'fire', grow: -6
            });
          }
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
          game.shake(5, 0.12);
        });
      }
      // 終結爆閃 + 震屏
      game.schedule(slashes * 0.07, () => {
        game.particles.shockRing(player.x, player.y, baseRange + slashes * 8 + 30, '#fff');
        game.particles.explosion(player.x + Math.cos(player.facing) * baseRange,
                                 player.y + Math.sin(player.facing) * baseRange, 80);
        game.shake(10, 0.3);
        AudioMgr.explosion();
      });
      Utils.bigToast('狂暴斬擊！');
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
      // 中央巨大爆閃 + 額外四道火焰柱
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.5, max: 0.5, color: 'rgba(255,170,48,0.7)',
        size: baseRadius * 1.6, type: 'flash'
      });
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const tx = player.x + Math.cos(a) * baseRadius * 0.6;
        const ty = player.y + Math.sin(a) * baseRadius * 0.6;
        game.schedule(0.1 + i * 0.03, () => {
          for (let j = 0; j < 12; j++) {
            game.particles.add({
              x: tx, y: ty,
              vx: Utils.jitter(40), vy: -Utils.randomRange(60, 180) - j * 8,
              life: 0.9, max: 0.9, color: Utils.pick(['#ff5020', '#ff8030', '#ffd86b']),
              size: Utils.randomRange(5, 10), type: 'fire', grow: -4
            });
          }
          game.particles.shockRing(tx, ty, 70, '#ff8030');
        });
      }
      AudioMgr.explosion();
      AudioMgr.shockwave();
      game.shake(20, 0.6);
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
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.4, max: 0.4, color: 'rgba(255,80,40,0.7)',
        size: 180, type: 'flash'
      });
      game.particles.shockRing(player.x, player.y, 180, '#ff3030');
      game.particles.shockRing(player.x, player.y, 130, '#ff5050');
      game.particles.shockRing(player.x, player.y, 80, '#ff8030');
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

    // 隕石術：10 道（+mut）隕石近全螢幕降下
    m_meteor(game) {
      const player = game.player;
      const weaponMult = WEAPONS[player.currentWeapon]?.skillMult || 1;
      const count = 10 + (game.mut?.meteorExtra || 0) + Math.round((weaponMult - 1) * 4);
      const cx = Input.mouse.worldX;
      const cy = Input.mouse.worldY;
      const baseDmg = (70 + player.attack * 1.5) * ActiveSkills.dmgMult(game) * weaponMult;

      // 中央巨大爆閃預警
      game.particles.add({
        x: cx, y: cy, vx: 0, vy: 0,
        life: 0.5, max: 0.5, color: 'rgba(255,80,40,0.7)',
        size: 240, type: 'flash'
      });
      // 三層紅色預警圈
      game.particles.shockRing(cx, cy, 280, '#ff5020');
      game.particles.shockRing(cx, cy, 200, '#ff8030');
      game.particles.shockRing(cx, cy, 120, '#ffaa33');
      // 螢幕震動 (連續低頻)
      game.shake(4, 0.3);
      for (let i = 0; i < count; i++) {
        const delay = Utils.randomRange(0.05, 1.2);
        const ang = (i / count) * Math.PI * 2 + Math.random();
        const r = Utils.randomRange(0, 240);
        const tx = cx + Math.cos(ang) * r;
        const ty = cy + Math.sin(ang) * r;
        const sx = tx - 380 + Utils.jitter(80);
        const sy = ty - 700;
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
        game.schedule(delay + 0.35, () => {
          // 巨型撞擊（兩層爆炸 + 衝擊環）
          game.particles.explosion(tx, ty, 130);
          game.particles.explosion(tx + Utils.jitter(30), ty + Utils.jitter(30), 80);
          game.particles.shockRing(tx, ty, 160, '#ff5020');
          game.particles.shockRing(tx, ty, 90, '#fff');
          // 撞擊坑（黑色圓）
          game.particles.add({
            x: tx, y: ty, vx: 0, vy: 0,
            life: 1.5, max: 1.5, color: 'rgba(40,20,10,0.5)',
            size: 60, type: 'smoke', grow: -10
          });
          game.shake(7, 0.25);
          AudioMgr.explosion();
          AudioMgr.shockwave();
          for (const e of game.enemies) {
            if (!e.alive) continue;
            if (Utils.distance(tx, ty, e.x, e.y) < 130 + e.radius) {
              e.takeDamage(baseDmg, game);
              e.applyKnockback(tx, ty, 280);
              game.particles.damageText(e.x, e.y - 12, baseDmg, '#ffaa33');
            }
          }
          if (game.boss && game.boss.alive) {
            if (Utils.distance(tx, ty, game.boss.x, game.boss.y) < 130 + game.boss.radius) {
              game.boss.takeDamage(baseDmg * 0.85, game);
            }
          }
          if (game.mut?.meteorIce) {
            game.iceZones = game.iceZones || [];
            game.iceZones.push({ x: tx, y: ty, radius: 90, life: 5 });
          }
        });
      }
      Utils.bigToast('隕石術！');
      AudioMgr.fireball();
      AudioMgr.bossSpawn();
    },

    // 冰封新星：近全螢幕冰風暴
    m_frost(game) {
      const player = game.player;
      const weaponMult = WEAPONS[player.currentWeapon]?.skillMult || 1;
      const radius = 520 * Math.sqrt(weaponMult);  // 巨幅擴大
      const baseDmg = (110 + player.attack * 1.4) * ActiveSkills.dmgMult(game) * weaponMult;
      const freezeDur = 3 + (game.mut?.freezeExtra || 0);

      // 6 層震波（從小到大連續擴張）
      const ringColors = ['#fff', '#aaccff', '#88aaff', '#fff', '#aaccff', '#5577aa'];
      for (let i = 0; i < 6; i++) {
        game.schedule(i * 0.04, () => {
          game.particles.shockRing(player.x, player.y, radius * (0.25 + i * 0.15), ringColors[i]);
        });
      }
      // 中央巨大爆閃
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.5, max: 0.5, color: '#fff', size: 180, type: 'flash'
      });
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.45, max: 0.45, color: 'rgba(170,204,255,0.6)',
        size: 320, type: 'flash'
      });
      // 大量飛旋冰晶（兩波）
      game.particles.frostNova(player.x, player.y, radius);
      game.schedule(0.15, () => game.particles.frostNova(player.x, player.y, radius * 0.7));
      // 額外環狀大冰晶（60 顆）
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const sp = radius / 0.65;
        game.particles.add({
          x: player.x, y: player.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.7, max: 0.7, color: '#aaccff',
          size: Utils.randomRange(6, 10), type: 'iceShard', angle: a
        });
      }
      // 上升冰霧（覆蓋整個螢幕感）
      for (let i = 0; i < 40; i++) {
        game.particles.add({
          x: player.x + Utils.jitter(120), y: player.y + Utils.jitter(60),
          vx: Utils.jitter(20), vy: -Utils.randomRange(40, 110),
          life: 1.8, max: 1.8, color: 'rgba(170,204,255,0.6)',
          size: Utils.randomRange(10, 18), type: 'smoke', grow: 10
        });
      }
      // 周圍 8 道隨機冰柱
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = Utils.randomRange(radius * 0.3, radius * 0.6);
        const tx = player.x + Math.cos(a) * r;
        const ty = player.y + Math.sin(a) * r;
        game.schedule(0.1 + i * 0.04, () => {
          for (let j = 0; j < 5; j++) {
            game.particles.add({
              x: tx, y: ty,
              vx: 0, vy: -Utils.randomRange(40, 90) - j * 20,
              life: 0.8, max: 0.8, color: '#fff',
              size: 12 - j * 1.5, type: 'iceShard', angle: -Math.PI/2
            });
          }
          game.particles.shockRing(tx, ty, 30, '#aaccff');
        });
      }
      // 傷害 + 凍結
      for (const e of game.enemies) {
        if (!e.alive) continue;
        if (Utils.distance(player.x, player.y, e.x, e.y) < radius + e.radius) {
          e.takeDamage(baseDmg, game);
          e.frozenTimer = freezeDur;
          e.slowTimer = freezeDur + 1;
          game.particles.damageText(e.x, e.y - 12, baseDmg, '#aaccff', true);
        }
      }
      if (game.boss && game.boss.alive) {
        const d = Utils.distance(player.x, player.y, game.boss.x, game.boss.y);
        if (d < radius + game.boss.radius) {
          game.boss.takeDamage(baseDmg * 1.2, game);
          game.boss.slowTimer = freezeDur * 0.6;
        }
      }
      AudioMgr.shockwave();
      AudioMgr.lightning();
      AudioMgr.bossSpawn();
      game.shake(16, 0.55);
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
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.45, max: 0.45, color: 'rgba(110,221,110,0.65)',
        size: 200, type: 'flash'
      });
      game.particles.shockRing(player.x, player.y, 180, '#3a8a3a');
      game.particles.shockRing(player.x, player.y, 130, '#6fdd6f');
      game.particles.shockRing(player.x, player.y, 80, '#aaffaa');
      game.particles.runeCircle(player.x, player.y, radius, dur);
      game.particles.heal(player.x, player.y);
      game.shake(4, 0.2);
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

    // 箭矢風暴:18 道(+mut)寬扇形齊射,更亮更震
    a_storm(game) {
      const player = game.player;
      const count = 18 + (game.mut?.stormExtra || 0);
      const baseAng = player.facing;
      const spread = Math.PI * 0.6;   // 加大到 108°
      const dmg = (22 + player.attack * 0.55) * ActiveSkills.dmgMult(game);
      // 第一波
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? (i / (count - 1) - 0.5) : 0;
        const ang = baseAng + t * spread;
        const sx = player.x + Math.cos(ang) * (player.radius + 8);
        const sy = player.y + Math.sin(ang) * (player.radius + 8);
        const p = new Projectile(sx, sy, ang, 680, dmg, 'player', 'arrow');
        p.pierce = 2 + (game.mut?.pierceAll || 0);
        game.projectiles.push(p);
      }
      // 0.15 秒後第二波(輕量補射)
      game.schedule(0.15, () => {
        for (let i = 0; i < Math.floor(count * 0.7); i++) {
          const t = (i / (count - 1) - 0.5) + Utils.jitter(0.05);
          const ang = baseAng + t * spread;
          const sx = player.x + Math.cos(ang) * (player.radius + 8);
          const sy = player.y + Math.sin(ang) * (player.radius + 8);
          const p = new Projectile(sx, sy, ang, 720, dmg * 0.85, 'player', 'arrow');
          p.pierce = 2 + (game.mut?.pierceAll || 0);
          game.projectiles.push(p);
        }
        game.particles.muzzleFlash(player.x + Math.cos(baseAng) * 10,
                                    player.y + Math.sin(baseAng) * 10, baseAng, '#fff066');
      });
      // 巨型槍口扇形 + 中央爆閃
      game.particles.muzzleFlash(player.x + Math.cos(baseAng) * 10,
                                  player.y + Math.sin(baseAng) * 10, baseAng, '#ffd86b');
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.3, max: 0.3, color: '#fff066', size: 120, type: 'flash'
      });
      game.particles.shockRing(player.x, player.y, 80, '#ffd86b');
      game.particles.shockRing(player.x, player.y, 50, '#fff066');
      // 後座葉子噴射
      for (let i = 0; i < 16; i++) {
        const a = baseAng + Math.PI + Utils.jitter(0.5);
        const sp = Utils.randomRange(120, 280);
        game.particles.add({
          x: player.x, y: player.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.5, max: 0.5, color: '#fff066', size: 3, type: 'spark'
        });
      }
      AudioMgr.bowShoot();
      AudioMgr.bowShoot();
      game.shake(8, 0.3);
      Utils.bigToast('箭矢風暴！');
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
      game.particles.leafSwirl(player.x, player.y);
      // 綠色閃光多層
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.35, max: 0.35, color: 'rgba(110,221,110,0.6)',
        size: 200, type: 'flash'
      });
      game.particles.shockRing(player.x, player.y, 160, '#3a8a3a');
      game.particles.shockRing(player.x, player.y, 110, '#5cdb5c');
      game.particles.shockRing(player.x, player.y, 70, '#aaffaa');
      // 葉風暴向上
      for (let i = 0; i < 24; i++) {
        game.particles.add({
          x: player.x + Utils.jitter(40), y: player.y + Utils.jitter(20),
          vx: Utils.jitter(40), vy: -Utils.randomRange(60, 140),
          life: 1.4, max: 1.4, color: Utils.pick(['#5cdb5c', '#aaffaa', '#3aa83a']),
          size: 4, type: 'leaf', rot: Math.random() * 6
        });
      }
      game.shake(5, 0.2);
      game.particles.damageText(player.x, player.y - 24, '+' + amt, '#6fdd6f', true);
      AudioMgr.heal();
      Utils.bigToast('獵人之擁！');
    },

    // 冰巨箭：14 秒附魔，普攻變超大冰箭、命中凍結
    a_ice(game) {
      const player = game.player;
      const dur = 14 + (game.mut?.iceArrowDur || 0);
      player.iceArrowEnd = performance.now() / 1000 + dur;
      player.iceArrowActive = true;

      // 中央巨大冰爆閃光
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.5, max: 0.5, color: '#fff', size: 140, type: 'flash'
      });
      // 三層冰震波
      game.particles.shockRing(player.x, player.y, 200, '#aaccff');
      game.particles.shockRing(player.x, player.y, 130, '#fff');
      game.particles.shockRing(player.x, player.y, 80, '#88aaff');
      // 大量飛旋冰晶
      game.particles.frostNova(player.x, player.y, 220);
      // 額外環繞冰晶（更密集）
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const sp = Utils.randomRange(120, 320);
        game.particles.add({
          x: player.x, y: player.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.9, max: 0.9, color: '#aaccff',
          size: Utils.randomRange(5, 9), type: 'iceShard', angle: a
        });
      }
      // 上升冰霧
      for (let i = 0; i < 22; i++) {
        game.particles.add({
          x: player.x + Utils.jitter(40), y: player.y + Utils.jitter(20),
          vx: Utils.jitter(15), vy: -Utils.randomRange(40, 100),
          life: 1.5, max: 1.5, color: 'rgba(170,204,255,0.7)',
          size: Utils.randomRange(8, 14), type: 'smoke', grow: 6
        });
      }
      // 冰凍周圍敵人（範圍 280）
      for (const e of game.enemies) {
        if (!e.alive) continue;
        if (Utils.distance(player.x, player.y, e.x, e.y) < 280 + e.radius) {
          e.frozenTimer = Math.max(e.frozenTimer || 0, 1.5);
          e.slowTimer = Math.max(e.slowTimer || 0, 2.5);
        }
      }
      AudioMgr.shockwave();
      AudioMgr.lightning();
      game.shake(11, 0.45);
      Utils.bigToast('冰巨箭！');
    },

    // ============================================================
    // 黑靈狂戰士 Berserker
    // ============================================================

    // 黑魂附體:8 秒附魔,每次揮砍釋放黑色月牙
    b_darksoul(game) {
      const player = game.player;
      const dur = 8 + (game.mut?.darksoulDur || 0);
      player.darkSoulEnd = performance.now() / 1000 + dur;
      player.darkSoulActive = true;
      // 中央巨大暗紫衝擊
      game.particles.shockRing(player.x, player.y, 220, '#1a001a');
      game.particles.shockRing(player.x, player.y, 160, '#3a0a3a');
      game.particles.shockRing(player.x, player.y, 100, '#5a0a5a');
      game.particles.shockRing(player.x, player.y, 60, '#cc3030');
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.55, max: 0.55, color: 'rgba(20,0,30,0.7)', size: 280, type: 'flash'
      });
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.4, max: 0.4, color: '#5a0a5a', size: 140, type: 'flash'
      });
      // 8 道月牙浮現
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = 100;
        game.schedule(i * 0.04, () => {
          game.particles.slashArc(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r,
                                    a + Math.PI / 2, 60, '#3a0a3a');
        });
      }
      // 環狀邪氣粒子
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const r = 40 + Math.random() * 30;
        game.particles.add({
          x: player.x + Math.cos(a) * r,
          y: player.y + Math.sin(a) * r,
          vx: -Math.sin(a) * 100,
          vy: Math.cos(a) * 100 - 60,
          life: 1.5, max: 1.5,
          color: Utils.pick(['#3a0a3a', '#5a0a5a', '#cc3030', '#0a000a']),
          size: Utils.randomRange(4, 7), type: 'fire', grow: -3
        });
      }
      // 上升黑霧
      for (let i = 0; i < 16; i++) {
        game.particles.add({
          x: player.x + Utils.jitter(30), y: player.y + Utils.jitter(15),
          vx: Utils.jitter(20), vy: -Utils.randomRange(40, 100),
          life: 1.2, max: 1.2, color: 'rgba(40,10,40,0.8)',
          size: Utils.randomRange(6, 12), type: 'smoke', grow: 6
        });
      }
      AudioMgr.shockwave();
      AudioMgr.bossSpawn();
      game.shake(10, 0.4);
      Utils.bigToast('黑魂附體！');
    },

    // 狂熱：6 秒攻擊速度與移速大增
    b_frenzy(game) {
      const player = game.player;
      const dur = 6 + (game.mut?.frenzyDur || 0);
      player.frenzyEnd = performance.now() / 1000 + dur;
      player.frenzyActive = true;
      // 血紅震波 + 紅霧 + 巨型爆閃
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.45, max: 0.45, color: 'rgba(255,40,40,0.7)',
        size: 220, type: 'flash'
      });
      game.particles.shockRing(player.x, player.y, 200, '#5a0a0a');
      game.particles.shockRing(player.x, player.y, 140, '#cc3030');
      game.particles.shockRing(player.x, player.y, 90, '#ff3030');
      game.particles.shockRing(player.x, player.y, 50, '#fff');
      // 紅色血滴向上爆射
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = Utils.randomRange(80, 220);
        game.particles.add({
          x: player.x, y: player.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
          life: 0.8, max: 0.8,
          color: Utils.pick(['#cc3030', '#ff3030', '#aa0000', '#5a0a0a']),
          size: Utils.randomRange(3, 6), type: 'blood', gravity: 160
        });
      }
      // 持續上升的紅霧
      for (let i = 0; i < 20; i++) {
        game.particles.add({
          x: player.x + Utils.jitter(35), y: player.y + Utils.jitter(15),
          vx: Utils.jitter(15), vy: -Utils.randomRange(40, 90),
          life: 1.0, max: 1.0, color: 'rgba(200,40,40,0.7)',
          size: Utils.randomRange(6, 10), type: 'smoke', grow: 8
        });
      }
      AudioMgr.shockwave();
      AudioMgr.swing();
      game.shake(8, 0.35);
      Utils.bigToast('狂熱！');
    },

    // 血祭斬擊:前方扇形大範圍 AOE(近半屏幕),擊殺回血
    b_recovery(game) {
      const player = game.player;
      const range = 460 * (game.mut?.recoveryBoost ? 1.2 : 1);   // 近半屏幕
      const halfAngle = Math.PI * 0.42;                          // ~150° 扇形,接近半圓
      const baseDmg = (160 + player.attack * 2.2) * ActiveSkills.dmgMult(game);
      const facing = player.facing;

      // 中央巨型紅黑爆閃
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.55, max: 0.55, color: 'rgba(255,40,40,0.7)',
        size: 220, type: 'flash'
      });
      game.particles.add({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.45, max: 0.45, color: 'rgba(40,0,10,0.7)',
        size: 320, type: 'flash'
      });

      // 4 道大型弧形劍光填滿扇形
      const slashSweeps = [-0.35, -0.12, 0.12, 0.35];
      for (let i = 0; i < slashSweeps.length; i++) {
        const off = slashSweeps[i];
        game.schedule(i * 0.05, () => {
          const ang = facing + off;
          game.particles.slashArc(player.x, player.y, ang, range, i % 2 === 0 ? '#ff2030' : '#cc1030');
          game.particles.slashArc(player.x, player.y, ang, range * 0.85, '#fff');
        });
      }

      // 主弧形:沿扇形邊緣繪製血色光波
      for (let i = 0; i < 14; i++) {
        const t = i / 13;
        const ang = facing + (t - 0.5) * halfAngle * 2;
        game.schedule(t * 0.18, () => {
          // 沿著扇形外緣噴血
          for (let j = 0; j < 4; j++) {
            const r = range * (0.6 + j * 0.13);
            game.particles.add({
              x: player.x + Math.cos(ang) * r * 0.4,
              y: player.y + Math.sin(ang) * r * 0.4,
              vx: Math.cos(ang) * 350,
              vy: Math.sin(ang) * 350,
              life: 0.5, max: 0.5,
              color: Utils.pick(['#ff2030', '#cc1030', '#fff', '#5a0a0a']),
              size: Utils.randomRange(5, 9),
              type: 'fire', grow: -6
            });
          }
        });
      }

      // 血色震波環(沿前方)
      const ringX = player.x + Math.cos(facing) * range * 0.5;
      const ringY = player.y + Math.sin(facing) * range * 0.5;
      game.particles.shockRing(player.x, player.y, range, '#ff2030');
      game.particles.shockRing(player.x, player.y, range * 0.7, '#cc1030');
      game.particles.shockRing(ringX, ringY, 200, '#fff');

      // 血滴向前濺射
      for (let i = 0; i < 50; i++) {
        const a = facing + Utils.jitter(halfAngle);
        const sp = Utils.randomRange(250, 580);
        game.particles.add({
          x: player.x, y: player.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          life: 0.8, max: 0.8,
          color: Utils.pick(['#cc3030', '#5a0a0a', '#ff3030', '#0a0000', '#fff']),
          size: Utils.randomRange(4, 8), type: 'blood', gravity: 120
        });
      }
      // 持續紅霧
      for (let i = 0; i < 30; i++) {
        const a = facing + Utils.jitter(halfAngle);
        game.particles.add({
          x: player.x + Math.cos(a) * Utils.randomRange(40, range * 0.6),
          y: player.y + Math.sin(a) * Utils.randomRange(40, range * 0.6),
          vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 50,
          life: 1.3, max: 1.3, color: 'rgba(200,40,40,0.65)',
          size: Utils.randomRange(8, 14), type: 'smoke', grow: 8
        });
      }

      // 扇形內所有敵人吃傷害 + 擊飛 + 暴擊閃光
      let killed = 0;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const d = Utils.distance(player.x, player.y, e.x, e.y);
        if (d > range + e.radius) continue;
        const a = Utils.angle(player.x, player.y, e.x, e.y);
        if (Math.abs(Utils.angleDiff(a, facing)) > halfAngle) continue;
        const before = e.alive;
        e.takeDamage(baseDmg, game);
        e.applyKnockback(player.x, player.y, 460);
        game.particles.damageText(e.x, e.y - 12, baseDmg, '#ff2030');
        // 命中爆閃
        game.particles.add({
          x: e.x, y: e.y, vx: 0, vy: 0,
          life: 0.2, max: 0.2, color: '#fff', size: 28, type: 'flash'
        });
        if (before && !e.alive) killed++;
      }
      // Boss 也吃
      if (game.boss && game.boss.alive) {
        const d = Utils.distance(player.x, player.y, game.boss.x, game.boss.y);
        if (d < range + game.boss.radius) {
          const a = Utils.angle(player.x, player.y, game.boss.x, game.boss.y);
          if (Math.abs(Utils.angleDiff(a, facing)) < halfAngle) {
            game.boss.takeDamage(baseDmg * 1.15, game);
            game.particles.damageText(game.boss.x, game.boss.y - 14, Math.round(baseDmg * 1.15), '#ff2030', true);
          }
        }
      }
      // 擊殺回血:每擊殺 +12 HP,並至少回 15
      const heal = Math.max(15, killed * 12);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      if (heal > 0) game.particles.damageText(player.x, player.y - 30, '+' + heal, '#6fdd6f', true);

      AudioMgr.shockwave();
      AudioMgr.swing();
      AudioMgr.explosion();
      game.shake(14, 0.45);
      Utils.bigToast('血祭斬擊！');
    }

  } // end castMap
};
