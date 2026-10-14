import assert from 'node:assert/strict';
import test from 'node:test';

import { isolatedRole, withRoleContext } from '../src/runtime/role-context.js';

test('large role snapshots clone structure without serializing worldbook text', () => {
  const content = '大型世界书正文'.repeat(120000);
  const source = {
    roleKey:'large-role',
    charName:'应忱',
    characterCardSnapshot:{ name:'应忱', description:'角色描述', extensions:{ depth_prompt:{ prompt:'深度提示' } } },
    selectedWorldEntries:Array.from({ length:48 }, (_, index) => ({
      label:'条目 ' + index,
      content,
      wbName:'角色内嵌',
      uid:'entry-' + index,
    })),
  };
  const nativeStringify = JSON.stringify;
  let stringifyCalls = 0;
  JSON.stringify = (...args) => { stringifyCalls += 1; return nativeStringify(...args); };
  let snapshot;
  try {
    snapshot = isolatedRole(source);
  } finally {
    JSON.stringify = nativeStringify;
  }

  assert.equal(stringifyCalls, 0, 'isolating a role must not stringify large worldbook content');
  assert.notEqual(snapshot, source);
  assert.notEqual(snapshot.selectedWorldEntries, source.selectedWorldEntries);
  assert.notEqual(snapshot.selectedWorldEntries[0], source.selectedWorldEntries[0]);
  assert.equal(snapshot.selectedWorldEntries[0].content, content);
  snapshot.selectedWorldEntries[0].label = '已修改';
  assert.equal(source.selectedWorldEntries[0].label, '条目 0');
});

test('merging a role keeps shared settings untouched', () => {
  const shared = { theme:'day', selectedWorldEntries:[{ content:'shared' }] };
  const role = { charName:'应忱', selectedWorldEntries:[{ content:'role' }] };
  const merged = withRoleContext(shared, role);

  assert.equal(merged.theme, 'day');
  assert.equal(merged.charName, '应忱');
  assert.equal(merged.selectedWorldEntries[0].content, 'role');
  merged.selectedWorldEntries[0].content = 'changed';
  assert.equal(role.selectedWorldEntries[0].content, 'role');
  assert.equal(shared.selectedWorldEntries[0].content, 'shared');
});
