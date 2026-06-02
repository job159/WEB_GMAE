/* ================================================================
 * charClass.js
 * 3 種職業：法師 / 弓手 / 狂戰士
 * ================================================================ */
const CHAR_CLASSES = {
  mage: {
    id: 'mage',
    name: '法師',
    title: '隕石主宰',
    desc: '揮舞隕石杖，普攻射出可怕魔粒子。\n隕石術與冰封新星近乎全螢幕特效。',
    color: '#b06aff',
    accent: '#dca6ff',
    starting: {
      maxHp: 80, maxMp: 200, maxStamina: 80, maxHunger: 100,
      baseAttack: 10, baseDefense: 0, speed: 200,
      weapon: 'meteorStaff',
      mods: { skillCostMult: 0.75, skillDmgMult: 1.3, mpRegen: 10 }
    },
    skills: { q: 'm_meteor', r: 'm_frost', v: 'm_spring' }
  },
  archer: {
    id: 'archer',
    name: '弓手',
    title: '荒野獵神',
    desc: '揮舞巨弓射出大型箭矢。\n冰巨箭附魔時普攻變 5 倍大冰箭、命中凍結。',
    color: '#5cdb5c',
    accent: '#aaffaa',
    starting: {
      maxHp: 100, maxMp: 130, maxStamina: 130, maxHunger: 100,
      baseAttack: 12, baseDefense: 2, speed: 220,
      weapon: 'giantbow',
      mods: { rangedMult: 1.3, attackSpeedMult: 0.8 }
    },
    skills: { q: 'a_storm', r: 'a_ice', v: 'a_embrace' }
  },
  berserker: {
    id: 'berserker',
    name: '狂戰士',
    title: '吞噬者',
    desc: '揮舞 3 倍身形巨砍刀，每一斬皆帶衝擊波。\n黑魂月牙、狂熱倍速、血祭斬撕裂半屏。',
    color: '#3a0a3a',
    accent: '#cc3030',
    starting: {
      maxHp: 150, maxMp: 60, maxStamina: 130, maxHunger: 100,
      baseAttack: 18, baseDefense: 4, speed: 180,
      weapon: 'cleaver',
      mods: { meleeMult: 1.4, rangedMult: 0.4 }
    },
    skills: { q: 'b_darksoul', r: 'b_frenzy', v: 'b_recovery' }
  }
};

const CLASS_LIST = ['mage', 'archer', 'berserker'];

/* ===== 傳說武器：每職業 3 階（初始 / 中階鍛造 / 高階鍛造）===== */
const LEGENDARY_WEAPONS = {
  mage: [
    { id: 'meteorStaff',  name: '隕石杖',   desc: '初始武器：魔粒子',
      cost: null },
    { id: 'skyburnStaff', name: '焚天杖',   desc: '焰魔粒子帶範圍爆炸 + 技能 +40%',
      cost: { wood: 30, stone: 20, gold: 350 } },
    { id: 'genesisStaff', name: '創世神杖', desc: '虛空黑洞魔粒子 + 技能 +80%、CD -25%',
      cost: { stone: 50, iron: 35, gold: 900 } }
  ],
  archer: [
    { id: 'giantbow',  name: '巨弓',     desc: '初始武器：大型金箭',
      cost: null },
    { id: 'stormBow',  name: '風暴弓',   desc: '每次射出 3 道箭、傷害 +50%',
      cost: { wood: 40, iron: 15, gold: 350 } },
    { id: 'frostBow',  name: '永凍弓',   desc: '所有箭自動凍結、傷害 +100%',
      cost: { wood: 50, iron: 35, gold: 900 } }
  ],
  berserker: [
    { id: 'cleaver',      name: '巨砍刀',     desc: '初始武器：揮砍衝擊波',
      cost: null },
    { id: 'bloodCleaver', name: '血飲砍刀',   desc: '擊中回血 +6、傷害 +50%',
      cost: { stone: 30, iron: 20, gold: 400 } },
    { id: 'doomCleaver',  name: '末日砍刀',   desc: '每揮砍噴月牙、傷害 +100%',
      cost: { stone: 60, iron: 40, gold: 1000 } }
  ]
};
