import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = resolve(fileURLToPath(new URL('..', import.meta.url)));
const chrome = process.env.WANBAN_TEST_CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!chrome) throw new Error('Set WANBAN_TEST_CHROME to a Chromium executable.');

const requests = [];
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<div id="extensionsMenu"></div>
<script>
window.SillyTavern={getContext:()=>({})};
window.requestIdleCallback=callback=>setTimeout(()=>callback({didTimeout:false,timeRemaining:()=>8}),1000);
window.$=window.jQuery=(selector,root=document)=>({length:typeof selector==='string'?(root||document).querySelectorAll(selector).length:(selector?1:0)});
window.__activeIntervals=new Set();
const nativeSetInterval=window.setInterval,nativeClearInterval=window.clearInterval;
window.setInterval=(callback,delay,...args)=>{const id=nativeSetInterval(callback,delay,...args);__activeIntervals.add(id);return id};
window.clearInterval=id=>{__activeIntervals.delete(id);return nativeClearInterval(id)};
window.__errors=[];
addEventListener('error',event=>__errors.push(event.message));
addEventListener('unhandledrejection',event=>__errors.push(String(event.reason)));
const longText='移动端性能测试内容'.repeat(500);
const roles=Array.from({length:32},(_,index)=>({roleKey:'role_'+index,name:'角色 '+index,charName:'角色 '+index,manualCharPersona:longText,worldText:longText,roleUpdatedAt:index}));
localStorage.setItem('wanbanXiaowu_settings_v1',JSON.stringify({roleKey:'role_0',charName:'角色 0',companion:true}));
localStorage.setItem('wanbanXiaowu_worldPresets_v1',JSON.stringify(roles));
localStorage.setItem('wanbanXiaowu_roleContexts_v2',JSON.stringify(Object.fromEntries(roles.map(role=>[role.roleKey,role]))));
localStorage.setItem('wanbanXiaowu_summaries_v1',JSON.stringify(Array.from({length:32},(_,index)=>({id:'summary_'+index,name:'总结 '+index,content:longText}))));
localStorage.setItem('wanbanXiaowu_apiPresets_v1',JSON.stringify(Array.from({length:32},(_,index)=>({name:'API '+index,apiUrl:'https://example.test/v1',apiModel:'model-'+index}))));
window.__storageReads={};
const nativeStorageGet=Storage.prototype.getItem;
Storage.prototype.getItem=function(key){__storageReads[key]=(__storageReads[key]||0)+1;return nativeStorageGet.call(this,key)};
import('/index.js').then(()=>window.__launcherReady=true).catch(error=>__errors.push(String(error)));
</script></body></html>`;

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    requests.push(pathname);
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html;charset=utf-8');
      response.end(html);
      return;
    }
    if (pathname === '/script.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end('export const getRequestHeaders=()=>({});');
      return;
    }
    if (pathname === '/personas.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end("export const user_avatar='';");
      return;
    }
    if (pathname === '/lib.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end('export const yaml={};');
      return;
    }
    const path = resolve(workspace, '.' + pathname);
    if (!path.startsWith(workspace + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    const mime = { '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg' }[extname(path)] || 'application/octet-stream';
    response.setHeader('Content-Type', mime);
    response.end(await readFile(path));
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));

class CDP {
  constructor(url) {
    this.next = 1;
    this.pending = new Map();
    this.ws = new WebSocket(url);
    this.ready = new Promise((resolveOpen, rejectOpen) => { this.ws.onopen = resolveOpen; this.ws.onerror = rejectOpen; });
    this.ws.onmessage = event => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
    };
  }
  async call(method, params = {}) {
    await this.ready;
    const id = this.next++;
    return new Promise((resolveCall, rejectCall) => {
      this.pending.set(id, { resolve:resolveCall, reject:rejectCall });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const temporaryRoot = await mkdtemp(join(tmpdir(), 'wanban-startup-check-'));
const profile = join(temporaryRoot, 'profile');
await mkdir(profile);
let browser;
let client;
async function evaluate(expression) {
  const result = await client.call('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let i = 0; i < 180; i++) {
    if (await evaluate(expression)) return;
    await sleep(30);
  }
  throw new Error('Timed out: ' + expression);
}

try {
  const endpoint = await new Promise((resolveEndpoint, rejectEndpoint) => {
    browser = spawn(chrome, [
      '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
    ], { windowsHide:true, stdio:['ignore', 'ignore', 'pipe'] });
    browser.once('error', rejectEndpoint);
    browser.stderr.on('data', data => {
      const match = String(data).match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolveEndpoint(match[1]);
    });
    browser.once('exit', code => rejectEndpoint(new Error('Browser exited ' + code)));
  });
  const address = new URL(endpoint).host;
  const tabs = await (await fetch('http://' + address + '/json/list')).json();
  client = new CDP(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await client.call('Page.enable');
  await client.call('Runtime.enable');
  await client.call('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:2, mobile:true });
  await client.call('Page.navigate', { url:'http://127.0.0.1:' + server.address().port });
  await waitFor('window.__launcherReady===true && !!document.querySelector("#wanbanXiaowu-menu-item")');
  await sleep(3300);

  assert.ok(!requests.some(path => path.includes('wanban-app.js')), 'disabled background features must not warm the main runtime');
  assert.ok(!requests.includes('/style.css'), 'the full stylesheet must stay out of the startup path');

  await evaluate('window.__openStarted=performance.now();document.querySelector("#wanbanXiaowu-menu-item").click()');
  await waitFor('performance.getEntriesByType("resource").some(entry=>entry.name.includes("wanban-app.js"))');
  await waitFor('!!document.querySelector("#wanbanXiaowu-popup")');
  const openMs = await evaluate('performance.now()-window.__openStarted');
  assert.ok(requests.some(path => path.includes('wanban-app.js')), 'clicking the launcher should load the runtime');
  assert.ok(requests.includes('/style.css'), 'clicking the launcher should load the stylesheet');
  assert.equal(await evaluate('window.__activeIntervals.size'), 0, 'disabled notifications and pets must not leave a polling timer');
  assert.equal(await evaluate('document.querySelectorAll(".wb-game-card").length'), 5, 'the mobile first frame should render one small card batch');
  await sleep(300);
  const firstIcons = await evaluate(`(()=>({loaded:document.querySelectorAll('.wb-game-card .wb-game-icon.has-image img').length,html:Array.from(document.querySelectorAll('.wb-game-icon')).map(icon=>icon.outerHTML)}))()`);
  assert.equal(firstIcons.loaded, 5, 'first game icons did not load: ' + JSON.stringify(firstIcons) + ' requests=' + JSON.stringify(requests.filter(path=>path.includes('game-icons'))));
  await sleep(1200);
  assert.ok(await evaluate('document.querySelectorAll(".wb-game-card").length') > 5, 'remaining cards should render during idle time');
  for (const heavy of ['water-sort-bank.js', '/src/games/zuma.js', '/src/games/water-sort.js', '/src/games/flappy-bird.js', '/src/heart-challenge/']) {
    assert.ok(!requests.some(path => path.includes(heavy)), heavy + ' loaded before its feature was opened');
  }
  for (let i = 0; i < 8 && !(await evaluate('!!document.querySelector("[data-game=shuerte]")')); i++) {
    await evaluate('document.querySelector("#wb-body").scrollTop=document.querySelector("#wb-body").scrollHeight');
    await sleep(260);
  }
  assert.ok(await evaluate('!!document.querySelector("[data-game=shuerte]")'), 'scrolling should reveal the Schulte grid card');
  await evaluate('document.querySelector("[data-game=shuerte]").scrollIntoView({block:"center"})');
  await waitFor('document.querySelector("[data-game=shuerte] .wb-game-icon")?.classList.contains("has-image")');
  await evaluate('document.querySelector("[data-game=shuerte]").click()');
  await waitFor('!!document.querySelector("#wb-start-cover-btn")');
  await evaluate('document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('!!document.querySelector("#wb-choice-mask [data-choice=easy]")');
  await evaluate('document.querySelector("#wb-choice-mask [data-choice=easy]").click()');
  await waitFor('document.querySelectorAll(".wb-shuerte-cell").length===16');
  const interaction = await evaluate(`(async()=>{
    const board=document.querySelector('#wb-shuerte-board');
    const original=Array.from(board.children);
    const frameTimes=[];
    const handlerTimes=[];
    for(let value=1;value<=8;value++){
      const button=Array.from(board.children).find(cell=>cell.querySelector('.wb-shuerte-number')?.textContent===String(value));
      const started=performance.now();
      button.click();
      handlerTimes.push(performance.now()-started);
      await new Promise(requestAnimationFrame);
      frameTimes.push(performance.now()-started);
    }
    return {
      stable:original.every((cell,index)=>cell===board.children[index]),
      count:board.children.length,
      maxFrame:Math.max(...frameTimes),
      maxHandler:Math.max(...handlerTimes),
      target:document.querySelector('#wb-shuerte-target')?.textContent,
    };
  })()`);
  assert.equal(interaction.stable, true, 'Schulte input must reuse its grid cells');
  assert.equal(interaction.count, 16, 'Schulte input must preserve the grid');
  assert.equal(interaction.target, '目标：9', 'rapid Schulte taps must all register');
  assert.ok(interaction.maxHandler < 30, 'Schulte input handler took ' + interaction.maxHandler.toFixed(1) + 'ms');
  await sleep(1400);
  await evaluate('document.querySelector("#wb-pause").click()');
  await waitFor('!!document.querySelector("#wb-pause-overlay")');
  assert.equal(await evaluate(`import('/src/runtime/storage.js?progress-check').then(module=>module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_progress_v1')).shuerte.next)`), 9, 'debounced Schulte progress must persist');
  await evaluate(`(()=>{
    window.__settingsLongTasks=[];
    if(!globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')) return;
    window.__settingsLongObserver=new PerformanceObserver(list=>list.getEntries().forEach(entry=>__settingsLongTasks.push(entry.duration)));
    window.__settingsLongObserver.observe({type:'longtask',buffered:false});
  })()`);
  const settingsSwitch = await evaluate(`(()=>{
    window.__stableHeader=document.querySelector('.wb-head');
    const started=performance.now();
    document.querySelector('[data-tab=settings]').click();
    return performance.now()-started;
  })()`);
  assert.equal(await evaluate('document.querySelectorAll(".wb-settings-grid > .wb-panel").length'), 6, 'settings should render every panel');
  assert.ok(settingsSwitch < 100, 'settings switch took ' + settingsSwitch.toFixed(1) + 'ms');
  const settingsScroll = await evaluate(`(async()=>{
    const body=document.querySelector('#wb-body');
    const samples=[];
    const work=[];
    const maxScroll=body.scrollHeight-body.clientHeight;
    for(let step=1;step<=12;step++){
      const started=performance.now();
      body.scrollTop=maxScroll*step/12;
      document.elementFromPoint(body.clientWidth/2,Math.min(innerHeight-2,body.getBoundingClientRect().bottom-2));
      work.push(performance.now()-started);
      await new Promise(requestAnimationFrame);
      samples.push(performance.now()-started);
    }
    await new Promise(resolve=>setTimeout(resolve,50));
    window.__settingsLongObserver?.disconnect();
    return {maxFrame:Math.max(...samples),maxWork:Math.max(...work),maxLongTask:Math.max(0,...window.__settingsLongTasks),bottom:body.scrollTop>0,panels:document.querySelectorAll('.wb-settings-grid > .wb-panel').length};
  })()`);
  assert.equal(settingsScroll.bottom, true, 'settings should remain scrollable');
  assert.equal(settingsScroll.panels, 6, 'scrolling must preserve settings content');
  assert.ok(settingsScroll.maxWork < 30, 'settings scroll work took ' + settingsScroll.maxWork.toFixed(1) + 'ms');
  assert.ok(settingsScroll.maxLongTask < 80, 'settings produced a ' + settingsScroll.maxLongTask.toFixed(1) + 'ms long task');
  assert.ok(settingsScroll.maxFrame < 80, 'settings scroll frame took ' + settingsScroll.maxFrame.toFixed(1) + 'ms');
  const homeSwitch = await evaluate(`(()=>{
    const started=performance.now();
    document.querySelector('[data-tab=single]').click();
    return {elapsed:performance.now()-started,stableHeader:window.__stableHeader===document.querySelector('.wb-head')};
  })()`);
  assert.equal(homeSwitch.stableHeader, true, 'tab switches should preserve the popup header');
  assert.equal(await evaluate('document.querySelectorAll(".wb-game-card").length'), 5, 'returning home should keep the bounded mobile first batch');
  await waitFor('document.querySelectorAll(".wb-game-card .wb-game-icon.has-image img").length===5');
  assert.ok(homeSwitch.elapsed < 60, 'home switch took ' + homeSwitch.elapsed.toFixed(1) + 'ms');
  const secondSettingsSwitch = await evaluate(`(()=>{
    const started=performance.now();
    document.querySelector('[data-tab=settings]').click();
    return performance.now()-started;
  })()`);
  assert.ok(secondSettingsSwitch < 60, 'cached settings switch took ' + secondSettingsSwitch.toFixed(1) + 'ms');
  const readCounts = await evaluate(`Object.fromEntries(['wanbanXiaowu_apiPresets_v1','wanbanXiaowu_worldPresets_v1','wanbanXiaowu_summaries_v1','wanbanXiaowu_roleContexts_v2'].map(key=>[key,__storageReads[key]||0]))`);
  Object.entries(readCounts).forEach(([key,count]) => assert.ok(count <= 1, key + ' was decoded ' + count + ' times'));
  await evaluate(`(()=>{
    const input=document.querySelector('#wb-break-limit-prompt');
    input.value='遮罩关闭保存验证';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#wanbanXiaowu-shell').click();
  })()`);
  assert.equal(await evaluate('document.querySelector("#wanbanXiaowu-shell").classList.contains("wb-shell-visible")'), false, 'closing must hide the popup shell');
  assert.equal(await evaluate('document.querySelector("#wb-body").childElementCount'), 0, 'closing must release the heavy popup body');
  assert.equal(await evaluate(`import('/src/runtime/storage.js?settings-close-check').then(module=>module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_settings_v1')).breakLimitPrompt)`), '遮罩关闭保存验证', 'backdrop close must flush debounced settings');
  await sleep(1300);
  const releasedReadCounts = await evaluate(`Object.fromEntries(['wanbanXiaowu_apiPresets_v1','wanbanXiaowu_worldPresets_v1','wanbanXiaowu_summaries_v1','wanbanXiaowu_roleContexts_v2'].map(key=>[key,__storageReads[key]||0]))`);
  await evaluate('document.querySelector("#wanbanXiaowu-menu-item").click()');
  await waitFor('document.querySelectorAll(".wb-game-card").length===5');
  await evaluate('document.querySelector("[data-tab=settings]").click()');
  await waitFor('document.querySelectorAll(".wb-settings-grid > .wb-panel").length===6');
  const reopenedReadCounts = await evaluate(`Object.fromEntries(['wanbanXiaowu_apiPresets_v1','wanbanXiaowu_worldPresets_v1','wanbanXiaowu_summaries_v1','wanbanXiaowu_roleContexts_v2'].map(key=>[key,__storageReads[key]||0]))`);
  Object.entries(reopenedReadCounts).forEach(([key,count]) => assert.equal(count, (releasedReadCounts[key] || 0) + 1, key + ' cache was not released exactly once: ' + count));
  await evaluate('document.querySelector("[data-tab=single]").click()');
  for (let i = 0; i < 8 && !(await evaluate('!!document.querySelector("[data-game=shuerte]")')); i++) {
    await evaluate('document.querySelector("#wb-body").scrollTop=document.querySelector("#wb-body").scrollHeight');
    await sleep(260);
  }
  await evaluate('document.querySelector("[data-game=shuerte]").click()');
  await waitFor('!!document.querySelector("#wb-progress-continue")');
  await evaluate('document.querySelector("#wb-progress-continue").click()');
  await waitFor('document.querySelector("#wb-shuerte-target")?.textContent==="目标：9"');
  assert.equal(await evaluate('!!document.querySelector("#wb-pause-overlay")'), false, 'continued game must leave the pause state after its countdown');
  await evaluate(`(()=>{
    const button=Array.from(document.querySelectorAll('.wb-shuerte-cell')).find(cell=>cell.querySelector('.wb-shuerte-number')?.textContent==='9');
    button.click();
    window.__nativeStorageSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='wanbanXiaowu_progress_v1') throw new DOMException('temporary quota failure','QuotaExceededError');
      return window.__nativeStorageSet.call(this,key,value);
    };
    document.querySelector('#wb-pause').click();
    document.querySelector('#wb-close').click();
  })()`);
  assert.equal(await evaluate('document.querySelector("#wb-body").childElementCount'), 0, 'failed storage writes must still allow the heavy body to be released');
  await sleep(1300);
  await evaluate('Storage.prototype.setItem=window.__nativeStorageSet');
  await evaluate('document.querySelector("#wanbanXiaowu-menu-item").click()');
  for (let i = 0; i < 8 && !(await evaluate('!!document.querySelector("[data-game=shuerte]")')); i++) {
    await evaluate('document.querySelector("#wb-body").scrollTop=document.querySelector("#wb-body").scrollHeight');
    await sleep(260);
  }
  await evaluate('document.querySelector("[data-game=shuerte]").click()');
  await waitFor('!!document.querySelector("#wb-progress-continue")');
  await evaluate('document.querySelector("#wb-progress-continue").click()');
  await waitFor('document.querySelector("#wb-shuerte-target")?.textContent==="目标：10"');
  assert.equal(await evaluate(`import('/src/runtime/storage.js?progress-check').then(module=>module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_progress_v1')).shuerte.next)`), 10, 'pending progress must persist after storage recovers');
  await evaluate(`(async()=>{
    const board=document.querySelector('#wb-shuerte-board');
    for(let value=10;value<=16;value++){
      const button=Array.from(board.children).find(cell=>cell.querySelector('.wb-shuerte-number')?.textContent===String(value));
      button.click();
      await new Promise(requestAnimationFrame);
    }
  })()`);
  await waitFor('!!document.querySelector("#wb-generate-log:not([disabled])")');
  await evaluate('document.querySelector("#wb-generate-log").click()');
  await waitFor('document.querySelector("#wb-generate-log")?.textContent==="查看日志"');
  assert.equal(await evaluate(`import('/src/runtime/storage.js?record-check').then(module=>!!module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_records_v1')).shuerte?.[0]?.log)`), true, 'generated game log must be stored with its record');

  await evaluate('document.querySelector("#wb-generate-lines").click()');
  await waitFor('!!document.querySelector("#wb-single-generate-mask [data-kind=all]")');
  await evaluate('document.querySelector("#wb-single-generate-mask [data-kind=all]").click()');
  await sleep(100);
  await waitFor('document.querySelector("#wb-generate-lines")?.textContent==="生成" && !document.querySelector("#wb-generate-lines")?.disabled');
  const generatedContent = await evaluate(`import('/src/runtime/storage.js?generated-content-check').then(module=>{
    const lines=module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_roleLines_v1'));
    const theaters=module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_theaters_v1'));
    const scope=Object.keys(lines).find(key=>key.endsWith('::shuerte'));
    const theaterEntries=Object.entries(theaters).filter(([key])=>key.includes('::shuerte::'));
    return {
      role:scope?.slice(0,-'::shuerte'.length)||'',
      lineJSON:JSON.stringify(scope?lines[scope]:null),
      theaterJSON:JSON.stringify(Object.fromEntries(theaterEntries)),
      lineEvents:scope?Object.keys(Object.values(lines[scope]||{})[0]||{}).length:0,
      theaterScenes:theaterEntries.length,
      validTheaters:theaterEntries.every(([,items])=>Array.isArray(items)&&items.length===3),
    };
  })`);
  assert.ok(generatedContent.role, 'offline generated lines must have a persisted role scope');
  assert.ok(generatedContent.lineEvents >= 6, 'offline generated lines must persist complete event groups');
  assert.ok(generatedContent.theaterScenes >= 5 && generatedContent.validTheaters, 'offline generated theaters must persist three entries per scene');

  const theaterRawBeforeFailure = await evaluate(`localStorage.getItem('wanbanXiaowu_theaters_v1')`);
  await evaluate(`(()=>{
    window.__generationMessages=[];
    window.__generationConsoleLog=console.log;
    console.log=(...args)=>{ window.__generationMessages.push(args.map(String).join(' ')); window.__generationConsoleLog(...args); };
    window.__generationStorageGet=Storage.prototype.getItem;
    window.__generationStorageSet=Storage.prototype.setItem;
    Storage.prototype.getItem=function(key){
      if(key==='wanbanXiaowu_theaters_v1') return null;
      return window.__generationStorageGet.call(this,key);
    };
    Storage.prototype.setItem=function(key,value){
      if(key==='wanbanXiaowu_theaters_v1') throw new DOMException('temporary theater quota failure','QuotaExceededError');
      return window.__generationStorageSet.call(this,key,value);
    };
  })()`);
  await evaluate('document.querySelector("#wb-generate-lines").click()');
  await waitFor('!!document.querySelector("#wb-single-generate-mask [data-kind=theater]")');
  await evaluate('document.querySelector("#wb-single-generate-mask [data-kind=theater]").click()');
  await waitFor('document.querySelector("#wb-generate-lines")?.textContent==="生成" && !document.querySelector("#wb-generate-lines")?.disabled');
  await evaluate(`(()=>{
    Storage.prototype.getItem=window.__generationStorageGet;
    Storage.prototype.setItem=window.__generationStorageSet;
    console.log=window.__generationConsoleLog;
  })()`);
  assert.equal(await evaluate(`localStorage.getItem('wanbanXiaowu_theaters_v1')`), theaterRawBeforeFailure, 'failed theater storage must preserve the previous saved pack');
  const generationMessages = await evaluate('window.__generationMessages');
  assert.ok(generationMessages.some(message => message.includes('生成失败') && message.includes('小剧场')), 'single theater storage failure must be reported as a failure');
  assert.ok(!generationMessages.some(message => message.includes('已生成并覆盖')), 'single theater storage failure must not report false success');

  await evaluate('document.querySelector("#wb-generate-lines").click()');
  await waitFor('!!document.querySelector("#wb-single-generate-mask [data-kind=theater]")');
  await evaluate('document.querySelector("#wb-single-generate-mask [data-kind=theater]").click()');
  await sleep(100);
  await waitFor('document.querySelector("#wb-generate-lines")?.textContent==="生成" && !document.querySelector("#wb-generate-lines")?.disabled');
  await evaluate('document.querySelector("#wb-close").click()');
  await sleep(1300);
  await evaluate('document.querySelector("#wanbanXiaowu-menu-item").click()');
  await waitFor('!!document.querySelector("[data-tab=settings]")');
  await evaluate('document.querySelector("[data-tab=settings]").click()');
  await waitFor('!!document.querySelector("#wb-line-view-box")');
  const generatedRoleLiteral = JSON.stringify(generatedContent.role);
  const restoredContent = await evaluate(`import('/src/runtime/storage.js?generated-content-restore-check').then(module=>{
    const lines=module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_roleLines_v1'));
    const theaters=module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_theaters_v1'));
    const generatedRole=${generatedRoleLiteral};
    const lineScope=generatedRole+'::shuerte';
    const theaterEntries=Object.entries(theaters).filter(([key])=>key.startsWith(generatedRole+'::shuerte::'));
    const role=document.querySelector('#wb-line-view-role');
    const game=document.querySelector('#wb-line-view-game');
    const kind=document.querySelector('#wb-line-view-kind');
    role.value=generatedRole;
    game.value='shuerte';
    kind.value='lines';
    game.dispatchEvent(new Event('change',{bubbles:true}));
    const lineText=document.querySelector('#wb-line-view-box').textContent;
    kind.value='theater';
    kind.dispatchEvent(new Event('change',{bubbles:true}));
    const theaterText=document.querySelector('#wb-line-view-box').textContent;
    return {
      lineJSON:JSON.stringify(lines[lineScope]),
      theaterJSON:JSON.stringify(Object.fromEntries(theaterEntries)),
      lineText,
      theaterText,
    };
  })`);
  assert.equal(restoredContent.lineJSON, generatedContent.lineJSON, 'generated lines must survive close and cache release');
  assert.equal(restoredContent.theaterJSON, generatedContent.theaterJSON, 'generated theaters must survive close and cache release');
  assert.ok(restoredContent.lineText && !restoredContent.lineText.includes('未生成'), 'reopened settings must load generated lines from storage');
  assert.ok(restoredContent.theaterText && !restoredContent.theaterText.includes('未生成') && !restoredContent.theaterText.includes('失败：'), 'reopened settings must load generated theaters from storage');

  await evaluate(`(()=>{
    const companion=document.querySelector('#wb-companion-toggle');
    const theme=document.querySelector('#wb-theme');
    companion.checked=false;
    theme.value='arcade';
    theme.dispatchEvent(new Event('change',{bubbles:true}));
    companion.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('[data-tab=single]').click();
  })()`);
  for (let i = 0; i < 8 && !(await evaluate('!!document.querySelector("[data-game=numberklotski]")')); i++) {
    await evaluate('document.querySelector("#wb-body").scrollTop=document.querySelector("#wb-body").scrollHeight');
    await sleep(260);
  }
  await evaluate('document.querySelector("[data-game=numberklotski]").click()');
  await waitFor('!!document.querySelector("#wb-start-cover-btn")');
  await evaluate('document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('!!document.querySelector("#wb-choice-mask [data-choice=\'6x6\']")');
  await evaluate('document.querySelector("#wb-choice-mask [data-choice=\'6x6\']").click()');
  await waitFor('document.querySelectorAll(".wb-number-klotski-tile").length===36');
  const readKlotskiGeometry = () => evaluate(`(()=>{
    const board=document.querySelector('#wb-number-klotski-board');
    const stage=document.querySelector('.wb-number-klotski-stage');
    const gamebox=document.querySelector('#wb-gamebox');
    const root=document.querySelector('.wb-number-klotski');
    const b=board.getBoundingClientRect(),s=stage.getBoundingClientRect(),g=gamebox.getBoundingClientRect(),r=root.getBoundingClientRect();
    const cells=Array.from(board.children).map(cell=>cell.getBoundingClientRect());
    const epsilon=1;
    return {
      board:{left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height},
      stage:{left:s.left,right:s.right,top:s.top,bottom:s.bottom,width:s.width,height:s.height},
      gamebox:{left:g.left,right:g.right,top:g.top,bottom:g.bottom,width:g.width,height:g.height},
      root:{left:r.left,right:r.right,width:r.width,scrollWidth:root.scrollWidth},
      inside:b.left>=s.left-epsilon&&b.right<=s.right+epsilon&&b.top>=s.top-epsilon&&b.bottom<=s.bottom+epsilon&&b.left>=g.left-epsilon&&b.right<=g.right+epsilon&&b.left>=-epsilon&&b.right<=innerWidth+epsilon,
      allCellsInside:cells.every(cell=>cell.left>=b.left-epsilon&&cell.right<=b.right+epsilon&&cell.top>=b.top-epsilon&&cell.bottom<=b.bottom+epsilon),
      square:Math.abs(b.width-b.height)<=epsilon,
      viewportWidth:innerWidth,
    };
  })()`);
  const klotski390 = await readKlotskiGeometry();
  assert.equal(klotski390.inside, true, '6x6 number klotski board must fit its mobile stage at 390px: ' + JSON.stringify(klotski390));
  assert.equal(klotski390.allCellsInside, true, 'all 6x6 number klotski cells must remain visible at 390px');
  assert.equal(klotski390.square, true, 'number klotski board must remain square at 390px');
  assert.ok(klotski390.root.scrollWidth <= klotski390.root.width + 1, 'number klotski root must not overflow horizontally at 390px');
  await client.call('Emulation.setDeviceMetricsOverride', { width:320, height:568, deviceScaleFactor:2, mobile:true });
  await sleep(180);
  const klotski320 = await readKlotskiGeometry();
  assert.equal(klotski320.inside, true, '6x6 number klotski board must fit its mobile stage at 320px: ' + JSON.stringify(klotski320));
  assert.equal(klotski320.allCellsInside, true, 'all 6x6 number klotski cells must remain visible at 320px');
  assert.equal(klotski320.square, true, 'number klotski board must remain square at 320px');
  assert.ok(klotski320.root.scrollWidth <= klotski320.root.width + 1, 'number klotski root must not overflow horizontally at 320px');
  assert.deepEqual(await evaluate('window.__errors'), []);
  console.log('PASS: mobile first open ' + openMs.toFixed(1) + 'ms; Schulte handler ' + interaction.maxHandler.toFixed(1) + 'ms; settings switch ' + settingsSwitch.toFixed(1) + 'ms (cached ' + secondSettingsSwitch.toFixed(1) + 'ms); settings scroll work ' + settingsScroll.maxWork.toFixed(1) + 'ms; home switch ' + homeSwitch.elapsed.toFixed(1) + 'ms; 6x6 klotski ' + klotski390.board.width.toFixed(1) + 'px at 390px and ' + klotski320.board.width.toFixed(1) + 'px at 320px.');
} finally {
  client?.close();
  if (browser) {
    browser.kill();
    await new Promise(resolveExit => browser.once('exit', resolveExit));
  }
  server.close();
  const target = resolve(temporaryRoot);
  const tempBase = resolve(tmpdir());
  if (target.startsWith(tempBase + sep)) await rm(target, { recursive:true, force:true, maxRetries:8, retryDelay:200 }).catch(() => {});
}
