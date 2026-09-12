import LZString from '../vendor/lz-string.js';

const FORMAT = 'wanban-lz-v1';
const decodedTextCache = new Map();
const MAX_CACHED_CHARACTERS = 4 * 1024 * 1024;
let cachedCharacters = 0;

function rememberDecodedText(raw, json) {
  const size = raw.length + json.length;
  if (size > MAX_CACHED_CHARACTERS || decodedTextCache.has(raw)) return;
  while (decodedTextCache.size >= 8 || cachedCharacters + size > MAX_CACHED_CHARACTERS) {
    const oldest = decodedTextCache.keys().next().value;
    cachedCharacters -= oldest.length + decodedTextCache.get(oldest).length;
    decodedTextCache.delete(oldest);
  }
  decodedTextCache.set(raw, json);
  cachedCharacters += size;
}

function cachedDecodedText(raw) {
  const json = decodedTextCache.get(raw);
  if (json !== undefined) {
    decodedTextCache.delete(raw);
    decodedTextCache.set(raw, json);
  }
  return json;
}

function encodeJSONText(json) {
  if (json === undefined) throw new Error('Cannot store an undefined value');
  if (json.length < 4096) return json;
  const packed = JSON.stringify({ format:FORMAT, data:LZString.compressToUTF16(json) });
  return packed.length < json.length * 0.9 ? packed : json;
}

export function encodeStoredJSON(value) {
  return encodeJSONText(JSON.stringify(value));
}

export function decodeStoredJSON(raw) {
  const cached = cachedDecodedText(raw);
  // Cache text rather than mutable objects, so every caller still gets an independent value.
  if (cached !== undefined) return JSON.parse(cached);
  const value = JSON.parse(raw);
  if (value?.format !== FORMAT) return value;
  const json = LZString.decompressFromUTF16(value.data);
  if (!json) throw new Error('Invalid compressed save');
  rememberDecodedText(raw, json);
  return JSON.parse(json);
}

export function writeStoredJSON(storage, key, value) {
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error('Cannot store an undefined value');
  const previous = storage.getItem(key);
  if (previous === json || (previous !== null && cachedDecodedText(previous) === json)) return;
  const raw = encodeJSONText(json);
  if (previous === raw) return;
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw new Error('Storage verification failed: ' + key);
  if (raw !== json) rememberDecodedText(raw, json);
}

export function compactLegacyStorage(storage, prefix, excluded = []) {
  const keys = Array.from({ length:storage.length }, (_, i) => storage.key(i));
  for (const key of keys) {
    if (!key?.startsWith(prefix) || excluded.includes(key)) continue;
    try {
      const original = storage.getItem(key);
      if (!original || original.length < 4096) continue;
      const value = JSON.parse(original);
      if (value?.format === FORMAT) continue;
      const packed = encodeStoredJSON(value);
      // Replacing a key atomically leaves the previous save intact on quota failure.
      if (packed.length < original.length) storage.setItem(key, packed);
    } catch (error) {
      console.warn('[Wanban] Could not compact saved data:', key, error);
    }
  }
}
