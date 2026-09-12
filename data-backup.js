(function () {
  const core = window.HugeBackupCore;
  const byId = id => document.getElementById(id);
  let pending = null;
  let restoring = false;
  const status = message => { byId('backupStatus').textContent = message; };
  async function collect() {
    const records = {};
    core.keys.web.forEach(key => { const value = localStorage.getItem(key); if (value !== null) records[key] = JSON.parse(value); });
    return core.create('web', records, await window.HugeToolsTaskStorage.listTasks());
  }
  async function collectRaw() {
    const records = {};
    core.keys.web.forEach(key => { const value = localStorage.getItem(key); if (value !== null) records[key] = value; });
    let tasks;
    const errors = [];
    try { tasks = await window.HugeToolsTaskStorage.listTasks(); }
    catch (error) { errors.push('任务提醒未能读取：' + error.message); }
    return core.createRaw('web', records, tasks, errors);
  }
  function download(value, prefix) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `${prefix}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportRaw(reason) {
    try {
      const snapshot = await collectRaw();
      download(snapshot, '胡哥餐饮工具_原始诊断副本_不能直接恢复');
      status((typeof reason === 'string' ? '正常备份未生成：' + reason + '。' : '') + '已生成原始诊断副本，原始内容已保留，未经业务校验，不能直接恢复。' + (snapshot.readErrors ? '部分模块未读到：' + snapshot.readErrors.join('；') : ''));
    } catch (error) { status('原始副本未生成：' + error.message); }
  }
  async function exportBackup() {
    try { download(await collect(), '胡哥餐饮工具_网页备份'); status('备份文件已生成，请保存在妥善的位置。'); }
    catch (error) { await exportRaw(error.message); }
  }
  async function review(file) {
    if (restoring) return;
    pending = null; byId('restoreBackupBtn').disabled = true; byId('backupReview').textContent = '';
    try {
      if (!file || file.size > 8 * 1024 * 1024) throw new Error('请选择不超过 8 MB 的备份文件');
      const reviewed = core.parse(await file.text(), 'web');
      if (restoring) return;
      const summary = core.summary(reviewed);
      if (!summary.length) throw new Error('该备份没有可恢复模块');
      pending = reviewed;
      byId('backupReview').textContent = `备份日期：${pending.createdAt || '未记录'}\n将恢复：\n${summary.map(item => '• ' + item.label).join('\n')}\n恢复会替换上述模块；其他模块保持原数据。`;
      byId('restoreBackupBtn').disabled = false; status('核对恢复范围后，再点击确认恢复。');
    } catch (error) { pending = null; status(error.message); }
  }
  const comparableTasks = tasks => JSON.stringify(tasks.slice().sort((a, b) => String(a.id).localeCompare(String(b.id))));
  async function restore() {
    if (restoring || !pending || !window.confirm('确认恢复所列模块？系统会先保留未经修改的原始诊断副本。')) return;
    const selected = pending;
    const changedKeys = [];
    let recovery;
    let tasksTouched = false;
    restoring = true;
    byId('restoreBackupBtn').disabled = true;
    try {
      core.validate(selected, 'web');
      recovery = await collectRaw();
      if ('tasks' in selected && !('rawTasks' in recovery)) throw new Error('无法读取当前任务，未替换任何模块；请先排查任务存储');
      const checkpoint = JSON.stringify(recovery);
      localStorage.setItem('hugetools.backup.recovery.v1', checkpoint);
      if (localStorage.getItem('hugetools.backup.recovery.v1') !== checkpoint) throw new Error('恢复前副本未能保存，未替换任何模块');
      for (const key of Object.keys(selected.records)) {
        const next = JSON.stringify(selected.records[key]);
        changedKeys.push(key);
        localStorage.setItem(key, next);
        if (localStorage.getItem(key) !== next) throw new Error('模块写入后读回不一致：' + core.labels[key]);
      }
      if ('tasks' in selected) {
        tasksTouched = true;
        await window.HugeToolsTaskStorage.replaceAll(selected.tasks);
        if (comparableTasks(await window.HugeToolsTaskStorage.listTasks()) !== comparableTasks(selected.tasks)) throw new Error('任务写入后读回不一致');
      }
      pending = null;
      location.reload();
    } catch (error) {
      const rollbackErrors = [];
      if (recovery) {
        for (const key of changedKeys) {
          try {
            if (Object.prototype.hasOwnProperty.call(recovery.rawRecords, key)) localStorage.setItem(key, core.decodeRaw(recovery.rawRecords[key]));
            else localStorage.removeItem(key);
          } catch (rollback) { rollbackErrors.push(core.labels[key]); }
        }
        if (tasksTouched) {
          try { await window.HugeToolsTaskStorage.replaceAll(core.decodeRaw(recovery.rawTasks)); }
          catch (_) { rollbackErrors.push('任务提醒'); }
        }
      }
      status('恢复未完成：' + error.message + (rollbackErrors.length ? '；以下模块自动回退未完成：' + rollbackErrors.join('、') + '。请下载恢复前原始副本。' : changedKeys.length ? '；已回退到恢复前原始内容。' : '；原数据未变。'));
    } finally {
      restoring = false;
      byId('restoreBackupBtn').disabled = !pending;
    }
  }
  function init() {
    if (!byId('backupStatus')) return;
    byId('exportBackupBtn').addEventListener('click', exportBackup);
    byId('exportRawBackupBtn').addEventListener('click', () => exportRaw());
    byId('backupFile').addEventListener('change', event => review(event.target.files[0]));
    byId('restoreBackupBtn').addEventListener('click', restore);
    byId('recoveryBackupBtn').addEventListener('click', () => {
      try {
        const stored = localStorage.getItem('hugetools.backup.recovery.v1');
        if (!stored) return status('尚无恢复前副本。');
        const value = JSON.parse(stored);
        if (value.format === 'hugetools-raw-diagnostic') {
          download(core.validateRaw(value, 'web'), '胡哥餐饮工具_恢复前原始副本_不能直接恢复');
          status('已生成恢复前原始诊断副本，保留当时的原始内容，不能直接作为正常备份恢复。');
        } else {
          download(core.validate(value, 'web'), '胡哥餐饮工具_恢复前副本');
          status('已生成此前保存的恢复前备份。');
        }
      } catch (error) { status('恢复前副本未生成：' + error.message); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
