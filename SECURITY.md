# 安全策略

## 支持范围

SignalPatch 是自动化流程参考实现，不承诺生产级 SLA。仅 `main` 分支的最新版本属于支持范围。

## 报告漏洞

请不要把漏洞细节、凭据或真实用户 Feedback 发布到公开 Issue。请通过 GitHub 仓库的私密漏洞报告功能提交；如果该功能尚未启用，请先联系仓库所有者建立私密沟通渠道。

报告应包含受影响组件、可复现步骤、影响判断和建议缓解方式，但不要包含真实用户会话、Service Role Key、Vercel Token、GitHub App Private Key 或 Codex 会话文件。

## 信任边界

- Feedback、Issue Body、评论、PR Diff 和失败日志均视为不可信输入。
- Intake 与 Reviewer 使用只读 Sandbox；Builder 与 Repair 只允许写工作区。
- Codex 进程通过清空环境变量启动，不继承 GitHub、Supabase 或 Vercel 写凭据。
- GitHub App Token 只在确定性 Controller 步骤中短时创建。
- Supabase 匿名角色不能直接读取三张业务表，只能执行两个受限 RPC。
- `signalpatch` 是专用业务 schema；`public` 不承载 SignalPatch 业务表。
- 自托管 Runner 应使用专用 macOS 系统用户，不得复用个人 GitHub CLI 登录或个人工作目录。

完整约束见 [ADR 0014](docs/adr/0014-separate-codex-from-credentials.md) 与 [部署配置](docs/setup.md)。
