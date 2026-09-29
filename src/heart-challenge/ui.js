import * as E from './engine.js?v=4.1.13-heart-logs';
import { bankCatalog, createCustomBank } from './banks.js?v=4.1.13-heart-logs';
import { createRepository } from './repository.js?v=4.1.13-heart-logs';
import { loadHeartPromptTemplates, buildHeartRequest } from './prompts.js?v=4.1.13-heart-logs';
import { installPreparedPreview, installDemoRoom } from './preview.js?v=4.1.13-heart-logs';
import { createFittedReader } from './reader.js?v=4.1.13-heart-logs';

import { roomSessions, collectedCards, storyChapters } from './records.js?v=4.1.13-heart-logs';
import { cardArtwork } from './card-art.js?v=4.1.13-heart-logs';
import { generationLogFilename, generationLogText } from './generation-log.js?v=4.1.13-heart-logs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const typeName = type => type === 'T' ? '真心话' : '大冒险';
const button = (action, label, value = '', primary = false, disabled = false) => `<button type="button" class="hc-btn${primary ? ' hc-primary' : ''}" data-action="${esc(action)}" data-value="${esc(value)}"${disabled ? ' disabled' : ''}>${label}</button>`;
const option = (value, label, selected) => `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;
const input = (key, label, value, type = 'text', extra = '') => `<label class="hc-field"><span>${esc(label)}</span><input data-field="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const area = (key, label, value, extra = '') => `<label class="hc-field hc-wide"><span>${esc(label)}</span><textarea data-field="${key}" rows="4" ${extra}>${esc(value)}</textarea></label>`;
const select = (key, label, choices, value) => `<label class="hc-field"><span>${esc(label)}</span><select data-field="${key}">${choices.map(([id, name]) => option(id, name, value)).join('')}</select></label>`;
const check = (key, label, value, extra = '') => `<label class="hc-check"><input type="checkbox" data-field="${key}"${value ? ' checked' : ''} ${extra}><span>${esc(label)}</span></label>`;
const date = value => new Date(value).toLocaleString();
const toolIcons = {
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  records:'<path d="M6 3h10l3 3v15H6zM9 9h7M9 13h7M9 17h4"/>',
  cards:'<rect x="6" y="4" width="13" height="17" rx="2"/><path d="M3 16V3a2 2 0 0 1 2-2h10M12.5 9l3 3-3 3-3-3z"/>',
  chat:'<path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z"/><path d="M7 9h8M7 13h5"/>',
};
const toolIcon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${toolIcons[name]}</svg>`;
const DEFAULT_AVATARS = Array.from({ length:15 }, (_, index) => ({
  name:index === 13 ? '像素小猫' : index === 14 ? '像素小狗' : `像素角色 ${index + 1}`, avatar:`pixel:${index}`,
}));

export function safeImage(value) {
  const url = String(value || '').trim();
  return /^(https?:\/\/|\/(?!\/)|\.\.?\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(url) ? url : '';
}
export function avatarHTML(player) {
  if (player?.avatarMode === 'emoji') {
    const label = Array.from(player.avatar || player.name || '♡').slice(0, 32).join('');
    return `<span class="hc-avatar hc-emoji-avatar" role="img" aria-label="${esc(player.name || label)}">${esc(label)}</span>`;
  }
  const pixel = String(player?.avatar || '').match(/^pixel:(\d|1[0-4])$/);
  if (pixel) {
    const index = Number(pixel[1]), x = index % 5 * 25, y = Math.floor(index / 5) * 50;
    return `<span class="hc-avatar hc-pixel-avatar" style="--hc-avatar-x:${x}%;--hc-avatar-y:${y}%" role="img" aria-label="${esc(player?.name || DEFAULT_AVATARS[index].name)}"></span>`;
  }
  const url = safeImage(player?.avatar);
  return `<span class="hc-avatar">${url ? `<img src="${esc(url)}" alt="${esc(player?.name || '')}" loading="lazy" referrerpolicy="no-referrer">` : esc((player?.avatar && !/[:/]/.test(player.avatar) ? player.avatar : player?.name || '♡').slice(0, 16))}</span>`;
}

export function cardAvatarChoices(world, cards, players = []) {
  const character = world?.character || {};
  const sourceCardId = world?.sourceKind === 'current-card' && world.sourceId?.startsWith('current-card:')
    ? world.sourceId.slice('current-card:'.length) : '';
  const cardId = character.cardId || sourceCardId;
  const legacy = players.find(p => p.origin === 'world' && (!cardId || p.cardId === cardId));
  const id = cardId || legacy?.cardId || '';
  const assets = cards.filter(card => card.avatar);
  const current = assets.find(card => card.id === id);
  // Keep the imported portrait even if the host switches cards or the seat picks another avatar.
  const avatar = character.avatar || current?.avatar || legacy?.cardAvatar;
  if (!avatar) return assets;
  const match = current || (!id && assets.find(card => card.avatar === avatar));
  const first = { id:id || match?.id || 'world-card-avatar', name:character.name || match?.name || legacy?.name || '世界观角色卡', avatar };
  return [first, ...assets.filter(card => card.id !== first.id)];
}

export function userAvatarChoices(current, assets = []) {
  const seen = new Set(), choices = [];
  for (const item of [{ ...current, current:true }, ...assets]) {
    const avatar = safeImage(item?.avatar);
    if (!avatar || seen.has(avatar)) continue;
    seen.add(avatar);
    choices.push({ ...item, avatar, current:avatar === current?.avatar });
  }
  return choices;
}

export function createHeartChallenge(root, host) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const renderAvatar = player => avatarHTML(player?.id === 'USER' && (!player.avatarMode || player.avatarMode === 'current') ? { ...player, avatar:host.user().avatar || player.avatar } : player);
  const styleURL = new URL('./style.css?v=4.1.13-heart-logs', import.meta.url).href;
  if (!doc.querySelector('#wb-heart-style')) {
    const link = doc.createElement('link'); link.id = 'wb-heart-style'; link.rel = 'stylesheet';
    link.href = styleURL; doc.head.appendChild(link);
  }
  if (doc.querySelector('#wb-heart-style').href !== styleURL) doc.querySelector('#wb-heart-style').href = styleURL;
  const roomStyleURL = new URL('./room.css?v=4.1.13-heart-logs', import.meta.url).href;
  if (!doc.querySelector('#wb-heart-room-style')) {
    const link = doc.createElement('link'); link.id = 'wb-heart-room-style'; link.rel = 'stylesheet'; doc.head.appendChild(link);
  }
  if (doc.querySelector('#wb-heart-room-style').href !== roomStyleURL) doc.querySelector('#wb-heart-room-style').href = roomStyleURL;
  const collectionURL = new URL('./collections.css?v=4.1.13-heart-logs', import.meta.url).href;
  let collectionStyle = doc.querySelector('#wb-heart-collection-style');
  if (!collectionStyle) { collectionStyle = doc.createElement('link'); collectionStyle.id = 'wb-heart-collection-style'; collectionStyle.rel = 'stylesheet'; doc.head.append(collectionStyle); }
  if (collectionStyle.href !== collectionURL) collectionStyle.href = collectionURL;
  const repo = createRepository(host.storage || win.localStorage);
  let page = 'rooms', draft = null, overlay = null, busy = null, disposed = false;
  let notice = '', failureRaw = '', freeOpen = false;
  let demoLoading = false;
  let lastInput = null, selectedGenerationLog = null;
  let freeDraftTimer = null, pendingFreeDraft = null, progressFrame = null, layoutFrame = null;
  let failureGameId = '', worldReadId = 0;
  const worldPartReads = new Map();
  const emojiDrafts = new Map();
  const reader = createFittedReader(root, { position:() => run()?.readingPosition,
    onMove:position => { if (page === 'play' && !overlay && run()) mutateGame((g, r) => { r.readingPosition = position; }); } });
  const resizeObserver = new win.ResizeObserver(onViewport);
  resizeObserver.observe(root);
  let renderedPage = '', renderedTurn = '', returnFocus = null;
  let settingsTab = 'play', settingsReturn = 'play', collectionReturn = 'play', recordsTab = 'story';
  let archiveOpen = '', archiveGroup = '', cardsGameId = '';
  let bankFilter = '', bankSearch = '', recordFilter = '', recordSearch = '';
  let selectedBank = 'regular', bankDraft = null, bankEditorTab = 'T';
  const catalog = () => bankCatalog(repo.state.banks);
  let replay = null, replayRound = '';
  let worldOptions = host.worlds(), cardOptions = host.cards(), apiOptions = host.apis();
  const room = () => repo.state.rooms.find(r => r.id === repo.state.activeRoomId);
  const game = () => room()?.games.find(g => g.id === room().activeGameId);
  const run = () => E.currentRun(game());
  const update = fn => repo.update(fn);
  const mutateRoom = fn => update(store => {
    const target = store.rooms.find(r => r.id === store.activeRoomId);
    if (!target) throw new Error('房间不存在，请返回房间列表。'); return fn(target);
  });
  const mutateGame = fn => mutateRoom(r => {
    const g = r.games.find(g => g.id === r.activeGameId);
    if (!g) throw new Error('游戏不存在，请返回房间。'); return fn(g, E.currentRun(g));
  });
  function report(error) { notice = error?.message || String(error); host.toast?.(notice); render(); }
  function download(name, data) {
    const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type:'text/plain;charset=utf-8' });
    const url = win.URL.createObjectURL(blob), a = doc.createElement('a'); a.href = url; a.download = name;
    doc.body.appendChild(a); a.click(); a.remove(); win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  }
  function confirm(title, body, action) { overlay = { title, text:body, confirm:action }; render(); }
  function flushFreeDraft() {
    if (freeDraftTimer !== null) win.clearTimeout(freeDraftTimer);
    freeDraftTimer = null;
    const pending = pendingFreeDraft;
    if (!pending) return;
    update(store => {
      const target = store.rooms.find(r => r.id === pending.roomId)?.games.find(g => g.id === pending.gameId)?.runs.find(r => r.id === pending.runId);
      if (!target) throw new Error('输入所属的游戏已变化，请重新载入。');
      target.freeDraft = pending.text;
    });
    pendingFreeDraft = null;
  }
  function queueFreeDraft(value) {
    pendingFreeDraft = { roomId:room().id, gameId:game().id, runId:run().id, text:value };
    if (freeDraftTimer !== null) win.clearTimeout(freeDraftTimer);
    freeDraftTimer = win.setTimeout(() => {
      try { flushFreeDraft(); } catch (error) { notice = error.message; host.toast?.(notice); }
    }, 300);
  }
  function persistDraft() {
    flushFreeDraft();
    if (!draft) return;
    const value = E.clone(draft);
    value.config = E.normalizeConfig(value.config);
    mutateRoom(r => {
      for (const key of ['title', 'world', 'players', 'config']) if (value[key] !== undefined) r[key] = value[key];
      if (page === 'room-settings') {
        const active = r.games.find(game => game.id === r.activeGameId);
        if (active) {
          active.snapshot.title = r.title;
          const config = E.normalizeConfig(r.config);
          for (const key of ['api', 'replyApi', 'maxTokens', 'regenerations']) active.snapshot.config[key] = config[key];
          for (const person of [active.snapshot.world.user, ...active.snapshot.players]) {
            const edited = [r.world.user, ...r.players].find(item => item.id === person.id);
            if (edited) for (const key of ['avatar', 'avatarMode', 'cardAvatar']) if (edited[key] !== undefined) person[key] = edited[key];
          }
        }
      }
    });
  }
  function refreshSources() { worldOptions = host.worlds(); cardOptions = host.cards(); apiOptions = host.apis(); }
  function edit(kind) {
    refreshSources(); draft = E.clone(room()); emojiDrafts.clear();
    draft.config = E.normalizeConfig(draft.config);
    if (draft.world.user.avatarMode === 'current') draft.world.user.avatar = host.user().avatar || draft.world.user.avatar;
    if (kind === 'world' || kind === 'room-settings') {
      draft.worldSource = worldOptions.some(item => item.id === draft.world.sourceId) ? draft.world.sourceId : (worldOptions[0]?.id || '');
    }
    page = kind; overlay = null; render();
  }
  function cancel(message = '已取消，可以从保存的节点重试。') {
    if (!busy) return;
    const job = busy; busy = null; job.controller.abort(); failureRaw = job.raw || failureRaw; failureGameId = job.gameId;
    if (job.log) {
      try { persistAttempt({ ...job.log, raw:job.receivedRaw || job.raw, status:'cancelled', error:message, finishedAt:Date.now() }); }
      catch (error) { host.toast?.('生成记录本地保存失败：' + error.message); }
    }
    try { update(store => {
      const g = store.rooms.find(r => r.id === job.roomId)?.games.find(g => g.id === job.gameId);
      if (g?.request?.id === job.id) { g.request.status = 'cancelled'; g.error = { message, raw:job.raw || '', task:job.task, input:job.input }; }
    }); } catch (error) { notice = error.message; }
  }
  function leave() { persistDraft(); cancel(); destroy(); host.home(); }
  function destroy() {
    if (disposed) return;
    try { persistDraft(); } catch (error) { host.toast?.(error.message); }
    cancel('离开页面时已取消生成，返回后可以重试。'); disposed = true;
    if (freeDraftTimer !== null) win.clearTimeout(freeDraftTimer);
    if (progressFrame !== null) win.cancelAnimationFrame(progressFrame);
    if (layoutFrame !== null) win.cancelAnimationFrame(layoutFrame);
    resizeObserver.disconnect(); reader.clear();
    win.removeEventListener('resize', onViewport);
    win.visualViewport?.removeEventListener('resize', onViewport);
    doc.removeEventListener('visibilitychange', onVisibility); win.removeEventListener('pagehide', onPageHide);
    root.removeEventListener('click', onClick); root.removeEventListener('input', onInput);
    root.removeEventListener('change', onChange); root.removeEventListener('keydown', onKey);
    root.removeEventListener('toggle', onDisclosure, true);
  }
  function onVisibility() { if (doc.visibilityState === 'hidden') { try { persistDraft(); } catch (e) { notice = e.message; } } }
  function onPageHide() { try { persistDraft(); } catch (error) { notice = error.message; } cancel('页面关闭，生成已中断。'); }

  function persistAttempt(value) {
    update(store => {
      store.generationLogs ||= [];
      const index = store.generationLogs.findIndex(item => item.id === value.id);
      if (index < 0) store.generationLogs.push(value); else store.generationLogs[index] = value;
    });
  }
  async function saveAttempt(record) {
    // Keep a local fallback until the server confirms the complete raw output was saved.
    try { persistAttempt(record); }
    catch (error) { host.toast?.('生成记录本地保存失败：' + error.message); }
    if (!host.saveGenerationLog) return;
    try {
      const path = await host.saveGenerationLog(record);
      const { raw, ...entry } = record;
      persistAttempt({ ...entry, path });
    } catch (error) {
      host.toast?.('生成记录未能写入后台，已尝试保留本地副本：' + error.message);
      console.warn('[心动挑战] 生成记录保存失败', error);
    }
  }

  async function request(task, submitted = '') {
    if (busy) return;
    const g = game(), r = run();
    if (!g || task === 'game' && g.content) throw new Error('当前游戏不能重新生成。');
    if (task === 'reply' && (!['choice', 'turnEnd'].includes(r?.stage) || !submitted.trim())) throw new Error('请在互动节点输入内容。');
    if (task === 'ending' && r?.stage !== 'settlement') throw new Error('请先完成全部轮次。');
    const job = { id:E.uid('request'), roomId:room().id, gameId:g.id, task, input:submitted.trim(), raw:'', controller:new AbortController(), attempt:0, phase:'templates' };
    mutateGame(current => { current.request = { id:job.id, task, input:job.input, status:'pending', at:Date.now() }; current.error = null; });
    busy = job; lastInput = null; notice = ''; freeOpen = false; overlay = null; page = 'play'; render();
    try {
      const promptGame = E.clone(game()), promptRun = E.currentRun(promptGame), cfg = promptGame.snapshot.config;
      const templates = await loadHeartPromptTemplates(task, { signal:job.controller.signal });
      if (busy !== job || disposed) return;
      job.phase = 'generation';
      // Every attempt starts from the same saved input; failed output never becomes model context.
      const { prompt, input } = buildHeartRequest(task, promptGame, promptRun, job.input, templates);
      lastInput = { gameId:job.gameId, task, input };
      render();
      for (let attempt = 0; attempt <= cfg.regenerations; attempt++) {
        if (busy !== job || disposed) return;
        job.controller.signal.throwIfAborted();
        job.attempt = attempt; job.raw = ''; renderProgress();
        let data, output, completedOutput, checkedEnd = 0;
        let receivedRaw = '', attemptError = '';
        const startedAt = Date.now();
        let checkpointAt = startedAt;
        job.log = { id:job.id + '-' + (attempt + 1), requestId:job.id,
          roomId:job.roomId, roomTitle:promptGame.snapshot.title, gameId:job.gameId, task,
          attempt:attempt + 1, startedAt, status:'pending', raw:'' };
        job.receivedRaw = '';
        try { persistAttempt(job.log); } catch (error) { host.toast?.('生成记录本地保存失败：' + error.message); }
        const streamController = new AbortController();
        const cancelStream = () => streamController.abort(job.controller.signal.reason);
        job.controller.signal.throwIfAborted();
        job.controller.signal.addEventListener('abort', cancelStream, { once:true });
        try {
          output = await host.request({ api:task === 'reply' ? (cfg.replyApi || cfg.api) : cfg.api, prompt,
            maxTokens:task === 'game' ? cfg.maxTokens : task === 'reply' ? 3000 : 6000, signal:streamController.signal,
            onDelta:delta => {
              receivedRaw += delta;
              job.receivedRaw = receivedRaw;
              if (busy !== job || disposed || completedOutput) return;
              if (Date.now() - checkpointAt >= 2000) {
                checkpointAt = Date.now();
                try { persistAttempt({ ...job.log, raw:receivedRaw }); }
                catch (error) { console.warn('[心动挑战] 生成记录暂存失败', error); }
              }
              job.raw += delta;
              if (task === 'game') for (const closing of job.raw.matchAll(/<\/story\s*>/gi)) {
                const end = closing.index + closing[0].length;
                if (end <= checkedEnd) continue;
                checkedEnd = end;
                const candidate = job.raw.slice(0, end);
                try { data = E.validateContent(candidate, promptGame); } catch { continue; }
                completedOutput = candidate; job.raw = candidate;
                // Valid completion closes only this stream, not the user's generation job.
                streamController.abort(); break;
              }
              if (progressFrame === null) progressFrame = win.requestAnimationFrame(() => { progressFrame = null; renderProgress(); });
            } });
          job.controller.signal.throwIfAborted(); job.raw = completedOutput || output;
          data ||= task === 'game' ? E.validateContent(output, promptGame) : task === 'reply' ? E.validateReply(output, promptGame, promptRun) : E.validateEnding(output);
        } catch (error) {
          const raw = error.raw || error.rawOutput || job.raw || '';
          if (raw.length > receivedRaw.length) receivedRaw = raw;
          attemptError = error.message || String(error);
          job.controller.signal.throwIfAborted();
          // A transport cutoff after a complete story must not discard the validated game.
          if (!data && task === 'game' && output === undefined && raw) {
            try { data = E.validateContent(raw, promptGame); } catch { /* Incomplete stories still regenerate. */ }
          }
          if (!data) {
            if (attempt >= cfg.regenerations) throw Object.assign(error, { raw });
            continue;
          }
        } finally {
          job.controller.signal.removeEventListener('abort', cancelStream);
          const status = job.controller.signal.aborted ? 'cancelled' : data ? 'success' : 'failed';
          await saveAttempt({ ...job.log, finishedAt:Date.now(), status,
            error:status === 'success' ? '' : attemptError || (status === 'cancelled' ? '玩家取消生成' : '未收到有效结果'),
            raw:typeof output === 'string' && output.length >= receivedRaw.length ? output : receivedRaw });
        }
        if (busy !== job || disposed) return;
        update(store => {
          const current = store.rooms.find(r => r.id === job.roomId)?.games.find(g => g.id === job.gameId);
          if (current?.request?.id !== job.id) throw new Error('生成目标已改变，结果没有写入其他游戏。');
          const active = E.currentRun(current);
          if (task === 'game') { current.content = data; const next = E.newRun(current); current.runs.push(next); current.activeRunId = next.id; }
          else if (task === 'reply') E.applyReply(current, active, job.input, data);
          else E.finishGame(current, active, data);
          current.request = null; current.error = null;
        });
        failureRaw = ''; freeOpen = task === 'reply' && data.state === 'wait' && !data.conflict; return;
      }
    } catch (error) {
      if (busy !== job || disposed) return;
      failureRaw = error.raw || job.raw || ''; failureGameId = job.gameId; notice = '';
      try { update(store => {
        const current = store.rooms.find(r => r.id === job.roomId)?.games.find(g => g.id === job.gameId);
        if (current?.request?.id === job.id) { current.request.status = 'failed'; current.error = { task, input:job.input, message:error.message, raw:failureRaw }; }
      }); } catch (storageError) { notice += '；' + storageError.message + '。可导出本次原文后重试。'; }
    } finally { if (busy === job) { busy = null; if (progressFrame !== null) win.cancelAnimationFrame(progressFrame); progressFrame = null; if (!disposed) render(); } }
  }
  function renderProgress() {
    const el = root.querySelector('[data-progress]');
    if (el && busy) el.textContent = busy.phase === 'templates' ? '正在读取提示词文件…' : `${busy.attempt ? '失败后重新生成 · 第 ' + busy.attempt + ' 次 · ' : ''}已收到 ${busy.raw.length.toLocaleString()} 字${busy.raw.length ? '，完成后检查全部剧情' : '，正在等待模型响应'}`;
    const output = root.querySelector('[data-output]');
    if (output && busy) output.textContent = (busy.raw || '等待模型返回内容……').slice(-160);
  }
  function header() {
    const r = room();
    return `<header class="hc-header">${button('home', '‹ 小屋')}<div class="hc-brand"><h2>心动挑战</h2></div><button type="button" class="hc-room-switch" data-action="rooms">${renderAvatar(r?.players[0] || { name:'♡' })}<span>${esc(r?.title || '选择房间')}⌄</span></button>${page === 'rooms' || page === 'room' ? button('add-room', '＋', '', false, repo.state.rooms.length >= E.HEART_LIMITS.rooms) : ''}</header>`;
  }
  function roomsHTML() {
    return `<section class="hc-scroll hc-library"><div class="hc-lead"><h1>房间</h1></div>${repo.state.rooms.length ? `<div class="hc-room-grid">${repo.state.rooms.map(r => `<article class="hc-room-card-wrap"><button type="button" class="hc-room-card" data-action="select-room" data-value="${esc(r.id)}">${renderAvatar(r.players[0] || r.world.user)}<div><h3>${esc(r.title)}</h3><p>${esc(r.players.map(p => p.name).join(' / ') || '等待入座')}</p><small>${r.games.length} 局 · ${esc((r.world.background || r.world.view || r.world.sourceName).slice(0, 80))}</small></div><span>↗</span></button><button type="button" class="hc-room-delete" data-action="delete-room" data-value="${esc(r.id)}" aria-label="删除房间 ${esc(r.title)}">删除</button></article>`).join('')}</div>` : `<div class="hc-empty"><h3>暂无存档</h3></div>`}<div class="hc-actions">${button('add-room', '添加房间', '', true, repo.state.rooms.length >= E.HEART_LIMITS.rooms)}${button('demo-room', demoLoading ? '正在载入…' : '添加测试房间', '', false, demoLoading)}${button('help', '玩法说明')}</div></section>`;
  }
  function roomHTML() {
    const r = room(), g = game(), play = run(), ongoing = g && (!g.content || !['settlement', 'ending'].includes(play?.stage));
    const label = r.pendingOrder ? '继续安排座次' : !g ? '开始游戏'
      : play?.stage === 'ending' ? '查看结局' : play?.stage === 'settlement' ? '查看结算'
      : g.content ? '继续游戏 · 第 ' + (play.roundIndex + 1) + ' 轮' : '继续准备';
    return `<section class="hc-scroll hc-library"><div class="hc-lead"><span class="hc-kicker">${esc(r.world.sourceName || '独立世界')}</span><h1>${esc(r.title)}</h1>${r.world.background || r.world.view ? `<p>${esc((r.world.background || r.world.view).slice(0, 180))}</p>` : ''}</div><div class="hc-seats">${[r.world.user, ...r.players].map(p => `<div class="hc-seat">${renderAvatar(p)}<strong>${esc(p.name)}</strong></div>`).join('')}</div><div class="hc-room-primary hc-actions">${button(g || r.pendingOrder ? 'resume' : 'setup', label, '', true)}${g ? button('history', '回看故事') : ''}${g && !ongoing ? button('setup', '开启下一把') : ''}</div>${ongoing && g.content ? `<p class="hc-hint">当前进度：${esc(g.content.rounds[play.roundIndex].title)}</p>` : ''}<details class="hc-box hc-room-settings" data-section="room-settings"><summary>房间资料与管理</summary><div class="hc-actions">${button('edit-world', '世界观设置')}${!ongoing ? button('setup', '角色与玩法') : ''}${button('generation-logs', '生成测试记录')}${button('export-room', '导出房间')}${button('delete-room', '删除房间')}</div><p class="hc-hint">修改资料会用于之后的故事；进行中的故事保留开局设定。</p></details></section>`;
  }
  function worldHTML() {
    const w = draft.world, cfg = w.injection;
    const selected = worldOptions.find(item => item.id === draft.worldSource);
    const languages = host.languages?.() || ['粤语','古言','日语','英语','韩语','法语','俄语','西语'];
    if (w.language && !languages.includes(w.language)) languages.push(w.language);
    const choices = worldOptions.map(item => [item.id, item.name]);
    return `<section class="hc-scroll hc-form hc-world-form">
      <div class="hc-section-head"><div><h2>世界观设置</h2></div>${button('room', '返回房间')}</div>
      <div class="hc-form-grid">${input('title', '房间标题', draft.title, 'text', 'maxlength="80"')}
        ${select('worldSource', '载入世界观', choices, draft.worldSource)}
        <div class="hc-actions hc-wide">${button('import-world', selected?.kind === 'current-card' ? '注入当前角色卡' : '载入世界观配置', '', true)}${button('host-settings', '打开小屋设置')}</div>
        ${input('world.user.name', '你的称呼', w.user.name, 'text', 'maxlength="80" required')}
      </div>
      <section class="hc-box hc-injection-section">${check('world.injection.lazyWorldInject', '懒人模式（当前角色卡全部信息）', cfg.lazyWorldInject)}<p class="hc-hint">自动导入当前 User 人设、角色卡全部描述，并挂载蓝灯与绿灯世界书。</p></section>
      <section class="hc-box hc-injection-section">${check('world.injection.injectUserDesc', '用户设定描述', cfg.injectUserDesc)}
        <fieldset${cfg.injectUserDesc ? '' : ' disabled'}><div class="hc-form-grid">${select('world.injection.userDescSource', '用户来源', [['auto','自动导入当前 User 人设'],['manual','手动添加']], cfg.userDescSource)}
        <div class="hc-actions">${button('import-user', '重新读取当前 User 人设')}</div>
        ${area('world.user.persona', '用户设定', w.user.persona, 'placeholder="填写你的设定、性格、关系与偏好"')}</div></fieldset>
      </section>
      <section class="hc-box hc-injection-section">${check('world.injection.injectCharDesc', '角色描述', cfg.injectCharDesc)}
        <fieldset${cfg.injectCharDesc ? '' : ' disabled'}><div class="hc-form-grid">${select('world.injection.charDescMode', '角色描述来源', [['auto','自动导入当前角色卡'],['manual','手动添加']], cfg.charDescMode)}
        ${input('world.character.name', '角色姓名（可选）', w.character.name, 'text', 'maxlength="80"')}
        ${cfg.charDescMode === 'manual' ? area('world.character.manualDescription', '手动角色描述', w.character.manualDescription, 'placeholder="填写角色的性格、说话方式、关系设定"')
          : `<div class="hc-actions hc-wide">${button('refresh-character', '重新读取当前角色卡')}</div><details class="hc-wide hc-reference" data-section="character-preview"><summary>角色卡完整描述 · ${w.character.description.length.toLocaleString()} 字</summary><pre class="hc-prose">${esc(w.character.description || '尚未读取角色卡描述。')}</pre></details>`}</div></fieldset>
      </section>
      <section class="hc-box hc-injection-section">${check('world.injection.specialLanguageEnabled', '特殊语言要求', cfg.specialLanguageEnabled)}
        ${cfg.specialLanguageEnabled ? select('world.language', '使用语言', languages.map(lang => [lang, lang]), w.language || languages[0]) : ''}
      </section>
      <section class="hc-box hc-injection-section">${check('world.injection.injectChat', '注入最新聊天记录', cfg.injectChat)}
        ${cfg.injectChat ? `<div class="hc-actions">${button('refresh-chat', '重新读取最新聊天')}</div><details class="hc-reference" data-section="chat-preview"><summary>已读取的聊天 · ${w.chat.length.toLocaleString()} 字</summary><pre class="hc-prose">${esc(w.chat || '当前没有可读取的聊天记录。')}</pre></details>` : ''}
      </section>
      <section class="hc-box hc-injection-section">${area('world.breakLimitPrompt', '前置提示词 / 破限词（自动保存）', w.breakLimitPrompt, 'placeholder="填写希望置于生成提示词最前面的风格补充"')}</section>
      <section class="hc-box hc-injection-section"><h3>当前挂载的世界书</h3><div class="hc-form-grid">
        ${select('world.injection.worldAutoMountMode', '自动挂载', [['','手动选择'],['blue','蓝灯'],['bluegreen','蓝灯 + 绿灯']], cfg.worldAutoMountMode)}
        <div class="hc-actions">${button('refresh-worldbook', '刷新全部条目')}</div></div>
        <p class="hc-hint">${esc([...new Set(w.entries.map(e => e.wbName).filter(Boolean))].join(' / ') || '尚未挂载世界书')} · 已选 ${w.entries.filter(e => e.enabled !== false).length} 条</p>
        <div class="hc-worldbook-entries">${w.entries.length ? w.entries.map((entry, i) => `<div class="hc-worldbook-entry">${check('entry.' + i, entry.label || entry.wbName || '世界书条目', entry.enabled !== false)}<details><summary>查看内容</summary><pre class="hc-prose">${esc(entry.content)}</pre></details></div>`).join('') : '<p class="hc-hint">可载入设置中已挂载的条目，或读取当前角色卡挂载的世界书。</p>'}</div>
      </section>
      ${w.summary ? `<details class="hc-box" data-section="summary-preview"><summary>已随配置载入大总结</summary><div class="hc-prose">${esc(w.summary)}</div></details>` : ''}
      <section class="hc-box hc-injection-section">${area('world.supplemental', '补充信息', w.supplemental, 'placeholder="补充本次故事的场景、关系或其他要求"')}</section>
      <footer class="hc-form-footer">${button('save-world', '保存世界观 · 设置游戏', '', true)}</footer></section>`;
  }
  async function readWorldPart(part, mode) {
    const target = draft, world = draft.world, requestId = worldReadId, ticket = {};
    const parts = part === 'lazy' ? ['user', 'character', 'books'] : [part];
    parts.forEach(key => worldPartReads.set(key, ticket));
    const value = part === 'user' ? await (host.readWorldPart ? host.readWorldPart('user') : host.user())
      : await host.readWorldPart?.(part, { mode });
    if (disposed || draft !== target || draft.world !== world || requestId !== worldReadId
      || parts.some(key => worldPartReads.get(key) !== ticket)) return;
    if (value === undefined) throw new Error('当前宿主未提供读取接口，请从小屋设置载入已有配置。');
    const w = draft.world, cfg = w.injection;
    if (part === 'user' || part === 'lazy') {
      const user = part === 'lazy' ? value.user : value;
      // The room's chosen name is independent of whichever persona is imported.
      w.user = { ...w.user, persona:user.persona || '', avatar:w.user.avatarMode === 'current' ? user.avatar || w.user.avatar : w.user.avatar };
      cfg.userDescSource = 'auto'; cfg.injectUserDesc = true;
    }
    if (part === 'character' || part === 'lazy') {
      const character = part === 'lazy' ? value.character : value;
      w.character = { ...w.character, ...character }; cfg.charDescMode = 'auto'; cfg.injectCharDesc = true;
    }
    if (part === 'chat') w.chat = value;
    if (part === 'books' || part === 'lazy') {
      const entries = part === 'lazy' ? value.entries : value;
      const selected = new Set(w.entries.filter(e => e.enabled !== false).map(e => e.wbName + ':' + e.uid + ':' + e.label));
      w.entries = entries.map(e => ({ ...e, enabled:part === 'lazy' || !!mode || selected.has(e.wbName + ':' + e.uid + ':' + e.label) }));
    }
    if (part === 'lazy') { cfg.lazyWorldInject = true; cfg.worldAutoMountMode = 'bluegreen'; }
    persistDraft(); render();
  }
  function apiChoices() { return [['', '使用设置中的当前 API'], ...apiOptions.map(a => [a.id, a.name])]; }
  function emojiEditor(player, prefix) {
    const value = emojiDrafts.get(player.id) ?? player.avatar ?? '';
    return `<div class="hc-emoji-editor hc-wide">${input(prefix + 'avatar', '输入 emoji / 简短文字', value, 'text', `maxlength="32" data-emoji-target="${esc(player.id)}" placeholder="例如：🌙、小狐"`)}${button('confirm-emoji', '确定', player.id)}</div>`;
  }
  function playerHTML(p, i, frozen) {
    const prefix = 'players.' + i + '.';
    const avatarMode = ['auto', 'card', 'emoji', 'url'].includes(p.avatarMode) ? p.avatarMode : 'auto';
    const avatarEditor = avatarMode === 'auto' ? `<div class="hc-actions hc-wide">${button('player-avatar', '选择头像', p.id)}</div>`
      : avatarMode === 'card' ? `<div class="hc-actions hc-wide">${button('player-card-avatar', p.cardAvatar ? '更换角色卡面' : '选择角色卡面', p.id)}<span class="hc-hint">从酒馆现有的全部角色卡面中看图选择。</span></div>`
      : avatarMode === 'emoji' ? emojiEditor(p, prefix)
      : input(prefix + 'avatar', '输入图片 URL', p.avatar, 'url', 'maxlength="4000" placeholder="https://…"');
    return `<article class="hc-player-editor"><div class="hc-section-head">${renderAvatar(p)}<h3>${esc(p.name || '新角色')}</h3>${button('remove-player', '移除', p.id, false, frozen)}</div><fieldset${frozen ? ' disabled' : ''}><div class="hc-form-grid">${input(prefix + 'name', '角色姓名', p.name, 'text', 'maxlength="80"')}${p.origin === 'world' ? '<p class="hc-hint">沿用这个世界中的人物设定。</p>' : area(prefix + 'description', '独立角色设定（必填）', p.description, 'maxlength="80000"')}${select(prefix + 'avatarMode', '头像方式', [['auto', '默认像素头像'], ['card', '酒馆角色卡面'], ['emoji', 'emoji / 文字'], ['url', '图片 URL']], avatarMode)}${avatarEditor}</div></fieldset></article>`;
  }
  function randomSourceHTML(c) {
    const themes = Array.isArray(c.bankThemes) ? c.bankThemes : [];
    const keywords = Array.isArray(c.bankKeywords) ? c.bankKeywords : [];
    return `<details class="hc-box hc-wide" data-section="bank-design"><summary>设计要求（可选）</summary><p class="hc-hint">不选则无要求，结合世界观与角色自由设计。</p><div class="hc-form-grid"><div class="hc-box hc-wide"><h3>卡牌风格 · 可多选</h3><div class="hc-chips">${E.HEART_BANK_THEMES.map(s => `<label class="hc-chip"><input type="checkbox" data-bank-theme="${esc(s)}"${themes.includes(s) ? ' checked' : ''}><span>${esc(s)}</span></label>`).join('')}</div></div><div class="hc-box hc-wide"><h3>题目关键词 · 可多选</h3><div class="hc-chips">${E.HEART_BANK_KEYWORDS.map(s => `<label class="hc-chip"><input type="checkbox" data-bank-keyword="${esc(s)}"${keywords.includes(s) ? ' checked' : ''}><span>${esc(s)}</span></label>`).join('')}</div></div>${input('config.customTheme', '补充卡牌主题', c.customTheme, 'text', 'maxlength="500" placeholder="例如：本丸夜谈、宿敌合作"')}${input('config.keywords', '手动补充题目关键词', c.keywords, 'text', 'maxlength="500" placeholder="多个关键词可用逗号分隔"')}</div></details>`;
  }
  function userAvatarHTML(frozen) {
    const user = draft.world.user, mode = ['auto', 'current', 'tavern', 'emoji', 'url'].includes(user.avatarMode) ? user.avatarMode : 'current';
    const editor = mode === 'auto' ? `<div class="hc-actions hc-wide">${button('user-avatar', '选择像素头像', '', false, frozen)}</div>`
      : ['current', 'tavern'].includes(mode) ? `<div class="hc-actions hc-wide">${button('user-tavern-avatar', '选择酒馆用户头像', '', false, frozen)}${button('import-user-avatar', '使用当前头像', '', false, frozen)}<span class="hc-hint">当前头像排在第一位，也可选择酒馆里保存的其他用户头像。</span></div>`
      : mode === 'emoji' ? emojiEditor(user, 'world.user.')
      : input('world.user.avatar', '输入图片 URL', user.avatar, 'url', 'maxlength="4000" placeholder="https://…"');
    return `<article class="hc-player-editor hc-wide"><div class="hc-section-head">${renderAvatar(user)}<h3>${esc(user.name || 'USER')} · 你的头像</h3></div><fieldset${frozen ? ' disabled' : ''}><div class="hc-form-grid">${select('world.user.avatarMode', '头像方式', [['current', '跟随酒馆当前头像'], ['tavern', '酒馆用户头像'], ['auto', '默认像素头像'], ['emoji', 'emoji / 文字'], ['url', '图片 URL']], mode)}${editor}</div></fieldset></article>`;
  }
  function setupHTML() {
    const c = draft.config, previous = room().games.some(g => g.content), frozen = previous && page !== 'room-settings';
    const limit = c.mode === 'duo' ? 1 : 5;
    const people = !frozen ? `<div class="hc-actions hc-wide">${button('add-player', '＋ 世界中的角色', 'world', false, draft.players.length >= limit)}${button('add-player', '＋ 新角色', 'custom', false, draft.players.length >= limit)}</div>` : '';
    const source = c.source === 'builtin'
      ? select('config.bank', '选择题库', catalog().filter(b => !(b.id === 'intimate' || b.adult) || c.nsfw).map(b => [b.id, b.name]), c.bank) : randomSourceHTML(c);
    const focus = c.mode === 'multi' ? select('config.focusMode', '多人关注方式', [['balanced', '平均关注'], ['focused', '重点关注']], c.focusMode)
      + (c.focusMode === 'focused' ? `<div class="hc-wide hc-chips">${draft.players.map(p => `<label class="hc-chip"><input type="checkbox" data-focus="${p.id}"${c.focus.includes(p.id) ? ' checked' : ''}><span>${esc(p.name || '待命名')}</span></label>`).join('')}</div>` : '') : '';
    return `<section class="hc-scroll hc-form">
      <div class="hc-section-head"><div><h2>${previous ? '下一局设置' : '游戏设置'}</h2></div>${button('room', '返回房间')}</div>

      <details class="hc-box hc-cast-settings" data-section="cast"${!draft.players.length || draft.players.some(p => !p.name) ? ' open' : ''}><summary><strong>参与角色</strong><span>${esc([draft.world.user.name, ...draft.players.map(p => p.name || '待命名')].join(' · '))}</span></summary><div class="hc-form-grid">
        <fieldset class="hc-wide"${frozen ? ' disabled' : ''}>${select('config.mode', '参与模式', [['duo', '双人 · 你与一名角色'], ['multi', '多人 · 你与 2—5 名角色']], c.mode)}</fieldset>
        ${userAvatarHTML(frozen)}<div class="hc-wide">${draft.players.map((p, i) => playerHTML(p, i, frozen)).join('')}</div>${people}
      </div></details>
      <section class="hc-box hc-mood-settings"><h3>局势风格 · 可多选</h3><p class="hc-hint">不选则无要求。</p><div class="hc-chips">${E.HEART_STYLES.map(s => `<label class="hc-chip"><input type="checkbox" data-style="${esc(s)}"${c.styles.includes(s) ? ' checked' : ''}><span>${esc(s)}</span></label>`).join('')}</div><div class="hc-form-grid">
        ${select('config.narrativePerson', '人称', Object.entries(E.HEART_NARRATIVE_PERSONS), c.narrativePerson)}
        ${select('config.rounds', '轮数', [[1, '1 轮'], [2, '2 轮'], [4, '4 轮']], c.rounds)}${select('config.orderMode', '行动顺序', [['fate', '抽签排序'], ['manual', '手动排序']], c.orderMode)}
      </div></section>
      <details class="hc-box" data-section="bank"><summary><strong>牌库与边界</strong><span>${c.source === 'builtin' ? esc(catalog().find(b => b.id === c.bank)?.name || '常规题库') : '自由设计'} · ${c.nsfw ? '成人剧情已开启' : '常规剧情'}</span></summary><fieldset${frozen ? ' disabled' : ''}><div class="hc-form-grid">
        ${check('config.nsfw', '允许成人亲密剧情', c.nsfw)}${select('config.source', '牌库来源', [['builtin', '已有牌库 · 适配人物'], ['random', '自由设计牌库']], c.source)}${source}${input('config.excludes', '不想聊到的话题', c.excludes, 'text', 'maxlength="500" placeholder="用逗号分隔关键词"')}${focus}
      </div></fieldset>${button('banks', '翻阅题库')}</details>
      <details class="hc-box" data-section="connection"><summary><strong>生成设置</strong><span>${esc(apiOptions.find(a => a.id === c.api)?.name || '使用当前 API 预设')}</span></summary><div class="hc-form-grid">
        ${select('config.api', '剧情生成 API', apiChoices(), c.api)}${select('config.replyApi', '自由互动 API', [['', '跟随剧情生成 API'], ...apiOptions.map(a => [a.id, a.name])], c.replyApi)}
        ${input('config.maxTokens', '整把输出上限 tokens', c.maxTokens, 'number', 'min="4096" max="65536" step="1024"')}${select('config.regenerations', '失败后重新生成次数', [[0, '关闭'], [1, '最多 1 次'], [2, '最多 2 次']], c.regenerations)}
      </div><p class="hc-hint">开局生成整把故事，普通选牌与选择无需等待。自由输入和结局会单独生成。重新生成次数不含首次请求；0 次表示失败后停止，最多 2 次表示总共最多请求 3 次。</p></details>
      <footer class="hc-form-footer">${button('prepare-order', '准备好了 · 安排座次', '', true)}</footer></section>`;
  }
  function roomSettingsHTML() {
    return `<section class="hc-settings-sheet"><header class="hc-section-head"><div><small class="hc-kicker">${esc(draft.title)}</small><h2>房间设置</h2></div>${button('close-room-settings', '返回游戏')}</header><nav class="hc-collection-tabs">${button('settings-tab', '角色与玩法', 'play', settingsTab === 'play')}${button('settings-tab', '世界观', 'world', settingsTab === 'world')}</nav><p class="hc-settings-note">自动保存。房名、头像和接口即时更新；世界观、角色与玩法用于下一把。</p><div class="hc-room-settings-editor">${settingsTab === 'world' ? worldHTML() : setupHTML()}</div><footer class="hc-actions">${button('generation-logs', '生成测试记录')}${button('view-input', '查看上次完整输入', '', false, lastInput?.gameId !== game()?.id || !lastInput)}${button('close-room-settings', '保存并返回', '', true)}</footer></section>`;
  }
  function artCard(card, extra = '') {
    return `<article class="hc-art-card ${extra}" data-type="${card.type}"><header class="hc-art-header"><span>${typeName(card.type)}</span><small>${card.type === 'T' ? 'TRUTH' : 'DARE'}</small></header><div class="hc-art-illustration">${cardArtwork(card.type)}</div><div class="hc-art-copy"><div class="hc-art-caption"><span>${esc(card.tag || typeName(card.type))}</span><i aria-hidden="true"></i></div><p class="hc-card-full-text">${esc(card.question)}</p></div><footer class="hc-art-footer"><span>${card.type === 'T' ? '♡' : '✧'}</span><small>${esc(card.round || '')}</small><span>${card.type}</span></footer></article>`;
  }
  function orderHTML() {
    const r = room(), all = [r.world.user, ...r.players], pending = r.pendingOrder, chosen = pending?.order || [];
    const fate = r.config.orderMode === 'fate';
    const ready = chosen.length === all.length && (pending?.revealed || !fate);
    const sequence = chosen.length && (pending?.revealed || !fate) ? `<ol class="hc-order-list" aria-label="行动顺序">${chosen.map(id => `<li>${esc(all.find(p => p.id === id)?.name)}</li>`).join('')}</ol>` : '';
    const actions = `<footer class="hc-actions">${button('setup', '返回设置')}${ready ? button('generate', '生成游戏', '', true) : fate && pending ? button('reveal-fate', '揭晓命运数字', '', true) : ''}</footer>`;
    if (fate && pending) {
      const target = `<div data-type="D" class="hc-fate-target${pending.revealed ? ' hc-reveal-number' : ''}"><small>命运数字</small><strong>${pending.revealed ? String(pending.target).padStart(2, '0') : '?'}</strong></div>`;
      const cards = pending.draws.map((draw, index) => {
        const person = all.find(p => p.id === draw.actor);
        return `<article class="hc-seat hc-fate-seat hc-lot-card${pending.revealed ? ' hc-lot-revealed' : ''}" data-type="D" style="--hc-seat:${index}"><header>${renderAvatar(person)}<strong>${esc(person?.name)}</strong></header><div class="hc-lot-art">${cardArtwork('D')}<b>${pending.revealed ? String(draw.number).padStart(2, '0') : '?'}</b></div><small>${pending.revealed ? '距离 ' + draw.distance + ' · 第 ' + (chosen.indexOf(draw.actor) + 1) + ' 位' : '签号已锁定'}</small></article>`;
      }).join('');
      return `<section class="hc-order hc-lottery"><header class="hc-lottery-head"><div><h1>抽签排序</h1><p>与命运数字越接近，越先行动。</p></div>${target}</header><div class="hc-lottery-cards" style="--hc-lot-count:${all.length};--hc-lot-mobile:${Math.min(3, all.length)}">${cards}</div>${sequence}${actions}</section>`;
    }
    return `<section class="hc-scroll hc-order"><h1>${fate ? '抽签排序' : '手动排序'}</h1>${fate ? `<p>每个人选择 0—99 中的一个数字。距离揭晓数字越近，越先行动；同距按初始席位排序。</p><label class="hc-field hc-number-input"><span>你的数字</span><input id="hc-fate-number" type="number" min="0" max="99" step="1" inputmode="numeric" value="${esc(r.fateNumber ?? '')}" placeholder="0—99"></label>${button('fate', '确认数字', '', true)}` : `<p>依次点击角色，包含你自己。</p><div class="hc-seats">${all.map(p => `<button type="button" class="hc-seat hc-btn" data-action="order-seat" data-value="${p.id}"${chosen.includes(p.id) ? ' disabled' : ''}>${renderAvatar(p)}<strong>${esc(p.name)}</strong></button>`).join('')}</div>${button('reset-order', '重新排列')}`}${sequence}${actions}</section>`;
  }
  function narrative(title, text, actions, kicker = '', cls = '') {
    return `<section class="hc-narrative ${cls}"><header><span class="hc-kicker">${esc(kicker)}</span><h1>${esc(title)}</h1></header>${readerHTML('narrative', text, 'hc-prose')}<footer class="hc-actions">${actions}</footer></section>`;
  }
  function readerHTML(id, text, cls = '') {
    const r = run(), key = [page, game()?.id, r?.id, r?.stage, r?.history.length, overlay?.title, id].join(':');
    return `<div class="hc-reader ${cls}" data-reader="${id}" data-reader-key="${esc(key)}"><div class="hc-reading-window"><div data-reader-text>${esc(text)}</div></div><nav class="hc-reading-nav" aria-label="文本分页"><button type="button" data-action="read-page" data-value="${id}:-1" data-reader-step="-1" aria-label="上一页">‹</button><small data-reader-count>1 / 1</small><button type="button" data-action="read-page" data-value="${id}:1" data-reader-step="1" aria-label="下一页">›</button></nav></div>`;
  }
  function progressHTML() {
    return `<section class="hc-request" role="status"><div class="hc-shuffle"><i></i><i></i><i></i></div><h2>${busy.task === 'game' ? '正在生成游戏' : busy.task === 'reply' ? '正在生成回复' : '正在生成结局'}</h2><p data-progress></p><progress aria-label="正在生成"></progress><div class="hc-live-output"><small>最新输出片段</small><p data-output>${esc((busy.raw || '等待模型返回内容……').slice(-160))}</p></div><div class="hc-actions">${button('view-input', '查看本次完整输入', '', false, !lastInput || lastInput.gameId !== busy.gameId)}${button('cancel', '取消生成')}</div></section>`;
  }
  function errorHTML(g) {
    if (!g?.error && !(failureRaw && failureGameId === g?.id)) return '';
    return `<div class="hc-error" role="alert"><p>本次生成尚未完成，已有进度已保留。</p><div class="hc-actions">${g?.error ? button('retry', '重试', '', true) : ''}${button('error-detail', '查看问题')}${button('raw-output', '失败原文')}${button('api-settings', '调整 API')}</div></div>`;
  }
  function sideToolsHTML() {
    const r = run(), canTalk = ['choice', 'turnEnd'].includes(r?.stage) && r.freeReplies < E.HEART_LIMITS.freeReplies;
    const item = (action, label, icon) => `<button type="button" class="hc-dock-button" data-action="${action}" title="${label}" aria-label="${label}"><span class="hc-dock-circle">${toolIcon(icon)}</span><small>${label}</small></button>`;
    return `<aside class="hc-side-dock" aria-label="游戏工具">${item('room-settings', '设置', 'settings')}${r?.stage === 'settlement' ? '' : item('record-tools', '记录', 'records')}${item('banks', '牌库', 'cards')}${canTalk ? item('free-toggle', freeOpen || r.awaitingReply ? '收起' : '互动', 'chat') : ''}</aside>`;
  }
  function advance(action, value) {
    if (action === 'next' && (reader.move('dialogue', 1) || reader.move('narrative', 1))) return;
    if (action === 'accept' && reader.move('card', 1)) return;
    mutateGame((g, r) => {
      E.advance(g, r, action, value);
      if (g.error?.task === 'reply') { g.error = null; g.request = null; }
    });
    failureRaw = ''; freeOpen = false; render();
  }
  function onViewport() {
    if (layoutFrame !== null) return;
    layoutFrame = win.requestAnimationFrame(() => {
      layoutFrame = null;
      if (!disposed) fitPage();
    });
  }
  function fitPage() {
    reader.fit();
    for (const text of root.querySelectorAll('.hc-card-full-text')) {
      const card = text.closest('.hc-art-card');
      card.classList.remove('hc-card-compact', 'hc-card-expanded');
      text.style.fontSize = ''; text.style.lineHeight = '';
      if (!text.clientWidth || !text.clientHeight) continue;
      const overflows = () => text.scrollHeight > text.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1;
      if (overflows()) card.classList.add('hc-card-compact');
      let size = parseFloat(win.getComputedStyle(text).fontSize);
      while (overflows() && size > 12) {
        size = Math.max(12, size - .5); text.style.fontSize = size + 'px'; text.style.lineHeight = '1.5';
      }
      // Keep very long cards readable as one sheet instead of hiding or paging their text.
      if (overflows()) card.classList.add('hc-card-expanded');
    }
    for (const label of root.querySelectorAll('.hc-choice-label')) {
      const clipped = label.scrollHeight > label.clientHeight + 1;
      label.closest('button').dataset.action = clipped ? 'inspect-option' : 'option';
      label.closest('button').classList.toggle('hc-choice-expand', clipped);
    }
  }
  function onDisclosure(event) {
    if (event.target.matches('.hc-live-output') && event.target.open) renderProgress();
  }
  function playHTML() {
    const g = game(), r = run();
    if (!g) { page = 'room'; return roomHTML(); }
    if (busy) return progressHTML();
    if (!g.content) return narrative('准备生成', `${g.snapshot.config.rounds} 轮 · ${g.order.length} 人${g.error ? '\n\n本次生成尚未完成。\n' + g.error.message : ''}`, (g.error ? button('retry', '重试', '', true) + button('raw-output', '失败原文') : button('request-game', '生成游戏', '', true)) + button('api-settings', '生成设置') + button('reset-preparation', '重新安排本把') + button('room', '返回房间'), '第 ' + g.number + ' 把');
    const topError = errorHTML(g);
    if (r.stage === 'open') return topError + narrative(g.content.scene, g.content.open, button('next', '开始游戏', '', true), '第 ' + g.number + ' 把 · 序章', 'hc-opening');
    if (r.stage === 'ending') return narrative(r.endingTitle, r.ending, button('setup', '下一局', '', true) + button('history', '回看剧情') + button('room', '返回房间'), '结局');
    if (['roundEnd', 'settlement'].includes(r.stage)) {
      const final = r.stage === 'settlement';
      const entries = r.records.filter(record => final || record.round === 'R' + (r.roundIndex + 1)).map((record, index) => ({
        card:g.content.cards.find(card => card.id === record.cardId), index,
        actor:E.actors(g).find(actor => actor.id === record.actor),
        owner:E.actorName(g, record.actor), status:record.status,
      })).filter(entry => entry.card);
      return topError + `<section class="hc-collection-page hc-settlement"><header class="hc-section-head"><div><small class="hc-kicker">第 ${g.number} 把 · ${entries.length} 张卡牌</small><h2>${final ? '本局结算' : '本轮结算'}</h2></div></header>${galleryCards(entries, 'settlement')}<footer class="hc-collection-controls hc-actions">${(!final ? button('next', '进入下一轮', '', true) : !g.error ? button('ending', '生成结局', '', true) : '') + (final ? button('setup', '下一局') : '') + button('replay-game', '重玩本局')}</footer></section>`;
    }
    const turn = E.currentTurn(g, r), card = E.currentCard(g, r);
    const history = r.history.filter(n => n.roundIndex === r.roundIndex && n.turnIndex === r.turnIndex);
    const recent = [...history].reverse().filter(n => n.text && n.speaker && !['selection', 'card', 'marker'].includes(n.kind));
    const context = recent.find(n => !['N', 'USER'].includes(n.speaker)) || recent[0];
    const speakingLine = ['choice', 'turnEnd'].includes(r.stage) ? context : r.current;
    const speaker = r.current?.speaker || (['choice', 'turnEnd'].includes(r.stage) ? context?.speaker : turn.actor);
    let center = '', actions = '', secondary = '', dialogue = '';
    if (r.stage === 'turnIntro') {
      center = `<div class="hc-turn-welcome">${renderAvatar(E.actors(g).find(p => p.id === turn.actor))}<small>现在轮到</small><h2>${esc(E.actorName(g, turn.actor))}</h2></div>`;
      actions = button('next', turn.actor === 'USER' ? '选择我的牌' : '继续', '', true);
    }
    if (['pickType', 'pick'].includes(r.stage)) {
      actions = r.stage === 'pickType' ? '' : ['T', 'D'].map(type => button('type', typeName(type), type, r.type === type, !E.availableCards(g, r, type).length)).join('');
      const cover = (type, action, value, label, index = '') => `<button type="button" class="hc-deck-cover" data-type="${type}" data-action="${action}" data-value="${esc(value)}"><header><span>${typeName(type)}</span><small>${index || type}</small></header>${cardArtwork(type)}<div class="hc-cover-caption"><b>${esc(label)}</b><small>${type === 'T' ? 'TRUTH' : 'DARE'}</small></div></button>`;
      center = `<div class="hc-cover-row">${r.stage === 'pickType' ? ['T', 'D'].filter(type => E.availableCards(g, r, type).length).map(type => cover(type, 'type', type, typeName(type))).join('') : r.offered.map((id, index) => { const candidate = g.content.cards.find(card => card.id === id); return cover(candidate.type, 'draw', id, candidate.tag, String(index + 1).padStart(2, '0')); }).join('')}</div>`;
    }
    if (card && r.stage === 'reveal') {
      center = artCard(card, 'hc-flip');
      dialogue = turn.actor !== 'USER' ? lineHTML(g, { speaker:turn.actor, text:card.declaration || '这次我选' + typeName(card.type) + '。' }) : '';
      actions = button('accept', turn.actor === 'USER' ? '回应这张牌' : '继续', '', true);
      if (turn.actor === 'USER') secondary = button('swap', '换一张 · 余 ' + Math.max(0, g.snapshot.config.swaps - r.swaps), '', false, r.swaps >= g.snapshot.config.swaps) + button('skip', '这次先跳过');
    } else if (card && !['turnIntro', 'pick', 'pickType'].includes(r.stage)) {
      center = `<button type="button" class="hc-current-card" data-action="round-replay" data-type="${card.type}"><span class="hc-mini-suit" aria-hidden="true">${cardArtwork(card.type)}</span><span><small>${typeName(card.type)}</small><strong>${esc(card.tag)}</strong></span><span class="hc-card-summary">${esc(card.question)}</span><span class="hc-card-peek">本轮回放 ↗</span></button>`;
    }
    if (['story', 'event'].includes(r.stage)) { dialogue = lineHTML(g, r.current, true); actions = button('next', '继续 ›', '', true); }
    if (r.stage === 'choice') {
      const prompt = r.current.prompt && !/^你想如何回应[？?]?$/.test(r.current.prompt) ? '\n' + r.current.prompt : '';
      dialogue = (context ? lineHTML(g, { ...context, text:context.text + prompt }, true) : readerHTML('dialogue', prompt)) + `<div class="hc-choice-prompt"><small>${r.awaitingReply ? '等待你的回复' : '轮到你回应'}</small></div>`;
      actions = r.current.options.map(o => button('option', `<span class="hc-choice-label">${esc(o.text)}</span>`, o.id)).join('');
    }
    if (r.stage === 'turnEnd') {
      const next = g.order[r.turnIndex + 1];
      dialogue = (context ? lineHTML(g, context, true) : '') + `<p class="hc-turn-finished">${r.awaitingReply ? '等待你的回复' : r.skipped ? '行动已中止' : '行动已完成'}</p>`;
      actions = button('next', next ? '下一位：' + E.actorName(g, next) : r.roundIndex + 1 < g.snapshot.config.rounds ? '本轮结算' : '本局结算', '', true);
      secondary = button('restart-turn', '重选这次回答', '', false, !E.dependenciesMet(card, r));
    }
    const canTalk = ['choice', 'turnEnd'].includes(r.stage), composing = canTalk && (freeOpen || r.awaitingReply);
    if (canTalk) secondary += button('free-toggle', composing ? '收起输入' : r.stage === 'turnEnd' ? '再聊一句' : '亲自回应', '', false, r.freeReplies >= E.HEART_LIMITS.freeReplies);
    const typed = pendingFreeDraft?.runId === r.id ? pendingFreeDraft.text : r.freeDraft;
    const controls = composing ? `<div class="hc-free"><div class="hc-composer-head"><label for="hc-free-input">${r.awaitingReply ? '回复追问' : '自由回复'}</label>${button('return-options', r.stage === 'choice' ? '返回选项' : '收起')}</div><textarea id="hc-free-input" rows="2" maxlength="3000" placeholder="输入对白或动作">${esc(typed)}</textarea><div class="hc-actions">${button('submit-free', '发送', '', true, !typed.trim())}<small>Ctrl / ⌘ + Enter 发送</small></div></div>`
      : `<div class="hc-actions${r.stage === 'choice' ? ' hc-choices' : ''}">${actions}</div>${secondary ? `<div class="hc-actions hc-secondary-actions">${secondary}</div>` : ''}`;
    return `${topError}<div class="hc-game-layout"><main class="hc-table${composing ? ' hc-composing' : ''}" data-stage="${r.stage}"><section class="hc-voice-room"><div class="hc-table-top"><div class="hc-room-meta"><span class="hc-room-badge">剧情房间 · ${g.order.length} 人</span><h3>${esc(g.snapshot.title)}</h3></div><span class="hc-round-pill">${r.roundIndex + 1} / ${g.snapshot.config.rounds} 轮 · ${r.turnIndex + 1} / ${g.order.length} 位</span>${button('room-settings', '设置')}</div>
      <div class="hc-seats hc-turn-seats" style="--hc-seats:${g.order.length}" aria-label="本轮行动顺序">${g.order.map((id, index) => { const p = E.actors(g).find(p => p.id === id); return `<button type="button" data-action="actor-detail" data-value="${id}" class="hc-seat${speaker === id ? ' hc-speaking' : ''}${turn.actor === id ? ' hc-acting' : ''}" aria-label="${esc(p.name)}，${turn.actor === id ? '本次行动' : '查看角色'}"><span class="hc-seat-portrait">${renderAvatar(p)}<span class="hc-seat-number">${String(index + 1).padStart(2, '0')}</span></span>${speaker === id && speakingLine?.emoji ? `<span class="hc-emotion">${esc(speakingLine.emoji)}</span>` : ''}<strong>${esc(p.name)}</strong><small>${speaker === id && ['story', 'choice', 'event'].includes(r.stage) ? '<i class="hc-voice-bars" aria-hidden="true"><i></i><i></i><i></i></i> 发言中' : turn.actor === id ? '本次行动' : r.records.some(x => x.round === 'R' + (r.roundIndex + 1) && x.actor === id) ? '已完成' : '等待中'}</small></button>`; }).join('')}</div></section>
      <div class="hc-table-scroll"><div class="hc-card-stage">${center}</div><div class="hc-dialogue${r.stage === 'event' ? ' hc-important' : ''}"${['story', 'event'].includes(r.stage) ? ' data-action="next" tabindex="0" role="button" aria-label="阅读下一页或继续下一句"' : ''} aria-live="polite">${dialogue}</div></div><footer class="hc-controls">${controls}</footer></main></div>`;
  }
  function lineHTML(g, line, fitted = false) {
    if (!line?.text) return '';
    const speaker = line.speaker || 'N';
    const portrait = speaker !== 'N' ? renderAvatar(E.actors(g).find(p => p.id === speaker)) : '';
    return `<div class="hc-line${speaker === 'N' ? ' hc-narrator' : ''}${fitted ? ' hc-fitted-line' : ''}">${portrait}<div class="hc-line-copy">${speaker !== 'N' ? `<b>${esc(E.actorName(g, speaker))}${line.emoji ? ' ' + esc(line.emoji) : ''}</b>` : '<small>旁白</small>'}${fitted ? readerHTML('dialogue', line.text) : `<p>${esc(line.text)}</p>`}</div></div>`;
  }
  function showHistory(tab = 'story', round = '') {
    const groups = roomSessions(room());
    const options = groups.flatMap(group => group.entries.map(entry => ({ ...entry, label:`第 ${group.number} 场 · ${date(entry.createdAt)}` })));
    replay = { options, id:options.find(entry => entry.id === game()?.activeRunId)?.id || options.at(-1)?.id || '' };
    recordsTab = tab === 'cards' ? 'cards' : 'story'; archiveOpen = replay.id;
    archiveGroup = groups.find(group => group.entries.some(entry => entry.id === archiveOpen))?.id || '';
    cardsGameId = game()?.id || ''; recordFilter = ''; recordSearch = '';
    const entry = options.find(entry => entry.id === archiveOpen);
    replayRound = round === '' ? (entry?.run.stage === 'open' || entry?.run.stage === 'ending' ? '' : String(entry?.run.roundIndex ?? 0)) : String(round);
    page = 'history'; overlay = null; render();
  }
  function historyHTML() {
    const head = `<header class="hc-section-head hc-history-head"><div><small class="hc-kicker">${esc(room().title)} · 房间记录</small><h2>剧情记录</h2></div><nav class="hc-history-tabs" aria-label="记录类型">${button('records-tab', '剧情回看', 'story', recordsTab === 'story')}${button('records-tab', '卡牌记录', 'cards', recordsTab === 'cards')}</nav>${button('resume', '返回游戏')}</header>`;
    if (recordsTab === 'cards') {
      const entries = filteredCards(recordEntries(), recordFilter, recordSearch);
      const games = room().games.map(g => option(g.id, '第 ' + g.number + ' 把' + (g.id === room().activeGameId ? ' · 本次游戏' : ''), cardsGameId)).join('');
      return '<section class="hc-collection-page hc-card-records">' + head + '<div class="hc-collection-filter"><select aria-label="卡牌所属游戏" data-collection-game>' + games + '</select><span>点击卡牌翻面查看角色</span></div>' + galleryTools('record', recordFilter, recordSearch, entries.length) + galleryCards(entries, 'flip-record-card') + '</section>';
    }
    const item = replay.options.find(entry => entry.id === archiveOpen);
    const sessions = roomSessions(room()), session = sessions.find(group => group.id === archiveGroup);
    const visible = sessions;
    const directory = visible.map(group => {
      const open = archiveGroup === group.id;
      const rounds = group.games.map(batch => {
        const entry = group.entries.find(entry => entry.game.id === batch.id && entry.id === archiveOpen)
          || group.entries.find(entry => entry.game.id === batch.id && entry.active && !entry.branch);
        if (!entry) return '';
        const indexes = [...new Set(storyChapters(entry).filter(chapter => ['turn', 'round'].includes(chapter.kind)).map(chapter => chapter.roundIndex))];
        return indexes.map(index => {
          const selected = archiveOpen === entry.id && replayRound === String(index);
          const turns = storyChapters(entry, index).filter(chapter => chapter.kind === 'turn');
          return `<div class="hc-round-fold${selected ? ' hc-round-selected' : ''}"><button type="button" data-action="archive-round" data-value="${entry.id}:${index}" aria-expanded="${selected}"><span>第 ${entry.roundOffset + index + 1} 轮</span><small>${turns.length} / ${batch.order.length} 人</small><i>${selected ? '−' : '+'}</i></button>${selected ? `<div class="hc-round-actors">${turns.map(chapter => `<span>${esc(E.actorName(batch, chapter.actor))}</span>`).join('')}</div>` : ''}</div>`;
        }).join('');
      }).join('');
      const alternatives = group.entries.filter(entry => !entry.active || entry.branch);
      return `<div class="hc-volume${open ? ' hc-volume-open' : ''}"><button type="button" class="hc-volume-heading" data-action="archive-group" data-value="${group.id}" aria-expanded="${open}"><span class="hc-volume-number">${String(group.number).padStart(2, '0')}</span><span><b>第 ${group.number} 场游戏</b><small>${group.rounds} 轮 · ${group.ended ? '已生成结局' : '进行中'}</small></span><i>${open ? '−' : '+'}</i></button>${open ? `<div class="hc-volume-entries"><button type="button" class="hc-archive-all" data-action="all-rounds">开场与全部轮次${group.ended ? ' · 结局' : ''}</button><div class="hc-round-folds">${rounds || '<small>尚未开始第一轮</small>'}</div>${alternatives.length ? `<select data-archive-entry aria-label="选择游玩记录">${group.entries.map(entry => option(entry.id, `第 ${entry.roundOffset + 1} 轮起 · ${entry.branch ? '历史分支' : entry.active ? '有效记录' : '旧记录'}`, archiveOpen)).join('')}</select>` : ''}</div>` : ''}</div>`;
    }).join('');
    const entries = session?.games.map(batch => session.entries.find(entry => entry.game.id === batch.id && entry.id === archiveOpen) || session.entries.find(entry => entry.game.id === batch.id && entry.active && !entry.branch)).filter(Boolean) || [];
    const story = replayRound === '' ? entries.map(entry => fullStoryHTML(entry, '', entry.roundOffset)).join('') : item ? fullStoryHTML(item, replayRound, item.roundOffset || 0) : '';
    return `<section class="hc-collection-page hc-room-archive">${head}<div class="hc-archive-layout"><article class="hc-story-book"><header><div class="hc-story-ribbon">${session ? '第 ' + session.number + ' 场游戏' + (replayRound !== '' ? ' · 第 ' + ((item?.roundOffset || 0) + Number(replayRound) + 1) + ' 轮' : ' · 完整记录') : '剧情档案'}</div><h3>${esc(item?.game.content?.scene || room().title)}</h3></header><div class="hc-archive-scroll hc-scroll" tabindex="0" aria-label="完整剧情回放"><details class="hc-archive-directory-fold" data-section="archive-directory" open><summary>游戏与轮次目录 <small>选择要回看的内容</small></summary><aside class="hc-archive-directory hc-scroll">${directory || '<p>还没有游戏记录。</p>'}</aside></details>${story || '<p class="hc-archive-empty">选择游戏与轮次。</p>'}</div></article></div><footer class="hc-collection-controls">${replayRound !== '' ? button('all-rounds', '全部轮次') : ''}${button('export-history', '导出', '', false, !item)}${button('manage-games', '管理记录')}</footer></section>`;
  }
  function fullStoryHTML(entry, round, roundOffset = 0) {
    const g = entry.game, chapters = storyChapters(entry, round);
    const lineHTML = line => {
      if (line.kind === 'card') return `<section class="hc-archive-line hc-archive-card" data-type="${line.type || 'T'}"><div class="hc-archive-card-art">${cardArtwork(line.type || 'T')}</div><div><b class="hc-archive-card-title">${typeName(line.type)} · 抽牌记录</b><span data-story-copy>${esc(line.text)}</span></div></section>`;
      if (!line.speaker || line.speaker === 'N') return `<section class="hc-archive-line hc-archive-narrator"><span data-story-copy>${esc(line.text)}</span></section>`;
      const person = E.actors(g).find(person => person.id === line.speaker);
      return `<section class="hc-archive-line" data-speaker="${esc(line.speaker)}"><div class="hc-archive-identity">${renderAvatar(person)}<b class="hc-archive-speaker">${esc(E.actorName(g, line.speaker))}${line.emoji ? ' ' + esc(line.emoji) : ''}</b></div><span data-story-copy>${esc(line.text)}</span></section>`;
    };
    return chapters.map(chapter => {
      let heading;
      if (chapter.kind === 'turn') {
        const person = E.actors(g).find(person => person.id === chapter.actor);
        const card = chapter.lines.find(line => line.kind === 'card');
        heading = `<header class="hc-chapter-heading"><span class="hc-chapter-number">${String(chapter.turnIndex + 1).padStart(2, '0')}</span>${renderAvatar(person)}<div><small>第 ${roundOffset + chapter.roundIndex + 1} 轮 · 第 ${chapter.turnIndex + 1} 位</small><h4>${esc(person?.name || '角色')}的回合</h4></div>${card ? `<span class="hc-chapter-type" data-type="${card.type}">${typeName(card.type)}</span>` : ''}</header>`;
      } else {
        const title = chapter.kind === 'opening' ? '开场' : chapter.kind === 'ending' ? '结局' : `第 ${roundOffset + chapter.roundIndex + 1} 轮`;
        heading = `<header class="hc-chapter-divider"><i aria-hidden="true"></i><h4>${title}</h4><i aria-hidden="true"></i></header>`;
      }
      return `<section class="hc-story-chapter" data-chapter="${esc(chapter.key)}">${heading}${chapter.lines.map(lineHTML).join('')}</section>`;
    }).join('') || '<p class="hc-archive-empty">这份记录还没有剧情。</p>';
  }
  function filteredCards(entries, type, search) {
    const query = search.trim().toLocaleLowerCase();
    return entries.filter(entry => (!type || entry.card.type === type)
      && (!query || [entry.card.tag, entry.card.question, entry.card.round, entry.owner].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)));
  }
  function galleryTools(scope, type, search, count) {
    const tabs = ['', 'T', 'D'].map(value => '<button type="button" class="hc-btn' + (type === value ? ' hc-primary' : '') + '" data-action="gallery-filter" data-value="' + scope + ':' + value + '" aria-pressed="' + (type === value) + '">' + (value ? typeName(value) : '全部') + '</button>').join('');
    return '<nav class="hc-gallery-tabs" aria-label="卡牌类型">' + tabs + '</nav><div class="hc-gallery-tools"><label class="hc-gallery-search"><span>搜索</span><input id="hc-' + scope + '-search" type="search" data-gallery-search="' + scope + '" value="' + esc(search) + '" placeholder="题目、标题或人物" aria-label="搜索卡牌" maxlength="100"></label><small aria-live="polite">' + count + ' 张</small></div>';
  }
  function galleryCards(entries, action) {
    return '<div class="hc-card-grid hc-scroll" tabindex="0" aria-label="卡牌预览">' + (entries.map(entry => {
      const card = entry.card;
      const front = '<span class="hc-gallery-heading"><span>' + typeName(card.type) + '</span><small>' + String(entry.index + 1).padStart(2, '0') + '</small></span><span class="hc-gallery-art">' + cardArtwork(card.type) + '</span><strong>' + esc(card.tag || typeName(card.type)) + '</strong><p>' + esc(card.question) + '</p>';
      const footer = '<span class="hc-gallery-bottom"><span>' + esc(entry.owner || '点击查看完整牌面') + '</span><small>' + esc(card.round || (card.type === 'T' ? 'TRUTH' : 'DARE')) + '</small></span>';
      if (action === 'settlement') return '<article class="hc-gallery-card hc-settlement-card" data-type="' + card.type + '">' + front + '<div class="hc-settlement-owner">' + renderAvatar(entry.actor) + '<strong>' + esc(entry.owner) + '</strong><small>' + (entry.status === 'done' ? '已完成' : '已跳过') + '</small></div></article>';
      const flip = action === 'flip-record-card';
      const back = '<span class="hc-gallery-heading">抽到这张牌的角色</span><span class="hc-owner-orbit">' + (entry.actor ? renderAvatar(entry.actor) : '<span class="hc-owner-unknown">?</span>') + '</span><strong>' + esc(entry.owner) + '</strong><span class="hc-gallery-bottom">' + (entry.actor ? '再次点击查看牌面' : '这张候选牌尚未抽取') + '</span>';
      return '<button type="button" class="hc-gallery-card' + (flip ? ' hc-gallery-flippable' : '') + '" data-type="' + card.type + '" data-action="' + action + '" data-value="' + entry.index + '"' + (flip ? ' aria-pressed="false"' : '') + ' aria-label="' + esc((flip ? '翻面查看角色：' : '查看') + typeName(card.type) + '：' + (card.tag || card.question)) + '">' + (flip ? '<span class="hc-flip-inner"><span class="hc-gallery-face hc-gallery-front">' + front + footer + '</span><span class="hc-gallery-face hc-gallery-back" aria-hidden="true">' + back + '</span></span>' : front + footer) + '</button>';
    }).join('') || '<p class="hc-gallery-empty">没有找到符合条件的卡牌。</p>') + '</div>';
  }
  function recordEntries() {
    const selected = room().games.find(g => g.id === cardsGameId);
    return collectedCards(selected).map((entry, index) => ({ ...entry, index,
      actor:entry.draws.length ? E.actors(selected).find(actor => actor.id === entry.card.actor) : null,
      owner:entry.draws.length ? E.actorName(selected, entry.card.actor) : '尚未抽取' }));
  }
  function showBanks() {
    if (page !== 'banks' && page !== 'bank-editor') { persistDraft(); collectionReturn = page; }
    const chosen = draft?.config.bank || room()?.config.bank;
    if (catalog().some(bank => bank.id === chosen)) selectedBank = chosen;
    bankFilter = ''; bankSearch = ''; page = 'banks'; overlay = null; render();
  }
  function banksHTML() {
    const banks = catalog(), bank = banks.find(item => item.id === selectedBank) || banks[0];
    selectedBank = bank.id;
    const entries = filteredCards(bank.cards.map((card, index) => ({ card, index })), bankFilter, bankSearch);
    const directory = banks.map(item =>
      '<button type="button" class="hc-bank-tile' + (item.id === selectedBank ? ' hc-selected' : '') + '" data-action="select-bank" data-value="' + esc(item.id) + '"><span class="hc-bank-monogram">' + (item.custom ? '私' : item.id === 'regular' ? '常' : '亲') + '</span><span><b>' + esc(item.name) + '</b><small>' + (item.custom ? '自定义' : '内置') + ' · 真心话 ' + item.cards.filter(card => card.type === 'T').length + ' / 大冒险 ' + item.cards.filter(card => card.type === 'D').length + '</small></span></button>').join('');
    return '<section class="hc-collection-page hc-bank-library"><header class="hc-section-head"><div><small class="hc-kicker">所有房间共用 · 下滑浏览全部卡牌</small><h2>牌库</h2></div><div class="hc-actions">' + button('add-bank', '＋ 添加') + (bank.custom ? button('edit-bank', '编辑', bank.id) : '') + button('close-collection', '返回') + '</div></header><div class="hc-bank-layout"><aside class="hc-bank-list">' + directory + '</aside><div class="hc-bank-preview">' + galleryTools('bank', bankFilter, bankSearch, entries.length) + galleryCards(entries, 'inspect-bank-card') + '</div></div></section>';
  }
  function bankEditorHTML() {
    const count = type => bankDraft[type].split(/\r?\n/).filter(line => line.trim()).length;
    return `<section class="hc-collection-page hc-bank-editor"><header class="hc-section-head"><h2>${bankDraft.id ? '编辑牌库' : '添加牌库'}</h2>${button('cancel-bank', '返回牌库')}</header><div class="hc-bank-basics"><label class="hc-field"><span>牌库名称</span><input data-bank-field="name" maxlength="60" value="${esc(bankDraft.name)}"></label><label class="hc-check"><input type="checkbox" data-bank-field="adult"${bankDraft.adult ? ' checked' : ''}>成人内容</label></div><nav class="hc-collection-tabs">${button('bank-editor-tab', '真心话 · ' + count('truth'), 'T', bankEditorTab === 'T')}${button('bank-editor-tab', '大冒险 · ' + count('dare'), 'D', bankEditorTab === 'D')}</nav><p class="hc-settings-note">每行一道题；两种类型各 2—200 题，每题最多 500 字。任务通过语言、表情、目光或动作完成。</p><textarea class="hc-bank-questions" data-bank-field="${bankEditorTab === 'T' ? 'truth' : 'dare'}" aria-label="${typeName(bankEditorTab)}题目" placeholder="每行一道题">${esc(bankDraft[bankEditorTab === 'T' ? 'truth' : 'dare'])}</textarea><footer class="hc-collection-controls">${button('save-bank', '保存牌库', '', true)}</footer></section>`;
  }
  function editBank(id, copy) {
    const bank = catalog().find(bank => bank.id === id);
    if (!bank || (!copy && !bank.custom)) throw new Error('内置牌库可复制后编辑。');
    bankDraft = { id:copy ? '' : bank.id, name:bank.name + (copy ? ' · 自定义' : ''), adult:!!bank.adult || bank.id === 'intimate', truth:bank.cards.filter(card => card.type === 'T').map(card => card.question).join('\n'), dare:bank.cards.filter(card => card.type === 'D').map(card => card.question).join('\n') };
    bankEditorTab = 'T'; page = 'bank-editor'; render();
  }
  function showApis() {
    apiOptions = host.apis();
    const c = game()?.snapshot.config || room()?.config || E.defaultConfig();
    overlay = { title:'生成与快速回复 API', kind:'api', body:`<div class="hc-form-grid">${select('live.api', '剧情生成 API', apiChoices(), c.api)}${select('live.replyApi', '快速回复 API', [['', '跟随剧情生成 API'], ...apiOptions.map(a => [a.id, a.name])], c.replyApi)}${input('live.maxTokens', '整把输出上限 tokens', c.maxTokens, 'number', 'min="4096" max="65536"')}${select('live.regenerations', '失败后重新生成次数', [[0, '0 次'], [1, '1 次'], [2, '2 次']], c.regenerations)}</div>${button('host-settings', '管理现有 API 预设')}${button('view-input', '查看上次完整输入', '', false, lastInput?.gameId !== game()?.id || !lastInput)}` }; render();
  }
  function chooseAvatar(playerId) {
    const assets = DEFAULT_AVATARS;
    overlay = { title:'选择头像', avatarTarget:playerId, assets, body:`<div class="hc-avatar-grid">${assets.map((p, i) => `<button type="button" class="hc-btn hc-avatar-choice" data-action="choose-avatar" data-value="${i}">${renderAvatar(p)}<span>${esc(p.name)}</span></button>`).join('')}</div>` }; render();
  }
  async function chooseUserAvatar() {
    const target = draft, loading = { title:'选择酒馆用户头像', body:'<p class="hc-hint">正在读取酒馆用户头像……</p>' };
    overlay = loading; render();
    try {
      const source = host.userAvatars ? await host.userAvatars() : [];
      if (disposed || draft !== target || overlay !== loading) return;
      const assets = userAvatarChoices(host.user(), source);
      overlay = { title:'选择酒馆用户头像', kind:'user-avatars', assets, avatarTarget:'USER',
        body:assets.length ? '<div class="hc-avatar-grid">' + assets.map((asset, index) => '<button type="button" class="hc-btn hc-avatar-choice" data-action="choose-user-avatar" data-value="' + index + '">' + renderAvatar(asset) + '<span>' + esc(asset.name || '用户头像') + '</span>' + (asset.current ? '<small class="hc-avatar-current">当前使用</small>' : '') + '</button>').join('') + '</div>' : '<p class="hc-hint">酒馆里暂时没有用户头像，可先在用户设置中添加。</p>' };
      render();
    } catch (error) { if (!disposed && draft === target && overlay === loading) { overlay = null; report(error); } }
  }
  function chooseCardAvatar(playerId) {
    cardOptions = host.cards();
    const assets = cardAvatarChoices(draft.world, cardOptions, draft.players);
    overlay = { title:'选择酒馆角色卡面', avatarTarget:playerId, assets,
      body:assets.length ? `<div class="hc-avatar-grid">${assets.map(card => `<button type="button" class="hc-btn hc-avatar-choice" data-action="choose-card-avatar" data-value="${esc(card.id)}">${renderAvatar(card)}<span>${esc(card.name || card.label)}</span></button>`).join('')}</div>` : '<p class="hc-hint">酒馆中暂时没有可用的角色卡面。</p>' };
    render();
  }
  function render() {
    if (disposed || !root.isConnected) return;
    if (!room() && page !== 'rooms') page = 'rooms';
    root.className = 'wb-body wb-game-mode wb-heart-mode' + (['play', 'history', 'banks', 'bank-editor', 'room-settings', 'order'].includes(page) ? ' hc-playing' : ''); root.ontouchstart = null; root.ontouchend = null;
    const active = doc.activeElement;
    const focusKey = active && root.contains(active) ? { field:active.dataset.field, action:active.dataset.action, value:active.dataset.value, id:active.id } : null;
    const currentTurnKey = page === 'play' && run() ? game().id + ':' + run().roundIndex + ':' + run().turnIndex : '';
    const samePage = renderedPage === page, sameTurn = renderedTurn === currentTurnKey;
    const scroll = [...root.querySelectorAll('.hc-scroll')].map(node => ({ cls:node.className, top:node.scrollTop }));
    const disclosures = new Map([...root.querySelectorAll('details[data-section]')].map(node => [node.dataset.section, node.open]));
    const hadOverlay = !!root.querySelector('.hc-overlay');
    if (overlay && !hadOverlay) returnFocus = focusKey;
    const views = { rooms:roomsHTML, room:roomHTML, world:worldHTML, setup:setupHTML, 'room-settings':roomSettingsHTML, banks:banksHTML, 'bank-editor':bankEditorHTML, order:orderHTML, play:playHTML, history:historyHTML };
    let content = (views[page] || roomsHTML)();
    if (page === 'play' && game()?.content && !busy) content = `<div class="hc-play-shell"><div class="hc-play-main">${content}</div>${sideToolsHTML()}</div>`;
    root.innerHTML = `<div class="hc-app"><div class="hc-main-shell"${overlay ? ' inert' : ''}>${header()}${notice ? `<div class="hc-notice" role="alert"><span>${esc(notice)}</span>${button('dismiss', '关闭提示')}${button('reload', '重新载入存档')}</div>` : ''}<div class="hc-content">${content}</div></div>${overlay ? `<div class="hc-overlay"><section class="hc-modal${overlay.text !== undefined ? ' hc-text-modal' : ''}${overlay.kind === 'api' ? ' hc-api-modal' : ''}${overlay.kind === 'input' ? ' hc-input-modal' : ''}${overlay.kind === 'tools' ? ' hc-tools-modal' : ''}${overlay.kind === 'card-gallery' ? ' hc-card-modal' : ''}" role="dialog" aria-modal="true" aria-labelledby="hc-modal-title"><header><h2 id="hc-modal-title">${esc(overlay.title)}</h2>${button('close-overlay', '关闭')}</header>${overlay.text !== undefined ? readerHTML('overlay', overlay.text, 'hc-prose') : `<div class="hc-scroll">${overlay.body}</div>`}${overlay.confirm || overlay.actions ? `<footer class="hc-actions">${overlay.actions || button('confirm-overlay', '确认', '', true) + button('close-overlay', '取消')}</footer>` : ''}</section></div>` : ''}</div>`;
    root.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.parentElement.textContent = (img.alt || '♡').slice(0, 2); }, { once:true }));
    renderProgress();
    if (samePage) {
      root.querySelectorAll('details[data-section]').forEach(node => { if ((sameTurn || !['current-card', 'action-history'].includes(node.dataset.section)) && disclosures.has(node.dataset.section)) node.open = disclosures.get(node.dataset.section); });
      for (const saved of scroll) {
        if (!sameTurn && saved.cls.includes('hc-table-scroll')) continue;
        const node = [...root.querySelectorAll('.hc-scroll')].find(node => node.className === saved.cls);
        if (node) node.scrollTop = saved.top;
      }
    }
    const key = hadOverlay && !overlay ? returnFocus : focusKey;
    const restored = key && [...root.querySelectorAll('button,input,select,textarea,summary')].find(node =>
      key.id ? node.id === key.id : key.field ? node.dataset.field === key.field : key.action && node.dataset.action === key.action && node.dataset.value === key.value);
    const focus = overlay ? root.querySelector('.hc-modal button') : samePage && restored && !restored.disabled ? restored
      : root.querySelector('.hc-dialogue[data-action="next"], .hc-controls .hc-btn:not(:disabled), .hc-narrative footer button');
    focus?.focus({ preventScroll:true });
    resizeObserver.disconnect(); resizeObserver.observe(root);
    root.querySelectorAll('[data-reader]').forEach(node => resizeObserver.observe(node));
    fitPage(); onViewport();
    renderedPage = page; renderedTurn = currentTurnKey;
  }
  function prepare() {
    draft.config = E.normalizeConfig(draft.config);
    for (const player of [draft.world.user, ...draft.players]) {
      if (player.avatarMode === 'emoji' && emojiDrafts.has(player.id) && emojiDrafts.get(player.id).trim() !== player.avatar) {
        throw new Error('请点击 ' + (player.name || '角色') + ' 头像旁的“确定”后继续。');
      }
    }
    const userMode = ['auto', 'current', 'tavern', 'emoji', 'url'].includes(draft.world.user.avatarMode) ? draft.world.user.avatarMode : 'current';
    if (userMode === 'current' && !room().games.some(g => g.content)) draft.world.user.avatar = host.user().avatar || '';
    else if (userMode === 'auto') draft.world.user.avatar = /^pixel:(?:\d|1[0-4])$/.test(draft.world.user.avatar) ? draft.world.user.avatar : 'pixel:0';
    else if (userMode === 'emoji' && !draft.world.user.avatar.trim()) throw new Error('USER 需要输入 emoji 或简短文字。');
    else if (['url', 'tavern'].includes(userMode) && !safeImage(draft.world.user.avatar)) throw new Error('USER 的图片地址不正确。');
    for (const p of draft.players) {
      if (p.avatarMode === 'card') { if (!p.cardAvatar) throw new Error(p.name + ' 尚未关联角色卡，请导入角色卡或选择其他头像方式。'); p.avatar = p.cardAvatar; }
      else if (p.avatarMode === 'auto') p.avatar = /^pixel:(?:\d|1[0-4])$/.test(p.avatar) ? p.avatar : `pixel:${Math.floor(Math.random() * DEFAULT_AVATARS.length)}`;
      else if (p.avatarMode === 'emoji' && !p.avatar.trim()) throw new Error(p.name + ' 需要输入 emoji 或简短文字。');
      else if (p.avatarMode === 'url' && !safeImage(p.avatar)) throw new Error(p.name + ' 的图片地址不正确。');
    }
    const validationRoom = E.clone(draft);
    E.createGame(validationRoom, { order:['USER', ...validationRoom.players.map(p => p.id)] }, Math.random, repo.state.banks);
    persistDraft(); mutateRoom(r => { r.pendingOrder = null; }); draft = null; page = 'order'; render();
  }
  function newPlayer(origin, card = null) {
    if (page !== 'room-settings' && room().games.some(g => g.content)) throw new Error('已有剧情的房间需要保留原有角色。');
    if (draft.players.length >= (draft.config.mode === 'duo' ? 1 : 5)) throw new Error('当前模式的角色席位已满。');
    const next = Math.max(0, ...draft.players.map(p => Number(p.id.slice(1)))) + 1;
    draft.players.push(E.playerSnapshot({ id:'P' + next, name:card?.name || '', description:card?.description || '', origin,
      cardId:card?.id || '', cardAvatar:card?.avatar || '', avatar:card?.avatar || '', avatarMode:card?.avatar ? 'card' : 'auto' }, next));
    overlay = null; persistDraft(); render();
  }
  function chooseNewPlayer() {
    if (draft.players.length >= (draft.config.mode === 'duo' ? 1 : 5)) throw new Error('当前模式的角色席位已满。');
    cardOptions = host.cards();
    draft.cardImport = '';
    overlay = { kind:'new-player', title:'添加新角色', body:`<div class="hc-form-grid"><div class="hc-wide">${button('create-custom-player', '手动填写角色')}</div><label class="hc-field hc-wide"><span>导入其他角色卡</span><select data-field="cardImport" aria-label="选择导入角色卡">${option('', '选择角色卡', '')}${cardOptions.map(card => option(card.id, card.label || card.name, '')).join('')}</select></label><p class="hc-hint hc-wide">选择后自动填入姓名、角色描述和头像，可继续编辑。</p></div>` };
    render();
  }
  const actions = {
    'room-settings'() { persistDraft(); settingsReturn = page === 'play' ? 'play' : 'room'; settingsTab = 'play'; edit('room-settings'); },
    'settings-tab'(tab) { persistDraft(); settingsTab = tab === 'world' ? 'world' : 'play'; render(); },
    'close-room-settings'() { persistDraft(); draft = null; page = settingsReturn; overlay = null; render(); },
    'record-tools'() { overlay = { kind:'tools', title:'房间记录', body:`<div class="hc-record-gate">${button('history', toolIcon('records') + '<span>剧情回看<small>本房间的全部故事</small></span>')}${button('card-records', toolIcon('cards') + '<span>卡牌记录<small>牌面与抽取人物</small></span>')}</div>` }; render(); },
    'card-records'() { showHistory('cards'); },
    'round-replay'() { showHistory('story', run().roundIndex); },
    'all-rounds'() { replayRound = ''; render(); },
    'records-tab'(tab) { recordsTab = tab; render(); },
    'archive-group'(id) {
      if (archiveGroup === id) { archiveGroup = ''; archiveOpen = ''; replayRound = ''; }
      else {
        const group = roomSessions(room()).find(group => group.id === id);
        const entry = group?.entries.findLast(entry => entry.active && !entry.branch) || group?.entries[0];
        archiveGroup = id; archiveOpen = entry?.id || '';
        replayRound = entry?.run.stage === 'open' || entry?.run.stage === 'ending' ? '' : String(entry?.run.roundIndex ?? 0);
      }
      replay.id = archiveOpen; render();
    },
    'archive-round'(value) {
      const split = value.lastIndexOf(':'), id = value.slice(0, split), round = value.slice(split + 1);
      replayRound = archiveOpen === id && replayRound === round ? '' : round;
      archiveOpen = id; replay.id = id; render();
      root.querySelector('.hc-archive-scroll')?.scrollTo(0, 0);
    },
    'flip-record-card'(index) {
      const card = root.querySelector('[data-action="flip-record-card"][data-value="' + Number(index) + '"]');
      if (!card) return;
      const back = card.classList.toggle('hc-is-flipped');
      card.setAttribute('aria-pressed', String(back));
      card.querySelector('.hc-gallery-front').setAttribute('aria-hidden', String(back));
      card.querySelector('.hc-gallery-back').setAttribute('aria-hidden', String(!back));
    },
    'close-collection'() { page = collectionReturn; overlay = null; render(); },
    'select-bank'(id) { selectedBank = id; bankFilter = ''; bankSearch = ''; render(); },
    'gallery-filter'(value) {
      const [scope, type] = value.split(':');
      if (scope === 'bank') { bankFilter = type; }
      else { recordFilter = type; }
      render(); root.querySelector('.hc-card-grid')?.scrollTo(0, 0);
    },
    'inspect-bank-card'(index) {
      const card = catalog().find(bank => bank.id === selectedBank)?.cards[Number(index)];
      if (!card) return;
      overlay = { kind:'card-gallery', title:typeName(card.type) + ' · ' + (card.tag || '牌库预览') };
      overlay.body = '<div class="hc-card-exhibit">' + artCard(card) + '</div>'; render();
    },
    'add-bank'() { bankDraft = { name:'', truth:'', dare:'', adult:false }; bankEditorTab = 'T'; page = 'bank-editor'; render(); },
    'copy-bank'(id) { editBank(id, true); },
    'edit-bank'(id) { editBank(id, false); },
    'bank-editor-tab'(tab) { bankEditorTab = tab; render(); },
    'cancel-bank'() { bankDraft = null; page = 'banks'; render(); },
    'save-bank'() {
      const bank = createCustomBank(bankDraft, bankDraft.id || E.uid('custom'));
      update(store => { const index = store.banks.findIndex(item => item.id === bank.id); if (index < 0) { if (store.banks.length >= 30) throw new Error('最多保存 30 套自定义牌库。'); store.banks.push(bank); } else store.banks[index] = bank; });
      selectedBank = bank.id; bankDraft = null; page = 'banks'; render();
    },
    'use-bank'(id) {
      const bank = catalog().find(bank => bank.id === id);
      if (!bank) throw new Error('找不到这套牌库。');
      if ((bank.adult || bank.id === 'intimate') && !(draft?.config || room().config).nsfw) throw new Error('请先在房间设置中开启成人内容，再使用这套牌库。');
      if (draft) { draft.config.bank = id; draft.config.source = 'builtin'; }
      mutateRoom(room => { room.config.bank = id; room.config.source = 'builtin'; });
      page = collectionReturn; overlay = null; render();
    },
    'generation-logs'() {
      const entries = (repo.state.generationLogs || []).filter(entry => entry.roomId === room()?.id).slice().reverse();
      overlay = { title:'生成测试记录', body:'<p class="hc-hint">每次尝试分别保存，包含成功、失败和取消。后台文件保存在当前酒馆用户的 user/files 目录。</p>'
        + (entries.map(entry => '<article class="hc-box"><p>' + esc(date(entry.startedAt)) + ' · '
          + ({ game:'剧情', reply:'补充剧情', ending:'结局' }[entry.task] || esc(entry.task)) + ' · 第 ' + entry.attempt + ' 次尝试</p><p>'
          + ({ success:'通过校验', failed:'失败', cancelled:'已取消' }[entry.status] || '中断')
          + (entry.path ? ' · 已保存后台' : ' · 本地副本') + '</p>'
          + (entry.error ? '<p class="hc-hint">' + esc(entry.error) + '</p>' : '')
          + button('view-generation-log', '查看记录', entry.id) + '</article>').join('') || '<p>暂无生成记录。</p>') };
      render();
    },
    async 'view-generation-log'(id) {
      const entry = repo.state.generationLogs?.find(item => item.id === id);
      if (!entry) throw new Error('找不到这次生成记录。');
      const loading = { title:'读取生成记录', body:'<p>正在读取……</p>' };
      overlay = loading; render();
      let content;
      if (entry.path) {
        if (!/^\/(?:user\/)?files\/[^/\\]+\.txt$/.test(entry.path)) throw new Error('生成记录地址无效。');
        const response = await fetch(entry.path, { cache:'no-store' });
        if (!response.ok) throw new Error('后台记录读取失败：HTTP ' + response.status);
        content = await response.text();
      } else content = generationLogText(entry);
      if (disposed || overlay !== loading) return;
      selectedGenerationLog = { name:generationLogFilename(entry), content };
      overlay = { kind:'input', title:'生成记录 · 第 ' + entry.attempt + ' 次尝试',
        body:'<pre class="hc-full-input" tabindex="0">' + esc(content) + '</pre>',
        actions:button('export-generation-log', '导出记录') + button('generation-logs', '返回列表') };
      render();
    },
    'export-generation-log'() {
      if (selectedGenerationLog) download(selectedGenerationLog.name, selectedGenerationLog.content);
    },
    'view-input'() {
      if (!lastInput || lastInput.gameId !== game()?.id) throw new Error('本次打开游戏后还没有发送输入。');
      overlay = { kind:'input', title:'本次注入资料 · ' + ({ game:'正文', reply:'补充剧情', ending:'结局' }[lastInput.task]),
        body:'<pre class="hc-full-input" tabindex="0" aria-label="本次实际注入的世界观、参数与剧情记录">' + esc(lastInput.input) + '</pre>',
        actions:button('export-input', '导出输入资料') + button('close-overlay', '关闭') };
      render();
    },
    'export-input'() {
      if (lastInput?.gameId === game()?.id) download('心动挑战-' + lastInput.task + '-输入资料.txt', lastInput.input);
    },
    'manage-games'(value) {
      const games = room().games, index = Math.max(0, Math.min(games.length - 1, Number(value) || 0)), g = games[index];
      overlay = { title:'管理记录', text:g ? `第 ${g.number} 把 · ${g.runs.length} 局\n\n删除会移除该把的牌库、所有局和历史分支。可先导出房间留存。` : '暂无记录。',
        actions:button('manage-games', '上一把', index - 1, false, index === 0) + button('manage-games', '下一把', index + 1, false, index >= games.length - 1) + (g ? button('delete-game', '删除这把', g.id) : '') };
      render();
    },
    'read-page'(value) { const [id, delta] = value.split(':'); reader.move(id, Number(delta)); },
    'card-detail'() {
      const card = E.currentCard(game(), run());
      if (card) { overlay = { kind:'card-gallery', title:typeName(card.type) + ' · ' + card.tag, body:'<div class="hc-card-exhibit">' + artCard(card) + '</div>' }; render(); }
    },
    'actor-detail'(id) {
      const actor = E.actors(game()).find(actor => actor.id === id);
      if (actor) { overlay = { title:actor.name, text:actor.persona || actor.description || (game().snapshot.world.character?.name === actor.name ? game().snapshot.world.character.description : '') || '本轮第 ' + (game().order.indexOf(id) + 1) + ' 位行动。' }; render(); }
    },
    'inspect-option'(id) {
      const option = run()?.current?.options?.find(option => option.id === id);
      if (option) { overlay = { title:'你的回应', text:option.text, actions:button('choose-expanded-option', '选择这个回应', id, true) }; render(); }
    },
    'choose-expanded-option'(id) { overlay = null; advance('option', id); },
    home:leave,
    async 'demo-room'() {
      if (demoLoading) return;
      demoLoading = true; render();
      try {
        const id = await installDemoRoom(repo, { isCurrent:() => !disposed });
        if (!id || disposed) return;
        if (page === 'rooms') {
          update(store => { store.activeRoomId = id; });
          page = 'play'; overlay = null;
        }
      } catch (error) {
        report(error);
      } finally { demoLoading = false; if (!disposed) render(); }
    },
    rooms() { persistDraft(); cancel(); draft = null; page = 'rooms'; overlay = null; render(); },
    room() { persistDraft(); cancel(); draft = null; page = 'room'; overlay = null; render(); },
    'add-room'() {
      persistDraft(); cancel(); refreshSources();
      if (repo.state.rooms.length >= E.HEART_LIMITS.rooms) throw new Error('房间数量已满，请导出并整理旧房间。');
      update(store => { const source = worldOptions[0]; const r = E.createRoom('新的心动房间', source?.world || {}); if (r.world.user.avatarMode === 'current') r.world.user.avatar = host.user().avatar || r.world.user.avatar; if (source?.player?.name) r.players = [E.playerSnapshot(source.player, 0)]; store.rooms.push(r); store.activeRoomId = r.id; });
      edit('world');
    },
    'select-room'(id) { persistDraft(); cancel(); update(store => { store.activeRoomId = id; }); draft = null; page = 'room'; render(); },
    'edit-world'() { edit('world'); },
    setup() {
      const g = game(), r = run();
      if (g && g.content && !['settlement', 'ending'].includes(r?.stage)) throw new Error('请先完成当前游戏；如需另一个故事，可以新建房间。');
      if (g && !g.content) { page = 'play'; render(); return; }
      edit('setup');
    },
    resume() { persistDraft(); draft = null; page = room()?.pendingOrder ? 'order' : game() ? 'play' : 'room'; overlay = null; render(); },
    'save-world'() { if (!draft.world.user.name.trim()) throw new Error('请填写 USER 名称后再保存世界。'); const worldPlayer = draft.players.find(p => p.origin === 'world');
      if (worldPlayer && draft.world.character.name) worldPlayer.name = draft.world.character.name;
      persistDraft();
      if (game() && (!game().content || !['settlement', 'ending'].includes(run()?.stage))) {
        draft = null; page = 'room'; notice = '资料已保存，将用于之后的故事。'; render();
      } else edit('setup');
    },
    async 'import-world'() {
      const id = draft.worldSource || worldOptions[0]?.id, target = draft, targetId = draft.id, requestId = ++worldReadId;
      const source = host.importWorld ? await host.importWorld(id) : worldOptions.find(w => w.id === id);
      if (disposed || draft !== target || room()?.id !== targetId || requestId !== worldReadId) return;
      if (!source) throw new Error('找不到该世界预设，请重新打开设置。');
      const supplemental = draft.world.supplemental || '', chosenName = draft.world.user.name;
      draft.world = E.worldSnapshot({ ...source.world, sourceId:id, sourceKind:source.kind, supplemental:source.world.supplemental || supplemental });
      if (chosenName && chosenName !== '你') draft.world.user.name = chosenName;
      if (source.player?.name) {
        const imported = E.playerSnapshot({ ...source.player, origin:'world' }, 0), index = draft.players.findIndex(player => player.origin === 'world');
        if (index >= 0) { imported.id = draft.players[index].id; draft.players[index] = imported; }
        else if (draft.players.length < 5) draft.players.unshift(imported);
      }
      persistDraft(); render();
    },
    'import-user'() { return readWorldPart('user'); },
    'refresh-character'() { return readWorldPart('character'); },
    'refresh-chat'() { return readWorldPart('chat'); },
    'refresh-worldbook'() { return readWorldPart('books', ''); },
    'import-user-avatar'() { draft.world.user.avatar = host.user().avatar || ''; draft.world.user.avatarMode = 'current'; persistDraft(); render(); },
    'host-settings'() { persistDraft(); cancel(); destroy(); host.settings(); },
    'add-player'(origin) { if (origin === 'world') newPlayer('world'); else chooseNewPlayer(); },
    'create-custom-player'() { newPlayer('custom'); },
    'import-card'() { const c = cardOptions.find(c => c.id === draft.cardImport); if (!c) throw new Error('请先选择一张角色卡。'); newPlayer('custom', c); },
    'remove-player'(id) { draft.players = draft.players.filter(p => p.id !== id); draft.config.focus = draft.config.focus.filter(p => p !== id); emojiDrafts.delete(id); persistDraft(); render(); },
    'player-avatar':chooseAvatar,
    'player-card-avatar':chooseCardAvatar,
    'user-avatar'() { chooseAvatar('USER'); },
    'user-tavern-avatar':chooseUserAvatar,
    'choose-user-avatar'(index) {
      const asset = overlay?.kind === 'user-avatars' && overlay.assets[Number(index)];
      if (!asset || !draft) throw new Error('所选用户头像已失效，请重新选择。');
      draft.world.user.avatar = asset.avatar; draft.world.user.avatarMode = asset.current ? 'current' : 'tavern';
      overlay = null; persistDraft(); render();
    },
    'confirm-emoji'(id) {
      const player = id === 'USER' ? draft.world.user : draft.players.find(p => p.id === id);
      if (!player || player.avatarMode !== 'emoji') throw new Error('请先选择 emoji / 文字头像。');
      if (page !== 'room-settings' && room().games.some(g => g.content)) throw new Error('已有剧情的房间需要保留原有头像。');
      const value = String(emojiDrafts.get(id) ?? player.avatar ?? '').trim();
      if (!value || value.length > 32) throw new Error('请输入 1—32 个字符的 emoji 或简短文字。');
      player.avatar = value; emojiDrafts.delete(id); persistDraft(); render();
    },
    'choose-avatar'(value) { const asset = overlay.assets[Number(value)]; const p = overlay.avatarTarget === 'USER' ? draft.world.user : draft.players.find(p => p.id === overlay.avatarTarget); p.avatar = asset.avatar; p.avatarMode = 'auto'; overlay = null; persistDraft(); render(); },
    'choose-card-avatar'(value) { const card = overlay.assets.find(item => item.id === value); const p = draft.players.find(item => item.id === overlay.avatarTarget); if (!card || !p) throw new Error('所选角色卡面已经不存在，请重新选择。'); p.cardId = card.id; p.cardAvatar = card.avatar; p.avatar = card.avatar; p.avatarMode = 'card'; overlay = null; persistDraft(); render(); },
    'prepare-order':prepare,
    fate() { const field = root.querySelector('#hc-fate-number'); const number = field.value.trim() === '' ? NaN : Number(field.value); mutateRoom(r => { r.fateNumber = number; r.pendingOrder = E.fateOrder([r.world.user, ...r.players], number); }); render(); },
    'reveal-fate'() { mutateRoom(r => { r.pendingOrder.revealed = true; }); render(); },
    'order-seat'(id) { mutateRoom(r => { r.pendingOrder ||= { order:[], revealed:true }; if (!r.pendingOrder.order.includes(id) && ['USER', ...r.players.map(p => p.id)].includes(id)) r.pendingOrder.order.push(id); }); render(); },
    'reset-order'() { mutateRoom(r => { r.pendingOrder = null; }); render(); },
    async generate() { mutateRoom(r => { const g = E.createGame(r, r.pendingOrder, Math.random, repo.state.banks); r.games.push(g); r.activeGameId = g.id; r.pendingOrder = null; }); draft = null; await request('game'); },
    'request-game'() { return request('game'); },
    'reset-preparation'() {
      const id = game()?.id;
      if (!id || game().content) return;
      confirm('重新安排本把', '返回本把设置，重新选择人数、轮数和顺序。房间资料和以前的故事都会保留。', () => {
        mutateRoom(r => { r.games = r.games.filter(g => g.id !== id); r.activeGameId = r.games.at(-1)?.id || ''; r.pendingOrder = null; });
        failureRaw = ''; notice = ''; edit('setup');
      });
    },
    cancel() { cancel(); render(); },
    retry() { const error = game()?.error; if (error) return request(error.task, error.input || ''); },
    'error-detail'() { overlay = { title:'本次生成问题', text:game()?.error?.message || '上次生成尚未保存。' }; render(); },
    'raw-output'() { overlay = { title:'生成原文', text:failureRaw || game()?.error?.raw || '未收到正文', actions:button('export-raw', '导出原文') }; render(); },
    'export-raw'() { download('心动挑战-生成原文.txt', failureRaw || game()?.error?.raw || ''); },
    next() { advance('next'); },
    type(value) { advance('type', value); },
    draw(value) { advance('draw', value); },
    accept() { advance('accept'); },
    swap() { advance('swap'); },
    skip() { advance('skip'); },
    option(value) { advance('option', value); },
    'restart-turn'() { confirm('重新开始当前行动', '恢复行动开始前的互动、记忆和卡牌状态，保留当前行动人与已抽卡。旧记录保留为历史分支。', () => { mutateGame((g, r) => E.restartTurn(g, r)); }); },
    'replay-game'() { confirm('使用同一牌库再玩一局', '牌库保持不变。重玩将从本把开始时的状态重新计算，新结果作为当前有效记录；旧局仍可在历史中回看。', () => { mutateGame(g => { const next = E.newRun(g); g.runs.push(next); g.activeRunId = next.id; g.error = null; }); }); },
    ending() { return request('ending'); },
    'free-toggle'() { freeOpen = !freeOpen; overlay = null; render(); root.querySelector('#hc-free-input')?.focus(); },
    'submit-free'() { return request('reply', root.querySelector('#hc-free-input').value.trim()); },
    'toggle-tools'() { actions['room-settings'](); },
    'return-options'() { mutateGame((g, r) => { r.awaitingReply = false; }); freeOpen = false; render(); },
    history() { showHistory(); },
    'export-history'() { const item = replay.options.find(o => o.id === archiveOpen); if (!item) return; download('心动挑战-剧情记录.txt', item.label + '\n\n' + E.historyText(item.game, item.history)); },
    'export-room'() { persistDraft(); download('心动挑战-' + room().title.replace(/[<>:"/\\|?*]/g, '_') + '.json', { app:'心动挑战', version:1, room:room() }); },
    'delete-room'(value) {
      const id = value || room()?.id, target = repo.state.rooms.find(item => item.id === id);
      if (!target) throw new Error('这个房间已经不存在。');
      confirm('删除房间', `确定删除“${target.title}”吗？房间内的全部游戏与故事也会删除，此操作无法撤销。`, () => {
        update(store => {
          store.rooms = store.rooms.filter(item => item.id !== id);
          if (store.activeRoomId === id) store.activeRoomId = store.rooms[0]?.id || '';
        });
        if (draft?.id === id) draft = null;
        page = 'rooms'; notice = `已删除房间“${target.title}”。`;
      });
    },
    'delete-game'(id) { confirm('删除这把游戏', '删除该把的牌库、所有游玩记录和历史分支；既有后续游戏仍保留自己的开局记忆快照。', () => { mutateRoom(r => { r.games = r.games.filter(g => g.id !== id); if (r.activeGameId === id) r.activeGameId = r.games.at(-1)?.id || ''; }); showHistory(); }); },
    banks:showBanks,
    'api-settings':showApis,
    relations() { const g = game(), r = run(); overlay = { title:'共同经历', text:g && r ? E.actors(g).filter(p => p.id !== 'USER').map(p => `${p.name}\n互动 ${r.relations[p.id]?.interactions || 0} 次 · 共同回应 ${r.relations[p.id]?.shared || 0} 次 · 表达边界 ${r.relations[p.id]?.boundaries || 0} 次`).join('\n\n') + '\n\n' + r.facts.map(f => f.text).join('\n\n') : '游戏开始后，会在这里记下共同经历。' }; render(); },
    help() { overlay = { title:'心动挑战 · 玩法', text:'先保存世界与 USER 资料，再添加角色。角色来自世界书时可以直接填写姓名；新角色需补充设定，也可导入角色卡。\n\n每把选择 1、2 或 4 轮，全员每轮按顺序行动一次。命运数字在揭晓前锁定；同距离按原席位排序。\n\nUSER 每轮有两张真心话、两张大冒险候选。先选牌型，再翻牌；显示实际候选数量，换牌不额外调用 AI。NPC 牌与关键事件预先固定。\n\n逐句点击继续，遇到选择会暂停。可以保留、拒绝或自由输入；行动结束后点击“下一位”。自由输入可能追问并等待你补充。\n\n全部轮次完成后，可以同牌库重玩、下一把或生成结局。重开行动和重玩会恢复开始时的状态，旧记录只用于回看。\n\n每次有效操作自动保存。失败或取消后可重试，回放不会改变进度。点击“菜单”可回看剧情、查看共同经历。阅读时可轻触对白或按空格继续，长文字先翻页，读完当前段再进入下一句，遇到选择会停下。' }; render(); },
    'close-overlay'() { overlay = null; render(); },
    'confirm-overlay'() { const apply = overlay.confirm; overlay = null; apply(); render(); },
    dismiss() { notice = ''; render(); },
    reload() { cancel(); if (freeDraftTimer !== null) win.clearTimeout(freeDraftTimer); pendingFreeDraft = null; repo.reload(); draft = null; notice = ''; page = 'rooms'; render(); },
  };
  async function onClick(event) {
    const el = event.target.closest('[data-action]');
    if (!el || !root.contains(el) || el.disabled || el.closest('fieldset:disabled')) return;
    event.preventDefault(); event.stopPropagation();
    const action = el.dataset.action;
    if (event.detail > 1 && ['next', 'accept', 'draw', 'option'].includes(action)) return;
    if (busy && !['cancel', 'home', 'rooms', 'room', 'export-room', 'dismiss', 'reload', 'view-input', 'export-input', 'read-page', 'close-overlay'].includes(action)) return;
    try { if (action !== 'reload') flushFreeDraft(); await actions[action]?.(el.dataset.value); } catch (error) { report(error); }
  }
  function updateDraftField(target) {
    const key = target.dataset.field;
    if (!draft || !key || key.startsWith('live.')) return;
    if (target.dataset.emojiTarget) { emojiDrafts.set(target.dataset.emojiTarget, target.value); return; }
    // A late import must not overwrite a newer manual choice in the same section.
    const part = key === 'world.injection.lazyWorldInject' ? 'lazy'
      : /^world\.(user\.persona|injection\.(userDescSource|injectUserDesc))$/.test(key) ? 'user'
      : /^world\.(character\.|injection\.(charDescMode|injectCharDesc))/.test(key) ? 'character'
      : key === 'world.injection.injectChat' ? 'chat'
      : key.startsWith('entry.') || key === 'world.injection.worldAutoMountMode' ? 'books' : '';
    if (part === 'lazy') ['user', 'character', 'books'].forEach(key => worldPartReads.delete(key));
    else if (part) worldPartReads.delete(part);
    const value = target.type === 'checkbox' ? target.checked : target.type === 'number' ? (target.value === '' ? '' : Number(target.value)) : target.value;
    if (key.startsWith('entry.')) { draft.world.entries[Number(key.slice(6))].enabled = value; return; }
    const parts = key.split('.'); let object = draft;
    while (parts.length > 1) object = object[parts.shift()];
    object[parts[0]] = value;
  }
  function onInput(event) {
    try {
      if (event.target.id === 'hc-free-input') { queueFreeDraft(event.target.value); const send = root.querySelector('[data-action="submit-free"]'); if (send) send.disabled = !event.target.value.trim(); return; }
      if (event.target.dataset.bankField) { bankDraft[event.target.dataset.bankField] = event.target.type === 'checkbox' ? event.target.checked : event.target.value; return; }
      if (event.target.dataset.gallerySearch) {
        if (event.isComposing) return;
        const { id, value } = event.target;
        if (event.target.dataset.gallerySearch === 'bank') { bankSearch = value; }
        else { recordSearch = value; }
        render(); root.querySelector('.hc-card-grid')?.scrollTo(0, 0); root.querySelector('#' + id)?.focus({ preventScroll:true }); return;
      }
      updateDraftField(event.target);
    } catch (error) { notice = error.message; host.toast?.(notice); }
  }
  async function onChange(event) {
    const el = event.target;
    try {
      if (el.hasAttribute('data-archive-entry')) { archiveOpen = el.value; replay.id = el.value; replayRound = ''; render(); return; }
      if (el.hasAttribute('data-collection-game')) { cardsGameId = el.value; recordSearch = ''; recordFilter = ''; render(); return; }
      if (el.dataset.galleryFilter) {
        if (el.dataset.galleryFilter === 'bank') { bankFilter = el.value; }
        else { recordFilter = el.value; }
        render(); root.querySelector('.hc-card-grid')?.scrollTo(0, 0); return;
      }
      if (el.dataset.bankField) { bankDraft[el.dataset.bankField] = el.type === 'checkbox' ? el.checked : el.value; return; }
      if (el.dataset.field === 'cardImport' && overlay?.kind === 'new-player') {
        if (!el.value) return;
        const card = cardOptions.find(card => card.id === el.value);
        if (!card) throw new Error('找不到所选角色卡，请重新打开角色列表。');
        newPlayer('custom', card); return;
      }
      if (el.dataset.field === 'worldSource') {
        updateDraftField(el);
        worldReadId++;
        render(); return;
      }
      if (el.dataset.field?.startsWith('live.')) {
        const key = el.dataset.field.slice(5), value = el.type === 'number' ? Number(el.value) : el.value;
        mutateRoom(r => { r.config = E.normalizeConfig({ ...r.config, [key]:value }); const g = r.games.find(g => g.id === r.activeGameId); if (g) g.snapshot.config = E.normalizeConfig({ ...g.snapshot.config, [key]:value }); }); return;
      }
      if (el.dataset.style) { const list = draft.config.styles.filter(x => x !== el.dataset.style); if (el.checked) list.push(el.dataset.style); draft.config.styles = list; }
      else if (el.dataset.bankTheme) { const list = draft.config.bankThemes.filter(x => x !== el.dataset.bankTheme); if (el.checked) list.push(el.dataset.bankTheme); draft.config.bankThemes = list; }
      else if (el.dataset.bankKeyword) { const list = draft.config.bankKeywords.filter(x => x !== el.dataset.bankKeyword); if (el.checked) list.push(el.dataset.bankKeyword); draft.config.bankKeywords = list; }
      else if (el.dataset.focus) { const list = draft.config.focus.filter(x => x !== el.dataset.focus); if (el.checked) list.push(el.dataset.focus); draft.config.focus = list; }
      else updateDraftField(el);
      if (el.dataset.field?.startsWith('world.')) {
        const cfg = draft.world.injection;
        if (el.dataset.field === 'world.injection.lazyWorldInject' && el.checked) {
          try { await readWorldPart('lazy'); } catch (error) { cfg.lazyWorldInject = false; throw error; }
          return;
        }
        if (el.dataset.field === 'world.injection.userDescSource' && el.value === 'auto') { await readWorldPart('user'); return; }
        if (el.dataset.field === 'world.injection.charDescMode' && el.value === 'auto') { await readWorldPart('character'); return; }
        if (el.dataset.field === 'world.injection.injectChat' && el.checked) { await readWorldPart('chat'); return; }
        if (el.dataset.field === 'world.injection.worldAutoMountMode' && el.value) { await readWorldPart('books', el.value); return; }
        if (['world.language', 'world.injection.specialLanguageEnabled'].includes(el.dataset.field)) {
          if (!draft.world.language) draft.world.language = (host.languages?.() || ['粤语'])[0];
          draft.world.languageInstruction = host.languageInstruction?.(draft.world.language) || '';
        }
      }
      if (el.dataset.field === 'world.user.avatarMode' && el.value === 'current') draft.world.user.avatar = host.user().avatar || '';
      const cardAvatar = (el.dataset.field || '').match(/^players\.(\d+)\.cardAvatar$/);
      if (cardAvatar) draft.players[Number(cardAvatar[1])].avatar = el.value;
      if (el.dataset.field?.endsWith('.avatarMode') && el.value === 'emoji') {
        const player = el.dataset.field.startsWith('world.user.') ? draft.world.user : draft.players[Number(el.dataset.field.split('.')[1])];
        if (safeImage(player.avatar) || /^pixel:/.test(player.avatar)) player.avatar = '';
      }
      if (el.dataset.field === 'config.nsfw' && !draft.config.nsfw && (draft.config.bank === 'intimate' || catalog().find(bank => bank.id === draft.config.bank)?.adult)) draft.config.bank = 'regular';
      persistDraft();
      if (/^world\.injection\.|^config\.(mode|source|nsfw|focusMode|api|bank)$|^world\.user\.avatarMode$|\.origin$|\.avatarMode$|\.cardAvatar$/.test(el.dataset.field || '')) render();
    } catch (error) { report(error); }
  }
  function onKey(event) {
    if (!event.isComposing && event.key === 'Enter' && event.target.dataset.emojiTarget) {
      event.preventDefault();
      root.querySelector(`[data-action="confirm-emoji"][data-value="${event.target.dataset.emojiTarget}"]`)?.click(); return;
    }
    if (event.key === 'Escape') { if (overlay) { event.preventDefault(); overlay = null; render(); } return; }
    if (!overlay && !busy && event.target.id === 'hc-free-input' && !event.repeat && !event.isComposing && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault(); root.querySelector('[data-action="submit-free"]:not(:disabled)')?.click(); return;
    }
    if (!overlay && !busy && page === 'play' && !event.repeat && !event.isComposing
        && [' ', 'Enter'].includes(event.key) && !event.target.closest('button,input,textarea,select,summary,a,[contenteditable=true]')
        && ['story', 'event'].includes(run()?.stage)) {
      event.preventDefault(); try { advance('next'); } catch (error) { report(error); } return;
    }
    if (!overlay || event.key !== 'Tab') return;
    const nodes = [...root.querySelectorAll('.hc-modal button:not(:disabled), .hc-modal input:not(:disabled), .hc-modal select:not(:disabled), .hc-modal textarea:not(:disabled), .hc-modal summary')];
    if (!nodes.length) return;
    if (event.shiftKey && doc.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); }
    else if (!event.shiftKey && doc.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
  }
  root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange); root.addEventListener('keydown', onKey);
  win.addEventListener('resize', onViewport);
  win.visualViewport?.addEventListener('resize', onViewport);
  root.addEventListener('toggle', onDisclosure, true);
  doc.addEventListener('visibilitychange', onVisibility); win.addEventListener('pagehide', onPageHide);
  if (room()) page = room().pendingOrder ? 'order' : game() ? 'play' : 'room';
  if (repo.state.rooms.some(r => r.games.some(g => g.request?.status === 'pending'))) update(store => {
    for (const r of store.rooms) for (const g of r.games) if (g.request?.status === 'pending') { g.request.status = 'interrupted'; g.error = { task:g.request.task, input:g.request.input, message:'上次生成因页面刷新中断，已保留进度，可以重试。', raw:'' }; }
  });
  render();
  void installPreparedPreview(repo, { isCurrent:() => !disposed && !busy && !draft && ['play', 'room'].includes(page) })
    .then(installed => { if (installed && !disposed) { page = 'play'; notice = installed === 'expressions' ? '' : '试玩剧情已载入，原有记录已保留。'; render(); } })
    .catch(error => { if (!disposed) console.warn('[HeartChallenge] Prepared preview:', error); });
  return { destroy, save:persistDraft };
}
