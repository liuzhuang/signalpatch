# 两种 Issue 来源使用不同入口

Codex 多轮对话在用户明确确认一次后，先检查本机 `gh` 是否拥有仓库 Issue 写权限；有权限时直接复用统一发布生命周期创建 Issue，没有权限时才将 Issue Contract 写入本地队列，由 `publish-conversation-issues.yml` 使用确定性 Controller 创建 `content:raw` Issue。非重复时在同一个 Issue 上改为 `content:processed`，该标签事件自动启动 Delivery。

应用内 Feedback 只由 Next.js API 写入 Supabase。`feedback-intake.yml` 定时扫描未处理 Feedback，也支持 `workflow_dispatch` 立即扫描。Intake Agent 使用 `issue-intake` Skill 生成脱敏结果；Controller 创建 `content:raw` Issue，达到 `SPEC_READY` 后在同一个 Issue 上改为 `content:processed`。

两个入口使用同一套 Problem 指纹去重。命中已有 processed Issue 时，Controller 在当前 Issue 评论重复目标、添加 `duplicate` 标签并关闭当前 Issue；否则由 `content:processed` 标签事件启动 `issue-delivery.yml`。手动创建的 Issue 只要包含有效 Issue Contract 并添加该标签，也进入同一 Delivery；`workflow_dispatch` 仅作为运维补跑入口。
