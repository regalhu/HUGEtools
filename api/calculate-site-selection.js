const { calculateSiteSelection } = require("../site-selection-calculator.js");

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed", message: "Use POST /calculate-site-selection." });
    return;
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    res.status(200).json(calculateSiteSelection(payload || {}));
  } catch (error) {
    res.status(400).json({
      error: "invalid_payload",
      message: error.message || "Invalid site selection payload."
    });
  }
};
