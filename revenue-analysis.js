(function (root, factory) {
  const core = typeof module === "object" && module.exports ? require("./miniprogram/utils/revenue-core.js") : root.HugeRevenueCore;
  const api = factory(core);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HugeToolsRevenueAnalysis = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => api.mount());
    else api.mount();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (core) {
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

  const money = core.money;
  const percent = core.percent;
  const analyze = core.analyze;
  const normalizeStoreName = core.normalizeStoreName;
  const parseComparableStart = core.parseComparableStart;

  function safeText(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function metric(label, value, level) {
    return `<article class="metric ${level || ""}"><span>${safeText(label)}</span><strong>${safeText(value)}</strong></article>`;
  }

  function statusPill(status) {
    const level = /异常|重复/.test(status) ? "bad" : status !== "口径正常" ? "warn" : "";
    return `<span class="status-pill ${level}">${safeText(status)}</span>`;
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
      metric("可比折后营业收入", money(result.summary.comparableRevenue), result.summary.comparableRevenue ? "good" : "warn"),
      metric("到手收入", result.summary.takeHomeRevenue === null ? "不可计算" : money(result.summary.takeHomeRevenue), result.summary.takeHomeRevenue === null ? "warn" : "good"),
      metric("到手率", result.summary.takeHomeRate === null ? "不可计算" : percent(result.summary.takeHomeRate), result.summary.takeHomeRate === null ? "warn" : "good"),
      metric("纳入店月预算", result.summary.monthlyBudget === null ? "覆盖不完整" : money(result.summary.monthlyBudget), result.summary.monthlyBudget === null ? "warn" : "good"),
      metric("全月预算达成", result.summary.fullMonthBudgetAchievementRate === null ? "不可计算" : percent(result.summary.fullMonthBudgetAchievementRate), result.summary.fullMonthBudgetAchievementRate === null ? "warn" : result.summary.fullMonthBudgetAchievementRate >= 100 ? "good" : "warn"),
      metric("菜品销售金额", money(result.summary.dishSales), result.summary.dishSales ? "good" : "warn"),
      metric("覆盖率", percent(result.summary.coverageRate), result.summary.coverageRate > 105 ? "bad" : result.summary.coverageRate >= 75 ? "good" : "warn")
    ].join("");
    byId("revenueBoundary").innerHTML = [
      `<p>已应用门店标准化规则：金沙百联 → 金山百联；新街口 → 南京新街口；宝山共康绿地 → 宝山共康。</p>`,
      `<p>文件名中 0515、0605、0615 等日期标记会作为可比起始日，年份取导入记录；没有日期标记时保留全部导入日期。菜品记录缺日不会自动缩小营业额分母。</p>`,
      `<p>到手率 = 到手收入 ÷ 同范围折后营业收入 × 100%；缺失或非法数字不补零，重复店日不自动累加。预算达成使用月初起连续完整的到手收入，不受菜品起始日截取影响。</p>`,
      `<p>覆盖率逐店月核对营业额与菜品的日期集合；任一门店范围未匹配时，不通过缩小分母生成覆盖率。明确录入的 0 值保留。</p>`,
      `<p>导入待核查：${result.issues.length} 项。${result.issues.length ? "具体原表行号与原因见下方分析素材。" : "请继续核实本次导入的门店与日期范围。"}</p>`,
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
      (row) => `${row.orders === null ? "订单数未完整录入" : `${row.orders} 单`} / ${money(row.avgRevenue)}`,
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
    const input = currentInput();
    const result = analyze(input);
    if (input.fileName.includes("合成演示数据")) result.report = "【合成演示数据，不是真实经营事实】\n" + result.report;
    render(result);
  }

  function loadSample() {
    byId("storeMasterText").value = SAMPLE_MASTER;
    byId("storeRevenueText").value = SAMPLE_REVENUE;
    byId("storeBudgetText").value = SAMPLE_BUDGET;
    byId("dishSalesText").value = SAMPLE_DISH;
    byId("revenueFileName").value = "合成演示数据_非真实经营数据.xlsx";
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
    renderCurrent();
  }

  return {
    analyze,
    normalizeStoreName,
    parseComparableStart,
    mount
  };
});
