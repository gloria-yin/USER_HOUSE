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
  for (const level of [1, 4, 8, 9, 12, 20, 50]) {
    const difficulty = waterSortDifficulty(level);
    for (let seed = 1; seed <= 8; seed++) {
      const generated = createWaterSortLevel(level, seededRandom(level * 10000 + seed));
      assert.equal(isWaterSortSolved(generated.bottles), false, `level ${level}, seed ${seed} starts solved`);
      assert.equal(verifyWaterSortSolution(generated.bottles, generated.solution, generated.colorCount), true, `level ${level}, seed ${seed} has no valid saved solution`);
      assert.equal(generated.colorCount, difficulty.colorCount);
      assert.equal(generated.emptyCount, difficulty.emptyCount);
      assert.equal(generated.bottles.length, difficulty.colorCount + difficulty.emptyCount);
      assert.ok(generated.par >= 2);
      const colors = generated.bottles.flat();
      for (let color = 0; color < generated.colorCount; color++) {
        assert.equal(colors.filter(value => value === color).length, 4, `level ${level}, seed ${seed}, color ${color}`);
      }
    }
  }
});

test('water sort difficulty increases and then caps without capping level numbers', () => {
  assert.deepEqual(waterSortDifficulty(1), { level:1, colorCount:3, emptyCount:2, targetMoves:8, minMixed:2 });
  assert.equal(waterSortDifficulty(9).emptyCount, 1);
  assert.equal(waterSortDifficulty(20).colorCount, 10);
  assert.equal(waterSortDifficulty(20).targetMoves, 42);
  assert.deepEqual(waterSortDifficulty(500), { level:500, colorCount:10, emptyCount:1, targetMoves:42, minMixed:10 });
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
