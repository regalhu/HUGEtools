(function () {
  const key = 'hugetools.revenue.v1';
  const textFields = ['revenueFileName', 'storeMasterText', 'storeRevenueText', 'storeBudgetText', 'dishSalesText'];
  const filters = [
    { id: 'revenueRegionFilter', property: 'region', label: '地域' },
    { id: 'revenueCityFilter', property: 'city', label: '城市' },
    { id: 'revenueMonthFilter', property: 'month', label: '月份' }
  ];
  const allFields = textFields.concat(filters.map(filter => filter.id));
  const byId = id => document.getElementById(id);

  function readSaved() {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        !textFields.every(id => typeof data[id] === 'string') ||
        !filters.every(filter => data[filter.id] === undefined || typeof data[filter.id] === 'string')) {
      throw new Error('已保存分析输入结构异常');
    }
    return data;
  }

  function collect() {
    const data = {};
    allFields.forEach(id => {
      const input = byId(id);
      if (!input || typeof input.value !== 'string') throw new Error('页面输入字段未就绪，请刷新后重试。');
      data[id] = input.value;
    });
    return data;
  }

  function analyzeInput(data) {
    return {
      fileName: data.revenueFileName,
      storeMasterText: data.storeMasterText,
      revenueText: data.storeRevenueText,
      budgetText: data.storeBudgetText,
      dishText: data.dishSalesText
    };
  }

  function init() {
    const panel = byId('tool-revenue');
    if (!panel || byId('revenueSaveBar')) return;
    const bar = document.createElement('div');
    bar.id = 'revenueSaveBar'; bar.className = 'revenue-save-bar';
    const button = document.createElement('button');
    button.id = 'saveRevenueInputBtn'; button.type = 'button';
    button.textContent = '保存本次分析输入与范围'; button.className = 'ghost-button';
    const message = document.createElement('span');
    message.id = 'revenueSaveStatus'; message.setAttribute('role', 'status');
    bar.append(button, message); panel.prepend(bar);
    let locked = false;
    let availableRows = null;
    let baseMessage = '录入后可保存输入与地域、城市、月份范围，方便下次继续。';

    function lock() {
      locked = true;
      button.disabled = true;
      message.textContent = '已保存分析输入读取失败，已锁定保存并保留原内容。请先从数据备份导出核对，修复后重新打开页面。';
    }

    function showScope() {
      if (locked) return;
      const active = filters.map(filter => ({ ...filter, value: String(byId(filter.id)?.value || '').trim() })).filter(filter => filter.value);
      if (!active.length) {
        message.textContent = `${baseMessage} 当前筛选：全部地域、全部城市、全部月份。`;
        return;
      }
      const description = active.map(filter => `${filter.label}「${filter.value}」`).join('、');
      if (availableRows === null) {
        message.textContent = `${baseMessage} 已保留范围：${description}；当前无法核对范围匹配，请检查分析组件。`;
        return;
      }
      const matches = availableRows.some(row => active.every(filter => filter.property === 'month'
        ? row.month === filter.value
        : String(row[filter.property] || '').includes(filter.value)));
      message.textContent = matches
        ? `${baseMessage} 当前范围：${description}。`
        : `${baseMessage} 所选范围 ${description} 在当前导入数据中无匹配；仍保留原筛选，未扩大到全部范围，请核对数据或手动修改筛选。`;
    }

    function rebuildOptions() {
      const preserved = new Map(filters.map(filter => [filter.id, byId(filter.id)?.value || '']));
      const api = window.HugeToolsRevenueAnalysis || window.HugeRevenueCore;
      try {
        availableRows = api && typeof api.analyze === 'function' ? api.analyze(analyzeInput(collect())).monthly : null;
        if (!Array.isArray(availableRows)) availableRows = null;
      } catch (_) { availableRows = null; }
      filters.forEach(filter => {
        const input = byId(filter.id);
        if (!input) return;
        const value = preserved.get(filter.id);
        const options = [...new Set((availableRows || []).map(row => row[filter.property]).filter(item => typeof item === 'string' && item))].sort();
        const isSelect = input.tagName === 'SELECT';
        let target = input;
        if (!isSelect) {
          const listId = `${filter.id}Options`;
          target = byId(listId);
          if (!target) { target = document.createElement('datalist'); target.id = listId; panel.append(target); }
          input.setAttribute('list', listId);
        }
        target.replaceChildren();
        if (isSelect) {
          const option = document.createElement('option'); option.value = ''; option.textContent = `全部${filter.label}`; target.append(option);
        }
        options.forEach(item => {
          const option = document.createElement('option'); option.value = item; option.textContent = item; target.append(option);
        });
        // A stale selection must remain selected even when rebuilt options no longer contain it.
        if (isSelect && value && !options.includes(value)) {
          const option = document.createElement('option'); option.value = value; option.textContent = `${value}（保留的筛选值）`; target.append(option);
        }
        input.value = value;
      });
      showScope();
    }

    function recalculate() {
      const analyze = byId('analyzeRevenueBtn');
      if (analyze) analyze.click();
    }

    button.addEventListener('click', () => {
      if (locked) return;
      // Recheck so corruption or an unreadable record from another tab is never overwritten.
      try { readSaved(); } catch (_) { lock(); return; }
      let data;
      try { data = collect(); }
      catch (error) { message.textContent = error.message; return; }
      try {
        localStorage.setItem(key, JSON.stringify(data));
        baseMessage = '已保存分析输入与筛选范围，可在数据备份中一并导出。';
        rebuildOptions();
      } catch (_) { message.textContent = '保存失败，输入与范围尚未保存。请检查本机空间并先导出备份。'; }
    });

    function changed(rebuild) {
      if (locked) return;
      baseMessage = '输入或筛选已修改，尚未保存。';
      if (rebuild) rebuildOptions(); else showScope();
    }
    textFields.forEach(id => {
      byId(id)?.addEventListener('input', () => changed(true));
      byId(id)?.addEventListener('change', () => changed(true));
    });
    filters.forEach(filter => {
      byId(filter.id)?.addEventListener('input', () => changed(false));
      byId(filter.id)?.addEventListener('change', () => changed(false));
    });
    byId('loadRevenueSampleBtn')?.addEventListener('click', () => changed(true));

    let data;
    try { data = readSaved(); } catch (_) { lock(); return; }
    if (data) {
      textFields.forEach(id => { const input = byId(id); if (input) input.value = data[id]; });
      const legacy = filters.some(filter => data[filter.id] === undefined);
      // Restore all values before rebuilding choices and before the first restored calculation.
      filters.forEach(filter => {
        const input = byId(filter.id);
        if (!input) return;
        const value = data[filter.id] === undefined ? '' : data[filter.id];
        if (input.tagName === 'SELECT' && value) {
          const option = document.createElement('option'); option.value = value; option.textContent = value; input.append(option);
        }
        input.value = value;
      });
      baseMessage = legacy
        ? '已恢复旧版分析输入；旧版未完整保存筛选范围，缺失项暂按全部处理，请重新确认后保存。'
        : '已恢复本机保存的分析输入与筛选范围。';
    }
    rebuildOptions();
    recalculate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
