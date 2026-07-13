# SignalPatch

SignalPatch 是一个公开的参考实现：把匿名产品 Feedback 转化为可审计的 GitHub Issue Contract，再由 Codex 完成受约束的修改、独立审查、Preview 验收、合并和生产发布。

这个仓库的重点不是建设完整的反馈平台，而是展示一条真实、可复现、凭据隔离的 AI-native Issue-to-production 流程。

## 当前能力

- Next.js 应用提供匿名 Feedback 提交和 Repair Status 查询。
- Supabase 使用独立的 `signalpatch` schema，仅保存 `feedback`、`problems`、`automation_runs` 三张业务表。
- 匿名客户端不能直接读取表，只能调用 `submit_feedback` 和 `get_repair_status` 两个受限 RPC。
- `issue-intake` 与 `issue-delivery` 两个项目级 Skill 固化 Intake、Build、Review、Repair 和 Release 规则。
- 四条 GitHub Actions Workflow 串联 Feedback、Issue、Draft PR、验收、Repair 和生产发布。
- Codex Job 不接收 GitHub、Supabase Service Role 或 Vercel 写凭据；确定性 Controller Job 才能临时读取必要凭据。
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
3. [创建 GitHub App、Variables、Secrets、Environment 和 Ruleset](docs/setup.md#github)。
4. [配置专用 macOS Runner](docs/setup.md#自托管-macos-runner)。
5. 按 [运行手册](docs/runbook.md) 部署初始版本并执行第一条真实 Feedback 闭环。

Vercel 的 Git 自动部署通过 `vercel.json` 关闭。PR Gate 先构建 production 配置的预发布部署，使用 `--skip-domain` 暂不绑定生产域名；Smoke Test 通过后，PR Outcome 用 `vercel promote` 提升同一个 Deployment。这样验收和生产使用同一构建产物。

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
