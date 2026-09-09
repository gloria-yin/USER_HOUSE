import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ROLE_DEFAULTS, isolatedRole, withRoleContext, characterCardText } from '../src/runtime/role-context.js';

const runtime = readFileSync(new URL('../src/runtime/wanban-app.js', import.meta.url), 'utf8');
function functionSource(name) {
  const match = new RegExp('^  (?:async )?function ' + name + '\\(', 'm').exec(runtime);
  assert.ok(match, name);
  const start = match.index;
  const lineEnd = runtime.indexOf('\n', start);
  if (runtime.slice(start, lineEnd).trimEnd().endsWith('}')) return runtime.slice(start, lineEnd);
  return runtime.slice(start, runtime.indexOf('\n  }', lineEnd) + 4);
}

function harness() {
  const store = {};
  const cfg = {
    charName:'Alpha', avatarUrl:'/alpha.png', manualCharPersona:'ALPHA_ONLY',
    userName:'AlphaUser', userPersona:'ALPHA_ONLY', charDescriptionSnapshot:'ALPHA_ONLY',
    selectedWorldEntries:[{ label:'AlphaWorld', content:'ALPHA_ONLY' }],
    summaryId:'alpha-summary', summarySnapshot:{ content:'ALPHA_ONLY' },
    specialLanguageEnabled:true, specialLanguage:'ALPHA_ONLY', breakLimitPrompt:'ALPHA_ONLY',
    apiUrl:'https://example.invalid', apiKey:'shared-key', apiModel:'test-model',
  };
  const host = { characterId:0, name1:'AlphaUser', chat:[], characters:[
    { avatar:'alpha.png', data:{ name:'Alpha', description:'ALPHA_ONLY' } },
    { avatar:'beta.png', data:{ name:'Beta', description:'BETA_CARD', personality:'BETA_PERSONALITY',
      scenario:'BETA_SCENARIO', mes_example:'BETA_EXAMPLES', system_prompt:'BETA_SYSTEM',
      character_book:{ entries:[{ content:'BETA_INLINE_WORLD' }] } } },
  ] };
  const context = vm.createContext({
    console, ROLE_DEFAULTS, isolatedRole, withRoleContext, characterCardText,
    STORAGE_ROLE_CONTEXTS:'roles', STORAGE_WORLD_PRESETS:'presets', STORAGE_PET_FULL:'pets',
    STORAGE_PET_TEST:'trial', SCRIPT_ID:'test', PET_SPECIAL_CHAR_NAME:'沈栖白',
    PET_SPECIAL_CHAR_AVATAR:'/shen.png', PET_ASSET_BASE:'/pets/',
    currentGame:'snake', gameStarted:false, currentRoundRoleContext:null, petRuntimeMode:'full', petFullActiveCaretakerId:'',
    petTestInfoCache:null, petTestInfoLoading:null, petShenPortraitSelection:null,
    settings:() => structuredClone(cfg),
    setSettings:next => Object.assign(cfg, next),
    getHostContext:() => host,
    getHostWindow:() => ({}),
    safeObject:v => v && typeof v === 'object' && !Array.isArray(v) ? v : {},
    safeArray:v => Array.isArray(v) ? v : [],
    loadJSON:(key, fallback) => structuredClone(store[key] ?? fallback),
    saveJSON:(key, value) => { store[key] = structuredClone(value); },
    readCurrentUserPersonaFromST:() => 'ALPHA_ONLY',
    readCurrentUserNameFromST:() => 'AlphaUser',
    summarySnapshotFromId:id => id ? { content:'ALPHA_ONLY' } : null,
    recentChatText:() => 'ALPHA_ONLY',
    companionName:() => cfg.charName,
    activeGameRoleName:() => 'Beta',
    defaultPetTestState:() => ({ logs:{}, userName:'' }),
    qs:() => null,
    toast:() => {},
    setCurrentLinePreset:(game, name) => { context.selection = name; },
  });
  const names = ['normalizePresetName', 'hostRoleName', 'hostCharacterForRole', 'captureRoleContext',
    'saveRoleContext', 'worldPresets', 'worldPresetForRole', 'rolePromptConfig',
    'avatarUrlFromValue', 'findCharacterAvatarByName', 'findAvatar',
    'currentCharDescription', 'currentUserDescription', 'petCaretakerIsShen',
    'petCaretakerPromptConfig', 'defaultPetFullData', 'petFullData', 'savePetFullData',
    'petFullActiveCaretaker', 'petFullActivePet', 'petStorageTarget', 'petTargetIsCurrent',
    'updatePetTargetState', 'petTestState', 'petTrialHasSavedPet', 'withPetFullActive',
    'resumePetSpecialCompanion', 'applyWorldPresetToGame', 'refreshGameCompanionPanel',
    'applyLinePresetSelection', 'petShenPortraitUrl', 'selectedWorldText', 'selectedSummaryText'];
  vm.runInContext(names.map(functionSource).join('\n'), context);
  store.presets = [{ name:'Beta', charName:'Beta', avatarUrl:'', userPersona:'BETA_USER' }];
  return { context, store, cfg, host };
}

