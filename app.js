const $ = (id) => document.getElementById(id);
const money = (value) => `¥${Number(value || 0).toFixed(2)}`;
const cents = (value) => Math.round((Number(value) || 0) * 100) / 100;
const num = (id) => Number($(id).value) || 0;
const text = (id) => $(id).value.trim();
const splitList = (value) => value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);

const lossRecords = [];
let currentSchedule = [];
let marginMode = "simple";
let ingredientId = 1;
const ingredients = [];
const bomItems = [];
const unitMap = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  jin: { base: "g", factor: 500 },
  mL: { base: "mL", factor: 1 },
  L: { base: "mL", factor: 1000 },
  piece: { base: "piece", factor: 1 },
  tbsp: { base: "mL", factor: 15 }
};

document.querySelectorAll(".tool-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tool-tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tool-panel").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    $(`tool-${tab.dataset.tool}`).classList.add("active");
  });
});

document.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", recalculate);
  field.addEventListener("change", recalculate);
});

document.querySelectorAll("[data-reset]").forEach((button) => {
  button.addEventListener("click", () => {
    const panel = $(`tool-${button.dataset.reset}`);
    panel.querySelectorAll("input, textarea").forEach((field) => {
      if (field.type !== "date") field.value = "";
    });
    recalculate();
  });
});

$("addLossBtn").addEventListener("click", addLossRecord);
$("copyPostBtn").addEventListener("click", copyXhsPost);
$("exportScheduleBtn").addEventListener("click", exportSchedule);
$("exportDealBtn").addEventListener("click", exportDealReport);
$("addIngredientBtn").addEventListener("click", addIngredient);
$("addBomBtn").addEventListener("click", addBomItem);
$("applyYieldBtn").addEventListener("click", applyYieldTest);
$("exportCostCardBtn").addEventListener("click", exportCostCard);
$("salesChannel").addEventListener("change", applyChannelTemplate);
$("dealPlatform").addEventListener("change", applyDealPlatformTemplate);
document.querySelectorAll("[data-margin-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    marginMode = button.dataset.marginMode;
    document.querySelectorAll("[data-margin-mode]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.body.dataset.marginMode = marginMode;
    renderMargin();
  });
});
$("lossDate").valueAsDate = new Date();

seedMarginData();
seedLossRecords();
document.body.dataset.marginMode = marginMode;
applyChannelTemplate();
recalculate();

function recalculate() {
  renderMargin();
  renderDeal();
  renderLoss();
  renderXiaohongshu();
  renderSchedule();
}

function renderMargin() {
  const result = calculateMargin();
  const floor = num("marginFloor");
  const materialLevel = result.materialRate >= floor ? "good" : result.materialRate >= floor - 10 ? "warn" : "bad";
  const channelLevel = result.channelRate >= floor ? "good" : result.channelRate >= floor - 10 ? "warn" : "bad";
  const fullLevel = result.fullRate >= floor ? "good" : result.fullRate >= floor - 10 ? "warn" : "bad";

  renderIngredientLibrary();
  renderBomOptions();
  renderBomTable(result);
  renderYieldTool();

  $("marginResult").innerHTML = [
    metric("直接原料成本", money(result.materialCost), materialLevel),
    metric("标准材料毛利", `${money(result.materialProfit)} / ${result.materialRate.toFixed(1)}%`, materialLevel),
    metric("渠道到手毛利", `${money(result.channelProfit)} / ${result.channelRate.toFixed(1)}%`, channelLevel),
    metric("完全成本毛利", `${money(result.fullProfit)} / ${result.fullRate.toFixed(1)}%`, fullLevel)
  ].join("");
  renderPlatformRuleNote(result);

  const advice = [];
  if (marginMode === "simple") advice.push("当前为极简模式，适合快速估算；切到高级成本卡后可按出成率、损耗率和渠道费用精算。");
  if (result.channelProfit < 0) advice.push("渠道到手利润为负，先检查活动折扣、平台佣金、包装套件和推广补贴。");
  if (result.materialRate < floor) advice.push(`标准材料毛利率低于 ${floor}%，建议复核原料采购价、净料率或售价。`);
  if (result.priceDelta) advice.push(`售价模拟已调整 ${result.priceDelta > 0 ? "+" : ""}${result.priceDelta} 元，模拟售价为 ${money(result.price)}。`);
  if (result.beefInflation) advice.push(`牛肉价格模拟变动 ${result.beefInflation}%，所有含“牛肉”的原料已参与重算。`);
  if (!advice.length) advice.push(`${text("marginName") || "这道菜"}的成本结构暂时健康，可以保存为本期成本卡并持续记录价格变动。`);
  $("marginAdvice").innerHTML = advice.map((item) => `<p>${item}</p>`).join("");
}

