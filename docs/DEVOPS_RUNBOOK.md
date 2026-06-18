# HUGEtools DevOps 部署与安全运行手册

更新时间：2026-06-18

## 目标链路

```text
本地开发 -> GitHub main -> 天翼云 /www/hugetools -> Nginx 18089 生产入口
```

本项目不再使用 SCP 上传发布包。生产环境统一使用 Git 拉取：

```bash
git pull origin main
```

## 本地发布流程

固定使用：

```bash
git add .
git commit -m "version update"
git push origin main
```

推送后有两种生产更新方式：

- 半自动：登录服务器执行 `/root/deploy.sh`。
- 自动：GitHub Webhook 请求服务器 `/webhook`，自动执行 `/root/deploy.sh`。

## 服务器目录

统一目录：

```text
/www/hugetools
```

首次初始化：

```bash
git clone git@github.com:regalhu/HUGEtools.git /www/hugetools
```

后续更新：

```bash
cd /www/hugetools
git pull origin main
```

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
WEB_PORT="18089" \
WEBHOOK_PORT="18090" \
SSH_ALLOW_IP="166.0.17.12" \
bash /tmp/HUGEtools-main/deploy/server/bootstrap-tianyi.sh
```

脚本会安装：

- `/root/deploy.sh`
- `/root/rollback-hugetools.sh`
- `/etc/systemd/system/huge-tools.service`
- `/etc/systemd/system/hugetools-webhook.service`
- `/etc/nginx/conf.d/hugetools-mainland.conf`
- `/etc/fail2ban/jail.d/sshd.local`
- `/etc/ssh/sshd_config.d/99-hugetools-hardening.conf`

## 手动部署

```bash
/root/deploy.sh
```

部署脚本逻辑：

1. 进入 `/www/hugetools`。
2. `git fetch origin main --prune`。
3. `git pull --ff-only origin main`。
4. `systemctl restart huge-tools`。
5. 写入 `/var/log/hugetools/deploy.log`。

## 回滚

回滚到某个 commit 或 tag：

```bash
/root/rollback-hugetools.sh <commit-or-tag>
```

建议每次稳定版本打 tag：

```bash
git tag v0.6.3
git push origin v0.6.3
```

服务器回滚：

```bash
/root/rollback-hugetools.sh v0.6.3
```

## GitHub Webhook

服务端：

```text
Webhook URL: http://113.249.104.188:18090/webhook
Health URL:  http://113.249.104.188:18090/health
```

GitHub 仓库设置：

- Settings -> Webhooks -> Add webhook
- Payload URL：`http://113.249.104.188:18090/webhook`
- Content type：`application/json`
- Secret：使用 `/etc/hugetools/webhook.env` 中的 `GITHUB_WEBHOOK_SECRET`
- Events：Just the push event

Webhook 收到 `refs/heads/main` 的 push 后，会自动执行：

```bash
bash /root/deploy.sh
```

日志：

```bash
tail -f /var/log/hugetools/webhook.log
tail -f /var/log/hugetools/deploy.log
```

## SSH 安全加固

SSH 只允许指定 IP：

```text
166.0.17.12/32
```

禁止：

```text
0.0.0.0/0
```

SSH 配置落在：

```text
/etc/ssh/sshd_config.d/99-hugetools-hardening.conf
```

关键配置：

```text
UseDNS no
PrintMotd no
LoginGraceTime 20
MaxStartups 3:30:10
PasswordAuthentication no
PermitRootLogin prohibit-password
```

fail2ban 配置：

```text
/etc/fail2ban/jail.d/sshd.local
```

检查命令：

```bash
systemctl status ssh --no-pager
systemctl status fail2ban --no-pager
fail2ban-client status sshd
ss -lntp | grep ':22'
```

## 生产访问验证

公网入口：

```text
http://113.249.104.188:18089/hugetools/
```

版本验证：

```bash
curl -fsS "http://113.249.104.188:18089/hugetools/data/version-history.json" | python3 -m json.tool | head
```

测试用户访问要求：

- 天翼云安全组入方向允许 TCP `18089`。
- Linux 防火墙允许 TCP `18089`。
- Nginx `/hugetools/` 不加 `allow/deny` 用户 IP 白名单，除非只做小范围内测。
- 如果只允许指定测试用户访问，应在天翼云安全组中加入测试用户公网 IP，而不是限制应用文件。

## 多环境预留

建议后续分支与目录：

```text
main -> /www/hugetools-prod
test -> /www/hugetools-test
```

端口建议：

```text
prod: 18089
webhook: 18090
test: 18091
```

脚本已经支持环境变量：

```bash
APP_DIR=/www/hugetools-test BRANCH=test SERVICE_NAME=huge-tools-test /root/deploy.sh
```

## 运维原则

- 发布基于 Git，不使用 SCP 传包。
- GitHub 是版本源，服务器只拉取。
- Webhook 必须设置 secret。
- SSH 只对白名单 IP 开放。
- `18089` 是用户访问端口，不是部署端口。
- 每次生产更新后检查版本记录与页面加载。
