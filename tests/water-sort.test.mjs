import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createWaterSortGame, createWaterSortLevel, verifyWaterSortSolution, pourWater, waterSortHint, waterSortLayout, WATER_COLORS } from '../src/games/water-sort.js';
import { WATER_SORT_BANK } from '../src/games/water-sort-bank.js';
import { generateWaterSortCandidate, solveWaterSort, waterSortDifficulty, waterSortMetrics, waterSortRandom, waterSortStateKey, waterSortStructureKey } from '../src/games/water-sort-puzzles.js';

function element() {
  const listeners = new Map(), props = new Map(), classes = new Set();
  return {
    dataset:{}, style:{ setProperty:(key, value) => props.set(key, value) },
    classList:{ add:x => classes.add(x), remove:x => classes.delete(x) },
    setAttribute() {},
    addEventListener:(event, listener) => listeners.set(event, listener),
    removeEventListener:event => listeners.delete(event),
    click() { return listeners.get('click')?.(); },
    dispatch(event) { listeners.get(event)?.(); },
  };
}

function harness(state = {}, Worker) {
  const ids = new Map(), toolButtons = new Map(), timers = new Map();
  let bottleButtons = [], tick = 0, nextTimer = 1, paused = false, saved, cleared = false, finished = false;
  const board = element();
  board.clientWidth = 320;
  board.clientHeight = 360;
  Object.defineProperty(board, 'innerHTML', { set(html) {
    bottleButtons = [...html.matchAll(/data-bottle="(\d+)"/g)].map(match => {
      const button = element(); button.dataset.bottle = match[1]; return button;
    });
  } });
  board.querySelectorAll = () => bottleButtons;
  ids.set('#wb-water-board', board);
  for (const id of ['level','score','moves','difficulty','undo','hint','extra','banner']) ids.set('#wb-water-' + id, element());
  for (const tool of ['undo','hint','extra','reset','finish']) {
    const button = element(); button.dataset.tool = tool; toolButtons.set(tool, button);
  }
  ids.set('.wb-water-tools', { appendChild:button => toolButtons.set(button.dataset.tool, button) });
  const root = {
    querySelector(selector) {
      if (ids.has(selector)) return ids.get(selector);
      const tool = selector.match(/data-tool="([^"]+)"/);
      if (tool) return toolButtons.get(tool[1]);
      const bottle = selector.match(/data-bottle="(\d+)"/);
      return bottle ? bottleButtons[Number(bottle[1])] : null;
    },
    querySelectorAll:() => [...toolButtons.values()],
  };
  const window = Object.assign(element(), {
    Worker,
    setTimeout(fn, delay) { const id = nextTimer++; timers.set(id, { fn, at:tick + delay }); return id; },
    clearTimeout:id => timers.delete(id),
  });
  const document = Object.assign(element(), { getElementById:() => ({}), createElement:element });
  const env = { root, window, document, save:value => { saved = structuredClone(value); },
    clear:() => { cleared = true; }, finish:() => { finished = true; }, setScore() {}, speak() {}, toast() {}, isPaused:() => paused };
  const game = createWaterSortGame(state, env);
  return {
    game, env, timers,
    get saved() { return saved; }, get cleared() { return cleared; }, get finished() { return finished; },
    pause:value => { paused = value; },
    tool:name => toolButtons.get(name).click(), button:name => toolButtons.get(name),
    bottle:index => bottleButtons[index].click(),
    advance(ms) {
      const until = tick + ms;
      while (true) {
        const entry = [...timers.entries()].filter(([, job]) => job.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        timers.delete(entry[0]); tick = entry[1].at; entry[1].fn();
      }
      tick = until;
    },
  };
}

