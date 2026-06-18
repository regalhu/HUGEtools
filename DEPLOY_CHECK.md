# DEPLOY_CHECK.md

检查日期：2026-06-10

## 结论

当前项目不具备“npm build 型前端项目”的生产部署条件，因为仓库根目录没有 `package.json`，当前环境也没有可用的 `npm` 命令，因此无法执行 `npm run build`。

但项目具备两类非 npm 部署形态：

- 静态网页：`index.html` + `app.js` + `styles.css`，可按静态站点方式部署，例如 GitHub Pages。
- 微信小程序：`project.config.json` + `miniprogram/`，需要用微信开发者工具导入、编译、预览和发布。

## 1. 项目类型检查

已检查文件：

- `index.html`
- `app.js`
- `styles.css`
- `slider-fix.js`
- `version-archive.js`
- `project.config.json`
- `miniprogram/`

判断结果：

- 不是 Next.js 项目：未发现 `next.config.*`、`pages/`/`app/` Next 结构或 `package.json` 依赖。
- 不是 React/Vite 项目：未发现 `vite.config.*`、`src/main.*` 或相关依赖配置。
- 当前是静态网页 + 原生微信小程序项目。

## 2. package.json 与 build 命令

检查结果：

- 未发现 `package.json`。
- 因此不存在 `scripts.build`。
- 当前项目没有 npm 构建入口。

修复建议：

- 如果生产目标是 GitHub Pages 或普通静态站点，可以继续保持无构建部署，但应在部署说明中明确“无需 npm build”。
- 如果生产目标是 Vercel/Netlify/Node 前端流水线，应补充 `package.json`，并提供明确的 `build` 命令。
- 如果生产目标是微信小程序，应以微信开发者工具或 `miniprogram-ci` 作为构建/上传链路，而不是 `npm run build`。

## 3. npm run build 执行结果

执行命令：

```bash
npm --version
npm run build
```

结果：

```text
zsh:1: command not found: npm
```

结论：

- 当前机器环境中 `npm` 不在 PATH。
- 即使安装 npm，当前仓库也没有 `package.json`，仍无法直接执行 `npm run build`。

修复建议：

- 安装 Node/npm 工具链，或确认 Codex/CI 环境中的 npm 可用。
- 根据实际部署目标补充构建命令。
- 微信小程序建议另行配置 `miniprogram-ci`，并用真实 AppID 完成上传预览流程。

## 4. 编译错误、TypeScript 错误、缺失依赖

已执行检查：

```bash
node --check app.js
node --check slider-fix.js
node --check version-archive.js
node --check miniprogram/app.js
node --check miniprogram/pages/index/index.js
node --check miniprogram/utils/calc.js
python3 -m json.tool project.config.json
python3 -m json.tool miniprogram/app.json
python3 -m json.tool miniprogram/pages/index/index.json
python3 -m json.tool miniprogram/sitemap.json
python3 -m json.tool data/version-history.json
```

结果：

- JavaScript 语法检查通过。
- JSON 配置检查通过。
- 未发现 TypeScript 项目配置，未发现 `tsconfig.json`，因此不存在 TypeScript 编译检查链路。
- 未发现 npm 依赖声明，因此无法判断 npm 依赖完整性。

风险：

- 微信小程序 WXML/WXSS 仍需要微信开发者工具编译验证；本次只能做文件级静态检查。
- 当前没有自动化测试、CI、lint 或小程序上传预览脚本。

修复建议：

- 使用微信开发者工具导入根目录并完成一次“编译/预览/真机调试”。
- 如需自动化小程序发布，增加 `miniprogram-ci` 配置和对应脚本。
- 如需 Web 生产流程，补充 lint/build/test 脚本。

## 5. .env 文件检查

检查结果：

- 未发现 `.env` 或 `.env.*` 文件。

结论：

- 当前没有环境变量文件泄露风险。
- 当前也没有生产环境配置文件。

修复建议：

- 如果后续接入后端、云函数或小程序 CI，不要提交真实 `.env`。
- 可新增 `.env.example` 说明必需变量，但真实密钥应放在本机密钥库、CI Secret 或微信平台配置中。

## 6. 前端硬编码 API Key 检查

扫描关键词：

`api_key`、`apikey`、`secret`、`token`、`access_key`、`secret_key`、`AKIA...`、`sk-...`、`AIza...`、`appsecret`、`Bearer ...` 等。

结果：

- 未发现真实 API Key、Secret、Token 或 Bearer Token。
- 发现 `project.config.json` 中存在占位 AppID：

```json
"appid": "touristappid"
```

判断：

- `touristappid` 是微信开发者工具游客/测试占位值，不是敏感密钥。
- 生产发布前必须替换为真实小程序 AppID。

修复建议：

- 正式发布微信小程序前，将 `touristappid` 替换为真实 AppID。
- 不要把 `appsecret`、云开发密钥、服务器密钥或第三方平台密钥写入前端代码。
- 后续若接入接口，请通过后端/云函数转发敏感请求。

## 7. 生产部署建议

### 静态网页部署

当前静态网页可按 GitHub Pages/静态服务器方式部署。部署前建议确认：

- `index.html` 能正常加载 `app.js`、`slider-fix.js`、`version-archive.js`。
- `data/version-history.json` 能被同源静态服务读取。
- 生产域名下隐私说明和免责声明可访问。

### 微信小程序发布

当前小程序版还不应直接视为已完成生产发布，需要完成：

- 用微信开发者工具导入项目根目录。
- 替换真实小程序 AppID。
- 编译首页 `pages/index/index`。
- 真机预览核心工具。
- 检查 WXML/WXSS 是否存在微信开发者工具兼容错误。
- 确认隐私合规、类目、服务内容和小程序后台配置。

### npm 构建部署

当前不支持。若必须走 npm 构建，需要新增：

- `package.json`
- `scripts.build`
- 依赖锁文件
- 构建产物目录说明
- CI 或本地 build 验证记录

## 最终判断

| 检查项 | 状态 |
|---|---|
| 项目类型明确 | 通过，静态网页 + 微信小程序 |
| package.json | 不通过，文件不存在 |
| build 命令 | 不通过，不存在 |
| npm run build | 不通过，npm 不可用且无 package.json |
| JS 语法检查 | 通过 |
| JSON 配置检查 | 通过 |
| TypeScript 检查 | 不适用，项目无 TypeScript |
| 缺失依赖检查 | 无法完整判断，项目无 npm 依赖声明 |
| .env 泄露 | 通过，未发现 .env |
| 前端 API Key | 通过，未发现真实密钥 |
| 微信小程序生产发布 | 待验证，需要微信开发者工具编译和真实 AppID |
