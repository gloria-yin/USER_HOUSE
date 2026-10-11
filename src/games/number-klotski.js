export const NUMBER_KLOTSKI_LEVELS = Object.freeze({
  4: Object.freeze({ size:4, baseScore:1600, targetMoves:120, movePoint:6, targetSeconds:300, timePoint:2, timeBonusCap:600, scrambleSteps:260 }),
  5: Object.freeze({ size:5, baseScore:3200, targetMoves:300, movePoint:7, targetSeconds:600, timePoint:2, timeBonusCap:1200, scrambleSteps:460 }),
  6: Object.freeze({ size:6, baseScore:6000, targetMoves:650, movePoint:8, targetSeconds:1200, timePoint:2, timeBonusCap:2400, scrambleSteps:760 }),
});
export const NUMBER_KLOTSKI_BEST_STORAGE_KEY = 'wanbanXiaowu_numberKlotskiBest_v1';

function normalizedSize(value) {
  const match = String(value == null ? '' : value).match(/[456]/);
  const size = match ? Number(match[0]) : Number(value);
  return NUMBER_KLOTSKI_LEVELS[size] ? size : 4;
}

export function numberKlotskiSolvedBoard(size) {
  const width = normalizedSize(size);
  return Array.from({ length:width * width }, (_, index) => index === width * width - 1 ? 0 : index + 1);
}

export function numberKlotskiMovableIndices(board, size) {
  const width = normalizedSize(size);
  if (!Array.isArray(board) || board.length !== width * width) return [];
  const blank = board.indexOf(0);
  if (blank < 0) return [];
  const row = Math.floor(blank / width);
  const col = blank % width;
  const result = [];
  if (row > 0) result.push(blank - width);
  if (row < width - 1) result.push(blank + width);
  if (col > 0) result.push(blank - 1);
  if (col < width - 1) result.push(blank + 1);
  return result;
}

export function moveNumberKlotskiTile(board, size, index) {
  const width = normalizedSize(size);
  const target = Number(index);
  if (!numberKlotskiMovableIndices(board, width).includes(target)) return null;
  const next = board.slice();
  const blank = next.indexOf(0);
  [next[blank], next[target]] = [next[target], next[blank]];
  return next;
}

export function isNumberKlotskiSolved(board, size) {
  const solved = numberKlotskiSolvedBoard(size);
  return Array.isArray(board) && board.length === solved.length && board.every((value, index) => value === solved[index]);
}

export function isValidNumberKlotskiBoard(board, size) {
  const width = normalizedSize(size);
  if (!Array.isArray(board) || board.length !== width * width) return false;
  const values = board.map(Number).sort((a, b) => a - b);
  return values.every((value, index) => Number.isInteger(value) && value === index);
}

export function isSolvableNumberKlotskiBoard(board, size) {
  const width = normalizedSize(size);
  if (!isValidNumberKlotskiBoard(board, width)) return false;
  const tiles = board.filter(Boolean);
  let inversions = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) inversions++;
  }
  if (width % 2) return inversions % 2 === 0;
  const blankRowFromBottom = width - Math.floor(board.indexOf(0) / width);
  return (inversions + blankRowFromBottom) % 2 === 1;
}

export function numberKlotskiDistance(board, size) {
  const width = normalizedSize(size);
  if (!isValidNumberKlotskiBoard(board, width)) return 0;
  return board.reduce((total, tile, index) => {
    if (!tile) return total;
    const goal = tile - 1;
    return total + Math.abs(Math.floor(index / width) - Math.floor(goal / width)) + Math.abs(index % width - goal % width);
  }, 0);
}

export function createNumberKlotskiBoard(size, random = Math.random) {
  const width = normalizedSize(size);
  const config = NUMBER_KLOTSKI_LEVELS[width];
  const scramble = sampleRandom => {
    const board = numberKlotskiSolvedBoard(width);
    let blank = board.length - 1;
    let previousBlank = -1;
    for (let step = 0; step < config.scrambleSteps; step++) {
      let choices = numberKlotskiMovableIndices(board, width).filter(index => index !== previousBlank);
      if (!choices.length) choices = numberKlotskiMovableIndices(board, width);
      const sample = Math.max(0, Math.min(.999999999, Number(sampleRandom()) || 0));
      const target = choices[Math.floor(sample * choices.length)];
      previousBlank = blank;
      [board[blank], board[target]] = [board[target], board[blank]];
      blank = target;
    }
    return board;
  };
  let best = numberKlotskiSolvedBoard(width);
  let bestDistance = -1;
  for (let attempt = 0; attempt < 4; attempt++) {
    const board = scramble(random);
    const distance = numberKlotskiDistance(board, width);
    if (!isNumberKlotskiSolved(board, width) && distance > bestDistance) {
      best = board;
      bestDistance = distance;
    }
  }
  if (bestDistance < width) best = scramble(() => 0);
  if (isNumberKlotskiSolved(best, width)) return moveNumberKlotskiTile(best, width, best.length - 2);
  return best;
}

