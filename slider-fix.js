(function () {
  const money = (value) => `¥${Number(value || 0).toFixed(2)}`;
  const get = (id) => document.getElementById(id);
  const signed = (value, unit) => `${Number(value) > 0 ? "+" : ""}${value}${unit}`;

  function ensureValueSpan(inputId, spanId) {
    const input = get(inputId);
    if (!input) return null;
    const span = get(spanId) || document.createElement("span");
    span.id = spanId;
    span.style.display = "block";
    span.style.margin = "4px 0 8px";
    span.style.color = "#247a4b";
    span.style.fontSize = "13px";
    span.style.fontWeight = "800";
    if (!span.parentElement) input.parentElement.insertBefore(span, input);
    return span;
  }

  function updatePriceLabel() {
    const price = get("marginPrice");
    const slider = get("priceDelta");
    const label = ensureValueSpan("priceDelta", "priceDeltaValue");
    if (!price || !slider || !label) return;
    label.textContent = `${signed(slider.value, " 元")}，模拟售价 ${money(Number(price.value || 0) + Number(slider.value || 0))}`;
  }

  function updateBeefLabel() {
    const slider = get("beefInflation");
    const label = ensureValueSpan("beefInflation", "beefInflationValue");
    if (!slider || !label) return;
    label.textContent = signed(slider.value, "%");
  }

  function applySimpleBeefInflation() {
    const slider = get("beefInflation");
    const name = get("marginName");
    const mainCost = get("mainCost");
    if (!slider || !name || !mainCost) return;
    if (!mainCost.dataset.baseCost) mainCost.dataset.baseCost = mainCost.value || "0";
    if (document.body.dataset.marginMode !== "simple" || !name.value.includes("牛肉")) return;
    mainCost.value = money(Number(mainCost.dataset.baseCost || 0) * (1 + Number(slider.value || 0) / 100)).replace("¥", "");
    mainCost.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function excelCell(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function downloadExcelRows(rows, filename, sheetName) {
    const tableRows = rows.map((row) => {
      if (!row.length) return "<tr><td></td></tr>";
      return `<tr>${row.map((cell) => `<td>${excelCell(cell)}</td>`).join("")}</tr>`;
    }).join("");
    const content = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8">
          <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
          <x:Name>${excelCell(sheetName)}</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
          </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        </head>
        <body><table>${tableRows}</table></body>
      </html>
    `;
    const blob = new Blob([`\uFEFF${content}`], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function benchmarkForDish() {
    const combined = `${get("marginName")?.value || ""} ${get("dishCategory")?.value || ""}`;
    if (/(米粉|米线|面|粉面|牛肉粉|牛肉面)/.test(combined)) {
      return {
        label: "粉面/米粉/面馆",
        basis: "同品类公开毛利率/食材成本率",
        min: 60,
        max: 70,
        costMin: 30,
        costMax: 40,
        sources: [
          "CBNData/深燃：面馆原材料成本约30%-40%，毛利率约60%-70%",
          "MAIGOO：米粉店综合利润空间约65%，单碗利润约70%",
          "东吴证券九毛九研究：九毛九面馆毛利率约62%-63%"
        ]
      };
    }
    if (/(快餐|小吃|简餐|盖饭|套餐)/.test(combined)) {
      return {
        label: "快餐/小吃",
        basis: "相近快餐业态公开食材成本率",
        min: 65,
        max: 75,
        costMin: 25,
        costMax: 35,
        sources: [
          "National Restaurant Association：2024年有限服务餐饮食品成本中位数约32.4%",
          "餐厅菜单成本公开样本：食材成本常见区间约28%-35%",
          "RestaurantMargin：快餐/QSR食材成本目标约24%-30%"
        ]
      };
    }
    return {
      label: "餐饮通用",
      basis: "餐饮行业公开食材成本率",
      min: 65,
      max: 72,
      costMin: 28,
      costMax: 35,
      sources: [
        "National Restaurant Association：2024年餐饮食品成本中位数约32%",
        "餐厅菜单成本公开样本：食材成本常见区间约28%-35%"
      ]
    };
  }

  function benchmarkConclusion(result) {
    const benchmark = benchmarkForDish();
    const materialRate = Number(result?.materialRate ?? marginSnapshot().materialRate ?? 0);
    let position = "处于公开参考区间内";
    if (materialRate < benchmark.min) position = `低于参考下限 ${(benchmark.min - materialRate).toFixed(1)} 个百分点`;
    if (materialRate > benchmark.max) position = `高于参考上限 ${(materialRate - benchmark.max).toFixed(1)} 个百分点`;
    return {
      benchmark,
      text: `公开对比参考：按“${benchmark.basis}”匹配到${benchmark.label}参考区间，常见毛利率约 ${benchmark.min}-${benchmark.max}%（对应食材成本率约 ${benchmark.costMin}-${benchmark.costMax}%）。本菜品标准材料毛利率为 ${materialRate.toFixed(1)}%，${position}。来源：${benchmark.sources.join("；")}。该对比仅用于经营估算，不能替代门店真实采购、损耗和后台账单。`
    };
  }

  function appendBenchmarkAdvice() {
    const adviceBox = get("marginAdvice");
    if (!adviceBox || adviceBox.dataset.benchmarkPatched === "1") return;
    if (adviceBox.textContent.includes("公开对比参考")) return;
    const conclusion = benchmarkConclusion();
    const paragraph = document.createElement("p");
    paragraph.textContent = conclusion.text;
    adviceBox.appendChild(paragraph);
    adviceBox.dataset.benchmarkPatched = "1";
  }

  function metricValue(label) {
    const metric = [...document.querySelectorAll("#marginResult .metric")]
      .find((item) => item.innerText.includes(label));
    return metric ? metric.innerText.replace(label, "").trim() : "";
  }

  function percentFromMetric(label) {
    const value = metricValue(label);
    const match = value.match(/(-?\d+(?:\.\d+)?)%/);
    return match ? Number(match[1]) : 0;
  }

  function marginSnapshot() {
    return {
      name: get("marginName")?.value || "菜品",
      category: get("dishCategory")?.value || "",
      spec: get("dishSpec")?.value || "",
      price: get("marginPrice")?.value || "",
      materialCost: metricValue("直接原料成本"),
      materialProfitRate: metricValue("标准材料毛利"),
      channelProfitRate: metricValue("渠道到手毛利"),
      fullProfitRate: metricValue("完全成本毛利"),
      materialRate: percentFromMetric("标准材料毛利")
    };
  }

  function bomRowsFromDom() {
    const rows = [...document.querySelectorAll("#bomRows tr")].map((row) => (
      [...row.querySelectorAll("td")].map((cell) => cell.textContent.trim())
    ));
    return rows.length ? rows : [["极简模式成本", "", "", "", "切换高级成本卡后可导出逐项原料"]];
  }

  function costCardRows() {
    const snapshot = marginSnapshot();
    const conclusion = benchmarkConclusion({ materialRate: snapshot.materialRate });
    return [
      ["菜品", snapshot.name],
      ["分类", snapshot.category],
      ["规格", snapshot.spec],
      ["售价", snapshot.price],
      ["直接原料成本", snapshot.materialCost],
      ["标准材料毛利", snapshot.materialProfitRate],
      ["渠道到手毛利", snapshot.channelProfitRate],
      ["完全成本毛利", snapshot.fullProfitRate],
      [],
      ["公开对比参考", conclusion.benchmark.label],
      ["匹配口径", conclusion.benchmark.basis],
      ["参考标准材料毛利率", `${conclusion.benchmark.min}-${conclusion.benchmark.max}%`],
      ["参考食材成本率", `${conclusion.benchmark.costMin}-${conclusion.benchmark.costMax}%`],
      ["本菜品标准材料毛利率", `${snapshot.materialRate.toFixed(1)}%`],
      ["对比结论", conclusion.text],
      ["公开资料来源", conclusion.benchmark.sources.join("；")],
      [],
      ["原料", "类别", "用量", "单份成本", "备注"],
      ...bomRowsFromDom()
    ];
  }

  function patchCostCardExport() {
    const button = get("exportCostCardBtn");
    if (!button || button.dataset.excelPatched === "1") return;
    button.textContent = "导出 Excel";
    button.dataset.excelPatched = "1";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      downloadExcelRows(costCardRows(), `${get("marginName")?.value || "菜品"}-成本卡.xls`, "菜品成本卡");
    }, true);
  }

  function bind() {
    const price = get("priceDelta");
    const beef = get("beefInflation");
    const base = get("mainCost");
    if (base) base.addEventListener("change", () => { base.dataset.baseCost = base.value || "0"; });
    if (price) price.addEventListener("input", updatePriceLabel);
    if (beef) beef.addEventListener("input", () => {
      updateBeefLabel();
      applySimpleBeefInflation();
    });
    updatePriceLabel();
    updateBeefLabel();
    patchCostCardExport();
    appendBenchmarkAdvice();
    document.addEventListener("input", () => {
      const adviceBox = get("marginAdvice");
      if (adviceBox) adviceBox.dataset.benchmarkPatched = "0";
      setTimeout(appendBenchmarkAdvice, 0);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
