# Builder stage

<!--
  本文件只在 --stage build 时进入 Prompt。Runner 提供 main 工作树、Issue Contract 和 Issue 快照；
  Codex 不持外部写凭据，产出的 Diff 还要经过 allowedPaths 与风险策略校验才会发布到 AI 分支。
-->

Use a `workspace-write` sandbox with no external write credentials.

1. Reproduce the actual behavior.
2. Add or update one acceptance test at a public seam.
3. Implement the smallest change that satisfies the current criterion.
4. Run the validator named by the criterion, then `pnpm verify` and `pnpm build` when applicable.
5. Report changed paths, command results, residual risks, and any risk escalation.

Do not broaden the product, refactor unrelated code, or edit Workflow, Skill, Prompt, policy, dependency, or migration files unless the Issue is already classified R2 and awaiting human approval.
