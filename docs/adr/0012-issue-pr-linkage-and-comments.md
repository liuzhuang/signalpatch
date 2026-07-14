# Issue 在生产验收后关闭

Delivery 从 `ai:ready` Issue 创建 `ai/issue-<number>-<slug>` 分支和 Draft PR，PR 使用 `Refs #<number>` 建立关联，不使用自动关闭关键字。PR 通过 CI、独立审查、自动修复和 Preview Smoke Test 后合并；Issue 保持打开，直到 Production 发布和 Smoke Test 成功。

状态标签为 `ai:ready`、`ai:building`、`ai:verifying`、`ai:repairing`、`ai:observing`、`ai:needs-input`、`ai:human-required` 和 `ai:done`。

内容阶段标签为 `content:raw` 和 `content:processed`。同一个 Issue 从 raw 原地晋升为 processed；重复 Issue 保留 `content:raw`，添加 `duplicate`，评论 canonical Issue 后关闭。

Issue 评论只用于缺少输入、需要人工决策、回滚、最终验收和 Delivery 进度。Issue Delivery 由 Controller 维护一条固定的进度评论：开始 Codex 前写入 `ai:building` 与 UTC 开始时间，Codex 结束后更新结束时间并转为 `ai:verifying` 或 `ai:human-required`；不为每个步骤追加新评论。创建 PR 不额外评论，自动修复只更新 PR 中的一条固定状态评论，避免每轮产生新评论。最终验收评论必须包含 PR、Commit、Preview、Production 和逐条 Acceptance Criterion 证据。

`main` 不配置 Ruleset 或 Branch Protection，不要求通过 Pull Request 写入，也没有 Required status checks。自动化创建的 PR 仍由 PR Gate 和 PR Outcome 完成验收、修复、合并与发布。
