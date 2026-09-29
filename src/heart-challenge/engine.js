import { parseGeneratedJson } from '../runtime/generated-json.js';
import { sourceCards, keywordList } from './banks.js?v=4.1.13-heart-logs';
import { parseGameFormat, parseReplyFormat } from './format.js?v=4.1.13-heart-logs';
import { normalizeHeartWorld, heartWorldForPrompt } from './world.js?v=4.1.13-heart-logs';

export const HEART_STORAGE_KEY = 'wanbanXiaowu_heartChallenge_v1';
export const HEART_STYLES = ['轻松', '暧昧', '悬疑', '权谋', '恋爱', '修罗', '搞笑', '紧张', '疯狂'];
export const HEART_BANK_THEMES = ['灵魂', '试探', '越界', '解密', '撕裂', '搞笑', '默契', '惩罚', '冒险', '恋爱', '社交', '整蛊'];
export const HEART_BANK_KEYWORDS = ['回忆', '习惯', '愿望', '弱点', '信任', '守护', '吃醋'];
export const HEART_NARRATIVE_PERSONS = { first:'第一人称（USER 是“我”）', second:'第二人称（USER 是“你”）', third:'第三人称（USER 是“他/她”）' };
export const HEART_LIMITS = { rooms:12, games:16, runs:12, branches:30, freeReplies:120, history:12000 };
export const clone = value => JSON.parse(JSON.stringify(value));
export const uid = prefix => prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value, max = 12000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const bounded = (value, min, max, fallback) => value !== '' && value != null && Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Math.floor(Number(value)))) : fallback;
const AUTO_TRANSITIONS = new Set(['嗯。', '继续吧。', '我知道了。', '轮到你了。']);
const REFUSAL_TEXT = /拒绝|不做|不回答|不参与|别碰|不要碰|跳过|保留|无可奉告|与你无关/;
const OPTIONAL_RESULT = /握住|牵手|十指|触碰|触感|碰到|拥抱|亲吻|靠近|凑近|耳畔|暗语|距离.{0,8}(?:拉近|缩短)|蒙上眼|闭上眼|写字|写下|猜出|猜到|对视|倒计时|十秒(?:到了|结束)|任务(?:完成|结束)|挑战(?:完成|结束)|已经(?:回答|执行|完成|照做)|终于(?:回答|执行|完成)|答完|回答了|说出|敢说|喝下|唱完|跳完|脱下/;

export function defaultConfig() {
  return { mode:'duo', narrativePerson:'second', styles:[], nsfw:false, source:'builtin', bank:'regular',
    bankThemes:[], bankKeywords:[], customTheme:'', keywords:'', excludes:'', rounds:1, focusMode:'balanced', focus:[], orderMode:'fate',
    swaps:1, api:'', replyApi:'', maxTokens:32768, regenerations:1 };
}

export function normalizeConfig(value = {}) {
  const legacyBankThemes = Array.isArray(value?.bankThemes) ? value.bankThemes : (Array.isArray(value?.randomStyles) ? value.randomStyles : []);
  const cfg = { ...defaultConfig(), ...value };
  cfg.mode = cfg.mode === 'multi' ? 'multi' : 'duo';
  cfg.narrativePerson = Object.hasOwn(HEART_NARRATIVE_PERSONS, cfg.narrativePerson) ? cfg.narrativePerson : 'second';
  const legacyStyles = { 生涩:'轻松', 日常破冰:'轻松', 爆笑反差:'搞笑', 心跳暧昧:'暧昧', 默契升温:'恋爱', 试探:'暧昧', 冒险:'悬疑', 悬疑冒险:'悬疑' };
  cfg.styles = [...new Set((Array.isArray(cfg.styles) ? cfg.styles : []).map(x => legacyStyles[x] || x).filter(x => HEART_STYLES.includes(x)))];
  cfg.nsfw = cfg.nsfw === true;
  cfg.source = cfg.source === 'random' ? 'random' : 'builtin';
  cfg.bank = /^custom_[a-zA-Z0-9_]+$/.test(cfg.bank) ? cfg.bank : cfg.nsfw && cfg.bank === 'intimate' ? 'intimate' : 'regular';
  cfg.rounds = [1, 2, 4].includes(Number(cfg.rounds)) ? Number(cfg.rounds) : 1;
  cfg.focus = Array.isArray(cfg.focus) ? [...new Set(cfg.focus.filter(x => typeof x === 'string'))] : [];
  cfg.focusMode = cfg.mode === 'multi' && cfg.focusMode === 'focused' ? 'focused' : 'balanced';
  cfg.orderMode = cfg.orderMode === 'manual' ? 'manual' : 'fate';
  cfg.swaps = 1;
  cfg.maxTokens = bounded(cfg.maxTokens, 4096, 65536, 32768);
  cfg.regenerations = bounded(value?.regenerations ?? value?.repairs, 0, 2, 1);
  cfg.keywords = text(cfg.keywords, 500);
  const legacyThemes = { 日常闲聊:'社交', 关系试探:'试探', 默契合作:'默契', 秘密揭晓:'解密', 反差趣事:'搞笑', 冒险任务:'冒险' };
  cfg.bankThemes = [...new Set(legacyBankThemes.map(x => legacyThemes[x] || x).filter(x => HEART_BANK_THEMES.includes(x)))];
  cfg.bankKeywords = [...new Set((Array.isArray(cfg.bankKeywords) ? cfg.bankKeywords : []).filter(x => HEART_BANK_KEYWORDS.includes(x)))];
  cfg.customTheme = text(cfg.customTheme, 500);
  cfg.excludes = text(cfg.excludes, 500);
  cfg.api = text(cfg.api, 500); cfg.replyApi = text(cfg.replyApi, 500);
  // API secrets belong exclusively to the existing API settings, never a room snapshot.
  return Object.fromEntries(Object.keys(defaultConfig()).map(key => [key, cfg[key]]));
}

