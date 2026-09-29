import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as E from '../src/heart-challenge/engine.js';
import { createRepository } from '../src/heart-challenge/repository.js';
import { installPreparedPreview, installDemoRoom, previewFingerprint } from '../src/heart-challenge/preview.js';
import { fixtureRoom } from './heart-challenge-fixture.mjs';

const raw = await readFile(new URL('../assets/heart-challenge/preview-test.xml', import.meta.url), 'utf8');

test('a fresh phone can install the validated demo once without a bound save or secure-context digest', async () => {
  const memory = new Map();
  const repo = createRepository({ getItem:key => memory.get(key) ?? null, setItem:(key, value) => memory.set(key, value) });
  const fetch = async url => ({ ok:true, text:() => readFile(url, 'utf8') });
  const id = await installDemoRoom(repo, { fetch });
  assert.equal(repo.state.rooms.length, 1);
  const game = repo.state.rooms[0].games[0];
  assert.equal(game.content.cards.length, 5);
  assert.equal(E.currentRun(game).stage, 'open');
  assert.equal(game.snapshot.config.api, '');
  repo.reload();
  const saved = JSON.stringify(repo.state);
  assert.equal(await installDemoRoom(repo, { fetch:() => { throw new Error('must not fetch again'); } }), id);
  assert.equal(JSON.stringify(repo.state), saved);
});

test('demo read or validation failure never writes a partial room', async () => {
  const repo = createRepository({ getItem:() => null, setItem:() => {} });
  await assert.rejects(installDemoRoom(repo, { fetch:async () => ({ ok:false }) }), /读取失败/);
  await assert.rejects(installDemoRoom(repo, { fetch:async () => ({ ok:true, text:async () => '<cards>bad</cards>' }) }));
  assert.equal(repo.state.rooms.length, 0);
});

async function setup() {
  const room = fixtureRoom(1, 3);
  room.title = '测试'; room.world.user.name = '小兰';
  room.players.forEach((player, index) => { player.name = ['鹤丸国永', '三日月宗近', '小狐丸'][index]; });
  room.config.source = 'random';
  const game = E.createGame(room, { order:['P2', 'P3', 'USER', 'P1'], revealed:true }, () => .9);
  game.plans[0].turns.at(-1).cards[0].type = 'D';
  game.error = { task:'game', message:'original failure', raw:'original response' };
  game.request = { id:'failed_request', task:'game', status:'failed' };
  room.games.push(game); room.activeGameId = game.id;
  const memory = new Map([[E.HEART_STORAGE_KEY, JSON.stringify({ version:1, rooms:[room], activeRoomId:room.id })]]);
  const repo = createRepository({ getItem:key => memory.get(key) ?? null, setItem:(key, value) => memory.set(key, value) });
  const manifest = { version:1, id:'preview', gameId:'preview_game', roomId:room.id, sourceGameId:game.id,
    fingerprint:await previewFingerprint(repo.state.rooms[0].games[0]), file:'preview-test.xml' };
  const fetch = async url => url.pathname.endsWith('preview.json')
    ? { ok:true, json:async () => manifest } : { ok:true, text:async () => raw };
  return { repo, manifest, fetch };
}

test('prepared story is added once and preserves the original failure and room settings', async () => {
  const { repo, fetch } = await setup();
  const before = E.clone(repo.state.rooms[0]);
  assert.equal(await installPreparedPreview(repo, { fetch }), true);
  const room = repo.state.rooms[0], game = room.games.at(-1);
  assert.deepEqual(room.games[0], before.games[0]);
  for (const key of ['world', 'players', 'config']) assert.deepEqual(room[key], before[key]);
  assert.equal(game.content.cards.length, 7);
  assert.equal(E.currentRun(game).stage, 'open');
  assert.equal(room.activeGameId, game.id);
  assert.equal(await installPreparedPreview(repo, { fetch }), false);
  repo.update(store => { store.rooms[0].activeGameId = before.games[0].id; });
  assert.equal(await installPreparedPreview(repo, { fetch }), false);
  assert.equal(repo.state.rooms[0].games.length, 2);
});

