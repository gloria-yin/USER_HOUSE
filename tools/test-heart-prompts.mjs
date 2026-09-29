import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { loadHeartPromptTemplates, gamePrompt, replyPrompt, endingPrompt, buildHeartRequest } from '../src/heart-challenge/prompts.js';
import { readPromptAsset, templates } from './heart-prompt-fixture.mjs';
import * as E from '../src/heart-challenge/engine.js';
import { parseGameFormat } from '../src/heart-challenge/format.js';
import { fixtureGame, fixtureRoom, until } from './heart-challenge-fixture.mjs';

const filename = url => new URL(url).pathname.split('/').at(-1);
const response = text => ({ ok:true, text:async () => text });

test('only the three complete task TXT documents are installed', async () => {
  const files = await readdir(new URL('../assets/heart-challenge/text/', import.meta.url));
  assert.deepEqual(files.filter(file => file.endsWith('.txt')).sort(), ['ending.txt', 'game.txt', 'reply.txt']);
});

test('regeneration count migrates old saves and limits additional attempts', () => {
  assert.equal(E.defaultConfig().regenerations, 1);
  for (const value of [0, 1, 2]) {
    const migrated = E.normalizeConfig({ repairs:value });
    assert.equal(migrated.regenerations, value);
    assert.ok(!Object.hasOwn(migrated, 'repairs'));
  }
  assert.equal(E.normalizeConfig({ repairs:2, regenerations:0 }).regenerations, 0);
  assert.equal(E.normalizeConfig({ regenerations:99 }).regenerations, 2);
  assert.equal(E.normalizeConfig({ regenerations:-1 }).regenerations, 0);
});

test('generation inputs omit removed card fields even for older saved cards', () => {
  const { game, run } = fixtureGame();
  until(game, run, 'choice');
  E.currentCard(game, run).prop = 'LEGACY_UNUSED_FIELD';
  const prompt = replyPrompt(game, run, '继续', templates.reply);
  assert.ok(!prompt.includes('LEGACY_UNUSED_FIELD'));
  assert.ok(!prompt.includes('"prop":'));
});

test('each task reads exactly one complete document without caching', async () => {
  for (const task of ['game', 'reply', 'ending']) {
    const requests = [], controller = new AbortController();
    const bundle = await loadHeartPromptTemplates(task, { signal:controller.signal, fetch:async (url, options) => {
      requests.push({ name:filename(url), ...options }); return readPromptAsset(url, options);
    } });
    assert.deepEqual(requests.map(request => request.name), [task + '.txt']);
    assert.ok(requests.every(request => request.cache === 'no-store' && request.signal === controller.signal));
    assert.deepEqual(Object.keys(bundle), ['task', 'prompt']);
    assert.ok(Object.isFrozen(bundle));
  }
});

