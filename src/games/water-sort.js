import { WATER_SORT_BANK } from './water-sort-bank.js';
import { generateWaterSortCandidate, waterSortDifficulty, waterSortRandom, waterSortStructureKey } from './water-sort-puzzles.js';
export { waterSortDifficulty } from './water-sort-puzzles.js';
const CAPACITY = 4;
const MAX_EXTRA_BOTTLES_PER_LEVEL = 1;
const MAX_TOTAL_BOTTLES = 20 + MAX_EXTRA_BOTTLES_PER_LEVEL;
const MAX_LAYOUT_BOTTLES = 23; // Older saves can still contain three helper bottles.
const bankStructureKeys = new WeakMap();
export const WATER_COLORS = [
  '#d63848', '#2879c8', '#efbc22', '#18e8b8', '#384818', '#c828b8',
  '#f8b8d8', '#68b818', '#682858', '#1828a8', '#58d8f8', '#c8c898',
  '#a86828', '#186878', '#f86818', '#b888f8', '#f868a8', '#0800f8',
];
const WATER_COLOR_NAMES = ['红色','蓝色','金黄色','薄荷绿','深橄榄绿','洋红','浅粉色','草绿','梅子紫','靛蓝','天蓝','米黄色','棕色','墨青','橙色','淡紫色','玫粉色','亮宝蓝'];

export function waterSortLayout(bottleCount, width = 360, height = 360) {
  const count = Math.max(1, Math.min(MAX_LAYOUT_BOTTLES, Math.floor(Number(bottleCount) || 1)));
  const safeWidth = Math.max(220, Number(width) || 360);
  const safeHeight = Math.max(220, Number(height) || 360);
  const comfortableColumns = safeWidth < 300 ? 4 : safeWidth < 400 ? 5 : safeWidth < 540 ? 6 : 7;
  const rows = Math.min(3, Math.max(1, Math.ceil(count / comfortableColumns)));
  const columns = Math.min(8, Math.max(Math.min(count, 4), Math.ceil(count / rows)));
  const compact = safeWidth <= 560;
  const gapX = compact ? 3 : 10;
  const gapY = compact ? 8 : 16;
  const paddingX = compact ? 4 : 12;
  const paddingY = compact ? 12 : 22;
  const cellWidth = Math.max(columns > 7 ? 20 : 28, Math.min(64, Math.floor((safeWidth - paddingX * 2 - gapX * (columns - 1)) / columns)));
  const rowHeight = Math.max(64, Math.min(120, Math.floor((safeHeight - paddingY * 2 - gapY * (rows - 1)) / rows)));
  return { columns, rows, cellWidth, rowHeight };
}

export function waterSortBottleRewardLimit(referenceMoves) {
  const reference = Math.max(0, Math.floor(Number(referenceMoves) || 0));
  return reference ? Math.ceil(reference * 1.1) : 0;
}

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

export function verifyWaterSortSolution(bottles, solution, colorCount) {
  let current = bottles.map(bottle => bottle.slice());
  for (const move of solution || []) {
    const result = pourWater(current, move.from, move.to);
    if (!result.moved) return false;
    current = result.bottles;
  }
  return isWaterSortSolved(current) && current.filter(bottle => bottle.length).length === colorCount;
}

export function createWaterSortLevel(level, random = Math.random, excluded = []) {
  // Keep first entry and Worker fallbacks bounded on the UI thread.
  const fresh = generateWaterSortCandidate(level, random, { attempts:48, maxNodes:800, maxTimeMs:12, excluded });
  if (fresh && verifyWaterSortSolution(fresh.bottles, fresh.solution, fresh.colorCount)) return fresh;
  const config = waterSortDifficulty(level);
  const pool = WATER_SORT_BANK[config.structureTier - 1].slice();
  let item;
  while (pool.length) {
    const candidate = pool.splice(Math.floor(random() * pool.length), 1)[0];
    item ||= candidate;
    if (!excluded.length) break;
    let key = bankStructureKeys.get(candidate);
    if (key === undefined) { key = waterSortStructureKey(candidate.bottles); bankStructureKeys.set(candidate, key); }
    if (!excluded.includes(key)) { item = candidate; break; }
  }
  const order = item.bottles.map((_, index) => index);
  const colors = Array.from({ length:config.colorCount }, (_, index) => index);
  for (const values of [order, colors]) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
  }
  const inverse = order.map((_, index) => order.indexOf(index));
  return { ...item, bottles:order.map(index => item.bottles[index].map(color => colors[color])),
    solution:item.solution.map(move => ({ from:inverse[move.from], to:inverse[move.to] })) };
}

