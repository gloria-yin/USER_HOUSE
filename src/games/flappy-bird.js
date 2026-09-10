export const FLAPPY_WORLD = Object.freeze({
  width:360,
  height:560,
  groundY:500,
  birdX:92,
  birdHitX:11,
  birdHitY:9,
  pipeWidth:58,
  gravity:1050,
  flapVelocity:-340,
});

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function clampFlappyDelta(seconds) {
  return clamp(finiteNumber(seconds, 0), 0, .05);
}

export function flappyDifficulty(score) {
  const points = Math.max(0, Math.floor(finiteNumber(score, 0)));
  if (points < 10) {
    return {
      speed:112 + points * 1.25,
      gap:154 - points * .8,
      spacing:218 - points * .8,
      stage:1 + Math.floor(points / 5),
    };
  }
  const progress = points - 10;
  return {
    speed:Math.min(184, 124 + progress * 1.1),
    gap:Math.max(112, 146 - progress * .55),
    spacing:Math.max(174, 210 - progress * .45),
    stage:points >= 70 ? 8 : Math.min(7, 3 + Math.floor(progress / 12)),
  };
}

export function createFlappyPipe(x, score, random = Math.random, previousCenter) {
  const difficulty = flappyDifficulty(score);
  const halfGap = difficulty.gap / 2;
  const minCenter = 48 + halfGap;
  const maxCenter = FLAPPY_WORLD.groundY - 48 - halfGap;
  const sample = clamp(finiteNumber(random(), .5), 0, .999999);
  const unrestricted = minCenter + sample * (maxCenter - minCenter);
  const center = Number.isFinite(Number(previousCenter))
    ? clamp(Number(previousCenter) + (sample - .5) * 160, minCenter, maxCenter)
    : unrestricted;
  return {
    x:finiteNumber(x, FLAPPY_WORLD.width + 80),
    width:FLAPPY_WORLD.pipeWidth,
    gapTop:Math.round(center - halfGap),
    gapBottom:Math.round(center + halfGap),
    passed:false,
  };
}

export function flappyBirdHitsPipe(bird, pipe) {
  if (!bird || !pipe) return false;
  const x = finiteNumber(bird.x, FLAPPY_WORLD.birdX);
  const y = finiteNumber(bird.y, FLAPPY_WORLD.height / 2);
  const hitX = Math.max(1, finiteNumber(bird.hitX, FLAPPY_WORLD.birdHitX));
  const hitY = Math.max(1, finiteNumber(bird.hitY, FLAPPY_WORLD.birdHitY));
  const pipeX = finiteNumber(pipe.x, Infinity);
  const pipeWidth = Math.max(0, finiteNumber(pipe.width, FLAPPY_WORLD.pipeWidth));
  const overlapsX = x + hitX >= pipeX && x - hitX <= pipeX + pipeWidth;
  return overlapsX && (y - hitY <= finiteNumber(pipe.gapTop, 0) || y + hitY >= finiteNumber(pipe.gapBottom, FLAPPY_WORLD.groundY));
}

