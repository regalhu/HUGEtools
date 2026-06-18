# 中国大陆公网访问检查报告

检查日期：2026-06-10

## 结论

当前项目已经部署到 Vercel 生产域名：

```text
https://hugetools.vercel.app
```

但它目前不能作为中国大陆公网稳定入口。北京、深圳大陆节点对 Vercel 生产域名访问失败，表现为 HTTPS 443 连接超时；上海节点测试过程中连接中断，不能证明可用。

当前可行的修复方向是：保留 Vercel 作为海外/备用入口，同时在中国大陆可访问的服务器上部署静态镜像，并避开天翼云默认封禁端口 `80`、`443`、`8080`、`8443`。本项目静态资源已经使用相对路径，适合部署到 `/hugetools/` 子路径。

## 已执行测试

### 0. 复测说明

用户反馈：本机挂 VPN 后可以正常打开 Vercel 链接。因此本报告区分三种访问方式：

1. 本机/海外出口公网访问。
2. 第三方国际公网节点访问。
3. 中国大陆公网节点访问。

### 1. 本机到 Vercel

命令：

```bash
curl -I --max-time 20 https://hugetools.vercel.app/
curl -I --max-time 20 https://hugetools.vercel.app/data/version-history.json
```

结果：

```text
https://hugetools.vercel.app/                         HTTP/2 200
https://hugetools.vercel.app/data/version-history.json HTTP/2 200
```

说明：Vercel 生产域名从当前网络可访问，但这不能代表中国大陆公网可用。

### 2. 国际公网节点到 Vercel

测试入口：Check-Host HTTP test。

测试 URL：

```text
https://hugetools.vercel.app/
```

结果摘要：

| 节点区域 | 结果 |
| --- | --- |
| 美国 | `HTTP 200` |
| 欧洲 | `HTTP 200` |
| 印度 | `HTTP 200` |

判断：Vercel 生产域名在国际公网可访问，站点本身和 Vercel 部署不是故障点。

### 3. 大陆节点到 Vercel

测试入口：AppInChina Website Tester 的北京、上海、深圳节点接口。

测试 URL：

```text
https://hugetools.vercel.app/
```

结果摘要：

| 节点 | 结果 | 细节 |
| --- | --- | --- |
| 北京 | 不可达 | `Connection timeout to 52.175.9.80:443`，`Unreachable / Severely Limited` |
| 上海 | 超时 | quick-check 返回 `408`，不能证明可用 |
| 深圳 | 不可达 | `Connection timeout to 173.208.182.68:443`，`Unreachable / Severely Limited` |

判断：当前 Vercel 入口不满足“中国大陆公网也能浏览并使用”的要求。

### 4. 天翼云候选服务器

候选公网 IP：

```text
113.249.104.188
```

已知端口约束：

```text
天翼云默认封禁 80 / 443 / 8080 / 8443
```

测试结果：

```text
113.249.104.188:22   TCP 可连接，但 SSH banner 超时
113.249.104.188:3389 TCP 可连接，但 HTTP 请求无响应
```

执行过的 HTTP 测试：

```bash
curl -I --max-time 10 http://113.249.104.188:3389/
curl -v --http1.1 --max-time 15 http://113.249.104.188:3389/hugetools/
```

结果：均连接后等待到超时，没有返回 HTTP 响应。

当前阻塞：无法通过 SSH 登录服务器，不能远程创建目录、上传文件或修改 Nginx 配置。

## 静态资源路径检查

入口文件：

```text
index.html
```

资源路径：

```text
./styles.css
./app.js?v=macos-compat-1
./slider-fix.js?v=1
./version-archive.js?v=macos-compat-1
./data/version-history.json
```

结论：资源使用相对路径，适合根路径部署，也适合部署到 `/hugetools/` 子路径。

## 推荐修复方案

### 方案 A：天翼云静态镜像

推荐公网入口：

```text
http://113.249.104.188:3389/hugetools/
```

前提：

1. 修复 SSH banner 超时问题，确保可以登录 `root@113.249.104.188`。
2. 修复 `3389` 上 HTTP 连接后不响应的问题。
3. 确认安全组和系统防火墙开放 `3389`。
4. 不使用 `80`、`443`、`8080`、`8443`，除非已经在天翼云侧确认解封。

部署目录建议：

```text
/var/www/hugetools
```

需要上传的文件：

```text
index.html
styles.css
app.js
slider-fix.js
version-archive.js
data/version-history.json
DISCLAIMER.md
PRIVACY.md
.nojekyll
```

