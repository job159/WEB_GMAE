/* ================================================================
 * utils.js
 * 共用工具函式：數學、隨機、向量、文字、繪圖輔助
 * ================================================================ */
const Utils = {

  distance(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  distanceSq(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return dx * dx + dy * dy;
  },

  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },
  randomRange(min, max) { return Math.random() * (max - min) + min; },
  randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  angle(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },
  lerp(a, b, t) { return a + (b - a) * t; },
  chance(p) { return Math.random() < p; },
  jitter(r) { return (Math.random() - 0.5) * 2 * r; },

  // 平滑緩動
  easeOut(t) { return 1 - (1 - t) * (1 - t); },
  easeIn(t)  { return t * t; },
  easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },

  // 角度差規範
  angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  },

  // 矩形血條（加圓角 + 漸層）
  drawHpBar(ctx, x, y, w, h, ratio, fg = '#5dd55d', bg = '#5b1d1d') {
    ctx.fillStyle = bg;
    Utils.roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = fg;
    const fw = w * Utils.clamp(ratio, 0, 1);
    if (fw > 0) {
      Utils.roundRect(ctx, x, y, fw, h, h / 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1;
    Utils.roundRect(ctx, x, y, w, h, h / 2); ctx.stroke();
  },

  // 圓角矩形 path
  roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  // 帶描邊文字
  strokeText(ctx, text, x, y, fill = '#fff', stroke = '#000', lineW = 3) {
    ctx.lineWidth = lineW;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  },

  // 發光圓
  drawGlowCircle(ctx, x, y, r, color, alpha = 0.6) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  // toast 小提示（底部）
  toast(msg, ms = 1500) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(Utils._toastTimer);
    Utils._toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  },

  // 大字中央提示（升級、Boss 出現）
  bigToast(msg, ms = 1800) {
    const el = document.getElementById('big-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(Utils._bigToastTimer);
    Utils._bigToastTimer = setTimeout(() => el.classList.remove('show'), ms);
  },

  worldToScreen(wx, wy, camera) {
    return { x: wx - camera.x, y: wy - camera.y };
  },

  // 顏色插值，用於漸變
  rgb(r, g, b, a = 1) { return `rgba(${r|0},${g|0},${b|0},${a})`; }
};
