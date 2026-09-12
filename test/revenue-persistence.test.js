const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../miniprogram/utils/revenue-core.js');
const script = fs.readFileSync(path.join(__dirname, '../revenue-persistence.js'), 'utf8');
const textFields = ['revenueFileName', 'storeMasterText', 'storeRevenueText', 'storeBudgetText', 'dishSalesText'];
const filterFields = ['revenueRegionFilter', 'revenueCityFilter', 'revenueMonthFilter'];

// All stores and values are synthetic fixtures, never actual operating records.
function fixture(overrides = {}) {
  return {
    revenueFileName: '合成测试数据.csv',
    storeMasterText: '门店,地域,城市,市场层级\n测试甲店,区域甲,城市甲,层级甲\n测试乙店,区域乙,城市乙,层级乙',
    storeRevenueText: '门店,日期,折后营业收入,到手收入,订单数\n测试甲店,2024-02-01,100,80,5\n测试乙店,2024-03-01,200,160,10',
    storeBudgetText: '门店,月份,到手收入预算\n测试甲店,2024-02,2320\n测试乙店,2024-03,4960',
    dishSalesText: '门店,日期,菜品,主菜单,销售金额,销售份数\n测试甲店,2024-02-01,测试菜品,是,50,1\n测试乙店,2024-03-01,测试菜品,是,100,2',
    revenueRegionFilter: '区域甲',
    revenueCityFilter: '城市甲',
    revenueMonthFilter: '2024-02',
    ...overrides
  };
}
function setup(raw = null, options = {}) {
  const nodes = new Map();
  class Element {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.children = []; this.listeners = {}; this.attributes = {};
      this._value = ''; this.textContent = ''; this.disabled = false;
    }
    set id(value) { this._id = value; nodes.set(value, this); }
    get id() { return this._id; }
    set value(value) {
      this._value = this.tagName === 'SELECT' && !this.children.some(child => child.value === String(value)) ? '' : String(value);
    }
    get value() { return this._value; }
    append(...items) { this.children.push(...items); }
    prepend(...items) { this.children.unshift(...items); }
    replaceChildren(...items) { this.children = [...items]; if (this.tagName === 'SELECT') this._value = ''; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(event, fn) { this.listeners[event] = this.listeners[event] || []; this.listeners[event].push(fn); }
    dispatch(event) { for (const fn of this.listeners[event] || []) fn({ target: this }); }
    click() { if (!this.disabled) this.dispatch('click'); }
  }
  const document = { readyState: 'complete', createElement: tag => new Element(tag), getElementById: id => nodes.get(id) || null };
  for (const id of ['tool-revenue', 'analyzeRevenueBtn', 'loadRevenueSampleBtn', ...textFields, ...filterFields]) {
    const element = new Element(id === 'tool-revenue' ? 'section' : options.select && filterFields.includes(id) ? 'select' : id.endsWith('Btn') ? 'button' : 'input');
    element.id = id;
    if (element.tagName === 'SELECT') { const empty = new Element('option'); empty.value = ''; empty.textContent = '全部'; element.append(empty); }
  }
  let stored = raw;
  const calls = { writes: 0, calculations: [] };
  const localStorage = {
    getItem() { if (options.readError) throw new Error('synthetic read failure'); return stored; },
    setItem(key, value) { if (options.writeError) throw new Error('synthetic quota failure'); calls.writes += 1; stored = value; }
  };
  nodes.get('analyzeRevenueBtn').addEventListener('click', () => {
    const data = Object.fromEntries([...textFields, ...filterFields].map(id => [id, nodes.get(id).value]));
    const result = core.analyze({
      fileName: data.revenueFileName, storeMasterText: data.storeMasterText,
      revenueText: data.storeRevenueText, budgetText: data.storeBudgetText, dishText: data.dishSalesText,
      regionFilter: data.revenueRegionFilter, cityFilter: data.revenueCityFilter, monthFilter: data.revenueMonthFilter
    });
    calls.calculations.push({ data, result });
  });
  const context = vm.createContext({ window: options.noCore ? {} : { HugeRevenueCore: core }, document, localStorage });
  vm.runInContext(script, context);
  return { nodes, calls, getRaw: () => stored, setRaw: value => { stored = value; }, status: () => nodes.get('revenueSaveStatus').textContent };
}

test('restores all filters before recalculation and retains the saved store/date scope', () => {
  const data = fixture();
  const state = setup(JSON.stringify(data));
  assert.equal(state.calls.calculations.length, 1);
  assert.deepEqual(state.calls.calculations[0].data, data);
  assert.equal(state.calls.calculations[0].result.summary.storeCount, 1);
  assert.equal(state.calls.calculations[0].result.summary.comparableRevenue, 100);
  assert.equal(state.calls.writes, 0);
  assert.match(state.status(), /已恢复.*筛选范围/);
  assert.equal(state.nodes.get('revenueRegionFilter').attributes.list, 'revenueRegionFilterOptions');
  assert.deepEqual(state.nodes.get('revenueMonthFilterOptions').children.map(child => child.value), ['2024-02', '2024-03']);
});

