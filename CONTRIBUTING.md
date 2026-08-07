# Contributing

感谢考虑为 Free PCode 贡献代码！

## 开发环境

```bash
git clone https://github.com/kivenZhou/free-phone-pcode.git
cd free-phone-pcode
npm install
npm run dev
```

生产构建使用 Webpack（`impit` 原生模块与 Turbopack 不兼容）：

```bash
npm run build
npm start
```

## 添加新数据源

1. 在 `src/lib/providers/` 新建 provider，实现 `listNumbers()` 与 `listMessages()`；
2. 在 `src/lib/providers/registry.ts` 注册；
3. 在 `src/lib/provider-labels.ts` 添加展示名称；
4. 在 README 的「数据源」表格中注明来源 URL 与是否公开 API；
5. 若目标站 ToS 禁止自动化访问，**不要**合并，或在 PR 中默认 `DISABLED_PROVIDERS` 禁用并说明原因。

## Pull Request 须知

- 保持改动范围聚焦；
- 不要提交 `data/store.json`、`.env` 或任何真实短信内容；
- 新增环境变量请同步更新 `.env.example` 与 README；
- 涉及合规/免责声明的改动请同时更新 `DISCLAIMER.md`。

## Code Style

- TypeScript strict；
- 运行 `npm run lint` 后再提交；
- UI 文案优先中文。