function applyChannelTemplate() {
  const templates = {
    dineIn: { platformRate: 0, minCommission: 0, fulfillmentFee: 0, packKitCost: 0.2, discountRate: 0, promotionRate: 0, activityCost: 0, otherChannelCost: 0, overheadCost: 3 },
    meituan: { platformRate: 8, minCommission: 0, fulfillmentFee: 4.5, packKitCost: 1.5, discountRate: 8, promotionRate: 3, activityCost: 2, otherChannelCost: 0.8, overheadCost: 3 },
    taobao: { platformRate: 7.4, minCommission: 0, fulfillmentFee: 4, packKitCost: 1.5, discountRate: 8, promotionRate: 5, activityCost: 2, otherChannelCost: 1, overheadCost: 3 },
    jd: { platformRate: 5, minCommission: 0, fulfillmentFee: 3.5, packKitCost: 1.5, discountRate: 8, promotionRate: 3, activityCost: 2, otherChannelCost: 0.8, overheadCost: 3 }
  };
  const template = templates[$("salesChannel").value];
  Object.entries(template).forEach(([id, value]) => {
    $(id).value = value;
  });
  renderMargin();
}

function seedMarginData() {
  if (ingredients.length) return;
  ingredients.push(
    makeIngredient({ name: "鲜牛肉", type: "主料", supplier: "本地肉联厂", qty: 1, unit: "kg", price: 42, yieldRate: 85, cookYieldRate: 100, wasteRate: 3, density: 1 }),
    makeIngredient({ name: "米粉", type: "主料", supplier: "粉厂", qty: 10, unit: "kg", price: 58, yieldRate: 100, cookYieldRate: 100, wasteRate: 2, density: 1 }),
    makeIngredient({ name: "青菜", type: "辅料", supplier: "菜市", qty: 1, unit: "jin", price: 4.5, yieldRate: 92, cookYieldRate: 100, wasteRate: 5, density: 1 }),
    makeIngredient({ name: "草本汤底", type: "半成品", supplier: "自制", qty: 20, unit: "L", price: 120, yieldRate: 100, cookYieldRate: 90, wasteRate: 3, density: 1 }),
    makeIngredient({ name: "外卖餐盒", type: "包装", supplier: "包材商", qty: 500, unit: "piece", price: 400, yieldRate: 100, cookYieldRate: 100, wasteRate: 1, density: 1 })
  );
  bomItems.push(
    { ingredientId: ingredients[0].id, qty: 90, unit: "g", note: "现烫主料" },
    { ingredientId: ingredients[1].id, qty: 180, unit: "g", note: "基准份" },
    { ingredientId: ingredients[2].id, qty: 35, unit: "g", note: "出锅前放" },
    { ingredientId: ingredients[3].id, qty: 350, unit: "mL", note: "半成品汤底" }
  );
}

function addIngredient() {
  ingredients.unshift(makeIngredient({
    name: text("ingredientName") || "未命名原料",
    type: $("ingredientType").value,
    supplier: text("supplierName") || "未填写",
    qty: num("purchaseQty"),
    unit: $("purchaseUnit").value,
    price: num("purchasePrice"),
    yieldRate: num("yieldRate") || 100,
    cookYieldRate: num("cookYieldRate") || 100,
    wasteRate: num("wasteRate"),
    density: num("density") || 1
  }));
  renderMargin();
}

function makeIngredient(data) {
  return {
    id: ingredientId++,
    aliases: [],
    updatedAt: new Date().toLocaleString("zh-CN"),
    ...data
  };
}

