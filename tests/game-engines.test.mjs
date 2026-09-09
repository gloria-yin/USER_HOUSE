import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canPourWater,
  createWaterSortLevel,
  isWaterSortSolved,
  pourWater,
  verifyWaterSortSolution,
  waterSortDifficulty,
} from '../src/games/water-sort.js';
import {
  FLAPPY_WORLD,
  advanceFlappyState,
  clampFlappyDelta,
  createFlappyBirdGame,
  createFlappyPipe,
  flappyBirdHitsPipe,
  flappyDifficulty,
} from '../src/games/flappy-bird.js';
import {
  createZumaChain,
  createZumaPath,
  zumaColorCountForProgress,
  zumaPointAt,
  zumaSpeedForState,
} from '../src/games/zuma.js';

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

test('water sort pours the complete top run up to bottle capacity', () => {
  const bottles = [[0, 1, 1], [1, 1], []];
  assert.equal(canPourWater(bottles, 0, 1), true);
  assert.deepEqual(pourWater(bottles, 0, 1), {
    bottles:[[0], [1, 1, 1, 1], []],
    moved:2,
    color:1,
  });
  assert.equal(canPourWater(bottles, 0, 2), true);
  assert.equal(canPourWater(bottles, 0, 0), false);
});

test('endless water sort levels preserve colors and include a valid solution', () => {
  for (const level of [1, 10, 41, 91, 120, 121, 151]) {
    const difficulty = waterSortDifficulty(level);
    for (let seed = 1; seed <= (level >= 91 ? 3 : 6); seed++) {
      const generated = createWaterSortLevel(level, seededRandom(level * 10000 + seed));
      assert.equal(isWaterSortSolved(generated.bottles), false, `level ${level}, seed ${seed} starts solved`);
      assert.equal(verifyWaterSortSolution(generated.bottles, generated.solution, generated.colorCount), true, `level ${level}, seed ${seed} has no valid saved solution`);
      assert.equal(generated.colorCount, difficulty.colorCount);
      assert.equal(generated.emptyCount, difficulty.emptyCount);
      assert.equal(generated.bottles.length, difficulty.bottleCount);
      assert.ok(generated.par >= 2);
      assert.ok(generated.complexity >= difficulty.minComplexity, `level ${level}, seed ${seed} misses its structural target`);
      assert.equal(generated.bottles.filter(bottle => !bottle.length).length, 0);
      assert.ok(!generated.bottles.some(bottle => bottle.length === 4 && bottle.every(color => color === bottle[0])));
      assert.ok(generated.mixed >= difficulty.minMixed, `level ${level}, seed ${seed} does not meet its mixing target`);
      const colors = generated.bottles.flat();
      for (let color = 0; color < generated.colorCount; color++) {
        assert.equal(colors.filter(value => value === color).length, 4, `level ${level}, seed ${seed}, color ${color}`);
      }
    }
  }
});

test('water sort difficulty increases and then caps without capping level numbers', () => {
  assert.equal(waterSortDifficulty(1).colorCount, 3);
  assert.equal(waterSortDifficulty(3).bottleCount, 5);
  assert.equal(waterSortDifficulty(4).bottleCount, 6);
  assert.equal(waterSortDifficulty(46).colorCount, 18);
  assert.equal(waterSortDifficulty(120).colorCount, 18);
  assert.equal(waterSortDifficulty(1).minComplexity, waterSortDifficulty(2).minComplexity);
  assert.equal(waterSortDifficulty(1).hardRound, false);
  assert.equal(waterSortDifficulty(2).hardRound, false);
  assert.equal(waterSortDifficulty(3).hardRound, true);
  assert.ok(waterSortDifficulty(3).minComplexity > waterSortDifficulty(2).minComplexity);
  for (let level = 1; level <= 118; level += 3) {
    const config = waterSortDifficulty(level);
    assert.equal(config.emptyCount, 0);
    assert.ok(config.bottleCount <= 20);
    if (level > 1) assert.ok(config.minComplexity > waterSortDifficulty(level - 3).minComplexity);
  }
  assert.equal(waterSortDifficulty(121).endlessCycle, 1);
  assert.equal(waterSortDifficulty(500).level, 500);
  assert.equal(waterSortDifficulty(500).structureTier, 40);
  assert.equal(waterSortDifficulty(500).minComplexity, waterSortDifficulty(196).minComplexity);
});