test('complete task documents contain one module set and a full reference without hidden inputs', () => {
  const { game, run } = fixtureGame(); until(game, run, 'choice');
  game.snapshot.world.supplemental = 'literal {{RAW}} {{ERROR}} {{CONTEXT}} {{RESUME}} $&';
  for (const [task, prompt] of [
    ['game', gamePrompt(game, templates.game)],
    ['reply', replyPrompt(game, run, 'USER INPUT', templates.reply)],
    ['ending', endingPrompt(game, templates.ending)],
  ]) {
    for (const module of [0, 1, 2]) assert.equal((prompt.match(new RegExp('^# 模块 ' + module + ' ·', 'gm')) || []).length, 1);
    assert.equal((prompt.match(/^## 完整结构体参照/gm) || []).length, 1);
    assert.ok(prompt.includes(game.snapshot.world.supplemental), 'injected text is never recursively substituted');
    assert.ok(prompt.startsWith('# 任务\n'));
    assert.equal((prompt.match(/^# 输出要求$/gm) || []).length, 1);
    assert.ok(!prompt.includes('game-author-reference.txt'));
    assert.ok(prompt.startsWith(templates[task].prompt.slice(0, 30)));
  }
});

test('manual requests reload text while automatic regeneration can reuse identical frozen input', async () => {
  let revision = 1, reads = 0;
  const fetch = async () => { reads++; return response('GAME ' + revision + ' {{CONTEXT}}'); };
  const first = await loadHeartPromptTemplates('game', { fetch }), { game } = fixtureGame();
  const input = gamePrompt(game, first); revision = 2;
  assert.equal(gamePrompt(game, first), input); assert.equal(reads, 1);
  const next = await loadHeartPromptTemplates('game', { fetch });
  assert.equal(reads, 2); assert.match(gamePrompt(game, next), /GAME 2/);
});

test('missing, empty, HTML and malformed documents fail before any model request', async () => {
  for (const invalid of [null, '', '   ', '<!doctype html><html>Not found</html>', 'no placeholder']) {
    await assert.rejects(loadHeartPromptTemplates('game', { fetch:async () => invalid === null ? { ok:false, status:404 } : response(invalid) }), /提示词读取失败.*game\.txt/);
  }
  await assert.rejects(loadHeartPromptTemplates('reply', { fetch:async () => response('{{CONTEXT}}') }), /RESUME/);
  await assert.rejects(loadHeartPromptTemplates('ending', { fetch:async () => response('no context') }), /CONTEXT/);
  assert.throws(() => gamePrompt(fixtureGame().game), /TXT/);
  await assert.rejects(loadHeartPromptTemplates('unknown'), /未知/);
});

test('aborting document loading propagates cancellation', async () => {
  const controller = new AbortController();
  const promise = loadHeartPromptTemplates('game', { signal:controller.signal, fetch:async (_, { signal }) =>
    new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once:true })) });
  controller.abort(); await assert.rejects(promise, error => error.name === 'AbortError');
});

test('the concise reference preserves author card topics and all branches without weakening production length checks', async () => {
  const room = fixtureRoom(); room.config.source = 'random';
  const game = E.createGame(room, { order:['P1', 'USER'] }, () => .9);
  const source = templates.game.prompt.match(/^<cards>[\s\S]*?^<\/story>$/m)?.[0];
  assert.ok(source);
  const original = await readFile(new URL('../zxhp.txt', import.meta.url), 'utf8');
  const rows = original.match(/\nR\d[^\r\n]+/g).map(row => row.trim().split('|').filter((_, index) => index !== 6).join('|'));
  assert.deepEqual(source.match(/\nR\d[^\n]+/g).map(row => row.trim()), rows);
  const data = parseGameFormat(source, game);
  assert.equal(data.cards.length, 5);
  assert.ok(data.cards.every(card => card.beats.filter(beat => beat.kind === 'choice').every(beat => beat.options.some(option => option.attitude === 'reserved'))));
  assert.throws(() => E.validateContent(source, game), error => {
    const issues = error.message.split('\n').slice(1);
    return issues.length === 5 && issues.every(issue => /剧情过短：最短路径/.test(issue));
  });
  // Expand only prose in this test so every other production constraint is still exercised.
  for (const card of data.cards) card.beats.find(beat => beat.kind === 'line').text += '用于验证结构的补充叙事。'.repeat(30);
  assert.equal(E.validateContent(data, game).cards.length, 5);
});

const gameInput = game => {
  const input = buildHeartRequest('game', game, null, '', templates.game).input;
  const [core, runtime] = input.split('\n\n程序运行资料（卡牌绑定与有效进度）：\n');
  const headings = [...core.matchAll(/^【([^】]+)】：\n/gm)];
  return { core, runtime:JSON.parse(runtime), sections:Object.fromEntries(headings.map((match, index) =>
    [match[1], core.slice(match.index + match[0].length, headings[index + 1]?.index ?? core.length).trim()])) };
};

test('game input precedes the complete example and the final instruction ends the response at story', () => {
  const { game } = fixtureGame();
  const request = buildHeartRequest('game', game, null, '', templates.game);
  const inputEnd = request.prompt.indexOf('</game_input>');
  const reference = request.prompt.indexOf('## 完整结构体参照');
  const exampleEnd = request.prompt.indexOf('\n</story>', reference);
  const final = request.prompt.indexOf('## 现在执行本次生成');
  assert.ok(request.prompt.indexOf(request.input) < inputEnd && inputEnd < reference);
  assert.ok(reference < exampleEnd && exampleEnd < final);
  assert.doesNotMatch(request.prompt.slice(exampleEnd), /【世界观设定】|以下为游戏核心参数输入|### 旁白节奏/);
  assert.match(request.prompt.slice(final), /立即结束回答/);
  assert.match(request.prompt.slice(final), /不要续写本提示词/);
});

test('MODULE 0 parameters match settings, defaults, identities and the actual plan', () => {
  for (const count of [1, 3]) for (const source of ['random', 'builtin']) {
    const room = fixtureRoom(2, count);
    room.config.source = source;
    room.world.supplemental = 'literal {{游戏核心参数}} {{CONTEXT}} {{user}} $&';
    const order = ['P1', 'USER', ...room.players.slice(1).map(p => p.id)];
    const game = E.createGame(room, { order }), data = gameInput(game);
    assert.deepEqual(Object.keys(data.sections), ['世界观设定', '语言设置', '人称', '参与角色', '{{user}}设定', '人数模式',
      '局势风格', '是否包含卡牌库', '卡牌风格（无卡牌库）', 'NSFW阀值', '轮次与行动序', '当前游戏轮数']);
    assert.equal(data.sections['局势风格'], '无要求');
    assert.equal(data.sections['卡牌风格（无卡牌库）'], source === 'random' ? '无要求' : '不适用（使用已有卡牌库）');
    assert.equal(data.sections['是否包含卡牌库'], source === 'builtin' ? '是' : '否');
    assert.ok(data.sections['人数模式'].startsWith(count === 1 ? '1V1' : '多人'));
    assert.equal(data.sections['语言设置'], '简体中文');
    assert.ok(data.sections['{{user}}设定'].includes('玩家姓名：' + room.world.user.name));
    assert.equal(data.sections['轮次与行动序'], '共2轮，当前行动顺位：' + order.map(id => E.actorName(game, id)).join(' -> '));
    assert.deepEqual(data.runtime.order, order);
    assert.deepEqual(data.runtime.plans, game.plans);
    assert.deepEqual(data.runtime.sourceCards, game.sourceSnapshot);
    assert.ok(data.sections['世界观设定'].includes(room.world.supplemental));
    assert.doesNotMatch(data.core, /懒人模式/);
    assert.deepEqual(data.runtime.settings.styles, []);
    assert.deepEqual(data.runtime.settings.bankThemes, []);
    for (const player of room.players) {
      assert.ok(data.sections['世界观设定'].includes(player.description));
      assert.ok(data.sections['参与角色'].includes('角色 ID：' + player.id));
    }
    assert.deepEqual(game.snapshot.config.styles, [], 'empty choices remain unrestricted');
    assert.ok(!Object.hasOwn(data.runtime.settings, 'api'));
    assert.ok(!Object.hasOwn(data.runtime, '世界观设定'), 'core fields are rendered as text rather than repeated JSON');
  }
});

test('narrative person defaults and room snapshots reach all three generation tasks', () => {
  for (const value of [undefined, null, '', 'invalid']) {
    assert.equal(E.normalizeConfig({ narrativePerson:value }).narrativePerson, 'second');
  }
  assert.equal(E.normalizeConfig({}).narrativePerson, 'second');
  for (const [person, label] of Object.entries(E.HEART_NARRATIVE_PERSONS)) {
    const { game, run, room } = fixtureGame();
    game.snapshot.config.narrativePerson = person;
    room.config.narrativePerson = person === 'first' ? 'third' : 'first';
    until(game, run, 'choice');
    assert.equal(gameInput(game).sections['人称'], label);
    for (const output of [gamePrompt(game, templates.game),
      replyPrompt(game, run, '继续聊聊。', templates.reply), endingPrompt(game, templates.ending)]) {
      assert.ok(output.includes('【人称】：\n' + label));
    }
    const stored = E.normalizeStore(JSON.parse(JSON.stringify({ version:1, rooms:[room], activeRoomId:room.id })));
    assert.equal(stored.rooms[0].games[0].snapshot.config.narrativePerson, person);
  }
});

test('situation styles and card styles remain independently selected and survive migration', () => {
  const room = fixtureRoom();
  room.config = E.normalizeConfig({ styles:['日常破冰', '心跳暧昧', '权谋'], source:'random',
    bankThemes:['默契合作', '灵魂'], customTheme:'雨夜', keywords:'故乡' });
  const data = gameInput(E.createGame(room, { order:['P1', 'USER'] }));
  assert.equal(data.sections['局势风格'], '轻松 / 暧昧 / 权谋');
  assert.equal(data.sections['卡牌风格（无卡牌库）'], '默契 / 灵魂');
  assert.equal(data.runtime.settings.customTheme, '雨夜');
  assert.equal(data.runtime.settings.keywords, '故乡');
});

test('all tasks expand full world text and preserve literal newlines and placeholder-like content', () => {
  const { game, run } = fixtureGame();
  until(game, run, 'choice');
  const world = game.snapshot.world;
  world.character = { name:'林舟', description:'角色原文第一行\n角色原文第二行 {{CONTEXT}}' };
  world.view = '世界规则第一行\n世界规则第二行';
  world.chat = '玩家：原话\n角色：原话';
  world.injection.injectChat = true;
  world.entries = [{ wbName:'旅店', uid:'book-1', label:'夜雨', content:'条目第一行\n条目第二行 {{游戏核心参数}}', enabled:true }];
  const generated = gameInput(game);
  for (const value of [world.view, world.character.description, world.chat, world.entries[0].content]) {
    assert.ok(generated.sections['世界观设定'].includes(value), 'world content stays complete and multiline');
  }
  for (const output of [gamePrompt(game, templates.game), replyPrompt(game, run, '想再听听。', templates.reply), endingPrompt(game, templates.ending)]) {
    for (const [name, content] of Object.entries(generated.sections)) assert.ok(output.includes(`【${name}】：\n${content}`));
  }
});

test('the supplementary-dialogue example matches actual speaker, length and return-node rules', () => {
  const { game, run } = fixtureGame();
  until(game, run, 'choice');
  const prompt = replyPrompt(game, run, '我愿意补充一个细节。', templates.reply);
  const examples = [...prompt.matchAll(/^<reply\s[^>]*>[\s\S]*?^<\/reply>$/gm)];
  assert.equal(examples.length, 2);
  for (const [index, example] of examples.entries()) {
    const parsed = E.validateReply(example[0], game, run);
    assert.equal(parsed.lines.length, 4);
    assert.equal(parsed.state, index === 0 ? 'resume' : 'wait');
    assert.ok(parsed.lines.every(line => line.speaker !== 'USER'));
    assert.equal(parsed.resume, run.current.resumeId || run.current.id);
  }
});

test('input preview contains exactly the injected data and excludes the selected task document', () => {
  const { game, run } = fixtureGame(); until(game, run, 'choice');
  game.snapshot.world.supplemental = '世界观里的原文 {{CONTEXT}} 不得被删除。';
  for (const task of ['game', 'reply', 'ending']) {
    const request = buildHeartRequest(task, game, run, '我想先听你说。', templates[task]);
    assert.ok(request.input.startsWith('【世界观设定】：\n'));
    assert.ok(request.input.includes(game.snapshot.world.supplemental));
    assert.ok(request.prompt.includes(request.input));
    assert.doesNotMatch(request.input, /^# (?:任务|输出要求|模块)|^## 完整结构体参照/m);
    const runtime = JSON.parse(request.input.split('\n\n程序运行资料（卡牌绑定与有效进度）：\n').at(-1));
    assert.equal(runtime.task, task);
    if (task === 'game') assert.deepEqual(runtime.plans, game.plans);
    if (task === 'reply') {
      assert.equal(runtime.input, '我想先听你说。');
      assert.equal(runtime.resume, run.current.resumeId || run.current.id);
    }
    if (task === 'ending') assert.ok(runtime.endingInstruction);
  }
});

test('the complete ending example meets the actual output contract and requested length', () => {
  const example = templates.ending.prompt.match(/^\{"task":"ending".*\}$/m)?.[0];
  assert.ok(example);
  const parsed = E.validateEnding(example);
  assert.ok(parsed.text.length >= 200 && parsed.text.length <= 600);
});

test('short supplementary responses fail validation while four to six lines are accepted', () => {
  const { game, run } = fixtureGame();
  until(game, run, 'choice');
  const resume = run.current.resumeId || run.current.id;
  for (const state of ['resume', 'wait']) for (const count of [1, 2, 3, 4, 5, 6, 7]) {
    const output = '<reply state="' + state + '" resume="' + resume + '">\n'
      + Array.from({ length:count }, (_, index) => '[P1]围绕当前输入的具体回应' + index + '。').join('\n') + '\n</reply>';
    if (count >= 4 && count <= 6) assert.equal(E.validateReply(output, game, run).lines.length, count);
    else assert.throws(() => E.validateReply(output, game, run), /自由互动/);
  }
});

test('templates separate settings, effective facts, alternatives and task-specific output contracts', () => {
  const system = templates.game.prompt;
  for (const marker of ['{{user}}设定', 'sourceCards', 'previous', 'effectiveProgress', 'plans', 'order', '最短可播放路径至少250字']) assert.ok(system.includes(marker), marker);
  assert.ok(system.includes('未选分支和角色卡例文不能当成已发生事实'));
  assert.ok(system.includes('角色只知道自身见闻与已获知的信息'));
  assert.ok(system.includes('完整结局由玩家单独发起'));
  for (const marker of ['current', 'remaining', '4—6', '不输出 [USER]', '不新增轮次或生成结局']) assert.ok(templates.reply.prompt.includes(marker), marker);
  assert.ok(templates.ending.prompt.includes('结束从开场至今的整段连续游戏'));
  for (const task of ['reply', 'ending']) {
    const prompt = templates[task].prompt;
    assert.ok(prompt.indexOf('{{CONTEXT}}') < prompt.indexOf('## 完整结构体参照'));
    assert.ok(prompt.lastIndexOf('## 现在执行') > prompt.indexOf('## 完整结构体参照'));
    assert.doesNotMatch(prompt, /标签补全|交付前检查|MODULE|输出 Goal/);
  }
});
