const crypto = require("crypto");
const { execFile } = require("child_process");
const express = require("express");

const app = express();
const PORT = Number(process.env.WEBHOOK_PORT || 18090);
const HOST = process.env.WEBHOOK_HOST || "127.0.0.1";
const SECRET = process.env.GITHUB_WEBHOOK_SECRET || "REPLACE_WITH_SECRET";
const PROD_SCRIPT = process.env.PROD_DEPLOY_SCRIPT || "/root/deploy.sh";
const STAGING_SCRIPT = process.env.STAGING_DEPLOY_SCRIPT || "/root/deploy-staging.sh";

app.disable("x-powered-by");

app.use(express.raw({
  type: "application/json",
  limit: "1mb"
}));

function verifySignature(req) {
  if (!SECRET || SECRET === "REPLACE_WITH_SECRET") {
    return false;
  }
  const sig = req.headers["x-hub-signature-256"];
  if (!sig || !sig.startsWith("sha256=")) return false;
  const hash = "sha256=" + crypto.createHmac("sha256", SECRET).update(req.body).digest("hex");
  const received = Buffer.from(sig);
  const expected = Buffer.from(hash);
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(received, expected);
}

function runDeploy(script, delivery) {
  execFile("bash", [script], { timeout: 300000 }, (error, stdout, stderr) => {
    const status = error ? `failed code=${error.code || "unknown"}` : "success";
    console.log(`[${new Date().toISOString()}] delivery=${delivery} ${status}`);
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
  });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hugetools-webhook" });
});

app.post("/webhook", (req, res) => {
  if (!verifySignature(req)) {
    return res.status(403).send("invalid signature");
  }

  const event = req.headers["x-github-event"];
  const delivery = req.headers["x-github-delivery"] || "unknown";
  if (event !== "push") {
    return res.status(202).send("ignored event");
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch (_error) {
    return res.status(400).send("invalid json");
  }

  if (payload.ref === "refs/heads/main") {
    runDeploy(PROD_SCRIPT, delivery);
    return res.send("prod deploy started");
  }

  if (payload.ref === "refs/heads/staging") {
    runDeploy(STAGING_SCRIPT, delivery);
    return res.send("staging deploy started");
  }

  return res.status(202).send("ignored branch");
});

app.listen(PORT, HOST, () => {
  console.log(`hugetools webhook listening at http://${HOST}:${PORT}`);
});
