# 三种 Issue 来源使用不同入口

Codex 多轮对话在用户明确确认一次后，先检查本机 `gh` 是否拥有仓库 Issue 写权限；有权限时直接复用统一发布生命周期创建 Issue，没有权限时才将 Issue Contract 写入本地队列，由 `publish-conversation-issues.yml` 使用确定性 Controller 创建 `content:raw` Issue。非重复时在同一个 Issue 上改为 `content:processed`，该标签事件自动启动 Delivery。

应用内 Feedback 只由 Next.js API 写入 Supabase。`feedback-intake.yml` 定时扫描未处理 Feedback，也支持 `workflow_dispatch` 立即扫描。Intake Agent 使用 `issue-intake` Skill 生成脱敏结果；Controller 创建 `content:raw` Issue，达到 `SPEC_READY` 后在同一个 Issue 上改为 `content:processed`。

手动创建的 GitHub Issue 使用 `manual-issue-intake.yml` 监听 Issue 创建、正文修改、重新打开、`content:raw` 标签和用户评论事件。Controller 定向读取触发事件对应的 Issue 正文及全部非机器人评论；产品方向明确时由 Intake 结合仓库补齐执行细节，只有非产品意见、与产品无关或没有可识别产品结果时才要求补充。达到 `SPEC_READY` 时由 GitHub App Bot 把 Contract 写入专用评论，再原地改为 `content:processed`，不创建第二个 Issue。

Manual Intake 不接管带 `signalpatch-feedback:*`、`signalpatch-conversation-request:*` 的系统 Issue。每次资格判断记录上下文指纹；写回后再次读取正文与非机器人评论，输入变化时撤销旧生成区并恢复 raw，由最新事件继续处理。用户在 `ai:ready` 阶段补充上下文时生成新修订；Delivery 只接受与实时上下文指纹一致的修订。`ai:building` 作为本轮上下文截止点。

应用 Feedback 与 Codex 对话入口使用同一套 Problem 指纹去重。发布器按 Issue number 选择最早的已验证 raw 或 processed Issue 作为 canonical；较晚的相同 Problem Issue 关闭为重复，因此并发入口不会启动两个 Delivery。手动 Issue 不创建第二个 Issue；达到 `SPEC_READY` 后由 `content:processed` 标签事件启动 `issue-delivery.yml`。`workflow_dispatch` 仅作为运维补跑入口。
