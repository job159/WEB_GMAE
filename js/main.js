/* ================================================================
 * main.js
 * App 狀態機：splash → menu → classSelect → playing
 * 處理主選單 / 設定 / 控制 / 製作群按鈕
 * ================================================================ */
const App = {
  state: 'splash',
  pendingMode: 'normal',
  game: null,

  go(state) { this.state = state; this.applyView(); },

  applyView() {
    UI.hideAllOverlays();
    switch (this.state) {
      case 'menu': UI.showMainMenu(true); break;
      case 'classSelect': UI.showClassSelect(true); break;
      case 'settings': UI.showSettings(true); break;
      case 'controls': UI.showControls(true); break;
      case 'credits': UI.showCredits(true); break;
      case 'saveLoad': UI.showSaveSlots(true, 'load'); break;
      case 'achievements': UI.showAchievements(true); break;
      case 'leaderboard': UI.showLeaderboard('normal'); break;
    }
  },

  startGameWithClass(classId, mode) {
    this.game.startNewRun(classId, mode);
    UI.refreshSkillNames(classId);
  },

  loadSlot(slot) {
    this.game.startNewRun('warrior', 'normal');
    Save.load(this.game, slot);
    UI.refreshSkillNames(this.game.player.classId);
    this.game.state = 'playing';
    UI.hideAllOverlays();
  }
};

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');

  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', fitCanvas);

  AudioMgr.loadSettings();
  Settings.load();
  Meta.load();

  UI.init();
  Input.init(canvas);
  if (typeof Touch !== 'undefined') Touch.init();

  // 雲端初始化（會自動匿名登入）
  if (typeof Cloud !== 'undefined') Cloud.init();

  const game = new Game(canvas);
  window.GAME = game;
  App.game = game;

  // ===== 主選單按鈕 =====
  const $on = (id, evt, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(evt, fn); };

  $on('btn-new-game', 'click', () => { AudioMgr.click(); App.pendingMode = 'normal'; App.go('classSelect'); });
  $on('btn-continue', 'click', () => { AudioMgr.click(); App.go('saveLoad'); });
  $on('btn-daily', 'click', () => { AudioMgr.click(); App.pendingMode = 'daily'; App.go('classSelect'); });
  $on('btn-ngplus', 'click', () => {
    AudioMgr.click();
    if (!Meta.data.ngPlus) { Utils.toast('需先通關一次'); return; }
    App.pendingMode = 'ngplus'; App.go('classSelect');
  });
  $on('btn-settings', 'click', () => { AudioMgr.click(); App.go('settings'); });
  $on('btn-controls', 'click', () => { AudioMgr.click(); App.go('controls'); });
  $on('btn-credits', 'click', () => { AudioMgr.click(); App.go('credits'); });
  $on('btn-achievements', 'click', () => { AudioMgr.click(); App.go('achievements'); });
  $on('btn-leaderboard', 'click', () => { AudioMgr.click(); App.go('leaderboard'); });

  // ===== 雲端登入 =====
  $on('btn-login-discord', 'click', () => { AudioMgr.click(); Cloud.loginDiscord?.(); });
  $on('btn-login-google',  'click', () => { AudioMgr.click(); Cloud.loginGoogle?.(); });
  $on('btn-logout', 'click', async () => {
    AudioMgr.click();
    await Cloud.logout?.();
    Utils.toast('已登出，切回匿名');
  });
  $on('btn-rename', 'click', async () => {
    AudioMgr.click();
    const cur = Cloud.playerName || Cloud.profile?.display_name || '';
    const name = await UI.askPlayerName(cur);
    if (name) Utils.toast('名字已更新：' + name);
  });

  // 返回按鈕
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => { AudioMgr.click(); App.go('menu'); });
  });

  // ===== 暫停選單 =====
  $on('btn-resume', 'click', () => { AudioMgr.click(); game.resume(); });
  $on('btn-pause-settings', 'click', () => { AudioMgr.click(); UI.showSettings(true); });
  $on('btn-pause-menu', 'click', () => {
    AudioMgr.click(); game.state = 'start';
    UI.showPause(false); App.go('menu');
  });
  $on('btn-pause-save', 'click', () => { AudioMgr.click(); UI.showSaveSlots(true, 'save'); });

  // ===== 死亡 / 勝利 =====
  $on('btn-restart', 'click', () => { AudioMgr.click(); App.go('classSelect'); });
  $on('btn-restart-win', 'click', () => { AudioMgr.click(); App.go('classSelect'); });
  $on('btn-dead-menu', 'click', () => { AudioMgr.click(); UI.showDead(false); App.go('menu'); });
  $on('btn-win-menu', 'click', () => { AudioMgr.click(); UI.showVictory(false); App.go('menu'); });

  // ===== 設定頁 =====
  $on('vol-master', 'input', e => {
    AudioMgr.master = e.target.value / 100;
    document.getElementById('vol-master-v').textContent = e.target.value;
    AudioMgr.saveSettings();
  });
  $on('vol-sfx', 'input', e => {
    AudioMgr.sfx = e.target.value / 100;
    document.getElementById('vol-sfx-v').textContent = e.target.value;
    AudioMgr.saveSettings();
  });
  $on('shake-intensity', 'input', e => {
    Settings.shakeMult = e.target.value / 100;
    document.getElementById('shake-v').textContent = e.target.value;
    Settings.save();
  });
  $on('particle-quality', 'change', e => {
    Settings.particleQuality = e.target.value;
    if (e.target.value === 'low') game.particles.max = 200;
    else if (e.target.value === 'medium') game.particles.max = 500;
    else game.particles.max = 900;
    Settings.save();
  });
  $on('damage-numbers', 'change', e => {
    Settings.showDamage = e.target.checked;
    Settings.save();
  });
  $on('colorblind-mode', 'change', e => {
    Settings.colorblind = e.target.checked;
    document.body.classList.toggle('colorblind', e.target.checked);
    Settings.save();
  });

  // ===== Hotbar 點擊 =====
  document.querySelectorAll('#hotbar .slot').forEach(slot => {
    slot.onclick = () => {
      AudioMgr.click();
      const s = slot.dataset.slot;
      const sk = slot.dataset.skill;
      const tiers = LEGENDARY_WEAPONS[game.player.classId] || [];
      if (s === '1' && tiers[0] && game.player.unlockedWeapons.includes(tiers[0].id)) game.player.currentWeapon = tiers[0].id;
      else if (s === '2' && tiers[1] && game.player.unlockedWeapons.includes(tiers[1].id)) game.player.currentWeapon = tiers[1].id;
      else if (s === '3' && tiers[2] && game.player.unlockedWeapons.includes(tiers[2].id)) game.player.currentWeapon = tiers[2].id;
      if (s === 'B') { game.uiBuildOpen = !game.uiBuildOpen;
        game.uiBuildOpen ? UI.showForgeMenu(game) : UI.hideBuildMenu(); }
      else if (s === 'T') { game.uiSkillOpen = !game.uiSkillOpen;
        game.uiSkillOpen ? UI.showSkillPanel(game) : UI.hideSkillPanel(); }
      else if (s === 'N') { game.uiShopOpen = !game.uiShopOpen;
        game.uiShopOpen ? UI.showShop(game) : UI.hideShop(); }
      if (sk) ActiveSkills.cast(sk, game);
    };
  });

  // ===== 全域熱鍵 =====
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'p' && (game.state === 'playing' || game.state === 'paused')) game.togglePause();
    if (k === 'escape') {
      if (game.uiBuildOpen) { game.uiBuildOpen = false; UI.hideBuildMenu(); game.placingBuild = false; }
      else if (game.uiSkillOpen) { game.uiSkillOpen = false; UI.hideSkillPanel(); }
      else if (game.uiShopOpen) { game.uiShopOpen = false; UI.hideShop(); }
      else if (['settings','controls','credits','saveLoad','achievements','leaderboard'].includes(App.state)) App.go('menu');
    }
  });

  // ===== 啟動：splash 已在 HTML 顯示，800ms 後切到主選單 =====
  setTimeout(() => {
    document.getElementById('splash')?.classList.add('hidden');
    App.go('menu');
  }, 800);

  game.lastTime = performance.now();
  requestAnimationFrame((t) => game.loop(t));

  // 註冊 Service Worker（PWA）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
});