export function worldSnapshot(source = {}) {
  return normalizeHeartWorld(source);
}

export function playerSnapshot(player, index) {
  const avatarMode = ['auto', 'card', 'emoji', 'url'].includes(player.avatarMode) ? player.avatarMode : 'auto';
  const origin = player.origin === 'world' ? 'world' : 'custom';
  const savedAvatar = text(player.avatar, 4000);
  const avatar = avatarMode === 'auto'
    ? (/^pixel:(?:\d|1[0-4])$/.test(savedAvatar) ? savedAvatar : `pixel:${Math.max(0, Number(index) || 0) % 15}`)
    : savedAvatar;
  return {
    id:player.id || `P${index + 1}`, name:text(player.name, 80),
    // 世界角色的完整资料属于开房时保存的世界快照；席位本身只保存姓名。
    description:origin === 'world' ? '' : text(player.description, 80000),
    origin, cardId:text(player.cardId, 500),
    avatar, avatarMode,
    cardAvatar:text(player.cardAvatar, 4000),
  };
}

export function createRoom(title, world) {
  return { id:uid('room'), title:text(title, 80) || '未命名房间', world:worldSnapshot(world),
    players:[], config:defaultConfig(), games:[], activeGameId:'', createdAt:Date.now() };
}

export function normalizeStore(value) {
  if (value == null) return { version:1, rooms:[], activeRoomId:'', banks:[] };
  requireValue(value.version === 1 && Array.isArray(value.rooms), '心动挑战存档格式不兼容，请保留备份后检查。');
  requireValue(value.rooms.length <= HEART_LIMITS.rooms && value.rooms.every(r => r?.id && r.world && Array.isArray(r.games)), '房间存档结构不完整。');
  const store = clone(value);
  store.banks = Array.isArray(store.banks) ? store.banks : [];
  // 旧房间可能早于牌库主题、关键词等设置字段。读取时统一补齐，确保
  // “进入下一把”以及旧游戏回放不会把缺失字段直接交给界面或提示词。
  for (const room of store.rooms) {
    room.config = normalizeConfig(room.config);
    room.world = worldSnapshot(room.world);
    for (const [index, game] of room.games.entries()) {
      if (game?.snapshot) {
        game.snapshot.config = normalizeConfig(game.snapshot.config || room.config);
        game.snapshot.world = worldSnapshot(game.snapshot.world);
        game.continuity ||= nextGameContinuity(room.games.slice(0, index));
      }
      for (const run of game.runs || []) {
        if (game.content && run.stage === 'roundIntro') enterRound(game, run);
      }
    }
  }
  return store;
}

export function actors(game) { return [game.snapshot.world.user, ...game.snapshot.players]; }
export function actorName(game, id) { return actors(game).find(p => p.id === id)?.name || (id === 'N' ? '旁白' : id); }
export function currentRun(game) { return game?.runs.find(r => r.id === game.activeRunId) || null; }
export function currentTurn(game, run) { return game.content?.rounds[run.roundIndex]?.turns[run.turnIndex] || null; }
export function currentCard(game, run) { return game.content?.cards.find(c => c.id === run.cardId) || null; }

export function fateOrder(players, userNumber, random = Math.random) {
  requireValue(Number.isInteger(userNumber) && userNumber >= 0 && userNumber <= 99, '请输入 0—99 的整数。');
  const target = Math.floor(random() * 100);
  const draws = players.map((p, index) => ({ actor:p.id, number:p.id === 'USER' ? userNumber : Math.floor(random() * 100), index }));
  draws.forEach(draw => { draw.distance = Math.abs(draw.number - target); });
  const order = [...draws].sort((a, b) => a.distance - b.distance || a.index - b.index).map(d => d.actor);
  return { target, draws, order, revealed:false };
}

export function npcDareChance(player, config) {
  const persona = player.description || '';
  let chance = 0.45;
  if (/勇敢|好胜|大胆|表现欲|冒险|brave|competitive/i.test(persona)) chance += 0.23;
  if (/谨慎|内向|羞怯|cautious|shy/i.test(persona)) chance -= 0.18;
  if (/秘密|隐私|戒备|private|secret/i.test(persona) && (config.nsfw || config.styles.includes('恋爱'))) chance += 0.18;
  return Math.max(0.15, Math.min(0.85, chance));
}

export function nextGameContinuity(games) {
  const previous = games.findLast(game => game.content && ['settlement', 'ending'].includes(currentRun(game)?.stage));
  const empty = { completedRounds:0, completedGames:0, previousGameId:previous?.id || '', previousClosing:'', resetAfterEnding:false };
  if (!previous) return empty;
  const run = currentRun(previous);
  if (run.ending || previous.sessionEndedAt) return { ...empty, resetAfterEnding:true };
  const before = previous.continuity || nextGameContinuity(games.slice(0, games.indexOf(previous)));
  return { ...empty, completedRounds:before.completedRounds + normalizeConfig(previous.snapshot.config).rounds,
    completedGames:before.completedGames + 1,
    previousClosing:run.history.filter(line => line.text && ['line', 'event'].includes(line.kind)).slice(-6)
      .map(line => actorName(previous, line.speaker || 'N') + '：' + line.text).join('\n') };
}

