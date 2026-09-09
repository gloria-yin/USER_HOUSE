const CAPACITY = 4;
const MAX_COLORS = 18;

export function waterSortRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function waterSortDifficulty(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const band = Math.ceil(safeLevel / 3);
  const structureTier = Math.min(40, band);
  const colorCount = Math.min(MAX_COLORS, band + 2);
  const hardRound = safeLevel % 3 === 0;
  const baseComplexity = 6 + (structureTier - 1) * 2;
  return {
    level:safeLevel, band, colorCount, emptyCount:0, bottleCount:colorCount + 2, structureTier, hardRound,
    minMixed:Math.min(colorCount, 2 + Math.floor(band / 2)),
    minComplexity:baseComplexity + (hardRound ? 2 : 0),
    endlessCycle:Math.max(0, band - 40),
  };
}

export function waterSortMetrics(bottles) {
  let transitions = 0;
  let joinedLayers = 0;
  let mixed = 0;
  const dependencies = new Set();
  for (const bottle of bottles) {
    if (new Set(bottle).size > 1) mixed++;
    for (let i = 1; i < bottle.length; i++) {
      if (bottle[i] === bottle[i - 1]) joinedLayers++;
      else {
        transitions++;
        dependencies.add(bottle[i] + ':' + bottle[i - 1]);
      }
    }
  }
  return { mixed, transitions, joinedLayers, dependencies:dependencies.size, complexity:transitions + dependencies.size };
}

// Bottle order is irrelevant; delimiters keep two-digit color IDs unambiguous.
export function waterSortStateKey(bottles) {
  return bottles.map(bottle => bottle.join(',')).sort().join('|');
}

export function waterSortStructureKey(bottles) {
  const colors = [...new Set(bottles.flat())];
  let labels = new Map(colors.map(color => [color, 0]));
  // Color refinement is invariant to bottle positions and color renaming.
  // Ambiguous symmetric structures may be over-deduplicated, never counted as new just by recoloring.
  for (let pass = 0; pass < colors.length; pass++) {
    const profiles = colors.map(color => JSON.stringify(bottles.flatMap(bottle => bottle.flatMap((value, index) =>
      value === color ? [[index, ...bottle.map(c => labels.get(c))].join(',')] : [])).sort()));
    const ordered = [...new Set(profiles)].sort();
    labels = new Map(colors.map((color, index) => [color, ordered.indexOf(profiles[index])]));
  }
  return waterSortStateKey(bottles.map(bottle => bottle.map(color => labels.get(color))));
}

export function solveWaterSort(bottles, { maxNodes = 25000 } = {}) {
  const top = bottle => bottle[bottle.length - 1];
  const uniform = bottle => bottle.every(color => color === bottle[0]);
  const solved = board => board.every(bottle => !bottle.length || (bottle.length === CAPACITY && uniform(bottle)));
  const seen = new Set();
  let visited = 0;
  function search(board, depth) {
    if (solved(board)) return [];
    if (visited >= maxNodes || depth >= 240) return null;
    const key = waterSortStateKey(board);
    if (seen.has(key)) return null;
    seen.add(key);
    visited++;
    const candidates = [];
    const sources = new Set();
    for (let from = 0; from < board.length; from++) {
      const source = board[from];
      if (!source.length || (source.length === CAPACITY && uniform(source))) continue;
      const sourceKey = source.join(',');
      if (sources.has(sourceKey)) continue;
      sources.add(sourceKey);
      let run = 1;
      while (run < source.length && source[source.length - run - 1] === top(source)) run++;
      const targets = new Set();
      for (let to = 0; to < board.length; to++) {
        const target = board[to];
        if (from === to || target.length === CAPACITY || (target.length && top(target) !== top(source))) continue;
        if (!target.length && run === source.length) continue;
        const targetKey = target.join(',');
        if (targets.has(targetKey)) continue;
        targets.add(targetKey);
        const amount = Math.min(run, CAPACITY - target.length);
        const priority = (target.length ? 8 : 0) + (target.length + amount === CAPACITY && uniform(target) ? 12 : 0)
          + (amount === source.length ? 5 : 0) + (run < source.length && amount === run ? 3 : 0);
        candidates.push({ from, to, amount, priority });
      }
    }
    candidates.sort((a, b) => b.priority - a.priority);
    for (const move of candidates) {
      if (visited >= maxNodes) break;
      const next = board.map(bottle => bottle.slice());
      next[move.to].push(...next[move.from].splice(-move.amount));
      const rest = search(next, depth + 1);
      if (rest) return [{ from:move.from, to:move.to }, ...rest];
    }
    return null;
  }
  const solution = search(bottles, 0);
  return { solution, visited };
}

export function generateWaterSortCandidate(level, random = Math.random, { attempts = 16, maxNodes = 12000 } = {}) {
  const config = waterSortDifficulty(level);
  let best = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const lengths = Array(config.bottleCount).fill(1);
    for (let remaining = config.colorCount * CAPACITY - lengths.length; remaining > 0; remaining--) {
      const available = lengths.flatMap((length, index) => length < CAPACITY ? [index] : []);
      lengths[available[Math.floor(random() * available.length)]]++;
    }
    const water = Array.from({ length:config.colorCount }, (_, color) => Array(CAPACITY).fill(color)).flat();
    let offset = 0;
    const bottles = lengths.map(length => water.slice(offset, offset += length));
    const target = config.minComplexity;
    const swaps = config.colorCount * 30;
    for (let i = 0; i < swaps; i++) {
      const completed = bottles.flatMap((bottle, index) => bottle.length === CAPACITY && bottle.every(c => c === bottle[0]) ? [index] : []);
      const a = completed.length ? completed[Math.floor(random() * completed.length)] : Math.floor(random() * bottles.length);
      const b = Math.floor(random() * bottles.length);
      const x = Math.floor(random() * bottles[a].length);
      const y = Math.floor(random() * bottles[b].length);
      [bottles[a][x], bottles[b][y]] = [bottles[b][y], bottles[a][x]];
      const progress = waterSortMetrics(bottles);
      if (progress.complexity >= target && progress.mixed >= config.minMixed && !bottles.some(bottle => bottle.length === CAPACITY && bottle.every(c => c === bottle[0]))) break;
    }
    const metrics = waterSortMetrics(bottles);
    if (bottles.some(bottle => bottle.length === CAPACITY && bottle.every(c => c === bottle[0]))) continue;
    if (metrics.mixed < config.minMixed || metrics.complexity < target || metrics.complexity > target + 1) continue;
    const result = solveWaterSort(bottles, { maxNodes });
    if (!result.solution?.length) continue;
    const candidate = { bottles, solution:result.solution, colorCount:config.colorCount, emptyCount:0,
      par:result.solution.length, ...metrics };
    // Prefer the lower end of each tier, avoiding unnecessarily hard early puzzles.
    if (!best || candidate.complexity < best.complexity) best = candidate;
    if (best.complexity === target) break;
  }
  return best;
}