export function advanceFlappyState(current, seconds) {
  const state = current || {};
  const dt = clampFlappyDelta(seconds);
  const bird = Object.assign({
    x:FLAPPY_WORLD.birdX,
    y:FLAPPY_WORLD.height * .44,
    vy:0,
    hitX:FLAPPY_WORLD.birdHitX,
    hitY:FLAPPY_WORLD.birdHitY,
  }, state.bird || {});
  const scoreBefore = Math.max(0, Math.floor(finiteNumber(state.score, 0)));
  const difficulty = flappyDifficulty(scoreBefore);
  bird.vy = finiteNumber(bird.vy, 0) + FLAPPY_WORLD.gravity * dt;
  bird.y = finiteNumber(bird.y, FLAPPY_WORLD.height * .44) + bird.vy * dt;
  const scoredPipeIds = [];
  const pipes = (Array.isArray(state.pipes) ? state.pipes : []).map((source, index) => {
    const pipe = Object.assign({}, source, {
      x:finiteNumber(source?.x, FLAPPY_WORLD.width + 80) - difficulty.speed * dt,
      width:Math.max(1, finiteNumber(source?.width, FLAPPY_WORLD.pipeWidth)),
      passed:!!source?.passed,
    });
    if (!pipe.passed && pipe.x + pipe.width < bird.x) {
      pipe.passed = true;
      scoredPipeIds.push(pipe.id ?? index);
    }
    return pipe;
  });
  const alive = bird.y - bird.hitY > 0
    && bird.y + bird.hitY < FLAPPY_WORLD.groundY
    && !pipes.some(pipe => flappyBirdHitsPipe(bird, pipe));
  return Object.assign({}, state, {
    bird,
    pipes,
    score:scoreBefore + scoredPipeIds.length,
    distance:Math.max(0, finiteNumber(state.distance, 0)) + difficulty.speed * dt,
    alive,
    scoredPipeIds,
  });
}

function ensureStyles(doc) {
  if (doc.getElementById('wb-flappy-bird-module-css')) return;
  const style = doc.createElement('style');
  style.id = 'wb-flappy-bird-module-css';
  style.textContent = `
    .wb-flappy-shell{width:100%;height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:7px;place-items:center;overflow:hidden}
    .wb-flappy-top{width:min(420px,100%);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    .wb-flappy-stat{height:38px;min-width:0;display:grid;grid-template-rows:12px 1fr;place-items:center;padding:3px 5px;border:1px solid var(--wb-border);background:var(--wb-panel);box-sizing:border-box}
    .wb-flappy-stat span{font-size:9px;line-height:1;font-weight:800;color:var(--wb-muted)}
    .wb-flappy-stat b{max-width:100%;font:900 13px/1.1 "Courier New",monospace;color:var(--wb-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .wb-flappy-stage{width:min(420px,100%);height:100%;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:manipulation;user-select:none;-webkit-user-select:none}
    .wb-flappy-canvas{display:block;box-sizing:border-box;width:auto;height:auto;max-width:100%;max-height:100%;aspect-ratio:360/560;object-fit:contain;border:2px solid #28454e;background:#77d6e7;box-shadow:0 5px 16px rgba(33,66,72,.18);image-rendering:pixelated;cursor:pointer;touch-action:manipulation;outline:none}
    .wb-flappy-canvas:focus-visible{box-shadow:0 0 0 3px rgba(238,173,51,.5),0 5px 16px rgba(33,66,72,.18)}
    .wb-flappy-help{width:min(420px,100%);min-height:35px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;padding:6px 10px;border:1px solid var(--wb-border);background:var(--wb-panel);font-size:11px;font-weight:800;color:var(--wb-muted)}
    .wb-flappy-help kbd{padding:2px 7px;border:1px solid color-mix(in srgb,var(--wb-border) 75%,#667 25%);background:color-mix(in srgb,var(--wb-panel) 86%,#fff 14%);box-shadow:0 2px 0 var(--wb-border);font:900 11px/1.2 "Courier New",monospace;color:var(--wb-text)}
    @media(max-width:560px){
      .wb-flappy-shell{gap:5px}
      .wb-flappy-top{gap:4px}
      .wb-flappy-stat{height:33px;padding:2px 3px}
      .wb-flappy-stat b{font-size:11px}
      .wb-flappy-help{min-height:31px;padding:4px 7px;font-size:10px}
    }
  `;
  doc.head.appendChild(style);
}

function drawCloud(ctx, x, y, scale) {
  ctx.fillStyle = 'rgba(255,255,255,.86)';
  ctx.fillRect(Math.round(x), Math.round(y + 8 * scale), Math.round(48 * scale), Math.round(12 * scale));
  ctx.fillRect(Math.round(x + 8 * scale), Math.round(y + 2 * scale), Math.round(16 * scale), Math.round(12 * scale));
  ctx.fillRect(Math.round(x + 22 * scale), Math.round(y), Math.round(18 * scale), Math.round(16 * scale));
}

