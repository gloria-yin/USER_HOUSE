const WIDTH = 900;
const HEIGHT = 620;
const BALL_RADIUS = 17;
const BALL_SPACING = BALL_RADIUS * 1.86;
const COLORS = ['#ef5b5b', '#f7b84b', '#50b96b', '#4b8ee8', '#9a69df', '#f06fb2'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cubicPoint(a, b, c, d, t) {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

export function createZumaPath() {
  const segments = [
    [{ x:-45, y:92 }, { x:230, y:35 }, { x:650, y:55 }, { x:820, y:105 }],
    [{ x:820, y:105 }, { x:920, y:180 }, { x:890, y:445 }, { x:795, y:505 }],
    [{ x:795, y:505 }, { x:610, y:590 }, { x:230, y:570 }, { x:110, y:500 }],
    [{ x:110, y:500 }, { x:20, y:420 }, { x:25, y:255 }, { x:135, y:215 }],
    [{ x:135, y:215 }, { x:270, y:160 }, { x:650, y:165 }, { x:720, y:235 }],
    [{ x:720, y:235 }, { x:790, y:300 }, { x:755, y:395 }, { x:682, y:405 }],
  ];
  const points = [];
  segments.forEach((segment, segmentIndex) => {
    for (let i = segmentIndex ? 1 : 0; i <= 55; i++) {
      points.push(cubicPoint(segment[0], segment[1], segment[2], segment[3], i / 55));
    }
  });
  let distance = 0;
  points.forEach((point, index) => {
    if (index) distance += Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y);
    point.s = distance;
  });
  return { points, length:distance };
}

export function zumaPointAt(path, distance) {
  const s = clamp(Number(distance) || 0, 0, path.length);
  let low = 0;
  let high = path.points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (path.points[mid].s < s) low = mid + 1;
    else high = mid;
  }
  const right = path.points[low];
  const left = path.points[Math.max(0, low - 1)];
  const span = Math.max(1, right.s - left.s);
  const t = clamp((s - left.s) / span, 0, 1);
  return { x:left.x + (right.x - left.x) * t, y:left.y + (right.y - left.y) * t };
}

export function zumaColorCountForProgress(totalBallsGenerated) {
  return Math.min(6, 4 + Math.floor(Math.max(0, (Number(totalBallsGenerated) || 0) - 24) / 120));
}

export function zumaSpeedForState(score, cleared, ballCount, slowRemaining = 0) {
  const count = Math.max(0, Number(ballCount) || 0);
  const raw = 27
    + Math.max(0, Number(score) || 0) / 450
    + Math.max(0, Number(cleared) || 0) / 22
    + Math.max(0, count - 24) * .45;
  const sparseFactor = count >= 24 ? 1 : .7 + count / 24 * .3;
  return Math.min(84, raw) * sparseFactor * (Number(slowRemaining) > 0 ? .38 : 1);
}

export function createZumaChain(ballCount = 24, random = Math.random, colorCount = 4) {
  const count = Math.max(1, Math.floor(Number(ballCount) || 24));
  const colors = clamp(Math.floor(Number(colorCount) || 4), 2, COLORS.length);
  const chain = [];
  for (let i = 0; i < count; i++) {
    let color = Math.floor(random() * colors);
    if (i >= 2 && chain[i - 1].color === color && chain[i - 2].color === color) {
      color = (color + 1 + Math.floor(random() * (colors - 1))) % colors;
    }
    chain.push({ color, s:28 + i * BALL_SPACING });
  }
  return chain;
}

