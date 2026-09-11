import LZString from '../vendor/lz-string.js';

const FORMAT = 'wanban-lz-v1';

export function encodeStoredJSON(value) {
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error('Cannot store an undefined value');
  if (json.length < 4096) return json;
  const packed = JSON.stringify({ format:FORMAT, data:LZString.compressToUTF16(json) });
  return packed.length < json.length * 0.9 ? packed : json;
}

export function decodeStoredJSON(raw) {
  const value = JSON.parse(raw);
  if (value?.format !== FORMAT) return value;
  const json = LZString.decompressFromUTF16(value.data);
  if (!json) throw new Error('Invalid compressed save');
  return JSON.parse(json);
}

export function writeStoredJSON(storage, key, value) {
  const raw = encodeStoredJSON(value);
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw new Error('Storage verification failed: ' + key);
}

export function compactLegacyStorage(storage, prefix, excluded = []) {
  const keys = Array.from({ length:storage.length }, (_, i) => storage.key(i));
  for (const key of keys) {
    if (!key?.startsWith(prefix) || excluded.includes(key)) continue;
    try {
      const original = storage.getItem(key);
      if (!original || original.length < 4096) continue;
      const packed = encodeStoredJSON(decodeStoredJSON(original));
      // Replacing a key atomically leaves the previous save intact on quota failure.
      if (packed.length < original.length) storage.setItem(key, packed);
    } catch (error) {
      console.warn('[Wanban] Could not compact saved data:', key, error);
    }
  }
}
