import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const textDir = resolve(root, 'assets/pets/text');
const species = ['rabbit', 'dog', 'cat', 'bird', 'bala', 'fox', 'otter', 'hedgehog', 'redpanda', 'alpaca', 'sikadeer'];
const allowedLabels = new Set(['旁白', 'C', 'U', 'P']);
const expectedMainIds = Array.from({ length:15 }, (_, index) => `M${String(index + 1).padStart(2, '0')}`);
const taskNarration = /^(?:\[旁白\]\s*)?.*(?:你们要|你们需要|你们必须|沈栖白必须|需要教会|任务是|目标是|这次要|必须在继续前)/;
const fixedEggDescription = /(?:蓝白色蛋壳|(?:蓝色|紫色|粉色|绿色|金色|白色)蛋壳|蓝白色蛋|蓝白蛋|蓝色蛋|紫色蛋|粉色蛋|绿色蛋|金色蛋|白色蛋|[蓝紫粉绿金白]蛋)/;
const explanatoryOpening = /(?:你们要|你们需要|你们必须|任务是|目标是|表示反对|拒绝只由|迫使|逼(?:你|两人))/;

function fail(errors, file, message) {
  errors.push(`${file}: ${message}`);
}

function itemBlocks(section) {
  const starts = [...section.matchAll(/^  - id: ([A-Z]+\d+)/gm)];
  return starts.map((match, index) => ({
    id:match[1],
    text:section.slice(match.index, starts[index + 1]?.index ?? section.length)
  }));
}

function storyBodies(block) {
  const bodies = [];
  const lines = block.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const story = lines[index].match(/^(\s*)story:\s*\|-\s*$/);
    if (!story) continue;
    const indent = story[1].length;
    const body = [];
    for (index += 1; index < lines.length; index++) {
      const current = lines[index];
      if (!current.trim()) continue;
      const currentIndent = current.match(/^\s*/)[0].length;
      if (currentIndent <= indent) { index -= 1; break; }
      body.push(current.trim());
    }
    bodies.push(body);
  }
  return bodies;
}

