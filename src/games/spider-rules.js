export function spiderDealColumns(stockCount, columnCount = 10) {
  const stock = Math.max(0, Math.floor(Number(stockCount) || 0));
  const columns = Math.max(0, Math.floor(Number(columnCount) || 0));
  return Array.from({ length:Math.min(stock, columns) }, (_, index) => index);
}
