import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = resolve(fileURLToPath(new URL('..', import.meta.url)));
const yamlBrowser = resolve(workspace, '../../../../..', 'node_modules/yaml/browser');
const chrome = process.env.WANBAN_TEST_CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!chrome) throw new Error('Set WANBAN_TEST_CHROME to a Chromium executable.');

const requests = [];
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<div id="extensionsMenu"></div>
<script>
window.__hostContext={};
window.__hostEvents={};
window.event_types={CHAT_CHANGED:'CHAT_CHANGED',CHARACTER_EDITED:'CHARACTER_EDITED',CHARACTER_UPDATED:'CHARACTER_UPDATED',CHARACTER_PAGE_LOADED:'CHARACTER_PAGE_LOADED'};
window.eventSource={on:(name,callback)=>(window.__hostEvents[name]||(window.__hostEvents[name]=[])).push(callback)};
window.SillyTavern={getContext:()=>window.__hostContext};
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
localStorage.setItem('wanbanXiaowu_settings_v1',JSON.stringify({roleKey:'role_0',charName:'角色 0',companion:true,theaterEnabled:true}));
localStorage.setItem('wanbanXiaowu_progress_v1__turkey',JSON.stringify({
  initialized:true,savedAt:Date.now(),startedAt:Date.now(),score:0,moves:0,combo:0,
  tools:{thunder:3,stardust:3,hammer:3},seen:{},details:{},
  blocks:[
    {id:'clear_left',row:9,col:0,len:4,color:'#FF7B7B'},
    {id:'clear_right',row:9,col:4,len:4,color:'#FFD66B'},
    {id:'stack_low',row:8,col:0,len:1,color:'#5FD1C8'},
    {id:'stack_high',row:7,col:0,len:1,color:'#6CA8FF'},
    {id:'stable_move',row:8,col:4,len:1,color:'#B28DFF'},
  ],
}));
localStorage.setItem('wanbanXiaowu_petLastRoute',JSON.stringify('test'));
localStorage.setItem('wanbanXiaowu_petTest_v1',JSON.stringify({journeyId:'mobile_pet_story',userName:'测试用户',testSpecies:'rabbit',testEgg:'green',testPetName:'团团',stage:'egg',route:'common',growth:0,fullness:80,happiness:80,location:'home',pendingStories:['M01'],completedMain:[],completedSide:[],storyRecords:[],logs:{},days:{},sideCounts:{},sideTriggered:[],dismissedStories:[],activeStory:null}));
const fullPetInfo=['<pet_info>','pet_card:','  pet_name: 测试兔','  egg: green','  species: rabbit','  sex: female','main_story:','  - id: M01','    title: 初见','    story: "[旁白] 小屋里的测试剧情。"','side_story: []','quotes:','  char: {}','  pet: {}','</pet_info>'].join('\\n');
const formalState=(growth,name)=>({userName:'测试用户',testPetName:name,stage:'egg',route:'common',growth,fullness:80,happiness:80,location:'home',completedMain:['M01'],completedSide:[],storyRecords:[],logs:{},days:{},sideCounts:{},sideTriggered:[],pendingStories:[],dismissedStories:[],activeStory:null,eggInteractions:0,lastEggPetGrowthAt:0});
localStorage.setItem('wanbanXiaowu_petFull_v1',JSON.stringify({activeCaretakerId:'caretaker_a',caretakers:[
  {id:'caretaker_a',name:'饲养员甲',activePetId:'pet_a',pets:[{id:'pet_a',infoText:fullPetInfo,state:formalState(1,'甲兔'),stateSavedAt:0}]},
  {id:'caretaker_b',name:'饲养员乙',activePetId:'pet_b',pets:[{id:'pet_b',infoText:fullPetInfo,state:formalState(2,'乙兔'),stateSavedAt:0}]},
]}));
localStorage.setItem('wanbanXiaowu_petState_v1__'+encodeURIComponent('full_caretaker_a_pet_a'),JSON.stringify({savedAt:Date.now(),state:formalState(10,'甲兔')}));
localStorage.setItem('wanbanXiaowu_petState_v1__'+encodeURIComponent('full_caretaker_b_pet_b'),JSON.stringify({savedAt:Date.now(),state:formalState(20,'乙兔')}));
localStorage.setItem('wanbanXiaowu_worldPresets_v1',JSON.stringify(roles));
localStorage.setItem('wanbanXiaowu_roleContexts_v2',JSON.stringify(Object.fromEntries(roles.map(role=>[role.roleKey,role]))));
localStorage.setItem('wanbanXiaowu_summaries_v1',JSON.stringify(Array.from({length:32},(_,index)=>({id:'summary_'+index,name:'总结 '+index,content:longText}))));
localStorage.setItem('wanbanXiaowu_apiPresets_v1',JSON.stringify(Array.from({length:32},(_,index)=>({name:'API '+index,apiUrl:'https://example.test/v1',apiModel:'model-'+index}))));
window.__storageReads={};
const nativeStorageGet=Storage.prototype.getItem;
Storage.prototype.getItem=function(key){__storageReads[key]=(__storageReads[key]||0)+1;return nativeStorageGet.call(this,key)};
window.__storageWrites=[];
const nativeStorageSet=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){__storageWrites.push({key,time:performance.now()});return nativeStorageSet.call(this,key,value)};
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
      response.end("import yaml from '/yaml/index.js';export {yaml};");
      return;
    }
    if (pathname === '/api/worldinfo/get') {
      let body = '';
      for await (const chunk of request) body += chunk;
      const name = JSON.parse(body || '{}').name || '测试世界书';
      response.setHeader('Content-Type', 'application/json;charset=utf-8');
      response.end(JSON.stringify({ entries:[
        { uid:name + '-blue', comment:'蓝灯条目', content:name + '蓝灯内容', constant:true },
        { uid:name + '-green', comment:'绿灯条目', content:name + '绿灯内容' },
        { uid:name + '-chain', comment:'链式条目', content:name + '链式内容', vectorized:true },
      ] }));
      return;
    }
    if (pathname.startsWith('/yaml/')) {
      const yamlPath = resolve(yamlBrowser, '.' + pathname.slice('/yaml'.length));
      if (!yamlPath.startsWith(yamlBrowser + sep)) throw new Error('Invalid YAML module path');
      response.setHeader('Content-Type', 'text/javascript');
      response.end(await readFile(yamlPath));
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
const smokeReturnMetrics = [];
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
  const details = await evaluate(`(()=>({errors:window.__errors||[],gamebox:document.querySelector('#wb-gamebox')?.innerText||'',modals:Array.from(document.querySelectorAll('.wb-modal-mask')).map(mask=>mask.id)}))()`);
  throw new Error('Timed out: ' + expression + ' ' + JSON.stringify(details));
}
async function openListedGame(game, tab = 'single') {
  await waitFor('!!document.querySelector(".wb-cardgrid")');
  if (await evaluate(`!!document.querySelector('[data-tab="${tab}"]')`)) {
    await evaluate(`document.querySelector('[data-tab="${tab}"]').click()`);
    await waitFor('!!document.querySelector(".wb-cardgrid")');
  }
  for (let i = 0; i < 12 && !(await evaluate(`!!document.querySelector('[data-game="${game}"]')`)); i++) {
    await evaluate('document.querySelector("#wb-body").scrollTop=document.querySelector("#wb-body").scrollHeight');
    await sleep(260);
  }
  assert.ok(await evaluate(`!!document.querySelector('[data-game="${game}"]')`), game + ' card was not rendered');
  await evaluate(`document.querySelector('[data-game="${game}"]').click()`);
  const autoStarted = game === 'linklink' ? '#ll-board' : (game === 'blackjack' ? '.wb-bj' : '');
  await waitFor('!!document.querySelector("#wb-start-cover-btn")' + (autoStarted ? ` || !!document.querySelector(${JSON.stringify(autoStarted)})` : ''));
}
async function smokeStartListedGame(game, tab, selector) {
  if (!(await evaluate('!!document.querySelector(".wb-cardgrid")'))) {
    await evaluate('document.querySelector("#wb-back")?.click()');
  }
  await openListedGame(game, tab);
  await evaluate('window.__errors.length=0;document.querySelector("#wb-start-cover-btn")?.click()');
  for (let i = 0; i < 160 && !(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)); i++) {
    const action = await evaluate(`(()=>{
      const progress=document.querySelector('#wb-progress-new');
      if(progress){ progress.click(); return 'progress'; }
      const choice=document.querySelector('#wb-choice-mask [data-choice]');
      if(choice){ choice.click(); return 'choice'; }
      const first=document.querySelector('#wb-first-mask [data-first="user"]');
      if(first){ first.click(); return 'first'; }
      const cover=document.querySelector('#wb-start-cover-btn');
      if(cover&&cover.offsetParent!==null&&!cover.disabled){ cover.click(); return 'cover'; }
      return '';
    })()`);
    await sleep(action ? 70 : 30);
  }
  assert.ok(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), game + ' did not start');
  if (game === 'linklink') {
    const linkInteraction = await evaluate(`(async()=>{
      const board=document.querySelector('#ll-board');
      const tiles=Array.from(board.querySelectorAll('.wb-link-tile'));
      const tile=tiles.find(item=>!item.classList.contains('empty')&&!item.classList.contains('stone'));
      const started=performance.now();
      tile.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',isPrimary:true}));
      const handler=performance.now()-started;
      await new Promise(requestAnimationFrame);
      return {handler,selected:tile.classList.contains('sel'),stable:tiles.every((item,index)=>item===board.querySelectorAll('.wb-link-tile')[index])};
    })()`);
    assert.equal(linkInteraction.selected, true, 'link-link tap must select the tile');
    assert.equal(linkInteraction.stable, true, 'link-link selection must reuse every tile node');
    assert.ok(linkInteraction.handler < 30, 'link-link selection handler took ' + linkInteraction.handler.toFixed(1) + 'ms');
  }
  const errors = await evaluate('window.__errors.slice()');
  assert.deepEqual(errors, [], game + ' startup errors: ' + JSON.stringify(errors));
  const returnMetric = await evaluate(`(async()=>{
    window.__storageWrites.length=0;
    const longTasks=[];
    const longObserver=globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')
      ? new PerformanceObserver(list=>list.getEntries().forEach(entry=>longTasks.push({start:entry.startTime,duration:entry.duration})))
      : null;
    longObserver?.observe({type:'longtask',buffered:false});
    const back=document.querySelector('#wb-back');
    back.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',isPrimary:true}));
    await new Promise(requestAnimationFrame);
    const started=performance.now();
    back.click();
    const handler=performance.now()-started;
    const body=document.querySelector('#wb-body');
    const cards=document.querySelectorAll('.wb-game-card').length;
    const expected=Number(document.querySelector('[data-tab="${tab}"] .wb-tab-count')?.textContent||0);
    const readyStarted=performance.now();
    await new Promise(requestAnimationFrame);
    const readyFrame=performance.now()-readyStarted;
    const frames=[],work=[];
    for(let step=1;step<=12;step++){
      const frameStarted=performance.now();
      body.scrollTop=Math.max(0,body.scrollHeight-body.clientHeight)*step/12;
      body.dispatchEvent(new Event('scroll'));
      work.push(performance.now()-frameStarted);
      await new Promise(requestAnimationFrame);
      frames.push(performance.now()-frameStarted);
    }
    await new Promise(resolve=>setTimeout(resolve,0));
    longObserver?.disconnect();
    return {
      handler,cards,expected,readyFrame,frames,work,maxFrame:Math.max(...frames),maxWork:Math.max(...work),longTasks,
      writes:window.__storageWrites.filter(item=>item.key.startsWith('wanbanXiaowu_progress_v1')||item.key.startsWith('wanbanXiaowu_records_v1')).length,
    };
  })()`);
  assert.equal(returnMetric.cards, returnMetric.expected, game + ' return did not render the complete ' + tab + ' list');
  assert.equal(returnMetric.writes, 0, game + ' return storage writes competed with the first scroll frames');
  assert.ok(returnMetric.handler < 80, game + ' return handler took ' + returnMetric.handler.toFixed(1) + 'ms');
  assert.ok(returnMetric.readyFrame < 200, game + ' return list first paint took ' + returnMetric.readyFrame.toFixed(1) + 'ms');
  assert.ok(returnMetric.maxWork < 30, game + ' return scroll handler took ' + returnMetric.maxWork.toFixed(1) + 'ms');
  assert.ok(Math.max(0,...returnMetric.longTasks.map(task=>task.duration)) < 80, game + ' return produced a long task: ' + JSON.stringify(returnMetric.longTasks));
  assert.ok(returnMetric.maxFrame < 160, game + ' return scroll frames took ' + returnMetric.frames.map(value=>value.toFixed(1)).join('/') + 'ms');
  smokeReturnMetrics.push({ game, ...returnMetric });
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

  assert.ok(requests.some(path => path.includes('wanban-app.js')), 'the main runtime should warm before the first house open');
  assert.ok(requests.includes('/style.css'), 'the stylesheet should warm before the first house open');
  for (const modulePath of ['/src/games/zuma.js', '/src/games/water-sort.js', '/src/games/flappy-bird.js']) {
    assert.ok(requests.some(path => path.includes(modulePath)), modulePath + ' should be preloaded');
  }

  await evaluate(`(()=>{window.__openStarted=performance.now();const item=document.querySelector('#wanbanXiaowu-menu-item');item.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',isPrimary:true}));item.click()})()`);
  await waitFor('performance.getEntriesByType("resource").some(entry=>entry.name.includes("wanban-app.js"))');
  await waitFor('!!document.querySelector("#wanbanXiaowu-popup")');
  const openMs = await evaluate('performance.now()-window.__openStarted');
  assert.ok(openMs < 250, 'opening the prewarmed house took ' + openMs.toFixed(1) + 'ms');
  assert.equal(await evaluate('window.__activeIntervals.size'), 0, 'disabled notifications and pets must not leave a polling timer');
  const singleCardCount = await evaluate('document.querySelectorAll(".wb-game-card").length');
  assert.ok(singleCardCount >= 20, 'the first frame should contain the complete single-player game list');
  assert.equal(await evaluate('document.querySelector(".wb-cardgrid")?.innerText.includes("读取中")'), false, 'scores must render without waiting for the delayed idle callback');
  await sleep(300);
  const iconState = await evaluate(`(()=>({total:document.querySelectorAll('.wb-game-card').length,loaded:Array.from(document.querySelectorAll('.wb-game-card')).filter(card=>card.querySelector('.wb-game-icon.has-image img')).length}))()`);
  assert.equal(iconState.loaded, iconState.total, 'game icons did not load eagerly: ' + JSON.stringify(iconState));
  const tabSwitches = await evaluate(`(()=>{
    const measure=tab=>{const started=performance.now();document.querySelector('[data-tab='+tab+']').click();return performance.now()-started};
    return {double:measure('double'),intimacy:measure('intimacy'),single:measure('single'),cards:document.querySelectorAll('.wb-game-card').length};
  })()`);
  assert.ok(tabSwitches.double < 60, 'double-player tab took ' + tabSwitches.double.toFixed(1) + 'ms');
  assert.ok(tabSwitches.intimacy < 60, 'intimacy tab took ' + tabSwitches.intimacy.toFixed(1) + 'ms');
  assert.ok(tabSwitches.single < 60 && tabSwitches.cards >= 20, 'single-player tab took ' + tabSwitches.single.toFixed(1) + 'ms');
  for (const heavy of ['/src/heart-challenge/']) {
    assert.ok(!requests.some(path => path.includes(heavy)), heavy + ' loaded before its feature was opened');
  }
  assert.ok(await evaluate('!!document.querySelector("[data-game=shuerte]")'), 'the Schulte grid card should exist immediately');
  await evaluate('document.querySelector("[data-game=shuerte]").scrollIntoView({block:"center"})');
  await waitFor('document.querySelector("[data-game=shuerte] .wb-game-icon")?.classList.contains("has-image")');
  const gameEntryMs = await evaluate(`(()=>{const started=performance.now();document.querySelector('[data-game=shuerte]').click();return performance.now()-started})()`);
  assert.ok(gameEntryMs < 30, 'opening a game shell took ' + gameEntryMs.toFixed(1) + 'ms');
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
  const progressAutoSaveMs = await evaluate(`(async()=>{
    const module=await import('/src/runtime/storage.js?progress-autosave-check');
    const started=performance.now();
    while(performance.now()-started<1000){
      const raw=localStorage.getItem('wanbanXiaowu_progress_v1__shuerte');
      if(raw&&module.decodeStoredJSON(raw)?.next===9) return performance.now()-started;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    return performance.now()-started;
  })()`);
  assert.ok(progressAutoSaveMs < 700, 'single-game progress save took ' + progressAutoSaveMs.toFixed(1) + 'ms');
  await evaluate('document.querySelector("#wb-pause").click()');
  await waitFor('!!document.querySelector("#wb-pause-overlay")');
  await waitFor(`!!localStorage.getItem('wanbanXiaowu_progress_v1__shuerte') || !!localStorage.getItem('wanbanXiaowu_progress_v1')`);
  assert.equal(await evaluate(`import('/src/runtime/storage.js?progress-check').then(module=>{
    const shard=localStorage.getItem('wanbanXiaowu_progress_v1__shuerte');
    const aggregate=localStorage.getItem('wanbanXiaowu_progress_v1');
    return shard?module.decodeStoredJSON(shard).next:module.decodeStoredJSON(aggregate).shuerte.next;
  })`), 9, 'debounced Schulte progress must persist');
  await evaluate(`(()=>{
    window.__settingsLongTasks=[];
    if(!globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')) return;
    window.__settingsLongObserver=new PerformanceObserver(list=>list.getEntries().forEach(entry=>__settingsLongTasks.push(entry.duration)));
    window.__settingsLongObserver.observe({type:'longtask',buffered:false});
  })()`);
  const settingsSwitch = await evaluate(`(()=>{
    window.__stableHeader=document.querySelector('.wb-head');
    const nativeSet=Storage.prototype.setItem;
    let syncWrites=0;
    Storage.prototype.setItem=function(...args){
      syncWrites++;
      const blockedUntil=performance.now()+12;
      while(performance.now()<blockedUntil){}
      return nativeSet.apply(this,args);
    };
    const started=performance.now();
    try { document.querySelector('[data-tab=settings]').click(); }
    finally { Storage.prototype.setItem=nativeSet; }
    return {elapsed:performance.now()-started,syncWrites};
  })()`);
  assert.equal(await evaluate('document.querySelectorAll(".wb-settings-grid > .wb-panel").length'), 6, 'settings should render every panel');
  assert.equal(settingsSwitch.syncWrites, 0, 'settings switch performed synchronous storage writes');
  assert.ok(settingsSwitch.elapsed < 100, 'settings switch took ' + settingsSwitch.elapsed.toFixed(1) + 'ms');
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
    const nativeSet=Storage.prototype.setItem;
    let syncWrites=0;
    Storage.prototype.setItem=function(...args){ syncWrites++; return nativeSet.apply(this,args); };
    const started=performance.now();
    try { document.querySelector('[data-tab=single]').click(); }
    finally { Storage.prototype.setItem=nativeSet; }
    return {elapsed:performance.now()-started,syncWrites,stableHeader:window.__stableHeader===document.querySelector('.wb-head')};
  })()`);
  assert.equal(homeSwitch.stableHeader, true, 'tab switches should preserve the popup header');
  assert.equal(homeSwitch.syncWrites, 0, 'home switch performed synchronous storage writes');
  assert.ok(await evaluate('document.querySelectorAll(".wb-game-card").length') >= 5, 'returning home should render the visible mobile card batch immediately');
  await waitFor('Array.from(document.querySelectorAll(".wb-game-card")).slice(0,5).every(card=>card.querySelector(".wb-game-icon.has-image img"))');
  assert.ok(homeSwitch.elapsed < 60, 'home switch took ' + homeSwitch.elapsed.toFixed(1) + 'ms');
  const secondSettingsSwitch = await evaluate(`(()=>{
    const started=performance.now();
    document.querySelector('[data-tab=settings]').click();
    return performance.now()-started;
  })()`);
  assert.ok(secondSettingsSwitch < 60, 'cached settings switch took ' + secondSettingsSwitch.toFixed(1) + 'ms');
  const transientStorageRetry = await evaluate(`(async()=>{
    const messages=[];
    const previousLog=console.log;
    const previousSet=Storage.prototype.setItem;
    let failedOnce=false;
    console.log=(...args)=>{
      const message=args.map(String).join(' ');
      if(message.includes('数据暂未保存')||message.includes('保存失败：浏览器存储')) messages.push(message);
      previousLog(...args);
    };
    Storage.prototype.setItem=function(key,value){
      if(key==='wanbanXiaowu_settings_v1'&&!failedOnce){
        failedOnce=true;
        throw new DOMException('one temporary storage failure','QuotaExceededError');
      }
      return previousSet.call(this,key,value);
    };
    try {
      const select=document.querySelector('#wb-theme');
      const target=select.value==='day'?'arcade':'day';
      select.value=target;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,1100));
      const module=await import('/src/runtime/storage.js?transient-storage-retry');
      return {failedOnce,messages,target,saved:module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_settings_v1')).theme};
    } finally {
      Storage.prototype.setItem=previousSet;
      console.log=previousLog;
    }
  })()`);
  assert.equal(transientStorageRetry.failedOnce, true, 'transient storage test did not inject a failure');
  assert.equal(transientStorageRetry.saved, transientStorageRetry.target, 'a transient settings write did not recover automatically');
  assert.deepEqual(transientStorageRetry.messages, [], 'a recovered storage write showed a false backup warning');
  const readCounts = await evaluate(`Object.fromEntries(['wanbanXiaowu_apiPresets_v1','wanbanXiaowu_worldPresets_v1','wanbanXiaowu_summaries_v1','wanbanXiaowu_roleContexts_v2'].map(key=>[key,__storageReads[key]||0]))`);
  Object.entries(readCounts).forEach(([key,count]) => assert.ok(count <= 1, key + ' was decoded ' + count + ' times'));
  await evaluate(`(()=>{
    window.__hostCharacter={avatar:'current-role.png',data:{
      name:'当前角色',description:'初始角色卡描述',personality:'沉稳可靠',scenario:'移动端测试场景',
      extensions:{world:'角色绑定世界书'},
      character_book:{entries:{
        blue:{uid:'inline-blue',comment:'内嵌蓝灯',content:'角色内嵌蓝灯内容',constant:true},
        green:{uid:'inline-green',comment:'内嵌绿灯',content:'角色内嵌绿灯内容'},
        chain:{uid:'inline-chain',comment:'内嵌链式',content:'角色内嵌链式内容',vectorized:true}
      }}
    }};
    window.__hostContext={characterId:'card-current',characters:[window.__hostCharacter],currentCharacter:window.__hostCharacter,name2:'当前角色',chatMetadata:{world_info:'聊天挂载世界书'}};
    document.querySelector('#wb-reset-current-world-default').click();
    document.querySelector('#wb-confirm-ok').click();
  })()`);
  await waitFor(`document.querySelector('#wb-char-desc-preview')?.textContent.includes('初始角色卡描述')`);
  const restoredRole = await evaluate(`import('/src/runtime/storage.js?role-default-check').then(module=>{
    const saved=module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_settings_v1'));
    return {name:saved.charName,cardId:saved.cardId,description:saved.charDescriptionSnapshot,snapshotName:saved.characterCardSnapshot?.name};
  })`);
  assert.equal(restoredRole.name, '当前角色', 'restoring defaults did not bind the open character name');
  assert.equal(restoredRole.cardId, 'avatar:current-role.png', 'restoring defaults did not bind the open character card');
  assert.equal(restoredRole.snapshotName, '当前角色', 'restoring defaults did not save the open character card snapshot');
  assert.ok(restoredRole.description.includes('初始角色卡描述'), 'restoring defaults did not read the character description');
  await evaluate(`(()=>{
    window.__hostCharacter.data.description='编辑后的角色卡描述';
    (window.__hostEvents.CHARACTER_UPDATED||[]).forEach(callback=>callback());
  })()`);
  await waitFor(`document.querySelector('#wb-char-desc-preview')?.textContent.includes('编辑后的角色卡描述')`);
  await evaluate(`(()=>{
    const lazy=document.querySelector('#wb-lazy-world-inject');
    lazy.checked=true;
    lazy.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await sleep(1000);
  const lazyWorld = await evaluate(`import('/src/runtime/storage.js?lazy-world-check').then(module=>{
    const saved=module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_settings_v1'));
    const visible=Array.from(document.querySelectorAll('#wb-worldbook-list .wb-tag.active')).map(tag=>tag.wbWorldEntry?.content||'');
    return {lazy:saved.lazyWorldInject,mode:saved.worldAutoMountMode,count:saved.selectedWorldEntries?.length||0,visible,names:document.querySelector('#wb-mounted-worldbook-names')?.textContent||'',preview:document.querySelector('#wb-char-desc-preview')?.textContent||'',list:document.querySelector('#wb-worldbook-list')?.innerText||'',checked:document.querySelector('#wb-lazy-world-inject')?.checked||false};
  })`);
  assert.equal(lazyWorld.lazy, true, 'lazy mode was not persisted');
  assert.equal(lazyWorld.mode, 'bluegreen', 'lazy mode did not enable blue and green worldbook mounting');
  assert.equal(lazyWorld.count, 6, 'lazy mode did not save every selected character and chat worldbook entry: ' + JSON.stringify(lazyWorld));
  assert.ok(lazyWorld.names.includes('角色绑定世界书') && lazyWorld.names.includes('聊天挂载世界书'), 'mounted character or chat worldbook names were missing');
  for (const content of ['角色绑定世界书蓝灯内容','角色绑定世界书绿灯内容','聊天挂载世界书蓝灯内容','聊天挂载世界书绿灯内容','角色内嵌蓝灯内容','角色内嵌绿灯内容']) assert.ok(lazyWorld.visible.includes(content), content);
  assert.equal(lazyWorld.visible.some(content=>content.includes('链式内容')), false, 'lazy mode must exclude chain/vector worldbook entries');
  assert.ok(lazyWorld.preview.includes('编辑后的角色卡描述'), 'lazy mode lost the latest character card description');
  assert.ok(requests.filter(path=>path==='/api/worldinfo/get').length >= 2, 'lazy mode did not request character and chat worldbooks');
  await evaluate(`document.querySelector('#wb-save-current-avatar').click()`);
  await waitFor(`import('/src/runtime/storage.js?current-avatar-wait').then(module=>module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_settings_v1')).avatarUrl==='/thumbnail?type=avatar&file=current-role.png')`);
  const savedAvatar = await evaluate(`import('/src/runtime/storage.js?current-avatar-check').then(module=>module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_settings_v1')).avatarUrl)`);
  assert.equal(savedAvatar, '/thumbnail?type=avatar&file=current-role.png', 'save avatar did not use the currently open character card');
  await evaluate(`(()=>{
    const content='应忱大型内嵌世界书正文。'.repeat(1800);
    const entries=Array.from({length:48},(_,index)=>({uid:'yingchen-'+index,comment:'应忱条目 '+index,content:content+'#'+index,constant:index%2===0}));
    window.__largeWorldExpectedLength=entries.reduce((sum,entry)=>sum+entry.content.length,0);
    window.__hostCharacter={avatar:'yingchen.png',data:{
      name:'应忱',description:'应忱角色描述',personality:'冷静细致',scenario:'大型角色卡性能回归',
      first_mes:'初次见面。',system_prompt:'保持角色设定。',alternate_greetings:['欢迎回来。'],
      extensions:{depth_prompt:{prompt:'应忱深度提示词',depth:4,role:'system'},unrelatedLargeField:{ignored:true}},
      character_book:{name:'应忱内嵌世界书',entries}
    }};
    window.__hostContext={characterId:'yingchen-card',characters:[window.__hostCharacter],currentCharacter:window.__hostCharacter,name2:'应忱',chatMetadata:{}};
    (window.__hostEvents.CHAT_CHANGED||[]).forEach(callback=>callback());
    document.querySelector('#wb-reset-current-world-default').click();
    document.querySelector('#wb-confirm-ok').click();
  })()`);
  await waitFor(`document.querySelector('#wb-char-desc-preview')?.textContent.includes('应忱角色描述')`);
  const largeExpand = await evaluate(`(()=>{
    const button=document.querySelector('#wb-injection-details-toggle');
    const started=performance.now();
    button.click();
    return {elapsed:performance.now()-started,display:document.querySelector('#wb-injection-details').style.display};
  })()`);
  assert.equal(largeExpand.display, 'grid', 'large character details did not expand');
  assert.ok(largeExpand.elapsed < 30, 'large character details toggle took ' + largeExpand.elapsed.toFixed(1) + 'ms');
  const largeImportStart = await evaluate(`(()=>{
    const lazy=document.querySelector('#wb-lazy-world-inject');
    const original=lazy.onchange;
    lazy.onchange=async event=>{ await original.call(lazy,event); window.__largeImportFinished=true; };
    const nativeSet=Storage.prototype.setItem;
    let syncWrites=0;
    Storage.prototype.setItem=function(...args){ syncWrites++; return nativeSet.apply(this,args); };
    lazy.checked=true;
    const started=performance.now();
    try { lazy.dispatchEvent(new Event('change',{bubbles:true})); }
    finally { Storage.prototype.setItem=nativeSet; }
    const handler=performance.now()-started;
    const toggle=document.querySelector('#wb-injection-details-toggle');
    const toggleStarted=performance.now();
    toggle.click();
    toggle.click();
    return {handler,syncWrites,toggle:performance.now()-toggleStarted,display:document.querySelector('#wb-injection-details').style.display};
  })()`);
  assert.equal(largeImportStart.syncWrites, 0, 'large automatic import wrote storage in its click handler');
  assert.ok(largeImportStart.handler < 30, 'large automatic import handler took ' + largeImportStart.handler.toFixed(1) + 'ms');
  assert.ok(largeImportStart.toggle < 30, 'details toggle stalled during large automatic import: ' + largeImportStart.toggle.toFixed(1) + 'ms');
  assert.equal(largeImportStart.display, 'grid', 'details toggle stopped responding during automatic import');
  await waitFor('window.__largeImportFinished===true');
  assert.ok(await evaluate(`document.querySelectorAll('#wb-worldbook-list .wb-tag.active').length`) >= 48, 'large inline worldbook entries were not all selected');
  const largePreview = await evaluate(`document.querySelector('#wb-char-desc-preview').textContent`);
  assert.ok(largePreview.includes('应忱角色描述') && largePreview.includes('冷静细致') && largePreview.includes('应忱深度提示词'), 'large character import lost required role fields');
  assert.equal(largePreview.includes('character_book:'), false, 'character preview still contains the full embedded worldbook JSON');
  const largeCloseMs = await evaluate(`(()=>{const started=performance.now();document.querySelector('#wb-close').click();return performance.now()-started;})()`);
  assert.equal(await evaluate('document.querySelector("#wanbanXiaowu-shell").classList.contains("wb-shell-visible")'), false, 'large import close did not hide the popup immediately');
  assert.ok(largeCloseMs < 30, 'large import close handler took ' + largeCloseMs.toFixed(1) + 'ms');
  await waitFor('document.querySelector("#wb-body").childElementCount===0');
  await evaluate(`window.dispatchEvent(new Event('pagehide'))`);
  const largeSaved = await evaluate(`import('/src/runtime/storage.js?large-role-save-check').then(module=>{
    const settings=module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_settings_v1'));
    const roles=module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_roleContexts_v2'));
    const role=roles[settings.roleKey];
    const inline=(settings.selectedWorldEntries||[]).filter(entry=>entry.wbName==='角色内嵌');
    const roleInline=(role?.selectedWorldEntries||[]).filter(entry=>entry.wbName==='角色内嵌');
    return {
      name:settings.charName,
      settingsCount:inline.length,
      settingsLength:inline.reduce((sum,entry)=>sum+(entry.content||'').length,0),
      roleCount:roleInline.length,
      hasEmbeddedBook:Object.prototype.hasOwnProperty.call(settings.characterCardSnapshot||{},'character_book'),
      extensionKeys:Object.keys(settings.characterCardSnapshot?.extensions||{}),
      description:settings.charDescriptionSnapshot||''
    };
  })`);
  assert.equal(largeSaved.name, '应忱', 'large character import saved the wrong role');
  assert.equal(largeSaved.settingsCount, 48, 'large worldbook was incomplete in active settings');
  assert.equal(largeSaved.roleCount, 48, 'large worldbook was incomplete in the role context');
  assert.equal(largeSaved.settingsLength, await evaluate('window.__largeWorldExpectedLength'), 'large worldbook content was truncated');
  assert.equal(largeSaved.hasEmbeddedBook, false, 'the compact role snapshot duplicated the embedded worldbook');
  assert.deepEqual(largeSaved.extensionKeys, ['depth_prompt'], 'the compact role snapshot retained unrelated extension data');
  assert.equal(largeSaved.description.includes('character_book:'), false, 'the saved role description duplicated the embedded worldbook');
  await evaluate(`document.querySelector('#wanbanXiaowu-menu-item').click()`);
  await waitFor('document.querySelector("#wanbanXiaowu-shell").classList.contains("wb-shell-visible")');
  if (!(await evaluate(`!!document.querySelector('#wb-break-limit-prompt')`))) {
    await evaluate(`document.querySelector('[data-tab=settings]').click()`);
    await waitFor('!!document.querySelector("#wb-break-limit-prompt")');
  }
  const backdropCloseMs = await evaluate(`(()=>{
    const input=document.querySelector('#wb-break-limit-prompt');
    input.value='遮罩关闭保存验证';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    const started=performance.now();
    document.querySelector('#wanbanXiaowu-shell').click();
    return performance.now()-started;
  })()`);
  assert.equal(await evaluate('document.querySelector("#wanbanXiaowu-shell").classList.contains("wb-shell-visible")'), false, 'closing must hide the popup shell');
  assert.ok(backdropCloseMs < 30, 'backdrop close handler took ' + backdropCloseMs.toFixed(1) + 'ms');
  await waitFor('document.querySelector("#wb-body").childElementCount===0');
  assert.equal(await evaluate('document.querySelector("#wb-body").childElementCount'), 0, 'closing must release the heavy popup body');
  await waitFor(`import('/src/runtime/storage.js?settings-close-wait').then(module=>module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_settings_v1')).breakLimitPrompt==='遮罩关闭保存验证')`);
  assert.equal(await evaluate(`import('/src/runtime/storage.js?settings-close-check').then(module=>module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_settings_v1')).breakLimitPrompt)`), '遮罩关闭保存验证', 'backdrop close must flush debounced settings');
  await sleep(1300);
  const releasedReadCounts = await evaluate(`Object.fromEntries(['wanbanXiaowu_apiPresets_v1','wanbanXiaowu_worldPresets_v1','wanbanXiaowu_summaries_v1','wanbanXiaowu_roleContexts_v2'].map(key=>[key,__storageReads[key]||0]))`);
  const reopenedList = await evaluate(`(async()=>{
    const started=performance.now();
    document.querySelector('#wanbanXiaowu-menu-item').click();
    const handler=performance.now()-started;
    for(let frame=0;frame<12;frame++){
      const cards=Array.from(document.querySelectorAll('.wb-game-card'));
      if(cards.length>=5&&cards.slice(0,5).every(card=>card.querySelector('.wb-game-icon.has-image img'))) break;
      await new Promise(requestAnimationFrame);
    }
    return {handler,ready:performance.now()-started,cards:document.querySelectorAll('.wb-game-card').length,icons:Array.from(document.querySelectorAll('.wb-game-card')).slice(0,5).filter(card=>card.querySelector('.wb-game-icon.has-image img')).length};
  })()`);
  assert.ok(reopenedList.cards >= 5, 'reopening should restore the visible card batch immediately');
  assert.equal(reopenedList.icons, 5, 'reopening should reuse all decoded visible icons');
  assert.ok(reopenedList.handler < 60, 'reopen handler took ' + reopenedList.handler.toFixed(1) + 'ms');
  assert.ok(reopenedList.ready < 150, 'reopened list and icons took ' + reopenedList.ready.toFixed(1) + 'ms');
  await waitFor('document.querySelectorAll(".wb-game-card").length>=5');
  await evaluate('document.querySelector("[data-tab=settings]").click()');
  await waitFor('document.querySelectorAll(".wb-settings-grid > .wb-panel").length===6');
  const reopenedReadCounts = await evaluate(`Object.fromEntries(['wanbanXiaowu_apiPresets_v1','wanbanXiaowu_worldPresets_v1','wanbanXiaowu_summaries_v1','wanbanXiaowu_roleContexts_v2'].map(key=>[key,__storageReads[key]||0]))`);
  Object.entries(reopenedReadCounts).forEach(([key,count]) => assert.equal(count, releasedReadCounts[key] || 0, key + ' was decoded again after reopening: ' + count));
  await evaluate('document.querySelector("[data-tab=single]").click()');
  for (let i = 0; i < 8 && !(await evaluate('!!document.querySelector("[data-game=shuerte]")')); i++) {
    await evaluate('document.querySelector("#wb-body").scrollTop=document.querySelector("#wb-body").scrollHeight');
    await sleep(260);
  }
  const progressPromptMs = await evaluate(`(async()=>{
    const started=performance.now();
    document.querySelector('[data-game=shuerte]').click();
    while(!document.querySelector('#wb-progress-continue')&&performance.now()-started<200){ await new Promise(requestAnimationFrame); }
    return performance.now()-started;
  })()`);
  assert.ok(progressPromptMs < 80, 'saved progress prompt waited ' + progressPromptMs.toFixed(1) + 'ms');
  assert.ok(await evaluate('!!document.querySelector("#wb-progress-continue")'), 'saved progress prompt must appear without an idle callback');
  await evaluate(`(()=>{
    window.__continueStarted=performance.now();
    window.__continueDigits=[];
    document.querySelector('#wb-progress-continue').click();
    const number=document.querySelector('#wb-progress-count');
    if(number){
      window.__continueDigits.push(number.textContent);
      window.__continueDigitObserver=new MutationObserver(()=>{
        const value=number.textContent;
        if(window.__continueDigits.at(-1)!==value) window.__continueDigits.push(value);
      });
      window.__continueDigitObserver.observe(number,{childList:true,characterData:true,subtree:true});
    }
  })()`);
  await waitFor('document.querySelector("#wb-shuerte-target")?.textContent==="目标：9"');
  const continueResumeMs = await evaluate('performance.now()-window.__continueStarted');
  const continueDigits = await evaluate('window.__continueDigitObserver?.disconnect();window.__continueDigits.filter(value=>/^\\d$/.test(value))');
  assert.deepEqual(continueDigits, ['3','2','1'], 'saved game countdown must display 3, 2 and 1 once in order');
  assert.ok(continueResumeMs >= 2900 && continueResumeMs < 3350, 'saved game resume countdown drifted: ' + continueResumeMs.toFixed(1) + 'ms');
  assert.equal(await evaluate('!!document.querySelector("#wb-pause-overlay")'), false, 'continued game must leave the pause state after its countdown');
  const pauseResumeMs = await evaluate(`(async()=>{
    document.querySelector('#wb-pause').click();
    await new Promise(requestAnimationFrame);
    const started=performance.now();
    document.querySelector('#wb-pause').click();
    const number=document.querySelector('#wb-resume-count');
    window.__pauseResumeDigits=number?[number.textContent]:[];
    const observer=number?new MutationObserver(()=>{
      const value=number.textContent;
      if(window.__pauseResumeDigits.at(-1)!==value) window.__pauseResumeDigits.push(value);
    }):null;
    observer?.observe(number,{childList:true,characterData:true,subtree:true});
    while((document.querySelector('#wb-resume-mask')||document.querySelector('#wb-pause-overlay'))&&performance.now()-started<3800){
      await new Promise(requestAnimationFrame);
    }
    observer?.disconnect();
    return performance.now()-started;
  })()`);
  const pauseResumeDigits = await evaluate('window.__pauseResumeDigits.filter(value=>/^\\d$/.test(value))');
  assert.deepEqual(pauseResumeDigits, ['3','2','1'], 'pause countdown must display 3, 2 and 1 once in order');
  assert.ok(pauseResumeMs >= 2900 && pauseResumeMs < 3350, 'pause resume countdown drifted: ' + pauseResumeMs.toFixed(1) + 'ms');
  await evaluate(`(()=>{
    const button=Array.from(document.querySelectorAll('.wb-shuerte-cell')).find(cell=>cell.querySelector('.wb-shuerte-number')?.textContent==='9');
    button.click();
    window.__progressStorageMessages=[];
    window.__progressConsoleLog=console.log;
    console.log=(...args)=>{
      const message=args.map(String).join(' ');
      if(message.includes('数据暂未保存')||message.includes('保存失败：浏览器存储')) window.__progressStorageMessages.push(message);
      window.__progressConsoleLog(...args);
    };
    window.__nativeStorageSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='wanbanXiaowu_progress_v1__shuerte') throw new DOMException('temporary quota failure','QuotaExceededError');
      return window.__nativeStorageSet.call(this,key,value);
    };
    document.querySelector('#wb-pause').click();
    document.querySelector('#wb-close').click();
    window.dispatchEvent(new Event('pagehide'));
  })()`);
  assert.equal(await evaluate('document.querySelector("#wanbanXiaowu-shell").classList.contains("wb-shell-visible")'), false, 'failed storage writes must still hide the popup immediately');
  await waitFor('document.querySelector("#wb-body").childElementCount===0');
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
  const recoveredProgress = await evaluate(`import('/src/runtime/storage.js?progress-check').then(module=>{
    const shard=localStorage.getItem('wanbanXiaowu_progress_v1__shuerte');
    const aggregate=localStorage.getItem('wanbanXiaowu_progress_v1');
    return shard?{source:'shard',next:module.decodeStoredJSON(shard).next}:{source:'aggregate',next:module.decodeStoredJSON(aggregate).shuerte.next};
  })`);
  assert.equal(recoveredProgress.next, 10, 'pending progress must persist after storage recovers');
  assert.ok(['shard','aggregate'].includes(recoveredProgress.source), 'recovered progress must remain readable from a supported save location');
  assert.equal(await evaluate('window.__progressStorageMessages.length'), 0, 'successful fallback storage must not show a false failure warning');
  await evaluate('console.log=window.__progressConsoleLog');
  const gameOverInteraction = await evaluate(`(async()=>{
    window.__nativeRandom=Math.random;
    Math.random=()=>0;
    const board=document.querySelector('#wb-shuerte-board');
    const handlers=[];
    for(let value=10;value<=16;value++){
      const button=Array.from(board.children).find(cell=>cell.querySelector('.wb-shuerte-number')?.textContent===String(value));
      const started=performance.now();
      button.click();
      handlers.push(performance.now()-started);
      await new Promise(requestAnimationFrame);
    }
    return {
      maxHandler:Math.max(...handlers),
      resultVisible:!!document.querySelector('#wb-gameover-mask'),
      nextDisabled:document.querySelector('#wb-next-round')?.disabled,
      closeDisabled:document.querySelector('#wb-over-close')?.disabled,
    };
  })()`);
  assert.equal(gameOverInteraction.resultVisible, true, 'game-over result must render in the completion handler');
  assert.equal(gameOverInteraction.nextDisabled, false, 'next-round must be clickable on the first result frame');
  assert.equal(gameOverInteraction.closeDisabled, false, 'game-over close must be clickable on the first result frame');
  assert.ok(gameOverInteraction.maxHandler < 30, 'game-over completion handler took ' + gameOverInteraction.maxHandler.toFixed(1) + 'ms');
  await waitFor('!!document.querySelector("#wb-text-mask")');
  const theaterCloseMs = await evaluate(`(()=>{const started=performance.now();document.querySelector('#wb-text-close').click();return performance.now()-started})()`);
  assert.ok(theaterCloseMs < 30, 'theater close handler took ' + theaterCloseMs.toFixed(1) + 'ms');
  await evaluate('Math.random=window.__nativeRandom');
  await waitFor('!!document.querySelector("#wb-generate-log:not([disabled])")');
  await evaluate('document.querySelector("#wb-generate-log").click()');
  await waitFor('document.querySelector("#wb-generate-log")?.textContent==="查看日志"');
  await waitFor(`import('/src/runtime/storage.js?record-wait').then(module=>{
    const shard=localStorage.getItem('wanbanXiaowu_records_v1__shuerte');
    const aggregate=localStorage.getItem('wanbanXiaowu_records_v1');
    return !!(shard?module.decodeStoredJSON(shard)?.[0]?.log:module.decodeStoredJSON(aggregate)?.shuerte?.[0]?.log);
  })`);
  assert.equal(await evaluate(`import('/src/runtime/storage.js?record-check').then(module=>{
    const shard=localStorage.getItem('wanbanXiaowu_records_v1__shuerte');
    const aggregate=localStorage.getItem('wanbanXiaowu_records_v1');
    return !!(shard?module.decodeStoredJSON(shard)?.[0]?.log:module.decodeStoredJSON(aggregate)?.shuerte?.[0]?.log);
  })`), true, 'generated game log must be stored with its record');
  await waitFor(`import('/src/runtime/storage.js?pet-reward-wait').then(module=>{
    const saved=module.decodeStoredJSON(localStorage.getItem('wanbanXiaowu_petState_v1__test_mobile_pet_story'))?.state;
    return Number(saved?.growth||0)>=4&&Object.values(saved?.days||{}).some(day=>Number(day?.play||0)>=1);
  })`);

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

  await evaluate('document.querySelectorAll(".wb-modal-mask").forEach(mask=>mask.remove());document.querySelector("[data-tab=intimacy]").click()');
  await waitFor('!!document.querySelector("#wb-pet-trial")');
  const petEntryMs = await evaluate(`(()=>{const started=performance.now();document.querySelector('#wb-pet-trial').click();return performance.now()-started})()`);
  assert.ok(petEntryMs < 30, 'pet house entry handler took ' + petEntryMs.toFixed(1) + 'ms');
  await sleep(300);
  assert.equal(await evaluate('!!document.querySelector("#wb-pet-room")'), true, 'pet house did not open: ' + JSON.stringify(await evaluate(`(()=>({body:document.querySelector('#wb-body')?.innerText,modals:Array.from(document.querySelectorAll('.wb-modal-mask')).map(mask=>mask.id),errors:window.__errors,pet:localStorage.getItem('wanbanXiaowu_petTest_v1')}))()`)));
  await waitFor('!!document.querySelector("#wb-pet-story-play")');
  const petStoryEntryMs = await evaluate(`(()=>{
    window.__petPatButton=document.querySelector('#wb-pet-pat');
    const started=performance.now();
    document.querySelector('#wb-pet-story-play').click();
    return performance.now()-started;
  })()`);
  assert.ok(petStoryEntryMs < 30, 'pet story entry handler took ' + petStoryEntryMs.toFixed(1) + 'ms');
  await waitFor('document.querySelector("#wb-pet-room")?.classList.contains("story-mode")');
  await evaluate(`(()=>{
    const shardKey='wanbanXiaowu_petState_v1__'+encodeURIComponent('test_mobile_pet_story');
    window.__petStorageSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key===shardKey) throw new DOMException('temporary pet quota failure','QuotaExceededError');
      return window.__petStorageSet.call(this,key,value);
    };
    window.__petPatButton.click();
    Storage.prototype.setItem=window.__petStorageSet;
  })()`);
  const petStoryTap = await evaluate(`(async()=>{
    const room=document.querySelector('#wb-pet-room');
    const scene=document.querySelector('#wb-pet-scene');
    const started=performance.now();
    document.querySelector('#wb-pet-poke').click();
    const handler=performance.now()-started;
    await new Promise(requestAnimationFrame);
    const cursorKey='wanbanXiaowu_petState_v1__'+encodeURIComponent('test_mobile_pet_story')+'__story';
    const cursor=JSON.parse(localStorage.getItem(cursorKey));
    return {
      handler,
      stableRoom:room===document.querySelector('#wb-pet-room'),
      stableScene:scene===document.querySelector('#wb-pet-scene'),
      cursor,
      shardBytes:(localStorage.getItem('wanbanXiaowu_petState_v1__'+encodeURIComponent('test_mobile_pet_story'))||'').length,
      cursorBytes:(localStorage.getItem(cursorKey)||'').length,
    };
  })()`);
  assert.ok(petStoryTap.handler < 30, 'pet story tap handler took ' + petStoryTap.handler.toFixed(1) + 'ms');
  assert.equal(petStoryTap.stableRoom, true, 'pet story taps must preserve the house DOM');
  assert.equal(petStoryTap.stableScene, true, 'pet story taps must preserve the scene DOM');
  assert.ok(petStoryTap.cursor?.activeStory && (petStoryTap.cursor.activeStory.index > 0 || petStoryTap.cursor.activeStory.page > 0 || petStoryTap.cursor.activeStory.done), 'pet story cursor did not advance');
  assert.ok(petStoryTap.cursorBytes < petStoryTap.shardBytes || petStoryTap.cursorBytes < 512, 'pet story cursor should remain a lightweight save');
  const savedPetCursor = JSON.stringify(petStoryTap.cursor.activeStory);
  await evaluate('document.querySelector("#wb-close").click()');
  await waitFor('document.querySelector("#wb-body").childElementCount===0');
  await evaluate('document.querySelector("#wanbanXiaowu-menu-item").click()');
  await waitFor('!!document.querySelector("[data-tab=intimacy]")');
  await evaluate('document.querySelector("[data-tab=intimacy]").click()');
  await waitFor('!!document.querySelector("#wb-pet-trial")');
  await evaluate('document.querySelector("#wb-pet-trial").click()');
  await waitFor('document.querySelector("#wb-pet-room")?.classList.contains("story-mode")');
  const restoredPet = await evaluate(`(()=>{
    const base='wanbanXiaowu_petState_v1__'+encodeURIComponent('test_mobile_pet_story');
    const cursor=JSON.parse(localStorage.getItem(base+'__story')||'null');
    const shard=JSON.parse(localStorage.getItem(base)||'null');
    return {
      cursor:JSON.stringify(cursor?.activeStory||shard?.state?.activeStory||null),
      eggInteractions:Number(shard?.state?.eggInteractions||0),
    };
  })()`);
  assert.equal(restoredPet.cursor, savedPetCursor, 'pet story cursor must survive close and reopen');
  assert.equal(restoredPet.eggInteractions, 1, 'a failed full pet save must survive later lightweight story cursor saves');

  await evaluate('document.querySelector("#wb-pet-caretakers").click()');
  await waitFor('!!document.querySelector("#wb-pet-caretaker-mask [data-id=caretaker_a]")');
  const caretakerASwitch = await evaluate(`(()=>{
    const aggregate=localStorage.getItem('wanbanXiaowu_petFull_v1');
    const started=performance.now();
    document.querySelector('#wb-pet-caretaker-mask [data-id=caretaker_a]').click();
    return {handler:performance.now()-started,aggregateStable:aggregate===localStorage.getItem('wanbanXiaowu_petFull_v1')};
  })()`);
  assert.ok(caretakerASwitch.handler < 30, 'caretaker switch handler took ' + caretakerASwitch.handler.toFixed(1) + 'ms');
  assert.equal(caretakerASwitch.aggregateStable, true, 'caretaker switching must not rewrite the full pet archive');
  await waitFor('document.querySelector(".wb-pet-house-name")?.textContent.includes("饲养员甲")');
  const formalPetA = await evaluate(`(()=>{
    const started=performance.now();
    document.querySelector('#wb-pet-pat').click();
    const key='wanbanXiaowu_petState_v1__'+encodeURIComponent('full_caretaker_a_pet_a');
    const state=JSON.parse(localStorage.getItem(key)).state;
    return {handler:performance.now()-started,growth:state.growth,interactions:state.eggInteractions};
  })()`);
  assert.ok(formalPetA.handler < 30, 'formal pet interaction handler took ' + formalPetA.handler.toFixed(1) + 'ms');
  assert.deepEqual({ growth:formalPetA.growth, interactions:formalPetA.interactions }, { growth:11, interactions:1 }, 'first caretaker pet shard was not updated independently');

  await evaluate('document.querySelector("#wb-pet-caretakers").click()');
  await waitFor('!!document.querySelector("#wb-pet-caretaker-mask [data-id=caretaker_b]")');
  const caretakerBSwitch = await evaluate(`(()=>{
    const aggregate=localStorage.getItem('wanbanXiaowu_petFull_v1');
    const started=performance.now();
    document.querySelector('#wb-pet-caretaker-mask [data-id=caretaker_b]').click();
    return {handler:performance.now()-started,aggregateStable:aggregate===localStorage.getItem('wanbanXiaowu_petFull_v1')};
  })()`);
  assert.ok(caretakerBSwitch.handler < 30, 'second caretaker switch handler took ' + caretakerBSwitch.handler.toFixed(1) + 'ms');
  assert.equal(caretakerBSwitch.aggregateStable, true, 'second caretaker switch must not rewrite the full pet archive');
  await waitFor('document.querySelector(".wb-pet-house-name")?.textContent.includes("饲养员乙")');
  const formalPetB = await evaluate(`(()=>{
    const aKey='wanbanXiaowu_petState_v1__'+encodeURIComponent('full_caretaker_a_pet_a');
    const bKey='wanbanXiaowu_petState_v1__'+encodeURIComponent('full_caretaker_b_pet_b');
    const beforeA=JSON.parse(localStorage.getItem(aKey)).state.growth;
    const started=performance.now();
    document.querySelector('#wb-pet-pat').click();
    const b=JSON.parse(localStorage.getItem(bKey)).state;
    return {handler:performance.now()-started,beforeA,growth:b.growth,interactions:b.eggInteractions};
  })()`);
  assert.ok(formalPetB.handler < 30, 'second formal pet interaction handler took ' + formalPetB.handler.toFixed(1) + 'ms');
  assert.deepEqual({ growth:formalPetB.growth, interactions:formalPetB.interactions, first:formalPetB.beforeA }, { growth:21, interactions:1, first:11 }, 'switching caretakers mixed their pet shards');

  await evaluate('document.querySelector("#wb-pet-caretakers").click()');
  await waitFor('!!document.querySelector("#wb-pet-caretaker-mask [data-id=caretaker_a]")');
  await evaluate('document.querySelector("#wb-pet-caretaker-mask [data-id=caretaker_a]").click()');
  await waitFor('document.querySelector(".wb-pet-house-name")?.textContent.includes("饲养员甲")');
  await evaluate('document.querySelector("#wb-pet-restart").click()');
  await waitFor('!!document.querySelector("#wb-pet-mini-ok")');
  await evaluate('document.querySelector("#wb-pet-mini-ok").click()');
  await waitFor('!!document.querySelector("#wb-pet-adoption-mask")');
  const formalDelete = await evaluate(`(()=>{
    const aKey='wanbanXiaowu_petState_v1__'+encodeURIComponent('full_caretaker_a_pet_a');
    const bKey='wanbanXiaowu_petState_v1__'+encodeURIComponent('full_caretaker_b_pet_b');
    const full=JSON.parse(localStorage.getItem('wanbanXiaowu_petFull_v1'));
    return {
      aShard:localStorage.getItem(aKey),
      aCursor:localStorage.getItem(aKey+'__story'),
      aPets:full.caretakers.find(c=>c.id==='caretaker_a').pets.map(p=>p.id),
      bPets:full.caretakers.find(c=>c.id==='caretaker_b').pets.map(p=>p.id),
      bGrowth:JSON.parse(localStorage.getItem(bKey)).state.growth,
    };
  })()`);
  assert.deepEqual(formalDelete, { aShard:null, aCursor:null, aPets:[], bPets:['pet_b'], bGrowth:21 }, 'deleting one formal pet must preserve every other caretaker shard');
  await evaluate('document.querySelectorAll(".wb-modal-mask").forEach(mask=>mask.remove())');
  await evaluate('document.querySelector("[data-tab=settings]").click()');
  await waitFor('!!document.querySelector("#wb-companion-toggle")');

  await evaluate(`(()=>{
    const companion=document.querySelector('#wb-companion-toggle');
    const theme=document.querySelector('#wb-theme');
    companion.checked=false;
    theme.value='arcade';
    theme.dispatchEvent(new Event('change',{bubbles:true}));
    companion.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('[data-tab=single]').click();
  })()`);
  for (let i = 0; i < 10 && !(await evaluate('!!document.querySelector("[data-game=spider]")')); i++) {
    await evaluate('document.querySelector("#wb-body").scrollTop=document.querySelector("#wb-body").scrollHeight');
    await sleep(260);
  }
  await evaluate('document.querySelector("[data-game=spider]").click()');
  await waitFor('!!document.querySelector("#wb-start-cover-btn")');
  await evaluate('document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('!!document.querySelector("#wb-choice-mask [data-choice=easy]")');
  await evaluate('document.querySelector("#wb-choice-mask [data-choice=easy]").click()');
  await waitFor('document.querySelectorAll(".wb-spider-col").length===10 && document.querySelectorAll(".wb-spider-card").length===54');
  const spiderInteraction = await evaluate(`(async()=>{
    const board=document.querySelector('#sp-board');
    const columns=Array.from(board.querySelectorAll('.wb-spider-col'));
    const before=columns.map(column=>column.querySelectorAll('.wb-spider-card').length);
    const card=columns[0].querySelector('.wb-spider-card:not(.back):last-of-type');
    window.__stableSpiderCard=card;
    const selectStarted=performance.now();
    card.click();
    const selectHandler=performance.now()-selectStarted;
    await new Promise(requestAnimationFrame);
    const reusedAfterSelect=window.__stableSpiderCard===document.querySelector('[data-card-id="'+card.dataset.cardId+'"]');
    card.click();
    const dealStarted=performance.now();
    document.querySelector('#sp-deck').click();
    const dealHandler=performance.now()-dealStarted;
    return {before,selectHandler,dealHandler,reusedAfterSelect};
  })()`);
  await waitFor(`(()=>{const before=${JSON.stringify(spiderInteraction.before)};return Array.from(document.querySelectorAll('.wb-spider-col')).every((column,index)=>column.querySelectorAll('.wb-spider-card').length===before[index]+1)})()`);
  const spiderAfterDeal = await evaluate(`(()=>{
    const columns=Array.from(document.querySelectorAll('.wb-spider-col'));
    const readable=columns.every(column=>{
      const cards=Array.from(column.querySelectorAll('.wb-spider-card:not(.back)'));
      if(cards.length<2)return true;
      const tops=cards.map(card=>parseFloat(card.style.top)||0);
      return tops.slice(1).every((top,index)=>top-tops[index]>=12.9);
    });
    return {
      counts:columns.map(column=>column.querySelectorAll('.wb-spider-card').length),
      cards:columns.map(column=>Array.from(column.querySelectorAll('.wb-spider-card')).map(card=>card.dataset.cardId)),
      readable,
      horizontalOverflow:document.querySelector('#sp-board').scrollWidth-document.querySelector('#sp-board').clientWidth,
    };
  })()`);
  assert.equal(spiderInteraction.reusedAfterSelect, true, 'spider selection must reuse the existing card node');
  assert.ok(spiderInteraction.selectHandler < 30, 'spider selection handler took ' + spiderInteraction.selectHandler.toFixed(1) + 'ms');
  assert.ok(spiderInteraction.dealHandler < 30, 'spider deal handler took ' + spiderInteraction.dealHandler.toFixed(1) + 'ms');
  assert.equal(spiderAfterDeal.readable, true, 'spider face-up ranks must remain readable');
  assert.ok(spiderAfterDeal.horizontalOverflow <= 1, 'spider board must not overflow horizontally on mobile');
  const spiderCloseMs = await evaluate(`(()=>{const started=performance.now();document.querySelector('#wb-close').click();return performance.now()-started})()`);
  assert.ok(spiderCloseMs < 30, 'spider close handler took ' + spiderCloseMs.toFixed(1) + 'ms');
  assert.equal(await evaluate('document.querySelector("#wanbanXiaowu-shell").classList.contains("wb-shell-visible")'), false, 'spider close must hide immediately');
  await waitFor('document.querySelector("#wb-body").childElementCount===0');
  await evaluate('document.querySelector("#wanbanXiaowu-menu-item").click()');
  for (let i = 0; i < 10 && !(await evaluate('!!document.querySelector("[data-game=spider]")')); i++) {
    await evaluate('document.querySelector("#wb-body").scrollTop=document.querySelector("#wb-body").scrollHeight');
    await sleep(260);
  }
  await evaluate('document.querySelector("[data-game=spider]").click()');
  await sleep(180);
  if (await evaluate('!!document.querySelector("#wb-progress-continue")')) await evaluate('document.querySelector("#wb-progress-continue").click()');
  else await evaluate('document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('document.querySelectorAll(".wb-spider-card").length===64');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.wb-spider-col')).map(column=>Array.from(column.querySelectorAll('.wb-spider-card')).map(card=>card.dataset.cardId))`), spiderAfterDeal.cards, 'spider tableau must restore exactly after close');
  await evaluate('document.querySelector("#wb-close").click()');
  await waitFor('document.querySelector("#wb-body").childElementCount===0');
  await evaluate('document.querySelector("#wanbanXiaowu-menu-item").click()');
  await waitFor('!!document.querySelector("[data-tab=single]")');
  await evaluate('document.querySelector("[data-tab=single]").click()');
  for (let i = 0; i < 10 && !(await evaluate('!!document.querySelector("[data-game=watersort]")')); i++) {
    await evaluate('document.querySelector("#wb-body").scrollTop=document.querySelector("#wb-body").scrollHeight');
    await sleep(260);
  }
  await evaluate('document.querySelector("[data-game=watersort]").click()');
  await waitFor('!!document.querySelector("#wb-start-cover-btn")');
  await evaluate('document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('document.querySelectorAll(".wb-water-bottle").length>=5');
  const waterSortInteraction = await evaluate(`(async()=>{
    const board=document.querySelector('#wb-water-board');
    const bottles=Array.from(board.querySelectorAll('.wb-water-bottle'));
    const labels=bottles.map(bottle=>bottle.getAttribute('aria-label'));
    const colors=bottle=>{
      const label=bottle.getAttribute('aria-label')||'';
      if(label.includes('空瓶')) return [];
      return (label.split('从底到顶 ')[1]||'').split('，包含')[0].split('、').filter(Boolean);
    };
    const values=bottles.map(colors);
    let move=null;
    for(let from=0;from<values.length&&!move;from++) for(let to=0;to<values.length;to++){
      if(from!==to&&values[from].length&&values[to].length<4&&(!values[to].length||values[from].at(-1)===values[to].at(-1))){ move={from,to}; break; }
    }
    if(!move) throw new Error('No legal water sort move');
    const source=bottles[move.from],target=bottles[move.to];
    const started=performance.now();
    source.click();
    const handler=performance.now()-started;
    await new Promise(requestAnimationFrame);
    target.click();
    const firstStarted=source.classList.contains('pour-source')&&target.classList.contains('pour-target');
    await new Promise(resolve=>setTimeout(resolve,280));
    const firstCleared=!board.querySelector('.pour-source,.pour-target');
    document.querySelector('.wb-water-tool[data-tool="undo"]').click();
    source.click(); target.click();
    const secondStarted=source.classList.contains('pour-source')&&target.classList.contains('pour-target');
    await new Promise(resolve=>setTimeout(resolve,280));
    const secondCleared=!board.querySelector('.pour-source,.pour-target');
    document.querySelector('.wb-water-tool[data-tool="undo"]').click();
    return {handler,firstStarted,firstCleared,secondStarted,secondCleared,stable:bottles.every((bottle,index)=>bottle===board.querySelectorAll('.wb-water-bottle')[index]),labels};
  })()`);
  assert.equal(waterSortInteraction.stable, true, 'water sort selection must reuse every bottle node');
  assert.equal(waterSortInteraction.firstStarted && waterSortInteraction.secondStarted, true, 'every water sort pour must start both bottle animations');
  assert.equal(waterSortInteraction.firstCleared && waterSortInteraction.secondCleared, true, 'water sort pour classes must clear after every animation');
  assert.ok(waterSortInteraction.handler < 30, 'water sort selection handler took ' + waterSortInteraction.handler.toFixed(1) + 'ms');
  const waterSortBackMs = await evaluate(`(()=>{window.__storageWrites.length=0;window.__waterBackStarted=performance.now();document.querySelector('#wb-back').click();return performance.now()-window.__waterBackStarted})()`);
  assert.ok(waterSortBackMs < 30, 'water sort back handler took ' + waterSortBackMs.toFixed(1) + 'ms');
  assert.ok(await evaluate('!!document.querySelector(".wb-cardgrid")'), 'water sort back must render the game list synchronously');
  await sleep(450);
  const returnListScroll = await evaluate(`(async()=>{
    const body=document.querySelector('#wb-body');
    const shell=document.querySelector('#wanbanXiaowu-shell');
    const scrollStarted=performance.now();
    const maxScroll=Math.max(0,body.scrollHeight-body.clientHeight);
    const frames=[],work=[];
    window.__returnLongTasks=[];
    const observer=globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')
      ? new PerformanceObserver(list=>list.getEntries().forEach(entry=>window.__returnLongTasks.push(entry.duration)))
      : null;
    observer?.observe({type:'longtask',buffered:false});
    for(let step=1;step<=12;step++){
      const started=performance.now();
      body.scrollTop=maxScroll*step/12;
      body.dispatchEvent(new Event('scroll'));
      body.dispatchEvent(new Event('touchmove',{bubbles:true}));
      document.elementFromPoint(body.clientWidth/2,Math.min(innerHeight-2,body.getBoundingClientRect().bottom-2));
      work.push(performance.now()-started);
      await new Promise(requestAnimationFrame);
      frames.push(performance.now()-started);
    }
    observer?.disconnect();
    const competingWrites=window.__storageWrites.filter(item=>item.key==='wanbanXiaowu_progress_v1__watersort'||item.key.startsWith('wanbanXiaowu_records_v1'));
    return {
      maxFrame:Math.max(...frames),maxWork:Math.max(...work),maxLongTask:Math.max(0,...window.__returnLongTasks),
      competingWrites:competingWrites.length,writeDetails:competingWrites,backStarted:window.__waterBackStarted,scrollStarted,scrollEnded:performance.now(),bodyScrollable:maxScroll>0,
      shellScrollable:shell.scrollHeight>shell.clientHeight+1,popupHeight:document.querySelector('#wanbanXiaowu-popup').clientHeight,shellHeight:shell.clientHeight,
    };
  })()`);
  assert.equal(returnListScroll.bodyScrollable, true, 'returned game list must remain scrollable');
  assert.equal(returnListScroll.shellScrollable, false, 'mobile house must not create a competing outer scroll container');
  assert.equal(returnListScroll.competingWrites, 0, 'progress or record storage writes competed with return-list scrolling: ' + JSON.stringify(returnListScroll));
  assert.ok(returnListScroll.maxWork < 30, 'return-list scroll work took ' + returnListScroll.maxWork.toFixed(1) + 'ms');
  assert.ok(returnListScroll.maxLongTask < 80, 'return-list scroll produced a ' + returnListScroll.maxLongTask.toFixed(1) + 'ms long task');
  assert.ok(returnListScroll.maxFrame < 80, 'return-list scroll frame took ' + returnListScroll.maxFrame.toFixed(1) + 'ms');
  await sleep(900);
  const waterProgressPersisted = await evaluate(`window.__storageWrites.some(item=>item.key==='wanbanXiaowu_progress_v1__watersort')||!!localStorage.getItem('wanbanXiaowu_progress_v1__watersort')`);
  assert.equal(waterProgressPersisted, true, 'water sort progress was not persisted after scrolling stopped');
  assert.equal(await evaluate(`window.__storageWrites.some(item=>item.key==='wanbanXiaowu_records_v1__watersort')`), true, 'water sort record did not flush after scrolling stopped');
  assert.ok(await evaluate('!!localStorage.getItem("wanbanXiaowu_progress_v1__watersort")'), 'water sort back must flush its deferred snapshot');
  for (let i = 0; i < 10 && !(await evaluate('!!document.querySelector("[data-game=watersort]")')); i++) {
    await evaluate('document.querySelector("#wb-body").scrollTop=document.querySelector("#wb-body").scrollHeight');
    await sleep(260);
  }
  await evaluate('document.querySelector("[data-game=watersort]").click()');
  await waitFor('!!document.querySelector("#wb-progress-continue")');
  await evaluate('document.querySelector("#wb-progress-continue").click()');
  await waitFor('document.querySelectorAll(".wb-water-bottle").length>=5');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.wb-water-bottle')).map(bottle=>bottle.getAttribute('aria-label'))`), waterSortInteraction.labels, 'water sort must restore the exact bottle layout after back');
  await evaluate('document.querySelector("#wb-back").click()');
  for (let i = 0; i < 10 && !(await evaluate('!!document.querySelector("[data-game=game2048]")')); i++) {
    await evaluate('document.querySelector("#wb-body").scrollTop=document.querySelector("#wb-body").scrollHeight');
    await sleep(260);
  }
  await evaluate('document.querySelector("[data-game=game2048]").click()');
  await waitFor('!!document.querySelector("#wb-start-cover-btn")');
  await evaluate('document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('!!document.querySelector("#wb-choice-mask [data-choice=normal]")');
  await evaluate('document.querySelector("#wb-choice-mask [data-choice=normal]").click()');
  await waitFor('document.querySelectorAll("#wb-2048 .wb-tile").length===16');
  const game2048Interaction = await evaluate(`(async()=>{
    const board=document.querySelector('#wb-2048');
    const cells=Array.from(board.children);
    const started=performance.now();
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));
    const handler=performance.now()-started;
    await new Promise(requestAnimationFrame);
    return {handler,stable:cells.every((cell,index)=>cell===board.children[index])};
  })()`);
  assert.equal(game2048Interaction.stable, true, '2048 moves must reuse every grid node');
  assert.ok(game2048Interaction.handler < 30, '2048 move handler took ' + game2048Interaction.handler.toFixed(1) + 'ms');
  await evaluate('document.querySelector("#wb-back").click()');
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

  await client.call('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:2, mobile:true });
  await evaluate('document.querySelector("#wb-back").click()');
  await openListedGame('uyangle');
  await evaluate('document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('!!document.querySelector("#wb-choice-mask [data-choice=easy]")');
  await evaluate('document.querySelector("#wb-choice-mask [data-choice=easy]").click()');
  await waitFor('document.querySelectorAll(".wb-uyangle-tile").length>0');
  const uyangleReady = await evaluate(`(()=>({total:document.querySelectorAll('.wb-uyangle-tile').length,enabled:document.querySelectorAll('.wb-uyangle-tile:not(:disabled)').length,errors:window.__errors,body:document.querySelector('#wb-gamebox')?.innerText}))()`);
  assert.ok(uyangleReady.enabled > 0, 'U board has no selectable tile: ' + JSON.stringify(uyangleReady));
  const uyangleInteraction = await evaluate(`(()=>{
    const board=document.querySelector('#wb-uyangle-board');
    const before=board.children.length;
    const tile=board.querySelector('.wb-uyangle-tile:not(:disabled)');
    const started=performance.now();
    tile.click();
    return {handler:performance.now()-started,before,after:board.children.length,tray:document.querySelectorAll('#wb-uyangle-tray img').length};
  })()`);
  assert.equal(uyangleInteraction.after, uyangleInteraction.before - 1, 'U tile pick must remove exactly one board node');
  assert.equal(uyangleInteraction.tray, 1, 'U tile pick must preserve the tray result');
  assert.ok(uyangleInteraction.handler < 80, 'U tile handler took ' + uyangleInteraction.handler.toFixed(1) + 'ms');

  await evaluate('document.querySelector("#wb-back").click()');
  await openListedGame('popstar');
  await evaluate('document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('!!document.querySelector("#wb-choice-mask [data-choice=easy]")');
  await evaluate('document.querySelector("#wb-choice-mask [data-choice=easy]").click()');
  await waitFor('document.querySelectorAll(".wb-popstar-cell").length===100');
  const popstarInteraction = await evaluate(`(()=>{
    const board=document.querySelector('#wb-popstar-board');
    const cells=Array.from(board.querySelectorAll('.wb-popstar-cell'));
    const byPosition=new Map(cells.map(cell=>[cell.dataset.r+','+cell.dataset.c,cell]));
    const color=cell=>cell.style.getPropertyValue('--star-color');
    let pair=null;
    for(const cell of cells){
      const r=Number(cell.dataset.r),c=Number(cell.dataset.c);
      const neighbor=byPosition.get((r+1)+','+c)||byPosition.get(r+','+(c+1));
      if(neighbor&&color(neighbor)===color(cell)){ pair=[cell,neighbor]; break; }
    }
    if(!pair) throw new Error('No removable Pop Star group');
    const group=new Set(pair),queue=pair.slice();
    while(queue.length){
      const cell=queue.shift(),r=Number(cell.dataset.r),c=Number(cell.dataset.c);
      for(const key of [(r-1)+','+c,(r+1)+','+c,r+','+(c-1),r+','+(c+1)]){
        const next=byPosition.get(key);
        if(next&&!group.has(next)&&color(next)===color(cell)){ group.add(next); queue.push(next); }
      }
    }
    window.__stablePopstarNode=cells.find(cell=>!group.has(cell))||null;
    const before=cells.length,started=performance.now();
    pair[0].click();
    return {handler:performance.now()-started,before,removed:group.size};
  })()`);
  await sleep(380);
  const popstarAfter = await evaluate(`(()=>({
    count:document.querySelectorAll('#wb-popstar-board .wb-popstar-cell').length,
    removing:document.querySelectorAll('#wb-popstar-board .removing').length,
    stable:!window.__stablePopstarNode||window.__stablePopstarNode.isConnected,
    unique:new Set(Array.from(document.querySelectorAll('#wb-popstar-board .wb-popstar-cell')).map(cell=>cell.dataset.popstarId)).size,
  }))()`);
  assert.equal(popstarAfter.removing, 0, 'removed Pop Star nodes must be released after their animation');
  assert.equal(popstarAfter.count, popstarInteraction.before - popstarInteraction.removed, 'Pop Star board retained stale removed nodes');
  assert.equal(popstarAfter.unique, popstarAfter.count, 'Pop Star board must not duplicate reused nodes');
  assert.equal(popstarAfter.stable, true, 'Pop Star must preserve unaffected nodes');
  assert.ok(popstarInteraction.handler < 40, 'Pop Star handler took ' + popstarInteraction.handler.toFixed(1) + 'ms');

  await evaluate('document.querySelector("#wb-back").click()');
  await openListedGame('gomoku', 'double');
  await evaluate('document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('!!document.querySelector("#wb-choice-mask [data-choice=normal]")');
  await evaluate('document.querySelector("#wb-choice-mask [data-choice=normal]").click()');
  await waitFor('!!document.querySelector("#wb-first-mask [data-first=user]")');
  await evaluate('document.querySelector("#wb-first-mask [data-first=user]").click()');
  await waitFor('document.querySelectorAll(".wb-gcell").length===225');
  const gomokuInteraction = await evaluate(`(()=>{
    const cells=Array.from(document.querySelectorAll('.wb-gcell'));
    window.__gomokuCells=cells;
    window.__gomokuMoveStarted=performance.now();
    const started=performance.now();
    cells[112].click();
    return {handler:performance.now()-started,occupied:cells.filter(cell=>cell.classList.contains('black')||cell.classList.contains('white')).length,stable:cells.every((cell,index)=>cell===document.querySelectorAll('.wb-gcell')[index])};
  })()`);
  assert.equal(gomokuInteraction.stable, true, 'Gomoku moves must reuse all board cells');
  assert.equal(gomokuInteraction.occupied, 1, 'Gomoku AI must not move in the user click handler');
  assert.ok((await evaluate('document.querySelector("#wb-gomoku-turn").textContent')).includes('思考中'), 'Gomoku must show its AI thinking state');
  await sleep(350);
  assert.equal(await evaluate(`document.querySelectorAll('.wb-gcell.black,.wb-gcell.white').length`), 1, 'Gomoku AI delay ended too early');
  await waitFor('document.querySelectorAll(".wb-gcell.black,.wb-gcell.white").length>=2');
  const gomokuAfterAi = await evaluate(`({elapsed:performance.now()-window.__gomokuMoveStarted,stable:window.__gomokuCells.every((cell,index)=>cell===document.querySelectorAll('.wb-gcell')[index])})`);
  assert.equal(gomokuAfterAi.stable, true, 'Gomoku AI move must reuse all board cells');
  assert.ok(gomokuAfterAi.elapsed >= 700, 'Gomoku AI moved without a visible delay: ' + gomokuAfterAi.elapsed.toFixed(1) + 'ms');
  assert.ok(gomokuInteraction.handler < 80, 'Gomoku move and AI handler took ' + gomokuInteraction.handler.toFixed(1) + 'ms');

  await evaluate('document.querySelector("#wb-back").click()');
  await openListedGame('chinesechess', 'double');
  await evaluate('document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('document.querySelectorAll(".wb-xq-cell").length===90');
  const chineseChessMove = await evaluate(`(()=>{
    window.__xqCells=Array.from(document.querySelectorAll('.wb-xq-cell'));
    window.__xqMoveStarted=performance.now();
    document.querySelector('.wb-xq-cell[data-i="54"]').click();
    document.querySelector('.wb-xq-cell[data-i="45"]').click();
    return {
      thinking:document.querySelector('#wb-xq-text').textContent.includes('思考中'),
      userMarks:document.querySelectorAll('.wb-xq-cell.last-user').length,
      taMarks:document.querySelectorAll('.wb-xq-cell.last-ta').length,
    };
  })()`);
  assert.equal(chineseChessMove.thinking, true, 'Chinese chess must show its AI thinking state');
  assert.ok(chineseChessMove.userMarks > 0, 'Chinese chess user move did not complete');
  assert.equal(chineseChessMove.taMarks, 0, 'Chinese chess AI must not move in the user click handler');
  await sleep(350);
  assert.equal(await evaluate(`document.querySelectorAll('.wb-xq-cell.last-ta').length`), 0, 'Chinese chess AI delay ended too early');
  await waitFor('document.querySelectorAll(".wb-xq-cell.last-ta").length>0');
  const chineseChessAfterAi = await evaluate(`({elapsed:performance.now()-window.__xqMoveStarted,stable:window.__xqCells.every((cell,index)=>cell===document.querySelectorAll('.wb-xq-cell')[index])})`);
  assert.equal(chineseChessAfterAi.stable, true, 'Chinese chess AI move must reuse all board cells');
  assert.ok(chineseChessAfterAi.elapsed >= 700, 'Chinese chess AI moved without a visible delay: ' + chineseChessAfterAi.elapsed.toFixed(1) + 'ms');

  await evaluate('document.querySelector("#wb-back").click()');
  await openListedGame('ludo', 'double');
  await evaluate('document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('!!document.querySelector("#wb-first-mask [data-first=user]")');
  await evaluate('document.querySelector("#wb-first-mask [data-first=user]").click()');
  await waitFor('document.querySelectorAll(".wb-ludo-cell").length===121 && document.querySelectorAll(".wb-ludo-piece").length===8');
  const ludoRoll = await evaluate(`(()=>{
    window.__ludoCells=Array.from(document.querySelectorAll('.wb-ludo-cell'));
    window.__ludoPieces=Array.from(document.querySelectorAll('.wb-ludo-piece'));
    window.__ludoDice=Array.from(document.querySelector('#wb-ludo-dice').children);
    const started=performance.now();
    document.querySelector('#wb-ludo-roll').click();
    return performance.now()-started;
  })()`);
  await sleep(160);
  await evaluate('document.querySelector("#wb-ludo-roll").click()');
  await sleep(100);
  const ludoAfter = await evaluate(`(()=>({
    cells:document.querySelectorAll('.wb-ludo-cell').length,
    pieces:document.querySelectorAll('.wb-ludo-piece').length,
    dice:document.querySelector('#wb-ludo-dice').children.length,
    stableCells:window.__ludoCells.every((node,index)=>node===document.querySelectorAll('.wb-ludo-cell')[index]),
    stablePieces:window.__ludoPieces.every(node=>node.isConnected),
    stableDice:window.__ludoDice.every((node,index)=>node===document.querySelector('#wb-ludo-dice').children[index]),
  }))()`);
  assert.deepEqual({ cells:ludoAfter.cells, pieces:ludoAfter.pieces, dice:ludoAfter.dice }, { cells:121, pieces:8, dice:9 }, 'Ludo static nodes changed during a dice roll');
  assert.equal(ludoAfter.stableCells && ludoAfter.stablePieces && ludoAfter.stableDice, true, 'Ludo must reuse board, piece and dice nodes');
  assert.ok(ludoRoll < 30, 'Ludo roll handler took ' + ludoRoll.toFixed(1) + 'ms');

  await evaluate('document.querySelector("#wb-back").click()');
  await openListedGame('turkey');
  await sleep(90);
  await evaluate('document.querySelector("#wb-progress-mask")?.remove();document.querySelector("#wb-start-cover-btn").click()');
  await waitFor('document.querySelectorAll(".wb-turkey-block").length>0');
  const turkeyMove = await evaluate(`(()=>{
    const board=document.querySelector('#tk-board');
    const cell=board.getBoundingClientRect().width/8;
    const move=document.querySelector('.wb-turkey-block[data-id="stable_move"]');
    const doomed=['clear_left','clear_right'].map(id=>document.querySelector('.wb-turkey-block[data-id="'+id+'"]'));
    const survivors=['stack_low','stack_high','stable_move'].map(id=>[id,document.querySelector('.wb-turkey-block[data-id="'+id+'"]')]);
    if(!move||doomed.some(node=>!node)||survivors.some(([,node])=>!node)) return {error:'seeded Turkey blocks missing'};
    window.__turkeyPushTest={initialY:null,started:false,nodes:null,sawClear:false,clearSnapshot:false,doomed,survivors};
    const observer=new MutationObserver(()=>{
      if(doomed.every(node=>node.classList.contains('clear'))){
        window.__turkeyPushTest.sawClear=true;
        window.__turkeyPushTest.clearSnapshot=doomed.every(node=>node.isConnected)
          &&survivors.every(([,node])=>node.isConnected&&!node.classList.contains('clear'));
      }
      const pushed=board.querySelector('.wb-turkey-block.row-push');
      if(!pushed) return;
      const transform=getComputedStyle(pushed).transform;
      const y=transform==='none'?0:new DOMMatrixReadOnly(transform).m42;
      if(!pushed.classList.contains('run')&&window.__turkeyPushTest.initialY===null){
        window.__turkeyPushTest.initialY=y;
        window.__turkeyPushTest.nodes=new Map(Array.from(board.querySelectorAll('.wb-turkey-block')).map(element=>[element.dataset.id,element]));
      }
      if(pushed.classList.contains('run')) window.__turkeyPushTest.started=true;
    });
    observer.observe(board,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    window.__turkeyPushTest.observer=observer;
    const rect=board.getBoundingClientRect();
    const startX=rect.left+4.5*cell;
    const endX=startX+cell;
    const y=rect.top+8.5*cell;
    const event=(type,x)=>new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,pointerType:'touch',isPrimary:true,clientX:x,clientY:y});
    move.dispatchEvent(event('pointerdown',startX));
    document.dispatchEvent(event('pointermove',endX));
    document.dispatchEvent(event('pointerup',endX));
    return {cell};
  })()`);
  assert.equal(turkeyMove.error, undefined, turkeyMove.error);
  await waitFor('window.__turkeyPushTest?.sawClear===true');
  assert.equal(await evaluate('window.__turkeyPushTest.clearSnapshot'), true, 'Turkey clear must fade only the completed row while preserving survivors');
  await waitFor('!document.querySelector(".wb-turkey-block[data-id=clear_left]")&&!document.querySelector(".wb-turkey-block[data-id=clear_right]")');
  assert.equal(await evaluate(`window.__turkeyPushTest.survivors.every(([id,node])=>node.isConnected&&document.querySelector('.wb-turkey-block[data-id="'+id+'"]')===node)`), true, 'Turkey clear must remove only the completed row nodes');
  await waitFor('window.__turkeyPushTest?.started===true');
  await sleep(100);
  const turkeyPushMid = await evaluate(`(()=>{
    const pushed=document.querySelector('.wb-turkey-block.row-push.run');
    const transform=pushed?getComputedStyle(pushed).transform:'none';
    return {
      active:!!pushed,
      y:transform==='none'?0:new DOMMatrixReadOnly(transform).m42,
      initialY:window.__turkeyPushTest.initialY,
      stable:Array.from(window.__turkeyPushTest.nodes||[]).every(([id,node])=>node.isConnected&&node.dataset.id===id),
    };
  })()`);
  assert.equal(turkeyPushMid.active, true, 'Turkey row push ended before its visible middle frame');
  assert.equal(turkeyPushMid.stable, true, 'Turkey row push must reuse existing block nodes');
  assert.ok(Math.abs(turkeyPushMid.initialY-turkeyMove.cell)<2, 'Turkey row push must start one cell below its final position');
  assert.ok(turkeyPushMid.y>0&&turkeyPushMid.y<turkeyMove.cell, 'Turkey row push must visibly move upward: ' + JSON.stringify(turkeyPushMid));
  await waitFor('document.querySelectorAll(".wb-turkey-block.row-push").length===0');
  await sleep(700);
  assert.equal(await evaluate(`Array.from(window.__turkeyPushTest.nodes||[]).every(([id,node])=>{const current=document.querySelector('.wb-turkey-block[data-id="'+id+'"]');return !current||current===node})`), true, 'Turkey settling must never repurpose a surviving block node');
  await evaluate('window.__turkeyPushTest.observer.disconnect();document.querySelector("#wb-back").click()');

  const startupSmokes = [
    ['tetris','single','#wb-tetris-toggle-keys'], ['snake','single','#wb-snake-toggle-keys'], ['watermelon','single','#wb-watermelon'],
    ['memory','single','#wb-memory-board'], ['jump','single','#wb-jump'], ['plank','single','#wb-plank'], ['sudoku','single','#wb-sudoku-board'],
    ['minesweeper','single','#wb-mines-board'], ['screw','single','#wb-screw-canvas'], ['paopao','single','#wb-paopao-canvas'],
    ['game1010','single','#wb-1010-canvas'], ['linklink','single','#ll-board'],
    ['zuma','single','#wb-zuma-canvas'], ['flappybird','single','#wb-flappy-canvas'],
    ['territory','double','#wb-territory-board'], ['oldmaid','double','#wb-oldmaid-ta'], ['reversi','double','#wb-reversi-board'],
    ['bombnumber','double','#wb-bomb-grid'], ['connect4d','double','#wb-c4d-board'], ['draughts','double','#wb-draughts-board'],
    ['westernchess','double','#wb-chess-board'], ['blackjack','double','#bj-hit'],
    ['guessnumber','double','#wb-num-guess'], ['wordguess','double','#wb-word-input'], ['tictactoe','double','.wb-board3'],
  ];
  for (const [game, tab, selector] of startupSmokes) await smokeStartListedGame(game, tab, selector);
  for (const modulePath of ['/src/games/zuma.js', '/src/games/water-sort.js', '/src/games/flappy-bird.js']) {
    assert.equal(requests.filter(path => path === modulePath).length, 1, modulePath + ' must stay cached after its first load');
  }
  assert.equal(smokeReturnMetrics.length, startupSmokes.length, 'every smoke-tested game must verify its return path');
  assert.deepEqual(await evaluate('window.__errors'), []);
  console.log('PASS: mobile first open ' + openMs.toFixed(1) + 'ms; tabs single/double/intimacy ' + tabSwitches.single.toFixed(1) + '/' + tabSwitches.double.toFixed(1) + '/' + tabSwitches.intimacy.toFixed(1) + 'ms; reopened list+icons ' + reopenedList.ready.toFixed(1) + 'ms; game entry ' + gameEntryMs.toFixed(1) + 'ms/progress prompt ' + progressPromptMs.toFixed(1) + 'ms/save ' + progressAutoSaveMs.toFixed(1) + 'ms/resume ' + continueResumeMs.toFixed(1) + 'ms/pause resume ' + pauseResumeMs.toFixed(1) + 'ms; Schulte ' + interaction.maxHandler.toFixed(1) + 'ms; game over ' + gameOverInteraction.maxHandler.toFixed(1) + 'ms/theater close ' + theaterCloseMs.toFixed(1) + 'ms; water sort ' + waterSortInteraction.handler.toFixed(1) + 'ms/back ' + waterSortBackMs.toFixed(1) + 'ms/return scroll ' + returnListScroll.maxFrame.toFixed(1) + 'ms; 2048 ' + game2048Interaction.handler.toFixed(1) + 'ms; U ' + uyangleInteraction.handler.toFixed(1) + 'ms; Pop Star ' + popstarInteraction.handler.toFixed(1) + 'ms; Gomoku+AI ' + gomokuInteraction.handler.toFixed(1) + 'ms; Ludo ' + ludoRoll.toFixed(1) + 'ms; settings switch ' + settingsSwitch.elapsed.toFixed(1) + 'ms (cached ' + secondSettingsSwitch.toFixed(1) + 'ms); home switch ' + homeSwitch.elapsed.toFixed(1) + 'ms; 6x6 klotski ' + klotski390.board.width.toFixed(1) + 'px at 390px and ' + klotski320.board.width.toFixed(1) + 'px at 320px.');
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
