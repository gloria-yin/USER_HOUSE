import { generateWaterSortCandidate, solveWaterSort, waterSortRandom, waterSortStructureKey } from './water-sort-puzzles.js';

self.onmessage = ({ data }) => {
  const { id, kind } = data;
  try {
    if (kind === 'hint') {
      self.postMessage({ id, result:solveWaterSort(data.bottles, { maxNodes:60000 }).solution });
    } else {
      const random = waterSortRandom(data.seed);
      let result = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const candidate = generateWaterSortCandidate(data.level, random, { attempts:12, maxNodes:12000 });
        if (candidate && !data.excluded.includes(waterSortStructureKey(candidate.bottles))) {
          result = candidate;
          break;
        }
      }
      self.postMessage({ id, result });
    }
  } catch {
    self.postMessage({ id, result:null });
  }
};
