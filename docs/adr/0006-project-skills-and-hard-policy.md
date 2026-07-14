# 使用两个项目 Skill 与确定性策略门禁

SignalPatch 使用两个仓库级 Skill 固化 Codex 工作流：`issue-intake` 负责将 Codex 对话或应用 Feedback 转化为可执行 Issue，`issue-delivery` 负责规划、实现、PR 审查、自动修复、验收和发布。角色 Prompt 作为 Skill 的引用文件随仓库版本化，GitHub Actions 显式要求 Codex 使用对应 Skill。

Skill 和 `AGENTS.md` 负责指导模型如何工作，但不作为唯一安全边界。允许修改路径、风险等级、最大修复次数、自动合并和生产发布权限，由 `.ai/policy.yaml`、`scripts/ai/`、GitHub Actions、GitHub App 最小权限与 Environment 确定性执行。

当前 `main` 不配置 Ruleset 或 Branch Protection，PR Gate 结果也不是 Required status checks。PR Gate 仍是 SignalPatch 自动化内部的验收状态机；放宽仓库写入不等于删除 Contract、风险等级、exact-head、凭据隔离或生产验收。
