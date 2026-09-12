const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../miniprogram/utils/backup-core');
const reminder = id => ({ id, title: '合成测试任务', role: '店长', enabled: false, schedule: { type: 'daily', time: '09:00' }, completedHistory: [] });
test('backup round trip retains explicit zero and missing fields', () => {
  const records = { 'hugetools.operations-workbench.v1': { meetings: [{ id: 'synthetic-meeting', title: '合成测试', score: 0 }], logs: [], resources: [], training: [] } };
  const backup = core.create('web', records, [reminder('synthetic-test-task')]);
  assert.deepEqual(core.parse(JSON.stringify(backup), 'web'), backup);
  assert.equal(core.summary(backup).length, 2);
});
test('restore rejects cross platform and unknown data without mutating source', () => {
  const value = core.create('wechat', { 'hugetools.operations.v1': { meetingRecords: [] } });
  assert.throws(() => core.validate(value, 'web'), /同一端/);
  value.records['unrelated-key'] = {};
  assert.throws(() => core.validate(value, 'wechat'), /未知模块/);
});
test('restore rejects corrupted collections, duplicate tasks and unsafe fields', () => {
  assert.throws(() => core.create('web', {'hugetools.operations-workbench.v1':{meetings:{}}}, []), /列表格式/);
  assert.throws(() => core.create('web', {}, [reminder('a'), reminder('a')]), /重复/);
  const value = '{"format":"hugetools-local-backup","schemaVersion":1,"platform":"web","records":{"hugetools.operations-workbench.v1":{"__proto__":{}}}}';
  assert.throws(() => core.parse(value, 'web'), /不支持/);
  assert.throws(() => core.parse('not-json', 'web'), /无法读取/);
});
test('restore rejects empty modules and placeholder records across legacy modules', () => {
  for (const [platform, key, entry] of [
    ['web', 'hugetools.operations-workbench.v1', {}],
    ['wechat', 'hugetools.operations.v1', { meetingRecords: [{}] }],
    ['web', 'hugetools.incentiveSystem.v1', {}],
    ['web', 'hugetools.incentiveSystem.v1', { employees: [{}], tasks: [], records: [] }],
    ['web', 'hugetools.revenue.v1', {}],
    ['wechat', 'hugetools.revenue.v1', { fileName: '合成测试' }]
  ]) assert.throws(() => core.create(platform, { [key]: entry }));
});
test('revenue keeps both platform schemas and rejects cross-schema field names', () => {
  const web = { revenueFileName: '', storeMasterText: '', storeRevenueText: '', storeBudgetText: '', dishSalesText: '', revenueMonthFilter: '2026-09' };
  const mini = { fileName: '', storeMasterText: '', revenueText: '', budgetText: '', dishText: '' };
  assert.equal(core.create('web', { 'hugetools.revenue.v1': web }).records['hugetools.revenue.v1'].revenueMonthFilter, '2026-09');
  assert.doesNotThrow(() => core.create('wechat', { 'hugetools.revenue.v1': mini }));
  assert.throws(() => core.create('wechat', { 'hugetools.revenue.v1': web }), /字段/);
});
test('raw web snapshot preserves malformed strings exactly and cannot restore as normal backup', () => {
  const key = 'hugetools.operations-center.v1';
  const raw = '  {"broken":\n"未闭合内容"  ';
  const snapshot = core.createRaw('web', { [key]: raw }, []);
  const reloaded = JSON.parse(JSON.stringify(snapshot));
  assert.equal(core.decodeRaw(core.validateRaw(reloaded, 'web').rawRecords[key]), raw);
  assert.throws(() => core.parse(JSON.stringify(snapshot), 'web'), /原始诊断副本/);
});
test('raw WeChat object encoding preserves undefined, null, zero, NaN, dates and exact strings', () => {
  const raw = { content: '{bad JSON', empty: '', nothing: null, missing: undefined, zero: 0, minusZero: -0, nan: NaN, positive: Infinity, date: new Date('2026-09-12T00:00:00Z'), list: [undefined, '中文', 0] };
  const snapshot = core.createRaw('wechat', { 'hugetools.operations.v1': raw });
  const reloaded = core.validateRaw(JSON.parse(JSON.stringify(snapshot)), 'wechat');
  assert.deepEqual(core.decodeRaw(reloaded.rawRecords['hugetools.operations.v1']), raw);
  assert.throws(() => core.validate(snapshot, 'wechat'), /不能直接恢复/);
});
