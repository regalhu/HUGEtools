(function () {
  "use strict";
  function start() {
    const root = document.getElementById("operationsCenterRoot");
    if (!root) return;
    const core = window.HugeOperationsCore;
    if (!core) { root.textContent = "营运闭环模块未加载，请刷新后重试。"; return; }
    const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
    let state = { version: 1, tasks: [] };
    let readFailed = false;
    let initialError = "";
    let editor = null;
    let filters = { query: "", store: "", department: "", owner: "", source: "", status: "", overdue: false };
    try { state = core.readState(localStorage.getItem(core.STORAGE_KEY)); }
    catch (error) { readFailed = true; initialError = `读取失败：${error.message}。已暂停保存，请先在备份中心导出原数据。`; }
    const find = (selector) => root.querySelector(selector);
    const visibleTasks = () => core.filterTasks(state.tasks, filters);
    function message(text, error) {
      const box = find(".oc-feedback");
      box.textContent = text;
      box.classList.toggle("is-error", !!error);
      box.hidden = !text;
    }
    function persist(tasks, success) {
      if (readFailed) { message(initialError, true); return false; }
      try {
        const next = core.saveState({ ...state, tasks }, (key, value) => localStorage.setItem(key, JSON.stringify(value)));
        state = next;
        renderFilters();
        renderContent();
        message(success || "已保存到当前浏览器。", false);
        return true;
      } catch (error) { message(`保存失败，未覆盖已有记录：${error.message}`, true); return false; }
    }
    function options(items, selected, label) {
      return `<option value="">${esc(label)}</option>` + items.map((item) => {
        const value = typeof item === "string" ? item : item.value;
        const text = typeof item === "string" ? item : item.label;
        return `<option value="${esc(value)}" ${selected === value ? "selected" : ""}>${esc(text)}</option>`;
      }).join("");
    }
    function renderFilters() {
      const distinct = (values) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh"));
      const sources = new Map();
      state.tasks.forEach((t) => t.sources.forEach((s) => sources.set(s.key, { value: s.key, label: `${s.title}${s.date ? ` · ${s.date}` : ""}` })));
      find('[data-filter="store"]').innerHTML = options(distinct(state.tasks.map((t) => t.store)), filters.store, "全部门店");
      find('[data-filter="department"]').innerHTML = options(distinct(state.tasks.map((t) => t.department)), filters.department, "全部部门 / 中心");
      find('[data-filter="owner"]').innerHTML = options(distinct(state.tasks.flatMap((t) => t.assignees.map((a) => a.name))), filters.owner, "全部负责人");
      find('[data-filter="source"]').innerHTML = options(Array.from(sources.values()), filters.source, "全部会议来源");
      ["store", "department", "owner", "source"].forEach((key) => { if (filters[key] && !find(`[data-filter="${key}"]`).value) filters[key] = ""; });
    }
    function renderRanks(summary) {
      const rank = (items, kind) => items.length ? `<div class="oc-rank-table"><div class="oc-rank-row oc-rank-head"><span>${kind}</span><span>完成 / 总数</span><span>完成率</span><span>逾期</span></div>${items.map((r, index) => `<div class="oc-rank-row"><strong><small>${index + 1}</small>${esc(r.name)}</strong><span>${r.completed} / ${r.total}</span><b>${r.rate}%</b><span class="${r.overdue ? "oc-danger" : ""}">${r.overdue}</span></div>`).join("")}</div>` : `<p class="oc-empty">当前范围暂无${kind}记录。</p>`;
      find(".oc-people").innerHTML = rank(summary.people, "负责人");
      find(".oc-departments").innerHTML = rank(summary.departments, "部门 / 中心");
    }
    function renderContent() {
      const tasks = visibleTasks();
      const summary = core.summarize(tasks);
      find(".oc-count").textContent = `${tasks.length} 项 / 全部 ${state.tasks.length} 项`;
      find(".oc-metrics").innerHTML = [["待完成", summary.unfinished], ["逾期", summary.overdue], ["已完成", summary.complete], ["待分配", summary.unassigned]].map(([label, count]) => `<div><span>${label}</span><strong>${count}</strong></div>`).join("");
      find(".oc-carry-count").textContent = summary.unfinished;
      find('[data-action="carry"]').disabled = !summary.unfinished || readFailed;
      root.querySelectorAll('[data-action^="export"]').forEach((button) => { button.disabled = !tasks.length; });
      find(".oc-task-list").innerHTML = tasks.length ? tasks.map((task) => {
        const s = core.status(task);
        return `<article class="oc-task ${s.overdue ? "oc-task-overdue" : ""}">
          <div class="oc-task-top"><div><div class="oc-eyebrow">${esc(task.store || "门店未填写")} <span> / </span> ${esc(task.department || "部门未填写")}</div><h3>${esc(task.title)}</h3></div><button class="oc-text-button" type="button" data-action="edit" data-id="${esc(task.id)}">编辑</button></div>
          <div class="oc-task-meta"><span class="oc-status ${s.code}">${s.label}</span>${s.overdue ? '<span class="oc-status overdue">已逾期</span>' : ""}<span>到期 ${esc(task.dueDate || "未设置")}</span><span>负责人完成 ${s.completed} / ${s.total}</span></div>
          <div class="oc-progress-track"><i style="width:${s.percent}%"></i></div>
          <div class="oc-assignees">${task.assignees.length ? task.assignees.map((a) => `<div class="oc-assignee"><strong>${esc(a.name)}</strong><label class="oc-sr-only" for="oc-progress-${esc(task.id)}-${task.assignees.indexOf(a)}">${esc(a.name)}的进度</label><select id="oc-progress-${esc(task.id)}-${task.assignees.indexOf(a)}" data-progress="${esc(task.id)}" data-owner="${esc(a.name)}" ${readFailed ? "disabled" : ""}>${[[0, "待开始"], [50, "进行中"], [100, "已完成"]].map(([v, label]) => `<option value="${v}" ${a.progress === v ? "selected" : ""}>${label}</option>`).join("")}</select><input aria-label="${esc(a.name)}的进展备注" value="${esc(a.note)}" placeholder="个人进展备注" data-note="${esc(task.id)}" data-owner="${esc(a.name)}" ${readFailed ? "disabled" : ""}></div>`).join("") : '<p class="oc-hint">尚未指定负责人。编辑事项后可分别跟进每个人的进度。</p>'}</div>
          <details class="oc-details"><summary>查看 PDCA 与来源 <span>${task.sources.length ? `${task.sources.length} 条来源` : "手工录入"}</span></summary><div class="oc-pdca">${[["P", "问题 / 目标", task.plan], ["D", "执行措施", task.do], ["C", "检查结果", task.check], ["A", "标准化 / 下一步", task.act]].map(([letter, label, value]) => `<section><b>${letter}</b><div><h4>${label}</h4><p>${esc(value || "待补充")}</p></div></section>`).join("")}</div><div class="oc-sources">${task.sources.length ? task.sources.map((s) => `<div><strong>${esc(s.title)}</strong><span>${esc(s.date)}</span><p>${esc(s.reference || "未填写引用说明")}</p></div>`).join("") : '<p class="oc-hint">本事项为手工录入，可在编辑中补充会议或材料来源。</p>'}</div></details>
        </article>`;
      }).join("") : `<div class="oc-empty oc-empty-large"><div>从一次会议，走到一次改善</div><p>${state.tasks.length ? "当前筛选没有匹配事项，调整条件可查看其他记录。" : "新增执行事项，或从本机已保存的会议导入待办。每位负责人有独立进度，全部完成后事项才完成。"}</p></div>`;
      renderRanks(summary);
    }
    function field(name, label, value, wide, type) {
      return `<label class="${wide ? "oc-wide" : ""}"><span>${label}</span>${type === "textarea" ? `<textarea name="${name}" rows="3">${esc(value)}</textarea>` : `<input name="${name}" value="${esc(value)}" type="${type || "text"}" ${name === "title" ? "required" : ""}>`}</label>`;
    }
    function renderEditor() {
      const host = find(".oc-editor-host");
      if (!editor) { host.innerHTML = ""; return; }
      const t = editor;
      host.innerHTML = `<form class="oc-editor"><div class="oc-section-heading"><div><span class="oc-eyebrow">执行事项</span><h3>${t.id ? "编辑与复盘" : "新建改善行动"}</h3></div><button type="button" class="oc-text-button" data-action="cancel">收起</button></div><div class="oc-form-grid">
        ${field("title", "事项名称 *", t.title, true)}${field("store", "门店", t.store)}${field("department", "部门 / 中心", t.department)}${field("owners", "负责人（多人用顿号、逗号或换行分隔）", t.owners, true)}${field("dueDate", "到期日", t.dueDate, false, "date")}
        <p class="oc-hint">同名负责人将合并。编辑保留未改名人员的进度；新增人员从待开始记录。</p>
        ${field("plan", "P · 问题 / 目标", t.plan, true, "textarea")}${field("do", "D · 执行措施", t.do, true, "textarea")}${field("check", "C · 检查结果", t.check, true, "textarea")}${field("act", "A · 标准化 / 下一步", t.act, true, "textarea")}
      </div><div class="oc-source-editor"><div class="oc-section-heading"><h4>会议与材料来源</h4><button type="button" class="oc-text-button" data-action="add-source">＋ 添加来源</button></div><p class="oc-hint">可关联多次会议；手工事项可留空。导入记录保留原引用。</p>${(t.sources || []).map((s, index) => `<div class="oc-source-row" data-source-index="${index}"><input name="sourceTitle" aria-label="来源名称" placeholder="会议 / 材料名称" value="${esc(s.title)}"><input name="sourceDate" aria-label="来源日期" type="date" value="${esc(s.date)}"><textarea name="sourceReference" aria-label="引用说明" placeholder="议题编号、原文或引用说明">${esc(s.reference)}</textarea><button type="button" class="oc-text-button oc-danger" data-action="remove-source" data-index="${index}">移除此来源</button></div>`).join("")}</div><div class="oc-actions"><button type="submit" class="oc-button oc-primary" ${readFailed ? "disabled" : ""}>保存事项</button><button type="button" class="oc-button" data-action="cancel">取消</button></div></form>`;
    }
    function collectEditor() {
      const form = find(".oc-editor");
      const values = Object.fromEntries(new FormData(form).entries());
      return { ...editor, ...values, sources: Array.from(form.querySelectorAll(".oc-source-row")).map((row) => ({ key: editor.sources[Number(row.dataset.sourceIndex)].key, title: row.querySelector('[name="sourceTitle"]').value, date: row.querySelector('[name="sourceDate"]').value, reference: row.querySelector('[name="sourceReference"]').value })) };
    }
    function exportFile(csv) {
      const tasks = visibleTasks();
      if (!tasks.length) return;
      const content = csv ? core.exportCsv(tasks) : core.exportText(tasks);
      const url = URL.createObjectURL(new Blob([content], { type: csv ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `胡哥餐饮工具-营运闭环-${core.today()}.${csv ? "csv" : "txt"}`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message(`已生成当前筛选范围 ${tasks.length} 项的${csv ? " CSV" : "文本"}文件，请在下载中查看。`);
    }
    root.classList.add("oc-center");
    root.innerHTML = `<header class="oc-hero"><div><span class="oc-eyebrow">胡哥餐饮工具 · 营运闭环</span><h2>让每件事，都有回音。</h2><p>会议待办 · 多人进度 · PDCA 复盘</p></div><span class="oc-local-tag">本机记录</span></header>
      <div class="oc-feedback" role="status" aria-live="polite" hidden></div>
      <div class="oc-toolbar"><button type="button" class="oc-button oc-primary" data-action="new" ${readFailed ? "disabled" : ""}>＋ 新建执行事项</button><button type="button" class="oc-button" data-action="import" ${readFailed ? "disabled" : ""}>导入会议未完成待办</button><span class="oc-hint">保留原会议；重复导入自动去重。</span></div>
      <div class="oc-editor-host"></div>
      <section class="oc-filter-panel"><div class="oc-section-heading"><h3>执行总览</h3><span class="oc-count"></span></div><div class="oc-filters"><input type="search" data-filter="query" placeholder="搜索事项、PDCA 或会议" aria-label="搜索事项"><select data-filter="store" aria-label="筛选门店"></select><select data-filter="department" aria-label="筛选部门"></select><select data-filter="owner" aria-label="筛选负责人"></select><select data-filter="source" aria-label="筛选会议"></select><select data-filter="status" aria-label="筛选整体状态"><option value="">全部状态</option><option value="unfinished">全部未完成</option><option value="unassigned">待分配</option><option value="pending">待开始</option><option value="active">进行中</option><option value="complete">已完成</option></select></div><div class="oc-filter-bottom"><label class="oc-check"><input type="checkbox" data-filter="overdue">只看逾期</label><button type="button" class="oc-text-button" data-action="reset">重置筛选</button><div class="oc-export-actions"><button type="button" class="oc-text-button" data-action="export-text">导出当前范围 · 文本</button><button type="button" class="oc-text-button" data-action="export-csv">CSV</button></div></div><div class="oc-metrics"></div></section>
      <details class="oc-carry-panel"><summary>延续到下一次会议 <span>继承当前范围未完成事项</span></summary><p class="oc-hint">把当前筛选的 <strong class="oc-carry-count">0</strong> 个未完成事项关联到本次会议；保留原事项、来源和各人进度。</p><div class="oc-carry-fields"><input name="carryTitle" aria-label="本次会议名称" placeholder="本次会议名称"><input name="carryDate" aria-label="本次会议日期" type="date" value="${core.today()}"><input name="carryReference" aria-label="本次会议引用" placeholder="本次议题 / 跟进说明"><button type="button" class="oc-button" data-action="carry">关联未完成事项</button></div></details>
      <div class="oc-task-list"></div>
      <section class="oc-rank-panel"><div class="oc-section-heading"><h3>执行看板</h3><span>跟随上方筛选范围</span></div><p class="oc-hint">仅统计本机实际记录。个人完成率 = 个人已完成责任项 ÷ 个人责任项总数；部门按整体事项完成计算。逾期以到期日次日为起点，未设到期日不计入逾期。</p><div class="oc-rank-columns"><section><h4>人员进度</h4><div class="oc-people"></div></section><section><h4>部门 / 中心进度</h4><div class="oc-departments"></div></section></div></section>
      <p class="oc-footnote">数据仅保存在当前浏览器，不会自动同步到小程序或其他设备。多人进度由本机维护；全部负责人完成，事项才显示已完成。已完成事项可调整个人进度重新打开。</p>`;
    root.addEventListener("input", (event) => {
      if (event.target.dataset.filter === "query") { filters.query = event.target.value; renderContent(); }
    });
    root.addEventListener("change", (event) => {
      const target = event.target;
      if (target.dataset.filter) {
        filters[target.dataset.filter] = target.type === "checkbox" ? target.checked : target.value;
        renderContent();
      }
      const taskId = target.dataset.progress || target.dataset.note;
      if (taskId) {
        const task = state.tasks.find((t) => t.id === taskId);
        const person = task && task.assignees.find((a) => a.name === target.dataset.owner);
        if (!person) { message("事项已变化，请重新打开后操作。", true); return; }
        const updated = core.setProgress(task, person.name, target.dataset.progress ? Number(target.value) : person.progress, target.dataset.note ? target.value : undefined);
        if (!persist(state.tasks.map((t) => t.id === taskId ? updated : t), "个人进度已保存，整体状态已重新汇总。")) renderContent();
      }
    });
    root.addEventListener("submit", (event) => {
      if (!event.target.classList.contains("oc-editor")) return;
      event.preventDefault();
      try {
        const input = collectEditor();
        const old = state.tasks.find((t) => t.id === input.id);
        const task = core.makeTask(input, old);
        if (persist(old ? state.tasks.map((t) => t.id === old.id ? task : t) : [task, ...state.tasks])) { editor = null; renderEditor(); }
      } catch (error) { message(error.message, true); }
    });
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.action;
      if (action === "new" || action === "edit") {
        const task = action === "edit" && state.tasks.find((t) => t.id === button.dataset.id);
        editor = task ? { ...task, owners: task.assignees.map((a) => a.name).join("、"), assignees: undefined, sources: task.sources.map((s) => ({ ...s })) } : { title: "", owners: "", sources: [], dueDate: "" };
        renderEditor(); find('.oc-editor [name="title"]').focus();
      } else if (action === "cancel") { editor = null; renderEditor(); }
      else if (action === "add-source" || action === "remove-source") {
        editor = collectEditor();
        if (action === "add-source") editor.sources.push({ key: core.uid("source"), title: "", date: "", reference: "" });
        else editor.sources.splice(Number(button.dataset.index), 1);
        renderEditor();
      } else if (action === "reset") {
        filters = { query: "", store: "", department: "", owner: "", source: "", status: "", overdue: false };
        root.querySelectorAll("[data-filter]").forEach((el) => { if (el.type === "checkbox") el.checked = false; else el.value = ""; });
        renderContent();
      } else if (action === "export-text" || action === "export-csv") exportFile(action === "export-csv");
      else if (action === "import") {
        try {
          const raw = localStorage.getItem("hugetools.operations-workbench.v1");
          const old = raw ? JSON.parse(raw) : { meetings: [] };
          const result = core.importMeetings(state.tasks, old.meetings, "web");
          if (!result.added) message("未发现可新增的会议待办；已完成和已导入记录会跳过。请先在会议纪要中保存记录。");
          else persist(result.tasks, `已导入 ${result.added} 项；跳过已导入、已完成或无名称记录 ${result.skipped} 条。原会议已保留，请核对负责人和到期日。`);
        } catch (error) { message(`导入失败，原记录未变：${error.message}`, true); }
      } else if (action === "carry") {
        try {
          const result = core.carryForward(state.tasks, visibleTasks().map((t) => t.id), { title: find('[name="carryTitle"]').value, date: find('[name="carryDate"]').value, reference: find('[name="carryReference"]').value });
          if (result.linked) persist(result.tasks, `已将 ${result.linked} 项未完成事项关联本次会议，原来源与进度已保留。`);
          else message("没有需要新增关联的未完成事项；重复来源已跳过。");
        } catch (error) { message(error.message, true); }
      }
    });
    renderFilters(); renderContent();
    if (initialError) message(initialError, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
