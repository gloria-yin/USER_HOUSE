import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/runtime/wanban-app.js', import.meta.url), 'utf8');
// Captured from the original 25 Hz simulation before the animation change.
const baselineSnapshot = {"balls":[{"x":100,"y":333.65,"vx":0,"vy":7.600000000000002,"l":3,"a":0,"av":0},{"x":260,"y":399.7190248534614,"vx":0,"vy":0.27553579379424986,"l":3,"a":0,"av":0},{"x":260,"y":464.7190248534614,"vx":0,"vy":0.4495584004011445,"l":4,"a":0,"av":0}],"next":1,"score":80,"seen":{},"details":{"mergeCounts":{"3":1},"crisisResolves":0,"wasNearTop":false,"finalCounts":{}}};
function harness(text = source, state = { next:0 }, options = {}) {
  const from = text.indexOf('  function startWatermelon(state) {');
  const to = text.indexOf('\n  function startLudo(state) {', from);
  const code = text.slice(from, to);
  let now = 10000, nextId = 1, controller, active = true, settingsReads = 0, draws = 0, roots = 0;
  const frames = new Map(), timers = new Map(), scores = [], saves = [], endings = [], positions = [];
  const ctx = new Proxy({}, { get:(_, key) => key === 'createRadialGradient' || key === 'createLinearGradient' ? () => ({ addColorStop() {} })
    : key === 'clearRect' ? () => { draws++; positions.length = 0; }
    : key === 'translate' ? (x,y) => positions.push({x,y}) : () => {}, set:() => true });
  const view = {
    requestAnimationFrame:fn => { const id = nextId++; frames.set(id,fn); return id; },
    cancelAnimationFrame:id => frames.delete(id),
    setTimeout:fn => { const id = nextId++; timers.set(id,fn); return id; },
    clearTimeout:id => timers.delete(id),
  };
  const doc = { defaultView:view, hidden:false, createElement:() => ({ getContext:() => ctx }) };
  const canvas = { ownerDocument:doc, isConnected:true, width:400, height:500, getContext:() => ctx,
    getBoundingClientRect:() => ({ left:0, width:400 }), setPointerCapture(){}, releasePointerCapture(){} };
  const math = Object.create(Math);
  math.random = () => .4;
  math.hypot = (...args) => { roots++; return Math.hypot(...args); };
  math.sqrt = value => { roots++; return Math.sqrt(value); };
  const sandbox = { Math:math, Date:{ now:() => now }, gamePaused:false, watermelonTimer:null, PROGRESS_SAVE_DELAY:700,
    getHostDocument:() => doc, getHostWindow:() => view, isMobileHost:() => !!options.mobile, qs:s => s === '#wb-watermelon' ? canvas : {},
    settings:() => ({ theme:'day' }), currentTheme:() => { settingsReads++; return 'day'; }, isNightTheme:() => false,
    canvasThemePalette:() => ({ top:'#fff', bottom:'#eee', pattern:'#ddd', border:'#ccc', text:'#222' }),
    speak(){}, setScore:(_, score) => scores.push(score), saveProgress:(_, state, options) => saves.push({ state:JSON.parse(JSON.stringify(state)), options }),
    showGameOver:(...args) => endings.push(args),
    setTimeout:view.setTimeout, clearTimeout:view.clearTimeout, setInterval:view.setTimeout, clearInterval:view.clearTimeout,
    registerLegacyGameSave:(_, fn, cleanup) => { const guarded = force => { if(active) fn(force); }; guarded.isActive = () => active;
      controller = { save:() => guarded(true), destroy:() => { active=false; cleanup?.(); } }; return guarded; },
  };
  runInNewContext(code + '\nstartWatermelon(input);', Object.assign(sandbox, { input:JSON.parse(JSON.stringify(state)) }));
  return { canvas, doc, sandbox, frames, timers, scores, saves, endings, positions, controller,
    tick(time) { now=10000+time; const pending=[...frames.values()]; frames.clear(); pending.forEach(fn=>fn(time)); },
    legacyStep() { [...timers.values()][0](); },
    state() { controller.save(); return saves.at(-1).state; },
    metrics() { return { draws, settingsReads, roots }; },
  };
}
const fruit = (x,y,l=0) => ({ x,y,l,vx:0,vy:0,a:0,av:0 });
function equivalent(a,b) {
  assert.equal(a.score,b.score); assert.equal(a.next,b.next); assert.equal(a.balls.length,b.balls.length);
  for(let i=0;i<a.balls.length;i++) for(const key of ['x','y','vx','vy','l','a','av'])
    assert.ok(Math.abs(a.balls[i][key]-b.balls[i][key])<1e-8, 'physics mismatch: '+i+' '+key);
}
test('physics and merges match the original at 30, 60 and 120 Hz', () => {
  const seed={next:1,balls:[fruit(100,260,2),fruit(100,290,2),fruit(260,340,3),fruit(260,410,4)]};
  for(const hz of [30,60,120]) { const game=harness(source,seed); for(let i=0;i<=hz;i++) game.tick(i*1000/hz); equivalent(game.state(),baselineSnapshot); }
});
test('rendered motion changes between physics ticks without re-reading settings', () => {
  const game=harness(source,{next:0,balls:[fruit(200,100)]});
  game.tick(0); game.tick(40); game.tick(60);
  const first=game.positions.at(-1).y;
  game.tick(78); const second=game.positions.at(-1).y;
  assert.ok(second>first && second<100.45);
  assert.equal(game.metrics().settingsReads,1);
});
test('pointer bursts paint at most once per frame and controller save captures the drop', () => {
  const game=harness();
  const event={clientX:200,pointerId:1,preventDefault(){}};
  const before=game.metrics().draws;
  const savesBefore=game.saves.length;
  game.canvas.onpointerdown(event);
  for(let i=0;i<100;i++) game.canvas.onpointermove({...event,clientX:100+i});
  assert.equal(game.metrics().draws,before);
  game.tick(0); assert.equal(game.metrics().draws,before+1);
  game.canvas.onpointerup(event);
  assert.equal(game.saves.length,savesBefore);
  const state=game.state(); assert.equal(state.balls.length,1);
  assert.equal(game.saves.at(-1).options.immediate,true);
  assert.deepEqual(Object.keys(state.balls[0]).sort(),['a','av','l','vx','vy','x','y']);
});
test('pause and hidden tabs do not advance or replay inactive time', () => {
  const game=harness(source,{next:0,balls:[fruit(200,100)]}); game.tick(0); game.tick(40);
  for(const target of ['pause','hidden']) {
    const before=game.state();
    if(target==='pause') game.sandbox.gamePaused=true; else game.doc.hidden=true;
    game.tick(10000); game.tick(20000); equivalent(game.state(),before);
    game.sandbox.gamePaused=false; game.doc.hidden=false;
    game.tick(30000); equivalent(game.state(),before);
  }
});
test('stalls cap catch-up work and destroy clears both animation and drop timer', () => {
  const game=harness(); game.canvas.onclick({clientX:200}); game.tick(0); game.tick(60000);
  assert.equal(game.state().balls[0].vy,1.35);
  game.controller.destroy(); assert.equal(game.frames.size,0); assert.equal(game.timers.size,0);
  assert.equal(game.canvas.onclick,null); assert.equal(game.canvas.onpointermove,null);
  const count=game.saves.length; game.controller.save(); assert.equal(game.saves.length,count);
});
test('chain merges commit one score update per physics tick', () => {
  const game=harness(source,{next:0,balls:[fruit(100,200),fruit(100,200),fruit(100,200,1)]});
  game.tick(0); game.tick(40); assert.equal(game.state().score,100); assert.deepEqual(game.scores,[0,100]);
});
test('distant fruit pairs skip expensive distance calculations', () => {
  const balls=Array.from({length:48},(_,i)=>fruit(25+(i%8)*49,110+Math.floor(i/8)*57,i%2));
  const game=harness(source,{next:0,balls}); game.tick(0); game.tick(40);
  equivalent(game.state(),{next:0,score:0,balls:balls.map(b=>({...b,y:b.y+.45,vy:.45}))});
  assert.equal(game.metrics().roots,0);
});

