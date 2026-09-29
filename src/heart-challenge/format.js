// Parser for the model-facing protocol documented in
// AI真心话大冒险_高互动提示词与验证样例(1).md.
const clone = value => JSON.parse(JSON.stringify(value));
const decode = value => String(value ?? '').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
const clean = input => String(input ?? '').trim();
const need = (condition, message) => { if (!condition) throw new Error(message); };
const AUTO_TRANSITIONS = new Set(['嗯。', '继续吧。', '我知道了。', '轮到你了。']);

function preflight(text) {
  const issues = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const value = raw.trim();
    if (/^\[(?:N|USER(?::auto)?|P\d+)(?:;[^\]]*)?\]$/i.test(value)) issues.push('存在单独成行的空标签；必须写成“[角色]正文”，标签与正文在同一行');
    if (/^\[[^;\]]+;\]/.test(value)) issues.push('存在空emoji标签[角色;]，应改成[角色]或填写emoji');
    const close = value.indexOf(']');
    if (value.startsWith('[') && close >= 0 && /\[(?:USER(?::auto)?|N|P\d+)(?:;[^\]]*)?\]/i.test(value.slice(close + 1))) {
      issues.push('同一行嵌套了第二个角色标签，每个标签必须单独起一行');
    }
    const auto = value.match(/^\[USER:auto\](.+)$/i);
    if (auto && !AUTO_TRANSITIONS.has(auto[1].trim())) issues.push('USER:auto只能使用“嗯。”“继续吧。”“我知道了。”“轮到你了。”四种固定过渡');
  }
  const unique = [...new Set(issues)];
  need(!unique.length, `协议预检未通过：${unique.join('；')}。`);
}

function attrs(tag) {
  const out = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[match[1]] = decode(match[2]);
  return out;
}

function lines(text, label = '剧情') {
  const result = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const value = raw.trim();
    if (!value) continue;
    need(!/^\[(?:N|USER(?::auto)?|P\d+)(?:;[^\]]*)?\]$/i.test(value), `${label}只有标签没有正文；必须写成“[角色]正文”，不能在标签后换行。`);
    need(!/^\[[^;\]]+;\]/.test(value), `${label}出现空emoji标签；请把“[角色;]”改为“[角色]”或填写emoji。`);
    const match = value.match(/^\[([^\];]+)(?:;([^\]]+))?\](.+)$/);
    need(match, `${label}含有标签格式外文本：${value.slice(0, 40)}`);
    let speaker = match[1].trim(), auto = false;
    if (speaker === 'USER:auto') { speaker = 'USER'; auto = true; }
    const content = decode(match[3]);
    need(!/\[(?:USER(?::auto)?|N|P\d+)(?:;[^\]]*)?\]/i.test(content), `${label}把第二个角色标签嵌进了同一句；每个标签必须单独起一行。`);
    result.push({ speaker, text:content, ...(match[2] ? { emoji:decode(match[2]) } : {}), ...(auto ? { auto:true } : {}) });
  }
  return result;
}

function attitude(option, index) {
  if (option.attitude) {
    need(['curious', 'playful', 'gentle', 'reserved', 'refuse'].includes(option.attitude), `${option.id}的attitude需要使用规范中的五种态度。`);
    return option.attitude;
  }
  // Interpret the player's choice, not an NPC's reply or the option's position.
  const value = `${option.text}\n${option.lines.filter(line => line.speaker === 'USER').map(line => line.text).join('\n')}`;
  if (/拒绝|不做|跳过|不(?:想|愿|肯)?(?:回答|执行|接受|参与|触碰)|别碰|不要碰/.test(value)) return 'refuse';
  if (/保留|沉默|不评价|留在这里|以后再说|先听|听到这里|不作回应|静观|旁观|暂时观看|暂不|先不|安静地?听/.test(value)) return 'reserved';
  return ['curious', 'playful', 'gentle'][index % 3];
}

