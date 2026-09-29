import { readFile } from 'node:fs/promises';
import { loadHeartPromptTemplates, gamePrompt as buildGame, replyPrompt as buildReply, endingPrompt as buildEnding } from '../src/heart-challenge/prompts.js';

export async function readPromptAsset(url, { signal } = {}) {
  const body = await readFile(url, { encoding:'utf8', signal });
  return { ok:true, text:async () => body };
}

export const templates = Object.fromEntries(await Promise.all(['game', 'reply', 'ending'].map(async task =>
  [task, await loadHeartPromptTemplates(task, { fetch:readPromptAsset })])));
export const gamePrompt = game => buildGame(game, templates.game);
export const replyPrompt = (game, run, input) => buildReply(game, run, input, templates.reply);
export const endingPrompt = game => buildEnding(game, templates.ending);
