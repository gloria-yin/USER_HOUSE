export function spiderDealColumns(stockCount, columnCount = 10) {
  const stock = Math.max(0, Math.floor(Number(stockCount) || 0));
  const columns = Math.max(0, Math.floor(Number(columnCount) || 0));
  return Array.from({ length:Math.min(stock, columns) }, (_, index) => index);
}

export function canSpiderDeal(stockCount, columnCardCounts = []) {
  const stock = Math.max(0, Math.floor(Number(stockCount) || 0));
  const counts = Array.isArray(columnCardCounts) ? columnCardCounts : [];
  if (!counts.length) return false;
  if (stock < counts.length) return true;
  return counts.every(count => Number(count) > 0);
}

export function spiderAutoDealState(stockCount, columnCardCounts = [], stepsLeft = 0) {
  const due = Math.max(0, Math.floor(Number(stepsLeft) || 0)) === 0;
  const canDeal = canSpiderDeal(stockCount, columnCardCounts);
  return { due, canDeal, shouldDeal:due && canDeal };
}

export function spiderCardLayout(cards = [], availableHeight = 0, cardHeight = 48) {
  const list = Array.isArray(cards) ? cards : [];
  const height = Math.max(1, Number(cardHeight) || 48);
  if (!list.length) return { tops:[], height:height + 12, scroll:false };

  const gaps = list.slice(0, -1).map(card => card?.face === false ? 8 : 17);
  const minimums = list.slice(0, -1).map(card => card?.face === false ? 6 : 13);
  const wanted = gaps.reduce((sum, gap) => sum + gap, height + 4);
  const available = Math.max(80, Number(availableHeight) || 0);
  if (wanted > available) {
    const reducible = gaps.reduce((sum, gap, index) => sum + gap - minimums[index], 0);
    const need = Math.min(reducible, wanted - available);
    if (need > 0 && reducible > 0) {
      gaps.forEach((gap, index) => {
        const share = need * (gap - minimums[index]) / reducible;
        gaps[index] = Math.max(minimums[index], gap - share);
      });
    }
  }

  const tops = [0];
  gaps.forEach(gap => tops.push(tops[tops.length - 1] + gap));
  const columnHeight = Math.ceil(tops[tops.length - 1] + height + 4);
  return { tops:tops.map(top => Math.round(top * 10) / 10), height:columnHeight, scroll:columnHeight > available + 1 };
}
