import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as E from '../src/heart-challenge/engine.js';
import { fixtureGame, fixtureProtocol } from './heart-challenge-fixture.mjs';

const source = await readFile(new URL('../src/runtime/wanban-app.js', import.meta.url), 'utf8');
const stream = source.slice(source.indexOf('  async function callApiTextStream('), source.indexOf('  function openAiSummaryImporter('));
const fence = source.slice(source.indexOf('  function stripJsonFence('), source.indexOf('  async function fetchWithTimeout('));

async function call(text, mode, preserveFormat, finishReason = 'stop', exactInput = false) {
  const emitted = [];
  const message = { choices:[{ message:{ content:text }, finish_reason:finishReason }] };
  let response;
  if (mode === 'no-reader') response = { ok:true, body:null, json:async () => message };
  else if (mode === 'json') response = new Response(JSON.stringify(message));
  else {
    const parts = [text.slice(0, 7), text.slice(7)];
    const body = parts.map(content => 'data: ' + JSON.stringify({ choices:[{ delta:{ content } }] }) + '\n\n').join('')
      + 'data: ' + JSON.stringify({ choices:[{ delta:{}, finish_reason:finishReason }] }) + '\n\ndata: [DONE]\n\n';
    response = new Response(body, { headers:{ 'Content-Type':'text/event-stream' } });
  }
  let payload;
  const context = vm.createContext({ roleGenerationInput:() => 'LIVE COMPANION PREFIX', apiChatUrl:value => value,
    fetch:async (_, options) => { payload = JSON.parse(options.body); return response; }, AbortController, TextDecoder, setTimeout, clearTimeout });
  const request = vm.runInContext(fence + '\n' + stream + '\ncallApiTextStream', context);
  const result = await request({ apiUrl:'https://example.invalid', apiModel:'test' }, 'prompt', 'system', 4096,
    delta => emitted.push(delta), new AbortController().signal, { preserveFormat, exactInput });
  return { result, emitted:emitted.join(''), payload };
}

test('complete heart input is the sole wire message while other callers retain their prefixes', async () => {
  for (const mode of ['sse', 'json', 'no-reader']) {
    assert.deepEqual((await call('output', mode, true, 'stop', true)).payload.messages, [{ role:'user', content:'prompt' }]);
    assert.deepEqual((await call('output', mode, false)).payload.messages, [
      { role:'system', content:'system' }, { role:'user', content:'LIVE COMPANION PREFIX\n\nprompt' },
    ]);
  }
});

test('heart transport preserves XML fences for the parser across SSE and both JSON response paths', async () => {
  const { game } = fixtureGame();
  const raw = '```xml\n' + fixtureProtocol(game) + '\n```';
  for (const mode of ['sse', 'json', 'no-reader']) {
    const { result, emitted } = await call(raw, mode, true);
    assert.equal(result, raw, mode);
    assert.equal(emitted, raw, mode);
    assert.equal(E.validateContent(result, game).cards.length, 5);
  }
});

test('legacy JSON callers retain fence removal and truncated heart responses retain the raw output', async () => {
  for (const mode of ['sse', 'json', 'no-reader']) {
    assert.equal((await call('```json\n{"ok":true}\n```', mode, false)).result, '{"ok":true}');
    await assert.rejects(call('```xml\n<cards>', mode, true, 'length'), error => error.raw === '```xml\n<cards>' && /截断/.test(error.message));
  }
});
