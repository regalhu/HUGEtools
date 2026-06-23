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
let yieldMode = "quick";
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
const defaultYieldProfiles = {
  chicken: { label: "鸡肉", keywords: ["鸡", "鸡肉", "鸡腿", "鸡胸"], yield_rate: 0.72, loss_rate: 0.04 },
  beef: { label: "牛肉", keywords: ["牛", "牛肉", "牛腩", "肥牛"], yield_rate: 0.68, loss_rate: 0.05 },
  pork: { label: "猪肉", keywords: ["猪", "猪肉", "五花", "排骨"], yield_rate: 0.75, loss_rate: 0.04 },
  fish: { label: "鱼类", keywords: ["鱼", "鲈鱼", "草鱼", "鱼片"], yield_rate: 0.55, loss_rate: 0.06 },
  vegetable: { label: "蔬菜", keywords: ["菜", "青菜", "蔬菜", "生菜", "白菜"], yield_rate: 0.85, loss_rate: 0.03 },
  other: { label: "通用", keywords: [], yield_rate: 0.8, loss_rate: 0.03 }
};
const recruitmentCategoryProfiles = {
  hotpot: { label: "火锅/重餐饮", pace: "翻台节奏快、晚市高峰明显", skills: ["熟悉锅底、蘸料和桌边服务", "重视食品安全、餐具清洁和补台速度"], hooks: ["客流稳定", "培训标准清楚", "晋升店助/店长"] },
  fast_food: { label: "快餐简餐", pace: "午晚高峰集中、出餐速度要求高", skills: ["能按标准流程备餐、打包、叫号", "适应多岗位轮换和高峰协作"], hooks: ["流程简单上手快", "排班清楚", "绩效看得见"] },
  chinese: { label: "中餐正餐", pace: "菜品结构多、前后厅配合要求高", skills: ["熟悉点菜、传菜、包间服务或炒锅出品", "能稳定把控口味、卫生和客诉处理"], hooks: ["菜品体系完整", "师傅带教", "长期发展空间"] },
  bbq: { label: "烧烤烤肉", pace: "夜宵和周末高峰强、现场服务感重要", skills: ["能适应晚班、备串、烤制或桌边服务", "注意明火安全、食材保鲜和出品速度"], hooks: ["夜班补贴", "团队氛围直接", "旺季收入弹性"] },
  drink: { label: "茶饮咖啡", pace: "点单密集、标准化制作和门店形象重要", skills: ["能按配方制作饮品、备料、收银和清洁", "服务表达自然，能保持台面整洁"], hooks: ["年轻团队", "产品培训完整", "可学门店运营"] },
  bakery: { label: "烘焙甜品", pace: "产品陈列、出炉节奏和卫生细节要求高", skills: ["能协助烘焙、裱花、包装、陈列或收银", "重视克重、保质期和卖相"], hooks: ["环境干净", "技能成长清晰", "产品有成就感"] },
  noodle: { label: "粉面米饭", pace: "单品爆发强、备料和出餐链路短", skills: ["能完成煮面、浇头、配菜、打包或收台", "高峰期手脚麻利，愿意按标准克重出品"], hooks: ["岗位容易熟练", "小团队沟通快", "包吃实在"] },
  group_meal: { label: "团餐食堂", pace: "餐段固定、批量出餐和安全管理优先", skills: ["能按批量生产计划备餐、分餐和留样", "遵守食安、消毒、验收和台账要求"], hooks: ["作息相对稳定", "流程规范", "团队协作强"] },
  snack: { label: "小吃档口", pace: "人流变化快、一人多岗能力重要", skills: ["能完成现做、打包、收银和卫生维护", "愿意主动招呼顾客，动作利索"], hooks: ["上手快", "老板带着做", "多劳多得"] }
};
const recruitmentRankProfiles = {
  server: { label: "服务员/传菜/迎宾", level: "基础岗位", must: ["接待引导、点单协助、传菜收台", "保持前厅、桌面和餐具整洁", "高峰期配合厨房和收银完成翻台"], requirements: ["有礼貌，做事麻利", "能接受餐饮高峰节奏", "有服务经验优先，没有经验可培训"] },
  cashier: { label: "收银/点单", level: "基础岗位", must: ["完成点单、收银、核销和简单对账", "熟悉菜单、套餐和优惠规则", "协助外卖打包、叫号和顾客咨询"], requirements: ["表达清楚，数字敏感", "细心负责，能处理基础客诉", "会使用收银系统优先"] },
  kitchen: { label: "后厨/切配/洗消", level: "后厨基础岗", must: ["完成备菜、切配、洗消、打包和卫生收尾", "按标准克重、先进先出和保质期要求操作", "高峰期配合出餐，保证台面整洁"], requirements: ["手脚麻利，能吃苦", "重视卫生和安全", "有后厨经验优先，可接受学徒"] },
  cook: { label: "厨师/炒锅/出品", level: "技术岗", must: ["负责指定档口或菜品出品", "稳定口味、火候、克重和出餐速度", "配合备货、验收、盘点和新品试做"], requirements: ["有相关菜系或档口经验", "能按标准出品，不随意改配方", "食品安全意识强"] },
  chef_leader: { label: "厨师长/后厨主管", level: "后厨管理岗", must: ["负责后厨日常管理、排岗和出品质量", "控制食材验收、储存、损耗和毛利", "培训厨师、切配和洗消，推动新品优化"], requirements: ["有后厨管理经验", "懂成本、卫生和标准化", "能带团队，能解决高峰出餐问题"] },
  shift_leader: { label: "领班/班组长", level: "一线管理岗", must: ["负责班次人员分工、巡台和现场协调", "处理顾客反馈，盯住服务标准和卫生收尾", "协助店长做考勤、培训和物料检查"], requirements: ["有餐饮带班经验优先", "沟通直接，执行力强", "能接受轮班和高峰压力"] },
  store_manager: { label: "店长/储备店长", level: "门店管理岗", must: ["负责营业目标、人员排班、成本和服务质量", "管理库存、损耗、点评反馈和安全检查", "带教新人，推动活动执行和复盘"], requirements: ["有餐饮门店管理经验", "懂营业额、毛利、人工和顾客体验", "能独立处理门店日常问题"] },
  supervisor: { label: "运营督导", level: "多店运营岗", must: ["巡店检查标准执行、人员训练和经营数据", "协助门店提升营业额、毛利和服务稳定性", "输出问题清单、整改节奏和复盘结果"], requirements: ["有连锁餐饮或多店管理经验", "能看懂营业、成本、人效数据", "沟通推动能力强"] },
  marketing: { label: "市场/团购运营", level: "增长运营岗", must: ["负责团购套餐、达人沟通、社群和门店活动", "跟进核销、转化、评价反馈和复购数据", "协助拍摄菜单、门店环境和活动素材"], requirements: ["熟悉本地生活平台优先", "文案表达清楚，执行细致", "懂门店实际，不做脱离经营的活动"] },
  part_time: { label: "兼职/小时工", level: "灵活用工", must: ["协助高峰期传菜、收台、打包、洗消或叫号", "按班次完成指定区域卫生和收尾", "服从当班负责人安排"], requirements: ["时间稳定，守时靠谱", "手脚麻利，愿意配合", "有餐饮兼职经验优先"] }
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
$("loadSiteSampleBtn").addEventListener("click", loadSiteSample);
$("copyRecruitmentBtn").addEventListener("click", copyRecruitmentContent);
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
document.querySelectorAll("[data-yield-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    yieldMode = button.dataset.yieldMode;
    document.querySelectorAll("[data-yield-mode]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.body.dataset.yieldMode = yieldMode;
    renderYieldCapacity();
  });
});
$("lossDate").valueAsDate = new Date();

