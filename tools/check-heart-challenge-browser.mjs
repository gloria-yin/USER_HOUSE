import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = resolve(fileURLToPath(new URL('..', import.meta.url)));
const chrome = process.env.HEART_TEST_CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!chrome) throw new Error('Set HEART_TEST_CHROME to a Chromium executable.');
const artifactRoot = await mkdtemp(join(tmpdir(), 'wanban-heart-check-'));
const profile = join(artifactRoot, 'profile');
await mkdir(profile);
const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}#wanbanXiaowu-shell{display:flex}#wanbanXiaowu-popup{display:flex}#wanbanXiaowu-popup .wb-body{min-height:0}</style></head><body><div id="wanbanXiaowu-shell" class="wb-shell-visible"><div id="wanbanXiaowu-popup" class="wb-day wb-tab-intimacy"><div class="wb-head"><div class="wb-title">玩伴小屋</div><div class="wb-tabs"><button class="wb-tab">单人游戏</button><button class="wb-tab">双人游戏</button><button class="wb-tab active">亲密互动</button><button class="wb-tab">设置</button></div></div><div id="wb-body" class="wb-body"></div></div></div><script type="module">
import {createHeartChallenge} from '/src/heart-challenge/ui.js?v=4.1.13-heart-logs';
import * as E from '/src/heart-challenge/engine.js';
import {decodeStoredJSON} from '/src/runtime/storage.js';
import {heartWorldFromRole} from '/src/heart-challenge/world.js';
import {uploadGenerationLog} from '/src/heart-challenge/generation-log.js';
import {fixtureRoom,fixtureProtocol,fixtureReplyProtocol,fixtureGame} from '/tools/heart-challenge-fixture.mjs';
window.__calls=[]; window.__errors=[]; window.__delay=10; window.__replyState='resume';
window.addEventListener('error',e=>window.__errors.push(e.message));
window.addEventListener('unhandledrejection',e=>window.__errors.push(String(e.reason)));
window.__read=()=>{const raw=localStorage.getItem(E.HEART_STORAGE_KEY);return raw?decodeStoredJSON(raw):{rooms:[]}};
window.__active=()=>{const s=__read(),r=s.rooms.find(r=>r.id===s.activeRoomId);const g=r?.games.find(g=>g.id===r.activeGameId);return {room:r,game:g,run:E.currentRun(g)}};
const source=fixtureRoom(1,2);
const bookEntries=[{uid:1,wbName:'旅店',label:'蓝灯规则',content:'蓝灯世界书内容'},{uid:2,wbName:'旅店',label:'绿灯规则',content:'绿灯世界书内容'}];
const worldFor=kind=>heartWorldFromRole({userName:'旅人',userPersona:'设置中的用户设定',userDescSource:'manual',charName:'林舟',charDescriptionSnapshot:'角色卡全部描述',manualCharPersona:'设置中的手动角色描述',charDescMode:'manual',injectChat:false,specialLanguageEnabled:false,breakLimitPrompt:'设置中的前置要求',selectedWorldEntries:[bookEntries[0]]},{kind,summary:'旧旅途总结'});
const host={storage:localStorage,toast:text=>window.__toast=text,
worlds:()=>[{id:'world',kind:'existing-world',name:'雨夜世界预设',world:worldFor('existing-world'),player:{...source.players[0],origin:'world'}},{id:'current-card:P1',kind:'current-card',name:'当前角色卡：林舟',world:worldFor('current-card'),player:{...source.players[0],origin:'world'}}],
user:()=>({name:'旅人',persona:'来自酒馆的用户设定',avatar:'/assets/default-avatars-pixel.png?current-user'}),
userAvatars:async()=>[{name:'旧头像',avatar:'/assets/default-avatars-pixel.png?old-user'},{name:'当前头像',avatar:'/assets/default-avatars-pixel.png?current-user'}],
languages:()=>['粤语','古言','日语','英语'],languageInstruction:language=>'使用'+language+'并附中文翻译',
async readWorldPart(part,{mode}={}){if(window.__worldDelay)await new Promise(r=>setTimeout(r,__worldDelay));const user=host.user(),character={name:'林舟',description:'角色卡全部描述',cardId:'P1',avatar:'/assets/default-avatars-pixel.png?world'};if(part==='user')return user;if(part==='character')return character;if(part==='chat')return '最新聊天记录内容';if(part==='lazy')return {user,character,entries:bookEntries};return mode==='blue'?[bookEntries[0]]:bookEntries},
cards:()=>source.players.slice().reverse().map(p=>({...p,label:p.name,avatar:'/assets/default-avatars-pixel.png?tavern='+p.id})),apis:()=>[{id:'test-api',name:'测试 API'},{id:'quick-api',name:'快速回复 API'}],avatars:()=>[],home:()=>{window.__left=true},settings:()=>{window.__settings=true},
async request({prompt,system,onDelta,signal,api}) {
const {game,run}=__active(); const task=game.request.task; __calls.push({task,api,prompt,system});
await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,__delay);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('cancelled','AbortError'))},{once:true})});
if(window.__networkFailures>0){window.__networkFailures--;throw new Error('模拟网络断开')}
let output;
if(window.__invalid){window.__invalid=false;output='<cards>broken</cards><story></story>'}
else if(task==='game') output=fixtureProtocol(game);
else if(task==='reply') {output=fixtureReplyProtocol(run,__replyState);if(window.__shortReply){window.__shortReply=false;const lines=output.split(String.fromCharCode(10));output=[lines[0],lines[1],lines[2],lines.at(-1)].join(String.fromCharCode(10))}}
else output=JSON.stringify({task,title:'灯还为你亮着',text:'雨渐渐小了，桌上的茶还留着温度。林舟收好卡牌，认真记住那些被说出口的话，也把你选择留白的部分轻轻放下。大家没有急着散场，而是继续听了一会儿窗外的雨。今晚的游戏已经结束，彼此之间多了一点可以安静相处的默契。'});
if(window.__tailCutoff && task==='game' && output.includes('<open>')){
window.__tailCutoff=false;onDelta(output.slice(0,-4));window.__stoppedTooEarly=signal.aborted;
onDelta(output.slice(-4)+'\\n【世界观设定】：\\n多余尾文\\n[P1;]');window.__stoppedAtStory=signal.aborted;signal.throwIfAborted();
const error=new Error('模型输出达到上限');error.raw=output;throw error;
}
onDelta(output.slice(0,100));onDelta(output.slice(100));__calls.at(-1).aborted=signal.aborted;
return output;
}};
window.__mount=()=>{window.__controller?.destroy();window.__controller=createHeartChallenge(document.querySelector('#wb-body'),host)};
window.__enableServerLogs=()=>{host.saveGenerationLog=record=>uploadGenerationLog(record)};
window.__seed=(rounds,count)=>{window.__controller?.destroy();const {room}=fixtureGame(rounds,count);localStorage.setItem(E.HEART_STORAGE_KEY,JSON.stringify({version:1,rooms:[room],activeRoomId:room.id}));__mount()};
window.__seedEmpty=()=>{window.__controller.destroy();const room=fixtureRoom();room.players[0].adult=false;localStorage.setItem(E.HEART_STORAGE_KEY,JSON.stringify({version:1,rooms:[room],activeRoomId:room.id}));__mount()};
__mount();window.__ready=true;
</script></body></html>`;
const runtimeSource=await readFile(join(workspace,'src/runtime/wanban-app.js'),'utf8');
const watermelonCode=runtimeSource.slice(runtimeSource.indexOf('  function startWatermelon(state) {'),runtimeSource.indexOf('  function startLudo(state) {'));
const watermelonHTML=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#fff6ef}canvas{display:block;width:min(400px,100vw);height:auto;touch-action:none}</style></head><body><div id="wb-gamebox"></div><script>
let gamePaused=false,active=true;const PROGRESS_SAVE_DELAY=700;
window.__errors=[];window.__draws=0;window.__settingsReads=0;window.__saved=null;
window.addEventListener('error',e=>__errors.push(e.message));
const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='wb-watermelon')__draws++;return clear.apply(this,args)};
const qs=s=>document.querySelector(s),getHostWindow=()=>window,getHostDocument=()=>document;
const settings=()=>{__settingsReads++;return {theme:'day'}},isNightTheme=()=>false;
const canvasThemePalette=()=>({top:'#fff8eb',bottom:'#ffd8bc',pattern:'#ffe1cf',border:'#dfb393',text:'#4d3328'});
const speak=()=>{},setScore=(_,score)=>window.__score=score;
const saveProgress=(_,state)=>window.__saved=JSON.parse(JSON.stringify(state));
const showGameOver=()=>window.__over=true;
const registerLegacyGameSave=(_,save,cleanup)=>{const guarded=force=>{if(active)save(force)};guarded.isActive=()=>active;window.__controller={save:()=>guarded(true),destroy:()=>{active=false;cleanup()}};return guarded};
Math.random=()=>.1;
${watermelonCode}
startWatermelon({next:0});window.__ready=true;
</script></body></html>`;
const promptTextReads=[], promptModuleReads=[], promptTextOverrides=new Map();
const generationLogFiles = new Map();
const originalGamePrompt=await readFile(join(workspace,'assets/heart-challenge/text/game.txt'),'utf8');
promptTextOverrides.set('game.txt',originalGamePrompt+'\nBROWSER TXT REVISION ONE');
const server=createServer(async(req,res)=>{
  try {
    if(req.url==='/api/files/upload' && req.method==='POST') {
      let body='';for await(const chunk of req) body+=chunk;
      const {name,data}=JSON.parse(body),path='/user/files/'+name;
      generationLogFiles.set(path,Buffer.from(data,'base64').toString('utf8'));
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({path:path.slice(1)}));return;
    }
    if(generationLogFiles.has(req.url)) {res.setHeader('Content-Type','text/plain;charset=utf-8');res.end(generationLogFiles.get(req.url));return;}
    if(req.url==='/watermelon'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(watermelonHTML);return}
    if(req.url==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);return}
    const path=resolve(workspace,'.'+decodeURIComponent(req.url.split('?')[0]));
    if(!path.startsWith(workspace+sep)){res.writeHead(403);res.end();return}
    const promptPrefix='/assets/heart-challenge/text/';
    if(req.url.startsWith(promptPrefix)) {
      const name=req.url.slice(promptPrefix.length).split('?')[0];promptTextReads.push(name);
      if(promptTextOverrides.has(name)){res.setHeader('Content-Type','text/plain;charset=utf-8');res.end(promptTextOverrides.get(name));return}
    }
    if(req.url.startsWith('/src/heart-challenge/prompts.js')) promptModuleReads.push(req.url);
    const mime={'.txt':'text/plain;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream';
    res.setHeader('Content-Type',mime);res.end(await readFile(path));
  }catch{res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser,client;
class CDP {
  constructor(url){this.next=1;this.pending=new Map();this.ws=new WebSocket(url);this.ready=new Promise((r,j)=>{this.ws.onopen=r;this.ws.onerror=j});this.ws.onmessage=e=>{const m=JSON.parse(e.data);const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}};}
  async call(method,params={}){await this.ready;const id=this.next++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  close(){this.ws.close()}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(expression){const result=await client.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
async function wait(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(30)}throw new Error('Timed out: '+expression)}
async function click(action,value){
  const selector='[data-action="'+action+'"]'+(value===undefined?'':'[data-value="'+value+'"]');
  if(!await evaluate('!!document.querySelector('+JSON.stringify(selector)+')') && ['history','card-records'].includes(action)) await click('record-tools');
  assert.ok(await evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(node=>!node.closest('[inert]')&&node.getClientRects().length);if(!b||b.disabled||b.closest('fieldset:disabled')||b.closest('[inert]'))return false;for(let p=b.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;b.scrollIntoView({block:'nearest'});b.click();return true})()`),'Missing or inaccessible action '+selector);
  await sleep(5);
}
async function field(key,value){
  await evaluate(`(()=>{const f=document.querySelector('[data-field="'+${JSON.stringify(key)}+'"]');if(!f)throw new Error('Missing field '+${JSON.stringify(key)});for(let p=f.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;f.focus();${typeof value==='boolean'?'f.checked='+value:'f.value='+JSON.stringify(String(value))};f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}))})()`);
}
async function viewport(width,height){await client.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});await sleep(100)}
async function screenshot(name){await evaluate('Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect.getComputedTiming().iterations)).map(a=>a.finished))');const data=await client.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(artifactRoot,name+'.png'),Buffer.from(data.data,'base64'))}
async function noScroll(label) {
  await evaluate('Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect.getComputedTiming().iterations)).map(a=>a.finished))');
  const issues = await evaluate(`Array.from(document.querySelectorAll('.hc-play-shell,.hc-play-main,.hc-side-dock,.hc-content,.hc-table,.hc-table-scroll,.hc-controls,.hc-turn-seats,.hc-dialogue,.hc-narrative,.hc-history-panel,.hc-collection-page,.hc-story-book,.hc-archive-layout,.hc-bank-layout,.hc-card-exhibit,.hc-art-card,.hc-lottery,.hc-lottery-cards,.hc-lot-card,.hc-modal,.hc-modal>.hc-scroll,.hc-reading-window,[data-reader-text]')).filter(el=>el.getClientRects().length&&el.clientHeight>0).flatMap(el=>{const rect=el.getBoundingClientRect();return el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2||rect.bottom>innerHeight+1?[{name:el.className||el.tagName,h:el.clientHeight,sh:el.scrollHeight,w:el.clientWidth,sw:el.scrollWidth,bottom:rect.bottom}]:[]})`);
  assert.deepEqual(issues,[],label+' must fit without scrolling or clipped reading text');
  const emptyReaders=await evaluate(`[...document.querySelectorAll('[data-reader-text]')].filter(el=>el.getClientRects().length&&el.textContent&&el.clientHeight<parseFloat(getComputedStyle(el).lineHeight)).map(el=>({height:el.clientHeight,reader:el.closest('[data-reader]').dataset.reader}))`);
  assert.deepEqual(emptyReaders,[],label+' must leave space for at least one full text line');
}
async function checkThemeContrast(label) {
  const issues = await evaluate(`(()=>{const ctx=document.createElement('canvas').getContext('2d');const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4})};const lum=c=>{const v=rgb(c);return v[0]*.2126+v[1]*.7152+v[2]*.0722};const sample=document.createElement('span');sample.style.color='var(--hc-paper)';document.querySelector('.hc-app').append(sample);const paper=lum(getComputedStyle(sample).color);sample.remove();return [...document.querySelectorAll('[data-reader-text],.hc-speaking small,.hc-line-copy>b,.hc-dock-button,.hc-art-header>span')].filter(el=>el.clientHeight>0).flatMap(el=>{const background=el.closest('.hc-art-card')?lum(getComputedStyle(el).getPropertyValue('--hc-paper')):paper;const ink=lum(getComputedStyle(el).color),ratio=(Math.max(ink,background)+.05)/(Math.min(ink,background)+.05);return ratio<4.5?[{class:el.className||el.tagName,ratio}]:[]})})()`);
  assert.deepEqual(issues,[],label+' readable theme colors');
}
async function layout(label){const result=await evaluate(`(()=>{const root=document.querySelector('.hc-app'),content=document.querySelector('.hc-content');const controls=document.querySelector('.hc-controls'),popup=document.querySelector('#wanbanXiaowu-popup');return {width:innerWidth,scroll:root.scrollWidth,client:root.clientWidth,height:content.clientHeight,rootBottom:root.getBoundingClientRect().bottom,popupHeight:popup.clientHeight,popupBottom:popup.getBoundingClientRect().bottom,controls:controls?{height:controls.clientHeight,bottom:controls.getBoundingClientRect().bottom,scroll:controls.scrollHeight}:null,viewport:innerHeight}})()`);console.log('Layout:',label,JSON.stringify(result));assert.ok(result.scroll<=result.client+1,label+' horizontal overflow '+JSON.stringify(result));assert.ok(result.height>60,label+' no usable content height');if(result.controls){assert.ok(result.controls.height>35,label+' controls collapsed');assert.ok(result.controls.bottom<=result.viewport+2,label+' controls below screen')}}
async function walkTo(stage){for(let i=0;i<1500;i++){const active=await evaluate('__active()');if(active.run.stage===stage)return;if(active.run.stage==='open' && await evaluate('document.querySelector("[data-reader=narrative]")?.dataset.readerEnd!=="true"'))await click('read-page','narrative:1');else if(['pickType','pick'].includes(active.run.stage))await click(active.run.stage==='pickType'?'type':'draw',active.run.stage==='pickType'?'T':active.run.offered[0]);else if(active.run.stage==='reveal')await click('accept');else if(active.run.stage==='choice')await click('option','reserved');else await click('next')}throw new Error('Did not reach '+stage)}
try {
  const endpoint=await new Promise((resolve,reject)=>{
    browser=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    browser.once('error',reject);browser.stderr.on('data',data=>{const match=String(data).match(/DevTools listening on (ws:\/\/\S+)/);if(match)resolve(match[1])});browser.once('exit',code=>reject(new Error('Browser exited '+code)));
  });
  const address=new URL(endpoint).host;
  const tabs=await (await fetch('http://'+address+'/json/list')).json();
  client=new CDP(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await client.call('Page.enable');await client.call('Runtime.enable');await viewport(1366,900);await client.call('Page.navigate',{url:base});await wait('window.__ready===true');
  if (!process.env.HEART_TEST_COLLECTIONS_ONLY) {
  await layout('desktop rooms');
  assert.equal(await evaluate('document.body.textContent.includes("为相遇，留一个位置") || document.body.textContent.includes("今晚，从哪一句开始？")'),false);
  await click('add-room');
  const worldFields=()=>evaluate('Array.from(document.querySelectorAll(".hc-world-form [data-field]")).map(e=>e.dataset.field)');
  const expected=['world.injection.lazyWorldInject','world.injection.injectUserDesc','world.injection.userDescSource','world.injection.injectCharDesc','world.injection.charDescMode','world.injection.specialLanguageEnabled','world.injection.injectChat','world.breakLimitPrompt','world.injection.worldAutoMountMode','world.user.name','world.supplemental'];
  for(const id of ['current-card:P1','world']) {
    await field('worldSource',id);await click('import-world');
    const fields=await worldFields();for(const key of expected)assert.ok(fields.includes(key),id+' '+key);
    assert.equal(fields.at(-1),'world.supplemental','supplement is the final editable field');
    assert.equal(await evaluate('document.querySelectorAll("[data-field^=entry]").length'),1);
  }
  await field('title','雨夜小聚');await field('world.user.name','小栀');
  await evaluate('window.__worldDelay=100');
  await field('world.injection.charDescMode','auto');
  await field('world.injection.charDescMode','manual');await field('world.character.manualDescription','后写入的手动描述');
  await sleep(150);assert.equal(await evaluate('__active().room.world.injection.charDescMode'),'manual','late read cannot reset manual mode');
  await field('world.injection.charDescMode','auto');await field('world.injection.injectChat',true);
  await wait('__active().room.world.character.description==="角色卡全部描述" && __active().room.world.chat==="最新聊天记录内容"');
  assert.equal(await evaluate('__active().room.world.injection.charDescMode'),'auto','independent reads both complete');
  await evaluate('window.__worldDelay=0');await field('world.injection.injectChat',false);

  await field('world.injection.lazyWorldInject',true);await wait('__active().room.world.injection.lazyWorldInject && __active().room.world.entries.length===2');
  assert.equal(await evaluate('__active().room.world.user.name'),'小栀');
  assert.equal(await evaluate('__active().room.world.injection.injectChat'),false,'lazy mode matches settings and does not enable chat');
  await field('world.injection.userDescSource','manual');await field('world.user.persona','本次用户手动设定');
  await field('world.injection.charDescMode','manual');await field('world.character.manualDescription','本次角色手动设定');
  await field('world.injection.specialLanguageEnabled',true);await field('world.language','日语');
  await field('world.injection.injectChat',true);await wait('__active().room.world.chat==="最新聊天记录内容"');
  await field('world.breakLimitPrompt','本次前置提示词');
  await field('world.injection.worldAutoMountMode','blue');await wait('__active().room.world.entries.length===1');
  await field('world.injection.worldAutoMountMode','');await click('refresh-worldbook');
  assert.deepEqual(await evaluate('__active().room.world.entries.map(e=>e.enabled)'),[true,false],'manual refresh retains selection');
  await field('world.supplemental','本次游戏从停雨前开始。');
  await screenshot('desktop-world');await viewport(390,844);await layout('mobile world');await screenshot('mobile-world');await viewport(1366,900);
  await click('save-world');
  assert.equal(await evaluate('document.querySelectorAll(".hc-player-editor")[0].querySelectorAll("textarea").length'),0,'world role only asks for a name');
  assert.equal(await evaluate('document.querySelector("[data-field=\\"userAdult\\"]")'),null,'USER adult option is removed');await field('world.user.avatarMode','auto');await click('user-avatar');assert.equal(await evaluate('document.querySelectorAll(".hc-avatar-choice").length'),15,'USER can choose from 15 pixel avatars');await click('choose-avatar','2');await click('player-avatar','P1');assert.equal(await evaluate('document.querySelectorAll(".hc-avatar-choice").length'),15,'15 default pixel avatars');assert.equal(await evaluate('document.querySelectorAll(".hc-avatar-choice img").length'),0,'default picker excludes tavern card images');await click('close-overlay');
  await field('world.user.avatarMode','emoji');await field('world.user.avatar','🦉');
  assert.notEqual(await evaluate('__active().room.world.user.avatar'),'🦉','emoji edit waits for confirmation');
  await click('confirm-emoji','USER');
  assert.equal(await evaluate('__active().room.world.user.avatar'),'🦉');
  assert.equal(await evaluate('document.querySelector(".hc-player-editor.hc-wide .hc-emoji-avatar").textContent'),'🦉','USER portrait updates immediately');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".hc-player-editor.hc-wide .hc-emoji-avatar")).backgroundColor'),'rgb(255, 255, 255)');
  await field('world.user.avatar','小狐');await evaluate('document.querySelector("[data-emoji-target=USER]").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}))');
  assert.equal(await evaluate('__active().room.world.user.avatar'),'小狐','Enter confirms short text');
  await field('config.mode','multi');await click('add-player','custom');
  assert.ok(await evaluate('!!document.querySelector(".hc-modal [data-field=cardImport]")'),'new character offers card import');
  await field('cardImport','P2');
  assert.equal(await evaluate('__active().room.players[1].name'),'夏弥');
  assert.equal(await evaluate('__active().room.players[1].description'),'成年旅伴，勇敢但温柔，善于用玩笑化解尴尬。','import uses the chosen card description');
  assert.equal(await evaluate('__active().room.players[1].cardId'),'P2');
  assert.equal(await evaluate('document.querySelector(".hc-modal")'),null,'selecting a card applies immediately');
  await click('remove-player','P2');await click('add-player','custom');await click('create-custom-player');await field('players.1.name','夏弥');await field('players.1.description','成年旅伴，谨慎但会接住朋友的玩笑。');await field('players.1.avatarMode','card');await click('player-card-avatar','P2');assert.equal(await evaluate('document.querySelectorAll("[data-action=\\"choose-card-avatar\\"]").length'),2,'card avatar gallery reads every tavern card');assert.equal(await evaluate('document.querySelector("[data-action=choose-card-avatar]").dataset.value'),'P1','imported world card is first even when tavern order differs');assert.ok((await evaluate('document.querySelector("[data-action=choose-card-avatar] img").getAttribute("src")')).endsWith('?world'),'gallery uses the imported portrait');await screenshot('desktop-card-avatars');await click('choose-card-avatar','P1');assert.equal(await evaluate('__active().room.players[1].cardAvatar'),'/assets/default-avatars-pixel.png?world','selecting first portrait saves the world card image');assert.equal(await evaluate('document.querySelector("[data-field=\\"players.1.avatar\\"]")'),null,'card mode has no URL input');await field('players.1.avatarMode','emoji');assert.equal(await evaluate('document.querySelector("[data-field=\\"players.1.avatar\\"]").type'),'text','emoji mode has only a text input');await field('players.1.avatar','<猫>');await click('confirm-emoji','P2');
  assert.equal(await evaluate('__active().room.players[1].avatar'),'<猫>');
  assert.ok(await evaluate('Array.from(document.querySelectorAll(".hc-emoji-avatar")).some(el=>el.textContent==="<猫>" && el.children.length===0)'),'NPC short text updates as escaped text');
  await screenshot('desktop-emoji-settings');
  await field('players.1.avatarMode','url');assert.equal(await evaluate('document.querySelector("[data-field=\\"players.1.avatar\\"]").type'),'url','URL mode has a URL input');await field('players.1.avatarMode','auto');assert.equal(await evaluate('document.querySelector("[data-field=\\"players.1.avatar\\"]")'),null,'default mode has no URL or text input');
  assert.equal(await evaluate('document.querySelectorAll("[data-style]").length'),9,'nine MODULE 0 situation styles are separate from card styles');await field('config.source','random');assert.equal(await evaluate('document.querySelector("details[data-section=bank-design]").open'),false,'optional design settings are collapsed initially');assert.equal(await evaluate('document.querySelectorAll("[data-bank-theme]").length'),12,'twelve MODULE 0 card styles');assert.equal(await evaluate('document.querySelectorAll("[data-bank-keyword]").length'),7,'seven selectable card keywords');await field('config.customTheme','雨夜默契');assert.equal(await evaluate('document.querySelector("[data-field=\\"config.swaps\\"]")'),null,'swap count is fixed');assert.equal(await evaluate('document.body.textContent.includes("USER 每次行动最多换牌 1 次")'),false,'redundant swap hint is removed');await field('config.source','builtin');
  assert.equal(await evaluate('__active().room.config.narrativePerson'),'second');
  assert.deepEqual(await evaluate('Array.from(document.querySelector("[data-field=\\"config.narrativePerson\\"]").options).map(o=>o.value)'),['first','second','third']);
  await field('config.narrativePerson','first');
  assert.equal(await evaluate('__active().room.config.narrativePerson'),'first');
  await field('config.rounds',2);await field('config.orderMode','manual');await field('config.api','test-api');await field('config.replyApi','quick-api');
  await evaluate('document.querySelectorAll("details[data-section]").forEach(d=>d.open=false)');await layout('desktop settings');await screenshot('desktop-settings');await click('prepare-order');await click('order-seat','P1');await click('order-seat','USER');await click('order-seat','P2');await evaluate('window.__invalid=true;window.__tailCutoff=true');await click('generate');await wait('__active().run?.stage==="open"');assert.equal(await evaluate('__active().game.snapshot.players[0].description'),'','world-role seat stores name only');
  assert.equal(await evaluate('window.__tailCutoff'),false,'complete story survives a transport cutoff in ignored trailing text');
  const initialLogs = await evaluate('__read().generationLogs');
  assert.equal(initialLogs.length, 2, 'failed generation and retry are retained separately');
  assert.equal(initialLogs[0].status, 'failed');
  assert.equal(initialLogs[0].raw, '<cards>broken</cards><story></story>');
  assert.ok(initialLogs[0].error);
  assert.equal(initialLogs[1].status, 'success');
  assert.ok(initialLogs[1].raw.includes('【世界观设定】'), 'raw logs retain ignored trailing output');
  assert.equal(await evaluate('window.__stoppedTooEarly'),false,'split closing tags do not stop a partial story');
  assert.equal(await evaluate('window.__stoppedAtStory'),true,'validated story aborts transport before a trailing world can continue');
  assert.equal(await evaluate('__calls[0].aborted'),false,'invalid content with a closing tag must still regenerate');
  assert.equal(await evaluate('JSON.stringify(__active().game.content).includes("多余尾文")'),false);
  const generated=await evaluate('__calls[0].prompt');
  assert.ok(generated.includes('【人称】：'+String.fromCharCode(10)+'第一人称（USER 是“我”）'));
  assert.ok(promptModuleReads.some(url=>url.includes('?v=4.1.13-heart-logs')),'browser loads the updated placeholder resolver');
  assert.ok(generated.includes('【局势风格】：'+String.fromCharCode(10)+'无要求'));
  assert.ok(!generated.includes('懒人模式：'),'lazy control is not narrative input');
  for(const value of ['小栀','本次用户手动设定','本次角色手动设定','使用日语并附中文翻译','最新聊天记录内容','本次前置提示词','蓝灯世界书内容','本次游戏从停雨前开始。'])assert.ok(generated.includes(value),value);
  assert.ok(!generated.includes('绿灯世界书内容'),'unselected book is excluded');
  assert.ok((await evaluate('__calls[0].prompt')).includes('BROWSER TXT REVISION ONE'),'request uses TXT file content');
  assert.equal(await evaluate('__calls[0].system ?? null'),null,'complete document is the only input');
  assert.equal(await evaluate('__calls[0].prompt === __calls[1].prompt'),true,'regeneration uses identical input');
  await click('room-settings');await click('view-input');
  const injected=generated.split('以下为游戏核心参数输入：').at(-1).split('\n</game_input>')[0].trim();
  for(const [w,h] of [[1366,900],[390,844],[320,568],[568,320]]) {
    await viewport(w,h);
    assert.equal(await evaluate('document.querySelector(".hc-full-input").textContent'),injected,'preview contains all injected data without the TXT task');
    assert.ok(await evaluate('(()=>{const e=document.querySelector(".hc-full-input"),r=e.getBoundingClientRect();e.scrollTop=e.scrollHeight;return e.clientHeight>80 && r.top>=0 && r.bottom<=innerHeight && e.scrollWidth<=e.clientWidth+1 && e.scrollTop>0 && Math.abs(e.scrollHeight-e.clientHeight-e.scrollTop)<2})()'),'input fits and scrolls to the end '+w+'x'+h);
    assert.ok(await evaluate('document.querySelector("[data-action=export-input]").getBoundingClientRect().bottom<=innerHeight'),'export stays reachable');
    await noScroll('full input dialog '+w+'x'+h);
  }
  await viewport(390,844);await screenshot('mobile-full-input');
  await click('close-overlay');await click('close-room-settings');await viewport(1366,900);
  assert.equal(promptTextReads.filter(name=>name==='game.txt').length,1,'automatic regeneration reuses the same prompt version');
  assert.equal(await evaluate('__calls.length'),2,'one automatic regeneration');await walkTo('choice');await layout('desktop choice');await screenshot('desktop-table');
  const saved=await evaluate('JSON.stringify(__active().run)');await client.call('Page.reload');await wait('window.__ready===true');assert.equal(await evaluate('JSON.stringify(__active().run)'),saved,'refresh restores choice exactly');
  await click('free-toggle');await evaluate(`(()=>{const input=document.querySelector('#hc-free-input');input.value='我想先听你多说一点。';input.dispatchEvent(new Event('input',{bubbles:true}))})()`);await evaluate('window.__replyState="wait";window.__shortReply=true');await click('submit-free');await wait('__active().run.stage==="story"');await walkTo('choice');assert.equal(await evaluate('__calls.at(-1).api'),'quick-api');
  assert.equal(await evaluate('__calls.filter(call=>call.task==="reply").length'),2,'short supplemental reply triggers one automatic regeneration');
  assert.ok((await evaluate('__calls.at(-1).prompt')).includes('【人称】：'+String.fromCharCode(10)+'第一人称（USER 是“我”）'));
  assert.equal(await evaluate('__calls.at(-1).prompt === __calls.at(-2).prompt'),true,'reply regeneration retains the original input');
  assert.equal(await evaluate('__active().run.awaitingReply'),true,'follow-up state persists');
  assert.ok(await evaluate('!!document.querySelector("#hc-free-input")'),'follow-up opens the composer');
  await click('return-options');await viewport(390,844);await layout('mobile choice');await screenshot('mobile-table');await click('record-tools');await layout('mobile tools');await screenshot('mobile-menu');
  assert.ok(await evaluate('document.querySelector(".hc-main-shell").inert'),'menu prevents background interaction');
  await click('close-overlay');await click('free-toggle');await viewport(390,460);await layout('mobile keyboard');await screenshot('mobile-keyboard');await viewport(844,390);await layout('landscape');await viewport(390,844);await click('return-options');
  await click('option','reserved');await walkTo('turnEnd');await click('restart-turn');await click('confirm-overlay');assert.equal(await evaluate('__active().run.branches.length'),1);await click('accept');await walkTo('settlement');
  assert.equal(await evaluate('__calls.filter(call=>call.task==="ending").length'),0,'completing all rounds does not automatically request an ending');
  assert.equal(promptTextReads.filter(name=>name==='ending.txt').length,0,'normal play never loads the ending prompt');
  assert.equal(await evaluate('__active().run.records.length'),6);
  assert.equal(await evaluate('document.querySelectorAll(".hc-settlement-card").length'),6);
  assert.equal(await evaluate('document.querySelector(".hc-settlement [data-action=record-tools]")'),null);
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".hc-settlement-owner strong")].map(e=>e.textContent)'),await evaluate('__active().run.records.map(r=>r.actor==="USER"?__active().game.snapshot.world.user.name:__active().game.snapshot.players.find(p=>p.id===r.actor).name)'));
  await screenshot('mobile-settlement');await click('room-settings');await click('close-room-settings');
  assert.equal(await evaluate('document.querySelector("[data-action=record-tools]")'),null,'settlement has no records button');
  await click('rooms');await click('select-room',await evaluate('__read().activeRoomId'));await click('history');const historySave=await evaluate('JSON.stringify(__active().run)');await evaluate('document.querySelector(".hc-archive-scroll").scrollTop=300');assert.equal(await evaluate('JSON.stringify(__active().run)'),historySave,'replay must be read-only');await click('resume');await evaluate('window.__invalid=true');await click('ending');await wait('__active().run.stage==="ending"');
  assert.equal(await evaluate('__calls.filter(c=>c.task==="ending").length'),2);
  assert.equal(await evaluate('__calls.at(-1).prompt===__calls.at(-2).prompt'),true,'ending regeneration reuses original input');
  const loggedTasks = await evaluate('__read().generationLogs.map(entry=>entry.task)');
  for (const task of ['game','reply','ending']) assert.ok(loggedTasks.includes(task), task+' output logged');
  await click('room'); await click('generation-logs');
  await click('view-generation-log',await evaluate('__read().generationLogs.at(-1).id'));
  assert.ok(await evaluate('document.querySelector(".hc-full-input").textContent.includes("===== 原始输出 =====")'));
  await layout('mobile generation log'); await click('close-overlay'); await click('resume');

  await layout('mobile ending');await screenshot('mobile-ending');
  await evaluate(`(()=>{const s=__read(),r=s.rooms.find(item=>item.id===s.activeRoomId);r.config.source='random';r.config.randomStyles=['日常闲聊'];delete r.config.bankThemes;delete r.config.bankKeywords;localStorage.setItem('wanbanXiaowu_heartChallenge_v1',JSON.stringify(s));__mount()})()`);await click('setup');assert.equal(await evaluate('document.querySelectorAll("[data-bank-theme]:checked").length'),1,'legacy next-game settings migrate before rendering');assert.deepEqual(await evaluate('__errors'),[],'opening the next game from a legacy room must not throw');await field('config.source','builtin');await field('config.rounds',1);await field('config.orderMode','fate');await click('prepare-order');await evaluate(`document.querySelector('#hc-fate-number').value='37'`);await click('fate');const fate=await evaluate('JSON.stringify(__active().room.pendingOrder)');await click('reveal-fate');assert.equal(await evaluate('__active().room.pendingOrder.target'),JSON.parse(fate).target);await layout('mobile fate');await screenshot('mobile-fate');
  await evaluate('window.__delay=3000');await click('generate');await wait('!!document.querySelector("[data-progress]")');assert.ok(await evaluate('!!document.querySelector(".hc-live-output [data-output]")'),'stream output disclosure exists');assert.equal(await evaluate('document.querySelector("[data-action=live-output]")'),null,'full output button is removed');await wait('document.querySelector("[data-action=view-input]")?.disabled===false');await click('view-input');assert.ok(await evaluate('document.querySelector(".hc-full-input").textContent.startsWith("【世界观设定】：")'));await click('close-overlay');await click('cancel');assert.equal(await evaluate('__active().game.request.status'),'cancelled');assert.equal(await evaluate('__active().game.content'),null);await evaluate('window.__delay=10;window.__networkFailures=2');await click('retry');await wait('__active().game.request.status==="failed"');await click('retry');await wait('__active().run?.stage==="open"');
  assert.equal(await evaluate('__active().game.previous.length'),1,'next game imports actual prior play');
  await evaluate('__seed(4,1)');await walkTo('settlement');assert.equal(await evaluate('__active().run.records.length'),8);await click('replay-game');await click('confirm-overlay');assert.equal(await evaluate('__active().game.runs.length'),2);assert.equal(await evaluate('__active().run.records.length'),0);
  const roomId=await evaluate('__active().room.id');await click('rooms');const roomCount=await evaluate('__read().rooms.length');await click('delete-room',roomId);assert.ok(await evaluate('document.querySelector(".hc-modal")?.textContent.includes("删除房间")'),'room-list delete requires confirmation');await click('confirm-overlay');assert.equal(await evaluate('__read().rooms.length'),roomCount-1,'confirmed room deletion removes storage record');assert.equal(await evaluate('document.querySelector(".hc-library")?.textContent.includes("暂无存档")'),true,'deletion returns to empty room list');assert.ok(await evaluate('document.querySelector(".hc-notice")?.textContent.includes("已删除房间")'),'successful deletion is visibly acknowledged');
  await evaluate('__seed(1,1)');await walkTo('choice');await viewport(390,844);
  assert.ok(await evaluate('!!document.querySelector(".hc-dialogue .hc-line-copy [data-reader-text]")'),'choices retain the preceding dialogue');
  assert.equal(await evaluate('document.querySelectorAll(".hc-choices [data-action=free-toggle]").length'),0,'free input is separate from authored choices');
  const choiceSnapshot=await evaluate('JSON.stringify(__active().run)');
  await evaluate('document.querySelector(".hc-choice-prompt").dispatchEvent(new KeyboardEvent("keydown",{key:" ",bubbles:true,cancelable:true}))');
  assert.equal(await evaluate('JSON.stringify(__active().run)'),choiceSnapshot,'reading shortcuts cannot choose a branch');
  await click('free-toggle');
  await evaluate(`window.__writes=0;window.__originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){__writes++;return __originalSet.apply(this,args)};const input=document.querySelector('#hc-free-input');for(let i=0;i<40;i++){input.value='留下这句尚未发出的话'+i;input.dispatchEvent(new Event('input',{bubbles:true}))}`);
  assert.equal(await evaluate('__writes'),0,'typing does not synchronously rewrite the full save');
  await evaluate('window.__controller.save()');assert.equal(await evaluate('__writes'),1,'closing flushes one draft write');
  assert.equal(await evaluate('__active().run.freeDraft'),'留下这句尚未发出的话39');
  await evaluate('Storage.prototype.setItem=__originalSet');await client.call('Page.reload');await wait('window.__ready===true');await click('free-toggle');
  assert.equal(await evaluate('document.querySelector("#hc-free-input").value'),'留下这句尚未发出的话39','unsent words survive refresh');
  await viewport(390,460);
  assert.ok(await evaluate('(()=>{const input=document.querySelector("#hc-free-input"),button=document.querySelector("[data-action=submit-free]");return input.getBoundingClientRect().top>=0&&button.getBoundingClientRect().bottom<=innerHeight+1})()'),'keyboard leaves both input and send visible');
  await viewport(390,844);await evaluate('window.__networkFailures=2');await click('submit-free');await wait('__active().game.request.status==="failed"');
  await click('option','reserved');assert.equal(await evaluate('__active().game.error'),null,'choosing a branch clears a stale reply retry');
  await walkTo('settlement');assert.equal(await evaluate('__active().run.records.length'),2,'final turn goes directly to settlement');
  await evaluate('__seed(1,5)');await walkTo('choice');await viewport(320,568);await layout('small-screen six seats');await screenshot('small-screen-table');
  assert.ok(await evaluate('document.querySelector(".hc-turn-seats").scrollWidth<=document.querySelector(".hc-turn-seats").clientWidth+1'),'all six seats fit without horizontal scrolling');
  await noScroll('six seats on a small screen');
  await click('free-toggle');await viewport(568,320);await layout('small landscape composer');assert.ok(await evaluate('(()=>{const input=document.querySelector("#hc-free-input"),button=document.querySelector("[data-action=submit-free]");return input.getBoundingClientRect().top>=0&&button.getBoundingClientRect().bottom<=innerHeight+1})()'),'small landscape input and send remain visible');await screenshot('small-landscape-composer');
  await viewport(1366,900);await click('return-options');await click('option','warm');
  const readingBefore=await evaluate('__active().run.history.length');await evaluate('document.querySelector(".hc-dialogue").dispatchEvent(new KeyboardEvent("keydown",{key:" ",bubbles:true,cancelable:true}))');
  assert.equal(await evaluate('__active().run.history.length'),readingBefore+1,'space advances exactly one spoken line');
  await evaluate('document.querySelector(".hc-dialogue").dispatchEvent(new KeyboardEvent("keydown",{key:" ",repeat:true,bubbles:true,cancelable:true}))');
  assert.equal(await evaluate('__active().run.history.length'),readingBefore+1,'holding space cannot skip lines');
  assert.deepEqual(await evaluate('__errors'),[],'browser errors');
  await evaluate('__seedEmpty()');
  await click('setup');await field('config.nsfw',true);
  assert.equal(await evaluate('document.querySelectorAll("[data-field$=adult]").length'),0,'no repeated adulthood confirmations');
  await field('config.source','random');
  assert.equal(await evaluate('document.querySelector("details[data-section=bank-design]").open'),false,'free-design requirements start collapsed');
  await field('config.orderMode','manual');await click('prepare-order');await click('order-seat','USER');await click('order-seat','P1');
  const beforeTemplateFailure=await evaluate('__calls.length');promptTextOverrides.set('game.txt','');await click('generate');
  await wait('__active().game.request.status==="failed"');
  assert.equal(await evaluate('__calls.length'),beforeTemplateFailure,'invalid TXT cannot trigger a model request');
  assert.ok((await evaluate('__active().game.error.message')).includes('game.txt'));
  promptTextOverrides.set('game.txt',originalGamePrompt+'\nBROWSER TXT REVISION TWO');
  await click('retry');
  await wait('__active().run?.stage==="open"');
  assert.ok((await evaluate('__calls.at(-1).prompt')).includes('BROWSER TXT REVISION TWO'),'manual retry reloads edited TXT without a page refresh');
  assert.ok(!(await evaluate('__calls.at(-1).prompt')).includes('BROWSER TXT REVISION ONE'));
  assert.equal(await evaluate('__calls.at(-1).system ?? null'),null);
  assert.deepEqual(await evaluate('__active().game.snapshot.config.bankThemes'),[]);
  assert.deepEqual(await evaluate('__active().game.snapshot.config.bankKeywords'),[]);
  assert.equal(await evaluate('__active().game.snapshot.config.customTheme'),'');
  assert.equal(await evaluate('__active().game.snapshot.config.keywords'),'');
  assert.equal(await evaluate('__active().game.snapshot.config.nsfw'),true);
  await walkTo('settlement');
  assert.deepEqual(await evaluate('__errors'),[],'free-design browser errors');
  console.log('PASS: empty free-design bank completes without per-character adulthood confirmation.');
  console.log('PASS: world injection, settings, regeneration, multiplayer, duo, fate, reply, refresh, replay, ending, cancel and retry.');
  await evaluate(`(()=>{__seed(1,5);__controller.destroy();const s=__read(),g=s.rooms[0].games[0];window.__longText=('灯火映在杯沿，你听见窗外的雨声。👨‍👩‍👧‍👦 这一段长对白需要完整保留，每一页都可以返回阅读。').repeat(40);g.content.open=__longText;g.content.cards[0].beats[0].text=__longText;localStorage.setItem('wanbanXiaowu_heartChallenge_v1',JSON.stringify(s));__mount()})()`);
  await viewport(320,568);await noScroll('long opening');
  const startVisible=()=>evaluate('getComputedStyle(document.querySelector(".hc-opening [data-action=next]")).visibility!=="hidden"');
  assert.equal(await startVisible(),false,'opening start button waits for the last reading page');
  let opening='';
  for(let i=0;i<300;i++) {
    opening+=await evaluate('document.querySelector("[data-reader=narrative] [data-reader-text]").textContent');
    if(await evaluate('document.querySelector("[data-reader=narrative]").dataset.readerEnd==="true"')) break;
    assert.equal(await startVisible(),false);
    await click('read-page','narrative:1');
  }
  assert.equal(opening,await evaluate('__longText'));
  assert.equal(await startVisible(),true);
  await click('read-page','narrative:-1');assert.equal(await startVisible(),false);
  await click('read-page','narrative:1');assert.equal(await startVisible(),true);
  await click('next');assert.equal(await evaluate('__active().run.stage'),'turnIntro','opening goes straight to the first actor');
  await click('next');assert.equal(await evaluate('__active().run.stage'),'reveal');
  for(const [width,height] of [[1366,900],[390,844],[320,568],[568,320],[844,390]]) {
    await viewport(width,height);
    assert.equal(await evaluate('document.querySelector(".hc-dialogue [data-reader]")'),null,'short draw declaration has no pagination');
    assert.ok(await evaluate('(()=>{const d=document.querySelector(".hc-dialogue"),p=d.querySelector(".hc-line-copy>p");return p.textContent.length>1 && p.clientHeight+1>=parseFloat(getComputedStyle(p).lineHeight) && d.getClientRects().length>0 && p.scrollWidth<=p.clientWidth+1})()'),'complete declaration is visible at '+width+'x'+height);
    await noScroll('NPC draw declaration '+width+'x'+height);
  }
  await viewport(390,844);await screenshot('mobile-draw-declaration');
  await viewport(320,568);await click('accept');await noScroll('long dialogue');
  const lineHistory=await evaluate('__active().run.history.length');
  let joined='';
  for(let page=0;page<300;page++) {
    joined+=await evaluate('document.querySelector("[data-reader=dialogue] [data-reader-text]").textContent');
    if(await evaluate('document.querySelector("[data-value=\\"dialogue:1\\"]").disabled'))break;
    await click('read-page','dialogue:1');await noScroll('dialogue page '+page);
  }
  assert.equal(joined,await evaluate('__longText'),'pagination retains all original text and graphemes');
  assert.equal(await evaluate('__active().run.history.length'),lineHistory,'page turns do not advance the story');
  await click('read-page','dialogue:-1');
  const currentText=await evaluate('document.querySelector("[data-reader=dialogue] [data-reader-text]").textContent');
  await client.call('Page.reload');await wait('window.__ready===true');
  await wait('document.querySelector("[data-reader=dialogue]")?.dataset.readerPages>1');
  assert.equal(await evaluate('document.querySelector("[data-reader=dialogue] [data-reader-text]").textContent'),currentText,'reload restores the reading page');
  await viewport(568,320);await noScroll('long dialogue landscape');
  await screenshot('landscape-room');
  await viewport(1366,900);await noScroll('long dialogue desktop');
  await walkTo('choice');
  await evaluate(`(()=>{__controller.destroy();const s=__read(),g=s.rooms[0].games[0],r=g.runs.find(r=>r.id===g.activeRunId);const choice=r.current;window.__longOption='认真说明此刻的想法，并请对方给自己一点考虑的时间。'.repeat(12);choice.options[0].text=__longOption;choice.options.push({...choice.options[0],id:'extra',text:'换一个角度询问刚才的话题'},{...choice.options[1],id:'quiet',text:'保留答案，暂时安静地听一会儿'});localStorage.setItem('wanbanXiaowu_heartChallenge_v1',JSON.stringify(s));__mount()})()`);
  for(const [width,height] of [[320,568],[390,844],[568,320],[844,390],[1366,900]]) {
    await viewport(width,height);await noScroll('four choices '+width+'x'+height);
  }
  for(const theme of ['day','arcade','spring','night','mono','cyber','cardtheater','tavern']) {
    await evaluate(`document.querySelector('#wanbanXiaowu-popup').className='wb-${theme} wb-tab-intimacy'`);await sleep(60);await checkThemeContrast('dialogue '+theme);
  }
  await screenshot('room-dark-red');await evaluate("document.querySelector('#wanbanXiaowu-popup').className='wb-day wb-tab-intimacy'");
  await click('round-replay');await noScroll('current round archive');await screenshot('round-replay-desktop');await click('resume');
  await click('banks');await noScroll('system card banks');assert.equal(await evaluate('document.querySelectorAll(".hc-bank-tile").length'),2);await click('close-collection');
  assert.equal(await evaluate('document.querySelectorAll("[data-action=more-tools]").length'),0);
  await viewport(320,568);await click('inspect-option','warm');await noScroll('full option dialog');
  await click('close-overlay');await click('card-records');await noScroll('card archive front');await click('flip-record-card','0');await noScroll('card archive back');await screenshot('card-record-back-mobile');await click('resume');
  await click('history');await noScroll('full history page');await screenshot('history-mobile');await viewport(568,320);await noScroll('history landscape');await click('resume');
  await click('record-tools');await noScroll('record selector landscape');await click('close-overlay');
  const beforeSettings = await evaluate('JSON.stringify(__active().run)');
  await click('room-settings');await field('config.replyApi','quick-api');await field('config.rounds',2);await click('close-room-settings');
  assert.equal(await evaluate('__active().room.config.rounds'),2);assert.equal(await evaluate('__active().game.snapshot.config.rounds'),1);
  assert.equal(await evaluate('__active().game.snapshot.config.replyApi'),'quick-api');assert.equal(await evaluate('JSON.stringify(__active().run)'),beforeSettings);
  await evaluate(`(()=>{__controller.destroy();const s=__read(),g=s.rooms[0].games[0];g.error={task:'reply',message:'测试补充回复失败',raw:'测试失败原文'};localStorage.setItem('wanbanXiaowu_heartChallenge_v1',JSON.stringify(s));__mount()})()`);
  await viewport(320,568);await noScroll('reply failure portrait');await viewport(568,320);await noScroll('reply failure landscape');
  await evaluate(`(()=>{__controller.destroy();const s=__read(),g=s.rooms[0].games[0];g.error=null;localStorage.setItem('wanbanXiaowu_heartChallenge_v1',JSON.stringify(s));__mount()})()`);
  await viewport(390,844);await click('option','reserved');await walkTo('pickType');await noScroll('choose card type');await screenshot('card-types-mobile');
  await click('type','T');await noScroll('card backs');await screenshot('card-backs-mobile');
  await click('draw',(await evaluate('__active().run.offered'))[0]);await noScroll('revealed card');await screenshot('card-face-mobile');
  for(const theme of ['day','arcade','spring','night','mono','cyber','cardtheater','tavern']) {
    await evaluate(`document.querySelector('#wanbanXiaowu-popup').className='wb-${theme} wb-tab-intimacy'`);await sleep(60);await checkThemeContrast('card '+theme);await noScroll('card '+theme);
    if(['day','night','cardtheater'].includes(theme))await screenshot('card-'+theme);
  }
  await evaluate("document.querySelector('#wanbanXiaowu-popup').className='wb-day wb-tab-intimacy'");
  await viewport(568,320);await noScroll('card landscape');await viewport(320,568);await noScroll('card small portrait');await viewport(390,844);
  await click('accept');await walkTo('settlement');await noScroll('settlement');
  await viewport(568,320);await noScroll('settlement landscape');
  assert.deepEqual(await evaluate('__errors'),[],'fixed room layout browser errors');
  console.log('PASS: fixed room layout, complete paginated text, reading-position reload, four choices and long option inspection.');
  }
  if (process.env.HEART_TEST_PREVIEW_STORE) {
    const stored = JSON.parse(await readFile(process.env.HEART_TEST_PREVIEW_STORE, 'utf8'));
    const sourceRoom = stored.rooms.find(room => room.id === stored.activeRoomId);
    const sourceGame = sourceRoom.games.find(game => game.id === sourceRoom.activeGameId);
    const callCount = await evaluate('__calls.length');
    await evaluate(`(()=>{__controller.destroy();localStorage.setItem('wanbanXiaowu_heartChallenge_v1',JSON.stringify(${JSON.stringify(stored)}));__mount()})()`);
    await wait('__active().game?.id==="game_test_preview_20260919" && __active().run?.stage==="open"');
    assert.equal(await evaluate('__active().room.title'),sourceRoom.title);
    assert.equal(await evaluate('__active().room.games[0].error.raw'),sourceGame.error.raw,'failed output stays intact');
    assert.equal(await evaluate('__calls.length'),callCount,'ready preview needs no model request');
    await viewport(1366,900);await layout('prepared preview opening');await screenshot('preview-opening');
    await walkTo('choice');await viewport(390,844);await layout('prepared preview choice');await screenshot('preview-choice');
    const previewSave = await evaluate('JSON.stringify(__active().run)');
    await client.call('Page.reload');await wait('window.__ready===true');
    assert.equal(await evaluate('JSON.stringify(__active().run)'),previewSave,'preview survives refresh at the exact choice');
    await walkTo('settlement');
    assert.equal(await evaluate('__active().run.records.length'),4);
    assert.equal(await evaluate('__active().room.games.length'),sourceRoom.games.length+1);
    assert.deepEqual(await evaluate('__errors'),[]);
    console.log('PASS: prepared preview auto-loads into its bound room, preserves history, resumes and completes.');
  }
  await evaluate(`(async()=>{const E=await import('/src/heart-challenge/engine.js'),F=await import('/tools/heart-challenge-fixture.mjs');__controller.destroy();const first=F.fixtureGame(2,3),second=F.fixtureGame(1,3);F.until(first.game,first.run,'settlement');F.until(second.game,second.run,'choice');first.game.createdAt=Date.now()-86400000;second.game.number=2;const last=second.run.history.findLast(line=>line.speaker!=='N'&&line.kind==='line');last.emoji='😳';first.room.games.push(second.game);first.room.activeGameId=second.game.id;localStorage.setItem(E.HEART_STORAGE_KEY,JSON.stringify({version:1,rooms:[first.room],activeRoomId:first.room.id}));__mount()})()`);
  await click('room-settings');await click('user-tavern-avatar');await wait('document.querySelectorAll("[data-action=choose-user-avatar]").length===2');
  assert.equal(await evaluate('document.querySelector("[data-action=choose-user-avatar] img").getAttribute("src")'),'/assets/default-avatars-pixel.png?current-user');
  assert.ok(await evaluate('document.querySelector("[data-action=choose-user-avatar]").textContent.includes("当前使用")'));
  await click('choose-user-avatar','1');
  assert.equal(await evaluate('__active().game.snapshot.world.user.avatarMode'),'tavern');
  assert.equal(await evaluate('__active().game.snapshot.world.user.avatar'),'/assets/default-avatars-pixel.png?old-user');
  await click('close-room-settings');await client.call('Page.reload');await wait('window.__ready');
  assert.equal(await evaluate('__active().game.snapshot.world.user.avatarMode'),'tavern','historical persona survives reload');
  await click('room-settings');await click('import-user-avatar');await click('close-room-settings');
  const archiveState=await evaluate('JSON.stringify(__active().run)');
  for(const [w,h] of [[390,844],[320,568],[568,320]]) {
    await viewport(w,h);
    assert.ok(await evaluate('(()=>{const card=document.querySelector(".hc-current-card"),text=card.querySelector(".hc-card-summary");return card.getClientRects().length>0 && text.clientHeight>0 && getComputedStyle(text).display!=="none" && text.textContent===__active().game.content.cards.find(c=>c.id===__active().run.cardId).question})()'),'current card question remains visible on '+w+'x'+h);
  }
  await click('card-records');assert.ok(await evaluate('document.querySelectorAll(".hc-gallery-card").length>1'));
  for(const [w,h] of [[1366,900],[390,844],[320,568],[568,320]]) {await viewport(w,h);await noScroll('record grid '+w);await screenshot('record-grid-'+w)}
  await click('flip-record-card','0');await noScroll('record owner');
  assert.equal(await evaluate('document.querySelector(".hc-modal")'),null,'record flips in place without a separate page');
  assert.equal(await evaluate('document.querySelector("[data-action=flip-record-card]").getAttribute("aria-pressed")'),'true');
  assert.ok(await evaluate('!!document.querySelector(".hc-gallery-back .hc-avatar")'),'drawn card back shows its character');
  await click('flip-record-card','0');assert.equal(await evaluate('document.querySelector("[data-action=flip-record-card]").getAttribute("aria-pressed")'),'false');await click('resume');
  assert.equal(await evaluate('JSON.stringify(__active().run)'),archiveState,'gallery and detail are read-only');
  await viewport(1366,900);await click('history');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-action=archive-group]")].map(el=>el.getAttribute("aria-expanded"))'),['true']);
  assert.ok(await evaluate('document.querySelector(".hc-volume-heading small").textContent.includes("3 轮")'));
  assert.equal(await evaluate('document.querySelectorAll("[data-action=archive-round][aria-expanded=true]").length'),1,'current round expands by default');
  await click('all-rounds');await noScroll('two game archive');
  assert.ok(await evaluate('document.querySelector(".hc-archive-scroll > .hc-archive-directory-fold")'),'directory is inside narrative flow');
  assert.ok(await evaluate('document.querySelector(".hc-story-book").clientWidth >= document.querySelector(".hc-archive-layout").clientWidth - 2'),'story uses the full width');
  const archiveText=await evaluate('[...document.querySelectorAll(".hc-story-book [data-story-copy]")].map(el=>el.textContent).join("")');
  assert.equal(archiveText,await evaluate('__active().room.games.flatMap(g=>g.runs.find(r=>r.id===g.activeRunId).history).filter(line=>line.text&&line.kind!=="draw").map(line=>line.text).join("")'),'complete replay preserves all narrative, dialogue and cards');
  assert.ok(await evaluate('!!document.querySelector(".hc-archive-identity .hc-avatar") && !!document.querySelector(".hc-archive-card") && !!document.querySelector(".hc-chapter-heading")'));
  assert.equal(await evaluate('document.querySelectorAll(".hc-story-book [data-reader], [data-action=replay-next]").length'),0,'full replay has no click-through pages');
  await evaluate('document.querySelector(".hc-archive-scroll").scrollTop=350');await screenshot('archive-bubbles-desktop');
  await viewport(390,844);await noScroll('mobile replay with two games');await screenshot('archive-bubbles-mobile');
  for(const [w,h] of [[320,568],[568,320],[844,390]]) {await viewport(w,h);await noScroll('archive '+w+'x'+h)}
  await click('resume');assert.equal(await evaluate('JSON.stringify(__active().run)'),archiveState);
  assert.equal(await evaluate('document.querySelector(".hc-emotion")?.textContent'),'😳','choice keeps the preceding speaker emotion');
  await viewport(1366,900);await click('banks');
  assert.equal(await evaluate('document.querySelectorAll(".hc-gallery-card").length'),100,'bank renders all cards for continuous scrolling');
  await click('gallery-filter','bank:D');assert.ok(await evaluate('[...document.querySelectorAll(".hc-gallery-card")].every(c=>c.dataset.type==="D")'));
  await click('gallery-filter','bank:T');
  assert.equal(await evaluate('document.querySelectorAll(".hc-gallery-card").length'),50);
  assert.equal(await evaluate('document.querySelector(".hc-gallery-pages")'),null);
  assert.ok(await evaluate('(()=>{const e=document.querySelector(".hc-card-grid");e.scrollTop=e.scrollHeight;return e.scrollTop>0})()'),'all cards can be reached by scrolling');
  await evaluate('(()=>{const f=document.querySelector("#hc-bank-search");f.value="NO_MATCH_FOR_SEARCH";f.dispatchEvent(new Event("input",{bubbles:true}))})()');
  assert.equal(await evaluate('document.querySelectorAll(".hc-gallery-card").length'),0);
  await evaluate('(()=>{const f=document.querySelector("#hc-bank-search");f.value="";f.dispatchEvent(new Event("input",{bubbles:true}))})()');
  await click('gallery-filter','bank:');await click('inspect-bank-card','0');await noScroll('bank enlarged card');await click('close-overlay');
  for(const [w,h] of [[1366,900],[390,844],[320,568],[568,320]]) {await viewport(w,h);await noScroll('banks '+w+'x'+h);await screenshot('bank-grid-'+w)}
  await viewport(390,844);await screenshot('bank-library-mobile');await click('add-bank');
  const bankField=async(key,value)=>evaluate(`(()=>{const f=document.querySelector('[data-bank-field="'+${JSON.stringify(key)}+'"]');f.value=${JSON.stringify(value)};f.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await bankField('name','旅途问答');await bankField('truth','说出一个喜欢的季节。');await click('save-bank');
  assert.ok(await evaluate('document.querySelector(".hc-notice").textContent.includes("2—200")'));await click('dismiss');
  await bankField('truth','说出一个喜欢的季节。\n回忆一次愉快的旅行。');await click('bank-editor-tab','D');
  await bankField('dare','用一个表情表示现在的心情。\n邀请一人与你对视三秒。');await click('save-bank');
  assert.equal(await evaluate('__read().banks.length'),1);const customId=await evaluate('__read().banks[0].id');
  await noScroll('custom bank preview');
  assert.equal(await evaluate('document.querySelectorAll("[data-action=use-bank],[data-action=copy-bank]").length'),0,'unused bank actions removed');
  assert.equal(await evaluate('document.querySelectorAll(".hc-gallery-card").length'),4,'four custom cards share one grid');
  await click('close-collection');await client.call('Page.reload');await wait('window.__ready');await click('banks');
  assert.ok(await evaluate('document.querySelectorAll("[data-action=select-bank]").length>0'));
  await click('select-bank',customId);await click('edit-bank',customId);await bankField('name','旅途问答·修订');await click('save-bank');
  assert.ok(await evaluate('document.querySelector(".hc-bank-tile.hc-selected").textContent.includes("旅途问答·修订")'));
  await click('close-collection');
  await walkTo('pickType');await noScroll('illustrated type cards');await screenshot('card-types-mobile');await click('type','T');await screenshot('card-backs-mobile');
  await click('draw',(await evaluate('__active().run.offered'))[0]);
  for(const [w,h] of [[1366,900],[390,844],[320,568],[568,320]]) {await viewport(w,h);await noScroll('new card '+w+'x'+h);await screenshot('card-face-'+w)}
  await viewport(390,844);
  for(const theme of ['day','arcade','spring','night','mono','cyber','cardtheater','tavern']) {await evaluate(`document.querySelector('#wanbanXiaowu-popup').className='wb-${theme} wb-tab-intimacy'`);await sleep(60);await checkThemeContrast('new card '+theme);if(['day','night','tavern'].includes(theme))await screenshot('card-new-'+theme)}
  await evaluate("document.querySelector('#wanbanXiaowu-popup').className='wb-day wb-tab-intimacy'");
  await evaluate(`(async()=>{const E=await import('/src/heart-challenge/engine.js'),F=await import('/tools/heart-challenge-fixture.mjs');__controller.destroy();const r=F.fixtureRoom(1,5);r.config.orderMode='fate';localStorage.setItem(E.HEART_STORAGE_KEY,JSON.stringify({version:1,rooms:[r],activeRoomId:r.id}));__mount()})()`);
  await click('setup');await click('prepare-order');await evaluate("document.querySelector('#hc-fate-number').value='37'");await click('fate');
  for(const [w,h] of [[1366,900],[390,844],[320,568],[568,320],[844,390]]) {await viewport(w,h);await noScroll('lottery unrevealed '+w+'x'+h);await screenshot('lottery-back-'+w)}
  await click('reveal-fate');
  for(const [w,h] of [[1366,900],[390,844],[320,568],[568,320],[844,390]]) {await viewport(w,h);await noScroll('lottery revealed '+w+'x'+h);await screenshot('lottery-face-'+w)}
  assert.deepEqual(await evaluate('__errors'),[],'collections and lottery browser errors');
  console.log('PASS: room-wide rich archives, read-only records, persistent custom decks, emoji, illustrated cards and six-seat lottery.');
  await viewport(390,844);await click('rooms');const beforeDemo=await evaluate('__read().rooms.length'), beforeDemoCalls=await evaluate('__calls.length');
  await click('demo-room');await wait('__active().room?.demoId==="rainy-inn-demo-v1" && __active().run?.stage==="open"');
  assert.equal(await evaluate('__read().rooms.length'),beforeDemo+1);
  assert.equal(await evaluate('__calls.length'),beforeDemoCalls,'demo does not call a model');
  await viewport(390,844);await screenshot('phone-demo-opening');
  await click('rooms');await click('demo-room');assert.equal(await evaluate('__read().rooms.length'),beforeDemo+1);
  await walkTo('pickType');await click('type','T');await click('draw',(await evaluate('__active().run.offered'))[0]);
  const longCard='说一件旅途中记得的小事，解释当时留意到的细节，再邀请对方自愿回应。'.repeat(12);
  await evaluate(`(()=>{const node=document.querySelector('.hc-card-full-text');node.textContent=${JSON.stringify(longCard)};window.dispatchEvent(new Event('resize'))})()`);
  for(const [w,h] of [[1366,900],[390,844],[320,568],[568,320]]) {
    await viewport(w,h);
    const full=await evaluate(`(()=>{const el=document.querySelector('.hc-card-full-text');return {text:el.textContent,h:el.clientHeight,sh:el.scrollHeight,w:el.clientWidth,sw:el.scrollWidth,size:parseFloat(getComputedStyle(el).fontSize),pages:el.closest('.hc-art-card').querySelectorAll('[data-reader]').length}})()`);
    assert.equal(full.text,longCard);assert.equal(full.pages,0);assert.ok(full.size>=12);
    assert.ok(full.sh<=full.h+2 && full.sw<=full.w+2,'full long card must remain inside its sheet '+JSON.stringify(full));
    await screenshot('long-card-'+w);
  }
  await click('banks');await click('inspect-bank-card','0');
  await evaluate(`(()=>{document.querySelector('.hc-card-full-text').textContent=${JSON.stringify(longCard)};window.dispatchEvent(new Event('resize'))})()`);
  await viewport(320,568);
  assert.ok(await evaluate('(()=>{const e=document.querySelector(".hc-card-full-text");return e.scrollHeight<=e.clientHeight+2 && !e.closest(".hc-art-card").querySelector("[data-reader]")})()'));
  await screenshot('long-bank-card');await click('close-overlay');
  await evaluate(`document.querySelector('.hc-gallery-card>p').textContent=${JSON.stringify(longCard)}`);
  assert.ok(await evaluate('(()=>{const e=document.querySelector(".hc-gallery-card>p");return e.scrollHeight<=e.clientHeight+2 && getComputedStyle(e).webkitLineClamp==="none"})()'));
  assert.deepEqual(await evaluate('__errors'),[]);
  console.log('PASS: mobile demo installs once without AI, and long cards retain all text on one sheet.');
  await evaluate('__enableServerLogs()');
  for (const retries of [0, 2]) {
    await evaluate('__seed(1,1)');await walkTo('choice');
    await evaluate(`(()=>{__controller.destroy();const s=__read(),r=s.rooms.find(r=>r.id===s.activeRoomId),g=r.games.find(g=>g.id===r.activeGameId);g.snapshot.config.regenerations=${retries};localStorage.setItem('wanbanXiaowu_heartChallenge_v1',JSON.stringify(s));__mount();window.__networkFailures=10})()`);
    const beforeCalls=await evaluate('__calls.length'), beforeHistory=await evaluate('JSON.stringify(__active().run.history)');
    await click('free-toggle');await evaluate('(()=>{const e=document.querySelector("#hc-free-input");e.value="再讲一句。";e.dispatchEvent(new Event("input",{bubbles:true}))})()');
    await click('submit-free');await wait('__active().game.request.status==="failed"');
    assert.equal(await evaluate('__calls.length'),beforeCalls+retries+1,'configured additional attempts are exact');
    assert.equal(await evaluate('JSON.stringify(__active().run.history)'),beforeHistory,'failed attempts do not change played history');
    assert.equal(await evaluate(`new Set(__calls.slice(${beforeCalls}).map(c=>c.prompt)).size`),1,'all attempts use the same original input');
    const entries=await evaluate('__read().generationLogs');
    assert.equal(entries.length,retries+1);
    for(const entry of entries) {
      assert.ok(entry.path.startsWith('/user/files/'));
      assert.equal(entry.raw,undefined,'uploaded output no longer consumes local save quota');
      assert.ok(generationLogFiles.get(entry.path).includes('模拟网络断开'));
    }
    await click('rooms');await click('select-room',await evaluate('__read().activeRoomId'));
    await click('generation-logs');await click('view-generation-log',entries.at(-1).id);
    assert.ok(await evaluate('document.querySelector(".hc-full-input").textContent.includes("模拟网络断开")'));
    await layout('mobile server generation log');await click('close-overlay');
  }
  console.log('PASS: zero and two regenerations respect attempt limits and preserve history.');
  await client.call('Page.navigate',{url:base+'/watermelon'});await wait('window.__ready===true');
  await wait('__draws>2');
  for(let i=0;i<2;i++) {
    await client.call('Input.dispatchMouseEvent',{type:'mousePressed',x:200,y:160,button:'left',clickCount:1});
    await client.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:210,y:180,button:'left',buttons:1});
    await client.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:210,y:180,button:'left',clickCount:1});
    await sleep(250);
  }
  await wait('__score===40');await evaluate('__controller.save()');
  assert.equal(await evaluate('__saved.balls.length'),1,'real pointer input drops once and equal fruit merge');
  assert.equal(await evaluate('__saved.balls[0].l'),1);
  assert.equal(await evaluate('__settingsReads'),1,'real animation does not read settings each frame');
  await evaluate('gamePaused=true;__controller.save()');const paused=await evaluate('JSON.stringify(__saved)');
  await sleep(180);await evaluate('__controller.save()');assert.equal(await evaluate('JSON.stringify(__saved)'),paused);
  await evaluate('gamePaused=false');await sleep(180);await evaluate('__controller.save()');
  assert.notEqual(await evaluate('JSON.stringify(__saved)'),paused,'resume advances falling fruit');
  await viewport(390,844);await screenshot('watermelon-mobile');
  await evaluate('__controller.destroy()');const lastDraw=await evaluate('__draws');await sleep(100);
  assert.equal(await evaluate('__draws'),lastDraw,'destroy stops real RAF rendering');
  assert.deepEqual(await evaluate('__errors'),[],'watermelon browser errors');
  console.log('PASS: watermelon real canvas, pointer input, merge, pause, resume and cleanup.');
  console.log('Screenshots: '+artifactRoot);
} finally {
  client?.close();if(browser){browser.kill();await new Promise(r=>browser.once('exit',r));}server.close();
  // This profile was created above exclusively for this check; never touch the user's browser profile.
  const target=resolve(profile);if(target.startsWith(resolve(artifactRoot)+sep))await rm(target,{recursive:true,force:true,maxRetries:8,retryDelay:200}).catch(()=>{});
}
