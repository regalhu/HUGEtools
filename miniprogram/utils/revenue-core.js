(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HugeRevenueCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ALIASES = { "金沙百联": "金山百联", "新街口": "南京新街口", "宝山共康绿地": "宝山共康" };
  const normalizeStoreName = (value) => ALIASES[String(value || "").trim()] || String(value || "").trim();
  const cents = (value) => Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER / 100 ? Math.round(value * 100) / 100 : null;
  const money = (value) => value === null || !Number.isFinite(value) ? "不可计算" : `¥${cents(value).toFixed(2)}`;
  const percent = (value) => value === null || !Number.isFinite(value) ? "不可计算" : `${value.toFixed(1)}%`;
  const ratio = (value, denominator) => Number.isFinite(value) && Number.isFinite(denominator) && denominator > 0 ? value / denominator * 100 : null;
  const total = (rows, field) => rows.length && rows.every((row) => Number.isFinite(row[field])) ? cents(rows.reduce((sum, row) => sum + row[field], 0)) : null;
  const field = (row, names) => { for (const name of names) if (Object.prototype.hasOwnProperty.call(row, name)) return row[name]; return ""; };

  function number(value) {
    const text = String(value === undefined || value === null ? "" : value).trim();
    if (!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+|\d{1,3}(?:,\d{3})+(?:\.\d+)?)$/.test(text)) return null;
    const parsed = Number(text.replace(/,/g, ""));
    return Number.isFinite(parsed) && Math.abs(parsed) <= Number.MAX_SAFE_INTEGER / 100 ? parsed : null;
  }

  function parseDate(value) {
    const match = String(value || "").trim().replace(/[./]/g, "-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    if (year < 1000 || month < 1 || month > 12 || day < 1) return null;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
  const isoDate = (date) => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "";
  const daysInMonth = (month) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const monthOf = (value) => /^\d{4}-(?:0[1-9]|1[0-2])$/.test(String(value || "").trim()) ? String(value).trim() : "";
  function parseComparableStart(fileName, fallbackYear) {
    const match = String(fileName || "").match(/(?:^|\D)((?:0[1-9]|1[0-2]))((?:0[1-9]|[12]\d|3[01]))(?:\D|$)/);
    return match && fallbackYear ? parseDate(`${fallbackYear}-${match[1]}-${match[2]}`) : null;
  }

  // CSV quoting also accepts pasted TSV; row numbers refer to the original text.
  function parseTable(value, source, issues) {
    const text = String(value || "").replace(/^\uFEFF/, "");
    if (!text.trim()) return [];
    const delimiter = text.split(/\r?\n/)[0].includes("\t") ? "\t" : ",";
    const records = [];
    let cells = [], cell = "", quoted = false, rowNumber = 1, line = 1;
    function endRow() {
      cells.push(cell.trim());
      if (cells.some((item) => item !== "")) records.push({ cells, rowNumber });
      cells = []; cell = ""; rowNumber = line + 1;
    }
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
        else if (quoted || !cell.trim()) quoted = !quoted;
        else cell += char;
      } else if (char === delimiter && !quoted) { cells.push(cell.trim()); cell = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i += 1;
        endRow(); line += 1;
      } else { cell += char; if (char === "\n") line += 1; }
    }
    endRow();
    if (quoted) issues.push({ source, row: rowNumber, code: "invalid_csv", message: "引号未闭合，请检查表格格式" });
    const header = records.shift();
    if (!header) return [];
    if (new Set(header.cells).size !== header.cells.length || header.cells.some((name) => !name)) {
      issues.push({ source, row: header.rowNumber, code: "invalid_header", message: "列名为空或重复，请检查表头" });
    }
    return records.map((record) => {
      const row = { _row: record.rowNumber, _invalid: record.cells.length !== header.cells.length || quoted };
      header.cells.forEach((key, index) => { row[key] = record.cells[index] === undefined ? "" : record.cells[index]; });
      if (row._invalid) issues.push({ source, row: record.rowNumber, code: "invalid_csv", message: "字段数与表头不一致或引号未闭合，请检查分隔符", store: normalizeStoreName(field(row, ["门店", "store"])) });
      return row;
    });
  }
  function groupBy(rows, key) {
    const grouped = new Map();
    rows.forEach((row) => { const value = key(row); if (!grouped.has(value)) grouped.set(value, []); grouped.get(value).push(row); });
    return grouped;
  }
  function filterRow(row, input) {
    return (!input.regionFilter || String(row.region || "未分区").includes(String(input.regionFilter).trim())) &&
      (!input.cityFilter || String(row.city || "未标注").includes(String(input.cityFilter).trim())) &&
      (!input.monthFilter || row.month === String(input.monthFilter).trim());
  }

  function analyze(input) {
    input = { ...(input || {}) };
    ["regionFilter", "cityFilter", "monthFilter"].forEach((name) => { input[name] = String(input[name] || "").trim(); });
    const issues = [];
    const masterRows = parseTable(input.storeMasterText, "master", issues);
    const master = new Map();
    masterRows.forEach((row) => {
      const store = normalizeStoreName(field(row, ["门店", "store", "name"]));
      if (!store) { issues.push({ source: "master", row: row._row, code: "missing_store", message: "门店名称缺失" }); return; }
      if (master.has(store)) issues.push({ source: "master", row: row._row, store, code: "duplicate_master", message: "同一门店主数据重复，请先确认唯一记录" });
      else master.set(store, { store, region: field(row, ["地域", "region"]) || "未分区", city: field(row, ["城市", "city"]) || "未标注", market: field(row, ["市场层级", "market"]) || "未分层" });
    });
    const masterFor = (store) => master.get(store) || { store, region: "未分区", city: "未标注", market: "未分层" };
    const normalizeFacts = (text, source) => parseTable(text, source, issues).map((row) => {
      const store = normalizeStoreName(field(row, ["门店", "store"]));
      const date = parseDate(field(row, ["日期", "date"]));
      const month = date ? isoDate(date).slice(0, 7) : "";
      const context = { source, row: row._row, store, month };
      if (!store || !date) { issues.push({ ...context, code: !store ? "missing_store" : "invalid_date", message: !store ? "门店名称缺失" : "日期缺失或不是真实日历日期" }); return null; }
      const read = (names, optional) => {
        const raw = field(row, names), value = number(raw);
        if (value === null && (!optional || String(raw).trim())) issues.push({ ...context, code: "invalid_number", field: names[0], message: `${names[0]}缺失或不是有效数字` });
        return value;
      };
      const item = { ...masterFor(store), date, dateText: isoDate(date), month, _row: row._row, _invalid: row._invalid };
      if (source === "revenue") {
        item.revenue = read(["折后营业收入", "营业额", "revenue"]);
        item.takeHomeRevenue = read(["到手收入", "takeHomeRevenue"]);
        item.hasTakeHomeRevenue = item.takeHomeRevenue !== null;
        item.orders = read(["订单数", "orders"], true);
        if (item.orders !== null && (item.orders < 0 || !Number.isInteger(item.orders))) { issues.push({ ...context, code: "invalid_orders", field: "订单数", message: "订单数须为非负整数" }); item.orders = null; }
        item.dineInRevenue = read(["堂食收入", "dineInRevenue"], true);
        item.deliveryRevenue = read(["外卖收入", "deliveryRevenue"], true);
      } else {
        item.dish = field(row, ["菜品", "dish"]);
        if (!item.dish) issues.push({ ...context, code: "missing_dish", message: "菜品名称缺失" });
        const mainMenu = String(field(row, ["主菜单", "mainMenu", "isMainMenu"])).trim();
        item.isMainMenu = /^(是|主菜单|true|1|yes)$/i.test(mainMenu) ? true : /^(否|非主菜单|false|0|no)$/i.test(mainMenu) ? false : null;
        item.salesAmount = read(["销售金额", "salesAmount"]);
        item.quantity = read(["销售份数", "quantity"], true);
      }
      return item;
    }).filter(Boolean);
    const revenueRows = normalizeFacts(input.revenueText, "revenue");
    const dishRows = normalizeFacts(input.dishText, "dish");
    function markDuplicates(rows, source, key) {
      groupBy(rows, key).forEach((group) => {
        if (group.length < 2) return;
        group.forEach((row) => { row._duplicate = true; issues.push({ source, row: row._row, store: row.store, month: row.month, code: "duplicate_fact", message: source === "revenue" ? `${row.dateText} 店日营业额重复，请确认唯一记录` : `${row.dateText} ${row.dish} 菜品记录重复，请确认汇总粒度` }); });
      });
    }
    markDuplicates(revenueRows, "revenue", (row) => JSON.stringify([row.store, row.dateText]));
    markDuplicates(dishRows, "dish", (row) => JSON.stringify([row.store, row.dateText, row.dish]));
    const budgetRows = parseTable(input.budgetText, "budget", issues).map((row) => {
      const store = normalizeStoreName(field(row, ["门店", "store"])), month = monthOf(field(row, ["月份", "month"]));
      const explicit = Object.prototype.hasOwnProperty.call(row, "到手收入预算") || Object.prototype.hasOwnProperty.call(row, "takeHomeBudget") || input.budgetBasis === "takeHome";
      const value = number(field(row, explicit ? ["到手收入预算", "takeHomeBudget", "预算", "budget"] : []));
      const budget = explicit && value !== null && value >= 0 && !row._invalid ? value : null;
      const context = { source: "budget", row: row._row, store, month };
      if (!store || !month) { issues.push({ ...context, code: "invalid_budget_key", message: "预算门店缺失或月份无效（须为 YYYY-MM）" }); return null; }
      if (budget === null) issues.push({ ...context, code: explicit ? "invalid_budget" : "ambiguous_budget", message: explicit ? "到手收入预算缺失或不是非负有效数字" : "预算口径未明确；请使用“到手收入预算”列名" });
      return { ...masterFor(store), month, monthlyBudget: budget, _row: row._row };
    }).filter(Boolean);
    const revenueGroups = groupBy(revenueRows, (row) => JSON.stringify([row.store, row.month]));
    const dishGroups = groupBy(dishRows, (row) => JSON.stringify([row.store, row.month]));
    const budgetGroups = groupBy(budgetRows, (row) => JSON.stringify([row.store, row.month]));
    budgetGroups.forEach((group) => { if (group.length > 1) group.forEach((row) => issues.push({ source: "budget", row: row._row, store: row.store, month: row.month, code: "duplicate_budget", message: "同一门店月份预算重复，请确认唯一记录" })); });
    const comparableDishRows = [];
    const monthly = [...new Set([...revenueGroups.keys(), ...dishGroups.keys(), ...budgetGroups.keys()])].map((key) => {
      const rev = revenueGroups.get(key) || [], dishes = dishGroups.get(key) || [], budgets = budgetGroups.get(key) || [];
      const reference = rev[0] || dishes[0] || budgets[0];
      const statuses = [];
      const fileStart = isoDate(parseComparableStart(input.fileName, Number(reference.month.slice(0, 4))));
      const start = [fileStart, input.startDate ? isoDate(parseDate(input.startDate)) : ""].filter(Boolean).sort().pop() || "";
      const end = input.endDate ? isoDate(parseDate(input.endDate)) : "";
      const inRange = (row) => (!start || row.dateText >= start) && (!end || row.dateText <= end);
      const comparableRev = rev.filter(inRange), comparableDish = dishes.filter(inRange);
      const revenueDates = [...new Set(comparableRev.map((row) => row.dateText))].sort();
      const dishDates = [...new Set(comparableDish.map((row) => row.dateText))].sort();
      // An unreadable date/header cannot be silently excluded from an otherwise plausible subtotal.
      const unresolvedFor = (source) => issues.some((issue) => issue.source === source && !issue.month && (!issue.store || issue.store === reference.store));
      const revenueUnresolved = unresolvedFor("revenue") || unresolvedFor("master");
      const dishUnresolved = unresolvedFor("dish") || unresolvedFor("master");
      const comparableRevenue = revenueUnresolved || comparableRev.some((row) => row._duplicate || row._invalid) ? null : total(comparableRev, "revenue");
      const takeHomeRevenue = revenueUnresolved || comparableRev.some((row) => row._duplicate || row._invalid) ? null : total(comparableRev, "takeHomeRevenue");
      const dishSales = dishUnresolved || comparableDish.some((row) => row._duplicate || row._invalid || !row.dish) ? null : total(comparableDish, "salesAmount");
      const coverageComplete = revenueDates.length > 0 && JSON.stringify(revenueDates) === JSON.stringify(dishDates) && comparableRevenue !== null && dishSales !== null;
      const coverageRate = coverageComplete ? ratio(dishSales, comparableRevenue) : null;
      const mainMenuRate = dishSales !== null && comparableDish.every((row) => row.isMainMenu !== null) ? ratio(comparableDish.filter((row) => row.isMainMenu).reduce((sum, row) => sum + (row.salesAmount || 0), 0), dishSales) : null;
      const fullMonth = comparableRevenue !== null && revenueDates.length === daysInMonth(reference.month) && revenueDates[0] === `${reference.month}-01` && revenueDates[revenueDates.length - 1] === `${reference.month}-${daysInMonth(reference.month)}`;
      const monthDates = [...new Set(rev.map((row) => row.dateText))].sort();
      const maxMonthDate = monthDates[monthDates.length - 1] || "";
      const lastDay = maxMonthDate ? Number(maxMonthDate.slice(-2)) : 0;
      const monthToDateComplete = lastDay > 0 && monthDates.length === lastDay && !rev.some((row) => row._duplicate || row._invalid);
      const budgetActualTakeHomeRevenue = monthToDateComplete && !revenueUnresolved ? total(rev, "takeHomeRevenue") : null;
      const monthlyBudget = budgets.length === 1 && !unresolvedFor("budget") ? budgets[0].monthlyBudget : null;
      const timeProgress = lastDay ? lastDay / daysInMonth(reference.month) : null;
      const timeProgressBudget = monthlyBudget !== null && timeProgress !== null ? cents(monthlyBudget * timeProgress) : null;
      if (!rev.length || !dishes.length) statuses.push("门店未匹配");
      if (comparableRevenue === null) statuses.push("折后收入不完整");
      if (takeHomeRevenue === null) statuses.push("到手收入不完整");
      if (dishSales === null) statuses.push("菜品销售不完整");
      if (!coverageComplete) statuses.push("店日覆盖不一致或不完整");
      if (coverageRate > 105) statuses.push("口径异常");
      if (mainMenuRate !== null && mainMenuRate < 75) statuses.push("主菜单匹配偏低");
      if (mainMenuRate === null && comparableDish.length) statuses.push("主菜单口径不完整");
      if (rev.some((row) => row._duplicate)) statuses.push("店日记录重复");
      if (dishes.some((row) => row._duplicate)) statuses.push("菜品记录重复");
      if (!fullMonth) statuses.push("非整月样本");
      if (monthlyBudget === null) statuses.push("预算未接入或待确认");
      if (monthlyBudget !== null && budgetActualTakeHomeRevenue === null) statuses.push("月初至今数据不完整，预算达成不计算");
      if (!statuses.length) statuses.push("口径正常");
      const result = {
        ...masterFor(reference.store), month: reference.month,
        comparableStart: revenueDates[0] || start, comparableEnd: revenueDates[revenueDates.length - 1] || "",
        comparableRevenue, takeHomeRevenue, takeHomeComplete: takeHomeRevenue !== null, takeHomeRate: ratio(takeHomeRevenue, comparableRevenue),
        monthlyBudget, timeProgress, timeProgressBudget, budgetActualTakeHomeRevenue, monthToDateComplete,
        fullMonthBudgetAchievementRate: ratio(budgetActualTakeHomeRevenue, monthlyBudget), timeProgressBudgetAchievementRate: ratio(budgetActualTakeHomeRevenue, timeProgressBudget),
        dishSales, coverageRate, coverageComplete, mainMenuRate, revenueDayCount: revenueDates.length, dishDayCount: dishDates.length,
        orders: revenueUnresolved || comparableRev.some((row) => row._duplicate || row._invalid) ? null : total(comparableRev, "orders"),
        avgRevenue: comparableRevenue !== null && revenueDates.length ? cents(comparableRevenue / revenueDates.length) : null, fullMonth, statuses
      };
      if (filterRow(result, input)) comparableDishRows.push(...comparableDish);
      return result;
    }).filter((row) => filterRow(row, input));
    const scopedIssues = issues.filter((issue) => (!issue.month || !input.monthFilter || issue.month === input.monthFilter) && (!issue.store || filterRow({ ...masterFor(issue.store), month: issue.month || input.monthFilter }, input)));
    const unresolved = (source) => scopedIssues.some((issue) => issue.source === source && (!issue.store || !issue.month));
    const factUnresolved = unresolved("revenue") || unresolved("master");
    const dishUnresolved = unresolved("dish") || unresolved("master");
    const summary = {
      storeCount: new Set(monthly.map((row) => row.store)).size,
      comparableRevenue: factUnresolved ? null : total(monthly, "comparableRevenue"),
      takeHomeRevenue: factUnresolved ? null : total(monthly, "takeHomeRevenue"),
      dishSales: dishUnresolved ? null : total(monthly, "dishSales"),
      monthlyBudget: unresolved("budget") ? null : total(monthly, "monthlyBudget"),
      budgetActualTakeHomeRevenue: factUnresolved ? null : total(monthly, "budgetActualTakeHomeRevenue"),
      abnormalCount: monthly.filter((row) => row.statuses.some((status) => status !== "口径正常" && status !== "非整月样本")).length,
      qualityIssueCount: scopedIssues.length
    };
    summary.takeHomeComplete = summary.takeHomeRevenue !== null;
    summary.budgetComplete = summary.monthlyBudget !== null;
    summary.coverageRate = monthly.length && monthly.every((row) => row.coverageComplete) ? ratio(summary.dishSales, summary.comparableRevenue) : null;
    summary.takeHomeRate = ratio(summary.takeHomeRevenue, summary.comparableRevenue);
    summary.fullMonthBudgetAchievementRate = ratio(summary.budgetActualTakeHomeRevenue, summary.monthlyBudget);
    const dishTop = [...groupBy(dishUnresolved ? [] : comparableDishRows, (row) => row.dish).values()].map((rows) => ({ dish: rows[0].dish, salesAmount: rows.some((row) => row._duplicate || row._invalid) ? null : total(rows, "salesAmount"), storeCount: new Set(rows.map((row) => row.store)).size })).filter((row) => row.dish && row.salesAmount !== null).sort((a, b) => b.salesAmount - a.salesAmount).slice(0, 8);
    const segmentRows = [];
    ["region", "market"].forEach((dimension) => groupBy(monthly, (row) => row[dimension]).forEach((rows, label) => {
      const comparableRevenue = factUnresolved ? null : total(rows, "comparableRevenue"), dishSales = dishUnresolved ? null : total(rows, "dishSales");
      segmentRows.push({ label: `${dimension === "region" ? "地域" : "市场"}：${label}`, comparableRevenue, dishSales, coverageRate: rows.every((row) => row.coverageComplete) ? ratio(dishSales, comparableRevenue) : null });
    }));
    const result = { revenueRows, dishRows, monthly, summary, issues: scopedIssues, dishTop, segmentRows, coverageTop: monthly.filter((row) => row.coverageRate !== null).slice().sort((a, b) => b.coverageRate - a.coverageRate).slice(0, 8), dailyRank: monthly.filter((row) => row.fullMonth).sort((a, b) => b.avgRevenue - a.avgRevenue).slice(0, 8) };
    result.report = buildReport(result);
    return result;
  }

  function buildReport(result) {
    const summary = result.summary;
    return [
      "门店营业额联合分析素材（按本次导入记录计算）",
      `纳入门店：${summary.storeCount} 家`,
      `可比范围折后营业收入：${money(summary.comparableRevenue)}`,
      `可比范围到手收入：${money(summary.takeHomeRevenue)}`,
      `到手率：${percent(summary.takeHomeRate)}（到手收入 ÷ 同范围折后营业收入 × 100%）`,
      `所纳入店月到手收入预算：${money(summary.monthlyBudget)}`,
      `全月预算达成率：${percent(summary.fullMonthBudgetAchievementRate)}（使用月初至最后录入日的完整到手收入）`,
      `菜品销售金额：${money(summary.dishSales)}`,
      `菜品销售金额/营业额覆盖率：${percent(summary.coverageRate)}`,
      ...result.monthly.map((row) => `${row.store} ${row.month}：${row.comparableStart || "无有效日期"} 至 ${row.comparableEnd || "无有效日期"}；营业额 ${row.revenueDayCount} 天 / 菜品 ${row.dishDayCount} 天；${row.statuses.join(" / ")}`),
      result.issues.length ? `导入待核查 ${result.issues.length} 项：\n${result.issues.slice(0, 50).map((item) => `${({ revenue: "营业额", dish: "菜品", budget: "预算", master: "主数据" })[item.source] || item.source}第 ${item.row || "?"} 行：${item.message}`).join("\n")}${result.issues.length > 50 ? "\n更多问题请分批检查原表。" : ""}` : (summary.storeCount ? "未发现已校验的格式与重复记录问题；仍需核对导入范围是否完整。" : "请导入真实经营数据后分析。"),
      "边界：缺失不补零，重复记录不自动累加；比例仅在同店日范围完整时计算。真实零值保留。",
      "预算仅使用明确的到手收入预算；月初起连续日期或到手收入缺失时不计算达成率。",
      "覆盖率仅作销售结构参考，不等于真实营业贡献率、毛利率或利润贡献；输入内容须经业务核实。"
    ].join("\n");
  }
  return { analyze, normalizeStoreName, parseComparableStart, parseDate, isoDate, parseNumber: number, money, percent };
});