export function createGame(room, orderResult, random = Math.random, customBanks = []) {
  requireValue(room.games.length < HEART_LIMITS.games, '这个房间的游戏记录已满，请导出备份并整理历史后再开始。');
  const config = normalizeConfig(room.config);
  const players = room.players.map(playerSnapshot);
  requireValue(players.length >= 1 && players.length <= 5, '请添加 1—5 名角色。');
  requireValue(config.mode !== 'duo' || players.length === 1, '1V1 模式需要恰好一名角色。');
  requireValue(config.mode !== 'multi' || players.length >= 2, '多人模式至少需要两名角色。');
  requireValue(players.every(p => p.name && (p.origin === 'world' || p.description)), '新角色需要填写姓名与角色设定。');
  requireValue(new Set(players.map(p => p.id)).size === players.length && players.every(p => /^P\d+$/.test(p.id)), '角色标识重复，请重新添加角色。');
  requireValue(new Set(players.map(p => p.name)).size === players.length, '请为同名角色加上可区分的称呼。');
  requireValue(text(room.world?.user?.name, 80), '请在世界设置中填写 USER 名称。');
  const world = worldSnapshot(room.world);
  const injected = heartWorldForPrompt(world);
  requireValue(injected.background || injected.view || injected.character.description || injected.entries.length || injected.user.persona || injected.chat || injected.supplemental,
    '请先载入世界观，或填写角色描述、用户设定、挂载世界书。');
  requireValue(!players.some(p => p.name === world.user.name), 'USER 与角色请使用不同称呼。');
  config.focus = config.focus.filter(id => players.some(p => p.id === id));
  requireValue(config.focusMode !== 'focused' || config.focus.length, '请选择至少一位重点关注角色。');
  const ids = ['USER', ...players.map(p => p.id)];
  requireValue(orderResult?.order?.length === ids.length && new Set(orderResult.order).size === ids.length && orderResult.order.every(id => ids.includes(id)), '行动顺序需要包含全部参与者，且不能重复。');
  const sources = sourceCards(config, customBanks);
  if (config.source === 'builtin') requireValue(['T', 'D'].every(type => sources.filter(c => c.type === type).length >= 2), '排除关键词后题库不足，请调整排除词或选择随机牌库。');
  const plans = Array.from({ length:config.rounds }, (_, r) => ({
    id:`R${r + 1}`,
    turns:orderResult.order.map((actor, t) => {
      const id = `R${r + 1}A${t + 1}`;
      let type = actor === 'USER' ? '' : (random() < npcDareChance(players.find(p => p.id === actor), config) ? 'D' : 'T');
      if (type && config.source === 'builtin' && !sources.some(c => c.type === type)) type = type === 'T' ? 'D' : 'T';
      return { id, actor, cards:actor === 'USER'
        ? ['T', 'T', 'D', 'D'].map((type, i) => ({ id:`${id}C${i + 1}`, type }))
        : [{ id:`${id}C1`, type }] };
    }),
  }));
  const previous = room.games.map(game => effectiveMemory(game)).filter(m => m.records?.length);
  return { id:uid('game'), number:Math.max(0, ...room.games.map(g => g.number || 0)) + 1,
    createdAt:Date.now(), snapshot:{ title:room.title, world, players, config },
    order:clone(orderResult.order), orderResult:clone(orderResult), plans, sourceSnapshot:clone(sources),
    previous, continuity:nextGameContinuity(room.games), content:null, runs:[], activeRunId:'', request:null, error:null };
}

function validateLines(lines, ids, where, { min = 1, max = 60, user = false } = {}) {
  requireValue(Array.isArray(lines) && lines.length >= min && lines.length <= max, `${where}需要 ${min}—${max} 行带标签的完整剧情。`);
  for (const line of lines) {
    requireValue(line && ids.has(line.speaker) && text(line.text), `${where}含未知说话者或空对白。`);
    requireValue(user || line.speaker !== 'USER' || line.auto === true, `${where}不能在玩家选择前替 USER 作决定。`);
    requireValue(!line.auto || AUTO_TRANSITIONS.has(line.text), `${where}的USER:auto不在固定白名单中；只能使用“嗯。”“继续吧。”“我知道了。”“轮到你了。”。`);
    requireValue(typeof line.text === 'string' && line.text.length <= 4000, `${where}单句过长。`);
    requireValue(!line.emoji || typeof line.emoji === 'string' && line.emoji.length <= 32, `${where}表情格式不正确。`);
  }
}

function boundaryIssues(beat, game) {
  const issues = [], options = beat.options || [], resume = beat.resume || [];
  if (resume.some(line => line.speaker === 'USER')) issues.push(`${beat.id}公共continue不能包含USER或USER:auto；USER的选择结果必须留在option内部。`);
  const hasBoundary = options.some(option => ['reserved', 'refuse'].includes(option.attitude)
    || REFUSAL_TEXT.test(`${option.text}\n${(option.lines || []).filter(line => line.speaker === 'USER').map(line => line.text).join('\n')}`));
  if (!hasBoundary) return issues;
  const resumeText = resume.map(line => line.text).join('\n');
  if (OPTIONAL_RESULT.test(resumeText)) issues.push(`${beat.id}存在拒绝选项，但公共continue仍暗示接触、回答或任务已经执行。`);
  const names = [...actors(game).map(actor => actor.name), '你', '您', '主殿'].map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const transition = new RegExp(`^(?:(?:好了|接下来|那么|现在)[，,\\s]*)*(?:(?:该)?轮到|下一位是)(?:${names})(?:了)?(?:吧|吗|呢|对吗)?[？?]$`);
  const questions = resumeText.match(/[^。！？?!\n]*[？?]/g) || [];
  if (questions.some(question => !transition.test(question.trim()))) issues.push(`${beat.id}公共continue不能继续追问被拒绝的问题；需要玩家回应的新问题放入interact，行动顺序确认可以保留。`);
  return issues;
}

