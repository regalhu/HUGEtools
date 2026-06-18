(function () {
  const safeText = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function fallbackHistory() {
    return {
      currentVersion: "0.7.1",
      updatedAt: "2026-06-18",
      iterationRule: "每次功能更新都追加版本记录，保留上一版本基线、核心变化、验证结果和风险边界。",
      versions: [
        {
          version: "0.7.1",
          date: "2026-06-18",
          baseline: "0.7.0",
          title: "餐饮经营决策辅助系统",
          changes: ["新增快速、标准、专业三层测算模式。", "统一 Material、Product、Result JSON 结构。", "结果输出最大产能、瓶颈、单位成本、毛利率和经营建议。"],
          verification: ["版本档案读取失败时，不影响工具主体使用。"]
        }
      ]
    };
  }

  function injectStyles() {
    if (document.getElementById("version-archive-style")) return;
    const style = document.createElement("style");
    style.id = "version-archive-style";
    style.textContent = `
      .version-panel { margin-top: 18px; border: 1px solid var(--line, #dde6de); border-radius: 8px; background: #f7fbf8; padding: 14px; }
      .version-panel h2 { margin: 0 0 8px; font-size: 16px; }
      .version-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; color: var(--muted, #66736b); font-size: 12px; font-weight: 800; }
      .version-pill { border: 1px solid var(--line, #dde6de); border-radius: 999px; background: #fff; padding: 4px 8px; }
      .version-list { display: grid; gap: 10px; }
      .version-item { border-top: 1px solid var(--line, #dde6de); padding-top: 10px; }
      .version-item h3 { margin: 0 0 6px; font-size: 14px; }
      .version-item p, .version-item ul { margin: 0; color: var(--muted, #66736b); font-size: 12px; line-height: 1.7; }
      .version-item ul { padding-left: 18px; }
    `;
    document.head.appendChild(style);
  }

  function renderVersionArchive(data) {
    if (document.getElementById("versionArchive")) return;
    const footer = document.querySelector(".site-footer") || document.body;
    const versions = Array.isArray(data.versions) ? data.versions.slice(0, 4) : [];
    const current = versions[0] || {};
    const section = document.createElement("section");
    section.className = "version-panel";
    section.id = "versionArchive";
    section.innerHTML = `
      <h2>版本与迭代记录</h2>
      <div class="version-meta">
        <span class="version-pill">当前版本 ${safeText(data.currentVersion || current.version || "-")}</span>
        <span class="version-pill">更新日期 ${safeText(data.updatedAt || current.date || "-")}</span>
        <span class="version-pill">对比基线 ${safeText(current.baseline || "-")}</span>
      </div>
      <div class="version-item">
        <p>${safeText(data.iterationRule || "每次更新都和上一版本进行对比，再记录本次变化与验证结果。")}</p>
      </div>
      <div class="version-list">
        ${versions.map((item) => `
          <article class="version-item">
            <h3>${safeText(item.version)} · ${safeText(item.title)}</h3>
            <p>日期：${safeText(item.date)}；对比：${safeText(item.baseline || "-")}</p>
            <ul>${(item.changes || []).slice(0, 3).map((change) => `<li>${safeText(change)}</li>`).join("")}</ul>
            <p>验证：${safeText((item.verification || []).join("；") || "待补充")}</p>
          </article>
        `).join("")}
      </div>
    `;
    footer.insertAdjacentElement(footer === document.body ? "beforeend" : "beforebegin", section);
  }

  async function init() {
    injectStyles();
    try {
      const response = await fetch("./data/version-history.json", { cache: "no-store" });
      if (!response.ok) throw new Error("version history unavailable");
      renderVersionArchive(await response.json());
    } catch (_) {
      renderVersionArchive(fallbackHistory());
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
