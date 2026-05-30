/* ================================================================
 * prng.js
 * mulberry32 seeded PRNG — 每日挑戰、地圖種子用
 * 同一個種子永遠產出同樣的隨機序列
 * ================================================================ */
const PRNG = {
  // 字串雜湊成 32-bit seed
  hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  },

  mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (((t ^ (t >>> 14)) >>> 0)) / 4294967296;
    };
  },

  // 今日種子（YYYY-MM-DD）
  todaySeed() {
    const d = new Date();
    const s = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    return { seed: this.hash(s), label: s };
  },

  // 包裝成 RNG 物件，提供常用方法
  rng(seed) {
    const fn = this.mulberry32(seed);
    return {
      next: fn,
      range: (min, max) => min + fn() * (max - min),
      int: (min, max) => Math.floor(fn() * (max - min + 1)) + min,
      chance: (p) => fn() < p,
      pick: (arr) => arr[Math.floor(fn() * arr.length)],
      shuffle: (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(fn() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }
    };
  }
};
