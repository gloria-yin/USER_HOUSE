import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spiderDealColumns } from '../src/games/spider-rules.js';

test('spider deals only when stock exists and caps a row at ten cards', () => {
  assert.deepEqual(spiderDealColumns(0), []);
  assert.deepEqual(spiderDealColumns(4), [0, 1, 2, 3]);
  assert.deepEqual(spiderDealColumns(10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(spiderDealColumns(27), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('a partial final deal visits each available column once', () => {
  const columns = spiderDealColumns(7, 10);
  assert.equal(new Set(columns).size, 7);
  assert.ok(columns.every(column => column >= 0 && column < 10));
});

test('the spider runtime does not refill stock while dealing', () => {
  const source = readFileSync(new URL('../src/runtime/wanban-app.js', import.meta.url), 'utf8');
  const from = source.indexOf('    async function dealRow(auto){');
  const to = source.indexOf('\n    async function animateDealCard', from);
  const dealRow = source.slice(from, to);
  assert.match(dealRow, /spiderDealColumns\(st\.deck\.length, st\.cols\.length\)/);
  assert.doesNotMatch(dealRow, /ensureDeck\(/);
});
