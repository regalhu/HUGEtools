(function () {
  const MS = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseTime(time) {
    const [hour, minute] = String(time || "09:00").split(":").map((part) => Number(part) || 0);
    return { hour: Math.min(Math.max(hour, 0), 23), minute: Math.min(Math.max(minute, 0), 59) };
  }

  function makeLocalDate(dateText, timeText) {
    const source = dateText ? new Date(`${dateText}T00:00:00`) : new Date();
    const { hour, minute } = parseTime(timeText);
    return new Date(source.getFullYear(), source.getMonth(), source.getDate(), hour, minute, 0, 0);
  }

  function withTime(date, timeText) {
    const { hour, minute } = parseTime(timeText);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function jsWeekdayToStore(date) {
    const day = date.getDay();
    return day === 0 ? 7 : day;
  }

  function addMonths(date, amount) {
    const next = new Date(date);
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + amount);
    next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
    return next;
  }

  function calculateNextDue(schedule, fromDate = new Date()) {
    const from = new Date(fromDate);
    const type = schedule?.type || "daily";
    const time = schedule?.time || "09:00";

    if (type === "once") {
      const due = makeLocalDate(schedule.date || dateKey(from), time);
      return due >= from ? due.toISOString() : due.toISOString();
    }

    if (type === "daily") {
      const today = withTime(from, time);
      if (today > from) return today.toISOString();
      const tomorrow = new Date(today.getTime() + MS.day);
      return tomorrow.toISOString();
    }

    if (type === "weekly") {
      const weekdays = Array.isArray(schedule.weekdays) && schedule.weekdays.length ? schedule.weekdays : [jsWeekdayToStore(from)];
      for (let offset = 0; offset < 14; offset += 1) {
        const candidateDate = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
        if (!weekdays.includes(jsWeekdayToStore(candidateDate))) continue;
        const candidate = withTime(candidateDate, time);
        if (candidate > from) return candidate.toISOString();
      }
    }

    if (type === "monthly_date") {
      const preferredDay = Math.min(Math.max(Number(schedule.monthDay) || 1, 1), 31);
      for (let offset = 0; offset < 15; offset += 1) {
        const monthCursor = new Date(from.getFullYear(), from.getMonth() + offset, 1);
        const day = Math.min(preferredDay, daysInMonth(monthCursor.getFullYear(), monthCursor.getMonth()));
        const candidate = withTime(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day), time);
        if (candidate > from) return candidate.toISOString();
      }
    }

    if (type === "monthly_last") {
      for (let offset = 0; offset < 15; offset += 1) {
        const monthCursor = new Date(from.getFullYear(), from.getMonth() + offset, 1);
        const lastDay = daysInMonth(monthCursor.getFullYear(), monthCursor.getMonth());
        const candidate = withTime(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), lastDay), time);
        if (candidate > from) return candidate.toISOString();
      }
    }

    if (type === "custom_interval") {
      const intervalValue = Math.max(Number(schedule.intervalValue) || 1, 1);
      const intervalUnit = schedule.intervalUnit || "days";
      let candidate = makeLocalDate(schedule.startDate || dateKey(from), time);
      const step = () => {
        if (intervalUnit === "hours") candidate = new Date(candidate.getTime() + intervalValue * MS.hour);
        if (intervalUnit === "days") candidate = new Date(candidate.getTime() + intervalValue * MS.day);
        if (intervalUnit === "weeks") candidate = new Date(candidate.getTime() + intervalValue * MS.week);
        if (intervalUnit === "months") candidate = addMonths(candidate, intervalValue);
      };
      let guard = 0;
      while (candidate <= from && guard < 2000) {
        step();
        guard += 1;
      }
      return candidate.toISOString();
    }

    return withTime(from, time).toISOString();
  }

  function makeTask(input) {
    const now = new Date().toISOString();
    const task = {
      id: input.id || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: String(input.title || "未命名任务").trim(),
      role: String(input.role || "店长").trim(),
      description: String(input.description || "").trim(),
      enabled: input.enabled !== false,
      schedule: normalizeSchedule(input.schedule || {}),
      completedHistory: Array.isArray(input.completedHistory) ? input.completedHistory.slice(0, 50) : [],
      createdAt: input.createdAt || now,
      updatedAt: now,
      lastTriggeredAt: input.lastTriggeredAt || null
    };
    task.nextDueAt = task.enabled ? calculateNextDue(task.schedule, new Date(Date.now() - 1000)) : input.nextDueAt || null;
    return task;
  }

  function normalizeSchedule(schedule) {
    return {
      type: schedule.type || "daily",
      time: schedule.time || "09:00",
      date: schedule.date || dateKey(new Date()),
      weekdays: Array.isArray(schedule.weekdays) ? schedule.weekdays.map(Number).filter((item) => item >= 1 && item <= 7) : [1],
      monthDay: Math.min(Math.max(Number(schedule.monthDay) || 1, 1), 31),
      intervalValue: Math.max(Number(schedule.intervalValue) || 1, 1),
      intervalUnit: schedule.intervalUnit || "days",
      startDate: schedule.startDate || dateKey(new Date())
    };
  }

  function dueState(task, now = new Date()) {
    if (!task.enabled || !task.nextDueAt) return "inactive";
    const due = new Date(task.nextDueAt);
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endToday = new Date(startToday.getTime() + MS.day);
    if (due < startToday) return "overdue";
    if (due < endToday) return "today";
    return "future";
  }

  function isDue(task, now = new Date()) {
    return task.enabled && task.nextDueAt && new Date(task.nextDueAt) <= now;
  }

  function completeTask(task, note = "") {
    const now = new Date();
    const historyItem = {
      title: task.title,
      role: task.role,
      dueAt: task.nextDueAt || null,
      completedAt: now.toISOString(),
      note: String(note || "").trim()
    };
    const completedHistory = [historyItem, ...(task.completedHistory || [])].slice(0, 50);
    const next = { ...task, completedHistory, updatedAt: now.toISOString() };
    if (task.schedule?.type === "once") {
      next.enabled = false;
      next.nextDueAt = null;
    } else {
      next.nextDueAt = calculateNextDue(task.schedule, now);
    }
    return next;
  }

  function toggleTask(task) {
    const enabled = !task.enabled;
    return {
      ...task,
      enabled,
      nextDueAt: enabled ? calculateNextDue(task.schedule, new Date(Date.now() - 1000)) : task.nextDueAt,
      updatedAt: new Date().toISOString()
    };
  }

  function markTriggered(task) {
    return { ...task, lastTriggeredAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }

  function formatDue(iso) {
    if (!iso) return "无下次提醒";
    const date = new Date(iso);
    return `${dateKey(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  window.HugeToolsTaskScheduler = {
    calculateNextDue,
    makeTask,
    normalizeSchedule,
    dueState,
    isDue,
    completeTask,
    toggleTask,
    markTriggered,
    formatDue,
    dateKey
  };
})();
