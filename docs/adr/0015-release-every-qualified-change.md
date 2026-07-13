# 每个合格 PR 都成为一个生产版本

每个通过全部门禁的 R0/R1 PR 自动合并到 `main`，随后将已通过 Smoke Test 的同一个 Vercel Preview Deployment 提升为 Production，再执行 Production Smoke Test。版本标识使用 Git Commit SHA 与 Vercel Deployment ID，不额外维护 Semantic Version 或 GitHub Release。

Demo 的 Preview 与 Production 共用一个 Supabase 项目，以保证提升的是同一份已验证 Deployment 和配置。Smoke Test 数据标记为 `synthetic=true` 并在测试后清理；清理凭据只提供给确定性 Deployment Job。数据库迁移属于 R2，不能自动合并。
