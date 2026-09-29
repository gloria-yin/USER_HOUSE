import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/heart-challenge/engine.js';
import { HEART_BANKS, sourceCards } from '../src/heart-challenge/banks.js';
import { createRepository } from '../src/heart-challenge/repository.js';
import { gamePrompt, replyPrompt, endingPrompt } from './heart-prompt-fixture.mjs';
import { parseReplyFormat } from '../src/heart-challenge/format.js';
import { safeImage, avatarHTML, cardAvatarChoices } from '../src/heart-challenge/ui.js';
import { fixtureGame, fixtureRoom, fixtureContent, fixtureProtocol, until, step } from './heart-challenge-fixture.mjs';

const storage = () => { const map = new Map(); return { getItem:key => map.get(key) ?? null, setItem:(key, value) => map.set(key, value) }; };
const reply = (run, state = 'resume', conflict = false) => ({ task:'reply', state, conflict, resume:run.stage === 'choice' ? run.current.id : 'TURN_END', facts:['实际自由互动'], lines:[{ speaker:'P1', text:'我听到了，你可以慢慢说。' }, { speaker:'N', text:'炉火照着桌面。' }, { speaker:'P1', text:'这个细节，我刚才确实忽略了。' }, { speaker:'P1', text:'我会记得，不急着替它下结论。' }] });

test('two source banks contain exactly 50 unique truths and 50 unique dares', () => {
  for (const bank of Object.values(HEART_BANKS)) { assert.equal(new Set(bank.cards.map(c => c.id)).size, 100); assert.equal(new Set(bank.cards.map(c => c.question)).size, 100); for (const type of ['T','D']) assert.equal(bank.cards.filter(c => c.type === type).length, 50); }
  assert.throws(() => sourceCards({ bank:'intimate', nsfw:false }));
  assert.ok(sourceCards({ source:'builtin', bank:'regular', excludes:'秘密' }).every(c => !c.question.includes('秘密')));
});

test('legacy room settings migrate before opening the next game', () => {
  const room = fixtureRoom();
  room.config.source = 'random';
  room.config.styles = ['日常破冰', '心跳暧昧'];
  room.config.randomStyles = ['日常闲聊'];
  delete room.config.bankThemes;
  delete room.config.bankKeywords;
  room.games.push({ id:'old_game', snapshot:{ config:E.clone(room.config) } });
  const memory = storage();
  memory.setItem(E.HEART_STORAGE_KEY, JSON.stringify({ version:1, rooms:[room], activeRoomId:room.id }));
  const migrated = createRepository(memory).state.rooms[0];
  assert.deepEqual(migrated.config.styles, ['轻松', '暧昧']);
  assert.deepEqual(migrated.config.bankThemes, ['社交']);
  assert.deepEqual(migrated.config.bankKeywords, []);
  assert.deepEqual(migrated.games[0].snapshot.config.bankThemes, ['社交']);
  assert.deepEqual(migrated.games[0].snapshot.config.bankKeywords, []);
});

test('document cards/story protocol parses into a complete validated game', () => {
  const room = fixtureRoom(2, 2), order = ['P1', 'USER', 'P2'];
  const game = E.createGame(room, { order, revealed:true }, () => .3);
  const protocol = fixtureProtocol(game), parsed = E.validateContent(protocol, game);
  assert.equal(parsed.cards.length, game.plans.flatMap(round => round.turns.flatMap(turn => turn.cards)).length);
  assert.deepEqual(parsed.rounds.flatMap(round => round.turns.map(turn => turn.actor)), [...order, ...order]);
  assert.ok(parsed.cards.every(card => card.beats.at(-1).kind === 'done'));
  assert.equal(E.validateContent('```text\n' + fixtureProtocol(game) + '\n```', game).cards.length, parsed.cards.length);
  assert.deepEqual(E.validateContent('以下是结果：\n' + fixtureProtocol(game), game), parsed);
  assert.deepEqual(parseReplyFormat('<reply state="resume" resume="K1">\n[P1]我听到了。\n</reply>').state, 'resume');
  assert.throws(() => parseReplyFormat('<reply state="end" resume="K1">\n[P1]结束。\n</reply>'), /resume或wait/);
  assert.throws(() => E.validateContent(protocol.replace('[P1;😳]', '[P1;]'), game), /空emoji标签/);
  assert.throws(() => E.validateContent(protocol.replace(/\[P1;😳\][^\n]+/, '[P1]\n正文被错误地放到了下一行。'), game), /标签与正文在同一行/);
  assert.throws(() => E.validateContent(protocol.replace(/\[N\]雨声[^\n]*/, '$&[USER:auto]继续。'), game), /嵌套了第二个角色标签/);
  assert.throws(() => E.validateContent(protocol.replace(/\[N\]雨声[^\n]*/, '[USER:auto]她不想承认心里的动摇。'), game), /USER:auto.*固定过渡/);
  const combined = protocol.replace('[P1;😳]', '[P1;]').replace(/\[N\]雨声[^\n]*/, '[USER:auto]她不想承认心里的动摇。[P1]继续。');
  assert.throws(() => E.validateContent(combined, game), error => ['空emoji', '嵌套', 'USER:auto'].every(word => error.message.includes(word)));
});

