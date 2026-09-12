const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
  const requests = [];
  const timers = new Map();
  let sequence = 0;
  const indexedDB = { open() { const request = {}; requests.push(request); return request; } };
  const window = { indexedDB };
  vm.runInNewContext(fs.readFileSync(require.resolve('../task-reminder-storage.js'), 'utf8'), {
    window, indexedDB,
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  function succeed(index, rows) {
    const database = {
      closed: false,
      close() { this.closed = true; },
      transaction() {
        const tx = { objectStore: () => ({ getAll() {
          const request = {};
          queueMicrotask(() => { request.result = rows; request.onsuccess(); queueMicrotask(() => tx.oncomplete()); });
          return request;
        } }) };
        return tx;
      }
    };
    requests[index].result = database;
    requests[index].onsuccess();
    return database;
  }
  return { storage: window.HugeToolsTaskStorage, requests, timers, succeed, expire: () => Array.from(timers.values()).forEach(item => item.callback()) };
}

test('a pending database open rejects on timeout, closes late handle and allows a real retry', async () => {
  const page = fixture();
  const first = page.storage.listTasks();
  const rejected = assert.rejects(first, /超时/);
  assert.equal(Array.from(page.timers.values())[0].delay, 3000);
  page.expire();
  await rejected;
  const late = page.succeed(0, []);
  assert.equal(late.closed, true);
  const retry = page.storage.listTasks();
  assert.equal(page.requests.length, 2);
  page.succeed(1, [{ id: 'synthetic-saved-task' }]);
  assert.deepEqual(await retry, [{ id: 'synthetic-saved-task' }]);
  assert.equal(page.timers.size, 0);
});

test('blocked database does not masquerade as an empty task list and can retry', async () => {
  const page = fixture();
  const first = page.storage.listTasks();
  const rejected = assert.rejects(first, /其他页面占用/);
  page.requests[0].onblocked();
  await rejected;
  assert.equal(page.timers.size, 0);
  const retry = page.storage.listTasks();
  page.succeed(1, []);
  assert.deepEqual(await retry, []);
});

test('version changes close and invalidate the cached handle rather than breaking later reads', async () => {
  const page = fixture();
  const first = page.storage.listTasks();
  const database = page.succeed(0, [{ id: 'before' }]);
  await first;
  database.onversionchange();
  assert.equal(database.closed, true);
  const next = page.storage.listTasks();
  assert.equal(page.requests.length, 2);
  page.succeed(1, [{ id: 'after' }]);
  assert.deepEqual(await next, [{ id: 'after' }]);
});
