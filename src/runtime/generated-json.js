function repairJsonText(text) {
  let result = '', quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (escaped) { result += ch; escaped = false; continue; }
      if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
      else if (ch.charCodeAt(0) < 32) { result += JSON.stringify(ch).slice(1, -1); continue; }
    } else {
      if (ch === '"') quoted = true;
      // Remove trailing commas only outside dialogue strings.
      if (ch === ',' && /^\s*[}\]]/.test(text.slice(i + 1))) continue;
    }
    result += ch;
  }
  return result;
}

export function parseGeneratedJson(text) {
  const raw = String(text || '');
  try { return JSON.parse(raw); } catch (_) {}
  const clean = raw.replace(/^\uFEFF/, '').replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?\s*>/gi, '').trim();
  const fenced = Array.from(clean.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi), match => match[1].trim());
  const candidates = [...fenced, clean];
  // Scan complete containers without inventing missing keys or closing truncated output.
  let start = -1, stack = [], quoted = false, escaped = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (start < 0) {
      if (ch !== '{' && ch !== '[') continue;
      start = i;
    }
    if (escaped) { escaped = false; continue; }
    if (quoted) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') {
      if (stack.pop() !== ch) { start = -1; stack = []; continue; }
      if (!stack.length) { candidates.push(clean.slice(start, i + 1)); start = -1; }
    }
  }
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch (_) {}
    try { return JSON.parse(repairJsonText(candidate)); } catch (_) {}
  }
  const error = new Error('AI返回内容不是完整可解析JSON，请检查是否截断、缺少引号或括号');
  error.rawOutput = raw;
  throw error;
}
