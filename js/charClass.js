/* ================================================================
 * charClass.js
 * 3 種職業 + 每職業 3 個專屬技能（Q / R / V，V 為治癒類）
 * ================================================================ */
const CHAR_CLASSES = {
  warrior: {
    id: 'warrior',
    name: '戰士',
    title: '荒野鬥士',
    desc: '近戰王者。狂暴斬擊橫掃 + 大地震動破壞 + 血怒之力強化。',
    color: '#d04040',
    accent: '#ff7050',
    starting: {
      maxHp: 130, maxMp: 80, maxStamina: 110, maxHunger: 100,
      baseAttack: 14, baseDefense: 5, speed: 200,
      weapon: 'sword',
      mods: { meleeMult: 1.25, rangedMult: 0.8 }
    },
    skills: { q: 'w_slash', r: 'w_quake', v: 'w_fury' }
  },
  mage: {
    id: 'mage',
    name: '法師',
    title: '元素操縱者',
    desc: '法術之神。隕石雨 + 冰封新星 + 生命之泉。技能消耗 -25%。',
    color: '#b06aff',
    accent: '#dca6ff',
    starting: {
      maxHp: 75, maxMp: 180, maxStamina: 80, maxHunger: 100,
      baseAttack: 8, baseDefense: 0, speed: 195,
      weapon: 'bow',
      mods: { skillCostMult: 0.75, skillDmgMult: 1.25, mpRegen: 8 }
    },
    skills: { q: 'm_meteor', r: 'm_frost', v: 'm_spring' }
  },
  archer: {
    id: 'archer',
    name: '弓手',
    title: '荒野獵人',
    desc: '遠程獵神。箭矢風暴 + 雷霆穿心 + 獵人之擁（隱身加速）。',
    color: '#5cdb5c',
    accent: '#aaffaa',
    starting: {
      maxHp: 100, maxMp: 110, maxStamina: 130, maxHunger: 100,
      baseAttack: 12, baseDefense: 2, speed: 230,
      weapon: 'bow',
      mods: { rangedMult: 1.3, attackSpeedMult: 0.75 }
    },
    skills: { q: 'a_storm', r: 'a_pierce', v: 'a_embrace' }
  }
};

const CLASS_LIST = ['warrior', 'mage', 'archer'];
