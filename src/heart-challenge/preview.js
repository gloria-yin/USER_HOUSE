import * as E from './engine.js?v=4.1.13-heart-logs';

const ROOT = new URL('../../assets/heart-challenge/', import.meta.url);

export async function installDemoRoom(repo, { fetch:read = globalThis.fetch, isCurrent = () => true } = {}) {
  const demoId = 'rainy-inn-demo-v1';
  const existing = repo.state.rooms.find(room => room.demoId === demoId);
  if (existing) return existing.id;
  if (repo.state.rooms.length >= E.HEART_LIMITS.rooms) throw new Error('房间已满，请先整理房间再添加测试房间。');
  const response = await read(new URL('demo-game.xml', ROOT), { cache:'no-store' });
  if (!response.ok) throw new Error('测试房间读取失败，请刷新后重试。');
  const text = await response.text();
  const room = E.createRoom('测试房间 · 雨夜旅店', { background:'夜雨将两名成年旅人留在旅店，围坐炉火旁玩真心话大冒险。', user:{ name:'旅人', persona:'成年旅人，愿意慢慢了解旅伴。', avatarMode:'current' } });
  room.demoId = demoId;
  room.players = [E.playerSnapshot({ id:'P1', name:'林舟', description:'成年旅伴，温和、善于观察，尊重他人的保留与拒绝。', origin:'custom', avatarMode:'auto', avatar:'pixel:0' }, 0)];
  room.config = E.normalizeConfig({ mode:'duo', rounds:1, source:'random', orderMode:'manual' });
  const game = E.createGame(room, { order:['P1', 'USER'], revealed:true }, () => .99);
  game.content = E.validateContent(text.slice(text.indexOf('<cards>')), game);
  const run = E.newRun(game);
  game.runs.push(run); game.activeRunId = run.id;
  room.games.push(game); room.activeGameId = game.id;
  if (!isCurrent()) return null;
  let id = room.id;
  repo.update(store => {
    const existing = store.rooms.find(item => item.demoId === demoId);
    if (existing) { id = existing.id; return; }
    if (store.rooms.length >= E.HEART_LIMITS.rooms) throw new Error('房间已满，测试房间未添加。');
    store.rooms.push(room);
  });
  return id;
}

export async function previewFingerprint(game) {
  const source = JSON.stringify({ snapshot:game.snapshot, order:game.order, plans:game.plans, sourceSnapshot:game.sourceSnapshot });
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function installPreparedPreview(repo, { fetch:read = globalThis.fetch, isCurrent = () => true } = {}) {
  const activeRoom = repo.state.rooms.find(room => room.id === repo.state.activeRoomId);
  if (activeRoom?.previewImports?.length && isCurrent()) {
    const response = await read(new URL('preview.json', ROOT), { cache:'no-store' });
    if (response.ok) {
      const manifest = await response.json();
      const existing = activeRoom.games.find(game => game.id === manifest.gameId);
      if (existing?.content && activeRoom.id === manifest.roomId && (existing.expressionRevision || 0) < (manifest.expressionRevision || 0)) {
        const output = await read(new URL('preview-test.xml', ROOT), { cache:'no-store' });
        if (!output.ok) return false;
        const reference = E.validateContent(await output.text(), existing), expressions = new Map();
        const visit = (value, apply) => {
          if (!value || typeof value !== 'object') return;
          if (value.speaker && value.text) apply(value);
          for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child, apply);
        };
        visit(reference, line => { if (line.emoji) expressions.set(line.speaker + '\n' + line.text, line.emoji); });
        if (!isCurrent()) return false;
        repo.update(store => {
          const game = store.rooms.find(room => room.id === manifest.roomId)?.games.find(game => game.id === manifest.gameId);
          if (!game) return;
          // Only add display metadata to unchanged lines; keep every selected branch and saved node.
          visit(game, line => { const emoji = expressions.get(line.speaker + '\n' + line.text); if (emoji && !line.emoji) line.emoji = emoji; });
          game.expressionRevision = manifest.expressionRevision;
        });
        return 'expressions';
      }
    }
  }
  const eligible = (store, manifest) => {
    const room = store.rooms.find(item => item.id === store.activeRoomId);
    const game = room?.games.find(item => item.id === room.activeGameId);
    if (!room || !game || game.content || !game.error || game.request?.status === 'pending') return null;
    if (manifest && (room.id !== manifest.roomId || game.id !== manifest.sourceGameId
      || room.previewImports?.includes(manifest.id) || room.games.some(item => item.id === manifest.gameId))) return null;
    return { room, game };
  };
  if (!eligible(repo.state) || !isCurrent()) return false;
  const response = await read(new URL('preview.json', ROOT), { cache:'no-store' });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error('试玩剧情资料读取失败。');
  const manifest = await response.json(), target = eligible(repo.state, manifest);
  if (!target || !isCurrent()) return false;
  if (!manifest.id || !manifest.gameId || manifest.version !== 1 || manifest.file !== 'preview-test.xml') throw new Error('试玩剧情资料格式不正确。');
  if (await previewFingerprint(target.game) !== manifest.fingerprint) return false;
  const source = JSON.stringify(target.game);
  const output = await read(new URL(manifest.file, ROOT), { cache:'no-store' });
  if (!output.ok) throw new Error('试玩剧情文件读取失败。');
  const content = E.validateContent(await output.text(), target.game);
  if (!isCurrent()) return false;
  const latest = eligible(repo.state, manifest);
  if (!latest || JSON.stringify(latest.game) !== source) return false;
  // Append a new game atomically; the failed response and any previous play stay intact.
  repo.update(store => {
    const current = eligible(store, manifest);
    if (!current || JSON.stringify(current.game) !== source) throw new Error('房间已经变化，试玩剧情未写入。');
    const { room, game } = current;
    if (room.games.length >= E.HEART_LIMITS.games) throw new Error('房间记录已满，试玩剧情未写入。');
    const preview = { ...E.clone(game), id:manifest.gameId,
      number:Math.max(...room.games.map(item => item.number || 0)) + 1, createdAt:Date.now(),
      content, runs:[], activeRunId:'', request:null, error:null, expressionRevision:manifest.expressionRevision || 0 };
    const run = E.newRun(preview);
    preview.runs.push(run); preview.activeRunId = run.id;
    room.games.push(preview); room.activeGameId = preview.id;
    room.previewImports = [...(room.previewImports || []), manifest.id];
  });
  return true;
}
