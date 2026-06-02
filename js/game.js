/* ================================================================
 * game.js
 * 主迴圈 / 卡牌觸發 / 鏡頭 / 震動 / 商店 / mutations
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
    this.stats = new Stats();
    this.mut = {};         // mutations (cards apply here)
    this.seed = null;
    this.rng = null;

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
    this.uiCardOpen = false;
    this.pendingCards = null;

    this.quests = this.buildInitialQuests();
    this.killCount = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;

    this.particles = new ParticleSystem(900);
    this.decor = [];
    this.spawnInitialResources();
    this.generateDecor();

    this.shakeIntensity = 0;
    this.shakeTime = 0;

    this.scheduled = []; // 技能延遲事件
    this.healZones = []; // 法師生命之泉
    this.iceZones = [];  // 冰霜地面
    this.darkZones = []; // Boss 暗影法師黑洞

    this.lastTime = performance.now();
    this.autoSaveTimer = 30;
  }

  schedule(delay, fn) { this.scheduled.push({ delay, fn }); }

  buildInitialQuests() {
    return [
      { id: 'wood', text: '收集 50 木材', target: 50, progress: 0, done: false },
      { id: 'forge', text: '鍛造 1 件傳說武器', target: 1, progress: 0, done: false },
      { id: 'wave5', text: '擊敗第 5 波 Boss', target: 1, progress: 0, done: false },
      { id: 'skill3', text: '升技能到 3 級', target: 1, progress: 0, done: false },
      { id: 'wave15', text: '撐過第 15 波', target: 1, progress: 0, done: false },
      { id: 'final', text: '擊敗最終 Boss', target: 1, progress: 0, done: false }
    ];
  }

  generateDecor() {
    this.decor = [];
    const r = this.rng || { next: Math.random, int: (a,b) => Math.floor(Math.random()*(b-a+1))+a, chance: p => Math.random() < p };
    for (let i = 0; i < 280; i++) {
      this.decor.push({
        x: r.next() * this.mapW,
        y: r.next() * this.mapH,
        type: r.chance(0.7) ? 'grass' : (r.chance(0.6) ? 'flower' : 'stone'),
        size: 2 + r.next() * 3,
        hue: r.int(0, 360)
      });
    }
  }

  spawnInitialResources() {
    this.resources = [];
    const r = this.rng || { next: Math.random, range: (a,b) => Math.random()*(b-a)+a };
    const ratios = { tree: 100, rock: 60, iron: 30, bush: 40, chest: 10 };
    for (const [type, count] of Object.entries(ratios)) {
      for (let i = 0; i < count; i++) {
        for (let tries = 0; tries < 20; tries++) {
          const x = r.range(80, this.mapW - 80);
          const y = r.range(80, this.mapH - 80);
          if (Utils.distance(x, y, this.player.x, this.player.y) < 100) continue;
          let ok = true;
          for (const rs of this.resources) {
            if (Utils.distance(x, y, rs.x, rs.y) < rs.radius + 20) { ok = false; break; }
          }
          if (ok) { this.resources.push(new ResourceNode(type, x, y)); break; }
        }
      }
    }
  }

  // 用 classId 與 mode 開始新局
  startNewRun(classId = 'warrior', mode = 'normal', seed = null) {
    if (mode === 'daily') {
      const t = PRNG.todaySeed();
      seed = t.seed;
    } else if (mode === 'ngplus') {
      // NG+ 隨機 seed
      seed = Math.floor(Math.random() * 1e9);
    } else if (seed === null) {
      seed = Math.floor(Math.random() * 1e9);
    }
    this.seed = seed;
    this.rng = PRNG.rng(seed);

    this.player = new Player(this.mapW / 2, this.mapH / 2);
    this.player.applyClass(classId);
    // 依職業設定初始解鎖武器（只有 Tier 1）
    const tiers = LEGENDARY_WEAPONS[classId] || [];
    this.player.unlockedWeapons = tiers[0] ? [tiers[0].id] : [];
    if (tiers[0]) this.player.currentWeapon = tiers[0].id;
    this.skills = new SkillSystem();
    this.skills.applyAll(this.player);
    this.stats = new Stats();
    this.stats.classId = classId;
    this.stats.mode = mode;
    this.mut = {};
    this.enemies = []; this.projectiles = []; this.buildings = []; this.boss = null;
    this.inventory = { wood: 10, stone: 0, iron: 0, gold: 50, food: 0 };
    this.waveManager = new WaveManager();
    this.timeOfDay = 0; this.day = 1; this.isNight = false;
    this.killCount = 0; this.score = 0; this.combo = 0;
    this.scheduled = []; this.healZones = []; this.iceZones = []; this.darkZones = [];
    this.particles.clear();
    this.quests = this.buildInitialQuests();
    this.spawnInitialResources();
    this.generateDecor();
    this.placingBuild = false; this.selectedBuild = null;
    this.uiBuildOpen = this.uiSkillOpen = this.uiShopOpen = this.uiCardOpen = false;
    UI.hideAllOverlays();
    this.state = 'playing';
    Utils.bigToast(CHAR_CLASSES[classId].name + ' 出發！');
  }

  pause() { if (this.state !== 'playing') return; this.state = 'paused'; UI.showPause(true); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; UI.showPause(false); }
  togglePause() { this.state === 'playing' ? this.pause() : this.resume(); }

  win() {
    this.state = 'victory';
    this.stats.victory = true;
    Meta.recordRun(this);
    const newAch = Meta.check(this);
    UI.showVictory(true, this);
    AudioMgr.victory();
    if (newAch.length) Utils.bigToast(`解鎖 ${newAch.length} 個成就`);
    this.markQuestDone('final');
    // 雲端上傳分數
    if (typeof Cloud !== 'undefined' && Cloud.submitScore) Cloud.submitScore(this);
  }
  die() {
    this.state = 'dead';
    Meta.recordRun(this);
    const newAch = Meta.check(this);
    UI.showDead(true, this);
    AudioMgr.defeat();
    if (newAch.length) Utils.bigToast(`解鎖 ${newAch.length} 個成就`);
  }

  shake(intensity = 5, duration = 0.2) {
    if (intensity > this.shakeIntensity) {
      this.shakeIntensity = intensity;
      this.shakeTime = duration;
    }
  }

  // 卡牌系統
  openCardChoice() {
    this.pendingCards = Cards.draw(this, this.rng);
    this.uiCardOpen = true;
    UI.showCardChoice(this);
  }
  pickCard(card) {
    Cards.take(card, this);
    this.uiCardOpen = false;
    UI.hideCardChoice();
    this.pendingCards = null;
    this.waveManager.afterCardChoice(this);
  }

  markQuestDone(id) {
    const q = this.quests.find(x => x.id === id);
    if (q && !q.done) { q.done = true; q.progress = q.target;
      Utils.toast(`任務完成：${q.text}`); this.score += 50; }
  }
  updateQuests() {
    const qw = this.quests.find(q => q.id === 'wood');
    if (qw && !qw.done) {
      qw.progress = Math.min(qw.target, this.inventory.wood);
      if (qw.progress >= qw.target) this.markQuestDone('wood');
    }
    const qf = this.quests.find(q => q.id === 'forge');
    if (qf && !qf.done) {
      const forgedCount = (this.player.unlockedWeapons?.length || 1) - 1;
      qf.progress = Math.max(qf.progress, forgedCount);
      if (qf.progress >= qf.target) this.markQuestDone('forge');
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
    if (typeof Touch !== 'undefined' && Touch.enabled) Touch.feedInput();
    Input.updateMouseWorld(this.camera);
    if (this.state === 'playing') this.update(dt);
    this.render();
    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.player.update(dt, this);
    if (this.player.hp <= 0) { this.die(); return; }

    // 1/2/3 切換傳說武器階級
    const wtiers = LEGENDARY_WEAPONS[this.player.classId] || [];
    if (Input.wasPressed('1') && wtiers[0] && this.player.unlockedWeapons.includes(wtiers[0].id)) {
      this.player.currentWeapon = wtiers[0].id; AudioMgr.click();
    }
    if (Input.wasPressed('2') && wtiers[1] && this.player.unlockedWeapons.includes(wtiers[1].id)) {
      this.player.currentWeapon = wtiers[1].id; AudioMgr.click();
    }
    if (Input.wasPressed('3') && wtiers[2] && this.player.unlockedWeapons.includes(wtiers[2].id)) {
      this.player.currentWeapon = wtiers[2].id; AudioMgr.click();
    }

    if (Input.wasPressed('b')) {
      this.uiBuildOpen = !this.uiBuildOpen; AudioMgr.click();
      if (this.uiBuildOpen) UI.showForgeMenu(this);
      else UI.hideBuildMenu();
    }
    if (Input.wasPressed('t')) {
      this.uiSkillOpen = !this.uiSkillOpen; AudioMgr.click();
      this.uiSkillOpen ? UI.showSkillPanel(this) : UI.hideSkillPanel();
    }
    if (Input.wasPressed('n')) {
      this.uiShopOpen = !this.uiShopOpen; AudioMgr.click();
      this.uiShopOpen ? UI.showShop(this) : UI.hideShop();
    }
    if (Input.wasPressed('f')) Save.save(this, 1);
    if (Input.wasPressed('l')) Save.load(this, 1);

    // 建造功能已移除（改成鍛造）
    // if (this.placingBuild && this.selectedBuild && Input.mouse.pressed) this.tryPlaceBuilding();

    // 排程觸發
    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      this.scheduled[i].delay -= dt;
      if (this.scheduled[i].delay <= 0) {
        try { this.scheduled[i].fn(); } catch (e) { console.error(e); }
        this.scheduled.splice(i, 1);
      }
    }
    // 治癒地面
    for (let i = this.healZones.length - 1; i >= 0; i--) {
      const z = this.healZones[i];
      z.life -= dt;
      if (z.life <= 0) { this.healZones.splice(i, 1); continue; }
      if (Utils.distance(z.x, z.y, this.player.x, this.player.y) < z.radius + this.player.radius) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 10 * dt);
        this.player.mp = Math.min(this.player.maxMp, this.player.mp + 5 * dt);
      }
    }
    // 冰霜地面
    for (let i = this.iceZones.length - 1; i >= 0; i--) {
      const z = this.iceZones[i];
      z.life -= dt;
      if (z.life <= 0) { this.iceZones.splice(i, 1); continue; }
    }
    // Boss 虛空黑洞:持續傷害 + 拉扯
    if (this.darkZones) {
      for (let i = this.darkZones.length - 1; i >= 0; i--) {
        const z = this.darkZones[i];
        z.life -= dt;
        if (z.life <= 0) { this.darkZones.splice(i, 1); continue; }
        const d = Utils.distance(z.x, z.y, this.player.x, this.player.y);
        if (d < z.radius + this.player.radius) {
          this.player.takeDamage(z.damage * dt);
          // 拉扯
          const a = Utils.angle(this.player.x, this.player.y, z.x, z.y);
          this.player.x += Math.cos(a) * 60 * dt;
          this.player.y += Math.sin(a) * 60 * dt;
        }
        // 環繞粒子
        if (Math.random() < dt * 8) {
          const a = Math.random() * Math.PI * 2;
          this.particles.add({
            x: z.x + Math.cos(a) * z.radius, y: z.y + Math.sin(a) * z.radius,
            vx: -Math.cos(a) * 90, vy: -Math.sin(a) * 90,
            life: 0.6, max: 0.6, color: '#b06aff', size: 3, type: 'spark'
          });
        }
      }
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
    if (this.boss && !this.boss.alive) this.boss = null;

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

    // 30 秒自動存檔
    this.autoSaveTimer -= dt;
    if (this.autoSaveTimer <= 0) {
      Save.autosave(this);
      this.autoSaveTimer = 30;
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
    if (Utils.distance(mx, my, this.player.x, this.player.y) > 240) { Utils.toast('太遠了'); AudioMgr.deny(); return; }
    if (!Collision.canPlaceBuilding(mx, my, cfg.w, cfg.h, this)) { Utils.toast('放不下'); AudioMgr.deny(); return; }
    for (const [k, v] of Object.entries(cfg.cost)) this.inventory[k] -= v;
    this.buildings.push(new Building(type, mx, my));
    this.stats?.recordBuild(type);
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
    const lerpFactor = 1 - Math.pow(0.001, dt);
    this.camera.x = Utils.lerp(this.camera.x, this.camera.tx, lerpFactor);
    this.camera.y = Utils.lerp(this.camera.y, this.camera.ty, lerpFactor);
  }

  render() {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.save();
    if (this.shakeIntensity > 0) {
      const t = this.shakeTime > 0 ? (this.shakeTime / 0.3) : 0;
      const k = this.shakeIntensity * Utils.clamp(t, 0, 1);
      ctx.translate(Utils.jitter(k), Utils.jitter(k));
    }

    // 背景漸層 + 紋路
    const bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#3a4d22');
    bg.addColorStop(1, '#1c2810');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    this.drawGrid(ctx);
    this.drawDecor(ctx);

    for (const r of this.resources) r.draw(ctx, this.camera);
    // 冰霜地面（在建築下）
    for (const z of this.iceZones) {
      const ps = Utils.worldToScreen(z.x, z.y, this.camera);
      const a = Math.min(1, z.life / 1.5);
      ctx.fillStyle = `rgba(170,204,255,${0.25 * a})`;
      ctx.beginPath(); ctx.arc(ps.x, ps.y, z.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(200,230,255,${0.5 * a})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ps.x, ps.y, z.radius, 0, Math.PI * 2); ctx.stroke();
    }
    for (const b of this.buildings) b.draw(ctx, this.camera);
    for (const e of this.enemies) e.draw(ctx, this.camera);
    if (this.boss) this.boss.draw(ctx, this.camera);
    this.player.draw(ctx, this.camera);
    // Combo 光環:combo >= 8 後,玩家身上有金色光圈跟著心跳擴張
    if (this.combo >= 8) {
      const ps = Utils.worldToScreen(this.player.x, this.player.y, this.camera);
      const t = performance.now() / 1000;
      const pulse = (Math.sin(t * 6) + 1) * 0.5;
      const tier = this.combo >= 30 ? 2 : this.combo >= 18 ? 1 : 0;
      const color = tier === 2 ? '#ff4040' : tier === 1 ? '#ffaa30' : '#ffd86b';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.6 + pulse * 0.3;
      ctx.lineWidth = 2 + tier;
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, this.player.radius + 16 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, this.player.radius + 24 + pulse * 10, 0, Math.PI * 2);
      ctx.stroke();
      // combo 數字浮在頭上
      ctx.globalAlpha = 0.85 + pulse * 0.15;
      ctx.font = `bold ${18 + tier * 4}px sans-serif`;
      ctx.textAlign = 'center';
      Utils.strokeText(ctx, `${this.combo} HIT!`, ps.x, ps.y - this.player.radius - 28, color, '#000', 3);
      ctx.textAlign = 'left';
      ctx.restore();
    }
    for (const p of this.projectiles) p.draw(ctx, this.camera);
    this.particles.draw(ctx, this.camera);

    if (this.placingBuild && this.selectedBuild) this.drawBuildPreview(ctx);
    if (this.isNight) this.drawNightOverlay(ctx);

    this.particles.drawTexts(ctx, this.camera);
    if (this.boss && this.boss.spawnAnim <= 0) this.boss.drawHpBarUI(ctx, cw);
    this.drawMapBorder(ctx);
    this.drawTimeTint(ctx, cw, ch);

    ctx.restore();
  }

  drawTimeTint(ctx, cw, ch) {
    const t = this.timeOfDay;
    let r = 0, g = 0, b = 0, a = 0;
    if (t < 0.05) { r = 80; g = 40; b = 120; a = 0.18; }
    else if (t < 0.10) { r = 255; g = 160; b = 80; a = 0.10; }
    else if (t < 0.50) { a = 0; }
    else if (t < 0.55) { r = 255; g = 120; b = 60; a = 0.15; }
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
    const cw = this.canvas.width, ch = this.canvas.height;
    for (const d of this.decor) {
      if (d.x < c.x - 20 || d.x > c.x + cw + 20) continue;
      if (d.y < c.y - 20 || d.y > c.y + ch + 20) continue;
      const sx = d.x - c.x, sy = d.y - c.y;
      if (d.type === 'grass') {
        ctx.strokeStyle = 'rgba(80,140,60,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy); ctx.lineTo(sx - 2, sy - d.size * 2);
        ctx.moveTo(sx, sy); ctx.lineTo(sx + 2, sy - d.size * 2);
        ctx.stroke();
      } else if (d.type === 'flower') {
        ctx.fillStyle = `hsl(${d.hue},70%,60%)`;
        ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill();
      } else if (d.type === 'stone') {
        ctx.fillStyle = 'rgba(110,110,110,0.5)';
        ctx.beginPath(); ctx.arc(sx, sy, d.size, 0, Math.PI * 2); ctx.fill();
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
    const ps = Utils.worldToScreen(this.player.x, this.player.y, this.camera);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(ps.x, ps.y, 240, 0, Math.PI * 2); ctx.stroke();
  }

  drawNightOverlay(ctx) {
    const cw = this.canvas.width, ch = this.canvas.height;
    // 整體變暗度從 0.62 降到 0.40（夜晚變亮一點）
    ctx.fillStyle = 'rgba(10, 20, 50, 0.40)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const ps = Utils.worldToScreen(this.player.x, this.player.y, this.camera);
    // 玩家周圍視野範圍從 110 擴大到 140，亮度從 0.7 提到 0.85
    const grad0 = ctx.createRadialGradient(ps.x, ps.y, 0, ps.x, ps.y, 140);
    grad0.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad0.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad0;
    ctx.beginPath(); ctx.arc(ps.x, ps.y, 140, 0, Math.PI * 2); ctx.fill();
    for (const b of this.buildings) {
      if (!b.alive || b.type !== 'campfire') continue;
      const s = Utils.worldToScreen(b.x, b.y, this.camera);
      const radius = 180 + Math.sin(performance.now() / 200) * 8;
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius);
      grad.addColorStop(0, 'rgba(0,0,0,0.95)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(s.x, s.y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
