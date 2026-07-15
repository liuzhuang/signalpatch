# 自动修复是有界循环

PR Gate 失败后先归一化日志并生成 Failure Fingerprint。Repair Agent 只接收 Issue Contract、当前 PR Diff、当前失败摘要与 Fingerprint、上一轮修改摘要、允许修改路径和尝试次数，不接收完整历史对话或无限日志。

CI 基础设施错误先原样重试一次，仍失败时把 Issue 标记为 `ai:human-required`，并把 Repair Status 更新为 `HUMAN_REQUIRED`。缺少仓库脚本等配置错误需要 R2 Issue Contract 和人工批准，不消耗业务 Repair 次数。只有应用代码或测试失败进入自动 Repair，最多尝试三次。同一 Fingerprint 连续出现两次、没有有效修改、超出允许路径、风险升级到 R2/R3、修改受保护文件、弱化测试、发现安全或数据风险、验收冲突或三次仍失败时，立即转入相同人工终态。

Builder、Reviewer 和 Repair 使用独立 Codex CLI 执行。Reviewer 使用只读 Sandbox，Builder 与 Repair 使用工作区写入 Sandbox。
