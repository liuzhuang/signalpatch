# Supabase 只保存三个业务实体

SignalPatch 使用 `feedback`、`problems` 和 `automation_runs` 三个表。多个 Feedback 通过 `problem_id` 归入一个 Problem，一个 Problem 可以拥有多次 Automation Run。应用只暴露 `POST /api/feedback`、`GET /api/status/:trackingId` 和 `GET /health`。

应用使用 Supabase Anon Key。匿名调用只允许提交 Feedback，并通过受限 RPC 使用不可预测的 Tracking ID 查询最小 Repair Status；不能遍历 Feedback、Problem、运行上下文或内部 ID。Intake Controller 使用 Service Role 扫描和更新待处理 Feedback，Service Role 不进入 Codex。Smoke Test 数据标记 `synthetic=true` 并在测试后清理。