test('flappy bird difficulty rises smoothly and remains playable when capped', () => {
  const start = flappyDifficulty(0);
  const ten = flappyDifficulty(10);
  const thirty = flappyDifficulty(30);
  const capped = flappyDifficulty(9999);
  assert.deepEqual(start, { speed:112, gap:154, spacing:218, stage:1 });
  assert.ok(ten.speed > flappyDifficulty(9).speed);
  assert.ok(thirty.speed > ten.speed);
  assert.ok(thirty.gap < ten.gap);
  assert.ok(thirty.spacing < ten.spacing);
  assert.deepEqual(capped, { speed:184, gap:112, spacing:174, stage:8 });
});

test('flappy bird pipes stay inside the playable vertical range', () => {
  const random = seededRandom(2309);
  let center;
  for (let score = 0; score <= 100; score += 5) {
    const pipe = createFlappyPipe(420, score, random, center);
    const difficulty = flappyDifficulty(score);
    center = (pipe.gapTop + pipe.gapBottom) / 2;
    assert.ok(pipe.gapTop >= 48);
    assert.ok(pipe.gapBottom <= FLAPPY_WORLD.groundY - 48);
    assert.ok(pipe.gapBottom - pipe.gapTop >= difficulty.gap - 1);
  }
});

test('flappy bird collision recognizes both pipe halves and safe gaps', () => {
  const pipe = { x:80, width:58, gapTop:150, gapBottom:300 };
  assert.equal(flappyBirdHitsPipe({ x:92, y:140 }, pipe), true);
  assert.equal(flappyBirdHitsPipe({ x:92, y:310 }, pipe), true);
  assert.equal(flappyBirdHitsPipe({ x:92, y:220 }, pipe), false);
  assert.equal(flappyBirdHitsPipe({ x:40, y:140 }, pipe), false);
});

test('flappy bird scores each pipe once and checks world bounds', () => {
  const initial = {
    bird:{ x:92, y:220, vy:0, hitX:11, hitY:9 },
    pipes:[{ id:7, x:33, width:58, gapTop:140, gapBottom:300, passed:false }],
    score:0,
    distance:0,
  };
  const scored = advanceFlappyState(initial, 0);
  assert.equal(scored.score, 1);
  assert.deepEqual(scored.scoredPipeIds, [7]);
  assert.equal(scored.alive, true);
  const repeated = advanceFlappyState(scored, 0);
  assert.equal(repeated.score, 1);
  assert.deepEqual(repeated.scoredPipeIds, []);
  const ceiling = advanceFlappyState(Object.assign({}, initial, { bird:{ x:92, y:5, vy:0, hitX:11, hitY:9 } }), 0);
  assert.equal(ceiling.alive, false);
  assert.equal(clampFlappyDelta(2), .05);
  assert.equal(clampFlappyDelta(-1), 0);
});

