const CAPACITY = 4;
const WATER_COLORS = ['#ef5b63', '#f4b942', '#4ebd78', '#4a91e8', '#9b6bdc', '#ee77b1', '#31b8bd', '#f0843e', '#7a8b3a', '#d14f95'];

function topRun(bottle) {
  if (!Array.isArray(bottle) || !bottle.length) return { color:-1, count:0 };
  const color = bottle[bottle.length - 1];
  let count = 1;
  for (let i = bottle.length - 2; i >= 0 && bottle[i] === color; i--) count++;
  return { color, count };
}

export function canPourWater(bottles, from, to) {
  if (!Array.isArray(bottles) || from === to || !bottles[from] || !bottles[to]) return false;
  const source = bottles[from];
  const target = bottles[to];
  if (!source.length || target.length >= CAPACITY) return false;
  const run = topRun(source);
  return !target.length || target[target.length - 1] === run.color;
}

export function pourWater(bottles, from, to) {
  const next = bottles.map(bottle => bottle.slice());
  if (!canPourWater(next, from, to)) return { bottles:next, moved:0, color:-1 };
  const source = next[from];
  const target = next[to];
  const run = topRun(source);
  const moved = Math.min(run.count, CAPACITY - target.length);
  for (let i = 0; i < moved; i++) target.push(source.pop());
  return { bottles:next, moved, color:run.color };
}

export function isWaterSortSolved(bottles) {
  return Array.isArray(bottles) && bottles.every(bottle => {
    if (!bottle.length) return true;
    return bottle.length === CAPACITY && bottle.every(color => color === bottle[0]);
  });
}

function solvedBottles(colorCount, emptyCount) {
  return Array.from({ length:colorCount }, (_, color) => Array(CAPACITY).fill(color))
    .concat(Array.from({ length:emptyCount }, () => []));
}

export function verifyWaterSortSolution(bottles, solution, colorCount) {
  let current = bottles.map(bottle => bottle.slice());
  for (const move of solution || []) {
    const result = pourWater(current, move.from, move.to);
    if (!result.moved) return false;
    current = result.bottles;
  }
  return isWaterSortSolved(current) && current.filter(bottle => bottle.length).length === colorCount;
}

export function waterSortDifficulty(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const colorCount = Math.min(10, 3 + Math.floor((safeLevel - 1) / 2));
  return {
    level:safeLevel,
    colorCount,
    emptyCount:safeLevel >= 9 ? 1 : 2,
    targetMoves:Math.min(42, 6 + safeLevel * 2 + Math.floor((safeLevel - 1) / 3)),
    minMixed:Math.min(colorCount, 2 + Math.floor((safeLevel - 1) / 3)),
  };
}