test('all 400 normal and hard backup puzzles meet their tier and full reference paths', () => {
  for (const [index, variants] of WATER_SORT_BANK.entries()) {
    for (const [variant, pool] of variants.entries()) {
      const config = waterSortDifficulty(index * 3 + (variant ? 3 : 1));
      const signatures = new Set();
      for (const puzzle of pool) {
        assert.ok(verifyWaterSortSolution(puzzle.bottles, puzzle.solution, puzzle.colorCount));
        assert.equal(puzzle.bottles.length, config.colorCount + 2);
        assert.equal(puzzle.bottles.filter(b => !b.length).length, 0);
        assert.ok(puzzle.bottles.every(b => b.length > 0 && b.length <= 4));
        assert.ok(puzzle.bottles.some(b => b.length < 4));
        assert.ok(!puzzle.bottles.some(b => b.length === 4 && b.every(color => color === b[0])));
        for (let color = 0; color < config.colorCount; color++) assert.equal(puzzle.bottles.flat().filter(c => c === color).length, 4);
        const metrics = waterSortMetrics(puzzle.bottles);
        assert.equal(metrics.joinedLayers, puzzle.joinedLayers);
        assert.ok(metrics.mixed >= config.minMixed);
        assert.ok(metrics.complexity >= config.minComplexity && metrics.complexity <= config.minComplexity + 1);
        signatures.add(waterSortStructureKey(puzzle.bottles));
      }
      assert.equal(signatures.size, 5);
    }
    assert.ok(Math.min(...variants[1].map(p => p.complexity)) > Math.max(...variants[0].map(p => p.complexity)),
      'Third level is not harder in tier ' + (index + 1));
  }
});

test('first 120 levels remain reproducible and avoid recolored or bottle-permuted duplicates', () => {
  const excluded = [];
  for (let level = 1; level <= 120; level++) {
    const puzzle = createWaterSortLevel(level, waterSortRandom(level), excluded);
    assert.deepEqual(puzzle, createWaterSortLevel(level, waterSortRandom(level), excluded));
    const key = waterSortStructureKey(puzzle.bottles);
    assert.ok(!excluded.includes(key), 'Repeated structure at ' + level);
    excluded.push(key);
    const renamed = puzzle.bottles.slice().reverse().map(b => b.map(c => 100 - c));
    assert.equal(waterSortStructureKey(renamed), key);
  }
  assert.notEqual(waterSortStateKey([[1,11,2], []]), waterSortStateKey([[11,1,2], []]));
});

test('generated puzzles and hints have complete solutions; legal first move alone is insufficient', () => {
  for (const level of [1,51,116,151,196]) {
    const puzzle = generateWaterSortCandidate(level, waterSortRandom(level), { attempts:64 });
    assert.ok(puzzle, 'Generation failed at ' + level);
    assert.ok(verifyWaterSortSolution(puzzle.bottles, puzzle.solution, puzzle.colorCount));
    assert.ok(waterSortHint(puzzle.bottles, puzzle.solution)?.exact);
    assert.equal(waterSortHint(puzzle.bottles, puzzle.solution.slice(0, 1)), null);
  }
  assert.equal(solveWaterSort([[0,1,0,1], [1,0,1,0]], { maxNodes:100 }).solution, null);
});

test('progress restores water, tools, history, initial puzzle and the once-per-level extra bottle', () => {
  const h = harness({ seed:123 });
  assert.deepEqual(h.saved.tools, { undo:10, hint:5, extra:5 });
  const initial = h.saved.initialBottles;
  const first = h.saved.solution[0];
  h.bottle(first.from); h.bottle(first.to); h.advance(230);
  h.tool('extra'); h.tool('extra');
  assert.equal(h.saved.levelStats.extra, 1);
  assert.equal(h.saved.tools.extra, 4);
  assert.equal(h.saved.history[0].bottles.length, initial.length + 1);
  h.game.save(); h.game.destroy();
  assert.equal(h.cleared, false);
  const resumed = harness(h.saved);
  assert.deepEqual(resumed.saved, h.saved);
  resumed.tool('undo');
  assert.deepEqual(resumed.saved.bottles, [...initial, []]);
  assert.equal(resumed.saved.tools.undo, 9);
  resumed.tool('reset'); resumed.tool('extra');
  assert.equal(resumed.saved.tools.extra, 4);
  assert.equal(resumed.saved.levelStats.extra, 1);
  assert.equal(resumed.saved.bottles.length, initial.length + 1);
  resumed.game.destroy();
});

