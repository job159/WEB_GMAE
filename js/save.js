/* ================================================================
 * save.js
 * localStorage 存讀檔（包含 Mana、商店升級、分數）
 * ================================================================ */
const Save = {
  KEY: 'survival-outpost-save-v2',

  save(game) {
    try {
      const p = game.player;
      const data = {
        version: 2,
        time: Date.now(),
        player: {
          x: p.x, y: p.y,
          hp: p.hp, maxHp: p.maxHp,
          mp: p.mp, maxMp: p.maxMp,
          stamina: p.stamina, hunger: p.hunger,
          level: p.level, exp: p.exp, expNeed: p.expNeed,
          baseAttack: p.baseAttack, baseDefense: p.baseDefense,
          speed: p.speed,
          skillPoints: p.skillPoints,
          currentWeapon: p.currentWeapon,
          shopUpgrades: p.shopUpgrades
        },
        inventory: { ...game.inventory },
        skills: {},
        buildings: game.buildings.filter(b => b.alive).map(b => ({
          type: b.type, x: b.x, y: b.y, hp: b.hp
        })),
        wave: game.waveManager.current,
        day: game.day,
        isNight: game.isNight,
        timeOfDay: game.timeOfDay,
        score: game.score,
        killCount: game.killCount,
        quests: game.quests.map(q => ({ id: q.id, done: q.done, progress: q.progress }))
      };
      for (const s of game.skills.list) data.skills[s.id] = s.level;

      localStorage.setItem(this.KEY, JSON.stringify(data));
      Utils.toast('已存檔');
      AudioMgr.click();
      return true;
    } catch (err) {
      console.error('Save error', err);
      Utils.toast('存檔失敗');
      return false;
    }
  },

  hasSave() { return !!localStorage.getItem(this.KEY); },

  load(game) {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) { Utils.toast('沒有存檔'); return false; }
      const data = JSON.parse(raw);

      Object.assign(game.player, data.player);
      if (data.player.shopUpgrades) game.player.shopUpgrades = data.player.shopUpgrades;

      game.inventory = { wood: 0, stone: 0, iron: 0, gold: 0, food: 0, ...data.inventory };

      for (const s of game.skills.list) {
        if (data.skills && data.skills[s.id] != null) s.level = data.skills[s.id];
      }
      game.skills.applyAll(game.player);
      game.player.applyShopUpgrades();

      game.buildings = data.buildings.map(b => new Building(b.type, b.x, b.y, b.hp));

      game.waveManager.current = data.wave || 1;
      game.waveManager.state = 'prepare';
      game.waveManager.timer = 5;
      game.day = data.day || 1;
      game.isNight = !!data.isNight;
      game.timeOfDay = data.timeOfDay || 0;
      game.score = data.score || 0;
      game.killCount = data.killCount || 0;

      if (data.quests) {
        for (const sq of data.quests) {
          const q = game.quests.find(x => x.id === sq.id);
          if (q) { q.done = sq.done; q.progress = sq.progress || 0; }
        }
      }

      Utils.toast('已讀檔');
      AudioMgr.click();
      return true;
    } catch (err) {
      console.error('Load error', err);
      Utils.toast('讀檔失敗');
      return false;
    }
  },

  clear() { localStorage.removeItem(this.KEY); }
};