test('game over stops frames and cannot overwrite the completed save', () => {
  const balls=Array.from({length:9},(_,i)=>({...fruit(20+i*42,25),vy:-.25}));
  const game=harness(source,{next:0,balls}); game.tick(0); game.tick(40);
  assert.equal(game.endings.length,1); assert.equal(game.frames.size,0);
  const writes=game.saves.length; game.controller.save(); assert.equal(game.saves.length,writes);
});
test('a removed game surface cannot keep running frames', () => {
  const game=harness(); game.canvas.isConnected=false; game.tick(0); assert.equal(game.frames.size,0);
});

test('mobile rendering uses a smaller backing store without changing game coordinates', () => {
  const game=harness(source,{next:0}, {mobile:true});
  assert.equal(game.canvas.width,320);
  assert.equal(game.canvas.height,400);
  game.canvas.onclick({clientX:200});
  assert.equal(game.state().balls[0].x,200);
});

test('a settled pile stops animation work and wakes on the next drop', () => {
  const game=harness(source,{next:0,balls:[fruit(200,486)]});
  for(let i=0;i<=12;i++) game.tick(i*40);
  assert.equal(game.frames.size,0);
  const before=game.metrics().draws;
  game.canvas.onclick({clientX:120});
  assert.equal(game.state().balls.length,2);
  assert.ok(game.frames.size>0);
  game.tick(600);
  assert.ok(game.metrics().draws>before);
});

test('stack correction jitter also reaches sleep instead of running forever', () => {
  const game=harness(source,{next:0,balls:[fruit(200,486),fruit(200,458),fruit(200,430)]});
  for(let i=0;i<=70;i++) game.tick(i*40);
  assert.equal(game.frames.size,0);
});
