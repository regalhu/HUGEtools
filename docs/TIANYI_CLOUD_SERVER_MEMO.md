# HUGEtools 天翼云服务器备忘

更新时间：2026-06-18

## 当前入口

- 公网 IP：`113.249.104.188`
- SSH 用户：`root`
- SSH 端口：`22`
- 静态站点 URL：`http://113.249.104.188:18089/hugetools/`
- Web 根目录：`/var/www/hugetools`
- Nginx 配置：`/etc/nginx/conf.d/hugetools-mainland.conf`
- 推荐端口：`18089`

## 当前状态

- 天翼公网入口可返回 `200 OK`。
- 2026-06-18 检查时，公网版本记录仍为 `0.6.2`。
- 本地最新待同步版本为 `0.6.3`，标题为“应产率与产能计算工具”。
- 2026-06-18 检查时，SSH 连接在 banner 阶段超时，暂时无法直接登录服务器覆盖 `/var/www/hugetools`。

## 部署方式

在本地生成静态包后，上传到服务器 `/tmp/hugetools-static.tar.gz`，再在服务器执行：

```bash
ALLOWED_IPS="允许访问的公网 IP" \
PORT=18089 \
bash /path/to/tianyi-hugetools-server-setup.sh /tmp/hugetools-static.tar.gz
```

部署脚本会：

- 解压静态文件到 `/var/www/hugetools`。
- 写入或更新 `/etc/nginx/conf.d/hugetools-mainland.conf`。
- 为 `/hugetools/` 和 `/hugetools/data/` 设置 no-cache 或 must-revalidate 缓存头。
- 按 `ALLOWED_IPS` 生成 Nginx allowlist，并尝试同步 UFW 规则。
- 执行 `nginx -t` 并 reload/restart Nginx。

## 端口限制

用户确认：天翼云服务器默认封禁 `80`、`443`、`8080`、`8443` 端口。

后续部署时：

- 不要默认使用 `80`、`443`、`8080`、`8443`。
- 优先继续使用 `18089` 这类高位非标准端口。
- 防火墙、安全组、Nginx 监听端口和文档访问 URL 要保持一致。
- 如果公网请求不到 Nginx 日志，而服务器本机 `127.0.0.1:18089` 正常，应优先检查天翼云安全组、NAT 或外部转发策略。

## 安全提醒

- 不要把天翼云控制台密码、服务器 root 密码、SSH 私钥、AccessKey 或 SecretKey 写入仓库。
- 只记录凭据存放方式，不记录凭据明文。
- 本项目主体仍是静态页面；如后续接入后端，需要重新评估隐私说明、日志、备份和访问控制。