function parseSequence(body, card) {
  const beats = [], resumes = new Map(), publicLines = [];
  let declaration = '', sawDraw = card.actor === 'USER', sawDone = false, sawEnd = false;
  const token = /<interact\b[^>]*>[\s\S]*?<\/interact>|<continue\b[^>]*>[\s\S]*?<\/continue>|\[DRAW:[^\]]+\]|\[DONE:[^\]]+\]|\[END\]|\[[^\]\r\n]+\][^\r\n]*/gi;
  let cursor = 0;
  for (const found of body.matchAll(token)) {
    need(!body.slice(cursor, found.index).trim(), `${card.id}含有无法识别的格式外内容。`);
    cursor = found.index + found[0].length;
    const value = found[0].trim();
    need(!sawEnd, `${card.id}的END后不能再有剧情节点。`);
    if (/^\[DRAW:/i.test(value)) {
      need(card.actor !== 'USER' && !sawDraw && declaration, `${card.id}需要在NPC宣言后显示一次DRAW。`);
      need(value.slice(6, -1).trim() === card.id, `${card.id}的DRAW标记不匹配。`); sawDraw = true; continue;
    }
    if (/^\[DONE:/i.test(value)) {
      need(!sawDone, `${card.id}只能出现一个DONE。`);
      need(value.slice(6, -1).trim() === card.id, `${card.id}的DONE标记不匹配。`);
      beats.push({ kind:'done', card:card.id }); sawDone = true; continue;
    }
    if (/^\[END\]$/i.test(value)) { need(sawDone, `${card.id}的END必须紧跟DONE。`); sawEnd = true; continue; }
    if (/^<interact\b/i.test(value)) {
      const head = value.match(/^<interact\b[^>]*>/i)?.[0] || '', meta = attrs(head), options = [];
      const inner = value.slice(head.length).replace(/<\/interact>\s*$/i, '');
      const optionToken = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
      let optionCursor = 0;
      for (const match of inner.matchAll(optionToken)) {
        need(!inner.slice(optionCursor, match.index).trim(), `${card.id}的interact含有option外内容。`);
        optionCursor = match.index + match[0].length;
        const data = attrs('<option ' + match[1] + '>'), option = { id:data.id, text:data.text, body:match[2] };
        need(option.id && option.text, `${card.id}的option必须包含id和text。`);
        const optionLines = lines(option.body, `${card.id}的option`);
        options.push({ id:option.id, text:option.text, attitude:data.attitude || '', lines:optionLines,
          facts:[`USER选择“${option.text}”`] });
      }
      need(!inner.slice(optionCursor).trim(), `${card.id}的interact含有option外内容。`);
      need(meta.id && meta.resume, `${card.id}的interact必须包含id和resume。`);
      options.forEach((option, index) => { option.attitude = attitude(option, index); });
      const choice = { kind:'choice', id:meta.id, resumeId:meta.resume, prompt:'你想如何回应？', options, resume:[] };
      need(!resumes.has(meta.resume), `${card.id}的resume节点重复。`);
      choice._resume = meta.resume; resumes.set(meta.resume, choice); beats.push(choice); continue;
    }
    if (/^<continue\b/i.test(value)) {
      const head = value.match(/^<continue\b[^>]*>/i)?.[0] || '', meta = attrs(head);
      const target = resumes.get(meta.id); need(target, `${card.id}的continue没有对应interact。`);
      need(!target.resume.length && beats.at(-1) === target, `${card.id}的continue需要紧接对应interact且仅出现一次。`);
      target.resume = lines(value.slice(head.length).replace(/<\/continue>\s*$/i, ''), `${card.id}的continue`); continue;
    }
    const parsed = lines(value, card.id)[0];
    if (!parsed) continue;
    if (!sawDraw && card.actor !== 'USER' && !declaration && parsed.speaker === card.actor) { declaration = parsed.text; continue; }
    need(sawDraw, `${card.id}应先由行动角色宣言选牌，再写DRAW，最后开始旁白与剧情。`);
    publicLines.push(parsed); beats.push({ kind:'line', ...parsed });
  }
  need(!body.slice(cursor).trim(), `${card.id}结尾含有格式外内容。`);
  need(sawDraw, `${card.id}缺少DRAW标记。`);
  need(sawDone && sawEnd && beats.at(-1)?.kind === 'done', `${card.id}必须以匹配的DONE和END结束。`);
  for (const beat of beats) if (beat.kind === 'choice') { need(beat._resume && beat.resume.length, `${card.id}的互动缺少公共continue。`); delete beat._resume; }
  const optionGroups = beats.filter(x => x.kind === 'choice').map(x => x.options);
  const common = new Set([...publicLines, ...beats.filter(beat => beat.kind === 'choice').flatMap(beat => beat.resume)].map(x => x.speaker));
  for (const options of optionGroups) for (const speaker of new Set(options[0]?.lines.map(x => x.speaker) || [])) {
    if (options.every(option => option.lines.some(line => line.speaker === speaker))) common.add(speaker);
  }
  if (card.actor !== 'USER') common.add('USER');
  const targets = [...common].filter(id => id !== 'N' && id !== card.actor);
  const textBlob = `${card.tag}\n${card.question}\n${body}`;
  const special = /默契盲选/.test(textBlob) ? 'blind' : /回声问题|彼此回答|双方回答/.test(textBlob) ? 'echo'
    : /双人任务|共同完成|两人一起/.test(textBlob) ? 'pair' : /匿名投票/.test(textBlob) ? 'vote' : 'none';
  const actorLines = publicLines.filter(line => line.speaker === card.actor).map(line => line.text);
  return { beats, declaration:card.actor === 'USER' ? '' : declaration,
    fixedAnswer:card.actor === 'USER' ? '' : actorLines.join(' '),
    resolution:card.actor === 'USER' ? 'USER完成了本次回应。' : (actorLines.at(-1) || `${card.actor}完成了本次回答或行动。`),
    targets, special, requires:[] };
}

function blocks(text, name) {
  const regex = new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)<\\/${name}>`, 'gi');
  return [...text.matchAll(regex)].map(match => ({ attrs:attrs(`<${name} ${match[1]}>`), body:match[2] }));
}

export function parseGameFormat(input, game) {
  if (input && typeof input === 'object') {
    const data = clone(input);
    for (const card of data.cards || []) if (card) delete card.prop;
    return data;
  }
  // Only the first paired document is playable; surrounding explanations and input echoes are not story.
  const source = clean(input).replace(/<!--[\s\S]*?-->/g, '');
  const whole = source.match(/<cards\s*>([\s\S]*?)<\/cards\s*>([\s\S]*?)<story\s*>([\s\S]*?)<\/story\s*>/i);
  need(whole, '输出需要按顺序包含完整闭合的<cards>与<story>，标签外文字会自动忽略；缺失结束标签时需要重新生成。');
  const cardsBlock = whole[1], story = whole[3];
  need(![cardsBlock, whole[2], story].some(part => /<\/?(?:cards|story)\b/i.test(part)), 'cards/story标签重复、嵌套或顺序不正确，不能拼接不同的剧情块。');
  preflight(cardsBlock + '\n' + story);
  const cards = cardsBlock.split(/\r?\n/).map(x => x.trim()).filter(Boolean).map((row, index) => {
    const parts = row.split('|');
    // Older saved output has an unused field before the question.
    if (parts.length === 8) parts.splice(6, 1);
    need(parts.length === 7, `cards第${index + 1}行需要7个字段：ID|轮次|回合|归属人|T/D|标题|牌面内容。`);
    const [id, round, turn, actor, type, tag, question] = parts.map(decode);
    need(id && round && turn && actor && ['T', 'D'].includes(type) && tag && question, `cards第${index + 1}行字段不完整。`);
    const sourceId = game?.snapshot.config.source === 'builtin'
      ? game.sourceSnapshot.find(card => card.type === type && card.question === question)?.id : '-';
    return { id, round, turn, actor, type, tag, sourceId, question };
  });
  const byId = new Map(cards.map(card => [card.id, card]));
  const storyHead = story.match(/^\s*<open>([\s\S]*?)<\/open>([\s\S]*)$/i);
  need(storyHead, 'story必须以完整<open>开始。');
  const open = decode(storyHead[1]); need(open, 'story缺少完整<open>。');
  need(!/\r?\n\s*\r?\n/.test(storyHead[1].trim()), 'open必须是一整段小说式剧情。');
  const roundSource = storyHead[2], roundBlocks = blocks(roundSource, 'round'), rounds = [];
  need(roundBlocks.length && !roundSource.replace(/<round\b[^>]*>[\s\S]*?<\/round>/gi, '').trim(), 'open之后只能包含完整round。');
  for (const [roundIndex, roundBlock] of roundBlocks.entries()) {
    const turns = [];
    const turnBlocks = blocks(roundBlock.body, 'turn');
    need(turnBlocks.length && !roundBlock.body.replace(/<turn\b[^>]*>[\s\S]*?<\/turn>/gi, '').trim(), `${roundBlock.attrs.id || `R${roundIndex + 1}`}只能包含完整turn。`);
    for (const turnBlock of turnBlocks) {
      const turnId = turnBlock.attrs.id, actor = turnBlock.attrs.actor;
      if (actor === 'USER') {
        const pick = turnBlock.body.match(/<pick\b[^>]*\/?\s*>/i)?.[0]; need(pick, `${turnId}缺少pick。`);
        const meta = attrs(pick), picked = Object.fromEntries(['T', 'D'].map(type => [type, String(meta[type] || '').split(',').map(x => x.trim()).filter(Boolean)]));
        need(['T', 'D'].every(type => picked[type].length === 2 && picked[type].every(id => byId.get(id)?.type === type)), `${turnId}的pick需要准确绑定2张T与2张D。`);
        const cardIds = [...picked.T, ...picked.D];
        const caseBlocks = blocks(turnBlock.body, 'case'); need(caseBlocks.length === cardIds.length, `${turnId}的每张USER候选都必须有完整case。`);
        need(new Set(caseBlocks.map(item => item.attrs.card)).size === cardIds.length
          && caseBlocks.every(item => cardIds.includes(item.attrs.card)), `${turnId}的case需要与pick一一对应。`);
        const outsideCases = turnBlock.body.replace(pick, '').replace(/<case\b[^>]*>[\s\S]*?<\/case>/gi, '');
        need(!outsideCases.trim(), `${turnId}的pick与case之外不能有其他内容。`);
        for (const item of caseBlocks) {
          const card = byId.get(item.attrs.card); need(card && card.actor === 'USER' && card.turn === turnId, `${item.attrs.card || turnId}的case绑定错误。`);
          Object.assign(card, parseSequence(item.body, card));
        }
        turns.push({ id:turnId, actor, cardIds });
      } else {
        const cardId = turnBlock.attrs.card, card = byId.get(cardId); need(card && card.actor === actor && card.turn === turnId, `${cardId || turnId}的turn绑定错误。`);
        Object.assign(card, parseSequence(turnBlock.body, card)); turns.push({ id:turnId, actor, cardIds:[cardId] });
      }
    }
    const id = roundBlock.attrs.id || `R${roundIndex + 1}`;
    rounds.push({ id, title:`第 ${roundIndex + 1} 轮 · 心动挑战`, intro:`第 ${roundIndex + 1} 轮开始。所有人会按已经确定的顺序完成一次真心话或大冒险。`, turns });
  }
  return { task:'game', scene:game?.snapshot?.title || '心动挑战', atmosphere:game?.snapshot?.config?.styles?.join(' · ') || '故事进行中', open, cards, rounds };
}

export function parseReplyFormat(input) {
  if (input && typeof input === 'object') return clone(input);
  const source = clean(input), match = source.match(/^<reply\b([^>]*)>([\s\S]*?)<\/reply>$/i); need(match, '自由互动只能输出完整<reply>，不得带Markdown或格式外说明。');
  const meta = attrs('<reply ' + match[1] + '>'), parsed = lines(match[2], 'reply');
  need(['resume', 'wait'].includes(meta.state), 'reply state必须是resume或wait。');
  need(meta.resume, 'reply必须包含resume。');
  return { task:'reply', state:meta.state, resume:meta.resume, conflict:false,
    lines:parsed, facts:[] };
}
