const C = require('../../utils/dish-tracking-core');

Page({
  onShareAppMessage() { return { title: '胡哥餐饮工具 · 菜品跟踪', path: '/pages/dish-tracking/dish-tracking' }; },
  data: { source: '', importText: '', group: 'new', notice: '', loadError: '', preview: null, replace: false, stats: { records: 0, batches: 0 }, cfg: {}, selected: [], dishOptions: [], stores: [], result: { messages: [], dishes: [] }, batches: [], activeBatch: null, dirty: false },
  onLoad() { this._expanded = {}; this._detailPages = {}; this._dishPage = 0; this.loadSaved(); },
  onShow() {
    if (!this._state) return;
    try { const raw = wx.getStorageSync(C.KEY); if (JSON.stringify(raw) !== this._loadedRaw) this.loadSaved(); } catch (error) { this.setData({ notice: '读取本机存储失败，尚未刷新。' }); }
  },
  loadSaved() {
    try { const raw = wx.getStorageSync(C.KEY); this._state = C.readState(raw); this._loadedRaw = JSON.stringify(raw); this.setData({ loadError: '' }); }
    catch (error) { this._state = C.emptyState(); this.setData({ loadError: '读取失败：' + error.message + ' 为保护原记录，导入与保存已暂停。' }); }
    this._drafts = JSON.parse(JSON.stringify(this._state.configs)); this._preview = null; this.setData({ preview: null, activeBatch: null }); this.refresh();
  },
  persist(next, notice) {
    if (this.data.loadError) return false;
    try { const raw = JSON.stringify(next); wx.setStorageSync(C.KEY, raw); this._loadedRaw = JSON.stringify(raw); ['new', 'regular'].forEach(key => { if (JSON.stringify(next.configs[key]) !== JSON.stringify(this._state.configs[key])) this._drafts[key] = JSON.parse(JSON.stringify(next.configs[key])); }); this._state = next; this.setData({ notice }); return true; }
    catch (error) { this.setData({ notice: '保存失败：本机存储不可用或空间不足。原记录未替换，请先备份。' }); return false; }
  },
  formatRow(row) { return Object.assign({}, row, { quantityText: C.formatNumber(row.quantity), revenueText: C.formatNumber(row.revenue) }); },
  refresh() {
    const state = this._state, group = this.data.group, cfg = this._drafts[group], choices = C.catalog(state), result = C.analyze(state, group), batches = new Map(state.batches.map(b => [b.id, b]));
    result.totalDishes = result.dishes.length; result.dishPages = Math.ceil(result.dishes.length / 3); this._dishPage = Math.max(0, Math.min(this._dishPage, result.dishPages - 1)); result.dishPage = this._dishPage + 1;
    result.dishes = result.dishes.slice(this._dishPage * 3, this._dishPage * 3 + 3).map(d => {
      const maximum = Math.max(1, ...d.current.days.map(day => day.quantity || 0));
      const key = group + ':' + d.dish, expanded = Boolean(this._expanded[key]), detailPages = Math.ceil(d.current.expected / 50), detailPage = Math.max(0, Math.min(this._detailPages[key] || 0, detailPages - 1)), detailRows = [];
      this._detailPages[key] = detailPage;
      if (expanded) d.current.days.forEach((day, dayIndex) => { day.coverage.forEach((cell, storeIndex) => { const index = dayIndex * result.stores.length + storeIndex; if (index < detailPage * 50 || index >= detailPage * 50 + 50) return; const batch = batches.get(cell.batchId); detailRows.push({ key: index, date: day.date, store: cell.store, recorded: cell.recorded, quantityText: C.formatNumber(cell.quantity), revenueText: C.formatNumber(cell.revenue), source: batch ? batch.source : '未记录', batchId: cell.batchId }); }); });
      return { dish: d.dish, complete: d.current.complete, quantityText: C.formatNumber(d.current.quantity), revenueText: C.formatNumber(d.current.revenue), previousQuantity: C.formatNumber(d.previous.quantity), previousRevenue: C.formatNumber(d.previous.revenue), coverage: d.current.recorded + ' / ' + d.current.expected, previousCoverage: d.previous.recorded + ' / ' + d.previous.expected, quantityChange: C.formatChange(d.quantityChange), revenueChange: C.formatChange(d.revenueChange), comparisonNote: d.comparisonNote, expanded, detailRows, detailPage: detailPage + 1, detailPages, sources: d.current.sources.map(id => batches.has(id) ? batches.get(id).source : id).join('；') || '无已记录数据', days: d.current.days.map(day => ({ date: day.date, quantityText: C.formatNumber(day.quantity), revenueText: C.formatNumber(day.revenue), coverage: day.recorded + '/' + day.expected, complete: day.complete, width: day.quantity === null ? 0 : Math.max(day.quantity > 0 ? 1 : 0, day.quantity / maximum * 100) })) };
    });
    this.setData({ cfg, modeLabel: cfg.mode === 'ongoing' ? '持续统计' : '固定周期', selected: cfg.dishes.map((dish, index) => ({ dish, index })), dishOptions: choices.dishes.filter(dish => !cfg.dishes.includes(dish)), stores: choices.stores.map(store => ({ store, checked: cfg.stores.includes(store) })), dirty: JSON.stringify(cfg) !== JSON.stringify(state.configs[group]), result, stats: { records: state.records.length, batches: state.batches.length }, batches: state.batches.map(batch => { const active = state.records.filter(r => r.batchId === batch.id).length; return { id: batch.id, source: batch.source, count: batch.rows.length, active, replacedCount: batch.replacedCount, superseded: batch.rows.length - active, confirmedAt: batch.confirmedAt }; }) });
  },
  onSource(e) { this._preview = null; this.setData({ source: e.detail.value, preview: null, replace: false }); },
  onText(e) { this.acceptText(e.detail.value); },
  acceptText(text) { this._preview = null; if (text.length > 200000) { this.setData({ importText: '', preview: null, replace: false, notice: '内容超过手机端单批 20 万字上限，本次未接收，请拆分后导入。' }); return; } this.setData({ importText: text, preview: null, replace: false }); },
  onClipboard() { wx.getClipboardData({ success: res => this.acceptText(res.data), fail: () => this.setData({ notice: '未能读取剪贴板，可直接粘贴到数据输入框。' }) }); },
  onTemplate() { wx.setClipboardData({ data: C.HEADER, success: () => this.setData({ notice: '空白模板表头已复制，请填入真实记录。' }), fail: () => this.setData({ notice: '复制失败，请直接使用页面中的表头。' }) }); },
  onPreview() {
    if (this.data.loadError) return;
    const p = C.previewImport(this.data.importText, this.data.source, this._state); this._preview = p;
    this.setData({ notice: '', replace: false, preview: { errors: p.errors.slice(0, 100), errorCount: p.errors.length, count: p.rows.length, source: p.source, newCount: p.newCount || 0, conflictCount: p.conflicts.length, rows: p.rows.slice(0, 8).map(r => this.formatRow(r)), conflicts: p.conflicts.slice(0, 20).map(c => { const batch = this._state.batches.find(b => b.id === c.previous.batchId); return { key: C.rowKey(c.incoming), store: c.incoming.store, date: c.incoming.date, dish: c.incoming.dish, beforeQuantity: C.formatNumber(c.previous.quantity), afterQuantity: C.formatNumber(c.incoming.quantity), beforeRevenue: C.formatNumber(c.previous.revenue), afterRevenue: C.formatNumber(c.incoming.revenue), source: batch ? batch.source : c.previous.batchId }; }) } });
  },
  onCopyValidation() {
    const p = this._preview; if (!p) return;
    const lines = p.errors.length ? p.errors : p.conflicts.map(c => { const b = this._state.batches.find(batch => batch.id === c.previous.batchId); return c.incoming.store + ' / ' + c.incoming.date + ' / ' + c.incoming.dish + '\n原来源：' + (b ? b.source : c.previous.batchId) + '\n销量 ' + c.previous.quantity + ' → ' + c.incoming.quantity + '；销售额 ' + c.previous.revenue + ' → ' + c.incoming.revenue; });
    wx.setClipboardData({ data: lines.join('\n'), fail: () => this.setData({ notice: '核对清单复制失败，请重试。' }) });
  },
  onReplace(e) { this.setData({ replace: e.detail.value.includes('replace') }); },
  onCommit() {
    if (!this._preview || this.data.loadError) return;
    try { const next = C.commitImport(this._state, this.data.importText, this.data.source, this.data.replace ? 'replace' : 'reject'); if (this.persist(next, '已确认入库 ' + this._preview.rows.length + ' 条，来源批次已保存。')) { this._preview = null; this.setData({ source: '', importText: '', preview: null, replace: false, activeBatch: null }); this.refresh(); } }
    catch (error) { this.setData({ notice: error.message }); }
  },
  onCancelImport() { this._preview = null; this.setData({ preview: null, replace: false, notice: '本批已取消，尚未入库。' }); },
  onGroup(e) { this._dishPage = 0; this.setData({ group: e.currentTarget.dataset.group, notice: '' }); this.refresh(); },
  onAddDish(e) { const dish = this.data.dishOptions[Number(e.detail.value)]; if (dish && !this._drafts[this.data.group].dishes.includes(dish)) this._drafts[this.data.group].dishes.push(dish); this.refresh(); },
  onRemoveDish(e) { this._drafts[this.data.group].dishes.splice(Number(e.currentTarget.dataset.index), 1); this.refresh(); },
  onStores(e) { this._drafts[this.data.group].stores = e.detail.value; this.refresh(); },
  onMode(e) { this._drafts[this.data.group].mode = Number(e.detail.value) === 1 ? 'ongoing' : 'fixed'; this.refresh(); },
  onDate(e) { this._drafts[this.data.group][e.currentTarget.dataset.field] = e.detail.value; this.refresh(); },
  onSaveConfig() {
    if (this.data.loadError) return;
    try { const next = C.updateConfig(this._state, this.data.group, this._drafts[this.data.group]), result = C.analyze(next, this.data.group); if (result.messages.length) this.setData({ notice: result.messages.join(' ') }); else if (this.persist(next, (this.data.group === 'new' ? '新品' : '常规菜品') + '范围已保存。')) this.refresh(); }
    catch (error) { this.setData({ notice: error.message }); }
  },
  onCopyReport() { wx.setClipboardData({ data: C.report(this._state, this.data.group), success: () => this.setData({ notice: '结果已复制，包含范围、覆盖与来源。' }), fail: () => this.setData({ notice: '复制失败，请重试。' }) }); },
  onToggleDish(e) { const dish = this.data.result.dishes[Number(e.currentTarget.dataset.index)].dish, key = this.data.group + ':' + dish; this._expanded[key] = !this._expanded[key]; this.refresh(); },
  onDishPage(e) { this._dishPage += Number(e.currentTarget.dataset.step); this.refresh(); },
  onDetailPage(e) { const key = this.data.group + ':' + e.currentTarget.dataset.dish; this._detailPages[key] = (this._detailPages[key] || 0) + Number(e.currentTarget.dataset.step); this.refresh(); },
  onBatch(e) {
    const id = e.currentTarget.dataset.id; if (this.data.activeBatch && this.data.activeBatch.id === id) { this.setData({ activeBatch: null }); return; }
    const batch = this._state.batches.find(b => b.id === id); if (!batch) return;
    this.setData({ activeBatch: { id: batch.id, source: batch.source, count: batch.rows.length, rows: batch.rows.slice(0, 100).map(r => this.formatRow(r)), replacements: (batch.replacements || []).slice(0, 20).map(c => ({ key: C.rowKey(c.incoming), label: c.incoming.store + ' / ' + c.incoming.date + ' / ' + c.incoming.dish, values: '销量 ' + c.previous.quantity + ' → ' + c.incoming.quantity + '；销售额 ' + c.previous.revenue + ' → ' + c.incoming.revenue, source: c.previous.batchId })), replacedCount: batch.replacedCount } });
  },
  onCopyBatch() {
    if (!this.data.activeBatch) return; const b = this._state.batches.find(batch => batch.id === this.data.activeBatch.id);
    wx.setClipboardData({ data: JSON.stringify(b, null, 2), fail: () => this.setData({ notice: '来源批次复制失败，请重试。' }) });
  }
});