test('game parsing ignores surrounding input echoes but keeps all internal validation', () => {
  const { game } = fixtureGame(), protocol = fixtureProtocol(game), expected = E.validateContent(protocol, game);
  const echo = '\n【世界观设定】：\n这段不得进入故事。\n[P1;]\n[N]\n{{游戏核心参数}}';
  for (const output of [protocol + echo, '说明文字\n```xml\n' + protocol + '\n```' + echo,
    protocol.replace('</cards>', '</cards>\n中间的说明也不属于数据。\n[P1;]'),
    '<!-- <cards>虚构注释</cards><story>忽略</story> -->\n' + protocol + echo]) {
    assert.deepEqual(E.validateContent(output, game), expected);
  }
  assert.throws(() => E.validateContent(protocol.replace('</story>', '') + echo, game), /完整闭合/);
  assert.throws(() => E.validateContent(protocol.replace('</cards>', '') + echo, game), /完整闭合/);
  assert.throws(() => E.validateContent(protocol.replace('<story>', '<story><story>') + echo, game), /重复|嵌套/);
  assert.throws(() => E.validateContent(protocol.replace('<story>', '<cards></cards><story>'), game), /重复|顺序/);
  assert.throws(() => E.validateContent(protocol.replace('[P1;😳]', '[P1;]') + echo, game), /空emoji标签/);
  assert.throws(() => E.validateContent(protocol.replace(/<case card="R1A2C4">[\s\S]*?<\/case>/, '') + echo, game), /每张USER候选/);
});

test('common continue cannot override a reserved or refused USER branch', () => {
  const { game } = fixtureGame(), contact = E.clone(game.content);
  const choice = contact.cards[0].beats.find(beat => beat.kind === 'choice');
  choice.resume = [{ speaker:'N', text:'十秒到了，他终于松开了握住的手。' }];
  assert.throws(() => E.validateContent(contact, game), /存在拒绝选项.*任务已经执行/);
  const followup = E.clone(game.content), followupChoice = followup.cards[0].beats.find(beat => beat.kind === 'choice');
  followupChoice.resume = [{ speaker:'P1', text:'你刚才为什么不肯回答？' }];
  assert.throws(() => E.validateContent(followup, game), /不能继续追问/);
  const spoken = E.clone(game.content), spokenChoice = spoken.cards[0].beats.find(beat => beat.kind === 'choice');
  spokenChoice.resume = [{ speaker:'USER', text:'继续吧。', auto:true }, { speaker:'N', text:'火光轻轻晃动。' }];
  assert.throws(() => E.validateContent(spoken, game), /公共continue不能包含USER/);
});

test('content audit reports every short card in one repair message', () => {
  const { game } = fixtureGame(), data = E.clone(game.content);
  for (const card of data.cards) {
    const choice = card.beats.find(beat => beat.kind === 'choice');
    card.beats = [card.beats.find(beat => beat.kind === 'line'), choice, { kind:'done', card:card.id }];
  }
  assert.throws(() => E.validateContent(data, game), error => data.cards.every(card => error.message.includes(card.id)));
});

