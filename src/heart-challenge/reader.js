// Page text against the rendered space, retaining every character and the reading position.
export function createFittedReader(root, { position = () => null, onMove = () => {} } = {}) {
  const records = new Map();
  function write(node, value) { node.textContent = value; }
  const segmenter = globalThis.Intl?.Segmenter ? new Intl.Segmenter(undefined, { granularity:'grapheme' }) : null;
  function fit() {
    for (const box of root.querySelectorAll('[data-reader]')) {
      const node = box.querySelector('[data-reader-text]');
      if (!node || !node.clientWidth || !node.clientHeight) continue;
      const key = box.dataset.readerKey, previous = records.get(key);
      const text = node.dataset.fitted === 'true' ? previous?.text || node.textContent : node.textContent;
      const style = root.ownerDocument.defaultView.getComputedStyle(node);
      const metrics = [node.clientWidth, node.clientHeight, style.font, style.lineHeight, style.letterSpacing].join(':');
      let record = previous;
      if (!record || record.text !== text || record.metrics !== metrics) {
        // Keep the user's text anchor while styles load or the viewport changes.
        const saved = position(), offset = previous?.text === text ? previous.anchor : saved?.key === key ? saved.offset : 0;
        const parts = segmenter ? Array.from(segmenter.segment(text), item => item.segment) : Array.from(text);
        const pages = [];
        let start = 0, charOffset = 0;
        while (start < parts.length) {
          const capacity = Math.ceil(node.clientWidth / 3) * Math.ceil(node.clientHeight / 8) + 64;
          let low = start + 1, high = Math.min(parts.length, start + capacity), end = low;
          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            write(node, parts.slice(start, mid).join(''), charOffset);
            if (node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1) { end = mid; low = mid + 1; }
            else high = mid - 1;
          }
          if (end < parts.length) {
            const floor = start + Math.floor((end - start) * .65);
            for (let i = end - 1; i > floor; i--) if (/[。！？!?；;\n]/.test(parts[i])) { end = i + 1; break; }
          }
          const value = parts.slice(start, end).join('');
          pages.push({ text:value, start:charOffset }); charOffset += value.length; start = end;
        }
        if (!pages.length) pages.push({ text:'', start:0 });
        record = { text, metrics, pages, anchor:offset, index:Math.max(0, pages.findLastIndex(page => page.start <= offset)) };
        records.set(key, record);
        while (records.size > 24) records.delete(records.keys().next().value);
      }
      node.dataset.fitted = 'true';
      paint(box, record);
    }
  }
  function paint(box, record) {
    write(box.querySelector('[data-reader-text]'), record.pages[record.index].text, record.pages[record.index].start);
    const count = box.querySelector('[data-reader-count]');
    if (count) count.textContent = `${record.index + 1} / ${record.pages.length}`;
    for (const button of box.querySelectorAll('[data-reader-step]')) {
      button.disabled = Number(button.dataset.readerStep) < 0 ? record.index === 0 : record.index === record.pages.length - 1;
    }
    box.dataset.readerPages = record.pages.length;
    box.dataset.readerIndex = record.index;
    box.dataset.readerOffset = record.pages[record.index].start;
    box.dataset.readerEnd = String(record.index === record.pages.length - 1);
  }
  function move(id, delta) {
    const box = [...root.querySelectorAll('[data-reader]')].find(node => node.dataset.reader === id);
    const record = box && records.get(box.dataset.readerKey);
    if (!record) return false;
    const index = Math.max(0, Math.min(record.pages.length - 1, record.index + delta));
    if (index === record.index) return false;
    record.index = index; record.anchor = record.pages[index].start; paint(box, record);
    onMove({ key:box.dataset.readerKey, offset:record.pages[index].start, id });
    return true;
  }
  return { fit, move, clear:() => records.clear() };
}
