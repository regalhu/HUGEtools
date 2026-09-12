const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const core = require("../miniprogram/utils/operations-core");

const date = "2026-09-12";
const now = "2026-09-12T03:00:00.000Z";
const task = (values = {}) => core.makeTask({ title: "测试事项", owners: "负责人甲、负责人乙", dueDate: "2026-09-11", ...values }, null, now);

test("多人事项仅在全部个人完成后完成；个人重开恢复整体进行中", () => {
  const initial = task();
  const partial = core.setProgress(initial, "负责人甲", 100, "已检查", now);
  assert.equal(core.status(initial, date).code, "pending");
  assert.equal(core.status(partial, date).code, "active");
  assert.equal(core.status(partial, date).overdue, true);
  assert.equal(core.status(partial, date).completed, 1);
  const complete = core.setProgress(partial, "负责人乙", 100);
  assert.equal(core.status(complete, date).code, "complete");
  assert.equal(core.status(complete, date).overdue, false);
  const reopened = core.setProgress(complete, "负责人甲", 0);
  assert.equal(core.status(reopened, date).code, "active");
  assert.equal(core.status(reopened, date).overdue, true);
  assert.equal(reopened.assignees[0].note, "已检查");
});

test("未分配不能自动完成；到期当天不算逾期，未设置到期日不算逾期", () => {
  const unassigned = task({ owners: "", dueDate: date });
  assert.equal(core.status(unassigned, date).code, "unassigned");
  assert.equal(core.status(unassigned, date).overdue, false);
  assert.equal(core.status(unassigned, "2026-09-13").overdue, true);
  assert.equal(core.status(task({ dueDate: "" }), date).overdue, false);
  assert.equal(core.status(unassigned, date).percent, 0);
});

test("去重负责人且不按名字内部空格拆人；编辑保留原负责人的进度与备注", () => {
  const initial = core.setProgress(task({ owners: "负责人甲，负责人甲；负责人乙\nAlex Chen" }), "负责人甲", 100, "原备注");
  const updated = core.makeTask({ ...initial, owners: "负责人甲、负责人丙", assignees: undefined }, initial, now);
  assert.deepEqual(initial.assignees.map((p) => p.name), ["负责人甲", "负责人乙", "Alex Chen"]);
  assert.deepEqual(updated.assignees.map((p) => [p.name, p.progress, p.note]), [["负责人甲", 100, "原备注"], ["负责人丙", 0, ""]]);
  assert.equal(updated.id, initial.id);
});

test("无效日期和进度阻止保存，不把 2 月 30 日滚动到 3 月", () => {
  assert.throws(() => task({ dueDate: "2026-02-30" }), /有效/);
  assert.throws(() => task({ sources: [{ title: "测试会议", date: "2026-13-01" }] }), /有效/);
  assert.throws(() => core.setProgress(task(), "负责人甲", 99), /无效/);
  assert.throws(() => core.setProgress(task(), "未知负责人", 100), /未找到/);
  assert.equal(core.isDate("2024-02-29"), true);
  assert.equal(core.isDate("2026-02-29"), false);
});

test("导入保留来源，重复导入不新增，未完成文字不误判为完成", () => {
  const meetings = [
    { id: 1, title: "测试会议", date, topic: "测试议题", owner: "负责人甲、负责人乙", dueDate: date, progress: "未完成" },
    { id: 2, title: "已结项测试会议", date, progress: "已完成" }
  ];
  const original = JSON.stringify(meetings);
  const first = core.importMeetings([], meetings, "web", now);
  assert.equal(first.added, 1);
  assert.equal(first.skipped, 1);
  assert.equal(first.tasks[0].assignees.length, 2);
  assert.equal(first.tasks[0].sources[0].key, "meeting:web:1");
  assert.match(first.tasks[0].sources[0].reference, /原进度：未完成/);
  assert.equal(core.importMeetings(first.tasks, meetings, "web", now).added, 0);
  assert.equal(JSON.stringify(meetings), original);
});

test("导入异常旧日期保留原文并等待核对，不发明到期日或人员", () => {
  const imported = core.importMeetings([], [{ id: 3, title: "旧记录", date: "2026年9月", dueDate: "明天", progress: "进行中" }], "mini", now).tasks[0];
  assert.equal(imported.dueDate, "");
  assert.equal(imported.assignees.length, 0);
  assert.match(imported.sources[0].reference, /原到期日：明天（待核对）/);
  assert.match(imported.sources[0].reference, /原会议日期：2026年9月/);
  assert.equal(core.status(imported, date).code, "unassigned");
  assert.throws(() => core.importMeetings([], {}, "mini"), /格式异常/);
});

test("未完成继承只关联选定范围，保留原进度和来源，重复操作不新增来源", () => {
  const first = core.setProgress(task({ sources: [{ title: "前次测试会议", date, reference: "第 1 项" }] }), "负责人甲", 100);
  let complete = task();
  complete = core.setProgress(core.setProgress(complete, "负责人甲", 100), "负责人乙", 100);
  const excluded = task({ title: "范围外测试事项" });
  const source = { title: "本次测试会议", date: "2026-09-14", reference: "继续跟进" };
  const next = core.carryForward([first, complete, excluded], [first.id, complete.id], source, now);
  assert.equal(next.linked, 1);
  assert.equal(next.tasks.length, 3);
  assert.equal(next.tasks[0].sources.length, 2);
  assert.equal(next.tasks[0].assignees[0].progress, 100);
  assert.equal(next.tasks[1].sources.length, 0);
  assert.equal(next.tasks[2].sources.length, 0);
  assert.equal(first.sources.length, 1);
  assert.equal(core.carryForward(next.tasks, [first.id], source, now).linked, 0);
});

