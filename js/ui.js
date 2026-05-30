/* ================================================================
 * ui.js
 * 更新 HUD、任務、快捷欄、建築選單、技能面板、商店
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
      cdQ: $('cd-q'), cdR: $('cd-r'), cdG: $('cd-g'), cdV: $('cd-v'),
      cdX: $('cd-x'), cdC: $('cd-c'),
      buildMenu: $('build-menu'), buildList: $('build-list'),
      skillPanel: $('skill-panel'), skillList: $('skill-list'), skillPoints: $('skill-points'),
      shopPanel: $('shop-panel'), shopList: $('shop-list'), shopGold: $('shop-gold'),
      pauseScreen: $('pause-screen'), startScreen: $('start-screen'),
      deadScreen: $('dead-screen'), deadWave: $('dead-wave'),
      deadKill: $('dead-kill'), deadScore: $('dead-score'),
      victoryScreen: $('victory-screen'), victoryScore: $('victory-score')
    };
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
    const bonus = Math.min(50, (game.combo || 0));
    this.el.bonus.textContent = bonus;

    this.updateQuests(game);

    const wm = game.waveManager;
    if (wm.state === 'prepare') {
      this.el.nextWave.textContent = `第 ${wm.current} 波 倒數 ${Math.ceil(wm.timer)} 秒` +
                                     (wm.isBossWave(wm.current) ? '（Boss）' : '');
      this.el.nextWave.style.color = '#ffaa33';
    } else {
      const alive = game.enemies.filter(e => e.alive).length + (game.boss && game.boss.alive ? 1 : 0);
      this.el.nextWave.textContent = `戰鬥中 ─ 剩餘 ${alive + wm.spawnQueue.length}`;
      this.el.nextWave.style.color = '#ff8080';
    }

    // 武器高亮
    const slotName = { axe: '1', sword: '2', bow: '3' };
    this.el.hotbar.forEach(slot => {
      slot.classList.toggle('active', slot.dataset.slot === slotName[p.currentWeapon]);
    });

    // 主動技能冷卻
    this.updateCd('q', p, 4);
    this.updateCd('r', p, 12);
    this.updateCd('g', p, 7);
    this.updateCd('v', p, 20);
    this.updateCd('x', p, 6);
    this.updateCd('c', p, 8);
  },

  updateCd(key, player, totalCd) {
    const el = this.el['cd' + key.toUpperCase()];
    const slot = document.querySelector(`#hotbar .slot[data-skill="${key}"]`);
    if (!el || !slot) return;
    const cd = player.skillCd[key];
    if (cd > 0) {
      el.classList.add('on');
      el.textContent = cd.toFixed(1);
      slot.classList.remove('ready');
    } else {
      el.classList.remove('on');
      el.textContent = '';
      // ready 亮顯示
      const sk = ACTIVE_SKILLS[key];
      slot.classList.toggle('ready', player.mp >= sk.cost);
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

  showBuildMenu(game) {
    this.el.buildMenu.classList.remove('hidden');
    const list = this.el.buildList;
    list.innerHTML = '';
    for (const key of Object.keys(BUILDING_TYPES)) {
      const cfg = BUILDING_TYPES[key];
      const div = document.createElement('div');
      div.className = 'build-item';
      if (game.selectedBuild === key) div.classList.add('selected');
      const parts = [];
      for (const [k, v] of Object.entries(cfg.cost)) {
        const have = game.inventory[k] || 0;
        const cls = have >= v ? '' : ' lock';
        parts.push(`<span class="${cls}">${k} ${v}</span>`);
      }
      div.innerHTML = `<b>${cfg.name}</b>　HP ${cfg.hp}<div class="cost">材料：${parts.join('  ')}</div>`;
      div.onclick = () => {
        game.selectedBuild = key;
        game.placingBuild = true;
        AudioMgr.click();
        this.showBuildMenu(game);
        Utils.toast(`選擇：${cfg.name}　按左鍵放置`);
      };
      list.appendChild(div);
    }
  },
  hideBuildMenu() { this.el.buildMenu.classList.add('hidden'); },

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
      div.onclick = () => {
        game.skills.upgrade(s.id, game.player);
        this.showSkillPanel(game);
      };
      list.appendChild(div);
    }
  },
  hideSkillPanel() { this.el.skillPanel.classList.add('hidden'); },

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
      div.onclick = () => {
        Shop.buy(item.id, game);
        this.showShop(game);
      };
      list.appendChild(div);
    }
  },
  hideShop() { this.el.shopPanel.classList.add('hidden'); },

  showPause(show) { this.el.pauseScreen.classList.toggle('hidden', !show); },
  showStart(show) { this.el.startScreen.classList.toggle('hidden', !show); },
  showDead(show, wave, kill, score) {
    this.el.deadScreen.classList.toggle('hidden', !show);
    if (show) {
      this.el.deadWave.textContent = wave;
      this.el.deadKill.textContent = kill;
      this.el.deadScore.textContent = score;
    }
  },
  showVictory(show, score) {
    this.el.victoryScreen.classList.toggle('hidden', !show);
    if (show) this.el.victoryScore.textContent = score;
  }
};