function auditContent(data, game) {
  const issues = [], ids = new Set(['N', ...actors(game).map(actor => actor.id)]);
  const inspect = (lines, where, options) => { try { validateLines(lines, ids, where, options); } catch (error) { issues.push(error.message); } };
  const length = lines => (Array.isArray(lines) ? lines : []).reduce((sum, line) =>
    sum + (line?.auto ? 0 : Array.from(String(line?.text || '').replace(/\s/g, '')).length), 0);
  for (const card of data.cards) {
    if (!Array.isArray(card?.beats)) continue;
    let count = length(card.beats.filter(beat => beat?.kind === 'line'));
    for (const beat of card.beats) {
      if (beat?.kind === 'line') inspect([beat], `${card.id}公共剧情`);
      if (beat?.kind !== 'choice' || !Array.isArray(beat.options) || !Array.isArray(beat.resume)) continue;
      count += (beat.options.length ? Math.min(...beat.options.map(option => length(option.lines))) : 0) + length(beat.resume);
      for (const option of beat.options) inspect(option.lines, `${beat.id}/${option.id}`, { min:1, max:4, user:true });
      if (!beat.options.some(option => ['reserved', 'refuse'].includes(option.attitude))) issues.push(`${beat.id}需要一个实际的保留或拒绝选项；最后一项不会自动算作保留。`);
      inspect(beat.resume, `${beat.id}公共汇合`, { min:1, max:6 });
      issues.push(...boundaryIssues(beat, game));
    }
    if (count < 250) issues.push(`${card.id}剧情过短：最短路径仅${count}字（至少250字）；需要补全实际回答/准备、执行、追问反馈与公共收束。`);
  }
  requireValue(!issues.length, `剧情完整性检查未通过：\n${[...new Set(issues)].map((issue, index) => `${index + 1}. ${issue}`).join('\n')}`);
}

