# HUGEtools 部署方案

整理日期：2026-06-10

## 当前项目状态

当前项目不是 Next.js / React / Vite 构建型项目。根目录没有 `package.json`，没有 `build` 命令，当前环境也没有可用的 `npm`。因此本项目不应按 `npm run build` 部署。

当前项目包含两部分：

- 静态网页：根目录 `index.html` 及同级资源文件。
- 原生微信小程序：`project.config.json` + `miniprogram/`。

已确认：

- JS 语法检查通过。
- JSON 配置检查通过。
- 未发现 `.env`。
- 未发现真实 API Key / Secret / Token 硬编码。
- `project.config.json` 中的 `appid` 仍为 `touristappid`，正式发布前必须替换。

## 一、静态网页部分

### 1. 静态网页入口文件

入口文件：

```text
index.html
```

### 2. 网页资源目录

静态网页资源位于仓库根目录及 `data/` 目录：

```text
index.html
styles.css
app.js
slider-fix.js
version-archive.js
data/version-history.json
DISCLAIMER.md
PRIVACY.md
README.md
```

其中页面实际运行依赖：

```text
index.html
styles.css
app.js
slider-fix.js
version-archive.js
data/version-history.json
```

### 3. 资源路径公网部署适配性

`index.html` 当前引用：

```html
<link rel="stylesheet" href="./styles.css">
<script src="./app.js?v=macos-compat-1"></script>
<script src="./slider-fix.js?v=1"></script>
<script src="./version-archive.js?v=macos-compat-1"></script>
```

`version-archive.js` 当前读取：

```js
fetch("./data/version-history.json", { cache: "no-store" })
```

判断：

- 使用相对路径，适合部署到公网静态站点根路径。
- 也适合部署到子路径，但子路径部署时必须保证整个目录结构原样保留。
- 没有依赖 npm 构建产物。
- 没有外部 CDN、第三方脚本、后端接口或 API Key。
- `data/version-history.json` 必须随静态文件一起上传，否则版本面板会走降级展示。

建议：

- 静态站点部署时上传整个根目录中的网页相关文件，不要只上传 `index.html`。
- 如果部署到子路径，例如 `/hugetools/`，Nginx 需要使用 `alias` 并保留 `data/` 目录。

### 4. Vercel 静态部署配置

不要使用 `npm run build`。

Vercel 项目设置建议：

```text
Framework Preset: Other
Root Directory: ./
Build Command: 留空
Install Command: 留空
Output Directory: ./
```

可选 `vercel.json`：

```json
{
  "version": 2,
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/data/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "/(.*).js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*).css",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

说明：

- 该配置不声明 build 命令。
- 如果 Vercel UI 仍自动填入构建命令，应手动清空。
- 当前项目不是 SPA 路由项目，不需要 rewrite 到 `index.html`。

### 5. Nginx 静态部署配置

根路径部署示例：

```nginx
server {
    listen 3389;
    server_name example.com;

    root /var/www/hugetools;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /data/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=0, must-revalidate";
    }

    location ~* \.(?:js|css)$ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

子路径部署示例，例如部署到 `/hugetools/`：

```nginx
location = /hugetools {
    return 301 /hugetools/;
}

location /hugetools/ {
    alias /var/www/hugetools/;
    index index.html;
    try_files $uri $uri/ /hugetools/index.html;
}

location /hugetools/data/ {
    alias /var/www/hugetools/data/;
    try_files $uri =404;
    add_header Cache-Control "public, max-age=0, must-revalidate";
}
```

注意：

- 不需要 `npm run build`。
- 上传文件时保持目录结构。
- 如果部署在天翼云服务器，已记录其默认封禁 `80`、`443`、`8080`、`8443`，不要默认监听这些端口；需选择可用端口或先确认解封。

## 二、微信小程序部分

### 1. 小程序入口目录

小程序入口目录：

```text
miniprogram/
```

微信开发者工具项目配置：

```text
project.config.json
```

关键配置：

```json
{
  "miniprogramRoot": "miniprogram/",
  "appid": "touristappid",
  "compileType": "miniprogram"
}
```

### 2. app.json 页面路径检查

`miniprogram/app.json` 页面配置：

```json
{
  "pages": [
    "pages/index/index"
  ]
}
```

检查结果：

```text
miniprogram/pages/index/index.js    存在
miniprogram/pages/index/index.json  存在
miniprogram/pages/index/index.wxml  存在
miniprogram/pages/index/index.wxss  存在
```

