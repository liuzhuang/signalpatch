import { NextResponse } from "next/server";

////////////////////////////////////////////////////
// 健康检查同时返回当前部署 Commit，供 Preview 和 Production Smoke Test 核对版本
////////////////////////////////////////////////////
export function GET() {
  return NextResponse.json({
    status: "ok",
    version:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local",
  });
}
