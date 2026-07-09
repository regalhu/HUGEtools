const cents = (value) => Math.round((Number(value) || 0) * 100) / 100;
const money = (value) => `¥${cents(value).toFixed(2)}`;
const percentText = (value) => `${(Number(value) || 0).toFixed(1)}%`;

function splitList(value) {
  return String(value || "")
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function levelByRate(rate, floor) {
  if (rate >= floor) return "good";
  if (rate >= floor - 10) return "warn";
  return "bad";
}

function calculateMargin(input) {
  const price = Math.max(Number(input.price) || 0, 0);
  const directCost = cents((Number(input.mainCost) || 0) + (Number(input.sideCost) || 0) + (Number(input.packCost) || 0));
  const seasoningCost = cents(Number(input.seasoningCost) || 0);
  const materialCost = cents(directCost + seasoningCost);
  const materialProfit = cents(price - materialCost);
  const materialRate = price ? materialProfit / price * 100 : 0;
  const discountedRevenue = cents(price - price * (Number(input.discountRate) || 0) / 100);
  const commission = cents(discountedRevenue * (Number(input.platformRate) || 0) / 100);
  const channelCost = cents(
    commission +
    (Number(input.fulfillmentFee) || 0) +
    (Number(input.activityCost) || 0) +
    (Number(input.promotionCost) || 0)
  );
  const channelProfit = cents(discountedRevenue - channelCost - materialCost);
  const channelRate = price ? channelProfit / price * 100 : 0;
  const fullProfit = cents(channelProfit - (Number(input.overheadCost) || 0));
  const fullRate = price ? fullProfit / price * 100 : 0;
  const floor = Number(input.floor) || 55;
  return {
    materialCost,
    materialProfit,
    materialRate,
    channelCost,
    channelProfit,
    channelRate,
    fullProfit,
    fullRate,
    cards: [
      { label: "直接原料成本", value: money(materialCost), level: levelByRate(materialRate, floor) },
      { label: "标准材料毛利", value: `${money(materialProfit)} / ${percentText(materialRate)}`, level: levelByRate(materialRate, floor) },
      { label: "渠道到手毛利", value: `${money(channelProfit)} / ${percentText(channelRate)}`, level: levelByRate(channelRate, floor) },
      { label: "完全成本毛利", value: `${money(fullProfit)} / ${percentText(fullRate)}`, level: levelByRate(fullRate, floor) }
    ],
    advice: marginAdvice(input.name, materialRate, channelProfit, floor)
  };
}

function marginAdvice(name, materialRate, channelProfit, floor) {
  const advice = [];
  if (materialRate < floor) advice.push(`标准材料毛利率低于 ${floor}%，建议先复核采购价、净料率或售价。`);
  if (channelProfit < 0) advice.push("渠道到手利润为负，优先检查平台扣点、配送、活动和推广费用。");
  if (!advice.length) advice.push(`${name || "这道菜"}的成本结构暂时健康，可以继续记录为本期成本卡。`);
  return advice;
}

function calculateCombo(input) {
  const itemProfitTotal = cents(
    (Number(input.itemProfit1) || 0) +
    (Number(input.itemProfit2) || 0) +
    (Number(input.itemProfit3) || 0) +
    (Number(input.itemProfit4) || 0)
  );
  const extraCost = cents((Number(input.extraPackCost) || 0) + (Number(input.giftCost) || 0));
  const profit = cents(itemProfitTotal - extraCost);
  const price = Number(input.price) || 0;
  const rate = price ? profit / price * 100 : 0;
  return {
    itemProfitTotal,
    extraCost,
    profit,
    rate,
    cards: [
      { label: "单品毛利合计", value: money(itemProfitTotal), level: "good" },
      { label: "额外成本合计", value: money(extraCost), level: extraCost > 5 ? "warn" : "good" },
      { label: "套餐毛利", value: `${money(profit)} / ${percentText(rate)}`, level: rate >= 35 ? "good" : rate >= 20 ? "warn" : "bad" },
      { label: "套餐售价", value: money(price), level: profit >= 0 ? "good" : "bad" }
    ],
    advice: [profit < 0 ? "当前套餐扣除额外成本后为亏损，优先减少赠品成本或调整单品组合。" : "当前套餐毛利为正，适合继续压测折扣和组合结构。"]
  };
}

function calculateGift(input) {
  const price = Number(input.price) || 0;
  const cost = cents((Number(input.baseCost) || 0) + (Number(input.packCost) || 0) + (Number(input.otherCost) || 0));
  const profit = cents(price - cost);
  const rate = price ? profit / price * 100 : 0;
  return {
    cost,
    profit,
    rate,
    cards: [
      { label: "礼品总成本", value: money(cost), level: cost > price ? "bad" : "good" },
      { label: "礼品毛利", value: `${money(profit)} / ${percentText(rate)}`, level: profit >= 5 ? "good" : profit >= 0 ? "warn" : "bad" },
      { label: "礼品售价", value: money(price), level: "good" },
      { label: "建议", value: profit >= 0 ? "可销售" : "需调价", level: profit >= 0 ? "good" : "bad" }
    ],
    advice: [profit < 0 ? "当前礼品为亏损，建议提高售价、降低采购成本，或只作为营销赠品。" : "当前礼品毛利为正，可结合套餐或加价购场景测试。"]
  };
}

function calculateDeal(input) {
  const price = Number(input.price) || 0;
  const soldCount = Number(input.soldCount) || 0;
  const refundCount = Math.round(soldCount * (Number(input.refundRate) || 0) / 100);
  const paidCount = Math.max(soldCount - refundCount, 0);
  const expectedBreakageCount = Math.round(paidCount * (Number(input.breakageRate) || 0) / 100);
  const checkedCount = Math.min(Number(input.checkedCount) || 0, Math.max(paidCount - expectedBreakageCount, 0));
  const directCost = cents((Number(input.foodCost) || 0) + (Number(input.packCost) || 0) + (Number(input.laborCost) || 0) + (Number(input.otherCost) || 0));
  const unitFees = cents(
    price * (Number(input.platformRate) || 0) / 100 +
    price * (Number(input.creatorRate) || 0) / 100 +
    price * (Number(input.paymentRate) || 0) / 100 +
    (Number(input.subsidy) || 0)
  );
  const unitProfit = cents(price - directCost - unitFees);
  const unitRate = price ? unitProfit / price * 100 : 0;
  const addOnProfit = cents((Number(input.addOnValue) || 0) * (Number(input.addOnRate) || 0) / 100 * (Number(input.addOnMarginRate) || 0) / 100);
  const repeatProfit = cents((Number(input.repeatValue) || 0) * (Number(input.repeatRate) || 0) / 100 * (Number(input.repeatMarginRate) || 0) / 100);
  const realUnitProfit = cents(unitProfit + addOnProfit + repeatProfit);
  const realUnitRate = price ? realUnitProfit / price * 100 : 0;
  const totalProfit = cents(realUnitProfit * checkedCount);
  const addOnUnitMargin = (Number(input.addOnValue) || 0) * (Number(input.addOnMarginRate) || 0) / 100;
  const neededAddOnRate = unitProfit < 0 && addOnUnitMargin ? Math.ceil(Math.abs(unitProfit) / addOnUnitMargin * 100) : 0;
  return {
    checkedCount,
    unitProfit,
    realUnitProfit,
    totalProfit,
    neededAddOnRate,
    cards: [
      { label: "团购单份利润", value: `${money(unitProfit)} / ${percentText(unitRate)}`, level: unitProfit >= 0 ? "good" : "bad" },
      { label: "含加购单份利润", value: `${money(realUnitProfit)} / ${percentText(realUnitRate)}`, level: realUnitProfit >= 6 ? "good" : realUnitProfit >= 0 ? "warn" : "bad" },
      { label: "核销后总利润", value: money(totalProfit), level: totalProfit >= 0 ? "good" : "bad" },
      { label: "保本所需加购率", value: neededAddOnRate ? `${neededAddOnRate}%` : "无需加购", level: neededAddOnRate > (Number(input.addOnRate) || 0) ? "bad" : "good" }
    ],
    advice: dealAdvice(unitProfit, neededAddOnRate, Number(input.addOnRate) || 0, totalProfit)
  };
}

function dealAdvice(unitProfit, neededAddOnRate, addOnRate, totalProfit) {
  const advice = [];
  if (unitProfit < 0) advice.push(`当前套餐不含加购每份亏 ${money(Math.abs(unitProfit))}，不要只靠未来复购做判断。`);
  if (neededAddOnRate > addOnRate) advice.push(`现有加购转化不足，至少需要 ${neededAddOnRate}% 的核销顾客发生加购。`);
  if (totalProfit > 0) advice.push("按当前核销量测算，总利润为正，但要盯住核销高峰人手和出餐速度。");
  if (!advice.length) advice.push("套餐结构基本可控，可以继续压测佣金、核销量和加购转化。");
  return advice;
}

function summarizeLoss(records) {
  const total = records.reduce((sum, item) => sum + item.amount, 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayTotal = records.filter((item) => item.date === today).reduce((sum, item) => sum + item.amount, 0);
  const topItem = topBy(records, "item");
  const topReason = topBy(records, "reason");
  const advice = records.length
    ? `当前损耗主要集中在「${topItem}」和「${topReason}」。如果连续 3 天同一原因最高，建议调整备货公式、保存标准或员工训练动作。`
    : "暂无损耗记录。新增真实损耗后会自动汇总今日、累计、TOP 品项和 TOP 原因。";
  return {
    cards: [
      { label: "今日损耗", value: money(todayTotal), level: todayTotal > 100 ? "bad" : "warn" },
      { label: "累计损耗", value: money(total), level: total > 300 ? "bad" : "warn" },
      { label: "TOP 品项", value: topItem || "暂无", level: "good" },
      { label: "TOP 原因", value: topReason || "暂无", level: "warn" }
    ],
    advice: [advice]
  };
}

function topBy(records, key) {
  const map = {};
  records.forEach((item) => {
    map[item[key]] = (map[item[key]] || 0) + item.amount;
  });
  return Object.keys(map).sort((a, b) => map[b] - map[a])[0] || "";
}

function generateXhs(input) {
  const category = input.category || "招牌菜";
  const city = input.city || "本地";
  const points = splitList(input.sellingPoints);
  const audience = splitList(input.audience);
  const style = input.style || "种草";
  const address = input.address || "门店附近";
  const templateNames = [
    "地域搜索攻略",
    "性价比清单",
    "真实探店记录",
    "工作餐推荐",
    "夜宵场景",
    "约会聚餐",
    "亲子家庭",
    "健康轻负担",
    "新品互动",
    "避坑测评"
  ];
  const templateName = templateNames[Number(input.templateIndex) || 0] || templateNames[0];
  const titles = [
    `${templateName}｜${city}${category}可以这样拍`,
    `${city}${category}，这碗真的适合下班来吃`,
    `${audience[0] || "上班族"}可以收藏的${category}小店`,
    `${style}｜${points[0] || "现做现吃"}的${category}`,
    `${city}吃饭灵感：一碗热乎的${category}`
  ];
  const body = [
    `今天用「${templateName}」角度写一家适合${audience.join("、") || "日常吃饭"}的${category}。`,
    `我最喜欢的是${points.join("、") || "出品稳定、价格清楚、吃起来舒服"}，不是那种只适合拍照的店，是真的能解决一顿饭。`,
    `如果你在${address}附近，午餐、晚餐或者夜宵都可以考虑。第一次来建议先点招牌款，再按口味加小吃或饮品。`,
    "小提醒：高峰期最好错开一点，出餐体验会更稳。"
  ].join("\n\n");
  const tags = [`#${city}美食`, `#${category}`, "#小餐饮探店", "#今天吃什么", "#本地生活", "#打工人午餐", "#夜宵推荐", "#宝藏小店"];
  return {
    titles,
    body,
    tags,
    templateName,
    templates: templateNames,
    visual: [
      `封面文案：${city}${category}，${points[0] || "热乎现做"}才舒服。`,
      `模板镜头：${templateName}要有一个强场景开头，再补产品近景、出餐过程、菜单价格和真实用餐环境。`,
      "拍摄建议：门头一张、产品近景一张、出餐过程一张、顾客用餐场景一张，最后补一张菜单或价格信息。"
    ],
    copyText: `${titles.join("\n")}\n\n${body}\n\n${tags.join(" ")}`
  };
}

function calculateYield(input) {
  const purchaseWeight = Number(input.purchaseWeight) || 0;
  const purchaseCost = Number(input.purchaseCost) || 0;
  const yieldRate = Math.min(Math.max((Number(input.yieldRate) || 80) / 100, 0), 1);
  const lossRate = Math.min(Math.max((Number(input.lossRate) || 0) / 100, 0), 1);
  const usageKg = Math.max((Number(input.usageGram) || 0) / 1000, 0);
  const sellingPrice = Number(input.sellingPrice) || 0;
  const netWeight = cents(purchaseWeight * yieldRate * (1 - lossRate));
  const capacity = usageKg ? Math.floor(netWeight / usageKg) : 0;
  const unitCost = usageKg && netWeight ? cents(purchaseCost / netWeight * usageKg) : 0;
  const grossProfit = cents(sellingPrice - unitCost);
  const grossRate = sellingPrice ? grossProfit / sellingPrice * 100 : 0;
  const materialName = input.materialName || "核心原料";
  return {
    cards: [
      { label: "净料重量", value: `${netWeight.toFixed(2)} kg`, level: netWeight ? "good" : "warn" },
      { label: "理论产能", value: `${capacity} 份`, level: capacity >= 50 ? "good" : capacity >= 20 ? "warn" : "bad" },
      { label: "单份成本", value: money(unitCost), level: unitCost && sellingPrice && grossRate < 55 ? "warn" : "good" },
      { label: "理论毛利", value: `${money(grossProfit)} / ${percentText(grossRate)}`, level: levelByRate(grossRate, 55) }
    ],
    rows: [
      { label: "瓶颈原料", value: materialName },
      { label: "每份用量", value: `${Number(input.usageGram) || 0} g` },
      { label: "采购成本", value: money(purchaseCost) }
    ],
    advice: [
      capacity ? `当前按「${materialName}」测算最多约 ${capacity} 份，备货和售卖上限先按这个数保守安排。` : "请补齐采购重量和每份用量，才能形成产能判断。",
      grossRate && grossRate < 55 ? "理论毛利率低于 55%，建议复核出成率、单份克重、售价或采购价。" : "毛利结构暂时可控，后续可扩展多原料 BOM。"
    ]
  };
}

function calculateHealth(input, lossRecords) {
  const revenue = Number(input.revenue) || 0;
  const openingInventory = Number(input.openingInventory) || 0;
  const periodPurchases = Number(input.periodPurchases) || 0;
  const endingInventory = Number(input.endingInventory) || 0;
  const trackedLoss = (lossRecords || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const adjustment = cents((input.includeTrackedLoss ? trackedLoss : 0) + (Number(input.manualLossCost) || 0) + (Number(input.compCost) || 0) + (Number(input.staffMealCost) || 0) - (Number(input.surplusCost) || 0));
  const actualCogs = cents(openingInventory + periodPurchases - endingInventory + adjustment);
  const grossProfit = cents(revenue - actualCogs);
  const foodCostRate = revenue ? actualCogs / revenue * 100 : 0;
  const grossMarginRate = revenue ? grossProfit / revenue * 100 : 0;
  const laborCost = Number(input.laborCost) || 0;
  const primeCost = cents(actualCogs + laborCost);
  const primeCostRate = revenue ? primeCost / revenue * 100 : 0;
  const theoreticalFoodCost = Number(input.theoreticalFoodCost) || 0;
  const variance = theoreticalFoodCost ? cents(actualCogs - theoreticalFoodCost) : 0;
  const foodRedline = Number(input.foodRedline) || 35;
  const primeRedline = Number(input.primeRedline) || 65;
  const foodLevel = actualCogs < 0 ? "bad" : foodCostRate <= foodRedline ? "good" : foodCostRate <= foodRedline + 5 ? "warn" : "bad";
  const primeLevel = primeCostRate <= primeRedline ? "good" : primeCostRate <= primeRedline + 5 ? "warn" : "bad";
  const advice = [];
  if (!revenue && !periodPurchases) advice.push("录入营业收入、期初库存、当期采购和期末库存后，会形成食材成本率与 Prime Cost。");
  if (foodCostRate > foodRedline) advice.push(`食材成本率高于 ${foodRedline}%，优先检查采购价、盘点、报损赠送和菜品克重。`);
  if (primeCostRate > primeRedline) advice.push(`Prime Cost 高于 ${primeRedline}%，需要同时看食材成本和排班人工。`);
  if (theoreticalFoodCost && variance > 0) advice.push(`实际食材成本比理论成本高 ${money(variance)}，重点排查损耗、盘亏或漏记销售。`);
  if (!advice.length) advice.push("当前经营健康度暂未触发红线，可以继续用损耗和标准菜谱校准。");
  return {
    cards: [
      { label: "实际食材成本", value: money(actualCogs), level: foodLevel },
      { label: "食材成本率", value: percentText(foodCostRate), level: foodLevel },
      { label: "毛利", value: `${money(grossProfit)} / ${percentText(grossMarginRate)}`, level: grossProfit >= 0 ? "good" : "bad" },
      { label: "Prime Cost", value: `${money(primeCost)} / ${percentText(primeCostRate)}`, level: primeLevel }
    ],
    varianceCards: [
      { label: "理论食材成本", value: money(theoreticalFoodCost), level: "good" },
      { label: "成本差异", value: money(variance), level: variance <= 0 ? "good" : "warn" },
      { label: "损耗记录联动", value: money(trackedLoss), level: trackedLoss > revenue * 0.02 && revenue ? "bad" : "good" },
      { label: "调整项合计", value: money(adjustment), level: adjustment > revenue * 0.03 && revenue ? "warn" : "good" }
    ],
    advice
  };
}

function calculateSite(input) {
  const monthlyRevenue = (Number(input.avgTicket) || 0) * (Number(input.dailyOrders) || 0) * (Number(input.businessDays) || 30);
  const rentCost = (Number(input.monthlyRent) || 0) + (Number(input.propertyFee) || 0);
  const grossProfit = monthlyRevenue * ((Number(input.grossMarginRate) || 60) / 100);
  const fixedCost = rentCost + (Number(input.laborCost) || 0) + (Number(input.utilitiesCost) || 0) + (Number(input.marketingCost) || 0);
  const monthlyNetProfit = cents(grossProfit - fixedCost);
  const rentRate = monthlyRevenue ? rentCost / monthlyRevenue * 100 : 0;
  const contribution = (Number(input.avgTicket) || 0) * ((Number(input.grossMarginRate) || 60) / 100);
  const breakEvenDailyOrders = contribution ? fixedCost / contribution / (Number(input.businessDays) || 30) : 0;
  const investment = (Number(input.transferFee) || 0) + (Number(input.decorationCost) || 0) + (Number(input.equipmentCost) || 0) + (Number(input.monthlyRent) || 0) * (Number(input.depositMonths) || 2);
  const paybackMonths = monthlyNetProfit > 0 ? investment / monthlyNetProfit : 0;
  const conditionScore = ["license", "exhaust", "waterDrainage"].reduce((sum, key) => sum + (input[key] ? 8 : -12), 0);
  const trafficScore = (Number(input.trafficScore) || 3) * 6 + (Number(input.customerScore) || 3) * 6 + (Number(input.competitionScore) || 3) * 4 + (Number(input.visibilityScore) || 3) * 4;
  const financeScore = rentRate <= 10 ? 24 : rentRate <= 15 ? 14 : 4;
  const profitScore = monthlyNetProfit > 0 ? 18 : 0;
  const finalScore = Math.min(Math.max(Math.round(conditionScore + trafficScore + financeScore + profitScore), 0), 100);
  const verdict = finalScore >= 75 ? "优先考虑" : finalScore >= 60 ? "可谈判进入" : finalScore >= 45 ? "谨慎观察" : "不建议进入";
  const risks = [];
  if (!input.license) risks.push("证照条件不明确。");
  if (!input.exhaust) risks.push("排烟条件不满足。");
  if (!input.waterDrainage) risks.push("上下水条件需确认。");
  if (rentRate > 15) risks.push("租售比高于 15%。");
  if (monthlyNetProfit <= 0) risks.push("按当前假设月净利润不为正。");
  return {
    cards: [
      { label: "选址结论", value: verdict, level: finalScore >= 60 ? "good" : finalScore >= 45 ? "warn" : "bad" },
      { label: "综合评分", value: `${finalScore} 分`, level: finalScore >= 60 ? "good" : "warn" },
      { label: "租售比", value: percentText(rentRate), level: rentRate <= 10 ? "good" : rentRate <= 15 ? "warn" : "bad" },
      { label: "月净利润", value: money(monthlyNetProfit), level: monthlyNetProfit > 0 ? "good" : "bad" },
      { label: "保本日订单", value: `${cents(breakEvenDailyOrders)} 单`, level: breakEvenDailyOrders <= (Number(input.dailyOrders) || 0) * 0.8 ? "good" : "warn" },
      { label: "回本周期", value: paybackMonths ? `${cents(paybackMonths)} 月` : "无法回本", level: paybackMonths && paybackMonths <= 18 ? "good" : "warn" }
    ],
    advice: [
      risks.length ? `风险：${risks.join(" ")}` : "红线条件暂未触发，建议继续做午晚高峰和周末踩点。",
      `谈判重点：月租、物业费、免租期、递增比例、排烟/上下水/电力和证照责任要写入合同附件。`
    ]
  };
}

function generateRecruitment(input) {
  const category = input.category || "快餐简餐";
  const rank = input.rank || "服务员";
  const company = input.company || "本店";
  const location = input.location || "门店附近";
  const count = input.count || "若干";
  const salary = input.salary || "面议";
  const schedule = input.schedule || "按门店班次安排";
  const benefits = splitList(input.benefits || "包吃,绩效奖金,晋升培训");
  const contact = input.contact || "负责人";
  const phone = input.phone || "到店咨询";
  const duties = [`负责${category}门店${rank}当班工作`, "按标准完成出品、服务、清洁或备货动作", "配合店长完成高峰期协作和食品安全检查"];
  const requirements = ["身体健康，守时靠谱", "能接受餐饮门店排班", "重视卫生、安全和顾客体验"];
  const draft = [
    `${company} 招 ${rank}`,
    `类目：${category}`,
    `人数：${count}`,
    `薪资：${salary}`,
    `地点：${location}`,
    `时间：${schedule}`,
    "",
    "岗位职责：",
    ...duties.map((item, index) => `${index + 1}. ${item}`),
    "",
    "任职要求：",
    ...requirements.map((item, index) => `${index + 1}. ${item}`),
    "",
    `福利亮点：${benefits.join("、")}`,
    `联系：${contact} ${phone}`
  ].join("\n");
  return {
    cards: [
      { label: "餐饮类目", value: category, level: "good" },
      { label: "招聘职级", value: rank, level: "good" },
      { label: "发布形式", value: input.format || "门店海报", level: "warn" },
      { label: "招募重点", value: benefits[0] || "岗位清楚", level: "good" }
    ],
    duties,
    requirements,
    draft,
    advice: ["发布前补齐真实手机号、详细地址、休息制度和社保/住宿等硬信息。"]
  };
}

function generateDianping(input) {
  const details = [input.items, input.taste, input.service, input.focus || input.issues].filter(Boolean).length;
  const modeLabel = input.mode === "merchantReply" ? "商家回复" : "真实体验评价";
  const riskLevel = details >= 3 ? "低" : details >= 2 ? "中" : "高";
  const introMap = { positive: "这次整体体验比较满意。", neutral: "这次体验中规中矩。", mixed: "这次有满意的地方，也有需要改进的地方。", negative: "这次体验不太理想。" };
  let draft;
  if (input.mode === "merchantReply") {
    draft = [
      input.sentiment === "negative" ? "很抱歉这次没有给您带来满意体验。" : "感谢您分享这次真实体验。",
      input.items ? `您提到的「${input.items}」我们已经记录。` : "",
      input.taste ? `关于产品反馈：${input.taste}` : "",
      input.service ? `关于服务/环境反馈：${input.service}` : "",
      input.issues ? `关于「${input.issues}」，我们会反馈给门店复盘并尽快优化。` : "我们会继续保持出品和服务稳定。"
    ].filter(Boolean).join("\n\n");
  } else {
    draft = details ? [
      input.visitDate ? `${input.visitDate} 到店体验，${introMap[input.sentiment] || introMap.neutral}` : (introMap[input.sentiment] || introMap.neutral),
      input.items ? `实际消费：${input.items}${input.spend ? `，金额约 ${input.spend}` : ""}。` : "",
      input.taste ? `口味/产品：${input.taste}` : "",
      input.service ? `服务/环境：${input.service}` : "",
      input.issues ? `不足/建议：${input.issues}` : "",
      input.focus ? `补充感受：${input.focus}` : ""
    ].filter(Boolean).join("\n\n") : "请先补充真实消费项目、口味/产品细节、服务/环境细节或希望表达的重点。";
  }
  return {
    cards: [
      { label: "真实细节完整度", value: `${details}/4`, level: details >= 3 ? "good" : details >= 2 ? "warn" : "bad" },
      { label: "草稿类型", value: modeLabel, level: "good" },
      { label: "合规风险", value: riskLevel, level: riskLevel === "低" ? "good" : riskLevel === "中" ? "warn" : "bad" },
      { label: "建议图片", value: "3 张", level: "good" }
    ],
    draft,
    photoIdeas: [
      input.items ? `产品近景：拍清楚「${input.items}」的真实份量、摆盘和状态。` : "产品近景：拍实际消费的菜品或套餐。",
      "环境照片：拍门头、座位区、菜单价格或排队动线。",
      "细节照片：可补充小票、取餐号、调料台、餐具或包装，注意遮挡隐私。"
    ],
    compliance: [
      "只整理本人真实体验或商家对真实评价的回复，不替顾客写评。",
      "不要承诺返现、赠品、折扣来换评价。",
      "没有实际体验的菜品、服务、环境细节不要补写。"
    ]
  };
}

function summarizeTasks(records) {
  const tasks = records || [];
  const pending = tasks.filter((item) => item.status !== "done").length;
  const urgent = tasks.filter((item) => item.priority === "高" && item.status !== "done").length;
  return {
    cards: [
      { label: "任务总数", value: `${tasks.length} 项`, level: tasks.length ? "good" : "warn" },
      { label: "待完成", value: `${pending} 项`, level: pending ? "warn" : "good" },
      { label: "高优先级", value: `${urgent} 项`, level: urgent ? "bad" : "good" },
      { label: "本地状态", value: "仅本页内存", level: "warn" }
    ],
    advice: [pending ? "先处理高优先级和今天到期任务，完成后可在列表中点完成。" : "当前任务都已完成，可以继续新增周期性门店动作。"]
  };
}

function calculateIncentive(records) {
  const list = records || [];
  const totalPoints = list.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  const avgScore = list.length ? list.reduce((sum, item) => sum + (Number(item.score) || 0), 0) / list.length : 0;
  const best = list.slice().sort((a, b) => (b.points || 0) - (a.points || 0))[0];
  return {
    cards: [
      { label: "评分记录", value: `${list.length} 条`, level: list.length ? "good" : "warn" },
      { label: "平均评分", value: percentText(avgScore), level: avgScore >= 85 ? "good" : avgScore >= 70 ? "warn" : "bad" },
      { label: "累计积分", value: `${cents(totalPoints)} 分`, level: "good" },
      { label: "当前领先", value: best ? best.employee : "暂无", level: best ? "good" : "warn" }
    ],
    advice: [list.length ? "积分用于执行激励参考，不直接等同工资；低分任务应进入带教和复盘。" : "先录入员工任务评分，即可生成积分和排行榜。"]
  };
}

function scoreIncentive(input) {
  const onTime = Number(input.onTimeScore) || 0;
  const quality = Number(input.qualityScore) || 0;
  const completion = Number(input.completionScore) || 0;
  const basePoints = Number(input.basePoints) || 10;
  const score = cents(onTime * 0.3 + quality * 0.45 + completion * 0.25);
  const points = cents(basePoints * score / 100);
  return { score, points };
}

function analyzeRevenue(input) {
  const alias = { "金沙百联": "金山百联", "新街口": "南京新街口", "宝山共康绿地": "宝山共康" };
  const normalizeStore = (name) => alias[String(name || "").trim()] || String(name || "").trim();
  const rowsFromText = (value) => {
    const lines = String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const header = lines[0].split(/\t|,/).map((item) => item.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(/\t|,/).map((item) => item.trim());
      return header.reduce((row, key, index) => {
        row[key] = cells[index] || "";
        return row;
      }, {});
    });
  };
  const monthOf = (dateText) => String(dateText || "").slice(0, 7);
  const startMatch = String(input.fileName || "").match(/(?:^|\D)(\d{2})(\d{2})(?:\D|$)/);
  const fileStart = startMatch ? `${new Date().getFullYear()}-${startMatch[1]}-${startMatch[2]}` : "";
  const masterRows = rowsFromText(input.storeMasterText);
  const masterMap = {};
  masterRows.forEach((row) => {
    const store = normalizeStore(row["门店"]);
    if (store) masterMap[store] = { region: row["地域"] || "未分区", city: row["城市"] || "未标注", market: row["市场层级"] || "未分层" };
  });
  const revenueRows = rowsFromText(input.revenueText).map((row) => ({
    store: normalizeStore(row["门店"]),
    date: row["日期"],
    month: monthOf(row["日期"]),
    revenue: Number(row["营业额"]) || 0,
    orders: Number(row["订单数"]) || 0
  })).filter((row) => row.store && row.date);
  const dishRows = rowsFromText(input.dishText).map((row) => ({
    store: normalizeStore(row["门店"]),
    date: row["日期"],
    month: monthOf(row["日期"]),
    dish: row["菜品"] || "未命名菜品",
    isMainMenu: /^(是|true|1|yes)$/i.test(String(row["主菜单"] || "")),
    sales: Number(row["销售金额"]) || 0
  })).filter((row) => row.store && row.date);
  const group = {};
  revenueRows.forEach((row) => {
    const key = `${row.store}__${row.month}`;
    group[key] = group[key] || { store: row.store, month: row.month, revenueRows: [], dishRows: [] };
    group[key].revenueRows.push(row);
  });
  dishRows.forEach((row) => {
    const key = `${row.store}__${row.month}`;
    group[key] = group[key] || { store: row.store, month: row.month, revenueRows: [], dishRows: [] };
    group[key].dishRows.push(row);
  });
  const rows = Object.values(group).map((item) => {
    const dishStart = item.dishRows.map((row) => row.date).sort()[0] || "";
    const comparableStart = [fileStart, dishStart].filter(Boolean).sort().slice(-1)[0] || "";
    const comparableRevenueRows = comparableStart ? item.revenueRows.filter((row) => row.date >= comparableStart) : item.revenueRows;
    const revenue = cents(comparableRevenueRows.reduce((sum, row) => sum + row.revenue, 0));
    const sales = cents(item.dishRows.reduce((sum, row) => sum + row.sales, 0));
    const mainSales = cents(item.dishRows.filter((row) => row.isMainMenu).reduce((sum, row) => sum + row.sales, 0));
    const coverage = revenue ? sales / revenue * 100 : 0;
    const mainRate = sales ? mainSales / sales * 100 : 0;
    const status = [];
    if (!item.revenueRows.length || !item.dishRows.length) status.push("门店未匹配");
    if (sales && item.revenueRows.length && !revenue) status.push("可比营业额为空");
    if (coverage > 105) status.push("口径异常");
    if (sales && mainRate < 75) status.push("主菜单匹配偏低");
    if (comparableRevenueRows.length < 28) status.push("非整月样本");
    if (!status.length) status.push("口径正常");
    return {
      key: `${item.store}-${item.month}`,
      store: item.store,
      month: item.month,
      revenue,
      sales,
      coverage,
      revenueText: money(revenue),
      salesText: money(sales),
      coverageText: percentText(coverage),
      status: status.join(" / "),
      master: masterMap[item.store] || {}
    };
  });
  const totalRevenue = cents(rows.reduce((sum, row) => sum + row.revenue, 0));
  const totalSales = cents(rows.reduce((sum, row) => sum + row.sales, 0));
  const coverage = totalRevenue ? totalSales / totalRevenue * 100 : 0;
  const abnormal = rows.filter((row) => row.status !== "口径正常" && row.status !== "非整月样本").length;
  return {
    rows,
    cards: [
      { label: "纳入门店", value: `${new Set(rows.map((row) => row.store)).size} 家`, level: rows.length ? "good" : "warn" },
      { label: "可比营业额", value: money(totalRevenue), level: totalRevenue ? "good" : "warn" },
      { label: "菜品销售金额", value: money(totalSales), level: totalSales ? "good" : "warn" },
      { label: "覆盖率", value: percentText(coverage), level: coverage > 105 ? "bad" : coverage >= 75 ? "good" : "warn" }
    ],
    report: [
      "门店营业额联合分析素材",
      `可比营业额：${money(totalRevenue)}`,
      `菜品销售金额：${money(totalSales)}`,
      `菜品销售金额/营业额覆盖率：${percentText(coverage)}`,
      abnormal ? `需核查口径：${rows.filter((row) => row.status !== "口径正常").map((row) => `${row.store}${row.month}${row.status}`).join("；")}` : "本次未发现覆盖率超过 105% 或主菜单匹配偏低的异常口径。",
      "边界：覆盖率仅作销售结构参考，不等于真实营业贡献率、毛利率或利润贡献。"
    ].join("\n")
  };
}

function generateSchedule(input) {
  const employees = splitList(input.employees);
  const roles = splitList(input.roles);
  const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const restDays = Math.min(Number(input.restDays) || 0, 3);
  const rows = days.map((day, dayIndex) => {
    const rest = employees.filter((_, index) => restDays && (index + dayIndex) % Math.ceil(7 / restDays) === 0).slice(0, restDays);
    const active = employees.filter((name) => rest.indexOf(name) < 0);
    const early = active.slice(0, Math.max(2, Math.ceil(active.length / 2)));
    const late = active.slice(-Math.max(2, Math.ceil(active.length / 2)));
    const peak = active.length >= 4 ? active : active.concat(input.hasPartTime ? ["兼职补位"] : ["需补人"]).filter(Boolean);
    return {
      day,
      early: formatShift(early, roles, 0),
      noon: formatShift(peak, roles, 1),
      evening: formatShift(peak.slice().reverse(), roles, 2),
      close: formatShift(late, roles, 3),
      rest: rest.join("、") || "无"
    };
  });
  const totalHours = employees.length * (7 - restDays) * (Number(input.dailyHours) || 0);
  return {
    rows,
    cards: [
      { label: "员工人数", value: `${employees.length} 人`, level: "good" },
      { label: "营业时间", value: `${input.openTime} - ${input.closeTime}`, level: "good" },
      { label: "周计划工时", value: `${totalHours || 0} 小时`, level: "warn" },
      { label: "高峰时段", value: input.peakTimes || "未设置", level: employees.length >= 4 ? "good" : "bad" }
    ],
    advice: [employees.length < 4 ? "员工少于 4 人，高峰期建议预留兼职或老板顶岗。" : "高峰期已尽量安排全员覆盖，后续可以接入营业额预测来压缩闲时人力。"]
  };
}

function formatShift(names, roles, offset) {
  return names.map((name, index) => `${name}(${roles[(index + offset) % Math.max(roles.length, 1)] || "机动"})`).join("、") || "未安排";
}

module.exports = {
  cents,
  money,
  percentText,
  calculateMargin,
  calculateCombo,
  calculateGift,
  calculateDeal,
  summarizeLoss,
  generateXhs,
  calculateYield,
  calculateHealth,
  calculateSite,
  generateRecruitment,
  generateDianping,
  summarizeTasks,
  calculateIncentive,
  scoreIncentive,
  analyzeRevenue,
  generateSchedule
};
