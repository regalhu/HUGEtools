(function () {
  const STORAGE_KEY = "hugetools.operations-workbench.v1";
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const emptyState = () => ({
    meetings: [],
    logs: [],
    resources: [],
    training: []
  });

  const byId = (id) => document.getElementById(id);
  const safeText = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  let readable = true;
  let state = loadState();
  let currentView = "overview";
  let overviewRequest = 0;
  const TASK_READ_TIMEOUT_MS = 1500;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const next = { ...emptyState(), ...saved };
      if (!Object.keys(emptyState()).every(key => Array.isArray(next[key]))) throw new Error("记录格式损坏");
      readable = true;
      return next;
    } catch {
      readable = false;
      return emptyState();
    }
  }

  function saveState(next) {
    if (!readable) { window.alert("原记录读取失败，已停止保存。请先核对备份，避免覆盖旧数据。"); return false; }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); state = next; return true; }
    catch (_) { window.alert("保存未完成，请检查本机空间并备份记录。"); return false; }
  }

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function dateLabel(value) {
    return String(value || "").replace(/-/g, "");
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function setView(view) {
    currentView = view;
    document.querySelectorAll("[data-workbench-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.workbenchView === view);
    });
    document.querySelectorAll("[data-workbench-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.workbenchPanel !== view;
    });
    renderAll();
  }

  function openTool(tool) {
    const tab = document.querySelector(`.tool-tab[data-tool="${tool}"]`);
    tab?.click();
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  async function taskSnapshot() {
    const unavailable = { total: null, active: null, overdue: null };
    const storage = window.HugeToolsTaskStorage;
    if (typeof storage?.listTasks !== "function") return unavailable;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(unavailable), TASK_READ_TIMEOUT_MS);
      // IndexedDB can remain blocked without rejecting. Keep this optional source
      // bounded so the overview and daily report remain usable.
      Promise.resolve().then(() => storage.listTasks()).then((tasks) => {
        if (!Array.isArray(tasks) || tasks.some(item => !item || typeof item !== "object")) return finish(unavailable);
        const now = Date.now();
        finish({
          total: tasks.length,
          active: tasks.filter((item) => item.enabled).length,
          overdue: tasks.filter((item) => item.enabled && item.nextDueAt && new Date(item.nextDueAt).getTime() < now).length
        });
      }).catch(() => finish(unavailable));
    });
  }

  function incentiveSnapshot() {
    try {
      const saved = localStorage.getItem("hugetools.incentiveSystem.v1");
      if (!saved) return { pending: 0, missed: 0 };
      const data = JSON.parse(saved);
      if (!Array.isArray(data.records)) throw new Error("评分记录不可读");
      return { pending: data.records.filter(item => item.status === "pending").length, missed: data.records.filter(item => item.status === "missed" || item.omitted).length };
    } catch (_) { return { pending: null, missed: null }; }
  }

  async function renderOverview() {
    const target = byId("workbenchSummary");
    if (!target) return;
    const request = ++overviewRequest;
    const incentive = incentiveSnapshot();
    const todayKey = today();
    const todayMeetings = readable ? state.meetings.filter((item) => item.date === todayKey).length : null;
    const todayLogs = readable ? state.logs.filter((item) => item.date === todayKey).length : null;
    const unresolvedTopics = readable ? state.meetings.filter((item) => !["已完成", "完成"].includes(item.progress)).length : null;
    const paint = (tasks, loading) => {
      const missing = loading ? "读取中" : "未读取";
      target.innerHTML = [
        metric("今日会议", todayMeetings ?? "未读取", todayMeetings ? "good" : "warn"),
        metric("今日日志", todayLogs ?? "未读取", todayLogs ? "good" : "warn"),
        metric("待跟进议题", unresolvedTopics ?? "未读取", unresolvedTopics === 0 ? "good" : "warn"),
        metric("启用任务", tasks.active ?? missing, tasks.active === null ? "warn" : tasks.overdue ? "bad" : "good"),
        metric("逾期任务", tasks.overdue ?? missing, tasks.overdue === null ? "warn" : tasks.overdue ? "bad" : "good"),
        metric("待执行评分", incentive.pending ?? "未读取", incentive.missed ? "bad" : "warn")
      ].join("");
      const hint = byId("workbenchTodayHint");
      if (hint) hint.textContent = (readable ? `经营日 ${dateLabel(todayKey)} · 数据仅保存在当前浏览器` : "原记录读取失败，保存已锁定，请核对备份。") + (loading ? " · 任务统计读取中" : tasks.active === null ? " · 任务存储未读取，可稍后重新打开总览" : "");
    };
    paint({ active: null, overdue: null }, true);
    const tasks = await taskSnapshot();
    if (request === overviewRequest) paint(tasks, false);
  }

  function metric(label, value, level) {
    return `<article class="metric ${level || ""}"><span>${safeText(label)}</span><strong>${safeText(value)}</strong></article>`;
  }

  function renderMeetings() {
    renderCollection("workbenchMeetingList", state.meetings, (item) => `
      <article class="workbench-record">
        <div>
          <span class="status-pill">${safeText(dateLabel(item.date))} ${safeText(item.period)}</span>
          <h3>${safeText(item.title)}</h3>
          <p>${safeText(item.summary || "未填写会议摘要")}</p>
          <p><strong>议题：</strong>${safeText(item.topic || "未填写")}　<strong>负责人：</strong>${safeText(item.owner || "未指定")}</p>
          <p><strong>计划完成：</strong>${safeText(dateLabel(item.dueDate) || "未设置")}　<strong>进度：</strong>${safeText(item.progress || "待开始")}</p>
        </div>
        <button class="text-button danger" type="button" data-delete-workbench="meetings" data-id="${safeText(item.id)}">删除</button>
      </article>
    `, "暂无会议纪要。");
  }

  function renderLogs() {
    renderCollection("workbenchLogList", state.logs, (item) => `
      <article class="workbench-record">
        <div>
          <span class="status-pill">${safeText(dateLabel(item.date))}</span>
          <h3>${safeText(item.title || "每日日志")}</h3>
          <p><strong>完成：</strong>${safeText(item.completed || "未填写")}</p>
          <p><strong>问题：</strong>${safeText(item.issue || "无记录")}</p>
          <p><strong>明日重点：</strong>${safeText(item.next || "未填写")}</p>
        </div>
        <button class="text-button danger" type="button" data-delete-workbench="logs" data-id="${safeText(item.id)}">删除</button>
      </article>
    `, "暂无每日日志。");
  }

  function renderResources() {
    renderCollection("workbenchResourceList", state.resources, (item) => `
      <article class="workbench-record">
        <div>
          <span class="status-pill">${safeText(item.category || "未分类")}</span>
          <h3>${safeText(item.title)}</h3>
          <p>${safeText(item.content || "未填写内容")}</p>
          <p><strong>来源：</strong>${safeText(item.source || "未记录")}</p>
        </div>
        <button class="text-button danger" type="button" data-delete-workbench="resources" data-id="${safeText(item.id)}">删除</button>
      </article>
    `, "暂无资料记录。");
  }

  function renderTraining() {
    renderCollection("workbenchTrainingList", state.training, (item) => `
      <article class="workbench-record">
        <div>
          <span class="status-pill">${safeText(dateLabel(item.date))} · ${safeText(item.score || "未评分")} 分</span>
          <h3>${safeText(item.session)}</h3>
          <p><strong>讲师：</strong>${safeText(item.trainer || "未填写")}　<strong>需复训：</strong>${safeText(item.retrain || "否")}</p>
          <p>${safeText(item.feedback || "未填写反馈")}</p>
        </div>
        <button class="text-button danger" type="button" data-delete-workbench="training" data-id="${safeText(item.id)}">删除</button>
      </article>
    `, "暂无培训反馈。");
  }

  function renderCollection(targetId, items, renderer, emptyText) {
    const target = byId(targetId);
    if (!target) return;
    target.innerHTML = items.length ? items.map(renderer).join("") : `<div class="task-empty">${safeText(emptyText)}</div>`;
  }

  async function buildReport() {
    const selectedDate = byId("workbenchReportDate")?.value || today();
    const tasks = await taskSnapshot();
    const incentive = await incentiveSnapshot();
    const meetings = state.meetings.filter((item) => item.date === selectedDate);
    const logs = state.logs.filter((item) => item.date === selectedDate);
    const training = state.training.filter((item) => item.date === selectedDate);
    let executionText = "执行闭环记录未读取";
    try {
      const core = window.HugeOperationsCore;
      const execution = core.summarize(core.readState(localStorage.getItem(core.STORAGE_KEY)).tasks);
      executionText = `执行闭环 ${execution.total} 项；未完成 ${execution.unfinished} 项；逾期 ${execution.overdue} 项；已完成 ${execution.complete} 项`;
    } catch (_) { /* Preserve an explicit missing state for unreadable execution data. */ }
    const lines = [
      `胡哥餐饮工具｜每日营运简报｜${dateLabel(selectedDate)}`,
      "",
      "一、当日总览",
      `会议 ${meetings.length} 场；日志 ${logs.length} 条；培训反馈 ${training.length} 条。`,
      `当前快照（非历史回溯）：启用任务 ${tasks.active ?? "未读取"} 项；逾期任务 ${tasks.overdue ?? "未读取"} 项；待执行评分 ${incentive.pending ?? "未读取"} 项。`,
      "",
      `执行闭环当前快照（非历史回溯）：${executionText}。`,
      "",
      "二、会议与议题",
      ...(meetings.length ? meetings.map((item, index) => `${index + 1}. ${item.title}（${item.period}）｜议题：${item.topic || "未填写"}｜负责人：${item.owner || "未指定"}｜计划完成：${dateLabel(item.dueDate) || "未设置"}｜进度：${item.progress || "待开始"}`) : ["当日无会议记录。"]),
      "",
      "三、工作日志",
      ...(logs.length ? logs.map((item, index) => `${index + 1}. ${item.title || "每日日志"}｜完成：${item.completed || "未填写"}｜问题：${item.issue || "无记录"}｜明日重点：${item.next || "未填写"}`) : ["当日无日志记录。"]),
      "",
      "四、培训反馈",
      ...(training.length ? training.map((item, index) => `${index + 1}. ${item.session}｜评分：${item.score || "未评分"}｜需复训：${item.retrain || "否"}｜${item.feedback || "未填写反馈"}`) : ["当日无培训反馈。"]),
      "",
      "口径说明：本简报只汇总当前浏览器中的本地记录；未填写、未读取或缺失的数据不按 0 推断。"
    ];
    return lines.join("\n");
  }

  async function renderReport() {
    const target = byId("workbenchReportDraft");
    if (target) target.value = await buildReport();
  }

  function downloadReport() {
    const content = byId("workbenchReportDraft")?.value || "";
    const date = byId("workbenchReportDate")?.value || today();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `胡哥餐饮每日营运简报_${dateLabel(date)}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function copyReport() {
    await navigator.clipboard.writeText(byId("workbenchReportDraft")?.value || "");
    byId("workbenchReportStatus").textContent = "简报已复制。";
  }

  function printReport() {
    document.body.classList.add("printing-workbench-report");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-workbench-report"), 200);
  }

  function addRecord(collection, form, requiredField) {
    const payload = formData(form);
    if (!payload[requiredField]) return;
    if (!saveState({ ...state, [collection]: [{ id: uid(collection), ...payload }, ...state[collection]] })) return;
    form.reset();
    applyDefaultDates();
    renderAll();
  }

  function deleteRecord(collection, id) {
    if (!state[collection]) return;
    if (!window.confirm("确认删除这条本机记录？建议先导出备份。")) return;
    if (!saveState({ ...state, [collection]: state[collection].filter((item) => item.id !== id) })) return;
    renderAll();
  }

  function applyDefaultDates() {
    ["meetingDate", "meetingTopicDueDate", "workLogDate", "trainingDate", "workbenchReportDate"].forEach((id) => {
      const input = byId(id);
      if (input && !input.value) input.value = today();
    });
  }

  async function renderAll() {
    renderMeetings();
    renderLogs();
    renderResources();
    renderTraining();
    await renderOverview();
    if (currentView === "report") await renderReport();
  }

  function bind() {
    document.querySelectorAll("[data-workbench-view]").forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.workbenchView));
    });
    document.querySelectorAll("[data-open-tool]").forEach((button) => {
      button.addEventListener("click", () => openTool(button.dataset.openTool));
    });
    byId("workbenchMeetingForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      addRecord("meetings", event.currentTarget, "title");
    });
    byId("workbenchLogForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      addRecord("logs", event.currentTarget, "completed");
    });
    byId("workbenchResourceForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      addRecord("resources", event.currentTarget, "title");
    });
    byId("workbenchTrainingForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      addRecord("training", event.currentTarget, "session");
    });
    byId("tool-operations")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-workbench]");
      if (button) deleteRecord(button.dataset.deleteWorkbench, button.dataset.id);
    });
    byId("workbenchReportDate")?.addEventListener("change", renderReport);
    byId("buildWorkbenchReportBtn")?.addEventListener("click", renderReport);
    byId("downloadWorkbenchReportBtn")?.addEventListener("click", downloadReport);
    byId("copyWorkbenchReportBtn")?.addEventListener("click", copyReport);
    byId("printWorkbenchReportBtn")?.addEventListener("click", printReport);
  }

  function mount() {
    if (!byId("tool-operations")) return;
    bind();
    applyDefaultDates();
    setView("overview");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  window.HugeToolsOperationsWorkbench = {
    loadState,
    buildReport
  };
})();