export function createWaterSortLevel(level, random = Math.random) {
  const config = waterSortDifficulty(level);
  const { colorCount, emptyCount, targetMoves, minMixed } = config;
  let best = null;
  for (let attempt = 0; attempt < 120; attempt++) {
    const bottles = solvedBottles(colorCount, emptyCount);
    const solution = [];
    const seen = new Set([bottles.map(bottle => bottle.join('')).join('|')]);
    let movesMade = 0;
    for (let step = 0; step < targetMoves * 5 && movesMade < targetMoves; step++) {
      const candidates = [];
      for (let from = 0; from < bottles.length; from++) {
        const run = topRun(bottles[from]);
        if (run.count <= 1) continue;
        for (let to = 0; to < bottles.length; to++) {
          if (from === to || bottles[to].length >= CAPACITY) continue;
          const targetTop = bottles[to][bottles[to].length - 1];
          if (targetTop === run.color) continue;
          const maxMove = Math.min(run.count - 1, CAPACITY - bottles[to].length);
          if (maxMove <= 0) continue;
          const weight = bottles[to].length ? 6 : 1;
          for (let amount = 1; amount <= maxMove; amount++) {
            const preview = bottles.map(bottle => bottle.slice());
            preview[to].push(...preview[from].splice(-amount));
            const key = preview.map(bottle => bottle.join('')).join('|');
            if (seen.has(key)) continue;
            for (let n = 0; n < weight; n++) candidates.push({ from, to, amount, key });
          }
        }
      }
      if (!candidates.length) break;
      const move = candidates[Math.floor(random() * candidates.length)];
      const moved = bottles[move.from].splice(bottles[move.from].length - move.amount, move.amount);
      bottles[move.to].push(...moved);
      seen.add(move.key);
      solution.unshift({ from:move.to, to:move.from });
      movesMade++;
    }
    const mixed = bottles.filter(bottle => new Set(bottle).size > 1).length;
    if (!isWaterSortSolved(bottles) && verifyWaterSortSolution(bottles, solution, colorCount)) {
      const candidate = { bottles:bottles.map(bottle => bottle.slice()), solution:solution.slice(), colorCount, emptyCount, par:solution.length, targetMoves, mixed };
      if (!best || candidate.par > best.par || (candidate.par === best.par && mixed > best.mixed)) best = candidate;
      if (movesMade >= targetMoves && mixed >= minMixed) return candidate;
    }
  }
  if (best) return best;
  const fallback = solvedBottles(colorCount, emptyCount);
  const solution = [];
  const spare = colorCount;
  fallback[spare].push(...fallback[0].splice(-2));
  solution.unshift({ from:spare, to:0 });
  fallback[0].push(...fallback[1].splice(-1));
  solution.unshift({ from:0, to:1 });
  return { bottles:fallback, solution, colorCount, emptyCount, par:solution.length, targetMoves, mixed:1 };
}

export function waterSortLegalMoves(bottles) {
  const moves = [];
  for (let from = 0; from < bottles.length; from++) {
    for (let to = 0; to < bottles.length; to++) {
      if (!canPourWater(bottles, from, to)) continue;
      const source = bottles[from];
      const target = bottles[to];
      const run = topRun(source);
      const sourceComplete = source.length === CAPACITY && run.count === CAPACITY;
      if (!target.length && sourceComplete) continue;
      moves.push({ from, to, joins:!!target.length, exposes:source.length > run.count });
    }
  }
  return moves;
}

export function waterSortHint(bottles, savedSolution) {
  const first = Array.isArray(savedSolution) ? savedSolution[0] : null;
  if (first && canPourWater(bottles, first.from, first.to)) return { from:first.from, to:first.to, exact:true };
  const moves = waterSortLegalMoves(bottles);
  return moves.find(move => move.joins && move.exposes)
    || moves.find(move => move.joins)
    || moves.find(move => move.exposes)
    || moves[0]
    || null;
}

