import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/heart-challenge/engine.js';
import { fixtureGame, fixtureContent, until } from './heart-challenge-fixture.mjs';
import { gamePrompt, endingPrompt } from './heart-prompt-fixture.mjs';
import { userAvatarChoices } from '../src/heart-challenge/ui.js';

function next(room, rounds) {
  room.config.rounds = rounds;
  const game = E.createGame(room, { order:['P1', 'USER'], revealed:true }, () => .3);
  room.games.push(game); room.activeGameId = game.id;
  return game;
}
function complete(game) {
  game.content = E.validateContent(fixtureContent(game), game);
  const run = E.newRun(game); game.runs.push(run); game.activeRunId = run.id;
  until(game, run, 'settlement');
  return run;
}

test('successive games accumulate rounds while every protocol starts at R1', () => {
  const { room, game, run } = fixtureGame(2);
  assert.equal(game.continuity.completedRounds, 0);
  until(game, run, 'settlement');
  const second = next(room, 4);
  assert.equal(second.continuity.completedRounds, 2);
  assert.equal(second.continuity.completedGames, 1);
  assert.ok(second.continuity.previousClosing);
  assert.equal(second.plans[0].id, 'R1');
  complete(second);
  const third = next(room, 1);
  assert.equal(third.continuity.completedRounds, 6);
  assert.equal(third.continuity.completedGames, 2);
  assert.equal(third.plans[0].id, 'R1');
  const prompt = gamePrompt(third);
  assert.match(prompt, /【当前游戏轮数】：\s*第6把/);
  assert.ok(prompt.includes(second.continuity.previousClosing.split('\n')[0]));
  assert.ok(prompt.includes('游戏继续进行'));
  assert.deepEqual(third.continuity, E.clone(third).continuity, 'retry uses the saved generation context');
});

test('saved endings reset counters and a fresh opening while keeping archive numbers and memories', () => {
  const { room, game, run } = fixtureGame(2);
  until(game, run, 'settlement');
  assert.match(endingPrompt(game), /玩家明确结束本次连续游戏/);
  E.finishGame(game, run, { title:'收牌', text:'他们收起了桌上的卡牌，今晚的游戏到此为止。' });
  const second = next(room, 4);
  assert.equal(second.continuity.completedRounds, 0);
  assert.equal(second.continuity.completedGames, 0);
  assert.equal(second.continuity.resetAfterEnding, true);
  assert.equal(second.continuity.previousClosing, '');
  assert.equal(second.number, 2);
  assert.equal(second.previous[0].ending, run.ending);
  assert.match(gamePrompt(second), /【当前游戏轮数】：\s*第0把/);
  complete(second);
  assert.equal(next(room, 1).continuity.completedRounds, 4);
});

test('failed preparations and replay do not add rounds; saved context survives history cleanup', () => {
  const { room, game, run } = fixtureGame(2);
  until(game, run, 'settlement');
  const failure = next(room, 4); failure.error = { task:'game', message:'network failure' };
  const second = next(room, 1);
  assert.equal(second.continuity.completedRounds, 2);
  const replay = E.newRun(game); game.runs.push(replay); game.activeRunId = replay.id;
  until(game, replay, 'settlement');
  assert.equal(E.nextGameContinuity(room.games).completedRounds, 2);
  room.games = [second];
  complete(second);
  assert.equal(next(room, 1).continuity.completedRounds, 3);
});

test('legacy rooms derive cumulative state from completed games and ending boundaries', () => {
  const { room, game, run } = fixtureGame(2);
  until(game, run, 'settlement');
  const second = next(room, 4); const secondRun = complete(second);
  E.finishGame(second, secondRun, { title:'落幕', text:'这一场游戏正式结束。' });
  const third = next(room, 1);
  for (const entry of room.games) { delete entry.continuity; delete entry.sessionEndedAt; }
  const migrated = E.normalizeStore({ version:1, rooms:[room], activeRoomId:room.id }).rooms[0];
  assert.deepEqual(migrated.games.map(entry => entry.continuity.completedRounds), [0, 2, 0]);
  assert.equal(migrated.games[2].id, third.id);
});

test('persona gallery puts the current avatar first, deduplicates it and keeps safe historical images', () => {
  const current = { name:'Current', avatar:'/User Avatars/current.png' };
  const assets = [{ name:'Older', avatar:'/User Avatars/old.png' }, current,
    { name:'Invalid', avatar:'javascript:alert(1)' }, { name:'Duplicate', avatar:'/User Avatars/old.png' }];
  const before = JSON.stringify(assets);
  const choices = userAvatarChoices(current, assets);
  assert.deepEqual(choices.map(item => item.avatar), [current.avatar, '/User Avatars/old.png']);
  assert.equal(choices[0].current, true);
  assert.equal(choices[1].current, false);
  assert.equal(JSON.stringify(assets), before);
});