function ensureStyles(doc) {
  if (doc.getElementById('wb-zuma-module-css')) return;
  const style = doc.createElement('style');
  style.id = 'wb-zuma-module-css';
  style.textContent = `
    .wb-zuma-shell{width:100%;height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:7px;overflow:hidden;place-items:center}
    .wb-zuma-top{width:min(760px,100%);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
    .wb-zuma-stat{min-width:0;height:38px;display:grid;grid-template-rows:12px 1fr;place-items:center;padding:3px 6px;border:1px solid var(--wb-border);background:var(--wb-panel);box-sizing:border-box}
    .wb-zuma-stat span{font-size:9px;font-weight:800;color:var(--wb-muted);line-height:1}
    .wb-zuma-stat b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:1.1;color:var(--wb-text)}
    .wb-zuma-stage{position:relative;width:min(760px,100%,calc(100cqh - 92px));aspect-ratio:45/31;min-height:0;overflow:hidden;border:1px solid color-mix(in srgb,var(--wb-border) 72%,#187b65 28%);background:#e8f3de;box-shadow:0 12px 26px rgba(27,78,66,.14)}
    .wb-zuma-canvas{display:block;width:100%;height:100%;touch-action:none;user-select:none;cursor:crosshair}
    .wb-zuma-banner{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);z-index:3;padding:7px 13px;background:rgba(22,48,39,.88);color:#fff;font-size:13px;font-weight:900;pointer-events:none;opacity:0;transition:opacity .18s}
    .wb-zuma-banner.show{opacity:1}
    .wb-zuma-swap{position:absolute;right:9px;bottom:9px;width:34px;height:34px;border:1px solid rgba(39,71,62,.25);border-radius:50%;background:rgba(255,255,255,.86);color:#285447;font-size:20px;line-height:1;cursor:pointer}
    .wb-zuma-tools{width:min(760px,100%);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
    .wb-zuma-tool{min-width:0;min-height:35px;padding:5px 8px;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
    .wb-zuma-tool.active{box-shadow:inset 0 0 0 2px var(--wb-gold);background:color-mix(in srgb,var(--wb-gold) 22%,var(--wb-panel) 78%)}
    .wb-zuma-tool i{font-style:normal;font-size:16px}
    @media(max-width:560px){
      .wb-zuma-shell{gap:5px}
      .wb-zuma-top{gap:4px}
      .wb-zuma-stat{height:33px;padding:2px 3px}
      .wb-zuma-stat b{font-size:11px}
      .wb-zuma-stage{width:min(100%,calc(100cqh - 79px));max-height:100%}
      .wb-zuma-tools{gap:4px}
      .wb-zuma-tool{min-height:31px;padding:3px 4px;font-size:11px}
      .wb-zuma-tool i{font-size:14px}
    }
  `;
  doc.head.appendChild(style);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawBall(ctx, x, y, color, radius, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const gradient = ctx.createRadialGradient(x - radius * .35, y - radius * .42, radius * .12, x, y, radius);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(.16, color);
  gradient.addColorStop(1, color);
  ctx.fillStyle = gradient;
  ctx.shadowColor = 'rgba(25,47,42,.26)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(35,53,48,.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function createZumaGame(state, env) {
  const doc = env.document;
  const win = env.window;
  const root = env.root;
  ensureStyles(doc);
  root.innerHTML = '<div class="wb-zuma-shell"><div class="wb-zuma-top"><div class="wb-zuma-stat"><span>分数</span><b id="wb-zuma-score"></b></div><div class="wb-zuma-stat"><span>珠链</span><b id="wb-zuma-left"></b></div><div class="wb-zuma-stat"><span>速度</span><b id="wb-zuma-speed"></b></div><div class="wb-zuma-stat"><span>最高连锁</span><b id="wb-zuma-combo"></b></div></div><div class="wb-zuma-stage"><canvas class="wb-zuma-canvas" id="wb-zuma-canvas" width="' + WIDTH + '" height="' + HEIGHT + '"></canvas><div class="wb-zuma-banner" id="wb-zuma-banner"></div><button type="button" class="wb-zuma-swap" id="wb-zuma-swap" title="交换当前与下一颗珠子" aria-label="交换当前与下一颗珠子">⇄</button></div><div class="wb-zuma-tools"><button type="button" class="wb-btn wb-zuma-tool" data-tool="bomb"><i>●</i>炸弹 <b id="wb-zuma-bomb"></b></button><button type="button" class="wb-btn wb-zuma-tool" data-tool="slow"><i>◷</i>减速 <b id="wb-zuma-slow"></b></button><button type="button" class="wb-btn wb-zuma-tool" data-tool="rainbow"><i>◆</i>彩虹 <b id="wb-zuma-rainbow"></b></button></div></div>';

  const canvas = root.querySelector('#wb-zuma-canvas');
  const ctx = canvas.getContext('2d');
  const path = createZumaPath();
  const frog = { x:450, y:355 };
  let chain = Array.isArray(state?.chain) && state.chain.length
    ? state.chain.map(ball => ({ color:clamp(Number(ball.color) || 0, 0, 5), s:Number(ball.s) || 0 })).sort((a, b) => a.s - b.s)
    : createZumaChain();
  let score = Math.max(0, Number(state?.score) || 0);
  let tools = Object.assign({ bomb:3, slow:3, rainbow:3 }, state?.tools || {});
  const restoredDetails = state?.details || {};
  let details = Object.assign({ shots:0, misses:0, cleared:0, maxCombo:0, dangerCount:0, bombUsed:0, slowUsed:0, rainbowUsed:0, totalBallsGenerated:chain.length, maxSpeed:0, clearAllCount:0 }, restoredDetails);
  details.totalBallsGenerated = Math.max(chain.length, Number(restoredDetails.totalBallsGenerated) || chain.length);
  let current = Number.isInteger(state?.current) ? state.current : randomActiveColor();
  let next = Number.isInteger(state?.next) ? state.next : randomActiveColor();
  const restoredSeen = state?.seen || {};
  let seen = Object.assign({ dangerActive:0, speedMark:0, spawnMark:0 }, restoredSeen);
  seen.dangerActive = 0;
  seen.spawnMark = Math.max(Number(seen.spawnMark) || 0, Math.floor(details.totalBallsGenerated / 50));
  let aim = Number(state?.aim) || 0;
  let shot = null;
  let armed = '';
  let slowRemaining = Math.max(0, Number(state?.slowRemaining) || 0);
  let raf = 0;
  let destroyed = false;
  let lastFrame = 0;
  let lastSave = 0;
  let spawnProgress = Math.max(0, Number(state?.spawnProgress) || 0);
  let particles = [];
  let resolution = restoreResolution(state?.resolution);
  let aiming = false;
  let keyboardHandler = null;

  function q(selector) {
    return root.querySelector(selector);
  }

  function restoreResolution(saved) {
    if (!saved || !chain.length) return null;
    if (saved.phase === 'burst') {
      const left = clamp(Math.floor(Number(saved.left) || 0), 0, chain.length - 1);
      const count = clamp(Math.floor(Number(saved.count) || 0), 1, chain.length - left);
      const duration = Math.max(.08, Number(saved.duration) || .3);
      return {
        phase:'burst',
        elapsed:clamp(Number(saved.elapsed) || 0, 0, duration),
        duration,
        left,
        count,
        color:clamp(Number(saved.color) || 0, 0, COLORS.length - 1),
        combo:Math.max(1, Math.floor(Number(saved.combo) || 1)),
        type:saved.type === 'bomb' ? 'bomb' : 'match',
        gained:Math.max(0, Number(saved.gained) || 0),
      };
    }
    if (saved.phase !== 'rollback') return null;
    const junction = clamp(Math.floor(Number(saved.junction) || 0), 0, chain.length);
    const movers = chain.slice(junction);
    if (!movers.length) return null;
    const duration = Math.max(.08, Number(saved.duration) || .35);
    return {
      phase:'rollback',
      elapsed:clamp(Number(saved.elapsed) || 0, 0, duration),
      duration,
      amount:Math.max(0, Number(saved.amount) || 0),
      lastEase:clamp(Number(saved.lastEase) || 0, 0, 1),
      movers,
      junction,
      nextCombo:Math.max(1, Math.floor(Number(saved.nextCombo) || 1)),
    };
  }

  function resolutionData() {
    if (!resolution) return null;
    if (resolution.phase === 'burst') {
      return {
        phase:resolution.phase,
        elapsed:resolution.elapsed,
        duration:resolution.duration,
        left:resolution.left,
        count:resolution.count,
        color:resolution.color,
        combo:resolution.combo,
        type:resolution.type,
        gained:resolution.gained,
      };
    }
    return {
      phase:resolution.phase,
      elapsed:resolution.elapsed,
      duration:resolution.duration,
      amount:resolution.amount,
      lastEase:resolution.lastEase,
      junction:resolution.junction,
      nextCombo:resolution.nextCombo,
    };
  }

  function randomActiveColor() {
    const present = Array.from(new Set(chain.map(ball => ball.color)));
    const colorCount = zumaColorCountForProgress(details.totalBallsGenerated);
    const pool = present.length ? present : Array.from({ length:colorCount }, (_, i) => i);
    return pool[Math.floor(Math.random() * pool.length)] || 0;
  }

  function spawnIncomingBall() {
    const colorCount = zumaColorCountForProgress(details.totalBallsGenerated);
    let color = Math.floor(Math.random() * colorCount);
    if (chain.length >= 2 && chain[0].color === color && chain[1].color === color) {
      color = (color + 1 + Math.floor(Math.random() * (colorCount - 1))) % colorCount;
    }
    const s = chain.length ? Math.max(0, chain[0].s - BALL_SPACING) : 0;
    chain.unshift({ color, s });
    details.totalBallsGenerated++;
    const spawnMark = Math.floor(details.totalBallsGenerated / 50);
    if (spawnMark > seen.spawnMark) env.speak('spawn_pressure');
    seen.spawnMark = Math.max(seen.spawnMark || 0, spawnMark);
    updateUI();
  }

  function stateData() {
    return { chain:chain.map(ball => ({ color:ball.color, s:ball.s })), score, current, next, tools:Object.assign({}, tools), slowRemaining, spawnProgress, aim, resolution:resolutionData(), details:Object.assign({}, details), seen:Object.assign({}, seen) };
  }

  function save(force) {
    if (!destroyed) env.save(stateData(), force);
  }

  function showBanner(text, duration = 700) {
    const banner = q('#wb-zuma-banner');
    if (!banner) return;
    banner.textContent = text;
    banner.classList.add('show');
    win.setTimeout(() => {
      if (banner && banner.isConnected) banner.classList.remove('show');
    }, duration);
  }

  function updateUI() {
    const fields = [
      ['#wb-zuma-score', score],
      ['#wb-zuma-left', chain.length],
      ['#wb-zuma-speed', Math.round(chainSpeed()) + (slowRemaining > 0 ? ' 减速' : '')],
      ['#wb-zuma-combo', '×' + (details.maxCombo || 0)],
      ['#wb-zuma-bomb', tools.bomb],
      ['#wb-zuma-slow', tools.slow],
      ['#wb-zuma-rainbow', tools.rainbow],
    ];
    fields.forEach(([selector, value]) => {
      const el = q(selector);
      if (el) el.textContent = String(value);
    });
    root.querySelectorAll('.wb-zuma-tool').forEach(button => {
      const tool = button.dataset.tool;
      button.classList.toggle('active', armed === tool || (tool === 'slow' && slowRemaining > 0));
      button.disabled = destroyed || (Number(tools[tool]) || 0) <= 0 || !!shot || !!resolution;
    });
    const swap = q('#wb-zuma-swap');
    if (swap) swap.disabled = destroyed || !!shot || !!resolution || !!armed;
  }

  function nearestPathDistance(x, y) {
    let best = 0;
    let distance = Infinity;
    path.points.forEach(point => {
      const d = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (d < distance) {
        distance = d;
        best = point.s;
      }
    });
    return best;
  }

  function addBurst(indices, color) {
    indices.forEach(index => {
      const point = zumaPointAt(path, index);
      for (let i = 0; i < 7; i++) {
        particles.push({
          x:point.x,
          y:point.y,
          vx:(Math.random() - .5) * 175,
          vy:(Math.random() - .72) * 165,
          life:.62,
          color:COLORS[color] || '#fff',
        });
      }
    });
  }

  function removalBounds(index) {
    if (index < 0 || index >= chain.length) return null;
    const color = chain[index].color;
    let left = index;
    let right = index;
    while (left > 0 && chain[left - 1].color === color) left--;
    while (right + 1 < chain.length && chain[right + 1].color === color) right++;
    return { left, right, count:right - left + 1, color };
  }

  function beginBurst(bounds, combo, type = 'match') {
    const gained = type === 'bomb'
      ? bounds.count * 14
      : bounds.count * 10 + Math.max(0, combo - 1) * bounds.count * 18;
    resolution = {
      phase:'burst',
      elapsed:0,
      duration:type === 'bomb' ? .34 : .3,
      left:bounds.left,
      count:bounds.count,
      color:bounds.color,
      combo,
      type,
      gained,
    };
    const burstingBalls = chain.slice(bounds.left, bounds.right + 1);
    if (type === 'bomb') burstingBalls.forEach(ball => addBurst([ball.s], ball.color));
    else addBurst(burstingBalls.map(ball => ball.s), bounds.color);
    if (type === 'bomb') {
      env.speak(bounds.count >= 5 ? 'bomb_big' : 'bomb');
      showBanner('炸弹 +' + gained, 520);
    } else {
      details.maxCombo = Math.max(details.maxCombo || 0, combo);
      env.speak(combo >= 2 ? 'chain' : (bounds.count >= 5 ? 'clear_5' : 'clear'));
      showBanner((combo >= 2 ? '连锁 ×' + combo + '  ' : '') + '+' + gained, 520);
    }
    updateUI();
  }

  function startMatch(index, combo = 1) {
    const bounds = removalBounds(index);
    if (!bounds || bounds.count < 3) return false;
    beginBurst(bounds, combo);
    return true;
  }

  function startBomb(index) {
    const left = Math.max(0, index - 2);
    const count = Math.min(chain.length - left, 5);
    if (!count) return false;
    beginBurst({ left, right:left + count - 1, count, color:chain[index]?.color || 0 }, 1, 'bomb');
    return true;
  }

  function applyRemoval(result) {
    const removed = chain.splice(result.left, result.count);
    score += result.gained;
    details.cleared += removed.length;
    env.setScore(score);
    updateUI();
    if (!chain.length) {
      resolution = null;
      rewardClearAll();
      updateUI();
      save();
      return;
    }
    const movers = chain.slice(result.left);
    if (!movers.length) {
      resolution = null;
      updateUI();
      save();
      return;
    }
    resolution = {
      phase:'rollback',
      elapsed:0,
      duration:Math.min(.58, .26 + result.count * .045),
      amount:result.count * BALL_SPACING,
      lastEase:0,
      movers,
      junction:result.left,
      nextCombo:result.type === 'bomb' ? 2 : result.combo + 1,
    };
  }

  function updateResolution(delta) {
    if (!resolution) return;
    const active = resolution;
    active.elapsed += delta;
    if (active.phase === 'burst') {
      if (active.elapsed >= active.duration) applyRemoval(active);
      return;
    }
    const progress = clamp(active.elapsed / active.duration, 0, 1);
    const eased = 1 - (1 - progress) ** 3;
    const shift = active.amount * Math.max(0, eased - active.lastEase);
    active.movers.forEach(ball => {
      ball.s = Math.max(0, ball.s - shift);
    });
    active.lastEase = eased;
    if (progress < 1) return;
    const junction = active.junction;
    const nextCombo = active.nextCombo;
    resolution = null;
    if (!startMatch(Math.min(junction, chain.length - 1), nextCombo)) {
      updateUI();
      save();
    }
  }

  function rewardClearAll() {
    if (chain.length) return;
    const bonus = 600;
    score += bonus;
    details.clearAllCount++;
    spawnProgress = 0;
    env.setScore(score);
    env.speak('clear_all');
    showBanner('珠链清空 +' + bonus, 750);
  }

  function settleShot(hitIndex) {
    const special = shot.special;
    let startedResolution = false;
    if (special === 'bomb') {
      startedResolution = startBomb(hitIndex);
    } else {
      const projected = nearestPathDistance(shot.x, shot.y);
      const color = special === 'rainbow' ? chain[hitIndex].color : shot.color;
      let insertAt = chain.findIndex(ball => ball.s > projected);
      if (insertAt < 0) insertAt = chain.length;
      const inserted = { color, s:projected };
      chain.splice(insertAt, 0, inserted);
      chain.sort((a, b) => a.s - b.s);
      for (let i = 1; i < chain.length; i++) {
        if (chain[i].s < chain[i - 1].s + BALL_SPACING) chain[i].s = chain[i - 1].s + BALL_SPACING;
      }
      startedResolution = startMatch(chain.indexOf(inserted));
      if (special === 'rainbow') env.speak('rainbow');
    }
    shot = null;
    updateUI();
    if (!startedResolution) save();
  }

  function fire() {
    if (destroyed || env.isPaused() || shot || resolution) return;
    const special = armed;
    if (special && special !== 'bomb' && special !== 'rainbow') return;
    if (special) {
      if ((tools[special] || 0) <= 0) return;
      tools[special]--;
      details[special + 'Used'] = (details[special + 'Used'] || 0) + 1;
    }
    const color = current;
    shot = {
      x:frog.x + Math.cos(aim) * 37,
      y:frog.y + Math.sin(aim) * 37,
      vx:Math.cos(aim) * 650,
      vy:Math.sin(aim) * 650,
      color,
      special,
    };
    current = next;
    next = randomActiveColor();
    armed = '';
    details.shots++;
    env.speak('shoot');
    updateUI();
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x:(event.clientX - rect.left) * WIDTH / Math.max(1, rect.width),
      y:(event.clientY - rect.top) * HEIGHT / Math.max(1, rect.height),
    };
  }

  function setAim(event) {
    const point = pointerPosition(event);
    aim = Math.atan2(point.y - frog.y, point.x - frog.x);
  }

  function chainSpeed() {
    return zumaSpeedForState(score, details.cleared, chain.length, slowRemaining);
  }

  function finishGame() {
    if (destroyed) return;
    const finalDetails = Object.assign({}, details, { score, remaining:chain.length });
    destroy();
    env.clear();
    env.setScore(score);
    env.speak('gameover');
    env.finish('珠链进洞', '本局分数：' + score + '分，生成' + details.totalBallsGenerated + '颗，消除' + details.cleared + '颗，最高连锁×' + (details.maxCombo || 0), { outcome:'score', score }, { score, maxCombo:details.maxCombo || 0, details:finalDetails });
  }

  function update(delta) {
    if (env.isPaused()) return;
    const wasSlowed = slowRemaining > 0;
    if (slowRemaining > 0) slowRemaining = Math.max(0, slowRemaining - delta * 1000);
    if (wasSlowed && slowRemaining === 0) updateUI();
    if (!chain.length && !shot && !resolution) spawnIncomingBall();
    const baseSpeed = zumaSpeedForState(score, details.cleared, chain.length);
    details.maxSpeed = Math.max(Number(details.maxSpeed) || 0, Math.round(baseSpeed * 10) / 10);
    const speedMark = Math.floor(baseSpeed / 10);
    if (seen.speedMark && speedMark > seen.speedMark) env.speak('speed_up');
    seen.speedMark = Math.max(seen.speedMark || 0, speedMark);
    const animationSpeedFactor = resolution ? (resolution.phase === 'burst' ? .16 : .1) : 1;
    const advance = chainSpeed() * delta * animationSpeedFactor;
    chain.forEach(ball => { ball.s += advance; });
    spawnProgress += advance;
    while (!resolution && spawnProgress >= BALL_SPACING) {
      spawnProgress -= BALL_SPACING;
      spawnIncomingBall();
    }
    updateResolution(delta);
    const front = chain[chain.length - 1];
    if (front && front.s >= path.length - 150 && !seen.dangerActive) {
      seen.dangerActive = 1;
      details.dangerCount++;
      env.speak('danger');
    } else if (front && front.s < path.length - 260) {
      seen.dangerActive = 0;
    }
    if (front && front.s >= path.length - 3 && !resolution) {
      finishGame();
      return;
    }

    if (shot) {
      shot.x += shot.vx * delta;
      shot.y += shot.vy * delta;
      let hit = -1;
      for (let i = 0; i < chain.length; i++) {
        const point = zumaPointAt(path, chain[i].s);
        if (Math.hypot(point.x - shot.x, point.y - shot.y) <= BALL_RADIUS * 1.72) {
          hit = i;
          break;
        }
      }
      if (hit >= 0) settleShot(hit);
      else if (shot.x < -45 || shot.x > WIDTH + 45 || shot.y < -45 || shot.y > HEIGHT + 45) {
        shot = null;
        details.misses++;
        env.speak('miss');
        updateUI();
        save();
      }
    }

    particles.forEach(particle => {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 170 * delta;
      particle.life -= delta;
    });
    particles = particles.filter(particle => particle.life > 0);

  }

  function drawTrack() {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    path.points.forEach((point, index) => {
      if (!index) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = '#9b7954';
    ctx.lineWidth = 48;
    ctx.stroke();
    ctx.strokeStyle = '#d4b781';
    ctx.lineWidth = 37;
    ctx.stroke();
    ctx.setLineDash([7, 12]);
    ctx.strokeStyle = 'rgba(87,71,48,.28)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawFrog() {
    ctx.save();
    ctx.translate(frog.x, frog.y);
    ctx.rotate(aim);
    ctx.fillStyle = '#4aaa6b';
    ctx.strokeStyle = '#246945';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 55, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#77cb82';
    ctx.beginPath();
    ctx.arc(31, -35, 18, 0, Math.PI * 2);
    ctx.arc(31, 35, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(34, -36, 9, 0, Math.PI * 2);
    ctx.arc(34, 36, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#173b2b';
    ctx.beginPath();
    ctx.arc(39, -36, 4, 0, Math.PI * 2);
    ctx.arc(39, 36, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#244e37';
    roundRect(ctx, 20, -13, 48, 26, 12);
    ctx.fill();
    drawBall(ctx, 17, 0, armed === 'bomb' ? '#30343b' : armed === 'rainbow' ? '#fff' : COLORS[current], 15);
    ctx.restore();
    if (aiming) {
      ctx.save();
      ctx.strokeStyle = 'rgba(37,83,67,.32)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(frog.x + Math.cos(aim) * 65, frog.y + Math.sin(aim) * 65);
      ctx.lineTo(frog.x + Math.cos(aim) * 190, frog.y + Math.sin(aim) * 190);
      ctx.stroke();
      ctx.restore();
    }
    drawBall(ctx, frog.x - 35, frog.y + 42, COLORS[next], 10, .9);
  }

  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    background.addColorStop(0, '#edf7df');
    background.addColorStop(.48, '#cce8d5');
    background.addColorStop(1, '#b9dcca');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.arc((i * 137) % WIDTH, (i * 83) % HEIGHT, 8 + (i % 4) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    drawTrack();
    const hole = zumaPointAt(path, path.length);
    ctx.fillStyle = '#19352c';
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d6a64c';
    ctx.lineWidth = 6;
    ctx.stroke();
    chain.forEach((ball, index) => {
      const point = zumaPointAt(path, ball.s);
      const bursting = resolution?.phase === 'burst'
        && index >= resolution.left
        && index < resolution.left + resolution.count;
      if (!bursting) {
        drawBall(ctx, point.x, point.y, COLORS[ball.color], BALL_RADIUS);
        return;
      }
      const progress = clamp(resolution.elapsed / resolution.duration, 0, 1);
      const scale = Math.max(.14, 1 + Math.sin(progress * Math.PI) * .3 - progress * .86);
      drawBall(ctx, point.x, point.y, COLORS[ball.color], BALL_RADIUS * scale, 1 - progress * progress);
      ctx.save();
      ctx.globalAlpha = (1 - progress) * .72;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 + progress * 4;
      ctx.beginPath();
      ctx.arc(point.x, point.y, BALL_RADIUS * (1.05 + progress * .7), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
    drawFrog();
    if (shot) {
      const color = shot.special === 'bomb' ? '#30343b' : shot.special === 'rainbow' ? '#fff' : COLORS[shot.color];
      drawBall(ctx, shot.x, shot.y, color, 14);
      if (shot.special === 'rainbow') {
        ctx.save();
        ctx.strokeStyle = '#e36a8d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, 10, .2, 2.2);
        ctx.stroke();
        ctx.strokeStyle = '#59a7e8';
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, 10, 2.3, 4.3);
        ctx.stroke();
        ctx.restore();
      }
    }
    particles.forEach(particle => {
      ctx.save();
      ctx.globalAlpha = clamp(particle.life / .62, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    if (slowRemaining > 0) {
      ctx.fillStyle = 'rgba(73,155,211,.13)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  function frame(now) {
    if (destroyed || !env.isActive()) return;
    const delta = lastFrame ? clamp((now - lastFrame) / 1000, 0, .05) : 0;
    lastFrame = now;
    update(delta);
    if (destroyed) return;
    draw();
    if (now - lastSave > 1000 && !env.isPaused()) {
      lastSave = now;
      save();
    }
    raf = win.requestAnimationFrame(frame);
  }

  function activateTool(tool) {
    if (destroyed || env.isPaused() || shot || resolution || (tools[tool] || 0) <= 0) return;
    if (tool === 'slow') {
      tools.slow--;
      details.slowUsed++;
      slowRemaining += 8000;
      armed = '';
      env.speak('slow');
      showBanner('减速 8 秒', 650);
      updateUI();
      save();
      return;
    }
    armed = armed === tool ? '' : tool;
    updateUI();
  }

  canvas.addEventListener('pointermove', event => {
    if (!aiming || destroyed) return;
    event.preventDefault();
    setAim(event);
    draw();
  });
  canvas.addEventListener('pointerdown', event => {
    if (destroyed || env.isPaused() || shot || resolution) return;
    event.preventDefault();
    aiming = true;
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    setAim(event);
    draw();
  });
  canvas.addEventListener('pointerup', event => {
    if (!aiming) return;
    event.preventDefault();
    setAim(event);
    aiming = false;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    fire();
    draw();
  });
  canvas.addEventListener('pointercancel', event => {
    if (!aiming) return;
    aiming = false;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    draw();
  });
  q('#wb-zuma-swap').addEventListener('click', () => {
    if (destroyed || env.isPaused() || shot || resolution || armed) return;
    const old = current;
    current = next;
    next = old;
    env.speak('swap');
    updateUI();
    save();
  });
  root.querySelectorAll('.wb-zuma-tool').forEach(button => {
    button.addEventListener('click', () => activateTool(button.dataset.tool));
  });
  keyboardHandler = event => {
    if (!env.isActive() || env.isPaused()) return;
    if (event.code === 'Space') {
      event.preventDefault();
      fire();
    } else if (String(event.key || '').toLowerCase() === 'x') {
      const swap = q('#wb-zuma-swap');
      if (swap) swap.click();
    }
  };
  doc.addEventListener('keydown', keyboardHandler);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (raf) win.cancelAnimationFrame(raf);
    if (keyboardHandler) doc.removeEventListener('keydown', keyboardHandler);
  }

  env.setScore(score);
  details.maxSpeed = Math.max(Number(details.maxSpeed) || 0, Math.round(zumaSpeedForState(score, details.cleared, chain.length) * 10) / 10);
  seen.speedMark = Math.max(seen.speedMark || 0, Math.floor(zumaSpeedForState(score, details.cleared, chain.length) / 10));
  env.speak(state?.chain ? 'resume' : 'start');
  updateUI();
  save(true);
  draw();
  raf = win.requestAnimationFrame(frame);
  return { destroy, save:() => save(true), getState:stateData };
}
