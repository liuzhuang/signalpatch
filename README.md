# SignalPatch

SignalPatch 是一个公开的参考实现：把匿名产品 Feedback 转化为可审计的 GitHub Issue Contract，再由 Codex 完成受约束的修改、独立审查、Preview 验收、合并和生产发布。

这个仓库的重点不是建设完整的反馈平台，而是展示一条真实、可复现、凭据隔离的 AI-native Issue-to-production 流程。

## 当前能力

- Next.js 应用提供匿名 Feedback 提交和 Repair Status 查询。
- Supabase 使用独立的 `signalpatch` schema，仅保存 `feedback`、`problems`、`automation_runs` 三张业务表。
- 匿名客户端不能直接读取表，只能调用 `submit_feedback` 和 `get_repair_status` 两个受限 RPC。
- `issue-intake` 与 `issue-delivery` 两个项目级 Skill 固化 Intake、Build、Review、Repair 和 Release 规则。
- 五条 GitHub Actions Workflow 接入 Supabase Feedback 与 Codex 本地队列，并串联统一 Issue、Draft PR、验收、Repair 和生产发布。
- 两个入口都先创建 `content:raw` Issue；完成资格判断后在同一个 Issue 上晋升为 `content:processed`。命中重复 Problem 时，当前 Issue 评论 canonical Issue、添加 `duplicate` 并关闭。
- Codex Job 不接收 GitHub、Supabase Service Role 或 Vercel 写凭据；确定性 Controller Job 才能临时读取必要凭据。
- 在用户明确确认后，Codex 也可作为 Issue 上报入口：它只把已校验的 `codex-conversation` Issue Contract 写入受控本地队列，独立发布控制器再创建 GitHub Issue。
- R0/R1 可自动合并发布，R2 必须经过 GitHub Environment 审批，R3 只分析、不改代码。

## 演示场景

初始版本有意保留一个已知缺陷：查询 Repair Status 时，Tracking ID 的首尾空格没有被清理。原始 ID 可以查询，`"  <tracking-id>  "` 会返回未找到。

这不是遗漏，而是 [ADR 0020](docs/adr/0020-first-automated-repair-scenario.md) 定义的第一条端到端自动修复场景。首次真实演示应通过应用提交该 Feedback，让自动化创建 Issue、生成 PR、补充验收测试、修复并发布。修复完成后应删除本节中的缺陷声明。

## 本地运行

要求 Node.js 24 和 pnpm 11.7.0。

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

`.env.local` 需要：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
```

应用入口为 `http://localhost:3000`。健康检查为 `GET /health`。

## 验证

```bash
pnpm verify
pnpm build
pnpm test:smoke -- --base-url="https://<deployment-url>"
```

`pnpm verify` 包含格式、Lint、TypeScript、单元测试、Migration 结构检查和 Workflow 静态检查。Smoke Test 会写入标记为 `synthetic=true` 的 Feedback；在自动化流程中，Controller 会在验收后清理这些数据。

已知缺陷的验收输入保存在 `tests/acceptance/tracking-id-whitespace.spec.md`，初始版本不会把它加入通过门禁。

## 部署与自动化配置

按顺序完成：

1. [配置 Supabase](docs/setup.md#supabase)。
2. [配置 Vercel](docs/setup.md#vercel)。
3. [创建 GitHub App、Variables、Secrets、Labels 和 Environment](docs/setup.md#github)。
4. [配置专用 macOS Runner](docs/setup.md#自托管-macos-runner)。
5. 按 [运行手册](docs/runbook.md) 部署初始版本并执行第一条真实 Feedback 闭环。

Vercel 的 Git 自动部署通过 `vercel.json` 关闭。PR Gate 先构建 production 配置的预发布部署，使用 `--skip-domain` 暂不绑定生产域名；Smoke Test 通过后，PR Outcome 用 `vercel promote` 提升同一个 Deployment。这样验收和生产使用同一构建产物。

当前仓库未配置 `main` Ruleset 或 Branch Protection，普通 push 和直接写入 `main` 不受 PR 或 Required status checks 限制。自动化生成的 PR 仍按 PR Gate → PR Outcome 执行完整验收与发布；这是自动化流程自身的状态机，不是 GitHub 仓库规则。

## Codex 对话 Issue 上报

这是 Codex 对话的直接入口，不需要用户打开 GitHub 或提交应用内 Feedback。Intake 仍在 `read-only` Sandbox 生成 Issue Contract；用户明确确认后，Codex 只执行本地入队：

```bash
node scripts/controllers/enqueue-conversation-issue.mjs \
  .ai/runs/conversation/contract.json
```

Contract 必须通过 `.ai/schemas/issue-contract.schema.json`，`source.kind` 为 `codex-conversation`，且 `source.references` 必须含有 `conversation:explicit-user-confirmation`。入队命令不读取 GitHub、Supabase 或部署凭据。

发布控制器必须由不同于 Codex 的受信任系统身份定时运行，并从受保护的凭据存储注入短时 GitHub App Token：

```bash
node scripts/controllers/publish-conversation-issues.mjs
```

两个进程使用相同的 `SIGNALPATCH_CONVERSATION_QUEUE` 目录；未设置时默认使用 `~/.signalpatch/conversation-issue-queue`。生产环境应让发布身份拥有该目录、让 Codex 身份只拥有写入权限，并将队列放在专用共享组目录。发布器会重新校验 Contract、按 `.ai/policy.yaml` 只上调风险、以请求 UUID 防重，并在成功后把 Issue 编号和 URL 写到 `completed/`。它才读取 `GH_TOKEN` 和 `GITHUB_REPOSITORY`；这两个变量不得传给 Codex。

## 设计文档

- [项目上下文与统一语言](CONTEXT.md)
- [实施交接与完成定义](HANDOFF.md)
- [架构决策记录](docs/adr)
- [安全边界](SECURITY.md)
- [部署配置](docs/setup.md)
- [运行手册](docs/runbook.md)

## API

- `POST /api/feedback`：提交匿名 Feedback，返回不可预测的 Tracking ID。
- `GET /api/status/:trackingId`：查询最小 Repair Status。
- `GET /health`：应用健康检查。

## License

[MIT](LICENSE)