function addBomItem() {
  const ingredient = ingredients.find((item) => item.id === Number($("bomIngredient").value));
  if (!ingredient) return;
  bomItems.push({
    ingredientId: ingredient.id,
    qty: num("bomQty"),
    unit: $("bomUnit").value,
    note: text("bomNote")
  });
  renderMargin();
}

function calculateMargin() {
  const priceDelta = Number($("priceDelta").value) || 0;
  const beefInflation = Number($("beefInflation").value) || 0;
  const basePrice = num("marginPrice");
  const price = Math.max(basePrice + priceDelta, 0);
  const servingDivisor = $("cookMode").value === "batch" ? Math.max(num("batchServings"), 1) : 1;
  const simplePackagingCost = $("salesChannel").value === "dineIn" ? num("packCost") : 0;
  const directCost = marginMode === "advanced"
    ? bomItems.reduce((sum, item) => sum + bomCost(item, { servingDivisor, beefInflation }), 0)
    : num("mainCost") + num("sideCost") + simplePackagingCost;
  const seasoningCost = seasoningAmount(directCost);
  const materialCost = cents(directCost + seasoningCost);
  const materialProfit = cents(price - materialCost);
  const materialRate = price ? materialProfit / price * 100 : 0;
  const discountAmount = cents(price * num("discountRate") / 100);
  const discountedRevenue = cents(price - discountAmount);
  const commission = cents(Math.max(cents(discountedRevenue * num("platformRate") / 100), num("minCommission")));
  const fulfillmentFee = cents(num("fulfillmentFee"));
  const packKitCost = cents(num("packKitCost"));
  const promotionFee = cents(discountedRevenue * num("promotionRate") / 100);
  const activityCost = cents(num("activityCost"));
  const otherChannelCost = cents(num("otherChannelCost"));
  const overheadCost = cents(num("overheadCost"));
  const channelCost = cents(commission + fulfillmentFee + packKitCost + promotionFee + activityCost + otherChannelCost);
  const channelProfit = cents(discountedRevenue - channelCost - materialCost);
  const channelRate = price ? channelProfit / price * 100 : 0;
  const fullProfit = cents(channelProfit - overheadCost);
  const fullRate = price ? fullProfit / price * 100 : 0;
  return {
    price,
    priceDelta,
    beefInflation,
    materialCost,
    materialProfit,
    materialRate,
    discountAmount,
    discountedRevenue,
    commission,
    fulfillmentFee,
    packKitCost,
    promotionFee,
    activityCost,
    otherChannelCost,
    overheadCost,
    channelCost,
    channelProfit,
    channelRate,
    fullProfit,
    fullRate
  };
}

function renderPlatformRuleNote(result) {
  const notes = {
    dineIn: "堂食模板不计平台佣金，只保留少量堂食耗材和房租人工水电分摊。",
    meituan: "美团外卖模板按“技术服务费/佣金 + 履约配送费 + 推广费 + 商家活动补贴 + 包装”拆分。公开资料显示，美团外卖费率会按品类、城市、配送方式和商家合同变化，后台账单应优先于默认值。",
    taobao: "淘宝闪购模板按公开报道中商家合同常见的佣金/推广/配送拆分做默认值。淘宝闪购仍在快速扩张期，不同类目和合作方式差异较大，建议以商家后台实际扣费覆盖默认值。",
    jd: "京东外卖模板按公开报道的低佣金口径设置默认佣金，并把配送履约费单独列出。若商家处在免佣、补贴或特殊签约期，请把技术服务费改成实际值。"
  };
  const rows = [
    `折扣后商品收入：${money(result.discountedRevenue)}`,
    `技术服务费/佣金：${money(result.commission)}`,
    `履约配送费：${money(result.fulfillmentFee)}`,
    `推广费：${money(result.promotionFee)}`,
    `包装+活动+其他：${money(result.packKitCost + result.activityCost + result.otherChannelCost)}`,
    `渠道费用合计：${money(result.channelCost)}`
  ];
  $("platformRuleNote").innerHTML = `<p>${notes[$("salesChannel").value]}</p><p>${rows.join("；")}。</p>`;
}

