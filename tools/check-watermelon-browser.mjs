import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = resolve(fileURLToPath(new URL('..', import.meta.url)));
const chrome = process.env.WATERMELON_TEST_CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!chrome) throw new Error('Set WATERMELON_TEST_CHROME to a Chromium executable.');

const runtime = await readFile(join(workspace, 'src/runtime/wanban-app.js'), 'utf8');
const from = runtime.indexOf('  function startWatermelon(state) {');
const to = runtime.indexOf('\n  function startLudo(state) {', from);
const gameCode = runtime.slice(from, to);
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>html,body,#wb-gamebox{margin:0;width:100%;height:100%;overflow:hidden}#wb-gamebox{display:grid;place-items:center;container-type:size}</style></head><body><div id="wb-gamebox"></div><script>
let gamePaused=false,activeGameController=null,currentGame='watermelon',gameStarted=true;
const PROGRESS_SAVE_DELAY=700;window.__draws=0;window.__drawTimes=[];window.__saved=null;window.__errors=[];window.__score=0;
addEventListener('error',event=>__errors.push(event.message));addEventListener('unhandledrejection',event=>__errors.push(String(event.reason)));
const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='wb-watermelon'){__draws++;__drawTimes.push(performance.now())}return clear.apply(this,args)};
const qs=selector=>document.querySelector(selector),getHostDocument=()=>document,getHostWindow=()=>window,isMobileHost=()=>true;
const currentTheme=()=> 'day',isNightTheme=()=>false,canvasThemePalette=()=>({top:'#fff8eb',bottom:'#ffd8bc',pattern:'#ffe1cf',border:'#dfb393',grid:'#ddd',text:'#4d3328'});
const speak=()=>{},setScore=(_,score)=>window.__score=score,saveProgress=(_,state)=>window.__saved=structuredClone(state);
const showGameOver=()=>window.__over=true;
Math.random=()=>.1;
const registerLegacyGameSave=(_,save,cleanup)=>{let active=true;const guarded=force=>{if(active)save(force)};guarded.isActive=()=>active;activeGameController={save:()=>guarded(true),destroy:()=>{if(!active)return;active=false;cleanup?.()}};return guarded};
${gameCode}
window.__mount=state=>{activeGameController?.destroy?.();document.querySelector('#wb-gamebox').innerHTML='';gamePaused=false;window.__over=false;startWatermelon(state)};
__mount({next:0});window.__ready=true;
</script></body></html>`;

const server = createServer(async (request, response) => {
  try {
    if (request.url === '/') { response.setHeader('Content-Type', 'text/html;charset=utf-8'); response.end(html); return; }
    const path = resolve(workspace, '.' + decodeURIComponent(request.url.split('?')[0]));
    if (!path.startsWith(workspace + sep)) { response.writeHead(403); response.end(); return; }
    const mime = { '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2' }[extname(path)] || 'application/octet-stream';
    response.setHeader('Content-Type', mime); response.end(await readFile(path));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));

class CDP {
  constructor(url) {
    this.next = 1; this.pending = new Map(); this.ws = new WebSocket(url);
    this.ready = new Promise((resolveOpen, rejectOpen) => { this.ws.onopen = resolveOpen; this.ws.onerror = rejectOpen; });
    this.ws.onmessage = event => { const message=JSON.parse(event.data), pending=this.pending.get(message.id); if(!pending)return; this.pending.delete(message.id); message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result); };
  }
  async call(method, params = {}) { await this.ready; const id=this.next++; return new Promise((resolveCall,rejectCall)=>{this.pending.set(id,{resolve:resolveCall,reject:rejectCall});this.ws.send(JSON.stringify({id,method,params}))}); }
  close() { this.ws.close(); }
}

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const temporaryRoot = await mkdtemp(join(tmpdir(), 'wanban-watermelon-check-'));
const profile = join(temporaryRoot, 'profile');
await mkdir(profile);
let browser, client;
async function evaluate(expression) {
  const result = await client.call('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for(let i=0;i<180;i++){ if(await evaluate(expression))return; await sleep(30); }
  throw new Error('Timed out: ' + expression);
}

try {
  const endpoint = await new Promise((resolveEndpoint, rejectEndpoint) => {
    browser = spawn(chrome, ['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'], { windowsHide:true, stdio:['ignore','ignore','pipe'] });
    browser.once('error', rejectEndpoint);
    browser.stderr.on('data', data => { const match=String(data).match(/DevTools listening on (ws:\/\/\S+)/); if(match)resolveEndpoint(match[1]); });
    browser.once('exit', code => rejectEndpoint(new Error('Browser exited ' + code)));
  });
  const address = new URL(endpoint).host;
  const tabs = await (await fetch('http://' + address + '/json/list')).json();
  client = new CDP(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await client.call('Page.enable'); await client.call('Runtime.enable');
  await client.call('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:true });
  await client.call('Page.navigate', { url:'http://127.0.0.1:' + server.address().port });
  await waitFor('window.__ready===true');

  const layout = await evaluate(`(()=>{const c=document.querySelector('#wb-watermelon'),r=c.getBoundingClientRect();return {backing:[c.width,c.height],rect:[r.left,r.top,r.width,r.height],scroll:document.documentElement.scrollWidth,viewport:innerWidth}})()`);
  assert.deepEqual(layout.backing, [320,400]);
  assert.ok(layout.rect[2] <= layout.viewport && layout.scroll <= layout.viewport, 'mobile canvas must not overflow');

  const pointer = { x:layout.rect[0] + layout.rect[2] / 2, y:layout.rect[1] + 40 };
  for(let i=0;i<2;i++){
    await client.call('Input.dispatchMouseEvent',{type:'mousePressed',x:pointer.x,y:pointer.y,button:'left',clickCount:1});
    await client.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:pointer.x,y:pointer.y,button:'left',clickCount:1});
    await sleep(400);
  }
  try { await waitFor('__score===40'); }
  catch(error){ error.message += ' ' + JSON.stringify(await evaluate('({score:__score,saved:__saved,errors:__errors,draws:__draws})')); throw error; }
  await evaluate('activeGameController.save()');
  assert.equal(await evaluate('__saved.balls.length'), 1);

  await evaluate(`__mount({next:0,balls:[{x:200,y:100,vx:0,vy:0,l:0,a:0,av:0}]});__drawTimes=[]`);
  await sleep(800);
  const cadence = await evaluate(`(()=>{const gaps=__drawTimes.slice(1).map((time,index)=>time-__drawTimes[index]).sort((a,b)=>a-b);return {frames:__drawTimes.length,median:gaps[Math.floor(gaps.length/2)]||0}})()`);
  assert.ok(cadence.frames >= 35 && cadence.median < 24, 'falling fruit should render near 60 FPS: '+JSON.stringify(cadence));

  await evaluate(`__mount({next:0,balls:[{x:200,y:486,vx:0,vy:0,l:0,a:0,av:0},{x:200,y:458,vx:0,vy:0,l:0,a:0,av:0},{x:200,y:430,vx:0,vy:0,l:0,a:0,av:0}]})`);
  await sleep(2400);
  const settledDraws = await evaluate('__draws');
  await sleep(300);
  assert.equal(await evaluate('__draws'), settledDraws, 'settled pile must stop repainting');
  assert.deepEqual(await evaluate('__errors'), []);
  console.log('PASS: mobile backing store, pointer merge, '+cadence.frames+' falling frames at '+cadence.median.toFixed(1)+'ms median, layout and settled-pile sleep.');
} finally {
  client?.close();
  if(browser){ browser.kill(); await new Promise(resolveExit => browser.once('exit', resolveExit)); }
  server.close();
  const target=resolve(temporaryRoot), tempBase=resolve(tmpdir());
  if(target.startsWith(tempBase + sep)) await rm(target,{recursive:true,force:true,maxRetries:8,retryDelay:200}).catch(()=>{});
}