结论：

- `app.json` 中声明的页面路径全部存在。

### 3. pages 页面完整性检查

当前 `pages/` 下只有一个页面：

```text
miniprogram/pages/index/index
```

配套文件完整：

```text
index.js
index.json
index.wxml
index.wxss
```

此外小程序全局文件存在：

```text
miniprogram/app.js
miniprogram/app.json
miniprogram/app.wxss
miniprogram/sitemap.json
miniprogram/utils/calc.js
```

### 4. touristappid 待替换项

当前：

```json
"appid": "touristappid"
```

状态：

- 待替换。
- 不能直接用于正式发布和提交审核。

修复建议：

- 在微信公众平台创建/确认小程序。
- 将 `project.config.json` 中的 `touristappid` 替换为真实小程序 AppID。
- 不要把 AppSecret 写进前端代码或仓库。

### 5. 微信开发者工具发布步骤

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择仓库根目录：

```text
/Users/regal.hugmail.com/Documents/Codex/2026-06-02/github/HUGEtools
```

4. 确认 `project.config.json` 已识别 `miniprogramRoot: miniprogram/`。
5. 将 AppID 从 `touristappid` 替换为真实小程序 AppID。
6. 点击“编译”，确认首页 `pages/index/index` 可以打开。
7. 逐项测试 5 个工具：
   - 毛利
   - 团购
   - 损耗
   - 小红书
   - 排班
8. 点击“预览”，用微信扫码预览。
9. 在真机上测试：
   - 表单输入
   - 工具切换
   - 结果刷新
   - 小红书复制文案
   - 页面滚动和布局
10. 检查小程序后台：
   - 服务类目
   - 隐私协议
   - 用户数据处理说明
   - 是否需要备案或补充资质
11. 点击“上传”，填写版本号和说明。
12. 在微信公众平台提交审核。

## 三、最终结果

### 1. 当前项目是否可以直接静态部署

可以直接静态部署，但仅限静态网页部分。

条件：

- 使用静态站点方式部署。
- 不执行 `npm run build`。
- 上传根目录网页文件和 `data/` 目录。
- 确保公网能访问：
  - `/index.html`
  - `/styles.css`
  - `/app.js`
  - `/slider-fix.js`
  - `/version-archive.js`
  - `/data/version-history.json`

### 2. 当前项目是否可以直接提交微信审核

不可以直接提交微信审核。

原因：

- `project.config.json` 仍为 `touristappid`。
- 尚未在微信开发者工具内完成正式 AppID 编译验证。
- 尚未完成真机测试。
- 尚未确认小程序后台服务类目、隐私协议和审核资料。

### 3. 必须修复项

静态网页生产部署前必须确认：

- 选择部署路径：根路径 `/` 或子路径，例如 `/hugetools/`。
- 上传静态资源时保留 `data/` 目录。
- 若使用天翼云，避开默认封禁端口 `80`、`443`、`8080`、`8443`，或先确认解封。

微信小程序提交审核前必须修复：

- 替换 `project.config.json` 中的 `touristappid`。
- 使用微信开发者工具编译通过。
- 完成微信扫码预览。
- 完成真机测试。
- 确认小程序后台隐私合规和服务类目。

可选增强项：

- 增加 `miniprogram-ci` 自动预览/上传脚本。
- 增加静态网页部署说明或 `vercel.json`。
- 增加部署后验收清单。

### 4. 可执行下一步清单

静态网页：

1. 选择部署平台：Vercel、GitHub Pages、Nginx 静态目录或天翼云可用端口。
2. 若用 Vercel：Framework 选择 Other，清空 Build Command 和 Install Command，Output Directory 填 `./`。
3. 若用 Nginx：把静态文件同步到 `/var/www/hugetools`。
4. 配置 Nginx `root` 或 `alias`。
5. 检查 `/data/version-history.json` 是否可访问。
6. 打开公网地址，测试 5 个网页工具。

微信小程序：

1. 登录微信公众平台确认真实 AppID。
2. 替换 `project.config.json` 的 `touristappid`。
3. 用微信开发者工具导入仓库根目录。
4. 编译 `pages/index/index`。
5. 逐项测试 5 个小程序工具。
6. 扫码预览并真机测试。
7. 补齐隐私协议、服务类目和审核资料。
8. 上传版本并提交审核。
