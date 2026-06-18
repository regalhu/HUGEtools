(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HugeToolsYield = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = "1.0.0";
  const INDUSTRY_DEFAULTS = {
    chicken: { label: "鸡肉", keywords: ["鸡", "鸡肉", "鸡腿", "鸡胸"], yield_rate: 0.72 },
    beef: { label: "牛肉", keywords: ["牛", "牛肉", "牛腩", "肥牛"], yield_rate: 0.68 },
    pork: { label: "猪肉", keywords: ["猪", "猪肉", "五花", "排骨"], yield_rate: 0.75 },
    fish: { label: "鱼类", keywords: ["鱼", "鲈鱼", "草鱼", "鱼片"], yield_rate: 0.55 },
    vegetable: { label: "蔬菜", keywords: ["菜", "青菜", "蔬菜", "生菜", "白菜"], yield_rate: 0.85 },
    other: { label: "通用", keywords: [], yield_rate: 0.8 }
  };

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

  function round(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round((finiteNumber(value) + Number.EPSILON) * factor) / factor;
  }

  function materialProfile(name) {
    const normalized = String(name || "").toLowerCase();
    return Object.values(INDUSTRY_DEFAULTS).find((profile) => profile.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) || INDUSTRY_DEFAULTS.other;
  }

  function normalizeMaterial(material = {}) {
    const name = material.material_name || material.name || "";
    const profile = materialProfile(name);
    const explicitYield = material.yield_rate != null ? material.yield_rate : material.yieldRate;
    return {
      type: "Material",
      id: material.id || material.material_id || name,
      material_name: name,
      name,
      category: material.category || profile.label,
      purchase_weight: positiveNumber(material.purchase_weight ?? material.purchaseWeight),
      purchase_cost: positiveNumber(material.purchase_cost ?? material.purchaseCost),
      yield_rate: rate(explicitYield, profile.yield_rate),
      loss_rate: material.loss_rate != null ? rate(material.loss_rate, 0) : null,
      loss_layers: material.loss_layers || material.losses || {},
      min_purchase_unit: positiveNumber(material.min_purchase_unit ?? material.minPurchaseUnit),
      meta: material.meta || {}
    };
  }

  function normalizeProduct(product = {}) {
    const name = product.product_name || product.name || "";
    return {
      type: "Product",
      id: product.id || product.product_id || name,
      product_name: name,
      name,
      selling_price: positiveNumber(product.selling_price ?? product.price),
      ingredients: Array.isArray(product.ingredients) ? product.ingredients.map((ingredient) => ({
        material_id: ingredient.material_id || ingredient.id || ingredient.material_name || ingredient.name || "",
        material_name: ingredient.material_name || ingredient.name || "",
        usage_per_portion: positiveNumber(ingredient.usage_per_portion ?? ingredient.usagePerPortion)
      })) : [],
      meta: product.meta || {}
    };
  }

  function collectLossRates(material) {
    const losses = [];
    if (material.loss_rate != null) losses.push(material.loss_rate);
    const layers = material.loss_layers || material.losses || {};
    [
      "purchase_loss_rate",
      "processing_loss_rate",
      "cooking_loss_rate",
      "purchase",
      "processing",
      "cooking"
    ].forEach((key) => {
      if (layers[key] != null) losses.push(layers[key]);
      if (material[key] != null) losses.push(material[key]);
    });
    return losses.map((item) => rate(item, 0));
  }

  function lossFactor(material) {
    return collectLossRates(material).reduce((factor, item) => factor * (1 - item), 1);
  }

  function singleBatchAvailability(material) {
    const normalized = normalizeMaterial(material);
    const purchaseWeight = positiveNumber(normalized.purchase_weight);
    const purchaseCost = positiveNumber(normalized.purchase_cost);
    const minUnit = positiveNumber(normalized.min_purchase_unit);
    const roundedPurchaseWeight = minUnit > 0 ? Math.ceil(purchaseWeight / minUnit) * minUnit : purchaseWeight;
    const adjustedPurchaseCost = purchaseWeight > 0 && roundedPurchaseWeight > purchaseWeight
      ? purchaseCost * roundedPurchaseWeight / purchaseWeight
      : purchaseCost;
    const yieldRate = rate(normalized.yield_rate, 1);
    const combinedLossFactor = lossFactor(normalized);
    const effectiveWeight = roundedPurchaseWeight * yieldRate * combinedLossFactor;
    const rawEffectiveWeight = purchaseWeight * yieldRate * combinedLossFactor;
    return {
      type: "MaterialAvailability",
      material_id: normalized.id,
      material_name: normalized.material_name,
      category: normalized.category,
      purchase_weight: round(purchaseWeight),
      effective_purchase_weight: round(roundedPurchaseWeight),
      purchase_cost: round(purchaseCost, 2),
      adjusted_purchase_cost: round(adjustedPurchaseCost, 2),
      yield_rate: round(yieldRate),
      loss_rate: round(1 - combinedLossFactor),
      loss_factor: round(combinedLossFactor),
      net_weight: round(rawEffectiveWeight),
      effective_weight: round(effectiveWeight),
      raw_effective_weight: round(rawEffectiveWeight),
      effective_unit_cost: effectiveWeight > 0 ? round(adjustedPurchaseCost / effectiveWeight, 6) : 0,
      min_purchase_unit: round(minUnit)
    };
  }

  function materialAvailability(material) {
    const normalized = normalizeMaterial(material);
    const batches = Array.isArray(material.batches) ? material.batches : [];
    if (!batches.length) return singleBatchAvailability(normalized);
    const totals = batches.map((batch) => singleBatchAvailability({ ...normalized, ...batch, batches: [] }));
    const aggregate = totals.reduce((sum, item) => ({
      purchase_weight: sum.purchase_weight + item.purchase_weight,
      effective_purchase_weight: sum.effective_purchase_weight + item.effective_purchase_weight,
      purchase_cost: sum.purchase_cost + item.purchase_cost,
      adjusted_purchase_cost: sum.adjusted_purchase_cost + item.adjusted_purchase_cost,
      effective_weight: sum.effective_weight + item.effective_weight,
      raw_effective_weight: sum.raw_effective_weight + item.raw_effective_weight
    }), {
      purchase_weight: 0,
      effective_purchase_weight: 0,
      purchase_cost: 0,
      adjusted_purchase_cost: 0,
      effective_weight: 0,
      raw_effective_weight: 0
    });
    return {
      type: "MaterialAvailability",
      material_id: normalized.id,
      material_name: normalized.material_name,
      category: normalized.category,
      purchase_weight: round(aggregate.purchase_weight),
      effective_purchase_weight: round(aggregate.effective_purchase_weight),
      purchase_cost: round(aggregate.purchase_cost, 2),
      adjusted_purchase_cost: round(aggregate.adjusted_purchase_cost, 2),
      yield_rate: null,
      loss_rate: null,
      loss_factor: null,
      net_weight: round(aggregate.raw_effective_weight),
      effective_weight: round(aggregate.effective_weight),
      raw_effective_weight: round(aggregate.raw_effective_weight),
      effective_unit_cost: aggregate.effective_weight > 0 ? round(aggregate.adjusted_purchase_cost / aggregate.effective_weight, 6) : 0,
      min_purchase_unit: positiveNumber(normalized.min_purchase_unit),
      batch_count: batches.length
    };
  }

  function calculateProductCapacity(product, materialMap) {
    const normalizedProduct = normalizeProduct(product);
    const ingredients = normalizedProduct.ingredients;
    const ingredientResults = ingredients.map((ingredient) => {
      const materialName = ingredient.material_name || ingredient.name || "";
      const material = materialMap.get(materialName) || materialMap.get(ingredient.material_id);
      const usagePerPortion = positiveNumber(ingredient.usage_per_portion);
      const capacity = material && usagePerPortion > 0 ? material.net_weight / usagePerPortion : 0;
      return {
        material_name: materialName,
        usage_per_portion: round(usagePerPortion),
        net_weight: round(material?.net_weight || 0),
        effective_weight: round(material?.effective_weight || 0),
        material_capacity: round(capacity),
        unit_cost: material ? round(material.effective_unit_cost * usagePerPortion, 4) : 0,
        warning: material ? "" : "material_not_found"
      };
    });
    const usableCapacities = ingredientResults
      .filter((item) => !item.warning && item.usage_per_portion > 0)
      .map((item) => item.material_capacity);
    const exactCapacity = usableCapacities.length ? Math.min(...usableCapacities) : 0;
    const theoreticalMaxPortions = Math.floor(exactCapacity);
    const bottleneckMaterials = ingredientResults
      .filter((item) => usableCapacities.length && Math.abs(item.material_capacity - exactCapacity) < 0.0001)
      .map((item) => item.material_name);
    const totalCost = ingredients.reduce((sum, ingredient) => {
      const material = materialMap.get(ingredient.material_name) || materialMap.get(ingredient.material_id);
      return sum + (material?.adjusted_purchase_cost || 0);
    }, 0);
    const unitCost = theoreticalMaxPortions > 0 ? totalCost / theoreticalMaxPortions : 0;
    const unitTheoreticalCost = unitCost || ingredientResults.reduce((sum, item) => sum + item.unit_cost, 0);
    const grossMarginRate = normalizedProduct.selling_price > 0
      ? (normalizedProduct.selling_price - unitTheoreticalCost) / normalizedProduct.selling_price
      : 0;
    const materialUtilization = ingredientResults.map((item) => {
      const usedWeight = theoreticalMaxPortions * item.usage_per_portion;
      const availableWeight = item.net_weight || item.effective_weight;
      const utilizationRate = availableWeight > 0 ? usedWeight / availableWeight : 0;
      return {
        material_name: item.material_name,
        utilization_rate: round(Math.min(utilizationRate, 1)),
        used_weight: round(usedWeight),
        remaining_weight: round(Math.max(availableWeight - usedWeight, 0)),
        is_bottleneck: bottleneckMaterials.includes(item.material_name)
      };
    });
    const result = {
      type: "Result",
      product_id: normalizedProduct.id,
      product_name: normalizedProduct.product_name,
      theoretical_max_portions: theoreticalMaxPortions,
      max_capacity: theoreticalMaxPortions,
      exact_capacity: round(exactCapacity),
      bottleneck_materials: bottleneckMaterials,
      total_cost: round(totalCost, 2),
      unit_cost: round(unitTheoreticalCost, 2),
      unit_theoretical_cost: round(unitTheoreticalCost, 2),
      selling_price: round(normalizedProduct.selling_price, 2),
      gross_margin_rate: round(grossMarginRate),
      material_capacity_details: ingredientResults,
      material_utilization: materialUtilization,
      warnings: ingredientResults.map((item) => item.warning).filter(Boolean),
      recommendations: []
    };
    result.recommendations = decisionRecommendations(result);
    return result;
  }

  function decisionRecommendations(result) {
    const advice = [];
    const bottleneck = result.bottleneck_materials[0] || "核心原料";
    if (!result.max_capacity) advice.push("先补齐单品用量或 BOM，否则无法形成可执行排产判断。");
    else advice.push(`最大产能约 ${result.max_capacity} 份，排班、备货和售卖上限先按该数做保守计划。`);
    advice.push(`瓶颈原料是「${bottleneck}」，优先复核采购重量、出成率、损耗率和替代菜品结构。`);
    if (result.selling_price > 0 && result.gross_margin_rate < 0.55) {
      advice.push(`毛利率约 ${round(result.gross_margin_rate * 100, 1)}%，建议调价、压低单份用量或重新谈采购价。`);
    } else if (result.selling_price > 0) {
      advice.push(`毛利率约 ${round(result.gross_margin_rate * 100, 1)}%，可继续跟踪实际售罄率和损耗偏差。`);
    } else {
      advice.push(`单位成本约 ${round(result.unit_cost, 2)} 元；补充售价后可输出毛利率和调价建议。`);
    }
    return advice.slice(0, 3);
  }

  function calculateYieldCapacity(payload) {
    const materials = Array.isArray(payload?.materials) ? payload.materials.map(normalizeMaterial) : [];
    const products = Array.isArray(payload?.products) ? payload.products.map(normalizeProduct) : [];
    const materialAvailabilityList = materials.map(materialAvailability);
    const materialMap = new Map();
    materialAvailabilityList.forEach((item) => {
      materialMap.set(item.material_name, item);
      materialMap.set(item.material_id, item);
    });
    const productResults = products.map((product) => calculateProductCapacity(product, materialMap));
    const bottleneckCounts = new Map();
    productResults.forEach((product) => {
      product.bottleneck_materials.forEach((name) => bottleneckCounts.set(name, (bottleneckCounts.get(name) || 0) + 1));
    });
    return {
      schema_version: VERSION,
      calculated_at: new Date().toISOString(),
      mode: payload?.mode || "standard",
      structures: {
        material: "Material",
        product: "Product",
        result: "Result"
      },
      material_availability: materialAvailabilityList,
      products: productResults,
      results: productResults,
      summary: {
        material_count: materialAvailabilityList.length,
        product_count: productResults.length,
        total_theoretical_portions: productResults.reduce((sum, item) => sum + item.theoretical_max_portions, 0),
        bottleneck_materials: [...bottleneckCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([material_name, count]) => ({ material_name, count }))
      }
    };
  }

  function post(path, payload) {
    if (!["/calculate-yield", "/api/calculate-yield"].includes(path)) {
      return Promise.reject(new Error("Unsupported endpoint"));
    }
    return Promise.resolve(calculateYieldCapacity(payload));
  }

  return {
    VERSION,
    INDUSTRY_DEFAULTS,
    calculateYieldCapacity,
    materialAvailability,
    normalizeMaterial,
    normalizeProduct,
    post
  };
});
