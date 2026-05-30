# 荒野據點 Survival Outpost

純前端 (HTML + CSS + JavaScript + Canvas) 製作的 2D 俯視角生存遊戲，可直接部署到 GitHub Pages。
**無後端、無外部素材、無外部套件、無音檔**（所有音效由 Web Audio 即時合成）。

## 玩法

- 收集 **木 / 石 / 鐵 / 食物**
- 建造 **木牆、石牆、箭塔、篝火、工作台、陷阱**
- 升級 9 種被動技能 + 使用 4 種爆炸華麗的主動技能
- 在 **荒野商人** 處購買藥水、材料包、永久強化
- 撐過 15 波怪物，擊敗最終 Boss「荒野巨獸」

## 操作

| 按鍵 | 功能 |
|------|------|
| W / A / S / D | 移動 |
| 滑鼠左鍵 | 攻擊 / 放置建築 |
| E | 採集附近資源 |
| Space | 衝刺 |
| 1 / 2 / 3 | 切換 斧頭 / 鐵劍 / 弓箭 |
| **Q** | 🔥 火球術（爆炸 AOE） |
| **R** | ⚡ 雷霆風暴（多重閃電） |
| **G** | 💥 衝擊波（環狀擊退） |
| **V** | 💚 治癒術（補 HP / 體力 / 飢餓） |
| B | 建築選單 |
| T | 技能面板（升被動） |
| N | 商店（準備時段才能交易） |
| P | 暫停 |
| F | 存檔 / L 讀檔 |

## 怪物

- 史萊姆、野狼、哥布林、骷髏弓手、巨魔
- **小惡魔**（極速纏鬥）、**毒蜘蛛**（中毒 DoT）、**黑暗法師**（魔法球 AOE）
- 每 5 波出 Boss **荒野巨獸**
  - 召喚小怪 / 地震 AOE / 衝鋒 / 狂暴模式

## 商店

- 治療 / 魔力 / 體力藥水、乾糧
- 木 / 石 / 鐵 材料包
- 技能點 +1
- **永久強化**（每次購買漲價 50%）：最大 HP、最大 MP、攻擊、防禦

## 視覺亮點

- 粒子系統（火、煙、葉、血、火花、爆炸、震波環、傷害飄字）
- 螢幕震動 + 鏡頭平滑追隨
- 日夜系統（凌晨紫光、日出橘光、夜晚變暗、篝火光圈）
- 武器特效（扇形光）、衝刺殘影、發光投射物

## 在本機執行

VS Code 安裝 **Live Server** → 在 `index.html` 上右鍵 → Open with Live Server。
或直接雙擊 `index.html` 用瀏覽器開啟。

## 部署到 GitHub Pages

```bash
cd survival-outpost
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/<YOUR_USER>/survival-outpost.git
git push -u origin main
```
GitHub repo → **Settings → Pages** → Source: `Deploy from a branch`，Branch: `main` / `(root)`。
1~2 分鐘後在 `https://<YOUR_USER>.github.io/survival-outpost/` 上線。

## 專案架構

```
survival-outpost/
├── index.html
├── README.md
├── css/style.css
├── js/
│   ├── main.js          入口
│   ├── game.js          主迴圈 / 鏡頭 / 震動 / 商店整合
│   ├── player.js        玩家、主動技能呼叫、中毒、永久強化
│   ├── enemy.js         8 種小怪
│   ├── boss.js          Boss：召喚、地震、衝鋒、狂暴
│   ├── resource.js      樹/石/鐵/草/寶箱
│   ├── building.js      6 種建築（含發光、紋路、攻擊範圍光暈）
│   ├── weapon.js        武器表
│   ├── skill.js         9 被動 + 4 主動技能
│   ├── projectile.js    箭 / 火球 / 魔法球（含尾巴粒子）
│   ├── wave.js          波數 + 新怪物開放
│   ├── save.js          存讀檔（含永久強化）
│   ├── shop.js          商店物品 + 邏輯
│   ├── ui.js            HUD / 任務 / 冷卻 / 商店畫面
│   ├── input.js         鍵盤滑鼠 + 自動初始化音效
│   ├── collision.js     碰撞
│   ├── particle.js      粒子系統 + 傷害飄字
│   ├── audio.js         Web Audio 合成音效
│   └── utils.js         數學 / 文字 / 發光 / Toast
└── assets/README.md
```

## 平衡

- HP / MP / 體力 / 飢餓：100（可永久升）
- 速度：200 px/s（衝刺 560）
- 第一波 5 隻，每波 +3 隻，怪物強度 +12% / 波
- 每 5 波出 Boss（35% HP 以下狂暴）
- 第 15 波擊敗 Boss → 勝利

Have fun!
