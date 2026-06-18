# HUGEtools SaaS 部署与安全运行手册

更新时间：2026-06-18

## 目标架构

```text
用户访问
  -> Nginx 80/443 统一入口
  -> Node 应用服务 127.0.0.1:18089
  -> GitHub main/staging 唯一代码源
  -> Webhook/CI 触发器 127.0.0.1:18090
```

生产入口只暴露 `80/443`。`18089` 和 `18090` 只监听本机，不作为公网入口。

## 本地发布规范

固定流程：

```bash
git add .
git commit -m "version update"
git push origin main
```

灰度测试使用：

```bash
git checkout staging
git merge main
git push origin staging
```

分支约定：

```text
main    -> production -> /www/hugetools -> 127.0.0.1:18089
staging -> test       -> /www/hugetools-staging -> 127.0.0.1:18091
```

## 服务器目录

```text
/www/hugetools
/www/hugetools-staging
```

首次初始化：

```bash
git clone git@github.com:regalhu/HUGEtools.git /www/hugetools
git clone git@github.com:regalhu/HUGEtools.git /www/hugetools-staging
```

后续所有更新均来自 GitHub：

```bash
cd /www/hugetools
git pull origin main
```

SCP 上传发布包已废弃。

## 一键初始化

在天翼云控制台或 SSH 中以 root 执行：

```bash
cd /tmp
rm -rf HUGEtools-main hugetools-main.tar.gz
curl -L https://github.com/regalhu/HUGEtools/archive/refs/heads/main.tar.gz -o hugetools-main.tar.gz
tar -xzf hugetools-main.tar.gz

REPO_URL="git@github.com:regalhu/HUGEtools.git" \
APP_DIR="/www/hugetools" \
BRANCH="main" \
DOMAIN="your-domain.com" \
WEB_PORT="18089" \
WEBHOOK_PORT="18090" \
STAGING_PORT="18091" \
SSH_ALLOW_IP="166.0.17.12" \
bash /tmp/HUGEtools-main/deploy/server/bootstrap-tianyi.sh
```

脚本会安装：

- `/root/deploy.sh`
- `/root/deploy-staging.sh`
- `/root/rollback.sh`
- `/etc/systemd/system/hugetools.service`
- `/etc/systemd/system/hugetools-staging.service`
- `/etc/systemd/system/hugetools-webhook.service`
- `/etc/nginx/conf.d/hugetools-saas.conf`
- `/etc/fail2ban/jail.d/sshd.local`
- `/etc/ssh/sshd_config.d/99-hugetools-hardening.conf`

## systemd 服务

生产服务：

```ini
[Unit]
Description=hugetools service
After=network.target

[Service]
WorkingDirectory=/www/hugetools
ExecStart=/usr/bin/node server.js
Restart=always
User=root
Environment=HOST=127.0.0.1
Environment=PORT=18089

[Install]
WantedBy=multi-user.target
```

Webhook 服务：

```text
hugetools-webhook.service -> /usr/bin/node webhook.js -> 127.0.0.1:18090
```

检查命令：

```bash
systemctl status hugetools --no-pager
systemctl status hugetools-webhook --no-pager
ss -lntp | egrep ':(80|443|18089|18090|18091)'
```

## Nginx 统一入口

模板文件：

```text
deploy/nginx-hugetools-saas.conf
```

核心结构：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:18089;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /webhook {
        proxy_pass http://127.0.0.1:18090;
        allow 166.0.17.12;
        deny all;
    }
}
```

SSL 预留在同一模板中。域名和备案完成后建议用 Let's Encrypt：

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

## 自动部署

GitHub Webhook：

```text
Payload URL: http://your-domain.com/webhook
Content type: application/json
Secret: /etc/hugetools/webhook.env 中的 GITHUB_WEBHOOK_SECRET
Events: push
```

Webhook 行为：

```text
push refs/heads/main    -> /root/deploy.sh
push refs/heads/staging -> /root/deploy-staging.sh
```

Webhook 安全：

- Node 服务仅监听 `127.0.0.1:18090`。
- Nginx `/webhook` 入口带 IP allow/deny。
- 应用层必须通过 `X-Hub-Signature-256` 做 HMAC SHA256 校验。
- 如使用 GitHub 公网直连 Webhook，需要在 Nginx allowlist 中加入 GitHub hook CIDR，或使用可信 CI/内网触发器转发。

## 部署脚本

生产：

```bash
/root/deploy.sh
```

逻辑：

```bash
cd /www/hugetools
git fetch origin
git checkout main
git pull origin main
npm install || true
systemctl restart hugetools
```

灰度：

```bash
/root/deploy-staging.sh
```

## 版本与灰度

版本打 tag：

```bash
git tag v0.7.0
git push origin v0.7.0
```

灰度发布：

```bash
git checkout staging
git merge main
git push origin staging
```

生产发布：

```bash
git checkout main
git merge staging
git push origin main
```

## 一键回滚

默认回退上一个提交：

```bash
/root/rollback.sh
```

回退到指定 tag/commit：

```bash
/root/rollback.sh v0.7.0
/root/rollback.sh <commit>
```

脚本会：

1. 打印最近 5 条提交。
2. `git reset --hard <target>`。
3. `systemctl restart hugetools`。
4. 写入 `/var/log/hugetools/deploy.log`。

## 安全策略

端口开放：

| 服务 | 端口 | 公网策略 |
|---|---:|---|
| HTTP | 80 | 开放 |
| HTTPS | 443 | 开放 |
| Node 生产服务 | 18089 | 仅本机 |
| Node Webhook | 18090 | 仅本机 |
| Node staging | 18091 | 仅本机 |
| SSH | 22 | 仅 `166.0.17.12/32` |

SSH 加固：

```text
UseDNS no
PrintMotd no
PasswordAuthentication no
PermitRootLogin prohibit-password
LoginGraceTime 20
MaxStartups 3:30:10
```

fail2ban：

```bash
systemctl status fail2ban --no-pager
fail2ban-client status sshd
```

## 验证

生产版本：

```bash
curl -fsS http://your-domain.com/data/version-history.json | python3 -m json.tool | head
```

本机服务：

```bash
curl -fsS http://127.0.0.1:18089/health
curl -fsS http://127.0.0.1:18090/health
```

日志：

```bash
tail -f /var/log/hugetools/deploy.log
journalctl -u hugetools -f
journalctl -u hugetools-webhook -f
```
