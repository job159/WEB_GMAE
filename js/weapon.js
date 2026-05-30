/* ================================================================
 * weapon.js
 * 武器資料定義
 * ================================================================ */
const WEAPONS = {
  axe: {
    id: 'axe', name: '斧頭', type: 'melee',
    damage: 12, range: 52, arc: Math.PI * 0.6,
    cooldown: 0.42, staminaCost: 4,
    color: '#cf7e3a', gatherBonus: { tree: 2 }
  },
  sword: {
    id: 'sword', name: '鐵劍', type: 'melee',
    damage: 22, range: 64, arc: Math.PI * 0.5,
    cooldown: 0.50, staminaCost: 6,
    color: '#dcdcdc', gatherBonus: {}
  },
  bow: {
    id: 'bow', name: '弓箭', type: 'ranged',
    damage: 18, range: 400, cooldown: 0.65, staminaCost: 5,
    color: '#8a5a2b', projectileSpeed: 640,
    gatherBonus: {}
  }
};

const WEAPON_SLOTS = ['axe', 'sword', 'bow'];
