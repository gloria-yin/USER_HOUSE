import { HEART_STORAGE_KEY, normalizeStore, clone } from './engine.js?v=4.1.13-heart-logs';
import { decodeStoredJSON, writeStoredJSON } from '../runtime/storage.js';

// Commit before publishing state; quota errors and other tabs cannot silently overwrite a save.
export function createRepository(storage) {
  let raw = storage.getItem(HEART_STORAGE_KEY);
  let state = normalizeStore(raw ? decodeStoredJSON(raw) : null);
  function reload() {
    const latest = storage.getItem(HEART_STORAGE_KEY);
    const next = normalizeStore(latest ? decodeStoredJSON(latest) : null);
    raw = latest; state = next;
    return state;
  }
  function update(change) {
    if (storage.getItem(HEART_STORAGE_KEY) !== raw) throw new Error('心动挑战存档已被另一个页面更新，请重新载入后继续。');
    const next = clone(state);
    const result = change(next);
    next.version = 1;
    writeStoredJSON(storage, HEART_STORAGE_KEY, next);
    raw = storage.getItem(HEART_STORAGE_KEY);
    state = next;
    return result;
  }
  return { get state() { return state; }, update, reload };
}
