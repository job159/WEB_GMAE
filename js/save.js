/* ================================================================
 * save.js
 * 多存檔槽 (3 個手動 + 1 個自動) + 簡易簽章（防 F12 修改）
 * Key: survival-outpost-save-v3-slotN
 * ================================================================ */
const Save = {
  PREFIX: 'survival-outpost-save-v3-slot',
  SLOTS: [0, 1, 2, 3],   // 0 = autosave，1/2/3 = 手動

  // 簡易混淆雜湊（不是強加密，只擋 F12 玩家）
  hash(str) {
    let h = 1779033703;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0).toString(36);
  },

  key(slot) { return this.PREFIX + slot; },

  // 全部 slot 的摘要（用於 UI）— 含雲端合併
  async list() {
    const local = this.SLOTS.map(slot => {
      const raw = localStorage.getItem(this.key(slot));
      if (!raw) return { slot, empty: true };
      try {
        const wrap = JSON.parse(raw);
        const data = wrap.d;
        return {
          slot,
          empty: false,
          time: data.time,
          wave: data.wave,
          day: data.day,
          score: data.score,
          classId: data.player?.classId || 'warrior',
          level: data.player?.level || 1,
          mode: data.mode || 'normal',
          auto: slot === 0,
          source: 'local'
        };
      } catch (e) { return { slot, empty: true, broken: true }; }
    });

    if (typeof Cloud === 'undefined' || !Cloud.user) return local;

    // 拉雲端，比較 updated_at，新的覆蓋舊的
    try {
      const cloud = await Cloud.listCloudSaves();
      const byId = {};
      for (const s of local) byId[s.slot] = s;
      for (const c of cloud) {
        const cloudInfo = {
          slot: c.slot, empty: false,
          time: new Date(c.updated_at).getTime(),
          wave: c.wave, day: 0, score: c.score,
          classId: c.class_id, level: c.level,
          mode: c.mode, auto: c.slot === 0,
          source: 'cloud'
        };
        const localInfo = byId[c.slot];
        if (!localInfo || localInfo.empty || cloudInfo.time > localInfo.time) {
          byId[c.slot] = cloudInfo;
        }
      }
      return Object.values(byId).sort((a, b) => a.slot - b.slot);
    } catch (e) {
      console.warn(e); return local;
    }
  },

  serialize(game) {
    const p = game.player;
    return {
      version: 3,
      time: Date.now(),
      mode: game.stats.mode,
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
        classId: p.classId,
        unlockedWeapons: p.unlockedWeapons || ['axe', 'sword', 'bow']
      },
      inventory: { ...game.inventory },
      skills: Object.fromEntries(game.skills.list.map(s => [s.id, s.level])),
      buildings: game.buildings.filter(b => b.alive).map(b => ({
        type: b.type, x: b.x, y: b.y, hp: b.hp
      })),
      mutations: { ...game.mut },
      wave: game.waveManager.current,
      day: game.day,
      isNight: game.isNight,
      timeOfDay: game.timeOfDay,
      score: game.score,
      killCount: game.killCount,
      seed: game.seed,
      quests: game.quests.map(q => ({ id: q.id, done: q.done, progress: q.progress }))
    };
  },

  save(game, slot = 1) {
    try {
      const data = this.serialize(game);
      const json = JSON.stringify(data);
      localStorage.setItem(this.key(slot), JSON.stringify({ d: data, s: this.hash(json) }));
      // 雲端背景上傳（best effort，不阻塞、失敗不影響）
      const cloud = (typeof Cloud !== 'undefined' && Cloud.user);
      if (cloud) Cloud.saveToCloud(slot, game).catch(e => console.warn(e));
      if (slot === 0) Utils.toast('已自動存檔' + (cloud ? '（本地 + 雲端）' : '（本地）'));
      else Utils.toast(`存檔 ${slot}：完成` + (cloud ? '（本地 + 雲端）' : ''));
      AudioMgr.click();
      return true;
    } catch (err) {
      console.error(err); Utils.toast('存檔失敗'); return false;
    }
  },

  autosave(game) {
    return this.save(game, 0);
  },

  // 對外的 load 介面：優先雲端，雲端沒有/逾時再退回本地
  async load(game, slot = 1) {
    if (typeof Cloud !== 'undefined' && Cloud.user) {
      try {
        // 雲端讀取最多等 5 秒，逾時就退回本地，避免網路卡住時整個遊戲卡在「載入中」
        const ok = await Promise.race([
          Cloud.loadFromCloud(slot, game),
          new Promise(res => setTimeout(() => res(null), 5000))
        ]);
        if (ok) { Utils.toast(`雲端讀檔 ${slot}`); AudioMgr.click(); return true; }
      } catch (e) { console.warn('[Save] 雲端讀檔失敗，改用本地', e); }
    }
    return this.loadLocal(game, slot);
  },

  // 純本地讀檔（保留原本邏輯）
  loadLocal(game, slot = 1) {
    try {
      const raw = localStorage.getItem(this.key(slot));
      if (!raw) { Utils.toast('沒有存檔'); return false; }
      const wrap = JSON.parse(raw);
      const data = wrap.d;
      const expectHash = wrap.s;
      const realHash = this.hash(JSON.stringify(data));
      if (expectHash !== realHash) {
        Utils.toast('存檔損毀'); return false;
      }
      this.applyToGame(game, data);
      Utils.toast(`本地讀檔 ${slot}`);
      AudioMgr.click();
      return true;
    } catch (err) {
      console.error(err); Utils.toast('讀檔失敗'); return false;
    }
  },

  applyToGame(game, data) {
    // 先依存檔職業套用「外型 + classMods + 基礎屬性」,再用存檔數值覆蓋
    if (data.player?.classId && game.player.applyClass) {
      game.player.applyClass(data.player.classId);
    }
    Object.assign(game.player, data.player);
    if (data.player.classId) game.player.classId = data.player.classId;
    game.player.unlockedWeapons = data.player.unlockedWeapons || ['axe', 'sword', 'bow'];
    // 讀檔後檢查等級對應的傳說武器是否需要自動解鎖
    if (game.player.checkAutoUnlock) game.player.checkAutoUnlock(null);

    game.inventory = { wood: 0, stone: 0, iron: 0, gold: 0, food: 0, ...data.inventory };
    for (const s of game.skills.list) {
      if (data.skills && data.skills[s.id] != null) s.level = data.skills[s.id];
    }
    game.skills.applyAll(game.player);

    game.buildings = (data.buildings || []).map(b => new Building(b.type, b.x, b.y, b.hp));
    game.mut = data.mutations || {};

    game.waveManager.current = data.wave || 1;
    game.waveManager.state = 'prepare';
    game.waveManager.timer = 8;
    game.day = data.day || 1;
    game.isNight = !!data.isNight;
    game.timeOfDay = data.timeOfDay || 0;
    game.score = data.score || 0;
    game.killCount = data.killCount || 0;
    game.seed = data.seed;
    game.stats.mode = data.mode || 'normal';

    if (data.quests) {
      for (const sq of data.quests) {
        const q = game.quests.find(x => x.id === sq.id);
        if (q) { q.done = sq.done; q.progress = sq.progress || 0; }
      }
    }
  },

  delete(slot) {
    localStorage.removeItem(this.key(slot));
    Utils.toast(`存檔 ${slot} 已刪除`);
  },

  hasAny() { return this.list().some(s => !s.empty); }
};