export function validateContent(input, game) {
  const data = parseGameFormat(input, game);
  requireValue(data.task === 'game', '生成结果 task 必须是 game。');
  requireValue(text(data.open) && data.open.length <= 4000, '开场需要完整交代场景与游戏契机，长度在4000字以内。');
  const userName = game.snapshot.world.user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const decidedMind = new RegExp(`${userName}.{0,24}(?:心里|内心|心中).{0,18}(?:不排斥|喜欢|愿意|期待|决定|答应|接受|想要)`);
  requireValue(!decidedMind.test(data.open), '开场替 USER 决定了内心态度，请改为可观察的环境、动作或角色提议。');
  const decidedAction = new RegExp(`${userName}.{0,50}(?:本欲|原想|原本想|犹豫|迟疑|终究|最终).{0,50}(?:答应|同意|接受|拒绝|加入|参与|坐下|留下)`);
  requireValue(!decidedAction.test(data.open), '开场替 USER 决定是否参加游戏；只能写角色提出邀请，并把决定留给USER。');
  requireValue(text(data.scene) && text(data.atmosphere), '缺少场景名称或氛围。');
  requireValue(Array.isArray(data.rounds) && data.rounds.length === game.plans.length, '生成轮数不完整。');
  const expected = game.plans.flatMap(round => round.turns.flatMap(turn => turn.cards.map(card => ({ ...card, round:round.id, turn:turn.id, actor:turn.actor }))));
  requireValue(Array.isArray(data.cards) && data.cards.length === expected.length, `需要完整生成 ${expected.length} 张牌，包括所有 USER 候选。`);
  auditContent(data, game);
  const cards = new Map(data.cards.map(card => [card.id, card]));
  requireValue(cards.size === data.cards.length, '卡牌 ID 重复。');
  const ids = new Set(['N', ...actors(game).map(p => p.id)]);
  const cfg = game.snapshot.config;
  const choices = new Set();
  const resumes = new Set();
  const coverage = {};
  for (const plan of game.plans) {
    const round = data.rounds[game.plans.indexOf(plan)];
    requireValue(round?.id === plan.id && text(round.title) && text(round.intro), `${plan.id}缺少轮次短剧情。`);
    requireValue(Array.isArray(round.turns) && round.turns.length === plan.turns.length, `${plan.id}行动数量错误。`);
    plan.turns.forEach((turn, i) => {
      const actual = round.turns[i];
      requireValue(actual?.id === turn.id && actual.actor === turn.actor && Array.isArray(actual.cardIds)
        && actual.cardIds.join(',') === turn.cards.map(c => c.id).join(','), `${turn.id}行动顺序或卡牌绑定错误。`);
    });
    coverage[plan.id] = { special:false, userSpecial:0, actors:new Set(), focused:0, total:0, pairs:[] };
  }
  for (const spec of expected) {
    const card = cards.get(spec.id);
    requireValue(card && ['round', 'turn', 'actor', 'type'].every(key => card[key] === spec[key]), `${spec.id}角色、轮次、行动或牌型绑定错误。`);
    requireValue(text(card.question) && text(card.tag), `${spec.id}缺少题目或牌背标签。`);
    requireValue(Array.isArray(card.targets) && card.targets.length && new Set(card.targets).size === card.targets.length
      && card.targets.every(id => id !== card.actor && id !== 'N' && ids.has(id)), `${spec.id}需要实际互动对象。`);
    if (cfg.source === 'builtin') {
      const source = game.sourceSnapshot.find(s => s.id === card.sourceId && s.type === card.type);
      requireValue(source, `${spec.id}来源不在所选题库内或牌型不符。`);
      requireValue(card.question === source.question, `${spec.id}需要使用所选题库原题。`);
    } else requireValue(card.sourceId === '-' || card.sourceId == null, `${spec.id}随机牌不应伪造题库来源。`);
    requireValue(!keywordList(cfg.excludes).some(word => card.question.includes(word)), `${spec.id}题目包含排除关键词。`);
    requireValue(['none', 'echo', 'pair', 'blind', 'vote'].includes(card.special), `${spec.id}特殊玩法标识错误。`);
    const position = expected.findIndex(c => c.id === card.id);
    card.requires = card.requires || [];
    requireValue(Array.isArray(card.requires) && card.requires.every(id => expected.slice(0, position).some(c => c.id === id && c.actor !== 'USER' && c.turn !== card.turn)), `${spec.id}依赖必须是之前行动的固定 NPC 卡。`);
    requireValue(text(card.resolution), `${spec.id}需要明确的卡牌完成内容。`);
    requireValue(card.actor === 'USER' || text(card.fixedAnswer), `${spec.id}缺少 NPC 固定答案或执行内容。`);
    requireValue(Array.isArray(card.beats) && card.beats.length >= 5 && card.beats.length <= 50, `${spec.id}缺少完整行动剧情。`);
    requireValue(card.beats.at(-1)?.kind === 'done' && card.beats.at(-1)?.card === card.id, `${spec.id}缺少末尾 DONE 完成标记。`);
    const speakers = new Set();
    let choiceCount = 0;
    const inspect = lines => { lines.forEach(line => { speakers.add(line.speaker); }); };
    for (const [i, beat] of card.beats.entries()) {
      if (beat.kind === 'line') {
        validateLines([beat], ids, `${spec.id}公共剧情`); inspect([beat]);
      } else if (beat.kind === 'event') {
        requireValue(text(beat.text) && beat.text.length <= 2000, `${spec.id}重要事件为空或过长。`);
      } else if (beat.kind === 'choice') {
        choiceCount++;
        requireValue(text(beat.id) && !choices.has(beat.id), `${spec.id}互动 ID 为空或重复。`);
        choices.add(beat.id);
        if (beat.resumeId) {
          requireValue(!resumes.has(beat.resumeId), `${spec.id}返回节点 ID 重复。`);
          resumes.add(beat.resumeId);
        }
        requireValue(Array.isArray(beat.options) && beat.options.length >= 2 && beat.options.length <= 4, `${beat.id}需要 2—4 个选项。`);
        requireValue(new Set(beat.options.map(o => o.id)).size === beat.options.length, `${beat.id}选项 ID 重复。`);
        requireValue(beat.options.some(o => ['reserved', 'refuse'].includes(o.attitude)), `${beat.id}需要一个保留或拒绝选项。`);
        requireValue(new Set(beat.options.map(o => o.attitude)).size >= 2, `${beat.id}选项态度需要有所不同。`);
        for (const option of beat.options) {
          requireValue(text(option.id) && text(option.text), `${beat.id}选项缺少文字或 ID。`);
          requireValue(['curious', 'playful', 'gentle', 'reserved', 'refuse'].includes(option.attitude), `${beat.id}选项态度标识错误。`);
          validateLines(option.lines, ids, `${beat.id}/${option.id}`, { min:1, max:4, user:true });
          requireValue(option.lines.some(line => line.speaker !== 'USER' && line.speaker !== 'N'), `${beat.id}/${option.id}需要角色的针对性反馈。`);
          requireValue(Array.isArray(option.facts) && option.facts.length <= 4 && option.facts.every(f => typeof f === 'string' && f.length <= 500), `${beat.id}分支事实格式错误。`);
        }
        beat.options[0].lines.forEach(line => { if (beat.options.every(o => o.lines.some(l => l.speaker === line.speaker))) speakers.add(line.speaker); });
        validateLines(beat.resume, ids, `${beat.id}公共汇合`, { min:1, max:6 });
        requireValue(beat.resume.every(line => line.speaker !== 'USER'), `${beat.id}公共continue不能包含USER或USER:auto；USER的选择结果必须留在option内部。`);
        inspect(beat.resume);
      } else requireValue(beat.kind === 'done' && i === card.beats.length - 1, `${spec.id}出现无法播放或提前结束的节点。`);
    }
    requireValue(choiceCount >= 1 && choiceCount <= 3, `${spec.id}需要 1—3 处 USER 互动。`);
    requireValue(card.actor === 'USER' || speakers.has(card.actor), `${spec.id}行动人没有实际发言。`);
    requireValue(card.targets.every(id => id === 'USER' || speakers.has(id)), `${spec.id}目标角色未实际参与剧情。`);
    if (cfg.mode === 'multi' && card.actor !== 'USER') {
      requireValue([...speakers].some(id => id !== 'N' && id !== 'USER' && id !== card.actor), `${spec.id}需要另一名 NPC 实际参与。`);
    }
    const cv = coverage[card.round];
    if (card.targets.includes('USER') || card.actor === 'USER') {
      if (['echo', 'pair', 'blind'].includes(card.special)) {
        if (card.actor === 'USER') cv.userSpecial++; else cv.special = true;
      }
    }
    // USER candidates are alternatives, not four guaranteed interactions.
    if (card.actor !== 'USER') {
      cv.total++;
      card.targets.forEach(id => cv.actors.add(id));
      if ([card.actor, ...card.targets].some(id => cfg.focus.includes(id))) cv.focused++;
      if (card.special === 'pair') cv.pairs.push([card.actor, ...card.targets].sort().join(','));
    }
  }
  for (const round of game.plans) {
    const cv = coverage[round.id];
    for (const type of ['T', 'D']) {
      const candidates = data.cards.filter(c => c.round === round.id && c.actor === 'USER' && c.type === type);
      requireValue(new Set(candidates.map(c => c.question)).size === 2, `${round.id}同类 USER 候选题目不能重复。`);
      if (cfg.source === 'builtin') requireValue(new Set(candidates.map(c => c.sourceId)).size === 2, `${round.id}同类 USER 候选来源不能重复。`);
    }
    if (cfg.mode === 'duo') requireValue(cv.special || cv.userSpecial === 4, `${round.id}需要回声问题、默契盲选或双人任务。`);
    if (cfg.mode === 'multi') {
      requireValue(game.snapshot.players.every(p => cv.actors.has(p.id)), `${round.id}并非每位角色都获得了他人的互动。`);
      if (cfg.focusMode === 'focused') requireValue(cv.focused >= Math.ceil(cv.total * 0.6), `${round.id}重点角色的关联互动不足 60%。`);
      requireValue(cv.pairs.every((pair, i) => !i || pair !== cv.pairs[i - 1]), `${round.id}不能连续强制同一组角色执行双人任务。`);
    }
  }
  return data;
}

