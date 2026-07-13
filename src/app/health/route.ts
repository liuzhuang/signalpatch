import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    version:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local",
  });
}
