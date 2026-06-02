/* ================================================================
 * particle.js
 * 粒子系統 + 傷害飄字 + 閃電折線
 * 全部粒子集中管理，避免效能爆掉
 * ================================================================ */
class ParticleSystem {
  constructor(max = 800) {
    this.list = [];
    this.max = max;
    this.texts = [];
    this.maxTexts = 80;
  }

  add(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(p);
  }

  // ===== 基本粒子工廠 =====

  spark(x, y, count = 8, color = '#ffd86b') {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = Utils.randomRange(60, 240);
      this.add({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.45, max: 0.45, color, size: Utils.randomRange(1.5, 3.5),
        type: 'spark', gravity: 80
      });
    }
  }

  blood(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = Utils.randomRange(40, 180);
      this.add({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
        life: 0.6, max: 0.6, color: '#a01a1a',
        size: Utils.randomRange(2, 4), type: 'blood', gravity: 240
      });
    }
  }

  leaves(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      this.add({
        x, y, vx: Math.cos(ang) * Utils.randomRange(20, 80),
        vy: Math.sin(ang) * Utils.randomRange(20, 80) - 30,
        life: 1.2, max: 1.2, color: '#3c8c3c',
        size: Utils.randomRange(2, 4), type: 'leaf', gravity: 40, rot: Math.random() * 6
      });
    }
  }

  rockChip(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      this.add({
        x, y, vx: Math.cos(ang) * Utils.randomRange(40, 120),
        vy: Math.sin(ang) * Utils.randomRange(40, 120) - 60,
        life: 0.7, max: 0.7, color: '#8a8a8a',
        size: Utils.randomRange(2, 3), type: 'chip', gravity: 300
      });
    }
  }

  smoke(x, y, count = 6, color = 'rgba(80,80,80,0.5)') {
    for (let i = 0; i < count; i++) {
      this.add({
        x: x + Utils.jitter(6), y: y + Utils.jitter(6),
        vx: Utils.jitter(20), vy: -Utils.randomRange(20, 50),
        life: 1.0, max: 1.0, color,
        size: Utils.randomRange(6, 12), type: 'smoke', grow: 8
      });
    }
  }

  fire(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      this.add({
        x, y, vx: Math.cos(ang) * Utils.randomRange(20, 50),
        vy: Math.sin(ang) * Utils.randomRange(20, 50) - 30,
        life: 0.5, max: 0.5, color: Utils.pick(['#ffd86b','#ffaa33','#ff5020']),
        size: Utils.randomRange(4, 8), type: 'fire', grow: -6
      });
    }
  }

  // ===== 射擊用：槍口閃光 =====
  // 射擊起點的閃光 + 一個方向錐形的火花噴射
  muzzleFlash(x, y, angle, color = '#fff066') {
    // 中央大閃光
    this.add({
      x, y, vx: 0, vy: 0,
      life: 0.18, max: 0.18,
      color, size: 26, type: 'flash'
    });
    // 噴射的火花（前方扇形）
    for (let i = 0; i < 10; i++) {
      const a = angle + Utils.jitter(0.55);
      const sp = Utils.randomRange(180, 360);
      this.add({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: Utils.randomRange(0.2, 0.4), max: 0.4,
        color: Utils.pick(['#fff', '#ffd86b', '#ff8030']),
        size: Utils.randomRange(1.5, 3), type: 'spark', gravity: 0
      });
    }
    // 一圈薄煙
    this.add({
      x: x + Math.cos(angle) * 10,
      y: y + Math.sin(angle) * 10,
      vx: 0, vy: 0,
      life: 0.4, max: 0.4,
      color: 'rgba(120,80,40,0.5)', size: 8, type: 'smoke', grow: 20
    });
  }

  // ===== 子彈拖曳尾巴（每 frame 呼叫一次）=====
  bulletTrail(x, y, color = '#fff066') {
    // 亮核心
    this.add({
      x, y, vx: 0, vy: 0,
      life: 0.25, max: 0.25, color, size: 5, type: 'fire', grow: -16
    });
    // 外層微光
    this.add({
      x: x + Utils.jitter(2), y: y + Utils.jitter(2),
      vx: 0, vy: 0,
      life: 0.18, max: 0.18, color, size: 3, type: 'spark'
    });
    // 小拖尾火花
    if (Utils.chance(0.5)) {
      this.add({
        x: x + Utils.jitter(3), y: y + Utils.jitter(3),
        vx: Utils.jitter(20), vy: Utils.jitter(20),
        life: 0.3, max: 0.3, color: 'rgba(255,255,255,0.7)',
        size: 1.5, type: 'spark', gravity: 0
      });
    }
  }

  // ===== 鎖鏈閃電折線（用 bolt 粒子畫出真正的鋸齒線）=====
  chainBolt(x1, y1, x2, y2, color = '#bbeaff') {
    const segments = 10;
    const points = [];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const px = -dy / len, py = dx / len; // 垂直方向
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const j = (i === 0 || i === segments) ? 0 : Utils.jitter(14);
      points.push({
        x: x1 + dx * t + px * j,
        y: y1 + dy * t + py * j
      });
    }
    this.add({
      x: x1, y: y1, vx: 0, vy: 0,
      life: 0.30, max: 0.30, color, size: 3,
      type: 'bolt', points
    });
    // 末端閃光
    this.add({
      x: x2, y: y2, vx: 0, vy: 0,
      life: 0.25, max: 0.25, color: '#fff', size: 30, type: 'flash'
    });
    // 沿途火花
    for (const pt of points) {
      if (Utils.chance(0.5)) {
        this.add({
          x: pt.x, y: pt.y,
          vx: Utils.jitter(40), vy: Utils.jitter(40),
          life: 0.3, max: 0.3, color, size: 2, type: 'spark'
        });
      }
    }
  }

  // ===== 大型爆炸（火球命中）=====
  explosion(x, y, radius = 100) {
    this.add({
      x, y, vx: 0, vy: 0, life: 0.3, max: 0.3,
      color: '#fff', size: radius, type: 'flash'
    });
    for (let i = 0; i < 36; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = Utils.randomRange(180, 420);
      this.add({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: Utils.randomRange(0.4, 0.9), max: 0.9,
        color: Utils.pick(['#ffd86b', '#ff8030', '#ff5020', '#fff']),
        size: Utils.randomRange(5, 10), type: 'fire', grow: -6
      });
    }
    this.smoke(x, y, 18, 'rgba(60,40,30,0.7)');
    this.shockRing(x, y, radius * 0.9, '#ffaa33');
    this.shockRing(x, y, radius * 1.2, '#ff5020');
  }

  // 子彈命中爆裂（小型 但很閃）
  bulletImpact(x, y, color = '#ffd86b') {
    this.add({
      x, y, vx: 0, vy: 0,
      life: 0.18, max: 0.18, color: '#fff', size: 22, type: 'flash'
    });
    for (let i = 0; i < 14; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = Utils.randomRange(120, 320);
      this.add({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: Utils.randomRange(0.25, 0.45), max: 0.45,
        color: Utils.pick([color, '#fff', '#fff066']),
        size: Utils.randomRange(2, 4), type: 'spark', gravity: 40
      });
    }
    this.shockRing(x, y, 38, color);
  }

  shockRing(x, y, radius = 120, color = '#ffd86b') {
    this.add({
      x, y, vx: 0, vy: 0, life: 0.45, max: 0.45,
      color, size: 6, type: 'ring', targetRadius: radius
    });
  }

  // 範圍式閃電（單道，從天而降）
  lightning(x1, y1, x2, y2) {
    this.chainBolt(x1, y1, x2, y2, '#ddeeff');
    this.spark(x2, y2, 12, '#aaccff');
  }

  // ===== 戰士：弧形劍光 =====
  slashArc(x, y, angle, range, color = '#ff5050') {
    this.add({
      x, y, vx: 0, vy: 0,
      life: 0.32, max: 0.32, color, size: range,
      type: 'slashArc', angle, range
    });
  }

  // ===== 戰士：地面裂縫 =====
  groundCrack(x, y, angle, length) {
    const segments = 7;
    const points = [{ x, y }];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      points.push({
        x: x + Math.cos(angle) * length * t + Utils.jitter(10),
        y: y + Math.sin(angle) * length * t + Utils.jitter(10)
      });
    }
    this.add({
      x, y, vx: 0, vy: 0,
      life: 1.2, max: 1.2, color: '#3a2010', size: 5,
      type: 'crack', points
    });
  }

  // ===== 法師：冰封新星（多顆飛旋冰晶）=====
  frostNova(x, y, radius) {
    for (let i = 0; i < 28; i++) {
      const ang = (i / 28) * Math.PI * 2;
      const speed = radius / 0.55;
      this.add({
        x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        life: 0.55, max: 0.55, color: '#aaccff',
        size: Utils.randomRange(5, 8), type: 'iceShard', angle: ang
      });
    }
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      this.add({
        x: x + Math.cos(ang) * 20, y: y + Math.sin(ang) * 20,
        vx: 0, vy: 0,
        life: 0.7, max: 0.7, color: '#fff',
        size: 14, type: 'iceShard', angle: ang
      });
    }
  }

  // ===== 法師：生命之泉符文圈（地面）=====
  runeCircle(x, y, radius, duration = 3) {
    this.add({
      x, y, vx: 0, vy: 0,
      life: duration, max: duration, color: '#6fdd6f',
      size: radius, type: 'runeCircle'
    });
  }

  // ===== 弓手：獵人之擁葉子旋轉 =====
  leafSwirl(x, y) {
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2;
      const r = 30 + Math.random() * 12;
      this.add({
        x: x + Math.cos(ang) * r,
        y: y + Math.sin(ang) * r,
        vx: -Math.sin(ang) * 100,
        vy: Math.cos(ang) * 100 - 50,
        life: 1.5, max: 1.5,
        color: Utils.pick(['#5cdb5c', '#aaffaa', '#3aa83a']),
        size: Utils.randomRange(3, 5),
        type: 'leaf', rot: ang
      });
    }
  }

  heal(x, y, count = 18) {
    for (let i = 0; i < count; i++) {
      this.add({
        x: x + Utils.jitter(22), y: y + Utils.jitter(10),
        vx: Utils.jitter(20), vy: -Utils.randomRange(40, 100),
        life: 1.0, max: 1.0, color: Utils.pick(['#6fdd6f', '#aaffaa']),
        size: Utils.randomRange(3, 5), type: 'fire', grow: -3
      });
    }
    this.shockRing(x, y, 50, '#6fdd6f');
  }

  levelup(x, y) {
    this.shockRing(x, y, 100, '#ffd86b');
    this.shockRing(x, y, 60, '#fff066');
    for (let i = 0; i < 24; i++) {
      const ang = Math.random() * Math.PI * 2;
      this.add({
        x: x + Math.cos(ang) * 10, y: y + Math.sin(ang) * 10,
        vx: Math.cos(ang) * Utils.randomRange(40, 140),
        vy: Math.sin(ang) * Utils.randomRange(40, 140) - 60,
        life: 1.0, max: 1.0, color: '#ffd86b',
        size: Utils.randomRange(2, 4), type: 'spark', gravity: -30
      });
    }
  }

  dashTrail(x, y, color = 'rgba(255,255,255,0.5)') {
    this.add({
      x, y, vx: 0, vy: 0, life: 0.3, max: 0.3,
      color, size: 14, type: 'fade'
    });
  }

  // ---- 傷害飄字 ----
  damageText(x, y, value, color = '#fff', big = false) {
    if (this.texts.length >= this.maxTexts) this.texts.shift();
    const num = typeof value === 'number' ? Math.round(value) : value;
    const auto = typeof value === 'number' && value >= 100;
    this.texts.push({
      x, y, vx: Utils.jitter(20), vy: -70,
      life: 1.0, max: 1.0, text: '' + num,
      color, big: big || auto
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      if (p.type !== 'ring' && p.type !== 'flash' && p.type !== 'fade' && p.type !== 'bolt') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.gravity) p.vy += p.gravity * dt;
        if (p.grow) p.size += p.grow * dt;
        if (p.rot != null) p.rot += dt * 4;
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this.texts.splice(i, 1); continue; }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vy += 30 * dt;
    }
  }

  draw(ctx, camera) {
    for (const p of this.list) {
      const alpha = Utils.clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = alpha;

      if (p.type === 'bolt') {
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * alpha;
        ctx.beginPath();
        for (let i = 0; i < p.points.length; i++) {
          const pt = p.points[i];
          const ps = Utils.worldToScreen(pt.x, pt.y, camera);
          if (i === 0) ctx.moveTo(ps.x, ps.y); else ctx.lineTo(ps.x, ps.y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * alpha;
        ctx.stroke();
        ctx.restore();
        continue;
      }

      // ===== 地面裂縫 =====
      if (p.type === 'crack') {
        ctx.save();
        ctx.strokeStyle = '#0a0500';
        ctx.lineWidth = 6 * alpha;
        ctx.shadowColor = '#ff6020';
        ctx.shadowBlur = 14 * alpha;
        ctx.beginPath();
        for (let i = 0; i < p.points.length; i++) {
          const pt = p.points[i];
          const ps = Utils.worldToScreen(pt.x, pt.y, camera);
          if (i === 0) ctx.moveTo(ps.x, ps.y); else ctx.lineTo(ps.x, ps.y);
        }
        ctx.stroke();
        // 內亮光（橘紅）
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255,140,40,${alpha})`;
        ctx.lineWidth = 2 * alpha;
        ctx.stroke();
        ctx.restore();
        continue;
      }

      // ===== 弧形劍光 =====
      if (p.type === 'slashArc') {
        const screen = Utils.worldToScreen(p.x, p.y, camera);
        const arcLen = 1.0 * alpha + 0.4;
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(p.angle - arcLen / 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 14 * alpha;
        ctx.lineCap = 'round';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, p.range, 0, arcLen);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 6 * alpha;
        ctx.beginPath();
        ctx.arc(0, 0, p.range, 0, arcLen);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      // ===== 冰晶 =====
      if (p.type === 'iceShard') {
        const screen = Utils.worldToScreen(p.x, p.y, camera);
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(p.angle + (1 - alpha) * 5);
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const r = i % 2 === 0 ? p.size : p.size * 0.5;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
        continue;
      }

      // ===== 符文圈（地面）=====
      if (p.type === 'runeCircle') {
        const screen = Utils.worldToScreen(p.x, p.y, camera);
        const rot = (p.max - p.life) * 1.2;
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(rot);
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        // 三層同心圓
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, p.size * 0.7, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2); ctx.stroke();
        // 8 個符文記號
        ctx.fillStyle = p.color;
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          const x = Math.cos(a) * p.size * 0.85;
          const y = Math.sin(a) * p.size * 0.85;
          ctx.beginPath();
          ctx.moveTo(x - 5, y);
          ctx.lineTo(x, y - 5);
          ctx.lineTo(x + 5, y);
          ctx.lineTo(x, y + 5);
          ctx.closePath();
          ctx.fill();
        }
        // 內部光暈
        const gd = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        gd.addColorStop(0, 'rgba(111,221,111,0.5)');
        gd.addColorStop(1, 'rgba(111,221,111,0)');
        ctx.fillStyle = gd;
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
        continue;
      }

      const s = Utils.worldToScreen(p.x, p.y, camera);

      if (p.type === 'spark' || p.type === 'fire' || p.type === 'blood' || p.type === 'chip') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.5, p.size), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'leaf') {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
        ctx.restore();
      } else if (p.type === 'smoke') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(1, p.size), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'flash') {
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, p.size);
        grad.addColorStop(0, p.color);
        grad.addColorStop(0.6, p.color === '#fff' ? 'rgba(255,255,255,0.3)' : 'rgba(255,200,80,0.3)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'ring') {
        const t = 1 - p.life / p.max;
        const radius = Utils.lerp(p.size, p.targetRadius, t);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 5 * (1 - t);
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        // 內層淡光
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2 * (1 - t);
        ctx.stroke();
      } else if (p.type === 'fade') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx, camera) {
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const s = Utils.worldToScreen(t.x, t.y, camera);
      const alpha = Utils.clamp(t.life / t.max, 0, 1);
      ctx.globalAlpha = alpha;
      // big 數字 跳出時放大彈跳效果
      const popup = t.life > t.max - 0.15 ? 1.3 - (t.max - t.life) * 2 : 1;
      const scale = t.big ? 1.5 * popup : popup;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(scale, scale);
      if (t.big) {
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 10;
      }
      ctx.font = t.big ? 'bold 22px sans-serif' : 'bold 14px sans-serif';
      Utils.strokeText(ctx, t.text, 0, 0, t.color, '#000', t.big ? 4 : 3);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  clear() { this.list = []; this.texts = []; }
}
