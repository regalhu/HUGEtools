(function (root, factory) {
  const api = factory();
  root.HugeToolsRevenueAnalysis = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => api.mount());
    else api.mount();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ALIASES = {
    "金沙百联": "金山百联",
    "新街口": "南京新街口",
    "宝山共康绿地": "宝山共康"
  };

  const SAMPLE_MASTER = [
    "门店,地域,城市,市场层级",
    "宝山共康,上海区域,上海,成熟市场",
    "金山百联,上海区域,上海,成长市场",
    "南京新街口,江苏区域,南京,核心市场"
  ].join("\n");

  const SAMPLE_REVENUE = [
    "门店,日期,折后营业收入,到手收入,订单数,堂食收入,外卖收入",
    "宝山共康绿地,2026-06-05,12800,11600,310,9200,3600",
    "宝山共康绿地,2026-06-06,13600,12240,328,9800,3800",
    "宝山共康绿地,2026-06-07,14100,12750,340,10100,4000",
    "金沙百联,2026-06-01,9600,8640,220,7100,2500",
    "金沙百联,2026-06-02,9800,8820,226,7200,2600",
    "新街口,2026-06-01,16800,15120,410,12300,4500",
    "新街口,2026-06-02,17200,15480,422,12600,4600"
  ].join("\n");

  const SAMPLE_BUDGET = [
    "门店,月份,到手收入预算",
    "宝山共康,2026-06,420000",
    "金山百联,2026-06,300000",
    "南京新街口,2026-06,520000"
  ].join("\n");

  const SAMPLE_DISH = [
    "门店,日期,菜品,主菜单,销售金额,销售份数",
    "宝山共康,2026-06-05,招牌辣子鸡,是,4200,105",
    "宝山共康,2026-06-05,口水鸡,是,3100,88",
    "宝山共康,2026-06-06,招牌辣子鸡,是,4600,115",
    "宝山共康,2026-06-07,活动券核销,否,12800,260",
    "金山百联,2026-06-01,宫保鸡丁,是,5600,140",
    "金山百联,2026-06-02,宫保鸡丁,是,5800,145",
    "南京新街口,2026-06-01,水煮鱼,是,6900,98",
    "南京新街口,2026-06-02,水煮鱼,是,7200,102"
  ].join("\n");

  function byId(id) {
    return typeof document === "undefined" ? null : document.getElementById(id);
  }

  function cents(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function money(value) {
    return `¥${cents(value).toFixed(2)}`;
  }

  function percent(value) {
    return `${(Number(value) || 0).toFixed(1)}%`;
  }

  function safeText(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function normalizeStoreName(name) {
    const raw = String(name || "").trim();
    return ALIASES[raw] || raw;
  }

  function splitLine(line) {
    return String(line || "").split(/\t|,/).map((item) => item.trim());
  }

  function parseTable(text) {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const header = splitLine(lines[0]);
    return lines.slice(1).map((line) => {
      const cells = splitLine(line);
      return header.reduce((row, key, index) => {
        row[key] = cells[index] || "";
        return row;
      }, {});
    });
  }

  function parseDate(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const normalized = text.replace(/[./]/g, "-");
    const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isoDate(date) {
    return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "";
  }

  function monthKey(date) {
    return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "";
  }

  function dateKey(date) {
    return date ? date.getTime() : 0;
  }

  function parseComparableStart(fileName, fallbackYear) {
    const match = String(fileName || "").match(/(?:^|\D)(\d{2})(\d{2})(?:\D|$)/);
    if (!match) return null;
    const year = fallbackYear || new Date().getFullYear();
    return parseDate(`${year}-${match[1]}-${match[2]}`);
  }

  function lastDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function isFullMonth(dates) {
    if (!dates.length) return false;
    const sorted = dates.slice().sort((a, b) => dateKey(a) - dateKey(b));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return first.getDate() === 1 && last.getDate() === lastDayOfMonth(first) && sorted.length >= lastDayOfMonth(first);
  }

  function metric(label, value, level) {
    return `<article class="metric ${level || ""}"><span>${safeText(label)}</span><strong>${safeText(value)}</strong></article>`;
  }

  function statusPill(status) {
    const level = status.includes("异常") ? "bad" : status.includes("偏低") || status.includes("非整月") || status.includes("未匹配") ? "warn" : "";
    return `<span class="status-pill ${level}">${safeText(status)}</span>`;
  }

  function buildStoreMaster(rows) {
    const map = new Map();
    rows.forEach((row) => {
      const name = normalizeStoreName(row["门店"] || row.store || row.name);
      if (!name) return;
      map.set(name, {
        store: name,
        region: row["地域"] || row.region || "未分区",
        city: row["城市"] || row.city || inferCity(name),
        market: row["市场层级"] || row.market || "未分层"
      });
    });
    return map;
  }

  function inferCity(store) {
    if (store.includes("南京")) return "南京";
    if (store.includes("上海") || store.includes("宝山") || store.includes("金山")) return "上海";
    return "未标注";
  }

  function normalizeRevenueRows(rows, storeMaster) {
    return rows.map((row) => {
      const date = parseDate(row["日期"] || row.date);
      const store = normalizeStoreName(row["门店"] || row.store);
      const master = storeMaster.get(store) || { store, region: "未分区", city: inferCity(store), market: "未分层" };
      const takeHomeRaw = row["到手收入"] ?? row.takeHomeRevenue ?? "";
      return {
        store,
        date,
        month: monthKey(date),
        revenue: Number(row["折后营业收入"] ?? row["营业额"] ?? row.revenue) || 0,
        takeHomeRevenue: String(takeHomeRaw).trim() === "" ? null : Number(takeHomeRaw),
        hasTakeHomeRevenue: String(takeHomeRaw).trim() !== "" && Number.isFinite(Number(takeHomeRaw)),
        orders: Number(row["订单数"] || row.orders) || 0,
        dineInRevenue: Number(row["堂食收入"] || row.dineInRevenue) || 0,
        deliveryRevenue: Number(row["外卖收入"] || row.deliveryRevenue) || 0,
        ...master
      };
    }).filter((row) => row.store && row.date);
  }

  function normalizeBudgetRows(rows) {
    const map = new Map();
    rows.forEach((row) => {
      const store = normalizeStoreName(row["门店"] || row.store);
      const month = String(row["月份"] || row.month || "").trim();
      const raw = row["到手收入预算"] ?? row["预算"] ?? row.budget;
      if (!store || !/^\d{4}-\d{2}$/.test(month) || String(raw ?? "").trim() === "") return;
      const budget = Number(raw);
      if (Number.isFinite(budget) && budget >= 0) map.set(`${store}__${month}`, budget);
    });
    return map;
  }

  function normalizeDishRows(rows, storeMaster) {
    return rows.map((row) => {
      const date = parseDate(row["日期"] || row.date);
      const store = normalizeStoreName(row["门店"] || row.store);
      const master = storeMaster.get(store) || { store, region: "未分区", city: inferCity(store), market: "未分层" };
      const mainMenuValue = String(row["主菜单"] || row.mainMenu || row.isMainMenu || "").trim();
      return {
        store,
        date,
        month: monthKey(date),
        dish: row["菜品"] || row.dish || "未命名菜品",
        isMainMenu: /^(是|主菜单|true|1|yes)$/i.test(mainMenuValue),
        salesAmount: Number(row["销售金额"] || row.salesAmount) || 0,
        quantity: Number(row["销售份数"] || row.quantity) || 0,
        ...master
      };
    }).filter((row) => row.store && row.date);
  }

  function groupBy(rows, keyFn) {
    const map = new Map();
    rows.forEach((row) => {
      const key = keyFn(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }

  function sum(rows, key) {
    return cents(rows.reduce((total, row) => total + (Number(row[key]) || 0), 0));
  }

  function analyze(input) {
    const storeMaster = buildStoreMaster(parseTable(input.storeMasterText));
    const revenueRows = normalizeRevenueRows(parseTable(input.revenueText), storeMaster);
    const dishRows = normalizeDishRows(parseTable(input.dishText), storeMaster);
    const budgetByStoreMonth = normalizeBudgetRows(parseTable(input.budgetText));
    const firstRevenueDate = revenueRows.map((row) => row.date).sort((a, b) => dateKey(a) - dateKey(b))[0];
    const comparableStartFromFile = parseComparableStart(input.fileName, firstRevenueDate?.getFullYear());
    const revenueByStoreMonth = groupBy(revenueRows, (row) => `${row.store}__${row.month}`);
    const dishByStoreMonth = groupBy(dishRows, (row) => `${row.store}__${row.month}`);
    const allKeys = new Set([...revenueByStoreMonth.keys(), ...dishByStoreMonth.keys()]);
    const monthly = [...allKeys].map((key) => {
      const revenueGroup = revenueByStoreMonth.get(key) || [];
      const dishGroup = dishByStoreMonth.get(key) || [];
      const reference = revenueGroup[0] || dishGroup[0] || {};
      const dishStart = dishGroup.map((row) => row.date).sort((a, b) => dateKey(a) - dateKey(b))[0] || null;
      const comparableStart = [comparableStartFromFile, dishStart].filter(Boolean).sort((a, b) => dateKey(b) - dateKey(a))[0] || null;
      const comparableRevenueRows = comparableStart ? revenueGroup.filter((row) => dateKey(row.date) >= dateKey(comparableStart)) : revenueGroup;
      const comparableRevenue = sum(comparableRevenueRows, "revenue");
      const takeHomeComplete = comparableRevenueRows.length > 0 && comparableRevenueRows.every((row) => row.hasTakeHomeRevenue);
      const takeHomeRevenue = takeHomeComplete ? sum(comparableRevenueRows, "takeHomeRevenue") : null;
      const takeHomeRate = takeHomeComplete && comparableRevenue ? takeHomeRevenue / comparableRevenue * 100 : null;
      const dishSales = sum(dishGroup, "salesAmount");
      const coverageRate = comparableRevenue ? dishSales / comparableRevenue * 100 : 0;
      const mainMenuSales = sum(dishGroup.filter((row) => row.isMainMenu), "salesAmount");
      const mainMenuRate = dishSales ? mainMenuSales / dishSales * 100 : 0;
      const revenueDates = comparableRevenueRows.map((row) => row.date);
      const fullMonth = isFullMonth(revenueDates);
      const statuses = [];
      if (!revenueGroup.length || !dishGroup.length) statuses.push("门店未匹配");
      if (dishSales && revenueGroup.length && !comparableRevenue) statuses.push("可比营业额为空");
      if (coverageRate > 105) statuses.push("口径异常");
      if (dishSales && mainMenuRate < 75) statuses.push("主菜单匹配偏低");
      if (!fullMonth) statuses.push("非整月样本");
      const orders = revenueGroup.reduce((total, row) => total + row.orders, 0);
      const avgRevenue = revenueDates.length ? comparableRevenue / revenueDates.length : 0;
      const minDate = revenueDates.slice().sort((a, b) => dateKey(a) - dateKey(b))[0];
      const maxDate = revenueDates.slice().sort((a, b) => dateKey(b) - dateKey(a))[0];
      const monthlyBudget = budgetByStoreMonth.has(key) ? budgetByStoreMonth.get(key) : null;
      const timeProgress = maxDate ? maxDate.getDate() / lastDayOfMonth(maxDate) : null;
      const timeProgressBudget = monthlyBudget !== null && timeProgress !== null ? cents(monthlyBudget * timeProgress) : null;
      const fullMonthBudgetAchievementRate = monthlyBudget > 0 && takeHomeRevenue !== null ? takeHomeRevenue / monthlyBudget * 100 : null;
      const timeProgressBudgetAchievementRate = timeProgressBudget > 0 && takeHomeRevenue !== null ? takeHomeRevenue / timeProgressBudget * 100 : null;
      if (!takeHomeComplete) statuses.push("到手收入不完整");
      if (monthlyBudget === null) statuses.push("预算未接入");
      if (!statuses.length) statuses.push("口径正常");
      return {
        store: reference.store || key.split("__")[0],
        month: reference.month || key.split("__")[1],
        region: reference.region || "未分区",
        city: reference.city || "未标注",
        market: reference.market || "未分层",
        comparableStart: isoDate(minDate || comparableStart),
        comparableEnd: isoDate(maxDate),
        comparableRevenue,
        takeHomeRevenue,
        takeHomeRate,
        takeHomeComplete,
        monthlyBudget,
        timeProgress,
        timeProgressBudget,
        fullMonthBudgetAchievementRate,
        timeProgressBudgetAchievementRate,
        dishSales,
        coverageRate,
        mainMenuRate,
        orders,
        avgRevenue: cents(avgRevenue),
        fullMonth,
        statuses
      };
    }).filter((row) => filterMonthlyRow(row, input));
    const dishTop = aggregateDishTop(dishRows, input);
    const coverageTop = monthly.slice().sort((a, b) => b.coverageRate - a.coverageRate).slice(0, 8);
    const dailyRank = monthly.filter((row) => row.fullMonth).sort((a, b) => b.avgRevenue - a.avgRevenue).slice(0, 8);
    const segmentRows = aggregateSegments(monthly);
    const takeHomeComplete = monthly.length > 0 && monthly.every((row) => row.takeHomeComplete);
    const budgetComplete = monthly.length > 0 && monthly.every((row) => row.monthlyBudget !== null);
    const summary = {
      storeCount: new Set(monthly.map((row) => row.store)).size,
      comparableRevenue: sum(monthly, "comparableRevenue"),
      takeHomeRevenue: takeHomeComplete ? sum(monthly, "takeHomeRevenue") : null,
      takeHomeComplete,
      dishSales: sum(monthly, "dishSales"),
      monthlyBudget: budgetComplete ? sum(monthly, "monthlyBudget") : null,
      budgetComplete,
      abnormalCount: monthly.filter((row) => row.statuses.some((status) => !["口径正常", "非整月样本", "到手收入不完整", "预算未接入"].includes(status))).length
    };
    summary.coverageRate = summary.comparableRevenue ? summary.dishSales / summary.comparableRevenue * 100 : 0;
    summary.takeHomeRate = summary.takeHomeRevenue !== null && summary.comparableRevenue ? summary.takeHomeRevenue / summary.comparableRevenue * 100 : null;
    summary.fullMonthBudgetAchievementRate = summary.monthlyBudget > 0 && summary.takeHomeRevenue !== null ? summary.takeHomeRevenue / summary.monthlyBudget * 100 : null;
    return {
      revenueRows,
      dishRows,
      monthly,
      dishTop,
      coverageTop,
      dailyRank,
      segmentRows,
      summary,
      report: buildReport(summary, monthly, segmentRows)
    };
  }

  function filterMonthlyRow(row, input) {
    const region = String(input.regionFilter || "").trim();
    const city = String(input.cityFilter || "").trim();
    const month = String(input.monthFilter || "").trim();
    if (region && !row.region.includes(region)) return false;
    if (city && !row.city.includes(city)) return false;
    if (month && row.month !== month) return false;
    return true;
  }

  function aggregateDishTop(rows, input) {
    const map = new Map();
    rows.filter((row) => filterMonthlyRow({ ...row, statuses: [] }, input)).forEach((row) => {
      const item = map.get(row.dish) || { dish: row.dish, salesAmount: 0, stores: new Set() };
      item.salesAmount += row.salesAmount;
      item.stores.add(row.store);
      map.set(row.dish, item);
    });
    return [...map.values()]
      .map((item) => ({ dish: item.dish, salesAmount: cents(item.salesAmount), storeCount: item.stores.size }))
      .sort((a, b) => b.salesAmount - a.salesAmount)
      .slice(0, 8);
  }

  function aggregateSegments(monthly) {
    const map = new Map();
    monthly.forEach((row) => {
      [`地域：${row.region}`, `市场：${row.market}`].forEach((key) => {
        const item = map.get(key) || { label: key, comparableRevenue: 0, dishSales: 0 };
        item.comparableRevenue += row.comparableRevenue;
        item.dishSales += row.dishSales;
        map.set(key, item);
      });
    });
    return [...map.values()].map((item) => ({
      ...item,
      comparableRevenue: cents(item.comparableRevenue),
      dishSales: cents(item.dishSales),
      coverageRate: item.comparableRevenue ? item.dishSales / item.comparableRevenue * 100 : 0
    }));
  }

  function buildReport(summary, monthly, segmentRows) {
    const abnormal = monthly.filter((row) => row.statuses.some((status) => !["口径正常", "非整月样本", "到手收入不完整", "预算未接入"].includes(status)));
    const bestSegment = segmentRows.slice().sort((a, b) => b.dishSales - a.dishSales)[0];
    return [
      "门店营业额联合分析素材",
      `纳入门店：${summary.storeCount} 家`,
      `折后营业收入：${money(summary.comparableRevenue)}`,
      `到手收入：${summary.takeHomeRevenue === null ? "数据不完整，不计算" : money(summary.takeHomeRevenue)}`,
      `到手率：${summary.takeHomeRate === null ? "不可计算" : percent(summary.takeHomeRate)}（到手收入 ÷ 折后营业收入 × 100%）`,
      `当月预算：${summary.monthlyBudget === null ? "预算覆盖不完整，不计算" : money(summary.monthlyBudget)}`,
      `全月预算达成率：${summary.fullMonthBudgetAchievementRate === null ? "不可计算" : percent(summary.fullMonthBudgetAchievementRate)}`,
      `菜品销售金额：${money(summary.dishSales)}`,
      `菜品销售金额/营业额覆盖率：${percent(summary.coverageRate)}`,
      bestSegment ? `销售金额最高维度：${bestSegment.label}，菜品销售额 ${money(bestSegment.dishSales)}。` : "",
      abnormal.length ? `需核查口径：${abnormal.map((row) => `${row.store}${row.month}${row.statuses.join("/")}`).join("；")}` : "本次未发现覆盖率超过 105% 或主菜单匹配偏低的异常口径。",
      "边界：菜品销售金额/营业额仅作为销售结构覆盖率参考，不等于真实营业贡献率、毛利率或利润贡献。"
    ].filter(Boolean).join("\n");
  }

  function renderRows(id, rows, columns, emptyText) {
    const target = byId(id);
    if (!target) return;
    target.innerHTML = rows.length
      ? rows.map((row) => `<tr>${columns.map((column) => `<td>${column(row)}</td>`).join("")}</tr>`).join("")
      : `<tr><td class="empty-table" colspan="${columns.length}">${safeText(emptyText || "暂无数据")}</td></tr>`;
  }

  function render(result) {
    byId("revenueSummary").innerHTML = [
      metric("纳入门店", `${result.summary.storeCount} 家`, result.summary.storeCount ? "good" : "warn"),
      metric("折后营业收入", money(result.summary.comparableRevenue), result.summary.comparableRevenue ? "good" : "warn"),
      metric("到手收入", result.summary.takeHomeRevenue === null ? "不可计算" : money(result.summary.takeHomeRevenue), result.summary.takeHomeRevenue === null ? "warn" : "good"),
      metric("到手率", result.summary.takeHomeRate === null ? "不可计算" : percent(result.summary.takeHomeRate), result.summary.takeHomeRate === null ? "warn" : "good"),
      metric("当月预算", result.summary.monthlyBudget === null ? "覆盖不完整" : money(result.summary.monthlyBudget), result.summary.monthlyBudget === null ? "warn" : "good"),
      metric("全月预算达成", result.summary.fullMonthBudgetAchievementRate === null ? "不可计算" : percent(result.summary.fullMonthBudgetAchievementRate), result.summary.fullMonthBudgetAchievementRate === null ? "warn" : result.summary.fullMonthBudgetAchievementRate >= 100 ? "good" : "warn"),
      metric("菜品销售金额", money(result.summary.dishSales), result.summary.dishSales ? "good" : "warn"),
      metric("覆盖率", percent(result.summary.coverageRate), result.summary.coverageRate > 105 ? "bad" : result.summary.coverageRate >= 75 ? "good" : "warn")
    ].join("");
    byId("revenueBoundary").innerHTML = [
      `<p>已应用门店标准化规则：金沙百联 → 金山百联；新街口 → 南京新街口；宝山共康绿地 → 宝山共康。</p>`,
      `<p>文件名 0515、0605、0615 等 4 位数字会作为可比营业额起始日期；若营业额起始日早于菜品销售起始日，则按菜品销售起始日截取。</p>`,
      `<p>到手率 = 到手收入 ÷ 折后营业收入 × 100%；任一到手收入缺失时不计算。预算达成只使用已维护的到手收入预算，缺失预算不按 0 处理。</p>`,
      `<p>覆盖率超过 105% 标记为口径异常；主菜单匹配率低于 75% 标记为主菜单匹配偏低；非整月样本不进入完整月日均营业额排行。</p>`
    ].join("");
    renderRows("revenueMonthlyRows", result.monthly, [
      (row) => safeText(row.store),
      (row) => safeText(row.month),
      (row) => `${safeText(row.comparableStart || "-")} 至 ${safeText(row.comparableEnd || "-")}`,
      (row) => money(row.comparableRevenue),
      (row) => row.takeHomeRevenue === null ? "不可计算" : `${money(row.takeHomeRevenue)} / ${percent(row.takeHomeRate)}`,
      (row) => row.monthlyBudget === null ? "未接入" : `全月 ${percent(row.fullMonthBudgetAchievementRate)} / 时间进度 ${percent(row.timeProgressBudgetAchievementRate)}`,
      (row) => `${money(row.dishSales)} / ${percent(row.coverageRate)}`,
      (row) => `${row.orders || 0} 单 / ${money(row.avgRevenue)}`,
      (row) => row.statuses.map(statusPill).join(" ")
    ], "暂无联合分析结果");
    renderRows("revenueDishTopRows", result.dishTop, [
      (row) => safeText(row.dish),
      (row) => money(row.salesAmount),
      (row) => `${row.storeCount} 家`
    ]);
    renderRows("revenueCoverageRows", result.coverageTop, [
      (row) => safeText(row.store),
      (row) => safeText(row.month),
      (row) => percent(row.coverageRate),
      (row) => row.statuses.map(statusPill).join(" ")
    ]);
    renderRows("revenueDailyRankRows", result.dailyRank, [
      (row) => safeText(row.store),
      (row) => safeText(row.month),
      (row) => money(row.avgRevenue),
      (row) => row.fullMonth ? "是" : "否"
    ], "暂无完整月样本");
    renderRows("revenueSegmentRows", result.segmentRows, [
      (row) => safeText(row.label),
      (row) => money(row.comparableRevenue),
      (row) => money(row.dishSales),
      (row) => percent(row.coverageRate)
    ]);
    byId("revenueReportDraft").value = result.report;
  }

  function currentInput() {
    return {
      fileName: byId("revenueFileName")?.value || "",
      regionFilter: byId("revenueRegionFilter")?.value || "",
      cityFilter: byId("revenueCityFilter")?.value || "",
      monthFilter: byId("revenueMonthFilter")?.value || "",
      storeMasterText: byId("storeMasterText")?.value || "",
      revenueText: byId("storeRevenueText")?.value || "",
      budgetText: byId("storeBudgetText")?.value || "",
      dishText: byId("dishSalesText")?.value || ""
    };
  }

  function renderCurrent() {
    render(analyze(currentInput()));
  }

  function loadSample() {
    byId("storeMasterText").value = SAMPLE_MASTER;
    byId("storeRevenueText").value = SAMPLE_REVENUE;
    byId("storeBudgetText").value = SAMPLE_BUDGET;
    byId("dishSalesText").value = SAMPLE_DISH;
    byId("revenueFileName").value = "多店营业额.xlsx";
    renderCurrent();
  }

  function mount() {
    if (!byId("tool-revenue")) return;
    byId("loadRevenueSampleBtn")?.addEventListener("click", loadSample);
    byId("analyzeRevenueBtn")?.addEventListener("click", renderCurrent);
    ["revenueFileName", "revenueRegionFilter", "revenueCityFilter", "revenueMonthFilter", "storeMasterText", "storeRevenueText", "storeBudgetText", "dishSalesText"].forEach((id) => {
      byId(id)?.addEventListener("input", renderCurrent);
      byId(id)?.addEventListener("change", renderCurrent);
    });
    if (!byId("storeRevenueText").value.trim() && !byId("dishSalesText").value.trim()) loadSample();
    else renderCurrent();
  }

  return {
    analyze,
    normalizeStoreName,
    parseComparableStart,
    mount
  };
});