test('empty and absent fields do not inherit settings role data; API stays shared', () => {
  const { context:c, store, cfg } = harness();
  const role = c.rolePromptConfig('Beta');
  assert.equal(role.apiKey, 'shared-key');
  assert.equal(role.avatarUrl, '');
  assert.equal(role.userPersona, 'BETA_USER');
  assert.equal(role.specialLanguageEnabled, false);
  assert.deepEqual(role.selectedWorldEntries, []);
  assert.equal(role.summaryId, '');
  assert.equal(role.breakLimitPrompt, '');
  assert.ok(!JSON.stringify(role).includes('ALPHA_ONLY'));
  assert.ok(!JSON.stringify(store.roles).includes('shared-key'));
  cfg.userPersona = 'CHANGED_ALPHA';
  assert.equal(c.currentUserDescription(role), 'BETA_USER');
  role.selectedWorldEntries.push({ content:'mutation' });
  assert.deepEqual(c.rolePromptConfig('Beta').selectedWorldEntries, []);
});

test('matching card snapshot contains personality, scenario, examples and inline worldbook', () => {
  const { context:c, host } = harness();
  const role = c.rolePromptConfig('Beta');
  for (const marker of ['BETA_CARD','BETA_PERSONALITY','BETA_SCENARIO','BETA_EXAMPLES','BETA_SYSTEM','BETA_INLINE_WORLD']) {
    assert.ok(c.currentCharDescription(role).includes(marker), marker);
  }
  host.characters[1].data.description = 'NEW_CARD';
  assert.ok(c.currentCharDescription(c.rolePromptConfig('Beta')).includes('BETA_CARD'));
});

test('default avatar belongs to selected game role, never settings or an arbitrary DOM image', async () => {
  const { context:c, cfg } = harness();
  assert.equal(c.findAvatar(), '/thumbnail?type=avatar&file=beta.png');
  const before = structuredClone(cfg);
  await c.applyLinePresetSelection('snake', 'world::0');
  assert.equal(c.selection, 'Beta');
  assert.deepEqual(cfg, before);
  c.activeGameRoleName = () => 'Missing';
  assert.equal(c.findAvatar(), '');
  assert.ok(!c.currentCharDescription(c.rolePromptConfig('Missing')).includes('ALPHA_ONLY'));
});

test('ambiguous card names do not pick the first other card', () => {
  const { context:c, host } = harness();
  host.characters.push({ avatar:'another-beta.png', data:{ name:'Beta' } });
  assert.equal(c.findCharacterAvatarByName('Beta'), '');
  assert.equal(c.hostCharacterForRole('Beta', 'beta.png').avatar, 'beta.png');
});

test('Shen fixed and generated routes have no default-role world, persona, summary or language', () => {
  const { context:c, store } = harness();
  for (const caretaker of [null, { name:'沈栖白', charDescriptionSnapshot:'SHEN_CARD', worldText:'ALPHA_ONLY' }]) {
    const role = c.petCaretakerPromptConfig(caretaker);
    assert.equal(role.charName, '沈栖白');
    assert.equal(role.builtinPetCaretaker, 'shenqibai');
    assert.ok(!JSON.stringify(role).includes('ALPHA_ONLY'));
  }
  store.pets = { activeCaretakerId:'beta', caretakers:[{ id:'beta', name:'Beta', pets:[] }] };
  assert.equal(c.petCaretakerPromptConfig().charName, 'Beta');
});

