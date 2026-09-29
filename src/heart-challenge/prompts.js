import { actors, currentCard, currentTurn, effectiveMemory, normalizeConfig, HEART_NARRATIVE_PERSONS } from './engine.js?v=4.1.13-heart-logs';
import { heartWorldForPrompt } from './world.js?v=4.1.13-heart-logs';

const PROMPT_ROOT = new URL('../../assets/heart-challenge/text/', import.meta.url);
const TASKS = ['game', 'reply', 'ending'];

export async function loadHeartPromptTemplates(task, { signal, fetch:fetcher = globalThis.fetch } = {}) {
  if (!TASKS.includes(task)) throw new Error('未知的心动挑战生成任务：' + task);
  const names = [task];
  const contents = await Promise.all(names.map(async name => {
    const path = 'assets/heart-challenge/text/' + name + '.txt';
    try {
      signal?.throwIfAborted();
      const response = await fetcher(new URL(name + '.txt', PROMPT_ROOT), { cache:'no-store', signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const text = (await response.text()).replace(/\r\n?/g, '\n').trim();
      signal?.throwIfAborted();
      if (!text || /^<(?:!doctype\s+html|html(?:\s|>))/i.test(text)) throw new Error('文件为空或返回了 HTML 页面');
      const required = name === 'reply' ? ['CONTEXT', 'RESUME'] : name === 'game' ? [] : ['CONTEXT'];
      for (const key of required) if (!text.includes('{{' + key + '}}')) throw new Error('缺少占位符 {{' + key + '}}');
      if (name === 'game' && !/\{\{(?:游戏核心参数|CONTEXT)\}\}/.test(text)) throw new Error('缺少占位符 {{游戏核心参数}}');
      return text;
    } catch (error) {
      signal?.throwIfAborted();
      throw new Error('心动挑战提示词读取失败：' + path + '（' + error.message + '）');
    }
  }));
  signal?.throwIfAborted();
  return Object.freeze({ task, prompt:contents[0] });
}

function fillTemplate(template, values) {
  // Replace once so placeholder-like text inside world data stays literal.
  return template.replace(/\{\{(游戏核心参数|CONTEXT|RESUME)\}\}/g,
    (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}

function compose(task, templates, values) {
  if (templates?.task !== task) throw new Error('请先读取当前任务的心动挑战 TXT 提示词。');
  return fillTemplate(templates.prompt, values);
}

function context(game, task = 'game') {
  const { world, players, config, title } = game.snapshot;
  const activeWorld = heartWorldForPrompt(world), normalized = normalizeConfig(config);
  const { api, replyApi, maxTokens, regenerations, ...settings } = normalized;
  if (settings.source !== 'random') settings.bankThemes = [];
  const participants = players.map(({ avatar, cardAvatar, ...p }) => p);
  const continuity = game.continuity || { completedRounds:0, completedGames:0, previousClosing:'', resetAfterEnding:false };
  return {
    '世界观设定':activeWorld,
    '语言设置':[...new Set([activeWorld.language, activeWorld.languageInstruction].filter(Boolean))].join('\n') || '简体中文',
    '人称':HEART_NARRATIVE_PERSONS[settings.narrativePerson],
    '参与角色':participants,
    '{{user}}设定':activeWorld.user,
    '人数模式':settings.mode === 'duo' ? '1V1' : '多人',
    '局势风格':settings.styles,
    '是否包含卡牌库':settings.source === 'builtin' ? '是' : '否',
    '卡牌风格（无卡牌库）':settings.bankThemes,
    'NSFW阀值':settings.nsfw ? 'NSFW' : '安全',
    '轮次与行动序':{ rounds:settings.rounds, order:game.order.map(id => ({ id, name:[activeWorld.user, ...participants].find(p => p.id === id)?.name || id })) },
    '当前游戏轮数':`第${continuity.completedRounds}把（此前已完成的累计轮数：${continuity.completedRounds}）。本段连续游戏已完成${continuity.completedGames}把，本次生成${settings.rounds}轮，标签从 R1 重新开始。`,
    ...(task !== 'game' ? {} : { openingInstruction:continuity.completedRounds === 0 ? '这是新的开场，请用 <open> 交代合理的游戏开始契机。此前记忆只作为历史，不把已经结束的场景当成仍在进行。'
        : '游戏继续进行，<open> 承接上一把最后的有效画面，不重新介绍游戏规则或让人物重新入场。\n上一把最后的有效画面：\n' + continuity.previousClosing }),
    room:title, settings, gameNumber:continuity.completedGames, archiveGameNumber:game.number, continuity, order:game.order,
    previous:game.previous, effectiveProgress:effectiveMemory(game) };
}

function formatInput(data) {
  const world = data['世界观设定'], user = data['{{user}}设定'], players = data['参与角色'];
  const config = world.injection;
  const playerText = players.map(player => {
    const description = player.description || (player.origin === 'world' && player.name === world.character.name
      ? world.character.description : '沿用世界观中对应角色的资料');
    return `姓名：${player.name}\n角色 ID：${player.id}\n补充设定：\n${description || '未提供'}`;
  }).join('\n\n');
  const userText = `玩家姓名：${user.name}\n角色 ID：USER\n玩家设定：\n${user.persona || (config.injectUserDesc ? '未提供' : '未启用')}`;
  const worldText = [
    `世界背景：\n${world.background || '未提供'}`,
    `世界规则：\n${world.view || '未提供'}`,
    `用户设定：\n${userText}`,
    `角色描述：\n姓名：${world.character.name || '未提供'}\n${world.character.description || (config.injectCharDesc ? '未提供' : '未启用')}`,
    `NPC 设定：\n${playerText || '未提供'}`,
    `最新聊天记录：\n${world.chat || (config.injectChat ? '未提供' : '未启用')}`,
    `历史摘要：\n${world.summary || '未提供'}`,
    `提示词/破限词：\n${world.breakLimitPrompt || '未提供'}`,
    `挂载世界书：\n${world.entries.map(entry => `世界书：${entry.wbName || '未命名'}\n条目：${entry.label || '未命名'}\n条目 ID：${entry.uid}\n${entry.content}`).join('\n\n') || '未挂载'}`,
    `补充：\n${world.supplemental || '未提供'}`,
  ].join('\n\n');
  const sequence = data['轮次与行动序'];
  const sections = [
    ['世界观设定', worldText],
    ['语言设置', data['语言设置']],
    ['人称', data['人称']],
    ['参与角色', playerText],
    ['{{user}}设定', userText],
    ['人数模式', data['人数模式'] === '1V1' ? '1V1（聚焦私密、心理防线击溃）' : '多人（修罗场、暗流涌动、派系倾轧）'],
    ['局势风格', data['局势风格'].join(' / ') || '无要求'],
    ['是否包含卡牌库', data['是否包含卡牌库']],
    ['卡牌风格（无卡牌库）', data['是否包含卡牌库'] === '是' ? '不适用（使用已有卡牌库）' : data['卡牌风格（无卡牌库）'].join(' / ') || '无要求'],
    ['NSFW阀值', data['NSFW阀值'] === 'NSFW' ? 'NSFW（NSFW情况下可使用相应扩展内容）' : '安全'],
    ['轮次与行动序', `共${sequence.rounds}轮，当前行动顺位：${sequence.order.map(person => person.name).join(' -> ')}`],
    ['当前游戏轮数', data['当前游戏轮数']],
  ];
  // Keep authored input sections readable while retaining exact IDs and progress for playback.
  const sectionNames = new Set(sections.map(([name]) => name));
  const runtime = Object.fromEntries(Object.entries(data).filter(([key]) => !sectionNames.has(key)));
  return sections.map(([name, value]) => `【${name}】：\n${value}`).join('\n\n')
    + '\n\n程序运行资料（卡牌绑定与有效进度）：\n' + JSON.stringify(runtime);
}

export function gamePrompt(game, templates) {
  return buildHeartRequest('game', game, null, '', templates).prompt;
}

export function replyPrompt(game, run, input, templates) {
  return buildHeartRequest('reply', game, run, input, templates).prompt;
}

export function endingPrompt(game, templates) {
  return buildHeartRequest('ending', game, null, '', templates).prompt;
}

export function buildHeartRequest(task, game, run, input, templates) {
  if (!TASKS.includes(task)) throw new Error('未知的心动挑战生成任务：' + task);
  const data = { task, ...context(game, task) };
  let resume;
  if (task === 'game') Object.assign(data, { plans:game.plans, sourceCards:game.sourceSnapshot });
  else if (task === 'reply') {
    const card = currentCard(game, run);
    resume = run.stage === 'choice' ? (run.current.resumeId || run.current.id) : 'TURN_END';
    Object.assign(data, { turn:currentTurn(game, run),
      card:card && { id:card.id, type:card.type, actor:card.actor, tag:card.tag, question:card.question, fixedAnswer:card.fixedAnswer, targets:card.targets },
      current:run.stage === 'choice' ? run.current : null, remaining:run.queue, resume, input,
      actors:actors(game).map(({ id, name }) => ({ id, name })) });
  } else data.endingInstruction = '玩家明确结束本次连续游戏。请完成收束，不再开启新一轮。结局成功保存后计数清零，下一次从累计0轮重新开场。';
  // Reuse the exact injected text in the preview, without searching the authored template.
  const injectedInput = formatInput(data);
  return { input:injectedInput, prompt:compose(task, templates, { CONTEXT:injectedInput, 游戏核心参数:injectedInput, ...(resume ? { RESUME:resume } : {}) }) };
}
