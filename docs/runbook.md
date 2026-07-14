# SignalPatch 运行手册

## 目标

部署初始版本，并用已知的 Tracking ID 首尾空格缺陷验证从 Feedback 到生产发布的完整闭环。

## 初始发布

完成 [部署配置](setup.md) 后，使用 Vercel CLI 创建初始生产部署：

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm build
pnpm exec vercel pull --yes --environment=production
pnpm exec vercel build --prod
pnpm exec vercel deploy --prebuilt --prod --yes
```

记录生产 URL，并执行：

```bash
pnpm test:smoke -- --base-url="https://<production-url>"
```

确认 `GET /health`、Feedback 提交和原始 Tracking ID 查询均成功。

## 触发第一条 Feedback

在生产页面提交一条最小 Feedback，例如：

```text
复制 Tracking ID 后，如果粘贴内容前后带有空格，Repair Status 会显示未找到。希望查询前自动忽略首尾空格。
```

保存页面返回的 Tracking ID。等待最多五分钟，或在 GitHub Actions 手动运行 `Feedback Intake`。

## 观察证据链

### Feedback Intake

预期：

- 扫描器只领取一个待处理 Feedback。
- Codex 只读取脱敏 evidence，没有 Supabase Service Role Key。
- 输出通过 JSON Schema 校验。
- Controller 先创建 `content:raw` Issue；达到 `SPEC_READY` 后在同一个 Issue 上改为 `content:processed`，并显式 dispatch `Issue Delivery`。
- 如果同一 Problem 已有 processed Issue，当前 raw Issue 评论 canonical Issue、添加 `duplicate` 并关闭，不再启动 Delivery。

### Issue Delivery

预期：

- Issue 风险为 R1。
- Builder 只能修改 Contract 允许的 Status API、Tracking ID 规范化模块和测试。
- Controller 创建 `ai/issue-<number>-delivery` 分支和 Draft PR。
- PR Body 使用 `Refs #<number>`，Issue 暂不关闭。

### PR Gate

预期四个自动化验收 Job 通过：

- `verify`
- `build`
- `independent-review`
- `preview-smoke`

`preview-smoke` 必须验证原始 Tracking ID、带首尾空格的 Tracking ID 和不存在的 ID。失败时，`PR Outcome` 应归一化日志并启动有界 Repair；同一 Failure Fingerprint 重复、越界修改或超过三次时转为 `ai:human-required`。

这四项结果不属于 Required Checks。当前 `main` 没有 Ruleset 或 Branch Protection；PR Gate 只负责决定自动化流程是否进入 PR Outcome。

### PR Outcome

R1 全部通过后应自动：

1. 把 Draft PR 标为 Ready 并以当前 Head SHA 为条件合并。
2. 提升 Preview Smoke Test 已验收的同一个 Vercel Deployment。
3. 对稳定 Production URL 再跑一次 Smoke Test。
4. 写入 `automation_runs`，在 Issue 发布最终证据评论，加 `ai:done` 并关闭 Issue。

最终评论应包含 PR、Commit、Preview、Production 和每条 Acceptance Criterion 的证据。

## 失败处理

### 基础设施失败

首次基础设施失败由 Workflow 原样重试失败 Job。第二次仍失败时停止自动代码修改，检查 Runner 在线状态、Vercel/Supabase 可用性和 Secret 是否过期。

### 应用失败

允许最多三次 Repair。不要手动扩大 Issue Contract 的 `allowedPaths` 来绕过策略；需要扩大范围时，新建或更新 Issue Contract，并重新评估风险。

### Production Smoke Test 失败

Workflow 请求 Vercel rollback，并把 Issue 标记为 `ai:human-required`。检查 Production Alias 是否已恢复到上一健康 Deployment，再处理测试产生的 `synthetic=true` 数据。

### 清理 Smoke Test 数据

自动化会调用：

```bash
node scripts/controllers/cleanup-smoke.mjs <tracking-id-file>
```

该命令需要 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，只能在确定性 Controller 环境执行。

## 完成证据

- 生产页面可访问，`/health` 正常。
- Supabase 中存在对应 Problem、Feedback 和完整 Automation Run 记录。
- GitHub Issue、AI 分支、Draft PR、检查结果和最终评论可公开核对。
- 生产环境中带首尾空格的 Tracking ID 查询成功。
- Issue 只在 Production Smoke Test 成功后关闭。
