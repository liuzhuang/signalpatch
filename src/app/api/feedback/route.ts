import { NextResponse } from "next/server";

import { parseFeedbackInput } from "@/lib/feedback";
import { submitFeedback } from "@/lib/feedback-store";

export const runtime = "nodejs";

////////////////////////////////////////////////////
// 先在 API 边界解析不可信 JSON；请求结构、正文长度和 Context 白名单均由共享解析器校验
////////////////////////////////////////////////////
export async function POST(request: Request) {
  let parsed: ReturnType<typeof parseFeedbackInput>;
  try {
    const payload = (await request.json()) as unknown;
    parsed = parseFeedbackInput(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Feedback 请求格式有误";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    ////////////////////////////////////////////////////
    // 客户端未提供时才补充部署 Commit 和发生时间，保留通过白名单检查的 Feedback Context
    ////////////////////////////////////////////////////
    const context = {
      ...parsed.context,
      commitSha:
        parsed.context.commitSha ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        process.env.GITHUB_SHA ??
        "local",
      occurredAt: parsed.context.occurredAt ?? new Date().toISOString(),
    };
    const result = await submitFeedback({ ...parsed, context });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    ////////////////////////////////////////////////////
    // 持久化错误只记录在服务端，对外统一返回 503，避免泄露数据库错误细节
    ////////////////////////////////////////////////////
    console.error("Feedback persistence failed", error);
    return NextResponse.json(
      { error: "Feedback 服务暂时不可用" },
      { status: 503 },
    );
  }
}
