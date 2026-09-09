import { EXTENSION_NAME } from './src/core/metadata.js';
import { waitForHostReady } from './src/core/sillytavern.js';
import { initWanbanXiaowu } from './src/runtime/wanban-app.js';

// AI 宠物素材制作提示词。保持用户指定的导出名称拼写。
export const pet_gengeration_prompt = new URL('./design/pet-generation-guide.md', import.meta.url).href;

let booted = false;

async function boot() {
  if (booted) return;
  booted = true;
  await waitForHostReady();
  initWanbanXiaowu();
  console.info('[玩伴小屋] SillyTavern extension loaded:', EXTENSION_NAME);
}

boot().catch(error => {
  booted = false;
  console.error('[玩伴小屋] extension boot failed:', error);
});

export function onEnable() {
  boot().catch(error => console.error('[玩伴小屋] enable failed:', error));
}

export function onActivate() {
  boot().catch(error => console.error('[玩伴小屋] activate failed:', error));
}