document.body.dataset.marginMode = marginMode;
document.body.dataset.yieldMode = yieldMode;
applyLossStageTemplate();
updateCustomLossFields();
applyChannelTemplate();
loadYieldSample();

function recalculate() {
  renderMargin();
  renderHealth();
  renderSiteSelection();
  renderRecruitment();
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

function materialProfile(name) {
  const normalized = String(name || "").toLowerCase();
  return Object.values(defaultYieldProfiles).find((profile) => profile.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) || defaultYieldProfiles.other;
}

function defaultUsagePerPortion(name) {
  const profile = materialProfile(name);
  if (profile === defaultYieldProfiles.vegetable) return 0.08;
  if (profile === defaultYieldProfiles.fish) return 0.15;
  return 0.12;
}

function currentYieldMaterialInput({ allocateId = true } = {}) {
  const name = text("yieldMaterialName") || "未命名原料";
  const profile = materialProfile(name);
  const editableYield = yieldMode !== "quick" && num("yieldRateInput");
  const quickLoss = profile.loss_rate;
  const proLossLayers = {
    purchase_loss_rate: percentToRate(num("yieldPurchaseLoss")),
    processing_loss_rate: percentToRate(num("yieldProcessingLoss")),
    cooking_loss_rate: percentToRate(num("yieldCookingLoss"))
  };
  const standardLossLayers = { processing_loss_rate: quickLoss };
  const lossLayers = yieldMode === "pro" ? proLossLayers : standardLossLayers;
  return {
    id: allocateId ? yieldMaterialId++ : 0,
    type: "Material",
    material_name: name,
    name,
    category: profile.label,
    purchase_weight: num("yieldPurchaseWeight"),
    purchase_cost: num("yieldPurchaseCost"),
    yield_rate: editableYield ? percentToRate(editableYield) : profile.yield_rate,
    loss_rate: yieldMode === "pro" ? undefined : quickLoss,
    loss_layers: lossLayers,
    min_purchase_unit: yieldMode === "pro" ? num("yieldMinUnit") : 0,
    meta: {
      mode: yieldMode,
      default_profile: profile.label,
      default_yield_rate: profile.yield_rate
    }
  };
}

function addYieldMaterial() {
  const material = currentYieldMaterialInput();
  const name = material.material_name;
  const existingIndex = yieldMaterials.findIndex((item) => item.material_name === name);
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
  if (!yieldDraftIngredients.length && yieldMode !== "pro") {
    const material = yieldMaterials.find((item) => item.id === Number($("yieldIngredientMaterial").value)) || yieldMaterials[0] || currentYieldMaterialInput({ allocateId: false });
    const usageKg = num("yieldUsagePerPortion") / 1000 || defaultUsagePerPortion(material.material_name);
    yieldDraftIngredients.push({ material_name: material.material_name, material_id: material.id || material.material_name, usage_per_portion: usageKg });
  }
  if (!yieldDraftIngredients.length) return;
  const product = {
    id: yieldProductId++,
    type: "Product",
    product_name: productName,
    name: productName,
    selling_price: num("yieldSellingPrice") || 0,
    ingredients: yieldDraftIngredients.map((item) => ({ ...item })),
    meta: { mode: yieldMode }
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
  renderYieldModeHint();
  renderYieldMaterialOptions();
  renderYieldMaterialRows();
  renderYieldDraftRows();
  renderYieldProductRows();
  const payload = buildYieldPayload();
  const calculator = window.HugeToolsYield;
  const result = calculator?.calculateYieldCapacity ? calculator.calculateYieldCapacity(payload) : emptyYieldResult();
  renderYieldResult(result);
}

function renderYieldModeHint() {
  const hints = {
    quick: "快速模式只填原料名称、采购重量和采购金额，系统自动套用行业默认出成率与损耗率。",
    standard: "标准模式可编辑出成率，并输入单品每份用量和售价，用于快速判断产能与毛利。",
    pro: "专业模式支持多原料 BOM、最小采购单位和采购/加工/烹饪双层损耗模型。"
  };
  $("yieldModeHint").textContent = hints[yieldMode] || hints.quick;
}

function emptyYieldResult() {
  return {
    material_availability: [],
    products: [],
    results: [],
    summary: { material_count: 0, product_count: 0, total_theoretical_portions: 0, bottleneck_materials: [] }
  };
}

function buildYieldPayload() {
  const materialSource = yieldMaterials.length ? yieldMaterials : [currentYieldMaterialInput({ allocateId: false })];
  const productSource = yieldProducts.length ? yieldProducts : [buildAutoYieldProduct(materialSource)];
  return {
    schema_version: "decision-support.v1",
    mode: yieldMode,
    materials: materialSource.map(({ id, ...material }) => material),
    products: productSource.map(({ id, ...product }) => ({
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

function buildAutoYieldProduct(materials) {
  const primary = materials[0] || currentYieldMaterialInput({ allocateId: false });
  const usage = yieldMode === "quick" ? defaultUsagePerPortion(primary.material_name) : (num("yieldUsagePerPortion") / 1000 || defaultUsagePerPortion(primary.material_name));
  const productName = text("yieldProductName") || `${primary.material_name}单品`;
  return {
    id: 0,
    type: "Product",
    product_name: productName,
    name: productName,
    selling_price: yieldMode === "quick" ? 28 : num("yieldSellingPrice"),
    ingredients: [{ material_name: primary.material_name, material_id: primary.id || primary.material_name, usage_per_portion: usage }],
    meta: { mode: yieldMode, auto_generated: true }
  };
}

function renderYieldMaterialOptions() {
  $("yieldIngredientMaterial").innerHTML = yieldMaterials.length
    ? yieldMaterials.map((item) => `<option value="${item.id}">${safeText(item.material_name)}</option>`).join("")
    : `<option value="">暂无原料</option>`;
}

function renderYieldMaterialRows() {
  if (!yieldMaterials.length) {
    if (yieldMode === "quick" || yieldMode === "standard") {
      $("yieldMaterialRows").innerHTML = renderYieldMaterialRow(currentYieldMaterialInput({ allocateId: false }), true);
      return;
    }
    $("yieldMaterialRows").innerHTML = `<tr><td class="empty-table" colspan="6">暂无原料，请先录入采购重量、金额、出成率和损耗。</td></tr>`;
    return;
  }
  $("yieldMaterialRows").innerHTML = yieldMaterials.map((item) => renderYieldMaterialRow(item, false)).join("");
}

function renderYieldMaterialRow(item, transient) {
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
        <td>${safeText(item.purchase_weight)}kg / ${money(item.purchase_cost)}<br><small>${transient ? "当前输入" : `最小单位 ${safeText(item.min_purchase_unit || 0)}kg`}</small></td>
        <td>出成 ${rateToPercent(item.yield_rate)}%<br><small>${safeText(lossText)}</small></td>
        <td>${safeText(stats.net_weight || stats.effective_weight || 0)}kg<br><small>净料重量</small></td>
        <td>${money(stats.effective_unit_cost || 0)} / kg</td>
        <td>${transient ? "自动测算" : `<button class="text-button danger" type="button" data-delete-yield-material="${item.id}">删除</button>`}</td>
      </tr>
    `;
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

  const rows = result.results?.length ? result.results : result.products;
  $("yieldResultRows").innerHTML = rows.length
    ? rows.map((product) => {
      const utilization = product.material_utilization
        .map((item) => `${safeText(item.material_name)} ${rateToPercent(item.utilization_rate)}%`)
        .join("；");
      return `
        <tr>
          <td>${safeText(product.product_name)}</td>
          <td>${safeText(product.max_capacity ?? product.theoretical_max_portions)} 份<br><small>精确值 ${safeText(product.exact_capacity)}</small></td>
          <td>${(product.bottleneck_materials || []).map(safeText).join("、") || "暂无"}</td>
          <td>${money(product.unit_cost ?? product.unit_theoretical_cost)}</td>
          <td>${rateToPercent(product.gross_margin_rate || 0)}%</td>
          <td>${(product.recommendations || []).slice(0, 3).map((item) => `<p>${safeText(item)}</p>`).join("") || safeText(utilization || "暂无")}</td>
        </tr>
      `;
    }).join("")
    : `<tr><td class="empty-table" colspan="6">暂无产能结果，请先录入原料并保存菜品 BOM。</td></tr>`;

  renderYieldBottleneckMap(result);
  const advice = [];
  if (!result.products.length) advice.push("先录入至少一个原料和一个菜品 BOM，工具会自动按多原料瓶颈法计算产能。");
  if (tightest !== "暂无") advice.push(`当前最常见瓶颈原料是「${tightest}」，优先复核采购量、出成率、BOM 克重或替代菜品结构。`);
  if (Number.isFinite(lowestCapacity) && lowestCapacity <= 20 && result.products.length) advice.push(`最低菜品产能只有 ${lowestCapacity} 份，适合提前做限量售卖、补货或调整排产。`);
  advice.push("页面输入的每份用量 g 会自动换算参与计算，适合直接拿来做采购、备货和限量售卖判断。");
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

function buildSiteSelectionPayload() {
  return {
    schema_version: "site-selection.v1",
    mode: "standard",
    storeType: $("siteStoreType").value,
    cityTier: $("siteCityTier").value,
    candidate: {
      areaSqm: num("siteAreaSqm"),
      monthlyRent: num("siteMonthlyRent"),
      propertyFee: num("sitePropertyFee"),
      transferFee: num("siteTransferFee"),
      decorationCost: num("siteDecorationCost"),
      equipmentCost: num("siteEquipmentCost"),
      depositMonths: num("siteDepositMonths"),
      contractYears: num("siteContractYears"),
      rentFreeMonths: num("siteRentFreeMonths"),
      annualRentIncreaseRate: percentToRate(num("siteAnnualRentIncreaseRate"))
    },
    businessAssumption: {
      avgTicket: num("siteAvgTicket"),
      dailyOrders: num("siteDailyOrders"),
      grossMarginRate: percentToRate(num("siteGrossMarginRate")),
      businessDaysPerMonth: num("siteBusinessDays"),
      laborCost: num("siteLaborCost"),
      utilitiesCost: num("siteUtilitiesCost"),
      marketingCost: num("siteMarketingCost"),
      otherFixedCost: num("siteOtherFixedCost"),
      platformRate: percentToRate(num("sitePlatformRate")),
      variableCostPerOrder: num("siteVariableCostPerOrder")
    },
    siteCondition: {
      canApplyLicense: $("siteCanApplyLicense").checked,
      hasExhaust: $("siteHasExhaust").checked,
      hasGas: $("siteHasGas").checked,
      hasWaterDrainage: $("siteHasWaterDrainage").checked,
      powerCapacityKw: num("sitePowerCapacityKw"),
      visibilityScore: num("siteVisibilityScore"),
      trafficScore: num("siteTrafficScore"),
      targetCustomerScore: num("siteCustomerScore"),
      competitionScore: num("siteCompetitionScore"),
      deliveryConvenienceScore: num("siteDeliveryScore"),
      parkingScore: num("siteParkingScore"),
      floorScore: num("siteFloorScore"),
      brandFitScore: num("siteBrandFitScore")
    },
    competition: {
      sameCategoryCount: num("siteSameCategoryCount"),
      strongBrandCount: num("siteStrongBrandCount")
    },
    customNotes: text("siteCustomNotes"),
    options: {
      rentToSalesWarn: 0.1,
      rentToSalesBad: 0.15,
      paybackWarnMonths: 18,
      paybackBadMonths: 24
    }
  };
}

function renderSiteSelection() {
  const payload = buildSiteSelectionPayload();
  const calculator = window.HugeToolsSiteSelection;
  const result = calculator?.calculateSiteSelection ? calculator.calculateSiteSelection(payload) : emptySiteSelectionResult();
  const finalScore = result.scores.final_score || 0;
  const scoreLevel = result.verdict.level === "blocker" || finalScore < 40 ? "bad" : finalScore >= 70 ? "good" : "warn";
  const rentLevel = result.financials.rent_to_sales_rate <= 0.1 ? "good" : result.financials.rent_to_sales_rate <= 0.15 ? "warn" : "bad";
  const profitLevel = result.financials.monthly_net_profit > 0 ? "good" : "bad";
  const paybackLevel = result.financials.payback_months == null ? "bad" : result.financials.payback_months <= 18 ? "good" : result.financials.payback_months <= 24 ? "warn" : "bad";

  $("siteResult").innerHTML = [
    metric("选址结论", safeText(result.verdict.label), scoreLevel),
    metric("综合评分", `${finalScore.toFixed(1)} 分`, scoreLevel),
    metric("租售比", `${rateToPercent(result.financials.rent_to_sales_rate)}%`, rentLevel),
    metric("月净利润", money(result.financials.monthly_net_profit), profitLevel),
    metric("保本日订单", `${result.financials.break_even_daily_orders || 0} 单`, result.financials.break_even_daily_orders <= payload.businessAssumption.dailyOrders * 0.8 ? "good" : "warn"),
    metric("回本周期", result.financials.payback_months == null ? "无法回本" : `${result.financials.payback_months} 月`, paybackLevel),
    metric("合理租金上限", money(result.financials.affordable_monthly_rent), result.financials.affordable_monthly_rent >= payload.candidate.monthlyRent ? "good" : "warn"),
    metric("一次性投入", money(result.financials.initial_investment), result.financials.initial_investment <= result.financials.monthly_revenue * 2 ? "good" : "warn")
  ].join("");

  $("siteScoreBars").innerHTML = result.scores.dimensions.map((item) => `
    <div class="structure-row ${item.rate < 0.55 ? "bottleneck-row" : ""}">
      <span>${safeText(item.label)}</span>
      <div class="structure-track"><div class="structure-fill" style="width: ${Math.min(item.rate * 100, 100)}%"></div></div>
      <strong>${item.score} / ${item.max}</strong>
    </div>
  `).join("");

  const riskBlocks = [];
  riskBlocks.push(`<p><strong>${safeText(result.verdict.label)}：</strong>${safeText(result.verdict.summary)}</p>`);
  if (result.risks.redFlags.length) {
    riskBlocks.push(`<p><strong>红线：</strong>${result.risks.redFlags.map(safeText).join("；")}</p>`);
  }
  if (result.risks.warnings.length) {
    riskBlocks.push(`<p><strong>风险：</strong>${result.risks.warnings.map(safeText).join("；")}</p>`);
  }
  riskBlocks.push(`<p><strong>建议：</strong>${result.recommendations.map(safeText).join("；")}</p>`);
  riskBlocks.push(`<p><strong>谈判清单：</strong>${result.negotiation_points.map(safeText).join("；")}</p>`);
  $("siteRiskAdvice").innerHTML = riskBlocks.join("");
}

function emptySiteSelectionResult() {
  return {
    financials: {
      monthly_revenue: 0,
      monthly_rent_cost: 0,
      rent_to_sales_rate: 0,
      monthly_net_profit: 0,
      initial_investment: 0,
      break_even_daily_orders: 0,
      payback_months: null,
      affordable_monthly_rent: 0
    },
    scores: { base_score: 0, risk_penalty: 0, final_score: 0, dimensions: [] },
    risks: { redFlags: ["选址评估计算模块未加载。"], warnings: [] },
    verdict: { level: "blocker", label: "暂不可用", summary: "页面脚本未完成加载，请刷新后重试。" },
    recommendations: ["刷新页面后重新计算。"],
    negotiation_points: []
  };
}

function loadSiteSample() {
  const values = {
    siteStoreType: "hotpot",
    siteCityTier: "new_first_tier",
    siteAreaSqm: 180,
    siteMonthlyRent: 38000,
    sitePropertyFee: 2800,
    siteTransferFee: 120000,
    siteDecorationCost: 320000,
    siteEquipmentCost: 110000,
    siteDepositMonths: 2,
    siteContractYears: 5,
    siteRentFreeMonths: 2,
    siteAnnualRentIncreaseRate: 5,
    siteAvgTicket: 88,
    siteDailyOrders: 170,
    siteGrossMarginRate: 62,
    siteBusinessDays: 30,
    siteLaborCost: 62000,
    siteUtilitiesCost: 14000,
    siteMarketingCost: 12000,
    siteOtherFixedCost: 7000,
    sitePlatformRate: 3,
    siteVariableCostPerOrder: 1.8,
    sitePowerCapacityKw: 90,
    siteVisibilityScore: 4,
    siteTrafficScore: 4,
    siteCustomerScore: 4,
    siteCompetitionScore: 3,
    siteSameCategoryCount: 8,
    siteStrongBrandCount: 2,
    siteDeliveryScore: 4,
    siteParkingScore: 3,
    siteFloorScore: 4,
    siteBrandFitScore: 4,
    siteCustomNotes: "社区和办公混合商圈，晚高峰强，午市一般，需二次确认排烟管道产权。"
  };
  Object.entries(values).forEach(([id, value]) => {
    $(id).value = value;
  });
  ["siteCanApplyLicense", "siteHasExhaust", "siteHasGas", "siteHasWaterDrainage"].forEach((id) => {
    $(id).checked = true;
  });
  renderSiteSelection();
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

function renderRecruitment() {
  const result = buildRecruitmentContent();
  $("recruitmentSummary").innerHTML = [
    metric("餐饮类目", safeText(result.category.label), "good"),
    metric("招聘职级", safeText(result.rank.label), "good"),
    metric("发布形式", safeText(result.formatLabel), "warn"),
    metric("招募重点", safeText(result.primaryHook), "good")
  ].join("");
  $("recruitmentTips").innerHTML = result.tips.map((item) => `<p>${safeText(item)}</p>`).join("");
  $("recruitmentPreview").innerHTML = `
    <div class="recruitment-card-head">
      <span>${safeText(result.category.label)}</span>
      <strong>${safeText(result.title)}</strong>
      <em>${safeText(result.salary)}</em>
    </div>
    <div class="chips">${result.hookChips.map((item) => `<span class="chip">${safeText(item)}</span>`).join("")}</div>
    <dl class="recruitment-facts">
      <div><dt>地点</dt><dd>${safeText(result.location)}</dd></div>
      <div><dt>人数</dt><dd>${safeText(result.count)}</dd></div>
      <div><dt>时间</dt><dd>${safeText(result.schedule)}</dd></div>
      <div><dt>联系</dt><dd>${safeText(result.contact)} ${safeText(result.phone)}</dd></div>
    </dl>
    <div class="recruitment-columns">
      <div>
        <h3>岗位职责</h3>
        <ul>${result.duties.slice(0, 4).map((item) => `<li>${safeText(item)}</li>`).join("")}</ul>
      </div>
      <div>
        <h3>任职要求</h3>
        <ul>${result.requirements.slice(0, 4).map((item) => `<li>${safeText(item)}</li>`).join("")}</ul>
      </div>
    </div>
  `;
  $("recruitmentDraft").value = result.draft;
}

function buildRecruitmentContent() {
  const category = recruitmentCategoryProfiles[$("recruitCategory").value] || recruitmentCategoryProfiles.fast_food;
  const rank = recruitmentRankProfiles[$("recruitRank").value] || recruitmentRankProfiles.server;
  const company = text("recruitCompany") || "本店";
  const location = text("recruitLocation") || "门店附近";
  const count = text("recruitCount") || "若干";
  const salary = text("recruitSalary") || "面议";
  const schedule = text("recruitSchedule") || "按门店班次安排";
  const benefits = splitList(text("recruitBenefits") || "包吃,绩效奖金,晋升培训");
  const highlights = splitList(text("recruitHighlights") || "团队稳定,流程清楚");
  const contact = text("recruitContact") || "负责人";
  const phone = text("recruitPhone") || "到店咨询";
  const format = $("recruitFormat").value;
  const formatLabel = { poster: "门店海报", moments: "朋友圈/社群", platform: "招聘平台" }[format] || "门店海报";
  const title = makeRecruitmentTitle({ company, category, rank, format });
  const duties = uniqueList([
    ...rank.must,
    ...category.skills.slice(0, 2),
    `适应${category.pace}，按门店标准完成当班工作`
  ]).slice(0, 5);
  const requirements = uniqueList([
    ...rank.requirements,
    "身体健康，守时靠谱，服从门店排班",
    "认同食品安全、卫生清洁和顾客体验要求"
  ]).slice(0, 5);
  const hookChips = uniqueList([...category.hooks, ...benefits, ...highlights]).slice(0, 8);
  const primaryHook = hookChips[0] || "岗位清楚";
  const tips = [
    "公开招聘平台和餐厅招聘海报的共性结构已内置：岗位、职责、要求、薪资、时间、人数、地点、福利和联系方式。",
    `${rank.label}文案会突出${rank.level}的核心判断点；${category.label}会强化${category.pace}和类目技能。`,
    "发布前建议补齐真实手机号、详细地址、休息制度和社保/住宿等硬信息，避免只写“待遇从优”。"
  ];
  const data = { company, category, rank, location, count, salary, schedule, benefits, highlights, contact, phone, title, duties, requirements, hookChips };
  const draft = format === "moments"
    ? recruitmentMomentsDraft(data)
    : format === "platform"
      ? recruitmentPlatformDraft(data)
      : recruitmentPosterDraft(data);
  return {
    ...data,
    formatLabel,
    primaryHook,
    tips,
    draft
  };
}

function makeRecruitmentTitle({ company, category, rank, format }) {
  if (format === "moments") return `${company}招${rank.label}`;
  if (format === "platform") return `${category.label}${rank.label}招聘`;
  return `急招 ${rank.label}`;
}

function recruitmentPosterDraft(data) {
  return [
    `${data.company} 招人`,
    "",
    `${data.title}`,
    `招聘人数：${data.count}`,
    `薪资待遇：${data.salary}`,
    `工作地点：${data.location}`,
    `工作时间：${data.schedule}`,
    "",
    "岗位职责：",
    ...numberedLines(data.duties),
    "",
    "任职要求：",
    ...numberedLines(data.requirements),
    "",
    `福利亮点：${uniqueList([...data.benefits, ...data.highlights]).join("、")}`,
    `联系电话：${data.contact} ${data.phone}`
  ].join("\n");
}

function recruitmentMomentsDraft(data) {
  return [
    `${data.company}现在招${data.rank.label}，${data.location}附近方便的朋友可以看一下。`,
    "",
    `岗位：${data.rank.label}，招${data.count}`,
    `薪资：${data.salary}`,
    `时间：${data.schedule}`,
    `福利：${data.benefits.join("、")}`,
    "",
    `我们是${data.category.label}门店，${data.category.pace}，希望你做事靠谱、手脚麻利、愿意按标准把服务和出品做好。`,
    `主要工作：${data.duties.slice(0, 3).join("；")}。`,
    "",
    `门店亮点：${data.highlights.join("、")}`,
    `联系：${data.contact} ${data.phone}`,
    "也欢迎转给正在找餐饮工作的朋友。"
  ].join("\n");
}

function recruitmentPlatformDraft(data) {
  return [
    `职位名称：${data.title}`,
    `公司/门店：${data.company}`,
    `工作地点：${data.location}`,
    `招聘人数：${data.count}`,
    `薪资范围：${data.salary}`,
    `工作时间：${data.schedule}`,
    "",
    "岗位职责：",
    ...numberedLines(data.duties),
    "",
    "任职要求：",
    ...numberedLines(data.requirements),
    "",
    "福利待遇：",
    ...numberedLines(uniqueList([...data.benefits, ...data.highlights]).slice(0, 6)),
    "",
    `联系方式：${data.contact} ${data.phone}`
  ].join("\n");
}

function numberedLines(items) {
  return items.map((item, index) => `${index + 1}. ${item}`);
}

async function copyRecruitmentContent() {
  const content = $("recruitmentDraft").value;
  const copied = await copyText(content);
  if (!copied) {
    $("recruitmentDraft").focus();
    $("recruitmentDraft").select();
  }
  $("copyRecruitmentBtn").textContent = copied ? "已复制" : "已选中文案";
  setTimeout(() => $("copyRecruitmentBtn").textContent = "复制招募文案", 1200);
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

const xhsTemplateLibrary = [
  {
    id: "localGuide",
    name: "地域搜索攻略",
    match: /(本地|附近|商圈|地铁|攻略|推荐|怎么选|路线|停车|周末|旅游|旅行)/,
    titlePattern: ({ city, category, keyword, point }) => `${city}${keyword}｜${category}怎么选先看这家`,
    body: ({ city, category, keyword, point, points, audience, address, hotspot }) => [
      `${city}${keyword}这组词，建议开头就写清楚：地点、品类、适合谁。今天这家${category}放在${address}场景里看，主打${point}。`,
      `为什么值得放进清单：${sentenceList(points, ["位置好找", "价格清楚", "出品稳定"])}。如果是${audience[0] || "附近吃饭人群"}临时决策，重点看动线、等位、份量和人均。`,
      `我的建议点法：第一次来先点招牌，再补一个低风险小吃或饮品；如果多人来，按“主菜+主食+解腻”组合更稳。`,
      `拍摄和发布时把「${hotspot.name}」放进前 3 行，结尾补一句：你还想看${city}哪一片的${category}清单？`
    ],
    tags: ["#附近美食", "#本地美食", "#吃饭攻略", "#美食清单"],
    photo: ({ city, category, point, address }) => [`首图拍门头+街景，画面里带出${address}。`, `第二张拍${category}招牌近景，让${point}有证据。`, "第三张拍菜单价格或桌面全景，适合做攻略收藏。"],
    cover: ({ city, category }) => `${city}${category}吃饭攻略`
  },
  {
    id: "valueList",
    name: "高性价比清单",
    match: /(性价比|便宜|划算|人均|套餐|学生|打工人|午餐|价格|省钱|预算)/,
    titlePattern: ({ city, category, priceWord }) => `${city}${priceWord}吃${category}，这份清单先收藏`,
    body: ({ city, category, point, points, audience, priceWord }) => [
      `如果你在${city}找${priceWord}的${category}，这篇就按“吃饱、好点、不容易踩雷”来写。`,
      `我会优先把${point}讲清楚：份量是不是够、套餐怎么点、哪些菜适合${audience.join("、") || "日常吃饭"}。`,
      `亮点拆开看：${sentenceList(points, ["出餐快", "价格透明", "主食和小吃搭配稳"])}。不建议只写“便宜”，要写清楚便宜在哪里。`,
      "结尾互动：你们更想看人均 30、50 还是 80 的版本？我按评论继续整理。"
    ],
    tags: ["#高性价比美食", "#人均消费", "#打工人午餐", "#省钱吃饭"],
    photo: ({ category }) => ["首图拍完整套餐或桌面全景，体现份量。", "补一张菜单/小票/价格牌，增强信任。", `拍${category}入口质感，避免只拍包装。`],
    cover: ({ city, priceWord }) => `${city}${priceWord}吃饭`
  },
  {
    id: "realVisit",
    name: "真实探店体验",
    match: /(探店|真实|体验|打卡|环境|服务|排队|第一次|朋友|聚餐)/,
    titlePattern: ({ city, category, point }) => `${city}探店｜这家${category}${point}是真的明显`,
    body: ({ category, point, points, audience, address }) => [
      `这篇按真实探店来写，不写空泛夸奖，直接记录到店后的几个感受。`,
      `到店场景：${address}，适合${audience.join("、") || "朋友小聚"}。第一眼先看环境和出餐节奏，再看${category}本身是否稳定。`,
      `我会重点写三件事：${sentenceList(points, [point, "服务动线", "真实份量"])}。如果有排队或等位，也要如实写等待时间。`,
      "最后用一句真实总结收尾：适合谁来、什么时间来、第一次点什么，不要编造不存在的体验。"
    ],
    tags: ["#真实探店", "#美食探店", "#打卡餐厅", "#用餐体验"],
    photo: ({ address }) => [`首图拍到店第一视角，能看出${address}。`, "拍环境、菜单、上菜顺序和吃到一半的真实状态。", "保留一张桌面全景，增强“真的来过”的感觉。"],
    cover: ({ category }) => `${category}真实探店`
  },
  {
    id: "officeMeal",
    name: "上班族工作餐",
    match: /(上班|打工人|午餐|工作餐|写字楼|快餐|出餐快|外卖|附近)/,
    titlePattern: ({ city, category }) => `${city}打工人午餐｜这家${category}适合工作日`,
    body: ({ city, category, point, points, audience, address }) => [
      `${city}工作日吃饭，最怕慢、贵、吃完犯困。所以这篇按${audience[0] || "上班族"}的午餐需求来写。`,
      `这家${category}在${address}，核心卖点是${point}。如果午休时间短，要优先写出餐速度、动线和是否方便打包。`,
      `内容结构：第一段写“为什么适合工作日”，第二段写点单建议，第三段写${sentenceList(points, ["份量", "价格", "口味负担"])}。`,
      "结尾可以问：你们午餐更在意出餐快、吃得饱，还是下午不困？"
    ],
    tags: ["#打工人午餐", "#工作餐", "#写字楼美食", "#午餐吃什么"],
    photo: () => ["首图拍一人份套餐，桌面干净，突出工作餐效率。", "拍打包、取餐口或出餐动线。", "拍吃完后的空盘/剩余状态，说明份量是否真实。"],
    cover: ({ city }) => `${city}打工人午餐`
  },
  {
    id: "nightSnack",
    name: "夜宵氛围",
    match: /(夜宵|晚餐|烧烤|烤肉|火锅|啤酒|下班|深夜|朋友|宵夜)/,
    titlePattern: ({ city, category, point }) => `${city}夜宵局｜${point}的${category}太适合下班后`,
    body: ({ city, category, point, points, audience, address }) => [
      `${city}夜宵内容要先写氛围，再写味道。这家${category}适合${audience.join("、") || "下班后朋友局"}，位置在${address}。`,
      `开头直接抛场景：忙完一天想吃点热的/重口的/能聊天的，${point}就是这篇的主线。`,
      `正文用“环境灯光、上菜节奏、必点组合、适合几个人”四段写，卖点落到：${sentenceList(points, [point, "热乎", "适合聊天"])}。`,
      "结尾问一句：夜宵你们更爱火锅、烧烤还是粉面？"
    ],
    tags: ["#夜宵吃什么", "#下班吃什么", "#朋友聚餐", "#城市夜生活"],
    photo: () => ["首图用暖光，拍热气、烟火感和桌面氛围。", "拍夹菜、倒汤、烤制等动态瞬间。", "补门头夜景，证明夜宵营业氛围。"],
    cover: ({ city, category }) => `${city}夜宵${category}`
  },
  {
    id: "dateGathering",
    name: "约会聚餐",
    match: /(约会|情侣|朋友|聚餐|生日|闺蜜|环境|仪式感|拍照|出片)/,
    titlePattern: ({ city, category }) => `${city}聚餐约会｜这家${category}环境和菜都稳`,
    body: ({ category, point, points, audience, address }) => [
      `这篇适合写给准备约会或朋友聚餐的人，重点不是“好吃”两个字，而是能不能坐得舒服、点得稳、拍得好看。`,
      `地点在${address}，${category}的主要卖点是${point}。适合${audience.join("、") || "朋友聚餐、情侣约会"}。`,
      `推荐从环境、桌距、招牌菜、拍照角度四个部分写。菜品亮点可以放：${sentenceList(points, [point, "摆盘好看", "多人分享方便"])}。`,
      "结尾给明确建议：几个人来、预算大概怎么控、第一次点哪几个菜。"
    ],
    tags: ["#约会餐厅", "#朋友聚餐", "#出片餐厅", "#生日聚餐"],
    photo: () => ["首图拍桌面+环境，留出文字区。", "拍两人或多人分享视角，不要只拍单盘菜。", "补一张门店角落/灯光/座位，突出适合拍照。"],
    cover: ({ category }) => `适合聚餐的${category}`
  },
  {
    id: "familyKids",
    name: "亲子家庭",
    match: /(亲子|带娃|家庭|老人|孩子|周末|不辣|停车|包间|儿童)/,
    titlePattern: ({ city, category }) => `${city}带娃吃饭｜这家${category}对家庭挺友好`,
    body: ({ category, point, points, audience, address }) => [
      `亲子家庭内容要写“省心”，不要只写口味。这家${category}在${address}，适合${audience.join("、") || "带娃家庭、周末聚餐"}。`,
      `重点信息：有没有不辣/清淡选择、座位是否舒服、上菜是否快、停车或动线是否方便。`,
      `卖点可以这样落：${sentenceList(points, [point, "选择多", "孩子老人都能点"])}。`,
      "结尾提醒：高峰期是否建议提前到、哪些菜更适合孩子、是否需要避开排队。"
    ],
    tags: ["#亲子餐厅", "#带娃吃饭", "#周末去哪吃", "#家庭聚餐"],
    photo: () => ["首图拍桌面全景，体现家庭可共享。", "拍清淡/不辣/儿童友好选项。", "拍座位、通道、停车或包间信息，帮助家长决策。"],
    cover: ({ city }) => `${city}带娃吃饭`
  },
  {
    id: "healthyLight",
    name: "健康轻负担",
    match: /(健康|低脂|低糖|轻食|清爽|不腻|真材实料|新鲜|配料|减脂|养生)/,
    titlePattern: ({ city, category, point }) => `${city}轻负担吃饭｜${point}的${category}`,
    body: ({ category, point, points, audience }) => [
      `轻负担内容不能写功效，要写“吃起来的负担感”和“配料是否清楚”。这篇围绕${category}的${point}展开。`,
      `适合${audience.join("、") || "想吃清爽一点的人"}，重点讲配料、油感、甜度/辣度、份量和饱腹感。`,
      `正文结构：先说为什么想吃轻一点，再写真实口感，最后写适合/不适合谁。卖点：${sentenceList(points, [point, "清爽不腻", "配料看得见"])}。`,
      "结尾避免“减肥必吃”等夸张承诺，改成“想吃清爽一点可以参考”。"
    ],
    tags: ["#轻负担美食", "#真材实料", "#清爽不腻", "#健康吃饭"],
    photo: () => ["首图拍食材和颜色，避免重滤镜。", "拍配料、汤底、称重或菜单标识。", "用自然光，画面干净，突出清爽。"],
    cover: ({ category }) => `轻负担${category}`
  },
  {
    id: "newProduct",
    name: "新品听劝互动",
    match: /(新品|上新|听劝|评论|投票|隐藏|菜单|试吃|限定|联名)/,
    titlePattern: ({ category, point }) => `听劝试了${category}新品，${point}这一点挺明显`,
    body: ({ category, point, points, audience }) => [
      `这篇按互动型新品来写，开头要说明：为什么试、谁推荐、想验证什么。`,
      `新品是${category}方向，核心感受先落到${point}。适合${audience.join("、") || "喜欢尝鲜的人"}。`,
      `正文不要只夸，按“第一口感受、适合口味、价格份量、还想怎么改”写。可展开：${sentenceList(points, [point, "新鲜感", "是否值得复点"])}。`,
      "结尾设置投票：下次想看隐藏吃法、价格明细还是老板改菜单？"
    ],
    tags: ["#听劝", "#新品试吃", "#隐藏菜单", "#评论区告诉我"],
    photo: () => ["首图拍新品最有辨识度的细节。", "拍试吃前后对比，留一个可投票的问题。", "拍菜单或新品标识，避免看不出是新品。"],
    cover: ({ category }) => `听劝试${category}`
  },
  {
    id: "avoidPit",
    name: "避坑对比测评",
    match: /(避坑|踩雷|测评|对比|不推荐|推荐|真实|价格|份量|怎么点)/,
    titlePattern: ({ city, category }) => `${city}${category}怎么点不踩雷？真实测完这样选`,
    body: ({ category, point, points, address }) => [
      `避坑类内容要克制，写事实，不做攻击。这篇围绕${address}这家${category}的点单选择来写。`,
      `先讲结论：什么值得点、什么看个人口味、什么不建议第一次点。核心判断来自${point}。`,
      `对比维度：价格、份量、出餐、口味稳定、适合人数。已知卖点：${sentenceList(points, [point, "份量清楚", "点单风险低"])}。`,
      "结尾写清楚“我的口味仅供参考”，并邀请大家补充真实点单经验。"
    ],
    tags: ["#避坑指南", "#真实测评", "#点单攻略", "#不踩雷"],
    photo: () => ["首图拍多道菜对比，标出推荐顺序。", "拍份量参照物和菜单价格。", "拍不夸张的真实状态，不用过度美化。"],
    cover: ({ category }) => `${category}点单避坑`
  }
];

recalculate();

function renderXiaohongshu() {
  const category = text("xhsCategory") || "招牌菜";
  const city = text("xhsCity") || "本地";
  const keywords = splitList(text("xhsKeywords"));
  const points = splitList(text("xhsSellingPoints"));
  const audience = splitList(text("xhsAudience"));
  const style = $("xhsStyle").value;
  const address = text("xhsAddress") || "门店附近";
  const template = chooseXhsTemplate({ category, city, keywords, points, audience, style, address });
  const hotspots = xhsHotspotsFor({ category, city, keywords, points, audience, style });
  const primaryHotspot = hotspots[0];
  const keywordLine = keywords.length ? keywords.join("、") : `${city}${category}`;
  const point = points[0] || primaryHotspot.phrase || "出品稳定";
  const priceWord = keywords.find((item) => /(人均|价格|便宜|划算|性价比|套餐|预算)/.test(item)) || "高性价比";
  const templateData = {
    category,
    city,
    keywords,
    keyword: keywords[0] || primaryHotspot.searchHook || category,
    keywordLine,
    points,
    point,
    audience,
    style,
    address,
    hotspot: primaryHotspot,
    priceWord
  };
  const titles = [
    template.titlePattern(templateData),
    `${city}${category}｜${primaryHotspot.titleHook}`,
    `${keywordLine}怎么选？${template.name}版先记好`,
    `${audience[0] || "附近打工人"}会关心的${category}真实信息`,
    `${style}｜${point}的${category}，适合${audience[0] || "日常吃饭"}`
  ];
  const body = template.body(templateData).join("\n\n");
  const tags = uniqueList([
    `#${city}美食`,
    `#${category}`,
    ...keywords.map((item) => `#${item.replace(/\s+/g, "")}`),
    ...template.tags,
    ...hotspots.flatMap((item) => item.tags),
    "#餐饮种草",
    "#今天吃什么",
    "#本地生活",
    "#餐饮老板",
    "#开店日常"
  ]).slice(0, 14);

  $("xhsHotspots").innerHTML = [
    `<p><strong>当前模板：</strong>${safeText(template.name)}。${safeText(templateGuide(template.id))}</p>`,
    `<p><strong>10 套备选：</strong>${xhsTemplateLibrary.map((item) => item.id === template.id ? `【${item.name}】` : item.name).join(" / ")}</p>`,
    ...hotspots.map((item) => `<p><strong>${safeText(item.name)}：</strong>${safeText(item.summary)}</p>`),
    `<p><a href="${xhsSearchUrl(keywordLine)}" target="_blank" rel="noopener">打开公开内容搜索：${safeText(keywordLine)}</a> <small>用于人工复核公开热词，不抓取或照搬平台原文。</small></p>`
  ].join("");
  $("xhsTitles").innerHTML = uniqueList(titles).map((item) => `<span class="chip">${safeText(item)}</span>`).join("");
  $("xhsBody").value = body;
  $("xhsTags").innerHTML = tags.map((item) => `<span class="chip">${safeText(item)}</span>`).join("");
  renderXhsPhotoAdvice({ template, templateData, primaryHotspot });
}

function chooseXhsTemplate(data) {
  const selected = $("xhsTemplate")?.value || "auto";
  if (selected !== "auto") return xhsTemplateLibrary.find((item) => item.id === selected) || xhsTemplateLibrary[0];
  const combined = [data.category, data.city, ...data.keywords, ...data.points, ...data.audience, data.style, data.address].join(" ");
  return xhsTemplateLibrary.find((item) => item.match.test(combined)) || xhsTemplateLibrary[2];
}

function templateGuide(id) {
  const guides = {
    localGuide: "适合搜索流量，先把城市、商圈、品类和决策问题讲清楚。",
    valueList: "适合套餐、人均、午餐和打工人场景，重点写价格和份量证据。",
    realVisit: "适合探店记录，按到店顺序写真实体验。",
    officeMeal: "适合写字楼、午餐和外卖高频消费，重点看效率。",
    nightSnack: "适合夜宵、烧烤、火锅和晚间聚会，重点写氛围。",
    dateGathering: "适合约会、生日、朋友聚餐，重点写环境和组合。",
    familyKids: "适合亲子家庭，重点写省心、不辣、停车和座位。",
    healthyLight: "适合轻食、茶饮、低负担内容，避免功效化承诺。",
    newProduct: "适合新品、听劝、投票互动，结尾要留问题。",
    avoidPit: "适合测评和点单攻略，写事实，不攻击。"
  };
  return guides[id] || guides.realVisit;
}

function renderXhsPhotoAdvice({ template, templateData, primaryHotspot }) {
  const photoLines = template.photo(templateData);
  const coverLine = template.cover(templateData);
  const keywordLine = templateData.keywordLine;
  $("xhsVisual").innerHTML = [
    `<p><strong>首图文字：</strong>${safeText(coverLine)}。文字不要超过 12 个字，优先放地域词、品类和场景。</p>`,
    `<p><strong>拍摄主线：</strong>${safeText(primaryHotspot.photoBrief)} 当前模板要补充：${safeText(photoLines[0])}</p>`,
    `<p><strong>必拍镜头：</strong>${photoLines.map(safeText).join("；")}</p>`,
    `<p><strong>构图顺序：</strong>1 张首图抓点击，2-3 张证明${safeText(templateData.point)}，1 张菜单/价格/地址，1 张真实用餐状态。</p>`,
    `<p><strong>搜索配合：</strong>图片角标和正文前 3 行都要出现「${safeText(keywordLine)}」里的核心词，但不要复制他人标题正文。</p>`
  ].join("");
}

function sentenceList(items, fallback) {
  return uniqueList((items && items.length ? items : fallback).filter(Boolean)).slice(0, 4).join("、");
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
      summary: "公开内容平台里的种草内容更适合写真实生活片段，而不是硬广。",
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
  setTimeout(() => $("copyPostBtn").textContent = "复制种草文案", 1200);
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
  const modeLabel = mode === "merchantReply" ? "商家回复" : "真实体验评价";
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