test('normal turn transitions survive boundary checks while new questions still require an interaction', () => {
  const { game } = fixtureGame();
  for (const line of ['好了，老爷爷这一张到这里。接下来，该轮到林舟了吧？', '下一位是旅人吗？']) {
    const data = E.clone(game.content);
    data.cards[0].beats.find(beat => beat.kind === 'choice').resume = [{ speaker:'P1', text:line }];
    assert.doesNotThrow(() => E.validateContent(data, game));
  }
  const data = E.clone(game.content);
  data.cards[0].beats.find(beat => beat.kind === 'choice').resume = [{ speaker:'P1', text:'接下来该轮到你告诉我秘密了吧？' }];
  assert.throws(() => E.validateContent(data, game), /不能继续追问/);
});

test('option attitude uses explicit metadata or player intent rather than NPC wording and last position', () => {
  const { game } = fixtureGame();
  const raw = fixtureProtocol(game).replace('[USER]那你还记得什么？', '[USER]那你还记得什么？请不要把话说得太含糊。');
  const parsed = E.validateContent(raw, game);
  assert.equal(parsed.cards[0].beats.find(beat => beat.kind === 'choice').options[0].attitude, 'curious');
  const noBoundary = raw.replaceAll('先把这个答案留在这里', '请继续讲下一段').replaceAll('id="reserved"', 'id="continue"');
  assert.throws(() => E.validateContent(noBoundary, game), /实际的保留或拒绝/);
  const explicit = raw.replaceAll('id="warm" text=', 'id="warm" attitude="playful" text=');
  assert.equal(E.validateContent(explicit, game).cards[0].beats.find(beat => beat.kind === 'choice').options[0].attitude, 'playful');
  assert.throws(() => E.validateContent(explicit.replaceAll('attitude="playful"', 'attitude="missing"'), game), /attitude/);
});

test('turn transitions treat punctuation in actor names literally', () => {
  const { game } = fixtureGame();
  game.snapshot.players[0].name = '林舟(旅伴)+';
  game.snapshot.world.user.name = '[旅人]';
  const data = E.clone(game.content);
  data.cards[0].beats.find(beat => beat.kind === 'choice').resume = [{ speaker:'P1', text:'接下来，轮到林舟(旅伴)+了吧？' }];
  assert.doesNotThrow(() => E.validateContent(data, game));
});

test('one repair report includes short paths, public USER speech and oversized choices together', () => {
  const { game } = fixtureGame(), data = E.clone(game.content);
  data.cards[0].beats[0] = { kind:'line', speaker:'USER', text:'我决定执行任务。' };
  const option = data.cards[1].beats.find(beat => beat.kind === 'choice').options[0];
  while (option.lines.length < 5) option.lines.push({ speaker:'P1', text:'多出来的角色回应。' });
  data.cards[2].beats.filter(beat => beat.kind === 'line').forEach(beat => { beat.text = '短句。'; });
  assert.throws(() => E.validateContent(data, game), error => ['公共剧情', 'USER', '1—4', '最短路径'].every(text => error.message.includes(text)));
});

test('seven-column protocol supports XML comments and four-line choices', () => {
  const { game } = fixtureGame();
  const output = fixtureProtocol(game).replace('<cards>', '<cards>\n<!-- author format -->');
  const parsed = E.validateContent('```xml\n' + output + '\n```', game);
  assert.ok(parsed.cards.every(card => !('prop' in card)));
  const legacy = output.replace(/^(R[^\n]+)\|([^|\n]+)$/gm, '$1|旧字段|$2');
  assert.deepEqual(E.validateContent(legacy, game), parsed, 'old eight-column output remains readable without the removed field');
  assert.ok(parsed.cards.every(card => game.sourceSnapshot.some(source => source.id === card.sourceId && source.question === card.question)));
  const option = parsed.cards[0].beats.find(beat => beat.kind === 'choice').options[0];
  while (option.lines.length < 4) option.lines.push({ speaker:'P1', text:'他看了看杯沿，又补充了当时记得的一个细节。' });
  assert.doesNotThrow(() => E.validateContent(parsed, game));
  option.lines.push({ speaker:'N', text:'炉火映着桌沿。' });
  assert.throws(() => E.validateContent(parsed, game), /1—4/);
});