export function newRun(game) {
  requireValue(game.content, '请先生成完整游戏。');
  requireValue(game.runs.length < HEART_LIMITS.runs, '同一牌库的游玩记录已满，请导出并整理旧记录。');
  return { id:uid('run'), createdAt:Date.now(), stage:'open', roundIndex:0, turnIndex:0,
    cardId:'', type:'', offered:[], rejected:[], swaps:0, used:[], queue:[], current:null,
    history:[], records:[], choices:[], facts:[], relations:{}, checkpoint:null, branches:[],
    ending:'', endingTitle:'', freeDraft:'', freeReplies:0, awaitingReply:false, skipped:false };
}

function log(run, node) {
  requireValue(run.history.length < HEART_LIMITS.history, '本局记录已达到保存上限，请先结算或导出记录。');
  run.history.push({ ...clone(node), roundIndex:run.roundIndex, turnIndex:run.turnIndex, cardId:run.cardId, at:Date.now() });
}

function checkpoint(run) {
  return { historyLength:run.history.length, records:clone(run.records), choices:clone(run.choices),
    facts:clone(run.facts), relations:clone(run.relations), used:clone(run.used), freeReplies:run.freeReplies };
}

function enterTurn(game, run) {
  run.cardId = ''; run.type = ''; run.offered = []; run.rejected = []; run.swaps = 0;
  run.queue = []; run.current = null; run.skipped = false; run.freeDraft = ''; run.awaitingReply = false;
  run.checkpoint = checkpoint(run);
  const turn = currentTurn(game, run);
  requireValue(turn, '找不到当前行动。');
  const fixed = turn.actor !== 'USER' && game.content.cards.find(c => c.id === turn.cardIds[0]);
  if (fixed && !dependenciesMet(fixed, run)) {
    run.cardId = fixed.id; run.type = fixed.type;
    log(run, { kind:'marker', text:'前置事件已中止，本行动跳过关联剧情。' });
    finishTurn(game, run, 'interrupted'); return;
  }
  run.stage = 'turnIntro';
}

function enterRound(game, run) {
  log(run, { kind:'round', speaker:'N', text:game.content.rounds[run.roundIndex].intro });
  enterTurn(game, run);
}

function playNext(game, run) {
  const node = run.queue.shift();
  requireValue(node, '剧情节点不完整，请重试当前行动。');
  run.current = clone(node);
  if (node.kind === 'choice') { run.stage = 'choice'; return; }
  if (node.kind === 'boundary') { run.stage = node.stage; run.current = node.choice || null; return; }
  if (node.kind === 'interrupted') { finishTurn(game, run, 'interrupted'); return; }
  if (node.kind === 'done') {
    requireValue(node.card === run.cardId, '完成标记与当前卡牌不一致。');
    finishTurn(game, run, 'done'); return;
  }
  run.stage = node.kind === 'event' ? 'event' : 'story';
  log(run, node);
}

function finishTurn(game, run, status) {
  const turn = currentTurn(game, run), card = currentCard(game, run);
  requireValue(card, '当前没有卡牌。');
  requireValue(!run.records.some(r => r.turn === turn.id), '当前行动已结算。');
  run.records.push({ turn:turn.id, round:card.round, actor:turn.actor, cardId:card.id, type:card.type,
    question:card.question, status, choices:run.choices.filter(c => c.turn === turn.id),
    resolution:status === 'done' ? (card.actor === 'USER' ? run.choices.filter(c => c.turn === turn.id).map(c => c.text).join('；') : card.resolution) : '本次行动中止，固定事件不视为发生。' });
  if (!run.used.includes(card.id)) run.used.push(card.id);
  run.stage = 'turnEnd'; run.queue = []; run.current = null; run.skipped = status !== 'done';
  log(run, { kind:'marker', text:status === 'done' ? '本次行动完成' : '本次行动已中止' });
}

