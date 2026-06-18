# HUGEtools 天翼云服务器备忘

更新时间：2026-06-18

## 当前入口

- 公网 IP：`113.249.104.188`
- SSH 用户：`root`
- SSH 端口：`22`
- 标准生产入口：`http://your-domain.com/`，SSL 完成后使用 `https://your-domain.com/`
- 临时公网入口：如 80/443 未就绪，可暂用已有高位端口方案
- Web 根目录：`/www/hugetools`
- Nginx 配置：`/etc/nginx/conf.d/hugetools-saas.conf`
- Node 生产服务：`127.0.0.1:18089`
- Node Webhook 服务：`127.0.0.1:18090`

## 当前状态

- 天翼公网入口可返回 `200 OK`。
- 2026-06-18 检查时，公网版本记录仍为 `0.6.2`。
- 本地最新待同步版本为 `0.6.3`，标题为“应产率与产能计算工具”。
- 2026-06-18 已升级为 SaaS 级部署目标：Nginx 80/443 统一入口，Node 服务监听本机 `18089`，Webhook 监听本机 `18090`。

## 部署方式

生产环境不再使用 SCP 上传静态包。服务器部署统一执行：

```bash
/root/deploy.sh
```

部署脚本会：

- 进入 `/www/hugetools`。
- 执行 `git fetch origin main --prune`。
- 执行 `git pull --ff-only origin main`。
- 执行 `npm install || true`。
- 执行 `systemctl restart hugetools`。
- 写入 `/var/log/hugetools/deploy.log`。

首次初始化和 Webhook 自动部署说明见：

```text
docs/DEVOPS_RUNBOOK.md
```

## 端口策略

SaaS 标准入口优先使用 `80/443`，需要域名、备案和 SSL 配置配套完成。

后续部署时：

- `80/443` 是用户访问入口。
- `18089` 只允许本机访问，用于 Node 生产服务。
- `18090` 只允许本机访问，用于 Node Webhook 服务。
- `22` 只允许 `166.0.17.12/32`。
- 防火墙、安全组、Nginx 监听端口和文档访问 URL 要保持一致。
- 如果天翼云 80/443 暂不可用，可临时保留高位端口测试入口，但最终生产标准仍应回到域名 + 80/443。

## 安全提醒

- 不要把天翼云控制台密码、服务器 root 密码、SSH 私钥、AccessKey 或 SecretKey 写入仓库。
- 只记录凭据存放方式，不记录凭据明文。
- 本项目主体仍是静态页面；如后续接入后端，需要重新评估隐私说明、日志、备份和访问控制。
