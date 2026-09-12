const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../miniprogram/utils/backup-core');
const normalize = value => JSON.parse(JSON.stringify(value));
const meeting = id => ({ id, title: '合成测试会议', date: '2026-09-12' });
const revenue = fileName => ({ fileName, storeMasterText: '', revenueText: '', budgetText: '', dishText: '' });
function pageFixture(initial, failKey) {
  const storage = new Map(Object.entries(initial));
  const files = new Map();
  let page;
  let failed = false;
  const wx = {
    env: { USER_DATA_PATH: '/synthetic-test' },
    getStorageInfoSync: () => ({ keys: Array.from(storage.keys()) }),
    getFileSystemManager: () => ({ writeFileSync: (file, contents) => files.set(file, contents) }),
    getStorageSync: key => storage.has(key) ? structuredClone(storage.get(key)) : '',
    setStorageSync: (key, value) => {
      if (key === failKey && !failed) { failed = true; throw new Error('synthetic quota failure'); }
      storage.set(key, structuredClone(value));
    },
    removeStorageSync: key => storage.delete(key)
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/data-backup/data-backup.js'), 'utf8'), { require: () => core, Page: value => { page = value; }, wx });
  page.data = structuredClone(page.data);
  page.setData = values => Object.assign(page.data, values);
  return { page, storage, files };
}
test('WeChat restore preserves untouched modules and keeps recovery checkpoint', () => {
  const key = 'hugetools.operations.v1';
  const old = { meetingRecords: [meeting('synthetic-old')] };
  const next = { meetingRecords: [meeting('synthetic-new')] };
  const { page, storage } = pageFixture({ [key]: old, unrelated: {keep:true} });
  page.prepare(JSON.stringify(core.create('wechat', { [key]: next })));
  assert.equal(page.data.canRestore, true);
  page.applyBackup();
  assert.deepEqual(storage.get(key), next);
  assert.deepEqual(core.decodeRaw(storage.get('hugetools.backup.recovery.v1').rawRecords[key]), old);
  assert.deepEqual(storage.get('unrelated'), {keep:true});
  assert.match(page.data.status, /恢复已完成/);
});
test('WeChat partial write failure rolls back previously written module', () => {
  const first = 'hugetools.operations.v1', second = 'hugetools.revenue.v1';
  const old = { meetingRecords: [meeting('synthetic-old')] };
  const { page, storage } = pageFixture({[first]:old,[second]:revenue('old')}, second);
  page.prepare(JSON.stringify(core.create('wechat',{[first]:{meetingRecords:[]},[second]:revenue('new')})));
  page.applyBackup();
  assert.deepEqual(storage.get(first),old);
  assert.deepEqual(storage.get(second),revenue('old'));
  assert.match(page.data.status,/恢复未完成/);
});
test('WeChat checkpoint failure does not change original records', () => {
  const key='hugetools.operations.v1';
  const old={meetingRecords:[meeting('synthetic-old')]};
  const {page,storage}=pageFixture({[key]:old},'hugetools.backup.recovery.v1');
  page.prepare(JSON.stringify(core.create('wechat',{[key]:{meetingRecords:[]}})));
  page.applyBackup();
  assert.deepEqual(storage.get(key),old);
  assert.match(page.data.status,/恢复未完成/);
});
test('WeChat backup accepts dish tracking JSON-string storage and preserves confirmed source', () => {
  const dishes = require('../miniprogram/utils/dish-tracking-core');
  const state = dishes.commitImport(dishes.emptyState(), '门店,日期,菜品,销量,销售额\n合成店,2026-09-10,合成菜,0,0', '合成测试来源', 'reject');
  const { page } = pageFixture({ [dishes.KEY]: JSON.stringify(state) });
  const backup = page.collect();
  assert.deepEqual(normalize(backup.records[dishes.KEY]), normalize(state));
  assert.deepEqual(core.parse(JSON.stringify(backup), 'wechat').records[dishes.KEY], state);
});
test('WeChat valid backup repairs malformed current storage while preserving exact raw original', () => {
  const key = 'hugetools.operations.v1';
  const old = '  {损坏原文\n';
  const { page, storage, files } = pageFixture({ [key]: old });
  page.exportBackup();
  assert.match(page.data.status, /原始诊断副本/);
  const diagnosis = JSON.parse(files.get(page.data.filePath));
  assert.equal(core.decodeRaw(diagnosis.rawRecords[key]), old);
  page.prepare(JSON.stringify(core.create('wechat', { [key]: { meetingRecords: [meeting('replacement')] } })));
  page.applyBackup();
  assert.equal(storage.get(key).meetingRecords[0].id, 'replacement');
  assert.equal(core.decodeRaw(storage.get('hugetools.backup.recovery.v1').rawRecords[key]), old);
  assert.match(page.data.status, /恢复已完成并读回核对/);
  page.exportRecovery();
  assert.match(page.data.fileName, /不能直接恢复/);
  assert.equal(core.decodeRaw(JSON.parse(files.get(page.data.filePath)).rawRecords[key]), old);
});
test('WeChat failure restores malformed objects and keeps intentionally stored empty strings', () => {
  const first = 'hugetools.operations.v1', second = 'hugetools.revenue.v1';
  const old = { meetingRecords: [{ unknown: undefined }], score: NaN };
  const { page, storage } = pageFixture({ [first]: old, [second]: '' }, second);
  page.prepare(JSON.stringify(core.create('wechat', { [first]: { meetingRecords: [] }, [second]: revenue('new') })));
  page.applyBackup();
  assert.deepEqual(storage.get(first), old);
  assert.equal(storage.has(second), true);
  assert.equal(storage.get(second), '');
  assert.match(page.data.status, /恢复未完成/);
});
test('WeChat raw diagnostic cannot enable restore and does not modify records', () => {
  const key = 'hugetools.operations.v1';
  const { page, storage } = pageFixture({ [key]: 'broken' });
  page.prepare(JSON.stringify(core.createRaw('wechat', { [key]: 'broken' })));
  assert.equal(page.data.canRestore, false);
  page.applyBackup();
  assert.equal(storage.get(key), 'broken');
  assert.match(page.data.status, /不能直接恢复/);
});

function webFixture(initial, failKey) {
  const storage = new Map(Object.entries(initial));
  const nodes = new Map();
  const downloads = [];
  let reloads = 0;
  let failed = false;
  const node = id => { if (!nodes.has(id)) nodes.set(id, { handlers: {}, addEventListener(name, callback) { this.handlers[name] = callback; }, textContent: '', disabled: false }); return nodes.get(id); };
  const document = { readyState: 'complete', getElementById: node, body: { appendChild() {} }, createElement: () => ({ click() {}, remove() {} }) };
  const localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => { if (key === failKey && !failed) { failed = true; throw new Error('synthetic quota failure'); } storage.set(key, value); },
    removeItem: key => storage.delete(key)
  };
  const window = { HugeBackupCore: core, HugeToolsTaskStorage: { listTasks: async () => [], replaceAll: async () => {} }, confirm: () => true };
  vm.runInNewContext(fs.readFileSync(require.resolve('../data-backup.js'), 'utf8'), { window, document, localStorage, Blob, URL: { createObjectURL: blob => { downloads.push(blob); return 'blob:synthetic'; }, revokeObjectURL() {} }, setTimeout: () => {}, location: { reload: () => { reloads++; } } });
  return { storage, downloads, node, reloads: () => reloads, review: async value => node('backupFile').handlers.change({ target: { files: [{ size: 1, text: async () => JSON.stringify(value) }] } }), restore: () => node('restoreBackupBtn').handlers.click() };
}
test('Web repair stores the original malformed localStorage string and verifies restored value', async () => {
  const key = 'hugetools.operations-workbench.v1';
  const original = ' {"broken":"原始\\n内容"';
  const page = webFixture({ [key]: original });
  await page.node('exportBackupBtn').handlers.click();
  const raw = JSON.parse(await page.downloads[0].text());
  assert.equal(core.decodeRaw(raw.rawRecords[key]), original);
  const next = { meetings: [meeting('replacement')], logs: [], resources: [], training: [] };
  await page.review(core.create('web', { [key]: next }));
  await page.restore();
  assert.deepEqual(JSON.parse(page.storage.get(key)), next);
  assert.equal(core.decodeRaw(JSON.parse(page.storage.get('hugetools.backup.recovery.v1')).rawRecords[key]), original);
  assert.equal(page.reloads(), 1);
});
test('Web partial failure rolls back exact malformed strings and never signals reload success', async () => {
  const first = 'hugetools.operations-workbench.v1', second = 'hugetools.taskReminder.settings';
  const original = 'not JSON\n原始内容';
  const page = webFixture({ [first]: original, [second]: '{bad' }, second);
  await page.review(core.create('web', { [first]: { meetings: [] }, [second]: { roleFilter: '', viewFilter: 'all' } }));
  await page.restore();
  assert.equal(page.storage.get(first), original);
  assert.equal(page.storage.get(second), '{bad');
  assert.equal(page.reloads(), 0);
  assert.match(page.node('backupStatus').textContent, /恢复未完成/);
});
