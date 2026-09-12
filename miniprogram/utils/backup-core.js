(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HugeBackupCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const shared = ['hugetools.operations-center.v1', 'hugetools.dish-tracking.v1'];
  const keys = {
    web: ['hugetools.operations-workbench.v1', 'hugetools.incentiveSystem.v1', 'hugetools.taskReminder.settings', 'hugetools.revenue.v1'].concat(shared),
    wechat: ['hugetools.operations.v1', 'hugetools.revenue.v1'].concat(shared)
  };
  const labels = {
    'hugetools.operations-workbench.v1': '会议、日志、资料与培训',
    'hugetools.operations.v1': '工作台、任务与激励',
    'hugetools.incentiveSystem.v1': '员工激励',
    'hugetools.taskReminder.settings': '任务视图设置',
    'hugetools.revenue.v1': '营业额分析输入',
    'hugetools.operations-center.v1': '执行闭环与多人进度',
    'hugetools.dish-tracking.v1': '菜品事实、来源与跟踪设置'
  };
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string';
  const nonempty = value => text(value) && value.trim().length > 0;
  const identifier = value => nonempty(value) || (typeof value === 'number' && Number.isFinite(value));
  function requireValue(condition, message) { if (!condition) throw new Error(message); }
  function validRows(rows, label, check) {
    requireValue(Array.isArray(rows), '记录列表格式错误：' + label);
    const ids = new Set();
    rows.forEach(row => {
      requireValue(object(row) && identifier(row.id), '记录编号缺失：' + label);
      requireValue(!ids.has(String(row.id)), '记录编号重复：' + label);
      ids.add(String(row.id));
      check(row);
    });
  }
  function validateLegacy(entry, fields) {
    requireValue(fields.some(field => Object.prototype.hasOwnProperty.call(entry, field)), '模块缺少记录列表');
    const required = { meetings: ['title'], meetingRecords: ['title'], logs: ['completed'], logRecords: ['completed'], resources: ['title'], resourceRecords: ['title'], training: ['session'], trainingRecords: ['session'], taskRecords: ['name', 'role'], incentiveRecords: ['employee', 'taskName'] };
    fields.filter(field => field in entry).forEach(field => validRows(entry[field], field, row => {
      requireValue(required[field].every(key => nonempty(row[key])), '记录必要字段缺失：' + field);
      ['title', 'date', 'period', 'topic', 'owner', 'dueDate', 'dueTime', 'progress', 'summary', 'completed', 'issue', 'next', 'category', 'content', 'source', 'session', 'trainer', 'retrain', 'feedback', 'name', 'role', 'priority', 'frequency', 'note', 'employee', 'taskName'].forEach(key => {
        if (key in row) requireValue(text(row[key]), '记录文本格式错误：' + field + '.' + key);
      });
      if (field === 'taskRecords') requireValue(['pending', 'done'].includes(row.status), '任务状态格式错误');
      if (field === 'incentiveRecords') ['score', 'points'].forEach(key => requireValue(Number.isFinite(row[key]), '激励评分格式错误：' + key));
    }));
  }
  function validateIncentive(entry) {
    validRows(entry.employees, 'employees', row => requireValue(nonempty(row.id) && nonempty(row.name) && text(row.role), '员工信息不完整'));
    validRows(entry.tasks, 'incentive tasks', row => requireValue(nonempty(row.id) && nonempty(row.title) && text(row.role) && text(row.ownerId), '激励任务信息不完整'));
    validRows(entry.records, 'incentive records', row => requireValue(nonempty(row.id) && text(row.taskId) && text(row.employeeId) && ['pending', 'completed', 'missed'].includes(row.status) && Number.isFinite(row.score) && Number.isFinite(row.points) && text(row.dueAt) && Number.isFinite(new Date(row.dueAt).getTime()), '激励执行记录不完整'));
  }
  function validateReminderTasks(tasks) {
    validRows(tasks, '任务提醒', row => {
      requireValue(nonempty(row.id) && nonempty(row.title) && text(row.role) && typeof row.enabled === 'boolean', '任务提醒必要字段缺失');
      requireValue(object(row.schedule) && ['once', 'daily', 'weekly', 'monthly_date', 'monthly_last', 'custom_interval'].includes(row.schedule.type) && text(row.schedule.time), '任务提醒周期格式错误');
      requireValue(Array.isArray(row.completedHistory), '任务提醒完成历史格式错误');
      requireValue(row.completedHistory.every(item => object(item) && text(item.completedAt) && Number.isFinite(new Date(item.completedAt).getTime())), '任务提醒完成历史内容异常');
      if (row.nextDueAt != null) requireValue(text(row.nextDueAt) && Number.isFinite(new Date(row.nextDueAt).getTime()), '任务提醒到期时间异常');
    });
  }
  function clean(value, depth) {
    if (depth > 30) throw new Error('备份层级过深');
    if (!value || typeof value !== 'object') return;
    Object.keys(value).forEach(key => {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('备份含有不支持的字段');
      clean(value[key], depth + 1);
    });
  }
  function validate(value, platform) {
    if (value && value.format === 'hugetools-raw-diagnostic') throw new Error('这是原始诊断副本，未经业务校验，不能直接恢复；请选择正常备份文件');
    if (!keys[platform] || !value || value.format !== 'hugetools-local-backup' || value.schemaVersion !== 1) throw new Error('不是支持的胡哥餐饮工具备份');
    if (value.platform !== platform) throw new Error('请恢复到导出备份时使用的同一端（网页或微信）');
    if (!value.records || typeof value.records !== 'object' || Array.isArray(value.records)) throw new Error('备份记录格式错误');
    clean(value, 0);
    for (const key of Object.keys(value.records)) {
      if (!keys[platform].includes(key)) throw new Error('备份包含未知模块');
      const entry = value.records[key];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('模块记录格式错误：' + labels[key]);
      if (key === 'hugetools.operations-center.v1') {
        const operations = typeof module === 'object' && module.exports ? require('./operations-core') : globalThis.HugeOperationsCore;
        operations.readState(entry);
      }
      if (key === 'hugetools.dish-tracking.v1') {
        const dishes = typeof module === 'object' && module.exports ? require('./dish-tracking-core') : globalThis.HugeDishTrackingCore;
        dishes.readState(entry);
      }
      if (key === 'hugetools.operations-workbench.v1') validateLegacy(entry, ['meetings', 'logs', 'resources', 'training']);
      if (key === 'hugetools.operations.v1') validateLegacy(entry, ['meetingRecords', 'logRecords', 'resourceRecords', 'trainingRecords', 'taskRecords', 'incentiveRecords']);
      if (key === 'hugetools.incentiveSystem.v1') validateIncentive(entry);
      if (key === 'hugetools.taskReminder.settings') {
        requireValue(['roleFilter', 'viewFilter'].some(field => field in entry), '任务视图设置为空');
        ['roleFilter', 'viewFilter'].forEach(field => { if (field in entry) requireValue(text(entry[field]), '任务视图设置格式错误'); });
      }
      if (key === 'hugetools.revenue.v1') {
        const fields = platform === 'web' ? ['revenueFileName', 'storeMasterText', 'storeRevenueText', 'storeBudgetText', 'dishSalesText'] : ['fileName', 'storeMasterText', 'revenueText', 'budgetText', 'dishText'];
        requireValue(fields.every(field => text(entry[field])), '营业额分析输入字段缺失或格式错误');
        ['revenueRegionFilter', 'revenueCityFilter', 'revenueMonthFilter', 'regionFilter', 'cityFilter', 'monthFilter'].forEach(field => { if (field in entry) requireValue(text(entry[field]), '营业额筛选范围格式错误'); });
      }
    }
    if ('tasks' in value && (platform !== 'web' || !Array.isArray(value.tasks))) throw new Error('任务备份格式错误');
    if ('tasks' in value) validateReminderTasks(value.tasks);
    return value;
  }
  function parse(text, platform) {
    if (typeof text !== 'string' || text.length > 8 * 1024 * 1024) throw new Error('备份超过 8 MB 或格式无效');
    let value;
    try { value = JSON.parse(text); } catch (_) { throw new Error('无法读取备份，请选择完整的备份文件'); }
    return validate(value, platform);
  }
  function create(platform, records, tasks) {
    const value = { format: 'hugetools-local-backup', schemaVersion: 1, version: '0.9.0', platform, createdAt: new Date().toISOString(), records };
    if (tasks !== undefined) value.tasks = tasks;
    return validate(value, platform);
  }
  function summary(value) {
    const items = Object.keys(value.records).map(key => ({ key, label: labels[key], size: JSON.stringify(value.records[key]).length }));
    if ('tasks' in value) items.push({ key: 'tasks', label: '门店任务提醒 · ' + value.tasks.length + ' 项', size: JSON.stringify(value.tasks).length });
    return items;
  }
  // Diagnostic snapshots encode values without applying business schemas or parsing
  // raw storage strings. Tags preserve undefined, non-finite numbers and empty values.
  function encodeRaw(value, ancestors, depth) {
    const stack = ancestors || [];
    requireValue((depth || 0) <= 60, '原始数据层级过深，未生成副本');
    if (value === null) return { type: 'null' };
    if (value === undefined) return { type: 'undefined' };
    if (typeof value === 'string' || typeof value === 'boolean') return { type: typeof value, value };
    if (typeof value === 'number') return { type: 'number', value: Number.isNaN(value) ? 'NaN' : value === Infinity ? 'Infinity' : value === -Infinity ? '-Infinity' : Object.is(value, -0) ? '-0' : value };
    if (typeof value === 'bigint') return { type: 'bigint', value: String(value) };
    requireValue(typeof value === 'object' && !stack.includes(value), '原始数据含无法编码的值，未生成副本');
    const next = stack.concat([value]);
    if (Object.prototype.toString.call(value) === '[object Date]') return { type: 'date', value: Number.isNaN(value.getTime()) ? 'invalid' : value.toISOString() };
    if (Array.isArray(value)) return { type: 'array', value: Array.from({ length: value.length }, (_, index) => index in value ? encodeRaw(value[index], next, (depth || 0) + 1) : { type: 'hole' }) };
    requireValue(Object.prototype.toString.call(value) === '[object Object]', '原始数据含不支持的对象类型，未生成副本');
    return { type: 'object', value: Object.keys(value).map(key => [key, encodeRaw(value[key], next, (depth || 0) + 1)]) };
  }
  function decodeRaw(encoded, depth) {
    requireValue((depth || 0) <= 60 && object(encoded) && text(encoded.type), '原始诊断副本编码异常');
    const decode = item => decodeRaw(item, (depth || 0) + 1);
    if (encoded.type === 'null') return null;
    if (encoded.type === 'undefined') return undefined;
    if (encoded.type === 'string' || encoded.type === 'boolean') { requireValue(typeof encoded.value === encoded.type, '原始值类型异常'); return encoded.value; }
    if (encoded.type === 'number') {
      const special = { NaN: NaN, Infinity: Infinity, '-Infinity': -Infinity, '-0': -0 };
      requireValue(Number.isFinite(encoded.value) || Object.prototype.hasOwnProperty.call(special, encoded.value), '原始数字编码异常');
      return typeof encoded.value === 'number' ? encoded.value : special[encoded.value];
    }
    if (encoded.type === 'bigint') { requireValue(text(encoded.value) && /^-?\d+$/.test(encoded.value), '原始整数编码异常'); return BigInt(encoded.value); }
    if (encoded.type === 'date') { const result = new Date(encoded.value === 'invalid' ? NaN : encoded.value); requireValue(encoded.value === 'invalid' || Number.isFinite(result.getTime()), '原始日期编码异常'); return result; }
    requireValue(Array.isArray(encoded.value), '原始容器编码异常');
    if (encoded.type === 'array') {
      const result = new Array(encoded.value.length);
      encoded.value.forEach((item, index) => { if (!item || item.type !== 'hole') result[index] = decode(item); });
      return result;
    }
    requireValue(encoded.type === 'object', '原始对象编码异常');
    const result = {};
    encoded.value.forEach(pair => {
      requireValue(Array.isArray(pair) && pair.length === 2 && text(pair[0]) && !Object.prototype.hasOwnProperty.call(result, pair[0]), '原始对象字段异常');
      Object.defineProperty(result, pair[0], { value: decode(pair[1]), enumerable: true, writable: true, configurable: true });
    });
    return result;
  }
  function validateRaw(value, platform) {
    requireValue(value && value.format === 'hugetools-raw-diagnostic' && value.schemaVersion === 1 && keys[platform] && value.platform === platform && object(value.rawRecords), '不是支持的原始诊断副本');
    Object.keys(value.rawRecords).forEach(key => {
      requireValue(keys[platform].includes(key), '原始副本包含未知模块');
      const decoded = decodeRaw(value.rawRecords[key]);
      if (platform === 'web') requireValue(text(decoded), '网页原始存储值必须为字符串');
    });
    if ('rawTasks' in value) { requireValue(platform === 'web', '任务副本端类型错误'); decodeRaw(value.rawTasks); }
    if ('readErrors' in value) requireValue(Array.isArray(value.readErrors) && value.readErrors.every(text), '原始副本读取说明异常');
    return value;
  }
  function createRaw(platform, rawRecords, tasks, readErrors) {
    const value = { format: 'hugetools-raw-diagnostic', schemaVersion: 1, platform, createdAt: new Date().toISOString(), notice: '原始诊断副本：未经业务校验，仅用于排查与人工修复，不能直接作为正常备份恢复。', rawRecords: {} };
    Object.keys(rawRecords).forEach(key => { value.rawRecords[key] = encodeRaw(rawRecords[key]); });
    if (tasks !== undefined) value.rawTasks = encodeRaw(tasks);
    if (readErrors && readErrors.length) value.readErrors = readErrors.slice();
    return validateRaw(value, platform);
  }
  return { keys, labels, parse, validate, create, summary, encodeRaw, decodeRaw, createRaw, validateRaw };
});
