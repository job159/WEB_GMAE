/* ================================================================
 * touch.js
 * 觸控控制：左下虛擬搖桿（移動）+ 右下攻擊按鈕 + 右側技能按鈕
 * 只在偵測到觸控裝置時顯示
 * ================================================================ */
const Touch = {
  enabled: false,
  joystick: { active: false, baseX: 0, baseY: 0, dx: 0, dy: 0, id: null },
  attack: { active: false, id: null },
  skillButtons: { q: false, r: false, g: false, v: false, x: false, c: false },
  init() {
    // 偵測觸控
    if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;
    this.enabled = true;
    document.body.classList.add('touch-mode');

    const overlay = document.getElementById('touch-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');

    // 搖桿
    const jb = document.getElementById('joystick-base');
    const jk = document.getElementById('joystick-knob');
    jb.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.joystick.id = t.identifier;
      const rect = jb.getBoundingClientRect();
      this.joystick.baseX = rect.left + rect.width / 2;
      this.joystick.baseY = rect.top + rect.height / 2;
      this.joystick.active = true;
      this.updateJoystick(t.clientX, t.clientY, jk);
    });
    document.addEventListener('touchmove', (e) => {
      if (!this.joystick.active) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystick.id) {
          this.updateJoystick(t.clientX, t.clientY, jk);
        }
      }
    }, { passive: false });
    document.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystick.id) {
          this.joystick.active = false;
          this.joystick.dx = this.joystick.dy = 0;
          jk.style.transform = 'translate(-50%, -50%)';
        }
        if (t.identifier === this.attack.id) {
          this.attack.active = false;
        }
      }
    });

    // 攻擊按鈕
    const atk = document.getElementById('touch-attack');
    atk.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.attack.id = e.changedTouches[0].identifier;
      this.attack.active = true;
    });

    // 技能按鈕
    for (const k of ['q', 'r', 'g', 'v', 'x', 'c']) {
      const btn = document.getElementById('touch-' + k);
      if (!btn) continue;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.skillButtons[k] = true;
        if (window.GAME) ActiveSkills.cast(k, GAME);
      });
    }

    // 隱藏 / 顯示按鈕
    document.getElementById('btn-touch-build')?.addEventListener('touchstart', e => {
      e.preventDefault();
      if (window.GAME) {
        GAME.uiBuildOpen = !GAME.uiBuildOpen;
        GAME.uiBuildOpen ? UI.showBuildMenu(GAME) : UI.hideBuildMenu();
      }
    });
    document.getElementById('btn-touch-shop')?.addEventListener('touchstart', e => {
      e.preventDefault();
      if (window.GAME) {
        GAME.uiShopOpen = !GAME.uiShopOpen;
        GAME.uiShopOpen ? UI.showShop(GAME) : UI.hideShop();
      }
    });
  },

  updateJoystick(cx, cy, jk) {
    let dx = cx - this.joystick.baseX;
    let dy = cy - this.joystick.baseY;
    const max = 50;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > max) { dx = dx / mag * max; dy = dy / mag * max; }
    this.joystick.dx = dx / max;
    this.joystick.dy = dy / max;
    jk.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  },

  // 把搖桿值寫進 Input.keys 模擬 WASD
  feedInput() {
    if (!this.enabled) return;
    if (this.joystick.active) {
      const { dx, dy } = this.joystick;
      Input.keys['w'] = dy < -0.3;
      Input.keys['s'] = dy >  0.3;
      Input.keys['a'] = dx < -0.3;
      Input.keys['d'] = dx >  0.3;
    } else {
      // 不動就鬆開
      if (!this._wasdHeld()) {
        Input.keys['w'] = Input.keys['s'] = Input.keys['a'] = Input.keys['d'] = false;
      }
    }
    if (this.attack.active) Input.mouse.down = true;
    // 攻擊方向：往螢幕中央朝搖桿方向
    if (this.joystick.active && window.GAME) {
      const g = GAME;
      Input.mouse.worldX = g.player.x + this.joystick.dx * 200;
      Input.mouse.worldY = g.player.y + this.joystick.dy * 200;
    }
  },

  _wasdHeld() {
    return Input.keys['w'] || Input.keys['a'] || Input.keys['s'] || Input.keys['d'];
  }
};
