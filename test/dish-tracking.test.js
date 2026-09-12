const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../miniprogram/utils/dish-tracking-core');
const csv = rows => C.HEADER + '\n' + rows.join('\n');
function imported(rows, state = C.emptyState(), source = '自动化测试来源') { return C.commitImport(state, csv(rows), source, 'reject'); }
function configured(state, patch, group = 'new') { return C.updateConfig(state, group, Object.assign({ dishes: ['测试菜甲'], stores: ['测试店甲'], startDate: '2026-09-03', endDate: '2026-09-04', mode: 'fixed' }, patch)); }

test('missing records remain null while explicitly recorded zero is retained', () => {
  let state = imported(['测试店甲,2026-09-03,测试菜甲,0,0']);
  state = configured(state, {});
  const dish = C.analyze(state, 'new').dishes[0];
  assert.equal(dish.current.days[0].quantity, 0);
  assert.equal(dish.current.days[1].quantity, null);
  assert.equal(dish.current.quantity, 0);
  assert.equal(dish.current.recorded, 1);
  assert.equal(dish.current.expected, 2);
  assert.equal(dish.quantityChange, null);
});
test('all missing selected-period records produce missing totals, never fake zero', () => {
  let state = imported(['测试店甲,2026-09-01,测试菜甲,1,8']);
  state = configured(state, {});
  const dish = C.analyze(state, 'new').dishes[0];
  assert.equal(dish.current.quantity, null);
  assert.equal(dish.current.revenue, null);
  assert.equal(dish.current.complete, false);
});
test('new and regular dish selections and store periods are independent', () => {
  let state = imported(['测试店甲,2026-09-03,测试菜甲,1,10', '测试店乙,2026-09-04,测试菜乙,3,30']);
  state = configured(state, {});
  const before = JSON.stringify(state.configs.new);
  state = configured(state, { dishes: ['测试菜乙'], stores: ['测试店乙'], startDate: '2026-09-04', mode: 'ongoing' }, 'regular');
  assert.equal(JSON.stringify(state.configs.new), before);
  assert.deepEqual(state.configs.regular.stores, ['测试店乙']);
  assert.equal(C.analyze(state, 'regular').dishes[0].dish, '测试菜乙');
  assert.equal(C.analyze(state, 'new').dishes[0].dish, '测试菜甲');
});
test('ongoing cutoff uses latest confirmed fact of selected stores, not today or other stores', () => {
  let state = imported(['测试店甲,2026-09-03,测试菜甲,1,10', '测试店甲,2026-09-05,测试菜乙,2,20', '测试店乙,2026-09-09,测试菜甲,3,30']);
  state = configured(state, { mode: 'ongoing', endDate: '2026-09-30' });
  const result = C.analyze(state, 'new');
  assert.equal(result.endDate, '2026-09-05');
  assert.equal(result.dishes[0].current.expected, 3);
  assert.equal(result.dishes[0].current.days[2].quantity, null);
  assert.equal(state.configs.new.endDate, '2026-09-30');
});
test('complete consecutive equal periods over identical stores produce precise changes', () => {
  let state = imported(['测试店甲,2026-09-01,测试菜甲,2,20', '测试店甲,2026-09-02,测试菜甲,2,20', '测试店甲,2026-09-03,测试菜甲,3,30', '测试店甲,2026-09-04,测试菜甲,3,30']);
  state = configured(state, {});
  const result = C.analyze(state, 'new'), dish = result.dishes[0];
  assert.equal(result.previousStart, '2026-09-01'); assert.equal(result.previousEnd, '2026-09-02');
  assert.equal(dish.quantityChange, 0.5); assert.equal(dish.revenueChange, 0.5);
});
test('partial previous or current store coverage suppresses changes rather than shrinking denominator', () => {
  let state = imported(['测试店甲,2026-09-01,测试菜甲,1,10', '测试店甲,2026-09-02,测试菜甲,1,10', '测试店甲,2026-09-03,测试菜甲,2,20', '测试店甲,2026-09-04,测试菜甲,2,20', '测试店乙,2026-09-04,测试菜甲,8,80']);
  state = configured(state, { stores: ['测试店甲', '测试店乙'] });
  const dish = C.analyze(state, 'new').dishes[0];
  assert.equal(dish.current.quantity, 12);
  assert.equal(dish.current.recorded, 3); assert.equal(dish.current.expected, 4);
  assert.equal(dish.quantityChange, null); assert.equal(dish.revenueChange, null);
});
test('zero prior denominator leaves change blank even with complete records', () => {
  let state = imported(['测试店甲,2026-09-02,测试菜甲,0,0', '测试店甲,2026-09-03,测试菜甲,2,20']);
  state = configured(state, { endDate: '2026-09-03' });
  const dish = C.analyze(state, 'new').dishes[0];
  assert.equal(dish.current.complete, true); assert.equal(dish.previous.complete, true);
  assert.equal(dish.quantityChange, null); assert.match(dish.comparisonNote, /零/);
});
test('invalid numbers, missing numbers, invalid dates and duplicate keys block the whole import', () => {
  const text = csv(['测试店甲,2026-09-03,测试菜甲,1,10', '测试店甲,2026-09-03,测试菜甲,2,20', '测试店甲,2026-02-30,测试菜乙,,abc', '测试店甲,2026-09-05,测试菜乙,-2,0']);
  const preview = C.previewImport(text, '测试原表', C.emptyState());
  assert.ok(preview.errors.some(e => e.includes('重复')));
  assert.ok(preview.errors.some(e => e.includes('日期无效')));
  assert.ok(preview.errors.some(e => e.includes('空白不代表零')));
  assert.throws(() => C.commitImport(C.emptyState(), text, '测试原表', 'replace'));
});
test('source name and real data rows are required; unsupported denominator headers are explicit', () => {
  assert.ok(C.previewImport(csv(['测试店甲,2026-09-03,测试菜甲,1,10']), '', C.emptyState()).errors.length);
  assert.ok(C.previewImport(C.HEADER, '测试来源', C.emptyState()).errors.length);
  assert.match(C.previewImport(C.HEADER + ',订单数\n测试店甲,2026-09-03,测试菜甲,1,10,5', '测试来源', C.emptyState()).errors.join(''), /订单分母/);
});
test('cross batch collision is rejected by default and explicit replace preserves original archive', () => {
  const old = imported(['测试店甲,2026-09-03,测试菜甲,1,10']);
  const incoming = csv(['测试店甲,2026-09-03,测试菜甲,5,50']);
  assert.equal(C.previewImport(incoming, '更正来源', old).conflicts.length, 1);
  assert.throws(() => C.commitImport(old, incoming, '更正来源', 'reject'), /明确覆盖/);
  const updated = C.commitImport(old, incoming, '更正来源', 'replace');
  assert.equal(updated.records.length, 1); assert.equal(updated.records[0].quantity, 5);
  assert.equal(old.records[0].quantity, 1);
  assert.equal(updated.batches[1].rows[0].quantity, 1);
  assert.equal(updated.batches[0].replacements[0].previous.quantity, 1);
  assert.equal(updated.batches[0].replacements[0].previous.batchId, old.batches[0].id);
  assert.deepEqual(C.readState(JSON.stringify(updated)), updated);
});
test('CSV quoting, reordered headers, BOM and tab separated data are correctly parsed', () => {
  const p = C.previewImport('\uFEFF菜品\t日期\t门店\t销售额\t销量\r\n"测试,菜"\t2026-09-03\t测试店甲\t10.25\t2\r\n', '测试来源', C.emptyState());
  assert.deepEqual(p.errors, []); assert.equal(p.rows[0].dish, '测试,菜'); assert.equal(p.rows[0].revenue, 10.25);
  const comma = C.previewImport(csv(['测试店甲,2026-09-03,"测试,菜",1,10']), '测试来源', C.emptyState());
  assert.deepEqual(comma.errors, []); assert.equal(comma.rows[0].dish, '测试,菜');
  assert.ok(C.previewImport(csv(['测试店甲,2026-09-03,"测试菜,1,10']), '测试来源', C.emptyState()).errors.length);
});
test('malformed saved data and facts without matching source are rejected', () => {
  assert.throws(() => C.readState('{broken'));
  assert.throws(() => C.readState({ schemaVersion: 99 }));
  const good = imported(['测试店甲,2026-09-03,测试菜甲,1,10']);
  assert.deepEqual(C.readState(good), good);
  const broken = JSON.parse(JSON.stringify(good)); broken.records[0].quantity = 999;
  assert.throws(() => C.readState(broken), /一致/);
  const missingSource = JSON.parse(JSON.stringify(good)); missingSource.batches = [];
  assert.throws(() => C.readState(missingSource), /来源/);
});
test('reversed and excessive periods cannot silently generate an empty analysis', () => {
  const state = imported(['测试店甲,2026-09-03,测试菜甲,1,10']);
  assert.ok(C.analyze(configured(state, { startDate: '2026-09-05' }), 'new').messages.length);
  assert.ok(C.analyze(configured(state, { startDate: '2024-01-01' }), 'new').messages.length);
});
test('per-dish report names coverage and sources without turning missing data into zero', () => {
  let state = imported(['测试店甲,2026-09-03,测试菜甲,0,0']); state = configured(state, {});
  const report = C.report(state, 'new');
  assert.match(report, /2026-09-04 \| 销量 缺失/);
  assert.match(report, /店日覆盖：1\/2/);
  assert.match(report, /自动化测试来源/);
  assert.match(report, /销量变化：—/);
});

