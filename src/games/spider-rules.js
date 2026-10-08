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
