# 使用四个 Workflow 串联完整生命周期

SignalPatch 使用 `feedback-intake.yml`、`issue-delivery.yml`、`pr-gate.yml` 和 `pr-outcome.yml`，并由 `publish-conversation-issues.yml` 接入本地 Codex 队列。两个入口都先创建 raw Issue，再原地晋升为 processed Issue，并显式 dispatch Delivery。Delivery 创建 Draft PR；PR Gate 执行验证、独立审查、Preview 和验收；PR Outcome 仅通过一层 `workflow_run` 在失败时修复、成功时合并和发布。

读取 Secret 前必须验证同仓库 PR、`ai/issue-` 分支、GitHub App Bot 作者，以及 Workflow Run SHA 仍等于 PR 当前 Head SHA。Preview Deployment 信息作为 Workflow Artifact 传递。`automation_runs` 保存跨 Workflow 状态。Issue Label 展示 raw、processed、重复和 Automation Run 阶段，不作为 Contract 的替代数据。

所有阶段使用 Issue 并发锁，并以 `repository + issue_number + stage + head_sha + attempt` 作为幂等键，防止重复 Webhook、扫描和 Dispatch 造成重复执行。