function nativePage(initial, failWrite) {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  let definition, saved = initial || '', payloadBytes = 0;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../miniprogram/pages/dish-tracking/dish-tracking.js'), 'utf8'), { require: () => C, Page: value => { definition = value; }, wx: { getStorageSync: () => saved, setStorageSync: (key, value) => { if (failWrite) throw new Error('disk full'); saved = value; } } });
  const page = Object.assign({}, definition, { data: JSON.parse(JSON.stringify(definition.data)), setData(patch) { payloadBytes = Math.max(payloadBytes, Buffer.byteLength(JSON.stringify(patch))); Object.assign(this.data, patch); } });
  page.onLoad(); return { page, saved: () => saved, payloadBytes: () => payloadBytes };
}
test('native failed storage writes leave confirmed facts untouched and keep import available', () => {
  const { page } = nativePage('', true);
  page.onSource({ detail: { value: '自动化测试来源' } });
  page.onText({ detail: { value: csv(['测试店甲,2026-09-03,测试菜甲,1,10']) } });
  page.onPreview(); page.onCommit();
  assert.equal(page._state.records.length, 0);
  assert.match(page.data.notice, /保存失败/);
  assert.ok(page.data.preview);
});
test('native multi-dish and store-day detail pagination keeps view payload bounded', () => {
  const rows = [], dishes = ['测试菜甲', '测试菜乙', '测试菜丙', '测试菜丁'], stores = Array.from({ length: 44 }, (_, index) => '测试店' + index);
  for (let day = 0; day < 60; day++) { const date = new Date(Date.UTC(2026, 6, 1 + day)).toISOString().slice(0, 10); stores.forEach(store => dishes.forEach(dish => rows.push([store, date, dish, 1, 10].join(',')))); }
  const state = configured(imported(rows), { dishes, stores, startDate: '2026-07-01', endDate: '2026-08-29' });
  const sample = nativePage(state), page = sample.page;
  assert.equal(page.data.result.totalDishes, 4); assert.equal(page.data.result.dishes.length, 3);
  assert.equal(page.data.result.dishes[0].detailRows.length, 0);
  page.onToggleDish({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(page.data.result.dishes[0].detailRows.length, 50);
  page.onDetailPage({ currentTarget: { dataset: { dish: dishes[0], step: 1 } } });
  assert.equal(page.data.result.dishes[0].detailPage, 2);
  assert.equal(page.data.result.dishes[0].detailRows[0].key, 50);
  page.onDishPage({ currentTarget: { dataset: { step: 1 } } });
  assert.equal(page.data.result.dishes.length, 1); assert.equal(page.data.result.dishes[0].dish, dishes[3]);
  assert.ok(sample.payloadBytes() < 500000, 'Native view updates should remain below 500 KB in this multi-store case');
});
test('native overlong paste is explicitly rejected and saving one group preserves the other draft', () => {
  const state = imported(['测试店甲,2026-09-03,测试菜甲,1,10']);
  const { page } = nativePage(state);
  page.acceptText('a'.repeat(200001)); assert.equal(page.data.importText, ''); assert.match(page.data.notice, /本次未接收/);
  page._drafts.regular.dishes = ['测试菜甲'];
  const next = configured(state, {}); assert.equal(page.persist(next, '保存成功'), true);
  assert.equal(page._drafts.regular.dishes[0], '测试菜甲');
  assert.equal(page._state.configs.regular.dishes.length, 0);
});
