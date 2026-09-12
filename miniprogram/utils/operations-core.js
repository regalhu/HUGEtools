(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.HugeOperationsCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const STORAGE_KEY = "hugetools.operations-center.v1";
  const clean = (value) => String(value == null ? "" : value).trim();
  const uid = (prefix) => `${prefix || "task"}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const today = (date) => {
    const d = date || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  function isDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const d = new Date(0);
    d.setFullYear(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  }
  function splitOwners(value) {
    return Array.from(new Set(clean(value).split(/[,，、；;\n]+/).map(clean).filter(Boolean)));
  }
  function normalizeSources(sources) {
    const seen = new Set();
    return (Array.isArray(sources) ? sources : []).map((s) => ({
      key: clean(s.key) || uid("source"), title: clean(s.title), date: clean(s.date), reference: clean(s.reference)
    })).filter((s) => {
      if (!s.title && !s.date && !s.reference) return false;
      if (!s.title) throw new Error("请填写每条来源的会议或材料名称。");
      if (s.date && !isDate(s.date)) throw new Error("来源日期请使用有效的 YYYY-MM-DD 格式。");
      const identity = JSON.stringify([s.title, s.date, s.reference]);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }
  function makeTask(input, previous, now) {
    input = input || {};
    previous = previous || {};
    const timestamp = now || new Date().toISOString();
    const title = clean(input.title);
    if (!title) throw new Error("请填写执行事项名称。");
    const dueDate = clean(input.dueDate);
    if (dueDate && !isDate(dueDate)) throw new Error("到期日请使用有效的 YYYY-MM-DD 格式。");
    const names = typeof input.owners === "string" ? splitOwners(input.owners) : Array.from(new Set((input.assignees || []).map((a) => clean(a.name)).filter(Boolean)));
    const assignees = names.map((name) => {
      const person = (input.assignees || []).find((a) => clean(a.name) === name) || (previous.assignees || []).find((a) => a.name === name) || {};
      const progress = Number(person.progress || 0);
      if (![0, 50, 100].includes(progress)) throw new Error("个人进度仅支持待开始、进行中、已完成。");
      return { name, progress, note: clean(person.note), updatedAt: clean(person.updatedAt) || timestamp };
    });
    return {
      id: previous.id || input.id || uid("task"), title, store: clean(input.store), department: clean(input.department),
      assignees, dueDate, plan: clean(input.plan), do: clean(input.do), check: clean(input.check), act: clean(input.act),
      sources: normalizeSources(input.sources), importKeys: Array.from(new Set([...(previous.importKeys || []), ...(input.importKeys || [])].map(clean).filter(Boolean))),
      createdAt: previous.createdAt || timestamp, updatedAt: timestamp
    };
  }
  function status(task, date) {
    const owners = task.assignees || [];
    const completed = owners.filter((a) => a.progress === 100).length;
    const code = !owners.length ? "unassigned" : completed === owners.length ? "complete" : owners.some((a) => a.progress > 0) ? "active" : "pending";
    return {
      code, label: { unassigned: "待分配", complete: "已完成", active: "进行中", pending: "待开始" }[code],
      completed, total: owners.length, percent: owners.length ? Math.round(completed / owners.length * 100) : 0,
      overdue: !!(task.dueDate && isDate(task.dueDate) && task.dueDate < (date || today()) && code !== "complete")
    };
  }
  function setProgress(task, name, progress, note, now) {
    if (![0, 50, 100].includes(Number(progress))) throw new Error("无效的个人进度。");
    if (!(task.assignees || []).some((a) => a.name === name)) throw new Error("未找到该负责人，请重新打开事项。");
    const timestamp = now || new Date().toISOString();
    return { ...task, updatedAt: timestamp, assignees: task.assignees.map((a) => a.name === name ? { ...a, progress: Number(progress), note: note === undefined ? a.note : clean(note), updatedAt: timestamp } : { ...a }) };
  }
  function readState(raw) {
    if (raw == null || raw === "") return { version: 1, tasks: [] };
    const state = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!state || state.version !== 1 || !Array.isArray(state.tasks)) throw new Error("营运闭环数据格式无法识别，原数据已保留，请先备份并检查。");
    const ids = new Set();
    state.tasks.forEach((task) => {
      if (!task || typeof task.id !== "string" || !task.id || typeof task.title !== "string" || !clean(task.title) || ids.has(task.id) || !Array.isArray(task.assignees) || !Array.isArray(task.sources) || !Array.isArray(task.importKeys)) throw new Error("营运闭环记录不完整，原数据已保留，请先备份并检查。");
      if (["store", "department", "dueDate", "plan", "do", "check", "act", "createdAt", "updatedAt"].some((key) => typeof task[key] !== "string") || task.importKeys.some((key) => typeof key !== "string" || !key)) throw new Error("营运闭环字段格式异常，原数据已保留。");
      ids.add(task.id);
      const names = new Set();
      task.assignees.forEach((a) => {
        if (!a || typeof a.name !== "string" || !clean(a.name) || names.has(a.name) || ![0, 50, 100].includes(a.progress) || typeof a.note !== "string" || typeof a.updatedAt !== "string") throw new Error("负责人进度数据异常，原数据已保留。");
        names.add(a.name);
      });
      if (task.dueDate && !isDate(task.dueDate)) throw new Error("到期日数据异常，原数据已保留。");
      task.sources.forEach((s) => {
        if (!s || typeof s.key !== "string" || !s.key || typeof s.title !== "string" || !clean(s.title) || typeof s.date !== "string" || typeof s.reference !== "string" || (s.date && !isDate(s.date))) throw new Error("会议来源数据异常，原数据已保留。");
      });
    });
    return JSON.parse(JSON.stringify(state));
  }
  function saveState(state, writer) {
    const valid = readState(state);
    writer(STORAGE_KEY, valid);
    return valid;
  }
  function filterTasks(tasks, filters, date) {
    const f = filters || {};
    const query = clean(f.query).toLocaleLowerCase();
    return tasks.filter((task) => {
      const state = status(task, date);
      return (!f.store || task.store === f.store) && (!f.department || task.department === f.department) &&
        (!f.owner || task.assignees.some((a) => a.name === f.owner)) && (!f.source || task.sources.some((s) => s.key === f.source)) &&
        (!f.status || (f.status === "unfinished" ? state.code !== "complete" : state.code === f.status)) &&
        (!f.overdue || state.overdue) && (!query || [task.title, task.plan, task.do, task.check, task.act, task.store, task.department, ...task.sources.map((s) => s.title)].join(" ").toLocaleLowerCase().includes(query));
    });
  }
  function summarize(tasks, date) {
    const people = new Map();
    const departments = new Map();
    let complete = 0, overdue = 0, unassigned = 0;
    tasks.forEach((task) => {
      const s = status(task, date);
      if (s.code === "complete") complete++;
      if (s.overdue) overdue++;
      if (s.code === "unassigned") unassigned++;
      task.assignees.forEach((a) => {
        const row = people.get(a.name) || { name: a.name, total: 0, completed: 0, overdue: 0 };
        row.total++;
        if (a.progress === 100) row.completed++;
        if (s.overdue && a.progress !== 100) row.overdue++;
        people.set(a.name, row);
      });
      const name = task.department || "未填写部门";
      const row = departments.get(name) || { name, total: 0, completed: 0, overdue: 0 };
      row.total++;
      if (s.code === "complete") row.completed++;
      if (s.overdue) row.overdue++;
      departments.set(name, row);
    });
    const ranked = (rows) => Array.from(rows.values()).map((r) => ({ ...r, rate: Math.round(r.completed / r.total * 100) })).sort((a, b) => b.rate - a.rate || b.completed - a.completed || a.name.localeCompare(b.name, "zh"));
    return { total: tasks.length, complete, unfinished: tasks.length - complete, overdue, unassigned, people: ranked(people), departments: ranked(departments) };
  }
  function meetingKey(meeting, platform) {
    return `meeting:${platform}:${clean(meeting.id) || JSON.stringify([meeting.date, meeting.period, meeting.title, meeting.topic, meeting.owner, meeting.dueDate])}`;
  }
  function importMeetings(tasks, meetings, platform, now) {
    if (!Array.isArray(meetings)) throw new Error("原会议数据格式异常，尚未导入。");
    const keys = new Set(tasks.flatMap((t) => t.importKeys || []));
    const added = [];
    let skipped = 0;
    meetings.forEach((meeting) => {
      if (!meeting || !clean(meeting.title)) { skipped++; return; }
      const key = meetingKey(meeting, platform);
      if (keys.has(key) || /^(已完成|完成|全部完成|done|closed|100%)$/i.test(clean(meeting.progress))) { skipped++; return; }
      const invalidDue = clean(meeting.dueDate) && !isDate(clean(meeting.dueDate));
      const reference = [`议题：${clean(meeting.topic) || "原记录未填议题"}`, `原负责人：${clean(meeting.owner) || "未指定"}`, `原进度：${clean(meeting.progress) || "未填写"}`, clean(meeting.period), invalidDue ? `原到期日：${meeting.dueDate}（待核对）` : ""].filter(Boolean).join("；");
      added.push(makeTask({
        title: clean(meeting.topic) || clean(meeting.title), owners: clean(meeting.owner), dueDate: invalidDue ? "" : clean(meeting.dueDate),
        plan: clean(meeting.topic), do: clean(meeting.summary),
        sources: [{ key, title: clean(meeting.title), date: isDate(clean(meeting.date)) ? clean(meeting.date) : "", reference: `${reference}${clean(meeting.date) && !isDate(clean(meeting.date)) ? `；原会议日期：${meeting.date}` : ""}` }], importKeys: [key]
      }, null, now));
      keys.add(key);
    });
    return { tasks: [...added, ...tasks], added: added.length, skipped };
  }
  function carryForward(tasks, selectedIds, source, now) {
    const normalized = normalizeSources([source]);
    if (!normalized.length) throw new Error("请填写本次会议名称。");
    const selected = new Set(selectedIds);
    let linked = 0;
    const result = tasks.map((task) => {
      if (!selected.has(task.id) || status(task).code === "complete") return task;
      const s = normalized[0];
      if (task.sources.some((x) => x.key === s.key || (x.title === s.title && x.date === s.date && x.reference === s.reference))) return task;
      linked++;
      return { ...task, sources: [...task.sources, { ...s }], updatedAt: now || new Date().toISOString() };
    });
    return { tasks: result, linked };
  }
  const sourceLabel = (task) => task.sources.length ? task.sources.map((s) => [s.title, s.date, s.reference].filter(Boolean).join(" · ")).join("\n") : "手工录入";
  const progressLabel = (progress) => ({ 0: "待开始", 50: "进行中", 100: "已完成" })[progress];
  function exportText(tasks, date) {
    const reportDate = date || today();
    const summary = summarize(tasks, reportDate);
    return [`胡哥餐饮工具｜营运闭环`, `导出日期：${reportDate}；当前筛选范围 ${tasks.length} 项；已完成 ${summary.complete} 项；逾期 ${summary.overdue} 项。`, "数据来自本机记录；个人完成率 = 已完成人员责任项 / 该人员责任项总数。", ...tasks.map((task, index) => {
      const s = status(task, reportDate);
      return `\n${index + 1}. ${task.title}\n门店：${task.store || "未填写"}｜部门/中心：${task.department || "未填写"}\n状态：${s.label}${s.overdue ? " · 逾期" : ""}｜到期日：${task.dueDate || "未设置"}\n负责人：${task.assignees.map((a) => `${a.name} ${progressLabel(a.progress)}${a.note ? `（${a.note}）` : ""}`).join("；") || "待分配"}\nP 问题/目标：${task.plan || "未填写"}\nD 执行措施：${task.do || "未填写"}\nC 检查结果：${task.check || "未填写"}\nA 标准化：${task.act || "未填写"}\n来源：${sourceLabel(task)}`;
    })].join("\n");
  }
  function exportCsv(tasks, date) {
    const cell = (value) => {
      let text = String(value == null ? "" : value);
      if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [["事项", "门店", "部门/中心", "整体状态", "是否逾期", "完成负责人数", "负责人数", "到期日", "个人进度", "P 问题/目标", "D 执行措施", "C 检查结果", "A 标准化", "会议/材料来源"]];
    tasks.forEach((task) => {
      const s = status(task, date);
      rows.push([task.title, task.store, task.department, s.label, s.overdue ? "是" : "否", s.completed, s.total, task.dueDate, task.assignees.map((a) => `${a.name} ${progressLabel(a.progress)}${a.note ? `（${a.note}）` : ""}`).join("；"), task.plan, task.do, task.check, task.act, sourceLabel(task)]);
    });
    return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
  }
  return { STORAGE_KEY, uid, today, isDate, splitOwners, makeTask, status, setProgress, readState, saveState, filterTasks, summarize, importMeetings, carryForward, exportText, exportCsv };
});
