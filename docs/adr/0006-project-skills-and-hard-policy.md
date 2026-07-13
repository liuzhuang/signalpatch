# 使用两个项目 Skill 与确定性策略门禁

SignalPatch 使用两个仓库级 Skill 固化 Codex 工作流：`issue-intake` 负责将 Codex 对话或应用 Feedback 转化为可执行 Issue，`issue-delivery` 负责规划、实现、PR 审查、自动修复、验收和发布。角色 Prompt 作为 Skill 的引用文件随仓库版本化，GitHub Actions 显式要求 Codex 使用对应 Skill。

Skill 和 `AGENTS.md` 负责指导模型如何工作，但不作为安全边界。允许修改路径、风险等级、最大修复次数、Required Checks、自动合并和生产发布权限，由 `.ai/policy.yaml`、`scripts/ai/`、GitHub Actions 与 GitHub Rulesets 确定性执行。
