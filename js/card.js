/* ================================================================
 * card.js
 * Roguelike 卡牌：每波結束選 3 取 1
 * 卡牌會修改 game.mut（持久變異旗標），直接改變技能特效
 * classes 屬性指定可出現的職業
 * ================================================================ */
const CARD_POOL = [
  // ====================== 通用 屬性 ======================
  { id: 'hp_up',  classes: 'all', tier: 'common', name: '生命之心', desc: '+25 最大 HP', color: '#ff7777',
    apply: g => { g.player.maxHp += 25; g.player.hp += 25; } },
  { id: 'mp_up',  classes: 'all', tier: 'common', name: '魔法之心', desc: '+30 最大 MP', color: '#7aaaff',
    apply: g => { g.player.maxMp += 30; g.player.mp += 30; } },
  { id: 'atk_up', classes: 'all', tier: 'common', name: '猛力之握', desc: '+5 攻擊力', color: '#ffaa55',
    apply: g => { g.player.baseAttack += 5; g.skills.applyAll(g.player); } },
  { id: 'def_up', classes: 'all', tier: 'common', name: '鋼鐵之膚', desc: '+3 防禦力', color: '#aaaaaa',
    apply: g => { g.player.baseDefense += 3; g.skills.applyAll(g.player); } },
  { id: 'spd_up', classes: 'all', tier: 'common', name: '疾風之靴', desc: '+12% 移動速度', color: '#88ff88',
    apply: g => { g.player.speed *= 1.12; } },
  { id: 'sk_pt',  classes: 'all', tier: 'common', name: '頓悟',     desc: '+2 技能點', color: '#ffd86b',
    apply: g => { g.player.skillPoints += 2; } },

  // ====================== 通用 技能強化 ======================
  { id: 'cd_reduce',  classes: 'all', tier: 'rare', name: '冷靜思緒',  desc: '技能冷卻 -20%', color: '#88ddff',
    apply: g => { g.mut.cdMult = (g.mut.cdMult || 1) * 0.8; } },
  { id: 'sk_dmg',     classes: 'all', tier: 'rare', name: '法力強化',  desc: '技能傷害 +25%', color: '#cc66ff',
    apply: g => { g.mut.skillDmgMult = (g.mut.skillDmgMult || 1) * 1.25; } },
  { id: 'heal_kill',  classes: 'all', tier: 'rare', name: '吸血鬥士',  desc: '擊殺回 3 HP', color: '#aa3333',
    apply: g => { g.mut.healOnKill = (g.mut.healOnKill || 0) + 3; } },
  { id: 'mp_kill',    classes: 'all', tier: 'rare', name: '靈魂收割',  desc: '擊殺回 5 MP', color: '#5a8aff',
    apply: g => { g.mut.mpOnKill = (g.mut.mpOnKill || 0) + 5; } },
  { id: 'gold_mult',  classes: 'all', tier: 'rare', name: '黃金獵手',  desc: '金幣 +50%', color: '#ffd86b',
    apply: g => { g.mut.goldMult = (g.mut.goldMult || 1) + 0.5; } },
  { id: 'tower_speed',classes: 'all', tier: 'rare', name: '速射箭塔',  desc: '箭塔射速 +40%', color: '#88aaff',
    apply: g => { g.mut.towerSpeedMult = (g.mut.towerSpeedMult || 1) * 0.7; } },
  { id: 'wall_regen', classes: 'all', tier: 'rare', name: '自癒之牆',  desc: '牆隨時間回血', color: '#cccccc',
    apply: g => { g.mut.wallRegen = true; } },

  // ====================== 法師 專屬 ======================
  { id: 'm_meteor_more', classes: ['mage'], tier: 'rare', name: '隕石暴雨', color: '#ff5020',
    desc: '隕石術 +3 顆隕石',
    apply: g => { g.mut.meteorExtra = (g.mut.meteorExtra || 0) + 3; } },
  { id: 'm_meteor_ice', classes: ['mage'], tier: 'rare', name: '冰火合擊', color: '#aaccff',
    desc: '隕石命中後留下冰霜減速地面',
    apply: g => { g.mut.meteorIce = true; } },
  { id: 'm_freeze_ext', classes: ['mage'], tier: 'rare', name: '永凍領域', color: '#88aaff',
    desc: '冰封新星凍結時間 +2 秒',
    apply: g => { g.mut.freezeExtra = (g.mut.freezeExtra || 0) + 2; } },
  { id: 'm_spring_dur', classes: ['mage'], tier: 'rare', name: '黑炎深淵', color: '#aa00ff',
    desc: '黑炎隕石雨傷害 +30%、隕石 +6 顆',
    apply: g => { g.mut.skillDmgMult = (g.mut.skillDmgMult || 1) * 1.3; g.mut.meteorExtra = (g.mut.meteorExtra || 0) + 6; } },
  { id: 'm_arcane', classes: ['mage'], tier: 'legendary', name: '奧術主宰', color: '#cc66ff',
    desc: '所有技能傷害 +40%、冷卻 -25%',
    apply: g => {
      g.mut.skillDmgMult = (g.mut.skillDmgMult || 1) * 1.4;
      g.mut.cdMult = (g.mut.cdMult || 1) * 0.75;
    } },

  // ====================== 弓手 專屬 ======================
  { id: 'a_storm_more', classes: ['archer'], tier: 'rare', name: '箭雨之神', color: '#ffd86b',
    desc: '箭矢風暴 +5 道箭',
    apply: g => { g.mut.stormExtra = (g.mut.stormExtra || 0) + 5; } },
  { id: 'a_pierce_more', classes: ['archer'], tier: 'rare', name: '穿透精通', color: '#ffaa55',
    desc: '所有箭穿透 +2',
    apply: g => { g.mut.pierceAll = (g.mut.pierceAll || 0) + 2; } },
  { id: 'a_ice_dur', classes: ['archer'], tier: 'rare', name: '永凍領域', color: '#bbeaff',
    desc: '冰巨箭持續 +6 秒',
    apply: g => { g.mut.iceArrowDur = (g.mut.iceArrowDur || 0) + 6; } },
  { id: 'a_invis_dmg', classes: ['archer'], tier: 'rare', name: '焰爆連射', color: '#ff6020',
    desc: '爆裂連矢持續 +6 秒、爆炸範圍 +50',
    apply: g => { g.mut.boomDur = (g.mut.boomDur || 0) + 6; g.mut.boomRadius = (g.mut.boomRadius || 0) + 50; } },
  { id: 'a_ranger', classes: ['archer'], tier: 'legendary', name: '荒野之神', color: '#aaffaa',
    desc: '箭矢風暴 +5、穿透 +1、攻速 +30%',
    apply: g => {
      g.mut.stormExtra = (g.mut.stormExtra || 0) + 5;
      g.mut.pierceAll = (g.mut.pierceAll || 0) + 1;
      g.mut.attackSpeedMult = (g.mut.attackSpeedMult || 1) * 0.7;
    } },

  // ====================== 黑靈狂戰士 專屬 ======================
  { id: 'b_double_moon', classes: ['berserker'], tier: 'rare', name: '雙倍月牙', color: '#5a0a5a',
    desc: '黑魂附體期間每次攻擊釋放 2 道月牙',
    apply: g => { g.mut.darkmoonDouble = true; } },
  { id: 'b_moon_dmg', classes: ['berserker'], tier: 'rare', name: '巨型月牙', color: '#cc3030',
    desc: '黑色月牙傷害 +60%',
    apply: g => { g.mut.darkmoonDmg = (g.mut.darkmoonDmg || 1) + 0.6; } },
  { id: 'b_darksoul_dur', classes: ['berserker'], tier: 'rare', name: '永恆黑魂', color: '#3a0a3a',
    desc: '黑魂附體持續 +6 秒',
    apply: g => { g.mut.darksoulDur = (g.mut.darksoulDur || 0) + 6; } },
  { id: 'b_frenzy_dur', classes: ['berserker'], tier: 'rare', name: '無盡狂熱', color: '#ff3030',
    desc: '狂熱持續 +4 秒',
    apply: g => { g.mut.frenzyDur = (g.mut.frenzyDur || 0) + 4; } },
  { id: 'b_recovery', classes: ['berserker'], tier: 'rare', name: '吞噬恢復', color: '#5a0a0a',
    desc: '恢復改為 +70% HP 且無敵 +3 秒',
    apply: g => { g.mut.recoveryBoost = true; } },
  { id: 'b_overlord', classes: ['berserker'], tier: 'legendary', name: '黑暗領主', color: '#aa00aa',
    desc: '黑魂 +10 秒、月牙傷害 +100%、攻速 +20%',
    apply: g => {
      g.mut.darksoulDur = (g.mut.darksoulDur || 0) + 10;
      g.mut.darkmoonDmg = (g.mut.darkmoonDmg || 1) + 1.0;
      g.mut.attackSpeedMult = (g.mut.attackSpeedMult || 1) * 0.8;
    } },

  // ====================== 詛咒 ======================
  { id: 'glass_cannon', classes: 'all', tier: 'curse', name: '玻璃大砲',
    desc: '攻擊 +60%，HP -30%', color: '#ff3030',
    apply: g => {
      g.player.baseAttack = Math.floor(g.player.baseAttack * 1.6);
      g.player.maxHp = Math.floor(g.player.maxHp * 0.7);
      g.player.hp = Math.min(g.player.hp, g.player.maxHp);
      g.skills.applyAll(g.player);
    } },
  { id: 'magic_drain', classes: 'all', tier: 'curse', name: '魔法乾涸',
    desc: 'MP -50% 但技能傷害 +40%', color: '#aa30dd',
    apply: g => {
      g.player.maxMp = Math.floor(g.player.maxMp * 0.5);
      g.player.mp = Math.min(g.player.mp, g.player.maxMp);
      g.mut.skillDmgMult = (g.mut.skillDmgMult || 1) * 1.4;
    } },

  // ====================== 傳奇 ======================
  { id: 'leg_phoenix', classes: 'all', tier: 'legendary', name: '不死鳥之魂',
    desc: '死亡時自動復活一次（回滿）', color: '#ff8030',
    apply: g => { g.mut.phoenix = (g.mut.phoenix || 0) + 1; } }
];

