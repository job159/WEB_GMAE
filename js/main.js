/* ================================================================
 * main.js
 * 入口
 * ================================================================ */
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');

  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(640, Math.min(1920, Math.floor(rect.width)));
    const h = Math.max(400, Math.min(1200, Math.floor(rect.height)));
    canvas.width = w;
    canvas.height = h;
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  UI.init();
  Input.init(canvas);

  const game = new Game(canvas);
  window.GAME = game;

  document.getElementById('btn-start').onclick = () => {
    AudioMgr.init(); AudioMgr.click();
    game.reset(); game.start();
  };
  document.getElementById('btn-load').onclick = () => {
    AudioMgr.init(); AudioMgr.click();
    if (!Save.hasSave()) { Utils.toast('沒有存檔'); return; }
    game.reset();
    Save.load(game);
    game.start();
  };
  document.getElementById('btn-restart').onclick = () => {
    AudioMgr.click();
    game.reset(); game.start();
  };
  document.getElementById('btn-restart-win').onclick = () => {
    AudioMgr.click();
    game.reset(); game.start();
  };

  // 點下方快捷欄
  document.querySelectorAll('#hotbar .slot').forEach(slot => {
    slot.onclick = () => {
      AudioMgr.click();
      const s = slot.dataset.slot;
      const sk = slot.dataset.skill;
      if (s === '1') game.player.currentWeapon = 'axe';
      else if (s === '2') game.player.currentWeapon = 'sword';
      else if (s === '3') game.player.currentWeapon = 'bow';
      else if (s === 'B') { game.uiBuildOpen = !game.uiBuildOpen;
        game.uiBuildOpen ? UI.showBuildMenu(game) : UI.hideBuildMenu(); }
      else if (s === 'T') { game.uiSkillOpen = !game.uiSkillOpen;
        game.uiSkillOpen ? UI.showSkillPanel(game) : UI.hideSkillPanel(); }
      else if (s === 'N') { game.uiShopOpen = !game.uiShopOpen;
        game.uiShopOpen ? UI.showShop(game) : UI.hideShop(); }
      if (sk) ActiveSkills.cast(sk, game);
    };
  });

  // 全域熱鍵
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'p' && (game.state === 'playing' || game.state === 'paused')) {
      game.togglePause();
    }
    if (k === 'escape') {
      if (game.uiBuildOpen) { game.uiBuildOpen = false; UI.hideBuildMenu(); game.placingBuild = false; }
      if (game.uiSkillOpen) { game.uiSkillOpen = false; UI.hideSkillPanel(); }
      if (game.uiShopOpen) { game.uiShopOpen = false; UI.hideShop(); }
    }
  });

  game.lastTime = performance.now();
  requestAnimationFrame((t) => game.loop(t));
});
