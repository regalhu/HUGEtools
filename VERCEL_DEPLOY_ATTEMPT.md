# Vercel 部署尝试记录

时间：2026-06-10

## 最终状态

已成功部署到 Vercel Production。

生产地址：

```text
https://hugetools.vercel.app
```

本次部署 URL：

```text
https://hugetools-8fei3st5u-regalhus-projects.vercel.app
```

Inspect 地址：

```text
https://vercel.com/regalhus-projects/hugetools/B4Ba4JuoJRZJJvFKD36xKbhTmHiU
```

Vercel inspect 状态：

```text
Ready
```

线上验证：

- `https://hugetools.vercel.app/` 返回 `HTTP/2 200`。
- `https://hugetools.vercel.app/data/version-history.json` 返回 `HTTP/2 200`。
- 线上版本 JSON 显示 `currentVersion: 0.5.0`。

## 本次已做

1. 新增 `vercel.json`，明确当前项目按纯静态站点部署，不需要 `npm run build`。
2. 调用 Vercel MCP 部署工具尝试部署当前项目。
3. 检查本机是否存在 Vercel CLI、npm、npx、pnpm、yarn、corepack。
4. 检查是否存在 Vercel 本地绑定目录 `.vercel/`。
5. 检查是否存在 `VERCEL_TOKEN` 环境变量。

## Vercel MCP 返回结果

Vercel MCP 没有直接创建部署，返回的操作建议是：

```text
To deploy this to Vercel, run the Vercel CLI command `vercel deploy`.
```

## 本机工具检查结果

```text
vercel not found
npm not found
pnpm not found
yarn not found
corepack not found
VERCEL_TOKEN is not set
```

同时，仓库当前没有 `.vercel/project.json`，说明本地尚未绑定 Vercel 项目。

## 曾经的阻塞点

首次尝试未能发布到 Vercel，阻塞原因是部署凭据和 CLI 环境缺失：

- 当前机器没有 `vercel` CLI。
- 当前机器没有 `npm` / `npx`，无法通过 `npx vercel deploy` 临时执行。
- 没有 `VERCEL_TOKEN`。
- 没有 `.vercel/project.json` 项目绑定。
- Vercel MCP 当前只返回 CLI 操作建议，没有直接执行部署。

后续通过 Vercel 设备授权登录，并临时下载 npm + Vercel CLI 后，已完成部署。这不是项目构建问题。

## 已生成的 Vercel 配置

已新增：

```text
vercel.json
```

该配置不包含 build 命令，不依赖 npm。

## 后续可执行方案

### 方案 A：在本机安装/登录 Vercel CLI 后部署

```bash
vercel login
vercel deploy
```

生产部署：

```bash
vercel deploy --prod
```

Vercel 项目设置保持：

```text
Framework Preset: Other
Build Command: 留空
Install Command: 留空
Output Directory: ./
```

### 方案 B：使用 Vercel Token 部署

设置环境变量：

```bash
export VERCEL_TOKEN="你的 Vercel Token"
```

然后执行：

```bash
vercel deploy --prod --token "$VERCEL_TOKEN"
```

### 方案 C：GitHub 集成自动部署

如果 Vercel 已绑定 GitHub 仓库：

1. 提交当前代码。
2. 推送到 `origin/main`。
3. 在 Vercel 控制台确认该仓库项目的 Build Command 为空。
4. 等待 Vercel Git 集成自动部署。

注意：本次未执行 commit/push。
