/* ================================================================
 * audio.js
 * Web Audio API 合成音效（不需要外部音檔）
 * 必須在使用者第一次互動後才能 init（瀏覽器限制）
 * ================================================================ */
const AudioMgr = {
  ctx: null,
  master: 0.4,
  muted: false,
  enabled: false,

  init() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.enabled = true;
    } catch (err) {
      console.warn('Web Audio not supported');
      this.enabled = false;
    }
  },

  // 基本 tone（含包絡）
  tone({ freq = 440, dur = 0.15, type = 'sine', vol = 0.3, attack = 0.005, decay = 0.0, sustain = 1, release = 0.05, sweepTo = null, delay = 0 }) {
    if (!this.enabled || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + dur);

    const v = vol * this.master;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(v, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(v * sustain, t0 + attack + decay);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.05);
  },

  // 白噪音（爆破、衝擊用）
  noise({ dur = 0.2, vol = 0.3, filterFreq = 1200, filterQ = 1 }) {
    if (!this.enabled || this.muted) return;
    const t0 = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = filterFreq;
    flt.Q.value = filterQ;
    const gain = this.ctx.createGain();
    const v = vol * this.master;
    gain.gain.setValueAtTime(v, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(flt).connect(gain).connect(this.ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  },

  // ===== 預設音效 =====
  swing()      { this.tone({ freq: 700, sweepTo: 350, dur: 0.10, type: 'square', vol: 0.10 }); },
  hit()        { this.tone({ freq: 220, sweepTo: 80, dur: 0.10, type: 'sawtooth', vol: 0.18 });
                 this.noise({ dur: 0.06, vol: 0.10, filterFreq: 800 }); },
  bowShoot()   { this.tone({ freq: 900, sweepTo: 400, dur: 0.08, type: 'triangle', vol: 0.10 }); },
  arrowHit()   { this.tone({ freq: 600, sweepTo: 200, dur: 0.08, type: 'square', vol: 0.10 }); },
  gather()     { this.tone({ freq: 480, sweepTo: 480, dur: 0.05, type: 'triangle', vol: 0.06 }); },
  build()      { this.tone({ freq: 220, sweepTo: 440, dur: 0.15, type: 'square', vol: 0.12 }); },
  levelup() {
    this.tone({ freq: 523, dur: 0.10, type: 'triangle', vol: 0.15 });
    this.tone({ freq: 659, dur: 0.10, type: 'triangle', vol: 0.15, delay: 0.10 });
    this.tone({ freq: 784, dur: 0.18, type: 'triangle', vol: 0.18, delay: 0.20 });
  },
  enemyDie()   { this.tone({ freq: 200, sweepTo: 50, dur: 0.18, type: 'sawtooth', vol: 0.14 });
                 this.noise({ dur: 0.10, vol: 0.10, filterFreq: 500 }); },
  bossSpawn() {
    this.tone({ freq: 80, dur: 0.6, type: 'sawtooth', vol: 0.20 });
    this.tone({ freq: 60, dur: 0.6, type: 'sawtooth', vol: 0.20, delay: 0.05 });
    this.noise({ dur: 0.4, vol: 0.10, filterFreq: 300 });
  },
  bossHit()    { this.tone({ freq: 150, sweepTo: 50, dur: 0.15, type: 'sawtooth', vol: 0.20 }); },
  playerHurt() { this.tone({ freq: 300, sweepTo: 80, dur: 0.18, type: 'square', vol: 0.18 }); },

  fireball() {
    this.tone({ freq: 180, sweepTo: 600, dur: 0.25, type: 'sawtooth', vol: 0.15 });
    this.noise({ dur: 0.2, vol: 0.10, filterFreq: 1200 });
  },
  explosion() {
    this.tone({ freq: 60, sweepTo: 30, dur: 0.4, type: 'sawtooth', vol: 0.25 });
    this.noise({ dur: 0.35, vol: 0.30, filterFreq: 600, filterQ: 2 });
  },
  lightning() {
    this.noise({ dur: 0.4, vol: 0.20, filterFreq: 2400, filterQ: 3 });
    this.tone({ freq: 1200, sweepTo: 200, dur: 0.15, type: 'square', vol: 0.12 });
  },
  shockwave() {
    this.tone({ freq: 60, sweepTo: 300, dur: 0.3, type: 'sine', vol: 0.20 });
    this.noise({ dur: 0.25, vol: 0.15, filterFreq: 800 });
  },
  heal() {
    this.tone({ freq: 392, dur: 0.18, type: 'sine', vol: 0.12 });
    this.tone({ freq: 523, dur: 0.18, type: 'sine', vol: 0.12, delay: 0.08 });
    this.tone({ freq: 659, dur: 0.25, type: 'sine', vol: 0.14, delay: 0.16 });
  },

  click()      { this.tone({ freq: 800, dur: 0.04, type: 'square', vol: 0.08 }); },
  buy()        { this.tone({ freq: 660, dur: 0.10, type: 'triangle', vol: 0.12 });
                 this.tone({ freq: 990, dur: 0.10, type: 'triangle', vol: 0.10, delay: 0.05 }); },
  deny()       { this.tone({ freq: 200, sweepTo: 120, dur: 0.18, type: 'square', vol: 0.12 }); },
  wave()       { this.tone({ freq: 110, dur: 0.4, type: 'sawtooth', vol: 0.18 });
                 this.tone({ freq: 220, dur: 0.4, type: 'sawtooth', vol: 0.15, delay: 0.1 }); },
  victory() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.20, type: 'triangle', vol: 0.18, delay: i * 0.15 }));
  },
  defeat() {
    this.tone({ freq: 220, sweepTo: 55, dur: 0.8, type: 'sawtooth', vol: 0.25 });
  }
};
