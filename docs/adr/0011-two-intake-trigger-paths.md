# 两种 Issue 来源使用不同入口

Codex 多轮对话在用户明确确认一次后，由 Codex 使用 `gh issue create` 创建符合 Issue Contract 的 GitHub Issue，`issues.opened` 启动 Delivery。

应用内 Feedback 只由 Next.js API 写入 Supabase。`feedback-intake.yml` 每五分钟在自托管 Runner 扫描未处理 Feedback，也支持 `workflow_dispatch` 立即扫描。Intake Agent 使用 `issue-intake` Skill 补齐脱敏证据、去重并归入 Problem，达到 `SPEC_READY` 后创建 Issue。

Vercel 应用不持有 GitHub Token。由 scanner 创建 Issue 后，Workflow 显式启动 Delivery，不依赖使用 `GITHUB_TOKEN` 创建资源后产生的隐式事件链。