function bomCost(item, options) {
  const ingredient = ingredients.find((entry) => entry.id === item.ingredientId);
  if (!ingredient) return 0;
  const qty = convertToBase(item.qty, item.unit, ingredient.density);
  const unitCost = effectiveUnitCost(ingredient, options.beefInflation);
  return qty * unitCost / options.servingDivisor;
}

function seasoningAmount(directCost) {
  const mode = $("seasoningMode").value;
  if (mode === "ratio") return directCost * num("seasoningRatio") / 100;
  if (mode === "precise") return marginMode === "advanced" ? 0 : num("simpleSeasoningCost");
  return marginMode === "simple" ? num("simpleSeasoningCost") : num("seasoningFixed");
}

function effectiveUnitCost(ingredient, beefInflation = 0) {
  const baseQty = convertToBase(ingredient.qty, ingredient.unit, ingredient.density);
  const price = ingredient.name.includes("牛肉") ? ingredient.price * (1 + beefInflation / 100) : ingredient.price;
  const usableQty = baseQty * ingredient.yieldRate / 100 * ingredient.cookYieldRate / 100 * (1 - ingredient.wasteRate / 100);
  return usableQty ? price / usableQty : 0;
}

function convertToBase(qty, unit, density = 1) {
  const meta = unitMap[unit] || unitMap.g;
  const raw = qty * meta.factor;
  return meta.base === "mL" ? raw * density : raw;
}

function renderIngredientLibrary() {
  $("ingredientRows").innerHTML = ingredients.map((item) => `
    <tr>
      <td>${item.name}<br><small>${item.supplier}</small></td>
      <td>${item.type}</td>
      <td>${item.qty}${unitLabel(item.unit)} / ${money(item.price)}</td>
      <td>${item.yieldRate}% / ${item.wasteRate}%</td>
      <td>${effectiveCostLabel(item)}</td>
      <td>${item.updatedAt}</td>
    </tr>
  `).join("");
}

function effectiveCostLabel(ingredient) {
  const unit = unitMap[ingredient.unit] || unitMap.g;
  const unitCost = effectiveUnitCost(ingredient);
  if (unit.base === "piece") return `${money(unitCost)} / 个`;
  if (unit.base === "mL") return `${money(unitCost * 1000 * (ingredient.density || 1))} / L`;
  return `${money(unitCost * 1000)} / kg`;
}

function renderBomOptions() {
  const options = ingredients.map((item) => `<option value="${item.id}">${item.name} · ${item.type}</option>`).join("");
  $("bomIngredient").innerHTML = options;
  $("yieldIngredient").innerHTML = options;
}

function renderBomTable(result) {
  const servingDivisor = $("cookMode").value === "batch" ? Math.max(num("batchServings"), 1) : 1;
  $("bomRows").innerHTML = bomItems.map((item) => {
    const ingredient = ingredients.find((entry) => entry.id === item.ingredientId);
    const cost = bomCost(item, { servingDivisor, beefInflation: result.beefInflation });
    return `
      <tr>
        <td>${ingredient?.name || "未知"}</td>
        <td>${ingredient?.type || "-"}</td>
        <td>${item.qty}${unitLabel(item.unit)}</td>
        <td>${money(cost)}</td>
        <td>${item.note || "-"}</td>
      </tr>
    `;
  }).join("");
}

function renderYieldTool() {
  const gross = num("grossWeight");
  const net = num("netWeight");
  const rate = gross ? net / gross * 100 : 0;
  $("yieldToolResult").innerHTML = `<p>本次测试出成率：${rate.toFixed(1)}%。例：${gross || 0}g 毛料出 ${net || 0}g 净料，净料成本会比采购单价高约 ${(100 / Math.max(rate, 1)).toFixed(2)} 倍。</p>`;
}

function applyYieldTest() {
  const ingredient = ingredients.find((item) => item.id === Number($("yieldIngredient").value));
  const gross = num("grossWeight");
  const net = num("netWeight");
  if (!ingredient || !gross || !net) return;
  ingredient.yieldRate = Number((net / gross * 100).toFixed(1));
  ingredient.updatedAt = new Date().toLocaleString("zh-CN");
  renderMargin();
}

