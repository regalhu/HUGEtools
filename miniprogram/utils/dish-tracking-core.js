(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HugeDishTrackingCore = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var KEY = 'hugetools.dish-tracking.v1';
  var HEADER = '门店,日期,菜品,销量,销售额';
  var DAY = 86400000;
  function blankConfig() { return { dishes: [], stores: [], startDate: '', endDate: '', mode: 'fixed' }; }
  function emptyState() { return { schemaVersion: 1, records: [], batches: [], configs: { new: blankConfig(), regular: blankConfig() } }; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function isDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  }
  function shift(date, offset) { return new Date(Date.parse(date + 'T00:00:00Z') + offset * DAY).toISOString().slice(0, 10); }
  function rowKey(row) { return JSON.stringify([row.store, row.date, row.dish]); }
  function validRecord(row) { return row && typeof row.store === 'string' && row.store.trim() && row.store.length <= 120 && typeof row.dish === 'string' && row.dish.trim() && row.dish.length <= 120 && isDate(row.date) && typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity >= 0 && row.quantity <= Number.MAX_SAFE_INTEGER && typeof row.revenue === 'number' && Number.isFinite(row.revenue) && row.revenue >= 0 && row.revenue <= Number.MAX_SAFE_INTEGER; }
  function readState(raw) {
    if (raw === null || raw === undefined || raw === '') return emptyState();
    var state = typeof raw === 'string' ? JSON.parse(raw) : clone(raw);
    if (!state || state.schemaVersion !== 1 || !Array.isArray(state.records) || !Array.isArray(state.batches) || !state.configs) throw new Error('菜品记录格式无法识别，请先导出备份再处理。');
    var keys = new Set();
    state.records.forEach(function (r) { if (!validRecord(r) || keys.has(rowKey(r))) throw new Error('已保存的菜品记录校验失败，未自动覆盖。'); keys.add(rowKey(r)); });
    ['new', 'regular'].forEach(function (group) {
      var c = state.configs[group];
      if (!c || !Array.isArray(c.dishes) || !Array.isArray(c.stores) || !c.dishes.every(function (s) { return typeof s === 'string' && s.trim(); }) || !c.stores.every(function (s) { return typeof s === 'string' && s.trim(); }) || new Set(c.dishes).size !== c.dishes.length || new Set(c.stores).size !== c.stores.length || !['fixed', 'ongoing'].includes(c.mode) || typeof c.startDate !== 'string' || (c.startDate && !isDate(c.startDate)) || typeof c.endDate !== 'string' || (c.endDate && !isDate(c.endDate))) throw new Error('已保存的跟踪范围校验失败，未自动覆盖。');
    });
    var sources = new Map();
    state.batches.forEach(function (b) {
      if (!b || typeof b.id !== 'string' || !b.id || sources.has(b.id) || typeof b.source !== 'string' || !b.source.trim() || b.source.length > 120 || typeof b.confirmedAt !== 'string' || !Number.isFinite(Date.parse(b.confirmedAt)) || !Array.isArray(b.rows) || !b.rows.length || !b.rows.every(validRecord) || b.count !== b.rows.length || !Number.isInteger(b.replacedCount) || b.replacedCount < 0 || b.replacedCount > b.count || !Array.isArray(b.replacements) || b.replacements.length !== b.replacedCount || !b.replacements.every(function (r) { return r && validRecord(r.incoming) && validRecord(r.previous) && rowKey(r.incoming) === rowKey(r.previous); })) throw new Error('来源批次格式不完整，未自动覆盖。');
      var rows = new Map(b.rows.map(function (r) { return [rowKey(r), r]; }));
      if (rows.size !== b.rows.length) throw new Error('来源批次内存在重复记录，未自动覆盖。');
      sources.set(b.id, rows);
    });
    state.records.forEach(function (r) { var rows = sources.get(r.batchId), original = rows && rows.get(rowKey(r)); if (!original || original.quantity !== r.quantity || original.revenue !== r.revenue) throw new Error('菜品记录缺少一致的来源批次，未自动覆盖。'); });
    state.batches.forEach(function (b) { b.replacements.forEach(function (r) { var rows = sources.get(r.previous.batchId), original = rows && rows.get(rowKey(r.previous)); if (!original || original.quantity !== r.previous.quantity || original.revenue !== r.previous.revenue) throw new Error('覆盖记录缺少一致的原始批次，未自动覆盖。'); }); });
    var choices = catalog(state);
    ['new', 'regular'].forEach(function (group) { var config = state.configs[group]; if (config.dishes.some(function (s) { return !choices.dishes.includes(s); }) || config.stores.some(function (s) { return !choices.stores.includes(s); })) throw new Error('已保存范围引用了不存在的菜品或门店。'); });
    return state;
  }
  // Parse escaped quotes and quoted delimiters; malformed input is never silently repaired.
  function parseTable(text) {
    text = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var first = text.split('\n')[0], delimiter = first.includes('\t') ? '\t' : ',';
    var rows = [], row = [], field = '', quoted = false, closed = false, line = 1, rowLine = 1;
    function cell() { row.push(field.trim()); field = ''; closed = false; }
    function finish() { cell(); if (row.some(function (v) { return v !== ''; })) rows.push({ cells: row, line: rowLine }); row = []; rowLine = line + 1; }
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quoted) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
        else { field += ch; if (ch === '\n') line++; }
      } else if (ch === delimiter) cell();
      else if (ch === '\n') { finish(); line++; }
      else if (ch === '"' && !field && !closed) quoted = true;
      else if (ch === '"' || (closed && ch.trim())) throw new Error('第 ' + line + ' 行引号格式有误。');
      else if (!closed) field += ch;
    }
    if (quoted) throw new Error('第 ' + rowLine + ' 行引号未闭合。');
    if (field || row.length || closed) finish();
    return rows;
  }
  function previewImport(text, source, state) {
    var errors = [], rows = [], conflicts = [], parsed;
    source = String(source || '').trim();
    if (!source) errors.push('请填写来源名称，便于追溯原始表。');
    if (source.length > 120) errors.push('来源名称不能超过 120 字。');
    if (String(text || '').length > 3000000) return { errors: ['单次内容过大，请拆分到 3 MB 以内。'], rows: [], conflicts: [], source: source };
    try { parsed = parseTable(text); } catch (error) { errors.push(error.message); parsed = []; }
    if (!parsed.length) errors.push('请粘贴含表头的数据。');
    var required = HEADER.split(','), header = parsed.length ? parsed[0].cells : [];
    if (parsed.length && (header.length !== 5 || required.some(function (v) { return header.indexOf(v) === -1; }))) errors.push('表头仅包含：' + HEADER + '。订单分母未接入，本版不计算点单率。');
    if (parsed.length > 20001) errors.push('单次最多导入 20,000 条，请拆分批次。');
    if (errors.some(function (e) { return e.includes('表头仅') || e.includes('最多导入'); })) return { errors: errors, rows: [], conflicts: [], source: source };
    var seen = new Map(), existing = new Map((state || emptyState()).records.map(function (r) { return [rowKey(r), r]; }));
    parsed.slice(1).forEach(function (entry) {
      var cells = entry.cells, line = entry.line;
      if (cells.length !== header.length) { errors.push('第 ' + line + ' 行列数不匹配。'); return; }
      var get = function (name) { return cells[header.indexOf(name)]; };
      var row = { store: get('门店'), date: get('日期'), dish: get('菜品'), quantity: Number(get('销量')), revenue: Number(get('销售额')), line: line };
      var invalid = false;
      ['门店', '菜品'].forEach(function (name) { if (!get(name) || get(name).length > 120 || /[\n\r]/.test(get(name))) { errors.push('第 ' + line + ' 行' + name + '为空、过长或含换行。'); invalid = true; } });
      if (!isDate(row.date)) { errors.push('第 ' + line + ' 行日期无效，格式应为 YYYY-MM-DD。'); invalid = true; }
      ['销量', '销售额'].forEach(function (name) { if (!/^\d+(?:\.\d+)?$/.test(get(name)) || !Number.isFinite(Number(get(name))) || Number(get(name)) > Number.MAX_SAFE_INTEGER) { errors.push('第 ' + line + ' 行' + name + '须为明确的非负数；空白不代表零。'); invalid = true; } });
      var key = rowKey(row);
      if (seen.has(key)) { errors.push('第 ' + line + ' 行与第 ' + seen.get(key) + ' 行门店、日期、菜品重复。'); invalid = true; }
      seen.set(key, line);
      if (!invalid) { rows.push(row); if (existing.has(key)) conflicts.push({ incoming: row, previous: existing.get(key) }); }
    });
    if (parsed.length === 1) errors.push('目前只有表头，请补充真实数据后预览。');
    return { errors: errors, rows: rows, conflicts: conflicts, source: source, newCount: rows.length - conflicts.length };
  }
  function commitImport(state, text, source, policy) {
    var preview = previewImport(text, source, state);
    if (preview.errors.length) throw new Error(preview.errors.join('\n'));
    if (preview.conflicts.length && policy !== 'replace') throw new Error('存在 ' + preview.conflicts.length + ' 条同门店、日期、菜品记录。请选择明确覆盖，或取消本批。');
    var next = clone(state), stamp = new Date().toISOString(), id = 'dish-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    var batch = { id: id, source: preview.source, confirmedAt: stamp, count: preview.rows.length, replacedCount: preview.conflicts.length, rows: clone(preview.rows), replacements: clone(preview.conflicts) };
    var records = new Map(next.records.map(function (r) { return [rowKey(r), r]; }));
    preview.rows.forEach(function (r) { records.set(rowKey(r), Object.assign({}, r, { batchId: id })); });
    next.records = Array.from(records.values()); next.batches.unshift(batch);
    return next;
  }
  function catalog(state) { return { dishes: Array.from(new Set(state.records.map(function (r) { return r.dish; }))).sort(), stores: Array.from(new Set(state.records.map(function (r) { return r.store; }))).sort() }; }
  function updateConfig(state, group, patch) {
    if (!['new', 'regular'].includes(group)) throw new Error('未知菜品分组。');
    var next = clone(state), config = Object.assign({}, next.configs[group], clone(patch)), choices = catalog(state);
    config.dishes = Array.from(new Set(config.dishes)); config.stores = Array.from(new Set(config.stores));
    if (config.dishes.some(function (s) { return !choices.dishes.includes(s); }) || config.stores.some(function (s) { return !choices.stores.includes(s); })) throw new Error('请选择已确认事实中的菜品和门店。');
    if (!['fixed', 'ongoing'].includes(config.mode)) throw new Error('统计模式无效。');
    next.configs[group] = config; return next;
  }
  function rangeDates(start, end) {
    var count = Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / DAY) + 1;
    if (!Number.isFinite(count) || count < 1 || count > 366) return [];
    return Array.from({ length: count }, function (_, i) { return shift(start, i); });
  }
  function analyze(state, group) {
    var config = state.configs[group], stores = config.stores, messages = [], end = config.endDate;
    if (config.mode === 'ongoing') end = state.records.filter(function (r) { return stores.includes(r.store); }).reduce(function (latest, r) { return r.date > latest ? r.date : latest; }, '');
    if (!config.dishes.length) messages.push('请在已选中面板添加菜品。');
    if (!stores.length) messages.push('请选择统计门店。');
    if (!isDate(config.startDate) || !isDate(end)) messages.push('请设置有效起始日期及截止日期。');
    var dates = isDate(config.startDate) && isDate(end) ? rangeDates(config.startDate, end) : [];
    if (!dates.length && isDate(config.startDate) && isDate(end)) messages.push('日期范围须为 1 至 366 天，截止日期不能早于起始日期。');
    if (messages.length) return { messages: messages, dishes: [], endDate: end, startDate: config.startDate, stores: stores, mode: config.mode };
    var lookup = new Map(state.records.map(function (r) { return [rowKey(r), r]; })), previousEnd = shift(config.startDate, -1), previousStart = shift(config.startDate, -dates.length), previousDates = rangeDates(previousStart, previousEnd);
    function period(dish, periodDates) {
      var recorded = 0, quantity = 0, revenue = 0, sources = new Set();
      var days = periodDates.map(function (date) {
        var dayQty = 0, dayRevenue = 0, count = 0;
        var coverage = stores.map(function (store) {
          var r = lookup.get(rowKey({ store: store, date: date, dish: dish }));
          if (r) { recorded++; count++; quantity += r.quantity; revenue += r.revenue; dayQty += r.quantity; dayRevenue += r.revenue; sources.add(r.batchId); }
          return { store: store, recorded: Boolean(r), quantity: r ? r.quantity : null, revenue: r ? r.revenue : null, batchId: r ? r.batchId : '' };
        });
        return { date: date, quantity: count ? dayQty : null, revenue: count ? dayRevenue : null, recorded: count, expected: stores.length, complete: count === stores.length, coverage: coverage };
      });
      return { quantity: recorded ? quantity : null, revenue: recorded ? revenue : null, recorded: recorded, expected: periodDates.length * stores.length, complete: recorded === periodDates.length * stores.length, days: days, sources: Array.from(sources) };
    }
    var dishes = config.dishes.map(function (dish) {
      var current = period(dish, dates), previous = period(dish, previousDates), comparable = current.complete && previous.complete;
      var reason = !comparable ? '前后同店等长周期的店日记录未完整，变化率留空。' : previous.quantity === 0 ? '前期销量为零，销量变化率无定义。' : '前后同店、等长且记录完整。';
      return { dish: dish, current: current, previous: previous, quantityChange: comparable && previous.quantity > 0 ? (current.quantity - previous.quantity) / previous.quantity : null, revenueChange: comparable && previous.revenue > 0 ? (current.revenue - previous.revenue) / previous.revenue : null, comparisonNote: reason + (comparable && previous.revenue === 0 ? '前期销售额为零，销售额变化率无定义。' : '') };
    });
    return { messages: [], dishes: dishes, startDate: config.startDate, endDate: end, previousStart: previousStart, previousEnd: previousEnd, stores: stores.slice(), mode: config.mode, dayCount: dates.length };
  }
  function formatNumber(n) { return n === null || n === undefined ? '缺失' : Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 }); }
  function formatChange(n) { return n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + (n * 100).toFixed(1) + '%'; }
  function report(state, group) {
    var result = analyze(state, group), lines = ['胡哥餐饮工具 · ' + (group === 'new' ? '新品' : '常规菜品') + '跟踪'];
    if (result.messages.length) return lines.concat(result.messages).join('\n');
    lines.push('门店：' + result.stores.join('、'), '本期：' + result.startDate + ' 至 ' + result.endDate + (result.mode === 'ongoing' ? '（持续统计，截止已确认事实）' : ''), '前期：' + result.previousStart + ' 至 ' + result.previousEnd);
    result.dishes.forEach(function (d) {
      lines.push('', d.dish, '已记录销量：' + formatNumber(d.current.quantity) + '；销售额：' + formatNumber(d.current.revenue) + ' 元', '店日覆盖：' + d.current.recorded + '/' + d.current.expected, '销量变化：' + formatChange(d.quantityChange) + '；销售额变化：' + formatChange(d.revenueChange), d.comparisonNote);
      d.current.days.forEach(function (day) { lines.push(day.date + ' | 销量 ' + formatNumber(day.quantity) + ' | 销售额 ' + formatNumber(day.revenue) + ' | 门店覆盖 ' + day.recorded + '/' + day.expected); });
      lines.push('来源：' + d.current.sources.map(function (id) { var b = state.batches.find(function (batch) { return batch.id === id; }); return b ? b.source + ' [' + id + ']' : id; }).join('；'));
    });
    lines.push('', '口径：未记录不补零；已记录零值保留。金额为导入销售额，未接入订单分母，不计算点单率。');
    return lines.join('\n');
  }
  return { KEY: KEY, HEADER: HEADER, emptyState: emptyState, readState: readState, previewImport: previewImport, commitImport: commitImport, catalog: catalog, updateConfig: updateConfig, analyze: analyze, report: report, formatNumber: formatNumber, formatChange: formatChange, rowKey: rowKey, isDate: isDate };
}));
