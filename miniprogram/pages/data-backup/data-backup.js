const core = require('../../utils/backup-core');
Page({
  data: { status: '记录保存在本机。建议在更换设备或清理微信前导出备份。', backupText: '', review: [], backupDate: '', canRestore: false, filePath: '', fileName: '', restoring: false },
  storedValues() {
    const storedKeys = new Set(wx.getStorageInfoSync().keys);
    const records = {};
    core.keys.wechat.forEach(key => { if (storedKeys.has(key)) records[key] = wx.getStorageSync(key); });
    return records;
  },
  collect() {
    const raw = this.storedValues();
    const records = {};
    Object.keys(raw).forEach(key => { records[key] = typeof raw[key] === 'string' ? JSON.parse(raw[key]) : raw[key]; });
    return core.create('wechat', records);
  },
  collectRaw() { return core.createRaw('wechat', this.storedValues()); },
  writeExport(value, prefix, message) {
    const text = JSON.stringify(value, null, 2);
    const fileName = `${prefix}.json`;
    const filePath = `${wx.env.USER_DATA_PATH}/hugetools-export-${Date.now()}.json`;
    wx.getFileSystemManager().writeFileSync(filePath, text, 'utf8');
    this._exportText = text;
    this.setData({ filePath, fileName, status: message });
  },
  exportBackup() {
    this._exportText = '';
    this.setData({ filePath: '', fileName: '' });
    try { this.writeExport(this.collect(), '胡哥餐饮工具_微信备份', '备份文件已在本机生成。点击保存/转发自行选择留存位置；也可复制文件文本。'); }
    catch (error) { this.exportRaw(error.message); }
  },
  exportRaw(reason) {
    this._exportText = '';
    this.setData({ filePath: '', fileName: '' });
    try { this.writeExport(this.collectRaw(), '胡哥餐饮工具_原始诊断副本_不能直接恢复', (typeof reason === 'string' ? '正常备份未生成：' + reason + '。' : '') + '原始诊断副本已生成，原始内容已保留，未经业务校验，不能直接恢复。'); }
    catch (error) { this.setData({ status: '原始副本未生成：' + error.message }); }
  },
  shareBackup() {
    if (!this.data.filePath) return;
    if (!wx.shareFileMessage) return this.setData({ status: '当前微信不支持分享文件，请使用复制文件文本。' });
    wx.shareFileMessage({ filePath: this.data.filePath, fileName: this.data.fileName, fail: () => this.setData({ status: '文件尚未分享，可重新选择或复制文件文本。' }) });
  },
  copyBackup() {
    if (!this._exportText) return this.setData({ status: '请先生成需要保存的文件。' });
    wx.setClipboardData({ data: this._exportText, fail: () => this.setData({ status: '复制未完成，请使用已生成的文件。' }) });
  },
  clearPending() { this._pending = null; this.setData({ canRestore: false, review: [], backupDate: '' }); },
  onBackupInput(event) { if (this.data.restoring) return; this.clearPending(); this.setData({ backupText: event.detail.value }); },
  readBackup() {
    if (this.data.restoring) return;
    this.clearPending();
    wx.chooseMessageFile({ count: 1, type: 'file', extension: ['json'], success: result => {
      try {
        const file = result.tempFiles[0];
        if (!file || file.size > 8 * 1024 * 1024) throw new Error('请选择不超过 8 MB 的备份文件');
        this.prepare(wx.getFileSystemManager().readFileSync(file.path, 'utf8'));
      } catch (error) { this.setData({ status: error.message }); }
    }, fail: () => this.setData({ status: '尚未选择备份文件，也可以粘贴备份文本。' }) });
  },
  reviewBackup() { this.prepare(this.data.backupText); },
  prepare(text) {
    if (this.data.restoring) return;
    this.clearPending();
    try {
      const value = core.parse(text, 'wechat');
      const review = core.summary(value);
      if (!review.length) throw new Error('备份没有可恢复模块');
      this._pending = value;
      this.setData({ review, backupDate: value.createdAt || '未记录', canRestore: true, status: '核对下列模块；恢复将替换这些模块，其他模块保持原数据。' });
    } catch (error) { this.setData({ status: error.message }); }
  },
  restoreBackup() {
    if (!this._pending || this.data.restoring) return;
    wx.showModal({ title: '确认恢复所列模块', content: '系统会先保留未经修改的原始诊断副本，再替换所列模块。', success: result => { if (result.confirm) this.applyBackup(); } });
  },
  applyBackup() {
    if (!this._pending || this.data.restoring) return;
    const selected = this._pending;
    const changedKeys = [];
    let recovery;
    this.setData({ restoring: true });
    try {
      core.validate(selected, 'wechat');
      recovery = this.collectRaw();
      wx.setStorageSync('hugetools.backup.recovery.v1', recovery);
      if (JSON.stringify(wx.getStorageSync('hugetools.backup.recovery.v1')) !== JSON.stringify(recovery)) throw new Error('恢复前副本未能保存，未替换任何模块');
      Object.keys(selected.records).forEach(key => {
        changedKeys.push(key);
        wx.setStorageSync(key, selected.records[key]);
        if (JSON.stringify(wx.getStorageSync(key)) !== JSON.stringify(selected.records[key])) throw new Error('模块写入后读回不一致：' + core.labels[key]);
      });
      this.clearPending();
      this._exportText = '';
      this.setData({ filePath: '', fileName: '', status: '恢复已完成并读回核对。返回工作台后可重新查看记录；恢复前原始副本已保留。' });
    } catch (error) {
      const failed = [];
      if (recovery) changedKeys.forEach(key => {
        try {
          if (Object.prototype.hasOwnProperty.call(recovery.rawRecords, key)) wx.setStorageSync(key, core.decodeRaw(recovery.rawRecords[key]));
          else wx.removeStorageSync(key);
        } catch (_) { failed.push(core.labels[key]); }
      });
      this.setData({ status: '恢复未完成：' + error.message + (failed.length ? '；以下模块自动回退未完成：' + failed.join('、') + '。请导出恢复前原始副本。' : changedKeys.length ? '；已回退到恢复前原始内容。' : '；原数据未变。') });
    } finally { this.setData({ restoring: false }); }
  },
  exportRecovery() {
    this._exportText = '';
    this.setData({ filePath: '', fileName: '' });
    try {
      const previous = wx.getStorageSync('hugetools.backup.recovery.v1');
      if (!previous) throw new Error('尚无恢复前副本');
      if (previous.format === 'hugetools-raw-diagnostic') this.writeExport(core.validateRaw(previous, 'wechat'), '胡哥餐饮工具_恢复前原始副本_不能直接恢复', '恢复前原始诊断副本已生成，保留当时的原始内容，不能直接作为正常备份恢复。');
      else this.writeExport(core.validate(previous, 'wechat'), '胡哥餐饮工具_恢复前副本', '此前保存的恢复前备份已生成，可保存文件或复制文本。');
    } catch (error) { this.setData({ status: '恢复前副本未生成：' + error.message }); }
  }
});
