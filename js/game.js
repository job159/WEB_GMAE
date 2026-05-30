/* ================================================================
 * game.js
 * 遊戲主體：狀態 / 主迴圈 / 更新 / 繪製 / 鏡頭 / 震動 / 商店
 * ================================================================ */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'start';

    this.mapW = 2800;
    this.mapH = 2000;
    this.camera = { x: 0, y: 0, tx: 0, ty: 0 };

    this.player = new Player(this.mapW / 2, this.mapH / 2);
    this.skills = new SkillSystem();
    this.skills.applyAll(this.player);

    this.enemies = [];
    this.projectiles = [];
    this.resources = [];
    this.buildings = [];
    this.boss = null;

    this.inventory = { wood: 0, stone: 0, iron: 0, gold: 0, food: 0 };
    this.waveManager = new WaveManager();

    this.timeOfDay = 0;
    this.dayLength = 140;
    this.day = 1;
    this.isNight = false;

    this.placingBuild = false;
    this.selectedBuild = null;
    this.uiBuildOpen = false;
    this.uiSkillOpen = false;
    this.uiShopOpen = false;

    this.quests = this.buildInitialQuests();
    this.killCount = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;

    this.particles = new ParticleSystem(800);

    // 地圖裝飾（草、花），純視覺
    this.decor = this.generateDecor();

    this.spawnInitialResources();

    this.shakeIntensity = 0;
    this.shakeTime = 0;

    this.lastTime = performance.now();
  }

  buildInitialQuests() {
    return [
      { id: 'wood', text: '收集 50 木材', target: 50, progress: 0, done: false },
      { id: 'build', text: '建造 3 個防禦', target: 3, progress: 0, done: false },
      { id: 'wave5', text: '擊敗第 5 波 Boss', target: 1, progress: 0, done: false },
      { id: 'skill3', text: '升技能到 3 級', target: 1, progress: 0, done: false },
      { id: 'wave15', text: '撐過第 15 波', target: 1, progress: 0, done: false },
      { id: 'final', text: '擊敗最終 Boss', target: 1, progress: 0, done: false }
    ];
  }

  generateDecor() {
    const list = [];
    for (let i = 0; i < 220; i++) {
      list.push({
        x: Utils.randomRange(0, this.mapW),
        y: Utils.randomRange(0, this.mapH),
        type: Utils.chance(0.75) ? 'grass' : 'flower',
        size: Utils.randomRange(2, 4),
        hue: Utils.randomInt(0, 360)
      });
    }
    return list;
  }

  spawnInitialResources() {
    this.resources = [];
    const ratios = { tree: 100, rock: 60, iron: 30, bush: 40, chest: 10 };
    for (const [type, count] of Object.entries(ratios)) {
      for (let i = 0; i < count; i++) {
        for (let tries = 0; tries < 20; tries++) {
          const x = Utils.randomRange(80, this.mapW - 80);
          const y = Utils.randomRange(80, this.mapH - 80);
          if (Utils.distance(x, y, this.player.x, this.player.y) < 100) continue;
          let ok = true;
          for (const r of this.resources) {
            if (Utils.distance(x, y, r.x, r.y) < r.radius + 20) { ok = false; break; }
          }
          if (ok) {
            this.resources.push(new ResourceNode(type, x, y));
            break;
          }
        }
      }
    }
  }

  reset() {
    const shop = this.player ? this.player.shopUpgrades : { maxHp: 0, maxMp: 0, attack: 0, defense: 0 };
    this.player = new Player(this.mapW / 2, this.mapH / 2);
    this.player.shopUpgrades = shop;  // 永久強化跨局保留
    this.player.applyShopUpgrades();
    this.skills = new SkillSystem();
    this.skills.applyAll(this.player);
    this.enemies = [];
    this.projectiles = [];
    this.buildings = [];
    this.boss = null;
    this.inventory = { wood: 0, stone: 0, iron: 0, gold: 0, food: 0 };
    this.waveManager = new WaveManager();
    this.timeOfDay = 0;
    this.day = 1;
    this.isNight = false;
    this.killCount = 0;
    this.score = 0;
    this.combo = 0;
    this.particles.clear();
    this.quests = this.buildInitialQuests();
    this.spawnInitialResources();
    UI.showDead(false);
    UI.showVictory(false);
    UI.showStart(false);
    UI.hideShop();
    UI.hideBuildMenu();
    UI.hideSkillPanel();
    this.uiBuildOpen = this.uiSkillOpen = this.uiShopOpen = false;
    this.placingBuild = false;
    this.selectedBuild = null;
    this.state = 'playing';
  }

  start() {
    this.state = 'playing';
    UI.showStart(false);
  }
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; UI.showPause(true); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; UI.showPause(false); }
  togglePause() { this.state === 'playing' ? this.pause() : this.resume(); }
  win()  { this.state = 'victory'; UI.showVictory(true, this.score); AudioMgr.victory(); this.markQuestDone('final'); }
  die()  { this.state = 'dead'; UI.showDead(true, this.waveManager.current, this.killCount, this.score); AudioMgr.defeat(); }

  shake(intensity = 5, duration = 0.2) {
    if (intensity > this.shakeIntensity) {
      this.shakeIntensity = intensity;
      this.shakeTime = duration;
    }
  }

  markQuestDone(id) {
    const q = this.quests.find(x => x.id === id);
    if (q && !q.done) {
      q.done = true; q.progress = q.target;
      Utils.toast(`任務完成：${q.text}`);
      this.score += 50;
    }
  }
  updateQuests() {
    const qw = this.quests.find(q => q.id === 'wood');
    if (qw && !qw.done) {
      qw.progress = Math.min(qw.target, this.inventory.wood);
      if (qw.progress >= qw.target) this.markQuestDone('wood');
    }
    const qb = this.quests.find(q => q.id === 'build');
    if (qb && !qb.done) {
      const defCount = this.buildings.filter(b =>
        b.alive && ['wall_wood','wall_stone','tower','trap'].includes(b.type)).length;
      qb.progress = Math.max(qb.progress, defCount);
      if (qb.progress >= qb.target) this.markQuestDone('build');
    }
    const qs = this.quests.find(q => q.id === 'skill3');
    if (qs && !qs.done) {
      if (this.skills.list.some(s => s.level >= 3)) this.markQuestDone('skill3');
    }
    const q15 = this.quests.find(q => q.id === 'wave15');
    if (q15 && !q15.done && this.waveManager.current >= 15) this.markQuestDone('wave15');
    const q5 = this.quests.find(q => q.id === 'wave5');
    if (q5 && !q5.done && this.waveManager.current > 5) this.markQuestDone('wave5');
  }

  loop(now) {
    const dtRaw = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(dtRaw, 0.05);

    Input.updateMouseWorld(this.camera);

    if (this.state === 'playing') this.update(dt);
    this.render();

    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    // 連擊計時
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.player.update(dt, this);
    if (this.player.hp <= 0) { this.die(); return; }

    if (Input.wasPressed('1')) { this.player.currentWeapon = 'axe'; AudioMgr.click(); }
    if (Input.wasPressed('2')) { this.player.currentWeapon = 'sword'; AudioMgr.click(); }
    if (Input.wasPressed('3')) { this.player.currentWeapon = 'bow'; AudioMgr.click(); }

    if (Input.wasPressed('b')) {
      this.uiBuildOpen = !this.uiBuildOpen;
      AudioMgr.click();
      if (this.uiBuildOpen) { UI.showBuildMenu(this); }
      else { UI.hideBuildMenu(); this.placingBuild = false; this.selectedBuild = null; }
    }
    if (Input.wasPressed('t')) {
      this.uiSkillOpen = !this.uiSkillOpen;
      AudioMgr.click();
      this.uiSkillOpen ? UI.showSkillPanel(this) : UI.hideSkillPanel();
    }
    if (Input.wasPressed('n')) {
      this.uiShopOpen = !this.uiShopOpen;
      AudioMgr.click();
      this.uiShopOpen ? UI.showShop(this) : UI.hideShop();
    }
    if (Input.wasPressed('f')) Save.save(this);
    if (Input.wasPressed('l')) Save.load(this);

    if (this.placingBuild && this.selectedBuild && Input.mouse.pressed) {
      this.tryPlaceBuilding();
    }

    for (const e of this.enemies) e.update(dt, this);
    if (this.boss) this.boss.update(dt, this);
    for (const p of this.projectiles) p.update(dt, this);
    for (const b of this.buildings) b.update(dt, this);
    for (const r of this.resources) r.update(dt, this);

    this.particles.update(dt);

    this.enemies = this.enemies.filter(e => e.alive);
    this.projectiles = this.projectiles.filter(p => p.alive);
    this.buildings = this.buildings.filter(b => b.alive);
    if (this.boss && !this.boss.alive) {
      if (this.waveManager.current === 15) this.markQuestDone('final');
      this.boss = null;
    }

    this.waveManager.update(dt, this);

    this.timeOfDay += dt / this.dayLength;
    if (this.timeOfDay >= 1) { this.timeOfDay -= 1; this.day++; }
    const newNight = this.timeOfDay > 0.55;
    if (newNight !== this.isNight) {
      this.isNight = newNight;
      Utils.bigToast(this.isNight ? '夜晚降臨' : '黎明');
    }

    this.updateCamera(dt);
    this.updateQuests();

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakeIntensity = 0;
    }

    UI.update(this);
  }

  tryPlaceBuilding() {
    const type = this.selectedBuild;
    const cfg = BUILDING_TYPES[type];
    if (!cfg) return;
    for (const [k, v] of Object.entries(cfg.cost)) {
      if (this.inventory[k] < v) { Utils.toast(`${k} 不足`); AudioMgr.deny(); return; }
    }
    const grid = 20;
    const mx = Math.round(Input.mouse.worldX / grid) * grid;
    const my = Math.round(Input.mouse.worldY / grid) * grid;
    if (Utils.distance(mx, my, this.player.x, this.player.y) > 240) {
      Utils.toast('太遠了'); AudioMgr.deny(); return;
    }
    if (!Collision.canPlaceBuilding(mx, my, cfg.w, cfg.h, this)) {
      Utils.toast('這裡放不下'); AudioMgr.deny(); return;
    }
    for (const [k, v] of Object.entries(cfg.cost)) this.inventory[k] -= v;
    this.buildings.push(new Building(type, mx, my));
    this.particles.shockRing(mx, my, 40, '#ffd86b');
    this.particles.smoke(mx, my, 8);
    AudioMgr.build();
    this.score += 10;
  }

  updateCamera(dt) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    this.camera.tx = Utils.clamp(this.player.x - cw / 2, 0, this.mapW - cw);
    this.camera.ty = Utils.clamp(this.player.y - ch / 2, 0, this.mapH - ch);
    // 平滑追隨
    const lerpFactor = 1 - Math.pow(0.001, dt);
    this.camera.x = Utils.lerp(this.camera.x, this.camera.tx, lerpFactor);
    this.camera.y = Utils.lerp(this.camera.y, this.camera.ty, lerpFactor);
  }

  render() {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.save();

    // 螢幕震動
    if (this.shakeIntensity > 0) {
      const t = this.shakeTime > 0 ? (this.shakeTime / 0.3) : 0;
      const k = this.shakeIntensity * Utils.clamp(t, 0, 1);
      ctx.translate(Utils.jitter(k), Utils.jitter(k));
    }

    // 背景
    ctx.fillStyle = '#2b3a1f';
    ctx.fillRect(0, 0, cw, ch);

    this.drawGrid(ctx);
    this.drawDecor(ctx);

    for (const r of this.resources) r.draw(ctx, this.camera);
    for (const b of this.buildings) b.draw(ctx, this.camera);
    for (const e of this.enemies) e.draw(ctx, this.camera);
    if (this.boss) this.boss.draw(ctx, this.camera);
    this.player.draw(ctx, this.camera);
    for (const p of this.projectiles) p.draw(ctx, this.camera);

    // 粒子（在物件上方，但傷害飄字最後）
    this.particles.draw(ctx, this.camera);

    if (this.placingBuild && this.selectedBuild) this.drawBuildPreview(ctx);

    if (this.isNight) this.drawNightOverlay(ctx);

    // 傷害飄字 / Boss 條 一定要在最上面
    this.particles.drawTexts(ctx, this.camera);
    if (this.boss && this.boss.spawnAnim <= 0) this.boss.drawHpBarUI(ctx, cw);

    this.drawMapBorder(ctx);

    // 時間漸層遮罩（黃昏 / 清晨）
    this.drawTimeTint(ctx, cw, ch);

    ctx.restore();
  }

  drawTimeTint(ctx, cw, ch) {
    // 用 timeOfDay 做藍紫黃漸變
    const t = this.timeOfDay;
    let r = 0, g = 0, b = 0, a = 0;
    if (t < 0.05) { r = 80; g = 40; b = 120; a = 0.18; }       // 凌晨
    else if (t < 0.10) { r = 255; g = 160; b = 80; a = 0.10; } // 日出
    else if (t < 0.50) { a = 0; }                              // 白天
    else if (t < 0.55) { r = 255; g = 120; b = 60; a = 0.15; } // 黃昏
    else { /* 夜晚由 drawNightOverlay 處理 */ }
    if (a > 0) {
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  drawGrid(ctx) {
    const size = 80;
    const c = this.camera;
    const startX = -((c.x) % size);
    const startY = -((c.y) % size);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let x = startX; x < this.canvas.width; x += size) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke();
    }
    for (let y = startY; y < this.canvas.height; y += size) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke();
    }
  }

  drawDecor(ctx) {
    const c = this.camera;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    for (const d of this.decor) {
      if (d.x < c.x - 20 || d.x > c.x + cw + 20) continue;
      if (d.y < c.y - 20 || d.y > c.y + ch + 20) continue;
      const sx = d.x - c.x;
      const sy = d.y - c.y;
      if (d.type === 'grass') {
        ctx.strokeStyle = 'rgba(80,140,60,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy); ctx.lineTo(sx - 2, sy - d.size * 2);
        ctx.moveTo(sx, sy); ctx.lineTo(sx + 2, sy - d.size * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = `hsl(${d.hue},70%,60%)`;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawMapBorder(ctx) {
    const s = Utils.worldToScreen(0, 0, this.camera);
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 4;
    ctx.strokeRect(s.x, s.y, this.mapW, this.mapH);
  }

  drawBuildPreview(ctx) {
    const cfg = BUILDING_TYPES[this.selectedBuild];
    const grid = 20;
    const mx = Math.round(Input.mouse.worldX / grid) * grid;
    const my = Math.round(Input.mouse.worldY / grid) * grid;
    const s = Utils.worldToScreen(mx, my, this.camera);
    const ok = Collision.canPlaceBuilding(mx, my, cfg.w, cfg.h, this) &&
               Utils.distance(mx, my, this.player.x, this.player.y) <= 240;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = ok ? cfg.color : '#aa3030';
    ctx.fillRect(s.x - cfg.w / 2, s.y - cfg.h / 2, cfg.w, cfg.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? '#fff' : '#ff0';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - cfg.w / 2, s.y - cfg.h / 2, cfg.w, cfg.h);
    // 範圍指引（建造距離）
    const ps = Utils.worldToScreen(this.player.x, this.player.y, this.camera);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(ps.x, ps.y, 240, 0, Math.PI * 2); ctx.stroke();
  }

  drawNightOverlay(ctx) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.fillStyle = 'rgba(0, 10, 40, 0.62)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const ps = Utils.worldToScreen(this.player.x, this.player.y, this.camera);
    const grad0 = ctx.createRadialGradient(ps.x, ps.y, 0, ps.x, ps.y, 110);
    grad0.addColorStop(0, 'rgba(0,0,0,0.7)');
    grad0.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad0;
    ctx.beginPath(); ctx.arc(ps.x, ps.y, 110, 0, Math.PI * 2); ctx.fill();

    for (const b of this.buildings) {
      if (!b.alive || b.type !== 'campfire') continue;
      const s = Utils.worldToScreen(b.x, b.y, this.camera);
      const radius = 160 + Math.sin(performance.now() / 200) * 8;
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius);
      grad.addColorStop(0, 'rgba(0,0,0,0.95)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(s.x, s.y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