export function calculateNumberKlotskiScore(size, moves, elapsedMs) {
  const config = NUMBER_KLOTSKI_LEVELS[normalizedSize(size)];
  const moveCount = Math.max(0, Math.floor(Number(moves) || 0));
  const seconds = Math.max(0, Math.floor((Number(elapsedMs) || 0) / 1000));
  const efficiencyBonus = Math.max(0, config.targetMoves - moveCount) * config.movePoint;
  const timeBonus = Math.min(config.timeBonusCap, Math.max(0, config.targetSeconds - seconds) * config.timePoint);
  return config.baseScore + efficiencyBonus + timeBonus;
}

export function numberKlotskiAchievements(size, moves, elapsedMs, newBest = false) {
  const width = normalizedSize(size);
  const config = NUMBER_KLOTSKI_LEVELS[width];
  const achievements = [];
  if (Math.max(0, Number(moves) || 0) <= config.targetMoves) achievements.push('低步数完成');
  if (Math.max(0, Number(elapsedMs) || 0) <= config.targetSeconds * 1000) achievements.push('快速完成');
  if (width === 6) achievements.push('完成6×6');
  if (newBest) achievements.push('刷新个人纪录');
  return achievements;
}

function formatTime(milliseconds) {
  const total = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

function cloneBoard(value) {
  return Array.isArray(value) ? value.map(Number) : [];
}

function bestStorage(win) {
  try {
    const value = JSON.parse(win.localStorage.getItem(NUMBER_KLOTSKI_BEST_STORAGE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (_) {
    return {};
  }
}

function saveBestStorage(win, value) {
  try { win.localStorage.setItem(NUMBER_KLOTSKI_BEST_STORAGE_KEY, JSON.stringify(value)); }
  catch (_) {}
}

export function createNumberKlotskiGame(savedState, env) {
  const doc = env.document;
  const win = env.window;
  const root = env.root;
  const size = normalizedSize(savedState?.size || savedState?.choice || savedState?.difficulty);
  const difficulty = size + 'x' + size;
  const config = NUMBER_KLOTSKI_LEVELS[size];
  const savedBoard = cloneBoard(savedState?.board);
  const restored = isValidNumberKlotskiBoard(savedBoard, size)
    && isSolvableNumberKlotskiBoard(savedBoard, size)
    && !isNumberKlotskiSolved(savedBoard, size);
  let board = restored ? savedBoard : createNumberKlotskiBoard(size);
  let moves = restored ? Math.max(0, Math.floor(Number(savedState?.moves) || 0)) : 0;
  let elapsedMs = restored ? Math.max(0, Number(savedState?.elapsedMs) || 0) : 0;
  let undoCount = restored ? Math.max(0, Math.floor(Number(savedState?.undoCount) || 0)) : 0;
  let history = restored && Array.isArray(savedState?.history)
    ? savedState.history.filter(item => isValidNumberKlotskiBoard(item, size) && isSolvableNumberKlotskiBoard(item, size)).slice(-200).map(cloneBoard)
    : [];
  let seen = Object.assign({ goodStart:false, progress25:false, progress50:false, progress75:false, nearFinish:false, stuck:false }, restored ? savedState?.seen : null);
  let details = Object.assign({ wrongClicks:0, forwardMoves:moves, undos:undoCount, progressPeak:0, startDistance:numberKlotskiDistance(board, size), minDistance:numberKlotskiDistance(board, size) }, restored ? savedState?.details : null);
  const initialDistance = Math.max(0, Number(details.startDistance) || numberKlotskiDistance(board, size));
  let lastMoveElapsed = restored ? Math.max(0, Number(savedState?.lastMoveElapsed) || elapsedMs) : 0;
  let lastClockAt = Date.now();
  let lastShownSecond = -1;
  let lastWrongAt = 0;
  let lastMovedInto = -1;
  let suppressClickUntil = 0;
  let pointerStart = null;
  let destroyed = false;
  let over = false;
  let pendingSaveTimer = 0;
  let timer = 0;
  const bests = bestStorage(win);

  root.innerHTML = '<div class="wb-number-klotski"><div class="wb-number-klotski-top"><div class="wb-number-klotski-stat"><span>难度</span><b>' + size + '×' + size + '</b></div><div class="wb-number-klotski-stat"><span>步数</span><b id="wb-number-klotski-moves">0</b></div><div class="wb-number-klotski-stat"><span>用时</span><b id="wb-number-klotski-time">00:00</b></div><div class="wb-number-klotski-stat"><span>最佳</span><b id="wb-number-klotski-best">--</b></div></div><div class="wb-number-klotski-stage"><div class="wb-number-klotski-board" id="wb-number-klotski-board" role="grid" aria-label="' + size + '乘' + size + '数字华容道"></div></div><div class="wb-number-klotski-actions"><button type="button" class="wb-btn primary" id="wb-number-klotski-undo">↶ 撤回</button><button type="button" class="wb-btn" id="wb-number-klotski-shuffle">⤨ 重新打乱</button></div><div class="wb-number-klotski-note">点击空格旁的数字移动 · 方向键或滑动可移动空格</div></div>';

  const boardElement = root.querySelector('#wb-number-klotski-board');
  boardElement.style.setProperty('--wb-number-klotski-size', String(size));
  boardElement.style.setProperty('--wb-number-klotski-font', size === 4 ? '11.5cqw' : size === 5 ? '9.2cqw' : '7.6cqw');
  boardElement.innerHTML = Array.from({ length:size * size }, (_, index) => '<button type="button" class="wb-number-klotski-tile" data-index="' + index + '" role="gridcell"></button>').join('');
  const cells = Array.from(boardElement.children);

  function syncClock() {
    const now = Date.now();
    if (!destroyed && !over && env.isActive() && !env.isPaused()) elapsedMs += Math.max(0, Math.min(1000, now - lastClockAt));
    lastClockAt = now;
  }

  function correctTileCount() {
    return board.reduce((count, value, index) => count + (value && value === index + 1 ? 1 : 0), 0);
  }

  function stateData() {
    syncClock();
    return {
      version:1,
      choice:difficulty,
      difficulty,
      size,
      board:board.slice(),
      moves,
      elapsedMs:Math.round(elapsedMs),
      undoCount,
      history:history.slice(-200).map(cloneBoard),
      seen:Object.assign({}, seen),
      lastMoveElapsed,
      details:Object.assign({}, details),
      score:0,
    };
  }

  function save(force) {
    if (force && pendingSaveTimer) {
      win.clearTimeout(pendingSaveTimer);
      pendingSaveTimer = 0;
    }
    if (!destroyed && !over) env.save(stateData(), force);
  }

  function scheduleSave() {
    if (pendingSaveTimer || destroyed || over) return;
    pendingSaveTimer = win.setTimeout(() => {
      pendingSaveTimer = 0;
      save(false);
    }, 180);
  }

  function updateCell(index, movable) {
    const cell = cells[index];
    const value = board[index];
    const classes = ['wb-number-klotski-tile'];
    if (!value) classes.push('empty');
    if (value && value === index + 1) classes.push('correct');
    if (movable.has(index)) classes.push('movable');
    if (index === lastMovedInto && value) classes.push('moved');
    const className = classes.join(' ');
    const text = value ? String(value) : '';
    const label = value ? ('数字' + value + (movable.has(index) ? '，可移动' : '')) : '空格';
    if (cell.className !== className) cell.className = className;
    if (cell.textContent !== text) cell.textContent = text;
    if (cell.disabled !== !value) cell.disabled = !value;
    if (cell.getAttribute('aria-label') !== label) cell.setAttribute('aria-label', label);
  }

  function updateUI(forceBoard = true) {
    const movable = new Set(numberKlotskiMovableIndices(board, size));
    if (forceBoard) cells.forEach((_, index) => updateCell(index, movable));
    const moveElement = root.querySelector('#wb-number-klotski-moves');
    const timeElement = root.querySelector('#wb-number-klotski-time');
    const bestElement = root.querySelector('#wb-number-klotski-best');
    const undoButton = root.querySelector('#wb-number-klotski-undo');
    if (moveElement) moveElement.textContent = String(moves);
    if (timeElement) timeElement.textContent = formatTime(elapsedMs);
    if (bestElement) bestElement.textContent = bests[size]?.moves ? bests[size].moves + '步' : '--';
    if (undoButton) undoButton.disabled = over || env.isPaused() || !history.length;
    const toolbarScore = doc.querySelector('#wb-score');
    if (toolbarScore && !over) toolbarScore.textContent = '步数：' + moves;
  }

  function pulseInvalid(index) {
    const cell = cells[index];
    if (!cell || !board[index]) return;
    cell.classList.remove('invalid');
    void cell.offsetWidth;
    cell.classList.add('invalid');
    win.setTimeout(() => cell.classList.remove('invalid'), 190);
    const now = Date.now();
    details.wrongClicks = (details.wrongClicks || 0) + 1;
    if (now - lastWrongAt > 2200) env.speak('wrong');
    lastWrongAt = now;
  }

  function announceProgress() {
    const total = size * size - 1;
    const correct = correctTileCount();
    const progress = correct / total;
    details.progressPeak = Math.max(Number(details.progressPeak) || 0, Math.round(progress * 100));
    const distance = numberKlotskiDistance(board, size);
    details.minDistance = Math.min(Number(details.minDistance) || distance, distance);
    if (!seen.goodStart && moves <= 12 && distance <= Math.max(0, initialDistance - 4)) { seen.goodStart = true; env.speak('good_start'); }
    if (!seen.progress25 && progress >= .25) { seen.progress25 = true; env.speak('progress_25'); }
    if (!seen.progress50 && progress >= .5) { seen.progress50 = true; env.speak('progress_50'); }
    if (!seen.progress75 && progress >= .75) { seen.progress75 = true; env.speak('progress_75'); }
    if (!seen.nearFinish && correct >= total - 3) { seen.nearFinish = true; env.speak('near_finish'); }
  }

  function updateBest(score) {
    const previous = bests[size];
    const candidate = { moves, elapsedMs:Math.round(elapsedMs), score, savedAt:Date.now() };
    const improves = !previous || moves < Number(previous.moves) || (moves === Number(previous.moves) && elapsedMs < Number(previous.elapsedMs || Infinity));
    if (improves) {
      bests[size] = candidate;
      saveBestStorage(win, bests);
    }
    return { improves, hadPrevious:!!previous };
  }

  function finishGame() {
    if (over || destroyed) return;
    syncClock();
    over = true;
    const score = calculateNumberKlotskiScore(size, moves, elapsedMs);
    const record = updateBest(score);
    const efficient = moves <= config.targetMoves;
    const fast = elapsedMs <= config.targetSeconds * 1000;
    const newBest = record.improves && record.hadPrevious;
    const achievements = numberKlotskiAchievements(size, moves, elapsedMs, newBest);
    details = Object.assign({}, details, {
      completed:true,
      size,
      moves,
      forwardMoves:moves,
      undos:undoCount,
      elapsedMs:Math.round(elapsedMs),
      score,
      efficient,
      fast,
      newBest,
      achievements,
      finalDistance:0,
    });
    boardElement.classList.add('complete');
    updateUI(true);
    if (record.improves && record.hadPrevious) env.speak('record');
    env.setScore(score);
    env.speak('gameover');
    env.finish('数字华容道完成', '本局分数：' + score + '分（' + size + '×' + size + '），' + moves + '步，用时' + formatTime(elapsedMs) + '，撤回' + undoCount + '次' + (achievements.length ? '，达成：' + achievements.join('、') : ''), { outcome:'score', score }, { score, size, moves, undoCount, elapsedMs:Math.round(elapsedMs), efficient, fast, newBest:details.newBest, achievements, details:Object.assign({}, details) });
  }

  function moveTile(index) {
    if (destroyed || over || env.isPaused() || !env.isActive()) return false;
    const next = moveNumberKlotskiTile(board, size, index);
    if (!next) {
      pulseInvalid(index);
      return false;
    }
    syncClock();
    const blank = board.indexOf(0);
    history.push(board.slice());
    if (history.length > 200) history.shift();
    board = next;
    moves++;
    details.forwardMoves = moves;
    lastMoveElapsed = elapsedMs;
    seen.stuck = false;
    lastMovedInto = blank;
    if (moves === 1 || moves % 30 === 0) env.speak('move');
    announceProgress();
    updateUI(true);
    if (isNumberKlotskiSolved(board, size)) finishGame();
    else scheduleSave();
    return true;
  }

  function moveBlank(direction) {
    const blank = board.indexOf(0);
    const row = Math.floor(blank / size);
    const col = blank % size;
    let target = -1;
    if (direction === 'left' && col > 0) target = blank - 1;
    if (direction === 'right' && col < size - 1) target = blank + 1;
    if (direction === 'up' && row > 0) target = blank - size;
    if (direction === 'down' && row < size - 1) target = blank + size;
    if (target >= 0) return moveTile(target);
    return false;
  }

  function undo() {
    if (destroyed || over || env.isPaused() || !history.length) return;
    syncClock();
    board = history.pop();
    undoCount++;
    details.undos = undoCount;
    lastMoveElapsed = elapsedMs;
    seen.stuck = false;
    lastMovedInto = -1;
    env.speak('undo');
    updateUI(true);
    scheduleSave();
  }

  function reshuffle() {
    if (destroyed || over || env.isPaused()) return;
    env.confirm('重新打乱数字', '确定重新打乱吗？当前棋盘、步数和用时会清零。', () => {
      if (typeof env.restart === 'function') env.restart({ choice:difficulty, difficulty, size });
    });
  }

  function onBoardClick(event) {
    if (Date.now() < suppressClickUntil) return;
    const cell = event.target.closest?.('[data-index]');
    if (cell && boardElement.contains(cell)) moveTile(Number(cell.dataset.index));
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStart = { id:event.pointerId, x:event.clientX, y:event.clientY };
  }

  function onPointerUp(event) {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    suppressClickUntil = Date.now() + 250;
    event.preventDefault();
    moveBlank(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
  }

  function onKeyDown(event) {
    if (!/^Arrow(Left|Right|Up|Down)$/.test(event.key)) return;
    if (doc.querySelector('.wb-modal-mask')) return;
    const tag = String(event.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    event.preventDefault();
    moveBlank(event.key.slice(5).toLowerCase());
  }

  function timerTick() {
    if (destroyed || over) return;
    syncClock();
    const second = Math.floor(elapsedMs / 1000);
    if (second !== lastShownSecond) {
      lastShownSecond = second;
      updateUI(false);
    }
    if (moves > 0 && !seen.stuck && elapsedMs - lastMoveElapsed >= 45000) {
      seen.stuck = true;
      env.speak('stuck');
      scheduleSave();
    }
  }

  function saveOnLeave() { save(true); }
  function saveOnHidden() { if (doc.hidden) save(true); }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (pendingSaveTimer) win.clearTimeout(pendingSaveTimer);
    if (timer) win.clearInterval(timer);
    timer = 0;
    boardElement.removeEventListener('click', onBoardClick);
    boardElement.removeEventListener('pointerdown', onPointerDown);
    boardElement.removeEventListener('pointerup', onPointerUp);
    doc.removeEventListener('keydown', onKeyDown);
    win.removeEventListener?.('pagehide', saveOnLeave);
    doc.removeEventListener?.('visibilitychange', saveOnHidden);
  }

  root.querySelector('#wb-number-klotski-undo').addEventListener('click', undo);
  root.querySelector('#wb-number-klotski-shuffle').addEventListener('click', reshuffle);
  boardElement.addEventListener('click', onBoardClick);
  boardElement.addEventListener('pointerdown', onPointerDown, { passive:true });
  boardElement.addEventListener('pointerup', onPointerUp, { passive:false });
  doc.addEventListener('keydown', onKeyDown);
  win.addEventListener?.('pagehide', saveOnLeave);
  doc.addEventListener?.('visibilitychange', saveOnHidden);
  function startTimer() {
    lastClockAt = Date.now();
    if (!timer && !destroyed && !over && env.isActive() && !env.isPaused()) timer = win.setInterval(timerTick, 1000);
  }
  function pause() {
    syncClock();
    if (timer) win.clearInterval(timer);
    timer = 0;
    lastClockAt = Date.now();
  }
  function resume() { startTimer(); }
  startTimer();
  env.speak(restored ? 'resume' : 'start');
  updateUI(true);
  save(true);
  return { destroy, pause, resume, save:() => save(true), getState:stateData };
}
