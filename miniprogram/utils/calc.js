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
    "小提醒：高峰期最好错开一点，出餐体验会更稳。"
  ].join("\n\n");
  const tags = [`#${city}美食`, `#${category}`, "#小餐饮探店", "#今天吃什么", "#本地生活", "#打工人午餐", "#夜宵推荐", "#宝藏小店"];
  return {
    titles,
    body,
    tags,
    visual: [
      `封面文案：${city}${category}，${points[0] || "热乎现做"}才舒服。`,
      "拍摄建议：门头一张、产品近景一张、出餐过程一张、顾客用餐场景一张，最后补一张菜单或价格信息。"
    ],
    copyText: `${titles.join("\n")}\n\n${body}\n\n${tags.join(" ")}`
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
  generateSchedule
};