function exportCostCard() {
  const result = calculateMargin();
  const rows = [
    ["菜品", text("marginName")],
    ["分类", text("dishCategory")],
    ["规格", $("dishSpec").value],
    ["售价", result.price],
    ["直接原料成本", result.materialCost.toFixed(2)],
    ["标准材料毛利率", `${result.materialRate.toFixed(1)}%`],
    ["渠道到手毛利率", `${result.channelRate.toFixed(1)}%`],
    ["完全成本毛利率", `${result.fullRate.toFixed(1)}%`],
    [],
    ["原料", "类别", "用量", "单份成本", "备注"],
    ...bomItems.map((item) => {
      const ingredient = ingredients.find((entry) => entry.id === item.ingredientId);
      return [ingredient?.name || "", ingredient?.type || "", `${item.qty}${unitLabel(item.unit)}`, bomCost(item, { servingDivisor: 1, beefInflation: result.beefInflation }).toFixed(2), item.note || ""];
    })
  ];
  downloadText(rows.map((row) => row.map(csvCell).join(",")).join("\n"), `${text("marginName") || "菜品"}-成本卡.csv`, "text/csv;charset=utf-8");
}

function unitLabel(unit) {
  return { jin: "斤", piece: "个", tbsp: "汤匙" }[unit] || unit;
}

function renderDeal() {
  const result = calculateDeal();
  const level = result.realUnitProfit >= 6 ? "good" : result.realUnitProfit >= 0 ? "warn" : "bad";
  const unitLevel = result.unitProfit >= 0 ? "good" : "bad";
  const floorLevel = result.realUnitRate >= num("dealMarginFloor") ? "good" : result.realUnitRate >= num("dealMarginFloor") - 10 ? "warn" : "bad";

  $("dealResult").innerHTML = [
    metric("团购单份利润", `${money(result.unitProfit)} / ${result.unitRate.toFixed(1)}%`, unitLevel),
    metric("含加购单份利润", `${money(result.realUnitProfit)} / ${result.realUnitRate.toFixed(1)}%`, floorLevel),
    metric("核销后总利润", money(result.totalProfit), level),
    metric("保本所需加购率", result.neededAddOnRate ? `${result.neededAddOnRate}%` : "无需加购", result.neededAddOnRate > num("addOnRate") ? "bad" : "good")
  ].join("");

  const advice = [];
  renderDealStructure(result);
  if (result.unitProfit < 0) advice.push(`当前套餐不含加购每份亏 ${money(Math.abs(result.unitProfit))}，要么提高团购价，要么砍掉一个低感知高成本单品。`);
  if (result.neededAddOnRate > num("addOnRate")) advice.push(`现有加购转化不足以覆盖亏损，至少需要 ${result.neededAddOnRate}% 的核销顾客发生加购。`);
  if (result.breakageProfit > 0) advice.push(`预计过期未核销可贡献 ${money(result.breakageProfit)}，但不要把它当稳定利润，设计套餐仍要按高核销率保本。`);
  if (result.totalProfit > 0) advice.push("按当前核销量测算，总利润为正，可以把团购当引流品，但要盯住核销高峰的人手和出餐速度。");
  if (result.highestCostShare?.share > 45) advice.push(`${result.highestCostShare.name}占套餐直接成本 ${result.highestCostShare.share.toFixed(1)}%，如果利润偏低，优先调整这一项。`);
  $("dealAdvice").innerHTML = advice.map((item) => `<p>${item}</p>`).join("") || "<p>套餐结构基本可控，可以继续压测不同佣金和核销量。</p>";
}

