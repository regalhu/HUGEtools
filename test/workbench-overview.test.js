const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const flush = () => new Promise(setImmediate);
function fixture(listTasks) {
  const nodes = new Map();
  const timers = new Map();
  let timerId = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: '', handlers: {}, dataset: { workbenchView: 'overview' }, classList: { toggle() {} }, addEventListener(name, fn) { this.handlers[name] = fn; } });
    return nodes.get(id);
  };
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const saved = { meetings: [{ id: 'synthetic-meeting', title: '合成会议', date: today, progress: '未完成' }], logs: [{ id: 'synthetic-log', completed: '合成记录', date: today }], resources: [], training: [] };
  const window = { HugeToolsTaskStorage: listTasks === undefined ? undefined : { listTasks } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../operations-workbench.js'), 'utf8'), {
    window,
    document: { readyState: 'complete', getElementById: node, querySelectorAll: selector => selector === '[data-workbench-view]' ? [node('overview-button')] : [] },
    localStorage: { getItem: key => key === 'hugetools.operations-workbench.v1' ? JSON.stringify(saved) : key === 'hugetools.incentiveSystem.v1' ? JSON.stringify({ records: [{ status: 'pending' }] }) : null },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  return { node, window, timers, expire: () => Array.from(timers.values()).forEach(item => item.callback()) };
}

test('blocked IndexedDB never prevents immediate local statistics and becomes explicitly unread after timeout', async () => {
  const page = fixture(() => new Promise(() => {}));
  const immediate = page.node('workbenchSummary').innerHTML;
  assert.match(immediate, /<span>今日会议<\/span><strong>1<\/strong>/);
  assert.match(immediate, /<span>今日日志<\/span><strong>1<\/strong>/);
  assert.match(immediate, /<span>待执行评分<\/span><strong>1<\/strong>/);
  assert.match(immediate, /<span>启用任务<\/span><strong>读取中<\/strong>/);
  assert.equal(Array.from(page.timers.values())[0].delay, 1500);
  page.expire();
  await flush();
  assert.match(page.node('workbenchSummary').innerHTML, /<span>启用任务<\/span><strong>未读取<\/strong>/);
  assert.match(page.node('workbenchTodayHint').textContent, /任务存储未读取/);
  const reportPromise = page.window.HugeToolsOperationsWorkbench.buildReport();
  page.expire();
  const report = await reportPromise;
  assert.match(report, /会议 1 场；日志 1 条/);
  assert.match(report, /启用任务 未读取/);
});

test('missing or rejected task reader reports unknown rather than zero while retaining local counts', async () => {
  for (const reader of [undefined, () => Promise.reject(new Error('synthetic unreadable store'))]) {
    const page = fixture(reader);
    await flush();
    const html = page.node('workbenchSummary').innerHTML;
    assert.match(html, /<span>逾期任务<\/span><strong>未读取<\/strong>/);
    assert.match(html, /<span>今日会议<\/span><strong>1<\/strong>/);
    assert.equal(page.timers.size, 0);
  }
});

test('successful task read updates counts and clears the bounded timer', async () => {
  const page = fixture(async () => [{ enabled: true, nextDueAt: '2000-01-01T00:00:00Z' }, { enabled: false }]);
  await flush();
  assert.match(page.node('workbenchSummary').innerHTML, /<span>启用任务<\/span><strong>1<\/strong>/);
  assert.match(page.node('workbenchSummary').innerHTML, /<span>逾期任务<\/span><strong>1<\/strong>/);
  assert.equal(page.timers.size, 0);
  assert.doesNotMatch(page.node('workbenchTodayHint').textContent, /任务存储未读取|读取中/);
});

test('an older task request cannot overwrite the latest overview', async () => {
  const requests = [];
  const page = fixture(() => new Promise(resolve => requests.push(resolve)));
  await flush();
  page.node('overview-button').handlers.click();
  await flush();
  requests[1]([{ enabled: true }, { enabled: true }]);
  await flush();
  requests[0]([{ enabled: true }]);
  await flush();
  assert.match(page.node('workbenchSummary').innerHTML, /<span>启用任务<\/span><strong>2<\/strong>/);
});