test('malformed branches and return nodes are rejected instead of silently dropping content', () => {
  const { game, run } = fixtureGame(), output = fixtureProtocol(game);
  const continuation = output.match(/<continue\b[^>]*>[\s\S]*?<\/continue>/)[0];
  assert.throws(() => E.validateContent(output.replace(continuation, continuation + '\n' + continuation), game), /仅出现一次/);
  assert.throws(() => E.validateContent(output.replace(/<pick T="([^"]+)" D="([^"]+)"\/>/, '<pick T="$1,$2" D=""/>'), game), /2张T与2张D/);
  assert.throws(() => E.validateContent(output.replace('<case card="R1A2C2">', '<case card="R1A2C1">'), game), /一一对应/);
  assert.throws(() => E.validateContent(output.replaceAll('R1A2C1_Q1_K', 'R1A1C1_Q1_K'), game), /返回节点 ID 重复/);
  until(game, run, 'choice');
  const resume = run.current.resumeId || run.current.id;
  const replyWithUser = `<reply state="resume" resume="${resume}">\n[P1]具体回应。\n[N]环境细节。\n[USER]被代写的决定。\n[P1]再次回应。\n[P1]交还剧情。\n</reply>`;
  assert.throws(() => E.validateReply(replyWithUser, game, run), /USER/);
});

test('the 250-character minimum measures the shortest path instead of summing alternatives', () => {
  const { game } = fixtureGame(), data = E.clone(game.content), card = data.cards[0];
  const choice = card.beats.find(beat => beat.kind === 'choice');
  card.beats.filter(beat => beat.kind === 'line').forEach(beat => { beat.text = '短句。'; });
  choice.resume.forEach(line => { line.text = '雨声。'; });
  choice.options[0].lines[1].text = '具体回答'.repeat(100);
  assert.throws(() => E.validateContent(data, game), /最短路径.*至少250字/);
  card.beats[0].text = '具体的场景细节'.repeat(40);
  assert.doesNotThrow(() => E.validateContent(data, game));
});