function chooseEffect(game, run, option, choiceId) {
  const card = currentCard(game, run), turn = currentTurn(game, run);
  const key = `${turn.id}:${choiceId}`;
  requireValue(!run.choices.some(c => c.key === key), '这个选项已经结算过。');
  run.choices.push({ key, turn:turn.id, choice:choiceId, option:option.id, text:option.text, attitude:option.attitude });
  for (const id of new Set([card.actor, ...card.targets].filter(id => id !== 'USER'))) {
    const relation = run.relations[id] ||= { interactions:0, shared:0, boundaries:0 };
    relation.interactions++;
    if (['refuse', 'reserved'].includes(option.attitude)) relation.boundaries++;
    else relation.shared++;
  }
  for (const fact of option.facts || []) run.facts.push({ turn:turn.id, text:fact });
  log(run, { kind:'selection', speaker:'USER', text:option.text, attitude:option.attitude });
}

export function weightedOffer(cards, count = 3, random = Math.random) {
  const pool = [...cards], chosen = [];
  while (pool.length && chosen.length < count) {
    const sum = pool.reduce((n, card) => n + Math.max(0.01, Number(card.weight) || 1), 0);
    let needle = random() * sum;
    let i = pool.findIndex(card => (needle -= Math.max(0.01, Number(card.weight) || 1)) < 0);
    if (i < 0) i = pool.length - 1;
    chosen.push(pool.splice(i, 1)[0]);
  }
  return chosen;
}

export function dependenciesMet(card, run) {
  return (card.requires || []).every(id => run.records.some(r => r.cardId === id && r.status === 'done'));
}

export function availableCards(game, run, type) {
  const turn = currentTurn(game, run);
  return game.content.cards.filter(c => turn.cardIds.includes(c.id) && c.type === type && !run.used.includes(c.id) && !run.rejected.includes(c.id) && dependenciesMet(c, run));
}

export function advance(game, run, action, payload, random = Math.random) {
  if (action === 'next') {
    if (run.stage === 'open') {
      log(run, { kind:'opening', speaker:'N', text:game.content.open }); enterRound(game, run);
    } else if (run.stage === 'roundIntro') {
      enterRound(game, run);
    } else if (run.stage === 'turnIntro') {
      const turn = currentTurn(game, run);
      if (turn.actor === 'USER') {
        run.stage = 'pickType';
        if (!['T', 'D'].some(type => availableCards(game, run, type).length)) {
          run.cardId = turn.cardIds[0]; finishTurn(game, run, 'interrupted');
        }
      }
      else {
        const card = game.content.cards.find(c => c.id === turn.cardIds[0]);
        run.cardId = card.id; run.type = card.type; run.stage = 'reveal';
        log(run, { kind:'line', speaker:turn.actor, text:card.declaration || (card.type === 'T' ? '这次我选真心话。' : '这次我选大冒险。') });
      }
    } else if (['story', 'event'].includes(run.stage)) playNext(game, run);
    else if (run.stage === 'turnEnd') {
      if (run.turnIndex + 1 < game.order.length) { run.turnIndex++; enterTurn(game, run); }
      else run.stage = run.roundIndex + 1 < game.snapshot.config.rounds ? 'roundEnd' : 'settlement';
    } else if (run.stage === 'roundEnd') {
      if (run.roundIndex + 1 < game.snapshot.config.rounds) { run.roundIndex++; run.turnIndex = 0; enterRound(game, run); }
      else run.stage = 'settlement';
    } else throw new Error('请先完成当前选择。');
  } else if (action === 'type') {
    requireValue(['pickType', 'pick'].includes(run.stage) && currentTurn(game, run).actor === 'USER', '当前不能选择牌型。');
    requireValue(['T', 'D'].includes(payload), '请选择真心话或大冒险。');
    const available = availableCards(game, run, payload);
    requireValue(available.length, '这类牌已用完或本次已换出，请选择另一牌型。');
    run.type = payload;
    run.offered = weightedOffer(available, 3, random).map(c => c.id);
    run.stage = 'pick';
  } else if (action === 'draw') {
    requireValue(run.stage === 'pick' && run.offered.includes(payload), '这张牌不在当前候选中。');
    run.cardId = payload; run.stage = 'reveal';
    log(run, { kind:'draw', speaker:'USER', text:'翻开卡牌', type:currentCard(game, run).type });
  } else if (action === 'swap') {
    requireValue(run.stage === 'reveal' && currentTurn(game, run).actor === 'USER', '当前不能换牌。');
    requireValue(run.swaps < game.snapshot.config.swaps, '本次行动的换牌次数已用完。');
    run.rejected.push(run.cardId); run.swaps++; run.cardId = ''; run.offered = []; run.stage = 'pickType';
    log(run, { kind:'marker', text:'换出一张牌，重新选择牌型。' });
  } else if (action === 'accept') {
    requireValue(run.stage === 'reveal', '请先翻开卡牌。');
    const card = currentCard(game, run);
    log(run, { kind:'card', text:card.question, type:card.type });
    run.queue = clone(card.beats); playNext(game, run);
  } else if (action === 'option') {
    requireValue(run.stage === 'choice', '当前不在选择节点。');
    const choice = run.current, option = choice.options.find(o => o.id === payload);
    requireValue(option, '找不到这个选项。');
    run.awaitingReply = false;
    chooseEffect(game, run, option, choice.id);
    run.queue = [...clone(option.lines).map(line => ({ ...line, kind:'line' })), ...clone(choice.resume).map(line => ({ ...line, kind:'line' })), ...run.queue];
    playNext(game, run);
  } else if (action === 'skip') {
    requireValue(['reveal', 'choice'].includes(run.stage) && currentTurn(game, run).actor === 'USER', '当前不能跳过行动。');
    log(run, { kind:'selection', speaker:'USER', text:'这张牌先跳过。', attitude:'refuse' });
    finishTurn(game, run, 'skipped');
  } else throw new Error('未知游戏操作。');
  return run;
}

