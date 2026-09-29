import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/heart-challenge/engine.js';
import { bankCatalog, createCustomBank, sourceCards } from '../src/heart-challenge/banks.js';
import { roomStories, roomSessions, collectedCards, storySegments, storyChapters } from '../src/heart-challenge/records.js';
import { createRepository } from '../src/heart-challenge/repository.js';
import { fixtureRoom, fixtureGame, until, step } from './heart-challenge-fixture.mjs';

const input = { name:'雨夜问答', truth:'说一个最近开心的瞬间。\n介绍自己的一个小习惯。', dare:'用一句话介绍今晚的心情。\n模仿惊讶时的表情。' };
test('archive groups generation batches until an ending and numbers rounds across batches', () => {
  const first = fixtureGame(2), second = fixtureGame(4), third = fixtureGame(1);
  until(first.game, first.run, 'settlement');
  until(second.game, second.run, 'settlement');
  second.game.sessionEndedAt = Date.now();
  // The persisted boundary still counts when the user replays a finished batch.
  second.run.ending = '';
  const room = first.room; room.games = [first.game, second.game, third.game]; room.activeGameId = third.game.id;
  const before = JSON.stringify(room), sessions = roomSessions(room);
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions.map(session => session.rounds), [6, 1]);
  assert.deepEqual(sessions[0].entries.map(entry => entry.roundOffset), [0, 2]);
  assert.equal(sessions[1].entries[0].roundOffset, 0);
  assert.equal(sessions[0].ended, true);
  assert.equal(sessions[1].current, true);
  assert.equal(JSON.stringify(room), before);
});
test('custom banks persist globally, remain selectable and snapshot into new games', () => {
  const bank = createCustomBank(input, 'custom_test');
  assert.equal(bankCatalog([bank]).length, 3);
  assert.equal(bank.cards.length, 4);
  const first = fixtureRoom(), second = fixtureRoom();
  first.config.bank = second.config.bank = bank.id;
  let raw = JSON.stringify({ version:1, rooms:[first, second], activeRoomId:first.id, banks:[bank] });
  const repo = createRepository({ getItem:() => raw, setItem:(_, value) => { raw = value; } });
  for (const room of repo.state.rooms) {
    assert.equal(room.config.bank, bank.id);
    const game = E.createGame(room, { order:['P1', 'USER'], revealed:true }, () => .5, repo.state.banks);
    assert.deepEqual(game.sourceSnapshot, repo.state.banks[0].cards);
    const original = JSON.stringify(game.sourceSnapshot);
    repo.update(store => { store.banks[0].cards[0].question = '编辑后的题目。'; });
    assert.equal(JSON.stringify(game.sourceSnapshot), original);
  }
  repo.reload(); assert.equal(repo.state.banks[0].cards[0].question, '编辑后的题目。');
});

test('custom bank input gives actionable errors and preserves source filtering', () => {
  for (const [change, error] of [[{ name:'' }, /名称/], [{ truth:'一题' }, /2—200/], [{ dare:'重复\n重复' }, /重复/], [{ truth:'题目|字段\n正常题目' }, /纯文本/]]) {
    assert.throws(() => createCustomBank({ ...input, ...change }, 'custom_test'), error);
  }
  const bank = createCustomBank(input, 'custom_test');
  assert.equal(sourceCards({ bank:bank.id, excludes:'习惯' }, [bank]).length, 3);
  assert.throws(() => sourceCards({ bank:bank.id }, []), /不存在/);
  const adult = createCustomBank({ ...input, adult:true }, 'custom_adult');
  assert.throws(() => sourceCards({ bank:adult.id }, [adult]), /成人内容/);
});

test('room archive includes previous games, old runs and branches without selecting them', () => {
  const { game, run } = fixtureGame(2);
  until(game, run, 'turnEnd'); E.restartTurn(game, run);
  const room = fixtureRoom(); room.games = [game]; room.activeGameId = game.id;
  const next = E.clone(game); next.id = 'next_game'; next.number = 2;
  room.games.push(next); room.activeGameId = next.id;
  const original = JSON.stringify(room), groups = roomStories(room);
  assert.equal(groups.length, 2); assert.equal(groups[0].current, false); assert.equal(groups[1].current, true);
  assert.ok(groups[0].entries.some(entry => entry.branch));
  assert.equal(JSON.stringify(room), original);
  const story = storySegments(groups[0].entries[0]);
  assert.ok(story.segments.every(segment => story.text.slice(segment.start, segment.end)));
});

test('card records distinguish unpicked candidates, swapped draws and actual owners', () => {
  const { game, run } = fixtureGame();
  assert.ok(collectedCards(game).every(entry => !entry.draws.length));
  until(game, run, 'pickType'); E.advance(game, run, 'type', 'T');
  const card = run.offered[0]; E.advance(game, run, 'draw', card); E.advance(game, run, 'swap');
  assert.equal(collectedCards(game).find(entry => entry.card.id === card).draws[0].actor, 'USER');
  while (run.stage !== 'settlement') step(game, run);
  assert.ok(collectedCards(game).find(entry => entry.card.id === card).draws.length);
  assert.ok(collectedCards(game).some(entry => entry.card.actor === 'USER' && !entry.draws.length));
});

test('continuous replay groups every played turn once and retains every line in order', () => {
  const { game, run } = fixtureGame(2, 3);
  until(game, run, 'settlement');
  const entry = { game, run, history:run.history }, before = JSON.stringify(run);
  const chapters = storyChapters(entry), turns = chapters.filter(chapter => chapter.kind === 'turn');
  assert.equal(turns.length, 8);
  assert.deepEqual(turns.map(chapter => chapter.actor), [...game.order, ...game.order]);
  assert.deepEqual(chapters.flatMap(chapter => chapter.lines), storySegments(entry).lines);
  assert.equal(storyChapters(entry, 1).filter(chapter => chapter.kind === 'turn').length, 4);
  assert.ok(storyChapters(entry, 1).every(chapter => chapter.roundIndex === 1));
  assert.equal(JSON.stringify(run), before);
});
