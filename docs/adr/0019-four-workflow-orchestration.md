# 使用四个 Workflow 串联完整生命周期

SignalPatch 使用 `feedback-intake.yml`、`manual-issue-intake.yml`、`issue-delivery.yml`、`pr-gate.yml` 和 `pr-outcome.yml`，并由 `publish-conversation-issues.yml` 接入本地 Codex 队列。Feedback 与 Codex 对话入口创建 raw Issue；手动入口由 Issue 和用户评论事件触发，并原地更新当前 raw Issue；所有入口达到 `SPEC_READY` 后晋升为 processed Issue，`content:processed` 标签事件统一启动 Delivery。Delivery 创建 Draft PR；PR Gate 执行验证、独立审查、Preview 和验收；PR Outcome 仅通过一层 `workflow_run` 在失败时修复、成功时合并和发布。

GitHub 仓库不使用 Ruleset 或 Branch Protection 约束 `main`。PR Gate 的四项结果属于自动化流程内部证据，不作为 Required Checks；自动化仍只在 Gate 成功后进入 finalize。

读取 Secret 前必须验证同仓库 PR、`ai/issue-` 分支、GitHub App Bot 作者，以及 Workflow Run SHA 仍等于 PR 当前 Head SHA。Preview Deployment 信息作为 Workflow Artifact 传递。`automation_runs` 保存跨 Workflow 状态。Issue Label 展示 raw、processed、重复和 Automation Run 阶段，不作为 Contract 的替代数据。

所有阶段使用 Issue 并发锁，并以 `repository + issue_number + stage + head_sha + attempt` 作为幂等键。Manual Intake 合并同一 Issue 的连续用户事件，机器人事件使用独立 Run 并直接跳过；Issue Delivery 的非 `content:processed` 标签事件同样使用独立 Run，不能替换真正的待执行事件。Manual Intake 使用持久化修订指纹和 Delivery 实时校验，防止旧 Contract 忽略新评论。Feedback 与 Codex 发布器把编号更小的已验证 raw Issue 纳入 canonical 选择，消除跨入口同时晋升造成的重复执行。