test('opening rejects an invented USER inner decision', () => {
  const { game } = fixtureGame(), data = E.clone(game.content);
  data.open = '夜雨把所有人留在旅店，炉火映着桌上的旧卡牌。'.repeat(5) + `${game.snapshot.world.user.name}心里其实并不排斥这场游戏。`;
  assert.throws(() => E.validateContent(data, game), /内心态度/);
  data.open = `${game.snapshot.world.user.name}本欲拒绝这个提议，最后终究还是在牌桌旁坐下参与游戏。`.repeat(6);
  assert.throws(() => E.validateContent(data, game), /决定是否参加游戏/);
});
test('all modes and round counts complete without extra USER turns, using either type', () => {
  for (const count of [1, 2, 5]) for (const rounds of [1, 2, 4]) for (const type of ['T','D']) {
    const { game, run } = fixtureGame(rounds, count, type === 'D');
    let steps = 0;
    while (run.stage !== 'settlement' && steps++ < 3000) step(game, run, 'reserved', type);
    assert.equal(run.stage, 'settlement'); assert.equal(run.records.length, rounds * (count + 1));
    assert.equal(run.records.filter(r => r.actor === 'USER').length, rounds);
    assert.ok(run.records.filter(r => r.actor === 'USER').every(r => r.type === type && !r.resolution.includes('角色分享')));
    E.finishGame(game, run, E.validateEnding({ task:'ending', title:'灯还亮着', text:'炉火渐渐落下，大家把今晚的话收在心里，彼此道过晚安。'.repeat(5) }));
    assert.equal(run.stage, 'ending'); assert.ok(E.effectiveMemory(game).ending);
  }
});
test('opening and subsequent rounds enter the first actor without a round-intro stop', () => {
  const { game, run } = fixtureGame(2, 2);
  E.advance(game, run, 'next');
  assert.equal(run.stage, 'turnIntro');
  assert.equal(run.turnIndex, 0);
  assert.equal(run.history.filter(line => line.kind === 'opening').length, 1);
  until(game, run, 'roundEnd');
  E.advance(game, run, 'next');
  assert.equal(run.stage, 'turnIntro');
  assert.equal(run.roundIndex, 1);
  assert.equal(run.turnIndex, 0);
  assert.deepEqual(run.history.filter(line => line.kind === 'round').map(line => line.roundIndex), [0, 1]);
  until(game, run, 'settlement');
  assert.equal(run.records.length, 6);
});
test('legacy saves at the removed round-intro screen resume at the first actor only once', () => {
  const { room, game, run } = fixtureGame(2, 1);
  run.stage = 'roundIntro';
  const first = E.normalizeStore({ version:1, rooms:[room], activeRoomId:room.id });
  const active = E.currentRun(first.rooms[0].games[0]);
  assert.equal(active.stage, 'turnIntro');
  assert.equal(active.history.filter(line => line.kind === 'round').length, 1);
  const again = E.normalizeStore(first);
  assert.deepEqual(again, first);
  assert.equal(run.stage, 'roundIntro', 'normalization does not mutate its input');
  E.advance(game, run, 'next');
  assert.equal(run.stage, 'turnIntro', 'old in-memory states also retain a valid transition');
});
test('reject missing cases, incorrect actor/source/order, premature DONE and coerced public USER speech', () => {
  const { game } = fixtureGame();
  const corruptions = [d => d.cards.pop(), d => d.cards[0].actor = 'stranger', d => d.cards[0].sourceId = 'fake', d => d.rounds[0].turns.reverse(), d => d.cards[0].beats.unshift({kind:'done',card:d.cards[0].id}), d => d.cards[0].beats[0].speaker = 'USER'];
  for (const corrupt of corruptions) { const content = E.clone(game.content); corrupt(content); assert.throws(() => E.validateContent(content, game)); }
});
test('coverage must occur on every selectable path and each USER candidate must be distinct', () => {
  const { game } = fixtureGame();
  let data = E.clone(game.content); data.cards.forEach(c => c.special = 'none'); data.cards[1].special = 'echo'; assert.throws(() => E.validateContent(data, game), /回声/);
  data = E.clone(game.content); const user = data.cards.filter(c => c.actor === 'USER'); user[1].question = user[0].question; user[1].sourceId = user[0].sourceId; assert.throws(() => E.validateContent(data, game), /重复/);
  data = E.clone(game.content); data.cards[0].beats.filter(b => b.kind === 'line').forEach(b => { b.text = '短句。'; }); assert.throws(() => E.validateContent(data, game), /过短/);
});
test('choice stops playback; only selected branch plays; next actor requires explicit action', () => {
  const { game, run } = fixtureGame(); until(game, run, 'choice'); assert.throws(() => E.advance(game, run, 'next'));
  E.advance(game, run, 'option', 'reserved'); assert.throws(() => E.advance(game, run, 'option', 'warm'));
  until(game, run, 'turnEnd'); assert.equal(run.turnIndex, 0); assert.ok(!E.historyText(game, run.history).includes('记得有人一边'));
  assert.equal(run.relations.P1.boundaries, 1); assert.equal(run.records.length, 1);
});
test('USER swaps exclude the rejected card and do not regenerate; candidate count is honest', () => {
  const { game, run } = fixtureGame(1, 1, true); until(game, run, 'pickType'); E.advance(game, run, 'type', 'T', () => .3);
  assert.equal(run.offered.length, 2); const chosen = run.offered[0]; E.advance(game, run, 'draw', chosen); E.advance(game, run, 'swap');
  E.advance(game, run, 'type', 'T'); assert.equal(run.offered.length, 1); assert.ok(!run.offered.includes(chosen));
  E.advance(game, run, 'draw', run.offered[0]); assert.throws(() => E.advance(game, run, 'swap'));
});
test('fate locks values and resolves equal distances by seat order', () => {
  const values = [.5,.49,.51]; const result = E.fateOrder([{id:'USER'},{id:'P1'},{id:'P2'}],49,()=>values.shift());
  assert.deepEqual(result.order,['USER','P1','P2']); assert.equal(result.target,50); assert.throws(()=>E.fateOrder([],100)); assert.throws(()=>E.fateOrder([],NaN));
});
test('free reply wait, resume and conflict routes preserve decision boundaries', () => {
  for (const state of ['wait','resume','end']) {
    const { game, run } = fixtureGame(); until(game,run,'choice');
    const id = run.current.id, turn = run.turnIndex, data = reply(run,state,state === 'end');
    E.applyReply(game,run,'我想先听你说。',data);
    assert.equal(run.stage,'story'); assert.equal(run.records.length,0);
    until(game,run,state === 'wait' ? 'choice' : 'turnEnd'); assert.equal(run.turnIndex,turn);
    if (state === 'wait') { assert.equal(run.current.id,id); assert.equal(run.choices.length,0); }
    if (state === 'end') assert.equal(run.records[0].status,'interrupted');
  }
});
test('free interaction at turn end does not advance or settle twice', () => {
  const { game, run } = fixtureGame(); until(game,run,'turnEnd'); E.applyReply(game,run,'还有一句想问。',reply(run)); until(game,run,'turnEnd');
  assert.equal(run.records.length,1); assert.equal(run.turnIndex,0); assert.equal(run.freeReplies,1);
});
test('restart restores effects, memory and cards while retaining read-only history branch', () => {
  const { game, run } = fixtureGame(); until(game,run,'turnEnd'); const id=run.cardId;
  E.restartTurn(game,run); assert.equal(run.cardId,id); assert.deepEqual(run.relations,{}); assert.equal(run.records.length,0); assert.equal(run.facts.length,0); assert.equal(run.branches.length,1);
  assert.ok(!JSON.stringify(E.effectiveMemory(game)).includes('接受了这个边界'));
  E.advance(game,run,'accept'); until(game,run,'turnEnd'); assert.equal(run.records.length,1); assert.equal(run.relations.P1.boundaries,1);
});
test('replay run and next game use only current effective records', () => {
  const { room, game, run } = fixtureGame(); until(game,run,'settlement'); const previous=E.clone(run.history);
  const next=E.newRun(game); game.runs.push(next); game.activeRunId=next.id;
  assert.deepEqual(game.runs[0].history,previous); assert.equal(E.effectiveMemory(game).records.length,0);
  const nextGame=E.createGame(room,{order:game.order}); assert.equal(nextGame.previous.length,0);
});
test('save/load restores the current node and rejects storage failures and stale writers', () => {
  const store=storage(), repo=createRepository(store), second=createRepository(store), {room,game,run}=fixtureGame(); until(game,run,'choice');
  repo.update(s=>{s.rooms=[room];s.activeRoomId=room.id;}); const resumed=createRepository(store); assert.equal(E.currentRun(resumed.state.rooms[0].games[0]).stage,'choice');
  assert.throws(()=>second.update(s=>s.rooms=[]),/另一个/);
  const previous=E.clone(repo.state); store.setItem=()=>{throw new Error('QuotaExceededError');};
  assert.throws(()=>repo.update(s=>s.rooms=[]),/Quota/); assert.deepEqual(repo.state,previous);
});
test('world and player snapshots are isolated, secrets are excluded, tasks remain distinct', () => {
  const room=fixtureRoom(); room.config.apiKey='DO_NOT_COPY'; const game=E.createGame(room,{order:['P1','USER']}); room.world.background='另一世界'; room.players[0].description='另一角色';
  assert.ok(!JSON.stringify(game).includes('DO_NOT_COPY')); assert.ok(!JSON.stringify(game.snapshot).includes('另一世界')); assert.ok(!JSON.stringify(game.snapshot).includes('另一角色'));
  const {game:g,run}=fixtureGame(); until(g,run,'choice'); const generated=gamePrompt(g); assert.match(generated,/"task":"game"/); assert.match(generated,/从 <cards> 开始，再输出 <story>；写完 <\/story> 立即结束回答/); assert.doesNotMatch(generated,/task=game JSON结构/); assert.match(replyPrompt(g,run,'你好'),/"task":"reply"/); assert.match(endingPrompt(g),/"task":"ending"/);
});
test('unmet dependencies skip contradictory NPC stories and reject future or USER dependencies', () => {
  const {game,run}=fixtureGame(2); const first=game.content.cards[0], later=game.content.cards.find(c=>c.actor==='P1' && c.round==='R2'); later.requires=[first.id];
  E.validateContent(game.content,game); until(game,run,'choice'); E.applyReply(game,run,'先停在这里。',reply(run,'end',true)); until(game,run,'settlement');
  assert.equal(run.records.find(r=>r.cardId===later.id).status,'interrupted');
  const data=E.clone(game.content); data.cards[0].requires=[later.id]; assert.throws(()=>E.validateContent(data,game),/依赖/);
});
test('avatar rendering escapes hostile text and forbids active URLs', () => {
  assert.equal(safeImage('javascript:alert(1)'), ''); assert.equal(safeImage('data:image/svg+xml,<svg>'),'');
  assert.ok(!avatarHTML({name:'<script>',avatar:'x" onerror="alert(1)'}).includes('<script>'));
});

