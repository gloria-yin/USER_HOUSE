export const ROLE_DEFAULTS = {
  charName:'', avatarUrl:'', defaultAvatarUrl:'', characterAvatar:'',
  charDescriptionSnapshot:'', characterCardSnapshot:null,
  charDescMode:'auto', manualCharPersona:'', charPersona:'',
  userName:'{{user}}', userPersona:'', userDescSource:'manual',
  userDescriptionSnapshot:'', chatSnapshot:'',
  injectUserDesc:true, injectCharDesc:true, injectChat:false,
  selectedWorldEntries:[], selectedWorldKeys:[], selectedWorldPresetName:'',
  worldText:'', worldView:'', summaryId:'', summarySnapshot:null,
  specialLanguageEnabled:false, specialLanguage:'', intimacyMode:false,
  breakLimitPrompt:'', lazyWorldInject:false, worldAutoMountMode:'',
  builtinPetCaretaker:'', roleContextVersion:2,
};

export function isolatedRole(source = {}, name = '') {
  const role = {};
  for (const [key, fallback] of Object.entries(ROLE_DEFAULTS)) {
    role[key] = source[key] === undefined ? fallback : source[key];
  }
  role.charName = name || source.charName || source.name || '';
  role.roleContextVersion = 2;
  return JSON.parse(JSON.stringify(role));
}

export function withRoleContext(shared, role) {
  // Empty role fields are intentional; never inherit another role's defaults.
  return Object.assign({}, shared, isolatedRole(role));
}

export function characterCardText(character) {
  const data = character?.data || character || {};
  return ['name', 'description', 'personality', 'scenario', 'first_mes',
    'mes_example', 'system_prompt', 'post_history_instructions',
    'alternate_greetings', 'character_book', 'extensions', 'creator_notes']
    .filter(key => data[key] !== undefined && data[key] !== '')
    .map(key => key + ': ' + (typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key])))
    .join('\n\n');
}
