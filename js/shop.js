/* ================================================================
 * shop.js
 * 商店：消耗品、材料包、永久升級
 * 永久升級用 player.shopUpgrades 計數
 * ================================================================ */
const ShopItems = [
  // 消耗品
  { id: 'pot_hp',  name: '治療藥水',   cost: 50,  desc: '回復 40 HP',
    effect: g => { g.player.hp = Math.min(g.player.maxHp, g.player.hp + 40);
                   g.particles.heal(g.player.x, g.player.y); } },
  { id: 'pot_mp',  name: '魔力藥水',   cost: 60,  desc: '回復 50 MP',
    effect: g => { g.player.mp = Math.min(g.player.maxMp, g.player.mp + 50);
                   g.particles.spark(g.player.x, g.player.y, 12, '#6aa6ff'); } },
  { id: 'pot_sp',  name: '體力藥水',   cost: 30,  desc: '回復 50 體力',
    effect: g => { g.player.stamina = Math.min(g.player.maxStamina, g.player.stamina + 50); } },
  { id: 'pot_food',name: '乾糧',       cost: 25,  desc: '回復 50 飢餓',
    effect: g => { g.player.hunger = Math.min(100, g.player.hunger + 50); } },

  // 材料包
  { id: 'pack_w',  name: '木材包',     cost: 40,  desc: '+25 木材',
    effect: g => { g.inventory.wood += 25; } },
  { id: 'pack_s',  name: '石頭包',     cost: 60,  desc: '+25 石頭',
    effect: g => { g.inventory.stone += 25; } },
  { id: 'pack_i',  name: '鐵礦包',     cost: 120, desc: '+15 鐵礦',
    effect: g => { g.inventory.iron += 15; } },

  // 技能點
  { id: 'sk_pt',   name: '技能點',     cost: 250, desc: '+1 技能點',
    effect: g => { g.player.skillPoints += 1; } },

  // 永久強化（會漲價）
  { id: 'up_hp',   name: '永久 HP+20', cost: 200, desc: '永久增加 20 最大 HP', perm: 'maxHp' },
  { id: 'up_mp',   name: '永久 MP+20', cost: 200, desc: '永久增加 20 最大 MP', perm: 'maxMp' },
  { id: 'up_atk',  name: '永久攻擊+5', cost: 250, desc: '永久增加 5 攻擊力',   perm: 'attack' },
  { id: 'up_def',  name: '永久防禦+3', cost: 250, desc: '永久增加 3 防禦力',   perm: 'defense' }
];

const Shop = {

  // 取得當前售價（永久強化每層漲 50%）
  getCost(item, player) {
    if (item.perm) {
      const lv = player.shopUpgrades[item.perm] || 0;
      return Math.round(item.cost * Math.pow(1.5, lv));
    }
    return item.cost;
  },

  buy(itemId, game) {
    const item = ShopItems.find(x => x.id === itemId);
    if (!item) return false;
    if (game.waveManager.state !== 'prepare') {
      Utils.toast('戰鬥中無法交易');
      AudioMgr.deny();
      return false;
    }
    const cost = this.getCost(item, game.player);
    if (game.inventory.gold < cost) { Utils.toast('金幣不足'); AudioMgr.deny(); return false; }
    game.inventory.gold -= cost;

    if (item.perm) {
      game.player.shopUpgrades[item.perm] = (game.player.shopUpgrades[item.perm] || 0) + 1;
      game.player.applyShopUpgrades();
      game.skills.applyAll(game.player);
      Utils.toast(`已強化：${item.name}`);
    } else {
      item.effect(game);
      Utils.toast(`已購買：${item.name}`);
    }
    AudioMgr.buy();
    return true;
  }
};