test("多条件筛选与统计范围一致；个人已完成不计入自身逾期", () => {
  const first = core.setProgress(task({ store: "测试门店甲", department: "测试部门", sources: [{ key: "source-1", title: "测试会议" }] }), "负责人甲", 100);
  const second = task({ store: "测试门店乙", owners: "负责人丙", dueDate: date });
  const visible = core.filterTasks([first, second], { store: "测试门店甲", owner: "负责人甲", source: "source-1", overdue: true, status: "unfinished" }, date);
  assert.equal(visible.length, 1);
  const summary = core.summarize(visible, date);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.complete, 0);
  assert.deepEqual(summary.people.find((p) => p.name === "负责人甲"), { name: "负责人甲", total: 1, completed: 1, overdue: 0, rate: 100 });
  assert.equal(summary.people.find((p) => p.name === "负责人乙").overdue, 1);
  assert.equal(summary.departments[0].completed, 0);
  assert.equal(core.filterTasks([first, second], { query: "不存在的文字" }, date).length, 0);
});

test("空看板不提供虚构人员或百分比分母", () => {
  const result = core.summarize([], date);
  assert.deepEqual(result, { total: 0, complete: 0, unfinished: 0, overdue: 0, unassigned: 0, people: [], departments: [] });
});

test("读回验证拒绝未知版本、重复记录和非法个人状态，保持原数据", () => {
  const original = { version: 1, tasks: [task()] };
  const valid = core.readState(JSON.stringify(original));
  valid.tasks[0].title = "新值";
  assert.equal(original.tasks[0].title, "测试事项");
  assert.throws(() => core.readState({ version: 2, tasks: [] }), /格式无法识别/);
  assert.throws(() => core.readState({ version: 1, tasks: [original.tasks[0], original.tasks[0]] }), /不完整/);
  const corrupted = JSON.parse(JSON.stringify(original));
  corrupted.tasks[0].assignees[0].progress = 90;
  assert.throws(() => core.readState(corrupted), /进度数据异常/);
});

test("存储异常向上抛出，写入前校验不合格状态", () => {
  const original = { version: 1, tasks: [task()] };
  let writes = 0;
  const writer = () => { writes++; throw new Error("存储空间不足"); };
  assert.throws(() => core.saveState(original, writer), /存储空间不足/);
  assert.equal(writes, 1);
  assert.throws(() => core.saveState({ version: 3, tasks: [] }, writer), /格式无法识别/);
  assert.equal(writes, 1);
  assert.equal(original.tasks[0].title, "测试事项");
});

test("范围导出保留 PDCA 与来源，CSV 引号转义并防止公式执行", () => {
  const item = task({ title: '=HYPERLINK("test")', plan: "测试问题\n下一行", do: "措施", check: "检查", act: "标准化", sources: [{ title: "测试会议", reference: "引用说明" }] });
  const csv = core.exportCsv([item], date);
  assert.match(csv, /"'=HYPERLINK\(""test""\)"/);
  assert.match(csv, /"测试问题\n下一行"/);
  assert.match(csv, /引用说明/);
  const text = core.exportText([item], date);
  assert.match(text, /当前筛选范围 1 项/);
  assert.match(text, /A 标准化：标准化/);
  assert.match(text, /C 检查结果：检查/);
});

function miniPage(storage) {
  let page;
  const context = { require: () => core, Page: (value) => { page = value; }, wx: { getStorageSync: () => storage, setStorageSync: () => { throw new Error("空间不足"); }, pageScrollTo: () => {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../miniprogram/pages/operations/operations.js"), "utf8"), context);
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = function (patch) {
    Object.entries(patch).forEach(([key, value]) => {
      const parts = key.replace(/\[(\d+)\]/g, ".$1").split(".");
      let target = this.data;
      parts.slice(0, -1).forEach((part) => { target = target[part]; });
      target[parts[parts.length - 1]] = value;
    });
  };
  page.onLoad();
  page.onShow();
  return page;
}

test("小程序保存失败保留编辑内容和旧列表，不显示假保存", () => {
  const original = { version: 1, tasks: [task()] };
  const page = miniPage(original);
  page.newTask();
  page.data.form.title = "待保存的测试事项";
  page.saveTask();
  assert.equal(page._state.tasks.length, 1);
  assert.equal(page.data.editorOpen, true);
  assert.equal(page.data.form.title, "待保存的测试事项");
  assert.equal(page.data.feedbackError, true);
  assert.match(page.data.feedback, /保存失败/);
});

test("小程序读取损坏状态锁定保存并报告错误", () => {
  const page = miniPage({ version: 1, tasks: [{}] });
  assert.equal(page.data.readFailed, true);
  assert.match(page.data.feedback, /读取失败/);
  assert.equal(page.persist([task()]), false);
  assert.equal(page._state.tasks.length, 0);
});
