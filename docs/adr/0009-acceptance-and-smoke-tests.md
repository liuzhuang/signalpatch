# 使用本地门禁与真实部署 Smoke Test

每个 PR 必须依次通过 `pnpm install --frozen-lockfile`、`pnpm verify` 和 `pnpm build`。`pnpm verify` 固定执行 Prettier Check、ESLint、TypeScript Type Check 和 Vitest。

Vercel Preview 连接测试用 Supabase 环境，使用 `pnpm test:smoke -- --base-url="$PREVIEW_URL"` 验证匿名提交 Feedback、获得 Tracking ID 和查询 Repair Status。Preview 通过后提升同一个 Deployment 到 Production，并使用相同命令验证生产地址。

第一版不在自托管 Runner 启动本地 Supabase。门禁或 Smoke Test 失败时进入 Codex Repair，最多自动修复三次。Production Smoke Test 失败时回滚到上一个健康 Deployment，并将 Issue 转为 `HUMAN_REQUIRED`。
