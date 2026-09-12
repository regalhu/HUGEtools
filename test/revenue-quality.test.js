const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../miniprogram/utils/revenue-core.js');
const web = require('../revenue-analysis.js');
const mini = require('../miniprogram/utils/calc.js');

// All records in this file are synthetic test fixtures, not actual business data.
const revenueHeader = '门店,日期,折后营业收入,到手收入,订单数';
const dishHeader = '门店,日期,菜品,主菜单,销售金额,销售份数';
const budgetHeader = '门店,月份,到手收入预算';
function fixture(options = {}) {
  return {
    storeMasterText: '门店,地域,城市,市场层级\n测试甲店,测试区域,测试城市,测试层级\n测试乙店,其他区域,其他城市,其他层级',
    revenueText: revenueHeader + '\n测试甲店,2024-02-01,100,80,5\n测试甲店,2024-02-02,200,160,10',
    dishText: dishHeader + '\n测试甲店,2024-02-01,测试菜品,是,50,1\n测试甲店,2024-02-02,测试菜品,是,100,2',
    budgetText: budgetHeader + '\n测试甲店,2024-02,2320',
    ...options
  };
}
function fullMonth(year, month, dayCount) {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const dates = Array.from({ length: dayCount }, (_, index) => `${ym}-${String(index + 1).padStart(2, '0')}`);
  return fixture({
    revenueText: revenueHeader + '\n' + dates.map((date) => `测试甲店,${date},100,80,5`).join('\n'),
    dishText: dishHeader + '\n' + dates.map((date) => `测试甲店,${date},测试菜品,是,50,1`).join('\n'),
    budgetText: budgetHeader + `\n测试甲店,${ym},2480`
  });
}

test('same store/day totals, take-home budget basis, and both adapters agree', () => {
  const input = fixture();
  const result = web.analyze(input);
  assert.equal(result.summary.comparableRevenue, 300);
  assert.equal(result.summary.takeHomeRevenue, 240);
  assert.equal(result.summary.takeHomeRate, 80);
  assert.equal(result.summary.coverageRate, 50);
  assert.equal(result.monthly[0].timeProgressBudget, 160);
  assert.equal(result.monthly[0].timeProgressBudgetAchievementRate, 150);
  assert.deepEqual(mini.analyzeRevenue(input).summary, result.summary);
  assert.deepEqual(mini.analyzeRevenue(input).monthly, result.monthly);
});

test('missing and malformed revenue never become zero; take-home is independent', () => {
  for (const value of ['', 'NaN', 'Infinity', '0x10', 'abc']) {
    const result = core.analyze(fixture({ revenueText: revenueHeader + `\n测试甲店,2024-02-01,${value},80,5` }));
    assert.equal(result.summary.comparableRevenue, null, value);
    assert.equal(result.summary.takeHomeRate, null, value);
    assert.equal(result.summary.coverageRate, null, value);
    assert.ok(result.issues.some((issue) => issue.field === '折后营业收入'));
    assert.match(result.report, /可比范围折后营业收入：不可计算/);
  }
});

test('explicit zeros stay zero and zero denominators stay uncomputable', () => {
  const result = core.analyze(fixture({
    revenueText: revenueHeader + '\n测试甲店,2024-02-01,0,0,0',
    dishText: dishHeader + '\n测试甲店,2024-02-01,测试菜品,否,0,0',
    budgetText: budgetHeader + '\n测试甲店,2024-02,0'
  }));
  assert.equal(result.summary.comparableRevenue, 0);
  assert.equal(result.summary.takeHomeRevenue, 0);
  assert.equal(result.summary.dishSales, 0);
  assert.equal(result.summary.monthlyBudget, 0);
  assert.equal(result.summary.coverageRate, null);
  assert.equal(result.summary.fullMonthBudgetAchievementRate, null);
  assert.equal(core.money(0), '¥0.00');
  assert.equal(core.percent(null), '不可计算');
});

test('missing or non-finite take-home data blocks rates and budget achievement', () => {
  for (const value of ['', 'NaN', 'Infinity']) {
    const result = core.analyze(fixture({ revenueText: revenueHeader + `\n测试甲店,2024-02-01,100,${value},5` }));
    assert.equal(result.summary.takeHomeRevenue, null);
    assert.equal(result.summary.takeHomeRate, null);
    assert.equal(result.summary.fullMonthBudgetAchievementRate, null);
  }
});

test('duplicates including aliases block summation instead of adding or overwriting', () => {
  const result = core.analyze(fixture({
    revenueText: revenueHeader + '\n金沙百联,2024-02-01,100,80,5\n金山百联,2024-02-01,200,160,10',
    dishText: dishHeader + '\n金山百联,2024-02-01,测试菜品,是,50,1',
    budgetText: ''
  }));
  assert.equal(result.monthly.length, 1);
  assert.equal(result.monthly[0].comparableRevenue, null);
  assert.equal(result.monthly[0].takeHomeRevenue, null);
  assert.equal(result.monthly[0].orders, null);
  assert.equal(result.issues.filter((issue) => issue.code === 'duplicate_fact').length, 2);
  assert.equal(result.dailyRank.length, 0);
});