export function restartTurn(game, run) {
  requireValue(run.stage === 'turnEnd' && run.checkpoint && dependenciesMet(currentCard(game, run), run), '只能在行动结束时重开当前行动。');
  requireValue(run.branches.length < HEART_LIMITS.branches, '历史分支已满，请先导出或结算。');
  const base = run.checkpoint;
  run.branches.push({ id:uid('branch'), turn:currentTurn(game, run).id, cardId:run.cardId,
    createdAt:Date.now(), history:clone(run.history.slice(base.historyLength)),
    records:clone(run.records.filter(r => r.turn === currentTurn(game, run).id)) });
  run.history = run.history.slice(0, base.historyLength);
  for (const key of ['records', 'choices', 'facts', 'relations', 'used', 'freeReplies']) run[key] = clone(base[key]);
  run.stage = 'reveal'; run.queue = []; run.current = null; run.skipped = false; run.freeDraft = ''; run.awaitingReply = false;
  run.rejected = []; run.swaps = 0;
  return run;
}

export function validateReply(input, game, run) {
  const reply = typeof input === 'string' && input.trim().startsWith('<') ? parseReplyFormat(input) : (typeof input === 'string' ? parseGeneratedJson(input) : clone(input));
  requireValue(reply.task === 'reply' && ['resume', 'wait', 'end'].includes(reply.state), '自由互动返回了错误的任务或状态。');
  const resume = run.stage === 'choice' ? (run.current.resumeId || run.current.id) : 'TURN_END';
  requireValue(reply.resume === resume, '自由互动的返回节点不匹配。');
  const ids = new Set(['N', ...actors(game).map(p => p.id)]);
  validateLines(reply.lines, ids, '自由互动', { min:4, max:6 });
  requireValue(reply.lines.every(line => line.speaker !== 'USER'), '自由互动中 USER 输入由程序显示，无需模型代言。');
  requireValue(reply.lines.some(line => line.speaker !== 'N' && line.speaker !== 'USER'), '自由互动缺少角色回应。');
  requireValue(Array.isArray(reply.facts) && reply.facts.length <= 5 && reply.facts.every(f => typeof f === 'string' && f.length <= 500), '自由互动的事实格式错误。');
  requireValue(typeof reply.conflict === 'boolean', '自由互动缺少冲突检查结果。');
  return reply;
}

export function applyReply(game, run, input, reply) {
  requireValue(['choice', 'turnEnd'].includes(run.stage), '当前不能自由互动。');
  requireValue(typeof input === 'string' && input.trim() && input.length <= 3000, '自由输入需要 1—3000 字。');
  reply = validateReply(reply, game, run);
  requireValue(run.freeReplies < HEART_LIMITS.freeReplies, '本局自由互动次数已满，请先结算。');
  const wasChoice = run.stage === 'choice', choice = clone(run.current);
  const turn = currentTurn(game, run);
  run.freeReplies++; run.freeDraft = ''; run.awaitingReply = reply.state === 'wait' && !reply.conflict;
  log(run, { kind:'line', speaker:'USER', text:input });
  for (const fact of reply.facts) run.facts.push({ turn:turn.id, text:fact });
  const lines = clone(reply.lines).map(line => ({ ...line, kind:'line' }));
  if (wasChoice && (reply.conflict || reply.state === 'end')) {
    chooseEffect(game, run, { id:'free', text:input, attitude:'reserved', facts:[] }, choice.id);
    run.queue = [...lines, { kind:'interrupted', card:run.cardId }];
  } else if (wasChoice && reply.state === 'resume') {
    chooseEffect(game, run, { id:'free', text:input, attitude:'curious', facts:[] }, choice.id);
    run.queue = [...lines, ...clone(choice.resume).map(line => ({ ...line, kind:'line' })), ...run.queue];
  } else {
    run.queue = [...lines, { kind:'boundary', stage:wasChoice ? 'choice' : 'turnEnd', choice:wasChoice ? choice : null }, ...run.queue];
  }
  playNext(game, run);
  return run;
}

export function validateEnding(input) {
  const data = typeof input === 'string' ? parseGeneratedJson(input) : clone(input);
  requireValue(data.task === 'ending' && text(data.title) && text(data.text).length >= 80 && data.text.length <= 12000, '结局需要标题与完整故事段落。');
  return { title:data.title, text:data.text };
}

export function finishGame(game, run, ending) {
  requireValue(run.stage === 'settlement', '请先完成全部轮次。');
  run.endingTitle = ending.title; run.ending = ending.text; run.stage = 'ending'; run.endedAt = Date.now();
  game.sessionEndedAt = run.endedAt;
  log(run, { kind:'ending', speaker:'N', text:ending.text });
}

export function effectiveMemory(game) {
  const run = currentRun(game);
  if (!run) return { number:game.number, records:[] };
  return { number:game.number, records:clone(run.records), facts:clone(run.facts), relations:clone(run.relations),
    choices:clone(run.choices), transcript:run.history.filter(n => ['line', 'event', 'selection', 'card'].includes(n.kind)).map(({ speaker, text, cardId }) => ({ speaker, text, cardId })),
    ending:run.ending || '' };
}

export function historyText(game, history) {
  return history.map(line => `${line.speaker ? '[' + actorName(game, line.speaker) + '] ' : ''}${line.text || ''}`).join('\n\n');
}
