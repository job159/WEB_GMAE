/* ================================================================
 * ui.js
 * 全部介面：HUD + 建築 / 技能 / 商店 + 主選單 / 設定 / 控制 / 製作群 +
 *           職業選擇 + 卡牌選擇 + 存檔槽 + 死亡結算 + 成就
 * ================================================================ */
const UI = {

  init() {
    const $ = id => document.getElementById(id);
    this.el = {
      barHp: $('bar-hp'), barHpText: $('bar-hp-text'),
      barMp: $('bar-mp'), barMpText: $('bar-mp-text'),
      barSp: $('bar-sp'), barSpText: $('bar-sp-text'),
      barHg: $('bar-hg'), barHgText: $('bar-hg-text'),
      wood: $('ui-wood'), stone: $('ui-stone'), iron: $('ui-iron'), gold: $('ui-gold'),
      level: $('ui-level'), exp: $('ui-exp'), expNeed: $('ui-exp-need'),
      wave: $('ui-wave'), day: $('ui-day'), time: $('ui-time'),
      skillPt: $('ui-skill-pt'), kill: $('ui-kill'), score: $('ui-score'),
      combo: $('ui-combo'), bonus: $('ui-bonus'),
      questList: $('quest-list'), nextWave: $('next-wave-info'),
      hotbar: document.querySelectorAll('#hotbar .slot'),
      cdQ: $('cd-q'), cdR: $('cd-r'), cdV: $('cd-v'),
      nameQ: $('skill-q-name'), nameR: $('skill-r-name'), nameV: $('skill-v-name'),
      buildMenu: $('build-menu'), buildList: $('build-list'),
      skillPanel: $('skill-panel'), skillList: $('skill-list'), skillPoints: $('skill-points'),
      shopPanel: $('shop-panel'), shopList: $('shop-list'), shopGold: $('shop-gold'),
      pauseScreen: $('pause-screen'),
      mainMenu: $('main-menu'),
      settingsScreen: $('settings-screen'),
      controlsScreen: $('controls-screen'),
      creditsScreen: $('credits-screen'),
      classSelect: $('class-select'),
      classList: $('class-list'),
      saveSlots: $('save-slots'),
      saveList: $('save-list'),
      cardScreen: $('card-screen'),
      cardList: $('card-list'),
      cardWave: $('card-wave'),
      achievementsScreen: $('achievements-screen'),
      achievementsList: $('achievements-list'),
      achievementsCount: $('achievements-count'),
      deadScreen: $('dead-screen'), victoryScreen: $('victory-screen'),
      deadStats: $('dead-stats'), victoryStats: $('victory-stats'),
      modeBadge: $('mode-badge'),
      leaderboardScreen: $('leaderboard-screen'),
      leaderboardList: $('leaderboard-list'),
      cloudStatus: $('cloud-status'),
      btnLoginDiscord: $('btn-login-discord'),
      btnLoginGoogle: $('btn-login-google'),
      btnLogout: $('btn-logout'),
      btnRename: $('btn-rename')
    };
  },

  // ===== 雲端登入狀態列 =====
  refreshCloudStatus(user, profile) {
    const el = this.el.cloudStatus;
    if (el) {
      if (!user) {
        el.textContent = '未連線（僅本地存檔）';
        el.classList.remove('online', 'anon');
        this.el.btnLoginDiscord?.classList.remove('hidden');
        this.el.btnLoginGoogle?.classList.remove('hidden');
        this.el.btnLogout?.classList.add('hidden');
        this.el.btnRename?.classList.add('hidden');
      } else if (user.is_anonymous) {
        const nm = (typeof Cloud !== 'undefined' && Cloud.playerName) || profile?.display_name;
        el.textContent = nm ? `匿名玩家：${nm}（雲端已啟用）` : '匿名玩家（請先輸入名字）';
        el.classList.add('online'); el.classList.add('anon');
        this.el.btnLoginDiscord?.classList.remove('hidden');
        this.el.btnLoginGoogle?.classList.remove('hidden');
        this.el.btnLogout?.classList.add('hidden');
        this.el.btnRename?.classList.remove('hidden');
      } else {
        const name = profile?.display_name || user.email?.split('@')[0] || '玩家';
        el.textContent = `已登入：${name}`;
        el.classList.add('online'); el.classList.remove('anon');
        this.el.btnLoginDiscord?.classList.add('hidden');
        this.el.btnLoginGoogle?.classList.add('hidden');
        this.el.btnLogout?.classList.remove('hidden');
        this.el.btnRename?.classList.remove('hidden');
      }
    }
    // 匿名但還沒名字 → 在主選單跳出輸入框
    this.maybeAskName();
  },

  // 若是匿名玩家且還沒輸入名字，在主選單跳出輸入框
  maybeAskName() {
    if (typeof App === 'undefined' || App.state !== 'menu') return;
    if (typeof Cloud === 'undefined' || !Cloud.needsName || !Cloud.needsName()) return;
    if (this._namePromptOpen) return;
    this.askPlayerName(Cloud.playerName || '');
  },

  // 顯示「輸入名字」對話框，確認後寫入 Cloud；回傳 Promise<name|null>
  askPlayerName(prefill = '') {
    const modal = document.getElementById('name-modal');
    const input = document.getElementById('name-input');
    const btn = document.getElementById('name-confirm');
    if (!modal || !input || !btn) return Promise.resolve(null);
    this._namePromptOpen = true;
    input.value = prefill || '';
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 50);
    return new Promise(resolve => {
      const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
      const submit = async () => {
        const v = input.value.trim();
        if (!v) { input.focus(); return; }
        btn.removeEventListener('click', submit);
        input.removeEventListener('keydown', onKey);
        modal.classList.add('hidden');
        this._namePromptOpen = false;
        AudioMgr.click();
        if (typeof Cloud !== 'undefined' && Cloud.setPlayerName) await Cloud.setPlayerName(v);
        resolve(v);
      };
      btn.addEventListener('click', submit);
      input.addEventListener('keydown', onKey);
    });
  },

  // ===== 排行榜 =====
  async showLeaderboard(mode = 'normal') {
    this.el.leaderboardScreen?.classList.remove('hidden');
    this.el.leaderboardScreen.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
      b.onclick = () => { AudioMgr.click(); this.showLeaderboard(b.dataset.mode); };
    });
    const list = this.el.leaderboardList;
    list.innerHTML = '<p class="small">載入中...</p>';
    let scores = [];
    if (typeof Cloud !== 'undefined' && Cloud.client) {
      if (mode === 'daily') {
        scores = await Cloud.dailyScores(PRNG.todaySeed().label);
      } else {
        scores = await Cloud.topScores(mode, 100);
      }
    }
    if (!scores.length) {
      list.innerHTML = '<p class="small">還沒有人通關此模式</p>';
      return;
    }
    list.innerHTML = scores.map((s, i) => {
      const cls = CHAR_CLASSES[s.class_id]?.name || s.class_id;
      const m = Math.floor((s.duration_sec || 0) / 60);
      const sec = (s.duration_sec || 0) % 60;
      const dur = s.duration_sec ? `${m}:${String(sec).padStart(2,'0')}` : '-';
      const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      return `<div class="lb-row ${rankCls}">
        <span class="lb-rank">#${i + 1}</span>
        <span class="lb-name">${this.escapeHtml(s.display_name)}</span>
        <span class="lb-class">${cls}</span>
        <span class="lb-wave">第 ${s.wave} 波</span>
        <span class="lb-time">${dur}</span>
        <span class="lb-score">${(s.score || 0).toLocaleString()}</span>
      </div>`;
    }).join('');
  },

  escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  },

  setBar(elFill, elText, val, max) {
    if (!elFill) return;
    elFill.style.width = (val / max * 100) + '%';
    elText.textContent = Math.ceil(val) + '/' + Math.ceil(max);
  },

  update(game) {
    const p = game.player;
    this.setBar(this.el.barHp, this.el.barHpText, p.hp, p.maxHp);
    this.setBar(this.el.barMp, this.el.barMpText, p.mp, p.maxMp);
    this.setBar(this.el.barSp, this.el.barSpText, p.stamina, p.maxStamina);
    this.setBar(this.el.barHg, this.el.barHgText, p.hunger, p.maxHunger);
    this.el.wood.textContent = game.inventory.wood;
    this.el.stone.textContent = game.inventory.stone;
    this.el.iron.textContent = game.inventory.iron;
    this.el.gold.textContent = game.inventory.gold;
    this.el.level.textContent = p.level;
    this.el.exp.textContent = p.exp;
    this.el.expNeed.textContent = p.expNeed;
    this.el.wave.textContent = game.waveManager.current;
    this.el.day.textContent = game.day;
    this.el.time.textContent = game.isNight ? '夜晚' : '白天';
    this.el.skillPt.textContent = p.skillPoints;
    this.el.kill.textContent = game.killCount;
    this.el.score.textContent = game.score;
    this.el.combo.textContent = game.combo || 0;
    this.el.bonus.textContent = Math.min(50, (game.combo || 0));
    if (this.el.modeBadge) {
      this.el.modeBadge.textContent =
        game.stats.mode === 'daily' ? '每日挑戰' :
        game.stats.mode === 'ngplus' ? 'NG+' : '';
      this.el.modeBadge.classList.toggle('hidden', game.stats.mode === 'normal');
    }
    this.updateQuests(game);
    const wm = game.waveManager;
    if (wm.state === 'prepare') {
      this.el.nextWave.textContent = `第 ${wm.current} 波 倒數 ${Math.ceil(wm.timer)} 秒` +
                                     (wm.isBossWave(wm.current) ? ` (Boss)` : '');
      this.el.nextWave.style.color = '#ffaa33';
    } else {
      const alive = game.enemies.filter(e => e.alive).length + game.bosses.filter(b => b && b.alive).length;
      this.el.nextWave.textContent = `戰鬥中 ─ 剩餘 ${alive + wm.spawnQueue.length}`;
      this.el.nextWave.style.color = '#ff8080';
    }
    const slotName = { axe: '1', sword: '2', bow: '3' };
    this.el.hotbar.forEach(slot => {
      slot.classList.toggle('active', slot.dataset.slot === slotName[p.currentWeapon]);
    });
    this.updateCd('q', p, 4);
    this.updateCd('r', p, 12);
    this.updateCd('v', p, 20);
  },

  // 更新 hotbar 上的技能名稱（職業切換時）
  refreshSkillNames(classId) {
    const cls = CHAR_CLASSES[classId];
    if (!cls) return;
    if (this.el.nameQ) this.el.nameQ.textContent = SKILL_DEFS[cls.skills.q]?.name || '技能 1';
    if (this.el.nameR) this.el.nameR.textContent = SKILL_DEFS[cls.skills.r]?.name || '技能 2';
    if (this.el.nameV) this.el.nameV.textContent = SKILL_DEFS[cls.skills.v]?.name || '治癒';
    // 也更新武器槽位顯示
    this.refreshWeaponSlots(classId);
  },

  // 武器槽位名稱（依職業 3 階傳說武器）
  refreshWeaponSlots(classId) {
    const slots = [
      document.querySelector('#hotbar .slot[data-slot="1"] .name'),
      document.querySelector('#hotbar .slot[data-slot="2"] .name'),
      document.querySelector('#hotbar .slot[data-slot="3"] .name')
    ];
    const tiers = LEGENDARY_WEAPONS[classId] || [];
    const player = window.GAME?.player;
    for (let i = 0; i < 3; i++) {
      const el = slots[i];
      if (!el) continue;
      const w = tiers[i];
      if (!w) { el.textContent = '—'; continue; }
      const owned = player?.unlockedWeapons?.includes(w.id);
      el.textContent = owned ? w.name : `🔒 ${w.name}`;
    }
  },

  updateCd(key, player, totalCd) {
    const el = this.el['cd' + key.toUpperCase()];
    const slot = document.querySelector(`#hotbar .slot[data-skill="${key}"]`);
    if (!el || !slot) return;
    const cd = player.skillCd[key];
    if (cd > 0) {
      el.classList.add('on'); el.textContent = cd.toFixed(1);
      slot.classList.remove('ready');
    } else {
      el.classList.remove('on'); el.textContent = '';
      const cls = CHAR_CLASSES[player.classId];
      const skId = cls?.skills?.[key];
      const sk = SKILL_DEFS[skId];
      const costMult = (player.classMods?.skillCostMult || 1);
      slot.classList.toggle('ready', sk && player.mp >= sk.cost * costMult);
    }
  },

  updateQuests(game) {
    const list = this.el.questList;
    list.innerHTML = '';
    for (const q of game.quests) {
      const li = document.createElement('li');
      li.textContent = `${q.done ? '✓ ' : ''}${q.text}` +
                       (q.target > 1 ? ` (${q.progress}/${q.target})` : '');
      if (q.done) li.classList.add('done');
      list.appendChild(li);
    }
  },

  // ===== 武器圖鑑(原鍛造選單,改成等級自動解鎖)=====
  showForgeMenu(game) {
    this.el.buildMenu.classList.remove('hidden');
    // 把標題改成武器圖鑑
    const h2 = this.el.buildMenu.querySelector('h2');
    if (h2) h2.innerHTML = '傳說武器圖鑑　<small>(B 關閉 - 升級自動解鎖)</small>';
    const list = this.el.buildList;
    list.innerHTML = '';
    const tiers = LEGENDARY_WEAPONS[game.player.classId] || [];
    const playerLv = game.player.level;
    for (let i = 0; i < tiers.length; i++) {
      const w = tiers[i];
      const wcfg = WEAPONS[w.id] || {};
      const owned = game.player.unlockedWeapons.includes(w.id);
      const equipped = game.player.currentWeapon === w.id;
      const div = document.createElement('div');
      div.className = 'build-item';
      if (equipped) div.classList.add('selected');

      const unlockLv = w.unlockLv || 1;
      const lvStr = unlockLv > 1
        ? (owned
          ? `<span style="color:#6fdd6f">LV${unlockLv} 已解鎖</span>`
          : `<span style="color:#888">LV${unlockLv} 解鎖(目前 LV${playerLv})</span>`)
        : '<span style="color:#888">初始裝備</span>';

      const stateLabel =
        equipped ? '<span style="color:#ffd86b">★ 已裝備</span>' :
        owned    ? '<span style="color:#6fdd6f">✓ 點擊裝備</span>' :
                   '<span style="color:#aaa">尚未解鎖</span>';

      div.innerHTML = `
        <b>[Tier ${i + 1}] ${w.name}</b>　傷害 ${wcfg.damage || '?'}　${stateLabel}
        <div class="cost">${w.desc}</div>
        <div class="cost">${lvStr}</div>`;
      div.onclick = () => {
        if (owned) {
          if (!equipped) {
            game.player.currentWeapon = w.id;
            UI.refreshWeaponSlots(game.player.classId);
            Utils.toast(`裝備：${w.name}`);
            AudioMgr.click();
            this.showForgeMenu(game);
          }
        } else {
          Utils.toast(`需要 LV${unlockLv} 才能解鎖`);
          AudioMgr.deny();
        }
      };
      list.appendChild(div);
    }
  },
  showBuildMenu(game) { this.showForgeMenu(game); },  // 舊呼叫相容
  hideBuildMenu() { this.el.buildMenu?.classList.add('hidden'); },

  showSkillPanel(game) {
    this.el.skillPanel.classList.remove('hidden');
    this.el.skillPoints.textContent = game.player.skillPoints;
    const list = this.el.skillList;
    list.innerHTML = '';
    for (const s of game.skills.list) {
      const div = document.createElement('div');
      div.className = 'skill-item';
      const max = s.level >= s.max ? '<span class="lock">已滿</span>' : '';
      div.innerHTML = `<b>${s.name}</b> Lv ${s.level}/${s.max} ${max}<div class="cost">${s.desc}</div>`;
      div.onclick = () => { game.skills.upgrade(s.id, game.player); this.showSkillPanel(game); };
      list.appendChild(div);
    }
  },
  hideSkillPanel() { this.el.skillPanel?.classList.add('hidden'); },

  showShop(game) {
    this.el.shopPanel.classList.remove('hidden');
    this.el.shopGold.textContent = game.inventory.gold;
    const list = this.el.shopList;
    list.innerHTML = '';
    for (const item of ShopItems) {
      const cost = Shop.getCost(item, game.player);
      const lv = item.perm ? game.player.shopUpgrades[item.perm] : null;
      const div = document.createElement('div');
      div.className = 'shop-item';
      const lvTag = lv != null ? ` <span style="color:#aaa">(Lv ${lv})</span>` : '';
      const lock = game.inventory.gold >= cost ? '' : 'lock';
      div.innerHTML = `<b>${item.name}${lvTag}</b>
                      <div class="cost">${item.desc}　<span class="gold ${lock}">${cost} g</span></div>`;
      div.onclick = () => { Shop.buy(item.id, game); this.showShop(game); };
      list.appendChild(div);
    }
  },
  hideShop() { this.el.shopPanel?.classList.add('hidden'); },

  // ===== 主選單 / 子畫面 =====
  showMainMenu(show) {
    this.el.mainMenu?.classList.toggle('hidden', !show);
    if (show) { this.updateMainMenuButtons(); this.maybeAskName(); }
  },
  updateMainMenuButtons() {
    const btnContinue = document.getElementById('btn-continue');
    const btnDaily = document.getElementById('btn-daily');
    const btnNg = document.getElementById('btn-ngplus');
    if (btnContinue) {
      const has = Save.hasAny();
      btnContinue.disabled = !has;
      btnContinue.style.opacity = has ? '1' : '0.5';
    }
    if (btnDaily) {
      const t = PRNG.todaySeed().label;
      const done = Meta.data.dailyDone[t];
      btnDaily.textContent = done ? `今日已完成 (${done}分)` : `今日挑戰 ${t}`;
    }
    if (btnNg) {
      btnNg.disabled = !Meta.data.ngPlus;
      btnNg.style.opacity = Meta.data.ngPlus ? '1' : '0.5';
      btnNg.title = Meta.data.ngPlus ? '' : '通關任一職業後解鎖';
    }
  },

  showSettings(show) { this.el.settingsScreen?.classList.toggle('hidden', !show); if (show) this.renderSettings(); },
  showControls(show) { this.el.controlsScreen?.classList.toggle('hidden', !show); },
  showCredits(show) { this.el.creditsScreen?.classList.toggle('hidden', !show); },

  renderSettings() {
    // 把目前的音量寫到 slider
    document.getElementById('vol-master').value = Math.round(AudioMgr.master * 100);
    document.getElementById('vol-master-v').textContent = Math.round(AudioMgr.master * 100);
    document.getElementById('vol-sfx').value = Math.round(AudioMgr.sfx * 100);
    document.getElementById('vol-sfx-v').textContent = Math.round(AudioMgr.sfx * 100);
    document.getElementById('shake-intensity').value = Math.round((Settings.shakeMult || 1) * 100);
    document.getElementById('shake-v').textContent = Math.round((Settings.shakeMult || 1) * 100);
    document.getElementById('particle-quality').value = Settings.particleQuality || 'high';
    document.getElementById('damage-numbers').checked = Settings.showDamage !== false;
    document.getElementById('colorblind-mode').checked = !!Settings.colorblind;
  },

  // ===== 職業選擇 =====
  showClassSelect(show) { this.el.classSelect?.classList.toggle('hidden', !show); if (show) this.renderClasses(); },
  renderClasses() {
    const list = this.el.classList;
    list.innerHTML = '';
    for (const key of CLASS_LIST) {
      const cls = CHAR_CLASSES[key];
      const card = document.createElement('div');
      card.className = 'class-card';
      card.style.borderColor = cls.color;
      const cleared = Meta.data.classesCleared.includes(key) ? ' ★' : '';
      card.innerHTML = `
        <div class="class-header" style="background:linear-gradient(180deg, ${cls.color}, ${cls.accent})">
          <h3>${cls.name}${cleared}</h3>
          <div class="class-title">${cls.title}</div>
        </div>
        <p class="class-desc">${cls.desc}</p>
        <div class="class-stats">
          HP ${cls.starting.maxHp}　MP ${cls.starting.maxMp}<br>
          攻擊 ${cls.starting.baseAttack}　防禦 ${cls.starting.baseDefense}<br>
          初始武器：${WEAPONS[cls.starting.weapon].name}
        </div>
        <button class="select-btn" style="background:${cls.color}">選擇</button>`;
      card.querySelector('button').onclick = () => {
        AudioMgr.click();
        App.startGameWithClass(key, App.pendingMode || 'normal');
      };
      list.appendChild(card);
    }
  },

  // ===== 存檔槽 =====
  showSaveSlots(show, mode = 'load') {
    this.el.saveSlots?.classList.toggle('hidden', !show);
    if (show) this.renderSaveSlots(mode);
  },
  async renderSaveSlots(mode) {
    const list = this.el.saveList;
    list.innerHTML = '<p class="small">載入中...</p>';
    const slots = await Save.list();
    list.innerHTML = '';
    for (const slot of slots) {
      const div = document.createElement('div');
      div.className = 'save-slot ' + (slot.empty ? 'empty' : '');
      if (slot.empty) {
        div.innerHTML = `<b>存檔 ${slot.slot}${slot.slot === 0 ? '（自動）' : ''}</b><div class="cost">空</div>`;
      } else {
        const d = new Date(slot.time);
        const cls = CHAR_CLASSES[slot.classId];
        const src = slot.source === 'cloud' ? '<span class="cloud-tag">☁ 雲端</span>' : '<span class="local-tag">本地</span>';
        div.innerHTML = `<b>存檔 ${slot.slot}${slot.slot === 0 ? '（自動）' : ''} ${src}</b>
          <div class="cost">${cls?.name || ''}　第 ${slot.wave} 波　Lv ${slot.level}　${slot.score}分<br>
          ${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}</div>`;
      }
      div.onclick = async () => {
        if (mode === 'load') {
          if (slot.empty) return;
          AudioMgr.click();
          App.loadSlot(slot.slot);
        } else {
          AudioMgr.click();
          Save.save(window.GAME, slot.slot);
          await this.renderSaveSlots(mode);
        }
      };
      list.appendChild(div);
    }
  },

  // ===== 卡牌選擇（含預覽與確認按鈕，避免誤觸）=====
  showCardChoice(game) {
    this.el.cardScreen?.classList.remove('hidden');
    this.el.cardWave.textContent = game.waveManager.current;
    this._selectedCard = null;
    this._renderCardChoice(game);
  },

  _renderCardChoice(game) {
    const list = this.el.cardList;
    list.innerHTML = '';
    // 三張卡
    for (const card of game.pendingCards) {
      const div = document.createElement('div');
      div.className = 'card-item tier-' + card.tier;
      if (this._selectedCard?.id === card.id) div.classList.add('selected');
      div.style.borderColor = card.color;
      div.innerHTML = `
        <div class="card-tier" style="color:${card.color}">${this.tierLabel(card.tier)}</div>
        <h3>${card.name}</h3>
        <p>${card.desc}</p>
        <div class="card-pick-hint">${this._selectedCard?.id === card.id ? '✓ 已選擇' : '點擊選擇'}</div>`;
      div.onclick = () => {
        this._selectedCard = card;
        AudioMgr.click();
        this._renderCardChoice(game);
      };
      list.appendChild(div);
    }

    // 確認列
    const row = document.createElement('div');
    row.className = 'card-confirm-row';
    if (this._selectedCard) {
      row.innerHTML = `
        <div class="card-confirm-info">已選：<b style="color:${this._selectedCard.color}">${this._selectedCard.name}</b> — ${this._selectedCard.desc}</div>
        <button id="btn-card-confirm" class="confirm-btn">確認選擇</button>`;
    } else {
      row.innerHTML = `<div class="card-confirm-info dim">請點選一張卡牌</div>
        <button id="btn-card-confirm" class="confirm-btn" disabled>確認選擇</button>`;
    }
    list.appendChild(row);

    const btn = row.querySelector('#btn-card-confirm');
    if (btn && this._selectedCard) {
      btn.onclick = () => {
        const c = this._selectedCard;
        this._selectedCard = null;
        game.pickCard(c);
      };
    }
  },
  tierLabel(t) {
    return { common: '◆ 普通', rare: '◆◆ 稀有', curse: '☠ 詛咒', legendary: '★ 傳奇' }[t] || t;
  },
  hideCardChoice() { this.el.cardScreen?.classList.add('hidden'); },

  // ===== 成就 =====
  showAchievements(show) { this.el.achievementsScreen?.classList.toggle('hidden', !show); if (show) this.renderAchievements(); },
  renderAchievements() {
    const list = this.el.achievementsList;
    list.innerHTML = '';
    const unlocked = Meta.data.unlocked;
    this.el.achievementsCount.textContent = `${unlocked.length} / ${ACHIEVEMENTS.length}`;
    for (const a of ACHIEVEMENTS) {
      const div = document.createElement('div');
      const ok = unlocked.includes(a.id);
      div.className = 'ach-item ' + (ok ? 'unlocked' : '');
      div.innerHTML = `<b>${ok ? '✓' : '🔒'} ${a.name}</b><div class="cost">${a.desc}</div>`;
      list.appendChild(div);
    }
  },

  // ===== 暫停 / 死亡 / 勝利 =====
  showPause(show) { this.el.pauseScreen?.classList.toggle('hidden', !show); },
  showDead(show, game) {
    this.el.deadScreen?.classList.toggle('hidden', !show);
    if (show && game) this.el.deadStats.innerHTML = this.buildStatsHTML(game);
  },
  showVictory(show, game) {
    this.el.victoryScreen?.classList.toggle('hidden', !show);
    if (show && game) this.el.victoryStats.innerHTML = this.buildStatsHTML(game);
  },

  buildStatsHTML(game) {
    const s = game.stats.summary();
    const m = Math.floor(s.time / 60);
    const sec = s.time % 60;
    return `
      <div class="stat-grid">
        <div><b>波次</b><br>${game.waveManager.current} / 15</div>
        <div><b>分數</b><br>${game.score}</div>
        <div><b>時間</b><br>${m}:${String(sec).padStart(2,'0')}</div>
        <div><b>擊殺</b><br>${s.kills}</div>
        <div><b>Boss 擊敗</b><br>${s.bosses}</div>
        <div><b>最高連擊</b><br>${s.maxCombo}</div>
        <div><b>造成傷害</b><br>${s.damageDealt}</div>
        <div><b>受到傷害</b><br>${s.damageTaken}</div>
        <div><b>採集</b><br>${s.gather}</div>
        <div><b>金幣賺</b><br>${s.goldEarned}</div>
        <div><b>金幣花</b><br>${s.goldSpent}</div>
        <div><b>建造</b><br>${s.builds}</div>
        <div><b>卡牌</b><br>${s.cards}</div>
        <div><b>無傷波</b><br>${s.flawless}</div>
      </div>
      <div class="skill-spend">
        <b>技能使用次數：</b>
        ${['q','r','v'].map(k => {
          const cls = CHAR_CLASSES[game.stats.classId];
          const name = SKILL_DEFS[cls?.skills?.[k]]?.name || k.toUpperCase();
          return `<span>${name}: ${game.stats.skillCasts[k] || 0}</span>`;
        }).join(' ')}
      </div>`;
  },

  hideAllOverlays() {
    ['buildMenu','skillPanel','shopPanel','pauseScreen','mainMenu',
     'settingsScreen','controlsScreen','creditsScreen','classSelect',
     'saveSlots','cardScreen','achievementsScreen','deadScreen','victoryScreen','leaderboardScreen']
      .forEach(k => this.el[k]?.classList.add('hidden'));
  }
};

// 全域設定（音量在 AudioMgr 內）
const Settings = {
  shakeMult: 1.0,
  particleQuality: 'high',
  showDamage: true,
  colorblind: false,

  save() {
    try {
      localStorage.setItem('game-settings-v1', JSON.stringify({
        shakeMult: this.shakeMult,
        particleQuality: this.particleQuality,
        showDamage: this.showDamage,
        colorblind: this.colorblind
      }));
    } catch(e){}
  },
  load() {
    try {
      const raw = localStorage.getItem('game-settings-v1');
      if (raw) Object.assign(this, JSON.parse(raw));
    } catch(e){}
  }
};
