# 首个自动修复任务是 Tracking ID 空格问题

初始 Demo 有意保留一个小型输入规范化缺陷：有效 Tracking ID 带首尾空格时，Repair Status 查询返回未找到。用户只需提交“复制追踪编号后总是查不到”这样的稀疏 Feedback，Feedback Context 自动附带功能、路由、Commit 版本、错误码和时间。

Evidence Agent 将其补齐为 R1 Issue Contract。验收要求原始 ID 和带首尾空格的 ID 返回同一状态，不存在的 ID 仍返回未找到，并通过本地门禁与 Preview Smoke Test。允许修改范围限定为 Status API、Tracking ID 规范化模块和测试。

该已知缺陷在 README 中明确标记为端到端自动化演示场景，用于证明 Feedback、Issue、Codex、PR、Repair、Acceptance 和 Release 的完整闭环。
