# 使用 Vercel Preview 与 Production

SignalPatch 由 GitHub Actions 使用固定版本的 Vercel CLI 构建一次 Preview Deployment，完成 Smoke Test 后再将同一部署提升到 Production；Supabase 独立管理数据，发布失败时回滚到上一 Production Deployment。
