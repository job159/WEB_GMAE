# assets/

第一版遊戲全部使用 Canvas 的幾何圖形 + 顏色繪製，**不需要任何外部圖檔**。

之後若要替換成圖片素材，可放在這個資料夾，例如：

```
assets/
├── player.png
├── enemies/
│   ├── slime.png
│   └── wolf.png
└── tiles/
    └── grass.png
```

並在對應的 JS 檔（如 `js/player.js`、`js/enemy.js`）裡用 `Image()` 載入後，
改寫 `draw()` 使用 `ctx.drawImage(...)` 代替原本的幾何繪製即可。

**注意**：因為要部署到 GitHub Pages，請務必使用 **相對路徑**：
```js
const img = new Image();
img.src = 'assets/player.png'; // ← 相對路徑，OK
// img.src = '/assets/player.png';  ✗ 絕對路徑會在 GitHub Pages 子路徑下壞掉
```
