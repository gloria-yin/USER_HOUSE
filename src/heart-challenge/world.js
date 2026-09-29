const string = value => typeof value === 'string' ? value.trim() : '';

export function normalizeHeartWorld(source = {}) {
  const cfg = source.injection || {};
  const legacyView = string(source.view);
  const marker = /【(?:世界角色资料|当前角色卡资料)】\s*/.exec(legacyView);
  const character = source.character || {};
  const description = string(character.description) || (marker ? legacyView.slice(marker.index + marker[0].length) : '');
  return {
    background:string(source.background), view:marker ? legacyView.slice(0, marker.index).trim() : legacyView,
    user:{ id:'USER', name:string(source.user?.name) || '你', persona:string(source.user?.persona), avatar:string(source.user?.avatar),
      avatarMode:['auto', 'current', 'tavern', 'emoji', 'url'].includes(source.user?.avatarMode) ? source.user.avatarMode : 'current' },
    character:{ name:string(character.name), description, manualDescription:string(character.manualDescription), cardId:string(character.cardId), avatar:string(character.avatar) },
    injection:{
      lazyWorldInject:cfg.lazyWorldInject === true,
      injectUserDesc:cfg.injectUserDesc !== false, userDescSource:cfg.userDescSource === 'auto' ? 'auto' : 'manual',
      injectCharDesc:cfg.injectCharDesc !== false, charDescMode:cfg.charDescMode === 'manual' ? 'manual' : 'auto',
      specialLanguageEnabled:cfg.specialLanguageEnabled === undefined ? !!source.language : cfg.specialLanguageEnabled === true,
      injectChat:cfg.injectChat === undefined ? !!source.chat : cfg.injectChat === true,
      worldAutoMountMode:['blue', 'bluegreen'].includes(cfg.worldAutoMountMode) ? cfg.worldAutoMountMode : '',
    },
    entries:(Array.isArray(source.entries) ? source.entries : []).map(e => ({
      label:string(e.label), content:string(e.content), wbName:string(e.wbName), uid:String(e.uid ?? ''), enabled:e.enabled !== false,
    })),
    summary:string(source.summary), chat:string(source.chat), language:string(source.language), languageInstruction:string(source.languageInstruction),
    breakLimitPrompt:string(source.breakLimitPrompt), supplemental:string(source.supplemental), sourceName:string(source.sourceName),
    sourceId:string(source.sourceId), sourceKind:source.sourceKind === 'current-card' ? 'current-card' : 'existing-world',
    capturedAt:source.capturedAt || Date.now(),
  };
}

// Map the same injection controls used by the host settings, without API credentials.
export function heartWorldFromRole(cfg, { user = {}, characterDescription = '', characterAvatar = '', summary = '', chat, languageInstruction = '', id = '', name = '', kind = 'existing-world' } = {}) {
  return normalizeHeartWorld({
    background:cfg.worldText || '', view:cfg.worldView || '',
    user:{ ...user, name:cfg.userName && cfg.userName !== '{{user}}' ? cfg.userName : user.name,
      persona:cfg.userDescriptionSnapshot || cfg.userPersona || user.persona || '' },
    character:{ name:cfg.charName, cardId:cfg.cardId, avatar:characterAvatar,
      description:characterDescription || cfg.charDescriptionSnapshot || '', manualDescription:cfg.manualCharPersona || '' },
    injection:cfg, entries:cfg.selectedWorldEntries || [], summary,
    chat:chat === undefined ? cfg.chatSnapshot || '' : chat,
    language:cfg.specialLanguage || '', languageInstruction, breakLimitPrompt:cfg.breakLimitPrompt || '',
    sourceName:name, sourceId:id, sourceKind:kind,
  });
}

export function heartWorldForPrompt(source) {
  const w = normalizeHeartWorld(source), cfg = w.injection;
  return {
    background:w.background, view:w.view, injection:cfg,
    user:{ id:'USER', name:w.user.name, persona:cfg.injectUserDesc ? w.user.persona : '' },
    character:{ name:w.character.name, description:cfg.injectCharDesc
      ? (cfg.charDescMode === 'manual' ? w.character.manualDescription : w.character.description) : '' },
    entries:w.entries.filter(e => e.enabled).map(({ enabled, ...entry }) => entry),
    chat:cfg.injectChat ? w.chat : '', language:cfg.specialLanguageEnabled ? w.language : '',
    languageInstruction:cfg.specialLanguageEnabled ? w.languageInstruction : '',
    breakLimitPrompt:w.breakLimitPrompt, summary:w.summary, supplemental:w.supplemental,
  };
}
