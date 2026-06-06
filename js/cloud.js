/* ================================================================
 * cloud.js
 * Supabase 雲端整合：匿名登入(輸入名字) / Discord / Google / 存檔 / 排行榜 / 成就
 * 重點：匿名玩家用「名字」當雲端身分，存檔以名字 + 槽位為主鍵 → 換裝置也能找回
 * 所有方法都包了 try/catch，失敗也不會影響遊戲本體
 * ================================================================ */
const Cloud = {
  URL: 'https://ifdpokqieznddirqxubq.supabase.co',
  KEY: 'sb_publishable_ph783RpTxEsuysLQijZxZA_F-VCWzhu',

  NAME_KEY: 'survival-outpost-player-name',  // localStorage：記住玩家輸入的名字

  client: null,
  user: null,
  ready: false,
  profile: null,
  playerName: null,        // 雲端存檔身分（匿名=玩家輸入；OAuth=平台名稱）
  _sessionLogged: false,   // 本次 session 是否已寫過 login_log

  // ===== 初始化（main.js 啟動時呼叫）=====
  init() {
    if (typeof supabase === 'undefined') {
      console.warn('[Cloud] Supabase script 未載入，雲端功能關閉');
      return;
    }
    try { this.playerName = localStorage.getItem(this.NAME_KEY) || null; } catch (e) {}
    try {
      this.client = supabase.createClient(this.URL, this.KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });

      // 監聽登入狀態變化（OAuth 跳轉回來會觸發）
      this.client.auth.onAuthStateChange(async (_event, session) => {
        const prev = this.user;
        this.user = session?.user || null;
        if (this.user && !prev) {
          await this.onSignedIn();
        } else {
          UI.refreshCloudStatus?.(this.user, this.profile);
        }
      });

      // 啟動時取目前 session
      this.client.auth.getSession().then(async ({ data }) => {
        this.ready = true;
        this.user = data.session?.user || null;
        if (!this.user) {
          // 沒登入：自動匿名（玩家不用註冊也能用雲端，名字稍後在選單輸入）
          await this.signInAnon();
        } else {
          await this.onSignedIn();
        }
        UI.refreshCloudStatus?.(this.user, this.profile);
      });
    } catch (e) {
      console.warn('[Cloud] init 失敗：', e);
    }
  },

  // 取得 session 後的共同處理（建 profile、合併成就、記錄登入）
  async onSignedIn() {
    await this.ensureProfile();
    await this.mergeCloudAchievements();
    if (this.user && !this.user.is_anonymous) {
      // OAuth：用平台名稱當存檔身分
      const nm = this.suggestName();
      if (nm) {
        this.playerName = nm;
        try { localStorage.setItem(this.NAME_KEY, nm); } catch (e) {}
      }
      await this.logLogin(this.user.app_metadata?.provider || 'oauth');
    } else if (this.playerName) {
      // 匿名且已有名字（回訪玩家）→ 記一筆登入
      await this.logLogin('anonymous');
    }
    UI.refreshCloudStatus?.(this.user, this.profile);
  },

  // 取得當前要顯示 / 存檔用的名稱
  suggestName() {
    if (!this.user) return this.playerName || 'Guest';
    const meta = this.user.user_metadata || {};
    if (!this.user.is_anonymous) {
      return meta.full_name || meta.name || meta.user_name ||
             (this.user.email ? this.user.email.split('@')[0] : null) ||
             `Player_${this.user.id.slice(0, 6)}`;
    }
    // 匿名：優先用玩家輸入的名字
    return this.playerName || `Guest_${this.user.id.slice(0, 6)}`;
  },

  // 匿名是否還沒輸入名字（UI 用來決定要不要跳輸入框）
  needsName() {
    return this.ready && this.isAnonymous() && !this.playerName;
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
        const name = this.playerName || this.suggestName();
        const { data: ins } = await this.client.from('profiles')
          .upsert({ id: this.user.id, display_name: name })
          .select().single();
        this.profile = ins;
      }
    } catch (e) {
      console.warn('[Cloud] ensureProfile', e);
    }
  },

  // 玩家在選單輸入 / 修改名字
  async setPlayerName(name) {
    name = String(name || '').trim().slice(0, 20);
    if (!name) return false;
    this.playerName = name;
    try { localStorage.setItem(this.NAME_KEY, name); } catch (e) {}
    await this.updateDisplayName(name);
    // 第一次取得名字時補記一筆登入（_sessionLogged 防重複）
    await this.logLogin(this.isAnonymous() ? 'anonymous' : (this.user?.app_metadata?.provider || 'oauth'));
    UI.refreshCloudStatus?.(this.user, this.profile);
    return true;
  },

  // 更新顯示名稱（profiles 表）
  async updateDisplayName(name) {
    if (!this.user || !this.client || !name) return false;
    try {
      const { error } = await this.client.from('profiles')
        .update({ display_name: name.slice(0, 20) }).eq('id', this.user.id);
      if (error) return false;
      this.profile = { ...this.profile, display_name: name.slice(0, 20) };
      return true;
    } catch (e) { return false; }
  },

  // 寫入登入紀錄（誰、什麼時間、用什麼方式）— 後台可匯出 CSV
  async logLogin(provider) {
    if (!this.client || this._sessionLogged) return;
    const name = this.playerName || this.suggestName();
    if (!name) return;
    this._sessionLogged = true;   // 先佔位，避免 onSignedIn 被觸發兩次而重複寫入
    try {
      await this.client.from('login_log').insert({
        user_id: this.user?.id || null,
        player_name: name,
        is_anonymous: this.isAnonymous(),
        provider: provider || (this.isAnonymous() ? 'anonymous' : 'oauth'),
        user_agent: (navigator.userAgent || '').slice(0, 200)
      });
    } catch (e) { console.warn('[Cloud] logLogin', e); }
  },

  // ===== 登入 / 登出 =====
  async signInAnon() {
    if (!this.client) return;
    try {
      const { data, error } = await this.client.auth.signInAnonymously();
      if (error) { console.warn('[Cloud] 匿名登入失敗：', error); return; }
      this.user = data.user;
      await this.onSignedIn();
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
    this._sessionLogged = false;
    // 自動切回匿名（玩家不會「斷線」）
    await this.signInAnon();
    UI.refreshCloudStatus?.(this.user, this.profile);
  },

  isAnonymous() {
    return !!this.user?.is_anonymous;
  },

  // ===== 存檔（以「名字 + 槽位」為主鍵）=====
  async saveToCloud(slot, game) {
    if (!this.client) return false;
    const name = this.playerName || this.suggestName();
    if (!name) return false;
    try {
      const data = Save.serialize(game);
      const { error } = await this.client.from('saves').upsert({
        player_name: name,
        user_id: this.user?.id || null,
        slot,
        data,
        wave: data.wave,
        level: data.player?.level || 1,
        class_id: data.player?.classId || 'warrior',
        score: data.score || 0,
        mode: data.mode || 'normal',
        updated_at: new Date().toISOString()
      }, { onConflict: 'player_name,slot' });
      if (error) { console.warn('[Cloud] saveToCloud', error); return false; }
      return true;
    } catch (e) { console.warn(e); return false; }
  },

  async loadFromCloud(slot, game) {
    if (!this.client) return false;
    const name = this.playerName || this.suggestName();
    if (!name) return false;
    try {
      const { data, error } = await this.client.from('saves')
        .select('data').eq('player_name', name).eq('slot', slot).maybeSingle();
      if (error || !data) return false;
      Save.applyToGame(game, data.data);
      return true;
    } catch (e) { console.warn(e); return false; }
  },

  async listCloudSaves() {
    if (!this.client) return [];
    const name = this.playerName || this.suggestName();
    if (!name) return [];
    try {
      const { data } = await this.client.from('saves')
        .select('slot, wave, level, class_id, score, mode, updated_at')
        .eq('player_name', name).order('slot');
      return data || [];
    } catch (e) { return []; }
  },

  async deleteCloud(slot) {
    if (!this.client) return;
    const name = this.playerName || this.suggestName();
    if (!name) return;
    try {
      await this.client.from('saves').delete()
        .eq('player_name', name).eq('slot', slot);
    } catch (e) { console.warn(e); }
  },

  // ===== 排行榜 =====
  async submitScore(game) {
    if (!this.user || !this.client) return;
    if (!game.stats?.victory) return; // 只記錄通關
    try {
      const name = this.playerName || this.profile?.display_name || this.suggestName();
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
