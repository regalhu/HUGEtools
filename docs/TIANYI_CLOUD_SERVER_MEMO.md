# HUGEtools 天翼云服务器备忘

更新时间：2026-06-22

## 当前入口

- 公网 IP：`113.249.104.188`
- SSH 用户：`root`
- SSH 端口：`22`
- 标准生产入口：`http://113.249.104.188:18089/`
- Web 根目录：`/www/hugetools`
- Nginx 配置：`/etc/nginx/conf.d/hugetools-saas.conf`
- Nginx 公网监听：`0.0.0.0:18089`
- Node 生产服务：`127.0.0.1:18088`
- Node Webhook 服务：`127.0.0.1:18090`

## 当前状态

- 2026-06-22 检查时，`http://113.249.104.188:18089/` 返回 Nginx 默认页。
- 2026-06-22 检查时，`http://113.249.104.188:18089/hugetools/` 返回 `403 Forbidden`。
- 2026-06-22 检查时，SSH 到 `root@113.249.104.188:22` 仍卡在 `Connection timed out during banner exchange`。
- 本地最新待同步版本为 `0.7.4`，标题为“门店选址评估工具”。
- 2026-06-22 复查时，GitHub `main` 已到 `d447e0c`，但云服务器公网入口仍未加载 HUGEtools 应用；`root@113.249.104.188:22` 仍卡在 `Connection timed out during banner exchange`，需恢复 SSH 或通过天翼云控制台执行 `/root/deploy.sh`。
- 当前部署目标是 Nginx 公网监听 `18089`，反向代理到本机 Node `18088`，Webhook 监听本机 `18090`。

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

天翼云目标端口保持为 `18089`。

后续部署时：

- `18089` 是用户访问入口，由 Nginx 公网监听。
- `18088` 只允许本机访问，用于 Node 生产服务。
- `18090` 只允许本机访问，用于 Node Webhook 服务。
- `22` 只允许 `166.0.17.12/32`。
- 防火墙、安全组、Nginx 监听端口和文档访问 URL 要保持一致。

## 安全提醒

- 不要把天翼云控制台密码、服务器 root 密码、SSH 私钥、AccessKey 或 SecretKey 写入仓库。
- 只记录凭据存放方式，不记录凭据明文。
- 本项目主体仍是静态页面；如后续接入后端，需要重新评估隐私说明、日志、备份和访问控制。