test('saving includes the three filters as well as the five input fields', () => {
  const state = setup();
  const data = fixture();
  for (const [id, value] of Object.entries(data)) state.nodes.get(id).value = value;
  state.nodes.get('saveRevenueInputBtn').click();
  assert.deepEqual(JSON.parse(state.getRaw()), data);
  assert.equal(state.calls.writes, 1);
  assert.match(state.status(), /已保存分析输入与筛选范围/);
});

test('a stale saved selection remains intact and does not broaden to all stores', () => {
  const data = fixture({ revenueRegionFilter: '已移除区域' });
  const state = setup(JSON.stringify(data));
  assert.equal(state.nodes.get('revenueRegionFilter').value, '已移除区域');
  assert.equal(state.calls.calculations[0].result.summary.storeCount, 0);
  assert.equal(state.calls.calculations[0].result.summary.comparableRevenue, null);
  assert.match(state.status(), /无匹配.*保留原筛选.*未扩大/);
  assert.equal(state.getRaw(), JSON.stringify(data));
});

test('combined filters are checked together even when each value individually exists', () => {
  const state = setup(JSON.stringify(fixture({ revenueCityFilter: '城市乙' })));
  assert.match(state.status(), /无匹配/);
  assert.equal(state.calls.calculations[0].result.summary.storeCount, 0);
});

test('free-text partial filters use the same matching semantics as the analyzer', () => {
  const state = setup(JSON.stringify(fixture({ revenueRegionFilter: '甲', revenueCityFilter: '甲' })));
  assert.doesNotMatch(state.status(), /无匹配/);
  assert.equal(state.calls.calculations[0].result.summary.storeCount, 1);
});

test('select controls rebuild options and preserve unavailable saved values before calculation', () => {
  const state = setup(JSON.stringify(fixture({ revenueMonthFilter: '2024-01' })), { select: true });
  const select = state.nodes.get('revenueMonthFilter');
  assert.equal(select.value, '2024-01');
  assert.deepEqual(select.children.map(child => child.value), ['', '2024-02', '2024-03', '2024-01']);
  assert.equal(state.calls.calculations[0].data.revenueMonthFilter, '2024-01');
  assert.equal(state.calls.calculations[0].result.summary.storeCount, 0);
  assert.match(state.status(), /未扩大/);
});

test('legacy records are restored with an explicit warning about missing historical filters', () => {
  const data = fixture();
  filterFields.forEach(id => { delete data[id]; });
  const raw = JSON.stringify(data);
  const state = setup(raw);
  assert.match(state.status(), /旧版未完整保存筛选范围.*请重新确认/);
  assert.equal(state.calls.calculations[0].data.revenueRegionFilter, '');
  assert.equal(state.calls.calculations[0].result.summary.storeCount, 2);
  assert.equal(state.getRaw(), raw);
  assert.equal(state.calls.writes, 0);
});

test('malformed JSON and unexpected structures lock saving without overwriting raw data', () => {
  const corrupt = ['{broken', 'null', '[]', '{}', JSON.stringify(fixture({ revenueMonthFilter: 202402 }))];
  for (const raw of corrupt) {
    const state = setup(raw);
    assert.equal(state.nodes.get('saveRevenueInputBtn').disabled, true);
    assert.match(state.status(), /锁定保存.*保留原内容/);
    assert.equal(state.calls.calculations.length, 0);
    state.nodes.get('saveRevenueInputBtn').click();
    assert.equal(state.calls.writes, 0);
    assert.equal(state.getRaw(), raw);
  }
});

test('corruption introduced after restoration is rechecked and never overwritten on save', () => {
  const state = setup(JSON.stringify(fixture()));
  state.setRaw('{changed-and-broken');
  state.nodes.get('saveRevenueInputBtn').click();
  assert.equal(state.getRaw(), '{changed-and-broken');
  assert.equal(state.calls.writes, 0);
  assert.equal(state.nodes.get('saveRevenueInputBtn').disabled, true);
});

test('input changes rebuild choices without clearing the current saved filter', () => {
  const state = setup(JSON.stringify(fixture()));
  state.nodes.get('storeMasterText').value = '门店,地域,城市\n测试甲店,新区域,新城市\n测试乙店,区域乙,城市乙';
  state.nodes.get('storeMasterText').dispatch('input');
  assert.equal(state.nodes.get('revenueRegionFilter').value, '区域甲');
  assert.match(state.status(), /尚未保存.*无匹配/);
  assert.ok(state.nodes.get('revenueRegionFilterOptions').children.some(child => child.value === '新区域'));
  assert.equal(state.calls.writes, 0);
});

test('read errors lock saving; write errors do not claim a successful save', () => {
  const unreadable = setup(null, { readError: true });
  assert.equal(unreadable.nodes.get('saveRevenueInputBtn').disabled, true);
  const original = JSON.stringify(fixture());
  const quota = setup(original, { writeError: true });
  quota.nodes.get('storeRevenueText').value = '';
  quota.nodes.get('saveRevenueInputBtn').click();
  assert.match(quota.status(), /尚未保存/);
  assert.equal(quota.getRaw(), original);
});

test('missing analysis component preserves filters while reporting unavailable scope validation', () => {
  const state = setup(JSON.stringify(fixture()), { noCore: true });
  assert.equal(state.nodes.get('revenueRegionFilter').value, '区域甲');
  assert.match(state.status(), /无法核对范围匹配/);
});
