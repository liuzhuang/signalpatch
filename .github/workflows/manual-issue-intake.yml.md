# manual-issue-intake.yml 说明

`manual-issue-intake.yml` 每 5 分钟扫描已有的 `content:raw` GitHub Issue。它只修改当前 Issue，不创建新的 Issue。

## 流程

```text
已有 content:raw Issue
        ↓
collect 读取正文和非机器人评论
        ↓
qualify 使用 read-only Codex 判断
        ├─ NEEDS_EVIDENCE → 原 Issue 评论缺失信息，保留 content:raw
        └─ SPEC_READY     → 原 Issue 写入 Contract，晋升 content:processed
                                      ↓
                               Issue Delivery
```

## 触发方式

- 定时：每 5 分钟处理最早更新的一个 `content:raw` Issue。
- 手动：在 Actions 中运行 `Manual Issue Intake`，可填写 `issue_number` 指定 Issue。

用户在 Issue 评论中补充上下文后，下一轮定时任务会重新读取这些非机器人评论。评论使用缺失证据指纹幂等，重复运行不会刷屏。

`qualify` 只接收脱敏的 Issue 正文和评论作为不可信证据，不接收 GitHub 写凭据；只有 `publish` Controller 可以评论、修改正文和标签。
