const $ = (id) => document.getElementById(id);
const money = (value) => `¥${Number(value || 0).toFixed(2)}`;
const cents = (value) => Math.round((Number(value) || 0) * 100) / 100;
const num = (id) => Number($(id).value) || 0;
const text = (id) => $(id).value.trim();
const splitList = (value) => value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
const safeText = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const lossRecords = [];
let currentSchedule = [];
let marginMode = "simple";
let ingredientId = 1;
const ingredients = [];
const bomItems = [];
let yieldMaterialId = 1;
let yieldProductId = 1;
const yieldMaterials = [];
const yieldDraftIngredients = [];
const yieldProducts = [];
const unitMap = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  jin: { base: "g", factor: 500 },
  mL: { base: "mL", factor: 1 },
  L: { base: "mL", factor: 1000 },
  piece: { base: "piece", factor: 1 },
  tbsp: { base: "mL", factor: 15 }
};
const lossStageMap = {
  raw: { label: "生品", rate: 100, note: "生品按采购原料 1:1 折算。" },
  semi: { label: "半成品", rate: 85, note: "半成品按原料加工出成率折回采购成本。" },
  cooked: { label: "熟品", rate: 75, note: "熟品按熟成率折回采购原料成本。" },
  finished: { label: "成品", rate: 65, note: "成品按含料出品率折回采购原料成本。" }
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
$("copyDianpingBtn").addEventListener("click", copyDianpingContent);
$("exportScheduleBtn").addEventListener("click", exportSchedule);
$("exportDealBtn").addEventListener("click", exportDealReport);
$("addIngredientBtn").addEventListener("click", addIngredient);
$("addBomBtn").addEventListener("click", addBomItem);
$("applyYieldBtn").addEventListener("click", applyYieldTest);
$("exportCostCardBtn").addEventListener("click", exportCostCard);
$("addYieldMaterialBtn").addEventListener("click", addYieldMaterial);
$("addYieldIngredientBtn").addEventListener("click", addYieldDraftIngredient);
$("addYieldProductBtn").addEventListener("click", addYieldProduct);
$("loadYieldSampleBtn").addEventListener("click", loadYieldSample);
$("calculateYieldBtn").addEventListener("click", renderYieldCapacity);
$("copyYieldPayloadBtn").addEventListener("click", copyYieldPayload);
$("ingredientRows").addEventListener("click", handleIngredientAction);
$("bomRows").addEventListener("click", handleBomAction);
$("lossRows").addEventListener("click", handleLossAction);
$("yieldMaterialRows").addEventListener("click", handleYieldMaterialAction);
$("yieldDraftRows").addEventListener("click", handleYieldDraftAction);
$("yieldProductRows").addEventListener("click", handleYieldProductAction);
$("salesChannel").addEventListener("change", applyChannelTemplate);
$("dealPlatform").addEventListener("change", applyDealPlatformTemplate);
$("lossStage").addEventListener("change", applyLossStageTemplate);
$("lossConversionRate").addEventListener("input", () => {
  $("lossConversionRate").dataset.touched = "1";
});
["lossReason", "lossOwner"].forEach((id) => {
  $(id).addEventListener("change", updateCustomLossFields);
});
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

document.body.dataset.marginMode = marginMode;
applyLossStageTemplate();
updateCustomLossFields();
applyChannelTemplate();
loadYieldSample();
recalculate();

function recalculate() {
  renderMargin();
  renderHealth();
  renderYieldCapacity();
  renderDeal();
  renderLoss();
  renderXiaohongshu();
  renderDianping();
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
  if (result.beefInflation) advice.push(`主料价格模拟变动 ${result.beefInflation}%，类别为“主料”的原料已参与重算。`);
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

function handleIngredientAction(event) {
  const button = event.target.closest("[data-delete-ingredient]");
  if (!button) return;
  const id = Number(button.dataset.deleteIngredient);
  const index = ingredients.findIndex((item) => item.id === id);
  if (index < 0) return;
  ingredients.splice(index, 1);
  for (let bomIndex = bomItems.length - 1; bomIndex >= 0; bomIndex -= 1) {
    if (bomItems[bomIndex].ingredientId === id) bomItems.splice(bomIndex, 1);
  }
  renderMargin();
}

function handleBomAction(event) {
  const button = event.target.closest("[data-delete-bom]");
  if (!button) return;
  const index = Number(button.dataset.deleteBom);
  if (index < 0 || index >= bomItems.length) return;
  bomItems.splice(index, 1);
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
  const price = ingredient.type === "主料" ? ingredient.price * (1 + beefInflation / 100) : ingredient.price;
  const usableQty = baseQty * ingredient.yieldRate / 100 * ingredient.cookYieldRate / 100 * (1 - ingredient.wasteRate / 100);
  return usableQty ? price / usableQty : 0;
}

function convertToBase(qty, unit, density = 1) {
  const meta = unitMap[unit] || unitMap.g;
  const raw = qty * meta.factor;
  return meta.base === "mL" ? raw * density : raw;
}

function renderIngredientLibrary() {
  if (!ingredients.length) {
    $("ingredientRows").innerHTML = `<tr><td class="empty-table" colspan="7">暂无原料，请先在上方录入采购信息。</td></tr>`;
    return;
  }
  $("ingredientRows").innerHTML = ingredients.map((item) => `
    <tr>
      <td>${safeText(item.name)}<br><small>${safeText(item.supplier)}</small></td>
      <td>${safeText(item.type)}</td>
      <td>${safeText(item.qty)}${unitLabel(item.unit)} / ${money(item.price)}</td>
      <td>${safeText(item.yieldRate)}% / ${safeText(item.wasteRate)}%</td>
      <td>${effectiveCostLabel(item)}</td>
      <td>${safeText(item.updatedAt)}</td>
      <td><button class="text-button danger" type="button" data-delete-ingredient="${item.id}">删除</button></td>
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
  if (!ingredients.length) {
    const emptyOption = `<option value="">暂无原料</option>`;
    $("bomIngredient").innerHTML = emptyOption;
    $("yieldIngredient").innerHTML = emptyOption;
    return;
  }
  const options = ingredients.map((item) => `<option value="${item.id}">${item.name} · ${item.type}</option>`).join("");
  $("bomIngredient").innerHTML = options;
  $("yieldIngredient").innerHTML = options;
}

function renderBomTable(result) {
  if (!bomItems.length) {
    $("bomRows").innerHTML = `<tr><td class="empty-table" colspan="6">暂无用料，请先选择原料并加入配方。</td></tr>`;
    return;
  }
  const servingDivisor = $("cookMode").value === "batch" ? Math.max(num("batchServings"), 1) : 1;
  $("bomRows").innerHTML = bomItems.map((item, index) => {
    const ingredient = ingredients.find((entry) => entry.id === item.ingredientId);
    const cost = bomCost(item, { servingDivisor, beefInflation: result.beefInflation });
    return `
      <tr>
        <td>${safeText(ingredient?.name || "未知")}</td>
        <td>${safeText(ingredient?.type || "-")}</td>
        <td>${safeText(item.qty)}${unitLabel(item.unit)}</td>
        <td>${money(cost)}</td>
        <td>${safeText(item.note || "-")}</td>
        <td><button class="text-button danger" type="button" data-delete-bom="${index}">删除</button></td>
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

function addYieldMaterial() {
  const name = text("yieldMaterialName") || "未命名原料";
  const existingIndex = yieldMaterials.findIndex((item) => item.material_name === name);
  const material = {
    id: yieldMaterialId++,
    material_name: name,
    purchase_weight: num("yieldPurchaseWeight"),
    purchase_cost: num("yieldPurchaseCost"),
    yield_rate: percentToRate(num("yieldRateInput") || 100),
    loss_layers: {
      purchase_loss_rate: percentToRate(num("yieldPurchaseLoss")),
      processing_loss_rate: percentToRate(num("yieldProcessingLoss")),
      cooking_loss_rate: percentToRate(num("yieldCookingLoss"))
    },
    min_purchase_unit: num("yieldMinUnit")
  };
  if (existingIndex >= 0) yieldMaterials.splice(existingIndex, 1, material);
  else yieldMaterials.unshift(material);
  renderYieldCapacity();
}

function addYieldDraftIngredient() {
  const material = yieldMaterials.find((item) => item.id === Number($("yieldIngredientMaterial").value));
  if (!material) return;
  const usageKg = num("yieldUsagePerPortion") / 1000;
  if (!usageKg) return;
  const existingIndex = yieldDraftIngredients.findIndex((item) => item.material_name === material.material_name);
  const ingredient = {
    material_name: material.material_name,
    usage_per_portion: usageKg
  };
  if (existingIndex >= 0) yieldDraftIngredients.splice(existingIndex, 1, ingredient);
  else yieldDraftIngredients.push(ingredient);
  renderYieldCapacity();
}

function addYieldProduct() {
  const productName = text("yieldProductName") || "未命名菜品";
  if (!yieldDraftIngredients.length) return;
  const product = {
    id: yieldProductId++,
    product_name: productName,
    ingredients: yieldDraftIngredients.map((item) => ({ ...item }))
  };
  const existingIndex = yieldProducts.findIndex((item) => item.product_name === productName);
  if (existingIndex >= 0) yieldProducts.splice(existingIndex, 1, product);
  else yieldProducts.unshift(product);
  yieldDraftIngredients.splice(0, yieldDraftIngredients.length);
  renderYieldCapacity();
}

function loadYieldSample() {
  yieldMaterials.splice(0, yieldMaterials.length,
    {
      id: yieldMaterialId++,
      material_name: "牛腩",
      purchase_weight: 10,
      purchase_cost: 420,
      yield_rate: 0.82,
      loss_layers: { purchase_loss_rate: 0, processing_loss_rate: 0.03, cooking_loss_rate: 0.08 },
      min_purchase_unit: 1
    },
    {
      id: yieldMaterialId++,
      material_name: "米饭",
      purchase_weight: 12,
      purchase_cost: 96,
      yield_rate: 0.98,
      loss_layers: { purchase_loss_rate: 0.01, processing_loss_rate: 0.01, cooking_loss_rate: 0 },
      min_purchase_unit: 0.5
    },
    {
      id: yieldMaterialId++,
      material_name: "青菜",
      purchase_weight: 5,
      purchase_cost: 45,
      yield_rate: 0.75,
      loss_layers: { purchase_loss_rate: 0.02, processing_loss_rate: 0.06, cooking_loss_rate: 0.04 },
      min_purchase_unit: 0.5
    }
  );
  yieldDraftIngredients.splice(0, yieldDraftIngredients.length);
  yieldProducts.splice(0, yieldProducts.length,
    {
      id: yieldProductId++,
      product_name: "招牌牛腩饭",
      ingredients: [
        { material_name: "牛腩", usage_per_portion: 0.12 },
        { material_name: "米饭", usage_per_portion: 0.18 },
        { material_name: "青菜", usage_per_portion: 0.06 }
      ]
    },
    {
      id: yieldProductId++,
      product_name: "小份牛腩饭",
      ingredients: [
        { material_name: "牛腩", usage_per_portion: 0.09 },
        { material_name: "米饭", usage_per_portion: 0.15 },
        { material_name: "青菜", usage_per_portion: 0.05 }
      ]
    }
  );
  renderYieldCapacity();
}

function handleYieldMaterialAction(event) {
  const button = event.target.closest("[data-delete-yield-material]");
  if (!button) return;
  const id = Number(button.dataset.deleteYieldMaterial);
  const index = yieldMaterials.findIndex((item) => item.id === id);
  if (index < 0) return;
  const materialName = yieldMaterials[index].material_name;
  yieldMaterials.splice(index, 1);
  removeMatchingYieldIngredients(yieldDraftIngredients, materialName);
  yieldProducts.forEach((product) => removeMatchingYieldIngredients(product.ingredients, materialName));
  renderYieldCapacity();
}

function handleYieldDraftAction(event) {
  const button = event.target.closest("[data-delete-yield-draft]");
  if (!button) return;
  const index = Number(button.dataset.deleteYieldDraft);
  if (index >= 0 && index < yieldDraftIngredients.length) yieldDraftIngredients.splice(index, 1);
  renderYieldCapacity();
}

function handleYieldProductAction(event) {
  const button = event.target.closest("[data-delete-yield-product]");
  if (!button) return;
  const id = Number(button.dataset.deleteYieldProduct);
  const index = yieldProducts.findIndex((item) => item.id === id);
  if (index >= 0) yieldProducts.splice(index, 1);
  renderYieldCapacity();
}

function removeMatchingYieldIngredients(list, materialName) {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index].material_name === materialName) list.splice(index, 1);
  }
}

function renderYieldCapacity() {
  renderYieldMaterialOptions();
  renderYieldMaterialRows();
  renderYieldDraftRows();
  renderYieldProductRows();
  const payload = buildYieldPayload();
  const calculator = window.HugeToolsYield;
  const result = calculator?.calculateYieldCapacity ? calculator.calculateYieldCapacity(payload) : emptyYieldResult();
  renderYieldResult(result);
  $("yieldPayloadPreview").value = JSON.stringify(payload, null, 2);
  $("yieldApiNote").innerHTML = [
    "<p>API 契约：POST /calculate-yield，静态部署可用 POST /api/calculate-yield；请求体即上方 JSON。</p>",
    "<p>浏览器内也可调用：HugeToolsYield.post('/calculate-yield', payload)。计算函数不读写页面状态，可直接给库存、批次和可视化模块复用。</p>",
    "<p>扩展预留：loss_layers 支持采购/加工/烹饪多层损耗；batches 支持不同批次成本；inventory_snapshot 预留实时库存。</p>"
  ].join("");
}

function emptyYieldResult() {
  return {
    material_availability: [],
    products: [],
    summary: { material_count: 0, product_count: 0, total_theoretical_portions: 0, bottleneck_materials: [] }
  };
}

function buildYieldPayload() {
  return {
    materials: yieldMaterials.map(({ id, ...material }) => material),
    products: yieldProducts.map(({ id, ...product }) => ({
      ...product,
      ingredients: product.ingredients.map((ingredient) => ({ ...ingredient }))
    })),
    options: {
      weight_unit: "kg",
      usage_unit: "kg_per_portion",
      include_min_purchase_unit: true,
      rounding: "floor"
    },
    inventory_snapshot: {}
  };
}

function renderYieldMaterialOptions() {
  $("yieldIngredientMaterial").innerHTML = yieldMaterials.length
    ? yieldMaterials.map((item) => `<option value="${item.id}">${safeText(item.material_name)}</option>`).join("")
    : `<option value="">暂无原料</option>`;
}

function renderYieldMaterialRows() {
  if (!yieldMaterials.length) {
    $("yieldMaterialRows").innerHTML = `<tr><td class="empty-table" colspan="6">暂无原料，请先录入采购重量、金额、出成率和损耗。</td></tr>`;
    return;
  }
  $("yieldMaterialRows").innerHTML = yieldMaterials.map((item) => {
    const stats = window.HugeToolsYield?.materialAvailability(item) || {};
    const lossLayers = item.loss_layers || {};
    const lossText = [
      lossLayers.purchase_loss_rate ? `采购${rateToPercent(lossLayers.purchase_loss_rate)}%` : "",
      lossLayers.processing_loss_rate ? `加工${rateToPercent(lossLayers.processing_loss_rate)}%` : "",
      lossLayers.cooking_loss_rate ? `烹饪${rateToPercent(lossLayers.cooking_loss_rate)}%` : ""
    ].filter(Boolean).join(" / ") || "无额外损耗";
    return `
      <tr>
        <td>${safeText(item.material_name)}</td>
        <td>${safeText(item.purchase_weight)}kg / ${money(item.purchase_cost)}<br><small>最小单位 ${safeText(item.min_purchase_unit || 0)}kg</small></td>
        <td>出成 ${rateToPercent(item.yield_rate)}%<br><small>${safeText(lossText)}</small></td>
        <td>${safeText(stats.effective_weight || 0)}kg<br><small>修正采购 ${safeText(stats.effective_purchase_weight || 0)}kg</small></td>
        <td>${money(stats.effective_unit_cost || 0)} / kg</td>
        <td><button class="text-button danger" type="button" data-delete-yield-material="${item.id}">删除</button></td>
      </tr>
    `;
  }).join("");
}

function renderYieldDraftRows() {
  $("yieldDraftRows").innerHTML = yieldDraftIngredients.length
    ? yieldDraftIngredients.map((item, index) => `
      <tr>
        <td>${safeText(text("yieldProductName") || "当前菜品")}</td>
        <td>${safeText(item.material_name)}</td>
        <td>${(item.usage_per_portion * 1000).toFixed(1)}g</td>
        <td><button class="text-button danger" type="button" data-delete-yield-draft="${index}">删除</button></td>
      </tr>
    `).join("")
    : `<tr><td class="empty-table" colspan="4">当前菜品还没有 BOM 原料。</td></tr>`;
}

function renderYieldProductRows() {
  $("yieldProductRows").innerHTML = yieldProducts.length
    ? yieldProducts.map((product) => `
      <tr>
        <td>${safeText(product.product_name)}</td>
        <td>${product.ingredients.map((item) => `${safeText(item.material_name)} ${(item.usage_per_portion * 1000).toFixed(1)}g`).join("；")}</td>
        <td><button class="text-button danger" type="button" data-delete-yield-product="${product.id}">删除</button></td>
      </tr>
    `).join("")
    : `<tr><td class="empty-table" colspan="3">暂无菜品，请先把当前 BOM 保存为菜品。</td></tr>`;
}

function renderYieldResult(result) {
  const tightest = result.summary.bottleneck_materials[0]?.material_name || "暂无";
  const lowestCapacity = result.products.reduce((min, item) => Math.min(min, item.theoretical_max_portions || 0), Infinity);
  $("yieldSummary").innerHTML = [
    metric("原料数", `${result.summary.material_count} 项`, result.summary.material_count ? "good" : "warn"),
    metric("菜品数", `${result.summary.product_count} 个`, result.summary.product_count ? "good" : "warn"),
    metric("合计理论产能", `${result.summary.total_theoretical_portions} 份`, result.summary.total_theoretical_portions ? "good" : "warn"),
    metric("最常见瓶颈", safeText(tightest), tightest === "暂无" ? "warn" : "bad")
  ].join("");

  $("yieldResultRows").innerHTML = result.products.length
    ? result.products.map((product) => {
      const utilization = product.material_utilization
        .map((item) => `${safeText(item.material_name)} ${rateToPercent(item.utilization_rate)}%`)
        .join("；");
      return `
        <tr>
          <td>${safeText(product.product_name)}</td>
          <td>${safeText(product.theoretical_max_portions)} 份<br><small>精确值 ${safeText(product.exact_capacity)}</small></td>
          <td>${product.bottleneck_materials.map(safeText).join("、") || "暂无"}</td>
          <td>${money(product.unit_theoretical_cost)}</td>
          <td>${utilization || "暂无"}</td>
        </tr>
      `;
    }).join("")
    : `<tr><td class="empty-table" colspan="5">暂无产能结果，请先录入原料并保存菜品 BOM。</td></tr>`;

  renderYieldBottleneckMap(result);
  const advice = [];
  if (!result.products.length) advice.push("先录入至少一个原料和一个菜品 BOM，工具会自动按多原料瓶颈法计算产能。");
  if (tightest !== "暂无") advice.push(`当前最常见瓶颈原料是「${tightest}」，优先复核采购量、出成率、BOM 克重或替代菜品结构。`);
  if (Number.isFinite(lowestCapacity) && lowestCapacity <= 20 && result.products.length) advice.push(`最低菜品产能只有 ${lowestCapacity} 份，适合提前做限量售卖、补货或调整排产。`);
  advice.push("所有重量在 API payload 中统一为 kg；页面输入的每份用量 g 会自动换算为 kg。");
  $("yieldAdvice").innerHTML = advice.map((item) => `<p>${item}</p>`).join("");
}

function renderYieldBottleneckMap(result) {
  const rows = result.products.flatMap((product) => product.material_capacity_details.map((item) => ({
    product: product.product_name,
    material: item.material_name,
    capacity: item.material_capacity,
    isBottleneck: product.bottleneck_materials.includes(item.material_name)
  })));
  const maxCapacity = Math.max(...rows.map((item) => item.capacity), 1);
  $("yieldBottleneckMap").innerHTML = rows.length
    ? rows.map((item) => `
      <div class="structure-row ${item.isBottleneck ? "bottleneck-row" : ""}">
        <span>${safeText(item.product)}</span>
        <div class="structure-track"><div class="structure-fill" style="width: ${Math.min(item.capacity / maxCapacity * 100, 100)}%"></div></div>
        <strong>${safeText(item.material)} · ${Math.floor(item.capacity)} 份</strong>
      </div>
    `).join("")
    : "";
}

async function copyYieldPayload() {
  const payload = $("yieldPayloadPreview").value || JSON.stringify(buildYieldPayload(), null, 2);
  const content = `POST /calculate-yield\nContent-Type: application/json\n\n${payload}`;
  const copied = await copyText(content);
  $("copyYieldPayloadBtn").textContent = copied ? "已复制" : "已选中";
  if (!copied) {
    $("yieldPayloadPreview").focus();
    $("yieldPayloadPreview").select();
  }
  setTimeout(() => $("copyYieldPayloadBtn").textContent = "复制 API 请求", 1200);
}

function percentToRate(value) {
  return Math.min(Math.max((Number(value) || 0) / 100, 0), 1);
}

function rateToPercent(value) {
  return (Number(value || 0) * 100).toFixed(1).replace(/\.0$/, "");
}

function unitLabel(unit) {
  return { jin: "斤", piece: "个", tbsp: "汤匙" }[unit] || unit;
}

function renderHealth() {
  const result = calculateHealth();
  const foodLevel = result.actualCogs < 0 ? "bad" : result.foodCostRate <= result.foodRedline ? "good" : result.foodCostRate <= result.foodRedline + 5 ? "warn" : "bad";
  const primeLevel = result.primeCostRate <= result.primeRedline ? "good" : result.primeCostRate <= result.primeRedline + 5 ? "warn" : "bad";
  const grossLevel = result.grossProfit >= 0 ? "good" : "bad";
  const varianceLevel = result.varianceAmount <= 0 ? "good" : result.varianceRate <= 5 ? "warn" : "bad";

  $("healthResult").innerHTML = [
    metric("实际食材成本 COGS", money(result.actualCogs), foodLevel),
    metric("食材成本率", `${result.foodCostRate.toFixed(1)}%`, foodLevel),
    metric("毛利", `${money(result.grossProfit)} / ${result.grossMarginRate.toFixed(1)}%`, grossLevel),
    metric("Prime Cost", `${money(result.primeCost)} / ${result.primeCostRate.toFixed(1)}%`, primeLevel)
  ].join("");

  $("varianceResult").innerHTML = [
    metric("理论食材成本", money(result.theoreticalFoodCost), "good"),
    metric("成本差异", `${money(result.varianceAmount)} / ${result.varianceRate.toFixed(1)}%`, varianceLevel),
    metric("调整项合计", money(result.adjustmentTotal), result.adjustmentTotal > result.revenue * 0.03 && result.revenue ? "warn" : "good"),
    metric("损耗记录联动", money(result.trackedLoss), result.trackedLoss > result.revenue * 0.02 && result.revenue ? "bad" : "good")
  ].join("");

  $("healthLossLink").innerHTML = `<p>当前损耗记录合计 ${money(result.trackedLoss)}，${result.includeTrackedLoss ? "已计入实际食材成本调整项" : "未计入实际食材成本调整项"}。</p>`;

  const advice = [];
  if (!result.hasCoreInput) advice.push("录入营业收入、期初库存、当期采购和期末库存后，会形成实际食材成本与 Prime Cost 总览。");
  if (result.actualCogs < 0) advice.push("实际食材成本为负，通常是期末库存、采购或调整项录入不一致，需要先复核库存流转数据。");
  if (result.foodCostRate > result.foodRedline) advice.push(`食材成本率高于 ${result.foodRedline}%，优先检查采购价、期末盘点、报损赠送和菜品标准克重。`);
  if (result.primeCostRate > result.primeRedline) advice.push(`Prime Cost 高于 ${result.primeRedline}%，需要同时看食材成本和排班人工，不能只压单菜毛利。`);
  if (result.theoreticalFoodCost && result.varianceAmount > 0) advice.push(`实际食材成本比理论成本高 ${money(result.varianceAmount)}，重点排查损耗、出品克重偏差、盘亏或漏记销售。`);
  if (result.theoreticalFoodCost && result.varianceAmount < 0) advice.push(`实际食材成本低于理论成本 ${money(Math.abs(result.varianceAmount))}，建议复核期末库存、采购入账和标准菜谱克重是否偏高。`);
  if (result.includeTrackedLoss && result.trackedLoss && result.adjustmentTotal > result.actualCogs * 0.08) advice.push("损耗及调整项占比较高，建议把异常报损、员工餐、赠送和盘点差异分开记录。");
  if (!advice.length) advice.push("当前经营健康度暂未触发红线；下一步可用标准菜谱成本和销售结构继续做菜单工程分析。");
  $("healthAdvice").innerHTML = advice.map((item) => `<p>${item}</p>`).join("");
}

function calculateHealth() {
  const revenue = num("healthRevenue");
  const openingInventory = num("openingInventory");
  const periodPurchases = num("periodPurchases");
  const endingInventory = num("endingInventory");
  const includeTrackedLoss = $("includeTrackedLoss").checked;
  const trackedLoss = lossRecords.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const manualLoss = num("manualLossCost");
  const compCost = num("compCost");
  const staffMealCost = num("staffMealCost");
  const shrinkageCost = num("shrinkageCost");
  const surplusCost = num("surplusCost");
  const adjustmentTotal = cents((includeTrackedLoss ? trackedLoss : 0) + manualLoss + compCost + staffMealCost + shrinkageCost - surplusCost);
  const actualCogs = cents(openingInventory + periodPurchases - endingInventory + adjustmentTotal);
  const grossProfit = cents(revenue - actualCogs);
  const foodCostRate = revenue ? actualCogs / revenue * 100 : 0;
  const grossMarginRate = revenue ? grossProfit / revenue * 100 : 0;
  const laborCost = num("laborCost");
  const primeCost = cents(actualCogs + laborCost);
  const primeCostRate = revenue ? primeCost / revenue * 100 : 0;
  const theoreticalFoodCost = num("theoreticalFoodCost");
  const varianceAmount = theoreticalFoodCost ? cents(actualCogs - theoreticalFoodCost) : 0;
  const varianceRate = theoreticalFoodCost ? varianceAmount / theoreticalFoodCost * 100 : 0;
  return {
    revenue,
    openingInventory,
    periodPurchases,
    endingInventory,
    includeTrackedLoss,
    trackedLoss,
    adjustmentTotal,
    actualCogs,
    grossProfit,
    foodCostRate,
    grossMarginRate,
    laborCost,
    primeCost,
    primeCostRate,
    theoreticalFoodCost,
    varianceAmount,
    varianceRate,
    foodRedline: num("foodCostRedline") || 35,
    primeRedline: num("primeCostRedline") || 65,
    hasCoreInput: Boolean(revenue || openingInventory || periodPurchases || endingInventory)
  };
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
  const stage = $("lossStage").value;
  const conversionRate = Math.min(Math.max(num("lossConversionRate"), 1), 100);
  const rawEquivalentQty = calculateRawEquivalentQty(qty, conversionRate);
  const rawMaterialCost = cents(rawEquivalentQty * unitCost);
  lossRecords.unshift({
    date: $("lossDate").value || new Date().toISOString().slice(0, 10),
    item: text("lossItem"),
    stage,
    stageLabel: lossStageMap[stage]?.label || "生品",
    qty,
    unit: text("lossUnit") || "份",
    unitCost,
    conversionRate,
    rawEquivalentQty,
    reason: selectedLossChoice("lossReason", "lossReasonCustom", "未填写原因"),
    owner: selectedLossChoice("lossOwner", "lossOwnerCustom", "未填写归类"),
    amount: rawMaterialCost
  });
  renderLoss();
  renderHealth();
}

function handleLossAction(event) {
  const button = event.target.closest("[data-delete-loss]");
  if (!button) return;
  const index = Number(button.dataset.deleteLoss);
  if (index < 0 || index >= lossRecords.length) return;
  lossRecords.splice(index, 1);
  renderLoss();
  renderHealth();
}

function renderLoss() {
  const total = lossRecords.reduce((sum, item) => sum + item.amount, 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayTotal = lossRecords.filter((item) => item.date === today).reduce((sum, item) => sum + item.amount, 0);
  const topItem = topBy(lossRecords, "item");
  const topReason = topBy(lossRecords, "reason");
  const topStage = topBy(lossRecords, "stageLabel");

  $("lossSummary").innerHTML = [
    metric("今日原料损耗", money(todayTotal), todayTotal > 100 ? "bad" : "warn"),
    metric("累计原料损耗", money(total), total > 300 ? "bad" : "warn"),
    metric("TOP 状态", safeText(topStage || "暂无"), "good"),
    metric("TOP 原因", safeText(topReason || "暂无"), "warn")
  ].join("");

  $("lossRows").innerHTML = lossRecords.length
    ? lossRecords.map((item, index) => `
      <tr>
        <td>${safeText(item.date)}</td>
        <td>${safeText(item.item)}</td>
        <td>${safeText(item.stageLabel || lossStageMap[item.stage]?.label || "生品")}</td>
        <td>${safeText(item.qty)}${safeText(item.unit)}</td>
        <td>${rawEquivalentLabel(item)}</td>
        <td>${money(item.amount)}</td>
        <td>${safeText(item.reason)}</td>
        <td>${safeText(item.owner)}</td>
        <td><button class="text-button danger" type="button" data-delete-loss="${index}">删除</button></td>
      </tr>
    `).join("")
    : `<tr><td class="empty-table" colspan="9">暂无损耗记录，请先录入真实损耗信息。</td></tr>`;

  const stage = lossStageMap[$("lossStage").value] || lossStageMap.raw;
  const lossAdvice = lossRecords.length ? [
    `<p>当前损耗金额统一按采购原材料成本统计，主要集中在「${safeText(topItem)}」和「${safeText(topReason)}」。</p>`,
    `<p>当前录入状态为「${stage.label}」：${stage.note} 损耗数量会按 ${num("lossConversionRate") || stage.rate}% 转化率折回采购原料数量。</p>`,
    "<p>如果连续 3 天同一原因最高，建议调整备货公式、保存标准或员工训练动作。</p>"
  ] : [
    "<p>暂无损耗记录。新增后会按采购原材料成本自动汇总。</p>",
    `<p>当前录入状态为「${stage.label}」：${stage.note} 损耗数量会按 ${num("lossConversionRate") || stage.rate}% 转化率折回采购原料数量。</p>`
  ];
  $("lossAdvice").innerHTML = lossAdvice.join("");
}

function calculateRawEquivalentQty(qty, conversionRate) {
  return cents(qty / (Math.min(Math.max(Number(conversionRate) || 100, 1), 100) / 100));
}

function rawEquivalentLabel(item) {
  const rate = item.conversionRate || 100;
  const rawQty = item.rawEquivalentQty ?? calculateRawEquivalentQty(item.qty, rate);
  return `${safeText(rawQty)}${safeText(item.unit)}<br><small>${safeText(rate)}% 转化率</small>`;
}

function selectedLossChoice(selectId, customId, fallback) {
  const select = $(selectId);
  if (select.value !== "__custom") return select.value || fallback;
  return text(customId) || fallback;
}

function applyLossStageTemplate() {
  const stage = lossStageMap[$("lossStage").value] || lossStageMap.raw;
  const rateInput = $("lossConversionRate");
  if (rateInput.dataset.touched !== "1") rateInput.value = stage.rate;
  renderLoss();
}

function updateCustomLossFields() {
  [
    ["lossReason", "lossReasonCustomLabel"],
    ["lossOwner", "lossOwnerCustomLabel"]
  ].forEach(([selectId, labelId]) => {
    $(labelId).classList.toggle("active", $(selectId).value === "__custom");
  });
}

function renderXiaohongshu() {
  const category = text("xhsCategory") || "招牌菜";
  const city = text("xhsCity") || "本地";
  const keywords = splitList(text("xhsKeywords"));
  const points = splitList(text("xhsSellingPoints"));
  const audience = splitList(text("xhsAudience"));
  const style = $("xhsStyle").value;
  const address = text("xhsAddress") || "门店附近";
  const hotspots = xhsHotspotsFor({ category, city, keywords, points, audience, style });
  const primaryHotspot = hotspots[0];
  const keywordLine = keywords.length ? keywords.join("、") : `${city}${category}`;
  const titles = [
    `${city}${category}｜${primaryHotspot.titleHook}`,
    `${keywordLine}怎么选？这家先记到清单里`,
    `${audience[0] || "附近打工人"}可以收藏的${category}小店`,
    `${style}｜${points[0] || primaryHotspot.phrase}的${category}`,
    `${city}吃饭灵感：${primaryHotspot.searchHook}`
  ];
  const body = [
    `最近做${city}${category}内容时，可以把关键词放在「${keywordLine}」这一组搜索场景里，而不是只写一句泛泛的好吃。`,
    `这篇按「${primaryHotspot.name}」来写：${primaryHotspot.bodyAngle}`,
    `适合${audience.join("、") || "日常吃饭"}参考。真实卖点可以落到：${points.join("、") || "出品稳定、价格清楚、吃起来舒服"}。`,
    `如果你正在${address}找吃的，可以把它当成${primaryHotspot.sceneUse}。第一次来建议先点招牌款，再按口味加小吃或饮品。`,
    `互动可以这样收尾：你们更想看「价格明细」「真实份量」还是「避雷点」？我下次按评论区继续补。`
  ].join("\n\n");
  const tags = uniqueList([
    `#${city}美食`,
    `#${category}`,
    ...keywords.map((item) => `#${item.replace(/\s+/g, "")}`),
    ...hotspots.flatMap((item) => item.tags),
    "#小餐饮探店",
    "#今天吃什么",
    "#本地生活",
    "#餐饮老板",
    "#开店日常"
  ]).slice(0, 14);

  $("xhsHotspots").innerHTML = [
    ...hotspots.map((item) => `<p><strong>${safeText(item.name)}：</strong>${safeText(item.summary)}</p>`),
    `<p><a href="${xhsSearchUrl(keywordLine)}" target="_blank" rel="noopener">打开小红书搜索：${safeText(keywordLine)}</a> <small>用于人工复核公开热词，不抓取或照搬平台原文。</small></p>`
  ].join("");
  $("xhsTitles").innerHTML = titles.map((item) => `<span class="chip">${item}</span>`).join("");
  $("xhsBody").value = body;
  $("xhsTags").innerHTML = tags.map((item) => `<span class="chip">${safeText(item)}</span>`).join("");
  $("xhsVisual").innerHTML = [
    `<p>封面文案：${safeText(primaryHotspot.coverLine.replace("{city}", city).replace("{category}", category))}</p>`,
    `<p>拍摄建议：${safeText(primaryHotspot.photoBrief)} 门头、产品近景、出餐过程、顾客用餐场景和菜单价格至少覆盖 3 类。</p>`,
    "<p>热点融合边界：可以借用公开热点方向和搜索关键词，不复制他人标题正文，不编造体验。</p>"
  ].join("");
}

function xhsHotspotsFor({ category, city, keywords, points, audience, style }) {
  const combined = [category, city, ...keywords, ...points, ...audience, style].join(" ");
  const rules = [
    {
      name: "地域美食",
      test: /(城市|本地|附近|旅游|旅行|周末|街区|商圈|地铁|景区|夜市|地域|老字号|烟火气)/,
      titleHook: "本地人会怎么吃",
      searchHook: "把本地烟火气拍出来",
      phrase: "本地风味",
      bodyAngle: "把门店放进城市/商圈/街区语境里，强调真实路线、附近场景和本地人选择。",
      sceneUse: "附近吃饭或周末顺路打卡选项",
      summary: "公开餐饮趋势里，地域美食和城市烟火气常被当作流量入口，适合写商圈、路线、附近人群和真实场景。",
      coverLine: "{city}{category}，本地人怎么吃",
      photoBrief: "先拍门头和周边街景，再拍招牌菜，建立“我真的到过这里”的真实感。",
      tags: ["#本地美食", "#城市美食", "#附近美食", "#周末去哪吃"]
    },
    {
      name: "搜索攻略",
      test: /(攻略|怎么选|推荐|清单|收藏|避雷|测评|对比|人均|价格|菜单|排名)/,
      titleHook: "先收藏这份吃饭清单",
      searchHook: "把价格、份量和选择理由讲清楚",
      phrase: "价格清楚",
      bodyAngle: "按用户搜索问题来写，给出选择理由、适合人群、价格份量和避雷点。",
      sceneUse: "决策前的搜索参考",
      summary: "公开种草方法强调标题、正文和标签的关键词布局；餐饮内容适合做清单、攻略、测评和避雷。",
      coverLine: "{city}{category}吃饭清单",
      photoBrief: "拍菜单价格、份量对比和桌面全景，让读者快速判断值不值得去。",
      tags: ["#吃饭攻略", "#美食清单", "#人均消费", "#避雷指南"]
    },
    {
      name: "生活记录",
      test: /(下班|午餐|晚餐|夜宵|一人食|聚餐|约会|朋友|打工人|日常|松弛|治愈|生活)/,
      titleHook: "下班后就想吃这一口",
      searchHook: "把一顿饭写成生活片段",
      phrase: "真实生活感",
      bodyAngle: "少写广告口吻，多写什么时间、和谁来、为什么点、吃完感受。",
      sceneUse: "日常吃饭灵感",
      summary: "公开资料提到小红书从种草走向生活兴趣社区，餐饮笔记更适合写真实生活片段，而不是硬广。",
      coverLine: "{city}下班吃什么",
      photoBrief: "拍用餐前后、热气、夹菜、朋友同桌等生活瞬间，弱化摆拍感。",
      tags: ["#下班吃什么", "#打工人午餐", "#一人食", "#生活记录"]
    },
    {
      name: "听劝互动",
      test: /(听劝|评论|投票|新品|上新|隐藏|菜单|愿望|粉丝|互动|建议)/,
      titleHook: "评论区想看的我先试了",
      searchHook: "用问题引导评论互动",
      phrase: "评论区听劝",
      bodyAngle: "把内容写成一次真实反馈收集，邀请用户选择下次测什么、拍什么、改什么。",
      sceneUse: "评论区互动选题",
      summary: "公开餐饮趋势里提到“听劝”和互动，让消费者想法成为内容选题，适合新品、隐藏吃法和菜单优化。",
      coverLine: "听劝试吃{category}",
      photoBrief: "拍新品细节、试吃反应和可投票选项，结尾留一个明确问题。",
      tags: ["#听劝", "#新品试吃", "#隐藏吃法", "#评论区告诉我"]
    },
    {
      name: "健康轻负担",
      test: /(健康|低脂|轻食|低糖|真材实料|营养|干净|配料|新鲜|低卡|养生)/,
      titleHook: "想吃得轻一点可以看这家",
      searchHook: "把配料和负担感说清楚",
      phrase: "干净清爽",
      bodyAngle: "强调真实食材、配料透明、口味负担和适合人群，不夸大功效。",
      sceneUse: "轻负担吃饭选择",
      summary: "公开餐饮趋势提到茶饮健康化、真材实料和感觉健康，餐饮文案可写清爽、配料透明和轻负担。",
      coverLine: "{city}轻负担{category}",
      photoBrief: "拍食材、汤底/配料、后厨出品或菜单标识，避免医疗化表达。",
      tags: ["#轻负担美食", "#真材实料", "#清爽不腻", "#健康吃饭"]
    },
    {
      name: "周边赠品",
      test: /(周边|联名|赠品|打卡|拍照|仪式感|漂亮|好看|出片|收藏|限定)/,
      titleHook: "好吃之外还挺好拍",
      searchHook: "把可拍、可晒、可收藏说出来",
      phrase: "好看出片",
      bodyAngle: "把菜品、包装、周边或门店视觉一起写，让内容有可拍可分享的理由。",
      sceneUse: "拍照打卡或朋友分享素材",
      summary: "公开趋势提到周边/赠品和漂亮饭能带动关注，适合写包装、摆盘、门店视觉和打卡理由。",
      coverLine: "{category}也太出片了",
      photoBrief: "拍包装、赠品、桌面拼图和门店视觉元素，封面突出一个最强记忆点。",
      tags: ["#出片美食", "#打卡拍照", "#限定周边", "#漂亮饭"]
    }
  ];
  const matched = rules.filter((rule) => rule.test.test(combined));
  return uniqueByName(matched.length ? matched.slice(0, 3) : [rules[2], rules[1], rules[0]]);
}

function xhsSearchUrl(keyword) {
  return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`;
}

function uniqueList(items) {
  return [...new Set(items.filter(Boolean))];
}

function uniqueByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
}

async function copyXhsPost() {
  const content = `${[...$("xhsTitles").querySelectorAll(".chip")].map((item) => item.textContent).join("\n")}\n\n${$("xhsBody").value}\n\n${[...$("xhsTags").querySelectorAll(".chip")].map((item) => item.textContent).join(" ")}`;
  const copied = await copyText(content);
  if (!copied) {
    $("xhsBody").value = content;
    $("xhsBody").focus();
    $("xhsBody").select();
  }
  $("copyPostBtn").textContent = copied ? "已复制" : "已选中文案";
  setTimeout(() => $("copyPostBtn").textContent = "复制文案", 1200);
}

function renderDianping() {
  const result = buildDianpingContent();
  $("dianpingSummary").innerHTML = [
    metric("真实细节完整度", `${result.detailScore}/4`, result.detailScore >= 3 ? "good" : result.detailScore >= 2 ? "warn" : "bad"),
    metric("草稿类型", result.modeLabel, "good"),
    metric("合规风险", result.riskLevel, result.riskLevel === "低" ? "good" : result.riskLevel === "中" ? "warn" : "bad"),
    metric("建议图片", `${result.photoIdeas.length} 张`, "good")
  ].join("");
  $("dianpingDraft").value = result.draft;
  $("dianpingPhotoAdvice").innerHTML = result.photoIdeas.map((item) => `<p>${safeText(item)}</p>`).join("");
  $("dianpingCompliance").innerHTML = result.compliance.map((item) => `<p>${safeText(item)}</p>`).join("");
}

function buildDianpingContent() {
  const mode = $("dpMode").value;
  const category = text("dpCategory") || "这家店";
  const items = text("dpItems");
  const visitDate = text("dpVisitDate");
  const spend = text("dpSpend");
  const sentiment = $("dpSentiment").value;
  const taste = text("dpTaste");
  const service = text("dpService");
  const issues = text("dpIssues");
  const focus = text("dpFocus");
  const detailScore = [items, taste, service, focus || issues].filter(Boolean).length;
  const riskLevel = detailScore >= 3 ? "低" : detailScore >= 2 ? "中" : "高";
  const modeLabel = mode === "merchantReply" ? "商家回复" : "真实评价";
  const compliance = [
    "仅可整理本人真实消费体验或商家对真实评价的回复，不替顾客写评，不提供给顾客照抄。",
    "不要承诺返现、赠品、折扣来换评价，不要求用户删改评价或截图证明。",
    "没有实际体验的菜品、服务、环境细节不要补写；细节不足时先补充真实信息再发布。"
  ];
  if (riskLevel !== "低") compliance.unshift("当前真实细节偏少，建议补充消费项目、口味、服务环境或具体改进点，避免生成空泛模板。");
  const photoIdeas = [
    items ? `产品近景：拍清楚「${items}」的真实份量、摆盘和状态。` : "产品近景：拍实际消费的菜品或套餐，不使用无关库存图。",
    "环境照片：拍门头、座位区、菜单价格或排队动线，帮助读者判断真实场景。",
    "细节照片：可补充小票、取餐号、调料台、餐具或包装，但注意遮挡个人隐私。"
  ];
  if (mode === "merchantReply") {
    return {
      detailScore,
      riskLevel,
      modeLabel,
      photoIdeas,
      compliance,
      draft: buildDianpingReply({ category, items, sentiment, taste, service, issues, focus })
    };
  }
  return {
    detailScore,
    riskLevel,
    modeLabel,
    photoIdeas,
    compliance,
    draft: buildDianpingReview({ category, items, visitDate, spend, sentiment, taste, service, issues, focus })
  };
}

function buildDianpingReview(data) {
  if (![data.items, data.taste, data.service, data.focus || data.issues].filter(Boolean).length) {
    return "请先补充真实消费项目、口味/产品细节、服务/环境细节或希望表达的重点。工具只整理真实体验，不编造评价内容。";
  }
  const introMap = {
    positive: "这次整体体验比较满意。",
    neutral: "这次体验中规中矩，记录一下真实感受。",
    mixed: "这次体验有满意的地方，也有一些可以改进的地方。",
    negative: "这次体验不太理想，主要问题记录如下。"
  };
  const parts = [
    data.visitDate ? `${data.visitDate} 到店体验，${introMap[data.sentiment]}` : introMap[data.sentiment],
    data.items ? `实际消费：${data.items}${data.spend ? `，人均/金额约 ${data.spend}` : ""}。` : "",
    data.taste ? `口味/产品：${data.taste}` : "",
    data.service ? `服务/环境：${data.service}` : "",
    data.issues ? `不足/建议：${data.issues}` : "",
    data.focus ? `补充感受：${data.focus}` : ""
  ].filter(Boolean);
  return parts.join("\n\n");
}

function buildDianpingReply(data) {
  const issueLine = data.issues
    ? `关于您提到的「${data.issues}」，我们会反馈给门店当班同事复盘，并尽快优化。`
    : "我们会继续保持出品和服务稳定，也欢迎您下次到店继续提出真实建议。";
  const thanks = data.sentiment === "negative"
    ? "很抱歉这次没有给您带来满意体验。"
    : "感谢您分享这次真实体验。";
  return [
    `${thanks}${data.items ? `您提到的「${data.items}」我们已经记录。` : ""}`,
    data.taste ? `关于产品反馈：${data.taste}` : "",
    data.service ? `关于服务/环境反馈：${data.service}` : "",
    issueLine,
    "感谢监督，我们会基于真实反馈持续改进。"
  ].filter(Boolean).join("\n\n");
}

async function copyDianpingContent() {
  const content = [
    $("dianpingDraft").value,
    "",
    "拍摄建议：",
    $("dianpingPhotoAdvice").innerText,
    "",
    "合规检查：",
    $("dianpingCompliance").innerText
  ].join("\n");
  const copied = await copyText(content);
  if (!copied) {
    $("dianpingDraft").focus();
    $("dianpingDraft").select();
  }
  $("copyDianpingBtn").textContent = copied ? "已复制" : "已选中内容";
  setTimeout(() => $("copyDianpingBtn").textContent = "复制内容", 1200);
}

async function copyText(content) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch (_) {
      // Safari and file:// pages can reject clipboard access; fall back below.
    }
  }
  const area = document.createElement("textarea");
  area.value = content;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (_) {
    copied = false;
  }
  area.remove();
  return copied;
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
