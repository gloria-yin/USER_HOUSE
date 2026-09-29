import * as E from '../src/heart-challenge/engine.js';

export function fixtureRoom(rounds = 1, count = 1) {
  const room = E.createRoom('雨夜的旅店', { background:'旅途中的小队被夜雨留在旅店，大家围坐在炉火旁。', user:{ name:'旅人', persona:'尊重他人、喜欢观察的成年旅人。', avatar:'🌙' } });
  room.players = Array.from({ length:count }, (_, i) => E.playerSnapshot({ id:'P' + (i + 1), name:['林舟', '夏弥', '陆遥', '温岚', '顾星'][i], description:'成年旅伴，勇敢但温柔，善于用玩笑化解尴尬。', origin:'custom', avatar:['🦊','🌸','🍀','⭐','🦋'][i], adult:true }, i));
  room.config = E.normalizeConfig({ rounds, mode:count > 1 ? 'multi' : 'duo' });
  return room;
}

export function fixtureContent(game) {
  const ids = game.snapshot.players.map(p => p.id);
  const cards = [];
  for (const round of game.plans) for (const turn of round.turns) for (const [index, spec] of turn.cards.entries()) {
    const speaker = turn.actor === 'USER' ? ids[0] : turn.actor;
    const other = ids.find(id => id !== speaker) || speaker;
    const targets = turn.actor === 'USER' ? ids : ['USER', ...ids.filter(id => id !== speaker)];
    const source = game.sourceSnapshot.filter(c => c.type === spec.type)[index];
    const line = (speaker, text, emoji = '') => ({ kind:'line', speaker, text, emoji });
    cards.push({ ...spec, round:round.id, turn:turn.id, actor:turn.actor, tag:'雨夜默契', sourceId:source?.id || '-',
      question:source?.question || '说出此刻想分享的小事 ' + index,
      declaration:spec.type === 'T' ? '这回不躲，我选真心话。' : '我选大冒险，不过你们先别笑。',
      fixedAnswer:turn.actor === 'USER' ? '' : '我记得你在下雨前替大家留了灯。', resolution:'角色分享了自己记得的善意。',
      special:game.snapshot.config.mode === 'duo' ? 'echo' : 'none', targets, requires:[],
      beats:[line(speaker, '这题倒像是专门等着我的。（抚平牌角）既然提到旅途上的小事，我想说的其实只是门口的一盏灯。那天回来得很晚，路上的摊子都收了，我原以为只能摸黑找门。', '😳'), line('N', '雨声在窗外响着，炉火把桌面的木纹映得发亮。门边的外套已经晾干大半，椅脚旁的水痕却还清晰。林舟将手指停在旧牌磨白的边缘，像是终于想起当时遗漏的细节。'),
        ...ids.map(id => line(id, id === speaker ? '我记得的是那盏灯。还没走到门口，就知道有人在等。' : '原来你也记住了，我还以为只有我看见。')),
        line(other, '不过你那时候嘴上还说，别浪费灯油。'), line(speaker, '关心灯油，和记得这件事，又不冲突。我后来特地看过，那盏灯的芯已经剪得很短，照不了整条街，偏偏就够照清门前的台阶。人到了那个时候，记住的反而是这些不起眼的安排。'),
        { kind:'choice', id:spec.id + '_Q1', prompt:'他看过来，等你接住这句话。', options:[
          { id:'warm', text:'笑着追问那晚的事', attitude:'curious', lines:[line('USER', '那你还记得什么？'), line(speaker, '记得有人一边说不冷，一边把手缩进袖子里。')], facts:['USER追问了雨夜的记忆。'] },
          { id:'reserved', text:'先把这个答案留在这里', attitude:'reserved', lines:[line(speaker, '好，剩下的以后再说。（把声音放轻）')], facts:['USER选择保留，角色接受了这个边界。'] },
        ], resume:[line('N', '桌边响起一阵轻轻的笑声，话题稳稳地落回这张牌。')] },
        line(speaker, '这就是我的答案，记性好偶尔也有好处。'), { kind:'done', card:spec.id }],
    });
  }
  return { task:'game', scene:'雨夜旅店 · 炉火旁', atmosphere:'轻松与一点试探',
    open:'夜雨来得比预料更急。你们把湿透的外衣搭在门边，掌柜又添了一盆炭，炉火把每个人的影子投在墙上。林舟把刚烧好的茶推到桌中央，摸到口袋里一路带着的旧卡牌，忍不住笑了笑。窗外的道路暂时走不成，谁也没有催着散场。他把牌放在灯下，提议玩一场真心话大冒险，语气像是在问大家要不要再喝一杯热茶。',
    cards, rounds:game.plans.map((round, i) => ({ id:round.id, title:['初见的回声', '藏在笑里的话', '默契的试探', '长夜的灯火'][i],
      intro:'牌角有些磨旧，但上面的字仍然清晰。这一轮每个人依次行动，可以说真心话，也可以接受一场小冒险；不想回答的时候，笑着摇摇头也算一种回应。',
      turns:round.turns.map(turn => ({ id:turn.id, actor:turn.actor, cardIds:turn.cards.map(c => c.id) })) })) };
}