test('world character portrait leads the card gallery without duplicates or changing other cards', () => {
  const cards = [{ id:'other', name:'Other', avatar:'/other.png' }, { id:'world', name:'World', avatar:'/live.png' }, { id:'empty', avatar:'' }];
  const world = E.worldSnapshot({ character:{ cardId:'world', name:'Imported', avatar:'/snapshot.png' } });
  const before = E.clone(cards);
  const assets = cardAvatarChoices(world, cards);
  assert.deepEqual(assets.map(card => card.id), ['world', 'other']);
  assert.equal(assets[0].avatar, '/snapshot.png');
  assert.equal(assets[0].name, 'Imported');
  assert.deepEqual(cards, before);
  assert.equal(E.worldSnapshot(world).character.avatar, '/snapshot.png');
  assert.ok(!JSON.stringify(gamePrompt({ ...fixtureGame().game, snapshot:{ ...fixtureGame().game.snapshot, world } })).includes('/snapshot.png'));
});

test('imported portrait remains selectable when absent from the live tavern list', () => {
  const world = E.worldSnapshot({ character:{ cardId:'deleted-card', name:'Imported', avatar:'/snapshot.png' } });
  const assets = cardAvatarChoices(world, [{ id:'other', avatar:'/other.png' }]);
  assert.equal(assets[0].id, 'deleted-card');
  assert.equal(assets[0].avatar, '/snapshot.png');
  assert.equal(assets.length, 2);
});

