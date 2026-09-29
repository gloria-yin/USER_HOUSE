import test from 'node:test';
import assert from 'node:assert/strict';
import { heartWorldFromRole, heartWorldForPrompt, normalizeHeartWorld } from '../src/heart-challenge/world.js';
import { gamePrompt, replyPrompt, endingPrompt } from './heart-prompt-fixture.mjs';
import * as E from '../src/heart-challenge/engine.js';
import { fixtureGame, fixtureRoom, until } from './heart-challenge-fixture.mjs';

const settings = () => ({
  lazyWorldInject:true, userName:'专属称呼', userDescSource:'auto', userDescriptionSnapshot:'用户完整设定',
  injectUserDesc:true, charName:'林舟', charDescriptionSnapshot:'角色自动描述', manualCharPersona:'角色手动描述',
  injectCharDesc:true, charDescMode:'auto', specialLanguageEnabled:true, specialLanguage:'日语',
  injectChat:true, chatSnapshot:'最近八条聊天', breakLimitPrompt:'前置风格要求', worldAutoMountMode:'bluegreen',
  selectedWorldEntries:[{ uid:1, wbName:'旅店', label:'规则', content:'选中世界书内容' },
    { uid:2, wbName:'旅店', label:'停用条目', content:'不应注入的世界书', enabled:false }],
  apiKey:'secret-api-token', apiUrl:'private-api-endpoint',
});

test('settings and current-card sources share all injection controls without credentials', () => {
  for (const kind of ['existing-world', 'current-card']) {
    const world = heartWorldFromRole(settings(), { kind, languageInstruction:'使用日语并附中文翻译' });
    assert.equal(world.sourceKind, kind);
    assert.deepEqual(world.injection, { lazyWorldInject:true, injectUserDesc:true, userDescSource:'auto',
      injectCharDesc:true, charDescMode:'auto', specialLanguageEnabled:true, injectChat:true, worldAutoMountMode:'bluegreen' });
    assert.equal(world.user.name, '专属称呼');
    assert.equal(world.user.persona, '用户完整设定');
    assert.equal(world.character.description, '角色自动描述');
    assert.equal(world.character.manualDescription, '角色手动描述');
    assert.equal(world.entries.length, 2);
    assert.doesNotMatch(JSON.stringify(world), /secret-api-token|private-api-endpoint|apiKey|apiUrl/);
  }
});

test('manual and disabled settings determine the actual prompt content', () => {
  const world = heartWorldFromRole({ ...settings(), charDescMode:'manual' });
  let result = heartWorldForPrompt(world);
  assert.equal(result.character.description, '角色手动描述');
  assert.equal(result.entries.length, 1);
  Object.assign(world.injection, { injectUserDesc:false, injectCharDesc:false, injectChat:false, specialLanguageEnabled:false });
  result = heartWorldForPrompt(world);
  assert.doesNotMatch(JSON.stringify(result), /用户完整设定|角色自动描述|角色手动描述|最近八条聊天|日语|不应注入的世界书/);
  assert.equal(result.user.name, '专属称呼');
  assert.equal(world.user.persona, '用户完整设定', 'disabled content remains editable in the saved world');
});

test('full world, chosen name and supplement reach game, reply and ending requests', () => {
  const { game, run } = fixtureGame();
  until(game, run, 'choice');
  game.snapshot.world = normalizeHeartWorld({ ...heartWorldFromRole(settings(), { languageInstruction:'使用日语并附中文翻译' }),
    supplemental:'补充的场景要求', user:{ name:'专属称呼', persona:'用户完整设定', avatar:'avatar-must-not-be-in-prompt' } });
  for (const prompt of [gamePrompt(game), replyPrompt(game, run, '自由回答'), endingPrompt(game)]) {
    for (const content of ['专属称呼', '用户完整设定', '角色自动描述', '最近八条聊天', '选中世界书内容', '使用日语并附中文翻译', '补充的场景要求']) assert.ok(prompt.includes(content), content);
    assert.equal(prompt.split('前置风格要求').length - 1, 1);
    assert.equal(prompt.split('使用日语并附中文翻译').length - 1, 1);
    assert.doesNotMatch(prompt, /不应注入的世界书|角色手动描述|avatar-must-not-be-in-prompt|secret-api-token/);
  }
});

test('long world content survives storage normalization and game snapshots', () => {
  const room = fixtureRoom();
  room.world = normalizeHeartWorld({ character:{ description:'完整描述'.repeat(25000) + '描述末尾' },
    user:{ name:'旅行者' }, supplemental:'补充'.repeat(12000) + '补充末尾',
    entries:[{ label:'长世界书', content:'条目'.repeat(50000) + '条目末尾' }] });
  const game = E.createGame(room, { order:['P1', 'USER'], revealed:true });
  room.games.push(game);
  const saved = E.normalizeStore({ version:1, rooms:[room] }).rooms[0];
  assert.deepEqual(saved.world, room.world);
  assert.deepEqual(saved.games[0].snapshot.world, room.world);
  const prompt = gamePrompt(game);
  for (const marker of ['描述末尾', '补充末尾', '条目末尾']) assert.ok(prompt.includes(marker));
});

test('legacy combined descriptions and chat migrate without loss', () => {
  const world = normalizeHeartWorld({ view:'旧世界规则\n【当前角色卡资料】\n完整旧角色资料',
    chat:'旧聊天快照', language:'英语', user:{ name:'旧称呼' } });
  assert.equal(world.view, '旧世界规则');
  assert.equal(world.character.description, '完整旧角色资料');
  assert.equal(world.injection.injectChat, true);
  assert.equal(world.injection.specialLanguageEnabled, true);
  assert.deepEqual(normalizeHeartWorld(world), world);
});