function countQuoteItems(section) {
  return (section.match(/^\s+-\s+"/gm) || []).length;
}

function quoteItems(section) {
  return [...section.matchAll(/^\s+-\s+"((?:\\.|[^"\\])*)"\s*$/gm)]
    .map(match => JSON.parse(`"${match[1]}"`));
}

const errors = [];
const allTitles = new Map();

for (const key of species) {
  const file = `pet_info_${key}.txt`;
  const text = await readFile(resolve(textDir, file), 'utf8');
  const petCardSection = text.slice(text.indexOf('\npet_card:\n'), text.indexOf('\nmain_story:\n'));
  if (/^\s+egg:\s+/m.test(petCardSection)) fail(errors, file, 'default story stores a fixed egg instead of using the player selection');
  if (fixedEggDescription.test(text)) fail(errors, file, 'contains a hard-coded egg colour in reusable default-story content');
  const firstOutingCount = (text.match(/第一次(?:只为玩耍出门|自己挑一个只负责开心的目的地|纯玩耍外出|“没有考核的散步”)/g) || []).length;
  if (firstOutingCount !== 1) fail(errors, file, `expected one first leisure outing, found ${firstOutingCount}`);
  if (/第一次非必要出门|手胘/.test(text)) fail(errors, file, 'contains a repeated-outing phrase or typo');
  const mainMarker = text.indexOf('\nmain_story:\n');
  const sideMarker = text.indexOf('\nside_story:\n');
  const quotesMarker = text.indexOf('\nquotes:\n');
  if (mainMarker < 0 || sideMarker < 0 || quotesMarker < 0) {
    fail(errors, file, 'missing main_story, side_story, or quotes section');
    continue;
  }

  const main = text.slice(mainMarker + 1, sideMarker);
  const side = text.slice(sideMarker + 1, quotesMarker);
  const quotes = text.slice(quotesMarker + 1);
  const mainBlocks = itemBlocks(main);
  const sideBlocks = itemBlocks(side);
  const ids = mainBlocks.map(block => block.id);
  const opening = mainBlocks.find(block => block.id === 'M01')?.text || '';

  if (JSON.stringify(ids) !== JSON.stringify(expectedMainIds)) {
    fail(errors, file, `main ids are ${ids.join(', ')}`);
  }
  if (!/(第一次见面|第一次见到|彼此陌生|两个陌生人)/.test(opening)) {
    fail(errors, file, 'M01 does not establish the first meeting');
  }
  if (/(常坐位置|你的杯子|之前约定|像往常一样|早已认识)/.test(opening)) {
    fail(errors, file, 'M01 contains familiarity that predates the first meeting');
  }
  if (sideBlocks.length !== 6) fail(errors, file, `expected 6 side stories, found ${sideBlocks.length}`);

  for (const block of mainBlocks) {
    const expectedBodies = ['M14', 'M15'].includes(block.id) ? 2 : 1;
    const bodies = storyBodies(block.text);
    if (bodies.length !== expectedBodies) fail(errors, file, `${block.id} expected ${expectedBodies} story bodies, found ${bodies.length}`);
    if (['M14', 'M15'].includes(block.id)) {
      if (!/^      spirit:\s*$/m.test(block.text) || !/^      ordinary:\s*$/m.test(block.text)) {
        fail(errors, file, `${block.id} is missing spirit or ordinary variant`);
      }
    }
    const title = block.text.match(/^    title:\s*(.+)$/m)?.[1];
    if (title) {
      const previous = allTitles.get(title);
      if (previous) fail(errors, file, `main title "${title}" duplicates ${previous}`);
      else allTitles.set(title, `${file}/${block.id}`);
    }
  }

  const bodies = [...mainBlocks, ...sideBlocks].flatMap(block =>
    storyBodies(block.text).map((lines, index) => ({ id:block.id, variant:index, lines, blockText:block.text }))
  );
  if (bodies.length !== 23) fail(errors, file, `expected 23 story bodies, found ${bodies.length}`);

  for (const body of bodies) {
    const counts = { 旁白:0, C:0, U:0, P:0 };
    const firstLine = body.lines[0] || '';
    const firstText = firstLine.replace(/^\[旁白\]\s*/, '').trim();
    const synopsis = body.blockText.match(/^\s+(?:summary|opening_cause):\s*(.+)$/m)?.[1]?.trim() || '';
    const comparable = value => String(value || '').replace(/[\s，。！？、；：“”‘’（）()《》【】]/g, '');
    const firstComparable = comparable(firstText);
    const synopsisComparable = comparable(synopsis);
    if (!/^\[旁白\]\s+/.test(firstLine)) fail(errors, file, `${body.id} does not open with scene narration`);
    if (explanatoryOpening.test(firstText)) fail(errors, file, `${body.id} opens with explanatory/task-like prose: ${firstText.slice(0, 60)}`);
    if (firstComparable.length >= 10 && synopsisComparable.length >= 10
      && (firstComparable === synopsisComparable || firstComparable.startsWith(synopsisComparable) || synopsisComparable.startsWith(firstComparable))) {
      fail(errors, file, `${body.id} repeats its synopsis as the story opening`);
    }
    if (synopsis.length >= 10 && body.lines.join('\n').includes(synopsis)) {
      fail(errors, file, `${body.id} copies its synopsis verbatim into the story body`);
    }
    for (const line of body.lines) {
      const label = line.match(/^\[([^\]]+)\]\s+/)?.[1];
      if (!label || !allowedLabels.has(label)) {
        fail(errors, file, `${body.id} contains invalid story line: ${line.slice(0, 40)}`);
        continue;
      }
      counts[label] += 1;
      if (label === '旁白' && taskNarration.test(line)) {
        fail(errors, file, `${body.id} contains task-like narration: ${line.slice(0, 60)}`);
      }
    }
    if (counts.C < 5 || counts.U < 3 || counts.P < 3 || counts.旁白 <= 8) {
      fail(errors, file, `${body.id} labels are C=${counts.C}, U=${counts.U}, P=${counts.P}, narrator=${counts.旁白}`);
    }
    const chineseLength = (body.lines.join('').match(/[\u3400-\u9fff]/g) || []).length;
    if (chineseLength < 500) fail(errors, file, `${body.id} has only ${chineseLength} Chinese characters`);
  }

  const charStart = quotes.indexOf('\n  char:\n');
  const petStart = quotes.indexOf('\n  pet:\n');
  if (charStart < 0 || petStart < 0) {
    fail(errors, file, 'missing char or pet quote subsection');
  } else {
    const charCount = countQuoteItems(quotes.slice(charStart, petStart));
    const petSection = quotes.slice(petStart);
    const petQuotes = quoteItems(petSection);
    const petCount = petQuotes.length;
    if (charCount !== 33) fail(errors, file, `expected 33 char quotes, found ${charCount}`);
    if (petCount !== 45) fail(errors, file, `expected 45 pet quotes, found ${petCount}`);
    if (new Set(petQuotes).size !== petQuotes.length) {
      fail(errors, file, 'pet quotes repeat within or across growth stages');
    }
    if (petQuotes.some(quote => /(?:\u6211\u4f1a\u8bb0\u5f97|\u6211\u5df2\u7ecf\u957f\u5927)\u3002?$/.test(quote))) {
      fail(errors, file, 'pet quotes contain a mechanically appended growth-stage ending');
    }
  }

  if (/\$\{pet\.|\[沈栖白\]|江维/.test(text)) fail(errors, file, 'contains unresolved placeholder, NPC label, or legacy name');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Verified ${species.length} files: 15 main milestones, 6 side stories, 23 bodies, 33/45 quotes, and all body constraints.`);
}