const Cards = {
  draw(game, rng) {
    const r = rng || { next: Math.random, pick: arr => arr[Math.floor(Math.random()*arr.length)] };
    const wave = game.waveManager.current;
    const cls = game.player.classId;
    const rareChance = Math.min(0.6, 0.20 + wave * 0.04);
    const legChance  = Math.min(0.20, 0.02 + wave * 0.02);
    const curseChance = 0.12;

    const eligible = CARD_POOL.filter(c =>
      c.classes === 'all' || (Array.isArray(c.classes) && c.classes.includes(cls)));

    const draw1 = () => {
      const roll = r.next();
      let tier = 'common';
      if (roll < legChance) tier = 'legendary';
      else if (roll < legChance + rareChance) tier = 'rare';
      else if (roll < legChance + rareChance + curseChance) tier = 'curse';
      const pool = eligible.filter(c => c.tier === tier);
      return pool.length ? r.pick(pool) : null;
    };

    const cards = [];
    let tries = 0;
    while (cards.length < 3 && tries < 30) {
      tries++;
      const c = draw1();
      if (!c) continue;
      if (cards.find(x => x.id === c.id)) continue;
      cards.push(c);
    }
    // 補滿
    while (cards.length < 3) {
      const c = eligible[Math.floor(r.next() * eligible.length)];
      if (!cards.find(x => x.id === c.id)) cards.push(c);
    }
    return cards;
  },

  take(card, game) {
    card.apply(game);
    game.stats.recordCard(card.id);
    Utils.toast(`獲得：${card.name}`);
    AudioMgr.levelup();
    game.particles.levelup(game.player.x, game.player.y);
  }
};
