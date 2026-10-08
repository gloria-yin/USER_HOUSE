import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canSpiderDeal, spiderAutoDealState, spiderDealColumns } from '../src/games/spider-rules.js';

test('spider deals only when stock exists and caps a row at ten cards', () => {
  assert.deepEqual(spiderDealColumns(0), []);
  assert.deepEqual(spiderDealColumns(4), [0, 1, 2, 3]);
  assert.deepEqual(spiderDealColumns(10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(spiderDealColumns(27), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('a partial final deal visits each available column once', () => {
  const columns = spiderDealColumns(7, 10);
  assert.deepEqual(columns, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(new Set(columns).size, 7);
  assert.ok(columns.every(column => column >= 0 && column < 10));
});

test('a partial final row can be dealt even when tableau columns are empty', () => {
  const emptyTableau = Array(10).fill(0);
  for (let stock = 0; stock < 10; stock++) {
    assert.equal(canSpiderDeal(stock, emptyTableau), true);
    assert.deepEqual(spiderDealColumns(stock, 10), Array.from({ length:stock }, (_, index) => index));
  }
});

test('a full row still requires every tableau column to be occupied', () => {
  assert.equal(canSpiderDeal(10, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), true);
  assert.equal(canSpiderDeal(27, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), true);
  assert.equal(canSpiderDeal(10, [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]), false);
  assert.equal(canSpiderDeal(27, [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]), false);
  assert.equal(canSpiderDeal(0, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), true);
});

test('a resumed due game automatically deals stock rows of ten or more when allowed', () => {
  const fullTableau = Array(10).fill(1);
  assert.deepEqual(spiderAutoDealState(10, fullTableau, 0), { due:true, canDeal:true, shouldDeal:true });
  assert.deepEqual(spiderAutoDealState(26, fullTableau, 0), { due:true, canDeal:true, shouldDeal:true });
  assert.equal(spiderAutoDealState(26, fullTableau, 1).shouldDeal, false);
  assert.equal(spiderAutoDealState(10, [...fullTableau.slice(0, 9), 0], 0).shouldDeal, false);
  assert.equal(spiderAutoDealState(9, Array(10).fill(0), 0).shouldDeal, true);
  assert.equal(spiderAutoDealState(0, Array(10).fill(0), 0).shouldDeal, true);
});

test('the spider runtime does not refill stock while dealing', () => {
  const source = readFileSync(new URL('../src/runtime/wanban-app.js', import.meta.url), 'utf8');
  const from = source.indexOf('    async function dealRow(auto){');
  const to = source.indexOf('\n    async function animateDealCard', from);
  const dealRow = source.slice(from, to);
  assert.match(dealRow, /spiderDealColumns\(st\.deck\.length, st\.cols\.length\)/);
  assert.doesNotMatch(dealRow, /ensureDeck\(/);
});

test('the spider runtime uses one deal guard for input, automatic dealing, and controls', () => {
  const source = readFileSync(new URL('../src/runtime/wanban-app.js', import.meta.url), 'utf8');
  const start = source.indexOf('  function startSpider(state) {');
  const end = source.indexOf('\n  function startGame1010', start);
  const runtime = source.slice(start, end);
  assert.match(runtime, /function canDealNow\(\)\{ return canSpiderDeal\(st\.deck\.length, st\.cols\.map\(c=>c\.length\)\); \}/);
  assert.match(runtime, /async function manualDeal\(\).*if\(!canDealNow\(\)\)/s);
  assert.match(runtime, /async function autoDealIfDue\(\).*if\(!auto\.canDeal\)/s);
  assert.match(runtime, /if \(resumed && dealStepsLeft\(\) === 0\) setTimeout\(resumeDueAutoDeal, 80\)/);
  assert.match(runtime, /async function resumeDueAutoDeal\(\).*await autoDealIfDue\(\)/s);
  assert.match(runtime, /if\(!st\.deck\.length\) ensureDeck\(10\)/);
  assert.match(runtime, /if\(replenished\) ensureDeck\(10\)/);
  assert.match(runtime, /deck\.disabled=!canDeal/);
  assert.match(runtime, /st\.dealEmptyLock&&!canDeal&&!col\.length/);
});
