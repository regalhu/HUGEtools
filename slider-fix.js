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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
