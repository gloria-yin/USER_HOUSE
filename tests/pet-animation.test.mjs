import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { playPetFrames, transferPetFrames, queuePetAppearance, PET_FRAME_POSITIONS } from '../src/runtime/pet-animation.js';

function harness(action = 'eat', key = 'shen-pet-1') {
  const props = new Map([['--wb-pet-sprite', 'url(/rabbit/baby/' + action + '.png)']]);
  const jobs = new Map();
  let serial = 0;
  const element = { tagName:'DIV', isConnected:true, className:'wb-pet-fox baby ' + action,
    dataset:{ petAnimationKey:key },
    style:{ setProperty:(name, value) => props.set(name, value), getPropertyValue:name => props.get(name) || '' },
    classList:{ add() {}, remove() {} },
  };
  const clock = { setTimeout(fn, ms) { assert.equal(ms, 500); jobs.set(++serial, fn); return serial; } };
  return { element, clock, jobs, position:() => props.get('background-position'), step() {
    const [id, fn] = jobs.entries().next().value; jobs.delete(id); fn();
  } };
}

test('every action plays all four frames in order for 500ms each', () => {
  for (const action of ['normal','happy','eat','sleep','sad']) {
    const h = harness(action);
    playPetFrames(h.element, h.clock);
    for (const position of PET_FRAME_POSITIONS) {
      assert.equal(h.position(), position);
      playPetFrames(h.element, h.clock);
      assert.equal(h.jobs.size, 1, 'retrigger must not restart or duplicate a running cycle');
      h.step();
    }
    assert.equal(h.jobs.size, 0);
    assert.equal(h.position(), PET_FRAME_POSITIONS[0]);
  }
});

test('story DOM replacement preserves current frame and completes the same cycle', () => {
  const old = harness(), next = harness();
  playPetFrames(old.element, old.clock);
  old.step(); old.step();
  old.element.isConnected = false;
  assert.ok(transferPetFrames(old.element, next.element));
  assert.equal(next.position(), PET_FRAME_POSITIONS[2]);
  playPetFrames(next.element, next.clock);
  assert.equal(next.jobs.size, 0);
  old.step(); assert.equal(next.position(), PET_FRAME_POSITIONS[3]);
  old.step(); assert.equal(old.jobs.size, 0);
});

test('a new requested action waits for the existing four frames, then plays its own four', () => {
  const old = harness('normal'), next = harness('happy');
  playPetFrames(old.element, old.clock); old.step();
  transferPetFrames(old.element, next.element);
  assert.ok(next.element.style.getPropertyValue('--wb-pet-sprite').includes('normal.png'));
  old.step(); old.step(); old.step();
  assert.ok(next.element.style.getPropertyValue('--wb-pet-sprite').includes('happy.png'));
  for (const position of PET_FRAME_POSITIONS) { assert.equal(next.position(), position); old.step(); }
  assert.equal(old.jobs.size, 0);
});

test('desktop action changes cannot skip frames; detached or different pets are not updated', () => {
  const h = harness();
  playPetFrames(h.element, h.clock); h.step();
  assert.ok(queuePetAppearance(h.element, 'wb-pet-fox baby happy', 'url(/rabbit/baby/happy.png)'));
  assert.equal(h.position(), PET_FRAME_POSITIONS[1]);
  const other = harness('normal', 'other-pet');
  assert.equal(transferPetFrames(h.element, other.element), false);
  h.element.isConnected = false;
  h.step(); assert.equal(h.jobs.size, 0);
  const egg = harness(); egg.element.tagName = 'IMG';
  playPetFrames(egg.element, egg.clock); assert.equal(egg.jobs.size, 0);
});

test('all 11 species have three forms and five four-frame RGBA action strips', () => {
  const species = ['rabbit','fox','dog','cat','bird','bala','otter','hedgehog','redpanda','alpaca','sikadeer'];
  let count = 0;
  for (const pet of species) for (const form of ['baby','adult','magic']) for (const action of ['normal','happy','eat','sleep','sad']) {
    const png = readFileSync(new URL('../assets/pets/' + pet + '/' + form + '/' + action + '.png', import.meta.url));
    assert.equal(png.readUInt32BE(16), 512);
    assert.equal(png.readUInt32BE(20), 128);
    assert.equal(png[25], 6);
    count++;
  }
  assert.equal(count, 165);
});

test('actual runtime starts actions immediately and routes sprite changes through the frame controller', () => {
  const runtime = readFileSync(new URL('../src/runtime/wanban-app.js', import.meta.url), 'utf8');
  function source(name) {
    const start = runtime.indexOf('  function ' + name + '(');
    return runtime.slice(start, runtime.indexOf('\n  }', start) + 4);
  }
  let plays = 0;
  const c = vm.createContext({ petAnimationTimer:null, clearTimeout() {}, setTimeout:() => 1, Math,
    triggerPetAnimation:() => { plays++; } });
  vm.runInContext(source('resetPetAnimationLoop') + '\nresetPetAnimationLoop({}, true);', c);
  assert.equal(plays, 1);
  assert.match(source('setPetSpriteState'), /queuePetAppearance\(fox, nextClass, nextSprite\)/);
  assert.doesNotMatch(source('petSpriteHTML'), /queuePetAppearance/);
  assert.match(source('renderPetHouseLoaded'), /transferPetFrames\(previousSprite, currentSprite\)/);
  assert.match(source('renderPetHouseLoaded'), /renderPetHouseLoaded\(info, next, \{ action:shownState \}\)/);
});