export function waterSortLegalMoves(bottles) {
  const moves = [];
  for (let from = 0; from < bottles.length; from++) {
    for (let to = 0; to < bottles.length; to++) {
      if (!canPourWater(bottles, from, to)) continue;
      const source = bottles[from];
      const target = bottles[to];
      const run = topRun(source);
      moves.push({ from, to, joins:!!target.length, exposes:source.length > run.count });
    }
  }
  return moves;
}

export function waterSortHint(bottles) {
  return waterSortLegalMoves(bottles);
}

function waterSortHintColor(index) {
  const hue = Math.round((index * 137.508 + 8) % 360);
  const saturation = [88, 78, 94][index % 3];
  const lightness = [43, 54][Math.floor(index / 3) % 2];
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function ensureStyles(doc) {
  if (doc.getElementById('wb-water-sort-module-css')) return;
  const style = doc.createElement('style');
  style.id = 'wb-water-sort-module-css';
  style.textContent = `
    .wb-water-sort-shell{width:100%;height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:8px;overflow:hidden}
    .wb-water-sort-top{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
    .wb-water-sort-stat{min-width:0;display:grid;gap:3px;text-align:center;padding:6px 3px;border-bottom:1px solid var(--wb-border)}
    .wb-water-sort-stat span{font-size:10px;color:var(--wb-muted)}
    .wb-water-sort-stat b{font-size:13px;color:var(--wb-text)}
    .wb-water-sort-board{position:relative;width:100%;height:100%;min-height:0;display:grid;grid-template-columns:repeat(var(--water-cols,5),var(--water-cell-width,64px));grid-auto-rows:var(--water-row-height,120px);justify-content:center;align-content:safe center;gap:16px 10px;padding:22px 12px;box-sizing:border-box;overflow:auto;overscroll-behavior:contain;background:radial-gradient(ellipse at 20% 0,rgba(210,234,230,.6),transparent 60%),linear-gradient(160deg,#f6f9f5,#f0f4f5 65%,#faf4e9);border:1px solid #d6e1df;border-radius:14px}
    .wb-water-bottle{position:relative;width:100%;height:100%;min-width:0;padding:0!important;border:0!important;box-shadow:none!important;background:transparent!important;cursor:pointer;touch-action:manipulation;transition:transform .18s ease}
    .wb-water-bottle::after{content:'';position:absolute;z-index:3;inset:4px 10% 8px;border:1.5px solid #7f9699;border-top:0;border-radius:0 0 20px 20px;box-shadow:inset 3px 0 rgba(255,255,255,.55);pointer-events:none}
    .wb-water-bottle::before{content:'';position:absolute;z-index:4;top:2px;left:8%;right:8%;height:3px;border:1.5px solid #7f9699;border-radius:4px;background:#f6faf9;pointer-events:none}
    .wb-water-glass{position:absolute;inset:10px 13% 11px;overflow:hidden;border-radius:0 0 17px 17px;background:rgba(255,255,255,.35)}
    .wb-water-fill{position:absolute;left:0;right:0;bottom:calc(var(--layer) * 25%);height:calc(var(--count) * 25%);background:var(--water);display:grid;place-items:center}
    .wb-water-fill.surface{box-shadow:inset 0 2px rgba(255,255,255,.4)}
    .wb-water-bottle.selected{transform:translateY(-7px)}
    .wb-water-bottle.selected::after{border-color:#c18932;box-shadow:0 0 0 2px rgba(193,137,50,.15)}
    .wb-water-bottle.hinted{animation:wbWaterHint 1.05s ease-in-out infinite;filter:drop-shadow(0 0 8px rgba(124,58,237,.72))}
    .wb-water-bottle.hinted::after{border:2.5px solid #7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.24),0 0 17px 4px rgba(124,58,237,.4),inset 0 0 9px rgba(124,58,237,.15)}
    .wb-water-hint-marks{position:absolute;z-index:7;top:-3px;left:0;right:0;display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-start;gap:2px 3px;padding:0 1px;pointer-events:none}
    .wb-water-hint-mark{width:10px;height:10px;box-sizing:border-box;border:1.5px solid #fff;border-radius:999px;background:var(--hint-color);box-shadow:0 1px 4px rgba(15,23,42,.62),0 0 6px var(--hint-color)}
    .wb-water-bottle.pour-source{transform:translateY(-8px) rotate(12deg)}
    .wb-water-bottle.hinted.pour-source{animation:none}
    .wb-water-bottle.pour-target{animation:wbWaterReceive .23s ease}
    .wb-water-bottle.bad{animation:wbWaterBad .24s ease}
    .wb-water-bottle.done:not(.hinted)::after{border-color:#4b9b7f}
    .wb-water-stream{position:absolute;z-index:5;height:3px;border-radius:2px;transform-origin:left center;background:var(--water);pointer-events:none;animation:wbWaterFlow .23s ease both}
    .wb-water-tools{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}
    .wb-water-tool{min-width:0;min-height:40px;padding:5px 3px!important;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:3px;font-size:11px}
    .wb-water-tool i{font-style:normal;font-size:14px}
    .wb-water-tool:disabled{opacity:.4;cursor:default}
    .wb-water-banner{position:absolute;z-index:8;left:50%;top:40%;transform:translate(-50%,-50%);max-width:85%;padding:10px 14px;border-radius:10px;background:rgba(31,58,56,.94);color:#fff;font-size:13px;opacity:0;pointer-events:none;transition:opacity .18s}
    .wb-water-banner.show{opacity:1}
    @keyframes wbWaterReceive{50%{transform:translateY(2px)}}
    @keyframes wbWaterBad{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
    @keyframes wbWaterFlow{0%,100%{opacity:0}25%,80%{opacity:.8}}
    @keyframes wbWaterHint{0%,100%{transform:translateY(-2px) scale(1)}50%{transform:translateY(-5px) scale(1.045)}}
    @media(max-width:560px){.wb-water-sort-shell{gap:5px}.wb-water-sort-stat b{font-size:11px}.wb-water-sort-board{gap:8px 3px;padding:12px 4px}.wb-water-tool{font-size:10px;min-height:38px}}
    @media(prefers-reduced-motion:reduce){.wb-water-bottle{transition:none}.wb-water-stream{display:none}.wb-water-bottle.hinted{animation:none}}
  `;
  doc.head.appendChild(style);
}

export function createWaterSortGame(state, env) {
  const doc = env.document;
  const win = env.window;
  const root = env.root;
  ensureStyles(doc);
  root.innerHTML = '<div class="wb-water-sort-shell"><div class="wb-water-sort-top"><div class="wb-water-sort-stat"><span>关卡</span><b id="wb-water-level"></b></div><div class="wb-water-sort-stat"><span>总分</span><b id="wb-water-score"></b></div><div class="wb-water-sort-stat"><span>步数 / 奖励线</span><b id="wb-water-moves" title="奖励线为本关内置参考步数的110%；不超过奖励线通关即可奖励1个空瓶。"></b></div><div class="wb-water-sort-stat"><span>难度</span><b id="wb-water-difficulty"></b></div></div><div class="wb-water-sort-board" id="wb-water-board"><div class="wb-water-banner" id="wb-water-banner"></div></div><div class="wb-water-tools"><button type="button" class="wb-btn wb-water-tool" data-tool="undo"><i>↶</i>撤回</button><button type="button" class="wb-btn wb-water-tool" data-tool="hint"><i>◎</i>提示 <b id="wb-water-hint"></b></button><button type="button" class="wb-btn wb-water-tool" data-tool="extra"><i>＋</i>空瓶 <b id="wb-water-extra"></b></button><button type="button" class="wb-btn wb-water-tool" data-tool="reset" title="重置本关"><i>↻</i>重置</button><button type="button" class="wb-btn wb-water-tool" data-tool="finish" title="结束并结算本局"><i>■</i>结算</button></div></div>';

  const seed = Number.isInteger(state?.seed) ? state.seed : Math.floor(Math.random() * 4294967296);
  let level = Math.max(1, Math.floor(Number(state?.level) || 1));
  let seenStructures = Array.isArray(state?.seenStructures) ? state.seenStructures.slice(-240) : [];
  const generated = !Array.isArray(state?.bottles) ? createWaterSortLevel(level, waterSortRandom(seed + level), seenStructures) : null;
  let bottles = generated ? generated.bottles : state.bottles.map(bottle => Array.isArray(bottle) ? bottle.slice(0, CAPACITY).map(Number) : []);
  let initialBottles = Array.isArray(state?.initialBottles) ? state.initialBottles.map(bottle => bottle.slice()) : bottles.map(bottle => bottle.slice());
  let solution = Array.isArray(state?.solution) ? state.solution.map(move => ({ from:Number(move.from), to:Number(move.to) })) : (generated?.solution || []);
  let initialSolution = Array.isArray(state?.initialSolution) ? state.initialSolution.map(move => ({ from:Number(move.from), to:Number(move.to) })) : solution.map(move => ({ from:move.from, to:move.to }));
  let par = Number(state?.par) || generated?.par || 0;
  if (!Number.isInteger(par) || par < 1) par = 0;
  if (!par && (!state?.moves || Array.isArray(state?.initialBottles)) && verifyWaterSortSolution(initialBottles, initialSolution, new Set(initialBottles.flat()).size)) par = initialSolution.length;
  let colorCount = Math.max(1, Number(state?.colorCount) || generated?.colorCount || (Math.max(-1, ...bottles.flat()) + 1));
  let baseEmptyCount = Math.max(0, Number(state?.baseEmptyCount ?? generated?.emptyCount ?? (state?.bottles ? 2 : waterSortDifficulty(level).emptyCount)) || 0);
  let baseBottleCount = Math.max(1, Number(state?.baseBottleCount) || generated?.bottles.length || colorCount + baseEmptyCount);
  let score = Math.max(0, Number(state?.score) || 0);
  let moves = Math.max(0, Number(state?.moves) || 0);
  let selected = -1;
  let busy = false;
  let pendingPour = null;
  let history = Array.isArray(state?.history) ? state.history.map(item => ({
    ...(Array.isArray(item?.bottles) ? { bottles:item.bottles.map(bottle => bottle.slice()) } : {
      from:Number(item?.from), to:Number(item?.to),
      source:Array.isArray(item?.source) ? item.source.slice() : [],
      target:Array.isArray(item?.target) ? item.target.slice() : [],
    }),
    solution:Array.isArray(item?.solution) ? item.solution.map(move => ({ from:Number(move.from), to:Number(move.to) })) : [],
    moves:Math.max(0, Number(item?.moves) || 0),
    totalMoves:Math.max(0, Number(item?.totalMoves ?? item?.details?.totalMoves) || 0),
    efficientStreak:Math.max(0, Number(item?.efficientStreak ?? item?.details?.efficientStreak) || 0),
  })).filter(item => item.bottles ? item.bottles.length === bottles.length
    : Number.isInteger(item.from) && Number.isInteger(item.to) && item.from !== item.to
      && !!bottles[item.from] && !!bottles[item.to] && item.source.length > 0) : [];
  const limits = { hint:3, extra:5 };
  let tools = Object.fromEntries(Object.entries(limits).map(([key, limit]) => {
    const saved = Number(state?.tools?.[key]);
    const amount = Number.isFinite(saved) ? saved : limit;
    return [key, Math.min(limit, Math.max(0, Math.floor(amount)))];
  }));
  let details = Object.assign({ totalMoves:0, levelsCleared:0, perfectLevels:0, hintsUsed:0, undosUsed:0, extraUsed:0, resets:0, sameColorPours:0, maxEfficientStreak:0, efficientStreak:0, maxColors:colorCount, oneEmptyLevels:0 }, state?.details || {});
  let levelStats = Object.assign({ hints:0, undos:0, extra:0, resets:0 }, state?.levelStats || {});
  levelStats.extra = Math.max(Number(levelStats.extra) || 0, bottles.length - baseBottleCount);
  let levelComplete = !!state?.levelComplete;
  let prepared = null;
  let requestSerial = 0;
  const workers = new Set();
  const savedHints = Array.isArray(state?.hintMoves) ? state.hintMoves : (state?.hintPair ? [state.hintPair] : []);
  let hintMoves = savedHints
    .filter(move => Number.isInteger(move?.from) && Number.isInteger(move?.to) && canPourWater(bottles, move.from, move.to))
    .map(move => ({ from:move.from, to:move.to }))
    .filter((move, index, list) => list.findIndex(item => item.from === move.from && item.to === move.to) === index);
  let destroyed = false;
  const timers = new Set();
  let boardObserver = null;

  function backgroundRequest(kind, payload) {
    if (!win.Worker) return Promise.resolve(null);
    return new Promise(resolve => {
      let worker;
      let timer;
      const finish = result => {
        if (!workers.has(job)) return;
        workers.delete(job);
        win.clearTimeout(timer);
        worker?.terminate();
        resolve(result);
      };
      const job = { cancel:() => finish(null) };
      workers.add(job);
      try {
        worker = new win.Worker(new URL('./water-sort-worker.js', import.meta.url), { type:'module' });
        worker.onmessage = event => finish(event.data.result);
        worker.onerror = () => finish(null);
        timer = win.setTimeout(() => finish(null), 6000);
        worker.postMessage({ id:++requestSerial, kind, ...payload });
      } catch { finish(null); }
    });
  }

  function prepareNextLevel() {
    const next = level + 1;
    backgroundRequest('generate', { level:next, seed:(seed + next) >>> 0, excluded:seenStructures }).then(result => {
      if (destroyed || level + 1 !== next || !result || !verifyWaterSortSolution(result.bottles, result.solution, result.colorCount)) return;
      prepared = { level:next, puzzle:result };
    });
  }

  function rememberPuzzle() {
    const original = initialBottles.slice();
    // Purchased helper bottles do not change the generated puzzle structure.
    for (let remaining = levelStats.extra; remaining > 0 && original.length > baseBottleCount && !original[original.length - 1].length; remaining--) original.pop();
    const signature = waterSortStructureKey(original);
    if (!seenStructures.includes(signature)) seenStructures.push(signature);
    seenStructures = seenStructures.slice(-240);
  }

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
      version:5, seed, seenStructures:seenStructures.slice(), levelComplete,
      level,
      bottles:bottles.map(bottle => bottle.slice()),
      initialBottles:initialBottles.map(bottle => bottle.slice()),
      initialSolution:initialSolution.map(move => ({ from:move.from, to:move.to })),
      solution:solution.map(move => ({ from:move.from, to:move.to })),
      par,
      colorCount,
      baseEmptyCount,
      baseBottleCount,
      score,
      moves,
      tools:Object.assign({}, tools),
      details:Object.assign({}, details),
      levelStats:Object.assign({}, levelStats),
      hintMoves:hintMoves.map(move => ({ from:move.from, to:move.to })),
      history:history.map(item => ({
        ...(item.bottles ? { bottles:item.bottles.map(bottle => bottle.slice()) } : {
          from:item.from, to:item.to, source:item.source.slice(), target:item.target.slice(),
        }),
        solution:item.solution.map(move => ({ from:move.from, to:move.to })),
        moves:item.moves,
        totalMoves:item.totalMoves,
        efficientStreak:item.efficientStreak,
      })),
    };
  }

  function save(force) {
    if (force && pendingPour) {
      const commit = pendingPour;
      pendingPour = null;
      commit();
    }
    if (!destroyed) env.save(stateData(), force);
  }

  function showBanner(text, duration = 700) {
    const banner = q('#wb-water-banner');
    if (!banner) return;
    banner.textContent = text;
    banner.classList.add('show');
    later(() => q('#wb-water-banner')?.classList.remove('show'), duration);
  }

  function layoutBoard(board) {
    if (!board) return;
    const layout = waterSortLayout(bottles.length, board.clientWidth, board.clientHeight);
    board.style.setProperty('--water-cols', String(layout.columns));
    board.style.setProperty('--water-rows', String(layout.rows));
    board.style.setProperty('--water-cell-width', layout.cellWidth + 'px');
    board.style.setProperty('--water-row-height', layout.rowHeight + 'px');
  }

  function draw() {
    const board = q('#wb-water-board');
    if (!board) return;
    layoutBoard(board);
    const banner = q('#wb-water-banner');
    const bannerHTML = banner ? banner.outerHTML : '<div class="wb-water-banner" id="wb-water-banner"></div>';
    board.innerHTML = bannerHTML + bottles.map((bottle, index) => {
      const complete = bottle.length === CAPACITY && bottle.every(color => color === bottle[0]);
      const bottleHints = hintMoves.flatMap((move, hintIndex) => move.from === index || move.to === index
        ? [{ hintIndex, color:waterSortHintColor(hintIndex) }] : []);
      const classes = [
        'wb-water-bottle',
        index === selected ? 'selected' : '',
        bottleHints.length ? 'hinted' : '',
        complete ? 'done' : '',
      ].filter(Boolean).join(' ');
      const groups = [];
      bottle.forEach((color, layer) => {
        const last = groups[groups.length - 1];
        if (last?.color === color) last.count++;
        else groups.push({ color, layer, count:1 });
      });
      const layers = groups.map(({ color, layer, count }, group) => '<span class="wb-water-fill' + (group === groups.length - 1 ? ' surface' : '') + '" style="--layer:' + layer + ';--count:' + count + ';--water:' + WATER_COLORS[color % WATER_COLORS.length] + '"></span>').join('');
      const label = bottle.length ? '，从底到顶 ' + bottle.map(color => WATER_COLOR_NAMES[color % WATER_COLOR_NAMES.length]).join('、') : '，空瓶';
      const hintMarks = bottleHints.length ? '<span class="wb-water-hint-marks" aria-hidden="true">' + bottleHints.map(hint => '<span class="wb-water-hint-mark" style="--hint-color:' + hint.color + '"></span>').join('') + '</span>' : '';
      const hintLabel = bottleHints.length ? '，包含可走方案 ' + bottleHints.map(hint => hint.hintIndex + 1).join('、') : '';
      return '<button type="button" class="' + classes + '" data-bottle="' + index + '" aria-label="瓶子 ' + (index + 1) + label + hintLabel + '">' + hintMarks + '<span class="wb-water-glass">' + layers + '</span></button>';
    }).join('');
    board.querySelectorAll('.wb-water-bottle').forEach(button => {
      button.addEventListener('click', () => selectBottle(Number(button.dataset.bottle)));
    });
    updateUI();
  }

  function updateUI() {
    const levelDifficulty = waterSortDifficulty(level);
    const cycle = levelDifficulty.endlessCycle;
    const bottleRewardLimit = waterSortBottleRewardLimit(par);
    const fields = [
      ['#wb-water-level', level],
      ['#wb-water-score', score],
      ['#wb-water-moves', moves + ' / ' + (bottleRewardLimit || '--')],
      ['#wb-water-difficulty', colorCount + '色 · ' + ['较易', '中等', '较难'][levelDifficulty.roundIndex] + (cycle ? ' ∞' : '')],
      ['#wb-water-hint', tools.hint],
      ['#wb-water-extra', tools.extra],
    ];
    fields.forEach(([selector, value]) => {
      const el = q(selector);
      if (el) el.textContent = String(value);
    });
    root.querySelectorAll('.wb-water-tool').forEach(button => {
      const tool = button.dataset.tool;
      const locked = destroyed || busy;
      // The host pause overlay handles pause; do not leave stale disabled flags after resume.
      if (tool === 'undo') button.disabled = locked || !history.length;
      else if (tool === 'extra') button.disabled = locked || tools.extra <= 0 || levelStats.extra >= MAX_EXTRA_BOTTLES_PER_LEVEL || bottles.length >= MAX_TOTAL_BOTTLES;
      else if (tool === 'hint') button.disabled = locked || tools.hint <= 0;
      else button.disabled = locked;
    });
  }

  function flashBottle(index) {
    const button = q('.wb-water-bottle[data-bottle="' + index + '"]');
    if (!button) return;
    button.classList.add('bad');
    later(() => button.classList.remove('bad'), 260);
  }

  function pushHistory(from, to) {
    // Store only the two changed bottles so unlimited undo keeps saves compact.
    history.push({
      from, to, source:bottles[from].slice(), target:bottles[to].slice(),
      solution:solution.map(move => ({ from:move.from, to:move.to })),
      moves,
      totalMoves:details.totalMoves,
      efficientStreak:details.efficientStreak,
    });
  }

  function selectBottle(index) {
    if (destroyed || busy || env.isPaused() || !bottles[index]) return;
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
    pushHistory(from, to);
    busy = true;
    const sourceButton = q('.wb-water-bottle[data-bottle="' + from + '"]');
    const targetButton = q('.wb-water-bottle[data-bottle="' + to + '"]');
    if (sourceButton) sourceButton.classList.add('pour-source');
    if (targetButton) targetButton.classList.add('pour-target');
    if (sourceButton?.getBoundingClientRect && targetButton?.getBoundingClientRect) {
      const board = q('#wb-water-board');
      const a = sourceButton.getBoundingClientRect(), b = targetButton.getBoundingClientRect(), rect = board.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top - a.top;
      const stream = doc.createElement('span');
      stream.className = 'wb-water-stream';
      stream.style.cssText = 'left:' + (a.left + a.width / 2 - rect.left + board.scrollLeft) + 'px;top:' + (a.top - rect.top + board.scrollTop + 5) + 'px;width:' + Math.hypot(dx, dy) + 'px;transform:rotate(' + Math.atan2(dy, dx) + 'rad);--water:' + WATER_COLORS[topRun(bottles[from]).color];
      board.appendChild(stream);
    }
    const commit = () => {
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
      hintMoves = [];
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
    };
    pendingPour = commit;
    later(() => {
      const pending = pendingPour;
      pendingPour = null;
      pending?.();
    }, 230);
  }

  function finishLevel() {
    busy = true;
    details.levelsCleared++;
    details.maxColors = Math.max(details.maxColors || 0, colorCount);
    if (baseEmptyCount === 1) details.oneEmptyLevels++;
    const efficiency = Math.max(0, (par || 1) + 8 - moves) * 25;
    const noAssist = levelStats.hints + levelStats.undos + levelStats.extra + levelStats.resets === 0;
    const difficulty = waterSortDifficulty(level);
    const reward = 300 + colorCount * 90 + difficulty.minComplexity * 10 + Math.min(10, difficulty.endlessCycle) * 80 + efficiency + (noAssist ? 180 : 0);
    if (noAssist) {
      details.perfectLevels++;
      env.speak('perfect');
    } else env.speak('level_clear');
    score += reward;
    env.setScore(score);
    const bottleRewardLimit = waterSortBottleRewardLimit(par);
    const toolRewards = [];
    if (bottleRewardLimit > 0 && moves <= bottleRewardLimit && tools.extra < limits.extra) toolRewards.push('空瓶 +1');
    if (bottleRewardLimit > 0 && moves <= bottleRewardLimit) tools.extra = Math.min(limits.extra, (tools.extra || 0) + 1);
    showBanner('第 ' + level + ' 关完成 +' + reward + (toolRewards.length ? ' · ' + toolRewards.join(' · ') : ''), 850);
    levelComplete = true;
    env.save(stateData(), true);
    later(() => startLevel(level + 1), 950);
  }

  function startLevel(nextLevel) {
    level = nextLevel;
    const generated = prepared?.level === level ? prepared.puzzle : createWaterSortLevel(level, waterSortRandom(seed + level), seenStructures);
    prepared = null;
    levelComplete = false;
    bottles = generated.bottles;
    initialBottles = bottles.map(bottle => bottle.slice());
    solution = generated.solution;
    initialSolution = solution.map(move => ({ from:move.from, to:move.to }));
    par = generated.par;
    colorCount = generated.colorCount;
    baseEmptyCount = generated.emptyCount;
    baseBottleCount = generated.bottles.length;
    moves = 0;
    selected = -1;
    busy = false;
    history = [];
    hintMoves = [];
    levelStats = { hints:0, undos:0, extra:0, resets:0 };
    tools.hint = limits.hint;
    rememberPuzzle();
    env.speak('level_up');
    draw();
    const levelDifficulty = waterSortDifficulty(level);
    const cycle = levelDifficulty.endlessCycle;
    showBanner('第 ' + level + ' 关 · ' + colorCount + '色 · 随机水位' + (cycle ? ' · 无尽' + cycle + '档' : ''), 800);
    save(true);
    prepareNextLevel();
  }

  function finishGame() {
    if (destroyed || busy || env.isPaused()) return;
    const finalDetails = Object.assign({}, details, { score, level, currentMoves:moves, colorCount, baseEmptyCount });
    destroy();
    env.clear();
    env.setScore(score);
    env.speak('settle');
    env.finish('本局结算', '累计总分：' + score + '分，到达第' + level + '关，已完成' + details.levelsCleared + '关，总步数' + details.totalMoves + '步', { outcome:'score', score }, { score, level, details:finalDetails });
  }

  function requestFinish() {
    if (destroyed || busy || env.isPaused()) return;
    env.confirm('结束并结算？', '确定要结束当前倒瓶子游戏并结算吗？取消后可以继续本局。', finishGame);
  }

  function useUndo() {
    if (destroyed || busy || env.isPaused() || !history.length) return;
    const previous = history.pop();
    if (previous.bottles) bottles = previous.bottles;
    else {
      bottles[previous.from] = previous.source;
      bottles[previous.to] = previous.target;
    }
    solution = previous.solution;
    moves = previous.moves;
    details.totalMoves = previous.totalMoves;
    details.efficientStreak = previous.efficientStreak;
    details.undosUsed++;
    levelStats.undos++;
    selected = -1;
    hintMoves = [];
    env.speak('undo');
    draw();
    save();
  }

  function useHint() {
    if (destroyed || busy || env.isPaused() || tools.hint <= 0) return;
    const availableMoves = waterSortHint(bottles);
    if (!availableMoves.length) {
      env.toast('当前没有可以倒水的方案，不扣提示次数；可撤回、加空瓶或重置后再试。');
      return;
    }
    tools.hint--;
    details.hintsUsed++;
    levelStats.hints++;
    hintMoves = availableMoves
      .filter((move, index, list) => list.findIndex(item => Math.min(item.from, item.to) === Math.min(move.from, move.to)
        && Math.max(item.from, item.to) === Math.max(move.from, move.to)) === index)
      .map(move => ({ from:move.from, to:move.to }));
    env.speak('hint');
    draw();
    save();
  }

  function useExtraBottle() {
    if (destroyed || busy || env.isPaused() || tools.extra <= 0 || levelStats.extra >= MAX_EXTRA_BOTTLES_PER_LEVEL || bottles.length >= MAX_TOTAL_BOTTLES) return;
    tools.extra--;
    details.extraUsed++;
    levelStats.extra++;
    bottles.push([]);
    initialBottles.push([]);
    history.forEach(item => item.bottles?.push([]));
    selected = -1;
    hintMoves = [];
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
    hintMoves = [];
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
  root.querySelector('[data-tool="finish"]').addEventListener('click', requestFinish);

  function destroy() {
    if (destroyed) return;
    save(true);
    destroyed = true;
    timers.forEach(timer => win.clearTimeout(timer));
    timers.clear();
    workers.forEach(job => job.cancel());
    boardObserver?.disconnect();
    win.removeEventListener?.('pagehide', saveOnLeave);
    doc.removeEventListener?.('visibilitychange', saveOnHidden);
  }

  function saveOnLeave() { save(true); }
  function saveOnHidden() { if (doc.hidden) save(true); }
  win.addEventListener?.('pagehide', saveOnLeave);
  doc.addEventListener?.('visibilitychange', saveOnHidden);
  if (win.ResizeObserver) {
    boardObserver = new win.ResizeObserver(() => {
      if (!destroyed) layoutBoard(q('#wb-water-board'));
    });
    boardObserver.observe(q('#wb-water-board'));
  }
  env.setScore(score);
  env.speak(state?.bottles ? 'resume' : 'start');
  draw();
  rememberPuzzle();
  save(true);
  if (levelComplete) { busy = true; later(() => startLevel(level + 1), 0); }
  else if (isWaterSortSolved(bottles)) finishLevel();
  else prepareNextLevel();
  return { destroy, save:() => save(true), getState:stateData };
}
