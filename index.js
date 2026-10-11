import { EXTENSION_NAME } from './src/core/metadata.js';
import { waitForHostReady } from './src/core/sillytavern.js';

// AI 宠物素材制作提示词。保持用户指定的导出名称拼写。
export const pet_gengeration_prompt = new URL('./design/pet-generation-guide.md', import.meta.url).href;

const MENU_ID = 'wanbanXiaowu-menu-item';
const MENU_SELECTORS = [
  '#extensionsMenu', '#extensionMenuItems', '.extensions_block', '#extension_settings',
  '#extensionsMenuList', '.extension_menu', '#rm_extensions_block',
];
let booted = false;
let runtimePromise = null;
let stylesPromise = null;
let lastOpenAt = 0;

function hostDocuments() {
  const documents = [];
  try {
    if (window.parent && window.parent !== window && window.parent.document?.body) documents.push(window.parent.document);
  } catch (_) {}
  if (document.body && !documents.includes(document)) documents.push(document);
  return documents;
}

function ensureStyles() {
  if (stylesPromise) return stylesPromise;
  const href = new URL('./style.css?v=4.2.2', import.meta.url).href;
  stylesPromise = Promise.all(hostDocuments().map(doc => new Promise((resolve, reject) => {
    const existing = doc.querySelector('link[data-wanban-style="1"]');
    if (existing?.sheet) { resolve(); return; }
    const link = existing || doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.wanbanStyle = '1';
    link.onload = resolve;
    link.onerror = () => reject(new Error('玩伴小屋样式加载失败'));
    if (!existing) (doc.head || doc.documentElement).appendChild(link);
  }))).catch(error => {
    stylesPromise = null;
    throw error;
  });
  return stylesPromise;
}

function prepareRuntime() {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import('./src/runtime/wanban-app.js?v=4.2.2'),
      ensureStyles(),
    ]).then(([runtime]) => runtime).catch(error => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

async function loadRuntime(open = false) {
  const runtime = await prepareRuntime();
  await runtime.initWanbanXiaowu({ open });
}

async function openFromLauncher(item) {
  const now = Date.now();
  if (now - lastOpenAt < 350) return;
  lastOpenAt = now;
  const label = item?.querySelector('span');
  if (label) label.textContent = '玩伴小屋（加载中）';
  item?.setAttribute('aria-busy', 'true');
  try {
    const doc = item?.ownerDocument;
    const menu = MENU_SELECTORS.map(selector => doc?.querySelector(selector)).find(Boolean);
    const menuButton = doc?.querySelector('#extensionsMenuButton');
    if (menu && menuButton && doc.defaultView?.getComputedStyle(menu).display !== 'none') menuButton.click();
    await loadRuntime(true);
  } catch (error) {
    console.error('[玩伴小屋] extension load failed:', error);
    alert('玩伴小屋加载失败，请刷新后重试。');
  } finally {
    if (label) label.textContent = '玩伴小屋';
    item?.removeAttribute('aria-busy');
  }
}

function mountLauncher(doc) {
  if (!doc?.body || doc.getElementById(MENU_ID)) return true;
  const menu = MENU_SELECTORS.map(selector => doc.querySelector(selector)).find(Boolean);
  if (!menu) return false;
  const wrap = doc.createElement('div');
  wrap.className = 'extension_container interactable';
  wrap.tabIndex = 0;
  wrap.innerHTML = '<div class="list-group-item flex-container flexGap5 interactable" id="' + MENU_ID + '" title="玩伴小屋"><div class="fa-fw fa-solid fa-gamepad extensionsMenuExtensionButton"></div><span>玩伴小屋</span></div>';
  const item = wrap.firstElementChild;
  const prepare = () => prepareRuntime().catch(error => console.warn('[玩伴小屋] intent preload failed:', error));
  item.addEventListener('pointerdown', prepare, { passive:true });
  item.addEventListener('pointerenter', prepare, { passive:true, once:true });
  item.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openFromLauncher(item);
  });
  wrap.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openFromLauncher(item);
  });
  menu.appendChild(wrap);
  return true;
}

function installLauncher() {
  let attempts = 0;
  const retry = () => {
    const mounted = hostDocuments().some(mountLauncher);
    attempts += 1;
    if (!mounted && attempts < 30) setTimeout(retry, attempts < 6 ? 500 : 1500);
  };
  retry();
}

async function backgroundRuntimeEnabled() {
  try {
    const raw = localStorage.getItem('wanbanXiaowu_settings_v1');
    if (!raw) return false;
    const { decodeStoredJSON } = await import('./src/runtime/storage.js');
    const settings = decodeStoredJSON(raw) || {};
    return !!(settings.messageNotify || settings.petDesktopEnabled || settings.floatingBallEnabled);
  } catch (_) {
    return false;
  }
}

function scheduleRuntimeWarmup() {
  const warm = () => loadRuntime(false).catch(error => console.warn('[玩伴小屋] idle warmup failed:', error));
  setTimeout(async () => {
    if (await backgroundRuntimeEnabled()) warm();
  }, 3000);
}

async function boot() {
  if (booted) return;
  booted = true;
  await waitForHostReady();
  installLauncher();
  scheduleRuntimeWarmup();
  console.info('[玩伴小屋] lightweight launcher loaded:', EXTENSION_NAME);
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