test('preview refuses unrelated rooms, changed snapshots, pending requests and stale async results', async () => {
  for (const variant of ['room', 'snapshot', 'pending', 'disposed', 'stale']) {
    const { repo, manifest, fetch } = await setup();
    if (variant === 'room') manifest.roomId = 'another-room';
    if (variant === 'snapshot') repo.update(store => { store.rooms[0].games[0].snapshot.config.rounds = 2; });
    if (variant === 'pending') repo.update(store => { store.rooms[0].games[0].request.status = 'pending'; });
    const before = E.clone(repo.state);
    let expected = before;
    const read = async url => {
      const result = await fetch(url);
      if (variant === 'stale' && url.pathname.endsWith('.xml')) {
        repo.update(store => { store.rooms[0].games[0].error.message = 'new request failed'; });
        expected = E.clone(repo.state);
      }
      return result;
    };
    assert.equal(await installPreparedPreview(repo, { fetch:read, isCurrent:() => variant !== 'disposed' }), false, variant);
    assert.deepEqual(repo.state, expected, variant);
  }
});

test('invalid preview output never creates a partial game', async () => {
  const { repo, fetch } = await setup(), before = E.clone(repo.state);
  await assert.rejects(installPreparedPreview(repo, { fetch:async url => url.pathname.endsWith('.xml')
    ? { ok:true, text:async () => raw.replace('</story>', '') } : fetch(url) }), /完整闭合/);
  assert.deepEqual(repo.state, before);
});

test('preview expression upgrade preserves selected progress and only decorates matching lines', async () => {
  const { repo, manifest, fetch } = await setup();
  await installPreparedPreview(repo, { fetch });
  const strip = value => JSON.parse(JSON.stringify(value, (key, child) => ['emoji', 'expressionRevision'].includes(key) ? undefined : child));
  repo.update(store => {
    const game = store.rooms[0].games.at(-1), run = E.currentRun(game);
    for (let i = 0; run.stage !== 'choice' && i < 100; i++) E.advance(game, run, run.stage === 'reveal' ? 'accept' : 'next');
    assert.equal(run.stage, 'choice');
    E.advance(game, run, 'option', run.current.options[0].id);
    store.rooms[0].games[store.rooms[0].games.length - 1] = strip(game);
  });
  manifest.expressionRevision = 1;
  const before = strip(repo.state);
  assert.equal(await installPreparedPreview(repo, { fetch, isCurrent:() => false }), false);
  assert.equal(await installPreparedPreview(repo, { fetch }), 'expressions');
  assert.deepEqual(strip(repo.state), before);
  const game = repo.state.rooms[0].games.at(-1);
  assert.equal(game.expressionRevision, 1);
  assert.ok(JSON.stringify(game.content).includes('emoji'));
  assert.equal(await installPreparedPreview(repo, { fetch }), false);
});

test('every preview branch and all four candidates complete, including one swap and skip', async () => {
  const { repo, fetch } = await setup();
  await installPreparedPreview(repo, { fetch });
  const game = repo.state.rooms[0].games.at(-1);
  const seen = new Set(), cards = new Set();
  let completed = 0;
  function walk(run) {
    for (let steps = 0; steps < 1000; steps++) {
      if (run.stage === 'settlement') {
        assert.equal(run.records.length, 4);
        assert.equal(new Set(run.records.map(record => record.turn)).size, 4);
        assert.equal(run.ending, '');
        assert.ok(!run.used.some(id => run.rejected.includes(id)));
        completed++; return;
      }
      let actions;
      if (run.stage === 'choice') {
        actions = run.current.options.map(option => {
          seen.add(run.current.id + '/' + option.id);
          return ['option', option.id];
        });
      } else if (run.stage === 'pickType') {
        actions = ['T', 'D'].filter(type => E.availableCards(game, run, type).length).map(type => ['type', type]);
      } else if (run.stage === 'pick') actions = run.offered.map(id => ['draw', id]);
      else if (run.stage === 'reveal') {
        cards.add(run.cardId); actions = [['accept']];
        if (E.currentTurn(game, run).actor === 'USER') {
          if (run.swaps === 0) actions.push(['swap']);
          actions.push(['skip']);
        }
      }
      if (actions) {
        for (const [action, payload] of actions) {
          const next = E.clone(run); E.advance(game, next, action, payload, () => .5); walk(next);
        }
        return;
      }
      E.advance(game, run, 'next');
    }
    assert.fail('Preview did not reach settlement');
  }
  walk(E.newRun(game));
  assert.equal(cards.size, 7);
  assert.equal(seen.size, 21);
  assert.equal(completed, 1728);
});
