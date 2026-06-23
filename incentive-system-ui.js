(function () {
  const engine = () => window.HugeToolsIncentiveEngine;
  const state = {
    data: null,
    view: "today",
    editingTaskId: null
  };

  const $ = (id) => document.getElementById(id);
  const safeText = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  async function init() {
    if (!$("incentivePanel")) return;
    state.data = await engine().ensureState();
    state.data = engine().generateRecords(state.data, new Date());
    bind();
    populateEmployeeOptions();
    resetTaskForm();
    render();
  }

  function bind() {
    document.querySelectorAll("[data-incentive-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.incentiveView;
        render();
      });
    });
    $("incentiveRoleFilter")?.addEventListener("change", render);
    $("incentiveEmployeeFilter")?.addEventListener("change", render);
    $("incentiveMyEmployee")?.addEventListener("change", render);
    $("incentiveRecordList")?.addEventListener("click", handleRecordAction);
    $("incentiveTaskForm")?.addEventListener("submit", handleTaskSubmit);
    $("incentiveTaskResetBtn")?.addEventListener("click", resetTaskForm);
    $("incentiveTaskList")?.addEventListener("click", handleTaskAction);
    $("incentiveTaskRole")?.addEventListener("change", syncOwnerOptions);
    $("incentiveTaskCycle")?.addEventListener("change", renderCycleFields);
  }

  function populateEmployeeOptions() {
    const employeeOptions = state.data.employees.map((employee) => (
      `<option value="${safeText(employee.id)}">${safeText(employee.name)} · ${safeText(employee.role)}</option>`
    )).join("");
    $("incentiveEmployeeFilter").innerHTML = `<option value="all">全部员工</option>${employeeOptions}`;
    $("incentiveMyEmployee").innerHTML = employeeOptions;
    syncOwnerOptions();
  }

  function syncOwnerOptions() {
    const role = $("incentiveTaskRole").value;
    const employees = state.data.employees.filter((employee) => employee.role === role);
    $("incentiveTaskOwner").innerHTML = employees.map((employee) => (
      `<option value="${safeText(employee.id)}">${safeText(employee.name)}</option>`
    )).join("");
  }

  function render() {
    document.querySelectorAll("[data-incentive-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.incentiveView === state.view);
    });
    document.querySelectorAll("[data-incentive-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.incentivePanel !== state.view;
    });
    renderSummary();
    renderToday();
    renderMyScore();
    renderLeaderboard();
    renderTaskManagement();
  }

  function renderSummary() {
    const board = engine().leaderboard(state.data);
    const records = state.data.records;
    const pending = records.filter((record) => record.status === "pending").length;
    const missed = records.filter((record) => record.status === "missed" || record.omitted).length;
    const avgScore = records.length ? Math.round(records.reduce((sum, record) => sum + record.score, 0) / records.length) : 0;
    const totalPoints = records.reduce((sum, record) => sum + record.points, 0);
    $("incentiveSummary").innerHTML = [
      metric("待执行记录", pending, pending ? "warn" : "good"),
      metric("遗漏记录", missed, missed ? "bad" : "good"),
      metric("平均评分", avgScore, avgScore >= 85 ? "good" : avgScore >= 70 ? "warn" : "bad"),
      metric("累计积分", totalPoints, totalPoints ? "good" : "warn")
    ].join("");
    $("incentiveTopPerformer").textContent = board[0] ? `${board[0].name} · ${board[0].points} 分` : "暂无排名";
  }

  function metric(label, value, level) {
    return `<article class="metric ${level}"><span>${safeText(label)}</span><strong>${safeText(value)}</strong></article>`;
  }

  function renderToday() {
    const role = $("incentiveRoleFilter").value;
    const employeeId = $("incentiveEmployeeFilter").value;
    const records = engine().todayRecords(state.data).filter((record) => {
      if (role !== "all" && record.role !== role) return false;
      if (employeeId !== "all" && record.employeeId !== employeeId) return false;
      return true;
    }).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    const target = $("incentiveRecordList");
    if (!records.length) {
      target.innerHTML = `<div class="task-empty">当前筛选下暂无执行记录。</div>`;
      return;
    }
    target.innerHTML = records.map((record) => {
      const task = state.data.tasks.find((item) => item.id === record.taskId);
      const employee = state.data.employees.find((item) => item.id === record.employeeId);
      return `
        <article class="incentive-record ${record.status}">
          <div>
            <span class="task-state">${safeText(engine().STATUS_LABELS[record.status])}</span>
            <h3>${safeText(task?.title || "未知任务")}</h3>
            <p>${safeText(task?.description || "")}</p>
            <p><strong>执行标准：</strong>${safeText(task?.qualityStandard || "按门店标准执行")}</p>
          </div>
          <div class="incentive-record-grid">
            <label>负责人<input value="${safeText(employee?.name || "-")}" disabled></label>
            <label>角色<input value="${safeText(record.role)}" disabled></label>
            <label>截止时间<input value="${safeText(formatDateTime(record.dueAt))}" disabled></label>
            <label>完成时间<input type="datetime-local" data-record-completed="${safeText(record.id)}" value="${safeText(toLocalInput(record.completedAt))}"></label>
            <label>质量分<input type="number" min="0" max="100" step="1" data-record-quality="${safeText(record.id)}" value="${safeText(record.qualityScore)}"></label>
            <label>状态
              <select data-record-status="${safeText(record.id)}">
                <option value="pending"${record.status === "pending" ? " selected" : ""}>待执行</option>
                <option value="completed"${record.status === "completed" ? " selected" : ""}>已完成</option>
                <option value="missed"${record.status === "missed" ? " selected" : ""}>遗漏</option>
              </select>
            </label>
            <label class="checkbox-label"><input type="checkbox" data-record-omitted="${safeText(record.id)}"${record.omitted ? " checked" : ""}>存在遗漏</label>
            <label>备注<input data-record-note="${safeText(record.id)}" value="${safeText(record.note || "")}"></label>
          </div>
          <div class="incentive-score-strip">
            <strong>评分 ${record.score}</strong>
            <strong>积分 +${record.points}</strong>
            <button class="primary-button" type="button" data-save-record="${safeText(record.id)}">保存执行记录</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderMyScore() {
    const employeeId = $("incentiveMyEmployee").value || state.data.employees[0]?.id;
    const employee = state.data.employees.find((item) => item.id === employeeId) || state.data.employees[0];
    const boardItem = engine().leaderboard(state.data).find((item) => item.id === employee?.id);
    const records = state.data.records.filter((record) => record.employeeId === employee?.id)
      .sort((a, b) => new Date(b.dueAt) - new Date(a.dueAt));
    $("incentiveMyScoreSummary").innerHTML = [
      metric("我的积分", boardItem?.points || 0, "good"),
      metric("平均评分", boardItem?.avgScore || 0, (boardItem?.avgScore || 0) >= 85 ? "good" : "warn"),
      metric("准时率", `${boardItem?.onTimeRate || 0}%`, (boardItem?.onTimeRate || 0) >= 90 ? "good" : "warn"),
      metric("激励标签", boardItem?.rankLevel || "暂无", "good")
    ].join("");
    $("incentiveMyScoreList").innerHTML = records.length ? records.map((record) => {
      const task = state.data.tasks.find((item) => item.id === record.taskId);
      return `<p><strong>${safeText(task?.title || "未知任务")}</strong> · ${safeText(formatDateTime(record.dueAt))} · 评分 ${record.score} · 积分 ${record.points} · ${safeText(engine().STATUS_LABELS[record.status])}</p>`;
    }).join("") : "<p>暂无执行记录。</p>";
  }

  function renderLeaderboard() {
    const board = engine().leaderboard(state.data);
    $("incentiveLeaderboard").innerHTML = board.map((item, index) => `
      <article class="leaderboard-row">
        <strong>${index + 1}</strong>
        <div>
          <h3>${safeText(item.name)} <span>${safeText(item.role)}</span></h3>
          <p>${safeText(item.rankLevel)} · 完成 ${item.completed}/${item.records} · 遗漏 ${item.missed}</p>
        </div>
        <div>
          <b>${item.points}</b>
          <span>平均 ${item.avgScore} / 准时 ${item.onTimeRate}%</span>
        </div>
      </article>
    `).join("");
  }

  function renderTaskManagement() {
    const tasks = state.data.tasks;
    $("incentiveTaskList").innerHTML = tasks.map((task) => {
      const employee = state.data.employees.find((item) => item.id === task.ownerId);
      return `
        <article class="task-card ${task.active ? "future" : "inactive"}">
          <div class="task-card-main">
            <div>
              <span class="task-state">${task.active ? "启用" : "停用"}</span>
              <h3>${safeText(task.title)}</h3>
              <p>${safeText(task.description || "无说明")}</p>
            </div>
            <dl>
              <div><dt>角色</dt><dd>${safeText(task.role)}</dd></div>
              <div><dt>负责人</dt><dd>${safeText(employee?.name || "-")}</dd></div>
              <div><dt>周期</dt><dd>${safeText(cycleLabel(task))}</dd></div>
              <div><dt>基础积分</dt><dd>${safeText(task.basePoints)}</dd></div>
            </dl>
          </div>
          <div class="task-actions">
            <button class="text-button" type="button" data-edit-incentive-task="${safeText(task.id)}">编辑</button>
            <button class="text-button danger" type="button" data-delete-incentive-task="${safeText(task.id)}">删除</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function handleRecordAction(event) {
    const button = event.target.closest("[data-save-record]");
    if (!button) return;
    const id = button.dataset.saveRecord;
    const status = document.querySelector(`[data-record-status="${CSS.escape(id)}"]`).value;
    const completedInput = document.querySelector(`[data-record-completed="${CSS.escape(id)}"]`).value;
    const qualityScore = Number(document.querySelector(`[data-record-quality="${CSS.escape(id)}"]`).value) || 0;
    const omitted = document.querySelector(`[data-record-omitted="${CSS.escape(id)}"]`).checked;
    const note = document.querySelector(`[data-record-note="${CSS.escape(id)}"]`).value;
    state.data = engine().updateRecord(state.data, id, {
      status,
      completedAt: status === "completed" ? new Date(completedInput || Date.now()).toISOString() : null,
      qualityScore,
      omitted,
      note
    });
    render();
  }

  function handleTaskSubmit(event) {
    event.preventDefault();
    state.data = engine().upsertTask(state.data, {
      id: state.editingTaskId || undefined,
      title: $("incentiveTaskTitle").value,
      role: $("incentiveTaskRole").value,
      ownerId: $("incentiveTaskOwner").value,
      cycle: $("incentiveTaskCycle").value,
      dueTime: $("incentiveTaskDueTime").value,
      dueWeekday: Number($("incentiveTaskWeekday").value),
      dueMonthDay: $("incentiveTaskMonthDay").value === "last" ? "last" : Number($("incentiveTaskMonthDay").value),
      basePoints: Number($("incentiveTaskPoints").value),
      description: $("incentiveTaskDescription").value,
      qualityStandard: $("incentiveTaskStandard").value,
      active: $("incentiveTaskActive").checked
    });
    state.data = engine().generateRecords(state.data, new Date());
    resetTaskForm();
    render();
  }

  function handleTaskAction(event) {
    const editButton = event.target.closest("[data-edit-incentive-task]");
    const deleteButton = event.target.closest("[data-delete-incentive-task]");
    if (editButton) {
      const task = state.data.tasks.find((item) => item.id === editButton.dataset.editIncentiveTask);
      if (!task) return;
      state.editingTaskId = task.id;
      $("incentiveTaskTitle").value = task.title;
      $("incentiveTaskRole").value = task.role;
      syncOwnerOptions();
      $("incentiveTaskOwner").value = task.ownerId;
      $("incentiveTaskCycle").value = task.cycle;
      $("incentiveTaskDueTime").value = task.dueTime;
      $("incentiveTaskWeekday").value = task.dueWeekday;
      $("incentiveTaskMonthDay").value = task.dueMonthDay;
      $("incentiveTaskPoints").value = task.basePoints;
      $("incentiveTaskDescription").value = task.description;
      $("incentiveTaskStandard").value = task.qualityStandard;
      $("incentiveTaskActive").checked = task.active;
      $("incentiveTaskSaveBtn").textContent = "保存修改";
      renderCycleFields();
    }
    if (deleteButton) {
      state.data = engine().deleteTask(state.data, deleteButton.dataset.deleteIncentiveTask);
      render();
    }
  }

  function resetTaskForm() {
    state.editingTaskId = null;
    $("incentiveTaskTitle").value = "";
    $("incentiveTaskRole").value = "店长";
    syncOwnerOptions();
    $("incentiveTaskCycle").value = "daily";
    $("incentiveTaskDueTime").value = "18:00";
    $("incentiveTaskWeekday").value = "5";
    $("incentiveTaskMonthDay").value = "last";
    $("incentiveTaskPoints").value = "10";
    $("incentiveTaskDescription").value = "";
    $("incentiveTaskStandard").value = "";
    $("incentiveTaskActive").checked = true;
    $("incentiveTaskSaveBtn").textContent = "保存任务";
    renderCycleFields();
  }

  function renderCycleFields() {
    const cycle = $("incentiveTaskCycle").value;
    document.querySelectorAll("[data-incentive-cycle-field]").forEach((field) => {
      field.hidden = field.dataset.incentiveCycleField !== cycle;
    });
  }

  function cycleLabel(task) {
    if (task.cycle === "weekly") return `每周${"一二三四五六日"[Number(task.dueWeekday || 5) - 1]} ${task.dueTime}`;
    if (task.cycle === "monthly") return `每月${task.dueMonthDay === "last" ? "最后一天" : `${task.dueMonthDay}日`} ${task.dueTime}`;
    return `每天 ${task.dueTime}`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function toLocalInput(value) {
    if (!value) return "";
    const date = new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  window.HugeToolsIncentiveUI = { init };
})();
