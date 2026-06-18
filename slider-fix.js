(function () {
  const get = (id) => document.getElementById(id);
  const money = (value) => `¥${Number(value || 0).toFixed(2)}`;
  const num = (id) => Number(get(id)?.value) || 0;

  function fieldLabel(id) {
    return get(id)?.closest("label");
  }

  function setLabel(id, labelText) {
    const label = fieldLabel(id);
    if (!label || !label.childNodes.length) return;
    label.childNodes[0].textContent = labelText;
  }

  function hideField(id) {
    const label = fieldLabel(id);
    if (label) label.style.display = "none";
  }

  function patchRemovedFields() {
    ["dishCategory", "cookMode", "batchServings", "marginFloor", "priceDelta", "seasoningRatio", "beefInflation"].forEach(hideField);
    const spec = get("dishSpec");
    if (spec) {
      spec.innerHTML = "<option>小</option><option selected>中</option><option>大</option>";
      setLabel("dishSpec", "规格");
    }
    const mode = get("seasoningMode");
    if (mode) [...mode.options].forEach((option) => {
      if (option.value === "ratio" || option.textContent.includes("比例")) option.remove();
    });
    setLabel("marginPrice", "售价（元）");
    setLabel("mainCost", "主料成本（元）");
    setLabel("sideCost", "辅料成本（元）");
    setLabel("packCost", "包材成本（元）");
    setLabel("simpleSeasoningCost", "调料固定成本（元）");
    setLabel("seasoningFixed", "调料固定金额（元）");
    const heading = [...document.querySelectorAll(".section-title h3")].find((item) => item.textContent.includes("菜品主数据"));
    const sub = heading?.parentElement?.querySelector("span");
    if (sub) sub.textContent = "单菜毛利、渠道费用和套餐毛利分开看";
    const bomHeading = [...document.querySelectorAll(".section-title h3")].find((item) => item.textContent.includes("菜品用料清单"));
    const bomSub = bomHeading?.parentElement?.querySelector("span");
    if (bomSub) bomSub.textContent = "支持半成品、单份用量和固定调料成本";
  }

  function injectListStyles() {
    if (document.getElementById("margin-list-patch-style")) return;
    const style = document.createElement("style");
    style.id = "margin-list-patch-style";
    style.textContent = `
      .table-actions { display: flex; justify-content: flex-end; }
      .unified-hidden { display: none !important; }
      .merged-deal-section { display: none; }
      body[data-profit-scene="groupbuy"] .merged-deal-section { display: block; }
      body[data-profit-scene="groupbuy"] #tool-margin > .mode-strip,
      body[data-profit-scene="groupbuy"] #tool-margin > .margin-section:not(.unified-stage):not(.merged-deal-section):not(.saved-list-section),
      body[data-profit-scene="groupbuy"] #marginResult,
      body[data-profit-scene="groupbuy"] #addDishResultBtn,
      body[data-profit-scene="groupbuy"] #marginAdvice { display: none; }
      body[data-profit-scene="dineIn"] #tool-margin .channel-only,
      body[data-profit-scene="takeout"] #tool-margin .channel-only { display: none; }
      body[data-profit-item-type="single"] #tool-margin .combo-only,
      body[data-profit-item-type="single"] #tool-margin .gift-only,
      body[data-profit-item-type="combo"] #tool-margin .single-only,
      body[data-profit-item-type="combo"] #tool-margin .gift-only,
      body[data-profit-item-type="gift"] #tool-margin .single-only,
      body[data-profit-item-type="gift"] #tool-margin .combo-only { display: none; }
      .mini-button {
        min-height: 30px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: #fff;
        color: var(--ink);
        padding: 0 10px;
        font-weight: 800;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureUnifiedStage() {
    if (get("profitScene")) return;
    const modeStrip = document.querySelector("#tool-margin .mode-strip");
    if (!modeStrip) return;
    const section = document.createElement("section");
    section.className = "margin-section unified-stage";
    section.innerHTML = `
      <div class="section-title">
        <h3>第一阶段：选择测算场景</h3>
        <span>先选经营场景和菜品类型，下面只显示匹配字段</span>
      </div>
      <div class="form-grid">
        <label>场景
          <select id="profitScene">
            <option value="dineIn">堂食</option>
            <option value="takeout">外带</option>
            <option value="delivery">外卖</option>
            <option value="groupbuy">团购</option>
          </select>
        </label>
        <label>菜品类型
          <select id="profitItemType">
            <option value="single">单品</option>
            <option value="combo">套餐</option>
            <option value="gift">礼品</option>
          </select>
        </label>
      </div>
    `;
    modeStrip.insertAdjacentElement("beforebegin", section);
    get("profitScene")?.addEventListener("change", applyUnifiedContext);
    get("profitItemType")?.addEventListener("change", applyUnifiedContext);
  }

  function tagUnifiedSections() {
    [...document.querySelectorAll("#tool-margin > .margin-section")].forEach((section) => {
      const title = section.querySelector(".section-title h3")?.textContent || "";
      if (/第一阶段/.test(title)) section.classList.add("unified-stage");
      if (/菜品主数据|原料库|菜品用料清单|出成率测试/.test(title)) section.classList.add("single-only");
      if (/渠道费用模板/.test(title)) section.classList.add("single-only", "channel-only");
      if (/套餐毛利测算/.test(title)) section.classList.add("combo-only");
      if (/礼品毛利测算/.test(title)) section.classList.add("gift-only");
      if (/已添加测算清单/.test(title)) section.classList.add("saved-list-section");
    });
    ["marginResult", "addDishResultBtn", "marginAdvice"].forEach((id) => get(id)?.classList.add("single-only"));
  }

  function mergeDealCalculator() {
    const dealTab = document.querySelector('[data-tool="deal"]');
    if (dealTab) dealTab.classList.add("unified-hidden");
    const dealPanel = get("tool-deal");
    const marginPanel = get("tool-margin");
    if (!dealPanel || !marginPanel || dealPanel.dataset.merged === "1") return;
    dealPanel.dataset.merged = "1";
    dealPanel.classList.remove("tool-panel");
    dealPanel.classList.add("margin-section", "merged-deal-section");
    marginPanel.insertBefore(dealPanel, get("marginResult"));
  }

  function applyUnifiedContext() {
    const scene = get("profitScene")?.value || "dineIn";
    const itemType = get("profitItemType")?.value || "single";
    document.body.dataset.profitScene = scene;
    document.body.dataset.profitItemType = itemType;
    const channelMap = { dineIn: "dineIn", takeout: "dineIn", delivery: "meituan", groupbuy: "dineIn" };
    const salesChannel = get("salesChannel");
    if (salesChannel && salesChannel.value !== channelMap[scene]) {
      salesChannel.value = channelMap[scene];
      salesChannel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setLabel("marginName", itemType === "gift" ? "礼品名称" : "菜品名称");
    setLabel("marginPrice", "售价（元）");
  }

  function metric(label, value, type = "") {
    return `<article class="metric ${type}"><span>${label}</span><strong>${value}</strong></article>`;
  }

  function calculateComboMargin() {
    const itemProfitTotal = num("comboItemProfit1") + num("comboItemProfit2") + num("comboItemProfit3") + num("comboItemProfit4");
    const extraCost = num("comboExtraPackCost") + num("comboGiftCost");
    const comboProfit = Math.round((itemProfitTotal - extraCost) * 100) / 100;
    const comboPrice = num("comboPrice");
    const comboRate = comboPrice ? comboProfit / comboPrice * 100 : 0;
    return { itemProfitTotal, extraCost, comboProfit, comboPrice, comboRate };
  }

  function renderComboMargin() {
    if (!get("comboMarginResult")) return;
    const result = calculateComboMargin();
    const rateLevel = result.comboRate >= 35 ? "good" : result.comboRate >= 20 ? "warn" : "bad";
    get("comboMarginResult").innerHTML = [
      metric("单品毛利合计", money(result.itemProfitTotal), "good"),
      metric("额外成本合计", money(result.extraCost), result.extraCost > 5 ? "warn" : "good"),
      metric("套餐毛利", `${money(result.comboProfit)} / ${result.comboRate.toFixed(1)}%`, rateLevel),
      metric("套餐售价", money(result.comboPrice), result.comboProfit >= 0 ? "good" : "bad")
    ].join("");
    get("comboMarginAdvice").innerHTML = `<p>${result.comboProfit < 0
      ? "当前套餐扣除额外包装和附加品后为亏损，优先减少赠品成本、提高套餐售价或调整单品组合。"
      : "当前套餐毛利为正。注意这里按“单品毛利相加 - 套餐额外成本”估算，若套餐价低于单品原价合计，需要把折扣影响先反映到各单品毛利里。"
    }</p>`;
  }

  function ensureComboSection() {
    if (get("comboMarginResult")) {
      renderComboMargin();
      return;
    }
    const bomSection = [...document.querySelectorAll(".margin-section")]
      .find((section) => section.innerText.includes("菜品用料清单"));
    if (!bomSection) return;
    const section = document.createElement("section");
    section.className = "margin-section";
    section.innerHTML = `
      <div class="section-title">
        <h3>套餐毛利测算</h3>
        <span>单品毛利相加，再扣套餐额外包装和附加品成本</span>
      </div>
      <div class="form-grid compact-grid">
        <label>套餐名称<input id="comboName"></label>
        <label>套餐售价（元）<input id="comboPrice" type="number" min="0" step="0.01"></label>
        <label>单品1毛利（元）<input id="comboItemProfit1" type="number" step="0.01"></label>
        <label>单品2毛利（元）<input id="comboItemProfit2" type="number" step="0.01"></label>
        <label>单品3毛利（元）<input id="comboItemProfit3" type="number" step="0.01"></label>
        <label>单品4毛利（元）<input id="comboItemProfit4" type="number" step="0.01"></label>
        <label>套餐额外包装成本（元）<input id="comboExtraPackCost" type="number" min="0" step="0.01"></label>
        <label>礼品等附加成本（元）<input id="comboGiftCost" type="number" min="0" step="0.01"></label>
      </div>
      <div class="result-grid compact-result" id="comboMarginResult"></div>
      <div class="advice-box" id="comboMarginAdvice"></div>
    `;
    bomSection.insertAdjacentElement("afterend", section);
    section.querySelectorAll("input").forEach((input) => input.addEventListener("input", renderComboMargin));
    renderComboMargin();
  }

  function calculateGiftMargin() {
    const price = num("giftPrice");
    const cost = num("giftBaseCost") + num("giftPackCost") + num("giftOtherCost");
    const profit = Math.round((price - cost) * 100) / 100;
    const rate = price ? profit / price * 100 : 0;
    return { price, cost, profit, rate };
  }

  function renderGiftMargin() {
    if (!get("giftMarginResult")) return;
    const result = calculateGiftMargin();
    const level = result.profit >= 5 ? "good" : result.profit >= 0 ? "warn" : "bad";
    get("giftMarginResult").innerHTML = [
      metric("礼品总成本", money(result.cost), result.cost > result.price ? "bad" : "good"),
      metric("礼品毛利", `${money(result.profit)} / ${result.rate.toFixed(1)}%`, level),
      metric("礼品售价", money(result.price), "good"),
      metric("建议", result.profit >= 0 ? "可销售" : "需调价", level)
    ].join("");
    get("giftMarginAdvice").innerHTML = `<p>${result.profit < 0 ? "当前礼品为亏损，建议提高售价、降低采购成本，或只作为营销赠品。" : "当前礼品毛利为正，可继续结合套餐或加价购场景测试。"}</p>`;
  }

  function ensureGiftSection() {
    if (get("giftMarginResult")) {
      renderGiftMargin();
      return;
    }
    const comboSection = [...document.querySelectorAll("#tool-margin > .margin-section")]
      .find((section) => section.innerText.includes("套餐毛利测算"));
    if (!comboSection) return;
    const section = document.createElement("section");
    section.className = "margin-section gift-only";
    section.innerHTML = `
      <div class="section-title">
        <h3>礼品毛利测算</h3>
        <span>适合玩具、周边、赠品加价购等简单测算</span>
      </div>
      <div class="form-grid compact-grid">
        <label>礼品名称<input id="giftName"></label>
        <label>售价（元）<input id="giftPrice" type="number" min="0" step="0.01"></label>
        <label>采购/制作成本（元）<input id="giftBaseCost" type="number" min="0" step="0.01"></label>
        <label>包装成本（元）<input id="giftPackCost" type="number" min="0" step="0.01"></label>
        <label>其他成本（元）<input id="giftOtherCost" type="number" min="0" step="0.01"></label>
      </div>
      <div class="result-grid compact-result" id="giftMarginResult"></div>
      <button class="primary-button" type="button" id="addGiftResultBtn">添加当前礼品</button>
      <div class="advice-box" id="giftMarginAdvice"></div>
    `;
    comboSection.insertAdjacentElement("afterend", section);
    section.querySelectorAll("input").forEach((input) => input.addEventListener("input", renderGiftMargin));
    get("addGiftResultBtn")?.addEventListener("click", addGiftResult);
    renderGiftMargin();
  }

  const savedItems = [];
  let savedId = 1;

  function ensureButtonAfter(targetId, buttonId, text) {
    if (get(buttonId)) return;
    const target = get(targetId);
    if (!target) return;
    const button = document.createElement("button");
    button.className = "primary-button";
    button.type = "button";
    button.id = buttonId;
    button.textContent = text;
    target.insertAdjacentElement("afterend", button);
  }

  function ensureSavedListSection() {
    if (get("marginListRows")) return;
    ensureButtonAfter("marginResult", "addDishResultBtn", "添加当前菜品");
    ensureButtonAfter("comboMarginResult", "addComboResultBtn", "添加当前套餐");
    const marginAdvice = get("marginAdvice");
    if (!marginAdvice) return;
    const section = document.createElement("section");
    section.className = "margin-section";
    section.innerHTML = `
      <div class="section-title">
        <h3>已添加测算清单</h3>
        <span>按添加顺序记录本次测算的菜品和套餐</span>
      </div>
      <div class="table-actions">
        <button class="ghost-button" type="button" id="clearMarginListBtn">清空表格</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>序号</th><th>类型</th><th>名称</th><th>规格</th><th>售价</th><th>毛利</th><th>毛利率</th><th>备注</th><th>操作</th></tr>
          </thead>
          <tbody id="marginListRows"></tbody>
        </table>
      </div>
    `;
    marginAdvice.insertAdjacentElement("afterend", section);
    get("addDishResultBtn")?.addEventListener("click", addDishResult);
    get("addComboResultBtn")?.addEventListener("click", addComboResult);
    get("clearMarginListBtn")?.addEventListener("click", clearSavedList);
    get("marginListRows")?.addEventListener("click", deleteSavedItem);
    renderSavedList();
  }

  function addGiftResult() {
    const gift = calculateGiftMargin();
    savedItems.push({
      id: savedId++,
      type: "礼品",
      name: get("giftName")?.value || "未命名礼品",
      spec: "-",
      price: gift.price,
      profit: gift.profit,
      rate: gift.rate,
      note: `礼品总成本 ${money(gift.cost)}`
    });
    renderSavedList();
  }

  function metricText(label) {
    const item = [...document.querySelectorAll("#marginResult .metric")].find((node) => node.innerText.includes(label));
    return item ? item.innerText.replace(label, "").trim() : "";
  }

  function parseMoney(text) {
    const match = String(text || "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function addDishResult() {
    savedItems.push({
      id: savedId++,
      type: "菜品",
      name: get("marginName")?.value || "未命名菜品",
      spec: get("dishSpec")?.value || "-",
      price: num("marginPrice"),
      profit: parseMoney(metricText("标准材料毛利")),
      rate: percent("标准材料毛利"),
      note: `原料成本 ${metricText("直接原料成本")}，渠道到手 ${metricText("渠道到手毛利")}`
    });
    renderSavedList();
  }

  function addComboResult() {
    const combo = calculateComboMargin();
    savedItems.push({
      id: savedId++,
      type: "套餐",
      name: get("comboName")?.value || "未命名套餐",
      spec: "-",
      price: combo.comboPrice,
      profit: combo.comboProfit,
      rate: combo.comboRate,
      note: `单品毛利合计 ${money(combo.itemProfitTotal)}，额外成本 ${money(combo.extraCost)}`
    });
    renderSavedList();
  }

  function deleteSavedItem(event) {
    const button = event.target.closest("[data-delete-saved-item]");
    if (!button) return;
    const index = savedItems.findIndex((item) => item.id === Number(button.dataset.deleteSavedItem));
    if (index >= 0) savedItems.splice(index, 1);
    renderSavedList();
  }

  function clearSavedList() {
    savedItems.splice(0, savedItems.length);
    renderSavedList();
  }

  function safeText(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderSavedList() {
    const rows = get("marginListRows");
    if (!rows) return;
    rows.innerHTML = savedItems.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${safeText(item.type)}</td>
        <td>${safeText(item.name)}</td>
        <td>${safeText(item.spec)}</td>
        <td>${money(item.price)}</td>
        <td>${money(item.profit)}</td>
        <td>${Number(item.rate || 0).toFixed(1)}%</td>
        <td>${safeText(item.note)}</td>
        <td><button class="mini-button" type="button" data-delete-saved-item="${item.id}">删除</button></td>
      </tr>
    `).join("") || `<tr><td colspan="9">还没有添加菜品或套餐。算好后点击上方按钮，就会按顺序记录在这里。</td></tr>`;
  }

  function percent(label) {
    const match = metricText(label).match(/(-?\d+(?:\.\d+)?)%/);
    return match ? Number(match[1]) : 0;
  }

  function benchmarkForDish() {
    const combined = get("marginName")?.value || "";
    if (/(米粉|米线|面|粉面)/.test(combined)) {
      return { label: "粉面/米粉/面馆", basis: "同品类公开毛利率/食材成本率", min: 60, max: 70, costMin: 30, costMax: 40 };
    }
    if (/(快餐|小吃|简餐|盖饭|套餐)/.test(combined)) {
      return { label: "快餐/小吃", basis: "相近快餐业态公开食材成本率", min: 65, max: 75, costMin: 25, costMax: 35 };
    }
    return { label: "餐饮通用", basis: "餐饮行业公开食材成本率", min: 65, max: 72, costMin: 28, costMax: 35 };
  }

  function benchmarkText() {
    const benchmark = benchmarkForDish();
    const materialRate = percent("标准材料毛利");
    let position = "处于公开参考区间内";
    if (materialRate < benchmark.min) position = `低于参考下限 ${(benchmark.min - materialRate).toFixed(1)} 个百分点`;
    if (materialRate > benchmark.max) position = `高于参考上限 ${(materialRate - benchmark.max).toFixed(1)} 个百分点`;
    return `公开对比参考：按“${benchmark.basis}”匹配到${benchmark.label}参考区间，常见毛利率约 ${benchmark.min}-${benchmark.max}%（对应食材成本率约 ${benchmark.costMin}-${benchmark.costMax}%）。本菜品标准材料毛利率为 ${materialRate.toFixed(1)}%，${position}。该对比仅用于经营估算，不能替代门店真实采购、损耗和后台账单。`;
  }

  function appendBenchmarkAdvice() {
    const advice = get("marginAdvice");
    if (!advice || advice.innerText.includes("公开对比参考")) return;
    const p = document.createElement("p");
    p.textContent = benchmarkText();
    advice.appendChild(p);
  }

  function excelCell(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function downloadExcel(rows, filename) {
    const table = rows.map((row) => `<tr>${row.map((cell) => `<td>${excelCell(cell)}</td>`).join("")}</tr>`).join("");
    const html = `<html><head><meta charset="UTF-8"></head><body><table>${table}</table></body></html>`;
    const blob = new Blob([`\uFEFF${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function patchExport() {
    const button = get("exportCostCardBtn");
    if (!button || button.dataset.comboExportPatched === "1") return;
    button.textContent = "导出 Excel";
    button.dataset.comboExportPatched = "1";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const combo = calculateComboMargin();
      const benchmark = benchmarkForDish();
      const rows = [
        ["菜品", get("marginName")?.value || ""],
        ["规格", get("dishSpec")?.value || ""],
        ["售价", get("marginPrice")?.value || ""],
        ["直接原料成本", metricText("直接原料成本")],
        ["标准材料毛利", metricText("标准材料毛利")],
        ["渠道到手毛利", metricText("渠道到手毛利")],
        ["完全成本毛利", metricText("完全成本毛利")],
        [],
        ["套餐毛利测算", get("comboName")?.value || ""],
        ["单品毛利合计", combo.itemProfitTotal.toFixed(2)],
        ["套餐额外成本合计", combo.extraCost.toFixed(2)],
        ["套餐毛利", combo.comboProfit.toFixed(2)],
        ["套餐毛利率", `${combo.comboRate.toFixed(1)}%`],
        [],
        ["公开对比参考", benchmark.label],
        ["匹配口径", benchmark.basis],
        ["参考标准材料毛利率", `${benchmark.min}-${benchmark.max}%`],
        ["参考食材成本率", `${benchmark.costMin}-${benchmark.costMax}%`],
        ["本菜品标准材料毛利率", `${percent("标准材料毛利").toFixed(1)}%`],
        ["对比结论", benchmarkText()]
      ];
      downloadExcel(rows, `${get("marginName")?.value || "菜品"}-成本卡.xls`);
    }, true);
  }

  let xhsPatchImage = null;
  let xhsPatchFilename = "";

  function ensureXhsImageTool() {
    const visual = get("xhsVisual");
    if (!visual || get("generateXhsImageBtn")) return;
    const section = document.createElement("div");
    section.className = "xhs-cover-tool";
    section.innerHTML = `
      <div class="section-title">
        <h3>图片生成工具</h3>
        <span id="xhsImageStatus">未上传产品图时，会自动生成简易海报图。</span>
      </div>
      <div class="form-grid compact-grid">
        <label>产品实拍图<input id="xhsProductImage" type="file" accept="image/*"></label>
        <label>封面版式<select id="xhsImageLayout"><option>产品大图</option><option>文字海报</option><option>门店场景</option></select></label>
        <label>画面色调<select id="xhsImageTone"><option>暖食欲</option><option>清爽干净</option><option>夜宵氛围</option><option>高质感</option></select></label>
        <label>滤镜<select id="xhsImageFilter"><option>自然提亮</option><option>暖黄胶片</option><option>高对比鲜明</option><option>柔和奶油</option></select></label>
        <button class="primary-button inline-button" type="button" id="generateXhsImageBtn">生成图片</button>
      </div>
      <div class="xhs-cover-layout">
        <canvas id="xhsCoverCanvas" width="1080" height="1440" aria-label="小红书封面图预览"></canvas>
        <div class="xhs-image-actions">
          <button class="ghost-button" type="button" id="downloadXhsCoverBtn">下载 PNG</button>
          <div class="advice-box xhs-cover-notes">
            <p>竖版 3:4 图片，适合小红书封面。上传产品图后会把实拍图、标题、卖点和标签合成一张图。</p>
            <p>没有产品图时，工具会生成一张简易产品海报，适合先做选题测试或发给店员照着拍。</p>
          </div>
        </div>
      </div>
    `;
    visual.insertAdjacentElement("afterend", section);
    get("generateXhsImageBtn")?.addEventListener("click", generateXhsImage);
    get("downloadXhsCoverBtn")?.addEventListener("click", downloadXhsCover);
    get("xhsProductImage")?.addEventListener("change", handleXhsImageUpload);
    ["xhsImageLayout", "xhsImageTone", "xhsImageFilter"].forEach((id) => get(id)?.addEventListener("change", generateXhsImage));
    patchXhsAdvice();
    generateXhsImage();
  }

  function injectXhsStyles() {
    if (document.getElementById("xhs-image-patch-style")) return;
    const style = document.createElement("style");
    style.id = "xhs-image-patch-style";
    style.textContent = `
      .xhs-cover-tool { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 10px; }
      .xhs-cover-layout { display: grid; grid-template-columns: minmax(260px, 360px) minmax(220px, 1fr); gap: 16px; align-items: start; margin-top: 16px; }
      #xhsCoverCanvas { width: 100%; max-width: 360px; aspect-ratio: 3 / 4; border: 1px solid var(--line); border-radius: 8px; background: #fff7ee; box-shadow: 0 12px 28px rgba(30, 42, 34, 0.11); }
      .xhs-image-actions { display: grid; gap: 12px; align-content: start; }
      .xhs-cover-notes { margin-top: 0; }
      #xhsImageStatus { color: var(--muted); font-size: 12px; font-weight: 800; }
      #xhsProductImage { min-height: 41px; padding: 8px 10px; }
      @media (max-width: 720px) { .xhs-cover-layout { grid-template-columns: 1fr; } #xhsCoverCanvas { max-width: 100%; } }
    `;
    document.head.appendChild(style);
  }

  function patchXhsAdvice() {
    const visual = get("xhsVisual");
    if (!visual) return;
    const category = get("xhsCategory")?.value.trim() || "招牌菜";
    const city = get("xhsCity")?.value.trim() || "本地";
    const point = splitList(get("xhsSellingPoints")?.value || "")[0] || "热乎现做";
    const keywords = splitList(get("xhsKeywords")?.value || "");
    const hotspotText = get("xhsHotspots")?.innerText || "";
    const hotspotName = (hotspotText.match(/^(地域美食|搜索攻略|生活记录|听劝互动|健康轻负担|周边赠品)/m) || [])[1] || "生活记录";
    const hotspotBriefs = {
      "地域美食": "先拍门头和周边街景，再拍招牌菜，把商圈、路线和附近场景交代清楚。",
      "搜索攻略": "补菜单价格、份量对比和桌面全景，让读者能快速判断值不值得去。",
      "生活记录": "多拍下班、聚餐、一人食或夜宵场景，用真实用餐片段弱化广告感。",
      "听劝互动": "拍新品细节、试吃反馈和可投票选项，结尾留下一个明确问题。",
      "健康轻负担": "拍食材、配料、汤底或菜单标识，强调真实清爽，避免功效化表达。",
      "周边赠品": "拍包装、周边、桌面拼图和门店视觉元素，让画面有可晒可收藏的理由。"
    };
    const keywordLine = keywords.length ? keywords.join("、") : `${city}${category}`;
    visual.innerHTML = [
      `<p><strong>封面文案：</strong>${city}${category}，${point}才舒服。</p>`,
      `<p><strong>热点方向：</strong>${hotspotName}。围绕「${keywordLine}」拍，不照搬他人标题正文。</p>`,
      `<p><strong>拍摄建议：</strong>${hotspotBriefs[hotspotName]} 门头、产品近景、出餐过程、顾客用餐场景和菜单价格至少覆盖 3 类。</p>`,
      `<p><strong>画面重点：</strong>把「${point}」拍成一眼能懂的证据，例如锅底、份量、菜单价格、食材细节或真实用餐状态。</p>`,
      `<p><strong>热点融合边界：</strong>可以借用公开热点方向和搜索关键词，不复制他人标题正文，不编造体验。</p>`
    ].join("");
  }

  function getXhsData() {
    const keywords = splitList(get("xhsKeywords")?.value || "");
    return {
      category: get("xhsCategory")?.value.trim() || "招牌菜",
      city: get("xhsCity")?.value.trim() || "本地",
      points: splitList(get("xhsSellingPoints")?.value || ""),
      audience: splitList(get("xhsAudience")?.value || ""),
      style: get("xhsStyle")?.value || "种草",
      address: get("xhsAddress")?.value.trim() || "门店附近",
      keywords
    };
  }

  function handleXhsImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      xhsPatchImage = null;
      xhsPatchFilename = "";
      generateXhsImage();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        xhsPatchImage = image;
        xhsPatchFilename = file.name;
        generateXhsImage();
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function generateXhsImage() {
    const canvas = get("xhsCoverCanvas");
    if (!canvas) return;
    patchXhsAdvice();
    drawXhsCover(canvas, getXhsData());
    const status = get("xhsImageStatus");
    if (status) status.textContent = xhsPatchImage ? `已使用产品图：${xhsPatchFilename}` : "已生成无图简易海报。";
  }

  function drawXhsCover(canvas, data) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const mainPoint = data.points[0] || "热乎现做";
    const secondPoint = data.points[1] || "出品稳定";
    const people = data.audience[0] || "上班族";
    const layout = get("xhsImageLayout")?.value || "产品大图";
    const tone = get("xhsImageTone")?.value || "暖食欲";
    const filter = get("xhsImageFilter")?.value || "自然提亮";
    const palette = xhsPalette(tone);

    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, palette.bg1);
    bg.addColorStop(0.52, palette.bg2);
    bg.addColorStop(1, palette.bg3);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    if (xhsPatchImage && layout !== "文字海报") drawProductPhoto(ctx, xhsPatchImage, layout, filter, palette);
    else drawSimpleFoodPoster(ctx, data.category, tone, palette);

    const cardY = layout === "文字海报" ? 120 : 760;
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    roundRect(ctx, 70, cardY, width - 140, height - cardY - 86, 52, true);
    ctx.fillStyle = palette.accent;
    roundRect(ctx, 112, cardY + 52, 184, 62, 31, true);
    drawCanvasText(ctx, data.style, 204, cardY + 94, 28, "#fff", 800, "center");
    drawCanvasText(ctx, `${data.city}美食`, 116, cardY + 178, 34, palette.green, 800);
    wrapCanvasText(ctx, data.category, 112, cardY + 300, 70, 86, width - 224, "#17211c", 900);
    wrapCanvasText(ctx, `${mainPoint} / ${secondPoint}`, 116, cardY + 516, 38, 54, width - 232, "#3d4b43", 800);
    drawCanvasText(ctx, `适合${people}收藏`, 116, cardY + 638, 34, palette.accent, 800);
    drawCanvasText(ctx, `地址：${data.address}`, 116, cardY + 700, 28, "#66736b", 700);
    [`#${data.city}美食`, `#${data.category}`, data.keywords?.[0] ? `#${data.keywords[0].replace(/\s+/g, "")}` : "#今天吃什么"].forEach((tag, index) => {
      const y = height - 210 + index * 56;
      ctx.fillStyle = index % 2 ? palette.soft2 : palette.soft1;
      roundRect(ctx, 118, y - 42, Math.min(700, 34 + tag.length * 32), 54, 27, true);
      drawCanvasText(ctx, tag, 146, y - 4, 26, index % 2 ? palette.dark2 : palette.green, 800);
    });
    drawCanvasText(ctx, "胡哥餐饮工具箱", width - 118, height - 98, 26, "#66736b", 700, "right");
  }

  function xhsPalette(tone) {
    const palettes = {
      "清爽干净": { bg1: "#f7fbff", bg2: "#e5f4ee", bg3: "#fff7df", accent: "#286f9e", green: "#247a4b", soft1: "#dff0fa", soft2: "#e3f3e9", dark2: "#286f9e" },
      "夜宵氛围": { bg1: "#272018", bg2: "#70452b", bg3: "#d59655", accent: "#c84d3f", green: "#ffe0a8", soft1: "#fff0ce", soft2: "#ffe5df", dark2: "#8a560f" },
      "高质感": { bg1: "#f8f5ef", bg2: "#e6ddd0", bg3: "#cfded7", accent: "#17211c", green: "#247a4b", soft1: "#e3f3e9", soft2: "#fff0ce", dark2: "#65430d" },
      "暖食欲": { bg1: "#fff8ea", bg2: "#ffe0d2", bg3: "#dff0e5", accent: "#c84d3f", green: "#247a4b", soft1: "#e3f3e9", soft2: "#fff0ce", dark2: "#8a560f" }
    };
    return palettes[tone] || palettes["暖食欲"];
  }

  function drawProductPhoto(ctx, image, layout, filter, palette) {
    const frame = layout === "门店场景" ? { x: 86, y: 102, width: 908, height: 650, radius: 44 } : { x: 70, y: 78, width: 940, height: 682, radius: 54 };
    ctx.save();
    roundedClip(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius);
    ctx.filter = canvasFilter(filter);
    drawImageCover(ctx, image, frame.x, frame.y, frame.width, frame.height);
    ctx.filter = "none";
    const shade = ctx.createLinearGradient(0, frame.y, 0, frame.y + frame.height);
    shade.addColorStop(0, "rgba(0,0,0,0.04)");
    shade.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = shade;
    ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.82)";
    ctx.lineWidth = 10;
    roundRect(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius, false, true);
    if (layout === "门店场景") {
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      roundRect(ctx, 118, 614, 334, 76, 38, true);
      drawCanvasText(ctx, "门店真实场景", 285, 664, 30, palette.accent, 800, "center");
    }
  }

  function drawSimpleFoodPoster(ctx, category, tone, palette) {
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.beginPath();
    ctx.arc(830, 286, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.beginPath();
    ctx.arc(196, 640, 160, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tone === "夜宵氛围" ? "#382417" : "#ffffff";
    roundRect(ctx, 160, 204, 760, 472, 70, true);
    ctx.fillStyle = tone === "夜宵氛围" ? "#f5b55e" : "#fff0ce";
    ctx.beginPath();
    ctx.ellipse(540, 452, 286, 154, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.strokeStyle = tone === "夜宵氛围" ? "#ffe0a8" : "#c84d3f";
    ctx.lineWidth = 20;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(330 + i * 80, 418);
      ctx.quadraticCurveTo(370 + i * 78, 366, 414 + i * 72, 420);
      ctx.stroke();
    }
    ctx.fillStyle = "#247a4b";
    ["现做", "热乎", "招牌"].forEach((label, index) => {
      roundRect(ctx, 276 + index * 174, 570, 116, 50, 25, true);
      drawCanvasText(ctx, label, 334 + index * 174, 604, 24, "#fff", 800, "center");
    });
    drawCanvasText(ctx, category.slice(0, 8), 540, 178, 38, palette.accent, 900, "center");
  }

  function canvasFilter(filter) {
    const filters = {
      "暖黄胶片": "brightness(1.08) saturate(1.15) sepia(0.18)",
      "高对比鲜明": "brightness(1.04) contrast(1.18) saturate(1.22)",
      "柔和奶油": "brightness(1.1) contrast(0.92) saturate(0.95)",
      "自然提亮": "brightness(1.08) contrast(1.04) saturate(1.08)"
    };
    return filters[filter] || filters["自然提亮"];
  }

  function drawImageCover(ctx, image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  function drawCanvasText(ctx, value, x, y, size, color, weight = 700, align = "left") {
    ctx.font = `${weight} ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(value, x, y);
  }

  function wrapCanvasText(ctx, value, x, y, size, lineHeight, maxWidth, color, weight = 700) {
    ctx.font = `${weight} ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    const lines = [];
    let line = "";
    String(value).split("").forEach((char) => {
      const next = line + char;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  }

  function roundedClip(ctx, x, y, width, height, radius) {
    roundedPath(ctx, x, y, width, height, radius);
    ctx.clip();
  }

  function roundedPath(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  function roundRect(ctx, x, y, width, height, radius, fill = false, stroke = false) {
    roundedPath(ctx, x, y, width, height, radius);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function downloadXhsCover() {
    const canvas = get("xhsCoverCanvas");
    if (!canvas) return;
    const city = get("xhsCity")?.value.trim() || "本地";
    const category = get("xhsCategory")?.value.trim() || "小红书封面";
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${city}-${category}-封面图.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function bind() {
    injectListStyles();
    ensureUnifiedStage();
    patchRemovedFields();
    ensureComboSection();
    ensureGiftSection();
    mergeDealCalculator();
    tagUnifiedSections();
    ensureSavedListSection();
    applyUnifiedContext();
    appendBenchmarkAdvice();
    patchExport();
    injectXhsStyles();
    ensureXhsImageTool();
    document.addEventListener("input", () => {
      setTimeout(() => {
        renderComboMargin();
        renderGiftMargin();
        appendBenchmarkAdvice();
        ensureXhsImageTool();
        if (document.activeElement?.id?.startsWith("xhs")) generateXhsImage();
      }, 0);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
