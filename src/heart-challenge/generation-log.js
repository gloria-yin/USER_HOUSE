const taskNames = { game:'剧情', reply:'补充剧情', ending:'结局' };
const statusNames = { success:'通过校验', failed:'失败', cancelled:'已取消', pending:'进行中或意外中断' };

export function generationLogFilename(record) {
  const stamp = new Date(record.startedAt).toISOString().replace(/[:.]/g, '-');
  const id = String(record.requestId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `heart-generation-${stamp}-${id}-${record.attempt}.txt`;
}

export function generationLogText(record) {
  return [
    '心动挑战 · 生成测试记录',
    `任务：${taskNames[record.task] || record.task}`,
    `状态：${statusNames[record.status] || record.status}`,
    `开始时间：${new Date(record.startedAt).toISOString()}`,
    `结束时间：${record.finishedAt ? new Date(record.finishedAt).toISOString() : '尚未结束'}`,
    `房间：${record.roomTitle || record.roomId}`,
    `游戏标识：${record.gameId}`,
    `请求标识：${record.requestId}`,
    `尝试：第 ${record.attempt} 次（首次生成计为 1）`,
    `失败原因：${record.error || '无'}`,
    '', '===== 原始输出 =====', record.raw || '',
  ].join('\n');
}

export async function uploadGenerationLog(record, { headers, fetch:fetcher = globalThis.fetch } = {}) {
  const bytes = new TextEncoder().encode(generationLogText(record));
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher('/api/files/upload', { method:'POST',
      headers:{ 'Content-Type':'application/json', ...headers }, signal:controller.signal,
      body:JSON.stringify({ name:generationLogFilename(record), data:btoa(binary) }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const path = '/' + String(result.path || '').replace(/^\/+/, '');
    if (!/^\/(?:user\/)?files\/[^/\\]+\.txt$/.test(path)) throw new Error('酒馆没有返回有效的记录文件地址');
    return path;
  } finally { clearTimeout(timer); }
}
