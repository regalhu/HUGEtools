(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HugeToolsSiteSelection = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = "1.0.0";
  const HEAVY_CATERING_TYPES = new Set(["hotpot", "chinese", "bbq", "noodle", "fast_food"]);

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function positiveNumber(value, fallback = 0) {
    return Math.max(finiteNumber(value, fallback), 0);
  }

  function rate(value, fallback = 0) {
    const number = finiteNumber(value, fallback);
    if (number > 1 && number <= 100) return number / 100;
    return Math.min(Math.max(number, 0), 1);
  }

  function score(value, fallback = 3) {
    return Math.min(Math.max(finiteNumber(value, fallback), 0), 5);
  }

  function round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round((finiteNumber(value) + Number.EPSILON) * factor) / factor;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(finiteNumber(value), min), max);
  }

  function normalizePayload(payload = {}) {
    const candidate = payload.candidate || {};
    const assumption = payload.businessAssumption || payload.business_assumption || {};
    const condition = payload.siteCondition || payload.site_condition || {};
    const competition = payload.competition || {};
    const options = payload.options || {};
    return {
      schema_version: payload.schema_version || "site-selection.v1",
      storeType: payload.storeType || payload.store_type || "fast_food",
      cityTier: payload.cityTier || payload.city_tier || "second_tier",
      candidate: {
        areaSqm: positiveNumber(candidate.areaSqm ?? candidate.area_sqm),
        monthlyRent: positiveNumber(candidate.monthlyRent ?? candidate.monthly_rent),
        propertyFee: positiveNumber(candidate.propertyFee ?? candidate.property_fee),
        transferFee: positiveNumber(candidate.transferFee ?? candidate.transfer_fee),
        decorationCost: positiveNumber(candidate.decorationCost ?? candidate.decoration_cost),
        equipmentCost: positiveNumber(candidate.equipmentCost ?? candidate.equipment_cost),
        depositMonths: positiveNumber(candidate.depositMonths ?? candidate.deposit_months, 2),
        contractYears: positiveNumber(candidate.contractYears ?? candidate.contract_years, 3),
        rentFreeMonths: positiveNumber(candidate.rentFreeMonths ?? candidate.rent_free_months),
        annualRentIncreaseRate: rate(candidate.annualRentIncreaseRate ?? candidate.annual_rent_increase_rate, 0)
      },
      businessAssumption: {
        avgTicket: positiveNumber(assumption.avgTicket ?? assumption.avg_ticket),
        dailyOrders: positiveNumber(assumption.dailyOrders ?? assumption.daily_orders),
        grossMarginRate: rate(assumption.grossMarginRate ?? assumption.gross_margin_rate, 0.6),
        businessDaysPerMonth: positiveNumber(assumption.businessDaysPerMonth ?? assumption.business_days_per_month, 30),
        laborCost: positiveNumber(assumption.laborCost ?? assumption.labor_cost),
        utilitiesCost: positiveNumber(assumption.utilitiesCost ?? assumption.utilities_cost),
        marketingCost: positiveNumber(assumption.marketingCost ?? assumption.marketing_cost),
        otherFixedCost: positiveNumber(assumption.otherFixedCost ?? assumption.other_fixed_cost),
        platformRate: rate(assumption.platformRate ?? assumption.platform_rate, 0),
        variableCostPerOrder: positiveNumber(assumption.variableCostPerOrder ?? assumption.variable_cost_per_order)
      },
      siteCondition: {
        canApplyLicense: condition.canApplyLicense ?? condition.can_apply_license ?? true,
        hasExhaust: condition.hasExhaust ?? condition.has_exhaust ?? true,
        hasGas: condition.hasGas ?? condition.has_gas ?? true,
        hasWaterDrainage: condition.hasWaterDrainage ?? condition.has_water_drainage ?? true,
        powerCapacityKw: positiveNumber(condition.powerCapacityKw ?? condition.power_capacity_kw),
        visibilityScore: score(condition.visibilityScore ?? condition.visibility_score),
        trafficScore: score(condition.trafficScore ?? condition.traffic_score),
        targetCustomerScore: score(condition.targetCustomerScore ?? condition.target_customer_score),
        competitionScore: score(condition.competitionScore ?? condition.competition_score),
        deliveryConvenienceScore: score(condition.deliveryConvenienceScore ?? condition.delivery_convenience_score),
        parkingScore: score(condition.parkingScore ?? condition.parking_score),
        floorScore: score(condition.floorScore ?? condition.floor_score),
        brandFitScore: score(condition.brandFitScore ?? condition.brand_fit_score)
      },
      competition: {
        sameCategoryCount: positiveNumber(competition.sameCategoryCount ?? competition.same_category_count),
        strongBrandCount: positiveNumber(competition.strongBrandCount ?? competition.strong_brand_count)
      },
      customNotes: payload.customNotes || payload.custom_notes || "",
      options: {
        rentToSalesWarn: rate(options.rentToSalesWarn ?? options.rent_to_sales_warn, 0.1),
        rentToSalesBad: rate(options.rentToSalesBad ?? options.rent_to_sales_bad, 0.15),
        paybackWarnMonths: positiveNumber(options.paybackWarnMonths ?? options.payback_warn_months, 18),
        paybackBadMonths: positiveNumber(options.paybackBadMonths ?? options.payback_bad_months, 24)
      }
    };
  }

  function calculateFinancials(input) {
    const c = input.candidate;
    const b = input.businessAssumption;
    const monthlyRevenue = b.avgTicket * b.dailyOrders * b.businessDaysPerMonth;
    const monthlyRentCost = c.monthlyRent + c.propertyFee;
    const rentToSalesRate = monthlyRevenue > 0 ? monthlyRentCost / monthlyRevenue : 0;
    const grossProfit = monthlyRevenue * b.grossMarginRate;
    const platformFee = monthlyRevenue * b.platformRate;
    const variableCost = b.variableCostPerOrder * b.dailyOrders * b.businessDaysPerMonth;
    const monthlyFixedCost = monthlyRentCost + b.laborCost + b.utilitiesCost + b.marketingCost + b.otherFixedCost;
    const monthlyNetProfit = grossProfit - platformFee - variableCost - monthlyFixedCost;
    const netProfitRate = monthlyRevenue > 0 ? monthlyNetProfit / monthlyRevenue : 0;
    const deposit = c.monthlyRent * c.depositMonths;
    const initialInvestment = c.transferFee + c.decorationCost + c.equipmentCost + deposit;
    const contributionPerOrder = b.avgTicket * (b.grossMarginRate - b.platformRate) - b.variableCostPerOrder;
    const breakEvenDailyOrders = contributionPerOrder > 0 && b.businessDaysPerMonth > 0
      ? monthlyFixedCost / contributionPerOrder / b.businessDaysPerMonth
      : 0;
    const paybackMonths = monthlyNetProfit > 0 ? initialInvestment / monthlyNetProfit : null;
    const affordableRent = Math.max(monthlyRevenue * input.options.rentToSalesWarn - c.propertyFee, 0);
    return {
      monthly_revenue: round(monthlyRevenue),
      monthly_rent_cost: round(monthlyRentCost),
      rent_to_sales_rate: round(rentToSalesRate, 4),
      gross_profit: round(grossProfit),
      platform_fee: round(platformFee),
      variable_cost: round(variableCost),
      monthly_fixed_cost: round(monthlyFixedCost),
      monthly_net_profit: round(monthlyNetProfit),
      net_profit_rate: round(netProfitRate, 4),
      initial_investment: round(initialInvestment),
      contribution_per_order: round(contributionPerOrder),
      break_even_daily_orders: round(breakEvenDailyOrders, 1),
      payback_months: paybackMonths == null ? null : round(paybackMonths, 1),
      affordable_monthly_rent: round(affordableRent)
    };
  }

  function costStructureScore(financials, options) {
    const rentScore = financials.rent_to_sales_rate <= 0.08 ? 8
      : financials.rent_to_sales_rate <= options.rentToSalesWarn ? 6
      : financials.rent_to_sales_rate <= options.rentToSalesBad ? 3
      : 0;
    const profitScore = financials.net_profit_rate >= 0.15 ? 6
      : financials.net_profit_rate >= 0.08 ? 4
      : financials.net_profit_rate > 0 ? 2
      : 0;
    const paybackScore = financials.payback_months == null ? 0
      : financials.payback_months <= 12 ? 6
      : financials.payback_months <= options.paybackWarnMonths ? 4
      : financials.payback_months <= options.paybackBadMonths ? 2
      : 0;
    return rentScore + profitScore + paybackScore;
  }

  function calculateScores(input, financials) {
    const s = input.siteCondition;
    const competitionDrag = input.competition.sameCategoryCount * 0.7 + input.competition.strongBrandCount * 1.6;
    const dimensions = [
      { key: "customer_match", label: "商圈与客群匹配", score: s.targetCustomerScore / 5 * 20, max: 20 },
      { key: "traffic_quality", label: "客流质量", score: (s.trafficScore * 0.45 + s.visibilityScore * 0.35 + s.deliveryConvenienceScore * 0.2) / 5 * 15, max: 15 },
      { key: "competition", label: "竞争环境", score: clamp(s.competitionScore / 5 * 15 - competitionDrag, 0, 15), max: 15 },
      { key: "cost_structure", label: "成本结构", score: costStructureScore(financials, input.options), max: 20 },
      { key: "property_condition", label: "物业经营条件", score: (
        (s.hasExhaust ? 3 : 0) +
        (s.hasWaterDrainage ? 3 : 0) +
        (s.hasGas ? 2 : 0) +
        (s.powerCapacityKw >= 60 ? 2 : s.powerCapacityKw >= 35 ? 1 : 0) +
        s.floorScore / 5 * 2 +
        s.parkingScore / 5 * 1.5 +
        s.deliveryConvenienceScore / 5 * 1.5
      ), max: 15 },
      { key: "compliance", label: "证照与合规风险", score: (
        (s.canApplyLicense ? 4 : 0) +
        (s.hasExhaust ? 2 : 0) +
        (s.hasWaterDrainage ? 2 : 0) +
        (s.powerCapacityKw >= 35 ? 1 : 0) +
        (input.candidate.contractYears >= 3 ? 1 : 0)
      ), max: 10 },
      { key: "strategy_fit", label: "品牌战略匹配", score: s.brandFitScore / 5 * 5, max: 5 }
    ];
    return dimensions.map((item) => ({
      ...item,
      score: round(clamp(item.score, 0, item.max), 1),
      rate: round(clamp(item.score / item.max, 0, 1), 4)
    }));
  }

  function evaluateRisks(input, financials) {
    const redFlags = [];
    const warnings = [];
    const c = input.candidate;
    const s = input.siteCondition;
    const heavy = HEAVY_CATERING_TYPES.has(input.storeType);
    if (!s.canApplyLicense) redFlags.push("证照办理条件不明确或不可办理，不能作为餐饮正式选址进入。");
    if (heavy && !s.hasExhaust) redFlags.push("当前业态需要稳定排烟条件，但该点位排烟条件不满足。");
    if (!s.hasWaterDrainage) redFlags.push("上下水/排水条件不满足，会直接影响后厨、清洗和办证。");
    if (financials.rent_to_sales_rate > 0.18) redFlags.push("租售比超过 18%，除非有极强确定性客流，否则不建议进入。");
    if (financials.monthly_net_profit < 0) redFlags.push("按当前假设月净利润为负，需要先重谈租金或重做业态模型。");
    if (c.contractYears < 3 && financials.initial_investment >= 200000) redFlags.push("合同期低于 3 年但投入较高，回本窗口不足。");
    if (financials.payback_months != null && financials.payback_months > 36) redFlags.push("预计回本周期超过 36 个月，现金流压力过大。");

    if (financials.rent_to_sales_rate > input.options.rentToSalesBad) warnings.push("租售比高于 15%，谈判重点应放在降租、免租期或营业额扣租。");
    else if (financials.rent_to_sales_rate > input.options.rentToSalesWarn) warnings.push("租售比高于 10%，需要用更保守的订单量再测一遍。");
    if (financials.break_even_daily_orders > input.businessAssumption.dailyOrders * 0.85) warnings.push("保本日订单接近当前预估日订单，抗波动能力偏弱。");
    if (input.competition.strongBrandCount >= 3) warnings.push("周边强竞争品牌较多，需要明确差异化产品、价格带或流量入口。");
    if (s.visibilityScore <= 2) warnings.push("门头可见度偏弱，要确认外卖、导视、社群或商场流量能否补偿。");
    if (s.powerCapacityKw > 0 && s.powerCapacityKw < 35) warnings.push("电力容量偏低，重餐饮设备同时运行可能受限。");
    if (c.annualRentIncreaseRate >= 0.08) warnings.push("租金年递增较高，合同谈判需锁定递增上限。");
    return { redFlags, warnings };
  }

  function riskPenalty(input, financials, risks) {
    let penalty = risks.redFlags.length * 12 + risks.warnings.length * 3;
    if (financials.rent_to_sales_rate > input.options.rentToSalesBad) penalty += 8;
    if (financials.payback_months == null || financials.payback_months > input.options.paybackBadMonths) penalty += 8;
    return round(penalty, 1);
  }

  function verdictFromScore(scoreValue, hasBlocker) {
    if (hasBlocker) return { level: "blocker", label: "不建议进入", summary: "先解决红线问题，再进入租金和经营模型谈判。" };
    if (scoreValue >= 85) return { level: "excellent", label: "优先考虑", summary: "点位与经营模型匹配度较高，可以进入合同细节和复盘踩点。" };
    if (scoreValue >= 70) return { level: "good", label: "可谈判进入", summary: "具备进入条件，但要围绕租金、免租期和证照条件谈判。" };
    if (scoreValue >= 55) return { level: "watch", label: "谨慎观察", summary: "当前模型可继续评估，但需要二次踩点和保守订单测算。" };
    if (scoreValue >= 40) return { level: "high_risk", label: "高风险", summary: "经营压力较大，除非条件明显改善，否则不建议投入。" };
    return { level: "reject", label: "不建议进入", summary: "综合分偏低，优先寻找替代点位。" };
  }

  function recommendations(input, financials, risks, verdict) {
    const items = [];
    if (risks.redFlags.length) items.push("先处理红线：证照、排烟、上下水、合同期或负利润模型未解决前，不建议交定金。");
    if (financials.affordable_monthly_rent < input.candidate.monthlyRent) {
      items.push(`按 10% 租售比倒推，建议月租金谈到 ${round(financials.affordable_monthly_rent, 0)} 元以内，或用免租期/递增条款抵消。`);
    } else {
      items.push(`当前租金低于 10% 租售比上限 ${round(financials.affordable_monthly_rent, 0)} 元，可重点核实客流质量。`);
    }
    if (financials.break_even_daily_orders) items.push(`保本日订单约 ${financials.break_even_daily_orders} 单，开业目标应至少高于保本线 20%。`);
    if (financials.payback_months != null) items.push(`预计回本周期约 ${financials.payback_months} 个月，合同期和免租期要覆盖真实爬坡期。`);
    else items.push("当前模型无法回本，先降低固定成本或重估客单价、订单量和毛利率。");
    if (risks.warnings.length) items.push(`二次踩点重点：${risks.warnings.slice(0, 2).join("；")}`);
    if (verdict.level === "excellent" || verdict.level === "good") items.push("进入下一步前，建议做工作日午晚高峰、周末晚高峰和雨天外卖便利性三次现场复核。");
    return items.slice(0, 5);
  }

  function calculateSiteSelection(payload) {
    const input = normalizePayload(payload);
    const financials = calculateFinancials(input);
    const dimensions = calculateScores(input, financials);
    const risks = evaluateRisks(input, financials);
    const baseScore = dimensions.reduce((sum, item) => sum + item.score, 0);
    const penalty = riskPenalty(input, financials, risks);
    const cappedScore = risks.redFlags.length ? Math.min(baseScore - penalty, 39) : baseScore - penalty;
    const finalScore = round(clamp(cappedScore, 0, 100), 1);
    const verdict = verdictFromScore(finalScore, risks.redFlags.length > 0);
    return {
      schema_version: VERSION,
      calculated_at: new Date().toISOString(),
      mode: payload?.mode || "standard",
      input,
      financials,
      scores: {
        base_score: round(baseScore, 1),
        risk_penalty: penalty,
        final_score: finalScore,
        dimensions
      },
      risks,
      verdict,
      recommendations: recommendations(input, financials, risks, verdict),
      negotiation_points: [
        "租金、物业费、免租期、递增比例写入合同附件。",
        "排烟、燃气、上下水、电力容量和证照办理责任要形成书面确认。",
        "转让费和装修投入按最坏回收周期测算，不按乐观客流做决策。"
      ]
    };
  }

  function post(path, payload) {
    if (!["/calculate-site-selection", "/api/calculate-site-selection"].includes(path)) {
      return Promise.reject(new Error("Unsupported endpoint"));
    }
    return Promise.resolve(calculateSiteSelection(payload));
  }

  return {
    VERSION,
    calculateSiteSelection,
    normalizePayload,
    post
  };
});