test('late pet log writes remain attached to original caretaker and pet', () => {
  const { context:c, store } = harness();
  store.pets = { activeCaretakerId:'a', caretakers:[
    { id:'a', name:'Alpha', activePetId:'a1', pets:[{ id:'a1', state:{ logs:{} } }] },
    { id:'b', name:'Beta', activePetId:'b1', pets:[{ id:'b1', state:{ logs:{} } }] },
  ] };
  const target = c.petStorageTarget();
  c.withPetFullActive('b');
  c.updatePetTargetState(target, state => ({ ...state, logs:{ yesterday:'ALPHA_LOG' } }));
  assert.equal(store.pets.caretakers[0].pets[0].state.logs.yesterday, 'ALPHA_LOG');
  assert.deepEqual(store.pets.caretakers[1].pets[0].state.logs, {});
  assert.equal(store.pets.activeCaretakerId, 'b');
  assert.equal(c.petTargetIsCurrent(target), false);
});

test('empty generated caretaker cannot borrow fixed-route state', () => {
  const { context:c, store } = harness();
  store.trial = { userName:'TRIAL_USER', growth:99 };
  store.pets = { activeCaretakerId:'b', caretakers:[{ id:'b', name:'Beta', pets:[] }] };
  assert.equal(c.petTestState().userName, '');
  c.petFullActiveCaretakerId = 'deleted';
  assert.equal(c.petFullActiveCaretaker(), null);
});

test('Shen resumes the saved route and keeps active story cursor', () => {
  const { context:c, store } = harness();
  let renders = 0;
  c.renderPetHouse = () => { renders++; };
  store.trial = { testSpecies:'rabbit', activeStory:{ id:'M03', index:7 } };
  assert.equal(c.resumePetSpecialCompanion(), true);
  assert.equal(c.petRuntimeMode, 'test');
  assert.equal(store.trial.activeStory.index, 7);
  store.pets = { caretakers:[{ id:'shen', name:'沈栖白', pets:[{ id:'s1', state:{ activeStory:{ id:'M02', index:4 } } }] }] };
  store.test_petLastSpecialRoute = 'full';
  assert.equal(c.resumePetSpecialCompanion(), true);
  assert.equal(c.petFullActiveCaretakerId, 'shen');
  assert.equal(c.petTestState().activeStory.index, 4);
  assert.equal(renders, 2);
});

test('four expression assets are 128 square with alpha, and game icon is 256 square', () => {
  for (const expression of ['neutral','smile','talk','thoughtful']) {
    const png = readFileSync(new URL('../assets/pets/portraits/shenqibai/' + expression + '.png', import.meta.url));
    assert.equal(png.readUInt32BE(16), 128);
    assert.equal(png.readUInt32BE(20), 128);
    assert.equal(png[25], 6);
  }
  const icon = readFileSync(new URL('../assets/game-icons/flappybird.png', import.meta.url));
  assert.equal(icon.readUInt32BE(16), 256);
  assert.equal(icon.readUInt32BE(20), 256);
});

test('Shen portraits appear only on his dialogue, never narration or another role', () => {
  const { context:c } = harness();
  c.petCharName = () => '沈栖白';
  const state = { activeStory:{ id:'M01', index:0 } };
  for (const speaker of ['C', 'char', '{{char}}', '沈', '沈栖白']) {
    assert.match(c.petShenPortraitUrl({ speaker, text:'你好' }, state), /portraits\/shenqibai\/\w+\.png$/);
  }
  for (const speaker of ['旁白', 'U', 'user', '{{user}}', 'P', 'pet', '宠物', '其他角色', '']) {
    assert.equal(c.petShenPortraitUrl({ speaker, text:'沈栖白笑了' }, state), '');
  }
  const line = { speaker:'C', text:'你好' };
  for (const activeStory of [null, {}, { id:'M01', prompt:true }, { id:'M01', done:true }]) {
    assert.equal(c.petShenPortraitUrl(line, { activeStory }), '');
  }
  assert.equal(c.petShenPortraitUrl(null, state), '');
  assert.equal(c.petShenPortraitUrl({ speaker:'C', text:'' }, state), '');
  c.petCharName = () => 'Beta';
  assert.equal(c.petShenPortraitUrl(line, state), '');
  assert.equal(c.petShenPortraitUrl({ speaker:'沈栖白', text:'你好' }, state), '');
});

