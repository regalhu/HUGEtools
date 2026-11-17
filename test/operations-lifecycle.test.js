const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../miniprogram/utils/operations-core');
const make = () => core.makeTask({title:'合成测试', owners:'甲', department:'测试部', dueDate:'2026-01-01', plan:'原方案', sources:[]});
test('不适用排除统计与跟进，恢复保留进度方案和身份', () => {
  const original = core.setProgress(make(), '甲', 100, '证据');
  const skipped = core.setExecutionMode(original, 'notApplicable');
  assert.equal(core.status(skipped).code, 'notApplicable');
  assert.equal(core.status(skipped).overdue, false);
  assert.deepEqual(core.summarize([skipped]).people, []);
  assert.equal(core.summarize([skipped]).unfinished, 0);
  assert.equal(core.filterTasks([skipped], {status:'unfinished'}).length, 0);
  assert.equal(core.carryForward([skipped], [skipped.id], {title:'新会议'}).linked, 0);
  const restored = core.setExecutionMode(skipped, 'normal');
  assert.equal(core.status(restored).code, 'complete');
  assert.equal(restored.id, original.id);
  assert.deepEqual(restored.assignees, original.assignees);
  assert.equal(restored.plan, original.plan);
});
test('搁置与终止即使个人完成也不算完成，终止不催办', () => {
  const complete = core.setProgress(make(), '甲', 100);
  for (const mode of ['paused','terminated']) {
    const item = core.setExecutionMode(complete, mode);
    const summary = core.summarize([item]);
    assert.equal(summary.complete, 0);
    assert.equal(summary.unfinished, 1);
    assert.equal(summary.people[0].completed, 0);
    assert.equal(summary.departments[0].completed, 0);
    assert.equal(core.status(item).overdue, mode === 'paused');
    assert.equal(core.needsFollowup(item), mode === 'paused');
  }
});
test('旧记录无需改写，兼容旧搁置标签，未知状态阻止保存', () => {
  const legacy = make(); delete legacy.executionMode;
  assert.equal(core.status(legacy).code, 'pending');
  assert.equal(core.readState({version:1,tasks:[legacy]}).tasks[0].executionMode, undefined);
  for (const label of ['已搁置未超时','已搁置已超时']) {
    const old = {...legacy, executionMode:label};
    assert.equal(core.status(old).code, 'paused');
    assert.equal(core.makeTask({...old, owners:'甲'}, old).executionMode, 'paused');
  }
  assert.throws(() => core.readState({version:1,tasks:[{...legacy,executionMode:'未知'}]}), /无法识别/);
});
test('编辑不清除已终止状态，导出保留状态', () => {
  const item = core.setExecutionMode(make(),'terminated');
  const updated = core.makeTask({title:item.title, owners:'甲', sources:[], plan:'新方案'},item);
  assert.equal(core.status(updated).code,'terminated');
  assert.match(core.exportCsv([updated]), /已终止/);
  assert.match(core.exportText([updated]), /已终止/);
});
