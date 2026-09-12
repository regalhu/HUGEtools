const core = require("../../utils/operations-core");

const blankForm = () => ({ title: "", store: "", department: "", owners: "", dueDate: "", plan: "", do: "", check: "", act: "", sources: [] });
const blankFilters = () => ({ query: "", store: "", department: "", owner: "", source: "", status: "", overdue: false });

Page({
  data: {
    feedback: "", feedbackError: false, readFailed: false, editorOpen: false, editorId: "", form: blankForm(),
    filters: blankFilters(), viewTasks: [], totalTasks: 0, summary: { total: 0, complete: 0, unfinished: 0, overdue: 0, unassigned: 0, people: [], departments: [] },
    storeOptions: ["全部门店"], departmentOptions: ["全部部门 / 中心"], ownerOptions: ["全部负责人"], sourceOptions: ["全部会议来源"],
    storeLabel: "全部门店", departmentLabel: "全部部门 / 中心", ownerLabel: "全部负责人", sourceLabel: "全部会议来源", statusLabel: "全部状态",
    statusOptions: ["全部状态", "全部未完成", "待分配", "待开始", "进行中", "已完成"],
    progressOptions: ["待开始", "进行中", "已完成"], carryOpen: false, carry: { title: "", date: core.today(), reference: "" }
  },
  onLoad() {
    this._state = { version: 1, tasks: [] };
    this._filterOptions = {};
  },
  onShow() {
    try {
      this._state = core.readState(wx.getStorageSync(core.STORAGE_KEY));
      this.setData({ readFailed: false });
      this.rebuild();
    } catch (error) {
      this.setData({ readFailed: true });
      this.feedback(`读取失败：${error.message}。已暂停保存，请先在备份中心导出原数据。`, true);
    }
  },
  feedback(text, error) { this.setData({ feedback: text, feedbackError: !!error }); },
  persist(tasks, text) {
    if (this.data.readFailed) { this.feedback("读取异常尚未解决，已暂停保存并保留原数据。请先备份。", true); return false; }
    try {
      const next = core.saveState({ ...this._state, tasks }, (key, value) => wx.setStorageSync(key, value));
      this._state = next;
      this.rebuild();
      this.feedback(text || "已保存到本机。");
      return true;
    } catch (error) { this.feedback(`保存失败，未覆盖已有记录：${error.message}`, true); return false; }
  },
  rebuild() {
    const tasks = this._state.tasks;
    const distinct = (values) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh"));
    const sources = new Map();
    tasks.forEach((task) => task.sources.forEach((s) => sources.set(s.key, s)));
    this._filterOptions = {
      store: ["", ...distinct(tasks.map((t) => t.store))], department: ["", ...distinct(tasks.map((t) => t.department))],
      owner: ["", ...distinct(tasks.reduce((all, t) => all.concat(t.assignees.map((a) => a.name)), []))], source: ["", ...Array.from(sources.keys())],
      status: ["", "unfinished", "unassigned", "pending", "active", "complete"]
    };
    const filters = { ...this.data.filters };
    ["store", "department", "owner", "source"].forEach((key) => { if (!this._filterOptions[key].includes(filters[key])) filters[key] = ""; });
    const source = sources.get(filters.source);
    const visible = core.filterTasks(tasks, filters);
    this.setData({
      totalTasks: tasks.length, filters,
      storeOptions: ["全部门店", ...this._filterOptions.store.slice(1)], departmentOptions: ["全部部门 / 中心", ...this._filterOptions.department.slice(1)],
      ownerOptions: ["全部负责人", ...this._filterOptions.owner.slice(1)], sourceOptions: ["全部会议来源", ...Array.from(sources.values()).map((s) => `${s.title}${s.date ? ` · ${s.date}` : ""}`)],
      storeLabel: filters.store || "全部门店", departmentLabel: filters.department || "全部部门 / 中心", ownerLabel: filters.owner || "全部负责人", sourceLabel: source ? `${source.title}${source.date ? ` · ${source.date}` : ""}` : "全部会议来源",
      statusLabel: this.data.statusOptions[this._filterOptions.status.indexOf(filters.status)],
      summary: core.summarize(visible),
      viewTasks: visible.map((task) => ({ ...task, state: core.status(task), detailsOpen: !!(this._expanded || {})[task.id], assignees: task.assignees.map((a) => ({ ...a, progressIndex: [0, 50, 100].indexOf(a.progress), progressLabel: this.data.progressOptions[[0, 50, 100].indexOf(a.progress)] })) }))
    });
  },
  onFilterPick(event) {
    const key = event.currentTarget.dataset.key;
    const value = this._filterOptions[key][Number(event.detail.value)];
    this.setData({ [`filters.${key}`]: value });
    this.rebuild();
  },
  onSearch(event) { this.setData({ "filters.query": event.detail.value }); this.rebuild(); },
  onOverdue(event) { this.setData({ "filters.overdue": event.detail.value }); this.rebuild(); },
  resetFilters() { this.setData({ filters: blankFilters() }); this.rebuild(); },
  toggleDetails(event) {
    const id = event.currentTarget.dataset.id;
    this._expanded = this._expanded || {};
    this._expanded[id] = !this._expanded[id];
    this.rebuild();
  },
  newTask() {
    this.setData({ editorOpen: true, editorId: "", form: blankForm() });
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },
  editTask(event) {
    const task = this._state.tasks.find((t) => t.id === event.currentTarget.dataset.id);
    if (!task) return this.feedback("事项已变化，请重新打开。", true);
    const form = { ...task, owners: task.assignees.map((a) => a.name).join("、"), sources: task.sources.map((s) => ({ ...s })) };
    delete form.assignees;
    this.setData({ editorOpen: true, editorId: task.id, form });
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },
  closeEditor() { this.setData({ editorOpen: false, editorId: "", form: blankForm() }); },
  onFormInput(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  onSourceInput(event) {
    this.setData({ [`form.sources[${Number(event.currentTarget.dataset.index)}].${event.currentTarget.dataset.field}`]: event.detail.value });
  },
  addSource() {
    this.setData({ "form.sources": [...this.data.form.sources, { key: core.uid("source"), title: "", date: "", reference: "" }] });
  },
  removeSource(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ "form.sources": this.data.form.sources.filter((s, i) => i !== index) });
  },
  saveTask() {
    try {
      const old = this._state.tasks.find((t) => t.id === this.data.editorId);
      const task = core.makeTask(this.data.form, old);
      if (this.persist(old ? this._state.tasks.map((t) => t.id === task.id ? task : t) : [task, ...this._state.tasks])) this.closeEditor();
    } catch (error) { this.feedback(error.message, true); }
  },
  onProgress(event) {
    const task = this._state.tasks.find((t) => t.id === event.currentTarget.dataset.id);
    if (!task) return this.feedback("事项已变化，请重新打开。", true);
    try {
      const updated = core.setProgress(task, event.currentTarget.dataset.name, [0, 50, 100][Number(event.detail.value)]);
      this.persist(this._state.tasks.map((t) => t.id === task.id ? updated : t), "个人进度已保存，整体状态已重新汇总。");
    } catch (error) { this.feedback(error.message, true); }
  },
  onNote(event) {
    const task = this._state.tasks.find((t) => t.id === event.currentTarget.dataset.id);
    const person = task && task.assignees.find((a) => a.name === event.currentTarget.dataset.name);
    if (!person || person.note === event.detail.value) return;
    const updated = core.setProgress(task, person.name, person.progress, event.detail.value);
    if (!this.persist(this._state.tasks.map((t) => t.id === task.id ? updated : t), "个人进展备注已保存。")) this.rebuild();
  },
  importMeetings() {
    try {
      const raw = wx.getStorageSync("hugetools.operations.v1");
      const old = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : { meetingRecords: [] };
      const result = core.importMeetings(this._state.tasks, old.meetingRecords, "mini");
      if (!result.added) this.feedback("未发现可新增的会议待办；已完成和已导入记录会跳过。请先在会议纪要中保存记录。");
      else this.persist(result.tasks, `已导入 ${result.added} 项；跳过已导入、已完成或无名称记录 ${result.skipped} 条。原会议已保留，请核对负责人和到期日。`);
    } catch (error) { this.feedback(`导入失败，原记录未变：${error.message}`, true); }
  },
  toggleCarry() { this.setData({ carryOpen: !this.data.carryOpen }); },
  onCarryInput(event) { this.setData({ [`carry.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  carryForward() {
    try {
      const result = core.carryForward(this._state.tasks, this.data.viewTasks.map((t) => t.id), this.data.carry);
      if (result.linked) this.persist(result.tasks, `已将 ${result.linked} 项未完成事项关联本次会议，原来源与进度已保留。`);
      else this.feedback("没有需要新增关联的未完成事项；重复来源已跳过。");
    } catch (error) { this.feedback(error.message, true); }
  },
  copyRange(event) {
    const tasks = core.filterTasks(this._state.tasks, this.data.filters);
    if (!tasks.length) return this.feedback("当前范围没有事项，请先添加或调整筛选条件。");
    const csv = event.currentTarget.dataset.format === "csv";
    wx.setClipboardData({
      data: csv ? core.exportCsv(tasks) : core.exportText(tasks),
      success: () => this.feedback(`已复制当前筛选范围 ${tasks.length} 项的${csv ? " CSV" : "文本"}内容。`),
      fail: () => this.feedback("复制失败，记录未变，请重试。", true)
    });
  }
});
