# manual-issue-intake.yml 说明

`manual-issue-intake.yml` 由 GitHub Issue 和用户评论事件触发。它只修改触发事件对应的手工 Issue，新建 Issue 无需预置标签；它不创建第二个 Issue。

## 流程

```text
新建或已有 content:raw Issue
        ↓
collect 读取当前正文和全部非机器人评论
        ↓
qualify 使用 read-only Codex 判断
        ├─ NEEDS_EVIDENCE → 原 Issue 评论缺失信息，保留 content:raw
        └─ SPEC_READY     → App Bot 评论写入 Contract，晋升 content:processed
                                      ↓
                               Issue Delivery
```

## 触发方式

- 自动：Issue 创建、正文修改、重新打开或添加 `content:raw` 标签时处理当前 Issue。
- 评论：用户创建、编辑或删除评论时重新读取当前正文和全部非机器人评论。
- 手动：在 Actions 中运行 `Manual Issue Intake`，可填写 `issue_number` 指定 Issue。

机器人评论、PR 评论、关闭或重复 Issue，以及 Feedback/Codex 发布器生成的系统 Issue 均会跳过。产品方向明确时，Intake 根据仓库现状自行补齐实现细节、响应式边界和 Validator；只有输入不是产品意见、与产品无关或没有可识别结果时才进入补证据分支。补证据评论使用缺失证据指纹保证幂等，重复运行不会刷屏。

`collect` 会为标题、用户原始正文和非机器人评论计算上下文指纹。GitHub App Bot 在自己可编辑的专用评论中保存 Contract 与 `signalpatch-manual-context:<sha256>` 修订标记；Issue 作者不能修改这条可信 Contract 评论，用户正文也不会被生成内容覆盖。

`qualify` 运行期间发生新的正文或评论变更时，`publish` 在晋升后再次读取上下文。指纹变化时会恢复 `content:raw`，由已排队的最新事件重新评估。若用户在 `content:processed + ai:ready` 阶段继续补充上下文，Manual Intake 会更新 App Bot Contract 评论并生成新修订；旧 Delivery 在 `prepare` 或执行认领阶段因指纹或 Contract digest 不一致而安全空跑。Delivery 完成原子认领并切换到 `ai:building` 后，本轮自动 Intake 不再接收新上下文。

`qualify` 只接收脱敏的 Issue 正文和评论作为不可信证据，不接收 GitHub 写凭据；只有 `publish` Controller 可以写 App Bot Contract 评论和修改标签。
