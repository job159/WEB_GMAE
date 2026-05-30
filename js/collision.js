/* ================================================================
 * collision.js
 * 碰撞判定：圓形 vs 圓形、圓形 vs 方形、點 vs 方形
 * 大部分遊戲物件以「圓形」碰撞表示（x, y, radius）
 * 建築用「方形」碰撞（x, y, w, h）
 * ================================================================ */
const Collision = {

  // 圓形 vs 圓形
  circleCircle(a, b) {
    const r = a.radius + b.radius;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return (dx * dx + dy * dy) < r * r;
  },

  // 點 vs 矩形（矩形以中心為原點）
  pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx - rw / 2 && px <= rx + rw / 2 &&
           py >= ry - rh / 2 && py <= ry + rh / 2;
  },

  // 圓形 vs 矩形（矩形中心 + 寬高）
  circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = Utils.clamp(cx, rx - rw / 2, rx + rw / 2);
    const closestY = Utils.clamp(cy, ry - rh / 2, ry + rh / 2);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < cr * cr;
  },

  // 玩家試圖移動到 (nx, ny)，檢查會不會撞到建築或地圖邊界
  // 回傳可移動到的位置（簡單作法：分軸測試 X / Y）
  resolveMove(entity, nx, ny, buildings, mapW, mapH) {
    let x = nx;
    let y = ny;

    // 邊界
    x = Utils.clamp(x, entity.radius, mapW - entity.radius);
    y = Utils.clamp(y, entity.radius, mapH - entity.radius);

    // 對每個建築先測 X 軸
    for (const b of buildings) {
      if (!b.alive || !b.solid) continue;
      if (Collision.circleRect(x, entity.y, entity.radius, b.x, b.y, b.w, b.h)) {
        x = entity.x; // 回退 X
        break;
      }
    }
    // 再測 Y 軸
    for (const b of buildings) {
      if (!b.alive || !b.solid) continue;
      if (Collision.circleRect(x, y, entity.radius, b.x, b.y, b.w, b.h)) {
        y = entity.y;
        break;
      }
    }
    return { x, y };
  },

  // 判斷某個矩形位置是否可放下建築（避開所有實體與其他建築）
  canPlaceBuilding(rx, ry, rw, rh, game) {
    // 邊界
    if (rx - rw / 2 < 0 || ry - rh / 2 < 0) return false;
    if (rx + rw / 2 > game.mapW || ry + rh / 2 > game.mapH) return false;

    // 玩家
    if (Collision.circleRect(game.player.x, game.player.y, game.player.radius + 4, rx, ry, rw, rh)) return false;

    // 其他建築（重疊）
    for (const b of game.buildings) {
      if (!b.alive) continue;
      // AABB 重疊
      if (Math.abs(rx - b.x) < (rw + b.w) / 2 &&
          Math.abs(ry - b.y) < (rh + b.h) / 2) return false;
    }

    // 資源
    for (const r of game.resources) {
      if (!r.alive) continue;
      if (Collision.circleRect(r.x, r.y, r.radius, rx, ry, rw, rh)) return false;
    }

    // 怪物
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (Collision.circleRect(e.x, e.y, e.radius, rx, ry, rw, rh)) return false;
    }

    return true;
  }
};