test('duplicate dish facts are flagged and cannot inflate sales or rankings', () => {
  const input = fixture();
  input.dishText += '\n测试甲店,2024-02-01,测试菜品,是,50,1';
  const result = core.analyze(input);
  assert.equal(result.summary.dishSales, null);
  assert.equal(result.summary.coverageRate, null);
  assert.equal(result.dishTop.length, 0);
});

test('impossible dates are rejected without silently dropping them from totals', () => {
  const input = fixture();
  input.revenueText += '\n测试甲店,2024-02-30,900,720,30';
  const result = core.analyze(input);
  assert.equal(result.summary.comparableRevenue, null);
  assert.equal(result.monthly[0].comparableRevenue, null);
  assert.equal(result.summary.fullMonthBudgetAchievementRate, null);
  assert.ok(result.issues.some((issue) => issue.code === 'invalid_date' && issue.row === 4));
  assert.equal(core.parseDate('2023-02-29'), null);
  assert.equal(core.isoDate(core.parseDate('2024/2/29')), '2024-02-29');
});

test('quoted CSV, thousand separators and TSV normalize across clients', () => {
  const input = fixture({
    revenueText: '门店\t日期\t折后营业收入\t到手收入\t订单数\n测试甲店\t2024/2/1\t1,200.50\t960.40\t5',
    dishText: dishHeader + '\n测试甲店,2024.2.1,"测试,菜品",是,"600.25",1',
    budgetText: budgetHeader + '\n测试甲店,2024-02,"2,320"'
  });
  const result = core.analyze(input);
  assert.equal(result.summary.comparableRevenue, 1200.5);
  assert.equal(result.summary.takeHomeRate, 80);
  assert.equal(result.summary.coverageRate, 50);
  assert.equal(result.dishTop[0].dish, '测试,菜品');
  assert.equal(result.issues.length, 0);
  assert.deepEqual(mini.analyzeRevenue(input).summary, web.analyze(input).summary);
});

test('malformed unquoted CSV and duplicate headers are visible quality failures', () => {
  for (const text of [
    revenueHeader + '\n测试甲店,2024-02-01,1,200,80,5',
    '门店,日期,折后营业收入,折后营业收入\n测试甲店,2024-02-01,100,200',
    revenueHeader + '\n测试甲店,2024-02-01,"100,80,5'
  ]) {
    const result = core.analyze(fixture({ revenueText: text }));
    assert.equal(result.summary.comparableRevenue, null);
    assert.ok(result.issues.some((issue) => /invalid_csv|invalid_header/.test(issue.code)));
  }
});

test('same store/month but missing day on either side blocks coverage', () => {
  const input = fixture();
  input.revenueText += '\n测试甲店,2024-02-03,100,80,5';
  const result = core.analyze(input);
  assert.equal(result.summary.comparableRevenue, 400);
  assert.equal(result.summary.dishSales, 150);
  assert.equal(result.summary.coverageRate, null);
  assert.equal(result.monthly[0].revenueDayCount, 3);
  assert.equal(result.monthly[0].dishDayCount, 2);
});

test('dish-only store stays in scope and cannot disappear from the denominator', () => {
  const input = fixture();
  input.dishText += '\n测试乙店,2024-02-01,测试菜品,是,50,1';
  const result = core.analyze(input);
  assert.equal(result.summary.storeCount, 2);
  assert.equal(result.summary.comparableRevenue, null);
  assert.equal(result.summary.coverageRate, null);
});

test('budget-only store remains visible; ambiguous, duplicate and invalid budgets block attainment', () => {
  const variants = [
    '门店,月份,预算\n测试甲店,2024-02,2320',
    budgetHeader + '\n测试甲店,2024-02,-1',
    budgetHeader + '\n测试甲店,2024-02,Infinity',
    budgetHeader + '\n测试甲店,2024-13,2320',
    budgetHeader + '\n测试甲店,2024-02,2320\n测试甲店,2024-02,2400'
  ];
  variants.forEach((budgetText) => {
    const result = core.analyze(fixture({ budgetText }));
    assert.equal(result.summary.monthlyBudget, null);
    assert.equal(result.summary.fullMonthBudgetAchievementRate, null);
    assert.ok(result.issues.length > 0);
  });
  const result = core.analyze(fixture({ budgetText: budgetHeader + '\n测试甲店,2024-02,2320\n测试乙店,2024-02,2320' }));
  assert.equal(result.summary.storeCount, 2);
  assert.equal(result.summary.monthlyBudget, 4640);
  assert.equal(result.summary.fullMonthBudgetAchievementRate, null);
});

