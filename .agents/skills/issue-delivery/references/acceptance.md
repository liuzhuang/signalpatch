# Acceptance and release evidence

<!--
  当前 Workflow 不直接渲染 acceptance 阶段 Prompt；Production Job 由确定性 Controller 汇总这些字段。
  本参考保留最终成功声明的完整证据标准，防止只凭 build 或 Preview 就关闭 Issue。
-->

For each Acceptance Criterion, record the validator, result, and artifact or URL. A final success report must include the Issue, PR, commit SHA, Preview deployment, Production deployment, Preview Smoke Test, Production Smoke Test, and criterion-by-criterion evidence.

Do not claim success from a build alone. The Issue remains open until Production acceptance succeeds. A Production Smoke Test failure requires rollback evidence and `HUMAN_REQUIRED`.