function calculateDeal() {
  const price = num("dealPrice");
  const soldCount = num("soldCount");
  const refundCount = Math.round(soldCount * num("refundRate") / 100);
  const paidCount = Math.max(soldCount - refundCount, 0);
  const expectedBreakageCount = Math.round(paidCount * num("breakageRate") / 100);
  const checkedCount = Math.min(num("dealCount"), Math.max(paidCount - expectedBreakageCount, 0));
  const directCost = num("dealFoodCost") + num("dealPackCost") + num("dealLaborCost") + num("dealOtherCost");
  const platformFee = cents(price * num("dealPlatformRate") / 100);
  const creatorFee = cents(price * num("dealCreatorRate") / 100);
  const paymentFee = cents(price * num("dealPaymentRate") / 100);
  const subsidy = cents(num("dealSubsidy"));
  const unitFees = cents(platformFee + creatorFee + paymentFee + subsidy);
  const unitProfit = cents(price - directCost - unitFees);
  const unitRate = price ? unitProfit / price * 100 : 0;
  const addOnProfit = cents(num("addOnValue") * num("addOnRate") / 100 * num("addOnMarginRate") / 100);
  const repeatProfit = cents(num("repeatValue") * num("repeatRate") / 100 * num("repeatMarginRate") / 100);
  const realUnitProfit = cents(unitProfit + addOnProfit + repeatProfit);
  const realUnitRate = price ? realUnitProfit / price * 100 : 0;
  const totalProfit = cents(realUnitProfit * checkedCount);
  const breakageProfit = cents(Math.max(paidCount - checkedCount, 0) * (price - unitFees));
  const addOnUnitMargin = num("addOnValue") * num("addOnMarginRate") / 100;
  const neededAddOnRate = unitProfit < 0 && addOnUnitMargin ? Math.ceil(Math.abs(unitProfit) / addOnUnitMargin * 100) : 0;
  const structure = [
    { name: "主食", cost: num("stapleCost") },
    { name: "小吃", cost: num("snackCost") },
    { name: "饮品", cost: num("drinkCost") },
    { name: "赠品", cost: num("giftCost") }
  ];
  const structureTotal = structure.reduce((sum, item) => sum + item.cost, 0);
  const structureShares = structure.map((item) => ({ ...item, share: structureTotal ? item.cost / structureTotal * 100 : 0 }));
  return {
    price,
    soldCount,
    refundCount,
    paidCount,
    checkedCount,
    directCost,
    platformFee,
    creatorFee,
    paymentFee,
    unitFees,
    unitProfit,
    unitRate,
    addOnProfit,
    repeatProfit,
    realUnitProfit,
    realUnitRate,
    totalProfit,
    breakageProfit,
    neededAddOnRate,
    structureShares,
    highestCostShare: structureShares.slice().sort((a, b) => b.share - a.share)[0]
  };
}

function applyDealPlatformTemplate() {
  const templates = {
    douyin: { dealPlatformRate: 6, dealCreatorRate: 8, dealPaymentRate: 0.6, dealSubsidy: 1 },
    meituan: { dealPlatformRate: 6, dealCreatorRate: 6, dealPaymentRate: 0.6, dealSubsidy: 1 },
    dianping: { dealPlatformRate: 8, dealCreatorRate: 0, dealPaymentRate: 0.6, dealSubsidy: 1 }
  };
  Object.entries(templates[$("dealPlatform").value]).forEach(([id, value]) => {
    $(id).value = value;
  });
  renderDeal();
}

function renderDealStructure(result) {
  $("dealStructure").innerHTML = result.structureShares.map((item) => `
    <div class="structure-row">
      <span>${item.name}</span>
      <div class="structure-track"><div class="structure-fill" style="width: ${item.share}%"></div></div>
      <strong>${money(item.cost)} · ${item.share.toFixed(1)}%</strong>
    </div>
  `).join("");
}

function exportDealReport() {
  const result = calculateDeal();
  const rows = [
    ["套餐名称", text("dealName")],
    ["平台", $("dealPlatform").selectedOptions[0]?.textContent || ""],
    ["原价", num("dealOriginal")],
    ["团购价", result.price],
    ["直接成本", result.directCost.toFixed(2)],
    ["平台技术服务费", result.platformFee.toFixed(2)],
    ["达人佣金", result.creatorFee.toFixed(2)],
    ["支付/结算费", result.paymentFee.toFixed(2)],
    ["团购单份利润", result.unitProfit.toFixed(2)],
    ["含加购单份利润", result.realUnitProfit.toFixed(2)],
    ["预计核销份数", result.checkedCount],
    ["核销后总利润", result.totalProfit.toFixed(2)],
    ["保本所需加购率", `${result.neededAddOnRate}%`]
  ];
  downloadText(rows.map((row) => row.map(csvCell).join(",")).join("\n"), `${text("dealName") || "团购套餐"}-利润测算.csv`, "text/csv;charset=utf-8");
}

