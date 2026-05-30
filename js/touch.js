/* ================================================================
 * touch.js
 * 觸控控制 — 修正版
 * 重點修正：
 *   ❌ 舊 bug：鬆開搖桿後玩家還在走（feedInput 條件式沒重置 WASD）
 *   ❌ 舊 bug：鬆開攻擊鍵後 mouse.down 持續 true
 *   ✅ 新邏輯：每 frame 先把所有 input 歸零，再依當前按住狀態重新設定
 *   ✅ 加 touchcancel 監聽（瀏覽器強制取消觸控時也能清乾淨）
 *   ✅ 視覺回饋：按下時 .active class、放大光暈
 *   ✅ 技能鍵已縮為 Q/R/V（之前 6 顆）
 * ================================================================ */
const Touch = {
  enabled: false,
  // 搖桿狀態
  joystick: { active: false, dx: 0, dy: 0, id: null, baseX: 0, baseY: 0 },
  // 攻擊鍵狀態
  attack:   { active: false, id: null },

  init() {
    // 偵測觸控裝置
    if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;
    this.enabled = true;
    document.body.classList.add('touch-mode');

    const overlay = document.getElementById('touch-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');

    this.setupJoystick();
    this.setupAttack();
    this.setupSkillButtons();
    this.setupExtraButtons();

    // 防止頁面捲動 / 縮放
    document.addEventListener('touchmove', (e) => {
      if (e.target.closest('#game-container')) e.preventDefault();
    }, { passive: false });
  },

  // ===== 搖桿 =====
  setupJoystick() {
    const jb = document.getElementById('joystick-base');
    const jk = document.getElementById('joystick-knob');
    if (!jb || !jk) return;

    const onStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.changedTouches[0];
      this.joystick.id = t.identifier;
      const rect = jb.getBoundingClientRect();
      this.joystick.baseX = rect.left + rect.width / 2;
      this.joystick.baseY = rect.top + rect.height / 2;
      this.joystick.active = true;
      jb.classList.add('active');
      this.updateJoystick(t.clientX, t.clientY, jk);
    };

    const onMove = (e) => {
      if (!this.joystick.active) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystick.id) {
          e.preventDefault();
          this.updateJoystick(t.clientX, t.clientY, jk);
        }
      }
    };

    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystick.id) this.releaseJoystick();
      }
    };

    jb.addEventListener('touchstart',  onStart, { passive: false });
    document.addEventListener('touchmove',   onMove,  { passive: false });
    document.addEventListener('touchend',    onEnd,   { passive: false });
    document.addEventListener('touchcancel', onEnd,   { passive: false });
  },

  releaseJoystick() {
    this.joystick.active = false;
    this.joystick.id = null;
    this.joystick.dx = 0;
    this.joystick.dy = 0;
    const jk = document.getElementById('joystick-knob');
    const jb = document.getElementById('joystick-base');
    if (jk) jk.style.transform = 'translate(-50%, -50%)';
    if (jb) jb.classList.remove('active');
    // 立刻把 WASD 鍵清空（雙保險，feedInput 也會清）
    if (Input.keys) {
      Input.keys['w'] = false;
      Input.keys['a'] = false;
      Input.keys['s'] = false;
      Input.keys['d'] = false;
    }
  },

  updateJoystick(cx, cy, jk) {
    let dx = cx - this.joystick.baseX;
    let dy = cy - this.joystick.baseY;
    const max = 55;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > max) { dx = dx / mag * max; dy = dy / mag * max; }
    this.joystick.dx = dx / max;
    this.joystick.dy = dy / max;
    jk.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  },

  // ===== 攻擊鍵 =====
  setupAttack() {
    const atk = document.getElementById('touch-attack');
    if (!atk) return;

    const onStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      atk.classList.add('active');
      this.attack.id = e.changedTouches[0].identifier;
      this.attack.active = true;
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.attack.id) this.releaseAttack();
      }
    };

    atk.addEventListener('touchstart',  onStart, { passive: false });
    document.addEventListener('touchend',    onEnd,   { passive: false });
    document.addEventListener('touchcancel', onEnd,   { passive: false });
  },

  releaseAttack() {
    this.attack.active = false;
    this.attack.id = null;
    const atk = document.getElementById('touch-attack');
    if (atk) atk.classList.remove('active');
    if (Input.mouse) Input.mouse.down = false;
  },

  // ===== 技能鍵（Q / R / V）=====
  setupSkillButtons() {
    for (const k of ['q', 'r', 'v']) {
      const btn = document.getElementById('touch-' + k);
      if (!btn) continue;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('active');
        if (window.GAME) ActiveSkills.cast(k, GAME);
        // 視覺回饋 250ms
        setTimeout(() => btn.classList.remove('active'), 250);
      }, { passive: false });
    }
  },

  // ===== 額外按鈕（鍛造 / 商店 / 暫停 / 衝刺）=====
  setupExtraButtons() {
    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('active');
        try { fn(); } catch (err) { console.warn(err); }
        setTimeout(() => el.classList.remove('active'), 250);
      }, { passive: false });
    };

    bind('btn-touch-build', () => {
      if (!window.GAME) return;
      GAME.uiBuildOpen = !GAME.uiBuildOpen;
      GAME.uiBuildOpen ? UI.showForgeMenu(GAME) : UI.hideBuildMenu();
    });
    bind('btn-touch-shop', () => {
      if (!window.GAME) return;
      GAME.uiShopOpen = !GAME.uiShopOpen;
      GAME.uiShopOpen ? UI.showShop(GAME) : UI.hideShop();
    });
    bind('btn-touch-skills', () => {
      if (!window.GAME) return;
      GAME.uiSkillOpen = !GAME.uiSkillOpen;
      GAME.uiSkillOpen ? UI.showSkillPanel(GAME) : UI.hideSkillPanel();
    });
    bind('btn-touch-dash', () => {
      // 模擬按一下空白鍵
      Input.keysPressed[' '] = true;
    });
    bind('btn-touch-pause', () => {
      if (window.GAME) GAME.togglePause();
    });
    bind('btn-touch-gather', () => {
      // 採集：按下 E 一次（feedInput 後續會清掉）
      Input.keys['e'] = true;
      setTimeout(() => { if (Input.keys) Input.keys['e'] = false; }, 250);
    });
  },

  // ===== 每 frame 從 game loop 呼叫 =====
  feedInput() {
    if (!this.enabled) return;

    // ★ 關鍵修正：每 frame 都先清空 WASD，再依當前搖桿狀態決定
    Input.keys['w'] = false;
    Input.keys['a'] = false;
    Input.keys['s'] = false;
    Input.keys['d'] = false;

    if (this.joystick.active) {
      const { dx, dy } = this.joystick;
      if (dy < -0.3) Input.keys['w'] = true;
      if (dy >  0.3) Input.keys['s'] = true;
      if (dx < -0.3) Input.keys['a'] = true;
      if (dx >  0.3) Input.keys['d'] = true;

      // 攻擊瞄準：沿搖桿方向（200 px 前方）
      if (window.GAME) {
        Input.mouse.worldX = GAME.player.x + dx * 220;
        Input.mouse.worldY = GAME.player.y + dy * 220;
      }
    }

    // ★ 關鍵修正：mouse.down 完全反映 attack.active 當下狀態
    Input.mouse.down = this.attack.active;
  }
};