test('legacy world cards are prioritized; no imported portrait leaves the order unchanged', () => {
  const cards = [{ id:'other', avatar:'/other.png' }, { id:'world', avatar:'/world.png' }];
  assert.deepEqual(cardAvatarChoices({ character:{ cardId:'world' } }, cards).map(card => card.id), ['world', 'other']);
  assert.equal(cardAvatarChoices({ sourceKind:'current-card', sourceId:'current-card:world' }, cards)[0].id, 'world');
  assert.equal(cardAvatarChoices({}, cards, [{ origin:'world', cardId:'old', cardAvatar:'/old.png' }])[0].avatar, '/old.png');
  assert.deepEqual(cardAvatarChoices({ character:{ cardId:'missing' } }, cards), cards);
  assert.deepEqual(cardAvatarChoices({}, cards), cards);
});

test('adult-content mode starts without obsolete per-character confirmation flags', () => {
  const room = fixtureRoom(1, 2);
  room.config.nsfw = true;
  room.players[0].adult = false;
  delete room.players[1].adult;
  const game = E.createGame(room, { order:['USER', 'P1', 'P2'] });
  assert.equal(game.snapshot.config.nsfw, true);
  assert.ok(game.snapshot.players.every(player => !Object.hasOwn(player, 'adult')));
  assert.match(gamePrompt(game), /【NSFW阀值】：\nNSFW（NSFW情况下可使用相应扩展内容）/);
});

test('free-design bank accepts empty optional requirements and validates generated content', () => {
  for (const nsfw of [false, true]) {
    const room = fixtureRoom();
    room.config = E.normalizeConfig({ source:'random', nsfw });
    const game = E.createGame(room, { order:['P1', 'USER'] });
    assert.deepEqual(game.sourceSnapshot, []);
    assert.deepEqual(game.snapshot.config.bankThemes, []);
    assert.deepEqual(game.snapshot.config.bankKeywords, []);
    assert.equal(game.snapshot.config.customTheme, '');
    assert.equal(game.snapshot.config.keywords, '');
    assert.ok(gamePrompt(game).includes('【卡牌风格（无卡牌库）】：\n无要求'));
    const content = E.validateContent(fixtureProtocol(game), game);
    assert.ok(content.cards.every(card => card.sourceId === '-'));
  }
});

test('optional free-design requirements and exclusions are retained when supplied', () => {
  const room = fixtureRoom();
  room.config = E.normalizeConfig({ source:'random', bankThemes:['默契合作'], bankKeywords:['信任'],
    customTheme:'旅途小事', keywords:'相识', excludes:'饮酒' });
  const game = E.createGame(room, { order:['P1', 'USER'] });
  for (const value of ['默契', '信任', '旅途小事', '相识', '饮酒']) assert.ok(gamePrompt(game).includes(value));
});