test('save during a pour, visibility change and pagehide commit once and survive exit', () => {
  for (const event of ['save','visibilitychange','pagehide']) {
    const h = harness({ seed:5 });
    const before = h.saved;
    const move = before.solution[0];
    h.bottle(move.from); h.bottle(move.to);
    if (event === 'save') h.game.save();
    else if (event === 'pagehide') h.env.window.dispatch(event);
    else { h.env.document.hidden = true; h.env.document.dispatch(event); }
    assert.deepEqual(h.saved.bottles, pourWater(before.bottles, move.from, move.to).bottles);
    assert.equal(h.saved.moves, 1);
    h.advance(230);
    assert.equal(h.saved.moves, 1);
    h.game.destroy();
    assert.equal(h.timers.size, 0);
  }
});

test('completion reward is saved atomically and resume does not pay it twice', () => {
  const h = harness({ seed:50, level:5 });
  const path = h.saved.solution.slice();
  for (const move of path) { h.bottle(move.from); h.bottle(move.to); h.advance(230); }
  assert.equal(h.saved.levelComplete, true);
  assert.equal(h.saved.details.levelsCleared, 1);
  const score = h.saved.score;
  h.game.save(); h.game.destroy();
  const resumed = harness(h.saved);
  resumed.advance(0);
  assert.equal(resumed.saved.level, 6);
  assert.equal(resumed.saved.moves, 0);
  assert.equal(resumed.saved.details.levelsCleared, 1);
  assert.equal(resumed.saved.score, score);
  assert.deepEqual(resumed.saved.tools, { undo:10, hint:5, extra:5 });
  resumed.game.destroy();
});

test('hiding during a pour does not leave tools disabled after resume', () => {
  const h = harness({ seed:5 });
  const move = h.saved.solution[0];
  h.bottle(move.from); h.bottle(move.to);
  h.pause(true); h.env.document.hidden = true; h.env.document.dispatch('visibilitychange');
  h.pause(false);
  assert.equal(h.button('undo').disabled, false);
  h.tool('undo'); assert.equal(h.saved.moves, 0);
  h.game.destroy();
});

test('old half-full progress is retained and inventory migrates exactly once', () => {
  const old = { level:80, bottles:[[0,0], [1,1,1,1], [0,0], []], colorCount:2, baseEmptyCount:1,
    moves:8, tools:{ undo:2, hint:1, extra:0 }, levelStats:{ extra:1 } };
  const h = harness(old);
  assert.deepEqual(h.saved.bottles, old.bottles);
  assert.equal(h.saved.moves, 8);
  assert.deepEqual(h.saved.tools, { undo:7, hint:3, extra:4 });
  h.tool('extra'); assert.equal(h.saved.bottles.length, 4);
  const again = harness(h.saved);
  assert.deepEqual(again.saved.tools, h.saved.tools);
  h.game.destroy(); again.game.destroy();
});

test('21-bottle cap, pause guards and settlement are enforced', () => {
  const h = harness({ seed:4, level:120 });
  assert.equal(h.saved.bottles.length, 20);
  assert.equal(h.saved.levelStats.extra, 0);
  h.pause(true); h.tool('extra'); h.tool('reset');
  assert.equal(h.saved.bottles.length, 20);
  h.pause(false); h.tool('extra'); h.tool('extra');
  assert.equal(h.saved.bottles.length, 21);
  assert.equal(h.button('extra').disabled, true);
  h.tool('finish');
  assert.ok(h.cleared && h.finished);
  assert.equal(h.timers.size, 0);
});

