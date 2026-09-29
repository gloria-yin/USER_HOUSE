import test from 'node:test';
import assert from 'node:assert/strict';
import { generationLogFilename, generationLogText, uploadGenerationLog } from '../src/heart-challenge/generation-log.js';
import * as E from '../src/heart-challenge/engine.js';
import { fixtureGame, fixtureProtocol } from './heart-challenge-fixture.mjs';

const record = { requestId:'request-test', roomId:'room-test', roomTitle:'雨夜客栈', gameId:'game-test',
  task:'game', attempt:2, startedAt:1750000000000, finishedAt:1750000001000,
  status:'failed', error:'存在空表情标签', raw:'<story>\n[P2;]原始输出。\n</story>\n【世界观设定】：尾文也保留' };

test('server log preserves all received text, Unicode, status and separate attempt filenames', async () => {
  let request;
  const path = await uploadGenerationLog(record, { headers:{ 'X-CSRF-Token':'test-token' }, fetch:async (url, options) => {
    request = { url, options, body:JSON.parse(options.body) };
    return { ok:true, json:async () => ({ path:'user/files/' + request.body.name }) };
  } });
  assert.equal(request.url, '/api/files/upload');
  assert.equal(request.options.headers['X-CSRF-Token'], 'test-token');
  const saved = Buffer.from(request.body.data, 'base64').toString('utf8');
  assert.equal(saved, generationLogText(record));
  assert.ok(saved.endsWith(record.raw));
  assert.match(saved, /失败原因：存在空表情标签/);
  assert.equal(path, '/user/files/' + generationLogFilename(record));
  assert.notEqual(generationLogFilename(record), generationLogFilename({ ...record, attempt:1 }));
});

test('upload failure is observable and cannot be mistaken for server persistence', async () => {
  await assert.rejects(uploadGenerationLog(record, { fetch:async () => ({ ok:false, status:500 }) }), /500/);
  await assert.rejects(uploadGenerationLog(record, { fetch:async () => ({ ok:true, json:async () => ({ path:'https://example.invalid/output' }) }) }), /地址/);
});

test('reported empty expression tags and missing NPC declarations reproduce actual validation failures', () => {
  const { game } = fixtureGame();
  const protocol = fixtureProtocol(game);
  assert.throws(() => E.validateContent(protocol.replace('[P1]', '[P1;]'), game), /空emoji标签/);
  const noDeclaration = protocol.replace(/\[P1[^\]]*\]([^\n]*)\n(?=\[DRAW:)/, '[N]轮到这名角色抽牌。\n');
  assert.notEqual(noDeclaration, protocol);
  assert.throws(() => E.validateContent(noDeclaration, game), /宣言/);
});
