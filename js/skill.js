/* ================================================================
 * skill.js
 * 被動 + 6 個主動技能
 * Q 火球 / R 雷霆 / G 衝擊波 / V 治癒 / X 子彈風暴 / C 鎖鏈閃電
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
      { id: 'fire',  name: '火球精通', desc: '火球傷害 +20% / 級', level: 0, max: 5 },
      { id: 'thunder',name:'雷霆精通', desc: '雷霆 +1 道閃電 / 級', level: 0, max: 4 },
      { id: 'bullet',name: '子彈大師', desc: '子彈風暴 +2 顆 / 級', level: 0, max: 4 },
      { id: 'chain', name: '鎖鏈大師', desc: '鎖鏈閃電 +1 跳 / 級', level: 0, max: 4 }
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
    player.attack  = (player.baseAttack || this.baseAttack) + atk * 3;
    player.defense = (player.baseDefense || this.baseDefense) + def * 2;
    player.maxMp = 100 + mp * 20 + (player.shopUpgrades?.maxMp || 0) * 20;
    if (player.mp > player.maxMp) player.mp = player.maxMp;
  }

  gatherMultiplier() { return 1 + this.get('gather').level * 0.25; }
  staminaRegenMult() { return 1 + this.get('stam').level * 0.3; }
  dashMult() { return 1 + this.get('dash').level * 0.2; }
  towerMult() { return 1 + this.get('tower').level * 0.3; }
  fireMult() { return 1 + this.get('fire').level * 0.20; }
  thunderBolts() { return 6 + this.get('thunder').level; }
  bulletCount()  { return 12 + this.get('bullet').level * 2; }
  chainJumps()   { return 5 + this.get('chain').level; }
}

/* ===== 主動技能定義 ===== */
const ACTIVE_SKILLS = {
  q: { id: 'q', name: '火球術',     cost: 25, cd: 4,  desc: '向滑鼠方向發射爆炸火球' },
  r: { id: 'r', name: '雷霆風暴',   cost: 50, cd: 12, desc: '隨機劈擊範圍內多隻敵人' },
  g: { id: 'g', name: '衝擊波',     cost: 30, cd: 7,  desc: '以自己為中心擴張衝擊波' },
  v: { id: 'v', name: '治癒術',     cost: 60, cd: 20, desc: '回復 40% HP + 體力' },
  x: { id: 'x', name: '子彈風暴',   cost: 35, cd: 6,  desc: '360° 噴射 12+ 魔力子彈' },
  c: { id: 'c', name: '鎖鏈閃電',   cost: 40, cd: 8,  desc: '雷電串聯 5+ 個敵人' }
};

