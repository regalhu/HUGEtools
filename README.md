# HUGEtools 餐饮经营小工具箱

这是一个面向小餐饮老板的纯静态网页工具箱。当前公开版优先规避风险：不登录、不上传、不采集、不抓取，不连接任何平台代理接口。

## 已发布工具

- 菜品毛利计算器：测算直接原料成本、标准材料毛利、渠道到手毛利、完全成本毛利。
- 门店损耗记录工具：轻量记录损耗金额、原因和责任归类。
- 应产率与产能计算工具：按采购重量、出成率、多层损耗、BOM 克重和最小采购单位测算最大出品份数、瓶颈原料、单份理论成本和原材料利用率。
- 食材成本与经营健康度：按库存流转法测算实际 COGS、食材成本率、毛利、Prime Cost 和理论/实际成本差异。
- 门店选址评估工具：按租金投入、经营假设、物业条件、商圈客流和竞争环境输出红线风险、财务指标、综合评分和谈判建议。
- 团购套餐利润测算器：测算抖音、美团、大众点评团购套餐的单份利润、核销后总利润、加购回血和保本加购率。
- 种草类生成工具：按搜索关键词匹配公开热点方向，生成种草内容草稿、拍摄建议、标签建议和封面图。
- 评价类生成工具：基于真实消费信息整理评价内容、商家回复、拍摄建议和合规检查，不生成虚假评价。
- 单店排班工具：生成轻量周排班表。

## 微信小程序版

仓库已包含原生微信小程序版本，目录为：

```text
miniprogram/
```

用微信开发者工具导入本仓库根目录即可，`project.config.json` 已指向 `miniprogram/`。当前小程序版保留 5 个核心工具：毛利、团购、损耗、小红书文案、排班。

更多说明见：

```text
docs/WECHAT_MINIPROGRAM_GUIDE.md
```

## 安全边界

- 纯静态网页，无后端数据库。
- 不要求注册登录。
- 不主动采集、上传或保存用户输入。
- 不包含爬虫、自动抓取、模拟登录、绕过验证码或绕过平台风控的功能。
- 平台费率、佣金、配送费、推广费等默认值仅用于估算，最终以商家后台账单、合同和平台规则为准。
- 测算结果不构成财务、税务、法律、平台招商或盈利承诺。

## GitHub Pages

仓库启用 GitHub Pages 后，访问地址通常为：

```text
https://regalhu.github.io/HUGEtools/
```

## 本地使用

建议在 macOS 终端里用本地静态服务打开，这样版本记录等 `fetch` 读取逻辑也能正常工作：

```bash
python3 -m http.server 8765
```

然后访问：

```text
http://127.0.0.1:8765/
```

macOS 也可以直接双击运行：

```text
scripts/serve-macos.command
```

如果只想快速看页面，直接打开 `index.html` 也可使用主体计算功能；但部分浏览器会限制本地文件的剪贴板或 `fetch` 能力。

## SaaS 生产部署

天翼云生产环境采用 SaaS 级部署结构：

```text
用户 -> Nginx 公网 18089 -> Node 服务 127.0.0.1:18088
GitHub push -> Webhook 127.0.0.1:18090 -> /root/deploy.sh
```

服务器目录统一为：

```text
/www/hugetools
```

本地发布固定流程：

```bash
git add .
git commit -m "version update"
git push origin main
```

服务器更新：

```bash
/root/deploy.sh
```

当前天翼云目标入口固定为：

```text
http://113.249.104.188:18089/
```

完整 Nginx、systemd、Webhook、灰度发布、回滚和 SSH 安全说明见：

```text
docs/DEVOPS_RUNBOOK.md
```

## 应产率与产能 API 契约

浏览器端和 Vercel API 共用 `yield-calculator.js` 里的纯函数：

```text
POST /calculate-yield
POST /api/calculate-yield
```

请求体结构见：

```text
schemas/yield-capacity.schema.json
```

所有重量在 API 中统一按 kg 传入；页面里“每份用量 g”会自动换算为 `usage_per_portion` kg。

## 门店选址评估 API 契约

浏览器端和服务端共用 `site-selection-calculator.js` 里的纯函数：

```text
POST /calculate-site-selection
POST /api/calculate-site-selection
```

请求体结构见：

```text
schemas/site-selection.schema.json
```

结果会返回财务测算、分项评分、红线风险、综合结论和谈判建议；红线条件会优先限制最终结论。
