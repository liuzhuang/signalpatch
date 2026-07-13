# Codex 与控制器和部署凭据隔离

真实用户 Feedback 和 GitHub Issue 都是不可信输入。Intake 与 Reviewer 使用只读 Sandbox，Builder 与 Repair 使用工作区写入 Sandbox；所有 Codex 进程都不接收 `GH_TOKEN`、Supabase Secret、Vercel Token 或部署权限，也不允许直接提交、推送、评论或发布。禁止对不可信输入使用 `danger-full-access`。

Controller 负责读取外部数据、脱敏、校验 Codex 的结构化输出和 Diff，并在校验通过后临时使用 GitHub Token。Deployment Job 不运行 Codex，只执行确定性发布和 Smoke Test。Issue 与 Feedback 通过文件或标准输入传递，不拼接进 Shell 命令。

自托管 macOS Runner 使用独立系统用户，只保留 Codex 订阅登录、Action 工作目录和必要构建工具，不使用个人 `gh` 凭据或访问个人文件。
