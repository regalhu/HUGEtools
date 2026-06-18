#!/usr/bin/env python3
import hashlib
import hmac
import json
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


HOST = os.getenv("WEBHOOK_HOST", "0.0.0.0")
PORT = int(os.getenv("WEBHOOK_PORT", "18090"))
SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")
DEPLOY_SCRIPT = os.getenv("DEPLOY_SCRIPT", "/root/deploy.sh")
DEPLOY_BRANCH = os.getenv("DEPLOY_BRANCH", "main")
LOG_FILE = os.getenv("WEBHOOK_LOG_FILE", "/var/log/hugetools/webhook.log")


def log(message):
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as fh:
        fh.write(message + "\n")


def verify_signature(body, signature_header):
    if not SECRET:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    received = signature_header.split("=", 1)[1]
    return hmac.compare_digest(expected, received)


def run_deploy(delivery):
    try:
        log(f"deploy start delivery={delivery}")
        completed = subprocess.run(
            ["bash", DEPLOY_SCRIPT],
            text=True,
            capture_output=True,
            timeout=300,
            check=False,
        )
        log(f"deploy exit={completed.returncode} delivery={delivery}")
        if completed.stdout:
            log("stdout:\n" + completed.stdout.strip())
        if completed.stderr:
            log("stderr:\n" + completed.stderr.strip())
    except Exception as exc:
        log(f"deploy error delivery={delivery}: {exc}")


class Handler(BaseHTTPRequestHandler):
    server_version = "HugeToolsWebhook/1.0"

    def do_GET(self):
        if self.path == "/health":
            self.respond(200, {"ok": True})
            return
        self.respond(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/webhook":
            self.respond(404, {"error": "not_found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        delivery = self.headers.get("X-GitHub-Delivery", "unknown")
        event = self.headers.get("X-GitHub-Event", "")

        if not verify_signature(body, self.headers.get("X-Hub-Signature-256", "")):
            log(f"reject invalid signature delivery={delivery}")
            self.respond(401, {"error": "invalid_signature"})
            return

        if event != "push":
            self.respond(202, {"ok": True, "ignored": f"event {event}"})
            return

        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            self.respond(400, {"error": "invalid_json"})
            return

        ref = payload.get("ref", "")
        if ref != f"refs/heads/{DEPLOY_BRANCH}":
            self.respond(202, {"ok": True, "ignored": ref})
            return

        threading.Thread(target=run_deploy, args=(delivery,), daemon=True).start()
        self.respond(202, {"ok": True, "delivery": delivery, "deploy": "started"})

    def log_message(self, fmt, *args):
        log("%s - %s" % (self.address_string(), fmt % args))

    def respond(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    log(f"webhook listening host={HOST} port={PORT} branch={DEPLOY_BRANCH}")
    httpd.serve_forever()