function drawBackground(ctx, distance) {
  const sky = ctx.createLinearGradient(0, 0, 0, FLAPPY_WORLD.groundY);
  sky.addColorStop(0, '#69c9e5');
  sky.addColorStop(.68, '#bcebdc');
  sky.addColorStop(1, '#f4e6b0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, FLAPPY_WORLD.width, FLAPPY_WORLD.groundY);
  const cloudShift = (distance * .08) % 430;
  drawCloud(ctx, 42 - cloudShift, 78, 1);
  drawCloud(ctx, 255 - cloudShift, 142, .72);
  drawCloud(ctx, 472 - cloudShift, 62, .9);
  const cityShift = (distance * .18) % 52;
  ctx.fillStyle = '#86c7b7';
  for (let i = -2; i < 10; i++) {
    const x = Math.round(i * 52 - cityShift);
    const height = 30 + ((i + 12) % 3) * 11;
    ctx.fillRect(x, FLAPPY_WORLD.groundY - 54 - height, 38, height);
    ctx.fillStyle = '#b8dfbf';
    ctx.fillRect(x + 7, FLAPPY_WORLD.groundY - 47 - height, 6, 6);
    ctx.fillRect(x + 23, FLAPPY_WORLD.groundY - 35 - height, 6, 6);
    ctx.fillStyle = '#86c7b7';
  }
  ctx.fillStyle = '#5fba6e';
  for (let x = -20 - (distance * .35) % 32; x < FLAPPY_WORLD.width + 24; x += 32) {
    ctx.fillRect(Math.round(x), FLAPPY_WORLD.groundY - 30, 38, 30);
    ctx.fillRect(Math.round(x + 7), FLAPPY_WORLD.groundY - 38, 24, 10);
  }
}

function drawPipeSection(ctx, x, top, height, capAtBottom) {
  if (height <= 0) return;
  ctx.fillStyle = '#245f38';
  ctx.fillRect(Math.round(x - 2), Math.round(top), FLAPPY_WORLD.pipeWidth + 4, Math.round(height));
  ctx.fillStyle = '#4fae45';
  ctx.fillRect(Math.round(x + 2), Math.round(top), FLAPPY_WORLD.pipeWidth - 4, Math.round(height));
  ctx.fillStyle = '#77d84f';
  ctx.fillRect(Math.round(x + 7), Math.round(top), 8, Math.round(height));
  ctx.fillStyle = '#34843e';
  ctx.fillRect(Math.round(x + FLAPPY_WORLD.pipeWidth - 12), Math.round(top), 8, Math.round(height));
  const capY = capAtBottom ? top + height - 20 : top + 2;
  ctx.fillStyle = '#214f31';
  ctx.fillRect(Math.round(x - 7), Math.round(capY - 2), FLAPPY_WORLD.pipeWidth + 14, 22);
  ctx.fillStyle = '#55b94a';
  ctx.fillRect(Math.round(x - 4), Math.round(capY + 1), FLAPPY_WORLD.pipeWidth + 8, 16);
  ctx.fillStyle = '#84dd58';
  ctx.fillRect(Math.round(x + 1), Math.round(capY + 2), 9, 14);
  ctx.fillStyle = '#2e7539';
  ctx.fillRect(Math.round(x + FLAPPY_WORLD.pipeWidth - 8), Math.round(capY + 1), 8, 16);
}

function drawPipe(ctx, pipe) {
  drawPipeSection(ctx, pipe.x, 0, pipe.gapTop, true);
  drawPipeSection(ctx, pipe.x, pipe.gapBottom, FLAPPY_WORLD.groundY - pipe.gapBottom, false);
}

function drawGround(ctx, distance) {
  ctx.fillStyle = '#3c7744';
  ctx.fillRect(0, FLAPPY_WORLD.groundY, FLAPPY_WORLD.width, 5);
  ctx.fillStyle = '#8ed14b';
  ctx.fillRect(0, FLAPPY_WORLD.groundY + 5, FLAPPY_WORLD.width, 10);
  ctx.fillStyle = '#d9ca62';
  ctx.fillRect(0, FLAPPY_WORLD.groundY + 15, FLAPPY_WORLD.width, FLAPPY_WORLD.height - FLAPPY_WORLD.groundY - 15);
  ctx.fillStyle = '#b79d4f';
  const shift = Math.floor(distance) % 24;
  for (let x = -24 - shift; x < FLAPPY_WORLD.width + 24; x += 24) {
    ctx.fillRect(x, FLAPPY_WORLD.groundY + 20, 12, 5);
    ctx.fillRect(x + 12, FLAPPY_WORLD.groundY + 35, 12, 5);
    ctx.fillRect(x + 4, FLAPPY_WORLD.groundY + 50, 12, 5);
  }
}

function drawBird(ctx, bird, wingUp) {
  const angle = clamp(finiteNumber(bird.vy, 0) / 700, -.35, .55);
  ctx.save();
  ctx.translate(Math.round(bird.x), Math.round(bird.y));
  ctx.rotate(angle);
  ctx.fillStyle = '#3c2b26';
  ctx.fillRect(-15, -9, 24, 20);
  ctx.fillRect(-10, -12, 17, 25);
  ctx.fillRect(7, -8, 9, 17);
  ctx.fillStyle = '#f2c432';
  ctx.fillRect(-12, -7, 21, 16);
  ctx.fillRect(-7, -10, 13, 21);
  ctx.fillStyle = '#ffe45d';
  ctx.fillRect(-10, -7, 8, 11);
  ctx.fillStyle = '#fff8df';
  ctx.fillRect(3, -9, 10, 10);
  ctx.fillStyle = '#27211f';
  ctx.fillRect(9, -6, 4, 5);
  ctx.fillStyle = '#e9682f';
  ctx.fillRect(11, 1, 11, 5);
  ctx.fillStyle = '#ff9a35';
  ctx.fillRect(10, -1, 12, 4);
  ctx.fillStyle = '#8d542c';
  if (wingUp) {
    ctx.fillRect(-12, -10, 9, 5);
    ctx.fillStyle = '#f7e07b';
    ctx.fillRect(-11, -9, 7, 3);
  } else {
    ctx.fillRect(-13, 3, 11, 7);
    ctx.fillStyle = '#f7e07b';
    ctx.fillRect(-11, 4, 8, 4);
  }
  ctx.restore();
}

function drawPixelText(ctx, text, x, y, size, align = 'center') {
  ctx.font = '900 ' + size + 'px "Courier New",monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = 'rgba(43,48,38,.72)';
  ctx.lineWidth = Math.max(2, Math.round(size / 8));
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff9dc';
  ctx.fillText(text, x, y);
}

function sanitizePipe(source, index) {
  if (!source || !Number.isFinite(Number(source.x)) || !Number.isFinite(Number(source.gapTop)) || !Number.isFinite(Number(source.gapBottom))) return null;
  const top = clamp(Number(source.gapTop), 42, FLAPPY_WORLD.groundY - 130);
  const bottom = clamp(Number(source.gapBottom), top + 100, FLAPPY_WORLD.groundY - 35);
  return {
    id:source.id ?? index + 1,
    x:Number(source.x),
    width:clamp(finiteNumber(source.width, FLAPPY_WORLD.pipeWidth), 40, 80),
    gapTop:top,
    gapBottom:bottom,
    passed:!!source.passed,
  };
}

export function createFlappyBirdGame(savedState, env) {
  const doc = env.document;
  const win = env.window;
  const root = env.root;
  ensureStyles(doc);
  root.innerHTML = '<div class="wb-flappy-shell"><div class="wb-flappy-top"><div class="wb-flappy-stat"><span>本局</span><b id="wb-flappy-score">0</b></div><div class="wb-flappy-stat"><span>穿管</span><b id="wb-flappy-passed">0</b></div><div class="wb-flappy-stat"><span>节奏</span><b id="wb-flappy-pace">经典</b></div></div><div class="wb-flappy-stage"><canvas class="wb-flappy-canvas" id="wb-flappy-canvas" width="360" height="560" tabindex="0" role="button" aria-label="像素鸟游戏画面，按空格或点击拍翅"></canvas></div><div class="wb-flappy-help"><kbd>SPACE</kbd><span>电脑按空格 · 手机点画面</span></div></div>';

  const canvas = root.querySelector('#wb-flappy-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const restored = !!savedState?.started;
  const savedBird = savedState?.bird || {};
  let state = {
    bird:{
      x:FLAPPY_WORLD.birdX,
      y:clamp(finiteNumber(savedBird.y, FLAPPY_WORLD.height * .44), 20, FLAPPY_WORLD.groundY - 20),
      vy:clamp(finiteNumber(savedBird.vy, 0), -520, 620),
      hitX:FLAPPY_WORLD.birdHitX,
      hitY:FLAPPY_WORLD.birdHitY,
    },
    pipes:(Array.isArray(savedState?.pipes) ? savedState.pipes : []).map(sanitizePipe).filter(Boolean).sort((a, b) => a.x - b.x),
    score:Math.max(0, Math.floor(finiteNumber(savedState?.score, 0))),
    distance:Math.max(0, finiteNumber(savedState?.distance, 0)),
    alive:true,
  };
  let phase = restored ? 'playing' : 'ready';
  const largestPipeId = state.pipes.reduce((max, pipe) => Number.isFinite(Number(pipe.id)) ? Math.max(max, Number(pipe.id)) : max, 0);
  let nextPipeId = Math.max(largestPipeId + 1, Math.floor(finiteNumber(savedState?.nextPipeId, 1)), 1);
  let details = Object.assign({
    flaps:0,
    pipesPassed:state.score,
    closeCalls:0,
    maxStreak:state.score,
    survivalSeconds:0,
    maxSpeed:flappyDifficulty(state.score).speed,
    maxDifficultyStage:flappyDifficulty(state.score).stage,
  }, savedState?.details || {});
  ['flaps','pipesPassed','closeCalls','maxStreak','survivalSeconds','maxSpeed','maxDifficultyStage'].forEach(key => {
    details[key] = Math.max(0, finiteNumber(details[key], 0));
  });
  let destroyed = false;
  let over = false;
  let animationFrame = 0;
  let lastFrameAt = 0;
  let accumulator = 0;
  let saveElapsed = 0;
  let visualClock = 0;
  let scorePulse = 0;
  let lastSpokenAt = 0;

  function appendPipe(x) {
    const previous = state.pipes[state.pipes.length - 1];
    const previousCenter = previous ? (previous.gapTop + previous.gapBottom) / 2 : undefined;
    const pipe = createFlappyPipe(x, state.score, Math.random, previousCenter);
    pipe.id = nextPipeId++;
    state.pipes.push(pipe);
  }

  function ensurePipeQueue() {
    state.pipes = state.pipes.filter(pipe => pipe.x + pipe.width > -24);
    const spacing = flappyDifficulty(state.score).spacing;
    let rightmost = state.pipes.reduce((max, pipe) => Math.max(max, pipe.x), -Infinity);
    if (!Number.isFinite(rightmost)) {
      rightmost = FLAPPY_WORLD.width + 72;
      appendPipe(rightmost);
    }
    while (rightmost < FLAPPY_WORLD.width + spacing * 2) {
      rightmost += spacing;
      appendPipe(rightmost);
    }
  }

  function stateData() {
    return {
      version:1,
      started:phase === 'playing' && !over,
      bird:Object.assign({}, state.bird),
      pipes:state.pipes.map(pipe => Object.assign({}, pipe)),
      score:state.score,
      distance:state.distance,
      nextPipeId,
      details:Object.assign({}, details),
    };
  }

  function save(force) {
    if (!destroyed && !over) env.save(stateData(), force);
  }

  function updateUI() {
    const difficulty = flappyDifficulty(state.score);
    const values = [
      ['#wb-flappy-score', state.score],
      ['#wb-flappy-passed', details.pipesPassed || 0],
      ['#wb-flappy-pace', difficulty.stage >= 8 ? '极速' : difficulty.stage >= 5 ? '高速' : difficulty.stage >= 3 ? '加速' : '经典'],
    ];
    values.forEach(([selector, value]) => {
      const element = root.querySelector(selector);
      if (element) element.textContent = String(value);
    });
  }

  function speak(event, important = false) {
    const now = Date.now();
    if (!important && now - lastSpokenAt < 2200) return;
    lastSpokenAt = now;
    env.speak(event);
  }

  function draw() {
    ctx.clearRect(0, 0, FLAPPY_WORLD.width, FLAPPY_WORLD.height);
    drawBackground(ctx, state.distance);
    state.pipes.forEach(pipe => drawPipe(ctx, pipe));
    const bob = phase === 'ready' ? Math.sin(visualClock * 4) * 5 : 0;
    drawBird(ctx, Object.assign({}, state.bird, { y:state.bird.y + bob }), Math.floor(visualClock * 9) % 2 === 0);
    drawGround(ctx, state.distance);
    drawPixelText(ctx, String(state.score), FLAPPY_WORLD.width / 2, 58, scorePulse > 0 ? 38 : 34);
    if (phase === 'ready') {
      ctx.fillStyle = 'rgba(24,54,59,.67)';
      ctx.fillRect(50, 206, 260, 86);
      drawPixelText(ctx, '点击 / 空格', 180, 235, 20);
      drawPixelText(ctx, '拍翅起飞', 180, 266, 16);
    }
  }

  function scorePipes(ids) {
    if (!ids.length) return;
    details.pipesPassed = state.score;
    details.maxStreak = Math.max(details.maxStreak || 0, state.score);
    const scored = new Set(ids);
    const close = state.pipes.some(pipe => {
      if (!scored.has(pipe.id)) return false;
      const topDistance = state.bird.y - state.bird.hitY - pipe.gapTop;
      const bottomDistance = pipe.gapBottom - (state.bird.y + state.bird.hitY);
      const nearest = Math.min(topDistance, bottomDistance);
      return nearest >= 0 && nearest <= 8;
    });
    if (close) details.closeCalls = (details.closeCalls || 0) + 1;
    const difficulty = flappyDifficulty(state.score);
    const previousStage = details.maxDifficultyStage || 1;
    details.maxSpeed = Math.max(details.maxSpeed || 0, difficulty.speed);
    details.maxDifficultyStage = Math.max(details.maxDifficultyStage || 1, difficulty.stage);
    scorePulse = .28;
    env.setScore(state.score);
    if (close) speak('close_call', true);
    else if ([10, 25, 50, 100].includes(state.score)) speak('high_score', true);
    else if (difficulty.stage >= 3 && difficulty.stage > previousStage) speak('speed_up', true);
    else if (state.score % 5 === 0) speak('streak', true);
    else speak('score');
    updateUI();
    save(true);
  }

  function collisionReason() {
    if (state.bird.y + state.bird.hitY >= FLAPPY_WORLD.groundY) return '地面';
    if (state.bird.y - state.bird.hitY <= 0) return '顶部';
    return '管道';
  }

  function finishGame() {
    if (over || destroyed) return;
    over = true;
    phase = 'over';
    details.pipesPassed = state.score;
    details.survivalSeconds = Math.round((details.survivalSeconds || 0) * 10) / 10;
    const finalDetails = Object.assign({}, details, {
      score:state.score,
      crash:collisionReason(),
      difficultyStage:flappyDifficulty(state.score).stage,
    });
    env.clear();
    env.setScore(state.score);
    speak('crash', true);
    env.finish('像素鸟 · 游戏结束', '本局得分：' + state.score + '分，穿过' + state.score + '组管道，拍翅' + (details.flaps || 0) + '次，极限擦边' + (details.closeCalls || 0) + '次', { outcome:'score', score:state.score }, { score:state.score, details:finalDetails });
  }

  function fixedStep(dt) {
    if (phase !== 'playing' || over) return;
    state = advanceFlappyState(state, dt);
    details.survivalSeconds = Math.max(0, finiteNumber(details.survivalSeconds, 0)) + dt;
    const scored = state.scoredPipeIds || [];
    scorePipes(scored);
    ensurePipeQueue();
    saveElapsed += dt;
    if (saveElapsed >= 1) {
      saveElapsed = 0;
      save(false);
    }
    if (!state.alive) finishGame();
  }

  function frame(timestamp) {
    if (destroyed) return;
    if (!lastFrameAt) lastFrameAt = timestamp;
    const elapsed = clampFlappyDelta((timestamp - lastFrameAt) / 1000);
    lastFrameAt = timestamp;
    if (!env.isPaused()) {
      visualClock += elapsed;
      scorePulse = Math.max(0, scorePulse - elapsed);
      if (phase === 'playing' && !over) {
        accumulator = Math.min(.1, accumulator + elapsed);
        while (accumulator >= 1 / 120) {
          fixedStep(1 / 120);
          accumulator -= 1 / 120;
          if (over) break;
        }
      }
    } else accumulator = 0;
    draw();
    animationFrame = over ? 0 : win.requestAnimationFrame(frame);
  }

  function flap() {
    if (destroyed || over || env.isPaused() || !env.isActive()) return;
    if (phase === 'ready') {
      phase = 'playing';
      state.bird.y = FLAPPY_WORLD.height * .44;
      state.bird.vy = 0;
      accumulator = 0;
    }
    state.bird.vy = FLAPPY_WORLD.flapVelocity;
    details.flaps = (details.flaps || 0) + 1;
    if (details.flaps === 1 || details.flaps % 9 === 0) speak('flap');
    save(false);
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    canvas.focus({ preventScroll:true });
    flap();
  }

  function onKeyDown(event) {
    if (event.code !== 'Space' && event.key !== ' ') return;
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    flap();
  }

  function destroy() {
    if (destroyed) return;
    save(true);
    destroyed = true;
    if (animationFrame) win.cancelAnimationFrame(animationFrame);
    canvas.removeEventListener('pointerdown', onPointerDown);
    doc.removeEventListener('keydown', onKeyDown);
    win.removeEventListener?.('pagehide', saveOnLeave);
    doc.removeEventListener?.('visibilitychange', saveOnHidden);
  }

  function saveOnLeave() { save(true); }
  function saveOnHidden() { if (doc.hidden) save(true); }

  ensurePipeQueue();
  canvas.addEventListener('pointerdown', onPointerDown, { passive:false });
  doc.addEventListener('keydown', onKeyDown);
  win.addEventListener?.('pagehide', saveOnLeave);
  doc.addEventListener?.('visibilitychange', saveOnHidden);
  env.setScore(state.score);
  env.speak(restored ? 'resume' : 'start');
  updateUI();
  draw();
  save(true);
  animationFrame = win.requestAnimationFrame(frame);
  return { destroy, save:() => save(true), getState:stateData };
}
