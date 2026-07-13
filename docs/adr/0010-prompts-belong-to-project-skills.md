# Prompt 归属于项目 Skill

SignalPatch 不维护独立的 `.ai/prompts/` 副本。`issue-intake` 和 `issue-delivery` 的阶段 Prompt、输出 Schema 与参考资料存放在各自 `.agents/skills/<name>/references/` 下，随 Skill 一起版本化。

GitHub Actions 不依赖 Codex 隐式发现 Skill。`scripts/ai/render-prompt.sh` 确定性组合根目录 `AGENTS.md`、对应 `SKILL.md`、当前阶段参考文件、Issue Contract 和本轮证据，再通过标准输入交给本地 Codex CLI。Prompt 或 Skill 变更统一判定为 `R2`。

`.ai/` 只保存机器策略、共享 Schema 和不入库的单次运行上下文。