test('18-color palette separates hue and lightness without visible numbering', () => {
  const lab = hex => {
    const rgb = hex.slice(1).match(/../g).map(value => {
      const channel = parseInt(value, 16) / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    const xyz = [(rgb[0] * .4124 + rgb[1] * .3576 + rgb[2] * .1805) / .95047,
      rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722,
      (rgb[0] * .0193 + rgb[1] * .1192 + rgb[2] * .9505) / 1.08883]
      .map(value => value > .008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
    return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
  };
  assert.equal(WATER_COLORS.length, 18);
  const palette = WATER_COLORS.map(lab);
  for (let i = 0; i < palette.length; i++) for (let j = i + 1; j < palette.length; j++) {
    assert.ok(Math.hypot(...palette[i].map((value, axis) => value - palette[j][axis])) > 35);
  }
  const runtime = readFileSync(new URL('../src/games/water-sort.js', import.meta.url), 'utf8');
  assert.doesNotMatch(runtime, /wb-water-number|showColorIds|data-tool="labels"/);
});

test('responsive layout uses up to three balanced rows and always renders 21 bottles as 7 by 3', () => {
  assert.deepEqual(waterSortLayout(10, 280, 360), { columns:4, rows:3, cellWidth:64, rowHeight:106 });
  assert.equal(waterSortLayout(10, 360, 360).columns, 5);
  assert.equal(waterSortLayout(12, 640, 360).columns, 6);
  assert.equal(waterSortLayout(15, 360, 360).columns, 5);
  assert.equal(waterSortLayout(18, 360, 360).columns, 6);
  for (const width of [240, 280, 360, 640]) {
    const layout = waterSortLayout(21, width, 360);
    assert.equal(layout.columns, 7);
    assert.equal(layout.rows, 3);
    assert.ok(layout.cellWidth >= 28);
  }
});

test('unavailable or failed hint search does not consume inventory', async () => {
  const h = harness({ seed:3 });
  const broken = { ...h.saved, solution:[] };
  h.game.destroy();
  const resumed = harness(broken);
  await resumed.tool('hint');
  assert.equal(resumed.saved.tools.hint, 5);
  resumed.game.destroy();
});

test('worker hints validate the entire path and late replies cannot mutate a closed game', async () => {
  const jobs = [];
  class Worker {
    postMessage(data) { jobs.push({ worker:this, data }); }
    terminate() { this.terminated = true; }
  }
  const source = harness({ seed:3 });
  const initial = { ...source.saved, solution:[] }; source.game.destroy();
  const h = harness(initial, Worker);
  const promise = h.tool('hint');
  const job = jobs.find(job => job.data.kind === 'hint');
  const solution = solveWaterSort(job.data.bottles).solution;
  job.worker.onmessage({ data:{ result:solution } });
  await promise;
  assert.equal(h.saved.tools.hint, 4);
  assert.ok(verifyWaterSortSolution(h.saved.bottles, h.saved.solution, h.saved.colorCount));
  h.game.destroy();
  assert.ok(jobs.every(job => job.worker.terminated));
});

test('runtime return and close routes flush controller progress before destroying it', () => {
  const runtime = readFileSync(new URL('../src/runtime/wanban-app.js', import.meta.url), 'utf8');
  const source = runtime.match(/^  function stopGame\(\).*$/m)[0];
  const calls = [];
  const c = vm.createContext({ activeGameController:{ save:() => calls.push('save'), destroy:() => calls.push('destroy') },
    flushAllProgressSaves:() => calls.push('flush'), commitGameActiveDuration() {}, clearGameDurationRewardTimer() {},
    hideGamePauseOverlay() {}, getHostDocument:() => ({}),
    snakeTimer:null,tetrisTimer:null,watermelonTimer:null,jumpTimer:null,screwTimer:null,linkLinkTimer:null,shuerteTimer:null,randomLineTimer:null,singleDialogueTimer:null });
  vm.runInContext(source + '\nstopGame();', c);
  assert.deepEqual(calls.slice(0, 3), ['save','destroy','flush']);
  const closeStart = runtime.indexOf('  function closePopupShell()');
  const close = runtime.slice(closeStart, runtime.indexOf('\n  }', closeStart));
  assert.match(close, /activeGameController\?\.save\?\.\(\)/);
  assert.match(close, /flushAllProgressSaves\(\)/);
});
