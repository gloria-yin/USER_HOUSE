import { DEFAULT_LINES, PROMPT_TEMPLATES } from './wanban-prompts.js';

// Runtime migrated from 益智小游戏/玩伴小屋V1.0.0.json.
// Keep this file behavior-compatible with the original script; split new code into src/* modules when extending.
let runtimeStarted = false;
let activePromptTemplates = PROMPT_TEMPLATES;

function clonePromptTemplates() {
  return JSON.parse(JSON.stringify(PROMPT_TEMPLATES));
}

function setPromptSection(root, path, lines) {
  const parts = path.split('.').map(x => x.trim()).filter(Boolean);
  if (!parts.length) return;
  let target = root;
  while (parts.length > 1) {
    const key = parts.shift();
    target[key] = target[key] || {};
    target = target[key];
  }
  const key = parts[0];
  const value = lines.map(x => x.trim()).filter(Boolean);
  target[key] = path.indexOf('systems.') === 0 ? value.join('\n').trim() : value;
}

function parsePromptText(text) {
  const root = clonePromptTemplates();
  let section = '';
  let lines = [];
  const flush = () => {
    if (!section) return;
    setPromptSection(root, section, lines);
    lines = [];
  };
  String(text || '').replace(/\r\n/g, '\n').split('\n').forEach(line => {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      flush();
      section = match[1];
      return;
    }
    if (section) lines.push(line);
  });
  flush();
  return root;
}

async function loadPromptTextTemplates() {
  try {
    const url = new URL('./wanban-prompts.txt', import.meta.url);
    const res = await fetch(url.href, { cache: 'no-store' });
    if (!res.ok) return;
    activePromptTemplates = parsePromptText(await res.text());
  } catch (e) {
    console.warn('[玩伴小屋] prompt txt load failed, using JS fallback:', e);
  }
}

function promptTemplates() {
  return activePromptTemplates || PROMPT_TEMPLATES;
}

export async function initWanbanXiaowu() {
  if (runtimeStarted) return;
  runtimeStarted = true;
  await loadPromptTextTemplates();

  const SCRIPT_ID = 'wanbanXiaowu';
  const POPUP_ID = SCRIPT_ID + '-popup';
  const SHELL_ID = SCRIPT_ID + '-shell';
  const MENU_ID = SCRIPT_ID + '-menu-item';
  const STYLE_ID = SCRIPT_ID + '-css';
  const STORAGE_SETTINGS = SCRIPT_ID + '_settings_v1';
  const STORAGE_SCORES = SCRIPT_ID + '_scores_v1';
  const STORAGE_LINES = SCRIPT_ID + '_lines_v1';
  const STORAGE_ROLE_LINES = SCRIPT_ID + '_roleLines_v1';
  const STORAGE_LINE_PRESET_SELECTION = SCRIPT_ID + '_linePresetSelection_v1';
  const STORAGE_API_PRESETS = SCRIPT_ID + '_apiPresets_v1';
  const STORAGE_WORLD_PRESETS = SCRIPT_ID + '_worldPresets_v1';
  const STORAGE_SUMMARIES = SCRIPT_ID + '_summaries_v1';
  const STORAGE_SUMMARY_REQ = SCRIPT_ID + '_summaryReq_v1';
  const STORAGE_PROGRESS = SCRIPT_ID + '_progress_v1';
  const STORAGE_RECORDS = SCRIPT_ID + '_records_v1';
  const FLAG = SCRIPT_ID + '_Loaded_v1_0_0';
  const MENU_SELECTORS = [
    '#extensionsMenu',
    '#extensionMenuItems',
    '.extensions_block',
    '#extension_settings',
    '#extensionsMenuList',
    '.extension_menu',
    '#rm_extensions_block'
  ];

  let currentTab = 'single';
  let currentGame = null;
  let snakeTimer = null;
  let tetrisTimer = null;
  let watermelonTimer = null;
  let jumpTimer = null;
  let touchStart = null;
  let gameStarted = false;
  let gamePaused = true;
  let gameStartAt = 0;
  let randomLineTimer = null;
  let currentRoundRecord = false;
  let theaterCache = {};
  let lastMenuOpenAt = 0;

  const GAME_ICON_BASE = new URL('../../assets/game-icons/', import.meta.url).href;
  const APP_ICON_URL = GAME_ICON_BASE + 'wanban.png';
  const GAME_META = {
    tetris: { id: 'tetris', name: '俄罗斯方块', mode: 'single', unit: '分', icon: '▦', iconImage: GAME_ICON_BASE + 'tetris.png' },
    snake: { id: 'snake', name: '贪吃蛇', mode: 'single', unit: '分', icon: '●', iconImage: GAME_ICON_BASE + 'snake.jpg' },
    game2048: { id: 'game2048', name: '2048', mode: 'single', unit: '分', icon: '2048', iconImage: GAME_ICON_BASE + 'game2048.png' },
    watermelon: { id: 'watermelon', name: '合成大西瓜', mode: 'single', unit: '分', icon: '瓜', iconImage: GAME_ICON_BASE + 'watermelon.png' },
    memory: { id: 'memory', name: '翻牌记忆', mode: 'single', unit: '分', icon: '◇', iconImage: GAME_ICON_BASE + 'memory.png' },
    jump: { id: 'jump', name: '跳一跳', mode: 'single', unit: '分', icon: '跳', iconImage: GAME_ICON_BASE + 'jump.jpg' },
    ludo: { id: 'ludo', name: '双人飞行棋', mode: 'double', unit: '胜', icon: '✈', iconImage: GAME_ICON_BASE + 'ludo.jpg' },
    guessnumber: { id: 'guessnumber', name: '猜数字', mode: 'double', unit: '胜', icon: '1234', iconImage: GAME_ICON_BASE + 'guessnumber.jpg' },
    wordguess: { id: 'wordguess', name: '我说你猜', mode: 'double', unit: '胜', icon: '谜', iconImage: GAME_ICON_BASE + 'wordguess.jpg' },
    tictactoe: { id: 'tictactoe', name: '井字棋', mode: 'double', unit: '胜', icon: '×○', iconImage: GAME_ICON_BASE + 'tictactoe.jpg' },
    gomoku: { id: 'gomoku', name: '五子棋', mode: 'double', unit: '胜', icon: '五', iconImage: GAME_ICON_BASE + 'gomoku.jpg' },
    territory: { id: 'territory', name: '电子围地盘', mode: 'double', unit: '胜', icon: '□', iconImage: GAME_ICON_BASE + 'territory.jpg' },
    oldmaid: { id: 'oldmaid', name: '抽鬼牌', mode: 'double', unit: '胜', icon: '鬼', iconImage: GAME_ICON_BASE + 'oldmaid.jpg' }
  };

  const DEFAULT_SETTINGS = {
    companion: false,
    theme: 'day',
    avatarUrl: '',
    apiUrl: '',
    apiKey: '',
    apiModel: 'gpt-4o-mini',
    charPersona: '',
    userPersona: '',
    worldView: '',
    injectUserDesc: true,
    injectCharDesc: true,
    injectChat: false,
    intimacyMode: false,
    breakLimitPrompt: '',
    summaryId: '',
    selectedWorldEntries: [],
    charName: '{{char}}',
    userName: '{{user}}',
    rememberWindow: false,
    messageNotify: false,
    lastTab: 'single',
    lastGame: ''
  };

  const EVENT_DESCRIPTIONS = {
    tetris: { start:'俄罗斯方块开局，玩家准备开始下落方块。', move:'玩家左右移动方块，调整落点。', rotate:'玩家旋转当前方块。', soft_drop:'玩家主动加速下落。', line_1:'俄罗斯方块消除1行。', line_2:'俄罗斯方块一次消除2行。', line_3:'俄罗斯方块一次消除3行。', line_4:'俄罗斯方块一次消除4行。', danger:'方块堆叠接近顶部，局面危险。', score_500:'俄罗斯方块本局分数达到500分。', score_1500:'俄罗斯方块本局分数达到1500分。', record:'单人游戏刷新历史最高分。', gameover:'俄罗斯方块方块堆到顶部，本局结束。' },
    snake: { start:'贪吃蛇开局。', turn:'贪吃蛇转向。', close_call:'蛇头接近墙体或自身，差点失败。', speed_up:'贪吃蛇吃到食物后速度提高。', eat_1:'贪吃蛇吃到第1个食物。', eat_5:'贪吃蛇累计吃到5个食物。', eat_10:'贪吃蛇累计吃到10个食物。', eat_20:'贪吃蛇累计吃到20个食物。', record:'单人游戏刷新历史最高分。', gameover:'贪吃蛇撞墙或撞到自己，本局结束。' },
    game2048: { start:'2048开局。', move:'玩家滑动并移动数字块。', stuck:'棋盘空位很少，局面拥挤。', tile_64:'棋盘首次合成64数字块。', tile_128:'棋盘首次合成128数字块。', tile_256:'棋盘首次合成256数字块。', tile_512:'棋盘首次合成512数字块。', tile_1024:'棋盘首次合成1024数字块。', tile_2048:'棋盘首次合成2048数字块，玩家达成目标。', record:'单人游戏刷新历史最高分。', gameover:'2048棋盘无可移动格子，本局结束。' },
    watermelon: { start:'合成大西瓜开局。', aim:'玩家长按瞄准水果落点。', drop_edge:'水果贴近边缘落下。', merge_2:'合成到较小水果。', merge_4:'合成到中级水果。', merge_6:'合成到偏大的水果。', merge_7:'合成到接近大西瓜的大水果。', near_top:'水果堆接近顶部警戒线。', watermelon:'成功合成大西瓜。', record:'单人游戏刷新历史最高分。', gameover:'水果堆超过警戒线，本局结束。' },
    memory: { start:'翻牌记忆开局，4×4牌面扣住。', first_flip:'玩家翻开本局第一张牌。', match:'玩家翻开的两张牌成功配对并消除。', miss:'玩家翻开的两张牌没有配对。', combo:'玩家连续成功配对。', half:'玩家已经完成一半配对。', record:'玩家以更少步数或更高分刷新记录。', gameover:'全部卡牌配对完成。' },
    jump: { start:'跳一跳开局，玩家站在第一个平台上。', charge:'玩家按住屏幕开始蓄力。', jump:'玩家松手起跳。', perfect:'玩家落在平台中心附近。', land:'玩家成功落到下一个平台。', record:'跳一跳刷新历史最高分。', gameover:'玩家没有落在平台上，本局结束。' },
    tictactoe: { start:'井字棋开局。', user_center:'玩家占据中心格。', user_corner:'玩家占据角落格。', ai_block:'机器人阻挡了玩家即将连线的一步。', user_win:'玩家在井字棋获胜。', user_lose:'机器人在井字棋获胜，玩家失败。', draw:'井字棋平局。' },
    gomoku: { start:'五子棋开局。', user_three:'玩家形成三连或强威胁。', ai_block:'机器人阻挡玩家形成强威胁。', ai_threat:'机器人形成强威胁，玩家需要防守。', user_win:'玩家五子连线获胜。', user_lose:'机器人五子连线获胜，玩家失败。', draw:'五子棋平局。' },
    territory: { start:'电子围地盘开局，5×5方格为空。', edge:'玩家画下一条边。', capture:'玩家围住某个方格最后一条边并占领得分。', chain:'玩家连续占领多个方格。', ta_capture:'机器人围住某个方格并占领得分。', user_turn:'机器人回合结束，轮到玩家。', danger:'玩家选择可能送给机器人得分机会的边。', user_win:'所有边画完后玩家得分更高。', user_lose:'所有边画完后机器人得分更高。', draw:'所有边画完后双方平分。' },
    oldmaid: { start:'抽鬼牌开局，双方手牌自动消去对子。', draw:'玩家从机器人手里随机抽走一张牌。', pair:'玩家抽牌后凑成对子并消去。', ta_draw:'机器人从玩家手里随机抽走一张牌。', ta_pair:'机器人抽牌后凑成对子并消去。', joker:'鬼牌在双方之间转移。', user_win:'玩家先清空手牌，没有留下鬼牌。', user_lose:'玩家最后留下鬼牌，机器人获胜。' },
    ludo: { start:'双人飞行棋开局或普通回合。', roll_6:'玩家掷出6点。', no_move:'玩家本回合没有可移动棋子。', takeoff:'玩家掷出可起飞点数，飞机起飞。', capture:'一方棋子撞回另一方棋子。', near_finish:'玩家棋子接近终点。', user_win:'玩家率先到达终点获胜。', user_lose:'机器人率先到达终点，玩家失败。' },
    guessnumber: { start:'角色想好一个四位数。', guess:'用户提交了一次四位数猜测。', miss:'本次猜测几乎没有命中。', close:'本次猜测数字或位置命中较多。', very_close:'本次猜测非常接近答案。', many_tries:'用户已经尝试多次仍未猜中。', user_win:'用户猜中完整四位数。', random:'猜测间隙的随机角色互动。' },
    wordguess: { start:'角色拿到一个与两人相关的词，开始描述让用户猜。', clue:'用户要求下一条描述，角色换一种不能直说答案的描述。', clue_late:'用户已经看到后段强提示。', guess:'用户猜错，角色回应并继续引导。', reveal:'用户揭晓答案。', user_win:'用户猜中词语。', random:'猜词间隙的随机角色互动。' }
  };
  function getHostWindow() {
    try { return (window.parent && window.parent !== window) ? window.parent : window; }
    catch(e) { return window; }
  }
  function getHostDocument() {
    try { const w = getHostWindow(); return w.document || document; }
    catch(e) { return document; }
  }
  function getHostJQ() {
    try { const w = getHostWindow(); return w.$ || w.jQuery || (typeof $ !== 'undefined' ? $ : (typeof jQuery !== 'undefined' ? jQuery : null)); }
    catch(e) { return (typeof $ !== 'undefined' ? $ : (typeof jQuery !== 'undefined' ? jQuery : null)); }
  }
  function qs(s, root) { return (root || getHostDocument()).querySelector(s); }
  function qsa(s, root) { return Array.from((root || getHostDocument()).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function loadJSON(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e) { return fallback; } }
  function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {} }
  function settings() { return Object.assign({}, DEFAULT_SETTINGS, loadJSON(STORAGE_SETTINGS, {})); }
  function setSettings(next) { saveJSON(STORAGE_SETTINGS, Object.assign(settings(), next)); }
  function saveWindowState(tab, game) {
    const cfg = settings();
    if (!cfg.rememberWindow) return;
    const nextTab = tab || currentTab || cfg.lastTab || 'single';
    const nextGame = game || '';
    setSettings({ lastTab: nextTab, lastGame: nextGame });
  }
  function restoreWindowState() {
    const cfg = settings();
    if (!cfg.rememberWindow) {
      currentTab = 'single';
      currentGame = null;
      return;
    }
    const tab = GAME_META[cfg.lastGame] ? GAME_META[cfg.lastGame].mode : cfg.lastTab;
    currentTab = (tab === 'double' || tab === 'settings' || tab === 'single') ? tab : 'single';
    currentGame = GAME_META[cfg.lastGame] ? cfg.lastGame : null;
  }
  function scores() {
    const loaded = loadJSON(STORAGE_SCORES, {});
    const base = { tetris: 0, snake: 0, game2048: 0, watermelon: 0, memory: 0, jump: 0, ludo: { user: 0, ta: 0 }, guessnumber: { user: 0, ta: 0 }, wordguess: { user: 0, ta: 0 }, tictactoe: { user: 0, ta: 0 }, gomoku: { user: 0, ta: 0 }, territory: { user: 0, ta: 0 }, oldmaid: { user: 0, ta: 0 } };
    ['ludo','guessnumber','wordguess','tictactoe','gomoku','territory','oldmaid'].forEach(k => { if (typeof loaded[k] === 'number') loaded[k] = { user: loaded[k], ta: 0 }; });
    return Object.assign(base, loaded);
  }
  function lines() { return Object.assign({}, DEFAULT_LINES, loadJSON(STORAGE_LINES, {})); }
  function saveLines(v) { saveJSON(STORAGE_LINES, v); }
  function roleLines() { return loadJSON(STORAGE_ROLE_LINES, {}); }
  function saveRoleLines(v) { saveJSON(STORAGE_ROLE_LINES, v); }
  function linePresetSelection() { return loadJSON(STORAGE_LINE_PRESET_SELECTION, {}); }
  function saveLinePresetSelection(v) { saveJSON(STORAGE_LINE_PRESET_SELECTION, v); }
  function normalizePresetName(name) { return String(name || '默认语录').trim().slice(0, 24) || '默认语录'; }
  function roleLineScope(game) { return companionName() + '::' + game; }
  function currentLinePreset(game) { const sel = linePresetSelection(); return normalizePresetName(sel[roleLineScope(game)] || '默认语录'); }
  function setCurrentLinePreset(game, name) { const sel = linePresetSelection(); sel[roleLineScope(game)] = normalizePresetName(name); saveLinePresetSelection(sel); }
  function roleLineSet(game, preset) { const all = roleLines(); const scope = all[roleLineScope(game)] || {}; return scope[normalizePresetName(preset || currentLinePreset(game))] || null; }
  function activeLineSet(game) { return roleLineSet(game) || (lines()[game] || DEFAULT_LINES[game] || {}); }
  function presetNamesForGame(game) { const scope = roleLines()[roleLineScope(game)] || {}; const names = Object.keys(scope).filter(Boolean); if (!names.includes('默认语录')) names.unshift('默认语录'); return names; }
  function saveRoleLineSet(game, preset, data) { const all = roleLines(); const scopeKey = roleLineScope(game); if (!all[scopeKey]) all[scopeKey] = {}; all[scopeKey][normalizePresetName(preset)] = data; saveRoleLines(all); }
  function apiPresets() { return loadJSON(STORAGE_API_PRESETS, []); }
  function saveApiPresets(v) { saveJSON(STORAGE_API_PRESETS, v); }
  function worldPresets() { return loadJSON(STORAGE_WORLD_PRESETS, []); }
  function saveWorldPresets(v) { saveJSON(STORAGE_WORLD_PRESETS, v); }
  function summaries() { return loadJSON(STORAGE_SUMMARIES, []); }
  function saveSummaries(v) { saveJSON(STORAGE_SUMMARIES, v); }
  function summaryReq() { return localStorage.getItem(STORAGE_SUMMARY_REQ) || ''; }
  function saveSummaryReq(v) { try { localStorage.setItem(STORAGE_SUMMARY_REQ, String(v || '')); } catch(e) {} }
  function progress() { return loadJSON(STORAGE_PROGRESS, {}); }
  function gameProgress(game) { const p = progress()[game]; return p && p.savedAt ? p : null; }
  function saveProgress(game, state) { const p = progress(); p[game] = Object.assign({ savedAt: Date.now() }, state || {}); saveJSON(STORAGE_PROGRESS, p); }
  function clearProgress(game) { const p = progress(); delete p[game]; saveJSON(STORAGE_PROGRESS, p); }
  function records() { const all = loadJSON(STORAGE_RECORDS, {}); let changed = false; Object.keys(all || {}).forEach(game => { (all[game] || []).forEach((r, i) => { if (!r.id) { r.id = 'rec_legacy_' + game + '_' + (r.savedAt || Date.now()) + '_' + i; changed = true; } if (r.log == null) { r.log = ''; changed = true; } }); }); if (changed) saveJSON(STORAGE_RECORDS, all); return all || {}; }
  function saveRecords(v) { saveJSON(STORAGE_RECORDS, v); }
  function companionName() { const cfg = settings(); const ctx = getHostContext(); const char = ctx && ctx.characters && ctx.characterId >= 0 ? ctx.characters[ctx.characterId] : (ctx && ctx.character ? ctx.character : null); const charData = char?.data || char || {}; return (cfg.charName && cfg.charName !== '{{char}}') ? cfg.charName : (charData.name || ctx?.name2 || '{{char}}'); }
  function scoreDisplay(game) { const g = GAME_META[game] || {}; const sc = scores()[game]; if (g.mode === 'double') { const v = (sc && typeof sc === 'object') ? sc : { user: sc || 0, ta: 0 }; return '你赢：' + (v.user || 0) + '场 TA赢：' + (v.ta || 0) + '场'; } return '最高：' + ((sc || 0) + (g.unit || '分')); }
  function cardScoreDisplay(game) { const g = GAME_META[game] || {}; const sc = scores()[game]; if (g.mode === 'double') { const v = (sc && typeof sc === 'object') ? sc : { user: sc || 0, ta: 0 }; return '你赢：' + (v.user || 0) + '场 TA赢：' + (v.ta || 0) + '场'; } return '当前最高分：' + ((sc || 0) + (g.unit || '分')); }
  function gameIconHTML(g) {
    const fallback = '<span>' + esc(g.icon || '') + '</span>';
    if (!g.iconImage) return '<div class="wb-game-icon">' + fallback + '</div>';
    return '<div class="wb-game-icon has-image"><img src="' + esc(g.iconImage) + '" alt="" loading="lazy" decoding="async" onerror="this.style.display=&#39;none&#39;;this.nextElementSibling.style.display=&#39;grid&#39;;this.parentNode.classList.remove(&#39;has-image&#39;);">' + fallback + '</div>';
  }
  function inferResult(game, title, scoreText) { const t = String((title || '') + ' ' + (scoreText || '')); const g = GAME_META[game] || {}; if (g.mode === 'double') { if (/你赢|1胜/.test(t) && !/平局/.test(t)) return 'user_win'; if (/机器人获胜|失败|0胜/.test(t) && !/平局/.test(t)) return 'ta_win'; if (/平局/.test(t)) return 'draw'; return 'finished'; } const m = t.match(/(\d+)\s*分/); return { outcome: 'score', score: m ? parseInt(m[1], 10) : 0 }; }
  function recordGameResult(game, title, scoreText, explicitResult) {
    const all = records(); const g = GAME_META[game] || { name: game, mode: 'single' }; const result = explicitResult || inferResult(game, title, scoreText); const started = gameStartAt || Date.now();
    const item = { id:'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), playedAt: new Date().toLocaleString(), savedAt: Date.now(), durationMs: Math.max(0, Date.now() - started), game: g.name, result, scoreText: scoreText || '', companion: companionName(), log: '' };
    if (!all[game]) all[game] = []; all[game].unshift(item); all[game] = all[game].slice(0, 100); saveRecords(all); return item;
  }
  function formatDuration(ms) { const sec = Math.max(0, Math.round((ms || 0) / 1000)); const m = Math.floor(sec / 60), s = sec % 60; return (m ? m + '分' : '') + s + '秒'; }
  function formatRecordResult(r) { if (!r) return '已完成'; if (typeof r === 'string') return ({ user_win:'你赢', ta_win:'TA赢', draw:'平局', finished:'已完成' }[r] || r); if (typeof r === 'object' && r.outcome === 'score') return '得分：' + (r.score || 0); return String(r); }
  function recordScoreDisplay(r) {
    const score = String(r?.scoreText || '').trim();
    if (!score) return '';
    if (r?.result && typeof r.result === 'object' && r.result.outcome === 'score') return '';
    const result = formatRecordResult(r?.result).replace(/\s+/g, '');
    const normalizedScore = score.replace(/\s+/g, '').replace(/^本局[：:]/, '').replace(/^本局分数[：:]/, '得分：');
    return result && normalizedScore === result ? '' : score;
  }
  function textSegments(value) {
    const flatten = input => Array.isArray(input) ? input.flatMap(flatten) : String(input || '').split(/\n{2,}|\r?\n/);
    const parts = flatten(value).map(x => String(x || '').trim()).filter(Boolean);
    return parts.length ? parts : [''];
  }
  function textSegmentsHTML(value) {
    return textSegments(value).map(x => '<p class="wb-text-seg">' + esc(x) + '</p>').join('');
  }
  function normalizeTheaterItem(item) {
    if (Array.isArray(item)) return textSegments(item);
    if (item && typeof item === 'object') {
      const parts = item.segments || item.paragraphs || item.parts || item.text;
      return Array.isArray(parts) ? textSegments(parts) : textSegments(parts || JSON.stringify(item));
    }
    return textSegments(item);
  }
  function updateRecord(game, id, patch) { const all = records(); const arr = all[game] || []; const idx = arr.findIndex(r => r.id === id); if (idx < 0) return null; arr[idx] = Object.assign({}, arr[idx], patch || {}); all[game] = arr; saveRecords(all); return arr[idx]; }
  function deleteRecord(game, id) { const all = records(); all[game] = (all[game] || []).filter(r => r.id !== id); saveRecords(all); }
  function recentGameLogs(game) { return (records()[game] || []).filter(r => r.log).slice(0, 5).map((r,i) => '日志' + (i + 1) + '：' + r.log).join('\n'); }
  function resultOutcome(result) { return typeof result === 'string' ? result : (result && result.outcome) || 'finished'; }
  function doubleStreak(game, outcome) { const arr = records()[game] || []; let n = 0; for (const r of arr) { if (resultOutcome(r.result) === outcome) n++; else break; } return n; }
  function eventDescriptionBlock(game, keys) { const m = EVENT_DESCRIPTIONS[game] || {}; return (keys || Object.keys(DEFAULT_LINES[game] || {})).map(k => k + '：' + (m[k] || '游戏事件触发')).join('\n'); }
  function addTaWin(game) { const sc = scores(); const cur = sc[game] && typeof sc[game] === 'object' ? sc[game] : { user: sc[game] || 0, ta: 0 }; cur.ta = (cur.ta || 0) + 1; sc[game] = cur; saveJSON(STORAGE_SCORES, sc); }

  function modalMaskClass() { return 'wb-modal-mask ' + (settings().theme === 'night' ? 'wb-night' : 'wb-day'); }
  function appendModalMask(mask) {
    const doc = getHostDocument();
    const win = getHostWindow();
    const shell = qs('#' + SHELL_ID, doc);
    const popup = qs('#' + POPUP_ID, doc);
    const mobile = (win.innerWidth || 800) <= 768;
    if (mobile && shell) {
      const vp = win.visualViewport || (typeof visualViewport !== 'undefined' ? visualViewport : null);
      const viewH = (vp && vp.height) || win.innerHeight || doc.documentElement.clientHeight || 600;
      const scrollTop = shell.scrollTop || 0;
      mask.style.top = scrollTop + 'px';
      mask.style.height = viewH + 'px';
      mask.style.bottom = 'auto';
      shell.style.overflowY = 'hidden';
    }
    const rawRemove = mask.remove.bind(mask);
    mask.remove = function() {
      rawRemove();
      if (shell && !qs('.wb-modal-mask', shell)) shell.style.overflowY = '';
    };
    (popup || doc.body).appendChild(mask);
    return mask;
  }
  function toast(msg) { if (typeof toastr !== 'undefined') toastr.info(msg); else console.log('[玩伴小屋]', msg); }
  function hostValue(name) {
    const w = getHostWindow();
    try {
      const ctx = w.SillyTavern && typeof w.SillyTavern.getContext === 'function' ? w.SillyTavern.getContext() : null;
      if (ctx && ctx[name] !== undefined) return ctx[name];
    } catch(e) {}
    return w && w[name] !== undefined ? w[name] : (window[name] !== undefined ? window[name] : undefined);
  }
  let messageNotifyBound = false;
  let messageNotifyLastId = null;
  function pauseGameForMessageNotify() {
    if (!gameStarted || !currentGame || gamePaused) return;
    gamePaused = true;
    showGamePauseOverlay();
    const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '继续';
  }
  function notifyBeep() {
    try {
      const w = getHostWindow();
      const AudioContextCls = w.AudioContext || w.webkitAudioContext || window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCls) return false;
      const ctx = new AudioContextCls();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.34);
      return true;
    } catch(e) { return false; }
  }
  function sendMessageFinishedNotification(messageId, text) {
    const cfg = settings();
    if (!cfg.messageNotify) return;
    if (messageId != null && String(messageId) === String(messageNotifyLastId)) return;
    messageNotifyLastId = messageId;
    const preview = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 160) || '角色回复已生成。';
    pauseGameForMessageNotify();
    notifyBeep();
    try { const nav = getHostWindow().navigator || navigator; if (nav && nav.vibrate) nav.vibrate([180, 80, 220]); } catch(e) {}
    showTextModal('角色回复已生成', preview);
  }
  function messageFromHost(messageId) {
    const w = getHostWindow();
    try {
      const getter = w.getChatMessages || window.getChatMessages;
      if (typeof getter === 'function') {
        const arr = getter(messageId);
        if (Array.isArray(arr) && arr[0]) return arr[0];
      }
    } catch(e) {}
    try {
      const ctx = w.SillyTavern && typeof w.SillyTavern.getContext === 'function' ? w.SillyTavern.getContext() : null;
      const chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : null;
      if (chat && messageId != null && chat[messageId]) return chat[messageId];
      if (chat && chat.length) return chat[chat.length - 1];
    } catch(e) {}
    return null;
  }
  function isAssistantMessage(msg) {
    if (!msg) return true;
    if (msg.role) return msg.role === 'assistant';
    if (msg.is_system) return false;
    if (msg.is_user === false) return true;
    return false;
  }
  function handleHostMessageReceived(messageId, type) {
    if (!settings().messageNotify) return;
    const msg = messageFromHost(messageId);
    if (!isAssistantMessage(msg)) return;
    const text = msg ? String(msg.message || msg.mes || msg.text || '') : '';
    sendMessageFinishedNotification(messageId, text);
  }
  function bindMessageNotifyEvents() {
    if (messageNotifyBound) return;
    const w = getHostWindow();
    const eventSource = hostValue('eventSource');
    const eventTypes = hostValue('event_types') || hostValue('eventTypes') || hostValue('tavern_events') || {};
    const eventName = eventTypes.MESSAGE_RECEIVED || 'MESSAGE_RECEIVED';
    if (eventSource && typeof eventSource.on === 'function') {
      eventSource.on(eventName, handleHostMessageReceived);
      messageNotifyBound = true;
      return;
    }
    if (eventSource && typeof eventSource.addEventListener === 'function') {
      eventSource.addEventListener(eventName, e => handleHostMessageReceived(e && e.detail && e.detail.message_id, e && e.detail && e.detail.type));
      messageNotifyBound = true;
      return;
    }
    if (!w.__wanbanMessageNotifyRetry) {
      w.__wanbanMessageNotifyRetry = setInterval(() => {
        const es = hostValue('eventSource');
        if (es && typeof es.on === 'function') { clearInterval(w.__wanbanMessageNotifyRetry); w.__wanbanMessageNotifyRetry = null; bindMessageNotifyEvents(); }
      }, 2000);
    }
  }

  function stopGame() { if (snakeTimer) clearInterval(snakeTimer); if (tetrisTimer) clearInterval(tetrisTimer); if (watermelonTimer) clearInterval(watermelonTimer); if (jumpTimer) clearInterval(jumpTimer); if (randomLineTimer) clearInterval(randomLineTimer); snakeTimer = tetrisTimer = watermelonTimer = jumpTimer = randomLineTimer = null; hideGamePauseOverlay(); getHostDocument().onkeydown = null; gameStarted = false; gamePaused = true; }
  function showGamePauseOverlay() {
    const box = qs('#wb-gamebox');
    if (!box || qs('#wb-pause-overlay', box)) return;
    const div = getHostDocument().createElement('div');
    div.className = 'wb-pause-overlay';
    div.id = 'wb-pause-overlay';
    div.innerHTML = '<span>PAUSE</span>';
    box.appendChild(div);
  }
  function hideGamePauseOverlay() {
    const old = qs('#wb-pause-overlay');
    if (old) old.remove();
  }

  function fitGameSurface() {
    const box = qs('#wb-gamebox');
    if (!box) return;
    const shell = qs('.wb-tetris-shell', box);
    const target = shell || box;
    const rect = target.getBoundingClientRect();
    const controls = shell ? qs('.wb-tetris-controls', shell) : null;
    const controlsRect = controls && getHostWindow().getComputedStyle(controls).display !== 'none' ? controls.getBoundingClientRect() : null;
    const padX = 2;
    const padY = 2;
    const maxW = Math.max(0, rect.width - padX - (controlsRect ? controlsRect.width + 8 : 0));
    const maxH = Math.max(0, rect.height - padY);
    if (maxW < 20 || maxH < 20) return;
    const canvas = qs('canvas.wb-canvas', box);
    if (canvas) {
      const rawW = canvas.width || 300;
      const rawH = canvas.height || rawW;
      const scale = Math.min(maxW / rawW, maxH / rawH, 1);
      canvas.style.width = Math.floor(rawW * scale) + 'px';
      canvas.style.height = Math.floor(rawH * scale) + 'px';
      return;
    }
    const square = qs('.wb-grid2048, .wb-board3, .wb-gomoku, .wb-ludo, .wb-memory', box);
    if (square) square.style.width = Math.floor(Math.min(maxW, maxH)) + 'px';
  }
  function scheduleFitGameSurface() {
    const win = getHostWindow();
    const raf = win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : (fn) => setTimeout(fn, 16);
    raf(() => fitGameSurface());
    setTimeout(fitGameSurface, 80);
  }

  function injectStyle() {
    if (qs('#' + STYLE_ID)) return;
    const css = getHostDocument().createElement('style');
    css.id = STYLE_ID;
    css.textContent = `
      #${SHELL_ID}, #${SHELL_ID} * { box-sizing: border-box; }
      #${SHELL_ID} {
        display:none;
        position:fixed;
        inset:0;
        width:100%;
        height:100vh;
        height:100dvh;
        z-index:999999;
        background:rgba(0,0,0,.45);
        backdrop-filter:blur(3px);
        -webkit-backdrop-filter:blur(3px);
        overscroll-behavior:contain;
      }
      #${SHELL_ID}.wb-shell-visible { display:flex; justify-content:center; align-items:stretch; padding:16px; }
      #${POPUP_ID}, #${POPUP_ID} * { box-sizing: border-box; }
      #${POPUP_ID} {
        position: fixed;
        top: 16px;
        right: 16px;
        bottom: 16px;
        left: 16px;
        width: auto;
        height: auto;
        max-width: calc(100vw - 32px);
        max-height: calc(100dvh - 32px);
        z-index: 1;
        color: var(--wb-text);
        background: var(--wb-bg);
        border: 1px solid var(--wb-border);
        border-top: 3px solid var(--wb-accent);
        box-shadow: 0 24px 70px rgba(0,0,0,.55), 0 0 40px var(--wb-glow);
        overflow: hidden;
        overscroll-behavior: contain;
        font-family: Georgia, 'Noto Serif SC', 'Microsoft YaHei', serif;
        font-size: 14px;
        line-height: 1.6;
        display: flex;
        flex-direction: column;
      }
      #${POPUP_ID}.wb-day { --wb-bg:#fff7fb; --wb-panel:#fffefd; --wb-soft:#ffeaf1; --wb-text:#2f2430; --wb-sub:#8a6470; --wb-border:#e8b9c5; --wb-accent:#c65b7c; --wb-accent2:#3a8f91; --wb-board:#fff2e6; --wb-input:#fff9fb; --wb-glow:rgba(198,91,124,.26); --wb-gold:#c99738; --wb-screen:#fff9f2; }
      #${POPUP_ID}.wb-night { --wb-bg:#11121d; --wb-panel:#191a28; --wb-soft:#252033; --wb-text:#f5eafa; --wb-sub:#bba8c7; --wb-border:#54425f; --wb-accent:#ff7aa8; --wb-accent2:#6ed6d1; --wb-board:#111827; --wb-input:#151620; --wb-glow:rgba(255,122,168,.28); --wb-gold:#f3c56a; --wb-screen:#111827; }
      .wb-head { flex-shrink:0; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px 12px; border-bottom:1px solid var(--wb-border); background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.02)); }
      .wb-title { font-size:20px; font-weight:800; letter-spacing:2px; color:var(--wb-accent); white-space:nowrap; }
      .wb-title::after { content:''; display:block; width:64px; height:1px; background:var(--wb-accent); margin-top:3px; opacity:.75; }
      .wb-tabs { display:flex; gap:0; flex-wrap:wrap; border:1px solid var(--wb-border); background:var(--wb-soft); }
      .wb-tab, .wb-btn, .wb-iconbtn { border:1px solid var(--wb-border); background:var(--wb-panel); color:var(--wb-text); border-radius:0; min-height:34px; padding:7px 12px; cursor:pointer; font-weight:700; font-family:inherit; letter-spacing:1px; }
      .wb-tabs .wb-tab { border:0; border-right:1px solid var(--wb-border); min-width:94px; }
      .wb-tabs .wb-tab:last-child { border-right:0; }
      .wb-iconbtn { width:34px; padding:0; display:grid; place-items:center; font-size:18px; }
      .wb-tab.active, .wb-btn.primary { background:var(--wb-accent); color:#fff; border-color:var(--wb-accent); }
      .wb-body { flex:1 1 auto; min-height:0; display:block; padding:14px; overflow-y:auto; -webkit-overflow-scrolling:touch; }
      .wb-body.wb-settings-mode { overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; max-height:calc(100dvh - 118px); min-height:0; padding-bottom:24px; }
      .wb-body.wb-game-mode { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; overflow:hidden; -webkit-overflow-scrolling:touch; height:auto; }
      #${POPUP_ID}.wb-playing { bottom:28px; }
      @media (min-width: 769px) {
        .wb-body.wb-game-mode { overflow:hidden; padding:8px 10px 10px; }
        .wb-body.wb-game-mode .wb-layout { flex:1 1 auto; height:auto; min-height:0; }
        .wb-body.wb-game-mode > .wb-layout > .wb-panel:first-child { overflow:hidden; }
        .wb-body.wb-game-mode .wb-board-wrap { min-height:0; height:auto; }
      }
      .wb-cardgrid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; align-content:start; }
      .wb-game-card { background:var(--wb-panel); border:1px solid var(--wb-border); border-left:3px solid var(--wb-accent); border-radius:0; padding:14px; cursor:pointer; min-height:92px; display:flex; align-items:center; gap:12px; transition:.16s transform,.16s box-shadow,.16s border-color; }
      .wb-game-card:hover { transform:translateY(-2px); border-color:var(--wb-accent); box-shadow:0 12px 28px rgba(0,0,0,.16); }
      .wb-game-icon { flex:0 0 auto; width:60px; height:60px; display:grid; place-items:center; border-radius:0; background:var(--wb-soft); color:var(--wb-accent); border:1px solid var(--wb-border); font-weight:900; overflow:hidden; }
      .wb-game-icon img { width:100%; height:100%; object-fit:cover; display:block; }
      .wb-game-icon.has-image { padding:0; background:var(--wb-soft); color:transparent; }
      .wb-game-icon.has-image span { display:none; }
      .wb-game-info { min-width:0; display:grid; gap:5px; align-content:center; }
      .wb-game-name { font-size:18px; font-weight:800; letter-spacing:1px; }
      .wb-muted { color:var(--wb-sub); font-size:13px; }
      .wb-word-meta { color:var(--wb-sub); font-size:13px; line-height:1.35; display:block; }
      .wb-layout { flex:1 1 auto; min-height:0; height:auto; display:grid; grid-template-columns:minmax(0, 1fr) minmax(250px, 300px); grid-template-rows:minmax(0, 1fr); gap:12px; align-items:stretch; }
      .wb-layout.no-companion { grid-template-columns:minmax(0, 1fr); }
      .wb-panel { background:var(--wb-panel); border:1px solid var(--wb-border); border-radius:0; padding:12px; min-height:0; }
      .wb-body.wb-game-mode > .wb-layout > .wb-panel:first-child { display:flex; flex-direction:column; overflow:hidden; }
      .wb-body.wb-game-mode > .wb-layout > .wb-panel:last-child { overflow:hidden; display:flex; flex-direction:column; }
      .wb-toolbar { flex-shrink:0; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
      .wb-stat { display:flex; gap:6px; flex-wrap:wrap; }
      .wb-pill { background:var(--wb-soft); border:1px solid var(--wb-border); border-radius:0; padding:5px 9px; font-size:12px; font-weight:700; }
      .wb-board-wrap { position:relative; flex:1 1 auto; min-height:0; width:100%; display:grid; place-items:center; background:var(--wb-board); border:1px solid var(--wb-border); border-radius:0; padding:8px; touch-action:none; overflow:hidden; container-type:size; }
      .wb-pause-overlay { position:absolute; inset:8px; z-index:6; display:grid; place-items:center; background:rgba(0,0,0,.42); color:#fff; font-size:clamp(34px, 9vh, 84px); font-weight:900; letter-spacing:0; pointer-events:none; text-shadow:0 3px 18px rgba(0,0,0,.45); }
      .wb-pause-overlay span { padding:8px 18px; border:2px solid rgba(255,255,255,.55); background:rgba(0,0,0,.18); }
      .wb-canvas { display:block; max-width:min(100%, 100cqw); max-height:min(100%, 100cqh); width:auto; height:auto; object-fit:contain; background:#151515; border-radius:0; box-shadow:inset 0 0 0 1px rgba(255,255,255,.08); }
      .wb-snake-shell { width:100%; height:100%; min-width:0; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; gap:8px; }
      .wb-snake-controls { display:none; grid-template-columns:repeat(3, 42px); grid-template-rows:repeat(3, 34px); gap:5px; justify-content:center; flex:0 0 auto; }
      .wb-snake-controls .wb-btn { min-width:42px; min-height:34px; padding:4px; font-size:14px; line-height:1; }
      .wb-snake-controls .up { grid-column:2; grid-row:1; }
      .wb-snake-controls .left { grid-column:1; grid-row:2; }
      .wb-snake-controls .down { grid-column:2; grid-row:2; }
      .wb-snake-controls .right { grid-column:3; grid-row:2; }
      .wb-canvas.wb-tetris-canvas { aspect-ratio:1 / 2; max-height:min(100%, 100cqh); }
      .wb-jump-canvas { aspect-ratio:13 / 16; max-height:min(100%, 100cqh); background:#e9f8ff; touch-action:none; }
      #${POPUP_ID}.wb-night .wb-jump-canvas { background:#000; }
      .wb-tetris-shell { width:100%; height:100%; min-width:0; min-height:0; display:flex; align-items:center; justify-content:center; gap:8px; }
      .wb-tetris-controls { display:none; flex:0 0 auto; gap:6px; }
      .wb-tetris-controls .wb-btn { writing-mode:vertical-rl; min-width:34px; min-height:74px; padding:8px 5px; letter-spacing:1px; }
      .wb-grid2048 { width:min(350px, 100%, 82cqh); max-height:82cqh; aspect-ratio:1; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); grid-template-rows:repeat(4,minmax(0,1fr)); gap:8px; background:#b8a89f; padding:8px; border-radius:0; contain:layout size; }
      .wb-tile { display:grid; place-items:center; border-radius:0; background:#cdc0b6; font-weight:900; font-size:clamp(16px, 3.2vh, 26px); color:#4f4039; min-width:0; min-height:0; aspect-ratio:1; overflow:hidden; line-height:1; }
      .wb-board3 { width:min(330px, 100%, 100cqh); aspect-ratio:1; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); grid-template-rows:repeat(3,minmax(0,1fr)); gap:8px; contain:layout size; }
      .wb-cell { border:1px solid var(--wb-border); border-radius:0; background:var(--wb-panel); color:var(--wb-text); font-size:clamp(30px, 6vh, 48px); font-weight:900; cursor:pointer; min-width:0; min-height:0; aspect-ratio:1; line-height:1; overflow:hidden; }
      .wb-gomoku { width:min(500px, 100%, 100cqh); aspect-ratio:1; display:grid; grid-template-columns:repeat(15,minmax(0,1fr)); grid-template-rows:repeat(15,minmax(0,1fr)); gap:2px; background:#ba9362; padding:7px; border-radius:0; contain:layout size; }
      .wb-territory-panel { width:100%; height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0, 1fr); gap:10px; place-items:center; }
      .wb-territory-info { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; align-items:center; }
      .wb-territory-board { width:min(520px, 100%, 100cqh); max-height:100%; aspect-ratio:1; display:grid; grid-template-columns:repeat(11,minmax(0,1fr)); grid-template-rows:repeat(11,minmax(0,1fr)); gap:0; padding:8px; background:#f5f7fb; border:1px solid var(--wb-border); contain:layout size; }
      .wb-territory-dot { width:9px; height:9px; place-self:center; background:#384152; border:1px solid rgba(0,0,0,.2); }
      .wb-territory-edge { appearance:none; border:0; background:transparent; cursor:pointer; padding:0; min-width:0; min-height:0; }
      .wb-territory-edge:hover:not(:disabled) { background:rgba(58,143,145,.24); }
      .wb-territory-edge.legal { background:rgba(58,143,145,.2); box-shadow:0 0 0 2px rgba(58,143,145,.28); }
      .wb-territory-edge.legal:hover { background:rgba(58,143,145,.42); box-shadow:0 0 0 2px rgba(58,143,145,.48); }
      .wb-territory-edge.h { height:9px; align-self:center; width:100%; }
      .wb-territory-edge.v { width:9px; justify-self:center; height:100%; }
      .wb-territory-edge.claimed { cursor:default; background:#4b5563; }
      .wb-territory-edge.user { background:#3a8f91; }
      .wb-territory-edge.ta { background:#d86f45; }
      .wb-territory-cell { margin:3px; display:grid; place-items:center; font-size:11px; font-weight:900; color:rgba(255,255,255,.92); background:rgba(148,163,184,.14); border:1px solid rgba(148,163,184,.16); }
      .wb-territory-cell.user { background:rgba(58,143,145,.78); }
      .wb-territory-cell.ta { background:rgba(216,111,69,.78); }
      #${POPUP_ID}.wb-night .wb-territory-board { background:#000; }
      #${POPUP_ID}.wb-night .wb-territory-dot { background:#d1d5db; }
      #${POPUP_ID}.wb-night .wb-territory-cell { background:rgba(255,255,255,.08); }
      #${POPUP_ID}.wb-night .wb-territory-cell.user { background:rgba(58,143,145,.72); }
      #${POPUP_ID}.wb-night .wb-territory-cell.ta { background:rgba(216,111,69,.72); }
      .wb-oldmaid { width:100%; height:100%; min-height:0; display:grid; grid-template-rows:auto auto minmax(0, 1fr) minmax(0, 1fr) auto; gap:8px; align-items:stretch; }
      .wb-oldmaid-status { text-align:center; font-weight:800; color:var(--wb-text); }
      .wb-oldmaid-reveal { min-height:0; display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap; }
      .wb-oldmaid-reveal:empty { display:none; }
      .wb-oldmaid-reveal-text { color:var(--wb-sub); font-size:12px; font-weight:800; }
      .wb-oldmaid-zone { min-height:0; display:grid; grid-template-rows:auto minmax(0, 1fr); gap:6px; }
      .wb-oldmaid-hand { min-height:0; display:flex; flex-wrap:wrap; gap:8px; align-content:center; justify-content:center; overflow:auto; padding:6px; border:1px solid var(--wb-border); background:var(--wb-soft); }
      .wb-oldmaid-card { width:42px; height:58px; display:grid; place-items:center; border:1px solid var(--wb-border); border-radius:0; background:#fff; color:#111827; font-weight:900; font-size:17px; box-shadow:0 2px 8px rgba(15,23,42,.12); }
      .wb-oldmaid-card.big { width:54px; height:74px; font-size:22px; box-shadow:0 8px 20px rgba(15,23,42,.22); }
      .wb-oldmaid-card.back { cursor:pointer; color:#fff; background:linear-gradient(135deg, #3a8f91, #235f61); }
      .wb-oldmaid-card.back:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 5px 14px rgba(15,23,42,.22); }
      .wb-oldmaid-card.back:disabled { opacity:.55; cursor:default; }
      .wb-oldmaid-card.joker { color:#fff; background:#1f2937; border-color:#111827; }
      .wb-oldmaid-log { min-height:34px; max-height:64px; overflow:auto; padding:7px 9px; border:1px solid var(--wb-border); color:var(--wb-muted); background:var(--wb-panel); font-size:12px; line-height:1.45; }
      .wb-text-segments { white-space:normal; line-height:1.75; }
      .wb-text-seg { margin:0 0 12px; }
      .wb-text-seg:last-child { margin-bottom:0; }
      .wb-watermelon-canvas { aspect-ratio:4 / 5; max-height:min(100%, 100cqh); background:#f7efe3; }
      .wb-ludo { width:min(500px, 100%, 100cqh); aspect-ratio:1; display:grid; grid-template-columns:repeat(11,minmax(0,1fr)); grid-template-rows:repeat(11,minmax(0,1fr)); gap:2px; background:var(--wb-soft); padding:7px; border:1px solid var(--wb-border); contain:layout size; }
      .wb-ludo-cell { position:relative; border:1px solid rgba(0,0,0,.12); background:var(--wb-panel); min-width:0; min-height:0; display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:1px; font-size:10px; overflow:hidden; }
      .wb-ludo-cell.path { background:#fff8e8; }
      .wb-ludo-cell.home-red { background:#ffe1dc; }
      .wb-ludo-cell.home-blue { background:#dff0ff; }
      .wb-ludo-piece { width:46%; height:46%; min-width:14px; min-height:14px; border-radius:50%; border:1px solid rgba(0,0,0,.28); display:grid; place-items:center; color:#fff; font-size:10px; font-weight:900; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,.22); flex:0 0 46%; }
      .wb-ludo-piece.red { background:#d84b42; }
      .wb-ludo-piece.blue { background:#2773c8; }
      .wb-ludo-piece.can { outline:2px solid var(--wb-accent); outline-offset:2px; }
      .wb-ludo-info { display:flex; gap:6px; align-items:center; justify-content:center; flex-wrap:wrap; margin-bottom:8px; }
      .wb-gcell { border:0; border-radius:50%; background:#d7b37c; cursor:pointer; min-width:0; min-height:0; aspect-ratio:1; overflow:hidden; }
      .wb-gcell.black { background:#222; box-shadow:inset 0 0 0 2px #000; }
      .wb-gcell.white { background:#f7f2e9; box-shadow:inset 0 0 0 2px #ddd; }
      .wb-memory { width:min(360px, 100%, 78cqh); max-height:78cqh; aspect-ratio:1; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); grid-template-rows:repeat(4,minmax(0,1fr)); gap:8px; contain:layout size; }
      .wb-memory-card { position:relative; border:0; background:transparent; color:var(--wb-accent); font-size:clamp(22px,5vh,36px); font-weight:900; display:block; cursor:pointer; min-width:0; min-height:0; aspect-ratio:1; padding:0; overflow:visible; perspective:800px; transition:.16s transform,.16s opacity; }
      .wb-memory-card.open .wb-memory-inner { transform:rotateY(180deg); }
      .wb-memory-card.done { opacity:0; pointer-events:none; transform:scale(.86); }
      .wb-memory-inner { position:absolute; inset:0; transform-style:preserve-3d; transition:transform .42s cubic-bezier(.2,.75,.2,1); }
      .wb-memory-face { position:absolute; inset:0; display:grid; place-items:center; overflow:hidden; border:1px solid var(--wb-border); backface-visibility:hidden; box-shadow:0 4px 10px rgba(0,0,0,.12); }
      .wb-memory-back { background:linear-gradient(145deg,var(--wb-soft),var(--wb-panel)); }
      .wb-memory-back::after { content:'?'; color:var(--wb-accent); font-size:clamp(24px,5vh,38px); font-weight:900; }
      .wb-memory-front { background:var(--wb-panel); transform:rotateY(180deg); box-shadow:inset 0 0 0 2px var(--wb-accent2), 0 4px 10px rgba(0,0,0,.12); }
      .wb-memory-img { width:100%; height:100%; object-fit:contain; display:block; background:#000; }
      .wb-guess-panel { width:min(560px,100%); display:grid; gap:10px; align-content:start; }
      .wb-guess-title { font-size:18px; font-weight:900; color:var(--wb-accent); }
      .wb-guess-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
      .wb-guess-history { max-height:min(260px, calc(100dvh - 360px)); overflow-y:auto; display:grid; gap:6px; padding:8px; background:var(--wb-soft); border:1px solid var(--wb-border); }
      .wb-guess-item { background:var(--wb-panel); border:1px solid var(--wb-border); padding:7px 9px; font-size:13px; }
      .wb-clue-box { white-space:pre-wrap; min-height:72px; max-height:min(260px, calc(100dvh - 360px)); overflow-y:auto; }
      .wb-companion { display:none; flex-shrink:0; margin-top:10px; background:var(--wb-panel); border:1px solid var(--wb-border); border-left:3px solid var(--wb-accent2); border-radius:0; padding:10px; max-height:92px; overflow:hidden; }
      .wb-companion.on { display:block; }
      .wb-side-companion { gap:10px; }
      .wb-side-companion .wb-companion { margin-top:0; margin-bottom:10px; max-height:none; }
      .wb-side-companion .wb-speech { max-height:120px; overflow-y:auto; }
      .wb-comp-row { display:flex; gap:10px; align-items:flex-start; min-height:0; }
      .wb-avatar { width:46px; height:46px; border-radius:0; object-fit:cover; background:var(--wb-soft); border:1px solid var(--wb-border); display:grid; place-items:center; font-weight:900; overflow:hidden; flex:0 0 auto; }
      .wb-comp-main { flex:1; min-width:0; display:grid; gap:4px; }
      .wb-comp-name { color:var(--wb-accent); font-weight:800; font-size:12px; line-height:1.1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .wb-speech { min-height:32px; max-height:50px; overflow:hidden; padding:7px 10px; border-radius:0; background:var(--wb-soft); line-height:1.45; font-size:13px; }
      .wb-form { display:grid; gap:10px; align-content:start; min-height:0; }
      .wb-body.wb-game-mode .wb-form { gap:8px; }
      .wb-field { display:grid; gap:6px; }
      .wb-field label { font-size:12px; color:var(--wb-sub); font-weight:700; letter-spacing:1px; }
      .wb-input, .wb-textarea, .wb-select { width:100%; background:var(--wb-input); color:var(--wb-text); border:1px solid var(--wb-border); border-radius:0; padding:8px 10px; outline:none; font-family:inherit; }
      .wb-textarea { min-height:76px; resize:vertical; }
      .wb-switch { display:flex; align-items:center; gap:8px; font-weight:800; }
      .wb-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
      .wb-line-tools { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
      .wb-line-tools .wb-select, .wb-line-tools .wb-input { width:auto; min-width:126px; max-width:180px; min-height:34px; padding:7px 9px; }
      .wb-start-cover { display:grid; place-items:center; text-align:center; gap:10px; width:100%; height:100%; min-height:240px; color:var(--wb-sub); }
      .wb-start-cover .wb-btn { min-width:160px; }
      .wb-settings-grid { display:grid; grid-template-columns:minmax(0, 820px); justify-content:center; gap:12px; align-items:start; padding-bottom:12px; }
      .wb-settings-left, .wb-settings-right { display:contents; }
      .wb-settings-grid .wb-panel { display:grid; gap:10px; align-content:start; min-height:auto; }
      .wb-preset-row, .wb-preset-save-row { display:flex; gap:6px; align-items:center; }
      .wb-preset-row select, .wb-preset-save-row input { flex:1; min-width:0; }
      .wb-api-status { background:var(--wb-soft); border:1px solid var(--wb-border); padding:8px 10px; color:var(--wb-sub); font-size:12px; line-height:1.6; }
      .wb-char-desc-preview { max-height:88px; overflow-y:auto; padding:7px 9px; line-height:1.45; white-space:pre-wrap; scrollbar-width:thin; }
      .wb-worldbook-list { display:flex; flex-wrap:wrap; gap:5px; max-height:118px; overflow-y:auto; padding:7px; background:var(--wb-soft); border:1px solid var(--wb-border); }
      .wb-tag { border:1px solid var(--wb-border); background:var(--wb-panel); color:var(--wb-text); padding:4px 8px; cursor:pointer; font-size:12px; }
      .wb-tag.active { background:var(--wb-accent); color:#fff; border-color:var(--wb-accent); }
      .wb-section-title { color:var(--wb-accent); font-weight:800; letter-spacing:2px; border-bottom:1px solid var(--wb-border); padding-bottom:6px; margin-bottom:2px; }
      .wb-modal-mask { position:fixed; top:0; left:0; right:0; bottom:0; width:100%; height:100%; z-index:1000000; background:rgba(0,0,0,.88); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; animation:wbFadeIn .25s ease; --wb-bg:#fff7fb; --wb-panel:#fffefd; --wb-soft:#ffeaf1; --wb-text:#2f2430; --wb-sub:#8a6470; --wb-border:#e8b9c5; --wb-accent:#c65b7c; --wb-accent2:#3a8f91; --wb-board:#fff2e6; --wb-input:#fff9fb; --wb-glow:rgba(198,91,124,.26); --wb-gold:#c99738; --wb-screen:#fff9f2; }
      .wb-modal-mask.wb-night { --wb-bg:#11121d; --wb-panel:#191a28; --wb-soft:#252033; --wb-text:#f5eafa; --wb-sub:#bba8c7; --wb-border:#54425f; --wb-accent:#ff7aa8; --wb-accent2:#6ed6d1; --wb-board:#111827; --wb-input:#151620; --wb-glow:rgba(255,122,168,.28); --wb-gold:#f3c56a; --wb-screen:#111827; }
      @keyframes wbFadeIn{from{opacity:0}to{opacity:1}}
      .wb-modal { background:linear-gradient(180deg, var(--wb-panel), var(--wb-bg)); color:var(--wb-text); border:1px solid var(--wb-border); border-top:3px solid var(--wb-accent); width:100%; max-width:560px; max-height:85vh; overflow-y:auto; animation:wbSlideUp .3s cubic-bezier(.34,1.56,.64,1); box-shadow:0 20px 60px rgba(0,0,0,.5),0 0 40px var(--wb-glow); padding:18px 22px; border-radius:0; }
      @keyframes wbSlideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
      .wb-modal-title { font-size:17px; font-weight:700; color:var(--wb-accent); letter-spacing:2px; padding:0 0 12px; margin:0 0 14px; border-bottom:1px solid var(--wb-border); }
      .wb-countdown { display:grid; place-items:center; gap:8px; padding:16px 0 18px; }
      .wb-countdown-num { width:72px; height:72px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(145deg, var(--wb-accent), var(--wb-accent2)); color:#fff; font-size:34px; font-weight:900; box-shadow:0 14px 34px var(--wb-glow); }

      /* 高级掌机风格美化层 */
      #${POPUP_ID} {
        border-radius:8px;
        border:1px solid color-mix(in srgb, var(--wb-border) 78%, #fff 22%);
        border-top:1px solid color-mix(in srgb, var(--wb-gold) 76%, #fff 24%);
        background:
          linear-gradient(145deg, color-mix(in srgb, var(--wb-bg) 92%, #fff 8%), color-mix(in srgb, var(--wb-panel) 80%, var(--wb-soft) 20%)),
          var(--wb-bg);
        box-shadow:0 28px 80px rgba(20,12,24,.42), 0 0 0 1px rgba(255,255,255,.22) inset, 0 0 44px var(--wb-glow);
      }
      #${POPUP_ID}.wb-night {
        background:
          linear-gradient(145deg, #10111c 0%, #191626 46%, #101824 100%),
          var(--wb-bg);
        box-shadow:0 30px 90px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.08) inset, 0 0 48px rgba(255,122,168,.18);
      }
      #${POPUP_ID}::before { background:rgba(20,10,18,.42); backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
      #${POPUP_ID}.wb-night::before { background:rgba(2,4,12,.62); }
      .wb-head {
        min-height:46px;
        display:grid;
        grid-template-columns:auto minmax(280px, 1fr) auto;
        align-items:center;
        gap:10px;
        padding:6px 10px;
        border-bottom:1px solid color-mix(in srgb, var(--wb-border) 70%, transparent 30%);
        background:
          linear-gradient(180deg, rgba(255,255,255,.54), rgba(255,255,255,.18)),
          var(--wb-panel);
      }
      #${POPUP_ID}.wb-night .wb-head {
        background:
          linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.025)),
          var(--wb-panel);
      }
      .wb-title {
        display:flex;
        align-items:center;
        gap:7px;
        color:var(--wb-text);
        font-size:17px;
        letter-spacing:1px;
        text-shadow:none;
      }
      .wb-title::before {
        content:'';
        width:22px;
        height:22px;
        display:grid;
        place-items:center;
        border-radius:7px;
        background:url('${APP_ICON_URL}') center / cover no-repeat, linear-gradient(135deg, var(--wb-accent), var(--wb-accent2));
        box-shadow:0 0 0 1px rgba(255,255,255,.35) inset;
        overflow:hidden;
      }
      .wb-title::after {
        display:none;
      }
      .wb-tabs {
        justify-self:center;
        flex-wrap:nowrap;
        padding:2px;
        gap:2px;
        border-radius:5px;
        border-color:color-mix(in srgb, var(--wb-border) 74%, transparent 26%);
        background:color-mix(in srgb, var(--wb-soft) 50%, var(--wb-panel) 50%);
        box-shadow:0 1px 0 rgba(255,255,255,.55) inset;
      }
      #${POPUP_ID}.wb-night .wb-tabs { box-shadow:0 1px 0 rgba(255,255,255,.08) inset; }
      .wb-tabs .wb-tab {
        border:0;
        border-radius:3px;
        min-width:96px;
        min-height:28px;
        padding:4px 10px;
        color:var(--wb-sub);
        background:transparent;
      }
      .wb-tabs .wb-tab.active {
        color:#fff;
        background:linear-gradient(135deg, var(--wb-accent), color-mix(in srgb, var(--wb-accent2) 72%, var(--wb-accent) 28%));
        box-shadow:0 6px 14px var(--wb-glow), 0 1px 0 rgba(255,255,255,.32) inset;
      }
      .wb-iconbtn, .wb-btn {
        border-radius:3px;
        border-color:color-mix(in srgb, var(--wb-border) 78%, transparent 22%);
        background:linear-gradient(180deg, color-mix(in srgb, var(--wb-panel) 92%, #fff 8%), color-mix(in srgb, var(--wb-soft) 72%, var(--wb-panel) 28%));
        box-shadow:0 1px 0 rgba(255,255,255,.55) inset, 0 8px 18px rgba(45,24,36,.10);
      }
      .wb-head .wb-iconbtn { width:30px; height:30px; min-height:30px; font-size:16px; }
      #${POPUP_ID}.wb-night .wb-iconbtn, #${POPUP_ID}.wb-night .wb-btn {
        background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
        box-shadow:0 1px 0 rgba(255,255,255,.08) inset, 0 10px 20px rgba(0,0,0,.24);
      }
      .wb-btn:hover, .wb-iconbtn:hover, .wb-tab:hover { transform:translateY(-1px); filter:brightness(1.04); }
      .wb-btn.primary {
        background:linear-gradient(135deg, var(--wb-accent), color-mix(in srgb, var(--wb-accent) 54%, var(--wb-accent2) 46%));
        border-color:color-mix(in srgb, var(--wb-accent) 76%, #fff 24%);
        color:#fff;
        box-shadow:0 12px 24px var(--wb-glow), 0 1px 0 rgba(255,255,255,.34) inset;
      }
      .wb-body {
        padding:16px;
        background:
          linear-gradient(180deg, rgba(255,255,255,.10), transparent 32%),
          linear-gradient(90deg, color-mix(in srgb, var(--wb-soft) 28%, transparent 72%), transparent 46%, color-mix(in srgb, var(--wb-accent2) 8%, transparent 92%));
      }
      .wb-cardgrid { gap:14px; }
      .wb-game-card {
        min-height:104px;
        padding:16px;
        align-items:center;
        gap:14px;
        border-radius:8px;
        border:1px solid color-mix(in srgb, var(--wb-border) 74%, #fff 26%);
        border-left:0;
        background:
          linear-gradient(145deg, rgba(255,255,255,.78), rgba(255,255,255,.24) 45%, color-mix(in srgb, var(--wb-soft) 70%, transparent 30%)),
          var(--wb-panel);
        box-shadow:0 14px 32px rgba(52,28,42,.13), 0 0 0 1px rgba(255,255,255,.34) inset;
        position:relative;
        overflow:hidden;
      }
      #${POPUP_ID}.wb-night .wb-game-card {
        background:linear-gradient(145deg, rgba(255,255,255,.09), rgba(255,255,255,.03) 46%, rgba(255,122,168,.07)), var(--wb-panel);
        border-color:rgba(255,255,255,.10);
        box-shadow:0 16px 34px rgba(0,0,0,.30), 0 0 0 1px rgba(255,255,255,.06) inset;
      }
      .wb-game-card::before {
        content:'';
        position:absolute;
        inset:0;
        border-top:2px solid color-mix(in srgb, var(--wb-gold) 68%, transparent 32%);
        pointer-events:none;
      }
      .wb-game-card:hover {
        transform:translateY(-4px);
        border-color:color-mix(in srgb, var(--wb-accent) 64%, var(--wb-border) 36%);
        box-shadow:0 20px 42px rgba(52,28,42,.20), 0 0 28px var(--wb-glow), 0 0 0 1px rgba(255,255,255,.36) inset;
      }
      .wb-game-icon {
        width:68px;
        height:68px;
        border-radius:8px;
        border-color:color-mix(in srgb, var(--wb-accent) 34%, var(--wb-border) 66%);
        color:#fff;
        background:linear-gradient(135deg, var(--wb-accent), var(--wb-accent2));
        box-shadow:0 12px 24px var(--wb-glow), 0 1px 0 rgba(255,255,255,.45) inset;
      }
      .wb-game-icon.has-image { color:transparent; background:var(--wb-soft); }
      .wb-game-icon.has-image img { border-radius:7px; }
      .wb-game-info { position:relative; z-index:1; }
      .wb-game-name { font-size:19px; color:var(--wb-text); }
      .wb-panel {
        border-radius:8px;
        border-color:color-mix(in srgb, var(--wb-border) 76%, transparent 24%);
        background:linear-gradient(180deg, color-mix(in srgb, var(--wb-panel) 94%, #fff 6%), color-mix(in srgb, var(--wb-panel) 76%, var(--wb-soft) 24%));
        box-shadow:0 12px 30px rgba(45,24,36,.10), 0 1px 0 rgba(255,255,255,.45) inset;
      }
      #${POPUP_ID}.wb-night .wb-panel {
        background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.025)), var(--wb-panel);
        box-shadow:0 14px 34px rgba(0,0,0,.28), 0 1px 0 rgba(255,255,255,.07) inset;
      }
      .wb-toolbar {
        padding:5px;
        border-radius:3px;
        margin-bottom:6px;
        background:color-mix(in srgb, var(--wb-soft) 52%, transparent 48%);
        border:1px solid color-mix(in srgb, var(--wb-border) 58%, transparent 42%);
      }
      .wb-toolbar .wb-btn { min-height:28px; padding:4px 9px; }
      .wb-toolbar .wb-select, .wb-toolbar .wb-input { min-height:28px; padding:4px 7px; }
      .wb-toolbar .wb-pill { padding:3px 7px; }
      .wb-pill {
        border-radius:999px;
        color:var(--wb-text);
        background:linear-gradient(180deg, color-mix(in srgb, var(--wb-panel) 86%, #fff 14%), color-mix(in srgb, var(--wb-soft) 78%, var(--wb-panel) 22%));
        box-shadow:0 1px 0 rgba(255,255,255,.42) inset;
      }
      .wb-board-wrap {
        border-radius:8px;
        padding:14px;
        border:1px solid color-mix(in srgb, var(--wb-border) 70%, var(--wb-gold) 30%);
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--wb-board) 82%, #fff 18%), color-mix(in srgb, var(--wb-soft) 72%, var(--wb-board) 28%));
        box-shadow:0 18px 38px rgba(51,28,41,.13) inset, 0 12px 28px rgba(51,28,41,.12);
      }
      #${POPUP_ID}.wb-night .wb-board-wrap {
        background:linear-gradient(135deg, #0c111d, #181627 55%, #101b24);
        box-shadow:0 18px 38px rgba(0,0,0,.34) inset, 0 0 24px rgba(110,214,209,.08);
      }
      .wb-canvas, .wb-grid2048, .wb-board3, .wb-gomoku, .wb-ludo {
        border-radius:8px;
        box-shadow:0 0 0 1px rgba(255,255,255,.16), 0 12px 28px rgba(0,0,0,.20);
      }
      .wb-canvas,
      .wb-canvas.wb-tetris-canvas,
      .wb-canvas.wb-watermelon-canvas,
      #wb-canvas.wb-canvas {
        border-radius:0;
      }
      .wb-grid2048 { background:linear-gradient(135deg, #d8b59f, #bfa1c9); }
      .wb-tile { border-radius:6px; box-shadow:0 2px 7px rgba(59,35,42,.18), 0 1px 0 rgba(255,255,255,.45) inset; }
      .wb-cell { border-radius:8px; background:linear-gradient(180deg, var(--wb-panel), var(--wb-soft)); box-shadow:0 1px 0 rgba(255,255,255,.34) inset; }
      .wb-cell:hover, .wb-gcell:hover, .wb-ludo-piece:hover { filter:brightness(1.08); transform:translateY(-1px); }
      .wb-gomoku { background:linear-gradient(135deg, #d7b06e, #b98b5e); }
      .wb-gcell { box-shadow:0 1px 1px rgba(255,255,255,.28) inset; }
      .wb-ludo { border-radius:8px; background:linear-gradient(135deg, color-mix(in srgb, var(--wb-soft) 80%, #fff 20%), color-mix(in srgb, var(--wb-accent2) 18%, var(--wb-soft) 82%)); }
      #${POPUP_ID}.wb-night .wb-ludo { background:linear-gradient(135deg, #151525, #172533); }
      .wb-ludo-cell { border-radius:4px; }
      .wb-ludo-piece { transition:.14s transform,.14s filter; }
      .wb-ludo-piece.can { outline-color:var(--wb-gold); box-shadow:0 0 14px var(--wb-glow), 0 2px 6px rgba(0,0,0,.26); }
      .wb-companion.on {
        border-radius:8px;
        border-left:0;
        border-top:1px solid color-mix(in srgb, var(--wb-accent2) 70%, #fff 30%);
        background:linear-gradient(135deg, color-mix(in srgb, var(--wb-panel) 80%, #fff 20%), color-mix(in srgb, var(--wb-soft) 74%, var(--wb-accent2) 26%));
        box-shadow:0 12px 24px rgba(37,28,43,.12), 0 1px 0 rgba(255,255,255,.40) inset;
      }
      #${POPUP_ID}.wb-night .wb-companion.on { background:linear-gradient(135deg, rgba(255,255,255,.07), rgba(110,214,209,.08)); }
      .wb-avatar { border-radius:8px; border-color:color-mix(in srgb, var(--wb-accent2) 45%, var(--wb-border) 55%); box-shadow:0 6px 14px rgba(0,0,0,.16); }
      .wb-speech { border-radius:8px; background:color-mix(in srgb, var(--wb-soft) 78%, var(--wb-panel) 22%); }
      .wb-input, .wb-textarea, .wb-select {
        border-radius:7px;
        background:linear-gradient(180deg, var(--wb-input), color-mix(in srgb, var(--wb-input) 78%, var(--wb-soft) 22%));
        box-shadow:0 1px 0 rgba(255,255,255,.35) inset;
      }
      .wb-worldbook-list, .wb-api-status { border-radius:8px; }
      .wb-summary-modal { width:min(620px, 100%); max-height:calc(100dvh - 48px); overflow-y:auto; }
      .wb-summary-list { display:grid; gap:8px; max-height:420px; overflow-y:auto; padding-right:2px; }
      .wb-record-table-wrap { max-height:min(520px, calc(100dvh - 210px)); overflow:auto; border:1px solid var(--wb-border); }
      .wb-record-table { width:100%; border-collapse:collapse; font-size:12px; table-layout:fixed; }
      .wb-record-table th, .wb-record-table td { border-bottom:1px solid var(--wb-border); padding:7px 8px; text-align:left; vertical-align:top; overflow:hidden; text-overflow:ellipsis; }
      .wb-record-table th { position:sticky; top:0; background:var(--wb-soft); z-index:1; color:var(--wb-accent); }
      .wb-record-table.wb-no-score .wb-rec-score-col { display:none; }
      .wb-record-table .wb-actions { gap:4px; }
      .wb-summary-item { display:flex; align-items:center; gap:10px; padding:10px; border:1px solid var(--wb-border); border-radius:8px; background:var(--wb-panel); }
      .wb-tag { border-radius:999px; background:linear-gradient(180deg, var(--wb-panel), var(--wb-soft)); }
      .wb-tag.active { background:linear-gradient(135deg, var(--wb-accent), var(--wb-accent2)); box-shadow:0 8px 18px var(--wb-glow); }
      .wb-section-title {
        color:var(--wb-text);
        border-bottom:1px solid color-mix(in srgb, var(--wb-border) 60%, transparent 40%);
        text-shadow:0 0 18px var(--wb-glow);
      }
      .wb-section-title::before { content:'◇ '; color:var(--wb-accent); }
      .wb-modal {
        border-radius:8px;
        background:linear-gradient(180deg, var(--wb-panel), var(--wb-bg));
        box-shadow:0 24px 70px rgba(0,0,0,.42), 0 0 0 1px rgba(255,255,255,.16) inset;
      }
      .wb-modal-title { color:var(--wb-text); text-shadow:0 0 18px var(--wb-glow); }
      .wb-start-cover {
        border-radius:8px;
        background:linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.04));
      }
      @media (max-width: 768px) {
        #${SHELL_ID}.wb-shell-visible { display:block!important; position:fixed!important; top:0!important; left:0!important; right:0!important; bottom:0!important; width:100%!important; height:100vh; height:100dvh; overflow-y:auto; padding:0!important; box-sizing:border-box; background:rgba(0,0,0,.45); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); -webkit-overflow-scrolling:touch; }
        #${POPUP_ID} { position:relative!important; top:auto!important; left:auto!important; right:auto!important; bottom:auto!important; transform:none!important; min-width:unset!important; max-width:100%!important; width:100%!important; min-height:100vh; min-height:100dvh; height:auto!important; max-height:none!important; margin:0!important; display:flex!important; flex-direction:column!important; overflow:visible!important; border-radius:0!important; border-left:0!important; border-right:0!important; }
        .wb-head { flex-shrink:0; display:grid; grid-template-columns:1fr auto; align-items:center; padding:4px 7px; gap:4px; min-height:0; }
        .wb-title { font-size:15px; grid-column:1; grid-row:1; letter-spacing:1px; }
        .wb-title::after { width:44px; margin-top:1px; }
        .wb-iconbtn { grid-column:2; grid-row:1; justify-self:end; width:24px; min-height:24px; height:24px; font-size:13px; padding:0; }
        .wb-tabs { width:100%; display:grid; grid-template-columns:repeat(3,1fr); grid-column:1 / 3; grid-row:2; }
        .wb-tabs .wb-tab { min-width:0; min-height:26px; padding:3px 4px; font-size:12px; }
        .wb-body { flex:1 1 0!important; min-height:0!important; padding:6px; gap:6px; overflow-y:auto!important; -webkit-overflow-scrolling:touch; }
        .wb-body.wb-settings-mode { max-height:none; padding-bottom:32px; }
        .wb-cardgrid { grid-template-columns:1fr; }
        #${POPUP_ID}.wb-playing { min-height:100vh; min-height:100dvh; height:100vh!important; height:100dvh!important; overflow:hidden!important; }
        #${POPUP_ID}.wb-playing .wb-head { grid-template-columns:1fr auto; grid-template-rows:auto; padding:2px 6px; }
        #${POPUP_ID}.wb-playing .wb-title { font-size:13px; }
        #${POPUP_ID}.wb-playing .wb-title::after { display:none; }
        #${POPUP_ID}.wb-playing .wb-tabs { display:none; }
        .wb-body.wb-game-mode { flex:1 1 auto!important; min-height:0!important; display:flex; flex-direction:column; overflow:hidden!important; padding:3px 5px 5px; height:auto; }
        .wb-layout { flex:1 1 auto; height:100%; min-height:0; grid-template-columns:1fr; grid-template-rows:minmax(0,1fr) auto; gap:4px; overflow:hidden; }
        .wb-layout.no-companion { grid-template-rows:minmax(0,1fr); }
        .wb-body.wb-game-mode > .wb-layout > .wb-panel:first-child { min-height:0; height:auto; padding:4px; display:flex; flex-direction:column; overflow:hidden; }
        .wb-body.wb-game-mode > .wb-layout > .wb-panel:last-child { max-height:72px; min-height:0; padding:4px 5px; overflow:hidden; }
        .wb-board-wrap { flex:1 1 0; height:auto; min-height:0; padding:4px; overflow:hidden; }
        .wb-toolbar { flex-shrink:0; display:grid; grid-template-columns:auto minmax(0,1fr); grid-template-rows:auto auto; gap:3px 5px; margin-bottom:3px; align-items:center; padding:3px; border:1px solid color-mix(in srgb, var(--wb-border) 70%, transparent 30%); border-radius:2px; background:color-mix(in srgb, var(--wb-soft) 72%, var(--wb-panel) 28%); }
        .wb-stat { grid-column:2; grid-row:1; min-width:0; gap:6px; flex-wrap:nowrap; overflow:hidden; align-items:center; }
        .wb-stat .wb-pill { border:0; background:transparent; box-shadow:none; padding:0; font-size:12px; line-height:1.2; }
        .wb-stat .wb-pill:first-child { font-size:13px; font-weight:900; color:var(--wb-text); max-width:45%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .wb-stat #wb-high { display:none; }
        .wb-toolbar > .wb-actions { grid-column:1 / 3; grid-row:2; width:100%; min-width:0; display:flex; flex-wrap:nowrap; gap:4px; overflow-x:auto; padding-bottom:0; scrollbar-width:none; justify-content:flex-start; }
        .wb-toolbar > .wb-actions::-webkit-scrollbar { display:none; }
        .wb-line-tools { flex:1 1 auto; min-width:136px; display:flex; flex-wrap:nowrap; gap:4px; width:auto; }
        .wb-line-tools .wb-select { flex:1 1 auto; min-width:74px; max-width:140px; height:26px; font-size:11px; padding:2px 5px; }
        .wb-btn { min-height:25px; padding:3px 7px; font-size:11px; border-radius:3px; white-space:nowrap; background:linear-gradient(180deg, var(--wb-panel), color-mix(in srgb, var(--wb-soft) 70%, var(--wb-panel) 30%)); box-shadow:0 1px 0 rgba(255,255,255,.28) inset; }
        .wb-btn.primary { background:linear-gradient(135deg, var(--wb-accent), var(--wb-accent2)); box-shadow:0 6px 14px var(--wb-glow); }
        #wb-back { grid-column:1; grid-row:1; width:auto; min-width:40px; min-height:25px; padding:2px 7px; display:grid; place-items:center; font-size:12px; border-radius:2px; }
        #wb-generate-lines { min-width:44px; }
        #wb-prompt-preview { width:25px; min-width:25px; height:25px; min-height:25px; padding:0; border-radius:50%; display:grid; place-items:center; font-size:12px; }
        .wb-pill { padding:3px 5px; font-size:10px; }
        .wb-record-table-wrap { border:0; max-height:calc(100dvh - 150px); overflow-y:auto; }
        .wb-record-table, .wb-record-table tbody, .wb-record-table tr, .wb-record-table td { display:block; width:100%; }
        .wb-record-table thead { display:none; }
        .wb-record-table tr { margin-bottom:8px; padding:8px; border:1px solid var(--wb-border); border-radius:8px; background:var(--wb-panel); box-shadow:0 6px 14px rgba(0,0,0,.08); }
        .wb-record-table td { border:0; padding:3px 0; display:grid; grid-template-columns:58px minmax(0,1fr); gap:6px; white-space:normal; overflow:visible; text-overflow:clip; align-items:start; }
        .wb-record-table td::before { color:var(--wb-accent); font-weight:800; font-size:11px; }
        .wb-record-table td:nth-child(1)::before { content:'时间'; }
        .wb-record-table td:nth-child(2)::before { content:'用时'; }
        .wb-record-table td:nth-child(3)::before { content:'结果'; }
        .wb-record-table td:nth-child(4)::before { content:'分数'; }
        .wb-record-table td:nth-child(5)::before { content:'陪伴'; }
        .wb-record-table td:nth-child(6)::before { content:'日志'; }
        .wb-record-table td:nth-child(7)::before { content:'操作'; }
        .wb-record-table td.wb-rec-empty { display:none; }
        .wb-record-table .wb-actions { justify-content:flex-start; gap:6px; }
        .wb-grid2048, .wb-board3, .wb-memory { width:min(100%, 50dvh, 340px); }
        .wb-gomoku, .wb-ludo, .wb-territory-board { width:min(100%, 52dvh, 360px); }
        .wb-canvas { max-height:100%; max-width:100%; }
        .wb-snake-shell .wb-canvas { max-height:calc(100% - 78px); }
        .wb-snake-controls { display:grid; }
        .wb-canvas.wb-tetris-canvas { height:auto; width:auto; max-height:100%; max-width:100%; }
        .wb-tetris-controls { display:flex; flex-direction:column; }
        .wb-watermelon-canvas { max-height:100%; }
        .wb-gomoku { gap:1px; padding:4px; }
        .wb-guess-panel { max-height:100%; overflow:hidden; gap:6px; }
        .wb-guess-history { max-height:86px; padding:5px; }
        .wb-clue-box { min-height:44px; max-height:none; overflow:visible; }
        .wb-side-companion { align-self:stretch; box-sizing:border-box; }
        .wb-side-companion .wb-companion { margin-bottom:0; }
        .wb-companion { max-height:60px; min-height:0; height:58px; margin-top:0; margin-bottom:0; padding:5px 6px; box-sizing:border-box; overflow:hidden; }
        .wb-avatar { width:40px; height:40px; }
        .wb-comp-main { gap:2px; }
        .wb-comp-name { font-size:11px; }
        .wb-speech { min-height:0; max-height:42px; font-size:12px; padding:4px 7px; line-height:1.3; overflow:hidden; }
        .wb-body.wb-game-mode .wb-muted { display:none; }
        .wb-body.wb-game-mode .wb-word-meta { display:block!important; }
        .wb-body.wb-game-mode .wb-field { display:none; }
        .wb-body.wb-game-mode .wb-form { grid-template-columns:1fr 1fr; gap:5px; align-content:center; }
        .wb-settings-grid { grid-template-columns:1fr; }
        .wb-modal-mask { padding:20px; }
        .wb-modal { max-height:85vh; }
      }
    `;

    getHostDocument().head.appendChild(css);
  }

  function syncMobileShellViewport() {
    const doc = getHostDocument();
    const shell = qs('#' + SHELL_ID, doc);
    if (!shell) return;
    const win = getHostWindow();
    const vp = win.visualViewport || (typeof visualViewport !== 'undefined' ? visualViewport : null);
    const mobile = (win.innerWidth || 800) <= 768;
    if (!mobile) {
      shell.style.top = '';
      shell.style.height = '';
      shell.style.setProperty('--wb-vvh', '100vh');
      return;
    }
    const screenH = win.screen && win.screen.height ? win.screen.height : (win.innerHeight || doc.documentElement.clientHeight || 700);
    const h = vp && vp.height ? vp.height : (win.innerHeight || doc.documentElement.clientHeight || 700);
    if (vp && h >= 320 && h < screenH * 0.75) {
      shell.style.top = (vp.offsetTop || 0) + 'px';
      shell.style.height = h + 'px';
      shell.style.setProperty('--wb-vvh', h + 'px');
    } else {
      shell.style.top = '0';
      shell.style.height = '';
      shell.style.setProperty('--wb-vvh', '100dvh');
    }
  }
  function buildPopup() {
    injectStyle();
    const doc = getHostDocument();
    let shell = qs('#' + SHELL_ID, doc);
    if (!shell) {
      shell = doc.createElement('div');
      shell.id = SHELL_ID;
      doc.body.appendChild(shell);
      shell.addEventListener('click', e => { if (e.target === shell) closePopupShell(); });
      const win = getHostWindow();
      const vp = win.visualViewport || (typeof visualViewport !== 'undefined' ? visualViewport : null);
      if (vp && !shell.dataset.vpBound) { vp.addEventListener('resize', () => { syncMobileShellViewport(); scheduleFitGameSurface(); }); vp.addEventListener('scroll', () => { syncMobileShellViewport(); scheduleFitGameSurface(); }); shell.dataset.vpBound = '1'; }
      win.addEventListener('resize', scheduleFitGameSurface);
      win.addEventListener('orientationchange', () => { setTimeout(syncMobileShellViewport, 120); setTimeout(scheduleFitGameSurface, 160); });
    }
    let p = qs('#' + POPUP_ID, doc);
    if (!p) {
      p = doc.createElement('div');
      p.id = POPUP_ID;
      shell.appendChild(p);
    } else if (p.parentNode !== shell) {
      shell.appendChild(p);
    }
    shell.classList.add('wb-shell-visible');
    shell.style.display = ((getHostWindow().innerWidth || 800) <= 768) ? 'block' : 'flex';
    syncMobileShellViewport();
    p.style.display = 'flex';
    restoreWindowState();
    render();
  }
  function closePopupShell() {
    const doc = getHostDocument();
    const shell = qs('#' + SHELL_ID, doc);
    if (shell) { shell.classList.remove('wb-shell-visible'); shell.style.display = 'none'; }
    const p = qs('#' + POPUP_ID, doc);
    if (p) p.style.display = 'none';
  }
  function syncPopupModeClass() {
    const p = qs('#' + POPUP_ID);
    if (!p) return;
    const theme = settings().theme === 'night' ? 'wb-night' : 'wb-day';
    p.className = theme + (currentGame ? ' wb-playing' : '');
  }
  function render() {
    const cfg = settings(); const p = qs('#' + POPUP_ID); syncPopupModeClass();
    p.onwheel = (e) => { e.stopPropagation(); };
    p.ontouchmove = (e) => { e.stopPropagation(); };
    p.innerHTML = '<div class="wb-head"><div class="wb-title">玩伴小屋</div><div class="wb-tabs"><button class="wb-tab" data-tab="single">单人游戏</button><button class="wb-tab" data-tab="double">双人游戏</button><button class="wb-tab" data-tab="settings">设置</button></div><button class="wb-iconbtn" id="wb-close" title="关闭">×</button></div><div class="wb-body" id="wb-body"></div>';
    qsa('.wb-tab', p).forEach(b => { b.classList.toggle('active', b.dataset.tab === currentTab); b.onclick = () => { flushSettingsProgress(); stopGame(); currentGame = null; currentTab = b.dataset.tab; saveWindowState(currentTab, ''); render(); }; });
    qs('#wb-close', p).onclick = () => { flushSettingsProgress(); saveWindowState(currentTab, currentGame); stopGame(); closePopupShell(); };
    if (currentGame) renderGame(currentGame); else if (currentTab === 'settings') renderSettings(); else renderSelect(currentTab);
  }

  function renderSelect(mode) {
    syncPopupModeClass();
    const body = qs('#wb-body'); body.className = 'wb-body'; const ids = Object.values(GAME_META).filter(g => g.mode === mode).map(g => g.id);
    body.innerHTML = '<div class="wb-cardgrid">' + ids.map(id => { const g = GAME_META[id]; return '<div class="wb-game-card" data-game="' + id + '">' + gameIconHTML(g) + '<div class="wb-game-info"><div class="wb-game-name">' + esc(g.name) + '</div><div class="wb-muted">' + esc(cardScoreDisplay(id)) + '</div></div></div>'; }).join('') + '</div>';
    qsa('.wb-game-card', body).forEach(c => c.onclick = () => { currentGame = c.dataset.game; if (GAME_META[currentGame]) currentTab = GAME_META[currentGame].mode; saveWindowState(currentTab, currentGame); renderGame(currentGame); });
  }

  function renderSettings() {
    const cfg = settings();
    const body = qs('#wb-body');
    body.className = 'wb-body wb-settings-mode';
    const apis = apiPresets();
    const injPresets = worldPresets();
    const sums = summaries();
    const apiOptions = '<option value="">— 选择预设载入 —</option>' + apis.map((x,i) => '<option value="' + i + '">' + esc(x.name || ('预设' + (i + 1))) + '</option>').join('');
    const injOptions = '<option value="">— 选择预设载入 —</option>' + injPresets.map((x,i) => '<option value="' + i + '">' + esc(x.name || ('预设' + (i + 1))) + '</option>').join('');
    const sumOptions = '<option value="">— 不注入 —</option>' + sums.map(x => '<option value="' + esc(x.id) + '">' + esc(x.name || '大总结') + '</option>').join('');
    const charPreview = currentCharDescription(Object.assign({}, cfg, { injectCharDesc: true }));
    body.innerHTML = '<div class="wb-settings-grid">'
      + '<div class="wb-panel"><div class="wb-section-title">基础设置</div>'
      + '<label class="wb-switch"><input id="wb-companion-toggle" type="checkbox" ' + (cfg.companion ? 'checked' : '') + '>开启陪伴模式</label>'
      + '<label class="wb-switch"><input id="wb-remember-window" type="checkbox" ' + (cfg.rememberWindow ? 'checked' : '') + '>保留上一次窗口</label>'
      + '<label class="wb-switch"><input id="wb-message-notify" type="checkbox" ' + (cfg.messageNotify ? 'checked' : '') + '>角色回复完成提醒，并暂停当前游戏</label>'
      + '<div class="wb-field"><label>美化主题</label><select class="wb-select" id="wb-theme"><option value="day">日间</option><option value="night">夜间</option></select></div>'
      + '</div>'
      + '<div class="wb-panel"><div class="wb-section-title">世界观注入</div>'
      + '<div class="wb-field"><label><input type="checkbox" id="wb-inject-user-desc" ' + (cfg.injectUserDesc !== false ? 'checked' : '') + '> 用户设定描述</label><textarea class="wb-textarea" id="wb-user-persona" placeholder="填写 user 的设定、性格、关系、偏好；留空则尝试读取当前 persona...">' + esc(cfg.userPersona) + '</textarea></div>'
      + '<label class="wb-switch"><input id="wb-inject-char-desc" type="checkbox" ' + (cfg.injectCharDesc !== false ? 'checked' : '') + '>角色描述</label>'
      + '<div class="wb-field"><label>角色姓名（可选）</label><input class="wb-input" id="wb-char-name" placeholder="留空则读取当前角色卡姓名" value="' + esc(cfg.charName && cfg.charName !== '{{char}}' ? cfg.charName : '') + '"></div>'
      + '<div class="wb-api-status wb-char-desc-preview" id="wb-char-desc-preview">' + esc(charPreview) + '</div>'
      + '<div class="wb-field"><label>世界观头像 URL（可选）</label><input class="wb-input" id="wb-avatar-url" placeholder="输入 URL 会优先作为头像；留空后点击保存头像会读取当前角色卡头像" value="' + esc(cfg.avatarUrl || '') + '"><div class="wb-actions"><button class="wb-btn" id="wb-save-current-avatar">保存头像</button><button class="wb-btn" id="wb-clear-avatar">清除世界观头像</button></div></div>'
      + '<label class="wb-switch"><input id="wb-inject-chat" type="checkbox" ' + (cfg.injectChat ? 'checked' : '') + '>注入最新聊天记录</label>'
      + '<label class="wb-switch"><input id="wb-intimacy-mode" type="checkbox" ' + (cfg.intimacyMode ? 'checked' : '') + '>NSFW模式</label>'
      + '<div class="wb-muted">开启后根据角色性格特征，允许角色之间更暧昧、亲近、露骨的色情化表达。</div>'
      + '<div class="wb-field"><label>前置提示词 / 破限词（自动保存）</label><textarea class="wb-textarea" id="wb-break-limit-prompt" style="min-height:88px;" placeholder="可粘贴希望置于生成提示词最前面的风格补充；不会覆盖安全限制。">' + esc(cfg.breakLimitPrompt || '') + '</textarea></div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><span class="wb-muted">当前挂载的世界书</span><button class="wb-btn" id="wb-refresh-worldbook">刷新挂载条目</button></div>'
      + '<div class="wb-worldbook-list" id="wb-worldbook-list"><span class="wb-muted">点击刷新以载入当前挂载的世界书条目...</span></div>'
      + '<div class="wb-section-title" style="font-size:12px;margin-top:4px;">导入大总结</div>'
      + '<div class="wb-preset-row"><select class="wb-select" id="wb-summary-select">' + sumOptions + '</select><button class="wb-btn" id="wb-manage-summary">管理/导入</button></div>'
      + '<div class="wb-api-status" id="wb-summary-preview">' + esc(summaryPreview(cfg.summaryId)) + '</div>'
      + '<div class="wb-section-title" style="font-size:12px;margin-top:4px;">注入预设</div>'
      + '<div class="wb-preset-row"><select class="wb-select" id="wb-world-preset">' + injOptions + '</select><button class="wb-btn" id="wb-load-world-preset">载入</button><button class="wb-btn" id="wb-del-world-preset">删</button></div>'
      + '<div class="wb-preset-save-row"><input class="wb-input" type="text" id="wb-world-preset-name" placeholder="命名并保存当前注入配置..."><button class="wb-btn" id="wb-save-world-preset">保存</button></div>'
      + '</div>'
      + '<div class="wb-panel"><div class="wb-section-title">API 配置</div>'
      + '<div class="wb-field"><label>API 基础 URL</label><input class="wb-input" type="url" id="wb-api-url" placeholder="https://api.example.com" value="' + esc(cfg.apiUrl) + '"></div>'
      + '<div class="wb-field"><label>API 密钥</label><input class="wb-input" type="password" id="wb-api-key" placeholder="sk-..." value="' + esc(cfg.apiKey) + '"></div>'
      + '<div class="wb-actions"><button class="wb-btn" id="wb-load-models-btn" style="flex:1;">加载模型列表</button></div>'
      + '<div class="wb-field"><label>选择模型</label><select class="wb-select" id="wb-api-model"><option value="">请先加载模型列表</option></select></div>'
      + '<div class="wb-api-status" id="wb-api-status">状态: 未配置</div>'
      + '<div class="wb-actions"><button class="wb-btn primary" id="wb-save-api-config" style="flex:1;">保存API配置</button><button class="wb-btn" id="wb-clear-api-config">清除</button></div>'
      + '<div class="wb-section-title" style="font-size:12px;margin-top:4px;">API 预设</div>'
      + '<div class="wb-preset-row"><select class="wb-select" id="wb-api-preset">' + apiOptions + '</select><button class="wb-btn" id="wb-load-api-preset">载入</button><button class="wb-btn" id="wb-del-api-preset">删</button></div>'
      + '<div class="wb-preset-save-row"><input class="wb-input" type="text" id="wb-api-preset-name" placeholder="命名并保存当前 API 配置..."><button class="wb-btn" id="wb-save-api-preset">保存</button></div>'
      + '</div>'
      + '<div class="wb-panel"><div class="wb-section-title">导出 / 导入</div>'
      + '<div class="wb-muted">一键导出除 API 配置和 API 预设以外的全部内容；导入不会覆盖 API URL、密钥、模型。</div>'
      + '<div class="wb-actions"><button class="wb-btn primary" id="wb-export-all" style="flex:1;">导出全部内容</button><button class="wb-btn" id="wb-import-all" style="flex:1;">导入备份</button><input type="file" id="wb-import-all-file" accept=".json,application/json" style="display:none;"></div>'
      + '<div class="wb-api-status" id="wb-import-export-status">未选择文件。</div>'
      + '</div></div>';
    qs('#wb-theme').value = cfg.theme;
    qs('#wb-summary-select').value = cfg.summaryId || '';
    populateModelSelect(cfg.apiModel);
    updateApiStatusUI();
    restoreSelectedWorldEntries();
    qs('#wb-companion-toggle').onchange = autoSaveBasicSettingsFromUI;
    const rememberWindowToggle = qs('#wb-remember-window'); if (rememberWindowToggle) rememberWindowToggle.onchange = autoSaveBasicSettingsFromUI;
    const messageNotifyToggle = qs('#wb-message-notify'); if (messageNotifyToggle) messageNotifyToggle.onchange = () => { autoSaveBasicSettingsFromUI(); bindMessageNotifyEvents(); };
    qs('#wb-theme').onchange = autoSaveBasicSettingsFromUI;
    const avatarInput = qs('#wb-avatar-url'); if (avatarInput) avatarInput.oninput = debounceAutoSaveInjection;
    const saveAvatarBtn = qs('#wb-save-current-avatar'); if (saveAvatarBtn) saveAvatarBtn.onclick = () => { const input = qs('#wb-avatar-url'); const typed = input ? input.value.trim() : ''; if (typed) { autoSaveInjectionSettingsFromUI(); toast('已保存头像 URL，优先使用该头像'); return; } const url = findCurrentCardAvatar(); if (!url) { toast('未读取到当前角色卡头像'); return; } if (input) input.value = url; autoSaveInjectionSettingsFromUI(); toast('已保存当前角色卡头像到世界观注入'); };
    const clearAvatarBtn = qs('#wb-clear-avatar'); if (clearAvatarBtn) clearAvatarBtn.onclick = () => { const input = qs('#wb-avatar-url'); if (input) input.value = ''; autoSaveInjectionSettingsFromUI(); toast('已清除世界观头像'); };
    qs('#wb-load-models-btn').onclick = loadModelsFromUI;
    qs('#wb-save-api-config').onclick = saveApiConfigFromUI;
    qs('#wb-clear-api-config').onclick = clearApiConfigFromUI;
    qs('#wb-save-api-preset').onclick = saveApiPresetFromUI;
    qs('#wb-load-api-preset').onclick = loadApiPresetFromUI;
    qs('#wb-del-api-preset').onclick = deleteApiPresetFromUI;
    const exportBtn = qs('#wb-export-all'); if (exportBtn) exportBtn.onclick = exportAllData;
    const importBtn = qs('#wb-import-all'); if (importBtn) importBtn.onclick = () => { const f = qs('#wb-import-all-file'); if (f) f.click(); };
    const importFile = qs('#wb-import-all-file'); if (importFile) importFile.onchange = importAllDataFromFile;
    qs('#wb-refresh-worldbook').onclick = refreshWorldbookList;
    ['#wb-inject-user-desc','#wb-inject-char-desc','#wb-inject-chat','#wb-intimacy-mode','#wb-summary-select'].forEach(sel => { const el = qs(sel); if (el) el.onchange = () => { const pv = qs('#wb-summary-preview'); if (pv) pv.textContent = summaryPreview(qs('#wb-summary-select').value); autoSaveInjectionSettingsFromUI(); }; });
    const up = qs('#wb-user-persona'); if (up) up.oninput = debounceAutoSaveInjection;
    const cn = qs('#wb-char-name'); if (cn) cn.oninput = () => { const preview = qs('#wb-char-desc-preview'); if (preview) preview.textContent = currentCharDescription(Object.assign({}, settings(), { charName: cn.value.trim() || '{{char}}', injectCharDesc: true })); debounceAutoSaveInjection(); };
    const bp = qs('#wb-break-limit-prompt'); if (bp) bp.oninput = debounceAutoSaveInjection;
    qs('#wb-manage-summary').onclick = openSummaryManager;
    qs('#wb-save-world-preset').onclick = saveWorldPresetFromUI;
    qs('#wb-load-world-preset').onclick = loadWorldPresetFromUI;
    qs('#wb-del-world-preset').onclick = deleteWorldPresetFromUI;
  }

  let wbAutoSaveTimer = null;
  function autoSaveBasicSettingsFromUI() {
    const companion = !!(qs('#wb-companion-toggle') && qs('#wb-companion-toggle').checked);
    const theme = qs('#wb-theme') ? qs('#wb-theme').value : settings().theme;
    const rememberWindow = !!(qs('#wb-remember-window') && qs('#wb-remember-window').checked);
    const messageNotify = !!(qs('#wb-message-notify') && qs('#wb-message-notify').checked);
    const patch = { companion, theme, rememberWindow, messageNotify };
    if (rememberWindow) { patch.lastTab = currentTab || 'single'; patch.lastGame = currentGame || ''; }
    setSettings(patch);
    syncPopupModeClass();
  }
  function autoSaveInjectionSettingsFromUI() {
    if (!qs('#wb-inject-user-desc')) return;
    setSettings({
      injectUserDesc: qs('#wb-inject-user-desc').checked,
      injectCharDesc: qs('#wb-inject-char-desc').checked,
      injectChat: qs('#wb-inject-chat').checked,
      intimacyMode: !!(qs('#wb-intimacy-mode') && qs('#wb-intimacy-mode').checked),
      breakLimitPrompt: qs('#wb-break-limit-prompt') ? qs('#wb-break-limit-prompt').value.trim() : '',
      userPersona: qs('#wb-user-persona').value.trim(),
      charName: (qs('#wb-char-name') && qs('#wb-char-name').value.trim()) || '{{char}}',
      avatarUrl: qs('#wb-avatar-url') ? qs('#wb-avatar-url').value.trim() : '',
      summaryId: qs('#wb-summary-select').value || '',
      selectedWorldEntries: selectedWorldEntriesFromUI()
    });
  }
  function debounceAutoSaveInjection() { if (wbAutoSaveTimer) clearTimeout(wbAutoSaveTimer); wbAutoSaveTimer = setTimeout(autoSaveInjectionSettingsFromUI, 250); }
  function flushSettingsProgress() {
    if (wbAutoSaveTimer) { clearTimeout(wbAutoSaveTimer); wbAutoSaveTimer = null; }
    if (qs('#wb-companion-toggle') || qs('#wb-theme') || qs('#wb-remember-window')) autoSaveBasicSettingsFromUI();
    if (qs('#wb-inject-user-desc')) autoSaveInjectionSettingsFromUI();
  }
  function saveBasicSettingsFromUI() {
    setSettings({ companion: qs('#wb-companion-toggle').checked, theme: qs('#wb-theme').value });
    toast('基础设置已保存'); render();
  }
  function populateModelSelect(model) {
    const sel = qs('#wb-api-model'); if (!sel) return;
    sel.innerHTML = model ? '<option value="' + esc(model) + '">' + esc(model) + '</option>' : '<option value="">请先加载模型列表</option>';
    if (model) sel.value = model;
  }
  function updateApiStatusUI() {
    const s = qs('#wb-api-status'); if (!s) return;
    const url = qs('#wb-api-url') ? qs('#wb-api-url').value.trim() : settings().apiUrl;
    const model = qs('#wb-api-model') ? qs('#wb-api-model').value : settings().apiModel;
    s.innerHTML = (url && model) ? ('URL: ' + esc(url) + '<br>模型: ' + esc(model)) : (url ? '已配置URL，请加载并选择模型' : '状态: 未配置');
  }
  function modelListUrl(url) {
    let base = (url || '').trim(); if (!base) return '';
    if (/\/chat\/completions\/?$/.test(base)) base = base.replace(/\/chat\/completions\/?$/, '/models');
    else { base = base.endsWith('/') ? base : base + '/'; if (!base.includes('/v1/') && !base.endsWith('v1/')) base += 'v1/'; base += 'models'; }
    return base;
  }
  async function loadModelsFromUI() {
    const url = qs('#wb-api-url').value.trim(); const key = qs('#wb-api-key').value.trim();
    if (!url) { toast('请输入API基础URL'); return; }
    const status = qs('#wb-api-status'); if (status) status.textContent = '正在加载模型列表...';
    try {
      const headers = { 'Content-Type': 'application/json' }; if (key) headers.Authorization = 'Bearer ' + key;
      const res = await fetch(modelListUrl(url), { method:'GET', headers });
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      const data = await res.json();
      let models = [];
      if (data.data && Array.isArray(data.data)) models = data.data.map(m => m.id).filter(Boolean);
      else if (Array.isArray(data)) models = data.map(m => typeof m === 'string' ? m : m.id).filter(Boolean);
      const sel = qs('#wb-api-model'); sel.innerHTML = '';
      if (!models.length) { sel.innerHTML = '<option value="">未发现模型</option>'; toast('未能解析模型列表'); return; }
      models.forEach(m => { const opt = getHostDocument().createElement('option'); opt.value = m; opt.textContent = m; sel.appendChild(opt); });
      const saved = settings().apiModel; if (saved && models.includes(saved)) sel.value = saved;
      updateApiStatusUI(); toast('加载了 ' + models.length + ' 个模型');
    } catch(e) { if (status) status.textContent = '加载失败: ' + e.message; toast('加载失败: ' + e.message); }
  }
  function exportDataKeys() {
    return [
      STORAGE_SETTINGS,
      STORAGE_SCORES,
      STORAGE_LINES,
      STORAGE_ROLE_LINES,
      STORAGE_LINE_PRESET_SELECTION,
      STORAGE_WORLD_PRESETS,
      STORAGE_SUMMARIES,
      STORAGE_SUMMARY_REQ,
      STORAGE_PROGRESS,
      STORAGE_RECORDS
    ];
  }
  function settingsWithoutApi(raw) {
    const out = Object.assign({}, raw || {});
    delete out.apiUrl;
    delete out.apiKey;
    delete out.apiModel;
    return out;
  }
  function exportAllData() {
    flushSettingsProgress();
    const data = { app:'玩伴小屋', scriptId:SCRIPT_ID, version:'1.0.0', exportedAt:new Date().toISOString(), items:{} };
    exportDataKeys().forEach(key => {
      if (key === STORAGE_SETTINGS) data.items[key] = settingsWithoutApi(loadJSON(key, {}));
      else if (key === STORAGE_SUMMARY_REQ) data.items[key] = localStorage.getItem(key) || '';
      else data.items[key] = loadJSON(key, null);
    });
    const text = JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type:'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = getHostDocument().createElement('a');
    a.href = url;
    a.download = '玩伴小屋-非API备份-' + new Date().toISOString().slice(0,10) + '.json';
    getHostDocument().body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
    const st = qs('#wb-import-export-status'); if (st) st.textContent = '已导出：不包含 API 配置和 API 预设。';
    toast('已导出全部非 API 内容');
  }
  function importAllDataFromFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        const items = data.items || data;
        const currentApi = ((cfg) => ({ apiUrl: cfg.apiUrl || '', apiKey: cfg.apiKey || '', apiModel: cfg.apiModel || '' }))(settings());
        exportDataKeys().forEach(key => {
          if (!Object.prototype.hasOwnProperty.call(items, key)) return;
          if (key === STORAGE_SETTINGS) saveJSON(key, Object.assign({}, settingsWithoutApi(items[key] || {}), currentApi));
          else if (key === STORAGE_SUMMARY_REQ) localStorage.setItem(key, String(items[key] || ''));
          else saveJSON(key, items[key]);
        });
        const st = qs('#wb-import-export-status'); if (st) st.textContent = '已导入：' + (file.name || '备份文件') + '。API 配置已保留。';
        toast('导入完成，API 配置未被覆盖');
        renderSettings();
      } catch(err) {
        const st = qs('#wb-import-export-status'); if (st) st.textContent = '导入失败：' + (err && err.message ? err.message : err);
        toast('导入失败：文件格式不正确');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  }
  function saveApiConfigFromUI() { setSettings({ apiUrl: qs('#wb-api-url').value.trim(), apiKey: qs('#wb-api-key').value.trim(), apiModel: qs('#wb-api-model').value || 'gpt-4o-mini' }); updateApiStatusUI(); toast('API配置已保存'); }
  function clearApiConfigFromUI() { qs('#wb-api-url').value=''; qs('#wb-api-key').value=''; qs('#wb-api-model').innerHTML='<option value="">请先加载模型列表</option>'; setSettings({ apiUrl:'', apiKey:'', apiModel:'' }); updateApiStatusUI(); toast('API配置已清除'); }
  function saveApiPresetFromUI() {
    const name = qs('#wb-api-preset-name').value.trim(); if (!name) { toast('请输入 API 预设名称'); return; }
    const arr = apiPresets().filter(x => x.name !== name);
    arr.unshift({ name, apiUrl: qs('#wb-api-url').value.trim(), apiKey: qs('#wb-api-key').value.trim(), apiModel: qs('#wb-api-model').value || 'gpt-4o-mini' });
    saveApiPresets(arr); toast('API 预设已保存'); renderSettings();
  }
  function loadApiPresetFromUI() { const idx = parseInt(qs('#wb-api-preset').value, 10); const pr = apiPresets()[idx]; if (!pr) return; qs('#wb-api-url').value=pr.apiUrl||''; qs('#wb-api-key').value=pr.apiKey||''; populateModelSelect(pr.apiModel||''); updateApiStatusUI(); toast('API 预设已载入'); }
  function deleteApiPresetFromUI() { const idx = parseInt(qs('#wb-api-preset').value, 10); const arr = apiPresets(); if (!arr[idx]) return; showConfirm('删除 API 预设','确定删除这个 API 预设吗？',()=>{ arr.splice(idx,1); saveApiPresets(arr); renderSettings(); }); }
  function selectedWorldEntriesFromUI() { return qsa('#wb-worldbook-list .wb-tag.active').map(x => ({ label: x.dataset.label || x.textContent, content: x.dataset.content || '', wbName: x.dataset.wbName || '', uid: x.dataset.uid || '' })); }
  function selectedWorldText(cfg) { const entries = (cfg.selectedWorldEntries || []).filter(x => x && (x.content || x.label)); return entries.map(x => '[' + (x.label || '世界书条目') + ']\n' + (x.content || '')).join('\n\n'); }
  function selectedSummaryText(cfg) { if (cfg.summarySnapshot && (cfg.summarySnapshot.content || cfg.summarySnapshot.name)) return '[' + (cfg.summarySnapshot.name || '大总结') + ']\n' + (cfg.summarySnapshot.content || ''); if (!cfg.summaryId) return ''; const s = summaries().find(x => x.id === cfg.summaryId); return s ? ('[' + (s.name || '大总结') + ']\n' + (s.content || '')) : ''; }
  function restoreSelectedWorldEntries() { const cfg = settings(); if (cfg.selectedWorldEntries && cfg.selectedWorldEntries.length) renderWorldbookTags(cfg.selectedWorldEntries, true); }
  function renderWorldbookTags(entries, activeAll) {
    const list = qs('#wb-worldbook-list'); if (!list) return;
    if (!entries || !entries.length) { list.innerHTML = '<span class="wb-muted">当前未发现可读取的世界书条目</span>'; return; }
    list.innerHTML = '';
    entries.forEach(e => { const b = getHostDocument().createElement('button'); b.type='button'; b.className='wb-tag' + (activeAll ? ' active' : ''); b.textContent=e.label||'世界书条目'; b.dataset.label=e.label||'世界书条目'; b.dataset.content=e.content||''; b.dataset.wbName=e.wbName||''; b.dataset.uid=e.uid||''; b.title=(e.content||'').slice(0,160); b.onclick=()=>{ b.classList.toggle('active'); autoSaveInjectionSettingsFromUI(); }; list.appendChild(b); });
  }
  async function refreshWorldbookList() {
    const list = qs('#wb-worldbook-list'); if (list) list.innerHTML = '<span class="wb-muted">正在读取挂载条目...</span>';
    try {
      const out = await getActiveWorldbookEntries();
      renderWorldbookTags(out, false); toast(out.length ? ('已载入 ' + out.length + ' 个世界书条目') : '当前未发现可读取的世界书条目');
    } catch(e) { if (list) list.innerHTML = '<span class="wb-muted">读取失败：当前环境未暴露世界书接口</span>'; toast('世界书读取失败'); }
  }
  function getHostContext() {
    try { const w = getHostWindow(); return w.SillyTavern && w.SillyTavern.getContext ? w.SillyTavern.getContext() : null; }
    catch(e) { return null; }
  }
  function getTavernHelper() {
    try { const w = getHostWindow(); return w.TavernHelper || window.TavernHelper || null; }
    catch(e) { return window.TavernHelper || null; }
  }
  async function readLorebookEntries(name) {
    const th = getTavernHelper();
    if (!th || !name) return [];
    let entries = [];
    if (th.getLorebookEntries) entries = await th.getLorebookEntries(name);
    else if (th.getWorldbook) {
      const wb = await th.getWorldbook(name);
      entries = Array.isArray(wb?.entries) ? wb.entries : Object.values(wb?.entries || {});
    }
    return Array.isArray(entries) ? entries : Object.values(entries || {});
  }
  function normalizeWorldNames(value) {
    const out = [];
    const walk = v => {
      if (!v) return;
      if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === 'string') out.push(v);
      else if (typeof v === 'object') Object.keys(v).forEach(k => { if (v[k]) out.push(k); });
    };
    walk(value);
    return out.filter(Boolean);
  }
  async function getActiveWorldbookEntries() {
    const results = [];
    const checked = new Set();
    const pushEntry = (source, e, i) => results.push({
      label: '[' + source + '] ' + (e.comment || e.name || (Array.isArray(e.key) ? e.key[0] : e.key) || e.uid || ('条目' + (i + 1))),
      content: e.content || '', wbName: source, uid: e.uid || e.id
    });
    try {
      const ctx = getHostContext();
      if (!ctx) return results;
      const char = ctx.characters && ctx.characterId >= 0 ? ctx.characters[ctx.characterId] : (ctx.character || null);
      const charData = char?.data || char || {};
      const charWorlds = normalizeWorldNames([charData?.extensions?.world, charData?.world, charData?.character_book?.name]);
      const chatMeta = ctx.chatMetadata || {};
      const metaWorlds = normalizeWorldNames([chatMeta.world_info, chatMeta.worldInfo, chatMeta.world, ctx.world_names]);
      const globalWorlds = normalizeWorldNames([ctx.worldInfo, ctx.globalWorldInfo]);
      for (const name of [...charWorlds, ...metaWorlds, ...globalWorlds]) {
        if (!name || checked.has(name)) continue;
        checked.add(name);
        try { (await readLorebookEntries(name)).forEach((e, i) => pushEntry(name, e, i)); }
        catch(e) { console.warn('[玩伴小屋] 世界书加载失败:', name, e); }
      }
      const inlineBook = charData?.character_book;
      if (inlineBook && Array.isArray(inlineBook.entries)) inlineBook.entries.forEach((e, i) => pushEntry('角色内嵌', e, i));
    } catch(e) { console.warn('[玩伴小屋] getActiveWorldbookEntries failed:', e); }
    return results.filter(e => e.content || e.label);
  }
  function currentUserDescription(cfg) {
    if (cfg.injectUserDesc === false) return '不注入';
    if (cfg.userPersona && cfg.userPersona.trim()) return cfg.userPersona.trim();
    const ctx = getHostContext();
    return (ctx && (ctx.personaDescription || ctx.persona || ctx.user_desc)) || '未填写';
  }
  function currentCharDescription(cfg) {
    if (cfg.injectCharDesc === false) return '不注入';
    if (cfg.charDescriptionSnapshot && String(cfg.charDescriptionSnapshot).trim()) return String(cfg.charDescriptionSnapshot).trim();
    const ctx = getHostContext();
    const char = ctx && ctx.characters && ctx.characterId >= 0 ? ctx.characters[ctx.characterId] : (ctx && ctx.character ? ctx.character : null);
    const charData = char?.data || char || {};
    const name = cfg.charName && cfg.charName !== '{{char}}' ? cfg.charName : (charData.name || ctx?.name2 || '{{char}}');
    const desc = (charData.description || ctx?.description || '').trim();
    return name + '：' + (desc || '未读取到当前角色描述');
  }
  function summaryPreview(id) { const s = summaries().find(x => x.id === id); if (!s) return '当前不注入大总结。'; const txt = (s.content || '').replace(/\s+/g, ' ').slice(0, 140); return '[' + (s.name || '大总结') + '] ' + txt + ((s.content || '').length > 140 ? '...' : ''); }
  function refreshSummaryInjectionUI(selectedId) {
    const id = selectedId !== undefined ? (selectedId || '') : (settings().summaryId || '');
    const sums = summaries();
    const exists = !!id && sums.some(x => x.id === id);
    const actualId = exists ? id : '';
    const sel = qs('#wb-summary-select');
    if (sel) {
      sel.innerHTML = '<option value="">— 不注入 —</option>' + sums.map(x => '<option value="' + esc(x.id) + '">' + esc(x.name || '大总结') + '</option>').join('');
      sel.value = actualId;
    }
    const pv = qs('#wb-summary-preview');
    if (pv) pv.textContent = summaryPreview(actualId);
  }
  function renderSummaryManagerList(mask) {
    const list = qs('#wb-summary-manager-list', mask); if (!list) return;
    const arr = summaries();
    if (!arr.length) { refreshSummaryInjectionUI(''); list.innerHTML = '<div class="wb-muted" style="padding:10px;text-align:center;">暂无大总结，点击“添加/导入”。</div>'; return; }
    list.innerHTML = arr.map((s,i) => '<div class="wb-summary-item" data-i="' + i + '"><div style="min-width:0;flex:1;"><div style="font-weight:800;color:var(--wb-accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(s.name || '大总结') + '</div><div class="wb-muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc((s.content || '').replace(/\s+/g, ' ').slice(0, 90)) + '</div></div><div class="wb-actions"><button class="wb-btn wb-summary-use" data-i="' + i + '">导入</button><button class="wb-btn wb-summary-edit" data-i="' + i + '">编辑</button><button class="wb-btn wb-summary-del" data-i="' + i + '">删</button></div></div>').join('');
    qsa('.wb-summary-use', list).forEach(b => b.onclick = () => { const s = summaries()[+b.dataset.i]; if (!s) return; setSettings({ summaryId: s.id }); refreshSummaryInjectionUI(s.id); closeSummaryModal(mask); renderSettings(); toast('大总结已设为导入'); });
    qsa('.wb-summary-edit', list).forEach(b => b.onclick = () => openSummaryEditor(mask, +b.dataset.i));
    qsa('.wb-summary-del', list).forEach(b => b.onclick = () => { const idx = +b.dataset.i; const arr = summaries(); if (!arr[idx]) return; showConfirm('删除大总结','确定删除这个大总结吗？',()=>{ const deleted = arr.splice(idx,1)[0]; const cfg = settings(); if (cfg.summaryId === deleted.id) setSettings({ summaryId: '' }); saveSummaries(arr); refreshSummaryInjectionUI(settings().summaryId || ''); renderSummaryManagerList(mask); }); });
  }
  function openSummaryManager() {
    const doc = getHostDocument();
    const old = qs('#wb-summary-mask', doc); if (old) old.remove();
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-summary-mask';
    mask.innerHTML = '<div class="wb-modal wb-summary-modal"><div class="wb-modal-title">导入大总结</div><div class="wb-actions" style="margin-bottom:10px;"><button class="wb-btn primary" id="wb-summary-add">添加/导入</button><button class="wb-btn" id="wb-summary-ai">AI智能导入</button><button class="wb-btn" id="wb-summary-clear-current">不注入</button></div><div class="wb-summary-list" id="wb-summary-manager-list"></div><div class="wb-actions" style="margin-top:12px;justify-content:flex-end;"><button class="wb-btn" id="wb-summary-close">关闭</button></div></div>';
    appendModalMask(mask);
    qs('#wb-summary-add', mask).onclick = () => openSummaryEditor(mask, -1);
    qs('#wb-summary-ai', mask).onclick = () => openAiSummaryImporter(mask);
    qs('#wb-summary-clear-current', mask).onclick = () => { setSettings({ summaryId: '' }); closeSummaryModal(mask); renderSettings(); toast('已取消导入大总结'); };
    qs('#wb-summary-close', mask).onclick = () => closeSummaryModal(mask);
    renderSummaryManagerList(mask);
  }
  async function callApiText(cfg, prompt, systemPrompt) {
    const url = apiChatUrl(cfg.apiUrl);
    if (!url) throw new Error('请先配置API基础URL');
    if (!cfg.apiModel) throw new Error('请先选择模型');
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
    const res = await fetchWithTimeout(url, {
      method: 'POST', headers,
      body: JSON.stringify({ model: cfg.apiModel, messages: [{ role: 'system', content: systemPrompt || '只输出结果正文，不要解释。' }, { role: 'user', content: prompt }], temperature: 0.55, max_tokens: 4096 })
    }, 60000);
    if (!res.ok) { const t = await res.text().catch(()=> ''); throw new Error('API错误 ' + res.status + ': ' + t.slice(0, 120)); }
    const json = await res.json();
    const txt = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || json.output_text || '';
    if (!txt) throw new Error('API响应格式异常');
    return stripJsonFence(txt);
  }

  function openAiSummaryImporter(mask) {
    const doc = getHostDocument();
    const old = qs('#wb-summary-ai-mask', doc); if (old) old.remove();
    const cfg = settings();
    const apis = apiPresets();
    const apiOptions = '<option value="">— 使用当前API配置 —</option>' + apis.map((x,i) => '<option value="' + i + '">' + esc(x.name || ('预设' + (i + 1))) + '</option>').join('');
    const modal = doc.createElement('div');
    modal.className = modalMaskClass();
    modal.id = 'wb-summary-ai-mask';
    modal.innerHTML = '<div class="wb-modal wb-summary-modal"><div class="wb-modal-title">AI智能导入大总结</div>'
      + '<div class="wb-field"><label>API 预设（可选）</label><div class="wb-preset-row"><select class="wb-select" id="wb-aisum-api">' + apiOptions + '</select><button class="wb-btn" id="wb-aisum-load-api">载入</button></div></div>'
      + '<div class="wb-field"><label>上传或粘贴主线内容</label><div class="wb-actions"><button class="wb-btn" id="wb-aisum-file-btn">上传文件</button><input type="file" id="wb-aisum-file" accept=".txt,.md,.json,.yaml,.yml,.csv,.log" style="display:none;"><button class="wb-btn" id="wb-aisum-clear">清空</button></div><div class="wb-preset-row"><input class="wb-input" id="wb-aisum-tag" placeholder="聊天标签，例如 content；留空读取全文" value=""><button class="wb-btn" id="wb-aisum-fetch">从聊天记录获取</button></div><div class="wb-muted" id="wb-aisum-info"></div><textarea class="wb-textarea" id="wb-aisum-content" style="min-height:150px;font-family:monospace;" placeholder="粘贴主线内容，或上传文件 / 从聊天记录标签中提取..."></textarea></div>'
      + '<div class="wb-field"><label>总结要求（自动保存）</label><textarea class="wb-textarea" id="wb-aisum-req" style="min-height:74px;" placeholder="例：约800字，按时间顺序，重点记录人物关系、关键事件、未解决伏笔。">' + esc(summaryReq()) + '</textarea></div>'
      + '<div class="wb-field" id="wb-aisum-result-wrap" style="display:none;"><label>生成结果（预览）</label><textarea class="wb-textarea" id="wb-aisum-result" style="min-height:170px;font-family:monospace;" readonly></textarea><label>保存标题</label><input class="wb-input" id="wb-aisum-name" placeholder="为这条大总结命名..."></div>'
      + '<div class="wb-actions" style="margin-top:12px;"><button class="wb-btn primary" id="wb-aisum-generate" style="flex:1;">生成大总结</button><button class="wb-btn" id="wb-aisum-save" style="display:none;flex:1;">保存并导入</button><button class="wb-btn" id="wb-aisum-cancel">取消</button></div></div>';
    appendModalMask(modal);
    let workCfg = Object.assign({}, cfg);
    qs('#wb-aisum-load-api', modal).onclick = () => { const idx = parseInt(qs('#wb-aisum-api', modal).value, 10); const pr = apis[idx]; if (!pr) { toast('请先选择 API 预设'); return; } workCfg = Object.assign({}, workCfg, { apiUrl: pr.apiUrl || '', apiKey: pr.apiKey || '', apiModel: pr.apiModel || '' }); toast('已临时载入 API 预设：' + (pr.name || '未命名')); };
    qs('#wb-aisum-file-btn', modal).onclick = () => qs('#wb-aisum-file', modal).click();
    qs('#wb-aisum-file', modal).onchange = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { qs('#wb-aisum-content', modal).value = String(r.result || ''); qs('#wb-aisum-info', modal).textContent = '已载入：' + f.name + '（' + (f.size / 1024).toFixed(1) + ' KB）'; if (!qs('#wb-aisum-name', modal).value.trim()) qs('#wb-aisum-name', modal).value = f.name.replace(/\.[^.]+$/, ''); }; r.readAsText(f, 'utf-8'); };
    qs('#wb-aisum-clear', modal).onclick = () => { qs('#wb-aisum-content', modal).value = ''; qs('#wb-aisum-info', modal).textContent = ''; };
    qs('#wb-aisum-fetch', modal).onclick = () => {
      const rawTag = qs('#wb-aisum-tag', modal).value.trim();
      const tag = rawTag.replace(/[<>\/]/g, '');
      try {
        const ctx = getHostContext();
        if (!ctx || !Array.isArray(ctx.chat) || !ctx.chat.length) { toast('未获取到聊天记录'); return; }
        const allText = ctx.chat.map(m => m && m.mes ? m.mes : '').filter(Boolean).join('\n\n');
        if (!tag) {
          qs('#wb-aisum-content', modal).value = allText;
          qs('#wb-aisum-info', modal).textContent = '已导入聊天全文，共 ' + allText.length + ' 字符';
          toast('已导入聊天全文');
          return;
        }
        const re = new RegExp('<' + tag + '>[\\s\\S]*?<\\/' + tag + '>', 'gi');
        const matches = allText.match(re) || [];
        if (!matches.length) { qs('#wb-aisum-info', modal).textContent = '未找到 <' + tag + '>...</' + tag + '> 标签'; toast('未找到指定聊天标签'); return; }
        const extracted = matches.map(x => x.replace(new RegExp('^<' + tag + '>|<\\/' + tag + '>$', 'gi'), '').trim()).filter(Boolean).join('\n\n');
        qs('#wb-aisum-content', modal).value = extracted;
        qs('#wb-aisum-info', modal).textContent = '已提取 ' + matches.length + ' 处 <' + tag + '> 内容，共 ' + extracted.length + ' 字符';
      } catch(e) { toast('获取失败：' + (e && e.message ? e.message : e)); }
    };
    qs('#wb-aisum-req', modal).oninput = e => saveSummaryReq(e.target.value);
    qs('#wb-aisum-generate', modal).onclick = async () => { const content = qs('#wb-aisum-content', modal).value.trim(); const req = qs('#wb-aisum-req', modal).value.trim(); if (!content) { toast('请先输入主线内容'); return; } if (!req) { toast('请填写总结要求'); return; } const prompt = '你现在的任务是：对当前主线内容进行结构化“大总结”。\n【核心要求】\n* 必须严格按照“填写要求”来控制总结粒度和内容\n* 只输出总结结果，不要解释，不要寒暄，不要任何额外说明\n* 每一条必须是独立信息点，信息密度高，避免空话\n* 所有总结必须来源于主线内容，不允许编造\n* 禁止出现任何markdown符号\n────────────────\n【填写要求】\n' + req + '\n────────────────\n【主线内容】\n' + content + '\n────────────────\n现在开始生成大总结。'; const btn = qs('#wb-aisum-generate', modal); btn.disabled = true; btn.textContent = '生成中...'; try { const result = await callApiText(workCfg, prompt, '你是剧情总结助手。只输出总结正文，不要解释。'); qs('#wb-aisum-result', modal).value = result; qs('#wb-aisum-result-wrap', modal).style.display = ''; qs('#wb-aisum-save', modal).style.display = ''; if (!qs('#wb-aisum-name', modal).value.trim()) qs('#wb-aisum-name', modal).value = 'AI大总结 ' + new Date().toLocaleString(); toast('大总结生成完成，请检查后保存'); } catch(e) { toast('生成失败：' + (e && e.message ? e.message : e)); } finally { btn.disabled = false; btn.textContent = '重新生成'; } };
    qs('#wb-aisum-save', modal).onclick = () => { const name = qs('#wb-aisum-name', modal).value.trim(); const content = qs('#wb-aisum-result', modal).value.trim(); if (!name || !content) { toast('请输入保存标题并确认生成内容'); return; } const arr = summaries(); const saved = { id:'sum_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), name, content }; arr.unshift(saved); saveSummaries(arr); setSettings({ summaryId: saved.id }); refreshSummaryInjectionUI(saved.id); modal.remove(); renderSummaryManagerList(mask); toast('AI大总结已保存并导入'); };
    qs('#wb-aisum-cancel', modal).onclick = () => modal.remove();
  }

  function openSummaryEditor(mask, idx) {
    const arr = summaries();
    const existing = idx >= 0 ? arr[idx] : null;
    const editor = getHostDocument().createElement('div');
    editor.className = modalMaskClass();
    editor.id = 'wb-summary-editor-mask';
    editor.innerHTML = '<div class="wb-modal wb-summary-modal"><div class="wb-modal-title">' + (existing ? '编辑大总结' : '添加/导入大总结') + '</div><div class="wb-field"><label>标题</label><input class="wb-input" id="wb-sum-name" placeholder="例：第一章剧情总结" value="' + esc(existing ? existing.name : '') + '"></div><div class="wb-field"><label>内容</label><textarea class="wb-textarea" id="wb-sum-content" style="min-height:220px;" placeholder="在此粘贴大总结，或用下方文件导入...">' + esc(existing ? existing.content : '') + '</textarea></div><div class="wb-actions"><button class="wb-btn" id="wb-sum-file-btn">从文件导入</button><input type="file" id="wb-sum-file" accept=".txt,.md,.json,.yaml,.yml,.csv,.log" style="display:none;"><button class="wb-btn" id="wb-sum-clear">清空</button></div><div class="wb-actions" style="margin-top:12px;"><button class="wb-btn primary" id="wb-sum-save" style="flex:1;">保存并导入</button><button class="wb-btn" id="wb-sum-cancel">取消</button></div></div>';
    appendModalMask(editor);
    qs('#wb-sum-file-btn', editor).onclick = () => qs('#wb-sum-file', editor).click();
    qs('#wb-sum-file', editor).onchange = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { qs('#wb-sum-content', editor).value = String(r.result || ''); if (!qs('#wb-sum-name', editor).value.trim()) qs('#wb-sum-name', editor).value = f.name.replace(/\.[^.]+$/, ''); }; r.readAsText(f); };
    qs('#wb-sum-clear', editor).onclick = () => { qs('#wb-sum-content', editor).value = ''; };
    qs('#wb-sum-cancel', editor).onclick = () => editor.remove();
    qs('#wb-sum-save', editor).onclick = () => {
      const name = qs('#wb-sum-name', editor).value.trim();
      const content = qs('#wb-sum-content', editor).value.trim();
      if (!name || !content) { toast('请输入大总结标题和内容'); return; }
      let saved;
      if (existing) { saved = Object.assign({}, existing, { name, content }); arr[idx] = saved; }
      else { saved = { id:'sum_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), name, content }; arr.unshift(saved); }
      saveSummaries(arr); setSettings({ summaryId: saved.id }); refreshSummaryInjectionUI(saved.id); editor.remove(); renderSummaryManagerList(mask); toast('大总结已保存并导入');
    };
  }
  function closeSummaryModal(mask) { if (mask) mask.remove(); const ed = qs('#wb-summary-editor-mask', getHostDocument()); if (ed) ed.remove(); }
  function summarySnapshotFromId(id) {
    const s = summaries().find(x => x.id === id);
    return s ? { id: s.id, name: s.name || '大总结', content: s.content || '' } : null;
  }
  function worldPresetSnapshotFromUI(name) {
    const selected = selectedWorldEntriesFromUI();
    const charName = (qs('#wb-char-name') && qs('#wb-char-name').value.trim()) || '{{char}}';
    const summaryId = qs('#wb-summary-select') ? (qs('#wb-summary-select').value || '') : '';
    const baseCfg = Object.assign(settings(), { charName, injectCharDesc: qs('#wb-inject-char-desc') ? qs('#wb-inject-char-desc').checked : true, charDescriptionSnapshot: '' });
    return {
      name,
      injectUserDesc: qs('#wb-inject-user-desc').checked,
      injectCharDesc: qs('#wb-inject-char-desc').checked,
      injectChat: qs('#wb-inject-chat').checked,
      intimacyMode: !!(qs('#wb-intimacy-mode') && qs('#wb-intimacy-mode').checked),
      breakLimitPrompt: qs('#wb-break-limit-prompt') ? qs('#wb-break-limit-prompt').value.trim() : '',
      userPersona: qs('#wb-user-persona').value.trim(),
      charName,
      charDescriptionSnapshot: currentCharDescription(baseCfg),
      avatarUrl: qs('#wb-avatar-url') ? qs('#wb-avatar-url').value.trim() : '',
      summaryId,
      summarySnapshot: summarySnapshotFromId(summaryId),
      selectedWorldKeys: selected.map(x => ({ label:x.label, wbName:x.wbName || '', uid:x.uid || '' })),
      selectedWorldEntries: selected.map(x => ({ label:x.label || '', content:x.content || '', wbName:x.wbName || '', uid:x.uid || '' }))
    };
  }
  function saveSettingsFromUI() {
    setSettings({ injectUserDesc: qs('#wb-inject-user-desc').checked, injectCharDesc: qs('#wb-inject-char-desc').checked, injectChat: qs('#wb-inject-chat').checked, userPersona: qs('#wb-user-persona').value.trim(), charName: (qs('#wb-char-name') && qs('#wb-char-name').value.trim()) || '{{char}}', avatarUrl: qs('#wb-avatar-url') ? qs('#wb-avatar-url').value.trim() : '', summaryId: qs('#wb-summary-select').value || '', selectedWorldEntries: selectedWorldEntriesFromUI() });
    toast('注入设置已保存'); render();
  }
  function saveWorldPresetFromUI() {
    const name = qs('#wb-world-preset-name').value.trim();
    if (!name) { toast('请输入注入预设名称'); return; }
    const arr = worldPresets().filter(x => x.name !== name);
    arr.unshift(worldPresetSnapshotFromUI(name));
    saveWorldPresets(arr);
    toast('注入预设已保存为固定快照');
    renderSettings();
  }
  async function loadWorldPresetFromUI() {
    const idx = parseInt(qs('#wb-world-preset').value, 10);
    const pr = worldPresets()[idx];
    if (!pr) return;
    qs('#wb-inject-user-desc').checked = pr.injectUserDesc !== false;
    qs('#wb-inject-char-desc').checked = pr.injectCharDesc !== false;
    qs('#wb-inject-chat').checked = !!pr.injectChat;
    const im = qs('#wb-intimacy-mode'); if (im) im.checked = !!pr.intimacyMode;
    const bp = qs('#wb-break-limit-prompt'); if (bp) bp.value = pr.breakLimitPrompt || '';
    qs('#wb-user-persona').value = pr.userPersona || '';
    const cn = qs('#wb-char-name'); if (cn) cn.value = pr.charName && pr.charName !== '{{char}}' ? pr.charName : '';
    const av = qs('#wb-avatar-url'); if (av) av.value = pr.avatarUrl || '';
    qs('#wb-summary-select').value = pr.summaryId || '';
    const pv = qs('#wb-summary-preview'); if (pv) pv.textContent = pr.summarySnapshot ? ('[' + (pr.summarySnapshot.name || '大总结') + '] ' + String(pr.summarySnapshot.content || '').replace(/\s+/g, ' ').slice(0, 140)) : summaryPreview(pr.summaryId || '');
    const matched = (pr.selectedWorldEntries || []).map(x => ({ label:x.label || '', content:x.content || '', wbName:x.wbName || '', uid:x.uid || '' }));
    renderWorldbookTags(matched, true);
    setSettings({
      injectUserDesc: qs('#wb-inject-user-desc').checked,
      injectCharDesc: qs('#wb-inject-char-desc').checked,
      injectChat: qs('#wb-inject-chat').checked,
      intimacyMode: !!(qs('#wb-intimacy-mode') && qs('#wb-intimacy-mode').checked),
      breakLimitPrompt: qs('#wb-break-limit-prompt') ? qs('#wb-break-limit-prompt').value.trim() : '',
      userPersona: qs('#wb-user-persona').value.trim(),
      charName: (qs('#wb-char-name') && qs('#wb-char-name').value.trim()) || '{{char}}',
      charDescriptionSnapshot: pr.charDescriptionSnapshot || '',
      avatarUrl: qs('#wb-avatar-url') ? qs('#wb-avatar-url').value.trim() : '',
      summaryId: qs('#wb-summary-select').value || '',
      summarySnapshot: pr.summarySnapshot || null,
      selectedWorldEntries: matched
    });
    const preview = qs('#wb-char-desc-preview'); if (preview) preview.textContent = currentCharDescription(settings());
    toast('注入预设已按保存快照载入');
  }
  function deleteWorldPresetFromUI() { const idx=parseInt(qs('#wb-world-preset').value,10); const arr=worldPresets(); if(!arr[idx]) return; showConfirm('删除注入预设','确定删除这个注入预设吗？',()=>{ arr.splice(idx,1); saveWorldPresets(arr); renderSettings(); }); }

  async function applyWorldPresetToGame(pr) {
    if (!pr) return false;
    const matched = (pr.selectedWorldEntries || []).map(x => ({ label:x.label || '', content:x.content || '', wbName:x.wbName || '', uid:x.uid || '' }));
    setSettings({
      injectUserDesc: pr.injectUserDesc !== false,
      injectCharDesc: pr.injectCharDesc !== false,
      injectChat: !!pr.injectChat,
      intimacyMode: !!pr.intimacyMode,
      breakLimitPrompt: pr.breakLimitPrompt || '',
      userPersona: pr.userPersona || '',
      charName: pr.charName || '{{char}}',
      charDescriptionSnapshot: pr.charDescriptionSnapshot || '',
      avatarUrl: pr.avatarUrl || '',
      summaryId: pr.summaryId || '',
      summarySnapshot: pr.summarySnapshot || null,
      selectedWorldEntries: matched
    });
    refreshGameCompanionPanel();
    return true;
  }
  function refreshGameCompanionPanel() {
    const panel = qs('.wb-side-companion');
    if (panel) panel.innerHTML = companionHTML();
  }
  async function applyLinePresetSelection(game, value) {
    if (!value) return;
    if (value.indexOf('world::') === 0) {
      const pr = worldPresets()[parseInt(value.slice(7), 10)];
      const name = normalizePresetName(pr && pr.name);
      if (pr) await applyWorldPresetToGame(pr);
      setCurrentLinePreset(game, name);
      toast('已切换世界观/语录预设：' + name);
      speak(game, 'start');
      return;
    }
    const name = normalizePresetName(value.replace(/^line::/, ''));
    const pr = worldPresets().find(x => normalizePresetName(x.name) === name);
    if (pr) await applyWorldPresetToGame(pr);
    setCurrentLinePreset(game, name);
    toast(pr ? ('已切换语录并同步设定：' + name) : ('已切换语录：' + name));
    speak(game, 'start');
  }

  function renderGame(id) {
    stopGame();
    currentGame = id;
    if (GAME_META[id]) currentTab = GAME_META[id].mode;
    saveWindowState(currentTab, id);
    syncPopupModeClass();
    const g = GAME_META[id]; const cfg = settings(); const body = qs('#wb-body'); body.className = 'wb-body wb-game-mode';
    const lineTools = cfg.companion ? '<div class="wb-line-tools"><select class="wb-select" id="wb-line-preset-select"></select><button class="wb-btn primary" id="wb-generate-lines">语录</button><button class="wb-btn" id="wb-prompt-preview" title="查看生成语录提示词">?</button></div>' : '';
    const pauseBtn = g.mode === 'double' ? '' : '<button class="wb-btn" id="wb-pause">暂停</button>';
    const companionPanel = cfg.companion ? '<div class="wb-panel wb-side-companion">' + companionHTML() + '</div>' : '';
    body.innerHTML = '<div class="wb-layout ' + (cfg.companion ? '' : 'no-companion') + '"><div class="wb-panel"><div class="wb-toolbar"><button class="wb-btn" id="wb-back">返回</button><div class="wb-stat"><span class="wb-pill">' + esc(g.name) + '</span><span class="wb-pill" id="wb-score">本局：0</span><span class="wb-pill" id="wb-high">' + esc(scoreDisplay(id)) + '</span></div><div class="wb-actions">' + lineTools + '<button class="wb-btn" id="wb-game-records">记录</button>' + pauseBtn + '<button class="wb-btn" id="wb-restart">重开</button></div></div><div class="wb-board-wrap" id="wb-gamebox"><div class="wb-start-cover"><div>准备开始</div><button class="wb-btn primary" id="wb-start-cover-btn">开始游戏</button></div></div></div>' + companionPanel + '</div>';
    gameStarted = false; gamePaused = true;
    qs('#wb-back').onclick = () => { stopGame(); currentGame = null; saveWindowState(currentTab, ''); syncPopupModeClass(); renderSelect(currentTab); };
    qs('#wb-start-cover-btn').onclick = () => startCurrentGame(id);
    qs('#wb-game-records').onclick = () => showGameRecords(id);
    const pbtn = qs('#wb-pause'); if (pbtn) pbtn.onclick = togglePause;
    qs('#wb-restart').onclick = () => { gamePaused = true; showGamePauseOverlay(); const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '继续'; showConfirm('确认重开', '确定要重开当前游戏吗？当前进度会丢失。', () => { clearProgress(id); renderGame(id); }); };
    renderLinePresetSelect(id);
    const presetSelect = qs('#wb-line-preset-select'); if (presetSelect) presetSelect.onchange = () => applyLinePresetSelection(id, presetSelect.value);
    const genBtn = qs('#wb-generate-lines'); if (genBtn) genBtn.onclick = () => generateLines(id);
    const promptBtn = qs('#wb-prompt-preview'); if (promptBtn) promptBtn.onclick = () => showLinePromptPreview(id);
    speak(id, 'start');
    setTimeout(() => { const saved = gameProgress(id); if (currentGame === id && saved && !gameStarted) showProgressChoice(id, saved); }, 60);
  }

  function startCurrentGame(id, savedState) {
    if (gameStarted) return;
    const resumeState = savedState || (id === 'wordguess' ? gameProgress(id) : null);
    if (!resumeState) clearProgress(id);
    gameStarted = true;
    gamePaused = false;
    hideGamePauseOverlay();
    currentRoundRecord = false;
    gameStartAt = Date.now();
    const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '暂停';
    const coverBtn = qs('#wb-start-cover-btn'); if (coverBtn) coverBtn.style.display = 'none';
    if (randomLineTimer) clearInterval(randomLineTimer);
    randomLineTimer = setInterval(() => { if (currentGame && gameStarted && !gamePaused) speak(currentGame, 'random'); }, 22000);
    if (id === 'snake') startSnake(resumeState);
    if (id === 'jump') startJump(resumeState);
    if (id === 'game2048') start2048(resumeState);
    if (id === 'watermelon') startWatermelon(resumeState);
    if (id === 'memory') startMemory(resumeState);
    if (id === 'ludo') startLudo(resumeState);
    if (id === 'guessnumber') startGuessNumber(resumeState);
    if (id === 'wordguess') startWordGuess(resumeState);
    if (id === 'tictactoe') startTicTacToe(resumeState);
    if (id === 'gomoku') startGomoku(resumeState);
    if (id === 'territory') startTerritory(resumeState);
    if (id === 'oldmaid') startOldMaid(resumeState);
    if (id === 'tetris') startTetris(resumeState);
    scheduleFitGameSurface();
  }
  function togglePause() {
    if (!gameStarted) return;
    if (!gamePaused) {
      gamePaused = true;
      showGamePauseOverlay();
      const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '继续';
      return;
    }
    startPauseResumeCountdown();
  }
  function showConfirm(title, message, onConfirm) {
    const doc = getHostDocument();
    const old = qs('#wb-confirm-mask', doc); if (old) old.remove();
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-confirm-mask';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">' + esc(title) + '</div><div style="margin-bottom:14px;line-height:1.7;">' + esc(message) + '</div><div class="wb-actions"><button class="wb-btn primary" id="wb-confirm-ok">确定</button><button class="wb-btn" id="wb-confirm-cancel">取消</button></div></div>';
    appendModalMask(mask);
    qs('#wb-confirm-ok', mask).onclick = () => { mask.remove(); onConfirm && onConfirm(); };
    qs('#wb-confirm-cancel', mask).onclick = () => mask.remove();
  }

function showGameRecords(game, page) {
    page = Math.max(1, page || 1);
    const doc = getHostDocument();
    const old = qs('#wb-record-mask', doc); if (old) old.remove();
    const g = GAME_META[game] || { name: '游戏' };
    const hideScore = game === 'oldmaid' || game === 'jump';
    const arr = (records()[game] || []).map((r,i) => Object.assign({ id:'legacy_' + i }, r));
    const pageSize = 8, total = Math.max(1, Math.ceil(arr.length / pageSize));
    page = Math.min(page, total);
    const rows = arr.slice((page - 1) * pageSize, page * pageSize).map(r => { const score = hideScore ? '' : recordScoreDisplay(r); return '<tr data-id="' + esc(r.id) + '"><td title="' + esc(r.playedAt || '') + '">' + esc(r.playedAt || '') + '</td><td>' + esc(formatDuration(r.durationMs)) + '</td><td>' + esc(formatRecordResult(r.result)) + '</td><td class="wb-rec-score-col ' + (score ? '' : 'wb-rec-empty') + '" title="' + esc(score) + '">' + esc(score) + '</td><td title="' + esc(r.companion || '') + '">' + esc(r.companion || '未记录') + '</td><td>' + (r.log ? '<button class="wb-btn wb-log-view" data-id="' + esc(r.id) + '">查看</button>' : '<span class="wb-muted">无</span>') + '</td><td><div class="wb-actions"><button class="wb-btn wb-record-del" data-id="' + esc(r.id) + '">删除</button></div></td></tr>'; }).join('');
    const empty = '<tr><td colspan="' + (hideScore ? '6' : '7') + '" style="text-align:center;color:var(--wb-sub);padding:14px;">暂无游戏记录。</td></tr>';
    const mask = doc.createElement('div'); mask.className = modalMaskClass(); mask.id = 'wb-record-mask';
    mask.innerHTML = '<div class="wb-modal wb-summary-modal" style="width:min(860px,100%);"><div class="wb-modal-title">' + esc(g.name) + ' · 游戏记录</div><div class="wb-record-table-wrap"><table class="wb-record-table ' + (hideScore ? 'wb-no-score' : '') + '"><thead><tr><th>时间</th><th>用时</th><th>结果</th><th class="wb-rec-score-col">分数/胜负</th><th>陪伴者</th><th>日志</th><th>操作</th></tr></thead><tbody>' + (rows || empty) + '</tbody></table></div><div class="wb-actions" style="margin-top:12px;justify-content:space-between;"><div><button class="wb-btn" id="wb-record-prev">上一页</button><span class="wb-pill">' + page + ' / ' + total + '</span><button class="wb-btn" id="wb-record-next">下一页</button></div><button class="wb-btn" id="wb-record-close">关闭</button></div></div>';
    appendModalMask(mask);
    qs('#wb-record-close', mask).onclick = () => mask.remove();
    qs('#wb-record-prev', mask).onclick = () => showGameRecords(game, page - 1);
    qs('#wb-record-next', mask).onclick = () => showGameRecords(game, page + 1);
    qsa('.wb-log-view', mask).forEach(b => b.onclick = () => { const r = (records()[game] || []).find(x => x.id === b.dataset.id); if (r) showTextModal('游戏日志', r.log || ''); });
    qsa('.wb-record-del', mask).forEach(b => b.onclick = () => showConfirm('删除游戏记录', '确定删除这条记录吗？', () => { deleteRecord(game, b.dataset.id); showGameRecords(game, page); }));
  }

    function showTextModal(title, text) { const doc = getHostDocument(); const old = qs('#wb-text-mask', doc); if (old) old.remove(); const mask = doc.createElement('div'); mask.className = modalMaskClass(); mask.id = 'wb-text-mask'; mask.innerHTML = '<div class="wb-modal wb-summary-modal"><div class="wb-modal-title">' + esc(title) + '</div><div class="wb-api-status wb-text-segments" style="max-height:420px;overflow:auto;">' + textSegmentsHTML(text || '') + '</div><div class="wb-actions" style="margin-top:12px;justify-content:flex-end;"><button class="wb-btn" id="wb-text-close">关闭</button></div></div>'; appendModalMask(mask); qs('#wb-text-close', mask).onclick = () => mask.remove(); }
  function startContinueCountdown(mask, game, state) {
    const modal = qs('.wb-modal', mask) || mask;
    let left = 3;
    modal.innerHTML = '<div class="wb-modal-title">准备继续</div>'
      + '<div class="wb-countdown"><div class="wb-countdown-num" id="wb-progress-count">3</div><div class="wb-muted">秒后继续上次进度</div></div>'
      + '<div class="wb-actions"><button class="wb-btn" id="wb-count-cancel">取消</button></div>';
    const cancel = qs('#wb-count-cancel', mask);
    let timer = null;
    const finish = () => { if (timer) clearInterval(timer); if (mask && mask.parentNode) mask.remove(); startCurrentGame(game, state); };
    if (cancel) cancel.onclick = () => { if (timer) clearInterval(timer); if (mask && mask.parentNode) mask.remove(); };
    timer = setInterval(() => {
      left -= 1;
      const num = qs('#wb-progress-count', mask);
      if (num) num.textContent = String(Math.max(0, left));
      if (left <= 0) finish();
    }, 1000);
  }

  function startPauseResumeCountdown() {
    if (!gameStarted || !currentGame || !gamePaused) return;
    const doc = getHostDocument();
    const old = qs('#wb-resume-mask', doc); if (old) old.remove();
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-resume-mask';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">准备继续</div><div class="wb-countdown"><div class="wb-countdown-num" id="wb-resume-count">3</div><div class="wb-muted">秒后继续当前游戏</div></div><div class="wb-actions"><button class="wb-btn" id="wb-resume-cancel">取消</button></div></div>';
    appendModalMask(mask);
    let left = 3;
    let timer = null;
    const pbtn = qs('#wb-pause');
    if (pbtn) pbtn.disabled = true;
    const cleanup = () => { if (timer) clearInterval(timer); if (pbtn) pbtn.disabled = false; };
    const finish = () => {
      cleanup();
      if (mask && mask.parentNode) mask.remove();
      if (!gameStarted || !currentGame) return;
      gamePaused = false;
      hideGamePauseOverlay();
      const btn = qs('#wb-pause'); if (btn) btn.textContent = '暂停';
    };
    qs('#wb-resume-cancel', mask).onclick = () => {
      cleanup();
      if (mask && mask.parentNode) mask.remove();
      const btn = qs('#wb-pause'); if (btn) btn.textContent = '继续';
    };
    timer = setInterval(() => {
      left -= 1;
      const num = qs('#wb-resume-count', mask);
      if (num) num.textContent = String(Math.max(0, left));
      if (left <= 0) finish();
    }, 1000);
  }

  function showProgressChoice(game, state) {
    const doc = getHostDocument();
    const old = qs('#wb-progress-mask', doc); if (old) old.remove();
    const g = GAME_META[game] || { name: '游戏' };
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-progress-mask';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">发现上次进度</div><div style="margin-bottom:14px;line-height:1.8;">' + esc(g.name) + ' 有未结束的上一次进度，要继续还是重新开始？</div><div class="wb-actions"><button class="wb-btn primary" id="wb-progress-continue">继续上次</button><button class="wb-btn" id="wb-progress-new">重新开始</button></div></div>';
    appendModalMask(mask);
    qs('#wb-progress-continue', mask).onclick = () => { startContinueCountdown(mask, game, state); };
    qs('#wb-progress-new', mask).onclick = () => { mask.remove(); clearProgress(game); renderGame(game); };
  }

  function doubleTheaterFallback(game, outcome, special) {
    const name = companionName(); const win = outcome === 'user_win'; const score = outcome === 'score';
    const lead = special === 'win_streak3' ? '第三次胜利的提示音像夏夜烟火一样炸开，' + name + '把手背在身后，故意装作平静，却连耳尖都亮得明显。' : special === 'lose_streak3' ? '第三次失败落下时，房间安静了一瞬，' + name + '轻轻坐到你身边，把掌心覆在你的手背上。' : special === 'record' ? '新的记录跳出来那刻，' + name + '像看见秘密星座般睁大眼睛，笑意在睫毛下闪闪发亮。' : score ? '结算数字停住时，' + name + '用指尖轻轻点了点屏幕，像是在确认你刚才留下的轨迹。' : win ? '胜利弹窗亮起，' + name + '先是一怔，随后像藏不住心事的少女般笑了起来。' : '失败的字样浮现，' + name + '却没有责备，只把声音放得很轻，像黄昏落在窗边。';
    return [lead + '“这一次，我想把它记下来。”她靠近屏幕，袖口擦过你的手腕，语气柔软得像翻开的轻小说插画。游戏只是小小一局，可她望向你的眼神认真得过分，仿佛你们刚从一场盛大的冒险里并肩回来。', lead + '她弯下腰看着结果，发丝从肩头滑落，带着一点不肯服输的甜味。“再来一局的话，我还会陪你。”她这样说着，把刚才的胜负悄悄写进两个人才懂的回忆里。', lead + '屏幕的光映在她眼底，像细碎的樱花雨。她轻轻笑了一声，用近乎耳语的声音复盘刚才的瞬间，把胜负说成命运的恶作剧，也把你的名字放进最温柔的位置。'];
  }
  async function generateDoubleTheater(game, outcome, special, scoreText, cfgOverride) {
    const cfg = cfgOverride || settings(); const fallback = doubleTheaterFallback(game, outcome, special);
	    if (!cfg.apiUrl || !cfg.apiModel) return fallback;
	    const intimacyText = cfg.intimacyMode ? '开启。允许成年角色之间更亲近、更暧昧、更依赖，允许含蓄的NSFW暗示；禁止未成年人相关性内容、强迫、失控或违法内容。' : '关闭。保持自然陪伴和轻松亲近，禁止色情行为和露骨内容。';
	    const prefix = (cfg.breakLimitPrompt || '').trim();
	    const prompt = [prefix, ...(promptTemplates().theater || PROMPT_TEMPLATES.theater), '亲密氛围模式：' + intimacyText, '游戏：' + ((GAME_META[game] || {}).name || game), '结果：' + formatRecordResult(outcome), '特殊触发：' + (special || '普通胜负'), '分数/胜负：' + (scoreText || ''), '角色描述：' + currentCharDescription(cfg), '世界背景：' + (selectedWorldText(cfg) || '无'), '大总结：' + (selectedSummaryText(cfg) || '无')].filter(Boolean).join('\n');
	    try { const txt = await callApiText(cfg, prompt, promptTemplates().systems.theater || PROMPT_TEMPLATES.systems.theater); const arr = JSON.parse(txt); if (Array.isArray(arr) && arr.length) return arr.map(normalizeTheaterItem).filter(x => x.length).slice(0,3); } catch(e) { console.warn('[玩伴小屋] theater failed:', e); }
    return fallback;
  }
  function showTheaterModal(title, lines) { const arr = Array.isArray(lines) && lines.length ? lines : ['']; const text = arr[Math.floor(Math.random() * arr.length)]; showTextModal(title || '角色互动小剧场', normalizeTheaterItem(text)); }
  async function generateGameLog(game, recordId) {
    const cfg = settings(); const rec = (records()[game] || []).find(r => r.id === recordId); if (!rec) { toast('未找到游戏记录'); return ''; }
    const fallback = companionName() + '轻声回顾了这局' + ((GAME_META[game] || {}).name || '游戏') + '：' + (rec.scoreText || formatRecordResult(rec.result)) + '。短短几分钟像被折进一页日记，她把你的认真和遗憾都记了下来。';
    if (!cfg.apiUrl || !cfg.apiModel) { updateRecord(game, recordId, { log:fallback }); toast('已生成离线日志'); return fallback; }
	    const prompt = [...(promptTemplates().gameLog || PROMPT_TEMPLATES.gameLog),'游戏：' + ((GAME_META[game] || {}).name || game),'游戏情况：' + (rec.scoreText || '') + '，结果：' + formatRecordResult(rec.result) + '，用时：' + formatDuration(rec.durationMs),'陪伴者：' + (rec.companion || companionName()),'角色描述：' + currentCharDescription(cfg),'世界背景：' + (selectedWorldText(cfg) || '无'),'大总结：' + (selectedSummaryText(cfg) || '无')].join('\n');
	    let log = fallback; try { log = await callApiText(cfg, prompt, promptTemplates().systems.gameLog || PROMPT_TEMPLATES.systems.gameLog); } catch(e) { toast('日志生成失败，已使用本地日志'); } updateRecord(game, recordId, { log }); return log;
  }
  async function showGameOver(game, title, scoreText, result) {
    clearProgress(game);
    const doc = getHostDocument();
    const old = qs('#wb-gameover-mask', doc); if (old) old.remove();
    if (snakeTimer) clearInterval(snakeTimer);
    if (tetrisTimer) clearInterval(tetrisTimer);
    if (watermelonTimer) clearInterval(watermelonTimer);
    if (jumpTimer) clearInterval(jumpTimer);
    if (randomLineTimer) clearInterval(randomLineTimer);
    snakeTimer = tetrisTimer = watermelonTimer = jumpTimer = randomLineTimer = null;
    const inferred = result || inferResult(game, title, scoreText);
    const g = GAME_META[game] || { name: '游戏', unit: '分' };
    if (g.mode === 'double' && inferred === 'ta_win' && !result) addTaWin(game);
    const rec = recordGameResult(game, title, scoreText, inferred);
    const outcome = resultOutcome(inferred);
    let special = '';
    if (g.mode === 'double') { const streak = doubleStreak(game, outcome); if (outcome === 'user_win' && streak >= 3) special = 'win_streak3'; if (outcome === 'ta_win' && streak >= 3) special = 'lose_streak3'; if (outcome === 'user_win') special = special || 'record'; }
    else if (currentRoundRecord) special = 'record';
    gamePaused = true;
    gameStarted = false;
    const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '继续';
    const high = scoreDisplay(game);
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-gameover-mask';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">' + esc(title || '游戏结束') + '</div><div style="margin-bottom:14px;line-height:1.8;"><div>游戏：' + esc(g.name) + '</div><div>' + esc(scoreText || '本局分数：0' + g.unit) + '</div><div>' + esc(high) + '</div><div>陪伴者：' + esc(companionName()) + '</div></div><div class="wb-actions"><button class="wb-btn primary" id="wb-next-round">开启下一把</button><button class="wb-btn" id="wb-generate-log">生成日志</button><button class="wb-btn" id="wb-over-close">留在本局</button></div></div>';
    appendModalMask(mask);
    const cachedTheater = theaterCache[theaterCacheKey(game, outcome, special)] || doubleTheaterFallback(game, outcome, special);
    showTheaterModal(special ? '特殊角色互动小剧场' : '角色互动小剧场', cachedTheater);
    qs('#wb-generate-log', mask).onclick = async () => { const btn = qs('#wb-generate-log', mask); btn.disabled = true; btn.textContent = '生成中...'; const log = await generateGameLog(game, rec.id); btn.disabled = false; btn.textContent = '查看日志'; btn.onclick = () => showTextModal('游戏日志', log || ''); };
    qs('#wb-next-round', mask).onclick = () => { mask.remove(); renderGame(game); startCurrentGame(game); };
    qs('#wb-over-close', mask).onclick = () => mask.remove();
  }

  function renderLinePresetSelect(game) {
    const sel = qs('#wb-line-preset-select');
    if (!sel) return;
    const active = currentLinePreset(game);
    const names = presetNamesForGame(game);
    if (!names.includes(active)) names.push(active);
    const savedOptions = names.map(name => '<option value="line::' + esc(name) + '"' + (name === active ? ' selected' : '') + '>' + esc(name) + '</option>').join('');
    const worldOptions = worldPresets().map((pr, i) => '<option value="world::' + i + '">' + esc(pr.name || ('世界观预设' + (i + 1))) + '</option>').join('');
    sel.innerHTML = '<optgroup label="当前保存语录">' + savedOptions + '</optgroup>' + (worldOptions ? '<optgroup label="世界观预设">' + worldOptions + '</optgroup>' : '');
  }

  function companionHTML() {
    const cfg = settings();
    const ctx = getHostContext();
    const char = ctx && ctx.characters && ctx.characterId >= 0 ? ctx.characters[ctx.characterId] : (ctx && ctx.character ? ctx.character : null);
    const charData = char?.data || char || {};
    const name = cfg.charName && cfg.charName !== '{{char}}' ? cfg.charName : (charData.name || ctx?.name2 || '{{char}}');
    const avatar = findAvatar();
    const av = avatar ? '<img src="' + esc(avatar) + '" style="width:100%;height:100%;object-fit:cover">' : esc(name.slice(0,1));
    return '<div class="wb-companion ' + (cfg.companion ? 'on' : '') + '" id="wb-comp"><div class="wb-comp-row"><div class="wb-avatar">' + av + '</div><div class="wb-comp-main"><div class="wb-comp-name">' + esc(name) + '</div><div class="wb-speech" id="wb-speech">...</div></div></div></div>';
  }
  function findAvatar() {
    const fixed = (settings().avatarUrl || '').trim();
    if (fixed) return fixed;
    return findCurrentCardAvatar();
  }
  function findCurrentCardAvatar() {
    for (const s of ['#avatar_div img', '.mes[is_user="false"] .avatar img', '.last_mes .avatar img', '.avatar img']) {
      const img = qs(s); if (img && img.src) return img.src;
    }
    return '';
  }
  function speak(game, event) {
    const cfg = settings(); if (!cfg.companion) return;
    const set = activeLineSet(game);
    const arr = set[event] || set.random || (DEFAULT_LINES[game] && (DEFAULT_LINES[game][event] || DEFAULT_LINES[game].random)) || ['我在。'];
    const sp = qs('#wb-speech');
    if (sp) sp.textContent = arr[Math.floor(Math.random() * arr.length)].replace(/{{char}}/g, companionName()).replace(/{{user}}/g, cfg.userName);
  }

  function theaterCacheKey(game, outcome, special) { return companionName() + '::' + game + '::' + (outcome || 'score') + '::' + (special || 'normal'); }
  function clearTheaterCacheForGame(game) {
    const prefix = companionName() + '::' + game + '::';
    Object.keys(theaterCache).forEach(k => { if (k.indexOf(prefix) === 0) delete theaterCache[k]; });
  }
  async function preGenerateTheaters(game, cfgOverride) {
    clearTheaterCacheForGame(game);
    const g = GAME_META[game] || {};
    const jobs = g.mode === 'double'
      ? [['user_win','normal'], ['ta_win','normal'], ['draw','normal'], ['user_win','win_streak3'], ['ta_win','lose_streak3'], ['user_win','record']]
      : [['score','normal'], ['score','record']];
    await Promise.all(jobs.map(async ([outcome, special]) => { const key = theaterCacheKey(game, outcome, special === 'normal' ? '' : special); theaterCache[key] = await generateDoubleTheater(game, outcome, special === 'normal' ? '' : special, '预生成小剧场', cfgOverride); }));
  }

  function promptConfigForGame(game) {
    const cfg = settings();
    const select = qs('#wb-line-preset-select');
    let promptCfg = cfg;
    let preset = currentLinePreset(game);
    if (select && select.value && select.value.indexOf('world::') === 0) {
      const pr = worldPresets()[parseInt(select.value.slice(7), 10)];
      if (pr) { promptCfg = Object.assign({}, cfg, pr); preset = normalizePresetName(pr.name); }
    } else if (select && select.value) {
      preset = normalizePresetName(select.value.replace(/^line::/, ''));
      const pr = worldPresets().find(x => normalizePresetName(x.name) === preset);
      if (pr) promptCfg = Object.assign({}, cfg, pr);
    }
    return { cfg: promptCfg, preset };
  }
	  function showLinePromptPreview(game) {
	    const info = promptConfigForGame(game);
	    const system = promptTemplates().systems.lineGeneration || PROMPT_TEMPLATES.systems.lineGeneration;
	    const text = '【System】\n' + system + '\n\n【User】\n' + buildPrompt(game, info.cfg);
	    showTextModal('生成语录提示词 · ' + ((GAME_META[game] || {}).name || game) + ' / ' + info.preset, text);
	  }
  async function generateLines(game) {
    const cfg = settings(); const btn = qs('#wb-generate-lines'); if (!btn) return; btn.disabled = true; btn.textContent = '生成中';
    let preset = currentLinePreset(game);
    let promptCfg = cfg;
    try {
      const select = qs('#wb-line-preset-select');
      if (select && select.value && select.value.indexOf('world::') === 0) {
        const pr = worldPresets()[parseInt(select.value.slice(7), 10)];
        if (pr) { promptCfg = Object.assign({}, cfg, pr); preset = normalizePresetName(pr.name); }
      } else if (select && select.value) {
        preset = normalizePresetName(select.value.replace(/^line::/, ''));
        const pr = worldPresets().find(x => normalizePresetName(x.name) === preset);
        if (pr) promptCfg = Object.assign({}, cfg, pr);
      }
      setCurrentLinePreset(game, preset);
      let data = null;
      if (promptCfg.apiUrl && promptCfg.apiModel) {
        try { data = await callLineApiBatches(promptCfg, game); }
        catch(apiErr) { console.warn('[玩伴小屋] line API failed, fallback used:', apiErr); toast('语录API失败，已使用本地语录：' + (apiErr && apiErr.message ? apiErr.message : apiErr)); }
      }
      if (!data) data = fallbackGenerated(game, promptCfg);
      data = normalizeGeneratedLines(game, data);
      saveRoleLineSet(game, preset, data);
      renderLinePresetSelect(game);
      toast('已覆盖“' + companionName() + ' / ' + preset + '”的全部事件语录，正在重新生成小剧场');
      try { await preGenerateTheaters(game, promptCfg); toast('全部语录和小剧场已重新生成并覆盖'); }
      catch(theaterErr) { console.warn('[玩伴小屋] theater pregenerate failed:', theaterErr); toast('语录已保存，小剧场生成失败时会使用本地小剧场'); }
      speak(game, 'start');
    } catch(e) { console.error('[玩伴小屋] generateLines failed:', e); toast('生成失败：' + (e && e.message ? e.message : '响应无法解析')); }
    finally { btn.disabled = false; btn.textContent = '生成语录'; }
  }
	  function buildPrompt(game, cfg, eventKeys) {
	    const keys = eventKeys && eventKeys.length ? eventKeys : Object.keys(DEFAULT_LINES[game] || {});
	    const events = keys.join(', ');
	    const tpl = promptTemplates().lineGeneration || PROMPT_TEMPLATES.lineGeneration;
	    const userDesc = currentUserDescription(cfg);
    const charDesc = currentCharDescription(cfg);
    const chatDesc = cfg.injectChat ? '请参考当前最新聊天记录的关系氛围（插件不直接上传聊天全文时按此要求处理）' : '不注入';
    const wbText = selectedWorldText(cfg) || '无';
    const summaryText = selectedSummaryText(cfg) || '无';
    const recentLogs = recentGameLogs(game) || '无';
    const intimacyText = cfg.intimacyMode ? '开启。允许成年角色之间更亲近、更暧昧、更依赖，允许含蓄的NSFW暗示；禁止未成年人相关性内容、强迫、失控或违法内容。' : '关闭。保持自然陪伴和轻松亲近，禁止色情行为和露骨内容。';
	    const prefix = (cfg.breakLimitPrompt || '').trim();
	    return [
	      prefix,
	      ...(tpl.header || []),
	      '游戏：' + GAME_META[game].name,
      '事件键：' + events,
      '事件键解释：\n' + eventDescriptionBlock(game, keys),
      '【用户设定描述】\n' + userDesc,
      '【角色描述】\n' + charDesc,
      '【注入最新聊天记录】\n' + chatDesc,
      '【当前挂载的世界书】\n' + wbText,
      '【导入大总结】\n' + summaryText,
	      '【最近5条游戏日志】\n' + recentLogs,
	      '【亲密氛围模式】\n' + intimacyText,
	      ...(tpl.rules || []),
	      ...(tpl.output || [])
	    ].filter(Boolean).join('\n');
	  }
  function apiChatUrl(url) {
    let base = (url || '').trim();
    if (!base) return '';
    if (/\/chat\/completions\/?$/.test(base)) return base;
    base = base.endsWith('/') ? base : base + '/';
    if (!base.includes('/v1/') && !base.endsWith('v1/')) base += 'v1/';
    return base + 'chat/completions';
  }
  function stripJsonFence(text) {
    let s = String(text || '').trim();
    const fence = String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96);
    s = s.replace(new RegExp('^\\s*' + fence + '(?:json)?\\s*', 'i'), '').replace(new RegExp('\\s*' + fence + '\\s*$', 'i'), '').trim();
    return s;
  }
  function extractJsonCandidate(s) {
    const firstObj = s.indexOf('{'), firstArr = s.indexOf('[');
    let start = -1;
    if (firstObj >= 0 && (firstArr < 0 || firstObj < firstArr)) start = firstObj;
    else if (firstArr >= 0) start = firstArr;
    if (start < 0) return '';
    const stack = [];
    let quote = '', escNext = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (escNext) { escNext = false; continue; }
      if (ch === '\\') { escNext = true; continue; }
      if (quote) { if (ch === quote) quote = ''; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') {
        if (stack[stack.length - 1] !== ch) return '';
        stack.pop();
        if (!stack.length) return s.slice(start, i + 1);
      }
    }
    return s.slice(start);
  }
  function parseGeneratedJson(text) {
    let s = stripJsonFence(text);
    try { return JSON.parse(s); } catch(e) {}
    const sub = extractJsonCandidate(s);
    if (sub) {
      try { return JSON.parse(sub); } catch(e2) {}
    }
    throw new Error('AI返回内容不是可解析JSON');
  }
  function normalizeGeneratedLines(game, data) {
    const events = Object.keys(DEFAULT_LINES[game] || {});
    const out = {};
    events.forEach(k => {
      let v = data && data[k];
      if (typeof v === 'string') v = [v];
      if (!Array.isArray(v)) v = [];
      v = v.map(x => String(x == null ? '' : x).trim()).filter(Boolean);
      if (!v.length) v = (DEFAULT_LINES[game] && DEFAULT_LINES[game][k]) || ['我在。'];
      out[k] = v;
    });
    return out;
  }
  async function fetchWithTimeout(url, options, timeoutMs) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs || 45000) : null;
    try {
      return await fetch(url, Object.assign({}, options || {}, ctrl ? { signal: ctrl.signal } : {}));
    } catch(e) {
      if (e && e.name === 'AbortError') throw new Error('API请求超时，请检查移动端网络或API地址');
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async function callApi(cfg, prompt) {
    const url = apiChatUrl(cfg.apiUrl);
    if (!url) throw new Error('请先配置API基础URL');
    if (!cfg.apiModel) throw new Error('请先选择模型');
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
    const res = await fetchWithTimeout(url, {
      method: 'POST', headers,
      body: JSON.stringify({ model: cfg.apiModel, messages: [{ role: 'system', content: promptTemplates().systems.lineGeneration || PROMPT_TEMPLATES.systems.lineGeneration }, { role: 'user', content: prompt }], temperature: 0.85, max_tokens: 6144 })
    }, 60000);
    if (!res.ok) { const t = await res.text().catch(()=> ''); throw new Error('API错误 ' + res.status + ': ' + t.slice(0, 120)); }
    const json = await res.json();
    const txt = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || json.output_text || '';
    if (!txt) throw new Error('API响应格式异常');
    return parseGeneratedJson(txt);
  }
  async function callLineApiBatches(cfg, game) {
    const keys = Object.keys(DEFAULT_LINES[game] || {});
    const merged = {};
    const errors = [];
    const batchSize = 4;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      try {
        const data = await callApi(cfg, buildPrompt(game, cfg, batch));
        batch.forEach(k => {
          if (data && data[k] != null) merged[k] = data[k];
        });
      } catch (e) {
        errors.push(e);
        console.warn('[玩伴小屋] line batch failed:', batch.join(','), e);
      }
    }
    if (!Object.keys(merged).length && errors.length) throw errors[0];
    return merged;
  }
  function fallbackGenerated(game, cfg) { const who = currentCharDescription(cfg).includes('未读取') ? '我陪你' : '按现在的语气陪你'; const out = {}; Object.keys(DEFAULT_LINES[game]).forEach(k => out[k] = [who + '，这一刻我记下了。', '别急，下一步更重要。', '这局还没结束，继续。', '我在旁边看着你，这一步很稳。', '这个节奏可以，先保持住。', '我们再把这一局往前推一点。']); return out; }
  function setScore(game, value) {
    const g = GAME_META[game] || {};
    const sc = scores();
    if (g.mode === 'double') {
      const cur = sc[game] && typeof sc[game] === 'object' ? sc[game] : { user: sc[game] || 0, ta: 0 };
      if (value > (cur.user || 0)) cur.user = value;
      sc[game] = cur; saveJSON(STORAGE_SCORES, sc);
      const h = qs('#wb-high'); if (h) h.textContent = scoreDisplay(game);
    } else {
      const old = sc[game] || 0;
      if (value > old) { sc[game] = value; saveJSON(STORAGE_SCORES, sc); if (!currentRoundRecord && old > 0 && DEFAULT_LINES[game] && DEFAULT_LINES[game].record) { currentRoundRecord = true; speak(game, 'record'); } }
    }
    const s = qs('#wb-score'); if (s) s.textContent = '本局：' + value;
  }

  function startSnake(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<div class="wb-snake-shell"><canvas class="wb-canvas" id="wb-canvas" width="420" height="420"></canvas><div class="wb-snake-controls" aria-label="贪吃蛇方向键"><button class="wb-btn up" data-dir="up" type="button">▲</button><button class="wb-btn left" data-dir="left" type="button">◀</button><button class="wb-btn down" data-dir="down" type="button">▼</button><button class="wb-btn right" data-dir="right" type="button">▶</button></div></div>';
    const c = qs('#wb-canvas'), ctx = c.getContext('2d'), n = 21, size = 20;
    let snake = Array.isArray(state?.snake) && state.snake.length ? state.snake : [{x:10,y:10}];
    let dir = state?.dir || {x:1,y:0}, next = state?.next || dir, food = state?.food || randFood(), score = state?.score || 0, dead = false;
    setScore('snake', score);
    function randFood(){ let p; do { p = {x:Math.floor(Math.random()*n), y:Math.floor(Math.random()*n)}; } while(snake.some(s=>s.x===p.x&&s.y===p.y)); return p; }
    function save(){ if (!dead) saveProgress('snake', { snake, dir, next, food, score }); }
    function setSnakeDir(name){ const m={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[name]; if(m && (m.x !== -dir.x || m.y !== -dir.y)){ next=m; speak('snake','turn'); save(); } }
    getHostDocument().onkeydown = e => { const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key]; if(k){ setSnakeDir(k); e.preventDefault(); } };
    addSwipe(box, setSnakeDir);
    qsa('.wb-snake-controls .wb-btn', box).forEach(btn => btn.onclick = e => { e.preventDefault(); setSnakeDir(btn.dataset.dir); });
    function snakeDelay(){ return Math.max(55, 150 - Math.floor(score / 10) * 6); }
    function scheduleSnake(){ if(!dead) snakeTimer = setTimeout(stepSnake, snakeDelay()); }
    function stepSnake(){ if(dead) return; if(gamePaused){ scheduleSnake(); return; } dir = next; const h = {x: snake[0].x + dir.x, y: snake[0].y + dir.y}; if(h.x<0||h.y<0||h.x>=n||h.y>=n||snake.some(s=>s.x===h.x&&s.y===h.y)){ dead=true; speak('snake','gameover'); showGameOver('snake', '游戏结束', '本局分数：' + score + '分'); return; } const nearWall=h.x<=1||h.y<=1||h.x>=n-2||h.y>=n-2, nearSelf=snake.slice(1).some(s=>Math.abs(s.x-h.x)+Math.abs(s.y-h.y)<=1); if((nearWall||nearSelf) && Math.random()<.08) speak('snake','close_call'); snake.unshift(h); if(h.x===food.x&&food.y===h.y){ score += 10; setScore('snake', score); const eaten = score/10; if(eaten===1) speak('snake','eat_1'); if([5,10,20].includes(eaten)) speak('snake','eat_'+eaten); if(eaten>1 && eaten%4===0) speak('snake','speed_up'); food=randFood(); } else snake.pop(); draw(); save(); scheduleSnake(); }
    scheduleSnake();
    function draw(){
      const night = settings().theme === 'night';
      ctx.fillStyle = night ? '#000' : '#fff';
      ctx.fillRect(0,0,420,420);
      ctx.strokeStyle = night ? 'rgba(255,255,255,.06)' : 'rgba(102,75,60,.12)';
      ctx.lineWidth = 1;
      for(let i=0;i<=n;i++){ const p=i*size+.5; ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,420); ctx.moveTo(0,p); ctx.lineTo(420,p); ctx.stroke(); }
      ctx.strokeStyle = night ? 'rgba(255,255,255,.2)' : 'rgba(80,55,48,.2)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5,1.5,417,417);
      const fx = food.x*size + size/2, fy = food.y*size + size/2;
      ctx.fillStyle = '#ef8f7a';
      ctx.beginPath(); ctx.arc(fx, fy, 8.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd4c8';
      ctx.beginPath(); ctx.arc(fx-3, fy-3, 2.4, 0, Math.PI*2); ctx.fill();
      snake.forEach((s,i)=>{
        const x=s.x*size+2, y=s.y*size+2, r=7;
        ctx.fillStyle = i===0 ? '#76c7b5' : (i%2 ? '#9ccbbb' : '#8fc5ad');
        ctx.beginPath();
        ctx.moveTo(x+r,y); ctx.lineTo(x+16-r,y); ctx.quadraticCurveTo(x+16,y,x+16,y+r); ctx.lineTo(x+16,y+16-r); ctx.quadraticCurveTo(x+16,y+16,x+16-r,y+16); ctx.lineTo(x+r,y+16); ctx.quadraticCurveTo(x,y+16,x,y+16-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.fill();
        if(i===0){ ctx.fillStyle=night?'#101010':'#fffaf2'; const ex1=x+7+(dir.x*3)+(dir.y*-3), ey1=y+7+(dir.y*3)+(dir.x*3), ex2=x+9+(dir.x*3)+(dir.y*3), ey2=y+9+(dir.y*3)+(dir.x*-3); ctx.beginPath(); ctx.arc(ex1,ey1,1.7,0,Math.PI*2); ctx.arc(ex2,ey2,1.7,0,Math.PI*2); ctx.fill(); }
      });
    }
    draw(); save();
  }

  function startJump(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<canvas class="wb-canvas wb-jump-canvas" id="wb-jump" width="520" height="640"></canvas>';
    const c = qs('#wb-jump'), ctx = c.getContext('2d');
    const W = 520, H = 640;
    let score = state?.score || 0;
    let seen = state?.seen || {};
    let dead = false;
    let charging = false;
    let charge = 0;
    let chargeDir = 1;
    let flight = null;
    let platforms = Array.isArray(state?.platforms) && state.platforms.length >= 2 ? state.platforms : [
      { x: 170, y: 440, r: 48, h: 54, c: '#7fc6b2' },
      makePlatform(330, 275, 0)
    ];
    let player = state?.player || { x: platforms[0].x, y: standY(platforms[0]), z: 0 };
    if (state?.player && Math.abs(player.y - standY(platforms[0])) > 28 && !state?.flight) player.y = standY(platforms[0]);
    setScore('jump', score);
    if (!seen.start) { seen.start = 1; speak('jump', 'start'); }
    function standY(p) { return p.y - 8; }
    function makePlatform(x, y, i) {
      const colors = ['#f2b36f', '#74a9d8', '#d86f7f', '#8bc47a', '#b98bd8'];
      return { x, y, r: 38 + Math.floor(Math.random() * 18), h: 46 + Math.floor(Math.random() * 22), c: colors[i % colors.length] };
    }
    function nextPlatform(from, i) {
      const side = Math.random() < .5 ? -1 : 1;
      const dx = side * (120 + Math.random() * 95);
      const dy = -(105 + Math.random() * 80);
      return makePlatform(Math.max(96, Math.min(W - 96, from.x + dx)), Math.max(160, from.y + dy), i);
    }
    function save() {
      if (!dead) saveProgress('jump', { score, platforms, player, seen });
    }
    function pointerDown(e) {
      if (dead || gamePaused || flight || charging) return;
      e.preventDefault();
      charging = true;
      charge = 0;
      chargeDir = 1;
      if (!seen.charge) { seen.charge = 1; speak('jump', 'charge'); }
    }
    function pointerUp(e) {
      if (!charging || dead) return;
      e.preventDefault();
      charging = false;
      startFlight();
    }
    c.addEventListener('pointerdown', pointerDown);
    c.addEventListener('pointerup', pointerUp);
    c.addEventListener('pointercancel', pointerUp);
    c.addEventListener('pointerleave', pointerUp);
    getHostDocument().onkeydown = e => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (!charging) pointerDown(e);
      }
    };
    getHostDocument().onkeyup = e => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        pointerUp(e);
      }
    };
    function startFlight() {
      const from = platforms[0], to = platforms[1];
      const vx = to.x - from.x, vy = standY(to) - standY(from);
      const dist = Math.max(1, Math.hypot(vx, vy));
      const power = 72 + charge * 230;
      const ratio = power / dist;
      flight = {
        t: 0,
        sx: player.x,
        sy: player.y,
        ex: player.x + vx * ratio,
        ey: player.y + vy * ratio,
        target: to
      };
      if (!seen.jump) { seen.jump = 1; speak('jump', 'jump'); }
      charge = 0;
      save();
    }
    function finishFlight() {
      const to = flight.target;
      player.x = flight.ex;
      player.y = flight.ey;
      player.z = 0;
      flight = null;
      const d = Math.hypot(player.x - to.x, player.y - standY(to));
      if (d <= to.r * .72) {
        const perfect = d <= to.r * .22;
        score += perfect ? 2 : 1;
        setScore('jump', score);
        speak('jump', perfect ? 'perfect' : 'land');
        platforms = [to, nextPlatform(to, score)];
        const dx = 170 - platforms[0].x, dy = 440 - platforms[0].y;
        platforms.forEach(p => { p.x += dx; p.y += dy; });
        player.x = platforms[0].x;
        player.y = standY(platforms[0]);
        save();
      } else {
        dead = true;
        clearInterval(jumpTimer);
        jumpTimer = null;
        speak('jump', 'gameover');
        showGameOver('jump', '游戏结束', '本局分数：' + score + '分');
      }
    }
    function loop() {
      if (dead) return;
      if (!gamePaused) {
        if (charging) {
          charge += chargeDir * .035;
          if (charge >= 1) { charge = 1; chargeDir = -1; }
          if (charge <= 0) { charge = 0; chargeDir = 1; }
        }
        if (flight) {
          flight.t = Math.min(1, flight.t + .045);
          const t = flight.t;
          player.x = flight.sx + (flight.ex - flight.sx) * t;
          player.y = flight.sy + (flight.ey - flight.sy) * t;
          player.z = Math.sin(Math.PI * t) * 118;
          if (t >= 1) finishFlight();
        }
      }
      draw();
    }
    function drawBlock(p) {
      const night = settings().theme === 'night';
      ctx.save();
      ctx.fillStyle = night ? 'rgba(0,0,0,.38)' : 'rgba(65,45,35,.16)';
      ctx.beginPath();
      ctx.ellipse(p.x + 9, p.y + 18, p.r * 1.15, p.r * .42, 0, 0, Math.PI * 2);
      ctx.fill();
      const side = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      side.addColorStop(0, shade(p.c, -.12));
      side.addColorStop(1, shade(p.c, -.38));
      ctx.fillStyle = side;
      ctx.beginPath();
      ctx.moveTo(p.x - p.r, p.y);
      ctx.quadraticCurveTo(p.x, p.y + p.r * .42, p.x + p.r, p.y);
      ctx.lineTo(p.x + p.r, p.y + p.h);
      ctx.quadraticCurveTo(p.x, p.y + p.h + p.r * .42, p.x - p.r, p.y + p.h);
      ctx.closePath();
      ctx.fill();
      const top = ctx.createRadialGradient(p.x - p.r * .35, p.y - p.r * .18, 5, p.x, p.y, p.r);
      top.addColorStop(0, shade(p.c, .22));
      top.addColorStop(1, p.c);
      ctx.fillStyle = top;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * .42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = night ? 'rgba(255,255,255,.2)' : 'rgba(57,44,38,.22)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    function shade(hex, amt) {
      const n = parseInt(hex.slice(1), 16);
      const r = Math.max(0, Math.min(255, (n >> 16) + 255 * amt));
      const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + 255 * amt));
      const b = Math.max(0, Math.min(255, (n & 255) + 255 * amt));
      return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
    }
    function drawPlayer() {
      const press = charging && !flight ? charge : 0;
      const x = player.x, footY = player.y - player.z + press * 10;
      const bodyH = 48 - press * 13;
      const bodyW = 31 + press * 7;
      const headR = 13 - press * 2;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath();
      ctx.ellipse(player.x, player.y + 8, 21 + press * 8, 7 + press * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#47354d';
      ctx.beginPath();
      ctx.ellipse(x - 8, footY + 1, 8, 4, -.15, 0, Math.PI * 2);
      ctx.ellipse(x + 8, footY + 1, 8, 4, .15, 0, Math.PI * 2);
      ctx.fill();
      const body = ctx.createLinearGradient(x - bodyW / 2, footY - bodyH, x + bodyW / 2, footY);
      body.addColorStop(0, '#ffe2c8');
      body.addColorStop(.42, '#ee8c78');
      body.addColorStop(1, '#9b4f69');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.roundRect(x - bodyW / 2, footY - bodyH, bodyW, bodyH, 14);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath();
      ctx.moveTo(x - bodyW / 2 + 7, footY - bodyH + 8);
      ctx.quadraticCurveTo(x - 2, footY - bodyH + 1, x + bodyW / 2 - 8, footY - bodyH + 10);
      ctx.strokeStyle = 'rgba(255,255,255,.42)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#f6c8a7';
      ctx.beginPath();
      ctx.arc(x, footY - bodyH - headR + 5, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2f3f';
      ctx.beginPath();
      ctx.arc(x, footY - bodyH - headR, headR + 2, Math.PI * .92, Math.PI * 2.05);
      ctx.quadraticCurveTo(x + 9, footY - bodyH - 9, x + 6, footY - bodyH + 2);
      ctx.quadraticCurveTo(x - 7, footY - bodyH - 4, x - headR - 1, footY - bodyH - headR + 6);
      ctx.fill();
      ctx.fillStyle = '#2f3340';
      ctx.beginPath();
      ctx.arc(x - 5, footY - bodyH - headR + 6, 2, 0, Math.PI * 2);
      ctx.arc(x + 6, footY - bodyH - headR + 6, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8d5661';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(x - 5, footY - bodyH - headR + 14);
      ctx.quadraticCurveTo(x, footY - bodyH - headR + 17, x + 6, footY - bodyH - headR + 14);
      ctx.stroke();
      ctx.restore();
    }
    function drawHud() {
      const night = settings().theme === 'night';
      ctx.fillStyle = night ? 'rgba(255,255,255,.86)' : 'rgba(28,24,22,.9)';
      ctx.font = '700 24px system-ui, -apple-system, sans-serif';
      ctx.fillText(String(score), 28, 42);
      ctx.font = '500 15px system-ui, -apple-system, sans-serif';
      ctx.fillText(charging ? '松手起跳' : '按住蓄力', 28, 68);
      ctx.fillStyle = night ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.12)';
      ctx.fillRect(28, 84, 150, 8);
      ctx.fillStyle = '#f08a6c';
      ctx.fillRect(28, 84, 150 * charge, 8);
    }
    function draw() {
      const night = settings().theme === 'night';
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, night ? '#050816' : '#e9f8ff');
      bg.addColorStop(1, night ? '#000' : '#fff');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = night ? 'rgba(255,255,255,.06)' : 'rgba(116,172,189,.18)';
      for (let i = 0; i < 7; i++) {
        const x = 40 + i * 88, y = 130 + (i % 3) * 42;
        ctx.beginPath();
        ctx.ellipse(x, y, 45, 12, -.12, 0, Math.PI * 2);
        ctx.fill();
      }
      platforms.slice().sort((a,b)=>a.y-b.y).forEach(drawBlock);
      drawPlayer();
      drawHud();
      if (gamePaused) {
        ctx.fillStyle = night ? 'rgba(0,0,0,.54)' : 'rgba(255,255,255,.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = night ? '#fff' : '#1d1a18';
        ctx.font = '800 38px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSE', W / 2, H / 2);
        ctx.textAlign = 'left';
      }
    }
    clearInterval(jumpTimer);
    jumpTimer = setInterval(loop, 32);
    draw();
    save();
  }

  function start2048(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<div class="wb-grid2048" id="wb-2048"></div>';
    let board = Array.isArray(state?.board) && state.board.length === 16 ? state.board : Array(16).fill(0), score = state?.score || 0, seen = state?.seen || {};
    if (!state?.board) { add(); add(); }
    draw(); save();
    getHostDocument().onkeydown = e => { const dirs = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'}; if(dirs[e.key]){ e.preventDefault(); move(dirs[e.key]); } };
    addSwipe(box, move);
    function save(){ saveProgress('game2048', { board, score, seen }); }
    function add(){ const empt=board.map((v,i)=>v?null:i).filter(v=>v!==null); if(empt.length) board[empt[Math.floor(Math.random()*empt.length)]] = Math.random()<.9?2:4; }
    function rows(dir){ const r=[]; for(let y=0;y<4;y++) r.push([0,1,2,3].map(x=>y*4+x)); if(dir==='right') r.forEach(a=>a.reverse()); if(dir==='up'||dir==='down'){ r.length=0; for(let x=0;x<4;x++) r.push([0,1,2,3].map(y=>y*4+x)); if(dir==='down') r.forEach(a=>a.reverse()); } return r; }
    function move(dir){ if (gamePaused) return; const old=board.join(','); rows(dir).forEach(idx=>{ let vals=idx.map(i=>board[i]).filter(Boolean); for(let i=0;i<vals.length-1;i++) if(vals[i]===vals[i+1]){ vals[i]*=2; score+=vals[i]; vals.splice(i+1,1); } while(vals.length<4) vals.push(0); idx.forEach((p,i)=>board[p]=vals[i]); }); if(board.join(',')!==old){ if(!seen.move){ seen.move=1; speak('game2048','move'); } add(); if(!seen.stuck && board.filter(Boolean).length>=13){ seen.stuck=1; speak('game2048','stuck'); } draw(); save(); } if(!board.includes(0) && !canMove()) { speak('game2048','gameover'); showGameOver('game2048', '游戏结束', '本局分数：' + score + '分'); } }
    function canMove(){ return rows('left').some(idx=>idx.some((p,i)=>i<3 && board[p]===board[idx[i+1]])) || rows('up').some(idx=>idx.some((p,i)=>i<3 && board[p]===board[idx[i+1]])); }
    function draw(){ setScore('game2048', score); const grid=qs('#wb-2048'); grid.innerHTML=board.map(v=>'<div class="wb-tile" style="background:' + tileColor(v) + ';font-size:' + (v>999?22:28) + 'px">' + (v||'') + '</div>').join(''); [64,128,256,512,1024,2048].forEach(v=>{ if(board.includes(v)&&!seen[v]){ seen[v]=1; speak('game2048','tile_'+v); } }); }
    function tileColor(v){ return ({0:'#cdc0b6',2:'#eee4da',4:'#ead8c7',8:'#efb07e',16:'#ec9368',32:'#e87865',64:'#e95f51',128:'#e4c16d',256:'#dfb954',512:'#d7ac3f',1024:'#cfa02f',2048:'#9ccbbb'})[v] || '#40342f'; }
  }

  function startTicTacToe(state) {
    const box = qs('#wb-gamebox');
    let b = Array.isArray(state?.b) && state.b.length === 9 ? state.b : Array(9).fill(''), over=false;
    box.innerHTML = '<div class="wb-board3">' + b.map((_,i)=>'<button class="wb-cell" data-i="'+i+'"></button>').join('') + '</div>';
    draw(); save();
    qsa('.wb-cell', box).forEach(cell => cell.onclick = () => { const i=+cell.dataset.i; if(gamePaused||over||b[i]) return; b[i]='X'; if(i===4) speak('tictactoe','user_center'); else if([0,2,6,8].includes(i)) speak('tictactoe','user_corner'); draw(); if(done()) return; ai(); draw(); if(!done()) save(); });
    function save(){ saveProgress('tictactoe', { b }); }
    function ai(){ const i = bestTic(b,'O') ?? bestTic(b,'X') ?? [4,0,2,6,8,1,3,5,7].find(i=>!b[i]); if(i!=null){ if(bestTic(b,'X')===i) speak('tictactoe','ai_block'); b[i]='O'; } }
    function done(){ const w=winner3(b); if(w||b.every(Boolean)){ over=true; if(w==='X'){ { const curScore = scores().tictactoe; setScore('tictactoe', ((curScore && typeof curScore === 'object' ? curScore.user : curScore) || 0) + 1); } speak('tictactoe','user_win'); showGameOver('tictactoe', '你赢了', '本局分数：1胜'); } else if(w==='O') { speak('tictactoe','user_lose'); showGameOver('tictactoe', '游戏结束', '本局分数：0胜（失败）'); } else { speak('tictactoe','draw'); showGameOver('tictactoe', '平局', '本局分数：0胜（平局）'); } return true; } return false; }
    function draw(){ qsa('.wb-cell', box).forEach((c,i)=>c.textContent=b[i]); }
  }
  function bestTic(b, m){ const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for(const w of wins){ const vals=w.map(i=>b[i]); if(vals.filter(v=>v===m).length===2 && vals.includes('')) return w[vals.indexOf('')]; } return null; }
  function winner3(b){ const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for(const w of wins) if(b[w[0]]&&b[w[0]]===b[w[1]]&&b[w[1]]===b[w[2]]) return b[w[0]]; return ''; }

  function startGomoku(state) {
    const box = qs('#wb-gamebox'), n=15;
    let b = Array.isArray(state?.b) && state.b.length === n*n ? state.b : Array(n*n).fill(''), over=false;
    box.innerHTML = '<div class="wb-gomoku">' + b.map((_,i)=>'<button class="wb-gcell" data-i="'+i+'"></button>').join('') + '</div>';
    draw(); save();
    qsa('.wb-gcell', box).forEach(cell => cell.onclick = () => { const i=+cell.dataset.i; if(gamePaused||over||b[i]) return; b[i]='B'; if(lineScore(b,n,i,'B')>=125) speak('gomoku','user_three'); draw(); if(done('B')) return; const ai=bestGomoku(b,n); if(ai>=0){ b[ai]='W'; if(lineScore(b,n,ai,'W')>=80) speak('gomoku','ai_threat'); draw(); if(!done('W')) save(); } });
    function save(){ saveProgress('gomoku', { b }); }
    function done(m){ if(winG(b,n,m)){ over=true; if(m==='B'){ { const curScore = scores().gomoku; setScore('gomoku', ((curScore && typeof curScore === 'object' ? curScore.user : curScore) || 0) + 1); } speak('gomoku','user_win'); showGameOver('gomoku', '你赢了', '本局分数：1胜'); } else { speak('gomoku','user_lose'); showGameOver('gomoku', '游戏结束', '本局分数：0胜（失败）'); } return true; } if(b.every(Boolean)){ over=true; speak('gomoku','draw'); showGameOver('gomoku', '平局', '本局分数：0胜（平局）'); return true; } return false; }
    function draw(){ qsa('.wb-gcell', box).forEach((c,i)=>{ c.className='wb-gcell' + (b[i]==='B'?' black':b[i]==='W'?' white':''); }); }
  }
  function bestGomoku(b,n){ const empty=b.map((v,i)=>v?'':i).filter(v=>v!==''); let best=-1, bestScore=-1; for(const i of empty){ let score=lineScore(b,n,i,'W')*1.1 + lineScore(b,n,i,'B'); if(score>bestScore){ bestScore=score; best=i; } } if(bestScore>=80) speak('gomoku','ai_block'); return best; }
  function lineScore(b,n,i,m){ const x=i%n,y=Math.floor(i/n), dirs=[[1,0],[0,1],[1,1],[1,-1]]; let total=0; for(const [dx,dy] of dirs){ let c=1; for(const s of [-1,1]){ let nx=x+dx*s, ny=y+dy*s; while(nx>=0&&ny>=0&&nx<n&&ny<n&&b[ny*n+nx]===m){ c++; nx+=dx*s; ny+=dy*s; } } total += Math.pow(5,c); } return total; }
  function winG(b,n,m){ for(let y=0;y<n;y++) for(let x=0;x<n;x++) if(b[y*n+x]===m) for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){ let c=0; for(let k=0;k<5;k++){ const nx=x+dx*k, ny=y+dy*k; if(nx>=0&&ny>=0&&nx<n&&ny<n&&b[ny*n+nx]===m) c++; } if(c===5) return true; } return false; }

  function startTerritory(state) {
    const box = qs('#wb-gamebox'), N = 5;
    const makeH = () => Array.from({length:N+1}, () => Array(N).fill(''));
    const makeV = () => Array.from({length:N}, () => Array(N+1).fill(''));
    const makeO = () => Array.from({length:N}, () => Array(N).fill(''));
    let h = Array.isArray(state?.h) && state.h.length === N+1 ? state.h : makeH();
    let v = Array.isArray(state?.v) && state.v.length === N ? state.v : makeV();
    let owner = Array.isArray(state?.owner) && state.owner.length === N ? state.owner : makeO();
    let turn = state?.turn || 'user', userScore = state?.userScore || 0, taScore = state?.taScore || 0, busy = false, over = false, chain = 0;
    box.innerHTML = '<div class="wb-territory-panel"><div class="wb-territory-info"><span class="wb-pill" id="wb-territory-turn"></span><span class="wb-pill" id="wb-territory-score"></span></div><div class="wb-territory-board" id="wb-territory-board"></div></div>';
    draw(); save(); speak('territory','start');
    if(turn === 'ta') setTimeout(robot, 500);
    function save(){ if(!over) saveProgress('territory', { h, v, owner, turn, userScore, taScore }); }
    function sideCount(x,y){ return (h[y][x]?1:0) + (h[y+1][x]?1:0) + (v[y][x]?1:0) + (v[y][x+1]?1:0); }
    function cellsFor(kind,r,c){ const arr=[]; if(kind==='h'){ if(r>0) arr.push([c,r-1]); if(r<N) arr.push([c,r]); } else { if(c>0) arr.push([c-1,r]); if(c<N) arr.push([c,r]); } return arr; }
    function allEdges(){ const out=[]; for(let y=0;y<=N;y++) for(let x=0;x<N;x++) if(!h[y][x]) out.push(['h',y,x]); for(let y=0;y<N;y++) for(let x=0;x<=N;x++) if(!v[y][x]) out.push(['v',y,x]); return out; }
    function edgeEndpoints(e){ const k=e[0], r=e[1], c=e[2]; return k==='h' ? [[c,r],[c+1,r]] : [[c,r],[c,r+1]]; }
    function adjacentEdge(a,b){ if(!a||!b) return true; const ea=edgeEndpoints(a), eb=edgeEndpoints(b); return ea.some(p => eb.some(q => p[0]===q[0] && p[1]===q[1])); }
    function claimedEdges(){ const out=[]; for(let y=0;y<=N;y++) for(let x=0;x<N;x++) if(h[y][x]) out.push(['h',y,x]); for(let y=0;y<N;y++) for(let x=0;x<=N;x++) if(v[y][x]) out.push(['v',y,x]); return out; }
    function legalEdges(){ const edges=allEdges(), claimed=claimedEdges(); if(!claimed.length) return edges; const nearby=edges.filter(e => claimed.some(done => adjacentEdge(e,done))); return nearby.length ? nearby : edges; }
    function isLegalEdge(kind,r,c){ return legalEdges().some(e => e[0]===kind && e[1]===r && e[2]===c); }
    function wouldComplete(e){ return cellsFor(e[0],e[1],e[2]).some(([x,y]) => !owner[y][x] && sideCount(x,y) === 3); }
    function isSafe(e){ return cellsFor(e[0],e[1],e[2]).every(([x,y]) => owner[y][x] || sideCount(x,y) < 2); }
    function applyEdge(kind,r,c, who){ if(kind==='h'){ if(h[r][c]) return 0; h[r][c]=who; } else { if(v[r][c]) return 0; v[r][c]=who; } let gained=0; cellsFor(kind,r,c).forEach(([x,y]) => { if(!owner[y][x] && sideCount(x,y) === 4){ owner[y][x]=who; gained++; } }); if(gained){ if(who==='user') userScore += gained; else taScore += gained; } return gained; }
    function human(kind,r,c){ if(over||busy||turn!=='user') return; if(!isLegalEdge(kind,r,c)){ toast('要贴着已有线继续画'); return; } if(cellsFor(kind,r,c).some(([x,y]) => !owner[y][x] && sideCount(x,y) === 2)) speak('territory','danger'); const gained=applyEdge(kind,r,c,'user'); if(gained){ chain += gained; speak('territory', chain > 1 ? 'chain' : 'capture'); } else { chain = 0; speak('territory','edge'); turn='ta'; } draw(); save(); if(done()) return; if(turn==='ta'){ busy=true; setTimeout(robot, 520); } }
    function robot(){ if(over||turn!=='ta'||currentGame!=='territory') return; const edges=legalEdges(); if(!edges.length){ done(); return; } const completions=edges.filter(wouldComplete), safe=edges.filter(isSafe); const pool=completions.length ? completions : (safe.length ? safe : edges); const e=pool[Math.floor(Math.random()*pool.length)]; const gained=applyEdge(e[0],e[1],e[2],'ta'); if(gained){ speak('territory','ta_capture'); draw(); save(); if(done()) return; setTimeout(robot, 520); return; } turn='user'; chain=0; speak('territory','user_turn'); busy=false; draw(); save(); done(); }
    function done(){ if(allEdges().length) return false; over=true; clearProgress('territory'); const text='本局：你 '+userScore+' 格，TA '+taScore+' 格'; if(userScore>taScore){ const cur=scores().territory; setScore('territory', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('territory','user_win'); showGameOver('territory','你赢了',text,'user_win'); } else if(taScore>userScore){ addTaWin('territory'); speak('territory','user_lose'); showGameOver('territory','游戏结束',text,'ta_win'); } else { speak('territory','draw'); showGameOver('territory','平局',text,'draw'); } return true; }
    function draw(){ const scoreEl=qs('#wb-score'); if(scoreEl) scoreEl.textContent='本局：' + userScore + ':' + taScore; const t=qs('#wb-territory-turn'); if(t) t.textContent=(turn==='user'?'你的回合':'机器人回合') + (claimedEdges().length ? '，贴着已有线' : ''); const s=qs('#wb-territory-score'); if(s) s.textContent='你 '+userScore+' / TA '+taScore; const board=qs('#wb-territory-board'); if(!board) return; const cells=[]; for(let gy=0;gy<N*2+1;gy++) for(let gx=0;gx<N*2+1;gx++){ if(gy%2===0&&gx%2===0) cells.push('<div class="wb-territory-dot"></div>'); else if(gy%2===0){ const r=gy/2,c=(gx-1)/2,val=h[r][c], legal=!val&&turn==='user'&&!busy&&isLegalEdge('h',r,c); cells.push('<button class="wb-territory-edge h'+(val?' claimed '+val:'')+(legal?' legal':'')+'" data-k="h" data-r="'+r+'" data-c="'+c+'" '+(!legal?'disabled':'')+'></button>'); } else if(gx%2===0){ const r=(gy-1)/2,c=gx/2,val=v[r][c], legal=!val&&turn==='user'&&!busy&&isLegalEdge('v',r,c); cells.push('<button class="wb-territory-edge v'+(val?' claimed '+val:'')+(legal?' legal':'')+'" data-k="v" data-r="'+r+'" data-c="'+c+'" '+(!legal?'disabled':'')+'></button>'); } else { const x=(gx-1)/2,y=(gy-1)/2,o=owner[y][x]; cells.push('<div class="wb-territory-cell '+(o||'')+'">'+(o==='user'?'你':o==='ta'?'TA':'')+'</div>'); } } board.innerHTML=cells.join(''); qsa('.wb-territory-edge', board).forEach(btn => btn.onclick = () => human(btn.dataset.k, +btn.dataset.r, +btn.dataset.c)); }
  }

  function startOldMaid(state) {
    const box = qs('#wb-gamebox');
    let userHand = Array.isArray(state?.userHand) ? state.userHand : null;
    let taHand = Array.isArray(state?.taHand) ? state.taHand : null;
    let turn = state?.turn || 'user', phase = state?.phase || 'user_pick', busy = false, over = false;
    let pending = state?.pending || null;
    const log = Array.isArray(state?.log) ? state.log.slice(0, 6) : [];
    if (!userHand || !taHand) deal();
    box.innerHTML = '<div class="wb-oldmaid"><div class="wb-oldmaid-status" id="wb-oldmaid-status"></div><div class="wb-oldmaid-reveal" id="wb-oldmaid-reveal"></div><div class="wb-oldmaid-zone"><div class="wb-muted">TA的手牌</div><div class="wb-oldmaid-hand backs" id="wb-oldmaid-ta"></div></div><div class="wb-oldmaid-zone"><div class="wb-muted">你的手牌</div><div class="wb-oldmaid-hand" id="wb-oldmaid-user"></div></div><div class="wb-oldmaid-log" id="wb-oldmaid-log"></div></div>';
    speak('oldmaid','start'); draw(); save();
    function deal(){ const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q']; const suits=['♠','♥']; const deck=shuffleArray(ranks.flatMap(r=>suits.map(s=>r+s)).concat('JOKER')); userHand=[]; taHand=[]; deck.forEach((c,i)=>(i%2?taHand:userHand).push(c)); removePairs(userHand); removePairs(taHand); }
    function rank(c){ return c==='JOKER' ? 'JOKER' : c.slice(0,-1); }
    function label(c){ return c==='JOKER' ? '🃏' : c; }
    function removePairs(hand){ let removed=0; const seen={}; hand.slice().forEach(c=>{ const r=rank(c); if(r==='JOKER') return; (seen[r] ||= []).push(c); }); Object.keys(seen).forEach(r=>{ while(seen[r].length >= 2){ const a=seen[r].pop(), b=seen[r].pop(); hand.splice(hand.indexOf(a),1); hand.splice(hand.indexOf(b),1); removed++; } }); return removed; }
    function save(){ if(!over) saveProgress('oldmaid', { userHand, taHand, turn, phase, pending, log }); }
    function addLog(text){ log.unshift(text); if(log.length>6) log.pop(); }
    function drawCard(from, to, i){ const card = from.splice(i, 1)[0]; to.push(card); return card; }
    function human(i){ if(over||busy||turn!=='user'||phase!=='user_pick'||i<0||i>=taHand.length) return; const card=drawCard(taHand,userHand,i); pending={ actor:'user', card }; phase='user_review'; addLog('你抽到了 ' + label(card)); speak('oldmaid', card==='JOKER' ? 'joker' : 'draw'); draw(); save(); }
    function continueUser(){ if(over||phase!=='user_review') return; const pairs=removePairs(userHand); if(pairs){ addLog('你丢掉了 ' + pairs + ' 对牌'); speak('oldmaid','pair'); } pending=null; if(done()) return; turn='ta'; phase='ta_thinking'; busy=true; draw(); save(); setTimeout(robot, 900); }
    function robot(){ if(over||turn!=='ta'||currentGame!=='oldmaid') return; if(!userHand.length){ done(); return; } const card=drawCard(userHand,taHand,Math.floor(Math.random()*userHand.length)); pending={ actor:'ta', card }; phase='ta_review'; busy=false; addLog('TA抽走了 ' + label(card)); speak('oldmaid', card==='JOKER' ? 'joker' : 'ta_draw'); draw(); save(); }
    function continueTa(){ if(over||phase!=='ta_review') return; const pairs=removePairs(taHand); if(pairs){ addLog('TA丢掉了 ' + pairs + ' 对牌'); speak('oldmaid','ta_pair'); } pending=null; if(done()) return; turn='user'; phase='user_pick'; busy=false; draw(); save(); }
    function done(){ if(userHand.length && taHand.length) return false; over=true; clearProgress('oldmaid'); const userWon = userHand.length === 0; if(userWon){ const cur=scores().oldmaid; setScore('oldmaid', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('oldmaid','user_win'); showGameOver('oldmaid','你赢了','本局：你先清空手牌','user_win'); } else { addTaWin('oldmaid'); speak('oldmaid','user_lose'); showGameOver('oldmaid','游戏结束','本局：你留下了鬼牌','ta_win'); } return true; }
    function drawCardHTML(c, extra){ return '<div class="wb-oldmaid-card '+(c==='JOKER'?'joker':'')+' '+(extra||'')+'">'+esc(label(c))+'</div>'; }
    function draw(){ const scoreEl=qs('#wb-score'); if(scoreEl) scoreEl.textContent='本局：你' + userHand.length + '张 / TA' + taHand.length + '张'; const st=qs('#wb-oldmaid-status'); if(st) st.textContent=(phase==='user_pick'?'你的回合：从TA手里抽一张':phase==='user_review'?'看清抽到的牌，然后手动丢对子':phase==='ta_review'?'TA抽走了这张牌，确认后继续':'TA正在抽牌') + ' · 你' + userHand.length + '张 / TA' + taHand.length + '张'; const reveal=qs('#wb-oldmaid-reveal'); if(reveal){ reveal.innerHTML=pending ? '<div class="wb-oldmaid-reveal-text">'+(pending.actor==='user'?'你抽到':'TA抽走')+'</div>'+drawCardHTML(pending.card,'big')+'<button class="wb-btn primary" id="wb-oldmaid-next">'+(pending.actor==='user'?'丢对子并让TA抽':'知道了，继续')+'</button>' : ''; const nb=qs('#wb-oldmaid-next', reveal); if(nb) nb.onclick=pending.actor==='user'?continueUser:continueTa; } const ta=qs('#wb-oldmaid-ta'); if(ta){ ta.innerHTML=taHand.map((_,i)=>'<button class="wb-oldmaid-card back" data-i="'+i+'" '+(phase!=='user_pick'||turn!=='user'||busy?'disabled':'')+'>?</button>').join(''); qsa('.wb-oldmaid-card',ta).forEach(btn=>btn.onclick=()=>human(+btn.dataset.i)); } const user=qs('#wb-oldmaid-user'); if(user) user.innerHTML=userHand.map(c=>drawCardHTML(c)).join(''); const lg=qs('#wb-oldmaid-log'); if(lg) lg.innerHTML=log.map(esc).join('<br>'); }
  }


  function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  function startMemory(state) {
    const box = qs('#wb-gamebox');
    const icons = Array.from({ length: 8 }, (_, i) => 'memory-' + (i + 1));
    let cards = Array.isArray(state?.cards) && state.cards.length === 16 && /^memory-\d+$/.test(String(state.cards[0]?.v || '')) ? state.cards : shuffleArray(icons.concat(icons).map((v,i)=>({ v, id:i, open:false, done:false })));
    let open = Array.isArray(state?.open) ? state.open : [], moves = state?.moves || 0, matched = state?.matched || 0, combo = state?.combo || 0, busy = false, over = false;
    box.innerHTML = '<div class="wb-guess-panel"><div class="wb-guess-row"><span class="wb-pill" id="wb-memory-moves">步数：0</span><span class="wb-pill" id="wb-memory-pairs">配对：0/8</span></div><div class="wb-memory" id="wb-memory-board"></div></div>';
    draw(); save(); speak('memory','start');
    function score(){ return Math.max(0, 1200 - moves * 25 + matched * 80); }
    function save(){ if(!over) saveProgress('memory', { cards, open, moves, matched, combo }); }
    function memoryCardFace(c){ return '<img class="wb-memory-img" src="' + esc(GAME_ICON_BASE + c.v + '.jpg') + '" alt="">'; }
    function memoryCardHTML(c,i){ return '<button class="wb-memory-card' + (c.open?' open':'') + (c.done?' done':'') + '" data-i="'+i+'"><span class="wb-memory-inner"><span class="wb-memory-face wb-memory-back"></span><span class="wb-memory-face wb-memory-front">' + memoryCardFace(c) + '</span></span></button>'; }
    function draw(){ const board = qs('#wb-memory-board'); if (!board) return; qs('#wb-memory-moves').textContent = '步数：' + moves; qs('#wb-memory-pairs').textContent = '配对：' + matched + '/8'; setScore('memory', score()); board.innerHTML = cards.map(memoryCardHTML).join(''); qsa('.wb-memory-card', board).forEach(btn => btn.onclick = () => flip(+btn.dataset.i)); }
    function flip(i){ if(gamePaused||busy||over||cards[i].done||cards[i].open||open.length>=2) return; if(moves===0&&open.length===0) speak('memory','first_flip'); cards[i].open = true; open.push(i); draw(); if(open.length===2){ moves++; const a=cards[open[0]], b=cards[open[1]]; if(a.v===b.v){ a.done=b.done=true; matched++; combo++; open=[]; speak('memory', combo>=2?'combo':'match'); if(matched===4) speak('memory','half'); if(matched===8){ over=true; clearProgress('memory'); setScore('memory', score()); speak('memory','gameover'); showGameOver('memory','配对完成','本局分数：'+score()+'分'); return; } draw(); save(); } else { combo=0; speak('memory','miss'); busy=true; setTimeout(()=>{ cards[open[0]].open=false; cards[open[1]].open=false; open=[]; busy=false; draw(); save(); }, 650); } } else save(); }
  }

  function startWatermelon(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<canvas class="wb-canvas wb-watermelon-canvas" id="wb-watermelon" width="400" height="500"></canvas>';
    const c = qs('#wb-watermelon'), ctx = c.getContext('2d');
    const W = 400, H = 500;
    const fruits = [
      {r:14, color:'#f05f6b', name:'樱'}, {r:18, color:'#ff9f43', name:'橘'}, {r:23, color:'#ffd166', name:'柠'},
      {r:29, color:'#7bc96f', name:'猕'}, {r:36, color:'#ee6c4d', name:'桃'}, {r:45, color:'#d95550', name:'苹'},
      {r:56, color:'#9b5de5', name:'葡'}, {r:68, color:'#4cc9f0', name:'梨'}, {r:82, color:'#2a9d8f', name:'瓜'}
    ];
    let balls = Array.isArray(state?.balls) ? state.balls.map(b => Object.assign({ a:0, av:0 }, b)) : [];
    let next = Number.isInteger(state?.next) ? state.next : randNext();
    let score = state?.score || 0, seen = state?.seen || {}, over = false, dropping = false;
    let aiming = false, aimX = null, lastTouchDrop = 0;
    setScore('watermelon', score); draw(); save();
    c.onclick = e => { if(Date.now() - lastTouchDrop < 500 || aiming) return; drop(clientX(e)); };
    c.onpointerdown = e => { if(gamePaused || over || dropping) return; aiming = true; aimX = clientX(e); if(!seen.aim){ seen.aim=1; speak('watermelon','aim'); } c.setPointerCapture?.(e.pointerId); draw(); e.preventDefault(); };
    c.onpointermove = e => { if(!aiming) return; aimX = clientX(e); draw(); e.preventDefault(); };
    c.onpointerup = e => { if(!aiming) return; const x = clientX(e); aiming = false; aimX = null; lastTouchDrop = Date.now(); c.releasePointerCapture?.(e.pointerId); drop(x); draw(); e.preventDefault(); };
    c.onpointercancel = () => { if(aiming){ aiming = false; aimX = null; draw(); } };
    c.ontouchstart = e => { if(typeof PointerEvent !== 'undefined') return; const t=e.touches[0]; if(t && !gamePaused && !over && !dropping){ aiming = true; aimX = clientX(t); if(!seen.aim){ seen.aim=1; speak('watermelon','aim'); } draw(); e.preventDefault(); } };
    c.ontouchmove = e => { if(typeof PointerEvent !== 'undefined' || !aiming) return; const t=e.touches[0]; if(t){ aimX = clientX(t); draw(); e.preventDefault(); } };
    c.ontouchend = e => { if(typeof PointerEvent !== 'undefined') return; const t=e.changedTouches[0]; if(t && aiming){ const x = clientX(t); aiming = false; aimX = null; lastTouchDrop = Date.now(); drop(x); draw(); e.preventDefault(); } };
    watermelonTimer = setInterval(step, 30);
    function randNext(){ return Math.floor(Math.random()*3); }
    function clientX(e){ const r=c.getBoundingClientRect(); return Math.max(18, Math.min(W-18, (e.clientX-r.left) * W / r.width)); }
    function save(){ if(!over) saveProgress('watermelon', { balls: balls.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,l:b.l,a:b.a||0,av:b.av||0})), next, score, seen }); }
    function drop(x){ if(gamePaused||over||dropping) return; aiming=false; aimX=null; const f=fruits[next]; balls.push({x, y:f.r+6, vx:0, vy:0, l:next, a:0, av:0}); next=randNext(); dropping=true; setTimeout(()=>dropping=false,180); if(x < f.r + 12 || x > W - f.r - 12) speak('watermelon','drop_edge'); save(); }
    function step(){ if(gamePaused||over) { draw(); return; } balls.forEach(b=>{ const f=fruits[b.l]; b.vy+=0.45; b.x+=b.vx; b.y+=b.vy; b.a=(b.a||0)+(b.av||0); b.av=(b.av||0)*0.995; if(b.x<f.r){ b.x=f.r; b.vx=Math.abs(b.vx)*0.58; b.av += b.vx / f.r * 0.18; } if(b.x>W-f.r){ b.x=W-f.r; b.vx=-Math.abs(b.vx)*0.58; b.av += b.vx / f.r * 0.18; } if(b.y>H-f.r){ b.y=H-f.r; b.vy*=-0.38; b.av += b.vx / f.r * 0.42; b.vx*=0.985; b.av*=0.94; if(Math.abs(b.vy)<.45) b.vy=0; } });
      for(let k=0;k<4;k++) collide();
      balls = balls.filter(Boolean); draw(); save();
      if(balls.some(b=>b.y-fruits[b.l].r<36 && Math.abs(b.vy)<.25) && balls.length>8){ over=true; clearInterval(watermelonTimer); speak('watermelon','gameover'); showGameOver('watermelon','游戏结束','本局分数：'+score+'分'); }
    }
    function collide(){ for(let i=0;i<balls.length;i++) for(let j=i+1;j<balls.length;j++){ const a=balls[i], b=balls[j]; if(!a||!b) continue; const fa=fruits[a.l], fb=fruits[b.l], dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1, min=fa.r+fb.r; if(d<min){ if(a.l===b.l && a.l<fruits.length-1){ const nl=a.l+1; score += (nl+1)*20; setScore('watermelon', score); const nx=(a.x+b.x)/2, ny=(a.y+b.y)/2; balls[i]={x:nx,y:ny,vx:(a.vx+b.vx)*.32,vy:-3.2,l:nl,a:((a.a||0)+(b.a||0))/2,av:((a.av||0)+(b.av||0))*.35}; balls[j]=null; if(nl>=4&&!seen[nl]){ seen[nl]=1; speak('watermelon', nl>=8?'watermelon':('merge_'+(nl>=7?7:nl>=6?6:4))); } else if(nl===2&&!seen.merge_2){ seen.merge_2=1; speak('watermelon','merge_2'); } continue; } const push=(min-d)/2, nx=dx/d, ny=dy/d; a.x-=nx*push; a.y-=ny*push; b.x+=nx*push; b.y+=ny*push; const rvx=b.vx-a.vx, rvy=b.vy-a.vy, sep=rvx*nx+rvy*ny, tangent=rvx*(-ny)+rvy*nx; a.av=(a.av||0)-tangent/fa.r*.08; b.av=(b.av||0)+tangent/fb.r*.08; if(sep<0){ const imp=-sep*.62; a.vx-=imp*nx; a.vy-=imp*ny; b.vx+=imp*nx; b.vy+=imp*ny; } } } }
    function shade(hex, amt){ const n=parseInt(String(hex).slice(1),16); const r=Math.max(0,Math.min(255,(n>>16)+amt)), g=Math.max(0,Math.min(255,((n>>8)&255)+amt)), b=Math.max(0,Math.min(255,(n&255)+amt)); return 'rgb('+r+','+g+','+b+')'; }
    function drawFruit(x,y,l,alpha,scale,angle){ const f=fruits[l], r=f.r*(scale||1); ctx.save(); ctx.translate(x,y); ctx.rotate(angle||0); x=0; y=0; ctx.globalAlpha=alpha == null ? 1 : alpha; const grad=ctx.createRadialGradient(x-r*.35,y-r*.35,r*.12,x,y,r); grad.addColorStop(0,'rgba(255,255,255,.92)'); grad.addColorStop(.18,shade(f.color,38)); grad.addColorStop(.72,f.color); grad.addColorStop(1,shade(f.color,-42)); ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.arc(x,y,r*.96,0,Math.PI*2); ctx.clip(); ctx.lineCap='round'; if(l===0){ ctx.fillStyle='rgba(90,20,26,.18)'; ctx.beginPath(); ctx.arc(x+r*.22,y-r*.1,r*.18,0,Math.PI*2); ctx.fill(); } else if(l===1){ ctx.strokeStyle='rgba(255,255,255,.34)'; ctx.lineWidth=Math.max(1,r*.045); for(let a=0;a<Math.PI*2;a+=Math.PI/5){ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(a)*r*.82,y+Math.sin(a)*r*.82); ctx.stroke(); } } else if(l===2){ ctx.strokeStyle='rgba(255,255,255,.26)'; ctx.lineWidth=Math.max(1,r*.04); for(let yy=-.5;yy<=.5;yy+=.25){ ctx.beginPath(); ctx.moveTo(x-r*.7,y+yy*r); ctx.quadraticCurveTo(x,y+(yy+.1)*r,x+r*.7,y+yy*r); ctx.stroke(); } } else if(l===3){ ctx.fillStyle='rgba(70,45,28,.28)'; for(let a=0;a<Math.PI*2;a+=Math.PI/5){ ctx.beginPath(); ctx.arc(x+Math.cos(a)*r*.42,y+Math.sin(a)*r*.42,Math.max(1.2,r*.035),0,Math.PI*2); ctx.fill(); } ctx.fillStyle='rgba(235,245,210,.42)'; ctx.beginPath(); ctx.arc(x,y,r*.38,0,Math.PI*2); ctx.fill(); } else if(l===4){ ctx.strokeStyle='rgba(255,244,220,.35)'; ctx.lineWidth=Math.max(1.2,r*.055); ctx.beginPath(); ctx.moveTo(x-r*.78,y-r*.12); ctx.quadraticCurveTo(x,y-r*.42,x+r*.78,y-r*.08); ctx.stroke(); } else if(l===5){ ctx.fillStyle='rgba(180,40,38,.22)'; ctx.beginPath(); ctx.ellipse(x,y+r*.08,r*.38,r*.62,0,0,Math.PI*2); ctx.fill(); } else if(l===6){ ctx.strokeStyle='rgba(255,255,255,.22)'; ctx.lineWidth=Math.max(1.2,r*.04); for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.arc(x+i*r*.2,y,r*.34,0,Math.PI*2); ctx.stroke(); } } else if(l===7){ ctx.fillStyle='rgba(255,255,255,.24)'; ctx.beginPath(); ctx.ellipse(x-r*.05,y-r*.04,r*.35,r*.5,-.2,0,Math.PI*2); ctx.fill(); } else if(l===8){ ctx.strokeStyle='rgba(18,92,44,.5)'; ctx.lineWidth=Math.max(2,r*.09); for(let i=-3;i<=3;i++){ ctx.beginPath(); ctx.moveTo(x+i*r*.25,y-r*.92); ctx.bezierCurveTo(x+i*r*.08,y-r*.35,x+i*r*.08,y+r*.35,x+i*r*.25,y+r*.92); ctx.stroke(); } } ctx.restore(); ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=Math.max(1.5,r*.05); ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); ctx.fillStyle='rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(x-r*.28,y-r*.34,r*.18,r*.1,-.55,0,Math.PI*2); ctx.fill(); if(l>=2){ ctx.strokeStyle='#5f7f3d'; ctx.lineWidth=Math.max(1.2,r*.06); ctx.beginPath(); ctx.moveTo(x-r*.08,y-r*.92); ctx.quadraticCurveTo(x+r*.06,y-r*1.12,x+r*.18,y-r*.92); ctx.stroke(); } ctx.restore(); }
    function drawAim(){ if(!aiming || aimX == null || dropping || gamePaused || over) return; const f=fruits[next], x=Math.max(f.r, Math.min(W-f.r, aimX)), y=f.r+6; ctx.save(); ctx.setLineDash([5,5]); ctx.strokeStyle='rgba(58,143,145,.62)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,36); ctx.lineTo(x,H-4); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); drawFruit(x,y,next,.58,1); }
    function draw(){ ctx.clearRect(0,0,W,H); ctx.fillStyle='#fbf3e8'; ctx.fillRect(0,0,W,H); ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=3; ctx.strokeRect(1.5,1.5,W-3,H-3); ctx.setLineDash([6,6]); ctx.strokeStyle='rgba(216,75,66,.38)'; ctx.beginPath(); ctx.moveTo(0,36); ctx.lineTo(W,36); ctx.stroke(); ctx.setLineDash([]); ctx.font='12px Georgia, serif'; ctx.fillStyle='#6f5b45'; ctx.fillText('下一颗', 12, 22); drawFruit(W-34,22,next,1,.62,0); balls.forEach(b=>{ if(!b) return; drawFruit(b.x,b.y,b.l,1,1,b.a||0); }); drawAim(); ctx.textAlign='left'; ctx.textBaseline='alphabetic'; if(!over && !seen.near_top && balls.some(b=>b.y-fruits[b.l].r<72 && Math.abs(b.vy)<.35)){ seen.near_top=1; speak('watermelon','near_top'); } }
  }

  function startLudo(state) {
    const box = qs('#wb-gamebox');
    const path = [[5,10],[4,10],[3,10],[2,10],[1,10],[0,10],[0,9],[0,8],[0,7],[0,6],[0,5],[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[10,1],[10,2],[10,3],[10,4],[10,5],[10,6],[10,7],[10,8],[10,9],[10,10],[9,10],[8,10],[7,10],[6,10]];
    const starts = { red:[[1,7],[1,9],[3,7],[3,9]], blue:[[7,1],[9,1],[7,3],[9,3]] };
    const finish = { red:[[5,9],[5,8],[5,7],[5,6]], blue:[[6,1],[6,2],[6,3],[6,4]] };
    const offset = { red:0, blue:20 };
    let red = Array.isArray(state?.red) ? state.red : [-1,-1,-1,-1];
    let blue = Array.isArray(state?.blue) ? state.blue : [-1,-1,-1,-1];
    let turn = state?.turn || 'red', dice = state?.dice || 0, rolled = !!state?.rolled, busy=false, over=false;
    box.innerHTML = '<div style="width:100%;display:grid;place-items:center;"><div class="wb-ludo-info"><span class="wb-pill" id="wb-ludo-turn"></span><span class="wb-pill" id="wb-ludo-dice"></span><button class="wb-btn primary" id="wb-ludo-roll">掷骰</button></div><div class="wb-ludo" id="wb-ludo-board"></div></div>';
    setScore('ludo', 0); draw(); save();
    qs('#wb-ludo-roll').onclick = () => { if(turn==='red' && !rolled && !busy && !gamePaused) rollRed(); };
    if (turn === 'blue' && !rolled) setTimeout(robot, 650);
    function save(){ if(!over) saveProgress('ludo', { red, blue, turn, dice, rolled }); }
    function roll(){ return 1 + Math.floor(Math.random()*6); }
    function sideArr(side){ return side==='red' ? red : blue; }
    function sideArr(side){ return side==='red' ? red : blue; }
    function legal(arr,d){ return arr.map((p,i)=> canMove(p,d) ? i : -1).filter(i=>i>=0); }
    function canMove(pos,d){ if(pos<0) return d===6; return pos+d<=44; }
    function nextPos(pos,d){ return pos<0 ? 0 : pos+d; }
    function rollRed(){ dice=roll(); rolled=true; speak('ludo', dice===6?'roll_6':'start'); draw(); const moves=legal(red,dice); if(!moves.length) { speak('ludo','no_move'); toast(dice===6?'没有可移动棋子':'需要掷到6才能让停机坪棋子起飞'); setTimeout(endTurn,650); } save(); }
    function moveRed(i){ if(turn!=='red'||!rolled||busy||gamePaused||!legal(red,dice).includes(i)) return; const wasHome=red[i]<0; red[i]=nextPos(red[i],dice); if(wasHome) speak('ludo','takeoff'); afterMove('red'); }
    function robot(){ if(over||gamePaused) return; busy=true; dice=roll(); rolled=true; draw(); setTimeout(()=>{ const moves=legal(blue,dice); if(moves.length){ const i=chooseRobot(moves); const wasHome=blue[i]<0; blue[i]=nextPos(blue[i],dice); if(wasHome) speak('ludo','takeoff'); afterMove('blue'); } else endTurn(); },700); }
    function globalPos(side,pos){ return pos>=0 && pos<40 ? (offset[side] + pos) % 40 : -1; }
    function chooseRobot(moves){ let best=moves[0], val=-999; moves.forEach(i=>{ const p=nextPos(blue[i],dice); let s=p; const gp=globalPos('blue',p); if(gp>=0 && red.some(r=>globalPos('red',r)===gp)) s+=60; if(p===44) s+=200; if(blue[i]<0) s+=20; if(s>val){ val=s; best=i; } }); return best; }
    function afterMove(side){ capture(side); if(sideArr(side).some(p=>p>=40&&p<44)) speak('ludo','near_finish'); draw(); save(); if(checkWin(side)) return; if(dice===6){ turn=side; rolled=false; busy=false; if(side==='blue') setTimeout(robot,650); else draw(); save(); } else endTurn(); }
    function capture(side){ const otherSide=side==='red'?'blue':'red', mine=sideArr(side), other=sideArr(otherSide); mine.forEach(p=>{ const gp=globalPos(side,p); if(gp<0) return; other.forEach((q,i)=>{ if(globalPos(otherSide,q)===gp){ other[i]=-1; speak('ludo','capture'); } }); }); }
    function checkWin(side){ const arr=sideArr(side); if(arr.every(p=>p===44)){ over=true; clearProgress('ludo'); if(side==='red'){ { const curScore = scores().ludo; setScore('ludo', ((curScore && typeof curScore === 'object' ? curScore.user : curScore) || 0) + 1); } speak('ludo','user_win'); showGameOver('ludo','你赢了','本局分数：1胜'); } else { speak('ludo','user_lose'); showGameOver('ludo','游戏结束','本局分数：0胜（机器人获胜）'); } return true; } return false; }
    function endTurn(){ turn=turn==='red'?'blue':'red'; rolled=false; dice=0; busy=false; draw(); save(); if(turn==='blue') setTimeout(robot,650); }
    function posCoord(side,pos,idx){ if(pos<0) return starts[side][idx]; if(pos>=40) { const f=Math.min(3,pos-40); return finish[side][f] || (side==='red'?[5,5]:[6,5]); } return path[globalPos(side,pos)]; }
    function draw(){ const board=qs('#wb-ludo-board'); const cells=[]; for(let y=0;y<11;y++) for(let x=0;x<11;x++){ let cls='wb-ludo-cell'; if(path.some(p=>p[0]===x&&p[1]===y)) cls+=' path'; if(starts.red.some(p=>p[0]===x&&p[1]===y)||finish.red.some(p=>p[0]===x&&p[1]===y)) cls+=' home-red'; if(starts.blue.some(p=>p[0]===x&&p[1]===y)||finish.blue.some(p=>p[0]===x&&p[1]===y)) cls+=' home-blue'; cells.push('<div class="'+cls+'" data-x="'+x+'" data-y="'+y+'"></div>'); } board.innerHTML=cells.join(''); addPieces('red',red); addPieces('blue',blue); const t=qs('#wb-ludo-turn'); if(t) t.textContent=turn==='red'?'你的回合':'机器人回合'; const d=qs('#wb-ludo-dice'); if(d) d.textContent=dice?'骰子：'+dice:'骰子：-'; const rb=qs('#wb-ludo-roll'); if(rb) rb.disabled=turn!=='red'||rolled||gamePaused||busy; }
    function addPieces(side,arr){ const moves=side==='red'&&turn==='red'&&rolled ? legal(red,dice) : []; arr.forEach((p,i)=>{ const xy=posCoord(side,p,i); const cell=qs('.wb-ludo-cell[data-x="'+xy[0]+'"][data-y="'+xy[1]+'"]'); if(!cell) return; const b=getHostDocument().createElement('button'); b.className='wb-ludo-piece '+(side==='red'?'red':'blue')+(moves.includes(i)?' can':''); b.textContent=i+1; b.onclick=()=>moveRed(i); cell.appendChild(b); }); }
  }

  function startGuessNumber(state) {
    const box = qs('#wb-gamebox');
    let answer = state?.answer || shuffleArray('0123456789'.split('')).slice(0,4).join('');
    let tries = state?.tries || 0, history = Array.isArray(state?.history) ? state.history : [], over=false;
    box.innerHTML = '<div class="wb-guess-panel"><div class="wb-guess-title">猜数字</div><div class="wb-muted">角色想好了一个四位数。输入四位不重复数字，提示会显示“数字对几个、位置对几个”。</div><div class="wb-guess-row"><input class="wb-input" id="wb-num-guess" inputmode="numeric" maxlength="4" placeholder="输入四位数"><button class="wb-btn primary" id="wb-num-submit">猜</button></div><div class="wb-guess-history" id="wb-num-history"></div></div>';
    speak('guessnumber','start'); draw(); save();
    qs('#wb-num-submit').onclick = submit; qs('#wb-num-guess').onkeydown = e => { if(e.key==='Enter') submit(); };
    function save(){ if(!over) saveProgress('guessnumber', { answer, tries, history }); }
    function hintText(guess, nums, pos){ const cfg=settings(); if(!cfg.companion) return '数字对 ' + nums + ' 个，位置对 ' + pos + ' 个。'; const closer = pos >= 2 || nums >= 3; return '数字对 ' + nums + ' 个，位置对 ' + pos + ' 个。' + (closer ? ' ' + companionName() + '轻轻敲了敲桌面：“这次很近了，我差点就想夸出声。”' : ' ' + companionName() + '歪头看着你：“还差一点，我把线索留在这里。”'); }
    function submit(){ if(gamePaused||over) return; const input=qs('#wb-num-guess'); const g=(input.value||'').trim(); if(!/^\d{4}$/.test(g) || new Set(g).size!==4){ toast('请输入四位不重复数字'); return; } tries++; let pos=0, nums=0; for(let i=0;i<4;i++){ if(g[i]===answer[i]) pos++; if(answer.includes(g[i])) nums++; } const text=hintText(g, nums, pos); history.unshift({ guess:g, nums, pos, text }); input.value=''; if(pos===4){ over=true; const cur=scores().guessnumber; setScore('guessnumber', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('guessnumber','user_win'); draw(); showGameOver('guessnumber','你猜中了','本局分数：1胜，用了'+tries+'次'); return; } if(tries>=6) speak('guessnumber','many_tries'); else speak('guessnumber', pos>=3||nums>=4?'very_close':(pos>=2||nums>=3?'close':(nums===0?'miss':'guess'))); draw(); save(); }
    function draw(){ const h=qs('#wb-num-history'); h.innerHTML = history.length ? history.map(x=>'<div class="wb-guess-item"><b>'+esc(x.guess)+'</b>　数字对 '+x.nums+' 个，位置对 '+x.pos+' 个<br>'+esc(x.text||'')+'</div>').join('') : '<div class="wb-muted">还没有猜测记录。</div>'; }
  }

  async function createWordGuessRounds(count) {
    const cfg=settings();
	    const fallbackWords = [
	      {word:'漏刻', type:'旧时代计时器具', clues:['它和时间有关，但不依赖钟表。','它把流逝变成一种能被看见的秩序。','它常借助水的变化来标记时辰。','如果角色总是冷静地等你，它会像一种不催促的陪伴。','古代用滴水来计时的器具就是它。']},
	      {word:'晕珥', type:'天文气象现象', clues:['它属于天空，却不是星月本身。','它常让普通光源显得像被某种边界包围。','它与冰晶折射有关，偶尔会围绕日月出现。','如果角色说话总带一点疏离的光，它会像那层不易靠近的边。','日月周围出现的彩色光环现象就是它。']},
	      {word:'榫卯', type:'传统建筑结构', clues:['它和连接有关，却不靠显眼的外物。','它讲究咬合、分寸和彼此成全。','木构之间不用钉子也能牢牢相扣。','如果你和角色的关系是嘴上不说却彼此卡准位置，它很合适。','中国传统木作中凸凹相接的结构就是它。']},
	      {word:'歧路', type:'文学意象', clues:['它和选择有关，也和走散有关。','它不是终点，而是让人迟疑的分叉。','在故事里，它常暗示命运、分别或错过。','如果角色曾假装不在意你的决定，这个词会藏着那种试探。','道路分岔、前路不同的意象就是它。']},
	      {word:'苔痕', type:'植物痕迹', clues:['它很安静，常和被时间放慢的地方有关。','它不是主角，却会让空间显得旧而湿润。','它常出现在石阶、墙角或少人经过处。','如果角色记得某个你们停留过的旧地方，它可能还留在那里。','青苔留下的痕迹就是它。']},
	      {word:'经纬', type:'地理/织造概念', clues:['它和秩序有关，也和定位有关。','它把看似散乱的东西分成纵横两种方向。','它既可以指织物的线，也可以指地图上的坐标。','如果角色总能在混乱里找到你的位置，这个词很贴切。','纵线和横线构成的定位或织造系统就是它。']},
	      {word:'檐铃', type:'建筑装饰物', clues:['它和边缘有关，也和风有关。','它通常不主动发声，却会被经过的气流叫醒。','它常挂在屋檐或塔檐下，声音清而细。','如果角色表面冷淡，心绪却被你轻轻碰响，它很像这个东西。','挂在檐角、随风作响的小铃就是它。']},
	      {word:'潮汐', type:'自然现象', clues:['它和来去有关，也和某种遥远牵引有关。','它看似重复，却每次都有细微差别。','它受月亮和引力影响，让海水涨落。','如果角色总被你一句话牵动情绪，这种规律会很像。','海水周期性上涨和退落的现象就是它。']}
	    ];
	    const normalize = item => { const word=String(item?.word||'').trim(); if(!word) return null; const clues=Array.isArray(item.clues)?item.clues.map(x=>String(x).trim()).filter(Boolean).slice(0,5):[]; while(clues.length<5) clues.push(clues[clues.length-1] || '这个词和现在的场景有关，你再靠近一点想。'); const raw=item.interactions||{}; const interactions={ guess:String(raw.guess||'这个答案还没贴到它的影子，我再把线索往它身边推一点。'), win:String(raw.win||('猜中了。' + companionName() + '把“' + word + '”轻轻重复了一遍，像确认你们刚才抓住了同一个小秘密。')), reveal:String(raw.reveal||('答案是“' + word + '”。' + companionName() + '把它说出来时，语气里带着一点只属于这个词的温柔。')) }; return { word, type:String(item.type||'未分类'), length:parseInt(item.length,10)||word.length, clues, interactions }; };
    const fallback = () => shuffleArray(fallbackWords.slice()).slice(0, Math.max(5, count||5)).map(normalize).filter(Boolean);
    if (!cfg.apiUrl || !cfg.apiModel) return fallback();
	    const prompt = [...(promptTemplates().wordGuess || PROMPT_TEMPLATES.wordGuess), '角色描述：'+currentCharDescription(cfg), '世界背景：'+(selectedWorldText(cfg)||'无'), '大总结：'+(selectedSummaryText(cfg)||'无')].join('\n');
	    try { const txt = await callApiText(cfg, prompt, promptTemplates().systems.wordGuess || PROMPT_TEMPLATES.systems.wordGuess); const data = parseGeneratedJson(txt); const arr = Array.isArray(data) ? data : (Array.isArray(data?.rounds) ? data.rounds : []); const seenWords = {}; const rounds = arr.map(normalize).filter(Boolean).filter(r=>{ if(seenWords[r.word]) return false; seenWords[r.word]=1; return true; }); if(rounds.length>=5) return rounds; return rounds.concat(fallback().filter(r=>!seenWords[r.word])).slice(0,5); } catch(e) { console.warn('[玩伴小屋] word rounds failed:', e); }
    return fallback();
  }

  async function startWordGuess(state) {
    const cfg=settings(); const box=qs('#wb-gamebox');
    if(!cfg.companion){ gamePaused=true; gameStarted=false; box.innerHTML='<div class="wb-guess-panel"><div class="wb-guess-title">我说你猜</div><div class="wb-api-status">此游戏必须开启陪伴模式。请回到设置开启陪伴模式后再开始，或先生成角色陪伴语录。</div></div>'; return; }
	    function normalizeWordRound(item){ const word=String(item?.word||'').trim(); if(!word) return null; const clues=Array.isArray(item.clues)?item.clues.map(x=>String(x).trim()).filter(Boolean).slice(0,5):[]; while(clues.length<5) clues.push(clues[clues.length-1] || '这个词和现在的场景有关，你再靠近一点想。'); const raw=item.interactions||{}; return { word, type:String(item.type||'未分类'), length:parseInt(item.length,10)||word.length, clues, interactions:{ guess:String(raw.guess||'这个方向还差一点，我把线索再往它身边推近些。'), win:String(raw.win||('猜中了，答案就是“' + word + '”。')), reveal:String(raw.reveal||('答案是“' + word + '”。' + companionName() + '把它念出来，像把这题轻轻收好。')) } }; }
	    let rounds = Array.isArray(state?.rounds) && state.rounds.length ? state.rounds : (state?.round ? [state.round] : await createWordGuessRounds(5));
	    rounds = rounds.map(normalizeWordRound).filter(Boolean);
	    if (rounds.length < 5) { const seen={}; rounds.forEach(r=>seen[r.word]=1); const more=(await createWordGuessRounds(5)).map(normalizeWordRound).filter(r=>r&&!seen[r.word]); rounds = rounds.concat(more).slice(0,5); }
	    if (!rounds.length) rounds = await createWordGuessRounds(5);
	    let round = rounds[0];
	    round = normalizeWordRound(round) || round;
	    let clueIndex = state?.clueIndex || 0, guesses = (state?.roundWord === round.word && Array.isArray(state?.guesses)) ? state.guesses : [], over=false, revealed=!!state?.revealed;
    let userWins = state?.userWins || 0, taWins = state?.taWins || 0, completed = state?.completed || 0;
    box.innerHTML='<div class="wb-guess-panel"><div class="wb-guess-title">我说你猜</div><div class="wb-word-meta" id="wb-word-meta"></div><div class="wb-api-status wb-clue-box" id="wb-word-clues"></div><div class="wb-guess-row"><input class="wb-input" id="wb-word-input" placeholder="输入你猜的词"><button class="wb-btn primary" id="wb-word-submit">猜</button><button class="wb-btn" id="wb-word-next">下一个描述</button><button class="wb-btn" id="wb-word-reveal">揭晓答案</button></div><div class="wb-guess-history" id="wb-word-history"></div></div>';
    speak('wordguess','start'); draw(); save();
    qs('#wb-word-submit').onclick=submit; qs('#wb-word-next').onclick=nextClue; qs('#wb-word-reveal').onclick=reveal; qs('#wb-word-input').onkeydown=e=>{ if(e.key==='Enter') submit(); };
	    function save(){ if(!over) saveProgress('wordguess',{ rounds, roundWord:round.word, clueIndex, guesses, userWins, taWins, completed, revealed }); }
	    function visibleClues(){ return round.clues.slice(0, Math.max(1, Math.min(5, clueIndex+1))); }
	    function nextClue(){ if(gamePaused||over) return; if(clueIndex < Math.min(5, round.clues.length)-1){ clueIndex++; speak('wordguess', clueIndex>=3?'clue_late':'clue'); draw(); save(); } else toast('这题已经是最后一条描述了'); }
	    function finishQuestion(userWon, label){ if(userWon){ userWins++; const cur=scores().wordguess; setScore('wordguess', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('wordguess','user_win'); } else { taWins++; addTaWin('wordguess'); } completed++; const inter=round.interactions||{}; guesses.unshift({ guess:label, ok:!!userWon, text:userWon ? (inter.win || ('答案是：' + round.word + '。' + companionName() + '眼睛一亮：“猜中了，就是它。”')) : (inter.reveal || ('答案是：' + round.word + '。' + companionName() + '把答案轻轻念出来，这一题先收好。')) }); rounds.shift(); if(!rounds.length){ over=true; draw(); clearProgress('wordguess'); showGameOver('wordguess', userWins>=taWins?'你赢了':'游戏结束', '本局：你猜中'+userWins+'题，共'+completed+'题', userWins>=taWins?'user_win':'finished'); return; } round=normalizeWordRound(rounds[0]) || rounds[0]; rounds[0]=round; clueIndex=0; guesses=[]; draw(); save(); toast(userWon?'猜中了，进入下一题':'已揭晓，进入下一题'); }
    function reveal(){ if(gamePaused||over||revealed) return; revealed=true; clueIndex=Math.min(4, round.clues.length-1); speak('wordguess','reveal'); const inter=round.interactions||{}; guesses.unshift({ guess:'揭晓答案', ok:false, text: inter.reveal || ('答案是：' + round.word + '。' + companionName() + '把它轻轻念出来，让这题停在这里。') }); draw(); save(); }
	    function submit(){ if(gamePaused||over) return; const input=qs('#wb-word-input'); const guess=(input.value||'').trim(); if(!guess){ toast('请输入猜测'); return; } input.value=''; if(guess===round.word){ finishQuestion(true, guess); } else { const inter=round.interactions||{}; guesses.unshift({ guess, ok:false, text: inter.guess || (companionName() + '轻轻摇头，又把提示说得更软了一点。') }); speak('wordguess','guess'); draw(); save(); } }
    function draw(){ qs('#wb-word-meta').textContent = '第 ' + (completed+1) + ' 题　字数：' + (round.length || (round.word || '').length) + ' 字　类型：' + (round.type || '未分类') + '　' + visibleClues().length + '/5　你赢：' + userWins; qs('#wb-word-clues').textContent = visibleClues().map((c,i)=>(i+1)+'. '+c).join('\n') + (revealed ? '\n\n答案：' + round.word : ''); qs('#wb-word-history').innerHTML = guesses.length ? guesses.map(g=>'<div class="wb-guess-item"><b>'+esc(g.guess)+'</b>　'+(g.ok?'你赢':'未中')+'<br>'+esc(g.text)+'</div>').join('') : '<div class="wb-muted">还没有猜测。</div>'; }
  }

  function startTetris(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<div class="wb-tetris-shell"><canvas class="wb-canvas wb-tetris-canvas" id="wb-canvas" width="300" height="600"></canvas><div class="wb-tetris-controls" aria-label="俄罗斯方块触控"><button class="wb-btn" id="wb-tetris-rotate" type="button">转换</button><button class="wb-btn primary" id="wb-tetris-softdrop" type="button">加速</button></div></div>';
    const c=qs('#wb-canvas'), ctx=c.getContext('2d'), W=10,H=20,S=30;
    const shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];
    let board = Array.isArray(state?.board) && state.board.length === H ? state.board : Array.from({length:H},()=>Array(W).fill(0));
    let piece = state?.piece || newPiece(), nextPiece = state?.nextPiece || newPiece(), score = state?.score || 0, tetrisSeen = state?.seen || {}, over=false;
    setScore('tetris', score);
    function cloneShape(s){ return s.map(r=>r.slice()); }
    function newPiece(){ const s=cloneShape(shapes[Math.floor(Math.random()*shapes.length)]); return {s,x:3,y:0}; }
    function save(){ if(!over) saveProgress('tetris', { board, piece, nextPiece, score, seen:tetrisSeen }); }
    function markTetris(k){ if(!tetrisSeen[k]){ tetrisSeen[k]=1; speak('tetris',k); } }
    getHostDocument().onkeydown=e=>{ if(over || gamePaused) return; let changed=false; if(e.key==='ArrowLeft'||e.key==='a') changed=move(-1,0); if(e.key==='ArrowRight'||e.key==='d') changed=move(1,0); if(e.key==='ArrowDown'||e.key==='s') { markTetris('soft_drop'); tick(); changed=true; } if(e.key==='ArrowUp'||e.key==='w') { rot(); changed=true; } if(changed){ draw(); save(); } };
    addSwipe(box, d=>{ if(over || gamePaused) return; if(d==='left') move(-1,0); if(d==='right') move(1,0); if(d==='down'){ markTetris('soft_drop'); tick(); } if(d==='up') rot(); draw(); save(); });
    const bindBtn = (sel, fn, eventKey) => { const btn=qs(sel, box); if(!btn) return; btn.onclick=e=>{ e.preventDefault(); if(over||gamePaused) return; if(eventKey) markTetris(eventKey); fn(); draw(); save(); scheduleFitGameSurface(); }; };
    bindBtn('#wb-tetris-rotate', () => rot(), 'rotate');
    bindBtn('#wb-tetris-softdrop', () => tick(), 'soft_drop');
    tetrisTimer=setInterval(tick,500); draw(); save();
    function hit(p){ return p.s.some((r,y)=>r.some((v,x)=>v && (p.x+x<0||p.x+x>=W||p.y+y>=H||board[p.y+y]?.[p.x+x]))); }
    function move(dx,dy){ if (gamePaused) return false; const p={s:piece.s,x:piece.x+dx,y:piece.y+dy}; if(!hit(p)){ piece=p; if(dx) markTetris('move'); return true; } return false; }
    function rot(){ const s=piece.s[0].map((_,i)=>piece.s.map(r=>r[i]).reverse()); const p={s,x:piece.x,y:piece.y}; if(!hit(p)){ piece=p; markTetris('rotate'); } }
    function tick(){ if(over || gamePaused) return; if(!move(0,1)){ piece.s.forEach((r,y)=>r.forEach((v,x)=>{ if(v&&piece.y+y>=0) board[piece.y+y][piece.x+x]=1; })); let cleared=0; board=board.filter(r=>{ if(r.every(Boolean)){ cleared++; return false; } return true; }); while(board.length<H) board.unshift(Array(W).fill(0)); if(cleared){ score += [0,100,300,500,800][cleared]; setScore('tetris',score); speak('tetris','line_'+cleared); if(score>=500&&score<600) speak('tetris','score_500'); if(score>=1500&&score<1600) speak('tetris','score_1500'); } if(!tetrisSeen.danger && board.slice(0,5).some(r=>r.some(Boolean))){ markTetris('danger'); } piece=nextPiece; nextPiece=newPiece(); if(hit(piece)){ over=true; clearInterval(tetrisTimer); speak('tetris','gameover'); showGameOver('tetris', '游戏结束', '本局分数：' + score + '分'); return; } } draw(); save(); }
    function drawPreview(night){ const panel={x:206,y:10,w:84,h:84}, s=nextPiece.s, cell=13; ctx.fillStyle=night?'rgba(17,24,39,.88)':'rgba(255,250,242,.92)'; ctx.fillRect(panel.x,panel.y,panel.w,panel.h); ctx.strokeStyle=night?'rgba(255,255,255,.2)':'rgba(80,55,48,.22)'; ctx.strokeRect(panel.x+.5,panel.y+.5,panel.w-1,panel.h-1); ctx.fillStyle=night?'#f5eafa':'#5d4038'; ctx.font='12px Georgia, serif'; ctx.fillText('下一块', panel.x+10, panel.y+17); const ox=panel.x+(panel.w-s[0].length*cell)/2, oy=panel.y+34+(42-s.length*cell)/2; s.forEach((r,y)=>r.forEach((v,x)=>{ if(v){ ctx.fillStyle='#ef8f7a'; ctx.fillRect(ox+x*cell+1,oy+y*cell+1,cell-2,cell-2); } })); }
    function draw(){ const night=settings().theme==='night'; ctx.fillStyle=night?'#000':'#fff'; ctx.fillRect(0,0,300,600); ctx.strokeStyle=night?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)'; for(let x=1;x<W;x++){ ctx.beginPath(); ctx.moveTo(x*S,0); ctx.lineTo(x*S,600); ctx.stroke(); } for(let y=1;y<H;y++){ ctx.beginPath(); ctx.moveTo(0,y*S); ctx.lineTo(300,y*S); ctx.stroke(); } const drawCell=(x,y,col)=>{ ctx.fillStyle=col; ctx.fillRect(x*S+1,y*S+1,S-2,S-2); }; board.forEach((r,y)=>r.forEach((v,x)=>v&&drawCell(x,y,'#9ccbbb'))); piece.s.forEach((r,y)=>r.forEach((v,x)=>v&&drawCell(piece.x+x,piece.y+y,'#ef8f7a'))); drawPreview(night); }
  }

  function addSwipe(el, cb) { el.ontouchstart = e => { const t=e.touches[0]; touchStart={x:t.clientX,y:t.clientY}; }; el.ontouchend = e => { if(!touchStart) return; const t=e.changedTouches[0], dx=t.clientX-touchStart.x, dy=t.clientY-touchStart.y; if(Math.max(Math.abs(dx),Math.abs(dy))<24) return; cb(Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up')); touchStart=null; }; }

  function getHostTargets() {
    const targets = [];
    try {
      if (window.parent && window.parent !== window) {
        void window.parent.document.body;
        const parentJQ = window.parent.$ || window.parent.jQuery || getHostJQ();
        targets.push({ doc: window.parent.document, jq: parentJQ });
      }
    } catch(e) {}
    targets.push({ doc: document, jq: (typeof $ !== 'undefined' ? $ : (typeof jQuery !== 'undefined' ? jQuery : null)) || getHostJQ() });
    return targets;
  }

  let menuRetries = 0;
  let menuRetryTimer = null;
  const menuObservers = new Map();

  function addMenuItem() {
    if (menuRetryTimer) { clearTimeout(menuRetryTimer); menuRetryTimer = null; }
    menuRetries = 0;
    tryInjectMenu();
  }

  function tryInjectMenu() {
    const targets = getHostTargets();
    for (const target of targets) {
      const pd = target.doc;
      const pj = target.jq;
      if (!pd || !pj) continue;
      if (pj('#' + MENU_ID, pd).length) { installMenuObserver(pd, pj); return; }
      let menu = null;
      for (const sel of MENU_SELECTORS) {
        const found = pj(sel, pd);
        if (found.length) { menu = found; break; }
      }
      if (menu) {
        appendMenuItem(menu, pd, pj);
        installMenuObserver(pd, pj);
        return;
      }
    }
    menuRetries++;
    if (menuRetries < 30) {
      const delay = menuRetries < 5 ? 1000 : menuRetries < 15 ? 2000 : 3000;
      menuRetryTimer = setTimeout(tryInjectMenu, delay);
    } else {
      console.warn('[玩伴小屋] 未找到 SillyTavern 扩展菜单容器，停止注入。');
    }
  }

  function appendMenuItem(menu, pd, pj) {
    if (pj('#' + MENU_ID, pd).length) return;
    const wrap = pj('<div class="extension_container interactable" tabindex="0"></div>');
    const item = pj('<div class="list-group-item flex-container flexGap5 interactable" id="' + MENU_ID + '" title="玩伴小屋"><div class="fa-fw fa-solid fa-gamepad extensionsMenuExtensionButton"></div><span>玩伴小屋</span></div>');
    item.on('click touchend pointerup', async (e) => {
      const now = Date.now();
      if (now - lastMenuOpenAt < 320) return;
      lastMenuOpenAt = now;
      if (e.type !== 'click') e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      try {
        const btn = pj('#extensionsMenuButton', pd);
        if (btn.length && menu.is(':visible')) { btn.trigger('click'); await new Promise(r => setTimeout(r, 150)); }
      } catch(e2) {}
      buildPopup();
    });
    wrap.append(item);
    menu.append(wrap);
    console.log('[玩伴小屋] 菜单项已添加');
  }

  function installMenuObserver(pd, pj) {
    const existing = menuObservers.get(pd);
    if (existing) {
      try { existing.takeRecords(); if (pd.body) return; } catch(e) {}
      try { existing.disconnect(); } catch(e) {}
      menuObservers.delete(pd);
    }
    try {
      const observer = new MutationObserver(() => {
        if (!pj || !pd.body || pj('#' + MENU_ID, pd).length) return;
        for (const sel of MENU_SELECTORS) {
          const found = pj(sel, pd);
          if (found.length) { appendMenuItem(found, pd, pj); break; }
        }
      });
      observer.observe(pd.body, { childList: true, subtree: true });
      menuObservers.set(pd, observer);
    } catch(e) {}
  }

  function init() { addMenuItem(); bindMessageNotifyEvents(); }

  if (typeof window[FLAG] === 'undefined') {
    window[FLAG] = true;
    const waitJQ = setInterval(() => {
      const jq = getHostJQ();
      if (jq) {
        clearInterval(waitJQ);
        const doc = getHostDocument();
        const state = doc.readyState;
        const startDelay = state === 'complete' ? 1500 : 4000;
        const go = () => setTimeout(init, startDelay);
        if (state === 'complete' || state === 'interactive') go();
        else doc.addEventListener('DOMContentLoaded', go);
      }
    }, 100);
  } else {
    console.warn('[玩伴小屋] Script already loaded, skipping.');
  }

  function openSummaryEditor(mask, idx) {
    const arr = summaries();
    const existing = idx >= 0 ? arr[idx] : null;
    const editor = getHostDocument().createElement('div');
    editor.className = modalMaskClass();
    editor.id = 'wb-summary-editor-mask';
    editor.innerHTML = '<div class="wb-modal wb-summary-modal"><div class="wb-modal-title">' + (existing ? '编辑大总结' : '添加/导入大总结') + '</div><div class="wb-field"><label>标题</label><input class="wb-input" id="wb-sum-name" placeholder="例：第一章剧情总结" value="' + esc(existing ? existing.name : '') + '"></div><div class="wb-field"><label>内容</label><textarea class="wb-textarea" id="wb-sum-content" style="min-height:220px;" placeholder="在此粘贴大总结，或用下方文件导入...">' + esc(existing ? existing.content : '') + '</textarea></div><div class="wb-actions"><button class="wb-btn" id="wb-sum-file-btn">从文件导入</button><input type="file" id="wb-sum-file" accept=".txt,.md,.json,.yaml,.yml,.csv,.log" style="display:none;"><button class="wb-btn" id="wb-sum-clear">清空</button></div><div class="wb-actions" style="margin-top:12px;"><button class="wb-btn primary" id="wb-sum-save" style="flex:1;">保存并导入</button><button class="wb-btn" id="wb-sum-cancel">取消</button></div></div>';
    appendModalMask(editor);
    qs('#wb-sum-file-btn', editor).onclick = () => qs('#wb-sum-file', editor).click();
    qs('#wb-sum-file', editor).onchange = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { qs('#wb-sum-content', editor).value = String(r.result || ''); if (!qs('#wb-sum-name', editor).value.trim()) qs('#wb-sum-name', editor).value = f.name.replace(/\.[^.]+$/, ''); }; r.readAsText(f); };
    qs('#wb-sum-clear', editor).onclick = () => { qs('#wb-sum-content', editor).value = ''; };
    qs('#wb-sum-cancel', editor).onclick = () => editor.remove();
    qs('#wb-sum-save', editor).onclick = () => {
      const name = qs('#wb-sum-name', editor).value.trim();
      const content = qs('#wb-sum-content', editor).value.trim();
      if (!name || !content) { toast('请输入大总结标题和内容'); return; }
      let saved;
      if (existing) { saved = Object.assign({}, existing, { name, content }); arr[idx] = saved; }
      else { saved = { id:'sum_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), name, content }; arr.unshift(saved); }
      saveSummaries(arr); setSettings({ summaryId: saved.id }); refreshSummaryInjectionUI(saved.id); editor.remove(); renderSummaryManagerList(mask); toast('大总结已保存并导入');
    };
  }
  function closeSummaryModal(mask) { if (mask) mask.remove(); const ed = qs('#wb-summary-editor-mask', getHostDocument()); if (ed) ed.remove(); }
  function saveSettingsFromUI() {
    setSettings({ injectUserDesc: qs('#wb-inject-user-desc').checked, injectCharDesc: qs('#wb-inject-char-desc').checked, injectChat: qs('#wb-inject-chat').checked, userPersona: qs('#wb-user-persona').value.trim(), charName: (qs('#wb-char-name') && qs('#wb-char-name').value.trim()) || '{{char}}', avatarUrl: qs('#wb-avatar-url') ? qs('#wb-avatar-url').value.trim() : '', summaryId: qs('#wb-summary-select').value || '', selectedWorldEntries: selectedWorldEntriesFromUI() });
    toast('注入设置已保存'); render();
  }
  function saveWorldPresetFromUI() {
    const name = qs('#wb-world-preset-name').value.trim();
    if (!name) { toast('请输入注入预设名称'); return; }
    const arr = worldPresets().filter(x => x.name !== name);
    arr.unshift(worldPresetSnapshotFromUI(name));
    saveWorldPresets(arr);
    toast('注入预设已保存为固定快照');
    renderSettings();
  }
  async function loadWorldPresetFromUI() {
    const idx = parseInt(qs('#wb-world-preset').value, 10);
    const pr = worldPresets()[idx];
    if (!pr) return;
    qs('#wb-inject-user-desc').checked = pr.injectUserDesc !== false;
    qs('#wb-inject-char-desc').checked = pr.injectCharDesc !== false;
    qs('#wb-inject-chat').checked = !!pr.injectChat;
    const im = qs('#wb-intimacy-mode'); if (im) im.checked = !!pr.intimacyMode;
    const bp = qs('#wb-break-limit-prompt'); if (bp) bp.value = pr.breakLimitPrompt || '';
    qs('#wb-user-persona').value = pr.userPersona || '';
    const cn = qs('#wb-char-name'); if (cn) cn.value = pr.charName && pr.charName !== '{{char}}' ? pr.charName : '';
    const av = qs('#wb-avatar-url'); if (av) av.value = pr.avatarUrl || '';
    qs('#wb-summary-select').value = pr.summaryId || '';
    const pv = qs('#wb-summary-preview'); if (pv) pv.textContent = pr.summarySnapshot ? ('[' + (pr.summarySnapshot.name || '大总结') + '] ' + String(pr.summarySnapshot.content || '').replace(/\s+/g, ' ').slice(0, 140)) : summaryPreview(pr.summaryId || '');
    const matched = (pr.selectedWorldEntries || []).map(x => ({ label:x.label || '', content:x.content || '', wbName:x.wbName || '', uid:x.uid || '' }));
    renderWorldbookTags(matched, true);
    setSettings({
      injectUserDesc: qs('#wb-inject-user-desc').checked,
      injectCharDesc: qs('#wb-inject-char-desc').checked,
      injectChat: qs('#wb-inject-chat').checked,
      intimacyMode: !!(qs('#wb-intimacy-mode') && qs('#wb-intimacy-mode').checked),
      breakLimitPrompt: qs('#wb-break-limit-prompt') ? qs('#wb-break-limit-prompt').value.trim() : '',
      userPersona: qs('#wb-user-persona').value.trim(),
      charName: (qs('#wb-char-name') && qs('#wb-char-name').value.trim()) || '{{char}}',
      charDescriptionSnapshot: pr.charDescriptionSnapshot || '',
      avatarUrl: qs('#wb-avatar-url') ? qs('#wb-avatar-url').value.trim() : '',
      summaryId: qs('#wb-summary-select').value || '',
      summarySnapshot: pr.summarySnapshot || null,
      selectedWorldEntries: matched
    });
    const preview = qs('#wb-char-desc-preview'); if (preview) preview.textContent = currentCharDescription(settings());
    toast('注入预设已按保存快照载入');
  }
  function deleteWorldPresetFromUI() { const idx=parseInt(qs('#wb-world-preset').value,10); const arr=worldPresets(); if(!arr[idx]) return; showConfirm('删除注入预设','确定删除这个注入预设吗？',()=>{ arr.splice(idx,1); saveWorldPresets(arr); renderSettings(); }); }

  function renderGame(id) {
    stopGame();
    currentGame = id;
    if (GAME_META[id]) currentTab = GAME_META[id].mode;
    saveWindowState(currentTab, id);
    syncPopupModeClass();
    const g = GAME_META[id]; const cfg = settings(); const body = qs('#wb-body'); body.className = 'wb-body wb-game-mode';
    const lineTools = cfg.companion ? '<div class="wb-line-tools"><select class="wb-select" id="wb-line-preset-select"></select><button class="wb-btn primary" id="wb-generate-lines">语录</button><button class="wb-btn" id="wb-prompt-preview" title="查看生成语录提示词">?</button></div>' : '';
    const pauseBtn = g.mode === 'double' ? '' : '<button class="wb-btn" id="wb-pause">暂停</button>';
    const companionPanel = cfg.companion ? '<div class="wb-panel wb-side-companion">' + companionHTML() + '</div>' : '';
    body.innerHTML = '<div class="wb-layout ' + (cfg.companion ? '' : 'no-companion') + '"><div class="wb-panel"><div class="wb-toolbar"><button class="wb-btn" id="wb-back">返回</button><div class="wb-stat"><span class="wb-pill">' + esc(g.name) + '</span><span class="wb-pill" id="wb-score">本局：0</span><span class="wb-pill" id="wb-high">' + esc(scoreDisplay(id)) + '</span></div><div class="wb-actions">' + lineTools + '<button class="wb-btn" id="wb-game-records">记录</button>' + pauseBtn + '<button class="wb-btn" id="wb-restart">重开</button></div></div><div class="wb-board-wrap" id="wb-gamebox"><div class="wb-start-cover"><div>准备开始</div><button class="wb-btn primary" id="wb-start-cover-btn">开始游戏</button></div></div></div>' + companionPanel + '</div>';
    gameStarted = false; gamePaused = true;
    qs('#wb-back').onclick = () => { stopGame(); currentGame = null; saveWindowState(currentTab, ''); syncPopupModeClass(); renderSelect(currentTab); };
    qs('#wb-start-cover-btn').onclick = () => startCurrentGame(id);
    qs('#wb-game-records').onclick = () => showGameRecords(id);
    const pbtn = qs('#wb-pause'); if (pbtn) pbtn.onclick = togglePause;
    qs('#wb-restart').onclick = () => { gamePaused = true; showGamePauseOverlay(); const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '继续'; showConfirm('确认重开', '确定要重开当前游戏吗？当前进度会丢失。', () => { clearProgress(id); renderGame(id); }); };
    renderLinePresetSelect(id);
    const presetSelect = qs('#wb-line-preset-select'); if (presetSelect) presetSelect.onchange = () => applyLinePresetSelection(id, presetSelect.value);
    const genBtn = qs('#wb-generate-lines'); if (genBtn) genBtn.onclick = () => generateLines(id);
    const promptBtn = qs('#wb-prompt-preview'); if (promptBtn) promptBtn.onclick = () => showLinePromptPreview(id);
    speak(id, 'start');
    setTimeout(() => { const saved = gameProgress(id); if (currentGame === id && saved && !gameStarted) showProgressChoice(id, saved); }, 60);
  }

  function startCurrentGame(id, savedState) {
    if (gameStarted) return;
    const resumeState = savedState || (id === 'wordguess' ? gameProgress(id) : null);
    if (!resumeState) clearProgress(id);
    gameStarted = true;
    gamePaused = false;
    hideGamePauseOverlay();
    currentRoundRecord = false;
    gameStartAt = Date.now();
    const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '暂停';
    const coverBtn = qs('#wb-start-cover-btn'); if (coverBtn) coverBtn.style.display = 'none';
    if (randomLineTimer) clearInterval(randomLineTimer);
    randomLineTimer = setInterval(() => { if (currentGame && gameStarted && !gamePaused) speak(currentGame, 'random'); }, 22000);
    if (id === 'snake') startSnake(resumeState);
    if (id === 'jump') startJump(resumeState);
    if (id === 'game2048') start2048(resumeState);
    if (id === 'watermelon') startWatermelon(resumeState);
    if (id === 'memory') startMemory(resumeState);
    if (id === 'ludo') startLudo(resumeState);
    if (id === 'guessnumber') startGuessNumber(resumeState);
    if (id === 'wordguess') startWordGuess(resumeState);
    if (id === 'tictactoe') startTicTacToe(resumeState);
    if (id === 'gomoku') startGomoku(resumeState);
    if (id === 'territory') startTerritory(resumeState);
    if (id === 'oldmaid') startOldMaid(resumeState);
    if (id === 'tetris') startTetris(resumeState);
    scheduleFitGameSurface();
  }
  function togglePause() {
    if (!gameStarted) return;
    if (!gamePaused) {
      gamePaused = true;
      showGamePauseOverlay();
      const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '继续';
      return;
    }
    startPauseResumeCountdown();
  }
  function showConfirm(title, message, onConfirm) {
    const doc = getHostDocument();
    const old = qs('#wb-confirm-mask', doc); if (old) old.remove();
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-confirm-mask';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">' + esc(title) + '</div><div style="margin-bottom:14px;line-height:1.7;">' + esc(message) + '</div><div class="wb-actions"><button class="wb-btn primary" id="wb-confirm-ok">确定</button><button class="wb-btn" id="wb-confirm-cancel">取消</button></div></div>';
    appendModalMask(mask);
    qs('#wb-confirm-ok', mask).onclick = () => { mask.remove(); onConfirm && onConfirm(); };
    qs('#wb-confirm-cancel', mask).onclick = () => mask.remove();
  }

function showGameRecords(game, page) {
    page = Math.max(1, page || 1);
    const doc = getHostDocument();
    const old = qs('#wb-record-mask', doc); if (old) old.remove();
    const g = GAME_META[game] || { name: '游戏' };
    const hideScore = game === 'oldmaid' || game === 'jump';
    const arr = (records()[game] || []).map((r,i) => Object.assign({ id:'legacy_' + i }, r));
    const pageSize = 8, total = Math.max(1, Math.ceil(arr.length / pageSize));
    page = Math.min(page, total);
    const rows = arr.slice((page - 1) * pageSize, page * pageSize).map(r => { const score = hideScore ? '' : recordScoreDisplay(r); return '<tr data-id="' + esc(r.id) + '"><td title="' + esc(r.playedAt || '') + '">' + esc(r.playedAt || '') + '</td><td>' + esc(formatDuration(r.durationMs)) + '</td><td>' + esc(formatRecordResult(r.result)) + '</td><td class="wb-rec-score-col ' + (score ? '' : 'wb-rec-empty') + '" title="' + esc(score) + '">' + esc(score) + '</td><td title="' + esc(r.companion || '') + '">' + esc(r.companion || '未记录') + '</td><td>' + (r.log ? '<button class="wb-btn wb-log-view" data-id="' + esc(r.id) + '">查看</button>' : '<span class="wb-muted">无</span>') + '</td><td><div class="wb-actions"><button class="wb-btn wb-record-del" data-id="' + esc(r.id) + '">删除</button></div></td></tr>'; }).join('');
    const empty = '<tr><td colspan="' + (hideScore ? '6' : '7') + '" style="text-align:center;color:var(--wb-sub);padding:14px;">暂无游戏记录。</td></tr>';
    const mask = doc.createElement('div'); mask.className = modalMaskClass(); mask.id = 'wb-record-mask';
    mask.innerHTML = '<div class="wb-modal wb-summary-modal" style="width:min(860px,100%);"><div class="wb-modal-title">' + esc(g.name) + ' · 游戏记录</div><div class="wb-record-table-wrap"><table class="wb-record-table ' + (hideScore ? 'wb-no-score' : '') + '"><thead><tr><th>时间</th><th>用时</th><th>结果</th><th class="wb-rec-score-col">分数/胜负</th><th>陪伴者</th><th>日志</th><th>操作</th></tr></thead><tbody>' + (rows || empty) + '</tbody></table></div><div class="wb-actions" style="margin-top:12px;justify-content:space-between;"><div><button class="wb-btn" id="wb-record-prev">上一页</button><span class="wb-pill">' + page + ' / ' + total + '</span><button class="wb-btn" id="wb-record-next">下一页</button></div><button class="wb-btn" id="wb-record-close">关闭</button></div></div>';
    appendModalMask(mask);
    qs('#wb-record-close', mask).onclick = () => mask.remove();
    qs('#wb-record-prev', mask).onclick = () => showGameRecords(game, page - 1);
    qs('#wb-record-next', mask).onclick = () => showGameRecords(game, page + 1);
    qsa('.wb-log-view', mask).forEach(b => b.onclick = () => { const r = (records()[game] || []).find(x => x.id === b.dataset.id); if (r) showTextModal('游戏日志', r.log || ''); });
    qsa('.wb-record-del', mask).forEach(b => b.onclick = () => showConfirm('删除游戏记录', '确定删除这条记录吗？', () => { deleteRecord(game, b.dataset.id); showGameRecords(game, page); }));
  }

    function showTextModal(title, text) { const doc = getHostDocument(); const old = qs('#wb-text-mask', doc); if (old) old.remove(); const mask = doc.createElement('div'); mask.className = modalMaskClass(); mask.id = 'wb-text-mask'; mask.innerHTML = '<div class="wb-modal wb-summary-modal"><div class="wb-modal-title">' + esc(title) + '</div><div class="wb-api-status wb-text-segments" style="max-height:420px;overflow:auto;">' + textSegmentsHTML(text || '') + '</div><div class="wb-actions" style="margin-top:12px;justify-content:flex-end;"><button class="wb-btn" id="wb-text-close">关闭</button></div></div>'; appendModalMask(mask); qs('#wb-text-close', mask).onclick = () => mask.remove(); }
  function showProgressChoice(game, state) {
    const doc = getHostDocument();
    const old = qs('#wb-progress-mask', doc); if (old) old.remove();
    const g = GAME_META[game] || { name: '游戏' };
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-progress-mask';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">发现上次进度</div><div style="margin-bottom:14px;line-height:1.8;">' + esc(g.name) + ' 有未结束的上一次进度，要继续还是重新开始？</div><div class="wb-actions"><button class="wb-btn primary" id="wb-progress-continue">继续上次</button><button class="wb-btn" id="wb-progress-new">重新开始</button></div></div>';
    appendModalMask(mask);
    qs('#wb-progress-continue', mask).onclick = () => { startContinueCountdown(mask, game, state); };
    qs('#wb-progress-new', mask).onclick = () => { mask.remove(); clearProgress(game); renderGame(game); };
  }

  function doubleTheaterFallback(game, outcome, special) {
    const name = companionName(); const win = outcome === 'user_win'; const score = outcome === 'score';
    const lead = special === 'win_streak3' ? '第三次胜利的提示音像夏夜烟火一样炸开，' + name + '把手背在身后，故意装作平静，却连耳尖都亮得明显。' : special === 'lose_streak3' ? '第三次失败落下时，房间安静了一瞬，' + name + '轻轻坐到你身边，把掌心覆在你的手背上。' : special === 'record' ? '新的记录跳出来那刻，' + name + '像看见秘密星座般睁大眼睛，笑意在睫毛下闪闪发亮。' : score ? '结算数字停住时，' + name + '用指尖轻轻点了点屏幕，像是在确认你刚才留下的轨迹。' : win ? '胜利弹窗亮起，' + name + '先是一怔，随后像藏不住心事的少女般笑了起来。' : '失败的字样浮现，' + name + '却没有责备，只把声音放得很轻，像黄昏落在窗边。';
    return [lead + '“这一次，我想把它记下来。”她靠近屏幕，袖口擦过你的手腕，语气柔软得像翻开的轻小说插画。游戏只是小小一局，可她望向你的眼神认真得过分，仿佛你们刚从一场盛大的冒险里并肩回来。', lead + '她弯下腰看着结果，发丝从肩头滑落，带着一点不肯服输的甜味。“再来一局的话，我还会陪你。”她这样说着，把刚才的胜负悄悄写进两个人才懂的回忆里。', lead + '屏幕的光映在她眼底，像细碎的樱花雨。她轻轻笑了一声，用近乎耳语的声音复盘刚才的瞬间，把胜负说成命运的恶作剧，也把你的名字放进最温柔的位置。'];
  }
  async function generateDoubleTheater(game, outcome, special, scoreText, cfgOverride) {
    const cfg = cfgOverride || settings(); const fallback = doubleTheaterFallback(game, outcome, special);
    if (!cfg.apiUrl || !cfg.apiModel) return fallback;
    const intimacyText = cfg.intimacyMode ? '开启。允许成年角色之间更亲近、更暧昧、更依赖，允许含蓄的NSFW暗示；禁止未成年人相关性内容、强迫、失控或违法内容。' : '关闭。保持自然陪伴和轻松亲近，禁止色情行为和露骨内容。';
    const prefix = (cfg.breakLimitPrompt || '').trim();
	    const prompt = [prefix, ...(promptTemplates().theater || PROMPT_TEMPLATES.theater), '亲密氛围模式：' + intimacyText, '游戏：' + ((GAME_META[game] || {}).name || game), '结果：' + formatRecordResult(outcome), '特殊触发：' + (special || '普通胜负'), '分数/胜负：' + (scoreText || ''), '角色描述：' + currentCharDescription(cfg), '世界背景：' + (selectedWorldText(cfg) || '无'), '大总结：' + (selectedSummaryText(cfg) || '无')].filter(Boolean).join('\n');
	    try { const txt = await callApiText(cfg, prompt, promptTemplates().systems.theater || PROMPT_TEMPLATES.systems.theater); const arr = JSON.parse(txt); if (Array.isArray(arr) && arr.length) return arr.map(normalizeTheaterItem).filter(x => x.length).slice(0,3); } catch(e) { console.warn('[玩伴小屋] theater failed:', e); }
    return fallback;
  }
  function showTheaterModal(title, lines) { const arr = Array.isArray(lines) && lines.length ? lines : ['']; const text = arr[Math.floor(Math.random() * arr.length)]; showTextModal(title || '角色互动小剧场', normalizeTheaterItem(text)); }
  async function generateGameLog(game, recordId) {
    const cfg = settings(); const rec = (records()[game] || []).find(r => r.id === recordId); if (!rec) { toast('未找到游戏记录'); return ''; }
    const fallback = companionName() + '轻声回顾了这局' + ((GAME_META[game] || {}).name || '游戏') + '：' + (rec.scoreText || formatRecordResult(rec.result)) + '。短短几分钟像被折进一页日记，她把你的认真和遗憾都记了下来。';
    if (!cfg.apiUrl || !cfg.apiModel) { updateRecord(game, recordId, { log:fallback }); toast('已生成离线日志'); return fallback; }
	    const prompt = [...(promptTemplates().gameLog || PROMPT_TEMPLATES.gameLog),'游戏：' + ((GAME_META[game] || {}).name || game),'游戏情况：' + (rec.scoreText || '') + '，结果：' + formatRecordResult(rec.result) + '，用时：' + formatDuration(rec.durationMs),'陪伴者：' + (rec.companion || companionName()),'角色描述：' + currentCharDescription(cfg),'世界背景：' + (selectedWorldText(cfg) || '无'),'大总结：' + (selectedSummaryText(cfg) || '无')].join('\n');
	    let log = fallback; try { log = await callApiText(cfg, prompt, promptTemplates().systems.gameLog || PROMPT_TEMPLATES.systems.gameLog); } catch(e) { toast('日志生成失败，已使用本地日志'); } updateRecord(game, recordId, { log }); return log;
  }
  async function showGameOver(game, title, scoreText, result) {
    clearProgress(game);
    const doc = getHostDocument();
    const old = qs('#wb-gameover-mask', doc); if (old) old.remove();
    if (snakeTimer) clearInterval(snakeTimer);
    if (tetrisTimer) clearInterval(tetrisTimer);
    if (watermelonTimer) clearInterval(watermelonTimer);
    if (jumpTimer) clearInterval(jumpTimer);
    if (randomLineTimer) clearInterval(randomLineTimer);
    snakeTimer = tetrisTimer = watermelonTimer = jumpTimer = randomLineTimer = null;
    const inferred = result || inferResult(game, title, scoreText);
    const g = GAME_META[game] || { name: '游戏', unit: '分' };
    if (g.mode === 'double' && inferred === 'ta_win' && !result) addTaWin(game);
    const rec = recordGameResult(game, title, scoreText, inferred);
    const outcome = resultOutcome(inferred);
    let special = '';
    if (g.mode === 'double') { const streak = doubleStreak(game, outcome); if (outcome === 'user_win' && streak >= 3) special = 'win_streak3'; if (outcome === 'ta_win' && streak >= 3) special = 'lose_streak3'; if (outcome === 'user_win') special = special || 'record'; }
    else if (currentRoundRecord) special = 'record';
    gamePaused = true;
    gameStarted = false;
    const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '继续';
    const high = scoreDisplay(game);
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-gameover-mask';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">' + esc(title || '游戏结束') + '</div><div style="margin-bottom:14px;line-height:1.8;"><div>游戏：' + esc(g.name) + '</div><div>' + esc(scoreText || '本局分数：0' + g.unit) + '</div><div>' + esc(high) + '</div><div>陪伴者：' + esc(companionName()) + '</div></div><div class="wb-actions"><button class="wb-btn primary" id="wb-next-round">开启下一把</button><button class="wb-btn" id="wb-generate-log">生成日志</button><button class="wb-btn" id="wb-over-close">留在本局</button></div></div>';
    appendModalMask(mask);
    const cachedTheater = theaterCache[theaterCacheKey(game, outcome, special)] || doubleTheaterFallback(game, outcome, special);
    showTheaterModal(special ? '特殊角色互动小剧场' : '角色互动小剧场', cachedTheater);
    qs('#wb-generate-log', mask).onclick = async () => { const btn = qs('#wb-generate-log', mask); btn.disabled = true; btn.textContent = '生成中...'; const log = await generateGameLog(game, rec.id); btn.disabled = false; btn.textContent = '查看日志'; btn.onclick = () => showTextModal('游戏日志', log || ''); };
    qs('#wb-next-round', mask).onclick = () => { mask.remove(); renderGame(game); startCurrentGame(game); };
    qs('#wb-over-close', mask).onclick = () => mask.remove();
  }

  function renderLinePresetSelect(game) {
    const sel = qs('#wb-line-preset-select');
    if (!sel) return;
    const active = currentLinePreset(game);
    const names = presetNamesForGame(game);
    if (!names.includes(active)) names.push(active);
    const savedOptions = names.map(name => '<option value="line::' + esc(name) + '"' + (name === active ? ' selected' : '') + '>' + esc(name) + '</option>').join('');
    const worldOptions = worldPresets().map((pr, i) => '<option value="world::' + i + '">' + esc(pr.name || ('世界观预设' + (i + 1))) + '</option>').join('');
    sel.innerHTML = '<optgroup label="当前保存语录">' + savedOptions + '</optgroup>' + (worldOptions ? '<optgroup label="世界观预设">' + worldOptions + '</optgroup>' : '');
  }

  function companionHTML() {
    const cfg = settings();
    const ctx = getHostContext();
    const char = ctx && ctx.characters && ctx.characterId >= 0 ? ctx.characters[ctx.characterId] : (ctx && ctx.character ? ctx.character : null);
    const charData = char?.data || char || {};
    const name = cfg.charName && cfg.charName !== '{{char}}' ? cfg.charName : (charData.name || ctx?.name2 || '{{char}}');
    const avatar = findAvatar();
    const av = avatar ? '<img src="' + esc(avatar) + '" style="width:100%;height:100%;object-fit:cover">' : esc(name.slice(0,1));
    return '<div class="wb-companion ' + (cfg.companion ? 'on' : '') + '" id="wb-comp"><div class="wb-comp-row"><div class="wb-avatar">' + av + '</div><div class="wb-comp-main"><div class="wb-comp-name">' + esc(name) + '</div><div class="wb-speech" id="wb-speech">...</div></div></div></div>';
  }
  function findAvatar() {
    const fixed = (settings().avatarUrl || '').trim();
    if (fixed) return fixed;
    return findCurrentCardAvatar();
  }
  function findCurrentCardAvatar() {
    for (const s of ['#avatar_div img', '.mes[is_user="false"] .avatar img', '.last_mes .avatar img', '.avatar img']) {
      const img = qs(s); if (img && img.src) return img.src;
    }
    return '';
  }
  function speak(game, event) {
    const cfg = settings(); if (!cfg.companion) return;
    const set = activeLineSet(game);
    const arr = set[event] || set.random || (DEFAULT_LINES[game] && (DEFAULT_LINES[game][event] || DEFAULT_LINES[game].random)) || ['我在。'];
    const sp = qs('#wb-speech');
    if (sp) sp.textContent = arr[Math.floor(Math.random() * arr.length)].replace(/{{char}}/g, companionName()).replace(/{{user}}/g, cfg.userName);
  }

  function theaterCacheKey(game, outcome, special) { return companionName() + '::' + game + '::' + (outcome || 'score') + '::' + (special || 'normal'); }
  function clearTheaterCacheForGame(game) {
    const prefix = companionName() + '::' + game + '::';
    Object.keys(theaterCache).forEach(k => { if (k.indexOf(prefix) === 0) delete theaterCache[k]; });
  }
  async function preGenerateTheaters(game, cfgOverride) {
    clearTheaterCacheForGame(game);
    const g = GAME_META[game] || {};
    const jobs = g.mode === 'double'
      ? [['user_win','normal'], ['ta_win','normal'], ['draw','normal'], ['user_win','win_streak3'], ['ta_win','lose_streak3'], ['user_win','record']]
      : [['score','normal'], ['score','record']];
    await Promise.all(jobs.map(async ([outcome, special]) => { const key = theaterCacheKey(game, outcome, special === 'normal' ? '' : special); theaterCache[key] = await generateDoubleTheater(game, outcome, special === 'normal' ? '' : special, '预生成小剧场', cfgOverride); }));
  }

  async function generateLines(game) {
    const cfg = settings(); const btn = qs('#wb-generate-lines'); if (!btn) return; btn.disabled = true; btn.textContent = '生成中';
    let preset = currentLinePreset(game);
    let promptCfg = cfg;
    try {
      const select = qs('#wb-line-preset-select');
      if (select && select.value && select.value.indexOf('world::') === 0) {
        const pr = worldPresets()[parseInt(select.value.slice(7), 10)];
        if (pr) { promptCfg = Object.assign({}, cfg, pr); preset = normalizePresetName(pr.name); }
      } else if (select && select.value) {
        preset = normalizePresetName(select.value.replace(/^line::/, ''));
        const pr = worldPresets().find(x => normalizePresetName(x.name) === preset);
        if (pr) promptCfg = Object.assign({}, cfg, pr);
      }
      setCurrentLinePreset(game, preset);
      let data = null;
      if (promptCfg.apiUrl && promptCfg.apiModel) {
        try { data = await callLineApiBatches(promptCfg, game); }
        catch(apiErr) { console.warn('[玩伴小屋] line API failed, fallback used:', apiErr); toast('语录API失败，已使用本地语录：' + (apiErr && apiErr.message ? apiErr.message : apiErr)); }
      }
      if (!data) data = fallbackGenerated(game, promptCfg);
      data = normalizeGeneratedLines(game, data);
      saveRoleLineSet(game, preset, data);
      renderLinePresetSelect(game);
      toast('已覆盖“' + companionName() + ' / ' + preset + '”的全部事件语录，正在重新生成小剧场');
      try { await preGenerateTheaters(game, promptCfg); toast('全部语录和小剧场已重新生成并覆盖'); }
      catch(theaterErr) { console.warn('[玩伴小屋] theater pregenerate failed:', theaterErr); toast('语录已保存，小剧场生成失败时会使用本地小剧场'); }
      speak(game, 'start');
    } catch(e) { console.error('[玩伴小屋] generateLines failed:', e); toast('生成失败：' + (e && e.message ? e.message : '响应无法解析')); }
    finally { btn.disabled = false; btn.textContent = '生成语录'; }
  }
	  function buildPrompt(game, cfg, eventKeys) {
	    const keys = eventKeys && eventKeys.length ? eventKeys : Object.keys(DEFAULT_LINES[game] || {});
	    const events = keys.join(', ');
	    const tpl = promptTemplates().lineGeneration || PROMPT_TEMPLATES.lineGeneration;
	    const userDesc = currentUserDescription(cfg);
    const charDesc = currentCharDescription(cfg);
    const chatDesc = cfg.injectChat ? '请参考当前最新聊天记录的关系氛围（插件不直接上传聊天全文时按此要求处理）' : '不注入';
    const wbText = selectedWorldText(cfg) || '无';
    const summaryText = selectedSummaryText(cfg) || '无';
    const recentLogs = recentGameLogs(game) || '无';
    const intimacyText = cfg.intimacyMode ? '开启。允许成年角色之间更亲近、更暧昧、更依赖，允许含蓄的NSFW暗示；禁止未成年人相关性内容、强迫、失控或违法内容。' : '关闭。保持自然陪伴和轻松亲近，禁止色情行为和露骨内容。';
	    const prefix = (cfg.breakLimitPrompt || '').trim();
	    return [
	      prefix,
	      ...(tpl.header || []),
	      '游戏：' + GAME_META[game].name,
      '事件键：' + events,
      '事件键解释：\n' + eventDescriptionBlock(game, keys),
      '【用户设定描述】\n' + userDesc,
      '【角色描述】\n' + charDesc,
      '【注入最新聊天记录】\n' + chatDesc,
      '【当前挂载的世界书】\n' + wbText,
      '【导入大总结】\n' + summaryText,
	      '【最近5条游戏日志】\n' + recentLogs,
	      '【亲密氛围模式】\n' + intimacyText,
	      ...(tpl.rules || []),
	      ...(tpl.output || [])
	    ].filter(Boolean).join('\n');
	  }
  function apiChatUrl(url) {
    let base = (url || '').trim();
    if (!base) return '';
    if (/\/chat\/completions\/?$/.test(base)) return base;
    base = base.endsWith('/') ? base : base + '/';
    if (!base.includes('/v1/') && !base.endsWith('v1/')) base += 'v1/';
    return base + 'chat/completions';
  }
  function parseGeneratedJson(text) {
    let s = stripJsonFence(text);
    try { return JSON.parse(s); } catch(e) {}
    const sub = extractJsonCandidate(s);
    if (sub) {
      try { return JSON.parse(sub); } catch(e2) {}
    }
    throw new Error('AI返回内容不是可解析JSON');
  }
  function normalizeGeneratedLines(game, data) {
    const events = Object.keys(DEFAULT_LINES[game] || {});
    const out = {};
    events.forEach(k => {
      let v = data && data[k];
      if (typeof v === 'string') v = [v];
      if (!Array.isArray(v)) v = [];
      v = v.map(x => String(x == null ? '' : x).trim()).filter(Boolean);
      if (!v.length) v = (DEFAULT_LINES[game] && DEFAULT_LINES[game][k]) || ['我在。'];
      out[k] = v;
    });
    return out;
  }
  async function callApi(cfg, prompt) {
    const url = apiChatUrl(cfg.apiUrl);
    if (!url) throw new Error('请先配置API基础URL');
    if (!cfg.apiModel) throw new Error('请先选择模型');
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
    const res = await fetchWithTimeout(url, {
      method: 'POST', headers,
      body: JSON.stringify({ model: cfg.apiModel, messages: [{ role: 'system', content: promptTemplates().systems.lineGeneration || PROMPT_TEMPLATES.systems.lineGeneration }, { role: 'user', content: prompt }], temperature: 0.85, max_tokens: 6144 })
    }, 60000);
    if (!res.ok) { const t = await res.text().catch(()=> ''); throw new Error('API错误 ' + res.status + ': ' + t.slice(0, 120)); }
    const json = await res.json();
    const txt = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || json.output_text || '';
    if (!txt) throw new Error('API响应格式异常');
    return parseGeneratedJson(txt);
  }
  async function callLineApiBatches(cfg, game) {
    const keys = Object.keys(DEFAULT_LINES[game] || {});
    const merged = {};
    const errors = [];
    const batchSize = 4;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      try {
        const data = await callApi(cfg, buildPrompt(game, cfg, batch));
        batch.forEach(k => {
          if (data && data[k] != null) merged[k] = data[k];
        });
      } catch (e) {
        errors.push(e);
        console.warn('[玩伴小屋] line batch failed:', batch.join(','), e);
      }
    }
    if (!Object.keys(merged).length && errors.length) throw errors[0];
    return merged;
  }
  function fallbackGenerated(game, cfg) { const who = currentCharDescription(cfg).includes('未读取') ? '我陪你' : '按现在的语气陪你'; const out = {}; Object.keys(DEFAULT_LINES[game]).forEach(k => out[k] = [who + '，这一刻我记下了。', '别急，下一步更重要。', '这局还没结束，继续。', '我在旁边看着你，这一步很稳。', '这个节奏可以，先保持住。', '我们再把这一局往前推一点。']); return out; }
  function setScore(game, value) {
    const g = GAME_META[game] || {};
    const sc = scores();
    if (g.mode === 'double') {
      const cur = sc[game] && typeof sc[game] === 'object' ? sc[game] : { user: sc[game] || 0, ta: 0 };
      if (value > (cur.user || 0)) cur.user = value;
      sc[game] = cur; saveJSON(STORAGE_SCORES, sc);
      const h = qs('#wb-high'); if (h) h.textContent = scoreDisplay(game);
    } else {
      const old = sc[game] || 0;
      if (value > old) { sc[game] = value; saveJSON(STORAGE_SCORES, sc); if (!currentRoundRecord && old > 0 && DEFAULT_LINES[game] && DEFAULT_LINES[game].record) { currentRoundRecord = true; speak(game, 'record'); } }
    }
    const s = qs('#wb-score'); if (s) s.textContent = '本局：' + value;
  }

  function startSnake(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<div class="wb-snake-shell"><canvas class="wb-canvas" id="wb-canvas" width="420" height="420"></canvas><div class="wb-snake-controls" aria-label="贪吃蛇方向键"><button class="wb-btn up" data-dir="up" type="button">▲</button><button class="wb-btn left" data-dir="left" type="button">◀</button><button class="wb-btn down" data-dir="down" type="button">▼</button><button class="wb-btn right" data-dir="right" type="button">▶</button></div></div>';
    const c = qs('#wb-canvas'), ctx = c.getContext('2d'), n = 21, size = 20;
    let snake = Array.isArray(state?.snake) && state.snake.length ? state.snake : [{x:10,y:10}];
    let dir = state?.dir || {x:1,y:0}, next = state?.next || dir, food = state?.food || randFood(), score = state?.score || 0, dead = false;
    setScore('snake', score);
    function randFood(){ let p; do { p = {x:Math.floor(Math.random()*n), y:Math.floor(Math.random()*n)}; } while(snake.some(s=>s.x===p.x&&s.y===p.y)); return p; }
    function save(){ if (!dead) saveProgress('snake', { snake, dir, next, food, score }); }
    function setSnakeDir(name){ const m={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[name]; if(m && (m.x !== -dir.x || m.y !== -dir.y)){ next=m; speak('snake','turn'); save(); } }
    getHostDocument().onkeydown = e => { const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key]; if(k){ setSnakeDir(k); e.preventDefault(); } };
    addSwipe(box, setSnakeDir);
    qsa('.wb-snake-controls .wb-btn', box).forEach(btn => btn.onclick = e => { e.preventDefault(); setSnakeDir(btn.dataset.dir); });
    function snakeDelay(){ return Math.max(55, 150 - Math.floor(score / 10) * 6); }
    function scheduleSnake(){ if(!dead) snakeTimer = setTimeout(stepSnake, snakeDelay()); }
    function stepSnake(){ if(dead) return; if(gamePaused){ scheduleSnake(); return; } dir = next; const h = {x: snake[0].x + dir.x, y: snake[0].y + dir.y}; if(h.x<0||h.y<0||h.x>=n||h.y>=n||snake.some(s=>s.x===h.x&&s.y===h.y)){ dead=true; speak('snake','gameover'); showGameOver('snake', '游戏结束', '本局分数：' + score + '分'); return; } const nearWall=h.x<=1||h.y<=1||h.x>=n-2||h.y>=n-2, nearSelf=snake.slice(1).some(s=>Math.abs(s.x-h.x)+Math.abs(s.y-h.y)<=1); if((nearWall||nearSelf) && Math.random()<.08) speak('snake','close_call'); snake.unshift(h); if(h.x===food.x&&food.y===h.y){ score += 10; setScore('snake', score); const eaten = score/10; if(eaten===1) speak('snake','eat_1'); if([5,10,20].includes(eaten)) speak('snake','eat_'+eaten); if(eaten>1 && eaten%4===0) speak('snake','speed_up'); food=randFood(); } else snake.pop(); draw(); save(); scheduleSnake(); }
    scheduleSnake();
    function draw(){
      const night = settings().theme === 'night';
      ctx.fillStyle = night ? '#000' : '#fff';
      ctx.fillRect(0,0,420,420);
      ctx.strokeStyle = night ? 'rgba(255,255,255,.06)' : 'rgba(102,75,60,.12)';
      ctx.lineWidth = 1;
      for(let i=0;i<=n;i++){ const p=i*size+.5; ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,420); ctx.moveTo(0,p); ctx.lineTo(420,p); ctx.stroke(); }
      ctx.strokeStyle = night ? 'rgba(255,255,255,.2)' : 'rgba(80,55,48,.2)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5,1.5,417,417);
      const fx = food.x*size + size/2, fy = food.y*size + size/2;
      ctx.fillStyle = '#ef8f7a';
      ctx.beginPath(); ctx.arc(fx, fy, 8.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd4c8';
      ctx.beginPath(); ctx.arc(fx-3, fy-3, 2.4, 0, Math.PI*2); ctx.fill();
      snake.forEach((s,i)=>{
        const x=s.x*size+2, y=s.y*size+2, r=7;
        ctx.fillStyle = i===0 ? '#76c7b5' : (i%2 ? '#9ccbbb' : '#8fc5ad');
        ctx.beginPath();
        ctx.moveTo(x+r,y); ctx.lineTo(x+16-r,y); ctx.quadraticCurveTo(x+16,y,x+16,y+r); ctx.lineTo(x+16,y+16-r); ctx.quadraticCurveTo(x+16,y+16,x+16-r,y+16); ctx.lineTo(x+r,y+16); ctx.quadraticCurveTo(x,y+16,x,y+16-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.fill();
        if(i===0){ ctx.fillStyle=night?'#101010':'#fffaf2'; const ex1=x+7+(dir.x*3)+(dir.y*-3), ey1=y+7+(dir.y*3)+(dir.x*3), ex2=x+9+(dir.x*3)+(dir.y*3), ey2=y+9+(dir.y*3)+(dir.x*-3); ctx.beginPath(); ctx.arc(ex1,ey1,1.7,0,Math.PI*2); ctx.arc(ex2,ey2,1.7,0,Math.PI*2); ctx.fill(); }
      });
    }
    draw(); save();
  }

  function start2048(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<div class="wb-grid2048" id="wb-2048"></div>';
    let board = Array.isArray(state?.board) && state.board.length === 16 ? state.board : Array(16).fill(0), score = state?.score || 0, seen = state?.seen || {};
    if (!state?.board) { add(); add(); }
    draw(); save();
    getHostDocument().onkeydown = e => { const dirs = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'}; if(dirs[e.key]){ e.preventDefault(); move(dirs[e.key]); } };
    addSwipe(box, move);
    function save(){ saveProgress('game2048', { board, score, seen }); }
    function add(){ const empt=board.map((v,i)=>v?null:i).filter(v=>v!==null); if(empt.length) board[empt[Math.floor(Math.random()*empt.length)]] = Math.random()<.9?2:4; }
    function rows(dir){ const r=[]; for(let y=0;y<4;y++) r.push([0,1,2,3].map(x=>y*4+x)); if(dir==='right') r.forEach(a=>a.reverse()); if(dir==='up'||dir==='down'){ r.length=0; for(let x=0;x<4;x++) r.push([0,1,2,3].map(y=>y*4+x)); if(dir==='down') r.forEach(a=>a.reverse()); } return r; }
    function move(dir){ if (gamePaused) return; const old=board.join(','); rows(dir).forEach(idx=>{ let vals=idx.map(i=>board[i]).filter(Boolean); for(let i=0;i<vals.length-1;i++) if(vals[i]===vals[i+1]){ vals[i]*=2; score+=vals[i]; vals.splice(i+1,1); } while(vals.length<4) vals.push(0); idx.forEach((p,i)=>board[p]=vals[i]); }); if(board.join(',')!==old){ if(!seen.move){ seen.move=1; speak('game2048','move'); } add(); if(!seen.stuck && board.filter(Boolean).length>=13){ seen.stuck=1; speak('game2048','stuck'); } draw(); save(); } if(!board.includes(0) && !canMove()) { speak('game2048','gameover'); showGameOver('game2048', '游戏结束', '本局分数：' + score + '分'); } }
    function canMove(){ return rows('left').some(idx=>idx.some((p,i)=>i<3 && board[p]===board[idx[i+1]])) || rows('up').some(idx=>idx.some((p,i)=>i<3 && board[p]===board[idx[i+1]])); }
    function draw(){ setScore('game2048', score); const grid=qs('#wb-2048'); grid.innerHTML=board.map(v=>'<div class="wb-tile" style="background:' + tileColor(v) + ';font-size:' + (v>999?22:28) + 'px">' + (v||'') + '</div>').join(''); [64,128,256,512,1024,2048].forEach(v=>{ if(board.includes(v)&&!seen[v]){ seen[v]=1; speak('game2048','tile_'+v); } }); }
    function tileColor(v){ return ({0:'#cdc0b6',2:'#eee4da',4:'#ead8c7',8:'#efb07e',16:'#ec9368',32:'#e87865',64:'#e95f51',128:'#e4c16d',256:'#dfb954',512:'#d7ac3f',1024:'#cfa02f',2048:'#9ccbbb'})[v] || '#40342f'; }
  }

  function startTicTacToe(state) {
    const box = qs('#wb-gamebox');
    let b = Array.isArray(state?.b) && state.b.length === 9 ? state.b : Array(9).fill(''), over=false;
    box.innerHTML = '<div class="wb-board3">' + b.map((_,i)=>'<button class="wb-cell" data-i="'+i+'"></button>').join('') + '</div>';
    draw(); save();
    qsa('.wb-cell', box).forEach(cell => cell.onclick = () => { const i=+cell.dataset.i; if(gamePaused||over||b[i]) return; b[i]='X'; if(i===4) speak('tictactoe','user_center'); else if([0,2,6,8].includes(i)) speak('tictactoe','user_corner'); draw(); if(done()) return; ai(); draw(); if(!done()) save(); });
    function save(){ saveProgress('tictactoe', { b }); }
    function ai(){ const i = bestTic(b,'O') ?? bestTic(b,'X') ?? [4,0,2,6,8,1,3,5,7].find(i=>!b[i]); if(i!=null){ if(bestTic(b,'X')===i) speak('tictactoe','ai_block'); b[i]='O'; } }
    function done(){ const w=winner3(b); if(w||b.every(Boolean)){ over=true; if(w==='X'){ { const curScore = scores().tictactoe; setScore('tictactoe', ((curScore && typeof curScore === 'object' ? curScore.user : curScore) || 0) + 1); } speak('tictactoe','user_win'); showGameOver('tictactoe', '你赢了', '本局分数：1胜'); } else if(w==='O') { speak('tictactoe','user_lose'); showGameOver('tictactoe', '游戏结束', '本局分数：0胜（失败）'); } else { speak('tictactoe','draw'); showGameOver('tictactoe', '平局', '本局分数：0胜（平局）'); } return true; } return false; }
    function draw(){ qsa('.wb-cell', box).forEach((c,i)=>c.textContent=b[i]); }
  }
  function bestTic(b, m){ const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for(const w of wins){ const vals=w.map(i=>b[i]); if(vals.filter(v=>v===m).length===2 && vals.includes('')) return w[vals.indexOf('')]; } return null; }
  function winner3(b){ const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for(const w of wins) if(b[w[0]]&&b[w[0]]===b[w[1]]&&b[w[1]]===b[w[2]]) return b[w[0]]; return ''; }

  function startGomoku(state) {
    const box = qs('#wb-gamebox'), n=15;
    let b = Array.isArray(state?.b) && state.b.length === n*n ? state.b : Array(n*n).fill(''), over=false;
    box.innerHTML = '<div class="wb-gomoku">' + b.map((_,i)=>'<button class="wb-gcell" data-i="'+i+'"></button>').join('') + '</div>';
    draw(); save();
    qsa('.wb-gcell', box).forEach(cell => cell.onclick = () => { const i=+cell.dataset.i; if(gamePaused||over||b[i]) return; b[i]='B'; if(lineScore(b,n,i,'B')>=125) speak('gomoku','user_three'); draw(); if(done('B')) return; const ai=bestGomoku(b,n); if(ai>=0){ b[ai]='W'; if(lineScore(b,n,ai,'W')>=80) speak('gomoku','ai_threat'); draw(); if(!done('W')) save(); } });
    function save(){ saveProgress('gomoku', { b }); }
    function done(m){ if(winG(b,n,m)){ over=true; if(m==='B'){ { const curScore = scores().gomoku; setScore('gomoku', ((curScore && typeof curScore === 'object' ? curScore.user : curScore) || 0) + 1); } speak('gomoku','user_win'); showGameOver('gomoku', '你赢了', '本局分数：1胜'); } else { speak('gomoku','user_lose'); showGameOver('gomoku', '游戏结束', '本局分数：0胜（失败）'); } return true; } if(b.every(Boolean)){ over=true; speak('gomoku','draw'); showGameOver('gomoku', '平局', '本局分数：0胜（平局）'); return true; } return false; }
    function draw(){ qsa('.wb-gcell', box).forEach((c,i)=>{ c.className='wb-gcell' + (b[i]==='B'?' black':b[i]==='W'?' white':''); }); }
  }
  function bestGomoku(b,n){ const empty=b.map((v,i)=>v?'':i).filter(v=>v!==''); let best=-1, bestScore=-1; for(const i of empty){ let score=lineScore(b,n,i,'W')*1.1 + lineScore(b,n,i,'B'); if(score>bestScore){ bestScore=score; best=i; } } if(bestScore>=80) speak('gomoku','ai_block'); return best; }
  function lineScore(b,n,i,m){ const x=i%n,y=Math.floor(i/n), dirs=[[1,0],[0,1],[1,1],[1,-1]]; let total=0; for(const [dx,dy] of dirs){ let c=1; for(const s of [-1,1]){ let nx=x+dx*s, ny=y+dy*s; while(nx>=0&&ny>=0&&nx<n&&ny<n&&b[ny*n+nx]===m){ c++; nx+=dx*s; ny+=dy*s; } } total += Math.pow(5,c); } return total; }
  function winG(b,n,m){ for(let y=0;y<n;y++) for(let x=0;x<n;x++) if(b[y*n+x]===m) for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){ let c=0; for(let k=0;k<5;k++){ const nx=x+dx*k, ny=y+dy*k; if(nx>=0&&ny>=0&&nx<n&&ny<n&&b[ny*n+nx]===m) c++; } if(c===5) return true; } return false; }

  function startTerritory(state) {
    const box = qs('#wb-gamebox'), N = 5;
    const makeH = () => Array.from({length:N+1}, () => Array(N).fill(''));
    const makeV = () => Array.from({length:N}, () => Array(N+1).fill(''));
    const makeO = () => Array.from({length:N}, () => Array(N).fill(''));
    let h = Array.isArray(state?.h) && state.h.length === N+1 ? state.h : makeH();
    let v = Array.isArray(state?.v) && state.v.length === N ? state.v : makeV();
    let owner = Array.isArray(state?.owner) && state.owner.length === N ? state.owner : makeO();
    let turn = state?.turn || 'user', userScore = state?.userScore || 0, taScore = state?.taScore || 0, busy = false, over = false, chain = 0;
    box.innerHTML = '<div class="wb-territory-panel"><div class="wb-territory-info"><span class="wb-pill" id="wb-territory-turn"></span><span class="wb-pill" id="wb-territory-score"></span></div><div class="wb-territory-board" id="wb-territory-board"></div></div>';
    draw(); save(); speak('territory','start');
    if(turn === 'ta') setTimeout(robot, 500);
    function save(){ if(!over) saveProgress('territory', { h, v, owner, turn, userScore, taScore }); }
    function sideCount(x,y){ return (h[y][x]?1:0) + (h[y+1][x]?1:0) + (v[y][x]?1:0) + (v[y][x+1]?1:0); }
    function cellsFor(kind,r,c){ const arr=[]; if(kind==='h'){ if(r>0) arr.push([c,r-1]); if(r<N) arr.push([c,r]); } else { if(c>0) arr.push([c-1,r]); if(c<N) arr.push([c,r]); } return arr; }
    function allEdges(){ const out=[]; for(let y=0;y<=N;y++) for(let x=0;x<N;x++) if(!h[y][x]) out.push(['h',y,x]); for(let y=0;y<N;y++) for(let x=0;x<=N;x++) if(!v[y][x]) out.push(['v',y,x]); return out; }
    function edgeEndpoints(e){ const k=e[0], r=e[1], c=e[2]; return k==='h' ? [[c,r],[c+1,r]] : [[c,r],[c,r+1]]; }
    function adjacentEdge(a,b){ if(!a||!b) return true; const ea=edgeEndpoints(a), eb=edgeEndpoints(b); return ea.some(p => eb.some(q => p[0]===q[0] && p[1]===q[1])); }
    function claimedEdges(){ const out=[]; for(let y=0;y<=N;y++) for(let x=0;x<N;x++) if(h[y][x]) out.push(['h',y,x]); for(let y=0;y<N;y++) for(let x=0;x<=N;x++) if(v[y][x]) out.push(['v',y,x]); return out; }
    function legalEdges(){ const edges=allEdges(), claimed=claimedEdges(); if(!claimed.length) return edges; const nearby=edges.filter(e => claimed.some(done => adjacentEdge(e,done))); return nearby.length ? nearby : edges; }
    function isLegalEdge(kind,r,c){ return legalEdges().some(e => e[0]===kind && e[1]===r && e[2]===c); }
    function wouldComplete(e){ return cellsFor(e[0],e[1],e[2]).some(([x,y]) => !owner[y][x] && sideCount(x,y) === 3); }
    function isSafe(e){ return cellsFor(e[0],e[1],e[2]).every(([x,y]) => owner[y][x] || sideCount(x,y) < 2); }
    function applyEdge(kind,r,c, who){ if(kind==='h'){ if(h[r][c]) return 0; h[r][c]=who; } else { if(v[r][c]) return 0; v[r][c]=who; } let gained=0; cellsFor(kind,r,c).forEach(([x,y]) => { if(!owner[y][x] && sideCount(x,y) === 4){ owner[y][x]=who; gained++; } }); if(gained){ if(who==='user') userScore += gained; else taScore += gained; } return gained; }
    function human(kind,r,c){ if(over||busy||turn!=='user') return; if(!isLegalEdge(kind,r,c)){ toast('要贴着已有线继续画'); return; } if(cellsFor(kind,r,c).some(([x,y]) => !owner[y][x] && sideCount(x,y) === 2)) speak('territory','danger'); const gained=applyEdge(kind,r,c,'user'); if(gained){ chain += gained; speak('territory', chain > 1 ? 'chain' : 'capture'); } else { chain = 0; speak('territory','edge'); turn='ta'; } draw(); save(); if(done()) return; if(turn==='ta'){ busy=true; setTimeout(robot, 520); } }
    function robot(){ if(over||turn!=='ta'||currentGame!=='territory') return; const edges=legalEdges(); if(!edges.length){ done(); return; } const completions=edges.filter(wouldComplete), safe=edges.filter(isSafe); const pool=completions.length ? completions : (safe.length ? safe : edges); const e=pool[Math.floor(Math.random()*pool.length)]; const gained=applyEdge(e[0],e[1],e[2],'ta'); if(gained){ speak('territory','ta_capture'); draw(); save(); if(done()) return; setTimeout(robot, 520); return; } turn='user'; chain=0; speak('territory','user_turn'); busy=false; draw(); save(); done(); }
    function done(){ if(allEdges().length) return false; over=true; clearProgress('territory'); const text='本局：你 '+userScore+' 格，TA '+taScore+' 格'; if(userScore>taScore){ const cur=scores().territory; setScore('territory', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('territory','user_win'); showGameOver('territory','你赢了',text,'user_win'); } else if(taScore>userScore){ addTaWin('territory'); speak('territory','user_lose'); showGameOver('territory','游戏结束',text,'ta_win'); } else { speak('territory','draw'); showGameOver('territory','平局',text,'draw'); } return true; }
    function draw(){ const scoreEl=qs('#wb-score'); if(scoreEl) scoreEl.textContent='本局：' + userScore + ':' + taScore; const t=qs('#wb-territory-turn'); if(t) t.textContent=(turn==='user'?'你的回合':'机器人回合') + (claimedEdges().length ? '，贴着已有线' : ''); const s=qs('#wb-territory-score'); if(s) s.textContent='你 '+userScore+' / TA '+taScore; const board=qs('#wb-territory-board'); if(!board) return; const cells=[]; for(let gy=0;gy<N*2+1;gy++) for(let gx=0;gx<N*2+1;gx++){ if(gy%2===0&&gx%2===0) cells.push('<div class="wb-territory-dot"></div>'); else if(gy%2===0){ const r=gy/2,c=(gx-1)/2,val=h[r][c], legal=!val&&turn==='user'&&!busy&&isLegalEdge('h',r,c); cells.push('<button class="wb-territory-edge h'+(val?' claimed '+val:'')+(legal?' legal':'')+'" data-k="h" data-r="'+r+'" data-c="'+c+'" '+(!legal?'disabled':'')+'></button>'); } else if(gx%2===0){ const r=(gy-1)/2,c=gx/2,val=v[r][c], legal=!val&&turn==='user'&&!busy&&isLegalEdge('v',r,c); cells.push('<button class="wb-territory-edge v'+(val?' claimed '+val:'')+(legal?' legal':'')+'" data-k="v" data-r="'+r+'" data-c="'+c+'" '+(!legal?'disabled':'')+'></button>'); } else { const x=(gx-1)/2,y=(gy-1)/2,o=owner[y][x]; cells.push('<div class="wb-territory-cell '+(o||'')+'">'+(o==='user'?'你':o==='ta'?'TA':'')+'</div>'); } } board.innerHTML=cells.join(''); qsa('.wb-territory-edge', board).forEach(btn => btn.onclick = () => human(btn.dataset.k, +btn.dataset.r, +btn.dataset.c)); }
  }

  function startOldMaid(state) {
    const box = qs('#wb-gamebox');
    let userHand = Array.isArray(state?.userHand) ? state.userHand : null;
    let taHand = Array.isArray(state?.taHand) ? state.taHand : null;
    let turn = state?.turn || 'user', phase = state?.phase || 'user_pick', busy = false, over = false;
    let pending = state?.pending || null;
    const log = Array.isArray(state?.log) ? state.log.slice(0, 6) : [];
    if (!userHand || !taHand) deal();
    box.innerHTML = '<div class="wb-oldmaid"><div class="wb-oldmaid-status" id="wb-oldmaid-status"></div><div class="wb-oldmaid-reveal" id="wb-oldmaid-reveal"></div><div class="wb-oldmaid-zone"><div class="wb-muted">TA的手牌</div><div class="wb-oldmaid-hand backs" id="wb-oldmaid-ta"></div></div><div class="wb-oldmaid-zone"><div class="wb-muted">你的手牌</div><div class="wb-oldmaid-hand" id="wb-oldmaid-user"></div></div><div class="wb-oldmaid-log" id="wb-oldmaid-log"></div></div>';
    speak('oldmaid','start'); draw(); save();
    function deal(){ const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q']; const suits=['♠','♥']; const deck=shuffleArray(ranks.flatMap(r=>suits.map(s=>r+s)).concat('JOKER')); userHand=[]; taHand=[]; deck.forEach((c,i)=>(i%2?taHand:userHand).push(c)); removePairs(userHand); removePairs(taHand); }
    function rank(c){ return c==='JOKER' ? 'JOKER' : c.slice(0,-1); }
    function label(c){ return c==='JOKER' ? '🃏' : c; }
    function removePairs(hand){ let removed=0; const seen={}; hand.slice().forEach(c=>{ const r=rank(c); if(r==='JOKER') return; (seen[r] ||= []).push(c); }); Object.keys(seen).forEach(r=>{ while(seen[r].length >= 2){ const a=seen[r].pop(), b=seen[r].pop(); hand.splice(hand.indexOf(a),1); hand.splice(hand.indexOf(b),1); removed++; } }); return removed; }
    function save(){ if(!over) saveProgress('oldmaid', { userHand, taHand, turn, phase, pending, log }); }
    function addLog(text){ log.unshift(text); if(log.length>6) log.pop(); }
    function drawCard(from, to, i){ const card = from.splice(i, 1)[0]; to.push(card); return card; }
    function human(i){ if(over||busy||turn!=='user'||phase!=='user_pick'||i<0||i>=taHand.length) return; const card=drawCard(taHand,userHand,i); pending={ actor:'user', card }; phase='user_review'; addLog('你抽到了 ' + label(card)); speak('oldmaid', card==='JOKER' ? 'joker' : 'draw'); draw(); save(); }
    function continueUser(){ if(over||phase!=='user_review') return; const pairs=removePairs(userHand); if(pairs){ addLog('你丢掉了 ' + pairs + ' 对牌'); speak('oldmaid','pair'); } pending=null; if(done()) return; turn='ta'; phase='ta_thinking'; busy=true; draw(); save(); setTimeout(robot, 900); }
    function robot(){ if(over||turn!=='ta'||currentGame!=='oldmaid') return; if(!userHand.length){ done(); return; } const card=drawCard(userHand,taHand,Math.floor(Math.random()*userHand.length)); pending={ actor:'ta', card }; phase='ta_review'; busy=false; addLog('TA抽走了 ' + label(card)); speak('oldmaid', card==='JOKER' ? 'joker' : 'ta_draw'); draw(); save(); }
    function continueTa(){ if(over||phase!=='ta_review') return; const pairs=removePairs(taHand); if(pairs){ addLog('TA丢掉了 ' + pairs + ' 对牌'); speak('oldmaid','ta_pair'); } pending=null; if(done()) return; turn='user'; phase='user_pick'; busy=false; draw(); save(); }
    function done(){ if(userHand.length && taHand.length) return false; over=true; clearProgress('oldmaid'); const userWon = userHand.length === 0; if(userWon){ const cur=scores().oldmaid; setScore('oldmaid', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('oldmaid','user_win'); showGameOver('oldmaid','你赢了','本局：你先清空手牌','user_win'); } else { addTaWin('oldmaid'); speak('oldmaid','user_lose'); showGameOver('oldmaid','游戏结束','本局：你留下了鬼牌','ta_win'); } return true; }
    function drawCardHTML(c, extra){ return '<div class="wb-oldmaid-card '+(c==='JOKER'?'joker':'')+' '+(extra||'')+'">'+esc(label(c))+'</div>'; }
    function draw(){ const scoreEl=qs('#wb-score'); if(scoreEl) scoreEl.textContent='本局：你' + userHand.length + '张 / TA' + taHand.length + '张'; const st=qs('#wb-oldmaid-status'); if(st) st.textContent=(phase==='user_pick'?'你的回合：从TA手里抽一张':phase==='user_review'?'看清抽到的牌，然后手动丢对子':phase==='ta_review'?'TA抽走了这张牌，确认后继续':'TA正在抽牌') + ' · 你' + userHand.length + '张 / TA' + taHand.length + '张'; const reveal=qs('#wb-oldmaid-reveal'); if(reveal){ reveal.innerHTML=pending ? '<div class="wb-oldmaid-reveal-text">'+(pending.actor==='user'?'你抽到':'TA抽走')+'</div>'+drawCardHTML(pending.card,'big')+'<button class="wb-btn primary" id="wb-oldmaid-next">'+(pending.actor==='user'?'丢对子并让TA抽':'知道了，继续')+'</button>' : ''; const nb=qs('#wb-oldmaid-next', reveal); if(nb) nb.onclick=pending.actor==='user'?continueUser:continueTa; } const ta=qs('#wb-oldmaid-ta'); if(ta){ ta.innerHTML=taHand.map((_,i)=>'<button class="wb-oldmaid-card back" data-i="'+i+'" '+(phase!=='user_pick'||turn!=='user'||busy?'disabled':'')+'>?</button>').join(''); qsa('.wb-oldmaid-card',ta).forEach(btn=>btn.onclick=()=>human(+btn.dataset.i)); } const user=qs('#wb-oldmaid-user'); if(user) user.innerHTML=userHand.map(c=>drawCardHTML(c)).join(''); const lg=qs('#wb-oldmaid-log'); if(lg) lg.innerHTML=log.map(esc).join('<br>'); }
  }


  function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  function startMemory(state) {
    const box = qs('#wb-gamebox');
    const icons = Array.from({ length: 8 }, (_, i) => 'memory-' + (i + 1));
    let cards = Array.isArray(state?.cards) && state.cards.length === 16 && /^memory-\d+$/.test(String(state.cards[0]?.v || '')) ? state.cards : shuffleArray(icons.concat(icons).map((v,i)=>({ v, id:i, open:false, done:false })));
    let open = Array.isArray(state?.open) ? state.open : [], moves = state?.moves || 0, matched = state?.matched || 0, combo = state?.combo || 0, busy = false, over = false;
    box.innerHTML = '<div class="wb-guess-panel"><div class="wb-guess-row"><span class="wb-pill" id="wb-memory-moves">步数：0</span><span class="wb-pill" id="wb-memory-pairs">配对：0/8</span></div><div class="wb-memory" id="wb-memory-board"></div></div>';
    draw(); save(); speak('memory','start');
    function score(){ return Math.max(0, 1200 - moves * 25 + matched * 80); }
    function save(){ if(!over) saveProgress('memory', { cards, open, moves, matched, combo }); }
    function memoryCardFace(c){ return '<img class="wb-memory-img" src="' + esc(GAME_ICON_BASE + c.v + '.jpg') + '" alt="">'; }
    function memoryCardHTML(c,i){ return '<button class="wb-memory-card' + (c.open?' open':'') + (c.done?' done':'') + '" data-i="'+i+'"><span class="wb-memory-inner"><span class="wb-memory-face wb-memory-back"></span><span class="wb-memory-face wb-memory-front">' + memoryCardFace(c) + '</span></span></button>'; }
    function draw(){ const board = qs('#wb-memory-board'); if (!board) return; qs('#wb-memory-moves').textContent = '步数：' + moves; qs('#wb-memory-pairs').textContent = '配对：' + matched + '/8'; setScore('memory', score()); board.innerHTML = cards.map(memoryCardHTML).join(''); qsa('.wb-memory-card', board).forEach(btn => btn.onclick = () => flip(+btn.dataset.i)); }
    function flip(i){ if(gamePaused||busy||over||cards[i].done||cards[i].open||open.length>=2) return; if(moves===0&&open.length===0) speak('memory','first_flip'); cards[i].open = true; open.push(i); draw(); if(open.length===2){ moves++; const a=cards[open[0]], b=cards[open[1]]; if(a.v===b.v){ a.done=b.done=true; matched++; combo++; open=[]; speak('memory', combo>=2?'combo':'match'); if(matched===4) speak('memory','half'); if(matched===8){ over=true; clearProgress('memory'); setScore('memory', score()); speak('memory','gameover'); showGameOver('memory','配对完成','本局分数：'+score()+'分'); return; } draw(); save(); } else { combo=0; speak('memory','miss'); busy=true; setTimeout(()=>{ cards[open[0]].open=false; cards[open[1]].open=false; open=[]; busy=false; draw(); save(); }, 650); } } else save(); }
  }

  function startWatermelon(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<canvas class="wb-canvas wb-watermelon-canvas" id="wb-watermelon" width="400" height="500"></canvas>';
    const c = qs('#wb-watermelon'), ctx = c.getContext('2d');
    const W = 400, H = 500;
    const fruits = [
      {r:14, color:'#f05f6b', name:'樱'}, {r:18, color:'#ff9f43', name:'橘'}, {r:23, color:'#ffd166', name:'柠'},
      {r:29, color:'#7bc96f', name:'猕'}, {r:36, color:'#ee6c4d', name:'桃'}, {r:45, color:'#d95550', name:'苹'},
      {r:56, color:'#9b5de5', name:'葡'}, {r:68, color:'#4cc9f0', name:'梨'}, {r:82, color:'#2a9d8f', name:'瓜'}
    ];
    let balls = Array.isArray(state?.balls) ? state.balls.map(b => Object.assign({ a:0, av:0 }, b)) : [];
    let next = Number.isInteger(state?.next) ? state.next : randNext();
    let score = state?.score || 0, seen = state?.seen || {}, over = false, dropping = false;
    let aiming = false, aimX = null, lastTouchDrop = 0;
    setScore('watermelon', score); draw(); save();
    c.onclick = e => { if(Date.now() - lastTouchDrop < 500 || aiming) return; drop(clientX(e)); };
    c.onpointerdown = e => { if(gamePaused || over || dropping) return; aiming = true; aimX = clientX(e); if(!seen.aim){ seen.aim=1; speak('watermelon','aim'); } c.setPointerCapture?.(e.pointerId); draw(); e.preventDefault(); };
    c.onpointermove = e => { if(!aiming) return; aimX = clientX(e); draw(); e.preventDefault(); };
    c.onpointerup = e => { if(!aiming) return; const x = clientX(e); aiming = false; aimX = null; lastTouchDrop = Date.now(); c.releasePointerCapture?.(e.pointerId); drop(x); draw(); e.preventDefault(); };
    c.onpointercancel = () => { if(aiming){ aiming = false; aimX = null; draw(); } };
    c.ontouchstart = e => { if(typeof PointerEvent !== 'undefined') return; const t=e.touches[0]; if(t && !gamePaused && !over && !dropping){ aiming = true; aimX = clientX(t); if(!seen.aim){ seen.aim=1; speak('watermelon','aim'); } draw(); e.preventDefault(); } };
    c.ontouchmove = e => { if(typeof PointerEvent !== 'undefined' || !aiming) return; const t=e.touches[0]; if(t){ aimX = clientX(t); draw(); e.preventDefault(); } };
    c.ontouchend = e => { if(typeof PointerEvent !== 'undefined') return; const t=e.changedTouches[0]; if(t && aiming){ const x = clientX(t); aiming = false; aimX = null; lastTouchDrop = Date.now(); drop(x); draw(); e.preventDefault(); } };
    watermelonTimer = setInterval(step, 30);
    function randNext(){ return Math.floor(Math.random()*3); }
    function clientX(e){ const r=c.getBoundingClientRect(); return Math.max(18, Math.min(W-18, (e.clientX-r.left) * W / r.width)); }
    function save(){ if(!over) saveProgress('watermelon', { balls: balls.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,l:b.l,a:b.a||0,av:b.av||0})), next, score, seen }); }
    function drop(x){ if(gamePaused||over||dropping) return; aiming=false; aimX=null; const f=fruits[next]; balls.push({x, y:f.r+6, vx:0, vy:0, l:next, a:0, av:0}); next=randNext(); dropping=true; setTimeout(()=>dropping=false,180); if(x < f.r + 12 || x > W - f.r - 12) speak('watermelon','drop_edge'); save(); }
    function step(){ if(gamePaused||over) { draw(); return; } balls.forEach(b=>{ const f=fruits[b.l]; b.vy+=0.45; b.x+=b.vx; b.y+=b.vy; b.a=(b.a||0)+(b.av||0); b.av=(b.av||0)*0.995; if(b.x<f.r){ b.x=f.r; b.vx=Math.abs(b.vx)*0.58; b.av += b.vx / f.r * 0.18; } if(b.x>W-f.r){ b.x=W-f.r; b.vx=-Math.abs(b.vx)*0.58; b.av += b.vx / f.r * 0.18; } if(b.y>H-f.r){ b.y=H-f.r; b.vy*=-0.38; b.av += b.vx / f.r * 0.42; b.vx*=0.985; b.av*=0.94; if(Math.abs(b.vy)<.45) b.vy=0; } });
      for(let k=0;k<4;k++) collide();
      balls = balls.filter(Boolean); draw(); save();
      if(balls.some(b=>b.y-fruits[b.l].r<36 && Math.abs(b.vy)<.25) && balls.length>8){ over=true; clearInterval(watermelonTimer); speak('watermelon','gameover'); showGameOver('watermelon','游戏结束','本局分数：'+score+'分'); }
    }
    function collide(){ for(let i=0;i<balls.length;i++) for(let j=i+1;j<balls.length;j++){ const a=balls[i], b=balls[j]; if(!a||!b) continue; const fa=fruits[a.l], fb=fruits[b.l], dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1, min=fa.r+fb.r; if(d<min){ if(a.l===b.l && a.l<fruits.length-1){ const nl=a.l+1; score += (nl+1)*20; setScore('watermelon', score); const nx=(a.x+b.x)/2, ny=(a.y+b.y)/2; balls[i]={x:nx,y:ny,vx:(a.vx+b.vx)*.32,vy:-3.2,l:nl,a:((a.a||0)+(b.a||0))/2,av:((a.av||0)+(b.av||0))*.35}; balls[j]=null; if(nl>=4&&!seen[nl]){ seen[nl]=1; speak('watermelon', nl>=8?'watermelon':('merge_'+(nl>=7?7:nl>=6?6:4))); } else if(nl===2&&!seen.merge_2){ seen.merge_2=1; speak('watermelon','merge_2'); } continue; } const push=(min-d)/2, nx=dx/d, ny=dy/d; a.x-=nx*push; a.y-=ny*push; b.x+=nx*push; b.y+=ny*push; const rvx=b.vx-a.vx, rvy=b.vy-a.vy, sep=rvx*nx+rvy*ny, tangent=rvx*(-ny)+rvy*nx; a.av=(a.av||0)-tangent/fa.r*.08; b.av=(b.av||0)+tangent/fb.r*.08; if(sep<0){ const imp=-sep*.62; a.vx-=imp*nx; a.vy-=imp*ny; b.vx+=imp*nx; b.vy+=imp*ny; } } } }
    function shade(hex, amt){ const n=parseInt(String(hex).slice(1),16); const r=Math.max(0,Math.min(255,(n>>16)+amt)), g=Math.max(0,Math.min(255,((n>>8)&255)+amt)), b=Math.max(0,Math.min(255,(n&255)+amt)); return 'rgb('+r+','+g+','+b+')'; }
    function drawFruit(x,y,l,alpha,scale,angle){ const f=fruits[l], r=f.r*(scale||1); ctx.save(); ctx.translate(x,y); ctx.rotate(angle||0); x=0; y=0; ctx.globalAlpha=alpha == null ? 1 : alpha; const grad=ctx.createRadialGradient(x-r*.35,y-r*.35,r*.12,x,y,r); grad.addColorStop(0,'rgba(255,255,255,.92)'); grad.addColorStop(.18,shade(f.color,38)); grad.addColorStop(.72,f.color); grad.addColorStop(1,shade(f.color,-42)); ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.arc(x,y,r*.96,0,Math.PI*2); ctx.clip(); ctx.lineCap='round'; if(l===0){ ctx.fillStyle='rgba(90,20,26,.18)'; ctx.beginPath(); ctx.arc(x+r*.22,y-r*.1,r*.18,0,Math.PI*2); ctx.fill(); } else if(l===1){ ctx.strokeStyle='rgba(255,255,255,.34)'; ctx.lineWidth=Math.max(1,r*.045); for(let a=0;a<Math.PI*2;a+=Math.PI/5){ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(a)*r*.82,y+Math.sin(a)*r*.82); ctx.stroke(); } } else if(l===2){ ctx.strokeStyle='rgba(255,255,255,.26)'; ctx.lineWidth=Math.max(1,r*.04); for(let yy=-.5;yy<=.5;yy+=.25){ ctx.beginPath(); ctx.moveTo(x-r*.7,y+yy*r); ctx.quadraticCurveTo(x,y+(yy+.1)*r,x+r*.7,y+yy*r); ctx.stroke(); } } else if(l===3){ ctx.fillStyle='rgba(70,45,28,.28)'; for(let a=0;a<Math.PI*2;a+=Math.PI/5){ ctx.beginPath(); ctx.arc(x+Math.cos(a)*r*.42,y+Math.sin(a)*r*.42,Math.max(1.2,r*.035),0,Math.PI*2); ctx.fill(); } ctx.fillStyle='rgba(235,245,210,.42)'; ctx.beginPath(); ctx.arc(x,y,r*.38,0,Math.PI*2); ctx.fill(); } else if(l===4){ ctx.strokeStyle='rgba(255,244,220,.35)'; ctx.lineWidth=Math.max(1.2,r*.055); ctx.beginPath(); ctx.moveTo(x-r*.78,y-r*.12); ctx.quadraticCurveTo(x,y-r*.42,x+r*.78,y-r*.08); ctx.stroke(); } else if(l===5){ ctx.fillStyle='rgba(180,40,38,.22)'; ctx.beginPath(); ctx.ellipse(x,y+r*.08,r*.38,r*.62,0,0,Math.PI*2); ctx.fill(); } else if(l===6){ ctx.strokeStyle='rgba(255,255,255,.22)'; ctx.lineWidth=Math.max(1.2,r*.04); for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.arc(x+i*r*.2,y,r*.34,0,Math.PI*2); ctx.stroke(); } } else if(l===7){ ctx.fillStyle='rgba(255,255,255,.24)'; ctx.beginPath(); ctx.ellipse(x-r*.05,y-r*.04,r*.35,r*.5,-.2,0,Math.PI*2); ctx.fill(); } else if(l===8){ ctx.strokeStyle='rgba(18,92,44,.5)'; ctx.lineWidth=Math.max(2,r*.09); for(let i=-3;i<=3;i++){ ctx.beginPath(); ctx.moveTo(x+i*r*.25,y-r*.92); ctx.bezierCurveTo(x+i*r*.08,y-r*.35,x+i*r*.08,y+r*.35,x+i*r*.25,y+r*.92); ctx.stroke(); } } ctx.restore(); ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=Math.max(1.5,r*.05); ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); ctx.fillStyle='rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(x-r*.28,y-r*.34,r*.18,r*.1,-.55,0,Math.PI*2); ctx.fill(); if(l>=2){ ctx.strokeStyle='#5f7f3d'; ctx.lineWidth=Math.max(1.2,r*.06); ctx.beginPath(); ctx.moveTo(x-r*.08,y-r*.92); ctx.quadraticCurveTo(x+r*.06,y-r*1.12,x+r*.18,y-r*.92); ctx.stroke(); } ctx.restore(); }
    function drawAim(){ if(!aiming || aimX == null || dropping || gamePaused || over) return; const f=fruits[next], x=Math.max(f.r, Math.min(W-f.r, aimX)), y=f.r+6; ctx.save(); ctx.setLineDash([5,5]); ctx.strokeStyle='rgba(58,143,145,.62)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,36); ctx.lineTo(x,H-4); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); drawFruit(x,y,next,.58,1); }
    function draw(){ ctx.clearRect(0,0,W,H); ctx.fillStyle='#fbf3e8'; ctx.fillRect(0,0,W,H); ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=3; ctx.strokeRect(1.5,1.5,W-3,H-3); ctx.setLineDash([6,6]); ctx.strokeStyle='rgba(216,75,66,.38)'; ctx.beginPath(); ctx.moveTo(0,36); ctx.lineTo(W,36); ctx.stroke(); ctx.setLineDash([]); ctx.font='12px Georgia, serif'; ctx.fillStyle='#6f5b45'; ctx.fillText('下一颗', 12, 22); drawFruit(W-34,22,next,1,.62,0); balls.forEach(b=>{ if(!b) return; drawFruit(b.x,b.y,b.l,1,1,b.a||0); }); drawAim(); ctx.textAlign='left'; ctx.textBaseline='alphabetic'; if(!over && !seen.near_top && balls.some(b=>b.y-fruits[b.l].r<72 && Math.abs(b.vy)<.35)){ seen.near_top=1; speak('watermelon','near_top'); } }
  }

  function startLudo(state) {
    const box = qs('#wb-gamebox');
    const path = [[5,10],[4,10],[3,10],[2,10],[1,10],[0,10],[0,9],[0,8],[0,7],[0,6],[0,5],[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[10,1],[10,2],[10,3],[10,4],[10,5],[10,6],[10,7],[10,8],[10,9],[10,10],[9,10],[8,10],[7,10],[6,10]];
    const starts = { red:[[1,7],[1,9],[3,7],[3,9]], blue:[[7,1],[9,1],[7,3],[9,3]] };
    const finish = { red:[[5,9],[5,8],[5,7],[5,6]], blue:[[6,1],[6,2],[6,3],[6,4]] };
    const offset = { red:0, blue:20 };
    let red = Array.isArray(state?.red) ? state.red : [-1,-1,-1,-1];
    let blue = Array.isArray(state?.blue) ? state.blue : [-1,-1,-1,-1];
    let turn = state?.turn || 'red', dice = state?.dice || 0, rolled = !!state?.rolled, busy=false, over=false;
    box.innerHTML = '<div style="width:100%;display:grid;place-items:center;"><div class="wb-ludo-info"><span class="wb-pill" id="wb-ludo-turn"></span><span class="wb-pill" id="wb-ludo-dice"></span><button class="wb-btn primary" id="wb-ludo-roll">掷骰</button></div><div class="wb-ludo" id="wb-ludo-board"></div></div>';
    setScore('ludo', 0); draw(); save();
    qs('#wb-ludo-roll').onclick = () => { if(turn==='red' && !rolled && !busy && !gamePaused) rollRed(); };
    if (turn === 'blue' && !rolled) setTimeout(robot, 650);
    function save(){ if(!over) saveProgress('ludo', { red, blue, turn, dice, rolled }); }
    function roll(){ return 1 + Math.floor(Math.random()*6); }
    function legal(arr,d){ return arr.map((p,i)=> canMove(p,d) ? i : -1).filter(i=>i>=0); }
    function canMove(pos,d){ if(pos<0) return d===6; return pos+d<=44; }
    function nextPos(pos,d){ return pos<0 ? 0 : pos+d; }
    function rollRed(){ dice=roll(); rolled=true; speak('ludo', dice===6?'roll_6':'start'); draw(); const moves=legal(red,dice); if(!moves.length) { speak('ludo','no_move'); toast(dice===6?'没有可移动棋子':'需要掷到6才能让停机坪棋子起飞'); setTimeout(endTurn,650); } save(); }
    function moveRed(i){ if(turn!=='red'||!rolled||busy||gamePaused||!legal(red,dice).includes(i)) return; const wasHome=red[i]<0; red[i]=nextPos(red[i],dice); if(wasHome) speak('ludo','takeoff'); afterMove('red'); }
    function robot(){ if(over||gamePaused) return; busy=true; dice=roll(); rolled=true; draw(); setTimeout(()=>{ const moves=legal(blue,dice); if(moves.length){ const i=chooseRobot(moves); const wasHome=blue[i]<0; blue[i]=nextPos(blue[i],dice); if(wasHome) speak('ludo','takeoff'); afterMove('blue'); } else endTurn(); },700); }
    function globalPos(side,pos){ return pos>=0 && pos<40 ? (offset[side] + pos) % 40 : -1; }
    function chooseRobot(moves){ let best=moves[0], val=-999; moves.forEach(i=>{ const p=nextPos(blue[i],dice); let s=p; const gp=globalPos('blue',p); if(gp>=0 && red.some(r=>globalPos('red',r)===gp)) s+=60; if(p===44) s+=200; if(blue[i]<0) s+=20; if(s>val){ val=s; best=i; } }); return best; }
    function afterMove(side){ capture(side); if(sideArr(side).some(p=>p>=40&&p<44)) speak('ludo','near_finish'); draw(); save(); if(checkWin(side)) return; if(dice===6){ turn=side; rolled=false; busy=false; if(side==='blue') setTimeout(robot,650); else draw(); save(); } else endTurn(); }
    function capture(side){ const otherSide=side==='red'?'blue':'red', mine=sideArr(side), other=sideArr(otherSide); mine.forEach(p=>{ const gp=globalPos(side,p); if(gp<0) return; other.forEach((q,i)=>{ if(globalPos(otherSide,q)===gp){ other[i]=-1; speak('ludo','capture'); } }); }); }
    function checkWin(side){ const arr=sideArr(side); if(arr.every(p=>p===44)){ over=true; clearProgress('ludo'); if(side==='red'){ { const curScore = scores().ludo; setScore('ludo', ((curScore && typeof curScore === 'object' ? curScore.user : curScore) || 0) + 1); } speak('ludo','user_win'); showGameOver('ludo','你赢了','本局分数：1胜'); } else { speak('ludo','user_lose'); showGameOver('ludo','游戏结束','本局分数：0胜（机器人获胜）'); } return true; } return false; }
    function endTurn(){ turn=turn==='red'?'blue':'red'; rolled=false; dice=0; busy=false; draw(); save(); if(turn==='blue') setTimeout(robot,650); }
    function posCoord(side,pos,idx){ if(pos<0) return starts[side][idx]; if(pos>=40) { const f=Math.min(3,pos-40); return finish[side][f] || (side==='red'?[5,5]:[6,5]); } return path[globalPos(side,pos)]; }
    function draw(){ const board=qs('#wb-ludo-board'); const cells=[]; for(let y=0;y<11;y++) for(let x=0;x<11;x++){ let cls='wb-ludo-cell'; if(path.some(p=>p[0]===x&&p[1]===y)) cls+=' path'; if(starts.red.some(p=>p[0]===x&&p[1]===y)||finish.red.some(p=>p[0]===x&&p[1]===y)) cls+=' home-red'; if(starts.blue.some(p=>p[0]===x&&p[1]===y)||finish.blue.some(p=>p[0]===x&&p[1]===y)) cls+=' home-blue'; cells.push('<div class="'+cls+'" data-x="'+x+'" data-y="'+y+'"></div>'); } board.innerHTML=cells.join(''); addPieces('red',red); addPieces('blue',blue); const t=qs('#wb-ludo-turn'); if(t) t.textContent=turn==='red'?'你的回合':'机器人回合'; const d=qs('#wb-ludo-dice'); if(d) d.textContent=dice?'骰子：'+dice:'骰子：-'; const rb=qs('#wb-ludo-roll'); if(rb) rb.disabled=turn!=='red'||rolled||gamePaused||busy; }
    function addPieces(side,arr){ const moves=side==='red'&&turn==='red'&&rolled ? legal(red,dice) : []; arr.forEach((p,i)=>{ const xy=posCoord(side,p,i); const cell=qs('.wb-ludo-cell[data-x="'+xy[0]+'"][data-y="'+xy[1]+'"]'); if(!cell) return; const b=getHostDocument().createElement('button'); b.className='wb-ludo-piece '+(side==='red'?'red':'blue')+(moves.includes(i)?' can':''); b.textContent=i+1; b.onclick=()=>moveRed(i); cell.appendChild(b); }); }
  }

  function startGuessNumber(state) {
    const box = qs('#wb-gamebox');
    let answer = state?.answer || shuffleArray('0123456789'.split('')).slice(0,4).join('');
    let tries = state?.tries || 0, history = Array.isArray(state?.history) ? state.history : [], over=false;
    box.innerHTML = '<div class="wb-guess-panel"><div class="wb-guess-title">猜数字</div><div class="wb-muted">角色想好了一个四位数。输入四位不重复数字，提示会显示“数字对几个、位置对几个”。</div><div class="wb-guess-row"><input class="wb-input" id="wb-num-guess" inputmode="numeric" maxlength="4" placeholder="输入四位数"><button class="wb-btn primary" id="wb-num-submit">猜</button></div><div class="wb-guess-history" id="wb-num-history"></div></div>';
    speak('guessnumber','start'); draw(); save();
    qs('#wb-num-submit').onclick = submit; qs('#wb-num-guess').onkeydown = e => { if(e.key==='Enter') submit(); };
    function save(){ if(!over) saveProgress('guessnumber', { answer, tries, history }); }
    function hintText(guess, nums, pos){ const cfg=settings(); if(!cfg.companion) return '数字对 ' + nums + ' 个，位置对 ' + pos + ' 个。'; const closer = pos >= 2 || nums >= 3; return '数字对 ' + nums + ' 个，位置对 ' + pos + ' 个。' + (closer ? ' ' + companionName() + '轻轻敲了敲桌面：“这次很近了，我差点就想夸出声。”' : ' ' + companionName() + '歪头看着你：“还差一点，我把线索留在这里。”'); }
    function submit(){ if(gamePaused||over) return; const input=qs('#wb-num-guess'); const g=(input.value||'').trim(); if(!/^\d{4}$/.test(g) || new Set(g).size!==4){ toast('请输入四位不重复数字'); return; } tries++; let pos=0, nums=0; for(let i=0;i<4;i++){ if(g[i]===answer[i]) pos++; if(answer.includes(g[i])) nums++; } const text=hintText(g, nums, pos); history.unshift({ guess:g, nums, pos, text }); input.value=''; if(pos===4){ over=true; const cur=scores().guessnumber; setScore('guessnumber', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('guessnumber','user_win'); draw(); showGameOver('guessnumber','你猜中了','本局分数：1胜，用了'+tries+'次'); return; } if(tries>=6) speak('guessnumber','many_tries'); else speak('guessnumber', pos>=3||nums>=4?'very_close':(pos>=2||nums>=3?'close':(nums===0?'miss':'guess'))); draw(); save(); }
    function draw(){ const h=qs('#wb-num-history'); h.innerHTML = history.length ? history.map(x=>'<div class="wb-guess-item"><b>'+esc(x.guess)+'</b>　数字对 '+x.nums+' 个，位置对 '+x.pos+' 个<br>'+esc(x.text||'')+'</div>').join('') : '<div class="wb-muted">还没有猜测记录。</div>'; }
  }

  async function createWordGuessRounds(count) {
    const cfg=settings();
	    const fallbackWords = [
	      {word:'漏刻', type:'旧时代计时器具', clues:['它和时间有关，但不依赖钟表。','它把流逝变成一种能被看见的秩序。','它常借助水的变化来标记时辰。','如果角色总是冷静地等你，它会像一种不催促的陪伴。','古代用滴水来计时的器具就是它。']},
	      {word:'晕珥', type:'天文气象现象', clues:['它属于天空，却不是星月本身。','它常让普通光源显得像被某种边界包围。','它与冰晶折射有关，偶尔会围绕日月出现。','如果角色说话总带一点疏离的光，它会像那层不易靠近的边。','日月周围出现的彩色光环现象就是它。']},
	      {word:'榫卯', type:'传统建筑结构', clues:['它和连接有关，却不靠显眼的外物。','它讲究咬合、分寸和彼此成全。','木构之间不用钉子也能牢牢相扣。','如果你和角色的关系是嘴上不说却彼此卡准位置，它很合适。','中国传统木作中凸凹相接的结构就是它。']},
	      {word:'歧路', type:'文学意象', clues:['它和选择有关，也和走散有关。','它不是终点，而是让人迟疑的分叉。','在故事里，它常暗示命运、分别或错过。','如果角色曾假装不在意你的决定，这个词会藏着那种试探。','道路分岔、前路不同的意象就是它。']},
	      {word:'苔痕', type:'植物痕迹', clues:['它很安静，常和被时间放慢的地方有关。','它不是主角，却会让空间显得旧而湿润。','它常出现在石阶、墙角或少人经过处。','如果角色记得某个你们停留过的旧地方，它可能还留在那里。','青苔留下的痕迹就是它。']},
	      {word:'经纬', type:'地理/织造概念', clues:['它和秩序有关，也和定位有关。','它把看似散乱的东西分成纵横两种方向。','它既可以指织物的线，也可以指地图上的坐标。','如果角色总能在混乱里找到你的位置，这个词很贴切。','纵线和横线构成的定位或织造系统就是它。']},
	      {word:'檐铃', type:'建筑装饰物', clues:['它和边缘有关，也和风有关。','它通常不主动发声，却会被经过的气流叫醒。','它常挂在屋檐或塔檐下，声音清而细。','如果角色表面冷淡，心绪却被你轻轻碰响，它很像这个东西。','挂在檐角、随风作响的小铃就是它。']},
	      {word:'潮汐', type:'自然现象', clues:['它和来去有关，也和某种遥远牵引有关。','它看似重复，却每次都有细微差别。','它受月亮和引力影响，让海水涨落。','如果角色总被你一句话牵动情绪，这种规律会很像。','海水周期性上涨和退落的现象就是它。']}
	    ];
    const normalize = item => { const word=String(item?.word||'').trim(); if(!word) return null; const clues=Array.isArray(item.clues)?item.clues.map(x=>String(x).trim()).filter(Boolean).slice(0,5):[]; while(clues.length<5) clues.push(clues[clues.length-1] || '这个词和现在的场景有关，你再靠近一点想。'); const raw=item.interactions||{}; const interactions={ guess:String(raw.guess||'这个答案还没贴到它的影子，我再把线索往它身边推一点。'), win:String(raw.win||('猜中了。' + companionName() + '把“' + word + '”轻轻重复了一遍，像确认你们刚才抓住了同一个小秘密。')), reveal:String(raw.reveal||('答案是“' + word + '”。' + companionName() + '把它说出来时，语气里带着一点只属于这个词的温柔。')) }; return { word, type:String(item.type||'未分类'), length:parseInt(item.length,10)||word.length, clues, interactions }; };
    const fallback = () => shuffleArray(fallbackWords.slice()).slice(0, Math.max(5, count||5)).map(normalize).filter(Boolean);
    if (!cfg.apiUrl || !cfg.apiModel) return fallback();
	    const prompt = [...(promptTemplates().wordGuess || PROMPT_TEMPLATES.wordGuess), '角色描述：'+currentCharDescription(cfg), '世界背景：'+(selectedWorldText(cfg)||'无'), '大总结：'+(selectedSummaryText(cfg)||'无')].join('\n');
	    try { const txt = await callApiText(cfg, prompt, promptTemplates().systems.wordGuess || PROMPT_TEMPLATES.systems.wordGuess); const data = parseGeneratedJson(txt); const arr = Array.isArray(data) ? data : (Array.isArray(data?.rounds) ? data.rounds : []); const seenWords = {}; const rounds = arr.map(normalize).filter(Boolean).filter(r=>{ if(seenWords[r.word]) return false; seenWords[r.word]=1; return true; }); if(rounds.length>=5) return rounds; return rounds.concat(fallback().filter(r=>!seenWords[r.word])).slice(0,5); } catch(e) { console.warn('[玩伴小屋] word rounds failed:', e); }
    return fallback();
  }

  async function startWordGuess(state) {
    const cfg=settings(); const box=qs('#wb-gamebox');
    if(!cfg.companion){ gamePaused=true; gameStarted=false; box.innerHTML='<div class="wb-guess-panel"><div class="wb-guess-title">我说你猜</div><div class="wb-api-status">此游戏必须开启陪伴模式。请回到设置开启陪伴模式后再开始，或先生成角色陪伴语录。</div></div>'; return; }
	    function normalizeWordRound(item){ const word=String(item?.word||'').trim(); if(!word) return null; const clues=Array.isArray(item.clues)?item.clues.map(x=>String(x).trim()).filter(Boolean).slice(0,5):[]; while(clues.length<5) clues.push(clues[clues.length-1] || '这个词和现在的场景有关，你再靠近一点想。'); const raw=item.interactions||{}; return { word, type:String(item.type||'未分类'), length:parseInt(item.length,10)||word.length, clues, interactions:{ guess:String(raw.guess||'这个方向还差一点，我把线索再往它身边推近些。'), win:String(raw.win||('猜中了，答案就是“' + word + '”。')), reveal:String(raw.reveal||('答案是“' + word + '”。' + companionName() + '把它念出来，像把这题轻轻收好。')) } }; }
	    let rounds = Array.isArray(state?.rounds) && state.rounds.length ? state.rounds : (state?.round ? [state.round] : await createWordGuessRounds(5));
	    rounds = rounds.map(normalizeWordRound).filter(Boolean);
	    if (rounds.length < 5) { const seen={}; rounds.forEach(r=>seen[r.word]=1); const more=(await createWordGuessRounds(5)).map(normalizeWordRound).filter(r=>r&&!seen[r.word]); rounds = rounds.concat(more).slice(0,5); }
	    if (!rounds.length) rounds = await createWordGuessRounds(5);
	    let round = rounds[0];
	    round = normalizeWordRound(round) || round;
	    let clueIndex = state?.clueIndex || 0, guesses = (state?.roundWord === round.word && Array.isArray(state?.guesses)) ? state.guesses : [], over=false, revealed=!!state?.revealed;
    let userWins = state?.userWins || 0, taWins = state?.taWins || 0, completed = state?.completed || 0;
    box.innerHTML='<div class="wb-guess-panel"><div class="wb-guess-title">我说你猜</div><div class="wb-word-meta" id="wb-word-meta"></div><div class="wb-api-status wb-clue-box" id="wb-word-clues"></div><div class="wb-guess-row"><input class="wb-input" id="wb-word-input" placeholder="输入你猜的词"><button class="wb-btn primary" id="wb-word-submit">猜</button><button class="wb-btn" id="wb-word-next">下一个描述</button><button class="wb-btn" id="wb-word-reveal">揭晓答案</button></div><div class="wb-guess-history" id="wb-word-history"></div></div>';
    speak('wordguess','start'); draw(); save();
    qs('#wb-word-submit').onclick=submit; qs('#wb-word-next').onclick=nextClue; qs('#wb-word-reveal').onclick=reveal; qs('#wb-word-input').onkeydown=e=>{ if(e.key==='Enter') submit(); };
	    function save(){ if(!over) saveProgress('wordguess',{ rounds, roundWord:round.word, clueIndex, guesses, userWins, taWins, completed, revealed }); }
	    function visibleClues(){ return round.clues.slice(0, Math.max(1, Math.min(5, clueIndex+1))); }
	    function nextClue(){ if(gamePaused||over) return; if(clueIndex < Math.min(5, round.clues.length)-1){ clueIndex++; speak('wordguess', clueIndex>=3?'clue_late':'clue'); draw(); save(); } else toast('这题已经是最后一条描述了'); }
	    function finishQuestion(userWon, label){ if(userWon){ userWins++; const cur=scores().wordguess; setScore('wordguess', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('wordguess','user_win'); } else { taWins++; addTaWin('wordguess'); } completed++; const inter=round.interactions||{}; guesses.unshift({ guess:label, ok:!!userWon, text:userWon ? (inter.win || ('答案是：' + round.word + '。' + companionName() + '眼睛一亮：“猜中了，就是它。”')) : (inter.reveal || ('答案是：' + round.word + '。' + companionName() + '把答案轻轻念出来，这一题先收好。')) }); rounds.shift(); if(!rounds.length){ over=true; draw(); clearProgress('wordguess'); showGameOver('wordguess', userWins>=taWins?'你赢了':'游戏结束', '本局：你猜中'+userWins+'题，共'+completed+'题', userWins>=taWins?'user_win':'finished'); return; } round=normalizeWordRound(rounds[0]) || rounds[0]; rounds[0]=round; clueIndex=0; guesses=[]; draw(); save(); toast(userWon?'猜中了，进入下一题':'已揭晓，进入下一题'); }
    function reveal(){ if(gamePaused||over||revealed) return; revealed=true; clueIndex=Math.min(4, round.clues.length-1); speak('wordguess','reveal'); const inter=round.interactions||{}; guesses.unshift({ guess:'揭晓答案', ok:false, text: inter.reveal || ('答案是：' + round.word + '。' + companionName() + '把它轻轻念出来，让这题停在这里。') }); draw(); save(); }
	    function submit(){ if(gamePaused||over) return; const input=qs('#wb-word-input'); const guess=(input.value||'').trim(); if(!guess){ toast('请输入猜测'); return; } input.value=''; if(guess===round.word){ finishQuestion(true, guess); } else { const inter=round.interactions||{}; guesses.unshift({ guess, ok:false, text: inter.guess || (companionName() + '轻轻摇头，又把提示说得更软了一点。') }); speak('wordguess','guess'); draw(); save(); } }
    function draw(){ qs('#wb-word-meta').textContent = '第 ' + (completed+1) + ' 题　字数：' + (round.length || (round.word || '').length) + ' 字　类型：' + (round.type || '未分类') + '　' + visibleClues().length + '/5　你赢：' + userWins; qs('#wb-word-clues').textContent = visibleClues().map((c,i)=>(i+1)+'. '+c).join('\n') + (revealed ? '\n\n答案：' + round.word : ''); qs('#wb-word-history').innerHTML = guesses.length ? guesses.map(g=>'<div class="wb-guess-item"><b>'+esc(g.guess)+'</b>　'+(g.ok?'你赢':'未中')+'<br>'+esc(g.text)+'</div>').join('') : '<div class="wb-muted">还没有猜测。</div>'; }
  }

  function startTetris(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<div class="wb-tetris-shell"><canvas class="wb-canvas wb-tetris-canvas" id="wb-canvas" width="300" height="600"></canvas><div class="wb-tetris-controls" aria-label="俄罗斯方块触控"><button class="wb-btn" id="wb-tetris-rotate" type="button">转换</button><button class="wb-btn primary" id="wb-tetris-softdrop" type="button">加速</button></div></div>';
    const c=qs('#wb-canvas'), ctx=c.getContext('2d'), W=10,H=20,S=30;
    const shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];
    let board = Array.isArray(state?.board) && state.board.length === H ? state.board : Array.from({length:H},()=>Array(W).fill(0));
    let piece = state?.piece || newPiece(), nextPiece = state?.nextPiece || newPiece(), score = state?.score || 0, tetrisSeen = state?.seen || {}, over=false;
    setScore('tetris', score);
    function cloneShape(s){ return s.map(r=>r.slice()); }
    function newPiece(){ const s=cloneShape(shapes[Math.floor(Math.random()*shapes.length)]); return {s,x:3,y:0}; }
    function save(){ if(!over) saveProgress('tetris', { board, piece, nextPiece, score, seen:tetrisSeen }); }
    function markTetris(k){ if(!tetrisSeen[k]){ tetrisSeen[k]=1; speak('tetris',k); } }
    getHostDocument().onkeydown=e=>{ if(over || gamePaused) return; let changed=false; if(e.key==='ArrowLeft'||e.key==='a') changed=move(-1,0); if(e.key==='ArrowRight'||e.key==='d') changed=move(1,0); if(e.key==='ArrowDown'||e.key==='s') { markTetris('soft_drop'); tick(); changed=true; } if(e.key==='ArrowUp'||e.key==='w') { rot(); changed=true; } if(changed){ draw(); save(); } };
    addSwipe(box, d=>{ if(over || gamePaused) return; if(d==='left') move(-1,0); if(d==='right') move(1,0); if(d==='down'){ markTetris('soft_drop'); tick(); } if(d==='up') rot(); draw(); save(); });
    const bindBtn = (sel, fn, eventKey) => { const btn=qs(sel, box); if(!btn) return; btn.onclick=e=>{ e.preventDefault(); if(over||gamePaused) return; if(eventKey) markTetris(eventKey); fn(); draw(); save(); scheduleFitGameSurface(); }; };
    bindBtn('#wb-tetris-rotate', () => rot(), 'rotate');
    bindBtn('#wb-tetris-softdrop', () => tick(), 'soft_drop');
    tetrisTimer=setInterval(tick,500); draw(); save();
    function hit(p){ return p.s.some((r,y)=>r.some((v,x)=>v && (p.x+x<0||p.x+x>=W||p.y+y>=H||board[p.y+y]?.[p.x+x]))); }
    function move(dx,dy){ if (gamePaused) return false; const p={s:piece.s,x:piece.x+dx,y:piece.y+dy}; if(!hit(p)){ piece=p; if(dx) markTetris('move'); return true; } return false; }
    function rot(){ const s=piece.s[0].map((_,i)=>piece.s.map(r=>r[i]).reverse()); const p={s,x:piece.x,y:piece.y}; if(!hit(p)){ piece=p; markTetris('rotate'); } }
    function tick(){ if(over || gamePaused) return; if(!move(0,1)){ piece.s.forEach((r,y)=>r.forEach((v,x)=>{ if(v&&piece.y+y>=0) board[piece.y+y][piece.x+x]=1; })); let cleared=0; board=board.filter(r=>{ if(r.every(Boolean)){ cleared++; return false; } return true; }); while(board.length<H) board.unshift(Array(W).fill(0)); if(cleared){ score += [0,100,300,500,800][cleared]; setScore('tetris',score); speak('tetris','line_'+cleared); if(score>=500&&score<600) speak('tetris','score_500'); if(score>=1500&&score<1600) speak('tetris','score_1500'); } if(!tetrisSeen.danger && board.slice(0,5).some(r=>r.some(Boolean))){ markTetris('danger'); } piece=nextPiece; nextPiece=newPiece(); if(hit(piece)){ over=true; clearInterval(tetrisTimer); speak('tetris','gameover'); showGameOver('tetris', '游戏结束', '本局分数：' + score + '分'); return; } } draw(); save(); }
    function drawPreview(night){ const panel={x:206,y:10,w:84,h:84}, s=nextPiece.s, cell=13; ctx.fillStyle=night?'rgba(17,24,39,.88)':'rgba(255,250,242,.92)'; ctx.fillRect(panel.x,panel.y,panel.w,panel.h); ctx.strokeStyle=night?'rgba(255,255,255,.2)':'rgba(80,55,48,.22)'; ctx.strokeRect(panel.x+.5,panel.y+.5,panel.w-1,panel.h-1); ctx.fillStyle=night?'#f5eafa':'#5d4038'; ctx.font='12px Georgia, serif'; ctx.fillText('下一块', panel.x+10, panel.y+17); const ox=panel.x+(panel.w-s[0].length*cell)/2, oy=panel.y+34+(42-s.length*cell)/2; s.forEach((r,y)=>r.forEach((v,x)=>{ if(v){ ctx.fillStyle='#ef8f7a'; ctx.fillRect(ox+x*cell+1,oy+y*cell+1,cell-2,cell-2); } })); }
    function draw(){ const night=settings().theme==='night'; ctx.fillStyle=night?'#000':'#fff'; ctx.fillRect(0,0,300,600); ctx.strokeStyle=night?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)'; for(let x=1;x<W;x++){ ctx.beginPath(); ctx.moveTo(x*S,0); ctx.lineTo(x*S,600); ctx.stroke(); } for(let y=1;y<H;y++){ ctx.beginPath(); ctx.moveTo(0,y*S); ctx.lineTo(300,y*S); ctx.stroke(); } const drawCell=(x,y,col)=>{ ctx.fillStyle=col; ctx.fillRect(x*S+1,y*S+1,S-2,S-2); }; board.forEach((r,y)=>r.forEach((v,x)=>v&&drawCell(x,y,'#9ccbbb'))); piece.s.forEach((r,y)=>r.forEach((v,x)=>v&&drawCell(piece.x+x,piece.y+y,'#ef8f7a'))); drawPreview(night); }
  }

  function addSwipe(el, cb) { el.ontouchstart = e => { const t=e.touches[0]; touchStart={x:t.clientX,y:t.clientY}; }; el.ontouchend = e => { if(!touchStart) return; const t=e.changedTouches[0], dx=t.clientX-touchStart.x, dy=t.clientY-touchStart.y; if(Math.max(Math.abs(dx),Math.abs(dy))<24) return; cb(Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up')); touchStart=null; }; }

}
