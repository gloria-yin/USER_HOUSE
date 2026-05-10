import { DEFAULT_LINES, PROMPT_TEMPLATES } from './wanban-prompts.js';

// Runtime migrated from 益智小游戏/玩伴小屋V1.0.1.json.
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
  const FLOAT_ID = SCRIPT_ID + '-float-ball';
  const STYLE_ID = SCRIPT_ID + '-css';
  const STORAGE_SETTINGS = SCRIPT_ID + '_settings_v1';
  const STORAGE_SCORES = SCRIPT_ID + '_scores_v1';
  const STORAGE_LINES = SCRIPT_ID + '_lines_v1';
  const STORAGE_ROLE_LINES = SCRIPT_ID + '_roleLines_v1';
  const STORAGE_THEATERS = SCRIPT_ID + '_theaters_v1';
  const STORAGE_LINE_PRESET_SELECTION = SCRIPT_ID + '_linePresetSelection_v1';
  const STORAGE_API_PRESETS = SCRIPT_ID + '_apiPresets_v1';
  const STORAGE_WORLD_PRESETS = SCRIPT_ID + '_worldPresets_v1';
  const STORAGE_SUMMARIES = SCRIPT_ID + '_summaries_v1';
  const STORAGE_SUMMARY_REQ = SCRIPT_ID + '_summaryReq_v1';
  const STORAGE_PROGRESS = SCRIPT_ID + '_progress_v1';
  const STORAGE_RECORDS = SCRIPT_ID + '_records_v1';
  const STORAGE_WORD_GUESS_BANK = SCRIPT_ID + '_wordGuessBank_v1';
  const FLAG = SCRIPT_ID + '_Loaded_v1_0_1';
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
  let gameAccumulatedMs = 0;
  let gameActiveStartedAt = 0;
  let randomLineTimer = null;
  let lastDialogueAt = 0;
  let singleDialogueQueue = null;
  let singleDialogueTimer = null;
  let firstMoverAwaitingUserAction = false;
  let currentRoundRecord = false;
  let currentRoundLineEvents = [];
  let currentRoundTheaterInfo = null;
  let theaterCache = loadJSON(STORAGE_THEATERS, {});
  let lastMenuOpenAt = 0;
  let floatingBallResizeBound = false;
  let lineGenerationBusy = false;
  let lineGenerationStatus = '当前状态：空闲';
  let lineGenerationKind = '';
  let batchLineGenerationCancel = false;
  let lineGenerationFailures = {};
  let theaterGenerationFailures = {};
  let batchGenerationDebug = [];
  let mainSwipeAnimation = '';

  const GAME_ICON_BASE = new URL('../../assets/game-icons/', import.meta.url).href;
  const APP_ICON_URL = GAME_ICON_BASE + 'wanban.png';
  const CONTINUE_IMAGE_URL = GAME_ICON_BASE + 'continue.png';
  const OLDMAID_CARD_URL = GAME_ICON_BASE + 'oldmaid-card.jpg';
  const OLDMAID_BACK_URL = GAME_ICON_BASE + 'oldmaid-back.jpg';
  const MEMORY_CARD_URL = GAME_ICON_BASE + 'memory-card.jpg';
  const PLANK_STAND_URL = GAME_ICON_BASE + 'plank-stand.png';
  const PLANK_WALK_URL = GAME_ICON_BASE + 'plank-walk.png';
  const JUMP_STAND_URL = GAME_ICON_BASE + 'jump-stand.png';
  const JUMP_DOWN_URL = GAME_ICON_BASE + 'jump-down.png';
  const FIRST_MOVER_GAMES = ['ludo', 'tictactoe', 'gomoku', 'territory', 'oldmaid', 'reversi', 'bombnumber', 'connect4d'];
  const GAME_META = {
    tetris: { id: 'tetris', name: '俄罗斯方块', mode: 'single', unit: '分', icon: '▦', iconImage: GAME_ICON_BASE + 'tetris.png' },
    snake: { id: 'snake', name: '贪吃蛇', mode: 'single', unit: '分', icon: '●', iconImage: GAME_ICON_BASE + 'snake.jpg' },
    game2048: { id: 'game2048', name: '2048', mode: 'single', unit: '分', icon: '2048', iconImage: GAME_ICON_BASE + 'game2048.png' },
    watermelon: { id: 'watermelon', name: '合成大西瓜', mode: 'single', unit: '分', icon: '瓜', iconImage: GAME_ICON_BASE + 'watermelon.png' },
    memory: { id: 'memory', name: '翻牌记忆', mode: 'single', unit: '分', icon: '◇', iconImage: GAME_ICON_BASE + 'memory.png' },
    jump: { id: 'jump', name: '跳一跳', mode: 'single', unit: '分', icon: '跳', iconImage: GAME_ICON_BASE + 'jump.jpg' },
    plank: { id: 'plank', name: '搭木板', mode: 'single', unit: '分', icon: '板', iconImage: GAME_ICON_BASE + 'plank.jpg' },
    sudoku: { id: 'sudoku', name: '数独', mode: 'single', unit: '分', icon: '9', iconImage: GAME_ICON_BASE + 'sudoku.jpg' },
    ludo: { id: 'ludo', name: '双人飞行棋', mode: 'double', unit: '胜', icon: '✈', iconImage: GAME_ICON_BASE + 'ludo.jpg' },
    guessnumber: { id: 'guessnumber', name: '猜数字', mode: 'double', unit: '胜', icon: '1234', iconImage: GAME_ICON_BASE + 'guessnumber.jpg' },
    wordguess: { id: 'wordguess', name: '我说你猜', mode: 'double', unit: '胜', icon: '谜', iconImage: GAME_ICON_BASE + 'wordguess.jpg' },
    tictactoe: { id: 'tictactoe', name: '井字棋', mode: 'double', unit: '胜', icon: '×○', iconImage: GAME_ICON_BASE + 'tictactoe.jpg' },
    gomoku: { id: 'gomoku', name: '五子棋', mode: 'double', unit: '胜', icon: '五', iconImage: GAME_ICON_BASE + 'gomoku.jpg' },
    territory: { id: 'territory', name: '电子围地盘', mode: 'double', unit: '胜', icon: '□', iconImage: GAME_ICON_BASE + 'territory.jpg' },
    oldmaid: { id: 'oldmaid', name: '抽鬼牌', mode: 'double', unit: '胜', icon: '鬼', iconImage: GAME_ICON_BASE + 'oldmaid.jpg' },
    reversi: { id: 'reversi', name: '翻转棋', mode: 'double', unit: '胜', icon: '●○', iconImage: GAME_ICON_BASE + 'reversi.jpg' },
    bombnumber: { id: 'bombnumber', name: '数字炸弹', mode: 'double', unit: '胜', icon: '爆', iconImage: GAME_ICON_BASE + 'bombnumber.jpg' },
    connect4d: { id: 'connect4d', name: '立体四子棋', mode: 'double', unit: '胜', icon: '4D', iconImage: GAME_ICON_BASE + 'connect4d.jpg' }
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
    charDescMode: 'auto',
    manualCharPersona: '',
    injectChat: false,
    intimacyMode: false,
    breakLimitPrompt: '',
    summaryId: '',
    selectedWorldEntries: [],
    selectedWorldPresetName: '',
    charName: '{{char}}',
    userName: '{{user}}',
    rememberWindow: false,
    floatingBallEnabled: false,
    floatingBallX: 18,
    floatingBallY: 180,
    messageNotify: false,
    messageNotifyTag: 'content',
    theaterEnabled: false,
    autoLog: false,
	    batchLinePromptOverride: '',
	    batchTheaterPromptOverride: '',
	    batchAttempts: 1,
	    batchLinesApiChoice: 'default',
	    batchTheaterApiChoice: 'default',
	    customFonts: [],
	    selectedFont: '',
	    lastTab: 'single',
	    lastGame: ''
	  };

  const GAME_RULES = {
    tetris: '控制方块左右移动、旋转和下落，凑满一整行即可消除得分。方块堆到顶部时游戏结束。',
    snake: '用方向键或手机方向按钮控制蛇吃食物。每吃一次会变长，后期速度会更快；撞墙或撞到自己就结束。',
    game2048: '上下左右滑动数字块，相同数字相撞会合并。尽量合成更大的数字，棋盘无法移动时结束。',
    watermelon: '选择落点投放水果，相同水果碰到会合成更大的水果。水果堆超过顶部警戒线时结束。',
    memory: '翻开两张牌，图案相同就配对成功。全部配对完成后按步数和分数结算。',
    jump: '按住蓄力，松开跳跃。落到下一个平台得分，越靠近中心越好；没落上平台就结束。',
    plank: '长按屏幕或空格生成木板，松开后木板会倒下成为桥。木板必须刚好搭到下一根柱子上，太短或太长都会掉下去。',
    sudoku: '每局自动生成唯一解数独。点击空格后输入1-9，已有数字会高亮同行同列和相同数字。可擦除、求助；填满但不正确时会高亮错误，并可帮你修改一个数字。',
    tictactoe: '你和{{char}}轮流落子，谁先连成横、竖或斜向三格谁赢。棋盘下满无人连线则平局。',
    gomoku: '你执黑，{{char}}执白，双方轮流落子。任意方向先连成五子的一方获胜。',
    territory: '在点阵之间画边，规则类似围方格。谁画下一个小方格的第4条边，谁就占领该格并继续行动。所有边画完后，占领格子多的一方获胜。',
    oldmaid: '双方手牌会先自动消去对子。你从{{char}}手里抽牌，{{char}}再从你手里抽牌，抽到能配对的牌就丢掉。最后谁手里留下鬼牌谁输。',
    ludo: '掷到6点可以让停机坪的棋子起飞。棋子沿路线前进，落到对方棋子所在格会把对方撞回家。四枚棋子全部到达终点的一方获胜。',
    guessnumber: '{{char}}想好一个四位不重复数字。你每次输入四位数，系统只提示“数字对几个、位置对几个”，猜中完整顺序获胜。',
    wordguess: '{{char}}按题目给出描述，你可以猜答案、要求下一条描述，或揭晓答案。猜中题数更多的一方获胜。',
    reversi: '8×8棋盘，双方轮流落子。新棋子和己方棋子夹住的对方棋子会被翻转。无合法落子时跳过，棋盘结束后你的格子数更多则胜。',
    bombnumber: '1-100数字方格中藏着一个炸弹数字。双方轮流点击当前可选范围内的数字，点到炸弹的人失败；点到其他数字会缩小安全范围。',
    connect4d: '双方轮流在7×7棋盘上选择横向位置投放棋子，棋子会从上方虚线落到该列最低空位。横向、纵向或斜向连成四个同色棋子即可获胜。'
  };

  const EVENT_DESCRIPTIONS = {
    tetris: { start:'俄罗斯方块开局，玩家准备开始下落方块。', move:'玩家左右移动方块，调整落点。', rotate:'玩家旋转当前方块。', soft_drop:'玩家主动加速下落。', line_1:'俄罗斯方块消除1行。', line_2:'俄罗斯方块一次消除2行。', line_3:'俄罗斯方块一次消除3行。', line_4:'俄罗斯方块一次消除4行。', danger:'方块堆叠接近顶部，局面危险。', score_500:'俄罗斯方块本局分数达到500分。', score_1500:'俄罗斯方块本局分数达到1500分。', score_2000_plus:'俄罗斯方块本局分数达到2000分以上，之后每隔500分触发一次；角色对不同分数的惊讶、兴奋和投入程度应逐渐递增。', record:'单人游戏刷新历史最高分。', gameover:'俄罗斯方块方块堆到顶部，本局结束。', random:'观看俄罗斯方块时的碎碎念。' },
    snake: { start:'贪吃蛇开局。', turn:'贪吃蛇转向。', close_call:'蛇头接近墙体或自身，差点失败。', speed_up:'贪吃蛇吃到更多食物后速度提高；分数越高，蛇移动越快，对话可以提到速度越来越快、反应时间变短、转向更紧张。', eat_1:'贪吃蛇吃到第1个食物。', eat_5:'贪吃蛇累计吃到5个食物，蛇身变长，速度开始更有压力。', eat_10:'贪吃蛇累计吃到10个食物，分数升高，蛇速明显更快。', eat_20:'贪吃蛇累计吃到20个食物，高分阶段蛇速很快，路线和反应都更紧张。', record:'单人游戏刷新历史最高分。', gameover:'贪吃蛇撞墙或撞到自己，本局结束。', random:'观看贪吃蛇时的碎碎念。' },
    game2048: { start:'2048开局。', move:'玩家滑动并移动数字块。', stuck:'棋盘空位很少，局面拥挤。', tile_64:'棋盘首次合成64数字块。', tile_128:'棋盘首次合成128数字块。', tile_256:'棋盘首次合成256数字块。', tile_512:'棋盘首次合成512数字块。', tile_1024:'棋盘首次合成1024数字块；从1024开始角色应明显惊讶。', tile_2048:'棋盘首次合成2048数字块；角色比1024更惊讶、更兴奋。', tile_4096:'棋盘首次合成4096数字块；角色惊讶程度必须比1024和2048继续递增。', record:'单人游戏刷新历史最高分。', gameover:'2048棋盘刚被数字块占满。', random:'观看2048时的碎碎念。' },
    watermelon: { start:'合成大西瓜开局。', aim:'玩家长按瞄准水果落点。', drop_edge:'水果贴近边缘落下。', merge_2:'合成到较小水果。', merge_4:'合成到中级水果。', merge_6:'合成到偏大的水果。', merge_7:'合成到接近大西瓜的大水果。', near_top:'水果堆接近顶部警戒线。', watermelon:'成功合成大西瓜。', record:'单人游戏刷新历史最高分。', gameover:'水果堆快要超过顶部警戒线。', random:'观看合成大西瓜时的碎碎念。' },
    memory: { start:'翻牌记忆开局，4×4牌面扣住。', first_flip:'玩家翻开本局第一张牌。', match:'玩家翻开的两张牌成功配对并消除。', miss:'玩家翻开的两张牌没有配对。', combo:'玩家连续成功配对。', half:'玩家已经完成一半配对。', record:'玩家以更少步数或更高分刷新记录。', gameover:'翻牌记忆只剩最后一对牌未配对。', random:'观看翻牌记忆时的碎碎念。' },
    jump: { start:'跳一跳开局，玩家站在第一个平台上。', charge:'玩家按住屏幕开始蓄力。', jump:'玩家松手起跳。', perfect:'玩家落在平台中心附近。', land:'玩家成功落到下一个平台。', score_10:'跳一跳达到10分。', score_20:'跳一跳达到20分。', score_30:'跳一跳达到30分。', score_40:'跳一跳达到40分。', score_50_plus:'跳一跳达到50分，且50分以上每10分触发一次。', record:'跳一跳刷新历史最高分。', gameover:'玩家松手时就能判断本次不会落上平台，起跳前触发。', random:'观看跳一跳时的碎碎念。' },
    plank: { start:'搭木板开局，玩家站在第一根柱子上。', perfect:'木板长度刚好落在柱子中心附近。', perfect_streak:'玩家连续3次以上完美搭到中心附近。', score_10:'搭木板达到10分。', score_20:'搭木板达到20分。', score_30:'搭木板达到30分。', score_40:'搭木板达到40分。', score_50_plus:'搭木板达到50分，且50分以上每10分触发一次。', record:'搭木板刷新历史最高分。', gameover:'玩家松手时木板已经确定太长或太短。', random:'观看搭木板时的碎碎念。' },
    sudoku: { start:'数独开局，玩家开始解唯一解题目。', first_fill:'玩家填入第一个数字。', erase:'玩家擦除一个已填数字。', hint:'玩家请求一次求助。', many_hints:'玩家求助超过5次。', row_done:'玩家填好一整行。', col_done:'玩家填好一整列。', nearly_done:'数独快要填完。', conflict:'玩家填入的数字在同一行、同一列或同一宫里造成重复。', complete_error:'玩家全部填完但仍有错误格，需要继续修改。', gameover:'数独只剩最后一个空格，或只剩一个错误格需要修改。', random:'观看数独时的碎碎念。' },
    tictactoe: { char_first:'{{char}}先手。', char_second:'{{char}}后手。', user_center:'玩家占据中心格。', user_corner:'玩家占据角落格。', ai_block:'TA阻挡了玩家即将连线的一步。', char_next:'{{char}}下一子，每隔3-5轮随机触发。', user_win:'玩家在井字棋获胜。', user_lose:'TA在井字棋获胜，玩家失败。', draw:'井字棋平局。', random:'和user玩井字棋时的碎碎念。' },
    gomoku: { char_first:'{{char}}先手。', char_second:'{{char}}后手。', user_three:'玩家形成三连或强威胁。', user_open_three:'玩家下出三连且两边都没有被遮挡，明显准备进攻。', user_blocked_four:'玩家下出四连但有一边被遮挡，仍然是强进攻。', user_open_four:'玩家下出四连且两边都没有被遮挡，TA知道自己这把基本必输了。', ai_block:'TA阻挡玩家形成强威胁。', ai_threat:'TA形成强威胁，玩家需要防守。', char_next:'{{char}}下一子，每隔3-5轮随机触发。', user_win:'玩家五子连线获胜。', user_lose:'TA五子连线获胜，玩家失败。', draw:'五子棋平局。', random:'和user玩五子棋时的碎碎念。' },
    territory: { char_first:'{{char}}先手。', char_second:'{{char}}后手。', edge:'玩家画下一条边。', no_safe_edge:'场面没有普通边了，之后每条边都可能送分。', capture:'玩家围住某个方格最后一条边并占领得分。', chain:'玩家连续占领多个方格。', ta_capture:'TA围住某个方格并占领得分。', user_turn:'TA的回合结束，轮到玩家。', danger:'玩家选择可能送给TA得分机会的边。', char_next:'{{char}}下一子，每隔3-5轮随机触发。', user_win:'所有边画完后玩家得分更高。', user_lose:'所有边画完后TA得分更高。', draw:'所有边画完后双方平分。', random:'和user玩电子围地盘时的碎碎念。' },
    oldmaid: { char_first:'{{char}}先手。', char_second:'{{char}}后手。', draw:'玩家从TA手里随机抽走一张牌。', pair:'玩家抽牌后凑成对子并消去。', ta_draw:'TA从玩家手里随机抽走一张牌。', ta_pair:'TA抽牌后凑成对子并消去。', joker:'鬼牌在双方之间转移。', user_win:'玩家先清空手牌，没有留下鬼牌。', user_lose:'玩家最后留下鬼牌，TA获胜。', random:'和user玩抽鬼牌时的碎碎念。' },
    ludo: { char_first:'{{char}}先手。', char_second:'{{char}}后手。', roll_6:'玩家掷出6点。', no_move:'玩家本回合没有可移动棋子。', user_takeoff:'玩家掷出可起飞点数，玩家飞机起飞。', char_takeoff:'{{char}}掷出可起飞点数，{{char}}飞机起飞。', user_capture:'玩家把{{char}}的棋子撞回家，{{char}}会懊恼或不甘。', char_capture:'{{char}}把玩家的棋子撞回家，{{char}}会得意或调侃。', near_finish:'玩家棋子接近终点。', user_win:'玩家率先到达终点获胜。', user_lose:'TA率先到达终点，玩家失败。', random:'和user玩双人飞行棋时的碎碎念。' },
    guessnumber: { start:'角色想好一个四位数。', guess:'用户提交了一次四位数猜测。', miss:'本次猜测几乎没有命中。', close:'本次猜测数字或位置命中较多。', very_close:'本次猜测非常接近答案。', many_tries:'用户已经尝试多次仍未猜中。', user_win:'用户猜中完整四位数。', random:'猜测间隙的随机角色互动。' },
    wordguess: { random:'猜词间隙的随机角色互动。', user_win:'我说你猜中，玩家猜中第3题时触发；{{char}}知道这一把user已经赢定了。', user_lose:'我说你猜中，玩家第3次没猜中或揭晓答案时触发；{{char}}知道这一把自己已经赢定，user已经输了。' }
    ,reversi: { char_first:'{{char}}先手。', char_second:'{{char}}后手。', corner:'玩家占据角落。', char_big_flip:'{{char}}一次翻转玩家超过5个棋子。', user_big_flip:'玩家一次翻转{{char}}超过5个棋子。', char_double:'棋盘上{{char}}棋子数量超过user的一倍。', user_double:'棋盘上user棋子数量超过{{char}}的一倍。', char_next:'{{char}}下一子，每隔3-5轮随机触发。', user_win:'翻转棋只剩最后一个空位时，玩家棋子数领先，基本确认玩家会获胜。', user_lose:'翻转棋只剩最后一个空位时，{{char}}棋子数领先，玩家基本会失败。', draw:'翻转棋只剩最后一个空位时，双方棋子数相同，局面接近平局。', random:'和user玩翻转棋时的碎碎念。' }
    ,bombnumber: { char_first:'{{char}}先手。', char_second:'{{char}}后手。', range_100_80:'可选范围还剩80到100个数字，氛围轻松。', range_80_60:'可选范围还剩60到80个数字，仍然稍微轻松。', range_60_40:'可选范围还剩40到60个数字，开始有点紧张。', range_40_20:'可选范围还剩20到40个数字，开始认真，可能想诈一下玩家。', range_20_0:'可选范围小于20个数字，马上就要炸了。', doomed:'可选范围只剩1个安全选择，局面像已经结束。', user_win:'玩家没有点中炸弹，{{char}}点中炸弹失败。', user_lose:'玩家点中炸弹失败。', random:'和user玩数字炸弹时的碎碎念。' }
    ,connect4d: { char_first:'{{char}}先手。', char_second:'{{char}}后手。', user_three:'玩家形成三连或强威胁。', user_open_four:'玩家已经形成四连获胜。', ai_block:'{{char}}阻挡玩家的威胁。', ai_threat:'{{char}}形成强威胁。', char_next:'{{char}}下一子，每隔3-5轮随机触发。', user_win:'玩家在7×7棋盘横向、纵向或斜向连成四子。', user_lose:'{{char}}在7×7棋盘横向、纵向或斜向连成四子。', draw:'棋盘填满无人连成四子。', random:'和user玩立体四子棋时的碎碎念。' }
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
    currentTab = (tab === 'double' || tab === 'intimacy' || tab === 'settings' || tab === 'single') ? tab : 'single';
    currentGame = GAME_META[cfg.lastGame] ? cfg.lastGame : null;
  }
  function scores() {
    const loaded = loadJSON(STORAGE_SCORES, {});
    const base = { tetris: 0, snake: 0, game2048: 0, watermelon: 0, memory: 0, jump: 0, plank: 0, sudoku: 0, ludo: { user: 0, ta: 0 }, guessnumber: { user: 0, ta: 0 }, wordguess: { user: 0, ta: 0 }, tictactoe: { user: 0, ta: 0 }, gomoku: { user: 0, ta: 0 }, territory: { user: 0, ta: 0 }, oldmaid: { user: 0, ta: 0 }, reversi: { user: 0, ta: 0 }, bombnumber: { user: 0, ta: 0 }, connect4d: { user: 0, ta: 0 } };
    ['ludo','guessnumber','wordguess','tictactoe','gomoku','territory','oldmaid','reversi','bombnumber','connect4d'].forEach(k => { if (typeof loaded[k] === 'number') loaded[k] = { user: loaded[k], ta: 0 }; });
    return Object.assign(base, loaded);
  }
  function lines() { return Object.assign({}, DEFAULT_LINES, loadJSON(STORAGE_LINES, {})); }
  function saveLines(v) { saveJSON(STORAGE_LINES, v); }
  function roleLines() { return loadJSON(STORAGE_ROLE_LINES, {}); }
  function saveRoleLines(v) { saveJSON(STORAGE_ROLE_LINES, v); }
  function linePresetSelection() { return loadJSON(STORAGE_LINE_PRESET_SELECTION, {}); }
  function saveLinePresetSelection(v) { saveJSON(STORAGE_LINE_PRESET_SELECTION, v); }
  function normalizePresetName(name) { return String(name || '默认语录').trim().slice(0, 24) || '默认语录'; }
  function roleLineScopeForName(game, name) { return String(name || companionName()).trim() + '::' + game; }
  function roleLineScope(game) { return roleLineScopeForName(game, companionName()); }
  function currentLinePreset(game) { const sel = linePresetSelection(); return normalizePresetName(sel[roleLineScope(game)] || companionName()); }
  function activeGameRoleName(game) { const id = game || currentGame; return id && GAME_META[id] ? normalizePresetName(currentLinePreset(id)) : companionName(); }
  function setCurrentLinePreset(game, name) { const sel = linePresetSelection(); sel[roleLineScope(game)] = normalizePresetName(name); saveLinePresetSelection(sel); }
  function roleLineSet(game, preset) { const all = roleLines(); const name = normalizePresetName(preset || currentLinePreset(game)); const scope = all[roleLineScope(game)] || {}; const direct = scope[name]; if (direct) return direct; const roleScope = all[roleLineScopeForName(game, name)] || {}; return roleScope[name] || Object.keys(roleScope).map(k => roleScope[k]).find(v => validLineSet(game, v)) || null; }
  function roleLineSetForName(game, roleName, preset) { const all = roleLines(); const scope = all[roleLineScopeForName(game, roleName)] || {}; return scope[normalizePresetName(preset || roleName)] || null; }
  function activeLineSet(game) { return roleLineSet(game) || (lines()[game] || DEFAULT_LINES[game] || {}); }
  function presetNamesForGame(game) { const scope = roleLines()[roleLineScope(game)] || {}; const names = Object.keys(scope).filter(Boolean).concat(roleNamesForLineStorage()); const current = normalizePresetName(companionName()); if (!names.includes(current)) names.unshift(current); return Array.from(new Set(names.map(normalizePresetName).filter(Boolean))); }
  function saveRoleLineSet(game, preset, data) { const all = roleLines(); const scopeKey = roleLineScope(game); if (!all[scopeKey]) all[scopeKey] = {}; all[scopeKey][normalizePresetName(preset)] = data; saveRoleLines(all); }
  function saveRoleLineSetForName(game, roleName, preset, data) { const all = roleLines(); const scopeKey = roleLineScopeForName(game, roleName); if (!all[scopeKey]) all[scopeKey] = {}; all[scopeKey][normalizePresetName(preset || roleName)] = data; saveRoleLines(all); }
  function saveTheaterCache() { saveJSON(STORAGE_THEATERS, theaterCache || {}); }
  function roleNamesForLineStorage() { const names = [companionName()]; worldPresets().forEach(x => { if (x && x.name) names.push(x.name); }); Object.keys(roleLines()).forEach(k => { const name = String(k).split('::')[0]; if (name) names.push(name); }); return Array.from(new Set(names.map(normalizePresetName).filter(Boolean))); }
  function validLineSet(game, set) {
    if (!set || typeof set !== 'object' || Array.isArray(set)) return false;
    const keys = Object.keys(DEFAULT_LINES[game] || {});
    return !!keys.length && keys.every(k => Array.isArray(set[k]) && set[k].some(v => String(v || '').trim()));
  }
  function roleLineStorageStatus(game, roleName) {
    const failKey = normalizePresetName(roleName || companionName()) + '::' + game;
    if (lineGenerationFailures[failKey]) return '失败';
    const scope = roleLines()[roleLineScopeForName(game, roleName)] || {};
    const vals = Object.keys(scope).map(k => scope[k]).filter(v => v != null);
    if (vals.some(v => validLineSet(game, v))) return '已有';
    return vals.length ? '失败' : '未生成';
  }
  function roleHasLineStorage(game, roleName) { return roleLineStorageStatus(game, roleName) === '已有'; }
  function storedLineSetForRoleGame(game, roleName) { const scope = roleLines()[roleLineScopeForName(game, roleName)] || {}; const preset = normalizePresetName(roleName); if (validLineSet(game, scope[preset])) return scope[preset]; return Object.keys(scope).map(k => scope[k]).find(v => validLineSet(game, v)) || null; }
  function theaterCacheKeyForName(roleName, game, outcome, special) { return normalizePresetName(roleName || companionName()) + '::' + game + '::' + (outcome || 'score') + '::' + (special || 'normal'); }
  function roleTheaterStorageStatus(game, roleName) {
    const failKey = normalizePresetName(roleName || companionName()) + '::' + game;
    if (theaterGenerationFailures[failKey]) return '失败';
    const jobs = theaterJobsForGame(game);
    const ok = jobs.length && jobs.every(([outcome, special]) => {
      const arr = theaterCache[theaterCacheKeyForName(roleName, game, outcome, special === 'normal' ? '' : special)];
      return Array.isArray(arr) && arr.some(v => String(v || '').trim());
    });
    return ok ? '已有' : '未生成';
  }
  function formatStoredTheaters(game, roleName) {
    const role = normalizePresetName(roleName || companionName());
    const failKey = role + '::' + game;
    if (theaterGenerationFailures[failKey]) return '失败：' + theaterGenerationFailures[failKey];
    const jobs = theaterJobsForGame(game);
    return jobs.map(([outcome, special]) => {
      const key = theaterCacheKeyForName(role, game, outcome, special === 'normal' ? '' : special);
      const arr = theaterCache[key];
      const title = theaterPackKey(outcome, special);
      if (!Array.isArray(arr) || !arr.length) return '【' + title + '】\n未生成';
      return '【' + title + '】\n' + arr.map((x,i) => (i + 1) + '. ' + textSegments(x).join(' / ').slice(0, 180)).join('\n');
    }).join('\n\n');
  }
  function formatStoredLineSet(game, set) {
    if (!set) return '当前角色和游戏还没有完整可用的语录。';
    return Object.keys(DEFAULT_LINES[game] || set).map(k => {
      const arr = Array.isArray(set[k]) ? set[k] : [];
      return '【' + k + '】\n' + (arr.length ? arr.join('\n') : '未存储');
    }).join('\n\n');
  }
  function apiPresets() { return loadJSON(STORAGE_API_PRESETS, []); }
  function saveApiPresets(v) { saveJSON(STORAGE_API_PRESETS, v); }
  function worldPresets() { return loadJSON(STORAGE_WORLD_PRESETS, []); }
  function saveWorldPresets(v) { saveJSON(STORAGE_WORLD_PRESETS, v); }
  function worldPresetForRole(roleName) {
    const name = normalizePresetName(roleName || companionName());
    return worldPresets().find(x => normalizePresetName(x && x.name) === name) || null;
  }
  function rolePromptConfig(roleName, baseCfg, extra) {
    const role = normalizePresetName(roleName || companionName());
    const pr = worldPresetForRole(role);
    const cfg = Object.assign({}, baseCfg || settings(), pr || {}, extra || {});
    if (!cfg.charName || cfg.charName === '{{char}}') cfg.charName = role;
    return cfg;
  }
  function applyRoleToAllGames(roleName) {
    const role = normalizePresetName(roleName || companionName());
    Object.keys(GAME_META).forEach(game => setCurrentLinePreset(game, role));
  }
  function summaries() { return loadJSON(STORAGE_SUMMARIES, []); }
  function saveSummaries(v) { saveJSON(STORAGE_SUMMARIES, v); }
  function summaryReq() { return localStorage.getItem(STORAGE_SUMMARY_REQ) || ''; }
  function saveSummaryReq(v) { try { localStorage.setItem(STORAGE_SUMMARY_REQ, String(v || '')); } catch(e) {} }
  function progress() { return loadJSON(STORAGE_PROGRESS, {}); }
  function gameProgress(game) { const p = progress()[game]; return p && p.savedAt ? p : null; }
  function currentGameDurationMs() {
    const active = gameStarted && !gamePaused && gameActiveStartedAt ? Math.max(0, Date.now() - gameActiveStartedAt) : 0;
    return Math.max(0, (gameAccumulatedMs || 0) + active);
  }
  function commitGameActiveDuration(updateStored) {
    if (gameStarted && !gamePaused && gameActiveStartedAt) {
      gameAccumulatedMs += Math.max(0, Date.now() - gameActiveStartedAt);
      gameActiveStartedAt = Date.now();
    }
    if (updateStored && currentGame) {
      const p = progress();
      if (p[currentGame]) {
        p[currentGame].durationMs = Math.max(Number(p[currentGame].durationMs || 0), gameAccumulatedMs || 0);
        saveJSON(STORAGE_PROGRESS, p);
      }
    }
  }
  function saveProgress(game, state) {
    const p = progress();
    const prev = p[game] || {};
    const startedAt = (state && state.startedAt) || prev.startedAt || gameStartAt || Date.now();
    const extra = game === currentGame ? { lineEvents: currentRoundLineEvents.slice(-120) } : {};
    const durationMs = game === currentGame ? currentGameDurationMs() : (state && state.durationMs) || prev.durationMs || 0;
    p[game] = Object.assign({ savedAt: Date.now(), startedAt }, extra, state || {}, { durationMs });
    saveJSON(STORAGE_PROGRESS, p);
  }
  function clearProgress(game) { const p = progress(); delete p[game]; saveJSON(STORAGE_PROGRESS, p); }
  function wordGuessBank(roleName) {
    const raw = loadJSON(STORAGE_WORD_GUESS_BANK, []);
    if (Array.isArray(raw)) return raw;
    const role = normalizePresetName(roleName || companionName());
    const arr = raw && raw[role];
    return Array.isArray(arr) ? arr : [];
  }
  function saveWordGuessBank(arr, roleName) {
    const raw = loadJSON(STORAGE_WORD_GUESS_BANK, {});
    const store = Array.isArray(raw) ? {} : (raw || {});
    store[normalizePresetName(roleName || companionName())] = Array.isArray(arr) ? arr : [];
    saveJSON(STORAGE_WORD_GUESS_BANK, store);
  }
  function hasPlayableProgress(game, state) {
    if (!state) return false;
    if (game === 'wordguess') return !!(state.completed || state.clueIndex || state.revealed || (state.guesses && state.guesses.length));
    if (game === 'guessnumber') return !!(state.tries || (state.history && state.history.length));
    if (game === 'oldmaid') return !!(state.pending || state.phase !== 'user_pick' || state.turn !== 'user' || (state.log && state.log.length));
    if (game === 'ludo') return !!(state.rolled || state.dice || String(state.turn || 'red') !== 'red' || (state.red || []).some(x => x !== -1) || (state.blue || []).some(x => x !== -1));
    if (game === 'tictactoe' || game === 'gomoku') return Array.isArray(state.b) && state.b.some(Boolean);
    if (game === 'territory') return !!(state.userScore || state.taScore || String(state.turn || 'user') !== 'user' || (state.h || []).some(row => row.some(Boolean)) || (state.v || []).some(row => row.some(Boolean)));
    if (game === 'watermelon') return !!(state.score || (state.balls && state.balls.length));
    if (game === 'memory') return !!(state.moves || (state.done && state.done.length) || (state.open && state.open.length));
    if (game === 'snake') return !!state.score;
    if (game === 'game2048') return !!state.score || (Array.isArray(state.board) && state.board.filter(Boolean).length > 2);
    if (game === 'jump') return !!state.score;
    if (game === 'tetris') return !!state.score || (Array.isArray(state.board) && state.board.some(row => row.some(Boolean)));
    return true;
  }
  function records() { const all = loadJSON(STORAGE_RECORDS, {}); let changed = false; Object.keys(all || {}).forEach(game => { (all[game] || []).forEach((r, i) => { if (!r.id) { r.id = 'rec_legacy_' + game + '_' + (r.savedAt || Date.now()) + '_' + i; changed = true; } if (r.log == null) { r.log = ''; changed = true; } }); }); if (changed) saveJSON(STORAGE_RECORDS, all); return all || {}; }
  function saveRecords(v) { saveJSON(STORAGE_RECORDS, v); }
  function companionName() { const cfg = settings(); const ctx = getHostContext(); const char = ctx && ctx.characters && ctx.characterId >= 0 ? ctx.characters[ctx.characterId] : (ctx && ctx.character ? ctx.character : null); const charData = char?.data || char || {}; return (cfg.charName && cfg.charName !== '{{char}}') ? cfg.charName : (charData.name || ctx?.name2 || '{{char}}'); }
  function displayCharNameForGame(game) { return settings().companion ? activeGameRoleName(game) : 'TA'; }
  function displayCharName() { return displayCharNameForGame(currentGame); }
  function displayCharTextForGame(text, game) {
    const name = displayCharNameForGame(game);
    let out = String(text || '').replace(/{{char}}/g, name);
    [companionName(), activeGameRoleName(game)].filter(Boolean).forEach(n => { out = out.replace(new RegExp(String(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), name); });
    return out;
  }
  function displayCharText(text) { return displayCharTextForGame(text, currentGame); }
  function roleGameStats(game, roleName) {
    const who = roleName || companionName();
    const arr = (records()[game] || []).filter(r => (r.companion || '') === who);
    const wins = arr.filter(r => resultOutcome(r.result) === 'user_win').length;
    const total = arr.filter(r => ['user_win','ta_win','draw'].includes(resultOutcome(r.result))).length;
    return { wins, total, records: arr };
  }
  function guessNumberBestTries(roleName) {
    const stats = roleGameStats('guessnumber', roleName);
    const vals = stats.records.filter(r => resultOutcome(r.result) === 'user_win').map(guessNumberTries).map(x => parseInt(x, 10)).filter(Boolean);
    return vals.length ? Math.min(...vals) : 0;
  }
  function sudokuBestDuration() {
    const vals = (records().sudoku || []).map(r => Number(r.durationMs || 0)).filter(Boolean);
    return vals.length ? Math.min(...vals) : 0;
  }
  function memoryBestMoves() {
    const sc = scores();
    const direct = parseInt(sc.memoryBestMoves, 10);
    if (direct > 0) return direct;
    const score = Number(sc.memory || 0);
    const derived = score ? Math.round((1840 - score) / 25) : 0;
    return derived >= 8 && derived <= 200 ? derived : 0;
  }
  function saveMemoryBestMoves(moves) {
    const n = parseInt(moves, 10);
    if (!n) return;
    const sc = scores();
    const old = parseInt(sc.memoryBestMoves, 10);
    if (!old || n < old) { sc.memoryBestMoves = n; saveJSON(STORAGE_SCORES, sc); }
  }
  function wordGuessBestCompanion() {
    const groups = new Map();
    (records().wordguess || []).forEach(r => {
      const name = String(r.companion || '').trim();
      if (!name || name === 'TA') return;
      const hits = parseInt(wordGuessHits(r), 10) || 0;
      const cur = groups.get(name) || { name, best: 0, total: 0, wins: 0, games: 0, last: 0 };
      cur.best = Math.max(cur.best, hits);
      cur.total += hits;
      cur.wins += resultOutcome(r.result) === 'user_win' ? 1 : 0;
      cur.games++;
      cur.last = Math.max(cur.last, Number(r.savedAt || 0));
      groups.set(name, cur);
    });
    const sorted = Array.from(groups.values()).sort((a,b) => b.best - a.best || b.wins - a.wins || b.total - a.total || b.last - a.last);
    return sorted[0]?.name || '';
  }
  function scoreDisplay(game) { const g = GAME_META[game] || {}; const sc = scores()[game]; if (game === 'sudoku') { const best = sudokuBestDuration(); return '最短时长：' + (best ? formatDuration(best) : '无'); } if (g.mode === 'double') { const st = roleGameStats(game); return '胜率：' + st.wins + '/' + st.total; } return '最高：' + ((sc || 0) + (g.unit || '分')); }
  function cardScoreDisplay(game) { const g = GAME_META[game] || {}; const sc = scores()[game]; if (game === 'memory') { const best = memoryBestMoves(); return '最短次数：' + (best ? best + '次' : '无'); } if (game === 'wordguess') { const name = wordGuessBestCompanion(); return '最默契：' + (name || '无'); } if (game === 'guessnumber') { const best = guessNumberBestTries(); return '最小次数：' + (best ? best + '次' : '无'); } if (game === 'sudoku') { const best = sudokuBestDuration(); return '最短时长：' + (best ? formatDuration(best) : '无'); } if (g.mode === 'double') { const st = roleGameStats(game); return '胜率：' + st.wins + '/' + st.total; } return '当前最高分：' + ((sc || 0) + (g.unit || '分')); }
  function gameIconHTML(g) {
    const fallback = '<span>' + esc(g.icon || '') + '</span>';
    if (!g.iconImage) return '<div class="wb-game-icon">' + fallback + '</div>';
    return '<div class="wb-game-icon has-image"><img src="' + esc(g.iconImage) + '" alt="" loading="lazy" decoding="async" onerror="this.style.display=&#39;none&#39;;this.nextElementSibling.style.display=&#39;grid&#39;;this.parentNode.classList.remove(&#39;has-image&#39;);">' + fallback + '</div>';
  }
  function inferResult(game, title, scoreText) { const t = String((title || '') + ' ' + (scoreText || '')); const g = GAME_META[game] || {}; if (g.mode === 'double') { if (/你赢|1胜/.test(t) && !/平局/.test(t)) return 'user_win'; if (/TA获胜|失败|0胜/.test(t) && !/平局/.test(t)) return 'ta_win'; if (/平局/.test(t)) return 'draw'; return 'finished'; } const m = t.match(/(\d+)\s*分/); return { outcome: 'score', score: m ? parseInt(m[1], 10) : 0 }; }
  function recordGameResult(game, title, scoreText, explicitResult) {
    commitGameActiveDuration(false);
    const all = records(); const g = GAME_META[game] || { name: game, mode: 'single' }; const result = explicitResult || inferResult(game, title, scoreText);
    const item = { id:'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), playedAt: new Date().toLocaleString(), savedAt: Date.now(), durationMs: currentGameDurationMs(), game: g.name, result, scoreText: displayCharTextForGame(scoreText || '', game), companion: displayCharNameForGame(game), log: '' };
    if (!all[game]) all[game] = []; all[game].unshift(item); all[game] = all[game].slice(0, 100); saveRecords(all); return item;
  }
  function formatDuration(ms) { const sec = Math.max(0, Math.round((ms || 0) / 1000)); const m = Math.floor(sec / 60), s = sec % 60; return (m ? m + '分' : '') + s + '秒'; }
  function formatRecordTime(r) {
    const d = new Date(Number(r?.savedAt || 0) || r?.playedAt || Date.now());
    if (Number.isNaN(d.getTime())) return String(r?.playedAt || '').replace(/^20(\d{2})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2}).*$/, '$1/$2/$3 $4');
    return String(d.getFullYear()).slice(-2) + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function formatRecordResult(r) { if (!r) return '已完成'; if (typeof r === 'string') return ({ user_win:'你赢', ta_win: displayCharName() + '赢', draw:'平局', finished:'已完成' }[r] || r); if (typeof r === 'object' && r.outcome === 'score') return '得分：' + (r.score || 0); return displayCharText(r); }
  function formatRecordResultForPrompt(r) { return resultOutcome(r) === 'ta_win' ? '{{char}}赢' : formatRecordResult(r).replace(/TA/g, '{{char}}'); }
  function recordScoreDisplay(r) {
    const score = String(r?.scoreText || '').trim();
    if (!score) return '';
    if (r?.result && typeof r.result === 'object' && r.result.outcome === 'score') return '';
    const result = formatRecordResult(r?.result).replace(/\s+/g, '');
    const normalizedScore = score.replace(/\s+/g, '').replace(/^本局[：:]/, '').replace(/^本局分数[：:]/, '得分：');
    return result && normalizedScore === result ? '' : score;
  }
  function singleRecordPoints(r) {
    if (r?.result && typeof r.result === 'object' && r.result.outcome === 'score') return (r.result.score || 0) + '分';
    const m = String(r?.scoreText || '').match(/(\d+)\s*分/);
    return (m ? parseInt(m[1], 10) : 0) + '分';
  }
  function userOutcomeText(result) {
    const out = resultOutcome(result);
    if (out === 'user_win') return '胜';
    if (out === 'ta_win') return '负';
    if (out === 'draw') return '平';
    return '已完成';
  }
  function extractNumber(text, re, fallback) {
    const m = String(text || '').match(re);
    return m ? parseInt(m[1], 10) : fallback;
  }
  function territoryUserCells(r) {
    const txt = String(r?.scoreText || '');
    return extractNumber(txt, /你\s*(\d+)\s*格/, 0) + '格';
  }
  function guessNumberTries(r) {
    return String(extractNumber(r?.scoreText || '', /(?:用了|猜数次数[：:])\s*(\d+)\s*次/, 0));
  }
  function wordGuessHits(r) {
    return extractNumber(r?.scoreText || '', /你猜中\s*(\d+)\s*题/, 0) + '题';
  }
  function isRoundCountGame(game) { return ['tictactoe','gomoku','territory','ludo','reversi','bombnumber','connect4d'].includes(game); }
  function recordRoundCount(r) { return String(extractNumber(r?.scoreText || '', /回合数[：:]\s*(\d+)/, 0)); }
	  function recordCompanionDisplay(r) { return r && r.companion ? r.companion : (settings().companion ? companionName() : 'TA'); }
  function recordTableHeaders(game) {
    if (game === 'territory') return ['时间','用时','胜负','回合数','格子数','陪伴者','日志','操作'];
    if (game === 'reversi') return ['时间','用时','胜负','回合数','格子数','陪伴者','日志','操作'];
    if (game === 'guessnumber') return ['时间','用时','胜负','猜几次','陪伴者','日志','操作'];
    if (game === 'sudoku') return ['时间','用时','求助次数','陪伴者','日志','操作'];
    if (game === 'wordguess') return ['时间','用时','猜中题数','陪伴者','日志','操作'];
    if (isRoundCountGame(game)) return ['时间','用时','胜负','回合数','陪伴者','日志','操作'];
    if ((GAME_META[game] || {}).mode === 'double') return ['时间','用时','胜负','陪伴者','日志','操作'];
    return ['时间','用时','结果','陪伴者','日志','操作'];
  }
  function recordDisplayCells(game, r) {
    const base = [formatRecordTime(r), formatDuration(r.durationMs)];
    if (game === 'territory') return base.concat([userOutcomeText(r.result), recordRoundCount(r), territoryUserCells(r), recordCompanionDisplay(r)]);
    if (game === 'reversi') return base.concat([userOutcomeText(r.result), recordRoundCount(r), territoryUserCells(r), recordCompanionDisplay(r)]);
    if (game === 'guessnumber') return base.concat([userOutcomeText(r.result), guessNumberTries(r), recordCompanionDisplay(r)]);
    if (game === 'sudoku') return base.concat([String(extractNumber(r?.scoreText || '', /求助\s*(\d+)\s*次/, 0)), recordCompanionDisplay(r)]);
    if (game === 'wordguess') return base.concat([wordGuessHits(r), recordCompanionDisplay(r)]);
    if (isRoundCountGame(game)) return base.concat([userOutcomeText(r.result), recordRoundCount(r), recordCompanionDisplay(r)]);
    if ((GAME_META[game] || {}).mode === 'double') return base.concat([userOutcomeText(r.result), recordCompanionDisplay(r)]);
    return base.concat([singleRecordPoints(r), recordCompanionDisplay(r)]);
  }
  function gameLogSituation(game, rec) {
    const cells = recordDisplayCells(game, rec);
    const headers = recordTableHeaders(game).filter(h => h !== '日志' && h !== '操作');
    return headers.map((h, i) => h + '：' + (cells[i] || '')).join('，');
  }
  function gameLogFieldRules(game, roleName) {
    const role = roleName || displayCharNameForGame(game);
    if (game === 'territory' || game === 'reversi') return '字段说明：胜负是user的胜负；回合数表示本局双方行动总数；格子数只表示user占领的格子数，不包含' + role + '的格子。';
    if (isRoundCountGame(game)) return '字段说明：胜负是user的胜负；回合数表示本局双方行动总数。';
    if (game === 'guessnumber') return '字段说明：胜负是user的胜负；猜几次只表示user猜了几次。';
    if (game === 'sudoku') return '字段说明：求助次数只表示user本局点击提示/修改的次数。';
    if (game === 'wordguess') return '字段说明：猜中题数只表示user猜中的题数。';
    if ((GAME_META[game] || {}).mode === 'double') return '字段说明：胜负是user的胜负，胜表示user赢，负表示' + role + '赢。';
    return '字段说明：结果是user本局获得的分数。';
  }
  function textSegments(value) {
    const flatten = input => Array.isArray(input) ? input.flatMap(flatten) : String(input || '').split(/\n{2,}|\r?\n/);
    const parts = flatten(value).map(x => String(x || '').trim()).filter(Boolean);
    return parts.length ? parts : [''];
  }
  function textSegmentsHTML(value) {
    return textSegments(value).map(x => '<p class="wb-text-seg">' + esc(x) + '</p>').join('');
  }
  function inlineMarkdownHTML(text) {
    let html = esc(text);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    return html;
  }
  function markdownTextHTML(text) {
    const raw = displayCharText(text || '');
    const lines = raw.split(/\r?\n/);
    const out = [];
    let inList = false;
    let inCode = false;
    let code = [];
    const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
    const closeCode = () => { if (inCode) { out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); code = []; inCode = false; } };
    lines.forEach(line => {
      const trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        if (inCode) closeCode();
        else { closeList(); inCode = true; code = []; }
        return;
      }
      if (inCode) { code.push(line); return; }
      if (!trimmed) { closeList(); return; }
      const h = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (h) { closeList(); out.push('<h' + Math.min(6, h[1].length) + '>' + inlineMarkdownHTML(h[2]) + '</h' + Math.min(6, h[1].length) + '>'); return; }
      const li = trimmed.match(/^[-*]\s+(.+)$/);
      if (li) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inlineMarkdownHTML(li[1]) + '</li>'); return; }
      closeList();
      out.push('<p class="wb-text-seg">' + inlineMarkdownHTML(trimmed) + '</p>');
    });
    closeList();
    closeCode();
    return out.join('');
  }
	  function normalizeTheaterItem(item) {
	    if (Array.isArray(item)) return textSegments(item);
	    if (item && typeof item === 'object') {
	      const parts = item.segments || item.paragraphs || item.parts || item.text;
	      return Array.isArray(parts) ? textSegments(parts) : textSegments(parts || JSON.stringify(item));
	    }
	    return textSegments(item);
	  }
	  function normalizeTheaterText(item) { return normalizeTheaterItem(item).join('\n'); }
	  function recordFavoriteTheaterText(r) {
	    if (!r || !r.favoriteTheater) return '';
	    const t = r.favoriteTheater;
	    return normalizeTheaterText(t.text || t.lines || t);
	  }
	  function updateRecord(game, id, patch) { const all = records(); const arr = all[game] || []; const idx = arr.findIndex(r => r.id === id); if (idx < 0) return null; arr[idx] = Object.assign({}, arr[idx], patch || {}); all[game] = arr; saveRecords(all); return arr[idx]; }
  function deleteRecord(game, id) { const all = records(); all[game] = (all[game] || []).filter(r => r.id !== id); saveRecords(all); }
  function recentGameLogs(game, companion) {
    const who = companion || companionName();
    return (records()[game] || [])
      .filter(r => r.log && (r.companion || '') === who)
      .slice(0, 5)
      .map((r,i) => '日志' + (i + 1) + '（同角色：' + who + '）：' + r.log)
      .join('\n');
  }
  function lineEventLogText(events) {
    const arr = Array.isArray(events) ? events : [];
    if (!arr.length) return '无';
    return arr.slice(-120).map((item, i) => {
      const event = item.event || 'custom';
      const desc = item.desc || '无解释';
      const text = item.text || '';
      return (i + 1) + '. ' + event + '：' + desc + (text ? '\n   内容：' + text : '');
    }).join('\n');
  }
  function recordLineTrigger(game, event, text) {
    if (!game) return;
    const desc = (EVENT_DESCRIPTIONS[game] && EVENT_DESCRIPTIONS[game][event]) || (event === 'custom' ? '自定义角色语录。' : '未配置解释的角色语录触发。');
    currentRoundLineEvents.push({ event, desc, text:String(text || '').trim(), at:Date.now() });
    if (currentRoundLineEvents.length > 120) currentRoundLineEvents = currentRoundLineEvents.slice(-120);
  }
  function resultOutcome(result) { return typeof result === 'string' ? result : (result && result.outcome) || 'finished'; }
  function doubleStreak(game, outcome, companion) {
    const who = companion || companionName();
    const arr = records()[game] || [];
    let n = 0;
    for (const r of arr) {
      if ((r.companion || '') !== who) continue;
      if (resultOutcome(r.result) === outcome) n++;
      else break;
    }
    return n;
  }
  function parseScoreNumber(text) { const m = String(text || '').match(/(\d+)\s*分/); return m ? parseInt(m[1], 10) : 0; }
  function gameTheaterConditionRules(game, roleName) {
    const g = GAME_META[game] || {};
    const role = roleName || displayCharNameForGame(game);
    if (g.mode !== 'double') {
      if (game === 'plank') return [
        'record：刷新当前游戏历史记录。',
        'super_good：超完美小剧场。搭木板连续5次以上perfect，表现角色对user手感的惊讶。',
        'plank_regret：遗憾小剧场。桥只差非常少一点点就能搭上。',
        'plank_tease：嘲笑小剧场。桥差得非常多，可以让角色调侃user是不是不小心手抖了。',
        'super_bad：超级菜小剧场。15秒以内失败，并且分数低于3分。',
        'long_run：单局持续20分钟以上。',
        '如果同一局同时满足多个特殊小剧场，会在满足条件的类型里等概率随机选择一个。'
      ].join('\n');
      if (game === 'sudoku') return [
        'record：刷新当前游戏最短完成时长记录。',
        'super_good：超厉害小剧场。求助少于5次，并且5分钟内完成。',
        'scholar：谁是学霸小剧场。数独里' + role + '帮助你超过5次，表现user一直找TA求助的情感。',
        'independent：超独立小剧场。数独一次求助都没有就完成。',
        'long_run：单局持续20分钟以上。',
        '如果同一局同时满足多个特殊小剧场，会在满足条件的类型里等概率随机选择一个。'
      ].join('\n');
      return [
        'record：刷新当前游戏历史记录。',
        'super_good：超级厉害小剧场。2048合成4096以上；俄罗斯方块消除10行以上；合成大西瓜合成2个最终西瓜；贪吃蛇达到200分以上。',
        'scholar：谁是学霸小剧场。数独里' + role + '帮助你超过5次，表现user一直找TA求助的情感。',
        'independent：超独立小剧场。数独一次求助都没有就完成。',
        'super_bad：超级菜小剧场。15秒以内失败，并且分数很低：俄罗斯方块低于200分、贪吃蛇低于30分、跳一跳低于3分、合成大西瓜低于120分、2048低于128分。',
        'long_run：单局持续20分钟以上。',
        '如果同一局同时满足多个特殊小剧场，会在满足条件的类型里等概率随机选择一个。'
      ].join('\n');
    }
    if (game === 'bombnumber') return [
      'bad_luck：数字炸弹超倒霉小剧场。user在还有80个以上可选数字时点中炸弹失败。',
      'bomb_lucky：数字炸弹超幸运小剧场。user一次缩小50个以上数字且没有爆炸。',
      'fated：数字炸弹命中注定小剧场。user最后剩1个数字没得选。',
      'rage：数字炸弹气急败坏小剧场。' + role + '最后剩1个数字没得选。'
    ].join('\n');
    if (game === 'reversi') return [
      'win_streak3：user在同一角色同一游戏连续赢三场。',
      'lose_streak3：' + role + '在同一角色同一游戏连续赢三场。',
      'reversi_user_sweep：完胜小剧场。user占据棋盘55个以上的棋子并获胜。',
      'reversi_char_sweep：完败小剧场。' + role + '占据棋盘55个以上的棋子并获胜。',
      'reversi_close_win：险胜小剧场。user的棋子不超过2个胜过' + role + '。',
      'reversi_close_lose：险败小剧场。' + role + '的棋子不超过2个胜过user，可以带一点小侥幸。',
      'reversi_comeback：逆转小剧场。user从远远少于' + role + '（user棋子是' + role + '一半以下）到一次突然翻转超过7个并最终获胜。'
    ].join('\n');
    if (game === 'connect4d') return [
      'win_streak3：user在同一角色同一游戏连续赢三场。',
      'lose_streak3：' + role + '在同一角色同一游戏连续赢三场。',
      'balanced：势均力敌小剧场。棋盘填满但是平局。'
    ].join('\n');
    return [
      'win_streak3：user在同一角色同一游戏连续赢三场。',
      'lose_streak3：' + role + '在同一角色同一游戏连续赢三场。',
      'lucky：运气超好。猜数字5次内猜中；飞行棋连续摇到2次6并获胜；我说你猜第一条直接猜中；抽鬼牌user3回合内获胜。',
      'stomp：实力悬殊。双人飞行棋' + role + '获胜且user一个飞机都没回去；围地盘' + role + '比user多10格以上；抽鬼牌' + role + '3回合内获胜。',
      'close_lose：惜败。user差一点输给' + role + '，包括井字棋最后一步输、围地盘差2格以内、飞行棋' + role + '赢时user也只差一个棋子。',
      'close_win：险胜。user惊险获胜，包括井字棋最后一步赢、围地盘差2格以内、飞行棋user赢时' + role + '也只差一个棋子。',
      'soulmate：我说你猜5道全部猜中。'
      ,'bad_luck：数字炸弹超倒霉小剧场。user在还有80个以上可选数字时点中炸弹失败。'
      ,'bomb_lucky：数字炸弹超幸运小剧场。user一次缩小50个以上数字且没有爆炸。'
      ,'fated：数字炸弹命中注定小剧场。user最后剩1个数字没得选。'
      ,'rage：数字炸弹气急败坏小剧场。' + role + '最后剩1个数字没得选。'
    ].join('\n');
  }
  function theaterConditionForSpecial(game, special, roleName) {
    if (!special) return '普通小剧场：未命中特殊小剧场条件。';
    const rules = gameTheaterConditionRules(game, roleName).split('\n');
    return rules.find(x => x.indexOf(special + '：') === 0) || (theaterTitleForSpecial(special) + '：命中该特殊小剧场条件。');
  }
  function singleSpecialTheater(game, scoreText, meta, durationMs) {
    const score = parseScoreNumber(scoreText);
    meta = meta || {};
    const candidates = [];
    if ((game === 'game2048' && (meta.maxTile || 0) >= 4096) || (game === 'tetris' && (meta.lines || 0) >= 10) || (game === 'watermelon' && (meta.finalWatermelons || 0) >= 2) || (game === 'snake' && score >= 200)) candidates.push('super_good');
    if (game === 'plank' && (meta.perfectStreak || 0) >= 5) candidates.push('super_good');
    if (game === 'plank' && meta.nearMiss) candidates.push('plank_regret');
    if (game === 'plank' && meta.farMiss) candidates.push('plank_tease');
    if (game === 'sudoku' && (meta.hints || 0) > 5) candidates.push('scholar');
    if (game === 'sudoku' && (meta.hints || 0) === 0) candidates.push('independent');
    if (game === 'sudoku' && (meta.hints || 0) < 5 && durationMs <= 300000) candidates.push('super_good');
    if (durationMs <= 15000 && ((game === 'tetris' && score < 200) || (game === 'snake' && score < 30) || ((game === 'jump' || game === 'plank') && score < 3) || (game === 'watermelon' && score < 120) || (game === 'game2048' && score < 128))) candidates.push('super_bad');
    if (durationMs >= 1200000) candidates.push('long_run');
    if (currentRoundRecord) candidates.push('record');
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : '';
  }
  function doubleSpecialTheater(game, outcome, scoreText, meta) {
    meta = meta || {};
    if (game === 'connect4d' && outcome === 'draw') return 'balanced';
    if (outcome === 'user_win') {
      if (game === 'bombnumber' && meta.luckyShrink) return 'bomb_lucky';
      if (game === 'bombnumber' && meta.charDoomed) return 'rage';
      if (game === 'bombnumber') return '';
      if (game === 'reversi' && meta.comeback) return 'reversi_comeback';
      if (game === 'reversi' && (meta.userScore || 0) >= 55) return 'reversi_user_sweep';
      if (game === 'reversi' && (meta.userScore || 0) > (meta.taScore || 0) && (meta.userScore || 0) - (meta.taScore || 0) <= 2) return 'reversi_close_win';
      if ((game === 'guessnumber' && (meta.tries || 99) <= 5) || (game === 'ludo' && (meta.consecutiveSixes || 0) >= 2) || (game === 'wordguess' && meta.firstClueWin) || (game === 'oldmaid' && (meta.userTurns || 99) <= 3)) return 'lucky';
      if (game === 'wordguess' && meta.allCorrect) return 'soulmate';
      if ((game === 'tictactoe' && meta.lastMoveWin) || (game === 'territory' && Math.abs((meta.userScore || 0) - (meta.taScore || 0)) <= 2) || (game === 'ludo' && meta.opponentOnePieceLeft)) return 'close_win';
      return '';
    }
    if (outcome === 'ta_win') {
      if (game === 'bombnumber' && meta.badLuck) return 'bad_luck';
      if (game === 'bombnumber' && meta.userDoomed) return 'fated';
      if (game === 'bombnumber') return '';
      if (game === 'reversi' && (meta.taScore || 0) >= 55) return 'reversi_char_sweep';
      if (game === 'reversi' && (meta.taScore || 0) > (meta.userScore || 0) && (meta.taScore || 0) - (meta.userScore || 0) <= 2) return 'reversi_close_lose';
      if ((game === 'ludo' && meta.userHomeAll) || (game === 'territory' && (meta.taScore || 0) - (meta.userScore || 0) >= 10) || (game === 'oldmaid' && (meta.taTurns || 99) <= 3)) return 'stomp';
      if ((game === 'tictactoe' && meta.lastMoveWin) || (game === 'territory' && Math.abs((meta.userScore || 0) - (meta.taScore || 0)) <= 2) || (game === 'ludo' && meta.opponentOnePieceLeft)) return 'close_lose';
    }
    return '';
  }
  function theaterTitleForSpecial(special) {
    return ({
      record: '破纪录小剧场',
      win_streak3: '连赢三场小剧场',
      lose_streak3: '连输三场小剧场',
      super_good: '超级厉害小剧场',
      super_bad: '超级菜小剧场',
      long_run: '超能熬小剧场',
      lucky: '运气超好小剧场',
      stomp: '实力悬殊小剧场',
      close_lose: '惜败小剧场',
      close_win: '险胜小剧场',
      soulmate: '心有灵犀小剧场'
      ,scholar: '谁是学霸小剧场'
      ,independent: '超独立小剧场'
      ,bad_luck: '超倒霉小剧场'
      ,bomb_lucky: '超幸运小剧场'
      ,fated: '命中注定小剧场'
      ,rage: '气急败坏小剧场'
      ,plank_regret: '遗憾小剧场'
      ,plank_tease: '嘲笑小剧场'
      ,reversi_user_sweep: '完胜小剧场'
      ,reversi_char_sweep: '完败小剧场'
      ,reversi_close_win: '险胜小剧场'
      ,reversi_close_lose: '险败小剧场'
      ,reversi_comeback: '逆转小剧场'
      ,balanced: '势均力敌小剧场'
    }[special] || '特殊角色互动小剧场').replace(/{{char}}/g, displayCharName());
  }
  function nextCharLineTurn(from) { return (from || 0) + 3 + Math.floor(Math.random() * 3); }
  function eventDescriptionBlock(game, keys) {
    const m = EVENT_DESCRIPTIONS[game] || {};
    const g = GAME_META[game] || {};
    return (keys || Object.keys(DEFAULT_LINES[game] || {})).map(k => {
      const desc = k === 'random' ? ((g.mode === 'double' ? '一起玩' : '观看') + (g.name || game) + '游戏时的碎碎念') : (m[k] || '游戏事件触发');
      return k + '：' + desc;
    }).join('\n');
  }
  function addTaWin(game) { const sc = scores(); const cur = sc[game] && typeof sc[game] === 'object' ? sc[game] : { user: sc[game] || 0, ta: 0 }; cur.ta = (cur.ta || 0) + 1; sc[game] = cur; saveJSON(STORAGE_SCORES, sc); }
  function isMobileHost() {
    const win = getHostWindow();
    const nav = win.navigator || navigator;
    return (win.innerWidth || 800) <= 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '') || (nav.maxTouchPoints || 0) > 1;
  }
	  function themeClass(value) {
	    const t = value || settings().theme || 'day';
	    return ({ day:'wb-day', night:'wb-night', spring:'wb-spring', cyber:'wb-cyber' })[t] || 'wb-day';
	  }
	  function customFonts() {
	    const cfg = settings();
	    return Array.isArray(cfg.customFonts) ? cfg.customFonts.filter(x => x && x.name && x.url) : [];
	  }
	  function selectedFontConfig(cfgOverride) {
	    const cfg = cfgOverride || settings();
	    const name = String(cfg.selectedFont || '').trim();
	    if (!name) return null;
	    return (Array.isArray(cfg.customFonts) ? cfg.customFonts : []).find(x => x && x.name === name && x.url) || null;
	  }
	  function applySelectedFont() {
	    const doc = getHostDocument();
	    const old = qs('#' + SCRIPT_ID + '-font-css', doc);
	    const font = selectedFontConfig();
	    if (!font) { if (old) old.remove(); return; }
	    const safeFamily = 'WanbanCustomFont_' + String(font.name).replace(/[^\w-]/g, '_');
	    const cssText = "@font-face{font-family:'" + safeFamily + "';src:url('" + String(font.url).replace(/['\\]/g, '') + "');font-display:swap;}#" + POPUP_ID + ",.wb-modal-mask{font-family:'" + safeFamily + "','Microsoft YaHei',system-ui,sans-serif!important;}";
	    const style = old || doc.createElement('style');
	    style.id = SCRIPT_ID + '-font-css';
	    style.textContent = cssText;
	    if (!old) doc.head.appendChild(style);
	  }
	  function isNightTheme(value) {
    const t = value || settings().theme || 'day';
    return t === 'night' || t === 'cyber';
  }
  function canvasThemePalette() {
    const t = settings().theme || 'day';
    if (t === 'spring') return { top:'#F4F1D3', mid:'#EAF6D4', bottom:'#D8EDB2', pattern:'rgba(111,168,90,.075)', grid:'rgba(76,59,42,.16)', border:'rgba(111,83,45,.32)', text:'#4C3B2A' };
    if (t === 'cyber') return { top:'#101A1D', mid:'#14201B', bottom:'#0D1512', pattern:'rgba(241,232,91,.07)', grid:'rgba(25,211,197,.18)', border:'rgba(241,232,91,.34)', text:'#F6F5DE' };
    if (t === 'night') return { top:'#1b1020', mid:'#211426', bottom:'#120b17', pattern:'rgba(244,194,215,.04)', grid:'rgba(244,194,215,.12)', border:'rgba(244,194,215,.16)', text:'#f7dce7' };
    return { top:'#fff1f5', mid:'#fde7ee', bottom:'#f8dce7', pattern:'rgba(216,112,147,.045)', grid:'rgba(174,82,115,.14)', border:'rgba(174,82,115,.18)', text:'#6f5b45' };
  }

  function modalMaskClass() { return 'wb-modal-mask ' + themeClass(); }
	  function appendModalMask(mask) {
	    const doc = getHostDocument();
	    const win = getHostWindow();
	    applySelectedFont();
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
  function updateLineGenerationStatusUI() {
    const status = qs('#wb-line-generation-status');
    if (status) status.textContent = lineGenerationStatus;
    const batch = qs('#wb-batch-lines');
    if (batch) { batch.disabled = lineGenerationBusy && lineGenerationKind !== 'batch'; batch.textContent = lineGenerationBusy && lineGenerationKind === 'batch' ? '取消生成' : '批量生成角色数据'; }
    const single = qs('#wb-generate-lines');
    if (single) { single.disabled = lineGenerationBusy; single.textContent = lineGenerationBusy ? '生成中' : '生成'; }
    const modalStart = qs('#wb-batch-start');
    if (modalStart) { modalStart.disabled = lineGenerationBusy && lineGenerationKind !== 'batch'; if (lineGenerationBusy && lineGenerationKind === 'batch') modalStart.textContent = '取消生成'; }
  }
  function setLineGenerationStatus(text, busy) {
    lineGenerationStatus = text || '当前状态：空闲';
    lineGenerationBusy = !!busy;
    updateLineGenerationStatusUI();
  }
  function requestBatchLineGenerationCancel() {
    if (!lineGenerationBusy || lineGenerationKind !== 'batch') return;
    showConfirm('中断批量生成', '确定要中断当前批量生成吗？正在等待的这一次 AI 调用可能会先完成，之后不会继续生成后续游戏。', () => {
      batchLineGenerationCancel = true;
      setLineGenerationStatus('正在中断批量生成，等待当前调用结束...', true);
      toast('已请求中断批量生成');
    });
  }
  function makeLineGenerationProgress(label, total, onText) {
    let done = 0;
    const progress = detail => {
      if (!total) return;
      done += 1;
      const text = label + '：' + done + '/' + total + (detail ? '（' + detail + '）' : '');
      setLineGenerationStatus(text, true);
      if (onText) onText(text);
    };
    progress.done = () => done;
    return progress;
  }
  function hostValue(name) {
    const w = getHostWindow();
    try {
      const ctx = w.SillyTavern && typeof w.SillyTavern.getContext === 'function' ? w.SillyTavern.getContext() : null;
      if (ctx && ctx[name] !== undefined) return ctx[name];
    } catch(e) {}
    return w && w[name] !== undefined ? w[name] : (window[name] !== undefined ? window[name] : undefined);
  }
  let messageNotifyBound = false;
  let messageNotifyLastSignature = null;
  let messageNotifyRecent = { key:'', at:0 };
  let messageNotifyPollTimer = null;
  function pauseGameForMessageNotify() {
    if (!gameStarted || !currentGame || gamePaused) return;
    if ((GAME_META[currentGame] || {}).mode === 'double') return;
    commitGameActiveDuration(true);
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
  function extractTaggedBody(text) {
    const tag = (settings().messageNotifyTag || 'content').replace(/[<>/\s]/g, '') || 'content';
    const raw = String(text || '');
    const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i');
    const match = raw.match(re);
    const body = (match ? match[1] : raw).replace(/<[^>]+>/g, '').trim();
    if (body.length <= 220) return body;
    const paragraphs = body.split(/\n{2,}|\r?\n/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const firstPart = paragraphs.length ? paragraphs.join('\n\n') : body.replace(/\s+/g, ' ').trim();
    return firstPart.slice(0, 200).trim();
  }
  function sendMessageFinishedNotification(messageId, text) {
    const cfg = settings();
    if (!cfg.messageNotify) return;
    const shell = qs('#' + SHELL_ID);
    if (!shell || !shell.classList.contains('wb-shell-visible') || !currentGame) return;
    const preview = extractTaggedBody(text) || 'RP正文已生成。';
    const stableKey = preview.replace(/\s+/g, '').slice(0, 160);
    const now = Date.now();
    if (stableKey && messageNotifyRecent.key === stableKey && now - messageNotifyRecent.at < 8000) return;
    const signature = String(messageId == null ? 'latest' : messageId) + '::' + preview;
    if (signature === messageNotifyLastSignature) return;
    messageNotifyLastSignature = signature;
    messageNotifyRecent = { key:stableKey, at:now };
    pauseGameForMessageNotify();
    notifyBeep();
    try { const nav = getHostWindow().navigator || navigator; if (nav && nav.vibrate) nav.vibrate([180, 80, 220]); } catch(e) {}
    showTextModal('RP正文完成提醒', preview);
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
  function primeMessageNotifyBaseline() {
    const msg = messageFromHost(null);
    if (!msg || !isAssistantMessage(msg)) return;
    const id = msg.id ?? msg.swipe_id ?? msg.send_date ?? 'latest';
    const text = String(msg.message || msg.mes || msg.text || '');
    const preview = extractTaggedBody(text) || '';
    if (preview) messageNotifyLastSignature = String(id) + '::' + preview;
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
    const updateNames = [eventTypes.MESSAGE_UPDATED, eventTypes.MESSAGE_SWIPED, eventTypes.CHARACTER_MESSAGE_RENDERED, 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'CHARACTER_MESSAGE_RENDERED'].filter(Boolean);
    if (eventSource && typeof eventSource.on === 'function') {
      eventSource.on(eventName, handleHostMessageReceived);
      updateNames.forEach(name => { try { eventSource.on(name, handleHostMessageReceived); } catch(e) {} });
      messageNotifyBound = true;
      startMessageNotifyPolling();
      return;
    }
    if (eventSource && typeof eventSource.addEventListener === 'function') {
      eventSource.addEventListener(eventName, e => handleHostMessageReceived(e && e.detail && e.detail.message_id, e && e.detail && e.detail.type));
      updateNames.forEach(name => { try { eventSource.addEventListener(name, e => handleHostMessageReceived(e && e.detail && e.detail.message_id, e && e.detail && e.detail.type)); } catch(err) {} });
      messageNotifyBound = true;
      startMessageNotifyPolling();
      return;
    }
    if (!w.__wanbanMessageNotifyRetry) {
      w.__wanbanMessageNotifyRetry = setInterval(() => {
        const es = hostValue('eventSource');
        if (es && typeof es.on === 'function') { clearInterval(w.__wanbanMessageNotifyRetry); w.__wanbanMessageNotifyRetry = null; bindMessageNotifyEvents(); }
      }, 2000);
    }
    startMessageNotifyPolling();
  }
  function startMessageNotifyPolling() {
    if (messageNotifyPollTimer) return;
    let pendingSig = '', pendingAt = 0;
    messageNotifyPollTimer = setInterval(() => {
      if (!settings().messageNotify) return;
      const msg = messageFromHost(null);
      if (!isAssistantMessage(msg)) return;
      const id = msg.id ?? msg.swipe_id ?? msg.send_date ?? 'latest';
      const text = String(msg.message || msg.mes || msg.text || '');
      if (!text.trim()) return;
      const sig = String(id) + '::' + text;
      if (sig !== pendingSig) { pendingSig = sig; pendingAt = Date.now(); return; }
      if (Date.now() - pendingAt >= 1400) sendMessageFinishedNotification(id, text);
    }, 1200);
  }

  function stopGame() { commitGameActiveDuration(true); if (snakeTimer) clearInterval(snakeTimer); if (tetrisTimer) clearInterval(tetrisTimer); if (watermelonTimer) clearInterval(watermelonTimer); if (jumpTimer) clearInterval(jumpTimer); if (randomLineTimer) clearInterval(randomLineTimer); if (singleDialogueTimer) clearTimeout(singleDialogueTimer); snakeTimer = tetrisTimer = watermelonTimer = jumpTimer = randomLineTimer = null; singleDialogueTimer = null; singleDialogueQueue = null; firstMoverAwaitingUserAction = false; hideGamePauseOverlay(); getHostDocument().onkeydown = null; gameStarted = false; gamePaused = true; gameActiveStartedAt = 0; }
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
    const shell = qs('.wb-tetris-shell, .wb-snake-shell', box);
    const target = shell || box;
    const rect = target.getBoundingClientRect();
    const controls = shell ? qs('.wb-tetris-controls, .wb-snake-controls', shell) : null;
    const controlsRect = controls && getHostWindow().getComputedStyle(controls).display !== 'none' ? controls.getBoundingClientRect() : null;
    const padX = 2;
    const padY = 2;
    const tetrisControls = controlsRect && controls?.classList.contains('wb-tetris-controls');
    const snakeControls = controlsRect && controls?.classList.contains('wb-snake-controls');
    const maxW = Math.max(0, rect.width - padX - (tetrisControls ? controlsRect.width + 8 : 0));
    const maxH = Math.max(0, rect.height - padY - (snakeControls ? controlsRect.height + 8 : 0));
    if (maxW < 20 || maxH < 20) return;
    const canvas = qs('canvas.wb-canvas', box);
    if (canvas) {
      const rawW = canvas.width || 300;
      const rawH = canvas.height || rawW;
      const allowGrow = canvas.classList.contains('wb-snake-canvas');
      const scale = Math.min(maxW / rawW, maxH / rawH, allowGrow ? 10 : 1);
      canvas.style.width = Math.floor(rawW * scale) + 'px';
      canvas.style.height = Math.floor(rawH * scale) + 'px';
      return;
    }
    const square = qs('.wb-ludo', box);
    if (square) {
      const isLudo = square.classList.contains('wb-ludo');
      const mobile = getHostWindow().matchMedia && getHostWindow().matchMedia('(max-width: 700px)').matches;
      const ludoInfo = isLudo ? qs('.wb-ludo-info', box) : null;
      const ludoInfoRect = ludoInfo ? ludoInfo.getBoundingClientRect() : null;
      const limitedH = isLudo ? Math.max(0, maxH - (ludoInfoRect ? ludoInfoRect.height + 12 : 0)) : maxH;
      const side = Math.floor(Math.min(maxW - (isLudo && mobile ? 12 : 0), limitedH, isLudo ? (mobile ? 310 : 460) : Infinity));
      square.style.width = side + 'px';
      if (isLudo) {
        square.style.height = side + 'px';
      }
    }
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
      #${FLOAT_ID} {
        position:fixed;
        left:18px;
        top:180px;
        width:54px;
        height:54px;
        z-index:999998;
        border:1px solid rgba(255,255,255,.75);
        border-radius:999px;
        background:url('${APP_ICON_URL}') center / cover no-repeat, linear-gradient(135deg, #ff7aa8, #6bc8ff);
        box-shadow:0 10px 26px rgba(0,0,0,.28), 0 0 0 3px rgba(255,255,255,.24);
        cursor:grab;
        touch-action:none;
        padding:0;
        outline:none;
      }
      #${FLOAT_ID}:hover { transform:translateY(-1px); box-shadow:0 14px 30px rgba(0,0,0,.32), 0 0 0 3px rgba(255,255,255,.32); }
      #${FLOAT_ID}.dragging { cursor:grabbing; transform:scale(.98); }
      @media (max-width: 768px) {
        #${FLOAT_ID} {
          width:36px;
          height:36px;
          box-shadow:0 8px 18px rgba(0,0,0,.26), 0 0 0 2px rgba(255,255,255,.24);
        }
      }
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
      @font-face { font-family: 'WanbanCyberPixel'; src: url('https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1759071282816_qdqqd_d815d3.ttf') format('truetype'); font-display:swap; }
      #${POPUP_ID}.wb-day { --wb-bg:#fff7fb; --wb-panel:#fffefd; --wb-soft:#ffeaf1; --wb-text:#2f2430; --wb-sub:#8a6470; --wb-border:#e8b9c5; --wb-accent:#c65b7c; --wb-accent2:#3a8f91; --wb-board:#fff2e6; --wb-input:#fff9fb; --wb-glow:rgba(198,91,124,.26); --wb-gold:#c99738; --wb-screen:#fff9f2; }
      #${POPUP_ID}.wb-spring { --wb-bg:#EAF6D4; --wb-panel:#F6E7C8; --wb-soft:#D8EDB2; --wb-text:#4C3B2A; --wb-sub:#7A6752; --wb-border:#BFA372; --wb-accent:#6FA85A; --wb-accent2:#7DB9D8; --wb-board:#E2F0BF; --wb-input:#F8EED6; --wb-glow:rgba(111,168,90,.24); --wb-gold:#E3C56A; --wb-screen:#F4F1D3; }
      #${POPUP_ID}.wb-night { --wb-bg:#11121d; --wb-panel:#191a28; --wb-soft:#252033; --wb-text:#f5eafa; --wb-sub:#bba8c7; --wb-border:#54425f; --wb-accent:#ff7aa8; --wb-accent2:#6ed6d1; --wb-board:#111827; --wb-input:#151620; --wb-glow:rgba(255,122,168,.28); --wb-gold:#f3c56a; --wb-screen:#111827; }
      #${POPUP_ID}.wb-cyber { --wb-bg:#0D1512; --wb-panel:#18231E; --wb-soft:#24352D; --wb-text:#F6F5DE; --wb-sub:#B9C4B8; --wb-border:#4C5B4A; --wb-accent:#F1E85B; --wb-accent2:#19D3C5; --wb-board:#101A1D; --wb-input:#14201B; --wb-glow:rgba(241,232,91,.22); --wb-gold:#FF8A3D; --wb-screen:#1A221D; }
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
      .wb-body.wb-swipe-enter-left { animation:wbSwipeEnterLeft .22s ease both; }
      .wb-body.wb-swipe-enter-right { animation:wbSwipeEnterRight .22s ease both; }
      @keyframes wbSwipeEnterLeft { from { opacity:.55; transform:translateX(22px); } to { opacity:1; transform:translateX(0); } }
      @keyframes wbSwipeEnterRight { from { opacity:.55; transform:translateX(-22px); } to { opacity:1; transform:translateX(0); } }
      .wb-body.wb-settings-mode { overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; max-height:calc(100dvh - 118px); min-height:0; padding-bottom:24px; }
      .wb-body.wb-game-mode { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; overflow:hidden; -webkit-overflow-scrolling:touch; height:auto; }
      .wb-body.wb-intimacy-mode { padding:0; overflow:hidden; display:grid; place-items:center; min-height:0; }
      .wb-intimacy-image { width:auto; height:70%; max-width:92%; max-height:92%; min-height:0; object-fit:contain; display:block; }
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
      .wb-snake-shell { width:100%; height:100%; min-width:0; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; }
      .wb-snake-controls { display:none; grid-template-columns:repeat(3, 42px); grid-template-rows:repeat(3, 34px); gap:5px; justify-content:center; flex:0 0 auto; }
      .wb-snake-controls .wb-btn { min-width:42px; min-height:34px; padding:4px; font-size:14px; line-height:1; }
      .wb-snake-controls .up { grid-column:2; grid-row:1; }
      .wb-snake-controls .left { grid-column:1; grid-row:2; }
      .wb-snake-controls .down { grid-column:2; grid-row:2; }
      .wb-snake-controls .right { grid-column:3; grid-row:2; }
      .wb-canvas.wb-tetris-canvas { aspect-ratio:1 / 2; max-height:min(100%, 100cqh); }
      .wb-canvas.wb-tetris-canvas { background:var(--wb-board); box-shadow:none; }
      .wb-jump-shell { position:relative; width:100%; height:100%; min-width:0; min-height:0; display:grid; place-items:center; }
      .wb-jump-canvas { aspect-ratio:13 / 16; max-height:min(100%, 100cqh); background:#e9f8ff; touch-action:none; }
      .wb-plank-shell { position:relative; width:100%; height:100%; min-width:0; min-height:0; display:grid; place-items:center; }
      .wb-plank-canvas { aspect-ratio:13 / 9; max-height:min(100%, 100cqh); background:#e9f8ff; touch-action:none; border:6px solid color-mix(in srgb, var(--wb-accent) 36%, #6b4328 64%); box-shadow:0 18px 36px rgba(74,49,31,.18), inset 0 0 0 2px rgba(255,255,255,.24); }
      #${POPUP_ID}.wb-night .wb-plank-canvas,
      #${POPUP_ID}.wb-cyber .wb-plank-canvas { border-color:color-mix(in srgb, var(--wb-accent) 70%, #101A1D 30%); box-shadow:0 0 24px rgba(25,211,197,.18), inset 0 0 0 2px rgba(241,232,91,.16); }
      .wb-jump-help { position:absolute; top:12px; left:50%; transform:translateX(-50%); z-index:2; padding:4px 10px; border:1px solid color-mix(in srgb, var(--wb-border) 70%, transparent 30%); background:color-mix(in srgb, var(--wb-panel) 82%, transparent 18%); color:var(--wb-sub); font-size:12px; font-weight:800; line-height:1.2; pointer-events:none; box-shadow:0 6px 16px rgba(0,0,0,.12); }
      #${POPUP_ID}.wb-night .wb-jump-canvas { background:#000; }
      #${POPUP_ID}.wb-cyber .wb-jump-help { border-color:rgba(25,211,197,.35); color:#F1E85B; box-shadow:0 0 14px rgba(25,211,197,.16); }
      .wb-tetris-shell { width:100%; height:100%; min-width:0; min-height:0; display:flex; align-items:center; justify-content:center; gap:8px; }
      .wb-tetris-controls { display:none; flex:0 0 auto; gap:6px; }
      .wb-tetris-controls .wb-btn { writing-mode:vertical-rl; min-width:34px; min-height:74px; padding:8px 5px; letter-spacing:1px; }
      .wb-2048-panel { width:100%; height:100%; min-height:0; display:grid; place-items:center; overflow:hidden; }
      .wb-grid2048 { width:min(430px, 100%, 82cqh); aspect-ratio:1 / 1; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); grid-template-rows:repeat(4,minmax(0,1fr)); gap:8px; background:#b8a89f; padding:8px; border-radius:0; box-sizing:border-box; }
      .wb-tile { display:grid; place-items:center; border-radius:0; background:#cdc0b6; font-weight:900; font-size:clamp(16px, 3.2vh, 26px); color:#4f4039; min-width:0; min-height:0; aspect-ratio:1; overflow:hidden; line-height:1; }
      .wb-board3-panel { width:100%; height:100%; min-height:0; display:grid; place-items:center; overflow:hidden; }
      .wb-board3 { width:min(430px, 100%, 82cqh); aspect-ratio:1 / 1; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); grid-template-rows:repeat(3,minmax(0,1fr)); gap:8px; box-sizing:border-box; }
      .wb-cell { border:1px solid var(--wb-border); border-radius:0; background:var(--wb-panel); color:var(--wb-text); font-size:clamp(30px, 6vh, 48px); font-weight:900; cursor:pointer; min-width:0; min-height:0; aspect-ratio:1; line-height:1; overflow:hidden; }
      .wb-gomoku-panel { width:100%; height:100%; min-height:0; display:grid; place-items:center; overflow:hidden; }
      .wb-gomoku { width:min(500px, 100%, 82cqh); aspect-ratio:1 / 1; display:grid; grid-template-columns:repeat(15,minmax(0,1fr)); grid-template-rows:repeat(15,minmax(0,1fr)); gap:2px; background:#ba9362; padding:7px; border-radius:0; box-sizing:border-box; }
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
      #${POPUP_ID}.wb-day .wb-territory-board { background:#fff1f5; }
      #${POPUP_ID}.wb-spring .wb-territory-board { background:#EAF6D4; }
      #${POPUP_ID}.wb-spring .wb-territory-dot { background:#4C3B2A; border-color:rgba(76,59,42,.28); }
      #${POPUP_ID}.wb-spring .wb-territory-cell { background:rgba(216,237,178,.42); border-color:rgba(111,168,90,.24); color:#4C3B2A; }
      #${POPUP_ID}.wb-spring .wb-territory-cell.user { background:rgba(111,168,90,.78); color:#fff; }
      #${POPUP_ID}.wb-spring .wb-territory-cell.ta { background:rgba(217,123,84,.78); color:#fff; }
      #${POPUP_ID}.wb-cyber .wb-territory-board { background:#101A1D; }
      #${POPUP_ID}.wb-cyber .wb-territory-dot { background:#F1E85B; border-color:rgba(25,211,197,.45); box-shadow:0 0 8px rgba(241,232,91,.38); }
      #${POPUP_ID}.wb-cyber .wb-territory-cell { background:rgba(25,211,197,.08); border-color:rgba(25,211,197,.18); color:#F6F5DE; }
      #${POPUP_ID}.wb-cyber .wb-territory-edge.user { background:#F1E85B; box-shadow:0 0 10px rgba(241,232,91,.32); }
      #${POPUP_ID}.wb-cyber .wb-territory-cell.user { background:rgba(241,232,91,.86); color:#0D1512; }
      #${POPUP_ID}.wb-cyber .wb-territory-cell.ta { background:rgba(255,79,163,.55); color:#F6F5DE; }
      .wb-oldmaid { width:100%; height:100%; min-height:0; display:grid; grid-template-rows:auto auto minmax(0, 1fr) minmax(0, 1fr) auto; gap:8px; align-items:stretch; }
      .wb-oldmaid-status { text-align:center; font-weight:800; color:var(--wb-text); }
      .wb-oldmaid-reveal { min-height:0; display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap; }
      .wb-oldmaid-reveal:empty { display:none; }
      .wb-oldmaid-reveal-text { color:var(--wb-sub); font-size:12px; font-weight:800; }
      .wb-oldmaid-zone { min-height:0; display:grid; grid-template-rows:auto minmax(0, 1fr); gap:6px; }
      .wb-oldmaid-hand { min-height:0; display:flex; flex-wrap:wrap; gap:8px; align-content:center; justify-content:center; overflow:auto; padding:6px; border:1px solid var(--wb-border); background:var(--wb-soft); }
      .wb-oldmaid-card { width:42px; height:58px; display:grid; place-items:center; border:1px solid var(--wb-border); border-radius:0; background:#fff; color:#111827; font-weight:900; font-size:17px; box-shadow:0 2px 8px rgba(15,23,42,.12); }
      .wb-oldmaid-card.big { width:54px; height:74px; font-size:22px; box-shadow:0 8px 20px rgba(15,23,42,.22); }
      .wb-oldmaid-card.back { cursor:pointer; color:transparent; font-size:0; background:url('${OLDMAID_BACK_URL}') center / 100% 100% no-repeat, #1f2937; overflow:hidden; }
      .wb-oldmaid-card.back:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 5px 14px rgba(15,23,42,.22); }
      .wb-oldmaid-card.back:disabled { opacity:.55; cursor:default; }
      .wb-oldmaid-card.joker { color:transparent; background:url('${OLDMAID_CARD_URL}') center / 100% 100% no-repeat, #1f2937; border-color:#111827; overflow:hidden; }
      .wb-oldmaid-log { min-height:34px; max-height:64px; overflow:auto; padding:7px 9px; border:1px solid var(--wb-border); color:var(--wb-muted); background:var(--wb-panel); font-size:12px; line-height:1.45; }
      .wb-text-segments { white-space:normal; line-height:1.75; }
      .wb-text-seg { margin:0 0 12px; }
      .wb-text-seg:last-child { margin-bottom:0; }
      .wb-text-segments h1, .wb-text-segments h2, .wb-text-segments h3, .wb-text-segments h4, .wb-text-segments h5, .wb-text-segments h6 { margin:10px 0 8px; color:var(--wb-accent); line-height:1.35; letter-spacing:0; }
      .wb-text-segments h1 { font-size:18px; }
      .wb-text-segments h2 { font-size:16px; }
      .wb-text-segments h3, .wb-text-segments h4, .wb-text-segments h5, .wb-text-segments h6 { font-size:14px; }
      .wb-text-segments ul { margin:0 0 12px 18px; padding:0; }
      .wb-text-segments li { margin:3px 0; }
      .wb-text-segments code { padding:1px 4px; border-radius:4px; background:color-mix(in srgb, var(--wb-border) 18%, transparent 82%); font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:.92em; }
      .wb-text-segments pre { margin:0 0 12px; padding:9px 10px; border:1px solid var(--wb-border); border-radius:6px; background:color-mix(in srgb, var(--wb-soft) 80%, #000 20%); overflow:auto; white-space:pre-wrap; }
      .wb-watermelon-canvas { aspect-ratio:4 / 5; max-height:min(100%, 100cqh); background:#f7efe3; }
      .wb-ludo-panel { width:100%; height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0, 1fr); gap:6px; place-items:center; overflow:hidden; }
      .wb-ludo { width:min(460px, 100%, calc(100cqh - 68px)); height:min(460px, 100%, calc(100cqh - 68px)); aspect-ratio:1 / 1; display:grid; grid-template-columns:repeat(11,minmax(0,1fr)); grid-template-rows:repeat(11,minmax(0,1fr)); gap:2px; background:#f4c8d6; padding:7px; border:1px solid rgba(174,82,115,.28); contain:layout size; box-sizing:border-box; }
      .wb-ludo-cell { position:relative; border:1px solid rgba(174,82,115,.13); background:#fff1f5; min-width:0; min-height:0; display:flex; flex-wrap:wrap; align-items:center; justify-content:center; align-content:center; gap:1px; font-size:10px; overflow:hidden; }
      .wb-ludo-cell.path { background:#fde7ee; }
      .wb-ludo-cell.home-red { background:#f7c4cf; }
      .wb-ludo-cell.home-blue { background:#e7d7f5; }
      .wb-ludo-piece { width:44%; height:auto; aspect-ratio:1 / 1; min-width:14px; max-width:22px; padding:0; border-radius:50%; border:1px solid rgba(0,0,0,.28); display:grid; place-items:center; color:#fff; font-size:11px; line-height:1; text-align:center; font-weight:900; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,.22); flex:0 0 auto; }
      .wb-ludo-piece:only-child { width:60%; max-width:24px; }
      .wb-ludo-piece.red { background:#d84b42; }
      .wb-ludo-piece.blue { background:#2773c8; }
      .wb-ludo-piece.can { outline:2px solid var(--wb-accent); outline-offset:2px; }
      .wb-ludo-info { display:flex; gap:6px; align-items:center; justify-content:center; flex-wrap:wrap; margin:0; }
      .wb-ludo-dice { width:38px; height:38px; padding:4px; box-sizing:border-box; display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr); place-items:center; border:1px solid var(--wb-border); border-radius:8px; background:#fffdf8; box-shadow:0 2px 8px rgba(15,23,42,.14), inset 0 0 0 1px rgba(255,255,255,.8); }
      .wb-ludo-dice.rolling { animation:wbDicePulse .18s linear infinite; }
      .wb-ludo-dot { width:6px; height:6px; border-radius:50%; background:#28313f; box-shadow:inset 0 1px 1px rgba(255,255,255,.2); }
      .wb-ludo-dice.one .wb-ludo-dot { width:12px; height:12px; background:#d84b42; }
      @keyframes wbDicePulse { 0% { transform:rotate(-5deg) scale(1); } 50% { transform:rotate(5deg) scale(1.08); } 100% { transform:rotate(-5deg) scale(1); } }
      .wb-gcell { border:0; border-radius:50%; background:#d7b37c; cursor:pointer; min-width:0; min-height:0; aspect-ratio:1; overflow:hidden; }
      .wb-gcell.black { background:#222; box-shadow:inset 0 0 0 2px #000; }
      .wb-gcell.white { background:#f7f2e9; box-shadow:inset 0 0 0 2px #ddd; }
      .wb-memory-panel { width:100%; height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0, 1fr); gap:8px; justify-items:center; align-items:center; align-content:stretch; overflow:hidden; }
      .wb-memory-panel .wb-guess-row { align-self:start; justify-content:center; }
      .wb-memory { width:min(420px, 100%, calc(100cqh - 54px)); height:auto; max-width:100%; aspect-ratio:1 / 1; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); grid-template-rows:repeat(4,minmax(0,1fr)); gap:10px; padding:6px; box-sizing:border-box; contain:layout size; align-self:center; justify-self:center; }
      .wb-memory-card { position:relative; border:0; background:transparent; color:var(--wb-accent); font-size:clamp(22px,5vh,36px); font-weight:900; display:block; width:100%; height:100%; cursor:pointer; min-width:0; min-height:0; aspect-ratio:1 / 1; padding:0; overflow:hidden; perspective:800px; transition:.16s transform,.16s opacity; }
      .wb-memory-card.open .wb-memory-inner { transform:rotateY(180deg); }
      .wb-memory-card.done { opacity:0; pointer-events:none; transform:scale(.86); }
      .wb-memory-inner { position:absolute; inset:0; transform-style:preserve-3d; transition:transform .42s cubic-bezier(.2,.75,.2,1); }
      .wb-memory-face { position:absolute; inset:0; display:grid; place-items:center; overflow:hidden; border:1px solid var(--wb-border); border-radius:6px; backface-visibility:hidden; box-shadow:0 4px 10px rgba(0,0,0,.12); }
      .wb-memory-back { background:url('${MEMORY_CARD_URL}') center / 100% 100% no-repeat, var(--wb-panel); }
      .wb-memory-back::after { content:''; display:none; }
      .wb-memory-front { background:var(--wb-panel); transform:rotateY(180deg); box-shadow:inset 0 0 0 2px var(--wb-accent2), 0 4px 10px rgba(0,0,0,.12); }
      .wb-memory-img { width:100%; height:100%; object-fit:contain; display:block; background:#000; }
      .wb-sudoku-panel { width:min(100%, 520px); height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr) auto auto; gap:8px; place-items:center; overflow:hidden; box-sizing:border-box; padding:0 6px; justify-self:center; }
      .wb-sudoku-top { width:100%; min-width:0; display:flex; justify-content:space-between; align-items:center; gap:8px; }
      .wb-sudoku { width:min(430px, 100%, 68vh); height:min(430px, 100%, 68vh); aspect-ratio:1 / 1; display:grid; grid-template-columns:repeat(9,minmax(0,1fr)); grid-template-rows:repeat(9,minmax(0,1fr)); border:3px solid var(--wb-text); background:var(--wb-text); gap:0; box-sizing:border-box; contain:layout size; }
      .wb-sudoku-cell { min-width:0; min-height:0; width:100%; height:100%; aspect-ratio:1 / 1; border:1px solid var(--wb-border); background:var(--wb-panel); color:var(--wb-text); font-weight:900; font-size:clamp(16px, 3.2vh, 24px); padding:0; box-sizing:border-box; line-height:1; display:grid; place-items:center; }
      .wb-sudoku-cell.box-l { border-left:2px solid var(--wb-text); }
      .wb-sudoku-cell.box-r { border-right:2px solid var(--wb-text); }
      .wb-sudoku-cell.box-t { border-top:2px solid var(--wb-text); }
      .wb-sudoku-cell.box-b { border-bottom:2px solid var(--wb-text); }
      .wb-sudoku-cell.fixed { background:var(--wb-soft); color:var(--wb-accent); cursor:pointer; }
      .wb-sudoku-cell.mutable { cursor:pointer; }
      .wb-sudoku-cell.peer { background:color-mix(in srgb, var(--wb-accent2) 10%, var(--wb-panel) 90%); }
      .wb-sudoku-cell.fixed.peer { background:color-mix(in srgb, var(--wb-accent2) 22%, var(--wb-soft) 78%); }
      .wb-sudoku-cell.fixed.same { background:color-mix(in srgb, var(--wb-gold) 46%, var(--wb-soft) 54%); color:var(--wb-text); }
      .wb-sudoku-cell.sel { outline:2px solid var(--wb-accent); z-index:1; }
      .wb-sudoku-cell.wrong { color:#ef4444; box-shadow:inset 0 0 0 2px #ef4444; }
      .wb-sudoku-nums { width:100%; min-width:0; display:grid; grid-template-columns:repeat(9,minmax(0,1fr)); gap:3px; }
      .wb-sudoku-nums .wb-btn { min-width:0; padding:6px 0; }
      .wb-sudoku-tools { justify-content:center; }
      .wb-sudoku-badge { display:inline-grid; place-items:center; min-width:18px; height:18px; margin-left:4px; padding:0 4px; border-radius:999px; background:rgba(255,255,255,.35); color:inherit; font-size:11px; font-weight:900; line-height:1; }
      .wb-reversi-panel, .wb-c4d-panel { width:100%; height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr) auto; gap:8px; place-items:center; overflow:hidden; }
      .wb-bomb-panel { width:100%; height:100%; min-height:0; display:grid; grid-template-rows:28px minmax(0,1fr) 54px; gap:8px; place-items:center; overflow:hidden; }
      .wb-bomb-info { min-height:28px; display:flex; align-items:center; justify-content:center; text-align:center; font-weight:800; color:var(--wb-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
      .wb-reversi { width:min(430px, 100%, 82cqh); aspect-ratio:1 / 1; display:grid; grid-template-columns:repeat(8,1fr); grid-template-rows:repeat(8,1fr); gap:2px; padding:6px; background:#276749; border:2px solid var(--wb-border); }
      .wb-reversi-cell { min-width:0; min-height:0; border:1px solid rgba(0,0,0,.18); background:#348a61; display:grid; place-items:center; padding:0; }
      .wb-reversi-cell span { width:74%; height:74%; border-radius:50%; display:block; box-shadow:0 2px 6px rgba(0,0,0,.28); }
      .wb-reversi-cell.user span { background:#f8fafc; }
      .wb-reversi-cell.ta span { background:#111827; }
      .wb-reversi-cell.legal::after { content:''; width:28%; height:28%; border-radius:50%; background:rgba(255,255,255,.45); }
      .wb-bomb-grid { width:min(520px, 100%, 78cqh); aspect-ratio:1 / 1; display:grid; grid-template-columns:repeat(10,1fr); gap:3px; align-self:center; justify-self:center; }
      .wb-bomb-cell { min-width:0; min-height:0; padding:0; border:1px solid var(--wb-border); background:var(--wb-panel); color:var(--wb-text); font-weight:800; font-size:clamp(10px,2.2cqh,16px); }
      .wb-bomb-cell.ok { background:color-mix(in srgb, var(--wb-accent2) 20%, var(--wb-panel) 80%); cursor:pointer; }
      .wb-bomb-cell.off { opacity:.28; }
      .wb-bomb-cell.chosen { transform:scale(1.08); background:color-mix(in srgb, var(--wb-gold) 62%, var(--wb-panel) 38%); color:var(--wb-text); box-shadow:0 0 0 2px var(--wb-gold), 0 0 16px rgba(255,196,79,.45); z-index:2; }
      .wb-bomb-cell.boom { transform:scale(1.16); background:#ef4444; color:#fff; box-shadow:0 0 0 3px rgba(255,255,255,.7), 0 0 26px rgba(239,68,68,.75); animation:wb-bomb-pop .55s ease-in-out infinite alternate; z-index:3; }
      .wb-bomb-cell.boom { font-size:clamp(20px,4.6cqh,34px); }
      .wb-bomb-cell.chosen, .wb-bomb-cell.boom { position:relative; transition:transform .18s ease, background .18s ease, box-shadow .18s ease; }
      @keyframes wb-bomb-pop { from { filter:brightness(1); } to { filter:brightness(1.28); } }
      .wb-bomb-log { width:min(520px,100%); height:54px; overflow:auto; color:var(--wb-sub); font-size:12px; line-height:1.4; box-sizing:border-box; }
      .wb-c4d-mask { width:min(460px,100%,66cqh); max-height:100%; aspect-ratio:1 / .95; display:grid; place-items:center; border:0; border-radius:0; background:linear-gradient(180deg, color-mix(in srgb, var(--wb-board) 76%, transparent 24%), color-mix(in srgb, var(--wb-soft) 66%, transparent 34%)); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--wb-border) 48%, transparent 52%); overflow:hidden; }
      .wb-c4d-stage { position:relative; width:84%; aspect-ratio:1 / 1.12; display:grid; grid-template-rows:12% 1fr 5%; align-items:stretch; }
      .wb-c4d-drop-line { position:absolute; left:0; right:0; top:8%; border-top:2px dashed color-mix(in srgb, var(--wb-accent) 70%, transparent 30%); opacity:.82; pointer-events:none; }
      .wb-c4d-drop-line::after { content:'投放线'; position:absolute; right:0; top:-18px; font-size:11px; color:var(--wb-sub); font-weight:800; }
      .wb-c4d { grid-row:2; width:100%; aspect-ratio:1 / 1; display:grid; grid-template-columns:repeat(7,1fr); grid-template-rows:repeat(7,1fr); gap:3px; align-self:end; padding:5px; box-sizing:border-box; background:linear-gradient(135deg, color-mix(in srgb, var(--wb-soft) 70%, transparent 30%), color-mix(in srgb, var(--wb-board) 86%, transparent 14%)); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--wb-border) 52%, transparent 48%); }
      .wb-c4d-stage::after { content:''; grid-row:3; display:block; width:100%; height:100%; background:linear-gradient(180deg, color-mix(in srgb, var(--wb-border) 45%, transparent 55%), color-mix(in srgb, var(--wb-board) 88%, transparent 12%)); box-shadow:inset 0 1px 0 rgba(255,255,255,.16); }
      .wb-c4d-cell { position:relative; min-width:0; min-height:0; border:1px solid color-mix(in srgb, var(--wb-border) 64%, transparent 36%); border-radius:8px; background:radial-gradient(circle at 50% 42%, rgba(255,255,255,.18), transparent 38%), color-mix(in srgb, var(--wb-panel) 70%, var(--wb-board) 30%); padding:2px; display:grid; place-items:center; cursor:pointer; overflow:hidden; }
      .wb-c4d-cell.full { opacity:.72; cursor:default; }
      .wb-c4d-cell.aim { outline:3px solid var(--wb-gold); outline-offset:-3px; filter:brightness(1.08); }
      .wb-c4d-disc, .wb-c4d-falling { width:68%; aspect-ratio:1 / 1; border-radius:50%; border:1px solid rgba(0,0,0,.22); display:block; }
      .wb-c4d-disc.user, .wb-c4d-falling.user { background:#f8fafc; box-shadow:0 3px 8px rgba(0,0,0,.24), inset 0 2px 3px rgba(255,255,255,.72); }
      .wb-c4d-disc.ta, .wb-c4d-falling.ta { background:#ef6f91; box-shadow:0 3px 8px rgba(0,0,0,.24), inset 0 2px 3px rgba(255,255,255,.35); }
      .wb-c4d-falling { position:absolute; z-index:4; width:26px; height:26px; border-radius:50%; pointer-events:none; transition:none; }
      .wb-guess-panel { width:min(560px,100%); max-height:100%; min-height:0; display:grid; gap:10px; align-content:start; overflow:hidden; }
      .wb-guess-panel.wb-memory-panel { width:100%; height:100%; grid-template-rows:auto minmax(0, 1fr); gap:8px; justify-items:center; align-items:center; align-content:stretch; }
      .wb-number-guess { grid-template-rows:auto auto auto auto minmax(0, 1fr); }
      .wb-guess-title { font-size:18px; font-weight:900; color:var(--wb-accent); }
      .wb-guess-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
      .wb-num-keypad { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:6px; }
      .wb-num-keypad .wb-btn { min-width:0; padding:6px 4px; font-size:15px; }
      .wb-guess-history { min-height:0; max-height:min(260px, calc(100dvh - 360px)); overflow-y:auto; display:grid; gap:6px; padding:8px; background:var(--wb-soft); border:1px solid var(--wb-border); }
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
      .wb-title-row { display:inline-flex; align-items:center; gap:3px; min-width:0; max-width:100%; vertical-align:middle; }
      .wb-game-title-text { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .wb-rule-btn { flex:0 0 auto; width:20px; min-width:20px; height:20px; min-height:20px; padding:0; border:0; background:transparent; box-shadow:none; border-radius:50%; font-size:15px; line-height:1; display:inline-grid; place-items:center; }
      .wb-rule-btn:hover { background:color-mix(in srgb, var(--wb-soft) 55%, transparent 45%); transform:none; }
      .wb-sticky-actions { position:sticky; bottom:-18px; z-index:3; margin:12px -22px -18px; padding:10px 22px; background:linear-gradient(180deg, color-mix(in srgb, var(--wb-panel) 70%, transparent 30%), var(--wb-panel)); border-top:1px solid var(--wb-border); }
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
      .wb-modal-mask.wb-spring { --wb-bg:#EAF6D4; --wb-panel:#F6E7C8; --wb-soft:#D8EDB2; --wb-text:#4C3B2A; --wb-sub:#7A6752; --wb-border:#BFA372; --wb-accent:#6FA85A; --wb-accent2:#7DB9D8; --wb-board:#E2F0BF; --wb-input:#F8EED6; --wb-glow:rgba(111,168,90,.24); --wb-gold:#E3C56A; --wb-screen:#F4F1D3; }
      .wb-modal-mask.wb-cyber { --wb-bg:#0D1512; --wb-panel:#18231E; --wb-soft:#24352D; --wb-text:#F6F5DE; --wb-sub:#B9C4B8; --wb-border:#4C5B4A; --wb-accent:#F1E85B; --wb-accent2:#19D3C5; --wb-board:#101A1D; --wb-input:#14201B; --wb-glow:rgba(241,232,91,.22); --wb-gold:#FF8A3D; --wb-screen:#1A221D; }
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
      #${POPUP_ID}.wb-spring {
        font-family:'WanbanCyberPixel','Microsoft YaHei',system-ui,sans-serif;
        letter-spacing:0;
        background:
          linear-gradient(145deg, rgba(255,255,255,.36), rgba(216,237,178,.42)),
          repeating-linear-gradient(90deg, rgba(122,103,82,.05) 0 3px, transparent 3px 12px),
          var(--wb-bg);
        box-shadow:0 28px 80px rgba(76,59,42,.22), 0 0 0 1px rgba(255,255,255,.32) inset, 0 0 44px rgba(111,168,90,.18);
      }
      #${POPUP_ID}.wb-cyber {
        font-family:'WanbanCyberPixel','Microsoft YaHei',system-ui,sans-serif;
        letter-spacing:0;
        background:
          linear-gradient(145deg, #0D1512 0%, #18231E 48%, #101A1D 100%),
          var(--wb-bg);
        box-shadow:0 30px 90px rgba(0,0,0,.70), 0 0 0 1px rgba(25,211,197,.16) inset, 0 0 54px rgba(241,232,91,.16);
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
      #${POPUP_ID}.wb-spring .wb-head {
        background:
          repeating-linear-gradient(90deg, rgba(76,59,42,.06) 0 4px, transparent 4px 14px),
          linear-gradient(180deg, rgba(255,255,255,.40), rgba(246,231,200,.36)),
          var(--wb-panel);
      }
      #${POPUP_ID}.wb-cyber .wb-head {
        background:
          linear-gradient(90deg, rgba(25,211,197,.16), rgba(241,232,91,.08) 42%, rgba(255,79,163,.12)),
          var(--wb-panel);
        box-shadow:0 1px 0 rgba(241,232,91,.22) inset;
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
      #${POPUP_ID}.wb-cyber .wb-iconbtn, #${POPUP_ID}.wb-cyber .wb-btn {
        background:linear-gradient(180deg, rgba(241,232,91,.14), rgba(25,211,197,.06)), var(--wb-panel);
        color:var(--wb-text);
        box-shadow:0 0 14px rgba(25,211,197,.12), 0 1px 0 rgba(241,232,91,.18) inset;
      }
      #${POPUP_ID}.wb-cyber .wb-btn.primary,
      #${POPUP_ID}.wb-cyber .wb-tab.active {
        color:#0D1512;
        text-shadow:0 1px 0 rgba(255,255,255,.22);
      }
      .wb-btn:hover, .wb-iconbtn:hover, .wb-tab:hover { transform:translateY(-1px); filter:brightness(1.04); }
      .wb-btn.primary {
        background:linear-gradient(135deg, var(--wb-accent), color-mix(in srgb, var(--wb-accent) 54%, var(--wb-accent2) 46%));
        border-color:color-mix(in srgb, var(--wb-accent) 76%, #fff 24%);
        color:#fff;
        box-shadow:0 12px 24px var(--wb-glow), 0 1px 0 rgba(255,255,255,.34) inset;
      }
      #${POPUP_ID}.wb-cyber .wb-btn.primary,
      #${POPUP_ID}.wb-cyber .wb-tab.active {
        background:linear-gradient(135deg, #F1E85B, #FF8A3D);
        border-color:#F6F5DE;
        color:#0D1512;
        box-shadow:0 0 18px rgba(241,232,91,.26), 0 1px 0 rgba(255,255,255,.42) inset;
        text-shadow:0 1px 0 rgba(255,255,255,.24);
      }
      .wb-modal-mask.wb-cyber .wb-btn.primary,
      .wb-modal-mask.wb-cyber .wb-tab.active {
        background:linear-gradient(135deg, #F1E85B, #FF8A3D);
        border-color:#F6F5DE;
        color:#0D1512;
        box-shadow:0 0 18px rgba(241,232,91,.26), 0 1px 0 rgba(255,255,255,.42) inset;
        text-shadow:0 1px 0 rgba(255,255,255,.24);
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
      #${POPUP_ID}.wb-spring .wb-game-card {
        background:
          linear-gradient(145deg, rgba(255,255,255,.46), rgba(216,237,178,.30) 58%, rgba(246,231,200,.52)),
          var(--wb-panel);
      }
      #${POPUP_ID}.wb-cyber .wb-game-card {
        background:linear-gradient(145deg, rgba(255,255,255,.045), rgba(255,255,255,.02)), var(--wb-panel);
        border-color:#4C5B4A;
        box-shadow:0 16px 34px rgba(0,0,0,.34), 0 0 0 1px rgba(25,211,197,.06) inset;
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
      #${POPUP_ID}.wb-spring .wb-panel {
        background:
          repeating-linear-gradient(90deg, rgba(76,59,42,.04) 0 3px, transparent 3px 16px),
          linear-gradient(180deg, rgba(255,255,255,.36), rgba(246,231,200,.42)),
          var(--wb-panel);
      }
      #${POPUP_ID}.wb-cyber .wb-panel {
        background:linear-gradient(180deg, rgba(25,211,197,.07), rgba(241,232,91,.025)), var(--wb-panel);
        box-shadow:0 14px 34px rgba(0,0,0,.32), 0 0 0 1px rgba(25,211,197,.08) inset;
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
        background:linear-gradient(135deg, #130d18, #1d1224 55%, #120b17);
        box-shadow:0 18px 38px rgba(0,0,0,.34) inset, 0 0 24px rgba(244,194,215,.07);
      }
      #${POPUP_ID}.wb-spring .wb-board-wrap {
        background:
          linear-gradient(135deg, #F6E7C8, #D8EDB2);
        border-color:#BFA372;
        box-shadow:0 16px 34px rgba(76,59,42,.12) inset;
      }
      #${POPUP_ID}.wb-cyber .wb-board-wrap {
        background:
          linear-gradient(135deg, rgba(25,211,197,.08), rgba(241,232,91,.05)),
          #101A1D;
        border-color:#4C5B4A;
        box-shadow:0 0 0 1px rgba(25,211,197,.20) inset, 0 0 24px rgba(25,211,197,.12), 0 18px 38px rgba(0,0,0,.40) inset;
      }
      #${POPUP_ID}.wb-spring :is(.wb-canvas,.wb-ludo,.wb-territory-board) {
        border:7px solid #9E7846;
        border-color:#B98A54 #6F4F2C #6F4F2C #C99A5F;
        box-shadow:0 0 0 2px rgba(255,246,220,.55) inset, 0 10px 22px rgba(76,59,42,.20);
      }
      #${POPUP_ID}.wb-cyber :is(.wb-canvas,.wb-ludo,.wb-territory-board) {
        border:4px solid #4C5B4A;
        border-image:linear-gradient(135deg, #F1E85B, #19D3C5 38%, #8B6BFF 68%, #FF4FA3) 1;
        box-shadow:0 0 0 2px rgba(241,232,91,.10) inset, 0 0 18px rgba(25,211,197,.18), 0 0 28px rgba(241,232,91,.10);
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
      .wb-ludo { border-radius:8px; background-image:linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.15) 75%), linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.15) 75%); background-position:0 0, 10px 10px; background-size:20px 20px; }
      #${POPUP_ID}.wb-night .wb-ludo { background-color:#241429; border-color:rgba(244,194,215,.20); }
      #${POPUP_ID}.wb-night .wb-ludo-cell { background:#1b1020; border-color:rgba(244,194,215,.10); }
      #${POPUP_ID}.wb-night .wb-ludo-cell.path { background:#2b1830; }
      #${POPUP_ID}.wb-night .wb-ludo-cell.home-red { background:#3a1c2a; }
      #${POPUP_ID}.wb-night .wb-ludo-cell.home-blue { background:#241d3a; }
      #${POPUP_ID}.wb-spring .wb-ludo { background-color:#B98A54; border-color:#6F4F2C; }
      #${POPUP_ID}.wb-spring .wb-ludo-cell { background:#F6E7C8; border-color:rgba(76,59,42,.18); }
      #${POPUP_ID}.wb-spring .wb-ludo-cell.path { background:#D8EDB2; }
      #${POPUP_ID}.wb-spring .wb-ludo-cell.home-red { background:#E3C56A; }
      #${POPUP_ID}.wb-spring .wb-ludo-cell.home-blue { background:#BDE0E9; }
      #${POPUP_ID}.wb-cyber .wb-ludo { background-color:#101A1D; border-color:#4C5B4A; box-shadow:0 0 18px rgba(25,211,197,.14); }
      #${POPUP_ID}.wb-cyber .wb-ludo-cell { background:#14201B; border-color:rgba(25,211,197,.16); }
      #${POPUP_ID}.wb-cyber .wb-ludo-cell.path { background:#24352D; }
      #${POPUP_ID}.wb-cyber .wb-ludo-cell.home-red { background:rgba(255,79,163,.20); }
      #${POPUP_ID}.wb-cyber .wb-ludo-cell.home-blue { background:rgba(25,211,197,.18); }
      #${POPUP_ID}.wb-spring :is(.wb-canvas,.wb-ludo,.wb-territory-board) {
        border:7px solid #9E7846;
        border-color:#B98A54 #6F4F2C #6F4F2C #C99A5F;
        box-shadow:0 0 0 2px rgba(255,246,220,.55) inset, 0 10px 22px rgba(76,59,42,.20);
      }
      #${POPUP_ID}.wb-cyber :is(.wb-canvas,.wb-ludo,.wb-territory-board) {
        border:4px solid #4C5B4A;
        border-image:linear-gradient(135deg, #F1E85B, #19D3C5 38%, #8B6BFF 68%, #FF4FA3) 1;
        box-shadow:0 0 0 2px rgba(241,232,91,.10) inset, 0 0 18px rgba(25,211,197,.18), 0 0 28px rgba(241,232,91,.10);
      }
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
      #${POPUP_ID}.wb-night .wb-side-companion { background:linear-gradient(155deg, #211a32, #162530 72%); border-color:rgba(110,214,209,.26); box-shadow:0 14px 34px rgba(0,0,0,.30), 0 0 22px rgba(110,214,209,.07) inset; }
      #${POPUP_ID}.wb-night .wb-companion.on { background:linear-gradient(135deg, rgba(55,38,70,.92), rgba(25,55,64,.84)); border-top-color:rgba(110,214,209,.55); }
      #${POPUP_ID}.wb-night .wb-speech { background:rgba(13,19,32,.72); border:1px solid rgba(110,214,209,.18); color:#f5eafa; }
      #${POPUP_ID}.wb-night .wb-comp-name { color:#f3c56a; }
      #${POPUP_ID}.wb-spring .wb-side-companion { background:linear-gradient(155deg, #D8EDB2, #BFDFA0 72%); border-color:rgba(111,168,90,.34); box-shadow:0 14px 30px rgba(76,59,42,.14), 0 1px 0 rgba(255,255,255,.42) inset; }
      #${POPUP_ID}.wb-spring .wb-companion.on { background:linear-gradient(135deg, rgba(255,248,220,.88), rgba(199,225,160,.78)); border-top-color:rgba(217,123,84,.58); box-shadow:0 10px 22px rgba(76,59,42,.12), 0 1px 0 rgba(255,255,255,.55) inset; }
      #${POPUP_ID}.wb-spring .wb-speech { background:rgba(255,248,220,.70); border:1px solid rgba(111,168,90,.24); color:#4C3B2A; }
      #${POPUP_ID}.wb-spring .wb-comp-name { color:#D97B54; }
      #${POPUP_ID}.wb-cyber .wb-side-companion { background:linear-gradient(155deg, #24152e, #171a32 72%); border-color:rgba(255,79,163,.34); box-shadow:0 14px 34px rgba(0,0,0,.36), 0 0 24px rgba(255,79,163,.10) inset; }
      #${POPUP_ID}.wb-cyber .wb-companion.on { background:linear-gradient(135deg, rgba(255,79,163,.18), rgba(139,107,255,.16)), #171a32; border-top-color:rgba(255,79,163,.68); box-shadow:0 0 22px rgba(255,79,163,.12), 0 1px 0 rgba(255,255,255,.08) inset; }
      #${POPUP_ID}.wb-cyber .wb-speech { background:rgba(255,79,163,.10); border:1px solid rgba(255,79,163,.24); color:#F6F5DE; }
      #${POPUP_ID}.wb-cyber .wb-comp-name { color:#FF8A3D; }
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
      .wb-record-table-wrap { max-height:min(620px, calc(100dvh - 170px)); overflow:auto; border:1px solid var(--wb-border); }
      .wb-record-table { width:100%; border-collapse:collapse; font-size:11px; table-layout:fixed; }
      .wb-record-table th, .wb-record-table td { border-bottom:1px solid var(--wb-border); padding:5px 6px; text-align:left; vertical-align:middle; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
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
      .wb-section-title.no-mark::before { content:''; }
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
        .wb-tabs { width:100%; display:grid; grid-template-columns:repeat(4,1fr); grid-column:1 / 3; grid-row:2; }
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
        .wb-body.wb-game-mode > .wb-layout.no-companion > .wb-panel:first-child { max-height:none; padding:4px; }
        .wb-board-wrap { flex:1 1 0; height:auto; min-height:0; padding:4px; overflow:hidden; }
        .wb-toolbar { flex-shrink:0; display:grid; grid-template-columns:auto minmax(0,1fr); grid-template-rows:auto auto; gap:3px 5px; margin-bottom:3px; align-items:center; padding:3px; border:1px solid color-mix(in srgb, var(--wb-border) 70%, transparent 30%); border-radius:2px; background:color-mix(in srgb, var(--wb-soft) 72%, var(--wb-panel) 28%); }
        .wb-stat { grid-column:2; grid-row:1; min-width:0; gap:6px; flex-wrap:nowrap; overflow:hidden; align-items:center; }
        .wb-stat .wb-pill { border:0; background:transparent; box-shadow:none; padding:0; font-size:12px; line-height:1.2; }
        .wb-stat .wb-pill:first-child { font-size:13px; font-weight:900; color:var(--wb-text); max-width:56%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-left:3px; }
        .wb-stat .wb-title-row { min-width:0; }
        .wb-stat .wb-game-title-text { padding-left:1px; }
        .wb-stat #wb-high { display:none; }
        .wb-toolbar > .wb-actions { grid-column:1 / 3; grid-row:2; width:100%; min-width:0; display:flex; flex-wrap:nowrap; gap:4px; overflow-x:auto; padding-bottom:0; scrollbar-width:none; justify-content:flex-start; }
        .wb-toolbar > .wb-actions::-webkit-scrollbar { display:none; }
        .wb-line-tools { flex:1 1 auto; min-width:136px; display:flex; flex-wrap:nowrap; gap:4px; width:auto; }
        .wb-line-tools .wb-select { flex:1 1 auto; min-width:74px; max-width:140px; height:26px; font-size:11px; padding:2px 5px; }
        .wb-btn { min-height:25px; padding:3px 7px; font-size:11px; border-radius:3px; white-space:nowrap; background:linear-gradient(180deg, var(--wb-panel), color-mix(in srgb, var(--wb-soft) 70%, var(--wb-panel) 30%)); box-shadow:0 1px 0 rgba(255,255,255,.28) inset; }
        .wb-btn.primary { background:linear-gradient(135deg, var(--wb-accent), var(--wb-accent2)); box-shadow:0 6px 14px var(--wb-glow); }
        #wb-back { grid-column:1; grid-row:1; width:auto; min-width:40px; min-height:25px; padding:2px 7px; display:grid; place-items:center; font-size:12px; border-radius:2px; }
        #wb-generate-lines { min-width:44px; }
        .wb-pill { padding:3px 5px; font-size:10px; }
        .wb-record-table-wrap { width:100%; border:1px solid var(--wb-border); max-height:calc(100dvh - 104px); overflow-y:auto; overflow-x:hidden; }
        .wb-record-modal { width:100vw!important; max-width:100vw!important; height:calc(100dvh - 12px); max-height:calc(100dvh - 12px); padding:8px 4px; display:flex; flex-direction:column; box-sizing:border-box; }
        .wb-record-modal .wb-record-table-wrap { flex:1 1 auto; min-height:0; }
        .wb-record-table { display:table; width:100%; min-width:0; table-layout:fixed; font-size:9px; }
        .wb-record-table thead { display:table-header-group; }
        .wb-record-table tbody { display:table-row-group; }
        .wb-record-table tr { display:table-row; margin:0; padding:0; border:0; background:transparent; box-shadow:none; }
        .wb-record-table th, .wb-record-table td { display:table-cell; padding:3px 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:none; line-height:1.25; }
        .wb-record-table th:nth-child(1), .wb-record-table td:nth-child(1) { width:20%; }
        .wb-record-table th:nth-child(2), .wb-record-table td:nth-child(2) { width:10%; }
        .wb-record-table th:nth-child(3), .wb-record-table td:nth-child(3) { width:11%; }
        .wb-record-table th:nth-child(4), .wb-record-table td:nth-child(4) { width:10%; }
        .wb-record-table th:nth-child(5), .wb-record-table td:nth-child(5) { width:13%; }
        .wb-record-table th:nth-child(6), .wb-record-table td:nth-child(6) { width:14%; }
        .wb-record-table th:nth-child(7), .wb-record-table td:nth-child(7) { width:10%; }
        .wb-record-table th:nth-child(8), .wb-record-table td:nth-child(8) { width:12%; }
        .wb-record-table td::before { content:none; }
        .wb-record-table .wb-actions { justify-content:flex-start; gap:2px; flex-wrap:nowrap; }
        .wb-record-table .wb-btn { min-height:22px; padding:2px 4px; border-radius:5px; font-size:9px; }
        .wb-record-modal > .wb-actions { margin-top:6px!important; gap:4px; }
        .wb-record-modal > .wb-actions .wb-btn { min-height:26px; padding:4px 7px; font-size:11px; }
        .wb-record-modal > .wb-actions .wb-pill { padding:4px 6px; font-size:11px; }
        .wb-grid2048, .wb-board3 { width:min(100%, 50dvh, 340px); }
        .wb-memory { width:min(100%, 48dvh, 320px); height:min(100%, 48dvh, 320px); gap:6px; padding:4px; }
        .wb-gomoku, .wb-territory-board { width:min(100%, 52dvh, 360px); }
        .wb-ludo { width:min(calc(100% - 12px), 46dvh, 310px); height:min(calc(100% - 12px), 46dvh, 310px); padding:5px; gap:1px; justify-self:center; align-self:center; }
        .wb-ludo-piece { min-width:12px; max-width:19px; font-size:10px; }
        .wb-ludo-piece:only-child { max-width:21px; }
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
  function clampFloatingBallPosition(x, y) {
    const win = getHostWindow();
    const doc = getHostDocument();
    const vw = win.innerWidth || doc.documentElement.clientWidth || 800;
    const vh = win.innerHeight || doc.documentElement.clientHeight || 700;
    const size = vw <= 768 ? 36 : 54;
    const margin = 8;
    const nx = Number.isFinite(Number(x)) ? Number(x) : DEFAULT_SETTINGS.floatingBallX;
    const ny = Number.isFinite(Number(y)) ? Number(y) : DEFAULT_SETTINGS.floatingBallY;
    return {
      x: Math.max(margin, Math.min(nx, Math.max(margin, vw - size - margin))),
      y: Math.max(margin, Math.min(ny, Math.max(margin, vh - size - margin)))
    };
  }
  function placeFloatingBall(btn, x, y) {
    if (!btn) return;
    const pos = clampFloatingBallPosition(x, y);
    btn.style.left = pos.x + 'px';
    btn.style.top = pos.y + 'px';
    btn.style.right = 'auto';
    btn.style.bottom = 'auto';
  }
  function bindFloatingBall(btn) {
    if (!btn || btn.dataset.wbBound) return;
    btn.dataset.wbBound = '1';
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    btn.addEventListener('pointerdown', e => {
      if (e.button != null && e.button !== 0) return;
      const rect = btn.getBoundingClientRect();
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      originX = rect.left;
      originY = rect.top;
      btn.classList.add('dragging');
      try { btn.setPointerCapture(e.pointerId); } catch(e2) {}
      e.preventDefault();
    });
    btn.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      placeFloatingBall(btn, originX + dx, originY + dy);
      e.preventDefault();
    });
    const finish = e => {
      if (!dragging) return;
      dragging = false;
      btn.classList.remove('dragging');
      try { btn.releasePointerCapture(e.pointerId); } catch(e2) {}
      const rect = btn.getBoundingClientRect();
      const pos = clampFloatingBallPosition(rect.left, rect.top);
      setSettings({ floatingBallX: pos.x, floatingBallY: pos.y });
      placeFloatingBall(btn, pos.x, pos.y);
      if (!moved) buildPopup();
      e.preventDefault();
    };
    btn.addEventListener('pointerup', finish);
    btn.addEventListener('pointercancel', e => {
      if (!dragging) return;
      dragging = false;
      btn.classList.remove('dragging');
      try { btn.releasePointerCapture(e.pointerId); } catch(e2) {}
      e.preventDefault();
    });
  }
  function syncFloatingBall() {
    const doc = getHostDocument();
    const cfg = settings();
    let btn = qs('#' + FLOAT_ID, doc);
    if (!cfg.floatingBallEnabled) {
      if (btn) btn.remove();
      return;
    }
    injectStyle();
    if (!btn) {
      btn = doc.createElement('button');
      btn.id = FLOAT_ID;
      btn.type = 'button';
      btn.title = '玩伴小屋';
      btn.setAttribute('aria-label', '打开玩伴小屋');
      doc.body.appendChild(btn);
      bindFloatingBall(btn);
    }
    placeFloatingBall(btn, cfg.floatingBallX, cfg.floatingBallY);
    if (!floatingBallResizeBound) {
      floatingBallResizeBound = true;
      getHostWindow().addEventListener('resize', () => {
        const latest = settings();
        const existing = qs('#' + FLOAT_ID, getHostDocument());
        if (existing) placeFloatingBall(existing, latest.floatingBallX, latest.floatingBallY);
      });
    }
  }
	  function buildPopup() {
	    injectStyle();
	    applySelectedFont();
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
	    applySelectedFont();
	    const theme = themeClass();
    p.className = theme + (currentGame ? ' wb-playing' : '');
  }
  function render() {
    const cfg = settings(); const p = qs('#' + POPUP_ID); syncPopupModeClass();
    p.onwheel = (e) => { e.stopPropagation(); };
    p.ontouchmove = (e) => { e.stopPropagation(); };
    p.innerHTML = '<div class="wb-head"><div class="wb-title">玩伴小屋</div><div class="wb-tabs"><button class="wb-tab" data-tab="single">单人游戏</button><button class="wb-tab" data-tab="double">双人游戏</button><button class="wb-tab" data-tab="intimacy">亲密互动</button><button class="wb-tab" data-tab="settings">设置</button></div><button class="wb-iconbtn" id="wb-close" title="关闭">×</button></div><div class="wb-body" id="wb-body"></div>';
    qsa('.wb-tab', p).forEach(b => { b.classList.toggle('active', b.dataset.tab === currentTab); b.onclick = () => { flushSettingsProgress(); stopGame(); currentGame = null; currentTab = b.dataset.tab; saveWindowState(currentTab, ''); render(); }; });
    qs('#wb-close', p).onclick = () => { flushSettingsProgress(); saveWindowState(currentTab, currentGame); stopGame(); closePopupShell(); };
    if (currentGame) renderGame(currentGame); else if (currentTab === 'settings') renderSettings(); else if (currentTab === 'intimacy') renderIntimacy(); else renderSelect(currentTab);
    applyMainSwipeAnimation();
    bindMainSwipe();
  }

  function applyMainSwipeAnimation() {
    const body = qs('#wb-body');
    if (!body || !mainSwipeAnimation || currentGame || !isMobileHost()) { mainSwipeAnimation = ''; return; }
    const cls = mainSwipeAnimation;
    body.classList.add(cls);
    mainSwipeAnimation = '';
    setTimeout(() => { if (body) body.classList.remove(cls); }, 260);
  }

  function bindMainSwipe() {
    const body = qs('#wb-body');
    if (!body) return;
    if (currentGame || body.classList.contains('wb-game-mode')) {
      body.ontouchstart = null;
      body.ontouchend = null;
      return;
    }
    let sx = 0, sy = 0;
    const tabs = ['single','double','intimacy','settings'];
    body.ontouchstart = e => { const t = e.touches && e.touches[0]; if (!t) return; sx = t.clientX; sy = t.clientY; };
    body.ontouchend = e => {
      if (currentGame || body.classList.contains('wb-game-mode')) return;
      const t = e.changedTouches && e.changedTouches[0]; if (!t || !sx) return;
      const dx = t.clientX - sx, dy = t.clientY - sy; sx = sy = 0;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      const i = tabs.indexOf(currentTab);
      const next = tabs[Math.max(0, Math.min(tabs.length - 1, i + (dx < 0 ? 1 : -1)))];
      if (next && next !== currentTab) { flushSettingsProgress(); stopGame(); currentGame = null; mainSwipeAnimation = dx < 0 ? 'wb-swipe-enter-left' : 'wb-swipe-enter-right'; currentTab = next; saveWindowState(currentTab, ''); render(); }
    };
  }

  function renderIntimacy() {
    syncPopupModeClass();
    const body = qs('#wb-body');
    body.className = 'wb-body wb-intimacy-mode';
    body.innerHTML = '<img class="wb-intimacy-image" src="' + esc(CONTINUE_IMAGE_URL) + '" alt="亲密互动">';
  }

  function renderSelect(mode) {
    syncPopupModeClass();
    const body = qs('#wb-body'); body.className = 'wb-body'; const ids = Object.values(GAME_META).filter(g => g.mode === mode).map(g => g.id);
    body.innerHTML = '<div class="wb-cardgrid">' + ids.map(id => { const g = GAME_META[id]; return '<div class="wb-game-card" data-game="' + id + '">' + gameIconHTML(g) + '<div class="wb-game-info"><div class="wb-game-name">' + esc(g.name) + '</div><div class="wb-muted">' + esc(cardScoreDisplay(id)) + '</div></div></div>'; }).join('') + '</div>';
    qsa('.wb-game-card', body).forEach(c => c.onclick = () => { currentGame = c.dataset.game; if (GAME_META[currentGame]) currentTab = GAME_META[currentGame].mode; saveWindowState(currentTab, currentGame); renderGame(currentGame); });
  }

  function markdownLiteHTML(text) {
    return markdownTextHTML(text);
  }
  function showGameRules(game) {
    const g = GAME_META[game] || { name:'游戏' };
    const doc = getHostDocument();
    const old = qs('#wb-rules-mask', doc); if (old) old.remove();
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-rules-mask';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">' + esc(g.name) + ' · 游戏介绍</div><div class="wb-api-status wb-text-segments">' + markdownLiteHTML(GAME_RULES[game] || '暂无介绍。') + '</div><div class="wb-actions" style="margin-top:12px;justify-content:flex-end;"><button class="wb-btn" id="wb-rules-close">关闭</button></div></div>';
    appendModalMask(mask);
    qs('#wb-rules-close', mask).onclick = () => mask.remove();
  }

  function renderSettings() {
    const cfg = settings();
    const body = qs('#wb-body');
    body.className = 'wb-body wb-settings-mode';
    const apis = apiPresets();
    const injPresets = worldPresets();
    const sums = summaries();
    const apiOptions = '<option value="">— 选择预设载入 —</option>' + apis.map((x,i) => '<option value="' + i + '">' + esc(x.name || ('预设' + (i + 1))) + '</option>').join('');
	    const savedWorldNameRaw = String(cfg.selectedWorldPresetName || '').trim();
	    const savedWorldName = savedWorldNameRaw ? normalizePresetName(savedWorldNameRaw) : '';
	    let activeWorldIndex = savedWorldName ? injPresets.findIndex(x => normalizePresetName(x && x.name) === savedWorldName) : -1;
	    if (activeWorldIndex < 0) activeWorldIndex = injPresets.findIndex(x => normalizePresetName(x && x.name) === normalizePresetName(companionName()));
		    const injOptions = '<option value=""' + (activeWorldIndex < 0 ? ' selected' : '') + '>— 当前角色 —</option>' + injPresets.map((x,i) => '<option value="' + i + '"' + (i === activeWorldIndex ? ' selected' : '') + '>' + esc(x.name || ('预设' + (i + 1))) + '</option>').join('');
	    const sumOptions = '<option value="">— 不注入 —</option>' + sums.map(x => '<option value="' + esc(x.id) + '">' + esc(x.name || '大总结') + '</option>').join('');
		    const lineRoleOptions = roleNamesForLineStorage().map(name => '<option value="' + esc(name) + '">' + esc(name) + '</option>').join('');
		    const lineGameOptions = Object.values(GAME_META).map(g => '<option value="' + esc(g.id) + '">' + esc(g.name) + '</option>').join('');
		    const fontOptions = '<option value="">默认字体</option>' + customFonts().map(f => '<option value="' + esc(f.name) + '">' + esc(f.name) + '</option>').join('');
		    const charPreview = currentCharDescription(Object.assign({}, cfg, { injectCharDesc: true }));
    body.innerHTML = '<div class="wb-settings-grid">'
      + '<div class="wb-panel"><div class="wb-section-title">基础设置</div>'
      + '<label class="wb-switch"><input id="wb-companion-toggle" type="checkbox" ' + (cfg.companion ? 'checked' : '') + '>开启陪伴模式</label>'
      + '<div id="wb-companion-suboptions" style="' + (cfg.companion ? '' : 'display:none;') + '">'
      + '<label class="wb-switch"><input id="wb-theater-toggle" type="checkbox" ' + (cfg.theaterEnabled ? 'checked' : '') + '>开启小剧场</label>'
      + '<label class="wb-switch"><input id="wb-auto-log-toggle" type="checkbox" ' + (cfg.autoLog ? 'checked' : '') + '>自动记录日志</label>'
      + '</div>'
      + '<label class="wb-switch"><input id="wb-remember-window" type="checkbox" ' + (cfg.rememberWindow ? 'checked' : '') + '>保留上一次窗口</label>'
      + '<label class="wb-switch"><input id="wb-floating-ball" type="checkbox" ' + (cfg.floatingBallEnabled ? 'checked' : '') + '>开启悬浮球入口</label>'
      + '<label class="wb-switch"><input id="wb-message-notify" type="checkbox" ' + (cfg.messageNotify ? 'checked' : '') + '>RP正文完成提醒</label>'
      + '<div class="wb-muted" style="font-size:11px;margin-top:-10px;padding-left:24px;line-height:1;">防沉迷系统（不是）</div>'
      + '<div class="wb-preset-row"><span class="wb-muted" style="flex:1;">正文标签：&lt;' + esc(cfg.messageNotifyTag || 'content') + '&gt;...&lt;/' + esc(cfg.messageNotifyTag || 'content') + '&gt;</span><button class="wb-btn" id="wb-message-tag-btn">设置正文标签</button></div>'
	      + '<div class="wb-field"><label>美化主题</label><select class="wb-select" id="wb-theme"><option value="day">【日】梦幻掌机</option><option value="spring">【日】春野物语</option><option value="night">【夜】霓虹游戏舱</option><option value="cyber">【夜】赛博街机</option></select></div>'
	      + '<div class="wb-field"><label>全局字体</label><div class="wb-preset-row"><select class="wb-select" id="wb-font-select">' + fontOptions + '</select><button class="wb-btn" id="wb-font-edit" type="button">编辑</button></div></div>'
      + '</div>'
      + '<div class="wb-panel"><div class="wb-section-title">API 配置</div>'
      + '<div class="wb-api-status" id="wb-current-api-model">当前模型：' + esc(cfg.apiModel || '未配置') + '</div>'
      + '<div class="wb-section-title no-mark" style="font-size:12px;margin-top:8px;">API 预设</div>'
      + '<div class="wb-preset-row"><select class="wb-select" id="wb-api-preset">' + apiOptions + '</select><button class="wb-btn" id="wb-load-api-preset">载入</button><button class="wb-btn" id="wb-del-api-preset">删</button></div>'
      + '<button class="wb-btn" id="wb-api-details-toggle" type="button">展开配置预设模型</button>'
      + '<div id="wb-api-details" style="display:none;gap:10px;">'
      + '<div class="wb-field"><label>API 基础 URL</label><input class="wb-input" type="url" id="wb-api-url" placeholder="https://api.example.com" value="' + esc(cfg.apiUrl) + '"></div>'
      + '<div class="wb-field"><label>API 密钥</label><input class="wb-input" type="password" id="wb-api-key" placeholder="sk-..." value="' + esc(cfg.apiKey) + '"></div>'
      + '<div class="wb-actions"><button class="wb-btn" id="wb-load-models-btn" style="flex:1;">加载模型列表</button></div>'
      + '<div class="wb-field"><label>选择模型</label><select class="wb-select" id="wb-api-model"><option value="">请先加载模型列表</option></select></div>'
      + '<div class="wb-api-status" id="wb-api-status">状态: 未配置</div>'
      + '<div class="wb-actions"><button class="wb-btn primary" id="wb-save-api-config" style="flex:1;">保存API配置</button><button class="wb-btn" id="wb-clear-api-config">清除</button></div>'
      + '<div class="wb-preset-save-row"><input class="wb-input" type="text" id="wb-api-preset-name" placeholder="命名并保存当前 API 配置..."><button class="wb-btn" id="wb-save-api-preset">保存</button></div>'
      + '</div>'
      + '</div>'
	      + '<div class="wb-panel"><div class="wb-section-title">世界观注入</div>'
      + '<div class="wb-section-title no-mark" style="font-size:12px;margin-top:4px;">当前默认角色设置</div>'
      + '<div class="wb-preset-row"><select class="wb-select" id="wb-world-preset">' + injOptions + '</select><button class="wb-btn" id="wb-load-world-preset">载入</button><button class="wb-btn" id="wb-del-world-preset">删</button></div>'
      + '<button class="wb-btn" id="wb-injection-details-toggle" type="button">展开详细配置</button>'
      + '<div id="wb-injection-details" style="display:none;gap:10px;">'
	      + '<div class="wb-field"><label><input type="checkbox" id="wb-inject-user-desc" ' + (cfg.injectUserDesc !== false ? 'checked' : '') + '> 用户设定描述</label><textarea class="wb-textarea" id="wb-user-persona" placeholder="填写 user 的设定、性格、关系、偏好；留空则尝试读取当前 persona...">' + esc(cfg.userPersona) + '</textarea></div>'
      + '<label class="wb-switch"><input id="wb-inject-char-desc" type="checkbox" ' + (cfg.injectCharDesc !== false ? 'checked' : '') + '>角色描述</label>'
      + '<div class="wb-field"><label>角色描述来源</label><select class="wb-select" id="wb-char-desc-mode"><option value="auto">自动导入当前角色卡</option><option value="manual">手动添加</option></select></div>'
      + '<div class="wb-field"><label>角色姓名（可选）</label><input class="wb-input" id="wb-char-name" placeholder="留空则读取当前角色卡姓名" value="' + esc(cfg.charName && cfg.charName !== '{{char}}' ? cfg.charName : '') + '"></div>'
      + '<div class="wb-field" id="wb-manual-char-wrap"><label>手动角色描述（自动保存）</label><textarea class="wb-textarea" id="wb-manual-char-persona" placeholder="手动填写当前角色的性格、说话方式、关系设定...">' + esc(cfg.manualCharPersona || '') + '</textarea></div>'
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
      + '<div class="wb-actions"><button class="wb-btn primary" id="wb-save-world-preset" style="flex:1;">保存为当前角色配置</button><button class="wb-btn" id="wb-reset-current-world-default" style="flex:1;">恢复当前角色卡默认</button></div>'
      + '</div>'
	      + '</div>'
	      + '<div class="wb-panel"><div class="wb-section-title">游戏语录设置</div>'
		      + '<details class="wb-line-view-details"><summary class="wb-btn" style="display:block;text-align:center;">查看语录 / 小剧场</summary><div style="display:grid;gap:8px;margin-top:8px;">'
		      + '<div class="wb-preset-row"><select class="wb-select" id="wb-line-view-role">' + lineRoleOptions + '</select><select class="wb-select" id="wb-line-view-game">' + lineGameOptions + '</select><select class="wb-select" id="wb-line-view-kind"><option value="lines">语录</option><option value="theater">小剧场</option></select></div>'
		      + '<div class="wb-api-status wb-text-segments" id="wb-line-view-box" style="min-height:180px;max-height:260px;overflow:auto;"></div></div></details>'
	      + '<div class="wb-api-status" id="wb-line-generation-status" style="margin-top:10px;">' + esc(lineGenerationStatus) + '</div>'
	      + '<div class="wb-actions" style="margin-top:10px;"><button class="wb-btn primary" id="wb-batch-lines" style="flex:1;">批量生成角色数据</button><button class="wb-btn" id="wb-batch-debug-settings">调试</button></div>'
	      + '</div>'
	      + '<div class="wb-panel"><div class="wb-section-title">导出 / 导入</div>'
	      + '<div class="wb-muted">一键导出除 API 配置和 API 预设以外的全部内容；导入不会覆盖 API URL、密钥、模型。</div>'
	      + '<div class="wb-actions"><button class="wb-btn primary" id="wb-export-all" style="flex:1;">导出全部内容</button><button class="wb-btn" id="wb-import-all" style="flex:1;">导入备份</button><input type="file" id="wb-import-all-file" accept=".json,application/json" style="display:none;"></div>'
	      + '<div class="wb-api-status" id="wb-import-export-status">未选择文件。</div>'
	      + '</div>'
	      + '<div class="wb-muted" style="text-align:center;font-size:11px;line-height:1.5;">当前版本：V1.0.1<br>本游戏发布者：Gloria</div>'
	      + '</div>';
	    qs('#wb-theme').value = cfg.theme;
	    const fontSelect = qs('#wb-font-select'); if (fontSelect) fontSelect.value = selectedFontConfig(cfg) ? cfg.selectedFont : '';
    const charMode = qs('#wb-char-desc-mode'); if (charMode) charMode.value = cfg.charDescMode === 'manual' ? 'manual' : 'auto';
    const manualWrap = qs('#wb-manual-char-wrap'); if (manualWrap) manualWrap.style.display = cfg.charDescMode === 'manual' ? '' : 'none';
    qs('#wb-summary-select').value = cfg.summaryId || '';
    populateModelSelect(cfg.apiModel);
    updateApiStatusUI();
    restoreSelectedWorldEntries();
    qs('#wb-companion-toggle').onchange = () => {
      const toggle = qs('#wb-companion-toggle');
      const sub = qs('#wb-companion-suboptions');
      if (sub) sub.style.display = toggle && toggle.checked ? '' : 'none';
      if (toggle && toggle.checked && !settings().companion) {
        const th = qs('#wb-theater-toggle');
        if (th) th.checked = true;
        autoSaveBasicSettingsFromUI();
      } else autoSaveBasicSettingsFromUI();
    };
    const theaterToggle = qs('#wb-theater-toggle'); if (theaterToggle) theaterToggle.onchange = autoSaveBasicSettingsFromUI;
    const autoLogToggle = qs('#wb-auto-log-toggle'); if (autoLogToggle) autoLogToggle.onchange = autoSaveBasicSettingsFromUI;
    const rememberWindowToggle = qs('#wb-remember-window'); if (rememberWindowToggle) rememberWindowToggle.onchange = autoSaveBasicSettingsFromUI;
    const floatingBallToggle = qs('#wb-floating-ball'); if (floatingBallToggle) floatingBallToggle.onchange = autoSaveBasicSettingsFromUI;
    const messageNotifyToggle = qs('#wb-message-notify'); if (messageNotifyToggle) messageNotifyToggle.onchange = () => { autoSaveBasicSettingsFromUI(); bindMessageNotifyEvents(); };
    const messageTagBtn = qs('#wb-message-tag-btn'); if (messageTagBtn) messageTagBtn.onclick = () => { const next = prompt('正文标签名', settings().messageNotifyTag || 'content'); if (next == null) return; const tag = String(next || '').replace(/[<>/\s]/g, '').trim() || 'content'; setSettings({ messageNotifyTag: tag }); renderSettings(); toast('正文标签已设置为 <' + tag + '>'); };
	    qs('#wb-theme').onchange = autoSaveBasicSettingsFromUI;
	    if (fontSelect) fontSelect.onchange = autoSaveBasicSettingsFromUI;
	    const fontEdit = qs('#wb-font-edit'); if (fontEdit) fontEdit.onclick = editCustomFontFromUI;
    const apiDetailsToggle = qs('#wb-api-details-toggle');
    if (apiDetailsToggle) apiDetailsToggle.onclick = () => {
      const details = qs('#wb-api-details');
      if (!details) return;
      const open = details.style.display === 'none';
      details.style.display = open ? 'grid' : 'none';
      apiDetailsToggle.textContent = open ? '收起配置预设模型' : '展开配置预设模型';
    };
    const avatarInput = qs('#wb-avatar-url'); if (avatarInput) avatarInput.oninput = debounceAutoSaveInjection;
    const saveAvatarBtn = qs('#wb-save-current-avatar'); if (saveAvatarBtn) saveAvatarBtn.onclick = () => { const input = qs('#wb-avatar-url'); const typed = input ? input.value.trim() : ''; if (typed) { autoSaveInjectionSettingsFromUI(); toast('已保存头像 URL，优先使用该头像'); return; } const url = findCurrentCardAvatar(); if (!url) { toast('未读取到当前角色卡头像'); return; } if (input) input.value = url; autoSaveInjectionSettingsFromUI(); toast('已保存当前角色卡头像到世界观注入'); };
    const clearAvatarBtn = qs('#wb-clear-avatar'); if (clearAvatarBtn) clearAvatarBtn.onclick = () => { const input = qs('#wb-avatar-url'); if (input) input.value = ''; autoSaveInjectionSettingsFromUI(); toast('已清除世界观头像'); };
    qs('#wb-load-models-btn').onclick = loadModelsFromUI;
    const apiModelSelect = qs('#wb-api-model'); if (apiModelSelect) apiModelSelect.onchange = updateApiStatusUI;
    qs('#wb-save-api-config').onclick = saveApiConfigFromUI;
    qs('#wb-clear-api-config').onclick = clearApiConfigFromUI;
    qs('#wb-save-api-preset').onclick = saveApiPresetFromUI;
    qs('#wb-load-api-preset').onclick = loadApiPresetFromUI;
    qs('#wb-del-api-preset').onclick = deleteApiPresetFromUI;
    const exportBtn = qs('#wb-export-all'); if (exportBtn) exportBtn.onclick = exportAllData;
    const importBtn = qs('#wb-import-all'); if (importBtn) importBtn.onclick = () => { const f = qs('#wb-import-all-file'); if (f) f.click(); };
	    const importFile = qs('#wb-import-all-file'); if (importFile) importFile.onchange = importAllDataFromFile;
	    const batchLinesBtn = qs('#wb-batch-lines'); if (batchLinesBtn) batchLinesBtn.onclick = openBatchLineGenerator;
	    const batchDebugSettings = qs('#wb-batch-debug-settings'); if (batchDebugSettings) batchDebugSettings.onclick = () => showBatchDebugModal(batchGenerationDebug);
	    const refreshLineView = () => {
	      const role = qs('#wb-line-view-role')?.value || companionName();
	      const game = qs('#wb-line-view-game')?.value || Object.keys(GAME_META)[0];
	      const box = qs('#wb-line-view-box');
	      const kind = qs('#wb-line-view-kind')?.value || 'lines';
	      if (box) box.innerHTML = markdownTextHTML(kind === 'theater' ? formatStoredTheaters(game, role) : formatStoredLineSet(game, storedLineSetForRoleGame(game, role)));
	    };
	    const lineRoleSel = qs('#wb-line-view-role'); if (lineRoleSel) lineRoleSel.onchange = refreshLineView;
	    const lineGameSel = qs('#wb-line-view-game'); if (lineGameSel) lineGameSel.onchange = refreshLineView;
	    const lineKindSel = qs('#wb-line-view-kind'); if (lineKindSel) lineKindSel.onchange = refreshLineView;
	    refreshLineView();
	    updateLineGenerationStatusUI();
    const injectionDetailsToggle = qs('#wb-injection-details-toggle');
    if (injectionDetailsToggle) injectionDetailsToggle.onclick = () => {
      const details = qs('#wb-injection-details');
      if (!details) return;
      const open = details.style.display === 'none';
      details.style.display = open ? 'grid' : 'none';
      injectionDetailsToggle.textContent = open ? '收起详细配置' : '展开详细配置';
    };
    qs('#wb-refresh-worldbook').onclick = refreshWorldbookList;
    ['#wb-inject-user-desc','#wb-inject-char-desc','#wb-char-desc-mode','#wb-inject-chat','#wb-intimacy-mode','#wb-summary-select'].forEach(sel => { const el = qs(sel); if (el) el.onchange = () => { const pv = qs('#wb-summary-preview'); if (pv) pv.textContent = summaryPreview(qs('#wb-summary-select').value); const wrap = qs('#wb-manual-char-wrap'); if (wrap && qs('#wb-char-desc-mode')) wrap.style.display = qs('#wb-char-desc-mode').value === 'manual' ? '' : 'none'; autoSaveInjectionSettingsFromUI(); const preview = qs('#wb-char-desc-preview'); if (preview) preview.textContent = currentCharDescription(settings()); }; });
    const up = qs('#wb-user-persona'); if (up) up.oninput = debounceAutoSaveInjection;
    const mp = qs('#wb-manual-char-persona'); if (mp) mp.oninput = () => { const preview = qs('#wb-char-desc-preview'); if (preview) preview.textContent = currentCharDescription(Object.assign({}, settings(), { charDescMode: 'manual', manualCharPersona: mp.value.trim(), injectCharDesc: true })); debounceAutoSaveInjection(); };
    const cn = qs('#wb-char-name'); if (cn) cn.oninput = () => { const preview = qs('#wb-char-desc-preview'); if (preview) preview.textContent = currentCharDescription(Object.assign({}, settings(), { charName: cn.value.trim() || '{{char}}', injectCharDesc: true })); debounceAutoSaveInjection(); };
    const bp = qs('#wb-break-limit-prompt'); if (bp) bp.oninput = debounceAutoSaveInjection;
    qs('#wb-manage-summary').onclick = openSummaryManager;
    qs('#wb-save-world-preset').onclick = saveWorldPresetFromUI;
    qs('#wb-reset-current-world-default').onclick = resetCurrentWorldDefaultFromUI;
    const worldPresetSelect = qs('#wb-world-preset'); if (worldPresetSelect) worldPresetSelect.onchange = loadWorldPresetFromUI;
    qs('#wb-load-world-preset').onclick = loadWorldPresetFromUI;
    qs('#wb-del-world-preset').onclick = deleteWorldPresetFromUI;
  }

  let wbAutoSaveTimer = null;
	  function autoSaveBasicSettingsFromUI() {
	    const companion = !!(qs('#wb-companion-toggle') && qs('#wb-companion-toggle').checked);
	    const theme = qs('#wb-theme') ? qs('#wb-theme').value : settings().theme;
	    const selectedFont = qs('#wb-font-select') ? qs('#wb-font-select').value : settings().selectedFont;
	    const rememberWindow = !!(qs('#wb-remember-window') && qs('#wb-remember-window').checked);
	    const floatingBallEnabled = !!(qs('#wb-floating-ball') && qs('#wb-floating-ball').checked);
	    const messageNotify = !!(qs('#wb-message-notify') && qs('#wb-message-notify').checked);
	    const theaterEnabled = companion && !!(qs('#wb-theater-toggle') && qs('#wb-theater-toggle').checked);
	    const autoLog = companion && !!(qs('#wb-auto-log-toggle') && qs('#wb-auto-log-toggle').checked);
	    const patch = { companion, theme, selectedFont, rememberWindow, floatingBallEnabled, messageNotify, theaterEnabled, autoLog };
	    if (rememberWindow) { patch.lastTab = currentTab || 'single'; patch.lastGame = currentGame || ''; }
	    setSettings(patch);
	    syncPopupModeClass();
	    applySelectedFont();
	    syncFloatingBall();
	  }
	  function editCustomFontFromUI() {
	    const cfg = settings();
	    const current = selectedFontConfig(cfg);
	    const name = prompt('字体名称', current ? current.name : '');
	    if (name == null) return;
	    const cleanName = String(name || '').trim();
	    if (!cleanName) { toast('请输入字体名称'); return; }
	    const url = prompt('字体 URL', current ? current.url : '');
	    if (url == null) return;
	    const cleanUrl = String(url || '').trim();
	    if (!cleanUrl) { toast('请输入字体 URL'); return; }
	    const fonts = customFonts().filter(f => f.name !== cleanName);
	    fonts.unshift({ name: cleanName, url: cleanUrl });
	    setSettings({ customFonts: fonts, selectedFont: cleanName });
	    applySelectedFont();
	    renderSettings();
	    toast('字体已保存并应用');
	  }
  function selectedWorldPresetNameFromUI() {
    const sel = qs('#wb-world-preset');
    if (!sel || sel.value === '') return '';
    const pr = worldPresets()[parseInt(sel.value, 10)];
    const name = String((pr && pr.name) || '').trim();
    return name ? normalizePresetName(name) : '';
  }
  function roleNameFromWorldUI() {
    const typed = qs('#wb-char-name') ? qs('#wb-char-name').value.trim() : '';
    return normalizePresetName(typed || companionName());
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
      charDescMode: qs('#wb-char-desc-mode') ? qs('#wb-char-desc-mode').value : 'auto',
      manualCharPersona: qs('#wb-manual-char-persona') ? qs('#wb-manual-char-persona').value.trim() : '',
      charName: (qs('#wb-char-name') && qs('#wb-char-name').value.trim()) || '{{char}}',
      avatarUrl: qs('#wb-avatar-url') ? qs('#wb-avatar-url').value.trim() : '',
      summaryId: qs('#wb-summary-select').value || '',
      selectedWorldEntries: selectedWorldEntriesFromUI(),
      selectedWorldPresetName: selectedWorldPresetNameFromUI()
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
    const current = qs('#wb-current-api-model');
    if (current) current.textContent = '当前模型：' + (model || '未配置');
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
      STORAGE_THEATERS,
      STORAGE_LINE_PRESET_SELECTION,
      STORAGE_WORLD_PRESETS,
      STORAGE_SUMMARIES,
      STORAGE_SUMMARY_REQ,
      STORAGE_PROGRESS,
      STORAGE_RECORDS,
      STORAGE_WORD_GUESS_BANK
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
    const data = { app:'玩伴小屋', scriptId:SCRIPT_ID, version:'1.0.1', exportedAt:new Date().toISOString(), items:{} };
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
    a.download = '玩伴小屋-备份-' + new Date().toISOString().slice(0,10) + '.json';
    getHostDocument().body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
    const st = qs('#wb-import-export-status'); if (st) st.textContent = '已导出备份：不包含 API 配置和 API 预设。';
    toast('已导出备份');
  }
  function importAllDataFromFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        const items = data.items || data;
        const st = qs('#wb-import-export-status'); if (st) st.textContent = '已读取备份：' + (file.name || '备份文件') + '，等待确认导入。';
        showConfirm('导入备份', '导入后会覆盖当前本地的设置、语录、小剧场、世界观预设、大总结、游戏记录、进度和题库等备份内包含的数据。当前 API 配置和 API 预设会保留，不会被覆盖。确定要继续导入吗？', () => {
          const currentApi = ((cfg) => ({ apiUrl: cfg.apiUrl || '', apiKey: cfg.apiKey || '', apiModel: cfg.apiModel || '' }))(settings());
          exportDataKeys().forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(items, key)) return;
            if (key === STORAGE_SETTINGS) saveJSON(key, Object.assign({}, settingsWithoutApi(items[key] || {}), currentApi));
            else if (key === STORAGE_SUMMARY_REQ) localStorage.setItem(key, String(items[key] || ''));
            else saveJSON(key, items[key]);
          });
          theaterCache = loadJSON(STORAGE_THEATERS, {});
          const doneStatus = qs('#wb-import-export-status'); if (doneStatus) doneStatus.textContent = '已导入：' + (file.name || '备份文件') + '。API 配置和 API 预设已保留。';
          toast('导入完成，API 配置和 API 预设未被覆盖');
          renderSettings();
          e.target.value = '';
        }, () => {
          const cancelStatus = qs('#wb-import-export-status'); if (cancelStatus) cancelStatus.textContent = '已取消导入备份。';
          e.target.value = '';
        });
      } catch(err) {
        const st = qs('#wb-import-export-status'); if (st) st.textContent = '导入失败：' + (err && err.message ? err.message : err);
        toast('导入失败：文件格式不正确');
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
    if (cfg.charDescMode === 'manual') return String(cfg.manualCharPersona || '').trim() || '未填写手动角色描述';
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
  function estimateTokenCount(text) {
    const s = String(text || '');
    const cjk = (s.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
    const asciiWords = (s.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ').match(/[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g) || []).length;
    return Math.max(1, Math.ceil(cjk + asciiWords * 0.75));
  }
  function fillApiDebugMeta(meta, data) {
    if (!meta || !data) return;
    const usage = data.usage || {};
    meta.inputTokensActual = usage.prompt_tokens || usage.input_tokens || 0;
    meta.outputTokensActual = usage.completion_tokens || usage.output_tokens || 0;
    meta.totalTokensActual = usage.total_tokens || 0;
  }
  function formatApiDebugMeta(meta) {
    if (!meta) return '';
    const input = meta.inputTokensActual ? (meta.inputTokensActual + '（API返回）') : ((meta.inputTokensEstimated || 0) + '（估算）');
    const output = meta.outputTokensActual ? String(meta.outputTokensActual) : '无';
    const total = meta.totalTokensActual ? String(meta.totalTokensActual) : '无';
    const seconds = typeof meta.durationMs === 'number' ? (meta.durationMs / 1000).toFixed(2) : '0.00';
    return [
      '输入token：' + input,
      '输出token：' + output,
      '总token：' + total,
      '输出时间：' + seconds + 's'
    ].join('\n');
  }
  async function callApiText(cfg, prompt, systemPrompt, maxTokens, debugMeta) {
    const url = apiChatUrl(cfg.apiUrl);
    if (!url) throw new Error('请先配置API基础URL');
    if (!cfg.apiModel) throw new Error('请先选择模型');
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
    const messages = [{ role: 'system', content: systemPrompt || '只输出结果正文，不要解释。' }, { role: 'user', content: prompt }];
    if (debugMeta) debugMeta.inputTokensEstimated = estimateTokenCount(messages.map(m => m.content).join('\n'));
    const started = Date.now();
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST', headers,
        body: JSON.stringify({ model: cfg.apiModel, messages, temperature: 0.55, max_tokens: maxTokens || 4096 })
      }, 300000);
      if (!res.ok) { const t = await res.text().catch(()=> ''); throw new Error('API错误 ' + res.status + ': ' + t.slice(0, 120)); }
      const json = await res.json();
      fillApiDebugMeta(debugMeta, json);
      const choice = json.choices?.[0] || {};
      const txt = choice.message?.content || choice.text || json.output_text || '';
      if (!txt) throw new Error('API响应格式异常');
      if (choice.finish_reason === 'length') throw new Error('AI返回被截断，请提高模型输出上限或减少生成内容');
      return stripJsonFence(txt);
    } finally {
      if (debugMeta) debugMeta.durationMs = Date.now() - started;
    }
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

  function summarySnapshotFromId(id) {
    const s = summaries().find(x => x.id === id);
    return s ? { id: s.id, name: s.name || '大总结', content: s.content || '' } : null;
  }
  function worldPresetSnapshotFromUI(name) {
    const selected = selectedWorldEntriesFromUI();
    const charName = normalizePresetName(name || (qs('#wb-char-name') && qs('#wb-char-name').value.trim()) || companionName());
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
      charDescMode: qs('#wb-char-desc-mode') ? qs('#wb-char-desc-mode').value : 'auto',
      manualCharPersona: qs('#wb-manual-char-persona') ? qs('#wb-manual-char-persona').value.trim() : '',
      charName,
      charDescriptionSnapshot: currentCharDescription(baseCfg),
      avatarUrl: qs('#wb-avatar-url') ? qs('#wb-avatar-url').value.trim() : '',
      summaryId,
      summarySnapshot: summarySnapshotFromId(summaryId),
      selectedWorldKeys: selected.map(x => ({ label:x.label, wbName:x.wbName || '', uid:x.uid || '' })),
      selectedWorldEntries: selected.map(x => ({ label:x.label || '', content:x.content || '', wbName:x.wbName || '', uid:x.uid || '' }))
    };
  }
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
      charDescMode: pr.charDescMode || 'auto',
      manualCharPersona: pr.manualCharPersona || '',
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
      return;
    }
	    const name = normalizePresetName(value.replace(/^line::/, ''));
	    const pr = worldPresets().find(x => normalizePresetName(x.name) === name);
	    if (pr) await applyWorldPresetToGame(pr);
	    else { setSettings({ charName: name, charDescriptionSnapshot: '', avatarUrl: '' }); refreshGameCompanionPanel(); }
	    setCurrentLinePreset(game, name);
	    toast(pr ? ('已切换语录并同步设定：' + name) : ('已切换语录：' + name));
	  }

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
      gameActiveStartedAt = Date.now();
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

  function theaterJobsForGame(game) {
    const g = GAME_META[game] || {};
    if (g.mode !== 'double') {
      if (game === 'plank') return [['score','normal'], ['score','record'], ['score','super_good'], ['score','super_bad'], ['score','long_run'], ['score','plank_regret'], ['score','plank_tease']];
      if (game === 'sudoku') return [['score','normal'], ['score','record'], ['score','super_good'], ['score','long_run'], ['score','scholar'], ['score','independent']];
      const jobs = [['score','normal'], ['score','record'], ['score','super_good'], ['score','super_bad'], ['score','long_run']];
      return jobs;
    }
    if (game === 'bombnumber') return [['user_win','normal'], ['ta_win','normal'], ['ta_win','bad_luck'], ['user_win','bomb_lucky'], ['ta_win','fated'], ['user_win','rage']];
    if (game === 'connect4d') return [['user_win','normal'], ['ta_win','normal'], ['draw','balanced'], ['user_win','win_streak3'], ['ta_win','lose_streak3']];
    if (game === 'reversi') return [['user_win','normal'], ['ta_win','normal'], ['draw','normal'], ['user_win','win_streak3'], ['ta_win','lose_streak3'], ['user_win','reversi_user_sweep'], ['ta_win','reversi_char_sweep'], ['user_win','reversi_close_win'], ['ta_win','reversi_close_lose'], ['user_win','reversi_comeback']];
    const jobs = [['user_win','normal'], ['ta_win','normal']];
    if (!['gomoku','oldmaid','ludo'].includes(game)) jobs.push(['draw','normal']);
    jobs.push(['user_win','win_streak3'], ['ta_win','lose_streak3'], ['user_win','lucky'], ['ta_win','stomp'], ['ta_win','close_lose'], ['user_win','close_win']);
    if (game === 'wordguess') jobs.push(['user_win','soulmate']);
    return jobs;
  }
  function theaterPackKey(outcome, special) { return outcome + '__' + (special || 'normal'); }
  function theaterPackFallback(game, jobs, roleName) {
    const out = {};
    jobs.forEach(([outcome, special]) => { out[theaterPackKey(outcome, special)] = doubleTheaterFallback(game, outcome, special === 'normal' ? '' : special, roleName); });
    return out;
  }
  function assertTheaterPackShape(jobs, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('小剧场返回必须是JSON对象');
    const required = jobs.map(([outcome, special]) => theaterPackKey(outcome, special));
    const requiredSet = new Set(required);
    const keys = Object.keys(data);
    const missing = required.filter(key => !Object.prototype.hasOwnProperty.call(data, key));
    const extra = keys.filter(key => !requiredSet.has(key));
    if (missing.length) throw new Error('小剧场缺少场景key：' + missing.join(', '));
    if (extra.length) throw new Error('小剧场包含多余场景key：' + extra.join(', '));
    required.forEach(key => {
      const raw = data[key];
      if (!Array.isArray(raw)) throw new Error('小剧场场景“' + key + '”必须是数组');
      if (raw.length !== 3) throw new Error('小剧场场景“' + key + '”必须正好3条，当前' + raw.length + '条');
      raw.forEach((item, idx) => {
        const normalized = normalizeTheaterItem(item);
        if (!normalized.length) throw new Error('小剧场场景“' + key + '”第' + (idx + 1) + '条为空或格式错误');
      });
    });
  }
  function normalizeTheaterPack(game, jobs, data) {
    assertTheaterPackShape(jobs, data);
    const out = {};
    jobs.forEach(([outcome, special]) => {
      const key = theaterPackKey(outcome, special);
      out[key] = data[key].map(normalizeTheaterItem);
    });
    return out;
  }
  function theaterStylePromptLines() {
    return (promptTemplates().theater || PROMPT_TEMPLATES.theater).filter(line => !/请生成3条|只输出JSON数组|不要编号|数组包含3条|如果分段|推荐把每条|第一条小剧场|第二条小剧场|第三条小剧场|^\s*\[|^\s*\]/.test(String(line || '')));
  }
  function theaterPackSystemPrompt(jobs) {
    const keys = jobs.map(([outcome, special]) => theaterPackKey(outcome, special)).join(', ');
    return '你是严格JSON生成器。只输出一个可被JSON.parse解析的JSON对象，不要markdown，不要代码块，不要解释，不要前后缀。必须完整生成全部内容，顶层key必须一个不漏地包含这些key：' + keys + '。顶层只能包含这些key。每个key的值必须是长度为3的数组。数组里每一项必须是字符串，或段落字符串数组。禁止漏key、改key、增加key，禁止只输出部分key，禁止用“同上/略/省略”等方式跳过内容，禁止输出顶层数组。禁止把多个场景的内容合并到同一个key里；每个key只能写该key对应的3条。';
  }
  function lineJsonSkeleton(game, keys) {
    return '{\n' + keys.map(k => '  "' + k + '": ["短句1", "短句2", "短句3", "短句4", "短句5", "短句6", "短句7", "短句8"]').join(',\n') + '\n}';
  }
  function wordGuessJsonSkeleton() {
    return '{\n'
      + '  "random": ["碎碎念1", "碎碎念2", "碎碎念3", "碎碎念4", "碎碎念5", "碎碎念6", "碎碎念7", "碎碎念8"],\n'
      + '  "user_win": ["user赢定语录1", "user赢定语录2", "user赢定语录3", "user赢定语录4", "user赢定语录5", "user赢定语录6", "user赢定语录7", "user赢定语录8"],\n'
      + '  "user_lose": ["{{char}}赢定语录1", "{{char}}赢定语录2", "{{char}}赢定语录3", "{{char}}赢定语录4", "{{char}}赢定语录5", "{{char}}赢定语录6", "{{char}}赢定语录7", "{{char}}赢定语录8"],\n'
      + '  "word_bank": [\n'
      + '    {\n'
      + '      "word": "答案",\n'
      + '      "length": 2,\n'
      + '      "type": "分类",\n'
      + '      "clues": ["描述1", "描述2", "描述3", "描述4", "描述5"],\n'
      + '      "start_line": "本词刚开始时{{char}}说的一句话",\n'
      + '      "wrong_lines": ["猜错1", "猜错2", "猜错3", "猜错4", "猜错5"],\n'
      + '      "next_lines": ["下一条1", "下一条2", "下一条3", "下一条4"],\n'
      + '      "win_line": "猜中后{{char}}说的话",\n'
      + '      "reveal_line": "揭晓答案后{{char}}说的话"\n'
      + '    }\n'
      + '  ]\n'
      + '}';
  }
  function theaterPackJsonSkeleton(jobs) {
    return '{\n' + jobs.map(([outcome, special]) => {
      const key = theaterPackKey(outcome, special);
      return '  "' + key + '": ["小剧场1", "小剧场2", "小剧场3"]';
    }).join(',\n') + '\n}';
  }
  function buildTheaterPackPrompt(game, cfg, jobs) {
    const intimacyText = cfg.intimacyMode ? '开启。允许成年角色之间更亲近、更暧昧、更依赖，允许含蓄的NSFW暗示；禁止未成年人相关性内容、强迫、失控或违法内容。' : '关闭。保持自然陪伴和轻松亲近，禁止色情行为和露骨内容。';
    const prefix = (cfg.breakLimitPrompt || '').trim();
    const isDoubleGame = (GAME_META[game] || {}).mode === 'double';
    const specialDesc = {
      normal:isDoubleGame ? '普通结算。双人游戏才可以写双方胜负。若结果是平局，必须按平局处理，不得写成失败或安慰输家。' : '普通结算。单人游戏没有双方输赢，{{char}}没有参与对局、没有赢也没有输；只能写小游戏结束后{{char}}看着user的分数/操作/坚持，觉得user真厉害，进行夸奖、陪伴、调侃或约定下一局。',
      record:isDoubleGame ? '破纪录或普通玩家胜利' : '单人游戏刷新历史最高分。{{char}}只是观看者，重点写user破纪录后角色惊讶、高兴、夸奖或给出奖励。',
      win_streak3:'user同一角色同一游戏连续赢三场',
      lose_streak3:'{{char}}同一角色同一游戏连续赢三场',
      super_good:'超级厉害小剧场。玩家达成极高成就，必须说明角色明显惊讶、兴奋或难以置信。',
      super_bad:'超级菜小剧场。玩家开局很短时间内或很少回合内失败，适合安慰、调侃和轻松互动。',
      long_run:'单局持续很久。生成“陪你熬到最后”的小剧场。',
      lucky:'运气超好小剧场。玩家靠少次数、连续好骰或极快胜利达成优势。',
      soulmate:'心有灵犀小剧场。我说你猜5道全部猜中触发；必须说明user非常了解{{char}}，能跟上{{char}}的表达和暗示，{{char}}应该非常高兴、被理解、亲近感明显上升。',
      stomp:'实力悬殊小剧场。{{char}}比user赢很多，需要更强烈情绪的安慰和互动。',
      close_lose:'惜败小剧场。user差一点输给{{char}}，需要安慰，{{char}}可以带一点小侥幸和得意。',
      close_win:'险胜小剧场。user惊险获胜，{{char}}需要有一点不服气等小情绪。'
    };
    const sceneText = jobs.map(([outcome, special]) => {
      const resultText = outcome === 'score' ? '单人分数结算' : formatRecordResultForPrompt(outcome);
      return theaterPackKey(outcome, special) + '：结果=' + resultText + '，特殊触发=' + (specialDesc[special] || special || '普通结算');
    }).join('\n');
    return [
      prefix,
      ...((cfg.theaterPromptOverride || '').trim() ? String(cfg.theaterPromptOverride).split(/\r?\n/) : theaterStylePromptLines()),
      '请一次性生成下列所有小剧场场景。必须完整生成全部场景和全部内容，任何一个小剧场key都不能遗漏。',
      '【最重要的输出格式】',
      '1. 只输出一个JSON对象，顶层必须是 { }，绝对不能是 [ ]。',
      '2. 顶层key必须完整且只能使用“场景”里列出的key，禁止新增、漏掉、改名、翻译key。',
      '3. 每个key的值必须是长度正好为3的数组。',
      '4. 每个数组项是一条小剧场：可以是一个字符串；如果要分段，则该数组项可以是段落字符串数组，例如 ["第一段","第二段"]。',
      '5. 每个key只写该key对应场景的3条，禁止把record、super_good、super_bad、long_run等其他场景塞进score__normal或任何错误key里。',
      '6. 禁止遗漏任何key，禁止只输出第一个key或部分key，禁止用“同上”“省略”“略”等占位内容，禁止把缺失内容留给系统补齐。',
      '7. 禁止输出注释、解释、markdown、代码块、编号、尾随逗号、未转义换行。',
      '【输出骨架，必须按这个结构替换内容】\n' + theaterPackJsonSkeleton(jobs),
      '场景：\n' + sceneText,
      '单人游戏规则：如果场景key以score__开头，说明这是单人游戏结算，{{char}}只是观看和陪伴者，不是对手。禁止写{{char}}参与游戏、禁止写{{char}}赢、禁止写user输给{{char}}、禁止写双方平局。score__normal必须营造“游戏结束了，user表现不错/真厉害”的语气；score__record才写破纪录；score__super_bad才写很快失败；score__long_run才写持续很久。',
      '平局规则：如果结果=平局或场景key包含draw，平局就是平局，不是user失败，也不是{{char}}失败。必须写双方打平后的反应，例如想再来一场、互相试探、嘴硬、不服气、松口气、谁也没赢的调侃，禁止写成失败安慰。',
      '亲密氛围模式：' + intimacyText,
      '游戏：' + ((GAME_META[game] || {}).name || game),
      '规则说明：如果结果里出现“{{char}}赢”，表示当前角色获胜，也就是原先的角色获胜。',
      '角色描述：' + currentCharDescription(cfg),
      '世界背景：' + (selectedWorldText(cfg) || '无'),
      '大总结：' + (selectedSummaryText(cfg) || '无')
    ].filter(Boolean).join('\n');
  }
  function promptConfigForGame(game) {
    const cfg = settings();
    const select = qs('#wb-line-preset-select');
    let promptCfg = cfg;
    let preset = currentLinePreset(game);
	    if (select && select.value && select.value.indexOf('world::') === 0) {
	      const pr = worldPresets()[parseInt(select.value.slice(7), 10)];
	      if (pr) { preset = normalizePresetName(pr.name); promptCfg = rolePromptConfig(preset, cfg, pr); }
	    } else if (select && select.value) {
	      preset = normalizePresetName(select.value.replace(/^line::/, ''));
	      promptCfg = rolePromptConfig(preset, cfg);
	    }
    return { cfg: promptCfg, preset };
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
  function aiCallCountForGames(games, cfg) {
    if (!cfg.apiUrl || !cfg.apiModel) return 0;
    return games.length * 2;
  }
  function aiCallCountForBatchTasks(tasks, cfg, attempts) {
    if (!cfg.apiUrl || !cfg.apiModel) return 0;
    return (tasks || []).length * Math.max(1, parseInt(attempts, 10) || 1);
  }
  async function generateLineOnlyForGame(game, promptCfg, preset, roleName, onAiCall, options) {
    const opts = options || {};
    let data = null;
    let apiFailed = '';
    let rawOutput = '';
    const apiDebug = {};
    if (promptCfg.apiUrl && promptCfg.apiModel) {
      try { if (onAiCall) onAiCall(GAME_META[game].name + '语录'); data = await callLineApiBatches(promptCfg, game, apiDebug); rawOutput = JSON.stringify(data, null, 2); assertGeneratedLinesShape(game, data); }
      catch(apiErr) { apiFailed = apiErr && apiErr.message ? apiErr.message : '语录API失败'; rawOutput = apiErr && apiErr.rawOutput ? apiErr.rawOutput : ''; console.warn('[玩伴小屋] line API failed:', apiErr); }
    }
    const targetRole = normalizePresetName(roleName || companionName());
    const failKey = targetRole + '::' + game;
    if (apiFailed && opts.skipOnApiFailure) { lineGenerationFailures[failKey] = true; return { skipped:true, reason:apiFailed, output:rawOutput || apiFailed, debug:apiDebug }; }
    if (!data) data = fallbackGenerated(game, promptCfg);
    data = normalizeGeneratedLines(game, data, targetRole);
    delete lineGenerationFailures[failKey];
    saveRoleLineSetForName(game, targetRole, preset, data);
    if (targetRole === normalizePresetName(companionName())) setCurrentLinePreset(game, preset);
    return { ok:true, output:JSON.stringify(data, null, 2), source:rawOutput ? 'api' : 'fallback', debug:apiDebug };
  }
  async function generateLinesForGame(game, promptCfg, preset, roleName, onAiCall, shouldStop, options) {
    const lineResult = await generateLineOnlyForGame(game, promptCfg, preset, roleName, onAiCall, options);
    if (lineResult && lineResult.skipped) return lineResult;
    if (shouldStop && shouldStop()) return false;
    await preGenerateTheaters(game, promptCfg, onAiCall, roleName).catch(e => console.warn('[玩伴小屋] theater pregenerate failed:', e));
    return true;
  }
  function openBatchLineGenerator() {
    if (lineGenerationBusy) { if (lineGenerationKind === 'batch') requestBatchLineGenerationCancel(); else toast('已有角色数据生成任务正在进行'); return; }
    const doc = getHostDocument();
    const old = qs('#wb-batch-lines-mask', doc); if (old) old.remove();
	    const cfg = settings();
	    const games = Object.values(GAME_META).map(g => g.id);
	    const roleOptions = roleNamesForLineStorage();
	    const apis = apiPresets();
	    const apiSelectOptions = '<option value="default">默认：当前API设置</option>' + apis.map((x,i) => '<option value="' + i + '">' + esc(x.name || ('API预设' + (i + 1))) + '</option>').join('');
	    const savedAttempts = Math.max(1, Math.min(5, parseInt(cfg.batchAttempts, 10) || 1));
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-batch-lines-mask';
    const defaultLineTpl = promptTemplates().lineGeneration || PROMPT_TEMPLATES.lineGeneration || {};
    const defaultLinePromptText = [].concat(defaultLineTpl.header || [], defaultLineTpl.rules || [], defaultLineTpl.output || []).join('\n');
    const defaultTheaterPromptText = (promptTemplates().theater || PROMPT_TEMPLATES.theater).join('\n');
	    mask.innerHTML = '<div class="wb-modal wb-summary-modal"><div class="wb-modal-title">批量生成角色数据</div><label class="wb-field"><span>角色</span><select class="wb-select" id="wb-batch-role">' + roleOptions.map(name => '<option value="' + esc(name) + '">' + esc(name) + '</option>').join('') + '</select></label><div class="wb-preset-row"><label class="wb-field" style="flex:1;margin:0;"><span>语录 API</span><select class="wb-select" id="wb-batch-lines-api">' + apiSelectOptions + '</select></label><label class="wb-field" style="flex:1;margin:0;"><span>小剧场 API</span><select class="wb-select" id="wb-batch-theater-api">' + apiSelectOptions + '</select></label></div><label class="wb-field"><span>生成次数</span><input class="wb-input" id="wb-batch-attempts" type="number" min="1" max="5" step="1" value="' + savedAttempts + '"><div class="wb-muted">每项数据最多生成的总次数；失败才会继续下一次，成功后停止。</div></label><div class="wb-actions" style="margin-bottom:8px;"><button class="wb-btn" id="wb-batch-all" type="button">全选</button><button class="wb-btn" id="wb-batch-missing" type="button">全选未生成</button><button class="wb-btn" id="wb-batch-clear" type="button">全部取消</button></div><div class="wb-worldbook-list" id="wb-batch-game-list" style="display:grid;grid-template-columns:1fr;max-height:360px;"></div><div class="wb-field" style="margin-top:10px;"><label>语录提示词</label><textarea class="wb-textarea" id="wb-batch-line-prompt" style="min-height:110px;">' + esc(cfg.batchLinePromptOverride || defaultLinePromptText) + '</textarea><button class="wb-btn" id="wb-batch-line-restore" type="button">恢复默认语录提示词</button></div><div class="wb-field"><label>小剧场提示词</label><textarea class="wb-textarea" id="wb-batch-theater-prompt" style="min-height:110px;">' + esc(cfg.batchTheaterPromptOverride || defaultTheaterPromptText) + '</textarea><button class="wb-btn" id="wb-batch-theater-restore" type="button">恢复默认小剧场提示词</button></div><div class="wb-sticky-actions"><div class="wb-api-status" id="wb-batch-info">请选择要生成的数据。</div><div class="wb-actions" style="margin-top:8px;"><button class="wb-btn primary" id="wb-batch-start" style="flex:1;">生成并覆盖</button><button class="wb-btn" id="wb-batch-cancel">返回</button></div></div></div>';
	    appendModalMask(mask);
	    const linesApiSel = qs('#wb-batch-lines-api', mask);
	    const theaterApiSel = qs('#wb-batch-theater-api', mask);
	    if (linesApiSel && Array.from(linesApiSel.options).some(o => o.value === String(cfg.batchLinesApiChoice || 'default'))) linesApiSel.value = String(cfg.batchLinesApiChoice || 'default');
	    if (theaterApiSel && Array.from(theaterApiSel.options).some(o => o.value === String(cfg.batchTheaterApiChoice || 'default'))) theaterApiSel.value = String(cfg.batchTheaterApiChoice || 'default');
	    qs('#wb-batch-line-restore', mask).onclick = () => { qs('#wb-batch-line-prompt', mask).value = defaultLinePromptText; setSettings({ batchLinePromptOverride:'' }); };
	    qs('#wb-batch-theater-restore', mask).onclick = () => { qs('#wb-batch-theater-prompt', mask).value = defaultTheaterPromptText; setSettings({ batchTheaterPromptOverride:'' }); };
	    const linePromptBox = qs('#wb-batch-line-prompt', mask); if (linePromptBox) linePromptBox.oninput = () => setSettings({ batchLinePromptOverride: linePromptBox.value === defaultLinePromptText ? '' : linePromptBox.value });
	    const theaterPromptBox = qs('#wb-batch-theater-prompt', mask); if (theaterPromptBox) theaterPromptBox.oninput = () => setSettings({ batchTheaterPromptOverride: theaterPromptBox.value === defaultTheaterPromptText ? '' : theaterPromptBox.value });
	    const selectedRole = () => normalizePresetName(qs('#wb-batch-role', mask)?.value || companionName());
	    const selectedTasks = () => qsa('.wb-batch-part:checked', mask).map(x => ({ game:x.dataset.game, part:x.dataset.part }));
	    const selectedAttempts = () => Math.max(1, Math.min(5, parseInt(qs('#wb-batch-attempts', mask)?.value, 10) || 1));
	    const selectedApiConfig = part => {
	      const id = qs(part === 'theater' ? '#wb-batch-theater-api' : '#wb-batch-lines-api', mask)?.value || 'default';
	      const pr = id === 'default' ? null : apis[parseInt(id, 10)];
	      const api = pr || cfg;
	      return { apiUrl: api.apiUrl || '', apiKey: api.apiKey || '', apiModel: api.apiModel || '' };
	    };
	    const selectedCallCount = (tasks, attempts) => (tasks || []).filter(task => { const api = selectedApiConfig(task.part); return api.apiUrl && api.apiModel; }).length * Math.max(1, parseInt(attempts, 10) || 1);
	    const selectedApiName = part => {
	      const id = qs(part === 'theater' ? '#wb-batch-theater-api' : '#wb-batch-lines-api', mask)?.value || 'default';
	      if (id === 'default') return '默认';
	      const pr = apis[parseInt(id, 10)];
	      return pr ? (pr.name || '未命名API') : '默认';
	    };
	    let pendingBatch = null;
	    const resetBatchConfirm = () => { pendingBatch = null; const start = qs('#wb-batch-start', mask); if (start) start.textContent = '生成并覆盖'; };
	    const refresh = () => { resetBatchConfirm(); const tasks = selectedTasks(); const attempts = selectedAttempts(); const calls = selectedCallCount(tasks, attempts); const info = qs('#wb-batch-info', mask); if (info) info.textContent = tasks.length ? ('将覆盖“' + selectedRole() + '”的 ' + tasks.length + ' 项数据；每项最多生成 ' + attempts + ' 次；语录API：' + selectedApiName('lines') + '；小剧场API：' + selectedApiName('theater') + '；预计最多调用 AI ' + calls + ' 次。') : '请选择要生成的数据。'; };
    const renderGameList = () => {
      const role = selectedRole();
      const list = qs('#wb-batch-game-list', mask);
	      if (!list) return;
	      list.innerHTML = games.map(id => {
	        const lineStatus = roleLineStorageStatus(id, role);
	        const theaterStatus = roleTheaterStorageStatus(id, role);
	        return '<div class="wb-api-status" style="display:grid;gap:6px;"><div style="font-weight:700;">' + esc(GAME_META[id].name) + '</div><label class="wb-switch"><input type="checkbox" class="wb-batch-part" data-game="' + esc(id) + '" data-part="lines">语录 <span class="wb-muted" style="margin-left:6px;">' + esc(lineStatus) + '</span></label><label class="wb-switch"><input type="checkbox" class="wb-batch-part" data-game="' + esc(id) + '" data-part="theater">小剧场 <span class="wb-muted" style="margin-left:6px;">' + esc(theaterStatus) + '</span></label></div>';
	      }).join('');
	      qsa('.wb-batch-part', mask).forEach(x => x.onchange = refresh);
	      refresh();
	    };
	    qs('#wb-batch-all', mask).onclick = () => { qsa('.wb-batch-part', mask).forEach(x => x.checked = true); refresh(); };
	    qs('#wb-batch-missing', mask).onclick = () => {
	      const role = selectedRole();
	      qsa('.wb-batch-part', mask).forEach(x => {
		        x.checked = x.dataset.part === 'lines' ? roleLineStorageStatus(x.dataset.game, role) !== '已有' : roleTheaterStorageStatus(x.dataset.game, role) !== '已有';
	      });
	      refresh();
	    };
	    qs('#wb-batch-clear', mask).onclick = () => { qsa('.wb-batch-part', mask).forEach(x => x.checked = false); refresh(); };
    qs('#wb-batch-role', mask).onchange = renderGameList;
	    qs('#wb-batch-attempts', mask).oninput = () => { setSettings({ batchAttempts: selectedAttempts() }); refresh(); };
	    qs('#wb-batch-lines-api', mask).onchange = () => { setSettings({ batchLinesApiChoice: qs('#wb-batch-lines-api', mask).value || 'default' }); refresh(); };
	    qs('#wb-batch-theater-api', mask).onchange = () => { setSettings({ batchTheaterApiChoice: qs('#wb-batch-theater-api', mask).value || 'default' }); refresh(); };
    renderGameList();
    qs('#wb-batch-cancel', mask).onclick = () => mask.remove();
	    qs('#wb-batch-start', mask).onclick = async () => {
	      if (lineGenerationBusy) { if (lineGenerationKind === 'batch') requestBatchLineGenerationCancel(); else toast('已有角色数据生成任务正在进行'); return; }
	      if (!pendingBatch) {
	        const linePromptOverride = qs('#wb-batch-line-prompt', mask)?.value || '';
	        const theaterPromptOverride = qs('#wb-batch-theater-prompt', mask)?.value || '';
		        setSettings({ batchLinePromptOverride: linePromptOverride === defaultLinePromptText ? '' : linePromptOverride, batchTheaterPromptOverride: theaterPromptOverride === defaultTheaterPromptText ? '' : theaterPromptOverride, batchAttempts: selectedAttempts(), batchLinesApiChoice: qs('#wb-batch-lines-api', mask).value || 'default', batchTheaterApiChoice: qs('#wb-batch-theater-api', mask).value || 'default' });
	        const tasks = selectedTasks();
	        if (!tasks.length) { toast('请先选择要生成的数据'); return; }
	        const attempts = selectedAttempts();
	        const calls = selectedCallCount(tasks, attempts);
	        const role = selectedRole();
	        const lineApi = selectedApiConfig('lines');
	        const theaterApi = selectedApiConfig('theater');
	        pendingBatch = { tasks, calls, role, attempts, lineApi, theaterApi, linePromptOverride, theaterPromptOverride, lineApiName:selectedApiName('lines'), theaterApiName:selectedApiName('theater') };
	        const info = qs('#wb-batch-info', mask); if (info) info.textContent = '确认覆盖“' + role + '”的 ' + tasks.length + ' 项数据，每项最多生成 ' + attempts + ' 次；语录API：' + pendingBatch.lineApiName + '；小剧场API：' + pendingBatch.theaterApiName + '；预计最多调用 AI ' + calls + ' 次。再次点击确认生成。';
	        const btn = qs('#wb-batch-start', mask); if (btn) btn.textContent = '确认生成';
	        return;
	      }
	      const tasks = pendingBatch.tasks.slice();
	      const calls = pendingBatch.calls;
	      const role = pendingBatch.role;
	      const attempts = Math.max(1, pendingBatch.attempts || 1);
	      const lineApi = pendingBatch.lineApi || {};
	      const theaterApi = pendingBatch.theaterApi || {};
	      const linePromptOverride = pendingBatch.linePromptOverride || '';
	      const theaterPromptOverride = pendingBatch.theaterPromptOverride || '';
	      const taskTotal = tasks.length;
	      let taskDone = 0;
	      pendingBatch = null;
	        const btn = qs('#wb-batch-start', mask); if (btn) { btn.disabled = false; btn.textContent = '中断生成'; }
		        const preset = normalizePresetName(role);
		        const basePromptCfg = rolePromptConfig(role, cfg, { linePromptOverride, theaterPromptOverride });
	        const setInfo = text => { const info = qs('#wb-batch-info', mask); if (info) info.textContent = text; };
	        const batchStatus = (label, attempt) => {
	          const text = '正在批量生成数据：' + Math.min(taskDone + 1, taskTotal) + '/' + taskTotal + '（' + label + '，第' + (attempt + 1) + '/' + attempts + '次）';
	          setLineGenerationStatus(text, true);
	          setInfo(text);
	        };
	        const progress = () => {};
	        progress.done = () => taskDone;
	        const skipped = [];
	        batchGenerationDebug = [];
        lineGenerationKind = 'batch';
        batchLineGenerationCancel = false;
        setLineGenerationStatus(taskTotal ? '正在批量生成数据：0/' + taskTotal : '正在批量生成数据：离线生成', true);
	        setInfo(lineGenerationStatus);
	        if (mask.parentNode) mask.remove();
	        if (currentTab === 'settings') renderSettings();
	        try {
	          const runTask = async (task, label, debugItem) => {
	            const attemptLogs = [];
	            let last = false;
	            for (let attempt = 0; attempt < attempts; attempt++) {
	              if (batchLineGenerationCancel) return false;
	              const attemptLabel = label + ' 第' + (attempt + 1) + '次';
	              batchStatus(label, attempt);
	              if (debugItem) {
	                debugItem.ok = false;
	                debugItem.reason = '生成中';
	                debugItem.output = attemptLogs.concat(['【第' + (attempt + 1) + '次】生成中...']).join('\n\n');
	              }
	              const taskCfg = Object.assign({}, basePromptCfg, task.part === 'lines' ? lineApi : theaterApi);
	              last = task.part === 'lines'
	                ? await generateLineOnlyForGame(task.game, taskCfg, preset, role, progress, { skipOnApiFailure:true })
	                : await preGenerateTheaters(task.game, taskCfg, progress, role, { skipOnApiFailure:true });
	              if (debugItem && last && last.debug) {
	                debugItem.inputTokensTotal = (debugItem.inputTokensTotal || 0) + (last.debug.inputTokensActual || last.debug.inputTokensEstimated || 0);
	                debugItem.durationMsTotal = (debugItem.durationMsTotal || 0) + (last.debug.durationMs || 0);
	              }
	              attemptLogs.push('【第' + (attempt + 1) + '次】' + ((last && last.skipped) ? '失败：' + (last.reason || '未知失败') : (last === false ? '中断' : '成功')) + '\n' + (formatApiDebugMeta(last && last.debug) || '输入token：无\n输出时间：无') + '\n输出：\n' + ((last && last.output) || '无输出'));
	              if (debugItem) debugItem.output = attemptLogs.join('\n\n');
	              if (!(last && last.skipped) || last === false) break;
	            }
	            if (last && typeof last === 'object') last.output = attemptLogs.join('\n\n');
	            return last;
	          };
	          for (let i = 0; i < tasks.length; i++) {
	            if (batchLineGenerationCancel) break;
	            const task = tasks[i];
	            const label = GAME_META[task.game].name + (task.part === 'lines' ? '语录' : '小剧场');
	            setLineGenerationStatus('正在批量生成数据：' + taskDone + '/' + taskTotal + '（准备生成' + label + '）', true);
	            const debugItem = { label, game:task.game, part:task.part, ok:false, reason:'等待生成', inputTokensTotal:0, durationMsTotal:0, output:'等待开始' };
	            batchGenerationDebug.push(debugItem);
	            let completed = await runTask(task, label, debugItem);
	            if (completed !== false) taskDone++;
	            debugItem.ok = !(completed && completed.skipped) && completed !== false;
	            debugItem.reason = (completed && completed.reason) || (completed === false ? '已中断或未完成' : '');
	            debugItem.output = (completed && completed.output) || (completed === false ? '已中断或未完成' : '已成功，但没有返回调试输出');
	            if (completed && completed.skipped) skipped.push(label + (completed.reason ? '（' + completed.reason + '）' : ''));
	            if (batchLineGenerationCancel || completed === false) break;
	          }
          if (batchLineGenerationCancel) {
            const done = taskDone;
            setLineGenerationStatus(taskTotal ? ('批量生成已中断：' + done + '/' + taskTotal) : '批量生成已中断', false);
            toast('批量生成已中断，已完成的游戏语录已保存');
          } else {
            const done = taskDone;
            setLineGenerationStatus(taskTotal ? ('批量生成完成：' + done + '/' + taskTotal + (skipped.length ? '，失败 ' + skipped.length + ' 个' : '')) : '批量生成完成：离线生成', false);
            toast(skipped.length ? ('批量生成完成，失败：' + skipped.join('、')) : '批量语录已生成并覆盖');
          }
        } catch(e) {
          console.error('[玩伴小屋] batch generate lines failed:', e);
          setLineGenerationStatus('批量生成失败：' + (e && e.message ? e.message : '响应无法解析'), false);
          toast('批量生成失败：' + (e && e.message ? e.message : '响应无法解析'));
        } finally {
          lineGenerationKind = '';
          batchLineGenerationCancel = false;
          updateLineGenerationStatusUI();
          if (currentTab === 'settings') renderSettings();
        }
	        if (mask.parentNode) renderGameList();
	    };
  }
  function startJump(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<div class="wb-jump-shell"><canvas class="wb-canvas wb-jump-canvas" id="wb-jump" width="520" height="640"></canvas><div class="wb-jump-help">长按空格/屏幕蓄力</div></div>';
    const c = qs('#wb-jump'), ctx = c.getContext('2d');
    const W = 520, H = 640;
    let score = state?.score || 0;
    let seen = state?.seen || {};
    let dead = false;
    let charging = false;
    let charge = 0;
    let chargeDir = 1;
    let flight = null;
    let transition = null;
    let particles = [];
    let platforms = Array.isArray(state?.platforms) && state.platforms.length >= 2 ? state.platforms : [
      makePlatform(170, 440, 0),
      makePlatform(330, 275, 1)
    ];
    let player = state?.player || { x: platforms[0].x, y: standY(platforms[0]), z: 0 };
    const heroStand = loadJumpHero(JUMP_STAND_URL), heroDown = loadJumpHero(JUMP_DOWN_URL);
    if (state?.player && Math.abs(player.y - standY(platforms[0])) > 28 && !state?.flight) player.y = standY(platforms[0]);
    setScore('jump', score);
    if (!seen.start) { seen.start = 1; }
    function standY(p) { return p.y - 8; }
    function loadJumpHero(src){ const img = new Image(); img.onload = draw; img.src = src; return img; }
    function makePlatform(x, y, i) {
      const colors = themePlatformColors();
      return { x, y, r: 38 + Math.floor(Math.random() * 18), h: 46 + Math.floor(Math.random() * 22), c: colors[i % colors.length], kind: i % colors.length };
    }
    function themePlatformColors() {
      const t = settings().theme || 'day';
      if(t === 'spring') return ['#B77B42','#8FBF68','#D8B15E','#78A6C8','#A7784F'];
      if(t === 'cyber') return ['#F1E85B','#19D3C5','#FF4FA3','#FF8A3D','#8B6BFF'];
      if(t === 'night') return ['#8B6BFF','#FF4FA3','#19D3C5','#F1E85B','#6f7dff'];
      return ['#f2a7c2','#8dc7ee','#f5c66f','#a6d58b','#c6a0e8'];
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
      if (dead || gamePaused || flight || transition || charging) return;
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
      const ex = player.x + vx * ratio, ey = player.y + vy * ratio;
      const willMiss = Math.hypot(ex - to.x, ey - standY(to)) > to.r * .72;
      if (!seen.gameover && willMiss) { seen.gameover = 1; speak('jump', 'gameover'); }
      flight = {
        t: 0,
        sx: player.x,
        sy: player.y,
        ex,
        ey,
        target: to
      };
      if (!willMiss && !seen.jump) { seen.jump = 1; }
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
        emitLanding(player.x, player.y, perfect);
        if ([10,20,30,40].includes(score) && !seen['score_' + score]) { seen['score_' + score] = 1; speak('jump', 'score_' + score); }
        if (score >= 50 && score % 10 === 0 && !seen['score_' + score]) { seen['score_' + score] = 1; speak('jump', 'score_50_plus'); }
        platforms = [to, nextPlatform(to, score)];
        transition = { t: 0, dx: 170 - platforms[0].x, dy: 440 - platforms[0].y };
      } else {
        dead = true;
        clearInterval(jumpTimer);
        jumpTimer = null;
        if (!seen.gameover) speak('jump', 'gameover');
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
        } else if (transition) {
          transition.t = Math.min(1, transition.t + .055);
          if (transition.t >= 1) {
            platforms.forEach(p => { p.x += transition.dx; p.y += transition.dy; });
            player.x += transition.dx;
            player.y += transition.dy;
            transition = null;
            player.x = platforms[0].x;
            player.y = standY(platforms[0]);
            save();
          }
        }
        updateParticles();
      }
      draw();
    }
    function ease(t){ return 1 - Math.pow(1 - t, 3); }
    function emitLanding(x,y,perfect){
      const count = perfect ? 22 : 12;
      const colors = settings().theme === 'cyber' ? ['#F1E85B','#19D3C5','#FF4FA3'] : (settings().theme === 'spring' ? ['#E3C56A','#6FA85A','#D97B54'] : ['#fff1a8','#f2a7c2','#8dc7ee']);
      for(let i=0;i<count;i++){
        const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * (perfect ? 3.6 : 2.2);
        particles.push({ x, y:y-20, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp - 1.5, life:perfect?34:24, max:perfect?34:24, c:colors[i%colors.length], s:perfect?3.8:2.8 });
      }
    }
    function updateParticles(){
      particles = particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += .12; p.life--;
        return p.life > 0;
      });
    }
    function drawBlock(p) {
      const night = isNightTheme();
      const spring = settings().theme === 'spring';
      const cyber = settings().theme === 'cyber';
      const topH = p.r * .42, bottomY = p.y + p.h;
      ctx.save();
      ctx.fillStyle = night ? 'rgba(0,0,0,.46)' : 'rgba(65,45,35,.18)';
      ctx.beginPath();
      ctx.ellipse(p.x + 7, bottomY + topH * .48, p.r * 1.15, topH * .68, 0, 0, Math.PI * 2);
      ctx.fill();
      const baseColor = spring ? (p.kind % 2 ? '#8FBF68' : '#A66E3D') : p.c;
      const side = ctx.createLinearGradient(p.x - p.r, p.y, p.x + p.r, bottomY);
      side.addColorStop(0, shade(baseColor, night ? -.26 : -.16));
      side.addColorStop(.5, shade(baseColor, night ? -.08 : .02));
      side.addColorStop(1, shade(baseColor, night ? -.48 : -.32));
      ctx.fillStyle = side;
      ctx.beginPath();
      ctx.moveTo(p.x - p.r, p.y);
      ctx.quadraticCurveTo(p.x, p.y + topH, p.x + p.r, p.y);
      ctx.lineTo(p.x + p.r, p.y + p.h);
      ctx.quadraticCurveTo(p.x, bottomY + topH, p.x - p.r, bottomY);
      ctx.closePath();
      ctx.fill();
      if(spring){
        ctx.strokeStyle=p.kind % 2 ? 'rgba(76,93,42,.32)' : 'rgba(92,54,25,.36)';
        ctx.lineWidth=1.4;
        for(let y=p.y+12;y<bottomY;y+=14){
          ctx.beginPath(); ctx.moveTo(p.x-p.r+9,y); ctx.quadraticCurveTo(p.x,y+5,p.x+p.r-9,y-2); ctx.stroke();
        }
      } else if(!night) {
        ctx.fillStyle='rgba(255,255,255,.18)';
        ctx.beginPath();
        ctx.moveTo(p.x-p.r*.72,p.y+12);
        ctx.quadraticCurveTo(p.x-p.r*.28,p.y+32,p.x-p.r*.54,bottomY-8);
        ctx.lineTo(p.x-p.r*.36,bottomY-2);
        ctx.quadraticCurveTo(p.x-p.r*.08,p.y+34,p.x-p.r*.42,p.y+10);
        ctx.fill();
      }
      const top = ctx.createRadialGradient(p.x - p.r * .35, p.y - p.r * .18, 5, p.x, p.y, p.r);
      top.addColorStop(0, shade(p.c, night ? .12 : .26));
      top.addColorStop(1, spring ? (p.kind % 2 ? '#A9D97B' : '#D2A05E') : p.c);
      ctx.fillStyle = top;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, topH, 0, 0, Math.PI * 2);
      ctx.fill();
      if(cyber){
        ctx.strokeStyle='rgba(241,232,91,.7)';
        ctx.lineWidth=3;
        ctx.shadowColor='rgba(25,211,197,.42)';
        ctx.shadowBlur=12;
      } else {
        ctx.strokeStyle = night ? 'rgba(255,255,255,.25)' : 'rgba(57,44,38,.25)';
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.shadowBlur=0;
      if(spring && p.kind % 2 === 0){
        ctx.strokeStyle='rgba(89,53,26,.5)';
        ctx.lineWidth=1.7;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r*.55, topH*.5, 0, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(p.x + p.r*.1, p.y + 1, p.r*.28, topH*.24, .18, 0, Math.PI*2); ctx.stroke();
      } else if(!night){
        ctx.fillStyle='rgba(255,255,255,.24)';
        ctx.beginPath(); ctx.ellipse(p.x-p.r*.25,p.y-p.r*.08,p.r*.35,p.r*.12,-.08,0,Math.PI*2); ctx.fill();
      } else {
        ctx.strokeStyle=cyber?'rgba(25,211,197,.52)':'rgba(244,194,215,.35)';
        ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.ellipse(p.x,p.y,p.r*.72,p.r*.27,0,0,Math.PI*2); ctx.stroke();
      }
      if(spring){
        ctx.fillStyle='#6FA85A';
        for(const g of [[-p.r-8,12],[-p.r+4,8],[p.r-8,11],[p.r+3,7]]){
          ctx.beginPath();
          ctx.moveTo(p.x+g[0], bottomY + topH*.55);
          ctx.quadraticCurveTo(p.x+g[0]+5, bottomY + topH*.55 - g[1], p.x+g[0]+11, bottomY + topH*.55);
          ctx.closePath(); ctx.fill();
        }
      }
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
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath();
      ctx.ellipse(player.x, player.y + 8, 21 + press * 10, 7 + press * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      const img = (charging || flight) ? heroDown : heroStand;
      if(img && img.complete && img.naturalWidth){
        const baseH = 72, baseW = Math.max(42, baseH * img.naturalWidth / img.naturalHeight);
        const sx = 1 + press * .13, sy = 1 - press * .23;
        ctx.translate(x, footY);
        if(flight) ctx.rotate(Math.sin(Math.PI * flight.t) * .12);
        ctx.scale(sx, sy);
        ctx.drawImage(img, -baseW / 2, -baseH + 2, baseW, baseH);
      } else {
        ctx.font='42px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('⭐', x, footY - 26);
      }
      ctx.textAlign='start';
      ctx.textBaseline='alphabetic';
      ctx.restore();
    }
    function drawParticles(){
      for(const p of particles){
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function drawChargeFx(){
      if(!charging || flight) return;
      const night = isNightTheme();
      const ring = 26 + charge * 42;
      ctx.save();
      ctx.strokeStyle = settings().theme === 'cyber' ? 'rgba(241,232,91,.68)' : (settings().theme === 'spring' ? 'rgba(217,123,84,.62)' : 'rgba(240,138,108,.58)');
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(player.x, player.y + 10, ring, ring * .28, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = night ? 'rgba(25,211,197,.12)' : 'rgba(255,255,255,.32)';
      ctx.beginPath(); ctx.ellipse(player.x, player.y + 10, ring * .76, ring * .2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function drawJumpBackdrop(pal){
      const t = settings().theme || 'day';
      if(t === 'spring'){
        const earth=ctx.createLinearGradient(0,500,0,H);
        earth.addColorStop(0,'rgba(216,237,178,.18)');
        earth.addColorStop(1,'rgba(111,168,90,.28)');
        ctx.fillStyle=earth;
        ctx.fillRect(0,500,W,140);
        ctx.fillStyle='rgba(111,168,90,.16)';
        ctx.beginPath(); ctx.ellipse(86,546,126,32,0,0,Math.PI*2); ctx.ellipse(355,585,190,42,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(122,103,82,.22)';
        ctx.lineWidth=4;
        for(let x=18;x<W;x+=52){ ctx.beginPath(); ctx.moveTo(x,558); ctx.lineTo(x+30,538); ctx.stroke(); }
        for(let x=28;x<W;x+=42){
          const y=592 + (x % 3) * 8;
          ctx.fillStyle=x % 84 ? 'rgba(111,168,90,.55)' : 'rgba(217,123,84,.72)';
          ctx.beginPath();
          ctx.moveTo(x,y);
          ctx.quadraticCurveTo(x+5,y-18,x+12,y);
          ctx.quadraticCurveTo(x+7,y-8,x,y);
          ctx.fill();
          if(x % 84 === 0){ ctx.beginPath(); ctx.arc(x+9,y-14,3,0,Math.PI*2); ctx.fill(); }
        }
        ctx.fillStyle='rgba(125,185,216,.22)';
        ctx.beginPath(); ctx.arc(410,118,38,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.58)';
        for(const cloud of [[100,104,44],[306,78,36],[438,174,30]]){
          ctx.beginPath(); ctx.ellipse(cloud[0],cloud[1],cloud[2],12,0,0,Math.PI*2); ctx.ellipse(cloud[0]+24,cloud[1]+4,cloud[2]*.7,10,0,0,Math.PI*2); ctx.ellipse(cloud[0]-20,cloud[1]+5,cloud[2]*.52,9,0,0,Math.PI*2); ctx.fill();
        }
        return;
      }
      if(t === 'cyber' || t === 'night'){
        const floor=ctx.createLinearGradient(0,500,0,H);
        floor.addColorStop(0,'rgba(25,211,197,.02)');
        floor.addColorStop(1,t === 'cyber' ? 'rgba(25,211,197,.12)' : 'rgba(139,107,255,.1)');
        ctx.fillStyle=floor;
        ctx.fillRect(0,500,W,140);
        ctx.strokeStyle = t === 'cyber' ? 'rgba(25,211,197,.16)' : 'rgba(244,194,215,.1)';
        ctx.lineWidth=1;
        for(let y=120;y<620;y+=34){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y-42); ctx.stroke(); }
        for(let x=-80;x<W+100;x+=50){ ctx.beginPath(); ctx.moveTo(x,640); ctx.lineTo(x+180,180); ctx.stroke(); }
        ctx.strokeStyle = t === 'cyber' ? 'rgba(241,232,91,.18)' : 'rgba(255,79,163,.12)';
        for(let y=528;y<640;y+=22){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
        ctx.fillStyle = t === 'cyber' ? 'rgba(241,232,91,.16)' : 'rgba(255,79,163,.12)';
        for(let i=0;i<18;i++){ const x=(i*73)%W, y=48+(i*97)%500; ctx.fillRect(x,y,3+(i%3)*2,3); }
        ctx.strokeStyle = t === 'cyber' ? 'rgba(241,232,91,.22)' : 'rgba(139,107,255,.18)';
        ctx.lineWidth=3;
        ctx.beginPath(); ctx.roundRect(32,104,W-64,426,18); ctx.stroke();
        return;
      }
      const floor=ctx.createLinearGradient(0,502,0,H);
      floor.addColorStop(0,'rgba(255,255,255,.05)');
      floor.addColorStop(1,'rgba(216,112,147,.18)');
      ctx.fillStyle=floor;
      ctx.fillRect(0,502,W,138);
      ctx.fillStyle='rgba(255,255,255,.5)';
      for(const cloud of [[88,98,42],[348,78,48],[442,168,32]]){
        ctx.beginPath(); ctx.ellipse(cloud[0],cloud[1],cloud[2],13,0,0,Math.PI*2); ctx.ellipse(cloud[0]+25,cloud[1]+5,cloud[2]*.68,10,0,0,Math.PI*2); ctx.ellipse(cloud[0]-20,cloud[1]+5,cloud[2]*.52,9,0,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='rgba(242,167,194,.28)';
      for(let x=24;x<W;x+=48){
        const y=594 + (x % 4) * 6;
        ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+7,y-5,2.8,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='rgba(216,112,147,.12)';
      for (let i = 0; i < 7; i++) {
        const x = 40 + i * 88, y = 130 + (i % 3) * 42;
        ctx.beginPath(); ctx.ellipse(x, y, 45, 12, -.12, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle='rgba(245,198,111,.18)';
      ctx.beginPath(); ctx.arc(430,108,35,0,Math.PI*2); ctx.fill();
    }
    function drawHud() {
      const night = isNightTheme();
      const pal = canvasThemePalette();
      ctx.fillStyle = night ? 'rgba(255,255,255,.86)' : pal.text;
      ctx.font = '700 24px system-ui, -apple-system, sans-serif';
      ctx.fillText(String(score), 28, 42);
      ctx.font = '500 15px system-ui, -apple-system, sans-serif';
      ctx.fillText(charging ? '松手起跳' : '按住蓄力', 28, 68);
      ctx.fillStyle = night ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.12)';
      ctx.fillRect(28, 84, 150, 8);
      ctx.fillStyle = settings().theme === 'cyber' ? '#FF8A3D' : (settings().theme === 'spring' ? '#D97B54' : '#f08a6c');
      ctx.fillRect(28, 84, 150 * charge, 8);
    }
    function draw() {
      const night = isNightTheme();
      const pal = canvasThemePalette();
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, pal.top);
      bg.addColorStop(.64, pal.mid);
      bg.addColorStop(1, pal.bottom);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      drawJumpBackdrop(pal);
      const tx = transition ? ease(transition.t) * transition.dx : 0;
      const ty = transition ? ease(transition.t) * transition.dy : 0;
      ctx.save();
      ctx.translate(tx, ty);
      platforms.slice().sort((a,b)=>a.y-b.y).forEach(drawBlock);
      drawChargeFx();
      drawPlayer();
      drawParticles();
      ctx.restore();
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

  function init() { addMenuItem(); bindMessageNotifyEvents(); syncFloatingBall(); }

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
    setSettings({ injectUserDesc: qs('#wb-inject-user-desc').checked, injectCharDesc: qs('#wb-inject-char-desc').checked, injectChat: qs('#wb-inject-chat').checked, userPersona: qs('#wb-user-persona').value.trim(), charName: (qs('#wb-char-name') && qs('#wb-char-name').value.trim()) || '{{char}}', avatarUrl: qs('#wb-avatar-url') ? qs('#wb-avatar-url').value.trim() : '', summaryId: qs('#wb-summary-select').value || '', selectedWorldEntries: selectedWorldEntriesFromUI(), selectedWorldPresetName: selectedWorldPresetNameFromUI() });
    toast('注入设置已保存'); render();
  }
  function saveWorldPresetFromUI() {
    const name = roleNameFromWorldUI();
    const nameInput = qs('#wb-char-name');
    if (nameInput && !nameInput.value.trim()) nameInput.value = name;
    const arr = worldPresets().filter(x => normalizePresetName(x && x.name) !== name);
    arr.unshift(worldPresetSnapshotFromUI(name));
    saveWorldPresets(arr);
    setSettings({ charName: name, selectedWorldPresetName: name });
    toast('已保存当前角色配置：' + name);
    renderSettings();
  }
  function resetCurrentWorldDefaultFromUI() {
    const name = normalizePresetName(companionName());
    showConfirm('恢复当前角色卡默认', '确定将当前世界观注入设置恢复为“' + name + '”的角色卡默认内容吗？已保存的角色和世界观预设不会被删除，前置提示词 / 破限词会保留。', () => {
      const keepBreak = qs('#wb-break-limit-prompt') ? qs('#wb-break-limit-prompt').value.trim() : (settings().breakLimitPrompt || '');
      setSettings({
        injectCharDesc: true,
        charDescMode: 'auto',
        manualCharPersona: '',
        charName: '{{char}}',
        charDescriptionSnapshot: '',
        avatarUrl: '',
        summaryId: '',
        summarySnapshot: null,
        selectedWorldEntries: [],
        selectedWorldPresetName: '',
        breakLimitPrompt: keepBreak
      });
      renderSettings();
      toast('已恢复当前角色卡默认配置');
    });
  }
  async function loadWorldPresetFromUI() {
    const idx = parseInt(qs('#wb-world-preset').value, 10);
    const pr = worldPresets()[idx];
    if (!pr) { setSettings({ selectedWorldPresetName: '' }); return; }
    qs('#wb-inject-user-desc').checked = pr.injectUserDesc !== false;
    qs('#wb-inject-char-desc').checked = pr.injectCharDesc !== false;
    qs('#wb-inject-chat').checked = !!pr.injectChat;
    const im = qs('#wb-intimacy-mode'); if (im) im.checked = !!pr.intimacyMode;
    const bp = qs('#wb-break-limit-prompt'); if (bp) bp.value = pr.breakLimitPrompt || '';
    qs('#wb-user-persona').value = pr.userPersona || '';
    const cm2 = qs('#wb-char-desc-mode'); if (cm2) cm2.value = pr.charDescMode === 'manual' ? 'manual' : 'auto';
    const mp2 = qs('#wb-manual-char-persona'); if (mp2) mp2.value = pr.manualCharPersona || '';
    const mw2 = qs('#wb-manual-char-wrap'); if (mw2 && cm2) mw2.style.display = cm2.value === 'manual' ? '' : 'none';
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
      charDescMode: qs('#wb-char-desc-mode') ? qs('#wb-char-desc-mode').value : 'auto',
      manualCharPersona: qs('#wb-manual-char-persona') ? qs('#wb-manual-char-persona').value.trim() : '',
      charName: (qs('#wb-char-name') && qs('#wb-char-name').value.trim()) || '{{char}}',
      charDescriptionSnapshot: pr.charDescriptionSnapshot || '',
      avatarUrl: qs('#wb-avatar-url') ? qs('#wb-avatar-url').value.trim() : '',
      summaryId: qs('#wb-summary-select').value || '',
      summarySnapshot: pr.summarySnapshot || null,
      selectedWorldEntries: matched,
      selectedWorldPresetName: normalizePresetName(pr.name || qs('#wb-char-name')?.value || companionName())
    });
    applyRoleToAllGames(normalizePresetName(pr.name || qs('#wb-char-name')?.value || companionName()));
    const preview = qs('#wb-char-desc-preview'); if (preview) preview.textContent = currentCharDescription(settings());
    toast('角色和世界观已按保存快照载入');
  }
  function deleteWorldPresetFromUI() { const idx=parseInt(qs('#wb-world-preset').value,10); const arr=worldPresets(); if(!arr[idx]) return; showConfirm('删除角色和世界观','确定删除这个角色和世界观预设吗？',()=>{ arr.splice(idx,1); saveWorldPresets(arr); renderSettings(); }); }

  function renderGame(id) {
    stopGame();
    currentGame = id;
    currentRoundLineEvents = [];
    currentRoundTheaterInfo = null;
    if (GAME_META[id]) currentTab = GAME_META[id].mode;
    saveWindowState(currentTab, id);
    syncPopupModeClass();
    const g = GAME_META[id]; const cfg = settings(); const body = qs('#wb-body'); body.className = 'wb-body wb-game-mode';
    const lineTools = cfg.companion ? '<div class="wb-line-tools"><select class="wb-select" id="wb-line-preset-select"></select><button class="wb-btn primary" id="wb-generate-lines">生成</button></div>' : '';
    const pauseBtn = g.mode === 'double' ? '' : '<button class="wb-btn" id="wb-pause">暂停</button>';
    const companionPanel = cfg.companion ? '<div class="wb-panel wb-side-companion">' + companionHTML() + '</div>' : '';
    body.innerHTML = '<div class="wb-layout ' + (cfg.companion ? '' : 'no-companion') + '"><div class="wb-panel"><div class="wb-toolbar"><button class="wb-btn" id="wb-back">返回</button><div class="wb-stat"><span class="wb-pill wb-title-row"><span class="wb-game-title-text">' + esc(g.name) + '</span><button class="wb-rule-btn" id="wb-game-rules" title="游戏介绍" aria-label="游戏介绍" type="button">💡</button></span><span class="wb-pill" id="wb-score">本局：0</span><span class="wb-pill" id="wb-high">' + esc(scoreDisplay(id)) + '</span></div><div class="wb-actions">' + lineTools + '<button class="wb-btn" id="wb-game-records">记录</button>' + pauseBtn + '<button class="wb-btn" id="wb-restart">重开</button></div></div><div class="wb-board-wrap wb-gamebox-' + esc(id) + '" id="wb-gamebox"><div class="wb-start-cover"><div>准备开始</div><button class="wb-btn primary" id="wb-start-cover-btn">开始游戏</button></div></div></div>' + companionPanel + '</div>';
    primeMessageNotifyBaseline();
    gameStarted = false; gamePaused = true;
    qs('#wb-back').onclick = () => { stopGame(); currentGame = null; saveWindowState(currentTab, ''); syncPopupModeClass(); renderSelect(currentTab); };
    qs('#wb-start-cover-btn').onclick = () => startCurrentGame(id);
    qs('#wb-game-rules').onclick = e => { e.stopPropagation(); showGameRules(id); };
    qs('#wb-game-records').onclick = () => showGameRecords(id);
    const pbtn = qs('#wb-pause'); if (pbtn) pbtn.onclick = togglePause;
    qs('#wb-restart').onclick = () => { commitGameActiveDuration(true); gamePaused = true; showGamePauseOverlay(); const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '继续'; showConfirm('确认重开', '确定要重开当前游戏吗？当前进度会丢失。', () => { clearProgress(id); renderGame(id); }, () => startPauseResumeCountdown()); };
    renderLinePresetSelect(id);
    const presetSelect = qs('#wb-line-preset-select'); if (presetSelect) presetSelect.onchange = () => applyLinePresetSelection(id, presetSelect.value);
    const genBtn = qs('#wb-generate-lines'); if (genBtn) genBtn.onclick = () => openSingleGenerateChoice(id);
    updateLineGenerationStatusUI();
    if (!needsFirstMoverChoice(id) && DEFAULT_LINES[id] && DEFAULT_LINES[id].start) speak(id, 'start');
    setTimeout(() => { const saved = gameProgress(id); if (currentGame === id && saved && hasPlayableProgress(id, saved) && !gameStarted) showProgressChoice(id, saved); }, 60);
  }

  function startCurrentGame(id, savedState) {
    if (gameStarted) return;
    const storedState = gameProgress(id);
    const resumeState = savedState || (storedState && hasPlayableProgress(id, storedState) ? storedState : null);
    if (!resumeState && needsFirstMoverChoice(id)) {
      clearProgress(id);
      showFirstMoverChoice(id, firstMover => startCurrentGame(id, { firstMover }));
      return;
    }
    if (!resumeState) clearProgress(id);
    gameStarted = true;
    gamePaused = false;
    firstMoverAwaitingUserAction = !!(needsFirstMoverChoice(id) && savedState && savedState.firstMover && !storedState && !savedState.userActed);
    gameAccumulatedMs = Math.max(0, Number(resumeState?.durationMs || 0));
    gameActiveStartedAt = Date.now();
    hideGamePauseOverlay();
    currentRoundRecord = false;
    currentRoundLineEvents = Array.isArray(resumeState?.lineEvents) ? resumeState.lineEvents.slice(-120) : [];
    currentRoundTheaterInfo = null;
    gameStartAt = Date.now();
    const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '暂停';
    const coverBtn = qs('#wb-start-cover-btn'); if (coverBtn) coverBtn.style.display = 'none';
    if (randomLineTimer) clearInterval(randomLineTimer);
    lastDialogueAt = Date.now();
    randomLineTimer = setInterval(() => {
      if (currentGame && gameStarted && !gamePaused && Date.now() - lastDialogueAt >= 10000) speak(currentGame, 'random');
    }, 1000);
    if (id === 'snake') startSnake(resumeState);
    if (id === 'jump') startJump(resumeState);
    if (id === 'plank') startPlank(resumeState);
    if (id === 'sudoku') startSudoku(resumeState);
    if (id === 'game2048') start2048(resumeState);
    if (id === 'watermelon') startWatermelon(resumeState);
    if (id === 'memory') startMemory(resumeState);
    if (id === 'ludo') startLudo(resumeState);
    if (id === 'guessnumber') startGuessNumber(resumeState);
    if (id === 'wordguess') startWordGuess(resumeState).catch(e => { console.warn('[玩伴小屋] wordguess start failed:', e); toast('我说你猜加载失败，已尝试重新生成题目'); startWordGuess(null).catch(err => console.error('[玩伴小屋] wordguess fallback failed:', err)); });
    if (id === 'tictactoe') startTicTacToe(resumeState);
    if (id === 'gomoku') startGomoku(resumeState);
    if (id === 'territory') startTerritory(resumeState);
    if (id === 'oldmaid') startOldMaid(resumeState);
    if (id === 'reversi') startReversi(resumeState);
    if (id === 'bombnumber') startBombNumber(resumeState);
    if (id === 'connect4d') startConnect4D(resumeState);
    if (id === 'tetris') startTetris(resumeState);
    scheduleFitGameSurface();
  }
  function togglePause() {
    if (!gameStarted) return;
    if (!gamePaused) {
      commitGameActiveDuration(true);
      gamePaused = true;
      showGamePauseOverlay();
      const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '继续';
      return;
    }
    startPauseResumeCountdown();
  }
  function showConfirm(title, message, onConfirm, onCancel) {
    const doc = getHostDocument();
    const old = qs('#wb-confirm-mask', doc); if (old) old.remove();
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-confirm-mask';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">' + esc(title) + '</div><div style="margin-bottom:14px;line-height:1.7;">' + esc(message) + '</div><div class="wb-actions"><button class="wb-btn primary" id="wb-confirm-ok">确定</button><button class="wb-btn" id="wb-confirm-cancel">取消</button></div></div>';
    appendModalMask(mask);
    qs('#wb-confirm-ok', mask).onclick = () => { mask.remove(); onConfirm && onConfirm(); };
    qs('#wb-confirm-cancel', mask).onclick = () => { mask.remove(); if (onCancel) onCancel(); };
  }

  function needsFirstMoverChoice(game) { return FIRST_MOVER_GAMES.includes(game); }
  function speakFirstMover(game, firstMover) { speak(game, firstMover === 'ta' ? 'char_first' : 'char_second'); }
  function markFirstMoverUserAction() { firstMoverAwaitingUserAction = false; }
  function linePriority(game, event) {
    if (event === 'random') return -1;
    if (event === 'gameover' || event === 'record') return 100;
    if (/^score_(?:20|30|40|50_plus|2000_plus|1500|500)$/.test(event)) return 90;
    if (/^tile_(?:4096|2048|1024|512|256|128|64)$/.test(event)) return 85;
    if (['watermelon','near_top','half','perfect_streak','many_hints','complete_error','nearly_done','danger','line_4','line_3','line_2','line_1'].includes(event)) return 80;
    if (['perfect','land','jump','charge','move','rotate','soft_drop','aim','drop_edge','match','miss','combo','first_flip','first_fill','erase','hint','row_done','col_done','conflict'].includes(event)) return 40;
    return 50;
  }
  function showSpeechLine(game, event, text) {
    const sp = qs('#wb-speech');
    if (!sp) return;
    const cfg = settings();
    const line = String(text || '').replace(/{{char}}/g, displayCharNameForGame(game)).replace(/{{user}}/g, cfg.userName);
    sp.innerHTML = markdownTextHTML(line);
    recordLineTrigger(game, event, line);
    lastDialogueAt = Date.now();
  }
  function queueSingleDialogue(game, event, text) {
    const item = { game, event, text, priority: linePriority(game, event) };
    const flush = () => {
      const q = singleDialogueQueue;
      singleDialogueQueue = null;
      singleDialogueTimer = null;
      if (q) showSpeechLine(q.game, q.event, q.text);
    };
    if (!singleDialogueQueue) {
      singleDialogueQueue = item;
      singleDialogueTimer = setTimeout(flush, item.priority >= 100 ? 0 : 650);
      return;
    }
    if (item.priority > singleDialogueQueue.priority || (item.priority === singleDialogueQueue.priority && Math.random() < 0.5)) singleDialogueQueue = item;
    if (item.priority >= 100 && singleDialogueTimer) {
      clearTimeout(singleDialogueTimer);
      singleDialogueTimer = setTimeout(flush, 0);
    }
  }
  function showFirstMoverChoice(game, onPick) {
    const doc = getHostDocument();
    const old = qs('#wb-first-mask', doc); if (old) old.remove();
    const g = GAME_META[game] || { name: '游戏' };
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-first-mask';
    const taName = displayCharNameForGame(game);
    const gestures = [['scissors','✌','剪刀'], ['rock','👊','石头'], ['paper','👋','布']];
    const choiceActions = () => '<button class="wb-btn primary" data-first="user">你</button><button class="wb-btn" data-first="ta">' + esc(taName) + '</button><button class="wb-btn" data-first="random">随机</button><button class="wb-btn" id="wb-first-back">返回</button>';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">决定先手</div><div class="wb-api-status" id="wb-first-body" style="margin-bottom:12px;">' + esc(g.name) + ' 请选择谁先出。</div><div class="wb-actions" id="wb-first-actions">' + choiceActions() + '</div></div>';
    appendModalMask(mask);
    const finish = first => { mask.remove(); onPick(first); };
    const close = () => { if (mask && mask.parentNode) mask.remove(); };
    const bindChoice = () => {
      const back = qs('#wb-first-back', mask); if (back) back.onclick = close;
      qsa('[data-first]', mask).forEach(btn => btn.onclick = () => {
        const first = btn.dataset.first;
        if (first === 'random') renderGesture();
        else finish(first);
      });
    };
    const renderChoice = () => {
      const body = qs('#wb-first-body', mask);
      const actions = qs('#wb-first-actions', mask);
      if (body) body.textContent = g.name + ' 请选择谁先出。';
      if (actions) actions.innerHTML = choiceActions();
      bindChoice();
    };
    const renderGesture = () => {
      const body = qs('#wb-first-body', mask);
      const actions = qs('#wb-first-actions', mask);
      if (body) body.textContent = '选择一个手势，' + taName + '会随机出手。平局会重新选择。';
      if (actions) actions.innerHTML = gestures.map(g => '<button class="wb-btn" data-gesture="' + g[0] + '" title="' + g[2] + '">' + g[1] + '</button>').join('') + '<button class="wb-btn" id="wb-first-choice-back">返回</button>';
      const back = qs('#wb-first-choice-back', mask); if (back) back.onclick = renderChoice;
      qsa('[data-gesture]', mask).forEach(btn => btn.onclick = () => {
        const user = btn.dataset.gesture;
        const ta = gestures[Math.floor(Math.random() * gestures.length)][0];
        const label = v => ({ rock:'👊', scissors:'✌', paper:'👋' }[v] || v);
        const win = (user === 'rock' && ta === 'scissors') || (user === 'scissors' && ta === 'paper') || (user === 'paper' && ta === 'rock');
        const body = qs('#wb-first-body', mask);
        const actions = qs('#wb-first-actions', mask);
        if (user === ta) {
          if (body) body.textContent = '你出了' + label(user) + '，' + taName + '也出了' + label(ta) + '，平局。请重新选择。';
          return;
        }
        const first = win ? 'user' : 'ta';
        if (body) body.textContent = '你出了' + label(user) + '，' + taName + '出了' + label(ta) + '。' + (first === 'user' ? '你先手。' : taName + '先手。');
        if (actions) actions.innerHTML = '<button class="wb-btn primary" id="wb-first-ok">开始</button><button class="wb-btn" id="wb-first-choice-back">返回</button>';
        const ok = qs('#wb-first-ok', mask); if (ok) ok.onclick = () => finish(first);
        const back = qs('#wb-first-choice-back', mask); if (back) back.onclick = renderChoice;
      });
    };
    bindChoice();
  }

function showGameRecords(game, page) {
    page = Math.max(1, page || 1);
    const doc = getHostDocument();
    const old = qs('#wb-record-mask', doc); if (old) old.remove();
    const g = GAME_META[game] || { name: '游戏' };
    const arr = (records()[game] || []).map((r,i) => Object.assign({ id:'legacy_' + i }, r));
    const pageSize = 12, total = Math.max(1, Math.ceil(arr.length / pageSize));
    page = Math.min(page, total);
    const headers = recordTableHeaders(game);
    const rows = arr.slice((page - 1) * pageSize, page * pageSize).map(r => {
      const labels = headers.filter(h => h !== '日志' && h !== '操作');
      const cells = recordDisplayCells(game, r).map((x, i) => '<td data-label="' + esc(labels[i] || '') + '" title="' + esc(x) + '">' + esc(x) + '</td>').join('');
	      const logCell = (r.log || recordFavoriteTheaterText(r)) ? '<button class="wb-btn wb-log-view" data-id="' + esc(r.id) + '">查看</button>' : '<span class="wb-muted">无</span>';
      return '<tr data-id="' + esc(r.id) + '">' + cells + '<td data-label="日志">' + logCell + '</td><td data-label="操作"><div class="wb-actions"><button class="wb-btn wb-record-del" data-id="' + esc(r.id) + '">删除</button></div></td></tr>';
    }).join('');
    const empty = '<tr><td colspan="' + headers.length + '" style="text-align:center;color:var(--wb-sub);padding:14px;">暂无游戏记录。</td></tr>';
    const mask = doc.createElement('div'); mask.className = modalMaskClass(); mask.id = 'wb-record-mask';
    mask.innerHTML = '<div class="wb-modal wb-summary-modal wb-record-modal" style="width:min(980px,100%);"><div class="wb-modal-title">' + esc(g.name) + ' · 游戏记录</div><div class="wb-record-table-wrap"><table class="wb-record-table"><thead><tr>' + headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + (rows || empty) + '</tbody></table></div><div class="wb-actions" style="margin-top:8px;justify-content:space-between;"><div><button class="wb-btn" id="wb-record-prev">上一页</button><span class="wb-pill">' + page + ' / ' + total + '</span><button class="wb-btn" id="wb-record-next">下一页</button></div><button class="wb-btn" id="wb-record-close">关闭</button></div></div>';
    appendModalMask(mask);
    qs('#wb-record-close', mask).onclick = () => mask.remove();
    qs('#wb-record-prev', mask).onclick = () => showGameRecords(game, page - 1);
    qs('#wb-record-next', mask).onclick = () => showGameRecords(game, page + 1);
	    qsa('.wb-log-view', mask).forEach(b => b.onclick = () => { const r = (records()[game] || []).find(x => x.id === b.dataset.id); if (r) showRecordLogModal(r, game); });
	    qsa('.wb-record-del', mask).forEach(b => b.onclick = () => showConfirm('删除游戏记录', '确定删除这条记录吗？', () => { deleteRecord(game, b.dataset.id); showGameRecords(game, page); }));
	  }

	    function showTextModal(title, text) { const doc = getHostDocument(); const old = qs('#wb-text-mask', doc); if (old) old.remove(); const mask = doc.createElement('div'); mask.className = modalMaskClass(); mask.id = 'wb-text-mask'; mask.innerHTML = '<div class="wb-modal wb-summary-modal"><div class="wb-modal-title">' + esc(title) + '</div><div class="wb-api-status wb-text-segments" style="max-height:420px;overflow:auto;">' + markdownTextHTML(text || '') + '</div><div class="wb-actions" style="margin-top:12px;justify-content:flex-end;"><button class="wb-btn" id="wb-text-close">关闭</button></div></div>'; appendModalMask(mask); qs('#wb-text-close', mask).onclick = () => mask.remove(); }
	  function showRecordLogModal(r, gameId) {
	    const log = (r && r.log) || '无';
	    const theater = recordFavoriteTheaterText(r);
	    const title = r && r.favoriteTheater && r.favoriteTheater.title ? r.favoriteTheater.title : '收藏的小剧场';
	    const regen = r && r.id && r.log ? '<button class="wb-btn wb-log-regen" id="wb-log-regen-in-modal" title="重新生成日志" style="min-height:24px;padding:2px 7px;">↻</button>' : '';
	    const body = '<div class="wb-section-title" style="font-size:12px;margin-bottom:6px;display:flex;align-items:center;gap:6px;">游戏日志' + regen + '</div>' + markdownTextHTML(log) + (theater ? '<div class="wb-section-title" style="font-size:12px;margin:12px 0 6px;">' + esc(title) + '</div>' + markdownTextHTML(theater) : '');
	    const doc = getHostDocument(); const old = qs('#wb-text-mask', doc); if (old) old.remove(); const mask = doc.createElement('div'); mask.className = modalMaskClass(); mask.id = 'wb-text-mask';
	    mask.innerHTML = '<div class="wb-modal wb-summary-modal"><div class="wb-modal-title">游戏日志</div><div class="wb-api-status wb-text-segments" style="max-height:420px;overflow:auto;">' + body + '</div><div class="wb-actions" style="margin-top:12px;justify-content:flex-end;"><button class="wb-btn" id="wb-text-close">关闭</button></div></div>';
	    appendModalMask(mask);
	    const regenBtn = qs('#wb-log-regen-in-modal', mask);
	    if (regenBtn) regenBtn.onclick = () => showConfirm('重新生成日志', '确定要重新生成这条游戏日志吗？原日志会被覆盖。', async () => { regenBtn.disabled = true; regenBtn.textContent = '...'; const id = gameId || Object.keys(GAME_META).find(k => GAME_META[k].name === r.game); await generateGameLog(id, r.id); const latest = (records()[id] || []).find(x => x.id === r.id); if (latest) showRecordLogModal(latest, id); });
	    qs('#wb-text-close', mask).onclick = () => mask.remove();
	  }
  function showBatchDebugModal(items) {
    const doc = getHostDocument();
    const old = qs('#wb-batch-debug-mask', doc); if (old) old.remove();
    const arr = Array.isArray(items) ? items : [];
    const text = arr.length ? arr.map((item, i) => {
      return [
        '【' + (i + 1) + '】' + (item.label || ''),
        '游戏：' + (item.game || ''),
        '类型：' + (item.part === 'theater' ? '小剧场' : '语录'),
        '状态：' + (item.ok ? '成功' : '失败'),
        '失败原因：' + (item.reason || '无'),
        '输入token合计：' + (item.inputTokensTotal || 0),
        '输出时间合计：' + ((item.durationMsTotal || 0) / 1000).toFixed(2) + 's',
        '调试：',
        item.output && item.output.indexOf('输入token：') >= 0 ? '见每次生成记录' : '无',
        '输出：',
        item.output || '无输出'
      ].join('\n');
    }).join('\n\n----------------\n\n') : '还没有批量生成调试数据。';
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-batch-debug-mask';
    mask.innerHTML = '<div class="wb-modal wb-summary-modal" style="width:min(960px,100%);"><div class="wb-modal-title">批量生成调试</div><textarea class="wb-textarea" readonly style="min-height:420px;font-family:monospace;white-space:pre;overflow:auto;">' + esc(text) + '</textarea><div class="wb-actions" style="margin-top:12px;justify-content:flex-end;"><button class="wb-btn" id="wb-batch-debug-close">关闭</button></div></div>';
    appendModalMask(mask);
    qs('#wb-batch-debug-close', mask).onclick = () => mask.remove();
  }
  function showProgressChoice(game, state) {
    const doc = getHostDocument();
    const old = qs('#wb-progress-mask', doc); if (old) old.remove();
    const g = GAME_META[game] || { name: '游戏' };
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-progress-mask';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">发现上次进度</div><div style="margin-bottom:14px;line-height:1.8;">' + esc(g.name) + ' 有未结束的上一次进度，要继续还是重新开始？</div><div class="wb-actions"><button class="wb-btn primary" id="wb-progress-continue">继续上次</button><button class="wb-btn" id="wb-progress-new">重新开始</button><button class="wb-btn" id="wb-progress-back">返回</button></div></div>';
    appendModalMask(mask);
    qs('#wb-progress-continue', mask).onclick = () => { startContinueCountdown(mask, game, state); };
    qs('#wb-progress-new', mask).onclick = () => { mask.remove(); clearProgress(game); renderGame(game); };
    qs('#wb-progress-back', mask).onclick = () => { mask.remove(); currentGame = null; saveWindowState(currentTab, ''); syncPopupModeClass(); renderSelect(currentTab); };
  }

	  function doubleTheaterFallback(game, outcome, special, roleName) {
	    const name = normalizePresetName(roleName || companionName()); const win = outcome === 'user_win'; const draw = outcome === 'draw'; const score = outcome === 'score';
    if (score && !special) {
      const lead = '游戏结束的结算停在屏幕上，' + name + '没有急着说话，只是把视线从分数移到你脸上，像是在重新确认你刚才的表现。';
      return [lead + '“很厉害。”她说得不重，却很认真，指尖轻轻点了点屏幕上的数字，像是在替你把这一局收进记忆里。小游戏只是你一个人在操作，她却看得比谁都专注，连你刚才几次差点失误又救回来的瞬间都记得清楚。她靠近一点，声音里带着藏不住的笑意：“这局结束了，但我觉得你还能更高。下一把，我继续看着你。”', lead + name + '看着最后的分数，先是轻轻笑了一声，随后把手搭在你旁边，语气里有一点调侃，也有一点明显的偏袒。“你刚才那几步是真的漂亮，别装作只是随便玩玩。”她没有把这局说成输赢，只把它当成你认真投入后留下的证明。屏幕暗下去时，她还在看你，像是在等你承认自己确实很厉害。', lead + '她把结算画面又看了一遍，像在回味刚才的节奏。“结束了。”她轻声说，随即弯起眼睛，“但是这个成绩不差，甚至有点让我想夸你。”没有对手，没有输赢，只有你刚才一点点把局面撑到最后的样子。她把手柄往你手边推了推，语气放软：“要不要再来一次？我想看看你还能做到什么程度。”'];
    }
    if (draw) {
      const lead = '平局的提示停在屏幕上，' + name + '盯了两秒，像是不太服气，又像悄悄松了一口气。';
      return [lead + '“这不算输，也不算赢。”她把这句话说得很认真，指尖却已经轻轻点在重开的地方，像把下一局提前藏进你们之间。屏幕还亮着，刚才那些差一点分出胜负的瞬间被她一一数过，最后只化成一句带笑的邀请：“再来一场，我想看看这次谁先露出破绽。”', lead + '她弯下腰看着结果，发丝从肩头滑落，语气里带着一点嘴硬的轻快。“刚好打平，说明我们都没有让对方得逞。”她这样说着，又偏过头看你，眼神像在挑衅，也像在等你答应下一局。', lead + '屏幕的光映在她眼底，平局两个字反而让气氛变得微妙。她轻轻笑了一声，把刚才的每一步都说成你们互相试探的证据。“谁也没赢，谁也没输。”她停了停，声音低下来，“所以这局还没结束，至少在我这里还没有。”'];
    }
    if (special === 'soulmate') {
      const lead = '第五道题也被你猜中的瞬间，' + name + '像是终于确认了什么，眼睛亮得几乎藏不住。';
      return [lead + '她把题目一条条回想过去，越想越忍不住笑。“你真的听懂了我每一次绕开的暗示。”这句话说出口时，她的声音比刚才更轻，像怕惊动这份默契。五道题全部猜中，不只是赢了一局游戏，更像你把她心里那些弯弯绕绕的小路都记住了。', lead + '结果停在全中时，' + name + '先是怔住，随后把脸偏开一点，笑意却从声音里漏出来。“原来你这么了解我啊。”她把每个词都念得很慢，好像每念一次，就把你们之间的距离再拉近一点。她高兴得太明显，连想装作平常都失败了。', lead + '屏幕上只剩最后的结算，' + name + '却还在看你，眼神里带着被理解后的柔软和一点点得意。“五道全中，这已经不是运气了。”她轻轻敲了敲桌面，像是在替这份心有灵犀盖章，“下次我得藏得更深一点，不然又要被你看穿了。”'];
    }
    const lead = special === 'win_streak3' ? '第三次胜利的提示音像夏夜烟火一样炸开，' + name + '把手背在身后，故意装作平静，却连耳尖都亮得明显。' : special === 'lose_streak3' ? '第三次失败落下时，房间安静了一瞬，' + name + '轻轻坐到你身边，把掌心覆在你的手背上。' : special === 'record' ? '新的记录跳出来那刻，' + name + '像看见秘密星座般睁大眼睛，笑意在睫毛下闪闪发亮。' : score ? '结算数字停住时，' + name + '用指尖轻轻点了点屏幕，像是在确认你刚才留下的轨迹。' : win ? '胜利弹窗亮起，' + name + '先是一怔，随后像藏不住心事的少女般笑了起来。' : '失败的字样浮现，' + name + '却没有责备，只把声音放得很轻，像黄昏落在窗边。';
    return [lead + '“这一次，我想把它记下来。”她靠近屏幕，袖口擦过你的手腕，语气柔软得像翻开的轻小说插画。游戏只是小小一局，可她望向你的眼神认真得过分，仿佛你们刚从一场盛大的冒险里并肩回来。', lead + '她弯下腰看着结果，发丝从肩头滑落，带着一点不肯服输的甜味。“再来一局的话，我还会陪你。”她这样说着，把刚才的胜负悄悄写进两个人才懂的回忆里。', lead + '屏幕的光映在她眼底，像细碎的樱花雨。她轻轻笑了一声，用近乎耳语的声音复盘刚才的瞬间，把胜负说成命运的恶作剧，也把你的名字放进最温柔的位置。'];
  }
  async function generateDoubleTheater(game, outcome, special, scoreText, cfgOverride) {
    const cfg = cfgOverride || settings(); const fallback = doubleTheaterFallback(game, outcome, special);
    if (!cfg.apiUrl || !cfg.apiModel) return fallback;
    const intimacyText = cfg.intimacyMode ? '开启。允许成年角色之间更亲近、更暧昧、更依赖，允许含蓄的NSFW暗示；禁止未成年人相关性内容、强迫、失控或违法内容。' : '关闭。保持自然陪伴和轻松亲近，禁止色情行为和露骨内容。';
    const prefix = (cfg.breakLimitPrompt || '').trim();
	    const prompt = [prefix, ...(promptTemplates().theater || PROMPT_TEMPLATES.theater), '亲密氛围模式：' + intimacyText, '游戏：' + ((GAME_META[game] || {}).name || game), '结果：' + formatRecordResultForPrompt(outcome), '特殊触发：' + (special || '普通结算'), '分数/胜负：' + String(scoreText || '').replace(new RegExp('TA' + '赢', 'g'), '{{char}}赢').replace(/TA/g, '{{char}}'), '规则说明：如果结果里出现“{{char}}赢”，表示当前角色获胜，也就是原先的角色获胜。平局就是平局，不是user失败，也不是{{char}}失败；平局小剧场应写双方打平后的反应，例如想再来一场、嘴硬、不服气、松口气或谁也没赢的调侃。', '角色描述：' + currentCharDescription(cfg), '世界背景：' + (selectedWorldText(cfg) || '无'), '大总结：' + (selectedSummaryText(cfg) || '无')].filter(Boolean).join('\n');
	    try { const txt = await callApiText(cfg, prompt, promptTemplates().systems.theater || PROMPT_TEMPLATES.systems.theater); const arr = JSON.parse(txt); if (Array.isArray(arr) && arr.length) return arr.map(normalizeTheaterItem).filter(x => x.length).slice(0,3); } catch(e) { console.warn('[玩伴小屋] theater failed:', e); }
    return fallback;
  }
	  function showTheaterModal(title, lines, meta) {
	    const arr = Array.isArray(lines) && lines.length ? lines : [''];
	    const text = normalizeTheaterText(arr[Math.floor(Math.random() * arr.length)]);
	    const doc = getHostDocument();
	    const old = qs('#wb-text-mask', doc); if (old) old.remove();
	    const mask = doc.createElement('div');
	    mask.className = modalMaskClass();
	    mask.id = 'wb-text-mask';
	    const canFavorite = !!(meta && meta.game && meta.recordId);
	    mask.innerHTML = '<div class="wb-modal wb-summary-modal"><div class="wb-modal-title">' + esc(title || '角色互动小剧场') + '</div><div class="wb-api-status wb-text-segments" style="max-height:420px;overflow:auto;">' + markdownTextHTML(text || '') + '</div><div class="wb-actions" style="margin-top:12px;justify-content:flex-end;">' + (canFavorite ? '<button class="wb-btn" id="wb-theater-favorite" title="收藏">♡ 收藏</button>' : '') + '<button class="wb-btn" id="wb-text-close">关闭</button></div></div>';
	    appendModalMask(mask);
	    const fav = qs('#wb-theater-favorite', mask);
	    if (fav) fav.onclick = () => {
	      updateRecord(meta.game, meta.recordId, { favoriteTheater: { title: title || '角色互动小剧场', text, savedAt: Date.now() } });
	      fav.textContent = '♥ 已收藏';
	      fav.disabled = true;
	      toast('已收藏小剧场到游戏记录');
	    };
	    qs('#wb-text-close', mask).onclick = () => mask.remove();
	  }
  async function generateGameLog(game, recordId) {
    const cfg = settings(); const rec = (records()[game] || []).find(r => r.id === recordId); if (!rec) { toast('未找到游戏记录'); return ''; }
    const roleName = rec.companion || displayCharNameForGame(game);
    const fallback = roleName + '轻声回顾了这局' + ((GAME_META[game] || {}).name || '游戏') + '：' + (rec.scoreText || formatRecordResult(rec.result)) + '。短短几分钟像被折进一页日记，她把你的认真和遗憾都记了下来。';
    if (!cfg.apiUrl || !cfg.apiModel) { updateRecord(game, recordId, { log:fallback }); toast('已生成离线日志'); return fallback; }
	    const theaterInfo = rec.theaterInfo || {};
	    const logCfg = rolePromptConfig(roleName, cfg);
	    const normalizedScoreText = String(rec.scoreText || '').replace(new RegExp(String(roleName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '{{char}}').replace(new RegExp('TA' + '赢', 'g'), '{{char}}赢').replace(/TA/g, '{{char}}');
	    const prompt = [...(promptTemplates().gameLog || PROMPT_TEMPLATES.gameLog),'游戏：' + ((GAME_META[game] || {}).name || game),'游戏情况（记录表字段，均为user视角）：' + gameLogSituation(game, rec), gameLogFieldRules(game, roleName),'原始结算文本：' + normalizedScoreText + '，结果：' + formatRecordResultForPrompt(rec.result) + '，用时：' + formatDuration(rec.durationMs),'本局触发过的角色语录（按触发顺序，包含触发条件解释和实际显示内容）：\n' + lineEventLogText(rec.lineEvents),'本局触发的小剧场主题：' + (theaterInfo.title || '角色互动小剧场'),'本局小剧场触发条件：' + (theaterInfo.condition || theaterConditionForSpecial(game, theaterInfo.special || '', roleName)),'当前游戏全部特殊小剧场规则：\n' + gameTheaterConditionRules(game, roleName),'规则说明：{{char}}赢表示当前角色获胜，也就是原先的角色获胜。胜负字段里的“胜/负/平”永远表示user的胜/负/平。','前几次同角色同游戏日志：\n' + (recentGameLogs(game, roleName) || '无'),'陪伴者：' + roleName,'角色描述：' + currentCharDescription(logCfg),'世界背景：' + (selectedWorldText(logCfg) || '无'),'大总结：' + (selectedSummaryText(logCfg) || '无')].join('\n');
	    let log = fallback; try { log = await callApiText(cfg, prompt, promptTemplates().systems.gameLog || PROMPT_TEMPLATES.systems.gameLog); } catch(e) { toast('日志生成失败，已使用本地日志'); } updateRecord(game, recordId, { log }); return log;
  }
  async function showGameOver(game, title, scoreText, result, meta) {
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
    if (g.mode === 'double') { special = doubleSpecialTheater(game, outcome, scoreText, meta); const streak = game === 'bombnumber' ? 0 : doubleStreak(game, outcome, rec.companion); if (!special && outcome === 'user_win' && streak >= 3) special = 'win_streak3'; if (!special && outcome === 'ta_win' && streak >= 3) special = 'lose_streak3'; }
    else special = singleSpecialTheater(game, scoreText, meta, rec.durationMs || 0);
    currentRoundTheaterInfo = { special, title:special ? theaterTitleForSpecial(special) : '角色互动小剧场', condition:theaterConditionForSpecial(game, special, rec.companion), allRules:gameTheaterConditionRules(game, rec.companion) };
    updateRecord(game, rec.id, { lineEvents: currentRoundLineEvents.slice(-120), theaterInfo: currentRoundTheaterInfo });
    gamePaused = true;
    gameStarted = false;
    const pbtn = qs('#wb-pause'); if (pbtn) pbtn.textContent = '继续';
    const high = scoreDisplay(game);
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-gameover-mask';
	    const logAction = settings().companion ? '<button class="wb-btn" id="wb-generate-log">生成日志</button>' : '';
	    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">' + esc(title || '游戏结束') + '</div><div style="margin-bottom:14px;line-height:1.8;"><div>游戏：' + esc(g.name) + '</div><div>' + esc(displayCharTextForGame(scoreText || '本局分数：0' + g.unit, game)) + '</div><div>' + esc(high) + '</div><div>陪伴者：' + esc(displayCharNameForGame(game)) + '</div></div><div class="wb-actions"><button class="wb-btn primary" id="wb-next-round">开启下一把</button>' + logAction + '<button class="wb-btn" id="wb-over-close">留在本局</button></div></div>';
    appendModalMask(mask);
    const allowDrawTheater = !(outcome === 'draw' && ['gomoku','oldmaid','ludo'].includes(game));
    const shouldShowTheater = !!(settings().companion && settings().theaterEnabled && allowDrawTheater && (special || Math.random() < 0.6));
    if (!shouldShowTheater) {
      const reason = settings().companion && settings().theaterEnabled
        ? (allowDrawTheater ? '本局未触发小剧场。普通小剧场仅有60%概率触发；特殊小剧场未命中。' : '本局为平局，当前游戏不触发平局小剧场。')
        : '小剧场未开启。';
      currentRoundTheaterInfo = { special:'', title:'无', condition:reason, allRules:gameTheaterConditionRules(game, rec.companion) };
      updateRecord(game, rec.id, { theaterInfo: currentRoundTheaterInfo });
    }
    if (shouldShowTheater) {
      const roleName = activeGameRoleName(game);
      const cachedTheater = theaterCache[theaterCacheKey(game, outcome, special)] || doubleTheaterFallback(game, outcome, special, roleName);
	      showTheaterModal(special ? theaterTitleForSpecial(special) : '角色互动小剧场', cachedTheater, { game, recordId: rec.id });
    }
    const logBtnHandler = async () => { const btn = qs('#wb-generate-log', mask); if (!btn) return; btn.disabled = true; btn.textContent = '生成中...'; await generateGameLog(game, rec.id); btn.disabled = false; btn.textContent = '查看日志'; btn.onclick = () => { const latest = (records()[game] || []).find(r => r.id === rec.id); if (latest) showRecordLogModal(latest, game); }; };
	    const logBtn = qs('#wb-generate-log', mask); if (logBtn) logBtn.onclick = logBtnHandler;
    if (settings().companion && settings().autoLog) setTimeout(logBtnHandler, 80);
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
    const name = currentGame ? displayCharNameForGame(currentGame) : (cfg.charName && cfg.charName !== '{{char}}' ? cfg.charName : (charData.name || ctx?.name2 || '{{char}}'));
    const avatar = findAvatar();
    const av = avatar ? '<img src="' + esc(avatar) + '" style="width:100%;height:100%;object-fit:cover">' : esc(name.slice(0,1));
    return '<div class="wb-companion ' + (cfg.companion ? 'on' : '') + '" id="wb-comp"><div class="wb-comp-row"><div class="wb-avatar">' + av + '</div><div class="wb-comp-main"><div class="wb-comp-name">' + esc(name) + '</div><div class="wb-speech wb-text-segments" id="wb-speech">...</div></div></div></div>';
  }
  function findAvatar() {
    const rolePreset = currentGame ? worldPresetForRole(activeGameRoleName(currentGame)) : null;
    const fixed = ((rolePreset && rolePreset.avatarUrl) || settings().avatarUrl || '').trim();
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
    if (firstMoverAwaitingUserAction && !['char_first','char_second','random'].includes(event)) return;
    const set = activeLineSet(game);
    const arr = set[event] || (DEFAULT_LINES[game] && DEFAULT_LINES[game][event]) || set.random || (DEFAULT_LINES[game] && DEFAULT_LINES[game].random) || ['我在。'];
    const text = arr[Math.floor(Math.random() * arr.length)] || '';
    if ((GAME_META[game] || {}).mode === 'single' && event !== 'random') queueSingleDialogue(game, event, text);
    else showSpeechLine(game, event, text);
  }
  function speakText(text) {
    const cfg = settings(); if (!cfg.companion) return;
    const line = String(text || '').trim();
    if (line) showSpeechLine(currentGame, 'custom', line);
  }

  function theaterCacheKey(game, outcome, special) { return theaterCacheKeyForName(activeGameRoleName(game), game, outcome, special); }
  function clearTheaterCacheForGame(game, roleName) {
    const prefix = normalizePresetName(roleName || companionName()) + '::' + game + '::';
    Object.keys(theaterCache).forEach(k => { if (k.indexOf(prefix) === 0) delete theaterCache[k]; });
    saveTheaterCache();
  }
  async function preGenerateTheaters(game, cfgOverride, onAiCall, roleName, options) {
    const targetRole = normalizePresetName(roleName || companionName());
    const failKey = targetRole + '::' + game;
    clearTheaterCacheForGame(game, targetRole);
    delete theaterGenerationFailures[failKey];
    const cfg = cfgOverride || settings();
    const jobs = theaterJobsForGame(game);
	    let pack = theaterPackFallback(game, jobs, targetRole);
    let apiFailed = '';
    let rawOutput = '';
    const apiDebug = {};
    if (cfg.apiUrl && cfg.apiModel) {
      const prompt = buildTheaterPackPrompt(game, cfg, jobs);
      try { if (onAiCall) onAiCall(GAME_META[game].name + '小剧场'); rawOutput = await callApiText(cfg, prompt, theaterPackSystemPrompt(jobs), 12000, apiDebug); pack = normalizeTheaterPack(game, jobs, parseGeneratedJson(rawOutput)); }
      catch(e) { apiFailed = e && e.message ? e.message : '小剧场API失败'; rawOutput = rawOutput || (e && e.rawOutput ? e.rawOutput : ''); console.warn('[玩伴小屋] theater pack failed:', e); }
    }
    if (apiFailed) {
      theaterGenerationFailures[failKey] = apiFailed;
      if (options && options.skipOnApiFailure) return { skipped:true, reason:apiFailed, output:rawOutput || apiFailed, debug:apiDebug };
    }
    jobs.forEach(([outcome, special]) => { theaterCache[theaterCacheKeyForName(targetRole, game, outcome, special === 'normal' ? '' : special)] = pack[theaterPackKey(outcome, special)]; });
    saveTheaterCache();
    return { ok:true, output:rawOutput || JSON.stringify(pack, null, 2), saved:JSON.stringify(pack, null, 2), source:rawOutput ? 'api' : 'fallback', debug:apiDebug };
  }

  function openSingleGenerateChoice(game) {
    if (lineGenerationBusy) { toast('已有角色数据生成任务正在进行'); return; }
    const doc = getHostDocument();
    const old = qs('#wb-single-generate-mask', doc); if (old) old.remove();
    const mask = doc.createElement('div');
    mask.className = modalMaskClass();
    mask.id = 'wb-single-generate-mask';
    mask.innerHTML = '<div class="wb-modal"><div class="wb-modal-title">生成' + esc(GAME_META[game].name) + '数据</div><div class="wb-api-status" style="margin-bottom:12px;">请选择要生成并覆盖的内容。</div><div class="wb-actions"><button class="wb-btn primary" data-kind="all">全部</button><button class="wb-btn" data-kind="lines">语录</button><button class="wb-btn" data-kind="theater">小剧场</button><button class="wb-btn" id="wb-single-gen-cancel">取消</button></div></div>';
    appendModalMask(mask);
    qsa('[data-kind]', mask).forEach(btn => btn.onclick = () => { const kind = btn.dataset.kind; mask.remove(); generateLines(game, kind); });
    qs('#wb-single-gen-cancel', mask).onclick = () => mask.remove();
  }
  async function generateLines(game, kind) {
    if (lineGenerationBusy) { toast('已有角色数据生成任务正在进行'); return; }
    const cfg = settings(); const btn = qs('#wb-generate-lines'); if (!btn) return; btn.disabled = true; btn.textContent = '生成中';
    let preset = currentLinePreset(game);
    let promptCfg = cfg;
    let failed = false;
    try {
      const select = qs('#wb-line-preset-select');
	      if (select && select.value && select.value.indexOf('world::') === 0) {
	        const pr = worldPresets()[parseInt(select.value.slice(7), 10)];
	        if (pr) { preset = normalizePresetName(pr.name); promptCfg = rolePromptConfig(preset, cfg, pr); }
	      } else if (select && select.value) {
	        preset = normalizePresetName(select.value.replace(/^line::/, ''));
	        promptCfg = rolePromptConfig(preset, cfg);
	      }
      setCurrentLinePreset(game, preset);
      const total = aiCallCountForGames([game], promptCfg);
      const progress = makeLineGenerationProgress('正在生成' + GAME_META[game].name + '数据', total);
      setLineGenerationStatus(total ? ('正在生成' + GAME_META[game].name + '数据：0/' + total) : ('正在生成' + GAME_META[game].name + '数据：离线生成'), true);
      if ((kind || 'all') !== 'theater') {
        let data = null;
        if (promptCfg.apiUrl && promptCfg.apiModel) {
          try { progress(GAME_META[game].name + '语录'); data = await callLineApiBatches(promptCfg, game); assertGeneratedLinesShape(game, data); }
          catch(apiErr) { console.warn('[玩伴小屋] line API failed, fallback used:', apiErr); toast('语录API失败，已使用本地语录：' + (apiErr && apiErr.message ? apiErr.message : apiErr)); }
        }
        if (!data) data = fallbackGenerated(game, promptCfg);
        data = normalizeGeneratedLines(game, data);
        saveRoleLineSet(game, preset, data);
        saveRoleLineSetForName(game, preset, preset, data);
        renderLinePresetSelect(game);
      }
      if ((kind || 'all') !== 'lines') {
        try { await preGenerateTheaters(game, promptCfg, progress, preset); }
        catch(theaterErr) { console.warn('[玩伴小屋] theater pregenerate failed:', theaterErr); toast('小剧场生成失败时会使用本地小剧场'); }
      }
      toast('已生成并覆盖“' + companionName() + ' / ' + preset + '”的' + ((kind === 'lines') ? '语录' : (kind === 'theater' ? '小剧场' : '全部数据')));
      setLineGenerationStatus('生成' + GAME_META[game].name + '数据完成', false);
    } catch(e) { failed = true; console.error('[玩伴小屋] generateLines failed:', e); setLineGenerationStatus('生成' + GAME_META[game].name + '数据失败：' + (e && e.message ? e.message : '响应无法解析'), false); toast('生成失败：' + (e && e.message ? e.message : '响应无法解析')); }
    finally { if (!failed && lineGenerationBusy) setLineGenerationStatus('生成' + GAME_META[game].name + '数据完成', false); btn.disabled = false; btn.textContent = '生成'; updateLineGenerationStatusUI(); }
  }
	  function buildPrompt(game, cfg, eventKeys) {
	    const keys = eventKeys && eventKeys.length ? eventKeys : Object.keys(DEFAULT_LINES[game] || {});
	    const events = keys.join(', ');
	    const tpl = (cfg.linePromptOverride || '').trim() ? { header:String(cfg.linePromptOverride).split(/\r?\n/), rules:[], output:[] } : (promptTemplates().lineGeneration || PROMPT_TEMPLATES.lineGeneration);
	    const userDesc = currentUserDescription(cfg);
    const charDesc = currentCharDescription(cfg);
    const chatDesc = cfg.injectChat ? '请参考当前最新聊天记录的关系氛围（插件不直接上传聊天全文时按此要求处理）' : '不注入';
    const wbText = selectedWorldText(cfg) || '无';
    const summaryText = selectedSummaryText(cfg) || '无';
    const recentRole = normalizePresetName((cfg && cfg.charName && cfg.charName !== '{{char}}') ? cfg.charName : companionName());
    const recentLogs = recentGameLogs(game, recentRole) || '无';
    const intimacyText = cfg.intimacyMode ? '开启。允许成年角色之间更亲近、更暧昧、更依赖，允许含蓄的NSFW暗示；禁止未成年人相关性内容、强迫、失控或违法内容。' : '关闭。保持自然陪伴和轻松亲近，禁止色情行为和露骨内容。';
	    const prefix = (cfg.breakLimitPrompt || '').trim();
	    if (game === 'wordguess') {
	      return [
	        prefix,
	        ...(tpl.header || []),
	        '游戏：' + GAME_META[game].name,
        '这是“我说你猜”的题库、每题专属语录、以及整局常规胜负语录生成。顶层常规事件键只能包含 random、user_win、user_lose。',
        '输出JSON顶层必须且只能包含 word_bank、random、user_win、user_lose。禁止输出 start、clue、clue_late、guess、reveal 等顶层事件键。',
        'word_bank 必须是数组，至少7道题。每道题必须完整包含：word、length、type、clues、start_line、wrong_lines、next_lines、win_line、reveal_line。',
        'random 必须是数组，写8条“很久没有说话时触发”的碎碎念；用于猜词过程中10秒没有新对话时触发，不绑定具体某一道题。',
        'user_win 必须是数组，写8条user猜中第3题时触发的整局胜利语录；此时{{char}}知道user已经必赢，语气应是认输、惊讶、不服气、佩服或想再来。',
        'user_lose 必须是数组，写8条user第3次没猜中/揭晓答案时触发的整局失败语录；此时{{char}}知道自己已经必赢、user已经输了，语气可以得意、调侃、安抚或邀战。',
	        '每题格式必须严格类似：{"word":"答案","length":2,"type":"分类","clues":["描述1","描述2","描述3","描述4","描述5"],"start_line":"本词刚开始时{{char}}说的一句话","wrong_lines":["猜错1","猜错2","猜错3","猜错4","猜错5"],"next_lines":["下一条1","下一条2","下一条3","下一条4"],"win_line":"猜中后{{char}}说的话","reveal_line":"揭晓答案后{{char}}说的话"}。',
	        'clues 必须正好5条，是给user看的逐步描述；next_lines 必须正好4条，对应第2到第5条描述前/后{{char}}的反应。',
	        'start_line 是每个词单独的开场语，会在该词刚开始时触发；每个词都必须不同，必须贴合该词和角色语气。',
	        'wrong_lines 必须正好5条，用于user猜错时触发。重要：{{char}}不知道user具体猜了什么，不能写“不是××”“不是什么”“你猜的不是……”这类针对具体答案的否定；只能写泛化的引导、靠近、调侃或提示。',
	        'win_line 是猜中后的一句话；reveal_line 是点击揭晓答案后，答案后面{{char}}说的一句话。',
	        '每个题目必须有自己独立的 start_line、wrong_lines、next_lines、win_line、reveal_line，禁止多题共用同一套语录，禁止“同上/省略/略”。random也不能和题目内语录重复。',
	        'JSON结构示例，必须照这个顶层结构填满全部题目：\n' + wordGuessJsonSkeleton(),
	        '【用户设定描述】\n' + userDesc,
	        '【角色描述】\n' + charDesc,
	        '【注入最新聊天记录】\n' + chatDesc,
	        '【当前挂载的世界书】\n' + wbText,
	        '【导入大总结】\n' + summaryText,
	        '【最近5条游戏日志】\n' + recentLogs,
	        '【亲密氛围模式】\n' + intimacyText
	      ].filter(Boolean).join('\n');
	    }
	    return [
	      prefix,
	      ...(tpl.header || []),
	      '游戏：' + GAME_META[game].name,
      '事件键：' + events,
      '必须完整生成全部事件键和全部短句内容，禁止遗漏任何一个事件键或其他条目信息。',
      '输出JSON顶层key必须完整且只能包含这些事件键，禁止新增、漏掉、改名，禁止只输出部分事件键：' + events,
      '每个事件键都必须有实际短句数组，禁止用“同上”“省略”“略”等占位内容，禁止把某个事件的内容合并到另一个事件键里。',
	      'JSON结构示例，必须照这个顶层结构填满全部短句：\n' + lineJsonSkeleton(game, keys),
	      game === 'wordguess' ? '我说你猜额外要求：除事件键外，还必须输出 word_bank 字段。word_bank 是数组，至少7道题；每题格式：{"word":"答案","length":2,"type":"分类","clues":["描述1","描述2","描述3","描述4","描述5"],"wrong_lines":["猜错1","猜错2","猜错3","猜错4","猜错5"],"next_lines":["下一条1","下一条2","下一条3","下一条4"],"win_line":"猜中后{{char}}说的话","reveal_line":"揭晓答案后{{char}}说的话"}。每个题目分别有自己的语录，禁止5个词共用同一套语录。' : '',
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
    const err = new Error('AI返回内容不是可解析JSON');
    err.rawOutput = s;
    throw err;
  }
  function normalizeGeneratedLines(game, data, roleName) {
    const events = Object.keys(DEFAULT_LINES[game] || {});
    const out = {};
    if (game === 'wordguess' && data && Array.isArray(data.word_bank)) {
      const bank = data.word_bank.map(normalizeWordGuessRoundData).filter(Boolean);
      if (bank.length) saveWordGuessBank(bank, roleName || companionName());
      events.forEach(k => {
        let v = data && data[k];
        if (typeof v === 'string') v = [v];
        if (!Array.isArray(v)) v = [];
        v = v.map(x => String(x == null ? '' : x).trim()).filter(Boolean);
        out[k] = v.length ? v : ((DEFAULT_LINES[game] && DEFAULT_LINES[game][k]) || ['我在。']);
      });
      return out;
    }
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
  function normalizeWordGuessRoundData(item) {
    const word = String(item?.word || '').trim();
    if (!word) return null;
    const raw = item.interactions || {};
    const clues = Array.isArray(item.clues) ? item.clues.map(x => String(x || '').trim()).filter(Boolean).slice(0, 5) : [];
    while (clues.length < 5) clues.push(clues[clues.length - 1] || '这个词和现在的场景有关，你再靠近一点想。');
    const wrong = Array.isArray(item.wrong_lines) ? item.wrong_lines.map(x => String(x || '').trim()).filter(Boolean).slice(0, 5) : [];
    const next = Array.isArray(item.next_lines) ? item.next_lines.map(x => String(x || '').trim()).filter(Boolean).slice(0, 4) : [];
    return {
      word,
      type: String(item.type || '未分类'),
      length: parseInt(item.length, 10) || word.length,
      clues,
      interactions: {
        start: String(item.start_line || item.start || raw.start || ('我把“' + word + '”藏好了，先给你第一条线索。')),
        guess: wrong.length ? wrong : (Array.isArray(raw.guess) ? raw.guess : [String(item.guess || raw.guess || '还没猜中，我再把线索往答案旁边推一点。')]),
        clue: next.length ? next : (Array.isArray(raw.clue) ? raw.clue : [String(item.clue || raw.clue || '我再换一种说法。')]),
        clue_late: String(item.clue_late || raw.clue_late || (next[3] || '这个提示已经很近了。')),
        win: String(item.win_line || item.win || raw.win || ('猜中了，答案就是“' + word + '”。')),
        reveal: String(item.reveal_line || item.reveal || raw.reveal || ('答案是“' + word + '”。'))
      }
    };
  }
  function assertGeneratedLinesShape(game, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('语录返回必须是JSON对象');
    if (game === 'wordguess') {
      const keys = Object.keys(data);
      const allowed = ['word_bank','random','user_win','user_lose'];
      const extra = keys.filter(k => !allowed.includes(k));
      if (extra.length) throw new Error('我说你猜只允许顶层 word_bank、random、user_win、user_lose，不能包含：' + extra.join(', '));
      ['random','user_win','user_lose'].forEach(k => {
        const arr = data[k];
        if (!Array.isArray(arr)) throw new Error('我说你猜必须输出 ' + k + ' 数组');
        const valid = arr.map(x => String(x || '').trim()).filter(Boolean);
        if (valid.length < 1) throw new Error(k + ' 至少需要1条有效短句');
      });
      if (!Array.isArray(data.word_bank)) throw new Error('我说你猜必须输出 word_bank 数组');
      if (data.word_bank.length < 7) throw new Error('word_bank 至少需要7道题');
      data.word_bank.forEach((item, i) => {
        const idx = i + 1;
        if (!String(item?.word || '').trim()) throw new Error('word_bank 第' + idx + '题缺少 word');
        ['clues','wrong_lines','next_lines'].forEach(k => { if (!Array.isArray(item[k])) throw new Error('word_bank 第' + idx + '题的 ' + k + ' 必须是数组'); });
        if (item.clues.length !== 5) throw new Error('word_bank 第' + idx + '题 clues 必须正好5条');
        if (item.wrong_lines.length !== 5) throw new Error('word_bank 第' + idx + '题 wrong_lines 必须正好5条');
        if (item.next_lines.length !== 4) throw new Error('word_bank 第' + idx + '题 next_lines 必须正好4条');
        ['start_line','win_line','reveal_line'].forEach(k => { if (!String(item[k] || '').trim()) throw new Error('word_bank 第' + idx + '题缺少 ' + k); });
      });
      return;
    }
    const events = Object.keys(DEFAULT_LINES[game] || {});
    const eventSet = new Set(events);
    const keys = Object.keys(data);
    const missing = events.filter(k => !Object.prototype.hasOwnProperty.call(data, k));
    const extra = keys.filter(k => !(eventSet.has(k) || (game === 'wordguess' && k === 'word_bank')));
    if (missing.length) throw new Error('语录缺少事件键：' + missing.join(', '));
    if (extra.length) throw new Error('语录包含多余事件键：' + extra.join(', '));
    events.forEach(k => {
      const raw = data[k];
      const arr = typeof raw === 'string' ? [raw] : raw;
      if (!Array.isArray(arr)) throw new Error('语录事件“' + k + '”必须是数组');
      const valid = arr.map(x => String(x == null ? '' : x).trim()).filter(Boolean).filter(x => !/^(同上|省略|略|无|N\/A)$/i.test(x));
      if (!valid.length) throw new Error('语录事件“' + k + '”没有有效短句');
    });
  }
  async function callApi(cfg, prompt, debugMeta) {
    const url = apiChatUrl(cfg.apiUrl);
    if (!url) throw new Error('请先配置API基础URL');
    if (!cfg.apiModel) throw new Error('请先选择模型');
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
    const messages = [{ role: 'system', content: promptTemplates().systems.lineGeneration || PROMPT_TEMPLATES.systems.lineGeneration }, { role: 'user', content: prompt }];
    if (debugMeta) debugMeta.inputTokensEstimated = estimateTokenCount(messages.map(m => m.content).join('\n'));
    const started = Date.now();
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST', headers,
        body: JSON.stringify({ model: cfg.apiModel, messages, temperature: 0.85, max_tokens: 6144 })
      }, 300000);
      if (!res.ok) { const t = await res.text().catch(()=> ''); throw new Error('API错误 ' + res.status + ': ' + t.slice(0, 120)); }
      const json = await res.json();
      fillApiDebugMeta(debugMeta, json);
      const txt = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || json.output_text || '';
      if (!txt) throw new Error('API响应格式异常');
      return parseGeneratedJson(txt);
    } finally {
      if (debugMeta) debugMeta.durationMs = Date.now() - started;
    }
  }
  async function callLineApiBatches(cfg, game, debugMeta) {
    return callApi(cfg, buildPrompt(game, cfg), debugMeta);
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
    box.innerHTML = '<div class="wb-snake-shell"><canvas class="wb-canvas wb-snake-canvas" id="wb-canvas" width="420" height="420"></canvas><div class="wb-snake-controls" aria-label="贪吃蛇方向键"><button class="wb-btn up" data-dir="up" type="button">▲</button><button class="wb-btn left" data-dir="left" type="button">◀</button><button class="wb-btn down" data-dir="down" type="button">▼</button><button class="wb-btn right" data-dir="right" type="button">▶</button></div></div>';
    const c = qs('#wb-canvas'), ctx = c.getContext('2d'), n = 21, size = 20;
    let snake = Array.isArray(state?.snake) && state.snake.length ? state.snake : [{x:10,y:10}];
    let dir = state?.dir || {x:1,y:0}, next = state?.next || dir, food = state?.food || randFood(), score = state?.score || 0, dead = false;
    let turnCount = state?.turnCount || 0, lastTurnSpeakAt = state?.lastTurnSpeakAt || 0;
    setScore('snake', score);
    function randFood(){ let p; do { p = {x:Math.floor(Math.random()*n), y:Math.floor(Math.random()*n)}; } while(snake.some(s=>s.x===p.x&&s.y===p.y)); return p; }
    function save(){ if (!dead) saveProgress('snake', { snake, dir, next, food, score, turnCount, lastTurnSpeakAt }); }
    function setSnakeDir(name){
      const m={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[name];
      if(!m || (m.x === -dir.x && m.y === -dir.y) || (m.x === next.x && m.y === next.y)) return;
      next=m;
      turnCount++;
      const now = Date.now();
      if (turnCount === 1 || now - lastTurnSpeakAt >= 8000) {
        speak('snake','turn');
        lastTurnSpeakAt = now;
      }
      save();
    }
    getHostDocument().onkeydown = e => { const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key]; if(k){ setSnakeDir(k); e.preventDefault(); } };
    addSwipe(box, setSnakeDir);
    qsa('.wb-snake-controls .wb-btn', box).forEach(btn => btn.onclick = e => { e.preventDefault(); setSnakeDir(btn.dataset.dir); });
    function snakeDelay(){ return Math.max(55, 150 - Math.floor(score / 10) * 6); }
    function scheduleSnake(){ if(!dead) snakeTimer = setTimeout(stepSnake, snakeDelay()); }
    function stepSnake(){ if(dead) return; if(gamePaused){ scheduleSnake(); return; } dir = next; const h = {x: snake[0].x + dir.x, y: snake[0].y + dir.y}; if(h.x<0||h.y<0||h.x>=n||h.y>=n||snake.some(s=>s.x===h.x&&s.y===h.y)){ dead=true; speak('snake','gameover'); showGameOver('snake', '游戏结束', '本局分数：' + score + '分', null, { score }); return; } const nearWall=h.x<=1||h.y<=1||h.x>=n-2||h.y>=n-2, nearSelf=snake.slice(1).some(s=>Math.abs(s.x-h.x)+Math.abs(s.y-h.y)<=1); if((nearWall||nearSelf) && Math.random()<.08) speak('snake','close_call'); snake.unshift(h); if(h.x===food.x&&food.y===h.y){ score += 10; setScore('snake', score); const eaten = score/10; if(eaten===1) speak('snake','eat_1'); if([5,10,20].includes(eaten)) speak('snake','eat_'+eaten); if(eaten>1 && eaten%4===0) speak('snake','speed_up'); food=randFood(); } else snake.pop(); draw(); save(); scheduleSnake(); }
    scheduleSnake();
    function draw(){
      const night = isNightTheme();
      const pal = canvasThemePalette();
      const bg = ctx.createLinearGradient(0,0,420,420);
      bg.addColorStop(0, pal.top);
      bg.addColorStop(1, pal.bottom);
      ctx.fillStyle = bg;
      ctx.fillRect(0,0,420,420);
      ctx.fillStyle = pal.pattern;
      for(let y=0;y<420;y+=40) for(let x=(y/40)%2?20:0;x<420;x+=40) ctx.fillRect(x,y,20,20);
      ctx.strokeStyle = pal.grid;
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
    box.innerHTML = '<div class="wb-2048-panel"><div class="wb-grid2048" id="wb-2048"></div></div>';
    let board = Array.isArray(state?.board) && state.board.length === 16 ? state.board : Array(16).fill(0), score = state?.score || 0, seen = state?.seen || {};
    if (!state?.board) { add(); add(); }
    draw(); save();
    getHostDocument().onkeydown = e => { const dirs = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'}; if(dirs[e.key]){ e.preventDefault(); move(dirs[e.key]); } };
    addSwipe(box, move);
    function save(){ saveProgress('game2048', { board, score, seen }); }
    function add(){ const empt=board.map((v,i)=>v?null:i).filter(v=>v!==null); if(empt.length) board[empt[Math.floor(Math.random()*empt.length)]] = Math.random()<.9?2:4; }
    function rows(dir){ const r=[]; for(let y=0;y<4;y++) r.push([0,1,2,3].map(x=>y*4+x)); if(dir==='right') r.forEach(a=>a.reverse()); if(dir==='up'||dir==='down'){ r.length=0; for(let x=0;x<4;x++) r.push([0,1,2,3].map(y=>y*4+x)); if(dir==='down') r.forEach(a=>a.reverse()); } return r; }
    function move(dir){ if (gamePaused) return; const old=board.join(','); rows(dir).forEach(idx=>{ let vals=idx.map(i=>board[i]).filter(Boolean); for(let i=0;i<vals.length-1;i++) if(vals[i]===vals[i+1]){ vals[i]*=2; score+=vals[i]; vals.splice(i+1,1); } while(vals.length<4) vals.push(0); idx.forEach((p,i)=>board[p]=vals[i]); }); if(board.join(',')!==old){ if(!seen.move){ seen.move=1; speak('game2048','move'); } add(); if(!seen.stuck && board.filter(Boolean).length>=13){ seen.stuck=1; speak('game2048','stuck'); } if(!seen.gameover && !board.includes(0)){ seen.gameover=1; speak('game2048','gameover'); } draw(); save(); } if(!board.includes(0) && !canMove()) { if(!seen.gameover){ seen.gameover=1; speak('game2048','gameover'); save(); } showGameOver('game2048', '游戏结束', '本局分数：' + score + '分', null, { maxTile: Math.max(...board) }); } }
    function canMove(){ return rows('left').some(idx=>idx.some((p,i)=>i<3 && board[p]===board[idx[i+1]])) || rows('up').some(idx=>idx.some((p,i)=>i<3 && board[p]===board[idx[i+1]])); }
    function draw(){ setScore('game2048', score); const grid=qs('#wb-2048'); grid.innerHTML=board.map(v=>'<div class="wb-tile" style="background:' + tileColor(v) + ';font-size:' + (v>999?22:28) + 'px">' + (v||'') + '</div>').join(''); [64,128,256,512,1024,2048,4096].forEach(v=>{ if(board.includes(v)&&!seen[v]){ seen[v]=1; speak('game2048','tile_'+v); } }); }
    function tileColor(v){ return ({0:'#cdc0b6',2:'#eee4da',4:'#ead8c7',8:'#efb07e',16:'#ec9368',32:'#e87865',64:'#e95f51',128:'#e4c16d',256:'#dfb954',512:'#d7ac3f',1024:'#cfa02f',2048:'#9ccbbb',4096:'#8f7ad8'})[v] || '#40342f'; }
  }

  function startTicTacToe(state) {
    const box = qs('#wb-gamebox');
    let b = Array.isArray(state?.b) && state.b.length === 9 ? state.b : Array(9).fill(''), over=false;
    let taMoves = state?.taMoves || 0, nextCharLineAt = state?.nextCharLineAt || nextCharLineTurn(0);
    box.innerHTML = '<div class="wb-board3-panel"><div class="wb-board3">' + b.map((_,i)=>'<button class="wb-cell" data-i="'+i+'"></button>').join('') + '</div></div>';
    if (!state?.b && state?.firstMover) speakFirstMover('tictactoe', state.firstMover);
    if (!state?.b && state?.firstMover === 'ta') ai();
    draw(); save();
    qsa('.wb-cell', box).forEach(cell => cell.onclick = () => { const i=+cell.dataset.i; if(gamePaused||over||b[i]) return; markFirstMoverUserAction(); b[i]='X'; const userSpoke = i===4 || [0,2,6,8].includes(i); if(i===4) speak('tictactoe','user_center'); else if([0,2,6,8].includes(i)) speak('tictactoe','user_corner'); draw(); if(done()) return; ai(userSpoke); draw(); if(!done()) save(); });
    function save(){ saveProgress('tictactoe', { b, taMoves, nextCharLineAt }); }
    function maybeCharNext(){ taMoves++; if(taMoves >= nextCharLineAt){ nextCharLineAt = nextCharLineTurn(taMoves); speak('tictactoe','char_next'); return true; } return false; }
    function ai(skipLine){ const i = bestTic(b,'O') ?? bestTic(b,'X') ?? [4,0,2,6,8,1,3,5,7].find(i=>!b[i]); if(i!=null){ const block = bestTic(b,'X')===i; let spoke = !!skipLine; if(!spoke && block && Math.random()<.5){ spoke = true; speak('tictactoe','ai_block'); } b[i]='O'; if(!spoke) maybeCharNext(); } }
    function done(){ const w=winner3(b); if(w||b.every(Boolean)){ over=true; const rounds=b.filter(Boolean).length, meta={ lastMoveWin:rounds>=8 }; if(w==='X'){ { const curScore = scores().tictactoe; setScore('tictactoe', ((curScore && typeof curScore === 'object' ? curScore.user : curScore) || 0) + 1); } speak('tictactoe','user_win'); showGameOver('tictactoe', '你赢了', '本局分数：1胜，回合数：'+rounds, 'user_win', meta); } else if(w==='O') { speak('tictactoe','user_lose'); showGameOver('tictactoe', '游戏结束', '本局分数：0胜（失败），回合数：'+rounds, 'ta_win', meta); } else { speak('tictactoe','draw'); showGameOver('tictactoe', '平局', '本局分数：0胜（平局），回合数：'+rounds, 'draw', meta); } return true; } return false; }
    function draw(){ qsa('.wb-cell', box).forEach((c,i)=>c.textContent=b[i]); }
  }
  function bestTic(b, m){ const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for(const w of wins){ const vals=w.map(i=>b[i]); if(vals.filter(v=>v===m).length===2 && vals.includes('')) return w[vals.indexOf('')]; } return null; }
  function winner3(b){ const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for(const w of wins) if(b[w[0]]&&b[w[0]]===b[w[1]]&&b[w[1]]===b[w[2]]) return b[w[0]]; return ''; }

  function startGomoku(state) {
    const box = qs('#wb-gamebox'), n=15;
    let b = Array.isArray(state?.b) && state.b.length === n*n ? state.b : Array(n*n).fill(''), over=false;
    let taMoves = state?.taMoves || 0, nextCharLineAt = state?.nextCharLineAt || nextCharLineTurn(0);
    box.innerHTML = '<div class="wb-gomoku-panel"><div class="wb-gomoku">' + b.map((_,i)=>'<button class="wb-gcell" data-i="'+i+'"></button>').join('') + '</div></div>';
    if (!state?.b && state?.firstMover) speakFirstMover('gomoku', state.firstMover);
    if (!state?.b && state?.firstMover === 'ta') { const first = bestGomoku(b,n,true); if(first>=0){ b[first]='W'; maybeCharNext(); } }
    draw(); save();
    qsa('.wb-gcell', box).forEach(cell => cell.onclick = () => { const i=+cell.dataset.i; if(gamePaused||over||b[i]) return; markFirstMoverUserAction(); b[i]='B'; const pat=gomokuPattern(b,n,i,'B'); let userEvent = ''; if(pat) userEvent = pat; else if(lineScore(b,n,i,'B')>=125) userEvent = 'user_three'; const userSpoke = !!userEvent && Math.random()<.5; if(userSpoke) speak('gomoku', userEvent); draw(); if(done('B')) return; const ai=bestGomoku(b,n,userSpoke); const aiSpoke = !!bestGomoku.lastSpoke; if(ai>=0){ b[ai]='W'; if(!userSpoke && !aiSpoke){ const threat = lineScore(b,n,ai,'W')>=80; if(threat) speak('gomoku','ai_threat'); else maybeCharNext(); } draw(); if(!done('W')) save(); } });
    function save(){ saveProgress('gomoku', { b, taMoves, nextCharLineAt }); }
    function maybeCharNext(){ taMoves++; if(taMoves >= nextCharLineAt){ speak('gomoku','char_next'); nextCharLineAt = nextCharLineTurn(taMoves); return true; } return false; }
    function done(m){ const rounds=b.filter(Boolean).length; if(winG(b,n,m)){ over=true; if(m==='B'){ { const curScore = scores().gomoku; setScore('gomoku', ((curScore && typeof curScore === 'object' ? curScore.user : curScore) || 0) + 1); } speak('gomoku','user_win'); showGameOver('gomoku', '你赢了', '回合数：' + rounds, 'user_win'); } else { speak('gomoku','user_lose'); showGameOver('gomoku', '游戏结束', '回合数：' + rounds + '（失败）', 'ta_win'); } return true; } if(b.every(Boolean)){ over=true; speak('gomoku','draw'); showGameOver('gomoku', '平局', '回合数：' + rounds + '（平局）', 'draw'); return true; } return false; }
    function draw(){ qsa('.wb-gcell', box).forEach((c,i)=>{ c.className='wb-gcell' + (b[i]==='B'?' black':b[i]==='W'?' white':''); }); }
  }
  function bestGomoku(b,n,silent){ bestGomoku.lastSpoke = false; const empty=b.map((v,i)=>v?'':i).filter(v=>v!==''); if(empty.length===n*n){ const c=Math.floor(n/2); return c*n+c; } const win=empty.find(i=>gomokuMoveWins(b,n,i,'W')); if(win!=null) return win; const block=empty.find(i=>gomokuMoveWins(b,n,i,'B')); if(block!=null){ if(!silent){ bestGomoku.lastSpoke = true; speak('gomoku','ai_block'); } return block; } let best=-1, bestScore=-1; for(const i of empty){ let score=gomokuMoveScore(b,n,i,'W')*1.12 + gomokuMoveScore(b,n,i,'B')*.96 + gomokuCenterScore(n,i); if(score>bestScore){ bestScore=score; best=i; } } if(bestScore>=180 && !silent){ bestGomoku.lastSpoke = true; speak('gomoku','ai_block'); } return best; }
  function gomokuMoveWins(b,n,i,m){ b[i]=m; const ok=winG(b,n,m); b[i]=''; return ok; }
  function gomokuCenterScore(n,i){ const x=i%n,y=Math.floor(i/n), c=(n-1)/2; return Math.max(0, 18 - (Math.abs(x-c)+Math.abs(y-c))*2); }
  function gomokuMoveScore(b,n,i,m){
    const x=i%n,y=Math.floor(i/n), dirs=[[1,0],[0,1],[1,1],[1,-1]];
    let total=0, openThrees=0, fours=0;
    for(const [dx,dy] of dirs){
      let count=1, open=0, gapBoost=0;
      for(const s of [-1,1]){
        let nx=x+dx*s, ny=y+dy*s;
        while(nx>=0&&ny>=0&&nx<n&&ny<n&&b[ny*n+nx]===m){ count++; nx+=dx*s; ny+=dy*s; }
        if(nx>=0&&ny>=0&&nx<n&&ny<n&&!b[ny*n+nx]){
          open++;
          const gx=nx+dx*s, gy=ny+dy*s;
          if(gx>=0&&gy>=0&&gx<n&&gy<n&&b[gy*n+gx]===m) gapBoost++;
        }
      }
      if(count>=4){ fours++; total += open ? 9000 : 2600; }
      else if(count===3&&open===2){ openThrees++; total += 1250; }
      else if(count===3&&open===1) total += 320;
      else if(count===2&&open===2) total += 110;
      else total += Math.pow(5,count) + open*8;
      total += gapBoost * 80;
    }
    if(fours>=2) total += 12000;
    if(openThrees>=2) total += 3600;
    return total;
  }
  function gomokuPattern(b,n,i,m){ const x=i%n,y=Math.floor(i/n), dirs=[[1,0],[0,1],[1,1],[1,-1]]; let best=''; for(const [dx,dy] of dirs){ let count=1, open=0; for(const s of [-1,1]){ let nx=x+dx*s, ny=y+dy*s; while(nx>=0&&ny>=0&&nx<n&&ny<n&&b[ny*n+nx]===m){ count++; nx+=dx*s; ny+=dy*s; } if(nx>=0&&ny>=0&&nx<n&&ny<n&&!b[ny*n+nx]) open++; } if(count>=4&&open===2) return 'user_open_four'; if(count>=4&&open===1) best=best||'user_blocked_four'; else if(count===3&&open===2) best=best||'user_open_three'; } return best; }
  function lineScore(b,n,i,m){ const x=i%n,y=Math.floor(i/n), dirs=[[1,0],[0,1],[1,1],[1,-1]]; let total=0; for(const [dx,dy] of dirs){ let c=1; for(const s of [-1,1]){ let nx=x+dx*s, ny=y+dy*s; while(nx>=0&&ny>=0&&nx<n&&ny<n&&b[ny*n+nx]===m){ c++; nx+=dx*s; ny+=dy*s; } } total += Math.pow(5,c); } return total; }
  function winG(b,n,m){ for(let y=0;y<n;y++) for(let x=0;x<n;x++) if(b[y*n+x]===m) for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){ let c=0; for(let k=0;k<5;k++){ const nx=x+dx*k, ny=y+dy*k; if(nx>=0&&ny>=0&&nx<n&&ny<n&&b[ny*n+nx]===m) c++; } if(c===5) return true; } return false; }

  function startTerritory(state) {
    const box = qs('#wb-gamebox'), N = 5;
    const role = displayCharName();
    const makeH = () => Array.from({length:N+1}, () => Array(N).fill(''));
    const makeV = () => Array.from({length:N}, () => Array(N+1).fill(''));
    const makeO = () => Array.from({length:N}, () => Array(N).fill(''));
    let h = Array.isArray(state?.h) && state.h.length === N+1 ? state.h : makeH();
    let v = Array.isArray(state?.v) && state.v.length === N ? state.v : makeV();
    let owner = Array.isArray(state?.owner) && state.owner.length === N ? state.owner : makeO();
    let turn = state?.turn || (state?.firstMover === 'ta' ? 'ta' : 'user'), userScore = state?.userScore || 0, taScore = state?.taScore || 0, busy = false, over = false, chain = 0, noSafeSpoken = !!state?.noSafeSpoken;
    let taMoves = state?.taMoves || 0, nextCharLineAt = state?.nextCharLineAt || nextCharLineTurn(0);
    box.innerHTML = '<div class="wb-territory-panel"><div class="wb-territory-info"><span class="wb-pill" id="wb-territory-turn"></span><span class="wb-pill" id="wb-territory-score"></span></div><div class="wb-territory-board" id="wb-territory-board"></div></div>';
    draw(); save();
    if (!state?.turn && state?.firstMover) speakFirstMover('territory', state.firstMover);
    if(turn === 'ta') setTimeout(robot, 500);
    function save(){ if(!over) saveProgress('territory', { h, v, owner, turn, userScore, taScore, noSafeSpoken, taMoves, nextCharLineAt }); }
    function shouldCharNext(){ taMoves++; if(taMoves >= nextCharLineAt){ nextCharLineAt = nextCharLineTurn(taMoves); return true; } return false; }
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
    function checkNoSafe(skipLine){ if(!noSafeSpoken && legalEdges().length && !legalEdges().some(isSafe)){ noSafeSpoken=true; if(!skipLine){ speak('territory','no_safe_edge'); return true; } } return false; }
    function human(kind,r,c){ if(over||busy||turn!=='user') return; if(!isLegalEdge(kind,r,c)){ toast('要贴着已有线继续画'); return; } markFirstMoverUserAction(); let userEvent = cellsFor(kind,r,c).some(([x,y]) => !owner[y][x] && sideCount(x,y) === 2) ? 'danger' : ''; const gained=applyEdge(kind,r,c,'user'); if(gained){ chain += gained; if(!userEvent) userEvent = chain > 1 ? 'chain' : 'capture'; } else { chain = 0; if(!userEvent) userEvent = 'edge'; turn='ta'; } let spoke = !!userEvent && Math.random()<.5; if(spoke) speak('territory', userEvent); if(checkNoSafe(spoke)) spoke = true; draw(); save(); if(done()) return; if(turn==='ta'){ busy=true; setTimeout(() => robot(spoke), 520); } }
    function robot(skipLine){ if(over||turn!=='ta'||currentGame!=='territory') return; const edges=legalEdges(); if(!edges.length){ done(); return; } const completions=edges.filter(wouldComplete), safe=edges.filter(isSafe); const pool=completions.length ? completions : (safe.length ? safe : edges); const e=pool[Math.floor(Math.random()*pool.length)]; const charNext = shouldCharNext(); let spoke = !!skipLine; const gained=applyEdge(e[0],e[1],e[2],'ta'); if(checkNoSafe(spoke)) spoke = true; if(gained){ if(!spoke){ spoke = true; speak('territory','ta_capture'); } draw(); save(); if(done()) return; setTimeout(() => robot(spoke), 520); return; } turn='user'; chain=0; if(!spoke) speak('territory', charNext ? 'char_next' : 'user_turn'); busy=false; draw(); save(); done(); }
    function done(){ if(allEdges().length) return false; over=true; clearProgress('territory'); const charLabel=role; const rounds=claimedEdges().length, text='本局：你 '+userScore+' 格，'+charLabel+' '+taScore+' 格，回合数：'+rounds, meta={ userScore, taScore }; if(userScore>taScore){ const cur=scores().territory; setScore('territory', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('territory','user_win'); showGameOver('territory','你赢了',text,'user_win',meta); } else if(taScore>userScore){ addTaWin('territory'); speak('territory','user_lose'); showGameOver('territory','游戏结束',text,'ta_win',meta); } else { speak('territory','draw'); showGameOver('territory','平局',text,'draw',meta); } return true; }
    function draw(){ const charLabel=role; const scoreEl=qs('#wb-score'); if(scoreEl) scoreEl.textContent='本局：你' + userScore + '/' + charLabel + taScore; const t=qs('#wb-territory-turn'); if(t) t.textContent=(turn==='user'?'你的回合':charLabel+'的回合') + (claimedEdges().length ? '，贴着已有线' : ''); const s=qs('#wb-territory-score'); if(s) s.textContent='你 '+userScore+' / '+charLabel+' '+taScore; const board=qs('#wb-territory-board'); if(!board) return; const cells=[]; for(let gy=0;gy<N*2+1;gy++) for(let gx=0;gx<N*2+1;gx++){ if(gy%2===0&&gx%2===0) cells.push('<div class="wb-territory-dot"></div>'); else if(gy%2===0){ const r=gy/2,c=(gx-1)/2,val=h[r][c], legal=!val&&turn==='user'&&!busy&&isLegalEdge('h',r,c); cells.push('<button class="wb-territory-edge h'+(val?' claimed '+val:'')+(legal?' legal':'')+'" data-k="h" data-r="'+r+'" data-c="'+c+'" '+(!legal?'disabled':'')+'></button>'); } else if(gx%2===0){ const r=(gy-1)/2,c=gx/2,val=v[r][c], legal=!val&&turn==='user'&&!busy&&isLegalEdge('v',r,c); cells.push('<button class="wb-territory-edge v'+(val?' claimed '+val:'')+(legal?' legal':'')+'" data-k="v" data-r="'+r+'" data-c="'+c+'" '+(!legal?'disabled':'')+'></button>'); } else { const x=(gx-1)/2,y=(gy-1)/2,o=owner[y][x]; cells.push('<div class="wb-territory-cell '+(o||'')+'">'+(o==='user'?'你':o==='ta'?charLabel:'')+'</div>'); } } board.innerHTML=cells.join(''); qsa('.wb-territory-edge', board).forEach(btn => btn.onclick = () => human(btn.dataset.k, +btn.dataset.r, +btn.dataset.c)); }
  }

  function startOldMaid(state) {
    const box = qs('#wb-gamebox');
    const role = displayCharName();
    let userHand = Array.isArray(state?.userHand) ? state.userHand : null;
    let taHand = Array.isArray(state?.taHand) ? state.taHand : null;
    let turn = state?.turn || (state?.firstMover === 'ta' ? 'ta' : 'user'), phase = state?.phase || (state?.firstMover === 'ta' ? 'ta_thinking' : 'user_pick'), busy = false, over = false;
    let pending = state?.pending || null, userTurns = state?.userTurns || 0, taTurns = state?.taTurns || 0;
    const log = Array.isArray(state?.log) ? state.log.slice(0, 6) : [];
    if (!userHand || !taHand) deal();
    box.innerHTML = '<div class="wb-oldmaid"><div class="wb-oldmaid-status" id="wb-oldmaid-status"></div><div class="wb-oldmaid-reveal" id="wb-oldmaid-reveal"></div><div class="wb-oldmaid-zone"><div class="wb-muted">' + esc(role) + '的手牌</div><div class="wb-oldmaid-hand backs" id="wb-oldmaid-ta"></div></div><div class="wb-oldmaid-zone"><div class="wb-muted">你的手牌</div><div class="wb-oldmaid-hand" id="wb-oldmaid-user"></div></div><div class="wb-oldmaid-log" id="wb-oldmaid-log"></div></div>';
    if (!state?.turn && state?.firstMover) speakFirstMover('oldmaid', state.firstMover); draw(); save();
    if (turn === 'ta' && phase === 'ta_thinking') { busy = true; setTimeout(robot, 900); }
    function deal(){ const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q']; const suits=['♠','♥']; const deck=shuffleArray(ranks.flatMap(r=>suits.map(s=>r+s)).concat('JOKER')); userHand=[]; taHand=[]; deck.forEach((c,i)=>(i%2?taHand:userHand).push(c)); removePairs(userHand); removePairs(taHand); }
    function rank(c){ return c==='JOKER' ? 'JOKER' : c.slice(0,-1); }
    function label(c){ return c==='JOKER' ? '🃏' : c; }
    function removePairs(hand){ let removed=0; const seen={}; hand.slice().forEach(c=>{ const r=rank(c); if(r==='JOKER') return; (seen[r] ||= []).push(c); }); Object.keys(seen).forEach(r=>{ while(seen[r].length >= 2){ const a=seen[r].pop(), b=seen[r].pop(); hand.splice(hand.indexOf(a),1); hand.splice(hand.indexOf(b),1); removed++; } }); return removed; }
    function save(){ if(!over) saveProgress('oldmaid', { userHand, taHand, turn, phase, pending, log, userTurns, taTurns }); }
    function addLog(text){ log.unshift(text); if(log.length>6) log.pop(); }
    function drawCard(from, to, i){ const card = from.splice(i, 1)[0]; to.push(card); return card; }
    function human(i){ if(over||busy||turn!=='user'||phase!=='user_pick'||i<0||i>=taHand.length) return; markFirstMoverUserAction(); userTurns++; const card=drawCard(taHand,userHand,i); pending={ actor:'user', card }; phase='user_review'; addLog('你抽到了 ' + label(card)); speak('oldmaid', card==='JOKER' ? 'joker' : 'draw'); draw(); save(); }
    function continueUser(){ if(over||phase!=='user_review') return; markFirstMoverUserAction(); const pairs=removePairs(userHand); if(pairs){ addLog('你丢掉了 ' + pairs + ' 对牌'); speak('oldmaid','pair'); } pending=null; if(done()) return; turn='ta'; phase='ta_thinking'; busy=true; draw(); save(); setTimeout(robot, 900); }
    function robot(){ if(over||turn!=='ta'||currentGame!=='oldmaid') return; if(!userHand.length){ done(); return; } taTurns++; const card=drawCard(userHand,taHand,Math.floor(Math.random()*userHand.length)); pending={ actor:'ta', card }; phase='ta_review'; busy=false; addLog(role + '抽走了 ' + label(card)); speak('oldmaid', card==='JOKER' ? 'joker' : 'ta_draw'); draw(); save(); }
    function continueTa(){ if(over||phase!=='ta_review') return; markFirstMoverUserAction(); const pairs=removePairs(taHand); if(pairs){ addLog(role + '丢掉了 ' + pairs + ' 对牌'); speak('oldmaid','ta_pair'); } pending=null; if(done()) return; turn='user'; phase='user_pick'; busy=false; draw(); save(); }
    function done(){ if(userHand.length && taHand.length) return false; over=true; clearProgress('oldmaid'); const userWon = userHand.length === 0, meta={ userTurns, taTurns }; if(userWon){ const cur=scores().oldmaid; setScore('oldmaid', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('oldmaid','user_win'); showGameOver('oldmaid','你赢了','本局：你先清空手牌','user_win', meta); } else { addTaWin('oldmaid'); speak('oldmaid','user_lose'); showGameOver('oldmaid','游戏结束','本局：你留下了鬼牌','ta_win', meta); } return true; }
    function drawCardHTML(c, extra){ return '<div class="wb-oldmaid-card '+(c==='JOKER'?'joker':'')+' '+(extra||'')+'">'+esc(label(c))+'</div>'; }
    function draw(){ const charLabel=role; const scoreEl=qs('#wb-score'); if(scoreEl) scoreEl.textContent='本局：你' + userHand.length + '张 / ' + charLabel + taHand.length + '张'; const st=qs('#wb-oldmaid-status'); if(st) st.textContent=(phase==='user_pick'?'你的回合：从' + charLabel + '手里抽一张':phase==='user_review'?'看清抽到的牌，然后手动丢对子':phase==='ta_review'?charLabel + '抽走了这张牌，确认后继续':charLabel + '正在抽牌') + ' · 你' + userHand.length + '张 / ' + charLabel + taHand.length + '张'; const reveal=qs('#wb-oldmaid-reveal'); if(reveal){ reveal.innerHTML=pending ? '<div class="wb-oldmaid-reveal-text">'+(pending.actor==='user'?'你抽到':charLabel + '抽走')+'</div>'+drawCardHTML(pending.card,'big')+'<button class="wb-btn primary" id="wb-oldmaid-next">'+(pending.actor==='user'?'丢对子并让' + charLabel + '抽':'知道了，继续')+'</button>' : ''; const nb=qs('#wb-oldmaid-next', reveal); if(nb) nb.onclick=pending.actor==='user'?continueUser:continueTa; } const ta=qs('#wb-oldmaid-ta'); if(ta){ ta.innerHTML=taHand.map((_,i)=>'<button class="wb-oldmaid-card back" data-i="'+i+'" '+(phase!=='user_pick'||turn!=='user'||busy?'disabled':'')+'>?</button>').join(''); qsa('.wb-oldmaid-card',ta).forEach(btn=>btn.onclick=()=>human(+btn.dataset.i)); } const user=qs('#wb-oldmaid-user'); if(user) user.innerHTML=userHand.map(c=>drawCardHTML(c)).join(''); const lg=qs('#wb-oldmaid-log'); if(lg) lg.innerHTML=log.map(esc).join('<br>'); }
  }

  function startReversi(state) {
    const box=qs('#wb-gamebox'), N=8, dirs=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    const role = displayCharName();
    let board=Array.isArray(state?.board)?state.board.slice():Array(64).fill('');
    if(!state?.board){ board[27]=board[36]='ta'; board[28]=board[35]='user'; }
    let turn=state?.turn || (state?.firstMover==='ta'?'ta':'user'), over=false, busy=false;
    let taMoves = state?.taMoves || 0, nextCharLineAt = state?.nextCharLineAt || nextCharLineTurn(0), seen = state?.seen || {};
    box.innerHTML='<div class="wb-reversi-panel"><div class="wb-reversi-info" id="wb-reversi-info"></div><div class="wb-reversi" id="wb-reversi-board"></div></div>';
    if(!state?.turn&&state?.firstMover) speakFirstMover('reversi', state.firstMover); draw(); save(); if(turn==='ta') setTimeout(ai,700);
    function idx(x,y){return y*N+x;} function inside(x,y){return x>=0&&y>=0&&x<N&&y<N;}
    function flips(side,i){ if(board[i]) return []; const x=i%N,y=Math.floor(i/N), other=side==='user'?'ta':'user', out=[]; dirs.forEach(d=>{ const arr=[]; let cx=x+d[0],cy=y+d[1]; while(inside(cx,cy)&&board[idx(cx,cy)]===other){ arr.push(idx(cx,cy)); cx+=d[0]; cy+=d[1]; } if(arr.length&&inside(cx,cy)&&board[idx(cx,cy)]===side) out.push(...arr); }); return out; }
    function legal(side){ return board.map((_,i)=>flips(side,i).length?i:-1).filter(i=>i>=0); }
    function save(){ if(!over) saveProgress('reversi',{board,turn,taMoves,nextCharLineAt,seen}); }
    function count(side){ return board.filter(x=>x===side).length; }
    function shouldCharNext(){ taMoves++; if(taMoves >= nextCharLineAt){ nextCharLineAt = nextCharLineTurn(taMoves); return true; } return false; }
    function place(side,i,skipLine){
      const f=flips(side,i); if(!f.length) return false;
      if(side==='user') markFirstMoverUserAction();
      const beforeUser=count('user'), beforeTa=count('ta');
      let spoke = !!skipLine;
      const charNext = side === 'ta' ? shouldCharNext() : false;
      board[i]=side; f.forEach(k=>board[k]=side);
      const afterUser=count('user'), afterTa=count('ta');
      if(side==='ta' && f.length>5 && !spoke){ spoke = true; speak('reversi','char_big_flip'); }
      if(side==='user' && f.length>5 && Math.random()<.5){ spoke = true; speak('reversi','user_big_flip'); }
      if(side==='user' && beforeUser * 2 < beforeTa && f.length>7) seen.comeback = 1;
      if(!seen.charDouble && afterTa > afterUser * 2 && afterUser > 0){ seen.charDouble=1; if(!spoke){ spoke = true; speak('reversi','char_double'); } }
      if(!seen.userDouble && afterUser > afterTa * 2 && afterTa > 0){ seen.userDouble=1; if(!spoke && Math.random()<.5){ spoke = true; speak('reversi','user_double'); } }
      if([0,7,56,63].includes(i) && !spoke && (side === 'ta' || Math.random()<.5)){ spoke = true; speak('reversi','corner'); }
      if(!seen.endLine && board.filter(x=>!x).length===1){
        seen.endLine=1;
        if(!spoke) speak('reversi', afterUser>afterTa ? 'user_win' : (afterTa>afterUser ? 'user_lose' : 'draw'));
      } else if(side==='ta' && charNext && !spoke) {
        spoke = true;
        speak('reversi','char_next');
      }
      const other=side==='user'?'ta':'user';
      if(legal(other).length){ turn=other; } else if(legal(side).length){ turn=side; } else return done();
      draw(); save(); if(turn==='ta') setTimeout(() => ai(spoke),700); return true;
    }
    function isCorner(i){ return [0,7,56,63].includes(i); }
    function isXSquare(i){ return [9,14,49,54].includes(i); }
    function isCSquare(i){ return [1,8,6,15,48,57,55,62].includes(i); }
    function adjacentCornerOpen(i){
      const pairs={9:0,1:0,8:0,14:7,6:7,15:7,49:56,48:56,57:56,54:63,55:63,62:63};
      return pairs[i] != null && !board[pairs[i]];
    }
    function simulate(side,i,fn){
      const f=flips(side,i), old=board[i];
      board[i]=side; f.forEach(k=>board[k]=side);
      const out=fn(f);
      board[i]=old; f.forEach(k=>board[k]=side==='user'?'ta':'user');
      return out;
    }
    function stableEdgeScore(side){
      let score=0;
      [[0,1,8],[7,-1,8],[56,1,-8],[63,-1,-8]].forEach(([corner,dx,dy])=>{
        if(board[corner]!==side) return;
        score+=80;
        let p=corner+dx; while(p>=0&&p<64&&Math.floor(p/8)===Math.floor(corner/8)&&board[p]===side){ score+=18; p+=dx; }
        p=corner+dy; while(p>=0&&p<64&&board[p]===side){ score+=18; p+=dy; }
      });
      return score;
    }
    function moveScore(i){
      const weights=[120,-24,18,8,8,18,-24,120,-24,-48,-6,-4,-4,-6,-48,-24,18,-6,10,4,4,10,-6,18,8,-4,4,2,2,4,-4,8,8,-4,4,2,2,4,-4,8,18,-6,10,4,4,10,-6,18,-24,-48,-6,-4,-4,-6,-48,-24,120,-24,18,8,8,18,-24,120];
      return simulate('ta', i, f=>{
        const userMoves=legal('user'), taMoves=legal('ta');
        const userCorners=userMoves.filter(isCorner).length;
        const taCorners=taMoves.filter(isCorner).length;
        const mobility=(taMoves.length-userMoves.length)*7;
        const parity=board.filter(Boolean).length > 48 ? f.length*4 : -Math.min(f.length,5)*2;
        const danger=(adjacentCornerOpen(i)&&!isCorner(i)?90:0) + (isXSquare(i)?28:0) + (isCSquare(i)?16:0);
        const corner=isCorner(i)?500:0;
        const edge=(i<8||i>=56||i%8===0||i%8===7)?28:0;
        return weights[i] + corner + edge + mobility + parity + taCorners*120 - userCorners*220 + stableEdgeScore('ta') - stableEdgeScore('user')*.8 - danger;
      });
    }
    function ai(skipLine){ if(over||gamePaused||turn!=='ta') return; const moves=legal('ta'); if(!moves.length){ turn='user'; draw(); save(); return; } moves.sort((a,b)=>moveScore(b)-moveScore(a)); const spoke = !skipLine && isCorner(moves[0]); if(spoke) speak('reversi','corner'); place('ta', moves[0], skipLine || spoke); }
    function done(){ over=true; clearProgress('reversi'); const u=board.filter(x=>x==='user').length,t=board.filter(x=>x==='ta').length, rounds=Math.max(0,u+t-4); const res=u>t?'user_win':(t>u?'ta_win':'draw'); if(!seen.endLine) speak('reversi', res==='ta_win' ? 'user_lose' : res); if(res==='user_win'){ const cur=scores().reversi; setScore('reversi',((cur&&typeof cur==='object'?cur.user:cur)||0)+1); } else if(res==='ta_win') addTaWin('reversi'); showGameOver('reversi',res==='user_win'?'你赢了':(res==='draw'?'平局':'游戏结束'),'你'+u+'格 / '+role+t+'格，回合数：'+rounds,res,{userScore:u,taScore:t,comeback:!!seen.comeback}); return true; }
    function draw(){ const u=board.filter(x=>x==='user').length,t=board.filter(x=>x==='ta').length; qs('#wb-score').textContent='本局：你'+u+' / '+role+t; qs('#wb-reversi-info').textContent=(turn==='user'?'你的回合':role+'思考中')+' · 你'+u+' / '+role+t; const leg=new Set(legal('user')); qs('#wb-reversi-board').innerHTML=board.map((v,i)=>'<button class="wb-reversi-cell '+v+(leg.has(i)&&turn==='user'?' legal':'')+'" data-i="'+i+'">'+(v?'<span></span>':'')+'</button>').join(''); qsa('.wb-reversi-cell',box).forEach(b=>b.onclick=()=>{ if(turn==='user'&&!busy) place('user',+b.dataset.i); }); }
  }

  function startBombNumber(state) {
    const box=qs('#wb-gamebox'); let bomb=state?.bomb||Math.floor(Math.random()*100)+1, low=state?.low||1, high=state?.high||100, turn=state?.turn||(state?.firstMover==='ta'?'ta':'user'), log=Array.isArray(state?.log)?state.log:[], over=false, busy=false, chosen=null, exploding=0, luckyShrink=!!state?.luckyShrink, userDoomed=!!state?.userDoomed, charDoomed=!!state?.charDoomed, turnCount=state?.turnCount||0;
    const role = displayCharName();
    box.innerHTML='<div class="wb-bomb-panel"><div class="wb-bomb-info" id="wb-bomb-info"></div><div class="wb-bomb-grid" id="wb-bomb-grid"></div><div class="wb-bomb-log" id="wb-bomb-log"></div></div>';
    if(!state?.turn&&state?.firstMover) speakFirstMover('bombnumber', state.firstMover); draw(); save(); if(turn==='ta') setTimeout(aiThink,900);
    function choices(){ return Array.from({length:100},(_,i)=>i+1).filter(n=>n>=low&&n<=high); }
    function rangeEvent(){ const len=choices().length; if(len===1) return 'doomed'; if(len>=80) return 'range_100_80'; if(len>=60) return 'range_80_60'; if(len>=40) return 'range_60_40'; if(len>=20) return 'range_40_20'; return 'range_20_0'; }
    function save(){ if(!over) saveProgress('bombnumber',{bomb,low,high,turn,log,luckyShrink,userDoomed,charDoomed,turnCount}); }
    function pick(side,n){ if(over||busy||n<low||n>high) return; if(side==='user') markFirstMoverUserAction(); const before=choices().length; busy=true; turnCount++; chosen={side,n}; log.unshift((side==='user'?'你':role)+'选择了 '+n); draw(); setTimeout(()=>resolvePick(side,n,before),680); }
    function resolvePick(side,n,before){
      if(over) return;
      if(n===bomb){
        exploding=n; chosen=null; draw();
        setTimeout(()=>{
          over=true; busy=false; clearProgress('bombnumber');
          const res=side==='user'?'ta_win':'user_win';
          if(res==='user_win'){ const cur=scores().bombnumber; setScore('bombnumber',((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('bombnumber','user_win'); }
          else { addTaWin('bombnumber'); speak('bombnumber','user_lose'); }
          showGameOver('bombnumber',res==='user_win'?'你赢了':'游戏结束','炸弹数字：'+bomb+'，回合数：'+turnCount,res,{badLuck:side==='user'&&before>=80,luckyShrink,charDoomed,userDoomed});
        }, 900);
        return;
      }
      if(n<bomb) low=n+1; else high=n-1;
      if(side==='user' && before-choices().length>=50) luckyShrink=true;
      if(choices().length===1){ if(side==='user') charDoomed=true; else userDoomed=true; }
      speak('bombnumber', rangeEvent());
      turn=side==='user'?'ta':'user'; chosen=null; busy=false; draw(); save();
      if(turn==='ta') setTimeout(aiThink, 500 + Math.random() * 500);
    }
    function aiThink(){ if(over||gamePaused||turn!=='ta'||busy) return; const arr=choices(); const n=arr[Math.floor(arr.length/2 + (Math.random()-.5)*Math.max(1,arr.length/3))]||arr[0]; pick('ta', n); }
    function draw(){ const len=choices().length; qs('#wb-score').textContent='范围：'+low+'-'+high; qs('#wb-bomb-info').textContent=(turn==='user'?'你的回合':role+(busy?'正在判断':'的回合'))+' · 可选 '+len+' 个'; qs('#wb-bomb-grid').innerHTML=Array.from({length:100},(_,i)=>{ const n=i+1, ok=n>=low&&n<=high, isChosen=chosen&&chosen.n===n, isBoom=exploding===n; return '<button class="wb-bomb-cell '+(ok?'ok':'off')+(isChosen?' chosen':'')+(isBoom?' boom':'')+'" data-n="'+n+'" '+(!ok||turn!=='user'||busy?'disabled':'')+'>'+(isBoom?'💣':n)+'</button>'; }).join(''); qs('#wb-bomb-log').innerHTML=log.slice(0,6).map(esc).join('<br>'); qsa('.wb-bomb-cell.ok',box).forEach(b=>b.onclick=()=>pick('user',+b.dataset.n)); }
  }

  function startConnect4D(state) {
    const box=qs('#wb-gamebox'), S=7, dirs=[[1,0],[0,1],[1,1],[1,-1]];
    const role = displayCharName();
    let grid=Array.isArray(state?.grid)?state.grid.slice():Array(S*S).fill(''), turn=state?.turn||(state?.firstMover==='ta'?'ta':'user'), over=false, dropping=null, aimCol=-1, aimX=0;
    let taMoves = state?.taMoves || 0, nextCharLineAt = state?.nextCharLineAt || nextCharLineTurn(0);
    box.innerHTML='<div class="wb-c4d-panel"><div class="wb-c4d-info" id="wb-c4d-info"></div><div class="wb-c4d-mask"><div class="wb-c4d-stage" id="wb-c4d-stage"><div class="wb-c4d-drop-line"></div><div class="wb-c4d" id="wb-c4d-board"></div></div></div></div>';
    if(!state?.turn&&state?.firstMover) speakFirstMover('connect4d', state.firstMover); draw(); save(); if(turn==='ta') setTimeout(ai,700);
    function id(x,y){return y*S+x;} function inside(x,y){return x>=0&&y>=0&&x<S&&y<S;}
    function landingRow(x){ for(let y=S-1;y>=0;y--) if(!grid[id(x,y)]) return y; return -1; }
    function legal(){ const a=[]; for(let x=0;x<S;x++) if(landingRow(x)>=0) a.push(x); return a; }
    function save(){ if(!over) saveProgress('connect4d',{grid,turn,taMoves,nextCharLineAt}); }
    function shouldCharNext(){ taMoves++; if(taMoves >= nextCharLineAt){ nextCharLineAt = nextCharLineTurn(taMoves); return true; } return false; }
    function winner(side){ for(let y=0;y<S;y++) for(let x=0;x<S;x++) if(grid[id(x,y)]===side){ for(const d of dirs){ let ok=true; for(let k=1;k<4;k++){ const nx=x+d[0]*k,ny=y+d[1]*k; if(!inside(nx,ny)||grid[id(nx,ny)]!==side){ ok=false; break; } } if(ok) return true; } } return false; }
    function place(side,x,aimPct,skipLine){ const y=landingRow(x); if(y<0||over||gamePaused||dropping) return; if(side==='user') markFirstMoverUserAction(); aimCol=-1; dropping={x,y,side,t:0,aimX:aimPct}; const charNext = side === 'ta' ? shouldCharNext() : false; animateDrop(()=>{ grid[id(x,y)]=side; dropping=null; const rounds=grid.filter(Boolean).length; if(winner(side)){ over=true; clearProgress('connect4d'); const res=side==='user'?'user_win':'ta_win'; if(res==='user_win'){ const cur=scores().connect4d; setScore('connect4d',((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('connect4d','user_win'); } else { addTaWin('connect4d'); speak('connect4d','user_lose'); } showGameOver('connect4d',res==='user_win'?'你赢了':'游戏结束','本局：'+(res==='user_win'?'你连成四子':role+'连成四子')+'，回合数：'+rounds,res); return; } if(!legal().length){ over=true; clearProgress('connect4d'); speak('connect4d','draw'); showGameOver('connect4d','平局','棋盘填满，回合数：'+rounds,'draw'); return; } if(side==='ta' && charNext && !skipLine) speak('connect4d','char_next'); turn=side==='user'?'ta':'user'; draw(); save(); if(turn==='ta') setTimeout(ai,700); }); }
    function animateDrop(done){ let n=0; const step=()=>{ n++; if(dropping) dropping.t=n/16; draw(); if(n<16) setTimeout(step,24); else done(); }; step(); }
    function supportedEmpty(x,y){ return inside(x,y) && !grid[id(x,y)] && landingRow(x) === y; }
    function lineScore(side,x,y){
      let best=0;
      dirs.forEach(d=>{
        let count=1, open=0, supported=0;
        [[d[0],d[1]],[-d[0],-d[1]]].forEach(v=>{
          let nx=x+v[0], ny=y+v[1];
          while(inside(nx,ny)&&grid[id(nx,ny)]===side){ count++; nx+=v[0]; ny+=v[1]; }
          if(inside(nx,ny)&&!grid[id(nx,ny)]){ open++; if(supportedEmpty(nx,ny)) supported++; }
        });
        const liveTwo=count>=2&&open>=2, deadOne=count>=1&&open===1;
        best=Math.max(best, count*count*18 + open*10 + supported*26 + (liveTwo?42:0) + (deadOne?8:0));
      });
      return best;
    }
    function immediateWins(side){
      return legal().filter(x=>{ const y=landingRow(x); grid[id(x,y)]=side; const ok=winner(side); grid[id(x,y)]=''; return ok; });
    }
    function createsNextThreat(side,x){
      const y=landingRow(x); if(y<0) return 0;
      grid[id(x,y)]=side;
      const wins=immediateWins(side).length;
      grid[id(x,y)]='';
      return wins;
    }
    function countSupportedWindows(side){
      let score=0, other=side==='user'?'ta':'user';
      for(let y=0;y<S;y++) for(let x=0;x<S;x++) dirs.forEach(d=>{
        const cells=[]; for(let k=0;k<4;k++){ const nx=x+d[0]*k, ny=y+d[1]*k; if(!inside(nx,ny)) return; cells.push([nx,ny]); }
        let mine=0, opp=0, empty=0, support=0;
        cells.forEach(([cx,cy])=>{ const v=grid[id(cx,cy)]; if(v===side) mine++; else if(v===other) opp++; else { empty++; if(supportedEmpty(cx,cy)) support++; } });
        if(opp) return;
        if(mine===3&&support) score+=520;
        else if(mine===2&&empty===2) score+=support ? 105 : 44;
        else if(mine===1&&empty===3&&support) score+=16;
      });
      return score;
    }
    function evaluateMove(x,side){
      const y=landingRow(x);
      if(y<0) return -1e9;
      grid[id(x,y)]=side;
      const win=winner(side);
      const own=lineScore(side,x,y), other=side==='user'?'ta':'user';
      const center=((S-1)/2-Math.abs(x-(S-1)/2))*18;
      const edgePenalty=(x===0||x===S-1)?22:(x===1||x===S-2?8:0);
      const futureThreats=immediateWins(side).length;
      const enemyThreats=immediateWins(other).length;
      const forkScore=Math.max(0, futureThreats-1)*680 + futureThreats*180;
      const windowScore=countSupportedWindows(side);
      const blockValue=countSupportedWindows(other)*.72;
      grid[id(x,y)]='';
      return (win?100000:0) + own + center + forkScore + windowScore + blockValue - enemyThreats*920 - edgePenalty;
    }
    function ai(){
      const m=legal(); if(!m.length) return;
      const userWins=immediateWins('user');
      if(userWins.length){ const blockTalk = Math.random()<.5; if(blockTalk) speak('connect4d','ai_block'); place('ta', userWins[0], null, blockTalk); return; }
      const taWins=immediateWins('ta');
      if(taWins.length){ place('ta', taWins[0]); return; }
      const userThreats=m.map(x=>({x, n:createsNextThreat('user',x)})).filter(o=>o.n>0).sort((a,b)=>b.n-a.n);
      if(userThreats.length){ const blockTalk = Math.random()<.5; if(blockTalk) speak('connect4d','ai_block'); place('ta', userThreats[0].x, null, blockTalk); return; }
      const taThreats=m.map(x=>({x, n:createsNextThreat('ta',x)})).filter(o=>o.n>0).sort((a,b)=>b.n-a.n);
      if(taThreats.length){ place('ta', taThreats[0].x); return; }
      const scored=m.map(x=>({x, s:evaluateMove(x,'ta')})).sort((a,b)=>b.s-a.s);
      place('ta', scored[0].x);
    }
    function draw(){
      qs('#wb-score').textContent=turn==='user'?'你的回合':role+'的回合';
      qs('#wb-c4d-info').textContent='长按任意位置选择一列，松开后棋子会从虚线落到该列最低空位。';
      const html=[];
      for(let y=0;y<S;y++) for(let x=0;x<S;x++){
        const v=grid[id(x,y)], full=landingRow(x)<0, active=(dropping&&dropping.x===x)||aimCol===x;
        html.push('<button class="wb-c4d-cell '+(v||'')+(full?' full':'')+(active?' aim':'')+'" data-x="'+x+'" '+(turn!=='user'||full||dropping?'disabled':'')+'>'+(v?'<span class="wb-c4d-disc '+v+'"></span>':'')+'</button>');
      }
      const board=qs('#wb-c4d-board');
      board.innerHTML=html.join('');
      const stage=qs('#wb-c4d-stage');
      if(stage){
        const old=qs('.wb-c4d-falling', stage); if(old) old.remove();
        if(aimCol>=0 && turn==='user' && !dropping){
          const piece=getHostDocument().createElement('span');
          piece.className='wb-c4d-falling user aim-piece';
          piece.style.left='calc('+aimX+'% - 13px)';
          piece.style.top='calc(8% - 13px)';
          stage.appendChild(piece);
        } else if(dropping){
          const t=Math.max(0,Math.min(1,dropping.t||0)), left=dropping.aimX ?? ((dropping.x+.5)*(100/S));
          const boardTop=12, boardHeight=83, cell=boardHeight/S, startTop=8, targetTop=boardTop+(dropping.y+.5)*cell, topPct=startTop+t*(targetTop-startTop);
          const piece=getHostDocument().createElement('span');
          piece.className='wb-c4d-falling '+dropping.side;
          piece.style.left='calc('+left+'% - 13px)';
          piece.style.top='calc('+topPct+'% - 13px)';
          stage.appendChild(piece);
        }
      }
      const eventAim=e=>{ const r=board.getBoundingClientRect(); const pct=Math.max(0,Math.min(100,(e.clientX-r.left)/Math.max(1,r.width)*100)); return { pct, col:Math.max(0,Math.min(S-1,Math.floor(pct/100*S))) }; };
      board.onpointerdown=e=>{ if(turn!=='user'||gamePaused||dropping) return; const a=eventAim(e); aimCol=a.col; aimX=a.pct; board.setPointerCapture?.(e.pointerId); draw(); e.preventDefault(); };
      board.onpointermove=e=>{ if(turn!=='user'||gamePaused||dropping||aimCol<0) return; const a=eventAim(e); aimCol=a.col; aimX=a.pct; draw(); e.preventDefault(); };
      board.onpointerup=e=>{ if(turn!=='user'||dropping) return; const a=aimCol>=0?{ col:aimCol, pct:aimX }:eventAim(e); aimCol=-1; board.releasePointerCapture?.(e.pointerId); draw(); place('user',a.col,a.pct); e.preventDefault(); };
      board.onpointercancel=()=>{ if(aimCol>=0){ aimCol=-1; draw(); } };
    }
  }


  function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  function startMemory(state) {
    const box = qs('#wb-gamebox');
    const icons = Array.from({ length: 8 }, (_, i) => 'memory-' + (i + 1));
    let cards = Array.isArray(state?.cards) && state.cards.length === 16 && /^memory-\d+$/.test(String(state.cards[0]?.v || '')) ? state.cards : shuffleArray(icons.concat(icons).map((v,i)=>({ v, id:i, open:false, done:false })));
    let open = Array.isArray(state?.open) ? state.open : [], moves = state?.moves || 0, matched = state?.matched || 0, combo = state?.combo || 0, busy = false, over = false, seen = state?.seen || {};
    box.innerHTML = '<div class="wb-guess-panel wb-memory-panel"><div class="wb-guess-row"><span class="wb-pill" id="wb-memory-moves">步数：0</span><span class="wb-pill" id="wb-memory-pairs">配对：0/8</span></div><div class="wb-memory" id="wb-memory-board"></div></div>';
    draw(); save();
    function score(){ return Math.max(0, 1200 - moves * 25 + matched * 80); }
    function save(){ if(!over) saveProgress('memory', { cards, open, moves, matched, combo, seen }); }
    function memoryCardFace(c){ return '<img class="wb-memory-img" src="' + esc(GAME_ICON_BASE + c.v + '.jpg') + '" alt="">'; }
    function memoryCardHTML(c,i){ return '<button class="wb-memory-card' + (c.open?' open':'') + (c.done?' done':'') + '" data-i="'+i+'"><span class="wb-memory-inner"><span class="wb-memory-face wb-memory-back"></span><span class="wb-memory-face wb-memory-front">' + memoryCardFace(c) + '</span></span></button>'; }
    function draw(){ const board = qs('#wb-memory-board'); if (!board) return; qs('#wb-memory-moves').textContent = '步数：' + moves; qs('#wb-memory-pairs').textContent = '配对：' + matched + '/8'; setScore('memory', score()); board.innerHTML = cards.map(memoryCardHTML).join(''); qsa('.wb-memory-card', board).forEach(btn => btn.onclick = () => flip(+btn.dataset.i)); }
    function flip(i){ if(gamePaused||busy||over||cards[i].done||cards[i].open||open.length>=2) return; if(moves===0&&open.length===0) speak('memory','first_flip'); cards[i].open = true; open.push(i); draw(); if(open.length===2){ moves++; const a=cards[open[0]], b=cards[open[1]]; if(a.v===b.v){ a.done=b.done=true; matched++; combo++; open=[]; speak('memory', combo>=2?'combo':'match'); if(matched===4) speak('memory','half'); if(matched===7&&!seen.gameover){ seen.gameover=1; speak('memory','gameover'); } if(matched===8){ over=true; clearProgress('memory'); setScore('memory', score()); saveMemoryBestMoves(moves); if(!seen.gameover) speak('memory','gameover'); showGameOver('memory','配对完成','本局分数：'+score()+'分'); return; } draw(); save(); } else { combo=0; speak('memory','miss'); busy=true; setTimeout(()=>{ cards[open[0]].open=false; cards[open[1]].open=false; open=[]; busy=false; draw(); save(); }, 650); } } else save(); }
  }

  function startPlank(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<div class="wb-plank-shell"><canvas class="wb-canvas wb-plank-canvas" id="wb-plank" width="520" height="360"></canvas><div class="wb-jump-help">长按空格/屏幕生成木板</div></div>';
    const c = qs('#wb-plank'), shell = qs('.wb-plank-shell', box), ctx = c.getContext('2d');
    let score = state?.score || 0, bridge = state?.bridge || 0, charging = false, over = false, seen = state?.seen || {}, perfectStreak = state?.perfectStreak || 0, bestPerfectStreak = state?.bestPerfectStreak || state?.perfectStreak || 0;
    let phase = 'ready', angle = 0, walk = 0, drop = 0, scroll = 0, failMode = '';
    let leftW = 76, gap = state?.gap || rand(80, 190), rightW = state?.rightW || rand(55, 95);
    let nextGap = state?.nextGap || rand(80, 190), nextW = state?.nextW || rand(55, 95);
    const groundY = 268, leftX = 55;
    const heroStand = loadPlankHero(PLANK_STAND_URL), heroWalk = loadPlankHero(PLANK_WALK_URL);
    setScore('plank', score); draw(); save();
    function rand(a,b){ return Math.floor(a + Math.random() * (b - a)); }
    function loadPlankHero(src){ const img = new Image(); img.onload = draw; img.src = src; return img; }
    function save(){ if(!over) saveProgress('plank', { score, bridge: phase === 'ready' || charging ? bridge : 0, gap, rightW, nextGap, nextW, seen, perfectStreak, bestPerfectStreak }); }
    function startCharge(){ if(gamePaused||over||charging||phase!=='ready') return; charging=true; bridge=0; }
    function endCharge(){ if(!charging||gamePaused||over) return; charging=false; if(!seen.gameover && (bridge < gap || bridge > gap + rightW)){ seen.gameover=1; speak('plank','gameover'); } phase='falling'; angle=0; }
    function nextPillar(){ score++; setScore('plank', score); if(score===10) speak('plank','score_10'); if(score===20) speak('plank','score_20'); if(score===30) speak('plank','score_30'); if(score===40) speak('plank','score_40'); if(score>=50&&score%10===0) speak('plank','score_50_plus'); if(Math.abs(bridge-gap-rightW/2)<10){ perfectStreak++; bestPerfectStreak=Math.max(bestPerfectStreak, perfectStreak); speak('plank','perfect'); if(perfectStreak>=3 && !seen.perfectStreak){ seen.perfectStreak=1; speak('plank','perfect_streak'); } } else perfectStreak=0; gap=nextGap; rightW=nextW; nextGap=rand(80,190); nextW=rand(55,95); bridge=0; angle=0; walk=0; drop=0; scroll=0; phase='ready'; save(); }
    function fail(){ const miss = failMode === 'short' ? gap - bridge : (failMode === 'long' ? bridge - (gap + rightW) : 0); over=true; clearInterval(jumpTimer); jumpTimer=null; if(!seen.gameover) speak('plank','gameover'); showGameOver('plank','游戏结束','本局分数：'+score+'分', null, { perfectStreak: bestPerfectStreak, nearMiss: miss > 0 && miss <= 10, farMiss: miss >= 58 }); }
    function loop(){
      if(gamePaused||over) { draw(); return; }
      if(charging) bridge=Math.min(302, bridge+3.45);
      if(phase==='falling'){
        angle=Math.min(Math.PI/2, angle+0.095);
        if(angle>=Math.PI/2){
          failMode = bridge < gap ? 'short' : (bridge > gap + rightW ? 'long' : '');
          if(failMode) perfectStreak = 0;
          phase = failMode ? 'walkingFail' : 'walking';
          walk = 0; drop = 0;
        }
      } else if(phase==='walking' || phase==='walkingFail'){
        const walkTarget = phase==='walking' ? gap + rightW - 10 : Math.max(18, bridge + 14);
        walk = Math.min(walkTarget, walk + 4.2);
        if(walk >= walkTarget){
          if(phase==='walking') phase='scrolling';
          else phase='dropping';
        }
      } else if(phase==='dropping'){
        drop += 8.5;
        if(drop > 118) fail();
      } else if(phase==='scrolling'){
        const target = gap + rightW;
        scroll = Math.min(target, scroll + 7.5);
        if(scroll >= target) nextPillar();
      }
      draw();
    }
    function draw(){
      ctx.clearRect(0,0,520,360);
      const pal=canvasThemePalette();
      drawSky(pal);
      const rightX = leftX + leftW + gap;
      const thirdX = rightX + rightW + nextGap;
      const offset = phase === 'scrolling' ? scroll : 0;
      ctx.save();
      ctx.translate(-offset, 0);
      drawPillar(leftX, leftW, pal, false);
      drawPillar(rightX, rightW, pal, true);
      drawPillar(thirdX, nextW, pal, false);
      drawBridge(leftX + leftW, groundY);
      const hero = heroPos(leftX + leftW);
      drawHero(hero.x, hero.y, phase === 'dropping');
      ctx.restore();
      drawHud(pal);
    }
    function heroPos(baseX){
      const startX = baseX - 19;
      if(phase==='walking' || phase==='walkingFail') return { x: baseX + walk - 12, y: groundY - 29 };
      if(phase==='dropping'){
        const x = baseX + walk - 12 + (failMode === 'long' ? drop * .08 : 0);
        return { x, y: groundY - 29 + drop };
      }
      if(phase==='scrolling') return { x: baseX + gap + rightW - 22, y: groundY - 29 };
      return { x:startX, y:groundY - 29 };
    }
    function drawSky(pal){
      const grad = ctx.createLinearGradient(0,0,0,360);
      grad.addColorStop(0, pal.top || '#e9f8ff');
      grad.addColorStop(0.62, '#f8fdff');
      grad.addColorStop(1, '#d7f0da');
      ctx.fillStyle=grad; ctx.fillRect(0,0,520,360);
      ctx.fillStyle='rgba(255,255,255,.62)';
      for(const cloud of [[78,72,38],[370,62,48],[450,125,30]]){
        ctx.beginPath(); ctx.ellipse(cloud[0],cloud[1],cloud[2],13,0,0,Math.PI*2); ctx.ellipse(cloud[0]+24,cloud[1]+4,cloud[2]*.7,10,0,0,Math.PI*2); ctx.ellipse(cloud[0]-22,cloud[1]+5,cloud[2]*.55,9,0,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='rgba(111,168,90,.18)';
      ctx.fillRect(0,groundY+54,520,38);
    }
    function drawPillar(x,w,pal,active){
      if(isNightTheme()) drawPixelPillar(x,w,pal,active);
      else drawWoodPillar(x,w,pal,active);
    }
    function drawWoodPillar(x,w,pal,active){
      const top = groundY, h = 106, cx = x + w / 2;
      ctx.fillStyle='rgba(78,52,30,.18)';
      ctx.beginPath(); ctx.ellipse(cx, 354, w * .62, 8, 0, 0, Math.PI * 2); ctx.fill();
      const body=ctx.createLinearGradient(x,top,x+w,top);
      body.addColorStop(0,'#7c4f2d'); body.addColorStop(.52, active ? '#b98247' : '#9d693b'); body.addColorStop(1,'#66411f');
      ctx.fillStyle=body;
      ctx.fillRect(x, top - 1, w, h + 10);
      ctx.lineWidth=3;
      ctx.strokeStyle='rgba(78,45,23,.72)';
      ctx.strokeRect(x, top - 1, w, h + 10);
      ctx.fillStyle=active ? '#e5b96d' : '#d39a58';
      ctx.beginPath(); ctx.ellipse(cx, top - 4, w * .56, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle='rgba(78,45,23,.72)';
      ctx.lineWidth=2.4;
      ctx.beginPath(); ctx.ellipse(cx, top - 4, w * .56, 13, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle='rgba(92,54,25,.62)';
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(cx, top - 4, w * .36, 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + w * .08, top - 3, w * .19, 4, .15, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle='rgba(65,38,22,.36)';
      ctx.lineWidth=1.6;
      for(let i=0;i<4;i++){
        const gx = x + 12 + i * Math.max(10, w / 5);
        ctx.beginPath();
        ctx.moveTo(gx, top + 12);
        ctx.bezierCurveTo(gx - 5, top + 36, gx + 6, top + 58, gx - 2, top + 92);
        ctx.stroke();
      }
      ctx.strokeStyle='rgba(255,235,184,.28)';
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(x + 12, top + 11); ctx.lineTo(x + 8, top + h - 13); ctx.stroke();
      const grassY = 352;
      for(const g of [[x-12,17,'#6FA85A'],[x-5,12,'#91bd62'],[x+w-7,16,'#6FA85A'],[x+w+3,11,'#91bd62'],[x+12,10,'#7ab45f']]){
        ctx.fillStyle=g[2];
        ctx.beginPath();
        ctx.moveTo(g[0], grassY);
        ctx.quadraticCurveTo(g[0] + 5, grassY - g[1], g[0] + 11, grassY);
        ctx.closePath();
        ctx.fill();
      }
      if(active){
        ctx.fillStyle='#d97b54';
        ctx.beginPath(); ctx.arc(x + w + 12, grassY - 10, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle='#e3c56a';
        ctx.beginPath(); ctx.arc(x + w + 8, grassY - 7, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    function drawPixelPillar(x,w,pal,active){
      const top = groundY, h = 106, ix = Math.round(x), iw = Math.round(w);
      const neon = settings().theme === 'cyber' ? '#F1E85B' : '#f4c2d7';
      const neon2 = settings().theme === 'cyber' ? '#19D3C5' : '#8ed8ff';
      ctx.fillStyle='rgba(0,0,0,.32)';
      ctx.fillRect(ix + 6, top + h - 2, iw, 8);
      ctx.fillStyle=settings().theme === 'cyber' ? '#16231d' : '#241324';
      ctx.fillRect(ix + 4, top + 2, iw - 8, h + 4);
      ctx.fillStyle=settings().theme === 'cyber' ? '#24352D' : '#33203a';
      ctx.fillRect(ix + 10, top + 8, iw - 20, h - 3);
      ctx.fillStyle=active ? neon : 'rgba(255,255,255,.16)';
      ctx.fillRect(ix - 2, top - 8, iw + 4, 10);
      ctx.fillStyle=settings().theme === 'cyber' ? '#101A1D' : '#1b1020';
      ctx.fillRect(ix + 8, top - 4, iw - 16, 4);
      ctx.fillStyle=neon2;
      ctx.fillRect(ix + 4, top + 12, 4, 22);
      ctx.fillRect(ix + iw - 8, top + h - 34, 4, 22);
      ctx.fillStyle='rgba(255,255,255,.1)';
      for(let y=top+22;y<top+h;y+=18) ctx.fillRect(ix + 14, y, iw - 28, 3);
      ctx.strokeStyle=active ? neon : 'rgba(185,196,184,.45)';
      ctx.lineWidth=2;
      ctx.strokeRect(ix + 3, top + 1, iw - 6, h + 5);
    }
    function drawBridge(baseX,baseY){
      ctx.save();
      ctx.translate(baseX,baseY);
      ctx.rotate(-Math.PI/2 + angle);
      if(isNightTheme()){
        const neon = settings().theme === 'cyber' ? '#F1E85B' : '#f4c2d7';
        ctx.fillStyle=settings().theme === 'cyber' ? '#18231E' : '#211426';
        ctx.fillRect(0,-6,bridge,12);
        ctx.strokeStyle=neon; ctx.lineWidth=2; ctx.strokeRect(0,-6,bridge,12);
        ctx.fillStyle=settings().theme === 'cyber' ? '#19D3C5' : '#8ed8ff';
        for(let x=14;x<bridge;x+=26) ctx.fillRect(x,-3,8,6);
      } else {
        const bg=ctx.createLinearGradient(0,-7,0,9);
        bg.addColorStop(0,'#c88b46'); bg.addColorStop(.55,'#8b582c'); bg.addColorStop(1,'#56351d');
        ctx.fillStyle=bg;
        ctx.beginPath(); ctx.roundRect(0,-7,bridge,14,5); ctx.fill();
        ctx.strokeStyle='rgba(65,38,22,.58)'; ctx.lineWidth=2; ctx.stroke();
        ctx.strokeStyle='rgba(255,224,158,.34)'; ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.moveTo(9,-2); ctx.bezierCurveTo(bridge*.28,-6,bridge*.62,4,bridge-8,-2); ctx.stroke();
        ctx.fillStyle='rgba(64,38,20,.36)';
        for(let x=16;x<bridge;x+=34){ ctx.beginPath(); ctx.arc(x,0,2.2,0,Math.PI*2); ctx.fill(); }
      }
      ctx.restore();
    }
    function drawHero(x,y,fallingHero){
      ctx.save();
      ctx.translate(x,y);
      if(fallingHero) ctx.rotate(Math.min(.75, drop/160));
      ctx.fillStyle='rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(2,32,15,5,0,0,Math.PI*2); ctx.fill();
      const walking = phase === 'walking' || phase === 'walkingFail';
      const img = fallingHero ? heroWalk : (walking && Math.floor(walk / 14) % 2 ? heroWalk : heroStand);
      if(img && img.complete && img.naturalWidth){
        const h = 66, w = Math.max(39, h * img.naturalWidth / img.naturalHeight);
        if(fallingHero) ctx.rotate(-0.34);
        ctx.drawImage(img, -w / 2, -39, w, h);
      } else {
        ctx.font='34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('🐱', 0, -6);
      }
      ctx.textAlign='start';
      ctx.textBaseline='alphabetic';
      ctx.restore();
    }
    function drawHud(pal){
      ctx.fillStyle='rgba(255,255,255,.72)';
      ctx.beginPath(); ctx.roundRect(226,18,68,36,12); ctx.fill();
      ctx.fillStyle=pal.text; ctx.font='900 20px sans-serif'; ctx.textAlign='center'; ctx.fillText(score+'',260,42); ctx.textAlign='start';
    }
    shell.onpointerdown=e=>{ startCharge(); shell.setPointerCapture?.(e.pointerId); e.preventDefault(); };
    shell.onpointerup=e=>{ endCharge(); shell.releasePointerCapture?.(e.pointerId); e.preventDefault(); };
    shell.onpointercancel=endCharge;
    getHostDocument().onkeydown=e=>{ if(e.code==='Space'){ e.preventDefault(); startCharge(); } };
    getHostDocument().onkeyup=e=>{ if(e.code==='Space'){ e.preventDefault(); endCharge(); } };
    clearInterval(jumpTimer); jumpTimer=setInterval(loop, 32);
  }

  function startSudoku(state) {
    const box = qs('#wb-gamebox');
    const made = state && isValidSudokuPuzzle(state.puzzle, state.solution) ? { puzzle: state.puzzle.slice(), solution: state.solution.slice() } : makeSudoku();
    let puzzle = made.puzzle, solution = made.solution;
    let grid = Array.isArray(state?.grid) && state.grid.length === 81 ? state.grid.slice(0, 81) : puzzle.slice();
    grid = Array.from({ length: 81 }, (_, i) => puzzle[i] || (Number.isInteger(grid[i]) && grid[i] >= 1 && grid[i] <= 9 ? grid[i] : 0));
    let selected = Number.isInteger(state?.selected) ? state.selected : -1, hints = state?.hints || 0, over = false, seen = state?.seen || {};
    box.innerHTML = '<div class="wb-sudoku-panel"><div class="wb-sudoku-top"><span class="wb-pill" id="wb-sudoku-clues"></span><span class="wb-pill" id="wb-sudoku-hints"></span></div><div id="wb-sudoku-board"></div><div class="wb-actions wb-sudoku-tools"><button type="button" class="wb-btn" id="wb-sudoku-erase">擦除</button><button type="button" class="wb-btn primary" id="wb-sudoku-hint">提示 <span class="wb-sudoku-badge" id="wb-sudoku-hint-badge">0</span></button></div><div class="wb-sudoku-nums">' + Array.from({length:9},(_,i)=>'<button type="button" class="wb-btn" data-n="'+(i+1)+'">'+(i+1)+'</button>').join('') + '</div></div>';
    draw(); save();
    function save(){ if(!over) saveProgress('sudoku', { puzzle, solution, grid, selected, hints, seen }); }
    function row(i){ return Math.floor(i/9); } function col(i){ return i%9; }
    function completeLine(kind, n){ for(let i=0;i<9;i++){ const idx=kind==='r'?n*9+i:i*9+n; if(grid[idx]!==solution[idx]) return false; } return true; }
    function solutionErrors(){ return grid.reduce((sum, v, i) => sum + (v && v !== solution[i] ? 1 : 0), 0); }
    function maybeSudokuGameoverLine(blanks, errors){ if(!seen.gameover && (blanks===1 || errors===1)){ seen.gameover=1; speak('sudoku','gameover'); } }
    function hasRuleConflict(i){
      const v = grid[i]; if(!v) return false;
      const r = row(i), c = col(i), br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for(let k=0;k<9;k++){ if(k!==c && grid[r*9+k]===v) return true; if(k!==r && grid[k*9+c]===v) return true; }
      for(let y=br;y<br+3;y++) for(let x=bc;x<bc+3;x++){ const j=y*9+x; if(j!==i && grid[j]===v) return true; }
      return false;
    }
    function draw(){
      const board = qs('#wb-sudoku-board', box);
      const full = grid.every(Boolean), errors = full ? solutionErrors() : 0;
      qs('#wb-sudoku-clues', box).textContent = full && errors ? '错误：' + errors + '格' : ('题面：' + puzzle.filter(Boolean).length + '格');
      qs('#wb-sudoku-hints', box).innerHTML = '提示：<b>' + hints + '</b>';
      const badge = qs('#wb-sudoku-hint-badge', box); if (badge) badge.textContent = String(hints);
      board.className = 'wb-sudoku-board';
      board.style.cssText = 'width:100%;max-width:min(390px,64cqh);max-height:100%;aspect-ratio:1/1;position:relative;box-sizing:border-box;border:2px solid var(--wb-text);background:var(--wb-text);overflow:hidden;flex:0 0 auto;';
      const selectedFixed = selected >= 0 && !!puzzle[selected];
      const same = selectedFixed ? puzzle[selected] : 0, sr=row(selected), sc=col(selected);
      board.innerHTML = Array.from({length:81},(_,i)=>{
        const r = row(i), c = col(i), v = grid[i] || 0;
        const fixed = !!puzzle[i], sel = i === selected, peer = selected >= 0 && (r === sr || c === sc);
        const sameNum = !!(same && fixed && puzzle[i] === same), wrong = !fixed && hasRuleConflict(i);
        const bg = sameNum ? 'var(--wb-gold)' : (peer ? (fixed ? 'var(--wb-soft)' : 'var(--wb-panel)') : (fixed ? 'var(--wb-soft)' : 'var(--wb-panel)'));
        const color = wrong ? '#ef4444' : 'var(--wb-text)';
        const border = 'border-left:'+(c%3===0?'1.5px solid var(--wb-text)':'1px solid var(--wb-border)')+';border-right:'+(c%3===2?'1.5px solid var(--wb-text)':'1px solid var(--wb-border)')+';border-top:'+(r%3===0?'1.5px solid var(--wb-text)':'1px solid var(--wb-border)')+';border-bottom:'+(r%3===2?'1.5px solid var(--wb-text)':'1px solid var(--wb-border)')+';';
        const outline = sel ? 'outline:2px solid var(--wb-accent);outline-offset:-3px;' : '';
        const shadow = wrong ? 'box-shadow:inset 0 0 0 2px #ef4444;' : (peer && !sameNum ? 'box-shadow:inset 0 0 0 999px rgba(125,185,216,.10);' : '');
        return '<button type="button" data-sudoku-cell="1" data-i="'+i+'" class="wb-sudoku-tile '+(fixed?'fixed':'mutable')+'" style="position:absolute;left:'+((c*100)/9)+'%;top:'+((r*100)/9)+'%;width:'+(100/9)+'%;height:'+(100/9)+'%;display:flex;align-items:center;justify-content:center;margin:0;padding:0;box-sizing:border-box;border-radius:0;font-weight:900;font-size:clamp(15px,3.1vh,24px);line-height:1;background:'+bg+';color:'+color+';'+border+outline+shadow+'">'+(v ? String(v) : '')+'</button>';
      }).join('');
      qsa('[data-sudoku-cell]', board).forEach(b=>b.onclick=()=>{ selected=+b.dataset.i; draw(); save(); });
    }
    function input(n){ if(gamePaused||over||selected<0||puzzle[selected]) return; if(!seen.first){ seen.first=1; speak('sudoku','first_fill'); } grid[selected]=n; if(hasRuleConflict(selected)) speak('sudoku','conflict'); if(completeLine('r',row(selected))&&!seen['r'+row(selected)]){ seen['r'+row(selected)]=1; speak('sudoku','row_done'); } if(completeLine('c',col(selected))&&!seen['c'+col(selected)]){ seen['c'+col(selected)]=1; speak('sudoku','col_done'); } const blanks=grid.filter(v=>!v).length; if(blanks<=5&&!seen.near){ seen.near=1; speak('sudoku','nearly_done'); } const errors=solutionErrors(); maybeSudokuGameoverLine(blanks, errors); draw(); save(); if(blanks===0 && errors===0) done(); else if(blanks===0){ speak('sudoku','complete_error'); toast('已填满，当前错误 ' + errors + ' 格，可以继续修改'); } }
    function erase(){ if(selected<0||puzzle[selected]) return; grid[selected]=0; speak('sudoku','erase'); maybeSudokuGameoverLine(grid.filter(v=>!v).length, solutionErrors()); draw(); save(); }
    function hint(){ let i = selected>=0 && !puzzle[selected] && grid[selected]!==solution[selected] ? selected : -1; if(i<0) i=grid.findIndex((v,k)=>!puzzle[k] && v && v!==solution[k]); if(i<0) i=grid.findIndex((v,k)=>!puzzle[k] && !v); if(i<0) return; hints++; selected=i; grid[i]=solution[i]; puzzle[i]=solution[i]; speak('sudoku', hints>5?'many_hints':'hint'); maybeSudokuGameoverLine(grid.filter(v=>!v).length, solutionErrors()); draw(); save(); if(grid.every(Boolean) && solutionErrors()===0) done(); }
    function done(){ const duration = currentGameDurationMs(), oldBest = sudokuBestDuration(); if(oldBest && duration < oldBest) currentRoundRecord = true; over=true; clearProgress('sudoku'); if(!seen.gameover) speak('sudoku','gameover'); showGameOver('sudoku','数独完成','求助'+hints+'次', null, { hints }); }
    qs('#wb-sudoku-erase', box).onclick=erase; qs('#wb-sudoku-hint', box).onclick=hint; qsa('.wb-sudoku-nums .wb-btn', box).forEach(b=>b.onclick=()=>input(+b.dataset.n));
    getHostDocument().onkeydown=e=>{ if(/^[1-9]$/.test(e.key)) input(+e.key); if(e.key==='Backspace'||e.key==='Delete') erase(); };
    function parseSudoku(str){ return String(str).replace(/\./g,'0').split('').map(x=>parseInt(x,10)||0); }
    function isValidSudokuPuzzle(puz, sol){ return Array.isArray(puz) && Array.isArray(sol) && puz.length===81 && sol.length===81 && puz.filter(Boolean).length>=28 && sol.every(n=>Number.isInteger(n)&&n>=1&&n<=9) && puz.every((n,i)=>!n || n===sol[i]); }
    function makeSudoku(){
      const bases=[
        ['53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79','534678912672195348198342567859761423426853791713924856961537284287419635345286179'],
        ['..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..','483921657967345821251876493548132976729564138136798245372689514814253769695417382']
      ];
      const pick=bases[Math.floor(Math.random()*bases.length)], puz0=parseSudoku(pick[0]), sol0=parseSudoku(pick[1]);
      const map={}; shuffleArray([1,2,3,4,5,6,7,8,9]).forEach((n,i)=>map[i+1]=n);
      const bandRows=shuffleArray([0,1,2]).flatMap(b=>shuffleArray([0,1,2]).map(r=>b*3+r));
      const bandCols=shuffleArray([0,1,2]).flatMap(b=>shuffleArray([0,1,2]).map(c=>b*3+c));
      const transform=arr=>Array.from({length:81},(_,i)=>{ const r=bandRows[row(i)], c=bandCols[col(i)], v=arr[r*9+c]; return v ? map[v] : 0; });
      return { puzzle:transform(puz0), solution:transform(sol0) };
    }
  }

  function startWatermelon(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<canvas class="wb-canvas wb-watermelon-canvas" id="wb-watermelon" width="400" height="500"></canvas>';
    const c = qs('#wb-watermelon'), ctx = c.getContext('2d');
    const W = 400, H = 500;
    const fruits = [
      {r:14, color:'#f05f6b', name:'樱'}, {r:18, color:'#f59f00', name:'苹'}, {r:23, color:'#ffd166', name:'柠'},
      {r:29, color:'#7bc96f', name:'猕'}, {r:36, color:'#ffb15c', name:'橙'}, {r:45, color:'#d95550', name:'苹'},
      {r:56, color:'#7cc66a', name:'蜜'}, {r:68, color:'#f3c04f', name:'菠'}, {r:82, color:'#2a9d55', name:'瓜'}
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
    watermelonTimer = setInterval(step, 40);
    function randNext(){ return Math.floor(Math.random()*3); }
    function clientX(e){ const r=c.getBoundingClientRect(); return Math.max(18, Math.min(W-18, (e.clientX-r.left) * W / r.width)); }
    function save(){ if(!over) saveProgress('watermelon', { balls: balls.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,l:b.l,a:b.a||0,av:b.av||0})), next, score, seen }); }
    function drop(x){ if(gamePaused||over||dropping) return; aiming=false; aimX=null; const f=fruits[next]; balls.push({x, y:f.r+6, vx:0, vy:0, l:next, a:0, av:0}); next=randNext(); dropping=true; setTimeout(()=>dropping=false,180); if(x < f.r + 12 || x > W - f.r - 12) speak('watermelon','drop_edge'); save(); }
    function step(){ if(gamePaused||over) { draw(); return; } balls.forEach(b=>{ const f=fruits[b.l]; b.vy+=0.45; b.x+=b.vx; b.y+=b.vy; b.a=(b.a||0)+(b.av||0); b.av=(b.av||0)*0.985; if(b.x<f.r){ b.x=f.r; b.vx=Math.abs(b.vx)*0.58; b.av += b.vx / f.r * 0.08; } if(b.x>W-f.r){ b.x=W-f.r; b.vx=-Math.abs(b.vx)*0.58; b.av += b.vx / f.r * 0.08; } if(b.y>H-f.r){ b.y=H-f.r; b.vy*=-0.38; b.av += b.vx / f.r * 0.16; b.vx*=0.985; b.av*=0.94; if(Math.abs(b.vy)<.45) b.vy=0; } });
      for(let k=0;k<4;k++) collide();
      balls = balls.filter(Boolean); draw(); save();
      if(balls.some(b=>b.y-fruits[b.l].r<36 && Math.abs(b.vy)<.25) && balls.length>8){ over=true; clearInterval(watermelonTimer); if(!seen.gameover){ seen.gameover=1; speak('watermelon','gameover'); } showGameOver('watermelon','游戏结束','本局分数：'+score+'分', null, { finalWatermelons: balls.filter(b=>b && b.l===fruits.length-1).length }); }
    }
    function collide(){ for(let i=0;i<balls.length;i++) for(let j=i+1;j<balls.length;j++){ const a=balls[i], b=balls[j]; if(!a||!b) continue; const fa=fruits[a.l], fb=fruits[b.l], dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1, min=fa.r+fb.r; if(d<min){ if(a.l===b.l && a.l<fruits.length-1){ const nl=a.l+1; score += (nl+1)*20; setScore('watermelon', score); const nx=(a.x+b.x)/2, ny=(a.y+b.y)/2; balls[i]={x:nx,y:ny,vx:(a.vx+b.vx)*.32,vy:-3.2,l:nl,a:((a.a||0)+(b.a||0))/2,av:((a.av||0)+(b.av||0))* .22}; balls[j]=null; if(nl>=4&&!seen[nl]){ seen[nl]=1; speak('watermelon', nl>=8?'watermelon':('merge_'+(nl>=7?7:nl>=6?6:4))); } else if(nl===2&&!seen.merge_2){ seen.merge_2=1; speak('watermelon','merge_2'); } continue; } const push=(min-d)/2, nx=dx/d, ny=dy/d; a.x-=nx*push; a.y-=ny*push; b.x+=nx*push; b.y+=ny*push; const rvx=b.vx-a.vx, rvy=b.vy-a.vy, sep=rvx*nx+rvy*ny, tangent=rvx*(-ny)+rvy*nx; a.av=(a.av||0)-tangent/fa.r*.035; b.av=(b.av||0)+tangent/fb.r*.035; if(sep<0){ const imp=-sep*.62; a.vx-=imp*nx; a.vy-=imp*ny; b.vx+=imp*nx; b.vy+=imp*ny; } } } }
    function shade(hex, amt){ const n=parseInt(String(hex).slice(1),16); const r=Math.max(0,Math.min(255,(n>>16)+amt)), g=Math.max(0,Math.min(255,((n>>8)&255)+amt)), b=Math.max(0,Math.min(255,(n&255)+amt)); return 'rgb('+r+','+g+','+b+')'; }
    function drawFruit(x,y,l,alpha,scale,angle){
      const f=fruits[l], r=f.r*(scale||1);
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(angle||0);
      x=0; y=0;
      ctx.globalAlpha=alpha == null ? 1 : alpha;
      const grad=ctx.createRadialGradient(x-r*.22,y-r*.22,r*.12,x,y,r);
      grad.addColorStop(0,'rgba(255,255,255,.92)');
      grad.addColorStop(.18,shade(f.color,38));
      grad.addColorStop(.72,f.color);
      grad.addColorStop(1,shade(f.color,-42));
      ctx.fillStyle=grad;
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(x,y,r*.96,0,Math.PI*2);
      ctx.clip();
      ctx.lineCap='round';
      if(l===0){
        ctx.fillStyle='rgba(255,190,170,.28)';
        for(let a=0;a<Math.PI*2;a+=Math.PI*2/3){
          ctx.beginPath();
          ctx.ellipse(x+Math.cos(a)*r*.26,y+Math.sin(a)*r*.2,r*.18,r*.1,a,0,Math.PI*2);
          ctx.fill();
        }
        ctx.fillStyle='rgba(255,242,200,.7)';
        for(let a=0;a<Math.PI*2;a+=Math.PI*2/5){
          ctx.beginPath();
          ctx.arc(x+Math.cos(a)*r*.34,y+Math.sin(a)*r*.26,Math.max(1,r*.035),0,Math.PI*2);
          ctx.fill();
        }
      } else if(l===1){
        ctx.strokeStyle='rgba(205,49,45,.62)';
        ctx.lineWidth=Math.max(2.4,r*.16);
        ctx.beginPath();
        ctx.arc(x,y,r*.86,0,Math.PI*2);
        ctx.stroke();
        ctx.fillStyle='rgba(255,219,68,.56)';
        ctx.beginPath();
        ctx.ellipse(x-r*.02,y+r*.02,r*.5,r*.56,-.05,0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle='rgba(255,239,128,.72)';
        ctx.beginPath();
        ctx.ellipse(x,y,r*.25,r*.31,0,0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle='rgba(104,60,24,.82)';
        [-1,1].forEach(s=>{
          ctx.beginPath();
          ctx.ellipse(x+s*r*.11,y+r*.02,r*.045,r*.085,s*.35,0,Math.PI*2);
          ctx.fill();
        });
      } else if(l===2){
        ctx.fillStyle='rgba(255,250,192,.34)';
        ctx.beginPath();
        ctx.arc(x,y,r*.88,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle='rgba(255,255,235,.78)';
        ctx.lineWidth=Math.max(1.1,r*.045);
        ctx.beginPath();
        ctx.arc(x,y,r*.8,0,Math.PI*2);
        ctx.stroke();
        for(let a=0;a<Math.PI*2;a+=Math.PI/5){
          ctx.beginPath();
          ctx.moveTo(x+Math.cos(a)*r*.08,y+Math.sin(a)*r*.08);
          ctx.lineTo(x+Math.cos(a)*r*.86,y+Math.sin(a)*r*.86);
          ctx.stroke();
        }
        ctx.fillStyle='rgba(255,225,76,.18)';
        for(let a=Math.PI/10;a<Math.PI*2;a+=Math.PI/5){
          ctx.beginPath();
          ctx.ellipse(x+Math.cos(a)*r*.48,y+Math.sin(a)*r*.48,r*.23,r*.09,a,0,Math.PI*2);
          ctx.fill();
        }
      } else if(l===3){
        ctx.fillStyle='rgba(70,45,28,.22)';
        for(let a=0;a<Math.PI*2;a+=Math.PI/5){
          ctx.beginPath();
          ctx.arc(x+Math.cos(a)*r*.42,y+Math.sin(a)*r*.42,Math.max(1.2,r*.035),0,Math.PI*2);
          ctx.fill();
        }
        ctx.fillStyle='rgba(235,245,210,.34)';
        ctx.beginPath();
        ctx.arc(x,y,r*.36,0,Math.PI*2);
        ctx.fill();
      } else if(l===4){
        ctx.fillStyle='rgba(255,238,174,.32)';
        ctx.beginPath();
        ctx.arc(x,y,r*.86,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle='rgba(255,246,210,.72)';
        ctx.lineWidth=Math.max(1.2,r*.045);
        ctx.beginPath();
        ctx.arc(x,y,r*.78,0,Math.PI*2);
        ctx.stroke();
        for(let a=0;a<Math.PI*2;a+=Math.PI/5){
          ctx.beginPath();
          ctx.moveTo(x+Math.cos(a)*r*.08,y+Math.sin(a)*r*.08);
          ctx.lineTo(x+Math.cos(a)*r*.84,y+Math.sin(a)*r*.84);
          ctx.stroke();
        }
        ctx.fillStyle='rgba(255,172,40,.18)';
        for(let a=Math.PI/10;a<Math.PI*2;a+=Math.PI/5){
          ctx.beginPath();
          ctx.ellipse(x+Math.cos(a)*r*.46,y+Math.sin(a)*r*.46,r*.24,r*.11,a,0,Math.PI*2);
          ctx.fill();
        }
      } else if(l===5){
        ctx.fillStyle='rgba(255,178,168,.34)';
        for(let a=0;a<Math.PI*2;a+=Math.PI*2/4){
          ctx.beginPath();
          ctx.ellipse(x+Math.cos(a)*r*.28,y+Math.sin(a)*r*.23,r*.28,r*.13,a,0,Math.PI*2);
          ctx.fill();
        }
        ctx.fillStyle='rgba(255,242,202,.78)';
        for(let a=0;a<Math.PI*2;a+=Math.PI*2/12){
          ctx.beginPath();
          ctx.arc(x+Math.cos(a)*r*.36,y+Math.sin(a)*r*.28,Math.max(1.3,r*.028),0,Math.PI*2);
          ctx.fill();
        }
        ctx.fillStyle='rgba(150,25,32,.16)';
        ctx.beginPath();
        ctx.arc(x,y,r*.18,0,Math.PI*2);
        ctx.fill();
      } else if(l===6){
        ctx.strokeStyle='rgba(238,255,210,.62)';
        ctx.lineWidth=Math.max(.8,r*.018);
        for(let k=-7;k<=7;k++){
          const off=(k*.13 + (k%2)*.035)*r;
          ctx.beginPath();
          ctx.moveTo(x-r*.9,y+off-r*(.08+(k%3)*.025));
          ctx.bezierCurveTo(x-r*.48,y+off+r*(.1-(k%2)*.06),x+r*.24,y+off-r*(.12+(k%4)*.02),x+r*.9,y+off+r*(.07-(k%3)*.018));
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x+off-r*(.06-(k%2)*.02),y-r*.9);
          ctx.bezierCurveTo(x+off+r*(.13+(k%3)*.018),y-r*.42,x+off-r*(.11-(k%4)*.012),y+r*.22,x+off+r*(.08+(k%2)*.02),y+r*.9);
          ctx.stroke();
        }
        ctx.strokeStyle='rgba(255,255,232,.42)';
        ctx.lineWidth=Math.max(.7,r*.014);
        for(let k=-6;k<=6;k++){
          ctx.beginPath();
          ctx.moveTo(x-r*.78,y+(k*.14-.05)*r);
          ctx.quadraticCurveTo(x-r*.12,y+(k*.12+(k%2)*.05)*r,x+r*.78,y+(k*.14+.05)*r);
          ctx.stroke();
        }
      } else if(l===7){
        ctx.strokeStyle='rgba(132,96,18,.42)';
        ctx.lineWidth=Math.max(1.2,r*.035);
        for(let k=-6;k<=6;k++){
          ctx.beginPath();
          ctx.moveTo(x-r*.95,y+(k*.2-.9)*r);
          ctx.lineTo(x+(k*.2+.9)*r,y+r*.95);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x+r*.95,y+(k*.2-.9)*r);
          ctx.lineTo(x-(k*.2+.9)*r,y+r*.95);
          ctx.stroke();
        }
        ctx.fillStyle='rgba(120,82,20,.22)';
        for(let yy=-.55;yy<=.55;yy+=.28){
          for(let xx=-.55;xx<=.55;xx+=.28){
            if(xx*xx+yy*yy>.72) continue;
            ctx.beginPath();
            ctx.arc(x+xx*r,y+yy*r,Math.max(1.2,r*.025),0,Math.PI*2);
            ctx.fill();
          }
        }
      } else if(l===8){
        ctx.strokeStyle='rgba(8,78,37,.58)';
        ctx.lineWidth=Math.max(2,r*.075);
        for(let i=-3;i<=3;i++){
          const side = i === 0 ? 0 : (i < 0 ? -1 : 1);
          const topX = x + i*r*.16;
          const midX = x + i*r*.26 + side*r*.12;
          const botX = x + i*r*.16;
          const wobble = (i % 2 ? -1 : 1) * r*.055;
          ctx.beginPath();
          ctx.moveTo(topX,y-r*.92);
          ctx.bezierCurveTo(midX+wobble,y-r*.62,midX-wobble,y-r*.28,midX,y-r*.05);
          ctx.bezierCurveTo(midX+wobble*1.2,y+r*.22,midX-wobble*.8,y+r*.56,botX,y+r*.92);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.strokeStyle='rgba(0,0,0,.22)';
      ctx.lineWidth=Math.max(1.5,r*.05);
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.5)';
      ctx.beginPath();
      ctx.ellipse(x-r*.28,y-r*.34,r*.18,r*.1,-.55,0,Math.PI*2);
      ctx.fill();
      if(l>=2){
        ctx.strokeStyle='#5f7f3d';
        ctx.lineWidth=Math.max(1.2,r*.06);
        ctx.beginPath();
        ctx.moveTo(x-r*.08,y-r*.92);
        ctx.quadraticCurveTo(x+r*.06,y-r*1.12,x+r*.18,y-r*.92);
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawAim(){ if(!aiming || aimX == null || dropping || gamePaused || over) return; const f=fruits[next], x=Math.max(f.r, Math.min(W-f.r, aimX)), y=f.r+6; ctx.save(); ctx.setLineDash([5,5]); ctx.strokeStyle='rgba(58,143,145,.62)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,36); ctx.lineTo(x,H-4); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); drawFruit(x,y,next,.58,1); }
    function draw(){ const night=isNightTheme(); const pal=canvasThemePalette(); ctx.clearRect(0,0,W,H); const bg=ctx.createLinearGradient(0,0,0,H); bg.addColorStop(0,pal.top); bg.addColorStop(1,pal.bottom); ctx.fillStyle=bg; ctx.fillRect(0,0,W,H); ctx.fillStyle=pal.pattern; for(let y=54;y<H;y+=42) for(let x=(y/42)%2?26:10;x<W;x+=52){ ctx.beginPath(); ctx.arc(x,y,2.2,0,Math.PI*2); ctx.fill(); } ctx.strokeStyle=pal.border; ctx.lineWidth=3; ctx.strokeRect(1.5,1.5,W-3,H-3); ctx.setLineDash([6,6]); ctx.strokeStyle=night?pal.grid:'rgba(216,75,66,.38)'; ctx.beginPath(); ctx.moveTo(0,36); ctx.lineTo(W,36); ctx.stroke(); ctx.setLineDash([]); ctx.font='12px Georgia, serif'; ctx.fillStyle=pal.text; ctx.fillText('下一颗', 12, 22); drawFruit(W-34,22,next,1,.62,0); balls.forEach(b=>{ if(!b) return; drawFruit(b.x,b.y,b.l,1,1,b.a||0); }); drawAim(); ctx.textAlign='left'; ctx.textBaseline='alphabetic'; if(!over && !seen.near_top && balls.some(b=>b.y-fruits[b.l].r<72 && Math.abs(b.vy)<.35)){ seen.near_top=1; speak('watermelon','near_top'); } if(!over && !seen.gameover && balls.some(b=>b.y-fruits[b.l].r<50 && Math.abs(b.vy)<.3) && balls.length>8){ seen.gameover=1; speak('watermelon','gameover'); } }
  }

  function startLudo(state) {
    const box = qs('#wb-gamebox');
    const path = [[5,10],[4,10],[3,10],[2,10],[1,10],[0,10],[0,9],[0,8],[0,7],[0,6],[0,5],[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[10,1],[10,2],[10,3],[10,4],[10,5],[10,6],[10,7],[10,8],[10,9],[10,10],[9,10],[8,10],[7,10],[6,10]];
    const starts = { red:[[1,7],[1,9],[3,7],[3,9]], blue:[[7,1],[9,1],[7,3],[9,3]] };
    const finish = { red:[[5,9],[5,8],[5,7],[5,6]], blue:[[5,1],[5,2],[5,3],[5,4]] };
    const offset = { red:0, blue:20 };
    const FINAL_POS = 43;
    let red = Array.isArray(state?.red) ? state.red.map(v => Number.isFinite(Number(v)) ? Number(v) : -1) : [-1,-1,-1,-1];
    let blue = Array.isArray(state?.blue) ? state.blue.map(v => Number.isFinite(Number(v)) ? Number(v) : -1) : [-1,-1,-1,-1];
    let turn = state?.turn || (state?.firstMover === 'ta' ? 'blue' : 'red'), dice = state?.dice || 0, rolled = !!state?.rolled, busy=false, over=false, redSixStreak = state?.redSixStreak || 0, turnCount = state?.turnCount || 0, diceRolling=false, diceRollingSide='', diceTimer=null, diceAutoTimer=null, diceStopper=null, diceFace=dice || 1;
    box.innerHTML = '<div class="wb-ludo-panel"><div class="wb-ludo-info"><span class="wb-pill" id="wb-ludo-turn"></span><span class="wb-ludo-dice" id="wb-ludo-dice"></span><button class="wb-btn primary" id="wb-ludo-roll">掷骰</button></div><div class="wb-ludo" id="wb-ludo-board"></div></div>';
    setScore('ludo', 0); draw(); save();
    if (!state?.turn && state?.firstMover) speakFirstMover('ludo', state.firstMover);
    qs('#wb-ludo-roll').onclick = () => { if(diceRolling && diceRollingSide==='red' && diceStopper) { diceStopper(true); return; } if(turn==='red' && !rolled && !busy && !gamePaused) rollRed(); };
    if (red.every(p=>Number(p)>=FINAL_POS)) setTimeout(()=>checkWin('red'), 0);
    else if (blue.every(p=>Number(p)>=FINAL_POS)) setTimeout(()=>checkWin('blue'), 0);
    else if (turn === 'blue' && !rolled) setTimeout(robot, 650);
    function save(){ if(!over) saveProgress('ludo', { red, blue, turn, dice, rolled, redSixStreak, turnCount }); }
    function roll(){ return 1 + Math.floor(Math.random()*6); }
    function diceDotsHTML(v){
      const dots = { 1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] }[v] || [];
      return Array.from({length:9},(_,i)=>dots.includes(i)?'<span class="wb-ludo-dot"></span>':'<span></span>').join('');
    }
    function setDiceDisplay(v, rolling){ const d=qs('#wb-ludo-dice'); if(d){ d.innerHTML=v ? diceDotsHTML(v) : ''; d.classList.toggle('rolling', !!rolling); d.classList.toggle('one', v===1); } }
    function animateDice(side, autoMs, done){
      if(diceRolling) return;
      diceRolling = true;
      diceRollingSide = side || '';
      busy = true;
      const finalDice = roll();
      diceFace = dice || 1;
      setDiceDisplay(diceFace, true);
      draw();
      diceTimer = setInterval(()=>{ diceFace = diceFace % 6 + 1; setDiceDisplay(diceFace, true); }, 70);
      const stop = manual => {
        if(!diceRolling) return;
        clearInterval(diceTimer);
        clearTimeout(diceAutoTimer);
        diceTimer = null;
        diceAutoTimer = null;
        diceRolling = false;
        diceRollingSide = '';
        diceStopper = null;
        dice = manual && side === 'red' ? (diceFace || finalDice) : finalDice;
        setDiceDisplay(dice, false);
        done(dice);
      };
      diceStopper = stop;
      diceAutoTimer = setTimeout(()=>stop(false), Math.max(300, autoMs || 1200));
    }
    function legal(arr,d){ const n = Number(d) || 0; return arr.map((p,i)=> canMove(Number(p),n) ? i : -1).filter(i=>i>=0); }
    function canMove(pos,d){ if(pos<0) return d===6; return pos+d<=FINAL_POS; }
    function nextPos(pos,d){ return Number(pos)<0 ? 0 : Math.min(FINAL_POS, Number(pos)+Number(d)); }
    function rollRed(){ animateDice('red', 1200, value=>{ turnCount++; dice = Math.max(1, Math.min(6, Number(value) || 1)); rolled=true; busy=false; redSixStreak = dice===6 ? redSixStreak + 1 : 0; if(dice===6) speak('ludo','roll_6'); const moves=legal(red,dice); draw(); if(!moves.length) { speak('ludo','no_move'); toast(dice===6?'没有可移动棋子':'需要掷到6才能让停机坪棋子起飞'); setTimeout(endTurn,650); } else if(dice===6 && red.some(p=>Number(p)<0)) toast('掷到6了，点击一枚棋子起飞'); save(); }); }
    function moveRed(i){
      const moves=legal(red,dice);
      if(turn!=='red'||!rolled||!moves.includes(i)) return;
      if(gamePaused){ gamePaused=false; gameActiveStartedAt = Date.now(); hideGamePauseOverlay(); }
      if(busy && !diceRolling) busy=false;
      if(busy) return;
      const wasHome=Number(red[i])<0;
      red[i]=nextPos(red[i],dice);
      if(wasHome) speak('ludo','user_takeoff');
      afterMove('red');
    }
    function robot(){ if(over||gamePaused) return; animateDice('blue', 900, value=>{ turnCount++; rolled=true; busy=true; draw(); setTimeout(()=>{ const moves=legal(blue,value); if(moves.length){ const i=chooseRobot(moves, value); const wasHome=blue[i]<0; blue[i]=nextPos(blue[i],value); if(wasHome) speak('ludo','char_takeoff'); afterMove('blue'); } else endTurn(); },450); }); }
    function globalPos(side,pos){ return pos>=0 && pos<40 ? (offset[side] + pos) % 40 : -1; }
    function canCaptureGlobal(side, arr, targetGp){
      return targetGp >= 0 && arr.some(pos => {
        for (let d=1; d<=6; d++) if (canMove(Number(pos), d) && globalPos(side, nextPos(Number(pos), d)) === targetGp) return true;
        return false;
      });
    }
    function ludoThreat(side, pos){
      const gp = globalPos(side, pos);
      if (gp < 0) return false;
      return side === 'blue' ? canCaptureGlobal('red', red, gp) : canCaptureGlobal('blue', blue, gp);
    }
    function chooseRobot(moves, rollValue){
      const n = Number(rollValue || dice) || 0;
      const takeoff = n === 6 ? moves.filter(i => Number(blue[i]) < 0) : [];
      if (takeoff.length) return takeoff[Math.floor(Math.random() * takeoff.length)];
      const active = blue.map(Number).filter(p => p >= 0 && p < FINAL_POS);
      const front = active.length ? Math.max(...active) : 0;
      const scored = moves.map(i => {
        const from = Number(blue[i]);
        const to = nextPos(from, n);
        const gp = globalPos('blue', to);
        let s = to * 8 + Math.random();
        if (to >= FINAL_POS) s += 5000;
        if (gp >= 0 && red.some(r => globalPos('red', r) === gp)) s += 2400;
        if (from >= 0 && ludoThreat('blue', from) && !ludoThreat('blue', to)) s += 750;
        if (to >= 38 && to < FINAL_POS) s += 700 + (to - 38) * 80;
        if (from >= 0 && from < front - 8) s += Math.min(900, (front - from) * 42);
        if (gp >= 0 && ludoThreat('blue', to)) s -= 420;
        if (blue.some((p, idx) => idx !== i && Number(p) === to)) s -= 180;
        return { i, s };
      }).sort((a,b) => b.s - a.s);
      const top = scored.filter(x => x.s >= scored[0].s - 160);
      return top[Math.floor(Math.random() * top.length)].i;
    }
    function sideArr(side){ return side === 'red' ? red : blue; }
    function afterMove(side){ capture(side); if(sideArr(side).some(p=>p>=40&&p<FINAL_POS)) speak('ludo','near_finish'); draw(); save(); if(checkWin(side)) return; if(dice===6){ turn=side; rolled=false; busy=false; if(side==='blue') setTimeout(robot,650); else draw(); save(); } else endTurn(); }
    function capture(side){ const otherSide=side==='red'?'blue':'red', mine=sideArr(side), other=sideArr(otherSide); mine.forEach(p=>{ const gp=globalPos(side,p); if(gp<0) return; other.forEach((q,i)=>{ if(globalPos(otherSide,q)===gp){ other[i]=-1; speak('ludo', side==='red' ? 'user_capture' : 'char_capture'); } }); }); }
    function checkWin(side){ const arr=sideArr(side); if(arr.every(p=>Number(p)>=FINAL_POS)){ over=true; clearProgress('ludo'); const meta = { consecutiveSixes:redSixStreak, userHomeAll:red.every(p=>p<0), opponentOnePieceLeft: side==='red' ? blue.filter(p=>Number(p)>=FINAL_POS).length>=3 : red.filter(p=>Number(p)>=FINAL_POS).length>=3 }; if(side==='red'){ { const curScore = scores().ludo; setScore('ludo', ((curScore && typeof curScore === 'object' ? curScore.user : curScore) || 0) + 1); } speak('ludo','user_win'); showGameOver('ludo','你赢了','本局分数：1胜，回合数：'+turnCount, null, meta); } else { speak('ludo','user_lose'); showGameOver('ludo','游戏结束','本局分数：0胜（TA获胜），回合数：'+turnCount, null, meta); } return true; } return false; }
    function endTurn(){ turn=turn==='red'?'blue':'red'; rolled=false; dice=0; busy=false; draw(); save(); if(turn==='blue') setTimeout(robot,650); }
    function posCoord(side,pos,idx){ if(pos<0) return starts[side][idx]; if(pos>=40) { const f=Math.min(3,pos-40); return finish[side][f] || [5,5]; } return path[globalPos(side,pos)]; }
    function draw(){ const board=qs('#wb-ludo-board'); const cells=[]; const charLabel=displayCharName(); for(let y=0;y<11;y++) for(let x=0;x<11;x++){ let cls='wb-ludo-cell'; if(path.some(p=>p[0]===x&&p[1]===y)) cls+=' path'; if(starts.red.some(p=>p[0]===x&&p[1]===y)||finish.red.some(p=>p[0]===x&&p[1]===y)) cls+=' home-red'; if(starts.blue.some(p=>p[0]===x&&p[1]===y)||finish.blue.some(p=>p[0]===x&&p[1]===y)) cls+=' home-blue'; cells.push('<div class="'+cls+'" data-x="'+x+'" data-y="'+y+'"></div>'); } board.innerHTML=cells.join(''); addPieces('red',red); addPieces('blue',blue); const t=qs('#wb-ludo-turn'); if(t) t.textContent=turn==='red'?'你的回合':charLabel+'的回合'; setDiceDisplay(dice, diceRolling); const rb=qs('#wb-ludo-roll'); if(rb){ const userRolling=diceRolling&&diceRollingSide==='red'; const charRolling=diceRolling&&diceRollingSide==='blue'; rb.disabled=gamePaused || charRolling || (turn!=='red' && !userRolling) || (rolled && !userRolling) || (busy && !userRolling); rb.textContent=userRolling ? '停止' : (charRolling ? charLabel + '掷骰中' : '掷骰'); } }
    function addPieces(side,arr){ const moves=side==='red'&&turn==='red'&&rolled ? legal(red,dice) : []; arr.forEach((p,i)=>{ const xy=posCoord(side,p,i); const cell=qs('.wb-ludo-cell[data-x="'+xy[0]+'"][data-y="'+xy[1]+'"]'); if(!cell) return; const b=getHostDocument().createElement('button'); b.type='button'; const can=moves.includes(i); b.className='wb-ludo-piece '+(side==='red'?'red':'blue')+(can?' can':''); b.disabled=side!=='red'||!can; b.textContent=i+1; let tapped=false; const tap=e=>{ e.preventDefault(); if(tapped) return; tapped=true; moveRed(i); setTimeout(()=>{ tapped=false; }, 260); }; b.onclick=tap; b.onpointerup=tap; cell.appendChild(b); }); }
  }

  function startGuessNumber(state) {
    const box = qs('#wb-gamebox');
    let answer = state?.answer || shuffleArray('0123456789'.split('')).slice(0,4).join('');
    let tries = state?.tries || 0, history = Array.isArray(state?.history) ? state.history : [], over=false;
    const mobileInput = isMobileHost();
    box.innerHTML = '<div class="wb-guess-panel wb-number-guess"><div class="wb-guess-title">猜数字</div><div class="wb-muted">角色想好了一个四位数。输入四位不重复数字，提示会显示“数字对几个、位置对几个”。</div><div class="wb-guess-row"><input class="wb-input" id="wb-num-guess" inputmode="' + (mobileInput ? 'none' : 'numeric') + '" maxlength="4" placeholder="输入四位数" ' + (mobileInput ? 'readonly autocomplete="off"' : '') + '><button class="wb-btn primary" id="wb-num-submit">猜</button></div><div class="wb-num-keypad" id="wb-num-keypad">' + '1234567890'.split('').map(n=>'<button class="wb-btn" data-num="'+n+'" type="button">'+n+'</button>').join('') + '<button class="wb-btn" data-act="back" type="button">退格</button><button class="wb-btn" data-act="clear" type="button">清空</button></div><div class="wb-guess-history" id="wb-num-history"></div></div>';
    draw(); save();
    qs('#wb-num-submit').onclick = submit; qs('#wb-num-guess').onkeydown = e => { if(e.key==='Enter') submit(); };
    qsa('#wb-num-keypad .wb-btn', box).forEach(btn => btn.onclick = () => { const input=qs('#wb-num-guess'); if(!input) return; if(btn.dataset.num){ if(input.value.length<4 && !input.value.includes(btn.dataset.num)) input.value += btn.dataset.num; if(!mobileInput) input.focus(); return; } if(btn.dataset.act==='back') input.value=input.value.slice(0,-1); if(btn.dataset.act==='clear') input.value=''; if(!mobileInput) input.focus(); });
    function save(){ if(!over) saveProgress('guessnumber', { answer, tries, history }); }
    function hintText(guess, nums, pos){ return '数字对 ' + nums + ' 个，位置对 ' + pos + ' 个。'; }
    function submit(){ if(gamePaused||over) return; const input=qs('#wb-num-guess'); const g=(input.value||'').trim(); if(!/^\d{4}$/.test(g) || new Set(g).size!==4){ toast('请输入四位不重复数字'); return; } tries++; let pos=0, nums=0; for(let i=0;i<4;i++){ if(g[i]===answer[i]) pos++; if(answer.includes(g[i])) nums++; } const text=hintText(g, nums, pos); history.unshift({ guess:g, nums, pos, text }); input.value=''; if(pos===4){ over=true; const cur=scores().guessnumber; setScore('guessnumber', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); speak('guessnumber','user_win'); draw(); showGameOver('guessnumber','你猜中了','猜数次数：'+tries+'次', 'user_win', { tries }); return; } if(tries>=6) speak('guessnumber','many_tries'); else speak('guessnumber', pos>=3||nums>=4?'very_close':(pos>=2||nums>=3?'close':(nums===0?'miss':'guess'))); draw(); save(); }
    function draw(){ const h=qs('#wb-num-history'); h.innerHTML = history.length ? history.map(x=>'<div class="wb-guess-item"><b>'+esc(x.guess)+'</b>　'+esc(hintText(x.guess, x.nums, x.pos))+'</div>').join('') : '<div class="wb-muted">还没有猜测记录。</div>'; }
  }

  async function createWordGuessRounds(count, forceFallback) {
    const cfg=settings();
    const role = displayCharName();
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
    const normalize = item => { const word=String(item?.word||'').trim(); if(!word) return null; const clues=Array.isArray(item.clues)?item.clues.map(x=>String(x).trim()).filter(Boolean).slice(0,5):[]; while(clues.length<5) clues.push(clues[clues.length-1] || '这个词和现在的场景有关，你再靠近一点想。'); const raw=item.interactions||{}; const interactions={ start:String(raw.start||('我把“' + word + '”藏好了，先给你一条不太好猜的线。')), clue:String(raw.clue||'我再换一种说法，你听听是不是离它近一点。'), clue_late:String(raw.clue_late||'这个提示已经很近了，再往前一点就要碰到答案了。'), guess:String(raw.guess||'这个答案还没贴到它的影子，我再把线索往它身边推一点。'), win:String(raw.win||('猜中了。' + role + '把“' + word + '”轻轻重复了一遍，像确认你们刚才抓住了同一个小秘密。')), reveal:String(raw.reveal||('答案是“' + word + '”。' + role + '把它说出来时，语气里带着一点只属于这个词的温柔。')) }; return { word, type:String(item.type||'未分类'), length:parseInt(item.length,10)||word.length, clues, interactions }; };
    const fallback = () => shuffleArray(fallbackWords.slice()).slice(0, Math.max(5, count||5)).map(normalize).filter(Boolean);
    if (forceFallback || !cfg.apiUrl || !cfg.apiModel) return fallback();
	    const prompt = [...(promptTemplates().wordGuess || PROMPT_TEMPLATES.wordGuess), '角色描述：'+currentCharDescription(cfg), '世界背景：'+(selectedWorldText(cfg)||'无'), '大总结：'+(selectedSummaryText(cfg)||'无')].join('\n');
	    try { const txt = await callApiText(cfg, prompt, promptTemplates().systems.wordGuess || PROMPT_TEMPLATES.systems.wordGuess); const data = parseGeneratedJson(txt); const arr = Array.isArray(data) ? data : (Array.isArray(data?.rounds) ? data.rounds : []); const seenWords = {}; const rounds = arr.map(normalize).filter(Boolean).filter(r=>{ if(seenWords[r.word]) return false; seenWords[r.word]=1; return true; }); if(rounds.length>=5) return rounds; return rounds.concat(fallback().filter(r=>!seenWords[r.word])).slice(0,5); } catch(e) { console.warn('[玩伴小屋] word rounds failed:', e); }
    return fallback();
  }

	  async function startWordGuess(state) {
	    const cfg=settings(); const box=qs('#wb-gamebox');
	    const role = displayCharName();
		    const bank = !state ? wordGuessBank() : [];
	    if (!state && !bank.length) box.innerHTML='<div class="wb-guess-panel"><div class="wb-guess-title">我说你猜</div><div class="wb-api-status wb-clue-box">当前为随机题库，请点击生成为该角色生成题库。正在抽取默认题库...</div></div>';
		    function normalizeWordRound(item){ const normalized=normalizeWordGuessRoundData(item); if(normalized) return normalized; const word=String(item?.word||'').trim(); if(!word) return null; const clues=Array.isArray(item.clues)?item.clues.map(x=>String(x).trim()).filter(Boolean).slice(0,5):[]; while(clues.length<5) clues.push(clues[clues.length-1] || '这个词和现在的场景有关，你再靠近一点想。'); const raw=item.interactions||{}; return { word, type:String(item.type||'未分类'), length:parseInt(item.length,10)||word.length, clues, interactions:{ start:String(raw.start||('我把“' + word + '”藏好了，先从很远的地方说起。')), clue:Array.isArray(raw.clue)?raw.clue:String(raw.clue||'我再换一种说法，你听听是不是离它近一点。'), clue_late:String(raw.clue_late||'这个提示已经很近了，再往前一点就要碰到答案了。'), guess:Array.isArray(raw.guess)?raw.guess:String(raw.guess||'这个方向还差一点，我把线索再往它身边推近些。'), win:String(raw.win||('猜中了，答案就是“' + word + '”。')), reveal:String(raw.reveal||('答案是“' + word + '”。' + role + '把它念出来，像把这题轻轻收好。')) } }; }
	    const roundLimit = 5;
		    let rounds = Array.isArray(state?.rounds) && state.rounds.length ? state.rounds : (state?.round ? [state.round] : (bank.length ? bank.slice(0, roundLimit) : await createWordGuessRounds(roundLimit, true)));
		    rounds = rounds.map(normalizeWordRound).filter(Boolean);
		    if (!state && rounds.length < roundLimit) { const seen={}; rounds.forEach(r=>seen[r.word]=1); const more=(await createWordGuessRounds(roundLimit, true)).map(normalizeWordRound).filter(r=>r&&!seen[r.word]); rounds = rounds.concat(more).slice(0,roundLimit); }
		    if (!rounds.length && !state) rounds = await createWordGuessRounds(roundLimit, true);
		    if (!state && rounds.length && bank.length) saveWordGuessBank(rounds);
	    if (currentGame !== 'wordguess') return;
		    let round = rounds[0];
	    round = normalizeWordRound(round) || round;
	    let over=false;
    let userWins = state?.userWins || 0, taWins = state?.taWins || 0, completed = state?.completed || 0, firstClueWin = !!state?.firstClueWin, finalLineSpoken = !!state?.finalLineSpoken;
	    function finishGame(){ over=true; clearProgress('wordguess'); const userWon=userWins > (roundLimit - userWins); showGameOver('wordguess', userWon?'你赢了':'游戏结束', '本局：你猜中'+userWins+'题，共'+roundLimit+'题', userWon?'user_win':'ta_win', { firstClueWin, allCorrect: userWins >= roundLimit, userWins, completed: roundLimit }); }
	    if (!round || completed >= roundLimit) { finishGame(); return; }
	    let clueIndex = state?.clueIndex || 0, guesses = (state?.roundWord === round.word && Array.isArray(state?.guesses)) ? state.guesses : [], revealed=!!state?.revealed;
	    box.innerHTML='<div class="wb-guess-panel"><div class="wb-guess-title">我说你猜</div><div class="wb-word-meta" id="wb-word-meta"></div><div class="wb-api-status wb-clue-box" id="wb-word-clues"></div><div class="wb-guess-row"><input class="wb-input" id="wb-word-input" placeholder="输入你猜的词"><button class="wb-btn primary" id="wb-word-submit">猜</button><button class="wb-btn" id="wb-word-next">下一个描述</button><button class="wb-btn" id="wb-word-reveal">揭晓答案</button></div><div class="wb-guess-history" id="wb-word-history"></div></div>';
	    draw(); save();
	    if (!state?.roundWord) speakText(round.interactions.start);
	    qs('#wb-word-submit').onclick=submit; qs('#wb-word-next').onclick=nextClue; qs('#wb-word-reveal').onclick=reveal; qs('#wb-word-input').onkeydown=e=>{ if(e.key==='Enter') submit(); };
	    function save(){ if(!over) saveProgress('wordguess',{ rounds, roundWord:round.word, clueIndex, guesses, userWins, taWins, completed, revealed, firstClueWin, finalLineSpoken }); }
	    function visibleClues(){ return round.clues.slice(0, Math.max(1, Math.min(5, clueIndex+1))); }
		    function nextClue(){ if(gamePaused||over) return; if(clueIndex < Math.min(5, round.clues.length)-1){ clueIndex++; const inter=round.interactions||{}; const nextLines=Array.isArray(inter.clue)?inter.clue:[]; speakText(nextLines[clueIndex-1] || inter[clueIndex>=3?'clue_late':'clue']); draw(); save(); } else toast('这题已经是最后一条描述了'); }
	    function finishQuestion(userWon, label){
	      if(userWon){ if(clueIndex===0) firstClueWin = true; userWins++; const cur=scores().wordguess; setScore('wordguess', ((cur&&typeof cur==='object'?cur.user:cur)||0)+1); }
      else { taWins++; addTaWin('wordguess'); }
	      completed++;
	      const inter=round.interactions||{};
	      guesses.unshift({ guess:label, ok:!!userWon, text:userWon ? (inter.win || ('答案是：' + round.word + '。' + role + '眼睛一亮：“猜中了，就是它。”')) : (inter.reveal || ('答案是：' + round.word + '。' + role + '把答案轻轻念出来，这一题先收好。')) });
	      speakText(guesses[0].text);
      if(!finalLineSpoken && (userWins >= 3 || taWins >= 3)){ finalLineSpoken = true; speak('wordguess', userWins >= 3 ? 'user_win' : 'user_lose'); }
      draw(); save();
      showWordNextModal(userWon, guesses[0].text);
    }
    function advanceQuestion(){
      if(completed >= roundLimit){ finishGame(); return; }
      rounds.shift();
	      if(!rounds.length){ finishGame(); return; }
      round=normalizeWordRound(rounds[0]) || rounds[0]; rounds[0]=round; clueIndex=0; guesses=[]; revealed=false; draw(); save(); speakText((round.interactions||{}).start);
    }
    function showWordNextModal(userWon, text){
      const doc=getHostDocument(); const old=qs('#wb-word-next-mask', doc); if(old) old.remove();
      const mask=doc.createElement('div'); mask.className=modalMaskClass(); mask.id='wb-word-next-mask';
      mask.innerHTML='<div class="wb-modal"><div class="wb-modal-title">' + (userWon?'猜中了':'答案已揭晓') + '</div><div class="wb-api-status" style="margin-bottom:12px;">' + esc(text || '') + '</div><div class="wb-actions"><button class="wb-btn primary" id="wb-word-go-next">进入下一题</button></div></div>';
      appendModalMask(mask);
      qs('#wb-word-go-next', mask).onclick=()=>{ mask.remove(); advanceQuestion(); };
    }
	    function reveal(){ if(gamePaused||over||revealed) return; revealed=true; clueIndex=Math.min(4, round.clues.length-1); finishQuestion(false, '揭晓答案'); }
		    function submit(){ if(gamePaused||over) return; const input=qs('#wb-word-input'); const guess=(input.value||'').trim(); if(!guess){ toast('请输入猜测'); return; } input.value=''; if(guess===round.word){ finishQuestion(true, guess); } else { const inter=round.interactions||{}; const wrong=Array.isArray(inter.guess)?inter.guess:[]; guesses.unshift({ guess, ok:false, text: wrong[Math.min(wrong.length-1, guesses.filter(g=>!g.ok).length)] || inter.guess || (role + '轻轻摇头，又把提示说得更软了一点。') }); speakText(guesses[0].text); draw(); save(); } }
    function draw(){ qs('#wb-word-meta').textContent = '第 ' + (completed+1) + ' 题　字数：' + (round.length || (round.word || '').length) + ' 字　类型：' + (round.type || '未分类') + '　' + visibleClues().length + '/5　你赢：' + userWins; qs('#wb-word-clues').textContent = visibleClues().map((c,i)=>(i+1)+'. '+c).join('\n') + (revealed ? '\n\n答案：' + round.word : ''); qs('#wb-word-history').innerHTML = guesses.length ? guesses.map(g=>'<div class="wb-guess-item"><b>'+esc(g.guess)+'</b>　'+(g.ok?'你赢':'未中')+'<br>'+esc(g.text)+'</div>').join('') : '<div class="wb-muted">还没有猜测。</div>'; }
  }

  function startTetris(state) {
    const box = qs('#wb-gamebox');
    box.innerHTML = '<div class="wb-tetris-shell"><canvas class="wb-canvas wb-tetris-canvas" id="wb-canvas" width="300" height="600"></canvas><div class="wb-tetris-controls" aria-label="俄罗斯方块触控"><button class="wb-btn" id="wb-tetris-rotate" type="button">转换</button><button class="wb-btn primary" id="wb-tetris-softdrop" type="button">加速</button></div></div>';
    const c=qs('#wb-canvas'), ctx=c.getContext('2d'), W=10,H=20,S=30;
    const shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];
    let board = Array.isArray(state?.board) && state.board.length === H ? state.board : Array.from({length:H},()=>Array(W).fill(0));
    let piece = state?.piece || newPiece(), nextPiece = state?.nextPiece || newPiece(), score = state?.score || 0, tetrisSeen = state?.seen || {}, totalLines = state?.totalLines || 0, over=false;
    setScore('tetris', score);
    function cloneShape(s){ return s.map(r=>r.slice()); }
    function newPiece(){ const s=cloneShape(shapes[Math.floor(Math.random()*shapes.length)]); return {s,x:3,y:0}; }
    function save(){ if(!over) saveProgress('tetris', { board, piece, nextPiece, score, seen:tetrisSeen, totalLines }); }
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
    function tick(){ if(over || gamePaused) return; if(!move(0,1)){ piece.s.forEach((r,y)=>r.forEach((v,x)=>{ if(v&&piece.y+y>=0) board[piece.y+y][piece.x+x]=1; })); let cleared=0; board=board.filter(r=>{ if(r.every(Boolean)){ cleared++; return false; } return true; }); while(board.length<H) board.unshift(Array(W).fill(0)); if(cleared){ totalLines += cleared; score += [0,100,300,500,800][cleared]; setScore('tetris',score); speak('tetris','line_'+cleared); if(score>=500&&score<600) speak('tetris','score_500'); if(score>=1500&&score<1600) speak('tetris','score_1500'); const milestone = Math.floor(score / 500) * 500; if(milestone >= 2000 && !tetrisSeen['score_'+milestone]){ tetrisSeen['score_'+milestone]=1; speak('tetris','score_2000_plus'); } } if(!tetrisSeen.danger && board.slice(0,5).some(r=>r.some(Boolean))){ markTetris('danger'); } piece=nextPiece; nextPiece=newPiece(); if(hit(piece)){ over=true; clearInterval(tetrisTimer); speak('tetris','gameover'); showGameOver('tetris', '游戏结束', '本局分数：' + score + '分', null, { lines: totalLines }); return; } } draw(); save(); }
    function drawPreview(night){ const panel={x:206,y:10,w:84,h:84}, s=nextPiece.s, cell=13; ctx.fillStyle=night?'rgba(17,24,39,.88)':'rgba(255,250,242,.92)'; ctx.fillRect(panel.x,panel.y,panel.w,panel.h); ctx.strokeStyle=night?'rgba(255,255,255,.2)':'rgba(80,55,48,.22)'; ctx.strokeRect(panel.x+.5,panel.y+.5,panel.w-1,panel.h-1); ctx.fillStyle=night?'#f5eafa':'#5d4038'; ctx.font='12px Georgia, serif'; ctx.fillText('下一块', panel.x+10, panel.y+17); const ox=panel.x+(panel.w-s[0].length*cell)/2, oy=panel.y+34+(42-s.length*cell)/2; s.forEach((r,y)=>r.forEach((v,x)=>{ if(v){ ctx.fillStyle='#ef8f7a'; ctx.fillRect(ox+x*cell+1,oy+y*cell+1,cell-2,cell-2); } })); }
    function draw(){ const night=isNightTheme(); const pal=canvasThemePalette(); const bg=ctx.createLinearGradient(0,0,0,600); bg.addColorStop(0,pal.top); bg.addColorStop(1,pal.bottom); ctx.fillStyle=bg; ctx.fillRect(0,0,300,600); ctx.fillStyle=pal.pattern; for(let y=0;y<600;y+=60) for(let x=0;x<300;x+=60) ctx.fillRect(x,y,30,30); ctx.strokeStyle=pal.grid; for(let x=1;x<W;x++){ ctx.beginPath(); ctx.moveTo(x*S,0); ctx.lineTo(x*S,600); ctx.stroke(); } for(let y=1;y<H;y++){ ctx.beginPath(); ctx.moveTo(0,y*S); ctx.lineTo(300,y*S); ctx.stroke(); } const drawCell=(x,y,col)=>{ ctx.fillStyle=col; ctx.fillRect(x*S+1,y*S+1,S-2,S-2); }; board.forEach((r,y)=>r.forEach((v,x)=>v&&drawCell(x,y,'#9ccbbb'))); piece.s.forEach((r,y)=>r.forEach((v,x)=>v&&drawCell(piece.x+x,piece.y+y,'#ef8f7a'))); drawPreview(night); }
  }

  function addSwipe(el, cb) { el.ontouchstart = e => { const t=e.touches[0]; touchStart={x:t.clientX,y:t.clientY}; }; el.ontouchend = e => { if(!touchStart) return; const t=e.changedTouches[0], dx=t.clientX-touchStart.x, dy=t.clientY-touchStart.y; if(Math.max(Math.abs(dx),Math.abs(dy))<24) return; cb(Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up')); touchStart=null; }; }

}
