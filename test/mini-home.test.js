const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const calc = require('../miniprogram/utils/calc');
function home(initial = {}) {
  const storage = new Map(Object.entries(initial));
  let page, target = '';
  const wx = { getStorageSync: key => storage.get(key) || '', showToast() {}, navigateTo: ({url}) => {target = url;}, showShareMenu() {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/index/index.js'), 'utf8'), { require: name => name.endsWith("operations-core") ? require("../miniprogram/utils/operations-core") : calc, wx, Page: value => {page = value;} });
  page.data = structuredClone(page.data);
  page.setData = (values, callback) => {
    for (const [key,value] of Object.entries(values)) {
      const pieces = key.split('.'); let cursor = page.data;
      pieces.slice(0,-1).forEach(k => {cursor = cursor[k];}); cursor[pieces.at(-1)] = value;
    }
    if (callback) callback();
  };
  return { page, storage, target: () => target };
}
test('home blocks writes when legacy stored data is a string or array', () => {
  for (const value of ['damaged-json', []]) {
    const fixture = home({'hugetools.operations.v1':value});
    fixture.page.restoreLocalRecords();
    assert.equal(fixture.page._storageReadable, false);
    assert.equal(fixture.storage.get('hugetools.operations.v1'), value);
  }
});
test('returning from backup recomputes restored revenue and retains meetings', () => {
  const fixture = home({'hugetools.operations.v1':{meetingRecords:[{id:'synthetic-test',date:'2026-09-10',title:'合成测试'}]}});
  fixture.page.onLoad();
  const input = {fileName:'',storeMasterText:'门店,地域,城市,市场层级\n合成店,合成区域,合成城市,测试',revenueText:'门店,日期,折后营业收入,到手收入,订单数\n合成店,2026-09-01,100,80,10',budgetText:'门店,月份,到手收入预算\n合成店,2026-09,3000',dishText:'门店,日期,菜品,主菜单,销售金额\n合成店,2026-09-01,合成菜,是,100'};
  fixture.storage.set('hugetools.revenue.v1',input);
  fixture.page.onShow();
  assert.deepEqual(fixture.page.data.revenueResult,calc.analyzeRevenue(input));
  assert.equal(fixture.page.data.meetingRecords[0].id,'synthetic-test');
});
test('home routes each new tool to its registered native page', () => {
  const fixture = home();
  for (const [tool,page] of [['operations-center','operations/operations'],['dish-tracking','dish-tracking/dish-tracking'],['data-backup','data-backup/data-backup']]) {
    fixture.page.onToolTap({currentTarget:{dataset:{tool}}});
    assert.equal(fixture.target(),'/pages/'+page);
  }
});
