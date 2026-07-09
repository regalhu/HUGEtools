(function () {
  const safeText = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function fallbackHistory() {
    return {
      currentVersion: "0.7.9",
      updatedAt: "2026-07-09",
      iterationRule: "每次功能更新都追加版本记录，保留上一版本基线、核心变化、验证结果和风险边界。",
      versions: [
        {
          version: "0.7.9",
          date: "2026-07-09",
          baseline: "0.7.8",
          title: "门店营业额联合分析",
          changes: ["新增门店营业额联合分析工具。", "支持门店名称标准化、可比营业额截取和覆盖率异常提示。", "同步 Web 和小程序端 13 个工具入口。"],
          verification: ["版本档案读取失败时，不影响工具主体使用。"]
        }
      ]
    };
  }

  function publicChangeText(change) {
    return String(change)
      .replace(/JSON Schema/g, "数据结构")
      .replace(/api\/\*\.js/gi, "服务文件")
      .replace(/api\/[a-z0-9-]+\.js/gi, "服务文件")
      .replace(/schemas\/[a-z0-9-]+\.schema\.json/gi, "字段配置")
      .replace(/schema\.json/gi, "字段配置")
      .replace(/JSON 校验/g, "格式校验")
      .replace(/JSON/g, "数据")
      .replace(/封面图生成能力/g, "封面拍摄指导能力")
      .replace(/POST \/api\/[a-z0-9-]+/gi, "服务端测算")
      .replace(/POST \/[a-z0-9-]+/gi, "服务端测算")
      .replace(/API 契约/g, "复用能力")
      .replace(/API 调用/g, "多端复用")
      .replace(/API/g, "服务能力");
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
            <ul>${(item.changes || []).slice(0, 3).map((change) => `<li>${safeText(publicChangeText(change))}</li>`).join("")}</ul>
            <p>验证：${safeText(publicChangeText((item.verification || []).join("；") || "待补充"))}</p>
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
