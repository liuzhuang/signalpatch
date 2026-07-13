# SignalPatch 交接

## 下一会话目标

在用户明确确认“开始构建”后，将已经完成设计决策的 SignalPatch 从文档阶段实现为可运行、可公开发布的 AI-native GitHub Issue 自动化演示项目，并实际验证首个 Feedback 到生产发布的闭环。

## 当前状态

- 需求访谈和架构决策已完成。
- 项目目录尚未初始化 Git，没有应用代码、依赖、测试或 Workflow。
- GitHub 远程仓库尚未创建。
- 用户在被询问“确认现在开始构建吗”后改为请求交接，因此构建授权门槛仍未得到明确确认。下一会话先用一句话确认，不要重新进行整轮访谈。
- UI 不是重点；自动化流程、权限隔离、验收证据和真实发布闭环是重点。

## 权威材料

开始前完整阅读：

- [领域语言](./CONTEXT.md)
- [架构决策目录](./docs/adr/)

ADR `0001` 至 `0020` 已逐项获得用户确认，不要重新发明或静默改变。`0002-nextjs-and-sqlite.md` 已被 `0003-nextjs-and-supabase.md` 替代。

快速定位：

- `0001`、`0008`、`0011`：隐私、Issue Contract 和两种 Intake 来源。
- `0003` 至 `0005`：Next.js、Supabase、Vercel 和自动化优先范围。
- `0006`、`0010`：两个项目 Skill 及 Prompt 归属。
- `0007`、`0009`、`0013`：风险、验收和有界 Repair。
- `0012`、`0019`：Issue/PR 衔接和四个 Workflow。
- `0014`、`0018`：Codex 凭据隔离和专用 GitHub App。
- `0015`、`0017`：发布模型和三表 Supabase 模型。
- `0016`：公开 MIT 仓库信息。
- `0020`：首个真实自动修复场景。

## 已确定的实现边界

- 目标仓库：`liuzhuang/signalpatch`，Public，MIT，默认分支 `main`。
- 技术栈：Next.js、TypeScript、pnpm、Supabase、Vercel。
- 不使用 OpenAI API Key；自托管 macOS Action Runner 使用已登录的 Codex CLI 订阅会话。
- 两个项目 Skill：`issue-intake` 和 `issue-delivery`。
- 四个 Workflow：`feedback-intake.yml`、`issue-delivery.yml`、`pr-gate.yml`、`pr-outcome.yml`。
- R0/R1 可自动合并并发布；R2 在合并前人工批准；R3 只分析。
- Codex 不得获得 GitHub、Supabase Service Role 或 Vercel 写凭据，也不得处理不可信输入时使用 `danger-full-access`。
- 应用只做匿名 Feedback、Tracking ID 和 Repair Status；不做管理后台。
- Preview 与 Production 在 Demo 中共用一个 Supabase 项目；提升同一个已验收的 Vercel Deployment。
- 首个自动任务是修复 Tracking ID 带首尾空格时查询失败的问题。

## 建议实施顺序

1. 取得用户明确的开始构建确认。
2. 检查本机 Node、pnpm、Codex CLI、GitHub CLI、Vercel CLI、Supabase CLI 和自托管 Runner 状态；按当前官方文档核对版本与 Action 用法。
3. 从 ADR 生成最小 Next.js 项目、Supabase Migration、RLS/RPC、三个 API 入口和测试。
4. 创建 `AGENTS.md`、两个 `.agents/skills/`、引用 Prompt、JSON Schema、`.ai/policy.yaml` 和确定性 Controller 脚本。
5. 编写四个 Workflow；任何 Codex 步骤与持有外部写凭据的步骤必须分离。
6. 实现 `pnpm verify`、`pnpm build` 和 Playwright Smoke Test。
7. 本地执行格式、Lint、类型、单测、构建和必要的结构校验。
8. 初始化 Git，按逻辑拆分提交，创建并推送公开 GitHub 仓库。
9. 配置专用 GitHub App、Repository Variables/Secrets、Ruleset、自托管 Runner、Supabase 和 Vercel。若外部凭据或人工创建 GitHub App 成为阻塞，只请求完成该最小人工步骤。
10. 部署初始版本，提交演示 Feedback，并观察 Issue、PR、验收、Repair、发布和 Issue 关闭的真实证据。

## 环境线索

- 本地项目路径：`/Users/liuzhuang/project/signalpatch`。
- 当前 GitHub CLI 可执行文件曾位于 `/opt/homebrew/bin/gh`；普通 shell 的 `PATH` 当时未包含它。
- 2026-07-13 检查时 GitHub 登录账号为 `liuzhuang`，`liuzhuang/signalpatch` 名称尚可用。执行前重新验证，勿依赖旧状态。
- Codex CLI 曾位于 `/Applications/ChatGPT.app/Contents/Resources/codex`。
- 不要记录、打印或转交任何 Token、Private Key、Service Role 或登录凭据。

## 完成定义

只有以下内容都有真实证据时才算完成：

- 本地验证命令通过。
- 公开 GitHub 仓库存在且文档足以复现配置。
- Supabase RLS/RPC 权限符合 ADR。
- GitHub App 与四个 Workflow 可以串联运行。
- Vercel Preview、Production 和 Smoke Test 通过。
- 稀疏 Feedback 自动形成 Issue Contract。
- Tracking ID 演示缺陷由 Codex 创建 PR、修复、验收并发布。
- 原 Issue 在 Production 验收成功后关闭；失败路径能转入 Repair 或 `ai:human-required`。

## Suggested skills

- `implement`：按已确认 ADR 实施，不重新规划产品范围。
- `tdd`：先固化 Tracking ID 缺陷及 Intake/Policy 状态机测试。
- `vercel:nextjs`：实现和检查 Next.js App Router 代码。
- `supabase:supabase`：创建 Schema、RLS、RPC 和环境配置，并在实施前核对最新官方文档。
- `vercel:deployments-cicd`：实现 Preview、Promote、Production 和回滚流程。
- `github:github`：创建仓库、配置 GitHub App、Ruleset、Actions 和检查真实运行状态。
- `github:gh-fix-ci`：真实 PR Gate 或 Workflow 失败时诊断和修复。
- `tech-doc-style-chinese`：完善中文教程、运行手册和安全配置说明。
