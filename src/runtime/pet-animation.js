export const PET_FRAME_MS = 500;
export const PET_FRAME_POSITIONS = ['0% 0', '33.3333333333% 0', '66.6666666667% 0', '100% 0'];
const runs = new WeakMap();

function appearance(element) {
  return { className:element.className.replace(/\s*\banimating\b/g, ''), sprite:element.style.getPropertyValue('--wb-pet-sprite') };
}

function applyAppearance(element, value) {
  element.className = value.className;
  element.style.setProperty('--wb-pet-sprite', value.sprite);
}

function paint(run) {
  run.element.style.setProperty('animation', 'none', 'important');
  run.element.style.setProperty('background-position', PET_FRAME_POSITIONS[run.frame], 'important');
  run.element.classList.add('animating');
}

export function playPetFrames(element, clock = globalThis) {
  if (!element || element.tagName === 'IMG' || runs.has(element)) return;
  const run = { element, clock, frame:0, pending:null, original:appearance(element) };
  runs.set(element, run);
  paint(run);
  const tick = () => {
    const target = run.element;
    if (!target.isConnected) { runs.delete(target); return; }
    if (++run.frame < 4) {
      paint(run);
      run.timer = clock.setTimeout(tick, PET_FRAME_MS);
      return;
    }
    runs.delete(target);
    target.classList.remove('animating');
    target.style.setProperty('background-position', PET_FRAME_POSITIONS[0], 'important');
    if (run.pending) {
      applyAppearance(target, run.pending);
      playPetFrames(target, clock);
    }
  };
  run.timer = clock.setTimeout(tick, PET_FRAME_MS);
}

// Continue the same four-frame cycle when a story page rebuilds its DOM.
export function transferPetFrames(previous, next) {
  const run = previous && runs.get(previous);
  if (!run || !next || next.tagName === 'IMG' || previous.dataset.petAnimationKey !== next.dataset.petAnimationKey) return false;
  const desired = appearance(next);
  run.pending = desired.sprite !== run.original.sprite ? desired : null;
  runs.delete(previous);
  run.element = next;
  runs.set(next, run);
  applyAppearance(next, run.original);
  paint(run);
  return true;
}

export function queuePetAppearance(element, className, sprite) {
  const run = runs.get(element);
  if (!run) return false;
  run.pending = sprite !== run.original.sprite ? { className, sprite } : null;
  return true;
}
