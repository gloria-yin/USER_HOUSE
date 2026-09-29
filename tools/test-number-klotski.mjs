import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NUMBER_KLOTSKI_LEVELS,
  NUMBER_KLOTSKI_BEST_STORAGE_KEY,
  calculateNumberKlotskiScore,
  createNumberKlotskiBoard,
  isNumberKlotskiSolved,
  isSolvableNumberKlotskiBoard,
  isValidNumberKlotskiBoard,
  moveNumberKlotskiTile,
  numberKlotskiAchievements,
  numberKlotskiDistance,
  numberKlotskiMovableIndices,
  numberKlotskiSolvedBoard,
} from '../src/games/number-klotski.js';
import { DEFAULT_LINES } from '../src/runtime/wanban-prompts.js';

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

test('solved boards and legal neighbors are correct for every size', () => {
  for (const size of [4, 5, 6]) {
    const board = numberKlotskiSolvedBoard(size);
    assert.equal(board.length, size * size);
    assert.equal(board.at(-1), 0);
    assert.equal(isNumberKlotskiSolved(board, size), true);
    assert.equal(isSolvableNumberKlotskiBoard(board, size), true);
    assert.deepEqual(numberKlotskiMovableIndices(board, size).sort((a, b) => a - b), [size * size - size - 1, size * size - 2]);
  }
});

test('generated 4x4, 5x5 and 6x6 boards are valid, solvable and meaningfully shuffled', () => {
  for (const size of [4, 5, 6]) {
    for (let seed = 1; seed <= 80; seed++) {
      const board = createNumberKlotskiBoard(size, seededRandom(seed * 97 + size));
      assert.equal(isValidNumberKlotskiBoard(board, size), true, size + 'x' + size + ' seed ' + seed);
      assert.equal(isSolvableNumberKlotskiBoard(board, size), true, size + 'x' + size + ' seed ' + seed);
      assert.equal(isNumberKlotskiSolved(board, size), false, size + 'x' + size + ' seed ' + seed);
      assert.ok(numberKlotskiDistance(board, size) >= size, size + 'x' + size + ' seed ' + seed + ' is too close to solved');
    }
  }
  for (const size of [4, 5, 6]) {
    for (const sample of [0, .5, .999999]) {
      const board = createNumberKlotskiBoard(size, () => sample);
      assert.equal(isSolvableNumberKlotskiBoard(board, size), true);
      assert.ok(numberKlotskiDistance(board, size) >= size);
    }
  }
});

test('only a tile next to the blank can move and the reverse move restores the board', () => {
  const solved = numberKlotskiSolvedBoard(4);
  assert.equal(moveNumberKlotskiTile(solved, 4, 0), null);
  const moved = moveNumberKlotskiTile(solved, 4, 14);
  assert.ok(moved);
  assert.equal(moved[14], 0);
  assert.equal(moved[15], 15);
  assert.deepEqual(moveNumberKlotskiTile(moved, 4, 15), solved);
});

test('inversion parity rejects unsolvable boards for odd and even widths', () => {
  for (const size of [4, 5, 6]) {
    const board = numberKlotskiSolvedBoard(size);
    [board[0], board[1]] = [board[1], board[0]];
    assert.equal(isSolvableNumberKlotskiBoard(board, size), false);
  }
});

test('thousands of rapid legal moves preserve board integrity and solvability', () => {
  const random = seededRandom(410);
  for (const size of [4, 5, 6]) {
    let board = createNumberKlotskiBoard(size, random);
    for (let step = 0; step < 5000; step++) {
      const moves = numberKlotskiMovableIndices(board, size);
      board = moveNumberKlotskiTile(board, size, moves[Math.floor(random() * moves.length)]);
      assert.ok(board);
      assert.equal(isValidNumberKlotskiBoard(board, size), true);
    }
    assert.equal(isSolvableNumberKlotskiBoard(board, size), true);
  }
});

test('score formula applies fixed difficulty, move and time rewards', () => {
  assert.equal(calculateNumberKlotskiScore(4, 120, 300000), NUMBER_KLOTSKI_LEVELS[4].baseScore);
  assert.equal(calculateNumberKlotskiScore(4, 100, 240000), 1840);
  assert.equal(calculateNumberKlotskiScore(5, 999, 9999999), NUMBER_KLOTSKI_LEVELS[5].baseScore);
  assert.ok(calculateNumberKlotskiScore(6, 500, 600000) > calculateNumberKlotskiScore(5, 200, 300000));
});

test('achievements exclude first completion and only use the requested four conditions', () => {
  assert.deepEqual(numberKlotskiAchievements(4, 120, 300000, false), ['低步数完成', '快速完成']);
  assert.deepEqual(numberKlotskiAchievements(6, 900, 1500000, false), ['完成6×6']);
  assert.deepEqual(numberKlotskiAchievements(5, 999, 9999999, true), ['刷新个人纪录']);
  assert.equal(numberKlotskiAchievements(4, 999, 9999999, false).includes('首次通关'), false);
});

test('runtime, styles, icon and all dialogue events are wired', () => {
  const runtime = readFileSync(new URL('../src/runtime/wanban-app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const icon = readFileSync(new URL('../assets/game-icons/number-klotski.png', import.meta.url));
  assert.match(runtime, /numberklotski:\s*\{\s*id:\s*'numberklotski'/);
  assert.match(runtime, /createNumberKlotskiGame\(resumeState/);
  assert.match(runtime, /NUMBER_KLOTSKI_BEST_STORAGE_KEY/);
  assert.match(runtime, /game === 'numberklotski'/);
  assert.match(css, /\.wb-number-klotski-board/);
  assert.ok(icon.length > 100);
  assert.equal(NUMBER_KLOTSKI_BEST_STORAGE_KEY, 'wanbanXiaowu_numberKlotskiBest_v1');
  const expected = ['start','resume','move','good_start','progress_25','progress_50','progress_75','near_finish','wrong','stuck','undo','record','gameover','random'];
  assert.deepEqual(Object.keys(DEFAULT_LINES.numberklotski).sort(), expected.sort());
});
