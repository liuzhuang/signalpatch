# 使用专用 GitHub App 执行仓库写操作

SignalPatch 使用只安装到 `liuzhuang/signalpatch` 的 GitHub App `signalpatch-automation`，不使用个人 PAT，也不把 `GITHUB_TOKEN` 交给 Codex。App 权限限定为 Metadata 读取，以及 Contents、Issues、Pull requests、Actions 和 Checks 的必要读写权限。

仓库保存 `SIGNALPATCH_APP_ID` Variable 和 `SIGNALPATCH_APP_PRIVATE_KEY` Secret。Workflow 每次运行生成短时 Installation Token，仅 Controller 步骤可见，用于创建 Issue、推送 AI 分支、创建或更新 PR、更新状态、合并和启动 Workflow。Codex 进程不继承该 Token。
