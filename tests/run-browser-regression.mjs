import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const chrome = process.env.WB_TEST_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = await mkdtemp(join(tmpdir(), 'wb-browser-check-'));
const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio:'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let sequence = 0;
try {
  let port;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await sleep(100); }
  }
  assert.ok(port, 'Chrome did not start');
  for (const width of [900,360,280]) {
    const target = await (await fetch('http://127.0.0.1:' + port + '/json/new?about:blank', { method:'PUT' })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    const pending = new Map();
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      const request = pending.get(message.id);
      if (request) { pending.delete(message.id); message.error ? request.reject(message.error) : request.resolve(message.result); }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height:1000, deviceScaleFactor:1, mobile:width < 500 });
    await send('Page.navigate', { url:process.env.WB_TEST_URL || 'http://127.0.0.1:8765/tests/water-sort-layout.html' });
    let result;
    for (let attempt = 0; attempt < 300; attempt++) {
      const response = await send('Runtime.evaluate', { expression:'JSON.stringify({ status:document.body?.dataset.result, text:document.querySelector("#result")?.textContent })', returnByValue:true });
      result = JSON.parse(response.result.value || '{}');
      if (result.status) break;
      await sleep(100);
    }
    const screenshot = await send('Page.captureScreenshot', { format:'png' });
    const path = join(profile, 'layout-' + width + '.png');
    await writeFile(path, Buffer.from(screenshot.data, 'base64'));
    console.log(width + 'px:', result?.text, '\nScreenshot:', path);
    socket.close();
    assert.equal(result?.status, 'PASS');
  }
} finally { child.kill(); }
