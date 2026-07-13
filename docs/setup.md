# SignalPatch 部署配置

## 目标

把公开仓库、Supabase、Vercel、GitHub App 和专用 Runner 连接成可运行的自动化闭环。配置完成后，Vercel 应用只持有 Supabase 匿名凭据；GitHub Actions 的确定性 Job 持有服务端凭据；Codex Job 不持有任何外部写凭据。

## Supabase

### 创建项目并应用 Migration

创建一个托管 Supabase 项目，然后在仓库根目录执行：

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase db push
```

Migration 创建独立的 `signalpatch` schema、三张业务表、RLS、枚举、触发器和两个 RPC。不要在 `public` schema 复制这些表。

### 暴露专用 schema

Migration 会把 PostgREST 的 Exposed schemas 配置为 `signalpatch`，并重新加载配置与 schema cache，无需在 Supabase Dashboard 手工修改。Migration 同时显式授予最小 schema、表和函数权限；仅暴露 schema 不足以替代这些授权。

用 SQL Editor 复核：

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'signalpatch'
order by table_name;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'signalpatch'
order by grantee, table_name, privilege_type;
```

预期只出现 `automation_runs`、`feedback`、`problems`。`anon` 不应拥有这些表的 `SELECT` 权限。

### 收集配置值

- `SUPABASE_URL`：项目 URL，存为 GitHub Repository Variable。
- `NEXT_PUBLIC_SUPABASE_URL`：同一项目 URL，存为 Vercel 环境变量。
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`：Publishable Key；若项目仍使用旧式密钥，可暂填 Anon Key。存为 Vercel 环境变量。
- `SUPABASE_SERVICE_ROLE_KEY`：仅存为 GitHub Actions Secret，禁止进入 Vercel、Codex 环境或仓库文件。

## Vercel

### 创建项目

从公开 GitHub 仓库创建 Vercel Project，但不要依赖 Git 推送部署。`vercel.json` 已设置 `git.deploymentEnabled=false`，所有部署由 GitHub Actions 使用固定版本 Vercel CLI 创建。

在 Production 环境配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

然后收集：

- `VERCEL_ORG_ID`：GitHub Actions Secret。
- `VERCEL_PROJECT_ID`：GitHub Actions Secret。
- `VERCEL_TOKEN`：仅 GitHub Actions Secret。
- `PRODUCTION_URL`：带 `https://` 的稳定自定义生产域名，GitHub Repository Variable。不要使用项目自动生成的 `.vercel.app` Alias；`--skip-domain` 只禁止分配自定义生产域名，系统 Alias 仍可能指向新的 Deployment。

### 同一产物提升

先为项目配置自定义生产域名，并把它用于 `PRODUCTION_URL`。PR Gate 执行：

```bash
vercel pull --environment=production
vercel build --prod
vercel deploy --prebuilt --prod --skip-domain
```

第三条命令创建使用生产配置、但尚未绑定生产域名的 staged deployment。Preview Smoke Test 针对它的唯一 URL 运行。验收通过后，PR Outcome 执行：

```bash
vercel promote <accepted-deployment-url>
```

不要重新构建或创建第二个 Production Deployment，否则会破坏“验收产物等于生产产物”的证据链。

## GitHub

### 创建专用 GitHub App

创建名为 `signalpatch-automation` 的 GitHub App，只安装到 `liuzhuang/signalpatch`。Webhook 可关闭；流程使用 Actions 主动创建短时 Installation Token。

Repository permissions：

- Metadata：Read-only。
- Actions：Read and write。
- Checks：Read and write。
- Contents：Read and write。
- Issues：Read and write。
- Pull requests：Read and write。

生成 Private Key，并配置：

- Repository Variable `SIGNALPATCH_APP_ID`：App ID。
- Repository Variable `SIGNALPATCH_APP_BOT`：通常为 `<app-slug>[bot]`，必须与 PR 作者登录名完全一致。
- Repository Secret `SIGNALPATCH_APP_PRIVATE_KEY`：完整 PEM 内容。

### Repository Variables

- `SUPABASE_URL`
- `PRODUCTION_URL`
- `SIGNALPATCH_APP_ID`
- `SIGNALPATCH_APP_BOT`

### Repository Secrets

- `SIGNALPATCH_APP_PRIVATE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VERCEL_TOKEN`

### Labels

创建以下 Label：

- `ai:ready`
- `ai:building`
- `ai:verifying`
- `ai:repairing`
- `ai:observing`
- `ai:needs-input`
- `ai:human-required`
- `ai:done`
- `risk:r0`
- `risk:r1`
- `risk:r2`
- `risk:r3`

### Environments

- `production`：供 R0/R1 的最终发布 Job 使用，不设置人工审批。
- `r2-approval`：设置 Required reviewers，供 R2 最终发布前人工审批。

### Ruleset

为 `main` 创建分支 Ruleset：

- 禁止删除和强制推送。
- 要求 Pull Request。
- 要求 `verify`、`build`、`independent-review`、`preview-smoke` 通过。
- 允许安装后的 `signalpatch-automation` GitHub App 完成合并。

初次配置阶段可在 Workflow 尚未产生检查名时暂缓启用 Required checks；四个检查各成功运行一次后立即收紧。

## 自托管 macOS Runner

### 隔离要求

Runner 使用独立 macOS 系统用户和独立目录，只安装 Node、pnpm、Git、Codex CLI 与构建所需工具。该用户只登录 Codex 订阅，不登录个人 `gh`，不保存 GitHub App、Supabase 或 Vercel 凭据。

### 注册

在仓库 `Settings -> Actions -> Runners -> New self-hosted runner` 获取一次性注册命令。注册时添加自定义 Label `signalpatch`，最终 Label 必须同时匹配：

```text
self-hosted, macOS, ARM64, signalpatch
```

在 Runner 目录安装并启动服务：

```bash
./config.sh --url https://github.com/liuzhuang/signalpatch --token <one-time-token> --labels signalpatch --unattended
./svc.sh install
./svc.sh start
./svc.sh status
```

`svc.sh install` 应由专用系统用户执行。不要把个人仓库已有 Runner 直接复用给 SignalPatch。

### Codex 验证

切换到专用 Runner 用户，确认：

```bash
/Applications/ChatGPT.app/Contents/Resources/codex --version
/Applications/ChatGPT.app/Contents/Resources/codex exec --ephemeral --sandbox read-only "Reply with OK only"
```

## 退出条件

- `signalpatch` schema 的 Migration 已在远端应用，匿名 RPC 实测通过，直接表读取被拒绝。
- Vercel 初始 Production Deployment 的 `/health` 返回成功。
- GitHub App、Variables、Secrets、Labels、Environments、Ruleset 都已配置。
- 专用 Runner 在线且显示四个预期 Label。
- 四条 Workflow 可被 GitHub 解析，并至少完成一次真实闭环。