test('flappy bird module handles input, pause, finish, save restore, and cleanup', () => {
  const canvasListeners = new Map();
  const documentListeners = new Map();
  const fields = new Map([
    ['#wb-flappy-score', { textContent:'' }],
    ['#wb-flappy-passed', { textContent:'' }],
    ['#wb-flappy-pace', { textContent:'' }],
  ]);
  const gradient = { addColorStop() {} };
  const context = new Proxy({ createLinearGradient:() => gradient }, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key === 'string') return () => {};
      return undefined;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  const canvas = {
    getContext:() => context,
    addEventListener:(type, fn) => canvasListeners.set(type, fn),
    removeEventListener:type => canvasListeners.delete(type),
    focus() {},
  };
  const root = {
    innerHTML:'',
    querySelector(selector) {
      return selector === '#wb-flappy-canvas' ? canvas : fields.get(selector) || null;
    },
  };
  let styleElement = null;
  const document = {
    head:{ appendChild:style => { styleElement = style; } },
    getElementById:id => styleElement?.id === id ? styleElement : null,
    createElement:() => ({ id:'', textContent:'' }),
    addEventListener:(type, fn) => documentListeners.set(type, fn),
    removeEventListener:type => documentListeners.delete(type),
  };
  let frameCallback = null;
  let frameId = 0;
  let paused = false;
  const saved = [];
  const spoken = [];
  let clearCalls = 0;
  let finishCalls = 0;
  const window = {
    requestAnimationFrame:callback => { frameCallback = callback; return ++frameId; },
    cancelAnimationFrame:id => { if (id === frameId) frameCallback = null; },
  };
  const environment = {
    root,
    document,
    window,
    save:(state, force) => saved.push({ state, force }),
    clear:() => { clearCalls++; },
    setScore() {},
    finish:() => { finishCalls++; },
    speak:event => spoken.push(event),
    isPaused:() => paused,
    isActive:() => true,
  };
  const controller = createFlappyBirdGame(null, environment);
  assert.equal(controller.getState().started, false);
  assert.ok(controller.getState().pipes.length >= 3);
  assert.equal(spoken[0], 'start');
  canvasListeners.get('pointerdown')({ pointerType:'touch', button:0, preventDefault() {} });
  assert.equal(controller.getState().started, true);
  assert.equal(controller.getState().details.flaps, 1);
  documentListeners.get('keydown')({ code:'Space', key:' ', repeat:false, preventDefault() {} });
  assert.equal(controller.getState().details.flaps, 2);
  documentListeners.get('keydown')({ code:'Space', key:' ', repeat:true, preventDefault() {} });
  assert.equal(controller.getState().details.flaps, 2);
  const runFrame = timestamp => {
    const callback = frameCallback;
    frameCallback = null;
    callback(timestamp);
  };
  runFrame(16);
  runFrame(32);
  const movingY = controller.getState().bird.y;
  paused = true;
  canvasListeners.get('pointerdown')({ pointerType:'touch', button:0, preventDefault() {} });
  runFrame(48);
  assert.equal(controller.getState().bird.y, movingY);
  assert.equal(controller.getState().details.flaps, 2);
  paused = false;
  for (let frame = 1; frame <= 120 && frameCallback; frame++) runFrame(48 + frame * 16);
  assert.equal(finishCalls, 1);
  assert.equal(clearCalls, 1);
  assert.equal(controller.getState().started, false);
  assert.ok(spoken.includes('crash'));
  assert.ok(saved.length >= 1);
  controller.destroy();
  assert.equal(canvasListeners.has('pointerdown'), false);
  assert.equal(documentListeners.has('keydown'), false);
  assert.equal(frameCallback, null);
  const resumeSnapshot = saved.map(item => item.state).reverse().find(item => item.started);
  const resumed = createFlappyBirdGame(resumeSnapshot, environment);
  assert.equal(resumed.getState().started, true);
  assert.equal(spoken.at(-1), 'resume');
  resumed.destroy();
});

test('zuma path lookup and continuous chain generation remain valid', () => {
  const path = createZumaPath();
  assert.ok(path.length > 1000);
  assert.ok(path.points.length > 250);
  assert.deepEqual(zumaPointAt(path, -100), zumaPointAt(path, 0));
  assert.deepEqual(zumaPointAt(path, path.length + 100), zumaPointAt(path, path.length));

  for (const [count, colorCount] of [[1, 4], [24, 4], [50, 6]]) {
    const chain = createZumaChain(count, seededRandom(count + colorCount), colorCount);
    assert.equal(chain.length, count);
    for (let index = 2; index < chain.length; index++) {
      assert.equal(chain[index].color === chain[index - 1].color && chain[index].color === chain[index - 2].color, false, `${count}-ball chain starts with a match`);
    }
    chain.forEach(ball => {
      assert.ok(ball.color >= 0 && ball.color < colorCount);
      const point = zumaPointAt(path, ball.s);
      assert.equal(Number.isFinite(point.x) && Number.isFinite(point.y), true);
    });
  }

  assert.equal(zumaColorCountForProgress(24), 4);
  assert.equal(zumaColorCountForProgress(144), 5);
  assert.equal(zumaColorCountForProgress(264), 6);
  assert.equal(zumaColorCountForProgress(9999), 6);
});

test('zuma speed rises with progress and remains capped', () => {
  const start = zumaSpeedForState(0, 0, 24);
  assert.ok(zumaSpeedForState(0, 0, 12) < start);
  assert.ok(zumaSpeedForState(900, 0, 24) > start);
  assert.ok(zumaSpeedForState(0, 44, 24) > start);
  assert.ok(zumaSpeedForState(0, 0, 40) > start);
  assert.equal(zumaSpeedForState(999999, 999999, 50), 84);
  assert.equal(zumaSpeedForState(999999, 999999, 50, 1), 84 * .38);
});