function addLossRecord() {
  const qty = num("lossQty");
  const unitCost = num("lossUnitCost");
  if (!text("lossItem") || !qty || !unitCost) return;
  lossRecords.unshift({
    date: $("lossDate").value || new Date().toISOString().slice(0, 10),
    item: text("lossItem"),
    qty,
    unit: text("lossUnit") || "份",
    unitCost,
    reason: $("lossReason").value,
    owner: $("lossOwner").value,
    amount: qty * unitCost
  });
  renderLoss();
}

function seedLossRecords() {
  lossRecords.push(
    { date: "2026-05-24", item: "牛肉", qty: 2, unit: "斤", unitCost: 38, reason: "备货过量", owner: "预估问题", amount: 76 },
    { date: "2026-05-23", item: "青菜", qty: 4, unit: "斤", unitCost: 5, reason: "过期", owner: "保存问题", amount: 20 },
    { date: "2026-05-22", item: "汤底", qty: 1, unit: "锅", unitCost: 68, reason: "出品失败", owner: "训练问题", amount: 68 }
  );
}

function renderLoss() {
  const total = lossRecords.reduce((sum, item) => sum + item.amount, 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayTotal = lossRecords.filter((item) => item.date === today).reduce((sum, item) => sum + item.amount, 0);
  const topItem = topBy(lossRecords, "item");
  const topReason = topBy(lossRecords, "reason");

  $("lossSummary").innerHTML = [
    metric("今日损耗", money(todayTotal), todayTotal > 100 ? "bad" : "warn"),
    metric("累计损耗", money(total), total > 300 ? "bad" : "warn"),
    metric("TOP 品项", topItem || "暂无", "good"),
    metric("TOP 原因", topReason || "暂无", "warn")
  ].join("");

  $("lossRows").innerHTML = lossRecords.map((item) => `
    <tr>
      <td>${item.date}</td>
      <td>${item.item}</td>
      <td>${item.qty}${item.unit}</td>
      <td>${money(item.amount)}</td>
      <td>${item.reason}</td>
      <td>${item.owner}</td>
    </tr>
  `).join("");

  $("lossAdvice").innerHTML = `<p>当前损耗主要集中在「${topItem || "暂无"}」和「${topReason || "暂无"}」。如果连续 3 天同一原因最高，建议调整备货公式、保存标准或员工训练动作。</p>`;
}

function renderXiaohongshu() {
  const category = text("xhsCategory") || "招牌菜";
  const city = text("xhsCity") || "本地";
  const points = splitList(text("xhsSellingPoints"));
  const audience = splitList(text("xhsAudience"));
  const style = $("xhsStyle").value;
  const address = text("xhsAddress") || "门店附近";
  const titles = [
    `${city}${category}，这碗真的适合下班来吃`,
    `别只会点外卖了，${category}现做才香`,
    `${audience[0] || "上班族"}可以收藏的${category}小店`,
    `${style}｜${points[0] || "现做现吃"}的${category}`,
    `${city}吃饭灵感：一碗热乎的${category}`
  ];
  const body = [
    `今天想写一家适合${audience.join("、") || "日常吃饭"}的${category}。`,
    `我最喜欢的是${points.join("、") || "出品稳定、价格清楚、吃起来舒服"}，不是那种只适合拍照的店，是真的能解决一顿饭。`,
    `如果你在${address}附近，午餐、晚餐或者夜宵都可以考虑。第一次来建议先点招牌款，再按口味加小吃或饮品。`,
    `小提醒：高峰期最好错开一点，出餐体验会更稳。`
  ].join("\n\n");

  $("xhsTitles").innerHTML = titles.map((item) => `<span class="chip">${item}</span>`).join("");
  $("xhsBody").value = body;
  $("xhsTags").innerHTML = [`#${city}美食`, `#${category}`, "#小餐饮探店", "#今天吃什么", "#本地生活", "#打工人午餐", "#夜宵推荐", "#宝藏小店", "#餐饮老板", "#开店日常"].map((item) => `<span class="chip">${item}</span>`).join("");
  $("xhsVisual").innerHTML = `<p>封面文案：${city}${category}，热乎现做才舒服。</p><p>拍摄建议：门头一张、产品近景一张、出餐过程一张、顾客用餐场景一张，最后补一张菜单或价格信息。</p>`;
}

async function copyXhsPost() {
  const content = `${[...$("xhsTitles").querySelectorAll(".chip")].map((item) => item.textContent).join("\n")}\n\n${$("xhsBody").value}\n\n${[...$("xhsTags").querySelectorAll(".chip")].map((item) => item.textContent).join(" ")}`;
  await navigator.clipboard.writeText(content);
  $("copyPostBtn").textContent = "已复制";
  setTimeout(() => $("copyPostBtn").textContent = "复制文案", 1200);
}

function renderSchedule() {
  const employees = splitList(text("employeeList"));
  const roles = splitList(text("roleList"));
  const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const restDays = Math.min(num("restDays"), 3);
  currentSchedule = days.map((day, dayIndex) => {
    const rest = employees.filter((_, index) => restDays && (index + dayIndex) % Math.ceil(7 / restDays) === 0).slice(0, restDays);
    const active = employees.filter((name) => !rest.includes(name));
    const early = active.slice(0, Math.max(2, Math.ceil(active.length / 2)));
    const late = active.slice(-Math.max(2, Math.ceil(active.length / 2)));
    const peak = active.length >= 4 ? active : [...active, $("hasPartTime").value === "有" ? "兼职补位" : "需补人"].filter(Boolean);
    return {
      day,
      early: formatShift(early, roles, 0),
      noon: formatShift(peak, roles, 1),
      evening: formatShift(peak.slice().reverse(), roles, 2),
      close: formatShift(late, roles, 3),
      rest: rest.join("、") || "无"
    };
  });

  const totalHours = employees.length * (7 - restDays) * num("dailyHours");
  $("scheduleSummary").innerHTML = [
    metric("员工人数", `${employees.length} 人`, "good"),
    metric("营业时间", `${text("openTime")} - ${text("closeTime")}`, "good"),
    metric("周计划工时", `${totalHours || 0} 小时`, "warn"),
    metric("高峰时段", text("peakTimes") || "未设置", employees.length >= 4 ? "good" : "bad")
  ].join("");

  $("scheduleRows").innerHTML = currentSchedule.map((item) => `
    <tr>
      <td>${item.day}</td>
      <td>${item.early}</td>
      <td>${item.noon}</td>
      <td>${item.evening}</td>
      <td>${item.close}</td>
      <td>${item.rest}</td>
    </tr>
  `).join("");

  const warning = employees.length < 4 ? "员工少于 4 人，高峰期建议预留兼职或老板顶岗。" : "高峰期已尽量安排全员覆盖，后续可以接入营业额预测来压缩闲时人力。";
  $("scheduleAdvice").innerHTML = `<p>${warning}</p><p>当前排班是快速可用版，适合先贴到店长群，再按请假、兼职和实际客流手动微调。</p>`;
}

function formatShift(names, roles, offset) {
  return names.map((name, index) => `${name}(${roles[(index + offset) % Math.max(roles.length, 1)] || "机动"})`).join("、") || "未安排";
}

function exportSchedule() {
  const header = "星期,早班,中峰,晚峰,收尾,休息";
  const rows = currentSchedule.map((item) => [item.day, item.early, item.noon, item.evening, item.close, item.rest].map(csvCell).join(","));
  downloadText([header, ...rows].join("\n"), "单店排班表.csv", "text/csv;charset=utf-8");
}

function metric(label, value, type = "") {
  return `<article class="metric ${type}"><span>${label}</span><strong>${value}</strong></article>`;
}

function topBy(records, key) {
  const map = new Map();
  records.forEach((item) => map.set(item[key], (map.get(item[key]) || 0) + item.amount));
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadText(content, filename, type) {
  const blob = new Blob([`\uFEFF${content}`], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
