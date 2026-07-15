# 使用本地门禁与真实部署 Smoke Test

每个 PR 必须依次通过 `pnpm install --frozen-lockfile`、`pnpm verify` 和 `pnpm build`。`pnpm verify` 固定执行 Prettier Check、ESLint、TypeScript Type Check 和 Vitest。

Builder 和 Repair 必须先在 Codex CLI 中运行不依赖本地服务、浏览器或 Sandbox 网络的针对性 Validator，以及 `pnpm verify`。Controller 只接受阶段与 Contract 风险一致、无 P0/P1 finding、`decision=APPROVE`、`pnpm verify=passed` 且不包含 `failed` 或 `not-run` 的结构化结果，其他结果不得生成 Patch。Codex Sandbox 不运行 `pnpm build`，也不启动本地服务或浏览器；其进程设置 `pnpm_config_verify_deps_before_run=false`，复用 Controller 已完成的依赖安装，避免 pnpm 在无网络 Sandbox 中自行重装。PR Gate 在干净的 Ubuntu Checkout 中独立执行 `pnpm verify`、`pnpm build` 和 Preview Smoke，Production Validator 由 PR Outcome 执行。Codex 预检只提前阻断已知失败，不能替代这些独立门禁。

Vercel Preview 连接测试用 Supabase 环境，使用 `pnpm test:smoke -- --base-url="$PREVIEW_URL"` 验证匿名提交 Feedback、获得 Tracking ID 和查询 Repair Status。Preview 通过后提升同一个 Deployment 到 Production，并使用相同命令验证生产地址。

第一版不在自托管 Runner 启动本地 Supabase。应用代码、测试或 Preview Smoke Test 失败时进入 Codex Repair，最多自动修复三次；配置错误和基础设施重试失败直接转为 `HUMAN_REQUIRED`。Production Smoke Test 失败时回滚到上一个健康 Deployment，并将 Issue 转为 `HUMAN_REQUIRED`。
