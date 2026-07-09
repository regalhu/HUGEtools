const express = require("express");
const path = require("path");
const QRCode = require("qrcode");
const { calculateYieldCapacity } = require("./yield-calculator.js");
const { calculateSiteSelection } = require("./site-selection-calculator.js");

const app = express();
const PORT = Number(process.env.PORT || 18089);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const WECHAT_API_BASE = "https://api.weixin.qq.com";
let wechatTokenCache = { token: "", expiresAt: 0 };

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hugetools", version: process.env.HUGETOOLS_VERSION || "local" });
});

function calculateYield(req, res) {
  try {
    res.json(calculateYieldCapacity(req.body || {}));
  } catch (error) {
    res.status(400).json({
      error: "invalid_payload",
      message: error.message || "Invalid yield calculation payload."
    });
  }
}

function calculateSite(req, res) {
  try {
    res.json(calculateSiteSelection(req.body || {}));
  } catch (error) {
    res.status(400).json({
      error: "invalid_payload",
      message: error.message || "Invalid site selection payload."
    });
  }
}

async function getWechatAccessToken() {
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_APPSECRET;
  if (!appid || !secret) {
    const error = new Error("WECHAT_APPID and WECHAT_APPSECRET are required on the server.");
    error.code = "wechat_not_configured";
    throw error;
  }

  if (wechatTokenCache.token && Date.now() < wechatTokenCache.expiresAt) {
    return wechatTokenCache.token;
  }

  const url = `${WECHAT_API_BASE}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`;
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    const error = new Error(payload.errmsg || "Unable to fetch WeChat access token.");
    error.code = "wechat_token_failed";
    throw error;
  }

  wechatTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(Number(payload.expires_in || 7200) - 300, 60) * 1000
  };
  return wechatTokenCache.token;
}

async function renderShareQr(req, res) {
  const text = String(req.query.text || "").trim();
  if (!text || text.length > 500) {
    res.status(400).json({ error: "invalid_text", message: "Share QR text is required and must be under 500 characters." });
    return;
  }

  try {
    const svg = await QRCode.toString(text, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 360
    });
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(svg);
  } catch (error) {
    res.status(500).json({ error: "qr_render_failed", message: error.message || "Unable to render QR code." });
  }
}

async function renderMiniProgramCode(req, res) {
  const scene = String(req.body?.scene || req.query.scene || "share=home").slice(0, 32);
  const page = String(req.body?.page || req.query.page || "pages/index/index").replace(/^\//, "");

  try {
    const token = await getWechatAccessToken();
    const response = await fetch(`${WECHAT_API_BASE}/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scene,
        page,
        check_path: false,
        env_version: process.env.WECHAT_MINIPROGRAM_ENV || "release"
      })
    });
    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());

    if (contentType.includes("application/json")) {
      const payload = JSON.parse(buffer.toString("utf8"));
      res.status(502).json({
        error: "wechat_qrcode_failed",
        message: payload.errmsg || "WeChat mini program code API returned an error.",
        code: payload.errcode
      });
      return;
    }

    res.json({
      ok: true,
      contentType: contentType || "image/png",
      imageBase64: buffer.toString("base64"),
      page,
      scene
    });
  } catch (error) {
    res.status(error.code === "wechat_not_configured" ? 501 : 502).json({
      error: error.code || "wechat_qrcode_failed",
      message: error.message || "Unable to generate WeChat mini program code."
    });
  }
}

app.post("/calculate-yield", calculateYield);
app.post("/api/calculate-yield", calculateYield);
app.post("/calculate-site-selection", calculateSite);
app.post("/api/calculate-site-selection", calculateSite);
app.get("/api/share-qr.svg", renderShareQr);
app.post("/api/miniprogram-code", renderMiniProgramCode);

app.use(express.static(ROOT, {
  etag: true,
  maxAge: 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith(".js") || filePath.endsWith(".css")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return;
    }
    if (filePath.includes(`${path.sep}data${path.sep}`)) {
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      return;
    }
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
  }
}));

app.get("*", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`hugetools service listening at http://${HOST}:${PORT}`);
});