### 方案 B：国内 CDN / 国内对象存储静态站点

如果天翼云服务器短期内不能恢复 SSH，建议使用已备案域名接入国内 CDN 或国内对象存储静态网站托管。

注意：

1. 中国大陆标准 Web 访问通常需要域名备案。
2. 如果继续使用 Vercel 源站，国内 CDN 回源仍可能遇到跨境链路波动。
3. 更稳妥做法是把静态文件直接托管在国内对象存储或国内服务器。

## 下一步清单

1. 在天翼云控制台检查 `113.249.104.188` 的云主机状态、CPU/内存/带宽是否异常。
2. 检查安全组：确认 `22` 和 `3389` 放行，且没有只允许特定来源 IP。
3. 登录服务器控制台/VNC，检查 SSH：

```bash
systemctl status sshd
journalctl -u sshd -n 100 --no-pager
ss -lntp | grep ':22'
```

4. 检查 `3389` 上的 Web 服务：

```bash
ss -lntp | grep ':3389'
curl -I --max-time 5 http://127.0.0.1:3389/
nginx -t
systemctl status nginx
```

5. 恢复 SSH 后，上传静态文件到 `/var/www/hugetools`。
6. 使用 `deploy/nginx-hugetools-subpath.conf` 中的配置挂载 `/hugetools/`。
7. 执行：

```bash
nginx -t
systemctl reload nginx
curl -I http://113.249.104.188:3389/hugetools/
curl -I http://113.249.104.188:3389/hugetools/data/version-history.json
```

8. 再用大陆节点复测：

```text
http://113.249.104.188:3389/hugetools/
```

## 2026-06-10 远程部署尝试

用户要求直接在 `113.249.104.188` 上部署国内镜像，并限制为测试人员 IP 访问。

本次最初选择端口：

```text
8888
```

原因：

- `8080` 在已知天翼云默认封禁端口列表中，不作为优先选择。
- `8888` 不在已知默认封禁列表中。

执行结果：

```text
113.249.104.188:22   TCP connected, but SSH banner timeout
113.249.104.188:8888 TCP connected, but HTTP request timeout with 0 bytes received
113.249.104.188:8080 TCP connected, but HTTP request timeout with 0 bytes received
113.249.104.188:3389 TCP connected, but HTTP request timeout with 0 bytes received
```

上传尝试：

```bash
scp -o BatchMode=yes -o ConnectTimeout=12 \
  artifacts/hugetools-mainland-static-20260610.tar.gz \
  root@113.249.104.188:/tmp/hugetools-mainland-static-20260610.tar.gz
```

结果：

```text
Connection timed out during banner exchange
scp: Connection closed
```

结论：当前不能通过 SSH/SCP 执行远程部署。需要先通过天翼云控制台/VNC 修复 SSH 或提供其他可用的远程执行通道。

已准备服务器侧部署脚本：

```text
deploy/tianyi-hugetools-server-setup.sh
```

该脚本会：

1. 解压发布包到 `/var/www/hugetools`。
2. 写入 Nginx server 配置。
3. 默认监听 `18089`。
4. 挂载 `/hugetools/` 子路径。
5. 使用 Nginx `allow/deny` 限制测试人员 IP。
6. 执行 `nginx -t` 并重载 Nginx。

服务器恢复后，可在服务器控制台执行：

```bash
mkdir -p /tmp
# 先把 artifacts/hugetools-mainland-static-20260610.tar.gz 上传到 /tmp/

ALLOWED_IPS="测试人员公网IP1,测试人员公网IP2" \
PORT=18089 \
bash /path/to/tianyi-hugetools-server-setup.sh /tmp/hugetools-mainland-static-20260610.tar.gz
```

测试地址：

```text
http://113.249.104.188:18089/hugetools/
```

如果有二级域名，请将二级域名 A 记录解析到 `113.249.104.188`，并使用：

```text
http://你的二级域名:18089/hugetools/
```

## 2026-06-10 SSH 修复后复测

用户反馈 SSH 已修复，重新测试后结果如下：

```text
113.249.104.188:22   TCP connected
ssh root@113.249.104.188   Permission denied (publickey,password)
ssh ubuntu@113.249.104.188 Permission denied (publickey,password)
ssh admin@113.249.104.188  Permission denied (publickey,password)
ssh ecs-user@113.249.104.188 Permission denied (publickey,password)
```

判断：

