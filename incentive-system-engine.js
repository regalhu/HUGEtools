(function () {
  const STORAGE_KEY = "hugetools.incentiveSystem.v1";
  const ROLES = ["店长", "后厨", "库管", "前厅"];
  const STATUS_LABELS = { pending: "待执行", completed: "已完成", missed: "遗漏" };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function weekKey(date) {
    const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = cursor.getDay() || 7;
    cursor.setDate(cursor.getDate() + 4 - day);
    const yearStart = new Date(cursor.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((cursor - yearStart) / 86400000) + 1) / 7);
    return `${cursor.getFullYear()}-W${pad(weekNo)}`;
  }

  function weekday(date) {
    return date.getDay() || 7;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function parseTime(time) {
    const [hour, minute] = String(time || "18:00").split(":").map((part) => Number(part) || 0);
    return { hour: Math.min(Math.max(hour, 0), 23), minute: Math.min(Math.max(minute, 0), 59) };
  }

  function withTime(date, time) {
    const { hour, minute } = parseTime(time);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
  }

  function dueDateForTask(task, baseDate = new Date()) {
    if (task.cycle === "weekly") {
      const current = weekday(baseDate);
      const target = Number(task.dueWeekday) || 5;
      const due = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + target - current);
      return withTime(due, task.dueTime);
    }
    if (task.cycle === "monthly") {
      const day = task.dueMonthDay === "last"
        ? daysInMonth(baseDate.getFullYear(), baseDate.getMonth())
        : Math.min(Number(task.dueMonthDay) || 1, daysInMonth(baseDate.getFullYear(), baseDate.getMonth()));
      return withTime(new Date(baseDate.getFullYear(), baseDate.getMonth(), day), task.dueTime);
    }
    return withTime(baseDate, task.dueTime);
  }

  function periodKeyForTask(task, date = new Date()) {
    if (task.cycle === "weekly") return weekKey(date);
    if (task.cycle === "monthly") return monthKey(date);
    return dateKey(date);
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function defaultState(seed = {}) {
    return {
      employees: seed.employees || [],
      tasks: (seed.tasks || []).map((task) => normalizeTask(task)),
      records: [],
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeTask(task) {
    return {
      id: task.id || makeId("incentive-task"),
      title: String(task.title || "未命名任务").trim(),
      role: ROLES.includes(task.role) ? task.role : "店长",
      ownerId: task.ownerId || "",
      cycle: ["daily", "weekly", "monthly"].includes(task.cycle) ? task.cycle : "daily",
      dueTime: task.dueTime || "18:00",
      dueWeekday: Number(task.dueWeekday) || 5,
      dueMonthDay: task.dueMonthDay || "last",
      basePoints: Math.min(Math.max(Number(task.basePoints) || 10, 1), 200),
      description: String(task.description || "").trim(),
      qualityStandard: String(task.qualityStandard || "").trim(),
      active: task.active !== false,
      isTemplate: task.isTemplate === true
    };
  }

  function storageError(message) {
    const error = new Error(message);
    error.code = "INCENTIVE_STORAGE_LOCKED";
    return error;
  }

  function validState(state) {
    if (!state || typeof state !== "object" || Array.isArray(state)) return false;
    const validList = (rows) => Array.isArray(rows) && rows.every((row) => row && typeof row === "object" && typeof row.id === "string" && row.id.trim()) && new Set(rows.map((row) => row.id)).size === rows.length;
    return validList(state.employees) && validList(state.tasks) && validList(state.records) &&
      state.employees.every((row) => typeof row.name === "string" && row.name.trim() && typeof row.role === "string") &&
      state.tasks.every((row) => typeof row.title === "string" && typeof row.role === "string" && typeof row.ownerId === "string") &&
      state.records.every((row) => typeof row.taskId === "string" && typeof row.employeeId === "string" && ["pending", "completed", "missed"].includes(row.status) && Number.isFinite(row.score) && Number.isFinite(row.points) && Number.isFinite(new Date(row.dueAt).getTime()));
  }

  function readState() {
    let raw;
    try { raw = localStorage.getItem(STORAGE_KEY); }
    catch { throw storageError("无法读取员工激励存储，已停止写入。请检查浏览器存储权限。"); }
    if (raw === null) return null;
    let value;
    try { value = JSON.parse(raw); }
    catch { throw storageError("员工激励已保存内容损坏，已锁定写入并保留原内容。请先导出备份后修复。"); }
    if (!validState(value)) throw storageError("员工激励已保存内容结构异常，已锁定写入并保留原内容。请先导出备份后修复。");
    return value;
  }

  function saveState(state) {
    // Recheck current storage before each mutation, including changes from another tab.
    readState();
    if (!validState(state)) throw storageError("员工激励内容未通过完整性检查，未覆盖已保存数据。");
    const next = { ...state, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { throw storageError("员工激励保存失败，可能存储空间不足。请先导出备份再重试。"); }
    return next;
  }

  async function loadTemplates() {
    const existing = readState();
    if (existing && (existing.tasks.length || existing.employees.length || existing.records.length)) throw new Error("已有员工激励记录，不能用模板覆盖。可在任务管理中新增任务。");
    const response = await fetch("./data/incentive-task-templates.json?v=0.9.0", { cache: "no-store" });
    if (!response.ok) throw new Error("任务模板暂时无法读取，请稍后重试。");
    const source = await response.json();
    if (!Array.isArray(source.tasks) || !source.tasks.length) throw new Error("任务模板内容为空或格式异常，未写入数据。");
    const template = defaultState({ tasks: source.tasks.map((task) => ({ ...task, title: `【模板】${task.title}`, ownerId: "", active: false, isTemplate: true })) });
    const latest = readState();
    if (latest && (latest.tasks.length || latest.employees.length || latest.records.length)) throw new Error("已有新记录保存，已停止载入模板以免覆盖。");
    return saveState(template);
  }

  async function ensureState() {
    return readState() || defaultState();
  }

  function generateRecords(state, date = new Date()) {
    const records = [...state.records];
    readState();
    state.tasks.filter((task) => task.active && !task.isTemplate && state.employees.some((employee) => employee.id === task.ownerId && !employee.isTemplate)).forEach((task) => {
      const periodKey = periodKeyForTask(task, date);
      const id = `${task.id}-${periodKey}`;
      if (records.some((record) => record.id === id)) return;
      records.push(scoreRecord({
        id,
        taskId: task.id,
        employeeId: task.ownerId,
        role: task.role,
        periodKey,
        dueAt: dueDateForTask(task, date).toISOString(),
        completedAt: null,
        status: "pending",
        qualityScore: null,
        omitted: false,
        note: ""
      }, task));
    });
    return records.length === state.records.length ? state : saveState({ ...state, records });
  }

  function scoreRecord(record, task) {
    const completed = record.status === "completed" && record.completedAt;
    const missed = record.status === "missed" || record.omitted;
    if (!completed && !missed) {
      return { ...record, score: 0, points: 0 };
    }
    const dueAt = new Date(record.dueAt);
    const completedAt = record.completedAt ? new Date(record.completedAt) : null;
    const timelyScore = completed ? (completedAt <= dueAt ? 100 : 70) : 0;
    const qualityScore = missed ? 0 : Math.min(Math.max(Number(record.qualityScore) || 0, 0), 100);
    const omissionScore = missed ? 0 : 100;
    const score = Math.round(timelyScore * 0.4 + qualityScore * 0.45 + omissionScore * 0.15);
    return {
      ...record,
      score,
      points: Math.round((Number(task?.basePoints) || 10) * score / 100)
    };
  }

  function updateRecord(state, recordId, patch) {
    const records = state.records.map((record) => {
      if (record.id !== recordId) return record;
      const task = state.tasks.find((item) => item.id === record.taskId);
      return scoreRecord({ ...record, ...patch }, task);
    });
    return saveState({ ...state, records });
  }

  function upsertTask(state, input) {
    let employees = state.employees.slice();
    let ownerId = input.ownerId;
    const employeeName = String(input.employeeName || "").trim();
    if (employeeName) {
      let employee = employees.find((item) => item.name === employeeName && item.role === input.role && !item.isTemplate);
      if (!employee) { employee = { id: makeId("employee"), name: employeeName, role: input.role }; employees.push(employee); }
      ownerId = employee.id;
    }
    if (!String(input.title || "").trim()) throw new Error("请填写真实任务名称。");
    if (!employees.some((employee) => employee.id === ownerId && employee.role === input.role && !employee.isTemplate)) throw new Error("请选择真实负责人，或填写该角色的真实员工姓名。");
    const task = normalizeTask({ ...input, title: String(input.title).replace(/^【模板】/, ""), ownerId, isTemplate: false });
    const exists = state.tasks.some((item) => item.id === task.id);
    const tasks = exists ? state.tasks.map((item) => item.id === task.id ? task : item) : [task, ...state.tasks];
    return saveState({ ...state, tasks, employees });
  }

  function deleteTask(state, taskId) {
    return saveState({
      ...state,
      tasks: state.tasks.filter((task) => task.id !== taskId),
      records: state.records.filter((record) => record.taskId !== taskId)
    });
  }

  function leaderboard(state) {
    return state.employees.map((employee) => {
      const records = state.records.filter((record) => record.employeeId === employee.id);
      const evaluatedRecords = records.filter((record) => record.status !== "pending");
      const completed = records.filter((record) => record.status === "completed").length;
      const missed = records.filter((record) => record.status === "missed" || record.omitted).length;
      const onTime = records.filter((record) => record.status === "completed" && record.completedAt && new Date(record.completedAt) <= new Date(record.dueAt)).length;
      const points = records.reduce((sum, record) => sum + record.points, 0);
      const avgScore = evaluatedRecords.length ? Math.round(evaluatedRecords.reduce((sum, record) => sum + record.score, 0) / evaluatedRecords.length) : 0;
      return {
        ...employee,
        records: records.length,
        evaluatedCount: evaluatedRecords.length,
        completed,
        missed,
        onTimeRate: completed ? Math.round(onTime / completed * 100) : 0,
        avgScore,
        points,
        rankLevel: rankLevel(points, avgScore)
      };
    }).filter((row) => row.evaluatedCount > 0 && !row.isTemplate).sort((a, b) => b.points - a.points || b.avgScore - a.avgScore);
  }

  function rankLevel(points, avgScore) {
    if (points >= 180 && avgScore >= 92) return "晋升候选";
    if (points >= 100 && avgScore >= 85) return "奖金优先";
    if (avgScore < 70) return "重点辅导";
    return "稳定执行";
  }

  function todayRecords(state, date = new Date()) {
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    return state.records.filter((record) => new Date(record.dueAt) <= end || record.periodKey === dateKey(date));
  }

  window.HugeToolsIncentiveEngine = {
    ROLES,
    STATUS_LABELS,
    dateKey,
    ensureState,
    readState,
    loadTemplates,
    validState,
    saveState,
    generateRecords,
    scoreRecord,
    updateRecord,
    upsertTask,
    deleteTask,
    leaderboard,
    todayRecords,
    normalizeTask,
    periodKeyForTask,
    dueDateForTask
  };
})();
