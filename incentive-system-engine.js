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
      employees: seed.employees || [
        { id: "emp-store-manager", name: "店长A", role: "店长" },
        { id: "emp-kitchen-lead", name: "后厨A", role: "后厨" },
        { id: "emp-stock-keeper", name: "库管A", role: "库管" },
        { id: "emp-front-lead", name: "前厅A", role: "前厅" }
      ],
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
      active: task.active !== false
    };
  }

  function readState() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (state?.tasks && state?.employees && state?.records) return state;
    } catch {
      return null;
    }
    return null;
  }

  function saveState(state) {
    const next = { ...state, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  async function loadTemplateState() {
    try {
      const response = await fetch("./data/incentive-task-templates.json?v=0.7.8", { cache: "no-store" });
      if (!response.ok) throw new Error("template fetch failed");
      return defaultState(await response.json());
    } catch {
      return defaultState();
    }
  }

  async function ensureState() {
    const existing = readState();
    if (existing) return existing;
    return saveState(await loadTemplateState());
  }

  function generateRecords(state, date = new Date()) {
    const records = [...state.records];
    state.tasks.filter((task) => task.active).forEach((task) => {
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
        qualityScore: 90,
        omitted: false,
        note: ""
      }, task));
    });
    return saveState({ ...state, records });
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
    const task = normalizeTask(input);
    const exists = state.tasks.some((item) => item.id === task.id);
    const tasks = exists ? state.tasks.map((item) => item.id === task.id ? task : item) : [task, ...state.tasks];
    return saveState({ ...state, tasks });
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
        completed,
        missed,
        onTimeRate: completed ? Math.round(onTime / completed * 100) : 0,
        avgScore,
        points,
        rankLevel: rankLevel(points, avgScore)
      };
    }).sort((a, b) => b.points - a.points || b.avgScore - a.avgScore);
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