1. SSH banner 超时问题已消失，SSH 服务已进入认证阶段。
2. 当前本机没有被服务器接受的密钥，且没有可用的非交互式密码凭据。
3. 仍无法执行上传、解压、Nginx 配置或服务重载。

下一步需要任选其一：

1. 将本机公钥加入服务器对应用户的 `~/.ssh/authorized_keys`。
2. 在本机配置可用的服务器私钥，并确认 `ssh root@113.249.104.188` 可免密登录。
3. 在天翼云控制台/VNC 上手动执行 `deploy/tianyi-hugetools-server-setup.sh`。

## 2026-06-10 服务器部署结果

用户提供 root 登录密码后，已完成以下操作：

1. 将本机公钥加入 `/root/.ssh/authorized_keys`，后续改用密钥登录。
2. 上传发布包到服务器：

```text
/tmp/hugetools-mainland-static-20260610.tar.gz
```

3. 上传并执行部署脚本：

```text
/tmp/tianyi-hugetools-server-setup.sh
```

4. 解压静态文件到：

```text
/var/www/hugetools
```

5. 写入 Nginx 配置：

```text
/etc/nginx/conf.d/hugetools-mainland.conf
```

6. Nginx 已监听：

```text
0.0.0.0:18089
```

7. UFW 已添加测试白名单：

```text
18089/tcp ALLOW IN 205.185.121.250
```

8. Nginx 访问白名单：

```text
127.0.0.1
205.185.121.250
```

服务器本机验证通过：

```text
curl -I http://127.0.0.1:18089/hugetools/                         HTTP/1.1 200 OK
curl -I http://127.0.0.1:18089/hugetools/data/version-history.json HTTP/1.1 200 OK
```

当前公网验证结果：

```text
curl -I http://113.249.104.188:18089/hugetools/ timeout
curl -I http://113.249.104.188/health timeout
```

服务器侧 Nginx access log 没有公网请求记录，UFW `18089` 规则命中计数仍为 `0`。SSH 连接显示本机来源 IP 为 `205.185.121.250`，说明服务器白名单没有写错。

判断：站点已经在服务器本机部署成功，但天翼云公网入口/安全组/NAT 还没有把 `113.249.104.188:18089` 的 HTTP 流量转发到云主机内网 IP `10.0.0.3:18089`。需要在天翼云控制台开放或映射 TCP `18089`，来源限制为测试人员公网 IP。

待公网放通后的测试地址：

```text
http://113.249.104.188:18089/hugetools/
```

## 2026-06-10 端口调整

根据要求，已将测试入口从 `8888` 调整为高位端口：

```text
18089
```

选择原因：

1. 避开天翼云已知默认封禁或不备案易受限端口：`80`、`443`、`8080`、`8443`。
2. 避开常见 Web/开发端口：`3000`、`5000`、`8000`、`8080`、`8888`、`9000`。
3. 避开常见数据库、缓存、远程管理端口。

已完成调整：

```text
Nginx listen: 0.0.0.0:18089
UFW allow: 205.185.121.250 -> 18089/tcp
旧 UFW 8888 规则已删除
Nginx 8888 监听已停止
```

服务器本机验证：

```text
http://127.0.0.1:18089/hugetools/                         HTTP/1.1 200 OK
http://127.0.0.1:18089/hugetools/data/version-history.json HTTP/1.1 200 OK
```

公网验证：

```text
http://113.249.104.188:18089/hugetools/ timeout
```

当前仍需在天翼云控制台安全组/NAT 中放通或映射：

```text
协议：TCP
端口：18089
来源：测试人员公网 IP，例如 205.185.121.250/32
目标：当前云主机 10.0.0.3
```

## 2026-06-16 公网访问放通

用户在天翼云安全组策略中增加 `18089` 入方向和出方向通行后，公网入口恢复。

由于服务器本机此前仍保留测试白名单，普通公网访问会超时，挂载 VPN 时可以访问。已在服务器侧完成调整：

```text
Nginx: 移除 /hugetools/ 与 /hugetools/data/ 的 allow/deny 测试白名单
UFW: 增加 18089/tcp ALLOW IN Anywhere
```

公网验证通过：

```text
http://113.249.104.188:18089/hugetools/                         HTTP/1.1 200 OK
http://113.249.104.188:18089/hugetools/data/version-history.json HTTP/1.1 200 OK
http://113.249.104.188:18089/hugetools/styles.css                HTTP/1.1 200 OK
```

当前正式测试入口：

```text
http://113.249.104.188:18089/hugetools/
```
