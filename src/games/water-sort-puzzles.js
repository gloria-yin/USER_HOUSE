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
  const baseComplexity = Math.round(colorCount * 3.6) - 3 + Math.max(0, structureTier - 16);
  const roundIndex = (safeLevel - 1) % 3;
  const maxComplexity = colorCount * 6 - 4;
  const extra = Math.max(0, structureTier - 16);
  const easyMax = Math.round(maxComplexity * .52 + extra * .15);
  const mediumMax = Math.floor(maxComplexity * .68 + extra * .15);
  const bottleCount = colorCount + 2;
  return {
    level:safeLevel, band, colorCount, emptyCount:0, bottleCount, structureTier,
    roundIndex, hardRound:roundIndex === 2,
    minMixed:roundIndex === 2
      ? Math.max(Math.ceil((colorCount + 2) * .7), Math.min(colorCount, 2 + Math.floor(structureTier / 2)))
      : Math.max(3, Math.ceil(bottleCount * [.5, .62][roundIndex])),
    minBicolor:[Math.ceil(bottleCount * .6), Math.ceil(bottleCount * .45), 0][roundIndex],
    minMulticolor:Math.max(roundIndex === 0 ? 0 : 1, Math.floor(colorCount * [.08, .18, .45][roundIndex])),
    maxMulticolor:[Math.floor(bottleCount * .35), Math.floor(bottleCount * .55), bottleCount][roundIndex],
    minComplexity:[Math.max(5, Math.round(easyMax * .7)), easyMax + 1, baseComplexity][roundIndex],
    maxComplexity:[easyMax, mediumMax, maxComplexity][roundIndex],
    endlessCycle:Math.max(0, band - 40),
  };
}

export function waterSortMetrics(bottles) {
  let transitions = 0;
  let joinedLayers = 0;
  let mixed = 0;
  let bicolor = 0;
  let multicolor = 0;
  const dependencies = new Set();
  for (const bottle of bottles) {
    const distinct = new Set(bottle).size;
    if (distinct > 1) mixed++;
    if (distinct === 2) bicolor++;
    if (distinct >= 3) multicolor++;
    for (let i = 1; i < bottle.length; i++) {
      if (bottle[i] === bottle[i - 1]) joinedLayers++;
      else {
        transitions++;
        dependencies.add(bottle[i] + ':' + bottle[i - 1]);
      }
    }
  }
  return { mixed, bicolor, multicolor, transitions, joinedLayers, dependencies:dependencies.size, complexity:transitions + dependencies.size };
}

// Bottle order is irrelevant; delimiters keep two-digit color IDs unambiguous.
export function waterSortStateKey(bottles) {
  return bottles.map(bottle => bottle.join(',')).sort().join('|');
}

export function waterSortStructureKey(bottles) {
  const colors = [...new Set(bottles.flat())];
  const occurrences = new Map(colors.map(color => [color, []]));
  bottles.forEach((bottle, bottleIndex) => bottle.forEach((color, index) => occurrences.get(color).push([bottleIndex, index])));
  let labels = new Map(colors.map(color => [color, 0]));
  // Color refinement is invariant to bottle positions and color renaming.
  // Ambiguous symmetric structures may be over-deduplicated, never counted as new just by recoloring.
  for (let pass = 0; pass < colors.length; pass++) {
    const rows = bottles.map(bottle => bottle.map(color => labels.get(color)).join(','));
    const profiles = colors.map(color => JSON.stringify(occurrences.get(color)
      .map(([bottleIndex, index]) => index + ',' + rows[bottleIndex]).sort()));
    const ordered = [...new Set(profiles)].sort();
    const ranks = new Map(ordered.map((profile, index) => [profile, index]));
    labels = new Map(colors.map((color, index) => [color, ranks.get(profiles[index])]));
  }
  return waterSortStateKey(bottles.map(bottle => bottle.map(color => labels.get(color))));
}

export function solveWaterSort(bottles, { maxNodes = 25000, maxTimeMs = Infinity } = {}) {
  const top = bottle => bottle[bottle.length - 1];
  const uniform = bottle => bottle.every(color => color === bottle[0]);
  const solved = board => board.every(bottle => !bottle.length || (bottle.length === CAPACITY && uniform(bottle)));
  const seen = new Set();
  let visited = 0;
  let exhausted = false;
  const deadline = performance.now() + Math.max(0, maxTimeMs);
  function search(board, depth) {
    if (solved(board)) return [];
    if ((visited & 63) === 0 && performance.now() >= deadline) exhausted = true;
    if (exhausted) return null;
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
      if (exhausted || visited >= maxNodes) break;
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

export function generateWaterSortCandidate(level, random = Math.random, { attempts = 96, maxNodes = 12000, maxTimeMs = 1000, excluded = [] } = {}) {
  const config = waterSortDifficulty(level);
  const deadline = performance.now() + Math.max(0, maxTimeMs);
  const seen = new Set(excluded);
  for (let attempt = 0; attempt < attempts && performance.now() < deadline; attempt++) {
    // Spread water as evenly as possible. With colorCount + 2 bottles this
    // avoids every full starting bottle through 6 colors, and above that keeps
    // the number of full bottles at the mathematical minimum (colorCount - 6).
    const waterCount = config.colorCount * CAPACITY;
    const baseLength = Math.floor(waterCount / config.bottleCount);
    const longerCount = waterCount % config.bottleCount;
    const lengths = Array.from({ length:config.bottleCount }, (_, index) => baseLength + (index < longerCount ? 1 : 0));
    for (let index = lengths.length - 1; index > 0; index--) {
      const target = Math.floor(random() * (index + 1));
      [lengths[index], lengths[target]] = [lengths[target], lengths[index]];
    }
    // The third round keeps the full-layer shuffle; earlier rounds allow small matching groups.
    // All groups are shuffled globally, so no ordered-color chain is retained.
    const groups = [];
    const target = (config.minComplexity + config.maxComplexity) / 2;
    const pairChance = config.hardRound ? 0 : Math.min(.95,
      Math.max(.05, Math.min(.9, (config.colorCount * 6 - 4 - target) / (config.colorCount * 3))) * (.6 + random() * .8)
        + [.16, .07][config.roundIndex]);
    for (let color = 0; color < config.colorCount; color++) {
      for (let remaining = CAPACITY; remaining > 0;) {
        const length = pairChance && remaining > 1 && random() < pairChance ? 2 : 1;
        groups.push(Array(length).fill(color));
        remaining -= length;
      }
    }
    for (let i = groups.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [groups[i], groups[j]] = [groups[j], groups[i]];
    }
    const water = groups.flat();
    let offset = 0;
    const bottles = lengths.map(length => water.slice(offset, offset += length));
    const metrics = waterSortMetrics(bottles);
    if (bottles.some(bottle => bottle.length === CAPACITY && bottle.every(c => c === bottle[0]))) continue;
    if (metrics.mixed < config.minMixed || metrics.bicolor < config.minBicolor
      || metrics.multicolor < config.minMulticolor || metrics.multicolor > config.maxMulticolor
      || metrics.complexity < config.minComplexity || metrics.complexity > config.maxComplexity) continue;
    if (seen.size && seen.has(waterSortStructureKey(bottles))) continue;
    const result = solveWaterSort(bottles, { maxNodes, maxTimeMs:deadline - performance.now() });
    if (!result.solution?.length) continue;
    return { bottles, solution:result.solution, colorCount:config.colorCount, emptyCount:0,
      par:result.solution.length, ...metrics };
  }
  return null;
}
