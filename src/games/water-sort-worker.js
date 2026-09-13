import { generateWaterSortCandidate, waterSortRandom } from './water-sort-puzzles.js';

self.onmessage = ({ data }) => {
  const { id, kind } = data;
  try {
    if (kind !== 'generate') throw new Error('Unsupported water-sort worker request');
    const random = waterSortRandom(data.seed);
    const result = generateWaterSortCandidate(data.level, random, { maxTimeMs:1200, excluded:data.excluded });
    self.postMessage({ id, result });
  } catch {
    self.postMessage({ id, result:null });
  }
};
