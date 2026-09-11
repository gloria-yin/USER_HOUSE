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

export function parsePetInfo(text, parseYaml) {
  const info = { pet_card:{}, main_story:[], side_story:[], quotes:{ char:{}, pet:{} },
    mainById:{}, sideById:{}, parseWarnings:[] };
  const warn = message => info.parseWarnings.push(message);
  let data;
  try {
    const raw = cleanPetInfoText(text);
    if (!raw.trim()) throw new Error('输出为空');
    data = object(parseYaml(raw));
    data = object(data.pet_info || data);
  } catch (error) {
    warn('YAML格式错误：' + error.message);
    return info;
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
      if (!ids.includes(id)) { warn(section + ' 包含未知ID：' + id); continue; }
      if (info[index][id]) { warn('剧情ID重复：' + id); continue; }
      const item = storyData(value, info.pet_card.pet_name, id);
      if (id === 'M14' || id === 'M15') {
        item.variants = {};
        for (const route of ['spirit', 'ordinary']) {
          const variant = storyData(value?.variants?.[route], info.pet_card.pet_name, id, route);
          if (!variant.lines.length) warn(id + '.' + route + ' 缺少正文');
          item.variants[route] = variant;
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
      info[index][id] = item;
    }
    const missing = ids.filter(id => !info[index][id]);
    if (missing.length) warn('缺少剧情：' + missing.join('、'));
  }
  for (const target of ['char', 'pet']) {
    for (const stage of target === 'char' ? ['egg', 'juvenile', 'adult', 'spirit'] : ['juvenile', 'adult', 'spirit']) {
      const source = object(data.quotes?.[target]?.[stage]);
      const actions = target === 'char' ? (stage === 'egg' ? ['pet', 'poke'] : ['feed', 'pet', 'poke']) : ['feed', 'pet', 'poke', 'sleep', 'sad'];
      info.quotes[target][stage] = {};
      for (const action of actions) {
        const lines = Array.isArray(source[action]) ? source[action].map(textValue).filter(Boolean) : [];
        info.quotes[target][stage][action] = lines;
        if (lines.length !== 3) warn('语录数量应为3：' + [target, stage, action].join('.') + '，当前' + lines.length);
      }
    }
  }
  return info;
}

export function assertPetInfo(info) {
  if (!info || info.parseWarnings?.length || !info.mainById?.M01?.lines?.length) {
    throw new Error('宠物档案读取失败：' + (info?.parseWarnings?.join('；') || '档案不完整'));
  }
  return info;
}