test('Shen randomly selects all four portraits per line and keeps pagination stable', () => {
  const { context:c } = harness();
  c.petCharName = () => '沈栖白';
  let draws = 0;
  c.Math = { random:() => (draws++ + 0.5) / 4, floor:Math.floor };
  const state = { activeStory:{ id:'M01', index:0 } };
  for (const [index, expression] of ['neutral', 'smile', 'talk', 'thoughtful'].entries()) {
    state.activeStory.index = index;
    const url = c.petShenPortraitUrl({ speaker:'C', text:'同一句台词' }, state);
    assert.ok(url.endsWith('/' + expression + '.png'));
    state.activeStory.page = 1;
    assert.equal(c.petShenPortraitUrl({ speaker:'C', text:'台词的下一页' }, structuredClone(state)), url);
  }
  assert.equal(draws, 4);
  assert.match(functionSource('renderPetHouseLoaded'), /const shenPortraitUrl = petShenPortraitUrl\(activeLine, state\)/);
  assert.match(functionSource('renderPetHouseLoaded'), /\(shenPortraitUrl \? '<img class="wb-pet-npc-portrait"/);
});

test('actual pet generation requests use only the selected role, for streaming and plain calls', async () => {
  for (const name of ['Beta', '沈栖白']) {
    for (const streaming of [false, true]) {
      const { context:c, store } = harness();
      store.presets[0].selectedWorldEntries = [{ content:'BETA_WORLD' }];
      Object.assign(c, {
        apiFieldsFromPresetIndex:() => ({ apiUrl:'test', apiKey:'shared', apiModel:'test' }),
        petAssetText:async path => path === 'shenqibai_special.txt' ? 'SHEN_CARD'
          : path === 'world.txt' ? 'PET_WORLD' : path,
        petFullAdoptionCycle:() => 1,
        petGenerationDiversityHintText:() => 'palette',
        petSpeciesColorRuleText:() => 'sprites',
        todayKey:() => '2026-09-09',
        specialLanguageRequirement:() => '',
      });
      vm.runInContext(functionSource('generatePetFullInfo'), c);
      let sent;
      const intercept = async (cfg, prompt) => { sent = { cfg, prompt }; throw new Error('intercepted'); };
      c.callApiText = intercept;
      c.callApiTextStream = intercept;
      const caretaker = { name, userName:'SavedUser', charDescriptionSnapshot:name === '沈栖白' ? 'SHEN_CARD' : '' };
      await assert.rejects(c.generatePetFullInfo(caretaker, { user_name:'FormUser', adoption_cycle:1 }, streaming ? () => {} : null), /intercepted/);
      assert.ok(!JSON.stringify(sent).includes('ALPHA_ONLY'));
      assert.ok(sent.prompt.includes(name === 'Beta' ? 'BETA_WORLD' : 'SHEN_CARD'));
      assert.ok(sent.prompt.includes('FormUser'));
      assert.equal(sent.cfg.userName, 'FormUser');
      if (name === '沈栖白') assert.ok(!JSON.stringify(sent).includes('BETA_'));
    }
  }
});

test('API serialization includes role-owned user, card and worldbook, without shared-role fields', async () => {
  const { context:c, store } = harness();
  store.presets[0].selectedWorldEntries = [{ content:'BETA_WORLD' }];
  store.presets[0].userName = 'BetaUser';
  let sent;
  Object.assign(c, {
    apiChatUrl:() => 'https://example.invalid',
    fetchWithTimeout:async (url, options) => {
      sent = JSON.parse(options.body);
      return { ok:true, json:async () => ({ choices:[{ message:{ content:'ok' } }] }) };
    },
    fillApiDebugMeta:() => {},
    stripJsonFence:text => text,
  });
  vm.runInContext(['roleGenerationInput','callApiText'].map(functionSource).join('\n'), c);
  assert.equal(await c.callApiText(c.rolePromptConfig('Beta'), 'TASK', 'SYSTEM'), 'ok');
  const input = sent.messages[1].content;
  for (const marker of ['BetaUser','BETA_USER','BETA_CARD','BETA_PERSONALITY','BETA_WORLD','TASK']) assert.ok(input.includes(marker), marker);
  assert.ok(!input.includes('ALPHA_ONLY'));
  assert.equal(sent.messages[0].content, 'SYSTEM');
});

test('worldbook discovery excludes global books and other characters extra books', () => {
  const { context:c, host } = harness();
  host.characters[0].data.extensions = { world:'ALPHA_BOOK' };
  host.worldInfoSettings = { globalSelect:['UNRELATED_GLOBAL'], charLore:[
    { name:'alpha', extraBooks:['ALPHA_EXTRA'] },
    { name:'beta', extraBooks:['BETA_EXTRA'] },
  ] };
  Object.assign(c, { getMountedWorldNamesFromDom:() => [], window:{} });
  vm.runInContext(['normalizeWorldNames','addWorldName','getCurrentWorldBookNames'].map(functionSource).join('\n'), c);
  assert.deepEqual(Array.from(c.getCurrentWorldBookNames()), ['ALPHA_BOOK','ALPHA_EXTRA']);
});

test('Shen growth cheat requires this journey opt-in and is unavailable to other caretakers', () => {
  const { context:c } = harness();
  c.petCharName = () => '沈栖白';
  vm.runInContext(functionSource('petCheatEnabled'), c);
  assert.equal(c.petCheatEnabled({}), false);
  assert.equal(c.petCheatEnabled({ cheatMode:false }), false);
  assert.equal(c.petCheatEnabled({ cheatMode:true }), true);
  c.petCharName = () => 'Beta';
  assert.equal(c.petCheatEnabled({ cheatMode:true }), false);
});

test('restart bypasses auto-resume and offers both story modes', () => {
  const { context:c } = harness();
  const nodes = {};
  let mask;
  let resumes = 0;
  Object.assign(c, {
    resumePetSpecialCompanion:() => { resumes++; return true; },
    injectPetArcadeStyle:() => {},
    getHostDocument:() => ({ createElement:() => (mask = { remove() {} }) }),
    modalMaskClass:() => 'modal', appendModalMask:() => {},
    esc:text => String(text),
    qs:(selector, parent) => parent === mask ? (nodes[selector] ||= {}) : null,
  });
  vm.runInContext(functionSource('openPetSpecialCompanionChoice'), c);
  c.openPetSpecialCompanionChoice({ forceNew:true });
  assert.equal(resumes, 0);
  assert.ok(mask.innerHTML.includes('wb-pet-special-local'));
  assert.ok(mask.innerHTML.includes('wb-pet-special-generate'));
  c.openPetSpecialCompanionChoice();
  assert.equal(resumes, 1);
});

test('new journey prompts for cheat choice while a saved journey resumes without prompting', () => {
  const { context:c } = harness();
  let prompts = 0;
  c.openPetCheatModeChoice = () => { prompts++; };
  vm.runInContext(['openPetTestSelect','openPetAdoptionForm'].map(functionSource).join('\n'), c);
  c.openPetTestSelect();
  c.openPetAdoptionForm({ name:'沈栖白' });
  assert.equal(prompts, 2);
});

test('generated Shen caretaker has its own entry distinct from default story entry', () => {
  const { context:c, store } = harness();
  store.pets = { caretakers:[{ id:'generated-shen', name:'沈栖白', pets:[{ id:'s1', infoText:'generated', state:{} }] }] };
  let mask;
  Object.assign(c, {
    injectPetArcadeStyle:() => {}, petFullIsActive:() => true,
    getHostDocument:() => ({ createElement:() => (mask = {}) }),
    PET_SPECIES_LABELS:{}, PET_SPECIAL_CHAR_NAME:'沈栖白',
    petDisplayName:() => 'pet', petFullCompletedCount:() => 0,
    petFullPetCompleted:() => false, parsePetInfoText:() => ({}),
    petSnapshotHTMLForInfo:() => '', petUiIcon:() => '',
    modalMaskClass:() => 'modal', appendModalMask:() => {},
    qs:() => ({}), qsa:() => [], esc:text => String(text),
  });
  vm.runInContext(functionSource('openPetCaretakerSelect'), c);
  c.openPetCaretakerSelect(null, { forceFull:true });
  assert.ok(mask.innerHTML.includes('data-id="generated-shen"'));
  assert.ok(mask.innerHTML.includes('自由剧情'));
  assert.ok(mask.innerHTML.includes('默认剧情'));
  assert.ok(mask.innerHTML.includes('wb-pet-trial-caretaker'));
});

test('late fixed-story writes cannot overwrite a restarted journey', () => {
  const { context:c, store } = harness();
  c.petRuntimeMode = 'test';
  store.trial = { journeyId:'old', logs:{} };
  const target = c.petStorageTarget();
  store.trial = { journeyId:'new', logs:{} };
  c.updatePetTargetState(target, state => ({ ...state, logs:{ leaked:true } }));
  assert.deepEqual(store.trial.logs, {});
});

test('current runtime parses all 11 fixed pet files, summaries, branches and quotes', () => {
  const c = vm.createContext({});
  vm.runInContext(['cleanPetInfoText','parsePetInfoValue','stripPetQuote','parsePetStoryLines',
    'parsePetFields','parsePetTrigger','normalizePetStory','parsePetInfoText'].map(functionSource).join('\n'), c);
  for (const species of ['rabbit','dog','cat','bird','bala','fox','otter','hedgehog','redpanda','alpaca','sikadeer']) {
    const raw = readFileSync(new URL('../assets/pets/text/pet_info_' + species + '.txt', import.meta.url), 'utf8');
    const info = c.parsePetInfoText(raw);
    assert.equal(info.main_story.length, 15, species);
    assert.equal(info.side_story.length, 6, species);
    assert.ok(info.mainById.M01.summary, species);
    assert.ok(info.mainById.M01.lines.length, species);
    for (const id of ['M14','M15']) {
      for (const route of ['spirit','ordinary']) assert.ok(info.mainById[id].variants[route].lines.length, species + id + route);
    }
    assert.ok(Object.keys(info.quotes.char).length, species);
    assert.ok(Object.keys(info.quotes.pet).length, species);
  }
});

test('streaming API request includes the same isolated role input', async () => {
  const { context:c } = harness();
  let sent;
  Object.assign(c, {
    apiChatUrl:() => 'https://example.invalid', stripJsonFence:text => text,
    fetch:async (url, options) => {
      sent = JSON.parse(options.body);
      return { ok:true, json:async () => ({ choices:[{ message:{ content:'stream-result' } }] }) };
    },
  });
  vm.runInContext(['roleGenerationInput','callApiTextStream'].map(functionSource).join('\n'), c);
  let delta = '';
  assert.equal(await c.callApiTextStream(c.rolePromptConfig('Beta'), 'TASK', 'SYSTEM', 100, text => { delta += text; }), 'stream-result');
  assert.equal(delta, 'stream-result');
  assert.equal(sent.stream, true);
  assert.ok(sent.messages[1].content.includes('BETA_CARD'));
  assert.ok(!sent.messages[1].content.includes('ALPHA_ONLY'));
});

test('saving another preset cannot overwrite an independently edited role snapshot', () => {
  const { context:c, store } = harness();
  c.saveRoleContext(isolatedRole({ userPersona:'BETA_NEW' }, 'Beta'));
  vm.runInContext(functionSource('saveWorldPresets'), c);
  c.saveWorldPresets([{ name:'Gamma', charName:'Gamma' }, ...store.presets]);
  assert.equal(c.rolePromptConfig('Beta').userPersona, 'BETA_NEW');
});

test('an active round retains its role snapshot and rejects mid-round role switches', async () => {
  const { context:c } = harness();
  c.gameStarted = true;
  c.currentRoundRoleContext = isolatedRole({ userPersona:'ROUND_USER' }, 'Beta');
  assert.equal(c.rolePromptConfig('Beta').userPersona, 'ROUND_USER');
  let restored = false;
  c.renderLinePresetSelect = () => { restored = true; };
  await c.applyLinePresetSelection('snake', 'line::Alpha');
  assert.equal(restored, true);
  assert.equal(c.selection, undefined);
});

test('late desktop replies are not displayed on a different pet', async () => {
  const { context:c, store } = harness();
  c.petRuntimeMode = 'test';
  store.trial = { journeyId:'one' };
  const el = { dataset:{}, isConnected:true };
  const shown = [];
  let finish;
  c.petDesktopSetChat = (node, text) => shown.push(text);
  c.generatePetDesktopChat = () => new Promise(resolve => { finish = resolve; });
  vm.runInContext(functionSource('refreshPetDesktopChat'), c);
  const request = c.refreshPetDesktopChat(el, 'chat', 'hello');
  store.trial = { journeyId:'two' };
  finish('OLD_REPLY');
  await request;
  assert.ok(!shown.includes('OLD_REPLY'));
});
