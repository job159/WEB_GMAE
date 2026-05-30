/* ================================================================
 * input.js
 * 鍵盤、滑鼠輸入
 * 第一次互動時自動初始化 Web Audio
 * ================================================================ */
const Input = {
  keys: {},
  keysPressed: {},
  mouse: { x: 0, y: 0, worldX: 0, worldY: 0, down: false, pressed: false, rightDown: false },

  init(canvas) {
    this.canvas = canvas;

    const wake = () => AudioMgr.init();

    window.addEventListener('keydown', (e) => {
      wake();
      const k = e.key.toLowerCase();
      if (!this.keys[k]) this.keysPressed[k] = true;
      this.keys[k] = true;
      if (['w','a','s','d',' ','q','r','v','e','b','t','n','f','l','p','1','2','3'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * sx;
      this.mouse.y = (e.clientY - rect.top) * sy;
    });
    canvas.addEventListener('mousedown', (e) => {
      wake();
      if (e.button === 0) {
        if (!this.mouse.down) this.mouse.pressed = true;
        this.mouse.down = true;
      } else if (e.button === 2) {
        this.mouse.rightDown = true;
      }
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  endFrame() {
    this.keysPressed = {};
    this.mouse.pressed = false;
  },

  updateMouseWorld(camera) {
    this.mouse.worldX = this.mouse.x + camera.x;
    this.mouse.worldY = this.mouse.y + camera.y;
  },

  isDown(key) { return !!this.keys[key.toLowerCase()]; },
  wasPressed(key) { return !!this.keysPressed[key.toLowerCase()]; }
};