function ensureStyles(doc) {
  if (doc.getElementById('wb-water-sort-module-css')) return;
  const style = doc.createElement('style');
  style.id = 'wb-water-sort-module-css';
  style.textContent = `
    .wb-water-sort-shell{width:100%;height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:7px;place-items:center;overflow:hidden}
    .wb-water-sort-top{width:min(720px,100%);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
    .wb-water-sort-stat{height:38px;min-width:0;display:grid;grid-template-rows:12px 1fr;place-items:center;padding:3px 5px;border:1px solid var(--wb-border);background:var(--wb-panel);box-sizing:border-box}
    .wb-water-sort-stat span{font-size:9px;line-height:1;font-weight:800;color:var(--wb-muted)}
    .wb-water-sort-stat b{max-width:100%;font-size:13px;line-height:1.1;color:var(--wb-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .wb-water-sort-board{position:relative;width:min(720px,100%);height:100%;min-height:0;display:flex;align-content:center;align-items:center;justify-content:center;flex-wrap:wrap;gap:clamp(8px,2cqh,16px) clamp(9px,2.2cqw,18px);padding:12px 10px;box-sizing:border-box;overflow:hidden;background:linear-gradient(160deg,#e8f5ed,#e6eff8 54%,#fff1df);border:1px solid color-mix(in srgb,var(--wb-border) 70%,#4f9c84 30%)}
    .wb-water-bottle{position:relative;flex:0 0 clamp(42px,7.8cqh,64px);width:clamp(42px,7.8cqh,64px);height:clamp(112px,20cqh,164px);min-width:0;padding:0;border:0;background:transparent;cursor:pointer;transition:transform .18s ease,filter .18s ease}
    .wb-water-bottle::before{content:'';position:absolute;z-index:3;left:27%;right:27%;top:0;height:12%;border:3px solid rgba(51,79,87,.56);border-bottom:0;background:rgba(255,255,255,.46)}
    .wb-water-bottle::after{content:'';position:absolute;z-index:3;inset:10% 8% 0;border:3px solid rgba(51,79,87,.56);border-top-width:2px;border-radius:10px 10px 17px 17px;box-shadow:inset 7px 0 9px rgba(255,255,255,.38),inset -4px 0 8px rgba(75,105,115,.08);pointer-events:none}
    .wb-water-fill{position:absolute;z-index:1;left:11%;right:11%;height:21.5%;bottom:calc(3% + var(--layer) * 21.5%);background:var(--water);border-top:1px solid rgba(255,255,255,.5);box-shadow:inset 8px 0 10px rgba(255,255,255,.22);transition:background .15s ease}
    .wb-water-fill.layer-0{border-radius:0 0 12px 12px}
    .wb-water-bottle:hover{transform:translateY(-2px)}
    .wb-water-bottle.selected{transform:translateY(-9px);filter:drop-shadow(0 6px 7px rgba(240,166,62,.32))}
    .wb-water-bottle.selected::after{border-color:#e9a638;box-shadow:0 0 0 3px rgba(233,166,56,.2),inset 7px 0 9px rgba(255,255,255,.38)}
    .wb-water-bottle.hint-source::after{border-color:#16966a;box-shadow:0 0 0 4px rgba(22,150,106,.2)}
    .wb-water-bottle.hint-target::after{border-color:#398dd4;box-shadow:0 0 0 4px rgba(57,141,212,.2)}
    .wb-water-bottle.pour-source{transform:translateY(-12px) rotate(7deg)}
    .wb-water-bottle.pour-target{animation:wbWaterReceive .28s ease}
    .wb-water-bottle.bad{animation:wbWaterBad .24s ease}
    .wb-water-bottle.done::after{border-color:rgba(29,139,88,.65);box-shadow:0 0 0 3px rgba(35,172,107,.17)}
    .wb-water-tools{width:min(720px,100%);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
    .wb-water-tool{min-width:0;min-height:35px;padding:5px 7px;display:flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap}
    .wb-water-tool i{font-style:normal;font-size:16px}
    .wb-water-banner{position:absolute;z-index:8;left:50%;top:50%;transform:translate(-50%,-50%);padding:8px 14px;background:rgba(26,53,51,.9);color:#fff;font-size:13px;font-weight:900;opacity:0;pointer-events:none;transition:opacity .18s}
    .wb-water-banner.show{opacity:1}
    @keyframes wbWaterReceive{50%{transform:scale(1.05)}}
    @keyframes wbWaterBad{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
    @media(max-width:560px){
      .wb-water-sort-shell{gap:5px}
      .wb-water-sort-top{gap:4px}
      .wb-water-sort-stat{height:33px;padding:2px 3px}
      .wb-water-sort-stat b{font-size:11px}
      .wb-water-sort-board{gap:7px 8px;padding:8px 5px}
      .wb-water-bottle{flex-basis:clamp(35px,7.2cqh,50px);width:clamp(35px,7.2cqh,50px);height:clamp(92px,17.8cqh,132px)}
      .wb-water-bottle::after{border-width:2px}
      .wb-water-bottle::before{border-width:2px}
      .wb-water-tools{gap:4px}
      .wb-water-tool{min-height:31px;padding:3px 3px;font-size:10px}
      .wb-water-tool i{font-size:13px}
    }
  `;
  doc.head.appendChild(style);
}

