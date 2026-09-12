const asArray = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim() : '';

export function petStoryMemoryText(info, state = {}, { beforeDate = '' } = {}) {
  const records = asArray(state.storyRecords).filter(item => item && typeof item === 'object');
  const remembered = new Set(records.map(item => item.id));
  const route = [state.route, state.stage].find(value => ['spirit', 'ordinary'].includes(value));
  const resolveStory = (id, selectedRoute = route) => {
    const item = info?.mainById?.[id] || asArray(info?.side_story).find(item => item?.id === id);
    if (!item) return null;
    if (item.variants) return selectedRoute ? item.variants[selectedRoute] : null;
    if ((id === 'M12' && selectedRoute !== 'spirit') || (id === 'M13' && selectedRoute !== 'ordinary')) return null;
    return item;
  };

  // Legacy completion flags identify played scenes, never the unused ending variant.
  // Undated scenes cannot safely be included when reconstructing a previous day.
  const legacy = beforeDate ? [] : [...asArray(state.completedMain), ...asArray(state.completedSide)]
    .filter(id => !remembered.has(id)).map(id => {
      const item = resolveStory(id);
      return item ? { ...item, id } : null;
    }).filter(Boolean);
  const played = records.slice().reverse()
    .filter(item => !beforeDate || (text(item.date) && item.date < beforeDate))
    .map(item => {
      const selectedRoute = ['spirit', 'ordinary'].includes(item.route) ? item.route : route;
      const source = resolveStory(item.id, selectedRoute);
      return { ...source, ...item, summary:text(item.summary) || text(source?.summary), story:text(item.story) || text(source?.story) };
    });
  const stories = [...legacy, ...played];

  // Preserve the identity reveal and ending alongside recent full scenes; keep all summaries.
  const detailed = new Set(stories.slice(-3));
  stories.filter(item => item.id === 'M02' || item.id === 'M15').forEach(item => detailed.add(item));
  return stories.map(item => [
    'experienced_story: ' + [item.id, text(item.title), text(item.date)].filter(Boolean).join(' | '),
    text(item.summary) ? 'summary: ' + text(item.summary) : '',
    detailed.has(item) && text(item.story) ? 'read_scene:\n' + text(item.story) : ''
  ].filter(Boolean).join('\n')).join('\n\n');
}
