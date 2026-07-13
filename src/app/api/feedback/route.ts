import { NextResponse } from "next/server";

import { parseFeedbackInput } from "@/lib/feedback";
import { submitFeedback } from "@/lib/feedback-store";

export const runtime = "nodejs";

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
    console.error("Feedback persistence failed", error);
    return NextResponse.json(
      { error: "Feedback 服务暂时不可用" },
      { status: 503 },
    );
  }
}