export function createWaterSortGame(state, env) {
  const doc = env.document;
  const win = env.window;
  const root = env.root;
  ensureStyles(doc);
  root.innerHTML = '<div class="wb-water-sort-shell"><div class="wb-water-sort-top"><div class="wb-water-sort-stat"><span>关卡</span><b id="wb-water-level"></b></div><div class="wb-water-sort-stat"><span>总分</span><b id="wb-water-score"></b></div><div class="wb-water-sort-stat"><span>本关步数</span><b id="wb-water-moves"></b></div><div class="wb-water-sort-stat"><span>难度</span><b id="wb-water-difficulty"></b></div></div><div class="wb-water-sort-board" id="wb-water-board"><div class="wb-water-banner" id="wb-water-banner"></div></div><div class="wb-water-tools"><button type="button" class="wb-btn wb-water-tool" data-tool="undo"><i>↶</i>撤回 <b id="wb-water-undo"></b></button><button type="button" class="wb-btn wb-water-tool" data-tool="hint"><i>◎</i>提示 <b id="wb-water-hint"></b></button><button type="button" class="wb-btn wb-water-tool" data-tool="extra"><i>＋</i>空瓶 <b id="wb-water-extra"></b></button><button type="button" class="wb-btn wb-water-tool" data-tool="reset" title="重置本关"><i>↻</i>重置</button><button type="button" class="wb-btn wb-water-tool" data-tool="finish" title="结束并结算本局"><i>■</i>结算</button></div></div>';

  let level = Math.max(1, Math.floor(Number(state?.level) || 1));
  const generated = !Array.isArray(state?.bottles) ? createWaterSortLevel(level) : null;
  let bottles = generated ? generated.bottles : state.bottles.map(bottle => Array.isArray(bottle) ? bottle.slice(0, CAPACITY).map(Number) : []);
  let initialBottles = Array.isArray(state?.initialBottles) ? state.initialBottles.map(bottle => bottle.slice()) : bottles.map(bottle => bottle.slice());
  let solution = Array.isArray(state?.solution) ? state.solution.map(move => ({ from:Number(move.from), to:Number(move.to) })) : (generated?.solution || []);
  let initialSolution = Array.isArray(state?.initialSolution) ? state.initialSolution.map(move => ({ from:Number(move.from), to:Number(move.to) })) : solution.map(move => ({ from:move.from, to:move.to }));
  let par = Math.max(1, Number(state?.par) || generated?.par || solution.length || 1);
  let colorCount = Math.max(1, Number(state?.colorCount) || generated?.colorCount || (Math.max(-1, ...bottles.flat()) + 1));
  let baseEmptyCount = Math.max(1, Number(state?.baseEmptyCount ?? generated?.emptyCount ?? (state?.bottles ? 2 : waterSortDifficulty(level).emptyCount)) || 1);
  let score = Math.max(0, Number(state?.score) || 0);
  let moves = Math.max(0, Number(state?.moves) || 0);
  let selected = -1;
  let busy = false;
  let history = Array.isArray(state?.history) ? state.history.slice(-40).map(item => ({
    bottles:Array.isArray(item?.bottles) ? item.bottles.map(bottle => bottle.slice()) : [],
    solution:Array.isArray(item?.solution) ? item.solution.map(move => ({ from:Number(move.from), to:Number(move.to) })) : [],
    moves:Math.max(0, Number(item?.moves) || 0),
    totalMoves:Math.max(0, Number(item?.totalMoves ?? item?.details?.totalMoves) || 0),
    efficientStreak:Math.max(0, Number(item?.efficientStreak ?? item?.details?.efficientStreak) || 0),
  })).filter(item => item.bottles.length === bottles.length) : [];
  let tools = Object.assign({ undo:5, hint:3, extra:1 }, state?.tools || {});
  let details = Object.assign({ totalMoves:0, levelsCleared:0, perfectLevels:0, hintsUsed:0, undosUsed:0, extraUsed:0, resets:0, sameColorPours:0, maxEfficientStreak:0, efficientStreak:0, maxColors:colorCount, oneEmptyLevels:0 }, state?.details || {});
  let levelStats = Object.assign({ hints:0, undos:0, extra:0, resets:0 }, state?.levelStats || {});
  let hintPair = null;
  let destroyed = false;
  const timers = new Set();

  function q(selector) {
    return root.querySelector(selector);
  }

  function later(fn, delay) {
    const timer = win.setTimeout(() => {
      timers.delete(timer);
      if (!destroyed) fn();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function stateData() {
    return {
      level,
      bottles:bottles.map(bottle => bottle.slice()),
      initialBottles:initialBottles.map(bottle => bottle.slice()),
      initialSolution:initialSolution.map(move => ({ from:move.from, to:move.to })),
      solution:solution.map(move => ({ from:move.from, to:move.to })),
      par,
      colorCount,
      baseEmptyCount,
      score,
      moves,
      tools:Object.assign({}, tools),
      details:Object.assign({}, details),
      levelStats:Object.assign({}, levelStats),
      history:history.map(item => ({
        bottles:item.bottles.map(bottle => bottle.slice()),
        solution:item.solution.map(move => ({ from:move.from, to:move.to })),
        moves:item.moves,
        totalMoves:item.totalMoves,
        efficientStreak:item.efficientStreak,
      })),
    };
  }

  function save(force) {
    if (!destroyed && !busy) env.save(stateData(), force);
  }

  function showBanner(text, duration = 700) {
    const banner = q('#wb-water-banner');
    if (!banner) return;
    banner.textContent = text;
    banner.classList.add('show');
    later(() => q('#wb-water-banner')?.classList.remove('show'), duration);
  }

  function draw() {
    const board = q('#wb-water-board');
    if (!board) return;
    const banner = q('#wb-water-banner');
    const bannerHTML = banner ? banner.outerHTML : '<div class="wb-water-banner" id="wb-water-banner"></div>';
    board.innerHTML = bannerHTML + bottles.map((bottle, index) => {
      const complete = bottle.length === CAPACITY && bottle.every(color => color === bottle[0]);
      const classes = [
        'wb-water-bottle',
        index === selected ? 'selected' : '',
        hintPair?.from === index ? 'hint-source' : '',
        hintPair?.to === index ? 'hint-target' : '',
        complete ? 'done' : '',
      ].filter(Boolean).join(' ');
      const layers = bottle.map((color, layer) => '<span class="wb-water-fill layer-' + layer + '" style="--layer:' + layer + ';--water:' + WATER_COLORS[color % WATER_COLORS.length] + '"></span>').join('');
      return '<button type="button" class="' + classes + '" data-bottle="' + index + '" aria-label="瓶子 ' + (index + 1) + '">' + layers + '</button>';
    }).join('');
    board.querySelectorAll('.wb-water-bottle').forEach(button => {
      button.addEventListener('click', () => selectBottle(Number(button.dataset.bottle)));
    });
    updateUI();
  }

  function updateUI() {
    const fields = [
      ['#wb-water-level', level],
      ['#wb-water-score', score],
      ['#wb-water-moves', moves],
      ['#wb-water-difficulty', colorCount + '色 · ' + baseEmptyCount + '空'],
      ['#wb-water-undo', tools.undo],
      ['#wb-water-hint', tools.hint],
      ['#wb-water-extra', tools.extra],
    ];
    fields.forEach(([selector, value]) => {
      const el = q(selector);
      if (el) el.textContent = String(value);
    });
    root.querySelectorAll('.wb-water-tool').forEach(button => {
      const tool = button.dataset.tool;
      if (tool === 'undo') button.disabled = destroyed || busy || env.isPaused() || tools.undo <= 0 || !history.length;
      else if (tool === 'hint' || tool === 'extra') button.disabled = destroyed || busy || env.isPaused() || tools[tool] <= 0;
      else button.disabled = destroyed || busy || env.isPaused();
    });
  }

  function flashBottle(index) {
    const button = q('.wb-water-bottle[data-bottle="' + index + '"]');
    if (!button) return;
    button.classList.add('bad');
    later(() => button.classList.remove('bad'), 260);
  }

  function pushHistory() {
    history.push({
      bottles:bottles.map(bottle => bottle.slice()),
      solution:solution.map(move => ({ from:move.from, to:move.to })),
      moves,
      totalMoves:details.totalMoves,
      efficientStreak:details.efficientStreak,
    });
    if (history.length > 40) history.shift();
  }

  function selectBottle(index) {
    if (destroyed || busy || env.isPaused() || !bottles[index]) return;
    hintPair = null;
    if (selected < 0) {
      if (!bottles[index].length) {
        flashBottle(index);
        return;
      }
      selected = index;
      draw();
      return;
    }
    if (selected === index) {
      selected = -1;
      draw();
      return;
    }
    if (!canPourWater(bottles, selected, index)) {
      if (bottles[index].length) selected = index;
      else flashBottle(index);
      env.speak('invalid');
      draw();
      return;
    }
    performPour(selected, index);
  }

  function performPour(from, to) {
    if (busy) return;
    pushHistory();
    busy = true;
    const sourceButton = q('.wb-water-bottle[data-bottle="' + from + '"]');
    const targetButton = q('.wb-water-bottle[data-bottle="' + to + '"]');
    if (sourceButton) sourceButton.classList.add('pour-source');
    if (targetButton) targetButton.classList.add('pour-target');
    later(() => {
      const targetBefore = bottles[to].length;
      const result = pourWater(bottles, from, to);
      if (!result.moved) {
        history.pop();
        busy = false;
        selected = -1;
        draw();
        return;
      }
      bottles = result.bottles;
      moves++;
      details.totalMoves++;
      const expected = solution[0];
      if (expected && expected.from === from && expected.to === to) solution.shift();
      else solution = [];
      if (targetBefore) {
        details.sameColorPours++;
        details.efficientStreak++;
        details.maxEfficientStreak = Math.max(details.maxEfficientStreak || 0, details.efficientStreak);
        env.speak(details.efficientStreak >= 3 ? 'streak' : 'merge');
      } else {
        details.efficientStreak = 0;
        env.speak('pour');
      }
      selected = -1;
      busy = false;
      draw();
      if (isWaterSortSolved(bottles)) finishLevel();
      else save();
    }, 230);
  }

  function finishLevel() {
    busy = true;
    details.levelsCleared++;
    details.maxColors = Math.max(details.maxColors || 0, colorCount);
    if (baseEmptyCount === 1) details.oneEmptyLevels++;
    const efficiency = Math.max(0, par + 8 - moves) * 25;
    const noAssist = levelStats.hints + levelStats.undos + levelStats.extra + levelStats.resets === 0;
    const reward = 550 + level * 170 + efficiency + (noAssist ? 180 : 0);
    if (noAssist) {
      details.perfectLevels++;
      env.speak('perfect');
    } else env.speak('level_clear');
    score += reward;
    env.setScore(score);
    showBanner('第 ' + level + ' 关完成 +' + reward, 850);
    tools.undo = Math.min(5, (tools.undo || 0) + 1);
    if (level % 2 === 0) tools.hint = Math.min(3, (tools.hint || 0) + 1);
    if (level % 5 === 0) tools.extra = Math.min(1, (tools.extra || 0) + 1);
    later(() => startLevel(level + 1), 950);
  }

  function startLevel(nextLevel) {
    level = nextLevel;
    const generated = createWaterSortLevel(level);
    bottles = generated.bottles;
    initialBottles = bottles.map(bottle => bottle.slice());
    solution = generated.solution;
    initialSolution = solution.map(move => ({ from:move.from, to:move.to }));
    par = generated.par;
    colorCount = generated.colorCount;
    baseEmptyCount = generated.emptyCount;
    moves = 0;
    selected = -1;
    busy = false;
    history = [];
    hintPair = null;
    levelStats = { hints:0, undos:0, extra:0, resets:0 };
    env.speak('level_up');
    draw();
    showBanner('第 ' + level + ' 关 · ' + colorCount + '色' + baseEmptyCount + '空瓶', 800);
    save(true);
  }

  function finishGame() {
    if (destroyed) return;
    const finalDetails = Object.assign({}, details, { score, level, currentMoves:moves, colorCount, baseEmptyCount });
    destroy();
    env.clear();
    env.setScore(score);
    env.speak('settle');
    env.finish('本局结算', '累计总分：' + score + '分，到达第' + level + '关，已完成' + details.levelsCleared + '关，总步数' + details.totalMoves + '步', { outcome:'score', score }, { score, level, details:finalDetails });
  }

  function useUndo() {
    if (destroyed || busy || env.isPaused() || tools.undo <= 0 || !history.length) return;
    const previous = history.pop();
    bottles = previous.bottles;
    solution = previous.solution;
    moves = previous.moves;
    details.totalMoves = previous.totalMoves;
    details.efficientStreak = previous.efficientStreak;
    tools.undo--;
    details.undosUsed++;
    levelStats.undos++;
    selected = -1;
    hintPair = null;
    env.speak('undo');
    draw();
    save();
  }

  function useHint() {
    if (destroyed || busy || env.isPaused() || tools.hint <= 0) return;
    const move = waterSortHint(bottles, solution);
    if (!move) {
      env.toast('当前没有可提示的合法倒水步骤');
      return;
    }
    tools.hint--;
    details.hintsUsed++;
    levelStats.hints++;
    hintPair = move;
    env.speak('hint');
    draw();
    later(() => {
      hintPair = null;
      draw();
    }, 1300);
    save();
  }

  function useExtraBottle() {
    if (destroyed || busy || env.isPaused() || tools.extra <= 0) return;
    tools.extra--;
    details.extraUsed++;
    levelStats.extra++;
    bottles.push([]);
    initialBottles.push([]);
    selected = -1;
    env.speak('extra');
    showBanner('增加一个空瓶', 650);
    draw();
    save();
  }

  function resetLevel() {
    if (destroyed || busy || env.isPaused()) return;
    bottles = initialBottles.map(bottle => bottle.slice());
    solution = initialSolution.map(move => ({ from:move.from, to:move.to }));
    moves = 0;
    selected = -1;
    history = [];
    details.resets++;
    levelStats.resets++;
    details.efficientStreak = 0;
    env.speak('reset');
    draw();
    save();
  }

  root.querySelector('[data-tool="undo"]').addEventListener('click', useUndo);
  root.querySelector('[data-tool="hint"]').addEventListener('click', useHint);
  root.querySelector('[data-tool="extra"]').addEventListener('click', useExtraBottle);
  root.querySelector('[data-tool="reset"]').addEventListener('click', resetLevel);
  root.querySelector('[data-tool="finish"]').addEventListener('click', finishGame);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    timers.forEach(timer => win.clearTimeout(timer));
    timers.clear();
  }

  env.setScore(score);
  env.speak(state?.bottles ? 'resume' : 'start');
  draw();
  save(true);
  return { destroy, save:() => save(true), getState:stateData };
}
