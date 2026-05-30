/* ================================================================
 * cloud.js
 * Supabase 雲端整合：匿名登入 / Discord / Google / 存檔 / 排行榜 / 成就
 * 所有方法都包了 try/catch，失敗也不會影響遊戲本體
 * ================================================================ */
const Cloud = {
  URL: 'https://ifdpokqieznddirqxubq.supabase.co',
  KEY: 'sb_publishable_ph783RpTxEsuysLQijZxZA_F-VCWzhu',

  client: null,
  user: null,
  ready: false,
  profile: null,

  // ===== 初始化（main.js 啟動時呼叫）=====
  init() {
    if (typeof supabase === 'undefined') {
      console.warn('[Cloud] Supabase script 未載入，雲端功能關閉');
      return;
    }
    try {
      this.client = supabase.createClient(this.URL, this.KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });

      // 監聽登入狀態變化（OAuth 跳轉回來會觸發）
      this.client.auth.onAuthStateChange(async (_event, session) => {
        const prev = this.user;
        this.user = session?.user || null;
        if (this.user && !prev) {
          await this.ensureProfile();
          // 登入後拉雲端成就合併到本地
          await this.mergeCloudAchievements();
        }
        UI.refreshCloudStatus?.(this.user, this.profile);
      });

      // 啟動時取目前 session
      this.client.auth.getSession().then(async ({ data }) => {
        this.user = data.session?.user || null;
        this.ready = true;
        if (!this.user) {
          // 沒登入：自動匿名（玩家不用註冊也能用雲端）
          await this.signInAnon();
        } else {
          await this.ensureProfile();
          await this.mergeCloudAchievements();
        }
        UI.refreshCloudStatus?.(this.user, this.profile);
      });
    } catch (e) {
      console.warn('[Cloud] init 失敗：', e);
    }
  },

  // 取得當前要顯示的名稱
  suggestName() {
    if (!this.user) return 'Guest';
    const meta = this.user.user_metadata || {};
    return meta.full_name || meta.name || meta.user_name ||
           (this.user.email ? this.user.email.split('@')[0] : null) ||
           (this.user.is_anonymous ? `Guest_${this.user.id.slice(0, 6)}` : `Player_${this.user.id.slice(0, 6)}`);
  },

  // 建立 / 更新 profile
  async ensureProfile() {
    if (!this.user || !this.client) return;
    try {
      const { data } = await this.client.from('profiles')
        .select('*').eq('id', this.user.id).maybeSingle();
      if (data) {
        this.profile = data;
      } else {
        const name = this.suggestName();
        const { data: ins } = await this.client.from('profiles')
          .upsert({ id: this.user.id, display_name: name })
          .select().single();
        this.profile = ins;
      }
    } catch (e) {
      console.warn('[Cloud] ensureProfile', e);
    }
  },

  // 更新顯示名稱
  async updateDisplayName(name) {
    if (!this.user || !this.client || !name) return false;
    try {
      const { error } = await this.client.from('profiles')
        .update({ display_name: name.slice(0, 20) }).eq('id', this.user.id);
      if (error) return false;
      this.profile = { ...this.profile, display_name: name.slice(0, 20) };
      UI.refreshCloudStatus?.(this.user, this.profile);
      return true;
    } catch (e) { return false; }
  },

  // ===== 登入 / 登出 =====
  async signInAnon() {
    if (!this.client) return;
    try {
      const { data, error } = await this.client.auth.signInAnonymously();
      if (error) { console.warn('[Cloud] 匿名登入失敗：', error); return; }
      this.user = data.user;
      await this.ensureProfile();
    } catch (e) { console.warn(e); }
  },

  loginDiscord() {
    if (!this.client) return;
    const redirect = location.href.split('?')[0].split('#')[0];
    return this.client.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: redirect }
    });
  },
  loginGoogle() {
    if (!this.client) return;
    const redirect = location.href.split('?')[0].split('#')[0];
    return this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirect }
    });
  },

  async logout() {
    if (!this.client) return;
    await this.client.auth.signOut();
    this.user = null;
    this.profile = null;
    // 自動切回匿名（玩家不會「斷線」）
    await this.signInAnon();
    UI.refreshCloudStatus?.(this.user, this.profile);
  },

  isAnonymous() {
    return !!this.user?.is_anonymous;
  },

  // ===== 存檔 =====
  async saveToCloud(slot, game) {
    if (!this.user || !this.client) return false;
    try {
      const data = Save.serialize(game);
      const { error } = await this.client.from('saves').upsert({
        user_id: this.user.id,
        slot,
        data,
        wave: data.wave,
        level: data.player?.level || 1,
        class_id: data.player?.classId || 'warrior',
        score: data.score || 0,
        mode: data.mode || 'normal',
        updated_at: new Date().toISOString()
      });
      if (error) { console.warn('[Cloud] saveToCloud', error); return false; }
      return true;
    } catch (e) { console.warn(e); return false; }
  },

  async loadFromCloud(slot, game) {
    if (!this.user || !this.client) return false;
    try {
      const { data, error } = await this.client.from('saves')
        .select('data').eq('user_id', this.user.id).eq('slot', slot).maybeSingle();
      if (error || !data) return false;
      Save.applyToGame(game, data.data);
      return true;
    } catch (e) { console.warn(e); return false; }
  },

  async listCloudSaves() {
    if (!this.user || !this.client) return [];
    try {
      const { data } = await this.client.from('saves')
        .select('slot, wave, level, class_id, score, mode, updated_at')
        .eq('user_id', this.user.id).order('slot');
      return data || [];
    } catch (e) { return []; }
  },

  async deleteCloud(slot) {
    if (!this.user || !this.client) return;
    try {
      await this.client.from('saves').delete()
        .eq('user_id', this.user.id).eq('slot', slot);
    } catch (e) { console.warn(e); }
  },

  // ===== 排行榜 =====
  async submitScore(game) {
    if (!this.user || !this.client) return;
    if (!game.stats?.victory) return; // 只記錄通關
    try {
      const name = this.profile?.display_name || this.suggestName();
      const score = Math.min(9999999, Math.max(0, game.score || 0));
      const wave = Math.min(15, Math.max(1, game.waveManager.current));
      const cls = game.stats.classId || 'warrior';
      const mode = ['normal', 'daily', 'ngplus'].includes(game.stats.mode) ? game.stats.mode : 'normal';
      const seed = mode === 'daily' ? PRNG.todaySeed().label : null;
      const dur = Math.min(86400, Math.max(0, Math.round(game.stats.timePlayed())));
      const { error } = await this.client.from('scores').insert({
        user_id: this.user.id,
        display_name: name,
        score, wave, class_id: cls, mode,
        daily_seed: seed,
        duration_sec: dur
      });
      if (error) console.warn('[Cloud] submitScore', error);
      else Utils.toast('分數已上傳排行榜');
    } catch (e) { console.warn(e); }
  },

  async topScores(mode = 'normal', limit = 50) {
    if (!this.client) return [];
    try {
      const { data } = await this.client.from('scores')
        .select('display_name, score, wave, class_id, created_at, duration_sec')
        .eq('mode', mode)
        .order('score', { ascending: false })
        .limit(limit);
      return data || [];
    } catch (e) { return []; }
  },

  async dailyScores(seed) {
    if (!this.client) return [];
    try {
      const { data } = await this.client.from('scores')
        .select('display_name, score, wave, class_id, duration_sec, created_at')
        .eq('daily_seed', seed)
        .order('score', { ascending: false })
        .limit(100);
      return data || [];
    } catch (e) { return []; }
  },

  // ===== 成就 =====
  async syncAchievement(achievementId) {
    if (!this.user || !this.client) return;
    try {
      await this.client.from('achievements').upsert({
        user_id: this.user.id,
        achievement_id: achievementId
      });
    } catch (e) {}
  },

  async fetchAchievements() {
    if (!this.user || !this.client) return [];
    try {
      const { data } = await this.client.from('achievements')
        .select('achievement_id').eq('user_id', this.user.id);
      return (data || []).map(d => d.achievement_id);
    } catch (e) { return []; }
  },

  // 把雲端成就合併進本地 Meta 並反向把本地未上傳的推上去
  async mergeCloudAchievements() {
    const remote = await this.fetchAchievements();
    if (!remote.length) {
      // 雲端沒有 → 把本地全部上傳
      for (const id of Meta.data.unlocked) this.syncAchievement(id);
      return;
    }
    let added = 0;
    for (const id of remote) {
      if (!Meta.data.unlocked.includes(id)) {
        Meta.data.unlocked.push(id);
        added++;
      }
    }
    // 本地獨有的也上傳
    for (const id of Meta.data.unlocked) {
      if (!remote.includes(id)) this.syncAchievement(id);
    }
    if (added > 0) {
      Meta.save();
      Utils.toast(`同步雲端成就 +${added}`);
    }
  }
};
