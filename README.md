# Free PCode

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**免费公开接码聚合站** — 汇总多家第三方平台上**已公开展示**的临时号码与短信收件箱，提供国家筛选、收藏、分页、验证码高亮等功能。

- **正式站（实时）**：[https://phone.fastx.ink/](https://phone.fastx.ink/)
- **静态演示（GitHub Pages）**：[https://kivenzhou.github.io/free-phone-pcode/](https://kivenzhou.github.io/free-phone-pcode/)

> ⚠️ **Disclaimer** · 本项目为开源聚合工具，**不拥有任何号码**，**与 listed 平台无官方关系**。请勿用于敏感账号验证或违法用途。详见 [DISCLAIMER.md](./DISCLAIMER.md)。

English summary: an open-source **aggregator** that reads **publicly displayed** temporary SMS inboxes from multiple third-party websites. You deploy at your own risk and must comply with upstream ToS and local laws.

---

## 功能

- **多数据源聚合**：OnlineSIM、FreePhoneNum、SMSCodeOnline、SMS24、云接码、云短信等（可插拔，见 `src/lib/providers/`）
- **国家浏览**：首页按国旗 / 国家分组，点进后查看该国号码
- **分页列表**：10 / 20 / 50 / 100 条每页
- **收藏**：浏览器 `localStorage` 本地收藏，快速进入收短信页
- **智能时间**：24 小时内显示「X 分钟前」，超过 24 小时显示日期
- **验证码高亮**：自动识别 OTP 并支持一键复制
- **并行同步**：多来源并行抓取，显著缩短全量同步时间
- **可降级设计**：某源被 Cloudflare 拦截或结构变更时单独标记「暂不可用」

---

## 截图

首页按国家浏览号码：

![首页 · 按国家浏览](./docs/screenshot-home.png)

号码详情页查看公开短信与验证码：

![收件箱 · 验证码高亮](./docs/screenshot-inbox.png)

> **提示**：正式站 / GitHub Pages 受 Workers 免费额度与运行时限制，部分来源（如依赖原生模块的 SMS24）会被跳过或抓不全。**本机 `npm run dev` / `npm start` 可启用完整来源与更高并发，通常能同步到更多手机号。**

---

## 快速开始

### 环境要求

- Node.js 20+
- npm / pnpm / yarn

### 本地开发

```bash
git clone https://github.com/kivenZhou/free-phone-pcode.git
cd free-phone-pcode
npm install
cp .env.example .env.local   # 可选
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

首次访问若本地无缓存，会触发后台同步；也可点击「同步全部来源」，或：

```bash
curl -X POST http://localhost:3000/api/refresh
```

> 本地 Node 环境可使用完整 provider（含 SMS24 / `impit`）与更高并发，**通常比线上正式站同步到更多手机号**。

### 生产部署

因 `impit` 原生模块与 Turbopack 不兼容，**生产构建请使用 Webpack**：

```bash
npm run build    # 内部为 next build --webpack
npm start
```

推荐 Docker / VPS 等支持原生模块的环境；**完整功能首选 Cloudflare Workers**（见下文）。

### Cloudflare Workers（实时 API，无需绑卡）

项目已适配 [OpenNext Cloudflare](https://opennext.js.org/cloudflare)，可在 Cloudflare 上运行 Next.js + API（**实时同步、拉短信、收验证码**）。

**数据存储**：生产环境使用 **Workers KV**（代替本地 `data/store.json`）。KV 在 Workers 免费版即可使用，**一般不需要绑信用卡**（R2 才需要绑卡）。

> **与 GitHub 的关系**：Cloudflare Workers **不会**因为 push 到 GitHub 就自动部署。需要在本机执行 `npm run deploy:cf`，或在 Cloudflare 控制台手动「连接到仓库」后才会 CI 部署。这与 **GitHub Pages**（推 `main` 自动更新静态站）是两套独立流程。

#### 一次性准备

1. 注册 [Cloudflare](https://dash.cloudflare.com/)，安装 Wrangler 并登录：

```bash
npx wrangler login
```

2. 创建 KV 并自动写入 `wrangler.jsonc`：

```bash
npm run setup:cf-kv
```

也可在网页创建：**Workers & Pages → KV → Create namespace**，名称随意，然后把 namespace id 填进 `wrangler.jsonc` 的 `DATA_KV.id`。

3. 复制环境变量示例（可选，本地预览 Cloudflare 运行时用）：

```bash
cp .dev.vars.example .dev.vars
```

4. 在 Cloudflare 控制台 → Workers → `free-phone-pcode` → **Settings → Variables** 添加（生产环境建议设置）：

| 变量 | 说明 |
|------|------|
| `SKIP_NATIVE_MODULES` | 设为 `1`（Cloudflare 构建/运行时必须，自动禁用 SMS24） |
| `REFRESH_TOKEN` | 保护 `POST /api/refresh` |
| `CRON_SECRET` | 保护 `GET /api/cron/refresh` 定时同步 |
| `DISABLED_PROVIDERS` | 可选，逗号分隔禁用其他来源 |

#### 方式 A：本机部署（Wrangler CLI）

```bash
npm install
npm run deploy:cf
```

`deploy:cf` 内部会设置 `SKIP_NATIVE_MODULES=1`，调用 OpenNext 构建并上传 Worker。首次部署后默认地址形如 `https://free-phone-pcode.<你的子域>.workers.dev`（与 GitHub 用户名无关）。

#### 方式 B：关联 GitHub 自动部署（Workers Builds）

在 Cloudflare 控制台 → Workers → `free-phone-pcode` → **Settings → 构建** → **连接到仓库**，选择本仓库 `free-phone-pcode`，分支 `main`。

**务必修改默认构建命令**（不要用 `npm run build` + `npx wrangler deploy`）：

| 字段 | 命令 |
|------|------|
| **构建命令** | `SKIP_NATIVE_MODULES=1 npx opennextjs-cloudflare build` |
| **部署命令** | `npx opennextjs-cloudflare deploy` |

并在 **Variables** 中同样设置 `SKIP_NATIVE_MODULES=1`。关联完成后，推送 `main` 会自动构建部署。

#### 部署后

在 Cloudflare 控制台绑定自定义域名（可选）。部署完成后点「同步全部来源」，即可像本地一样收短信。

#### 定时同步

`wrangler.jsonc` 已配置每 2 小时 Cron。若设置了 `CRON_SECRET`，需在 Cloudflare Cron 触发器或外部定时任务里带上：

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://你的域名/api/cron/refresh
```

用户访问网站时也会自动检测缓存是否过期并后台同步（与本地类似）。

#### 本地预览 Cloudflare 运行时

```bash
npm run preview:cf
```

#### 注意事项

| 项目 | 说明 |
|------|------|
| SMS24 / impit | 依赖原生 `.node` 模块，**无法在 Workers 运行**；Cloudflare 构建会自动设 `SKIP_NATIVE_MODULES=1` 跳过 |
| 全量同步 | Cloudflare 上**分批**进行（默认每次 1 个来源并自动接力），避免免费版子请求上限；短信仍按需直连 |
| Node 自托管 | `npm run build && npm start` 可使用完整 SMS24（含 `impit`） |
| KV 体积 | 单 key 上限约 25MB，号码特别多时需后续拆分存储 |
| Worker 体积 | 免费版压缩后约 3MB 上限，构建失败可考虑 Workers Paid |
| GitHub Pages | **仅静态演示，不能收验证码**；完整实时功能请用 Cloudflare Workers |

### 在线地址

| 站点 | 地址 | 说明 |
|------|------|------|
| 正式站 | [https://phone.fastx.ink/](https://phone.fastx.ink/) | Cloudflare Workers，可实时拉短信 |
| 静态演示 | [https://kivenzhou.github.io/free-phone-pcode/](https://kivenzhou.github.io/free-phone-pcode/) | GitHub Pages，仅构建快照 |

### GitHub Pages（静态演示，不能收码）

仓库已配置 GitHub Actions，推送 `main` 后会自动部署静态演示站。

GitHub Pages **只能托管静态文件**，**无法实时拉短信或收验证码**（仅构建时快照，绝大多数号码没有短信数据）。

| 能力 | Node 自托管 | GitHub Pages |
|------|-------------|--------------|
| 浏览国家 / 号码列表 | ✅ 实时 | ✅ 构建快照 |
| 查看短信 | ✅ 实时拉取 | ⚠️ 仅构建时预缓存的号码（默认 300 个） |
| 手动同步来源 | ✅ | ❌ |
| 自动后台刷新 | ✅ | ❌（每 6 小时 CI 重建） |

本地构建静态版（需联网同步数据，耗时较长）：

```bash
npm run build:pages
# 产物在 out/，可用 npx serve out 预览
```

可在仓库 **Settings → Pages** 确认 Source 为 **GitHub Actions**。首次 push 后若 404，等待 workflow 完成即可。

---

## 环境变量

复制 [.env.example](./.env.example) 为 `.env.local`：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DISABLED_PROVIDERS` | — | 逗号分隔的 provider id，禁用指定来源 |
| `SKIP_NATIVE_MODULES` | — | 设为 `1` 时跳过 SMS24（Cloudflare 构建/部署脚本已自动设置） |
| `REFRESH_CONCURRENCY` | `5` / CF 上 `1` | 同批内并发抓取的来源数 |
| `REFRESH_BATCH_SIZE` | `100` / CF 上 `1` | 每次 Worker 调用同步几个来源（CF 自动分批接力） |
| `SMS24_MAX_PAGES` | `20` | SMS24 每个国家最多抓取页数 |
| `SMS24_CONCURRENCY` | `10` | SMS24 页面抓取并发 |
| `REFRESH_TOKEN` | — | 若设置，则 `POST /api/refresh` 需 `Authorization: Bearer <token>` |
| `CRON_SECRET` | — | 若设置，则 `GET /api/cron/refresh` 需 Bearer 鉴权（Cloudflare 定时任务用） |
| `STORE_BACKEND` | 自动 | 设为 `file` 可强制本地文件存储（Cloudflare 上自动用 KV） |
| `DISABLE_BACKGROUND_REFRESH` | — | Cloudflare 上默认开启；本地勿设 |

Provider id 列表见 [数据源](#数据源与商标声明)。

---

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/numbers?country=&provider=&q=&lineType=` | 号码列表（国家浏览模式下仅返回 countries） |
| `GET` | `/api/numbers/:id/messages?force=1` | 某号码公开短信 |
| `POST` | `/api/refresh` | 手动全量/单源同步，body 可选 `{ "provider": "onlinesim" }` |

---

## 项目结构

```
src/
  app/              # Next.js App Router 页面与 API
  components/       # UI 组件
  hooks/            # React hooks（收藏等）
  lib/
    providers/      # 可插拔数据源
    db.ts           # JSON 文件缓存
    refresh.ts      # 同步调度
data/               # 运行时缓存（已 gitignore，勿提交）
```

---

## 数据源与商标声明

以下名称**仅用于说明聚合的数据来源**，不代表官方合作、授权或背书：

| Provider ID | 名称 | 来源 | 备注 |
|-------------|------|------|------|
| `onlinesim` | OnlineSIM | onlinesim.io 公开 JSON API | 相对稳定 |
| `freephonenum` | FreePhoneNum | freephonenum.com | HTML |
| `smscodeonline` | SMSCodeOnline | smscodeonline.com | HTML |
| `sms24` | SMS24 | sms24.me | HTML + API，Cloudflare 保护；Node 环境用 `impit`，Workers 上自动禁用 |
| `mianfeisms` | 免费接码 SMS | mianfeisms.xyz | HTML |
| `goinsms` | GoInSMS | goinsms.xyz | HTML |
| `yunjiema` | 云接码 | yunjiema.net | HTML |
| `yunduanxin` | 云短信 | yunduanxin.xyz | HTML |
| `yunjiematop` | 云接码 Top | yunjiema.top | HTML |
| `storytrain` | StoryTrain | storytrain.info | HTML |
| `anonymsms` | AnonymSMS | anonymsms.com | HTML |
| `zsrq` | 云短信 ZSRQ | zsrq.net | HTML |
| `receive-smss` | Receive-SMSS | receive-smss.com | 常被 CF 拦截 |
| `smstome` | SMSToMe | smstome.com | 常被 CF 拦截 |

参考整理：[w3h5 免费接码汇总](https://www.w3h5.dev/post/619.html?lang=ch)

---

## 合规与开源须知

在推送到 GitHub **之前**，请确认：

### ✅ 可以开源的部分

- 本仓库 **源代码**（MIT 协议，见 [LICENSE](./LICENSE)）
- 架构设计、UI、provider 插件接口

### ⚠️ 需要特别注意

| 风险 | 说明 | 建议 |
|------|------|------|
| **第三方 ToS** | 自动化抓取可能违反目标网站服务条款 | 阅读各站 ToS；默认可禁用 HTML 抓取源；收到投诉立即 `DISABLED_PROVIDERS` |
| **Cloudflare 绕过** | SMS24 使用 TLS 指纹访问 | 在 DISCLAIMER 中说明；生产环境自行评估 |
| **短信隐私** | 公开展示的验证码仍可能涉及他人账号安全 | 页面保留免责声明；禁止用于敏感场景 |
| **商标** | 文档中提及第三方品牌 | 加注「无 affiliation」；不要用作项目 Logo |
| **缓存数据** | `data/store.json` 含短信正文 | 已在 `.gitignore`；**切勿提交** |
| **公开 API 滥用** | `/api/refresh` 可被恶意频繁调用 | 生产设置 `REFRESH_TOKEN` 或网关限流 |

完整说明：[DISCLAIMER.md](./DISCLAIMER.md) · 安全说明：[SECURITY.md](./SECURITY.md)

### ❌ 请勿

- 将本项目宣传为「官方接码平台」
- 出售号码或验证码
- 用于欺诈、批量恶意注册等违法活动

---

## 部署检查清单

- [ ] 未提交 `data/`、`.env*` 到 Git
- [ ] 生产环境设置 `REFRESH_TOKEN`（若公网可访问）
- [ ] Cloudflare 部署使用 `opennextjs-cloudflare`（非裸 `wrangler deploy`），并设置 `SKIP_NATIVE_MODULES=1`
- [ ] 若关联 GitHub 自动部署，构建/部署命令已按 README「方式 B」配置

---

## 参与贡献

见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## License

[MIT](./LICENSE) © Free PCode contributors

Software is provided **as-is**. Third-party phone numbers and SMS content are **not** covered by this license — see [DISCLAIMER.md](./DISCLAIMER.md).