const ActiveSkills = {
  cast(id, game) {
    const sk = ACTIVE_SKILLS[id];
    if (!sk) return false;
    const player = game.player;

    if (player.skillCd[id] > 0) { Utils.toast('冷卻中'); AudioMgr.deny(); return false; }
    if (player.mp < sk.cost) { Utils.toast('魔力不足'); AudioMgr.deny(); return false; }

    player.mp -= sk.cost;
    player.skillCd[id] = sk.cd;

    if (id === 'q') this.castFireball(game);
    if (id === 'r') this.castThunder(game);
    if (id === 'g') this.castShockwave(game);
    if (id === 'v') this.castHeal(game);
    if (id === 'x') this.castBulletStorm(game);
    if (id === 'c') this.castChainLightning(game);
    return true;
  },

  castFireball(game) {
    const player = game.player;
    const ang = player.facing;
    const sx = player.x + Math.cos(ang) * (player.radius + 8);
    const sy = player.y + Math.sin(ang) * (player.radius + 8);
    const dmg = (60 + player.attack * 1.5) * game.skills.fireMult();
    game.projectiles.push(new Projectile(sx, sy, ang, 500, dmg, 'player', 'fireball'));
    game.particles.muzzleFlash(sx, sy, ang, '#ff8033');
    AudioMgr.fireball();
    game.shake(5, 0.18);
  },

  castThunder(game) {
    const player = game.player;
    const range = 480;
    const targets = [];
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (Utils.distance(player.x, player.y, e.x, e.y) < range) targets.push(e);
    }
    if (game.boss && game.boss.alive &&
        Utils.distance(player.x, player.y, game.boss.x, game.boss.y) < range) targets.push(game.boss);

    if (targets.length === 0) { Utils.toast('附近沒有目標'); }
    const bolts = game.skills.thunderBolts();
    for (let i = 0; i < bolts; i++) {
      const tgt = Utils.pick(targets);
      if (!tgt) break;
      const sx = tgt.x + Utils.jitter(30);
      const sy = tgt.y - 420;
      game.particles.lightning(sx, sy, tgt.x, tgt.y);
      const dmg = 50 + player.attack * 0.6;
      if (tgt.takeDamage) tgt.takeDamage(dmg, game);
      game.particles.damageText(tgt.x, tgt.y - 16, dmg, '#bbeaff', true);
    }
    AudioMgr.lightning();
    game.shake(7, 0.28);
  },

  castShockwave(game) {
    const player = game.player;
    const radius = 180;
    game.particles.shockRing(player.x, player.y, radius, '#88ccff');
    game.particles.shockRing(player.x, player.y, radius * 0.7, '#fff');
    game.particles.spark(player.x, player.y, 30, '#cfeaff');
    const dmg = 40 + player.attack * 0.8;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (Utils.distance(player.x, player.y, e.x, e.y) < radius + e.radius) {
        e.takeDamage(dmg, game);
        e.applyKnockback(player.x, player.y, 420);
        game.particles.damageText(e.x, e.y - 12, dmg, '#88ccff');
      }
    }
    if (game.boss && game.boss.alive) {
      const d = Utils.distance(player.x, player.y, game.boss.x, game.boss.y);
      if (d < radius + game.boss.radius) {
        game.boss.takeDamage(dmg * 1.2, game);
        game.particles.damageText(game.boss.x, game.boss.y - 12, dmg * 1.2, '#88ccff');
      }
    }
    AudioMgr.shockwave();
    game.shake(9, 0.32);
  },

  castHeal(game) {
    const player = game.player;
    const amt = Math.floor(player.maxHp * 0.4);
    player.hp = Math.min(player.maxHp, player.hp + amt);
    player.stamina = Math.min(player.maxStamina, player.stamina + 30);
    player.hunger = Math.min(player.maxHunger, player.hunger + 30);
    game.particles.heal(player.x, player.y);
    game.particles.damageText(player.x, player.y - 24, '+' + amt, '#6fdd6f', true);
    AudioMgr.heal();
  },

  // ===== X 子彈風暴：360° 噴射魔力子彈 =====
  castBulletStorm(game) {
    const player = game.player;
    const count = game.skills.bulletCount();
    const dmg = 28 + player.attack * 0.5;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const sx = player.x + Math.cos(ang) * (player.radius + 6);
      const sy = player.y + Math.sin(ang) * (player.radius + 6);
      game.projectiles.push(new Projectile(sx, sy, ang, 580, dmg, 'player', 'bullet'));
      // 出口火花
      game.particles.add({
        x: sx, y: sy, vx: 0, vy: 0,
        life: 0.2, max: 0.2, color: '#ffd86b', size: 10, type: 'flash'
      });
    }
    game.particles.shockRing(player.x, player.y, 60, '#ffd86b');
    game.particles.shockRing(player.x, player.y, 30, '#fff');
    game.particles.spark(player.x, player.y, 24, '#fff066');
    AudioMgr.bowShoot();
    AudioMgr.shockwave();
    game.shake(6, 0.2);
  },

  // ===== C 鎖鏈閃電：在多個敵人間跳躍 =====
  castChainLightning(game) {
    const player = game.player;
    const range = 280;
    const all = [];
    for (const e of game.enemies) if (e.alive) all.push(e);
    if (game.boss && game.boss.alive) all.push(game.boss);

    // 找最近的初始目標
    const candidates = all.filter(e =>
      Utils.distance(player.x, player.y, e.x, e.y) < range);
    if (candidates.length === 0) {
      Utils.toast('附近沒有目標'); player.skillCd['c'] = 0.5; return;
    }
    candidates.sort((a, b) =>
      Utils.distanceSq(player.x, player.y, a.x, a.y) -
      Utils.distanceSq(player.x, player.y, b.x, b.y));

    const maxJumps = game.skills.chainJumps();
    const hit = new Set();
    let dmg = 55 + player.attack * 0.9;
    let lastX = player.x, lastY = player.y;
    let current = candidates[0];

    for (let i = 0; i < maxJumps && current; i++) {
      hit.add(current);
      game.particles.chainBolt(lastX, lastY, current.x, current.y, '#bbeaff');
      if (current.takeDamage) current.takeDamage(dmg, game);
      game.particles.damageText(current.x, current.y - 14, dmg, '#bbeaff', i === 0);
      game.particles.spark(current.x, current.y, 10, '#ddeeff');

      lastX = current.x; lastY = current.y;
      dmg *= 0.85;

      // 下個最近的、沒被打過的
      let next = null, nd = 240;
      for (const e of all) {
        if (hit.has(e) || !e.alive) continue;
        const d = Utils.distance(lastX, lastY, e.x, e.y);
        if (d < nd) { nd = d; next = e; }
      }
      current = next;
    }
    AudioMgr.lightning();
    game.shake(6, 0.25);
  }
};
