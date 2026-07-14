# Codex 与控制器和部署凭据隔离

真实用户 Feedback 和 GitHub Issue 都是不可信输入。Intake 与 Reviewer 使用只读 Sandbox，Builder 与 Repair 使用工作区写入 Sandbox；所有 Codex 进程都不接收 `GH_TOKEN`、Supabase Secret、Vercel Token 或部署权限。对话入口仅允许 `enqueue-conversation-issue.mjs` 检查本机 `gh` 登录上下文并直接完成 Issue 生命周期；push、评论、合并、部署等其他外部写操作仍禁止由 Codex 执行。没有可用 `gh` 权限时，Contract 必须进入受控队列。禁止对不可信输入使用 `danger-full-access`。

Controller 负责读取外部数据、脱敏、校验 Codex 的结构化输出和 Diff，并在校验通过后临时使用 GitHub Token。Deployment Job 不运行 Codex，只执行确定性发布和 Smoke Test。Issue 与 Feedback 通过文件或标准输入传递，不拼接进 Shell 命令。

自托管 macOS Runner 使用独立系统用户，只保留 Codex 订阅登录、必要构建工具和受控的 `gh` 登录上下文，不访问个人文件；队列兜底发布仍使用独立 GitHub App Token。
