(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HugeToolsYield = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = "1.0.0";

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
    const purchaseWeight = positiveNumber(material.purchase_weight);
    const purchaseCost = positiveNumber(material.purchase_cost);
    const minUnit = positiveNumber(material.min_purchase_unit);
    const roundedPurchaseWeight = minUnit > 0 ? Math.ceil(purchaseWeight / minUnit) * minUnit : purchaseWeight;
    const adjustedPurchaseCost = purchaseWeight > 0 && roundedPurchaseWeight > purchaseWeight
      ? purchaseCost * roundedPurchaseWeight / purchaseWeight
      : purchaseCost;
    const yieldRate = rate(material.yield_rate, 1);
    const combinedLossFactor = lossFactor(material);
    const effectiveWeight = roundedPurchaseWeight * yieldRate * combinedLossFactor;
    const rawEffectiveWeight = purchaseWeight * yieldRate * combinedLossFactor;
    return {
      material_name: material.material_name || material.name || "",
      purchase_weight: round(purchaseWeight),
      effective_purchase_weight: round(roundedPurchaseWeight),
      purchase_cost: round(purchaseCost, 2),
      adjusted_purchase_cost: round(adjustedPurchaseCost, 2),
      yield_rate: round(yieldRate),
      loss_factor: round(combinedLossFactor),
      effective_weight: round(effectiveWeight),
      raw_effective_weight: round(rawEffectiveWeight),
      effective_unit_cost: effectiveWeight > 0 ? round(adjustedPurchaseCost / effectiveWeight, 6) : 0,
      min_purchase_unit: round(minUnit)
    };
  }

  function materialAvailability(material) {
    const batches = Array.isArray(material.batches) ? material.batches : [];
    if (!batches.length) return singleBatchAvailability(material);
    const totals = batches.map((batch) => singleBatchAvailability({ ...material, ...batch, batches: [] }));
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
      material_name: material.material_name || material.name || "",
      purchase_weight: round(aggregate.purchase_weight),
      effective_purchase_weight: round(aggregate.effective_purchase_weight),
      purchase_cost: round(aggregate.purchase_cost, 2),
      adjusted_purchase_cost: round(aggregate.adjusted_purchase_cost, 2),
      yield_rate: null,
      loss_factor: null,
      effective_weight: round(aggregate.effective_weight),
      raw_effective_weight: round(aggregate.raw_effective_weight),
      effective_unit_cost: aggregate.effective_weight > 0 ? round(aggregate.adjusted_purchase_cost / aggregate.effective_weight, 6) : 0,
      min_purchase_unit: positiveNumber(material.min_purchase_unit),
      batch_count: batches.length
    };
  }

  function calculateProductCapacity(product, materialMap) {
    const ingredients = Array.isArray(product.ingredients) ? product.ingredients : [];
    const ingredientResults = ingredients.map((ingredient) => {
      const materialName = ingredient.material_name || ingredient.name || "";
      const material = materialMap.get(materialName);
      const usagePerPortion = positiveNumber(ingredient.usage_per_portion);
      const capacity = material && usagePerPortion > 0 ? material.effective_weight / usagePerPortion : 0;
      return {
        material_name: materialName,
        usage_per_portion: round(usagePerPortion),
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
    const unitTheoreticalCost = ingredientResults.reduce((sum, item) => sum + item.unit_cost, 0);
    const materialUtilization = ingredientResults.map((item) => {
      const usedWeight = theoreticalMaxPortions * item.usage_per_portion;
      const utilizationRate = item.effective_weight > 0 ? usedWeight / item.effective_weight : 0;
      return {
        material_name: item.material_name,
        utilization_rate: round(Math.min(utilizationRate, 1)),
        used_weight: round(usedWeight),
        remaining_weight: round(Math.max(item.effective_weight - usedWeight, 0)),
        is_bottleneck: bottleneckMaterials.includes(item.material_name)
      };
    });
    return {
      product_name: product.product_name || product.name || "",
      theoretical_max_portions: theoreticalMaxPortions,
      exact_capacity: round(exactCapacity),
      bottleneck_materials: bottleneckMaterials,
      unit_theoretical_cost: round(unitTheoreticalCost, 2),
      material_capacity_details: ingredientResults,
      material_utilization: materialUtilization,
      warnings: ingredientResults.map((item) => item.warning).filter(Boolean)
    };
  }

  function calculateYieldCapacity(payload) {
    const materials = Array.isArray(payload?.materials) ? payload.materials : [];
    const products = Array.isArray(payload?.products) ? payload.products : [];
    const materialAvailabilityList = materials.map(materialAvailability);
    const materialMap = new Map(materialAvailabilityList.map((item) => [item.material_name, item]));
    const productResults = products.map((product) => calculateProductCapacity(product, materialMap));
    const bottleneckCounts = new Map();
    productResults.forEach((product) => {
      product.bottleneck_materials.forEach((name) => bottleneckCounts.set(name, (bottleneckCounts.get(name) || 0) + 1));
    });
    return {
      schema_version: VERSION,
      calculated_at: new Date().toISOString(),
      material_availability: materialAvailabilityList,
      products: productResults,
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
    calculateYieldCapacity,
    materialAvailability,
    post
  };
});
