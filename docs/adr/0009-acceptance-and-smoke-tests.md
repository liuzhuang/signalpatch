# 使用本地门禁与真实部署 Smoke Test

每个 PR 必须依次通过 `pnpm install --frozen-lockfile`、`pnpm verify` 和 `pnpm build`。`pnpm verify` 固定执行 Prettier Check、ESLint、TypeScript Type Check 和 Vitest。

Builder 和 Repair 必须先在 Codex CLI 中运行针对性 Validator、`pnpm verify` 和 `pnpm build`。Controller 只接受阶段与 Contract 风险一致、无 P0/P1 finding、`decision=APPROVE` 且两条固定命令均为 `passed` 的结构化结果，其他结果不得生成 Patch。PR Gate 随后在干净的 Ubuntu Checkout 中独立复跑 `pnpm verify` 和 `pnpm build`；Codex 预检不能替代这次复验。依赖 Preview 或 Production 的 Validator 仍由后续 Controller Job 执行，不在 Builder 或 Repair 中伪报为 `not-run`。

Vercel Preview 连接测试用 Supabase 环境，使用 `pnpm test:smoke -- --base-url="$PREVIEW_URL"` 验证匿名提交 Feedback、获得 Tracking ID 和查询 Repair Status。Preview 通过后提升同一个 Deployment 到 Production，并使用相同命令验证生产地址。

第一版不在自托管 Runner 启动本地 Supabase。应用代码、测试或 Preview Smoke Test 失败时进入 Codex Repair，最多自动修复三次；配置错误和基础设施重试失败直接转为 `HUMAN_REQUIRED`。Production Smoke Test 失败时回滚到上一个健康 Deployment，并将 Issue 转为 `HUMAN_REQUIRED`。
