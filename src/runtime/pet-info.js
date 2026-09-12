const MAIN_IDS = Array.from({ length:15 }, (_, i) => 'M' + String(i + 1).padStart(2, '0'));
const SIDE_IDS = ['SJ01', 'SJ02', 'SJ03', 'SA01', 'SA02', 'SA03'];
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const textValue = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

export function cleanPetInfoText(text) {
  let raw = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const wrapped = raw.match(/<pet_info\s*>([\s\S]*?)(?:<\/pet_info\s*>|$)/i);
  if (wrapped) raw = wrapped[1];
  raw = raw.replace(/^\s*```[^\n]*$/gm, '').replace(/^\s*(?:yaml|yml)\s*\n/i, '');
  raw = raw.split('\n').map(line => line.replace(/^[\t ]*/, indent => indent.replace(/\t/g, '  '))).join('\n');
  raw = raw.replace(/^(\s*[\w-]+:\s*)(\{\{[^\n]*)$/gm, (_, key, value) => key + JSON.stringify(value));
  // Older prompt templates indent quotes one space deeper than the other sections.
  const cardIndent = raw.match(/^( *)pet_card\s*:\s*$/m)?.[1];
  if (cardIndent !== undefined) raw = raw.replace(/^ *quotes\s*:\s*$/m, cardIndent + 'quotes:');
  return raw.trimEnd();
}

export function parsePetStoryLines(raw) {
  return String(raw || '').split(/\n|(?=\[(?:C|U|P|char|user|pet|旁白)\])/).map(line => {
    const match = line.trim().match(/^\[([^\]]+)\]\s*(.*)$/);
    return match ? { speaker:match[1], text:match[2] } : { speaker:'旁白', text:line.trim() };
  }).filter(line => line.text);
}

function storyData(value, petName, id, route) {
  const item = object(value);
  const story = textValue(item.story);
  return { ...item, id, ...(route ? { route } : {}), title:textValue(item.title) || id,
    summary:textValue(item.summary || item.opening_cause), story,
    lines:parsePetStoryLines(story), petName:petName || '宠物' };
}

// Pre-4.0 saves were read line by line, including text that is not valid YAML.
function parseLegacyPetInfo(raw, parseYaml) {
  const lines = raw.split('\n');
  const scalar = value => {
    const text = value.trim();
    try {
      const parsed = parseYaml(text);
      if (parsed == null || typeof parsed !== 'object' || /^[\[{]/.test(text)) return parsed;
    } catch (_) { /* Preserve legacy unescaped quotes and colons as text. */ }
    return text.replace(/^"([\s\S]*)"$/, '$1').replace(/^'([\s\S]*)'$/, '$1');
  };
  const field = line => line.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
  const fields = block => {
    const result = {};
    for (let i = 0; i < block.length; i++) {
      const match = field(block[i]);
      if (!match || ['__proto__', 'constructor', 'prototype'].includes(match[1])) continue;
      const [, key, value] = match;
      if (/^[|>][-+\d]*(?:\s+#.*)?$/.test(value.trim())) {
        const body = [];
        while (i + 1 < block.length && !field(block[i + 1])) body.push(block[++i]);
        try { result[key] = parseYaml('value: ' + value + '\n' + body.join('\n')).value; }
        catch (_) { result[key] = body.map(line => line.trim()).join('\n').trim(); }
      } else if (key !== 'variants' && key !== 'trigger') result[key] = scalar(value);
    }
    return result;
  };
  const headers = [];
  lines.forEach((line, index) => {
    const match = line.match(/^\s*(pet_card|main_story|side_story|quotes)\s*:\s*(?:#.*)?$/);
    if (match) headers.push({ key:match[1], index });
  });
  const data = { pet_card:{}, main_story:[], side_story:[], quotes:{ char:{}, pet:{} } };
  for (let i = 0; i < headers.length; i++) {
    const { key, index } = headers[i];
    const block = lines.slice(index + 1, headers[i + 1]?.index ?? lines.length);
    if (key === 'pet_card') { data.pet_card = fields(block); continue; }
    if (key === 'quotes') {
      let target, stage, action;
      const stages = ['egg', 'juvenile', 'adult', 'spirit', 'ordinary'];
      block.forEach((line, lineIndex) => {
        const match = field(line);
        const next = block.slice(lineIndex + 1).find(line => line.trim());
        if (match) {
          const [, key, value] = match;
          if (key === 'char' || (key === 'pet' && stages.includes(field(next || '')?.[1]))) {
            target = key; stage = action = null;
          } else if (target && stages.includes(key)) {
            stage = key; action = null; data.quotes[target][stage] = {};
          } else if (stage && ['feed', 'pet', 'poke', 'sleep', 'sad', 'play', 'outing'].includes(key)) {
            action = key;
            const parsed = value ? scalar(value) : [];
            data.quotes[target][stage][action] = Array.isArray(parsed) ? parsed : [parsed];
          }
        } else if (target && stage && action && /^\s*-\s*/.test(line)) {
          data.quotes[target][stage][action].push(scalar(line.replace(/^\s*-\s*/, '')));
        }
      });
      continue;
    }
    const starts = [];
    block.forEach((line, index) => {
      const match = line.match(/^\s*-\s*id\s*:\s*["']?([A-Za-z]+\d+)/);
      if (match) starts.push({ index, id:match[1] });
    });
    starts.forEach((start, index) => {
      const storyBlock = block.slice(start.index + 1, starts[index + 1]?.index ?? block.length);
      const variantStart = storyBlock.findIndex(line => /^\s*variants\s*:/.test(line));
      const item = { ...fields(variantStart < 0 ? storyBlock : storyBlock.slice(0, variantStart)), id:start.id };
      if (variantStart >= 0) {
        item.variants = {};
        const routes = [];
        storyBlock.forEach((line, index) => {
          const match = line.match(/^\s*(spirit|ordinary)\s*:\s*$/);
          if (index > variantStart && match) routes.push({ index, route:match[1] });
        });
        routes.forEach((entry, index) => {
          item.variants[entry.route] = fields(storyBlock.slice(entry.index + 1, routes[index + 1]?.index ?? storyBlock.length));
        });
      }
      const triggerStart = storyBlock.findIndex(line => /^\s*trigger\s*:/.test(line));
      if (triggerStart >= 0) {
        const rest = storyBlock.slice(triggerStart + 1);
        const end = rest.findIndex(line => /^\s*(title|opening_cause|summary|story)\s*:/.test(line));
        item.trigger = fields(end < 0 ? rest : rest.slice(0, end));
      }
      data[key].push(item);
    });
  }
  return data;
}

export function parsePetInfo(text, parseYaml, { allowLegacy = false } = {}) {
  const info = { pet_card:{}, main_story:[], side_story:[], quotes:{ char:{}, pet:{} },
    mainById:{}, sideById:{}, parseWarnings:[] };
  const warn = message => info.parseWarnings.push(message);
  let data;
  const raw = cleanPetInfoText(text);
  try {
    if (!raw.trim()) throw new Error('输出为空');
    data = object(parseYaml(raw));
    data = object(data.pet_info || data);
  } catch (error) {
    warn('YAML格式错误：' + error.message);
    if (!allowLegacy) return info;
  }
  if (allowLegacy && (!data || !Object.keys(object(data.pet_card)).length
    || !Array.isArray(data.main_story) || !Array.isArray(data.side_story) || !Object.keys(object(data.quotes)).length)) {
    const legacy = parseLegacyPetInfo(raw, parseYaml);
    data = { ...legacy, ...object(data) };
    for (const key of ['pet_card', 'main_story', 'side_story', 'quotes']) {
      if (!Object.keys(object(data[key])).length && !Array.isArray(data[key])) data[key] = legacy[key];
    }
  }
  info.pet_card = { ...object(data.pet_card) };
  for (const key of ['pet_name', 'egg', 'species', 'sex']) {
    info.pet_card[key] = textValue(info.pet_card[key]);
    if (!info.pet_card[key]) warn('宠物名片缺少 ' + key);
  }
  if (info.pet_card.egg && !['blue', 'purple', 'pink', 'green', 'gold', 'white', '{{egg}}'].includes(info.pet_card.egg)) warn('未知宠物蛋：' + info.pet_card.egg);
  if (info.pet_card.species && !['rabbit', 'dog', 'cat', 'bird', 'bala', 'fox', 'otter', 'hedgehog', 'redpanda', 'alpaca', 'sikadeer'].includes(info.pet_card.species)) warn('未知宠物物种：' + info.pet_card.species);
  const normalizeId = value => textValue(value).toUpperCase().replace(/^(M|SJ|SA)(\d)$/, (_, prefix, digit) => prefix + '0' + digit);
  for (const [section, index, ids] of [['main_story', 'mainById', MAIN_IDS], ['side_story', 'sideById', SIDE_IDS]]) {
    for (const value of Array.isArray(data[section]) ? data[section] : []) {
      const id = normalizeId(value?.id);
      if (!ids.includes(id)) warn(section + ' 包含未知ID：' + id);
      if (!/^[A-Z]+\d+$/.test(id)) continue;
      if (info[index][id]) warn('剧情ID重复：' + id);
      const item = storyData(value, info.pet_card.pet_name, id);
      if (id === 'M14' || id === 'M15') {
        item.variants = {};
        for (const route of ['spirit', 'ordinary']) {
          const variant = storyData(value?.variants?.[route], info.pet_card.pet_name, id, route);
          if (!variant.lines.length) warn(id + '.' + route + ' 缺少正文');
          if (variant.lines.length) item.variants[route] = variant;
        }
      } else if (!item.lines.length) warn(id + ' 缺少正文');
      if (section === 'side_story') {
        item.trigger = { ...object(value.trigger) };
        const trigger = item.trigger;
        const valid = ['juvenile', 'adult'].includes(trigger.stage)
          && ['feed', 'pet', 'play', 'outing'].includes(trigger.behavior)
          && (trigger.context_type === 'location' ? ['home', 'outside', 'garden'].includes(trigger.context_value)
            : trigger.context_type === 'time' && ['day', 'night'].includes(trigger.context_value))
          && (trigger.behavior_trigger_type === 'count' ? Number(trigger.threshold) > 0
            : trigger.behavior_trigger_type === 'probability' && Number(trigger.probability) > 0 && Number(trigger.probability) <= 1);
        if (!valid) warn(id + ' 触发条件不完整');
      }
      info[section].push(item);
      if (item.lines.length || Object.keys(item.variants || {}).length || !info[index][id]) info[index][id] = item;
    }
    const missing = ids.filter(id => !info[index][id]);
    if (missing.length) warn('缺少剧情：' + missing.join('、'));
  }
  for (const target of ['char', 'pet']) {
    for (const [stage, actions] of Object.entries(object(data.quotes?.[target]))) {
      info.quotes[target][stage] = Object.fromEntries(Object.entries(object(actions)).map(([action, lines]) =>
        [action, (Array.isArray(lines) ? lines : [lines]).map(textValue).filter(Boolean)]));
    }
    for (const stage of target === 'char' ? ['egg', 'juvenile', 'adult', 'spirit'] : ['juvenile', 'adult', 'spirit']) {
      const source = object(data.quotes?.[target]?.[stage]);
      const actions = target === 'char' ? (stage === 'egg' ? ['pet', 'poke'] : ['feed', 'pet', 'poke']) : ['feed', 'pet', 'poke', 'sleep', 'sad'];
      info.quotes[target][stage] = info.quotes[target][stage] || {};
      for (const action of actions) {
        const lines = info.quotes[target][stage][action] || [];
        info.quotes[target][stage][action] = lines;
        if (!Array.isArray(source[action])) warn('语录应为数组：' + [target, stage, action].join('.'));
        if (lines.length !== 3) warn('语录数量应为3：' + [target, stage, action].join('.') + '，当前' + lines.length);
      }
    }
  }
  return info;
}

export function assertPetInfo(info, { strict = true } = {}) {
  const hasCard = ['pet_name', 'egg', 'species', 'sex'].some(key => textValue(info?.pet_card?.[key]));
  const hasStory = [...(info?.main_story || []), ...(info?.side_story || [])].some(item =>
    item.lines?.length || Object.values(item.variants || {}).some(variant => variant.lines?.length));
  if (!hasCard || !hasStory || (strict && (info.parseWarnings?.length || !info.mainById?.M01?.lines?.length))) {
    throw new Error('宠物档案读取失败：' + (info?.parseWarnings?.join('；') || '档案不完整'));
  }
  return info;
}
