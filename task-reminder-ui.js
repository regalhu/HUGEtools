(function () {
  const storage = () => window.HugeToolsTaskStorage;
  const scheduler = () => window.HugeToolsTaskScheduler;

  const state = {
    tasks: [],
    templates: [],
    editingId: null,
    reminderTimer: null,
    alertQueue: []
  };

  const fallbackTemplates = [
    { id: "opening-check", name: "开店检查", role: "店长", description: "检查门头灯箱、收银设备、备货、卫生、员工到岗和营业准备。", schedule: { type: "daily", time: "09:30" } },
    { id: "closing-check", name: "闭店检查", role: "值班经理", description: "检查收银结账、燃气水电、冰箱门、门锁、垃圾清运和交接事项。", schedule: { type: "daily", time: "22:30" } },
    { id: "receiving-check", name: "收货检查", role: "后厨主管", description: "核对供应商、数量、温度、生产日期、破损和入库签字。", schedule: { type: "weekly", time: "10:00", weekdays: [1, 3, 5] } },
    { id: "monthly-inventory", name: "月度盘点", role: "店长", description: "完成原料、包材、冻品、酒水和低值易耗品盘点，记录差异。", schedule: { type: "monthly_last", time: "21:00" } },
    { id: "attendance-submit", name: "考勤提交", role: "店长", description: "核对排班、迟到早退、请假、加班和兼职工时，提交给财务。", schedule: { type: "monthly_date", time: "18:00", monthDay: 3 } },
    { id: "supplier-reconciliation", name: "供应商对账", role: "财务", description: "核对送货单、退换货、付款周期、发票和异常扣款。", schedule: { type: "monthly_date", time: "16:00", monthDay: 5 } },
    { id: "fridge-temperature", name: "冰箱温度记录", role: "后厨", description: "记录冷藏、冷冻、展示柜温度，发现异常立即通知负责人。", schedule: { type: "custom_interval", time: "11:00", intervalValue: 6, intervalUnit: "hours" } },
    { id: "delivery-platform-check", name: "外卖平台检查", role: "运营", description: "检查营业状态、菜单售罄、配送范围、活动、差评和异常订单。", schedule: { type: "daily", time: "10:30" } }
  ];

  const $ = (id) => document.getElementById(id);
  const safeText = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  async function init() {
    if (!$("taskReminderList")) return;
    state.templates = await loadTemplates();
    bindEvents();
    hydrateSettings();
    renderTemplateOptions();
    await refreshTasks();
    updateScheduleFields();
    checkDueTasks({ openedPage: true });
    state.reminderTimer = window.setInterval(() => checkDueTasks({ openedPage: false }), 60000);
  }

  async function loadTemplates() {
    try {
      const response = await fetch("./data/task-reminder-templates.json?v=0.7.7", { cache: "no-store" });
      if (!response.ok) throw new Error(`模板读取失败：${response.status}`);
      const data = await response.json();
      return Array.isArray(data.templates) ? data.templates : fallbackTemplates;
    } catch {
      return fallbackTemplates;
    }
  }

  function bindEvents() {
    $("taskReminderForm")?.addEventListener("submit", handleSubmit);
    $("taskReminderResetBtn")?.addEventListener("click", resetForm);
    $("taskTemplateSelect")?.addEventListener("change", applySelectedTemplate);
    $("taskScheduleType")?.addEventListener("change", updateScheduleFields);
    $("taskRoleFilter")?.addEventListener("change", persistAndRender);
    $("taskViewFilter")?.addEventListener("change", persistAndRender);
    $("taskReminderList")?.addEventListener("click", handleTaskAction);
    $("taskAlertCloseBtn")?.addEventListener("click", closeAlert);
    $("taskAlertCompleteBtn")?.addEventListener("click", completeAlertTasks);
  }

  function hydrateSettings() {
    const settings = storage().readSettings();
    if (settings.roleFilter && $("taskRoleFilter")) $("taskRoleFilter").value = settings.roleFilter;
    if (settings.viewFilter && $("taskViewFilter")) $("taskViewFilter").value = settings.viewFilter;
  }

  function persistAndRender() {
    storage().saveSettings({
      roleFilter: $("taskRoleFilter").value,
      viewFilter: $("taskViewFilter").value
    });
    render();
  }

  function renderTemplateOptions() {
    const select = $("taskTemplateSelect");
    if (!select) return;
    select.innerHTML = `<option value="">选择内置模板</option>${state.templates.map((template) => (
      `<option value="${safeText(template.id)}">${safeText(template.name)} · ${safeText(template.role)}</option>`
    )).join("")}`;
  }

  async function refreshTasks() {
    state.tasks = (await storage().listTasks()).sort(sortTasks);
    renderRoleFilter();
    render();
  }

  function renderRoleFilter() {
    const select = $("taskRoleFilter");
    if (!select) return;
    const current = select.value;
    const roles = Array.from(new Set(state.tasks.map((task) => task.role).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    select.innerHTML = `<option value="all">全部角色</option>${roles.map((role) => `<option value="${safeText(role)}">${safeText(role)}</option>`).join("")}`;
    select.value = roles.includes(current) ? current : "all";
  }

  function render() {
    renderSummary();
    renderList();
    renderHistory();
    renderScheduleFields();
  }

  function renderSummary() {
    const now = new Date();
    const active = state.tasks.filter((task) => task.enabled).length;
    const today = state.tasks.filter((task) => scheduler().dueState(task, now) === "today").length;
    const overdue = state.tasks.filter((task) => scheduler().dueState(task, now) === "overdue").length;
    const completed = state.tasks.reduce((sum, task) => sum + (task.completedHistory || []).length, 0);
    $("taskReminderSummary").innerHTML = [
      metric("今日待办", today, today ? "warn" : "good"),
      metric("逾期提醒", overdue, overdue ? "bad" : "good"),
      metric("启用任务", active, active ? "good" : "warn"),
      metric("完成记录", completed, "good")
    ].join("");
  }

  function metric(label, value, level) {
    return `<article class="metric ${level}"><span>${safeText(label)}</span><strong>${safeText(value)}</strong></article>`;
  }

  function filteredTasks() {
    const roleFilter = $("taskRoleFilter")?.value || "all";
    const viewFilter = $("taskViewFilter")?.value || "all";
    const now = new Date();
    return state.tasks.filter((task) => {
      if (roleFilter !== "all" && task.role !== roleFilter) return false;
      const due = scheduler().dueState(task, now);
      if (viewFilter === "today") return due === "today";
      if (viewFilter === "overdue") return due === "overdue";
      if (viewFilter === "completed") return (task.completedHistory || []).length > 0;
      if (viewFilter === "active") return task.enabled;
      return true;
    });
  }

  function renderList() {
    const tasks = filteredTasks();
    const list = $("taskReminderList");
    if (!list) return;
    if (!tasks.length) {
      list.innerHTML = `<div class="task-empty">暂无符合条件的任务，可以从模板库导入或手动新增。</div>`;
      return;
    }
    list.innerHTML = tasks.map((task) => {
      const stateName = scheduler().dueState(task);
      const stateText = { today: "今日", overdue: "逾期", future: "待提醒", inactive: "停用" }[stateName];
      return `
        <article class="task-card ${stateName}">
          <div class="task-card-main">
            <div>
              <span class="task-state">${safeText(stateText)}</span>
              <h3>${safeText(task.title)}</h3>
              <p>${safeText(task.description || "无备注")}</p>
            </div>
            <dl>
              <div><dt>角色</dt><dd>${safeText(task.role)}</dd></div>
              <div><dt>周期</dt><dd>${safeText(scheduleLabel(task.schedule))}</dd></div>
              <div><dt>下次提醒</dt><dd>${safeText(scheduler().formatDue(task.nextDueAt))}</dd></div>
            </dl>
          </div>
          <div class="task-actions">
            <button class="text-button" type="button" data-complete-task="${safeText(task.id)}">完成</button>
            <button class="text-button" type="button" data-edit-task="${safeText(task.id)}">编辑</button>
            <button class="text-button" type="button" data-toggle-task="${safeText(task.id)}">${task.enabled ? "停用" : "启用"}</button>
            <button class="text-button danger" type="button" data-delete-task="${safeText(task.id)}">删除</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderHistory() {
    const history = state.tasks.flatMap((task) => (task.completedHistory || []).map((item) => ({
      ...item,
      taskId: task.id
    }))).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).slice(0, 12);
    const target = $("taskCompletedHistory");
    if (!target) return;
    if (!history.length) {
      target.innerHTML = `<p>还没有完成记录。</p>`;
      return;
    }
    target.innerHTML = history.map((item) => (
      `<p><strong>${safeText(item.title)}</strong> · ${safeText(item.role)} · ${safeText(scheduler().formatDue(item.completedAt))}</p>`
    )).join("");
  }

  function scheduleLabel(schedule) {
    const time = schedule.time || "09:00";
    const names = ["一", "二", "三", "四", "五", "六", "日"];
    if (schedule.type === "once") return `一次性 ${schedule.date || ""} ${time}`;
    if (schedule.type === "daily") return `每天 ${time}`;
    if (schedule.type === "weekly") return `每周${(schedule.weekdays || []).map((day) => names[day - 1]).join("、")} ${time}`;
    if (schedule.type === "monthly_date") return `每月 ${schedule.monthDay || 1} 日 ${time}`;
    if (schedule.type === "monthly_last") return `每月最后一天 ${time}`;
    if (schedule.type === "custom_interval") return `每 ${schedule.intervalValue || 1} ${unitLabel(schedule.intervalUnit)} ${time}`;
    return time;
  }

  function unitLabel(unit) {
    return { hours: "小时", days: "天", weeks: "周", months: "月" }[unit] || "天";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const existing = state.editingId ? state.tasks.find((task) => task.id === state.editingId) : null;
    const task = scheduler().makeTask({
      ...(existing || {}),
      title: $("taskTitle").value,
      role: $("taskRole").value,
      description: $("taskDescription").value,
      enabled: $("taskEnabled").checked,
      schedule: collectSchedule()
    });
    await storage().saveTask(task);
    resetForm();
    await refreshTasks();
    checkDueTasks({ openedPage: false });
  }

  function collectSchedule() {
    const weekdays = Array.from(document.querySelectorAll("[data-task-weekday]:checked")).map((item) => Number(item.value));
    return scheduler().normalizeSchedule({
      type: $("taskScheduleType").value,
      time: $("taskTime").value || "09:00",
      date: $("taskDate").value,
      weekdays,
      monthDay: Number($("taskMonthDay").value) || 1,
      intervalValue: Number($("taskIntervalValue").value) || 1,
      intervalUnit: $("taskIntervalUnit").value,
      startDate: $("taskStartDate").value
    });
  }

  function resetForm() {
    state.editingId = null;
    $("taskFormTitle").textContent = "新增任务";
    $("taskSaveBtn").textContent = "保存任务";
    $("taskTitle").value = "";
    $("taskRole").value = "店长";
    $("taskDescription").value = "";
    $("taskEnabled").checked = true;
    $("taskScheduleType").value = "daily";
    $("taskTime").value = "09:00";
    $("taskDate").value = scheduler().dateKey(new Date());
    $("taskMonthDay").value = "1";
    $("taskIntervalValue").value = "1";
    $("taskIntervalUnit").value = "days";
    $("taskStartDate").value = scheduler().dateKey(new Date());
    document.querySelectorAll("[data-task-weekday]").forEach((item) => {
      item.checked = item.value === "1";
    });
    updateScheduleFields();
  }

  function applySelectedTemplate() {
    const template = state.templates.find((item) => item.id === $("taskTemplateSelect").value);
    if (!template) return;
    resetForm();
    $("taskTitle").value = template.name;
    $("taskRole").value = template.role;
    $("taskDescription").value = template.description;
    applyScheduleToForm(scheduler().normalizeSchedule(template.schedule || {}));
  }

  function applyScheduleToForm(schedule) {
    $("taskScheduleType").value = schedule.type;
    $("taskTime").value = schedule.time;
    $("taskDate").value = schedule.date;
    $("taskMonthDay").value = schedule.monthDay;
    $("taskIntervalValue").value = schedule.intervalValue;
    $("taskIntervalUnit").value = schedule.intervalUnit;
    $("taskStartDate").value = schedule.startDate;
    document.querySelectorAll("[data-task-weekday]").forEach((item) => {
      item.checked = schedule.weekdays.includes(Number(item.value));
    });
    updateScheduleFields();
  }

  function updateScheduleFields() {
    const type = $("taskScheduleType")?.value || "daily";
    document.querySelectorAll("[data-schedule-field]").forEach((field) => {
      const modes = field.dataset.scheduleField.split(" ");
      field.hidden = !modes.includes(type);
    });
  }

  function renderScheduleFields() {
    if (!$("taskDate")?.value) $("taskDate").value = scheduler().dateKey(new Date());
    if (!$("taskStartDate")?.value) $("taskStartDate").value = scheduler().dateKey(new Date());
  }

  async function handleTaskAction(event) {
    const editBtn = event.target.closest("[data-edit-task]");
    const deleteBtn = event.target.closest("[data-delete-task]");
    const toggleBtn = event.target.closest("[data-toggle-task]");
    const completeBtn = event.target.closest("[data-complete-task]");

    if (editBtn) {
      const task = state.tasks.find((item) => item.id === editBtn.dataset.editTask);
      if (!task) return;
      state.editingId = task.id;
      $("taskFormTitle").textContent = "编辑任务";
      $("taskSaveBtn").textContent = "保存修改";
      $("taskTitle").value = task.title;
      $("taskRole").value = task.role;
      $("taskDescription").value = task.description || "";
      $("taskEnabled").checked = task.enabled;
      applyScheduleToForm(scheduler().normalizeSchedule(task.schedule));
      $("taskTitle").focus();
      return;
    }

    if (deleteBtn) {
      await storage().deleteTask(deleteBtn.dataset.deleteTask);
      await refreshTasks();
      return;
    }

    if (toggleBtn) {
      const task = state.tasks.find((item) => item.id === toggleBtn.dataset.toggleTask);
      if (!task) return;
      await storage().saveTask(scheduler().toggleTask(task));
      await refreshTasks();
      return;
    }

    if (completeBtn) {
      const task = state.tasks.find((item) => item.id === completeBtn.dataset.completeTask);
      if (!task) return;
      await storage().saveTask(scheduler().completeTask(task));
      await refreshTasks();
    }
  }

  async function checkDueTasks({ openedPage }) {
    const now = new Date();
    const dueTasks = state.tasks.filter((task) => {
      if (!scheduler().isDue(task, now)) return false;
      if (openedPage) return true;
      if (!task.lastTriggeredAt || !task.nextDueAt) return true;
      return new Date(task.lastTriggeredAt) < new Date(task.nextDueAt);
    });
    if (!dueTasks.length) return;
    state.alertQueue = dueTasks;
    showAlert(dueTasks, openedPage);
    const triggered = dueTasks.map((task) => scheduler().markTriggered(task));
    await storage().bulkSave(triggered);
    await refreshTasks();
  }

  function showAlert(tasks, openedPage) {
    const modal = $("taskAlertModal");
    const body = $("taskAlertBody");
    if (!modal || !body) return;
    body.innerHTML = [
      `<p>${openedPage ? "页面打开时发现错过或已到期的任务：" : "发现到期任务："}</p>`,
      ...tasks.map((task) => `<p><strong>${safeText(task.title)}</strong> · ${safeText(task.role)} · ${safeText(scheduler().formatDue(task.nextDueAt))}</p>`)
    ].join("");
    modal.hidden = false;
  }

  function closeAlert() {
    const modal = $("taskAlertModal");
    if (modal) modal.hidden = true;
  }

  async function completeAlertTasks() {
    const completed = state.alertQueue.map((task) => scheduler().completeTask(task));
    await storage().bulkSave(completed);
    state.alertQueue = [];
    closeAlert();
    await refreshTasks();
  }

  function sortTasks(a, b) {
    if (!a.enabled && b.enabled) return 1;
    if (a.enabled && !b.enabled) return -1;
    const aDue = a.nextDueAt ? new Date(a.nextDueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.nextDueAt ? new Date(b.nextDueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  }

  window.HugeToolsTaskReminderUI = { init };
})();