test('historical filename range does not use the current year or truncate budget actuals', () => {
  const result = core.analyze(fixture({ fileName: '合成测试_2024_0202.csv' }));
  assert.equal(result.monthly[0].comparableStart, '2024-02-02');
  assert.equal(result.summary.comparableRevenue, 200);
  assert.equal(result.summary.dishSales, 100);
  assert.equal(result.summary.takeHomeRevenue, 160);
  assert.equal(result.summary.budgetActualTakeHomeRevenue, 240);
  assert.equal(result.summary.fullMonthBudgetAchievementRate, 240 / 2320 * 100);
  assert.equal(result.monthly[0].orders, 10);
  assert.equal(result.summary.coverageRate, 50);
});

test('mid-month and gapped samples cannot claim time-progress budget achievement', () => {
  for (const dates of [['2024-02-02'], ['2024-02-01', '2024-02-03']]) {
    const result = core.analyze(fixture({
      revenueText: revenueHeader + '\n' + dates.map((date) => `测试甲店,${date},100,80,5`).join('\n'),
      dishText: dishHeader + '\n' + dates.map((date) => `测试甲店,${date},测试菜品,是,50,1`).join('\n')
    }));
    assert.equal(result.summary.takeHomeRevenue, dates.length * 80);
    assert.equal(result.summary.fullMonthBudgetAchievementRate, null);
    assert.equal(result.monthly[0].timeProgressBudgetAchievementRate, null);
  }
});

test('full-month ranking respects leap years, actual month length and unique dates', () => {
  assert.equal(core.analyze(fullMonth(2024, 2, 28)).dailyRank.length, 0);
  assert.equal(core.analyze(fullMonth(2024, 2, 29)).dailyRank.length, 1);
  assert.equal(core.analyze(fullMonth(2023, 2, 28)).dailyRank.length, 1);
  assert.equal(core.analyze(fullMonth(2024, 4, 28)).dailyRank.length, 0);
  assert.equal(core.analyze(fullMonth(2024, 4, 30)).dailyRank.length, 1);
  const duplicate = fullMonth(2024, 4, 29);
  duplicate.revenueText += '\n测试甲店,2024-04-29,100,80,5';
  assert.equal(core.analyze(duplicate).dailyRank.length, 0);
});

test('filters affect both adapters, all component totals and source quality scope', () => {
  const input = fixture();
  input.revenueText += '\n测试乙店,2024-02-01,400,320,20';
  input.dishText += '\n测试乙店,2024-02-01,其他测试菜,是,200,4';
  input.budgetText += '\n测试乙店,2024-02,4640';
  input.regionFilter = '测试区域';
  const browser = web.analyze(input), wechat = mini.analyzeRevenue(input);
  assert.equal(browser.summary.storeCount, 1);
  assert.equal(browser.summary.comparableRevenue, 300);
  assert.equal(browser.dishTop.length, 1);
  assert.deepEqual(wechat.summary, browser.summary);
  assert.deepEqual(wechat.monthly, browser.monthly);
});

test('empty input never generates synthetic activity or zero factual totals', () => {
  const result = core.analyze({});
  assert.equal(result.summary.storeCount, 0);
  assert.equal(result.summary.comparableRevenue, null);
  assert.equal(result.summary.dishSales, null);
  assert.equal(result.summary.coverageRate, null);
  assert.match(result.report, /请导入真实经营数据/);
  assert.deepEqual(mini.analyzeRevenue({}).rows, []);
});

test('browser loads empty and renders uncomputable values without null-to-zero coercion', () => {
  const nodes = new Map();
  for (const id of ['tool-revenue', 'revenueSummary', 'revenueBoundary', 'revenueReportDraft', 'storeRevenueText', 'dishSalesText', 'storeMasterText', 'storeBudgetText', 'revenueFileName']) {
    nodes.set(id, { value: '', innerHTML: '', addEventListener() {} });
  }
  const context = vm.createContext({ document: { readyState: 'complete', getElementById: (id) => nodes.get(id) || null } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../miniprogram/utils/revenue-core.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../revenue-analysis.js'), 'utf8'), context);
  assert.equal(nodes.get('storeRevenueText').value, '');
  assert.equal(nodes.get('dishSalesText').value, '');
  assert.match(nodes.get('revenueSummary').innerHTML, /不可计算/);
  assert.doesNotMatch(nodes.get('revenueSummary').innerHTML, /¥0\.00/);
});


test('a missing first dish day cannot silently shrink the revenue denominator', () => {
  const result = core.analyze(fixture({ dishText: dishHeader + '\n测试甲店,2024-02-02,测试菜品,是,100,2' }));
  assert.equal(result.summary.comparableRevenue, 300);
  assert.equal(result.monthly[0].comparableStart, '2024-02-01');
  assert.equal(result.summary.coverageRate, null);
});
