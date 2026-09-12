(function () {
  'use strict';
  var C = window.HugeDishTrackingCore;
  if (!C) return;
  var mount, state, group = 'new', drafts, preview = null, source = '', importText = '', replace = false, notice = '', loadError = '';
  function esc(value) { return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function fmt(value) { return esc(C.formatNumber(value)); }
  function save(next, message) {
    try { localStorage.setItem(C.KEY, JSON.stringify(next)); ['new', 'regular'].forEach(function (key) { if (JSON.stringify(next.configs[key]) !== JSON.stringify(state.configs[key])) drafts[key] = JSON.parse(JSON.stringify(next.configs[key])); }); state = next; notice = message; return true; }
    catch (error) { notice = '保存失败：本机存储不可用或空间不足。原记录未被替换，请先备份。'; return false; }
  }
  function reload() {
    try { state = C.readState(localStorage.getItem(C.KEY)); loadError = ''; }
    catch (error) { state = C.emptyState(); loadError = '读取失败：' + error.message; }
    drafts = JSON.parse(JSON.stringify(state.configs)); preview = null; if (mount) render();
  }
  function table(rows) {
    return '<div class="dt-table-wrap"><table class="dt-table"><thead><tr><th>门店</th><th>日期</th><th>菜品</th><th>销量</th><th>销售额 / 元</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td>' + esc(r.store) + '</td><td>' + esc(r.date) + '</td><td>' + esc(r.dish) + '</td><td>' + fmt(r.quantity) + '</td><td>' + fmt(r.revenue) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function importPanel() {
    var html = '<section class="dt-card"><div class="dt-section-head"><div><span class="dt-eyebrow">01 / 确认事实</span><h3>导入与来源核对</h3></div><button type="button" class="dt-link" data-action="template">下载空白模板</button></div><p class="dt-muted">粘贴 CSV 或 Excel 表格内容。日期使用 YYYY-MM-DD；缺失记录不要填成零。销量与销售额须为非负数，退菜请单独核对。</p><label class="dt-label" for="dtSource">来源名称 <span>必填</span></label><input id="dtSource" maxlength="120" class="dt-input" placeholder="填写真实表名或导出批次名称" value="' + esc(source) + '"' + (loadError ? ' disabled' : '') + '><label class="dt-label" for="dtImport">数据内容</label><textarea id="dtImport" class="dt-textarea" rows="5" placeholder="' + esc(C.HEADER) + '"' + (loadError ? ' disabled' : '') + '>' + esc(importText) + '</textarea><div class="dt-actions"><button type="button" class="dt-button" data-action="preview"' + (loadError ? ' disabled' : '') + '>预览并校验</button><span class="dt-muted">本版不接入订单分母，不计算点单率。</span></div>';
    if (preview) {
      if (preview.errors.length) html += '<div class="dt-alert" role="alert"><strong>本批未入库 · ' + preview.errors.length + ' 项待修正</strong><ul>' + preview.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
      else {
        html += '<div class="dt-preview"><h4>待确认 · ' + preview.rows.length + ' 条</h4><p>来源：' + esc(preview.source) + ' · 新增 ' + preview.newCount + ' 条 · 同键冲突 ' + preview.conflicts.length + ' 条</p>' + table(preview.rows.slice(0, 10)) + (preview.rows.length > 10 ? '<p class="dt-muted">展示前 10 条；已校验全部 ' + preview.rows.length + ' 条。</p>' : '');
        if (preview.conflicts.length) html += '<div class="dt-alert"><strong>以下同门店、日期、菜品记录将发生覆盖</strong><div class="dt-conflicts">' + preview.conflicts.map(function (c) { var b = state.batches.find(function (item) { return item.id === c.previous.batchId; }); return '<p>' + esc(c.incoming.store + ' / ' + c.incoming.date + ' / ' + c.incoming.dish) + '<br>原来源：' + esc(b ? b.source : c.previous.batchId) + '<br>销量 ' + fmt(c.previous.quantity) + ' → ' + fmt(c.incoming.quantity) + '；销售额 ' + fmt(c.previous.revenue) + ' → ' + fmt(c.incoming.revenue) + '</p>'; }).join('') + '</div><label class="dt-check"><input type="checkbox" id="dtReplace"' + (replace ? ' checked' : '') + '>我确认覆盖全部冲突记录，保留旧批次用于追溯</label></div>';
        html += '<div class="dt-actions"><button type="button" class="dt-button" data-action="commit"' + (preview.conflicts.length && !replace ? ' disabled' : '') + '>确认本批并入库</button><button type="button" class="dt-link" data-action="cancel-import">取消本批</button></div></div>';
      }
    }
    return html + '</section>';
  }
  function selectionPanel() {
    var catalog = C.catalog(state), draft = drafts[group], dirty = JSON.stringify(draft) !== JSON.stringify(state.configs[group]);
    return '<section class="dt-card"><span class="dt-eyebrow">02 / 确认范围</span><div class="dt-section-head"><h3>菜品跟踪</h3><div class="dt-tabs" role="group" aria-label="菜品分组"><button type="button" data-action="group" data-group="new" class="' + (group === 'new' ? 'is-active' : '') + '">新品</button><button type="button" data-action="group" data-group="regular" class="' + (group === 'regular' ? 'is-active' : '') + '">常规菜品</button></div></div><p class="dt-muted">两组各自保存菜品、门店和周期。修改后点击“保存范围并分析”。</p><div class="dt-selected"><strong>已选中 · ' + draft.dishes.length + ' 道</strong><div class="dt-chips">' + (draft.dishes.length ? draft.dishes.map(function (dish, index) { return '<button class="dt-chip" type="button" data-action="remove-dish" data-index="' + index + '" aria-label="移除 ' + esc(dish) + '">' + esc(dish) + ' <span aria-hidden="true">×</span></button>'; }).join('') : '<span class="dt-muted">尚未选择菜品</span>') + '</div></div><label class="dt-label" for="dtAddDish">添加已确认菜品</label><div class="dt-input-row"><select id="dtAddDish" class="dt-input"><option value="">请选择菜品</option>' + catalog.dishes.map(function (dish, index) { return draft.dishes.includes(dish) ? '' : '<option value="' + index + '">' + esc(dish) + '</option>'; }).join('') + '</select><button type="button" class="dt-secondary" data-action="add-dish">添加</button></div><span class="dt-label">统计门店 · ' + draft.stores.length + ' 家</span><div class="dt-stores">' + (catalog.stores.length ? catalog.stores.map(function (store, index) { return '<label class="dt-check"><input type="checkbox" data-store="' + index + '"' + (draft.stores.includes(store) ? ' checked' : '') + '>' + esc(store) + '</label>'; }).join('') : '<span class="dt-muted">确认首批数据后，门店与菜品会在这里出现。</span>') + '</div><div class="dt-form-grid"><label class="dt-label">统计方式<select id="dtMode" class="dt-input"><option value="fixed"' + (draft.mode === 'fixed' ? ' selected' : '') + '>固定周期</option><option value="ongoing"' + (draft.mode === 'ongoing' ? ' selected' : '') + '>持续统计</option></select></label><label class="dt-label">起始日期<input type="date" id="dtStart" class="dt-input" value="' + esc(draft.startDate) + '"></label><label class="dt-label">固定截止日期<input type="date" id="dtEnd" class="dt-input" value="' + esc(draft.endDate) + '"' + (draft.mode === 'ongoing' ? ' disabled' : '') + '></label></div><p class="dt-muted">持续统计截止于所选门店最新已确认日期；单次最长 366 天。切换模式会保留固定截止日期。</p><div class="dt-actions"><button type="button" class="dt-button" data-action="save-config"' + (loadError ? ' disabled' : '') + '>保存范围并分析</button>' + (dirty ? '<span class="dt-dirty">范围有修改；下方仍为已保存范围</span>' : '<span class="dt-muted">' + (C.analyze(state, group).messages.length ? '选择完成后保存范围' : '范围已保存') + '</span>') + '</div></section>';
  }
  function resultPanel() {
    var result = C.analyze(state, group);
    if (result.messages.length) return '<section class="dt-card dt-empty"><span class="dt-eyebrow">03 / 阅读结果</span><h3>从真实记录开始</h3><p>' + result.messages.map(esc).join('<br>') + '</p></section>';
    var batches = new Map(state.batches.map(function (b) { return [b.id, b]; }));
    return '<section class="dt-results"><div class="dt-section-head"><div><span class="dt-eyebrow">03 / 独立菜品趋势</span><h3>' + (group === 'new' ? '新品' : '常规菜品') + ' · 已保存范围</h3></div><button type="button" class="dt-secondary" data-action="copy-report">复制结果</button></div><p class="dt-muted">' + esc(result.startDate + ' 至 ' + result.endDate) + ' · ' + result.dayCount + ' 天 · ' + result.stores.length + ' 家门店' + (result.mode === 'ongoing' ? ' · 持续统计截止已确认事实' : '') + '<br>对比前期：' + esc(result.previousStart + ' 至 ' + result.previousEnd) + '</p>' + result.dishes.map(function (d) {
      var max = Math.max.apply(null, d.current.days.map(function (day) { return day.quantity || 0; }).concat([1]));
      return '<article class="dt-card dt-dish"><div class="dt-section-head"><h3>' + esc(d.dish) + '</h3><span class="dt-badge ' + (d.current.complete ? '' : 'is-partial') + '">' + (d.current.complete ? '记录完整' : '覆盖不足') + '</span></div><div class="dt-metrics"><div><span>已记录销量</span><strong>' + fmt(d.current.quantity) + '</strong><small>前期已记录 ' + fmt(d.previous.quantity) + '</small></div><div><span>已记录销售额 / 元</span><strong>' + fmt(d.current.revenue) + '</strong><small>前期已记录 ' + fmt(d.previous.revenue) + '</small></div><div><span>店日覆盖</span><strong>' + d.current.recorded + '<em> / ' + d.current.expected + '</em></strong><small>前期 ' + d.previous.recorded + ' / ' + d.previous.expected + '</small></div><div><span>销量 / 销售额变化</span><strong class="dt-change">' + C.formatChange(d.quantityChange) + ' / ' + C.formatChange(d.revenueChange) + '</strong><small>同店等长周期</small></div></div><p class="dt-method">' + esc(d.comparisonNote) + ' 已记录合计仅代表有记录部分。</p><h4>每日销量与门店覆盖</h4><div class="dt-trend">' + d.current.days.map(function (day) { return '<div class="dt-trend-row"><time>' + esc(day.date) + '</time><div class="dt-track"><span class="' + (day.complete ? '' : 'is-partial') + '" style="width:' + (day.quantity === null ? 0 : Math.max(day.quantity > 0 ? 1 : 0, day.quantity / max * 100)) + '%"></span></div><strong>' + fmt(day.quantity) + '</strong><small>' + day.recorded + '/' + day.expected + ' 店</small></div>'; }).join('') + '</div><details class="dt-details"><summary>查看店日明细及每条来源</summary><div class="dt-table-wrap"><table class="dt-table"><thead><tr><th>日期</th><th>门店</th><th>销量</th><th>销售额 / 元</th><th>来源批次</th></tr></thead><tbody>' + d.current.days.map(function (day) { return day.coverage.map(function (cell) { var b = batches.get(cell.batchId); return '<tr class="' + (cell.recorded ? '' : 'dt-missing') + '"><td>' + esc(day.date) + '</td><td>' + esc(cell.store) + '</td><td>' + fmt(cell.quantity) + '</td><td>' + fmt(cell.revenue) + '</td><td>' + (b ? esc(b.source) + '<small>' + esc(b.id) + '</small>' : '未记录') + '</td></tr>'; }).join(''); }).join('') + '</tbody></table></div></details><p class="dt-source">本期来源：' + (d.current.sources.length ? d.current.sources.map(function (id) { var b = batches.get(id); return esc(b ? b.source : id); }).join('；') : '无已记录数据') + '</p></article>';
    }).join('') + '</section>';
  }
  function sourcePanel() {
    return '<section class="dt-card"><span class="dt-eyebrow">04 / 来源归档</span><h3>已确认批次 · ' + state.batches.length + '</h3><p class="dt-muted">覆盖只替换当前统计事实；原批次、原值和确认时间均保留。记录仅保存在当前浏览器。</p>' + (state.batches.length ? state.batches.map(function (batch, index) {
      var active = state.records.filter(function (r) { return r.batchId === batch.id; }).length;
      return '<details class="dt-details" data-batch="' + index + '"><summary>' + esc(batch.source) + ' <span>' + batch.rows.length + ' 条 · 当前采用 ' + active + ' 条</span></summary><p class="dt-muted">' + esc(batch.id) + '<br>确认时间：' + esc(batch.confirmedAt) + '<br>本批覆盖 ' + batch.replacedCount + ' 条；其他批次替代 ' + (batch.rows.length - active) + ' 条。</p><div class="dt-batch-body"></div></details>';
    }).join('') : '<p class="dt-muted">暂无已确认批次。</p>') + '</section>';
  }
  function render() {
    mount.innerHTML = '<div class="dt-app"><header class="dt-hero"><span class="dt-eyebrow">DISH TRACKING / 菜品跟踪</span><h2>每一道菜，都有据可查。</h2><p>先确认数据与范围，再读销量、趋势和来源。</p><div class="dt-hero-meta"><span>' + state.records.length + ' 条已确认事实</span><span>' + state.batches.length + ' 个来源批次</span><span>缺失不补零</span></div></header>' + (loadError ? '<div class="dt-alert" role="alert">' + esc(loadError) + ' 为保护原记录，导入和保存已暂停。</div>' : '') + (notice ? '<div class="dt-notice" role="status">' + esc(notice) + '</div>' : '') + importPanel() + selectionPanel() + resultPanel() + sourcePanel() + '</div>';
    mount.querySelectorAll('details[data-batch]').forEach(function (details) { details.addEventListener('toggle', function () {
      if (!details.open || details.dataset.loaded) return;
      var b = state.batches[Number(details.dataset.batch)], body = details.querySelector('.dt-batch-body');
      body.innerHTML = table(b.rows) + ((b.replacements || []).length ? '<h4>覆盖记录核对</h4>' + b.replacements.map(function (r) { return '<p class="dt-muted">' + esc(r.incoming.store + ' / ' + r.incoming.date + ' / ' + r.incoming.dish) + '<br>销量 ' + fmt(r.previous.quantity) + ' → ' + fmt(r.incoming.quantity) + '；销售额 ' + fmt(r.previous.revenue) + ' → ' + fmt(r.incoming.revenue) + '<br>原批次：' + esc(r.previous.batchId) + '</p>'; }).join('') : ''); details.dataset.loaded = 'true';
    }); });
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); notice = '结果已复制，包含范围、覆盖与来源。'; }
    catch (error) { var area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select(); var copied = document.execCommand('copy'); area.remove(); notice = copied ? '结果已复制。' : '复制失败，请允许剪贴板访问后重试。'; }
    render();
  }
  function input(event) {
    var t = event.target, draft = drafts[group];
    if (t.id === 'dtSource' || t.id === 'dtImport') { if (t.id === 'dtSource') source = t.value; else importText = t.value; preview = null; replace = false; var prior = mount.querySelector('.dt-preview'); if (prior) prior.remove(); return; }
    if (t.id === 'dtReplace') { replace = t.checked; render(); return; }
    if (t.hasAttribute('data-store')) { var store = C.catalog(state).stores[Number(t.dataset.store)]; draft.stores = t.checked ? draft.stores.concat([store]) : draft.stores.filter(function (s) { return s !== store; }); render(); }
    if (t.id === 'dtMode' || t.id === 'dtStart' || t.id === 'dtEnd') { draft[t.id === 'dtMode' ? 'mode' : t.id === 'dtStart' ? 'startDate' : 'endDate'] = t.value; render(); }
  }
  function init() {
    mount = document.getElementById('dishTrackingRoot'); if (!mount) return; reload();
    mount.addEventListener('input', function (e) { if (e.target.id === 'dtSource' || e.target.id === 'dtImport') input(e); });
    mount.addEventListener('change', function (e) { if (e.target.id !== 'dtSource' && e.target.id !== 'dtImport') input(e); });
    mount.addEventListener('click', function (event) {
      var button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
      var action = button.dataset.action;
      try {
        if (action === 'preview') { preview = C.previewImport(importText, source, state); replace = false; notice = ''; }
        if (action === 'commit') { if (!preview || loadError) return; var next = C.commitImport(state, importText, source, replace ? 'replace' : 'reject'); if (save(next, '已确认入库 ' + preview.rows.length + ' 条，来源批次已保存。')) { preview = null; importText = ''; source = ''; replace = false; } }
        if (action === 'cancel-import') { preview = null; replace = false; notice = '本批已取消，尚未入库。'; }
        if (action === 'group') { group = button.dataset.group; notice = ''; }
        if (action === 'add-dish') { var value = mount.querySelector('#dtAddDish').value; if (value !== '') drafts[group].dishes.push(C.catalog(state).dishes[Number(value)]); }
        if (action === 'remove-dish') drafts[group].dishes.splice(Number(button.dataset.index), 1);
        if (action === 'save-config' && !loadError) { var configured = C.updateConfig(state, group, drafts[group]); var check = C.analyze(configured, group); if (check.messages.length) notice = check.messages.join(' '); else save(configured, (group === 'new' ? '新品' : '常规菜品') + '范围已保存。'); }
        if (action === 'copy-report') { copy(C.report(state, group)); return; }
        if (action === 'template') { var blob = new Blob(['\uFEFF' + C.HEADER + '\r\n'], { type: 'text/csv;charset=utf-8;' }); var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = '菜品跟踪_空白模板.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); return; }
      } catch (error) { notice = error.message; }
      render();
    });
    window.addEventListener('storage', function (event) { if (event.key === C.KEY) reload(); });
    window.HugeDishTracking = { refresh: reload };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
