const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../incentive-system-engine.js'), 'utf8');
const key = 'hugetools.incentiveSystem.v1';

// Synthetic test fixtures only. These names, tasks and scores are not real work records.
const employee = { id: 'synthetic-employee', name: '合成测试员工', role: '店长' };
const task = { id: 'synthetic-task', title: '合成测试检查', ownerId: employee.id, role: '店长', cycle: 'daily', dueTime: '18:00', active: true, basePoints: 10 };
const existing = () => ({ employees: [employee], tasks: [task], records: [], updatedAt: '2024-02-01T00:00:00.000Z' });
function setup(raw = null, fetcher) {
  let stored = raw;
  const calls = { writes: 0, fetches: 0 };
  const context = vm.createContext({
    window: {},
    localStorage: {
      getItem(storageKey) { assert.equal(storageKey, key); return stored; },
      setItem(storageKey, value) { assert.equal(storageKey, key); calls.writes += 1; stored = value; }
    },
    fetch: async () => {
      calls.fetches += 1;
      return fetcher ? fetcher() : { ok: true, json: async () => ({ employees: [employee], tasks: [task] }) };
    }
  });
  vm.runInContext(source, context);
  return { engine: context.window.HugeToolsIncentiveEngine, context, calls, getRaw: () => stored, setRaw: (value) => { stored = value; } };
}

test('first use is empty and read-only, with no template request or automatic storage write', async () => {
  const state = setup();
  const data = await state.engine.ensureState();
  assert.equal(data.employees.length, 0);
  assert.equal(data.tasks.length, 0);
  assert.equal(data.records.length, 0);
  state.engine.generateRecords(data);
  assert.equal(state.calls.fetches, 0);
  assert.equal(state.calls.writes, 0);
  assert.equal(state.getRaw(), null);
});

test('existing saved records are returned without seeding, rewriting, or changing timestamps', async () => {
  const original = JSON.stringify(existing());
  const state = setup(original);
  const data = await state.engine.ensureState();
  assert.equal(JSON.stringify(data), original);
  assert.equal(state.getRaw(), original);
  assert.equal(state.calls.writes, 0);
  assert.equal(state.calls.fetches, 0);
});

test('explicit templates contain no named employees and cannot create factual execution records', async () => {
  const state = setup();
  let data = await state.engine.loadTemplates();
  assert.equal(state.calls.fetches, 1);
  assert.equal(state.calls.writes, 1);
  assert.equal(data.employees.length, 0);
  assert.equal(data.records.length, 0);
  assert.equal(data.tasks[0].title, '【模板】合成测试检查');
  assert.equal(data.tasks[0].ownerId, '');
  assert.equal(data.tasks[0].active, false);
  assert.equal(data.tasks[0].isTemplate, true);
  data = state.engine.generateRecords(data);
  assert.equal(data.records.length, 0);
  assert.equal(state.calls.writes, 1);
  assert.equal(state.engine.leaderboard(data).length, 0);
});

test('loading a template cannot replace existing data or data saved while fetching', async () => {
  const original = JSON.stringify(existing());
  const state = setup(original);
  await assert.rejects(state.engine.loadTemplates(), /不能用模板覆盖/);
  assert.equal(state.getRaw(), original);
  assert.equal(state.calls.fetches, 0);
  const concurrent = setup(null, async () => {
    concurrent.setRaw(original);
    return { ok: true, json: async () => ({ tasks: [task] }) };
  });
  await assert.rejects(concurrent.engine.loadTemplates(), /已有新记录保存/);
  assert.equal(concurrent.getRaw(), original);
  assert.equal(concurrent.calls.writes, 0);
});

test('malformed or structurally broken stored content locks all writes and preserves raw bytes', async () => {
  for (const raw of ['{broken', 'null', '{}', '{"employees":{},"tasks":[],"records":[]}', '{"employees":[],"tasks":[null],"records":[]}']) {
    const state = setup(raw);
    await assert.rejects(state.engine.ensureState(), { code: 'INCENTIVE_STORAGE_LOCKED' });
    assert.throws(() => state.engine.saveState(existing()), { code: 'INCENTIVE_STORAGE_LOCKED' });
    assert.throws(() => state.engine.generateRecords(existing()), { code: 'INCENTIVE_STORAGE_LOCKED' });
    await assert.rejects(state.engine.loadTemplates(), { code: 'INCENTIVE_STORAGE_LOCKED' });
    assert.equal(state.getRaw(), raw);
    assert.equal(state.calls.writes, 0);
  }
});

test('corruption after a successful read is rechecked before a later write', async () => {
  const state = setup(JSON.stringify(existing()));
  const data = await state.engine.ensureState();
  state.setRaw('{later-corruption');
  assert.throws(() => state.engine.deleteTask(data, task.id), { code: 'INCENTIVE_STORAGE_LOCKED' });
  assert.equal(state.getRaw(), '{later-corruption');
  assert.equal(state.calls.writes, 0);
});

test('empty-state task creation requires an actual owner and creates records only once', async () => {
  const state = setup();
  let data = await state.engine.ensureState();
  assert.throws(() => state.engine.upsertTask(data, task), /真实负责人/);
  assert.equal(state.calls.writes, 0);
  data = state.engine.upsertTask(data, { ...task, employeeName: '合成测试员工', ownerId: '' });
  assert.equal(data.employees.length, 1);
  assert.equal(data.employees[0].name, '合成测试员工');
  const at = new Date('2024-02-01T08:00:00Z');
  data = state.engine.generateRecords(data, at);
  assert.equal(data.records.length, 1);
  assert.equal(data.records[0].qualityScore, null);
  assert.equal(data.records[0].status, 'pending');
  const afterFirst = state.getRaw();
  data = state.engine.generateRecords(data, at);
  assert.equal(data.records.length, 1);
  assert.equal(state.getRaw(), afterFirst);
  assert.equal(state.engine.leaderboard(data).length, 0);
});

test('reviewed template becomes a real task only after assigning an actual employee', async () => {
  const state = setup();
  let data = await state.engine.loadTemplates();
  data = state.engine.upsertTask(data, { ...data.tasks[0], employeeName: '合成测试员工', active: true });
  assert.equal(data.tasks[0].isTemplate, false);
  assert.equal(data.tasks[0].title, '合成测试检查');
  assert.ok(data.tasks[0].ownerId);
  data = state.engine.generateRecords(data, new Date('2024-02-01T08:00:00Z'));
  assert.equal(data.records.length, 1);
});

test('failed template download leaves first-use storage untouched', async () => {
  const state = setup(null, async () => ({ ok: false }));
  await assert.rejects(state.engine.loadTemplates(), /模板暂时无法读取/);
  assert.equal(state.getRaw(), null);
  assert.equal(state.calls.writes, 0);
});

test('storage write failure is reported as a write lock without inventing a saved result', async () => {
  const original = JSON.stringify(existing());
  const state = setup(original);
  const data = await state.engine.ensureState();
  state.context.localStorage.setItem = () => { throw new Error('synthetic quota error'); };
  assert.throws(() => state.engine.deleteTask(data, task.id), { code: 'INCENTIVE_STORAGE_LOCKED' });
  assert.equal(state.getRaw(), original);
});
