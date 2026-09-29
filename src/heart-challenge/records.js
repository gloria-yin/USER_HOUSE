// Archive views only read the room; opening a record never selects a live run.
export function roomStories(room) {
  return room.games.map(game => ({ game, current:game.id === room.activeGameId,
    entries:(game.runs || []).flatMap(run => [
      { id:run.id, game, run, history:run.history || [], active:run.id === game.activeRunId, createdAt:run.createdAt },
      ...(run.branches || []).map(branch => ({ id:branch.id, game, run, history:branch.history || [], branch:true, createdAt:branch.createdAt || run.createdAt })),
    ]),
  }));
}

export function collectedCards(game) {
  if (!game?.content) return [];
  return game.content.cards.map(card => {
    const draws = [];
    for (const run of game.runs || []) {
      const record = (run.records || []).find(record => record.cardId === card.id || record.card === card.id);
      const encountered = (run.history || []).some(line => line.cardId === card.id)
        || run.cardId === card.id || run.rejected?.includes(card.id) || run.used?.includes(card.id) || record;
      if (encountered) draws.push({ actor:card.actor, runId:run.id, status:record?.status || (run.rejected?.includes(card.id) ? 'swapped' : 'drawn'), active:run.id === game.activeRunId });
      for (const branch of run.branches || []) if (branch.history?.some(line => line.cardId === card.id)) {
        draws.push({ actor:card.actor, runId:branch.id, status:'archived', active:false });
      }
    }
    return { card, draws };
  });
}

export function storySegments(entry, round = '', turn = '') {
  const lines = (entry?.history || []).filter(line => line.text && line.kind !== 'draw'
    && (round === '' || line.roundIndex === Number(round)) && (turn === '' || line.turnIndex === Number(turn)));
  let text = '';
  const segments = lines.map(line => {
    const start = text.length;
    text += line.text;
    const end = text.length;
    text += '\n\n';
    return { start, end, speaker:line.speaker || 'N', emoji:line.emoji || '', kind:line.kind || 'line', type:line.type, roundIndex:line.roundIndex };
  });
  return { text, segments, lines };
}

// One session can span several generation batches; only an ending closes it.
export function roomSessions(room) {
  const sessions = [];
  for (const group of roomStories(room)) {
    if (!group.entries.length) continue;
    let session = sessions.at(-1);
    if (!session || session.ended || group.game.continuity?.resetAfterEnding) {
      session = { id:group.game.id, number:sessions.length + 1, games:[], entries:[], rounds:0, current:false, ended:false };
      sessions.push(session);
    }
    session.games.push(group.game);
    session.entries.push(...group.entries.map(entry => ({ ...entry, roundOffset:session.rounds })));
    session.rounds += group.game.snapshot.config.rounds;
    session.current ||= group.current;
    session.ended = !!(group.game.sessionEndedAt || group.entries.some(entry => entry.active && !entry.branch && entry.run.ending));
  }
  return sessions;
}

export function storyChapters(entry, round = '') {
  const chapters = [];
  for (const line of storySegments(entry, round).lines) {
    const kind = ['opening', 'round', 'ending'].includes(line.kind) ? line.kind : 'turn';
    const key = `${kind}:${line.roundIndex}:${kind === 'turn' ? line.turnIndex : ''}`;
    let chapter = chapters.at(-1);
    if (chapter?.key !== key) {
      const turn = kind === 'turn' ? entry.game.content?.rounds[line.roundIndex]?.turns[line.turnIndex] : null;
      chapter = { key, kind, roundIndex:line.roundIndex, turnIndex:line.turnIndex, actor:turn?.actor, lines:[] };
      chapters.push(chapter);
    }
    chapter.lines.push(line);
  }
  return chapters;
}
