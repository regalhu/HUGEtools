const express = require("express");
const path = require("path");
const { calculateYieldCapacity } = require("./yield-calculator.js");

const app = express();
const PORT = Number(process.env.PORT || 18089);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;

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

app.post("/calculate-yield", calculateYield);
app.post("/api/calculate-yield", calculateYield);

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