function protocolLines(lines) {
  return lines.map(line => `[${line.speaker}${line.emoji ? ';' + line.emoji : ''}]${line.text}`).join('\n');
}

function protocolCase(card, npc = false) {
  const parts = [];
  if (npc) parts.push(`[${card.actor}]${card.declaration}`, `[DRAW:${card.id}]`);
  for (const beat of card.beats) {
    if (beat.kind === 'line') parts.push(protocolLines([beat]));
    else if (beat.kind === 'choice') {
      const resume = beat.id + '_K';
      parts.push(`<interact id="${beat.id}" resume="${resume}">`);
      for (const option of beat.options) parts.push(`<option id="${option.id}" text="${option.text}">`, protocolLines(option.lines), '</option>');
      parts.push('</interact>', `<continue id="${resume}">`, protocolLines(beat.resume), '</continue>');
    } else if (beat.kind === 'done') parts.push(`[DONE:${card.id}]`, '[END]');
  }
  return parts.join('\n');
}

export function fixtureProtocol(game) {
  const content = fixtureContent(game), cards = content.cards.map(card => {
    const tag = card.special === 'echo' ? '回声问题' : card.special === 'pair' ? '双人任务' : card.tag;
    return [card.id, card.round, card.turn, card.actor, card.type, tag, card.question].join('|');
  }).join('\n');
  const rounds = content.rounds.map(round => {
    const turns = round.turns.map(turn => {
      const selected = content.cards.filter(card => turn.cardIds.includes(card.id));
      if (turn.actor !== 'USER') return `<turn id="${turn.id}" actor="${turn.actor}" card="${selected[0].id}">\n${protocolCase(selected[0], true)}\n</turn>`;
      const truth = selected.filter(card => card.type === 'T').map(card => card.id).join(','), dare = selected.filter(card => card.type === 'D').map(card => card.id).join(',');
      return `<turn id="${turn.id}" actor="USER">\n<pick T="${truth}" D="${dare}"/>\n${selected.map(card => `<case card="${card.id}">\n${protocolCase(card)}\n</case>`).join('\n')}\n</turn>`;
    }).join('\n');
    return `<round id="${round.id}">\n${turns}\n</round>`;
  }).join('\n');
  return `<cards>\n${cards}\n</cards>\n<story>\n<open>\n${content.open}\n</open>\n${rounds}\n</story>`;
}

export function fixtureReplyProtocol(run, state = 'resume') {
  const resume = run.stage === 'choice' ? (run.current.resumeId || run.current.id) : 'TURN_END';
  return `<reply state="${state}" resume="${resume}">\n[P1]好，你的意思我听懂了。\n[N]炉火轻轻响了一声。\n[P1]刚才只顾着说自己的想法，倒是漏掉了这个细节。\n[P1]${state === 'wait' ? '你愿意再多说一点吗？' : '这个细节我记着，不急着替它下结论。'}\n</reply>`;
}

export function fixtureGame(rounds = 1, count = 1, userFirst = false) {
  const room = fixtureRoom(rounds, count);
  const order = [...room.players.map(p => p.id), 'USER'];
  if (userFirst) order.unshift(order.pop());
  const game = E.createGame(room, { order, revealed:true }, () => .3);
  game.content = E.validateContent(fixtureContent(game), game);
  const run = E.newRun(game); game.runs.push(run); game.activeRunId = run.id;
  room.games.push(game); room.activeGameId = game.id;
  return { room, game, run };
}

export function step(game, run, attitude = 'reserved', type = 'T') {
  if (run.stage === 'pickType') E.advance(game, run, 'type', type);
  else if (run.stage === 'pick') E.advance(game, run, 'draw', run.offered[0]);
  else if (run.stage === 'reveal') E.advance(game, run, 'accept');
  else if (run.stage === 'choice') E.advance(game, run, 'option', run.current.options.find(o => o.attitude === attitude)?.id || run.current.options[0].id);
  else E.advance(game, run, 'next');
}
export function until(game, run, stage) {
  for (let i = 0; i < 3000 && run.stage !== stage; i++) step(game, run);
  if (run.stage !== stage) throw new Error('Did not reach ' + stage);
}
