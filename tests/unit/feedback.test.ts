import { describe, expect, it } from "vitest";

import { parseFeedbackInput } from "@/lib/feedback";

describe("Feedback input", () => {
  it("accepts sparse feedback and keeps only bounded context", () => {
    expect(
      parseFeedbackInput({
        message: "复制追踪编号后总是查不到",
        context: {
          feature: "repair-status",
          route: "/",
          commitSha: "abc123",
          errorCode: "STATUS_NOT_FOUND",
          occurredAt: "2026-07-13T08:00:00.000Z",
          ignored: "not persisted",
        },
      }),
    ).toEqual({
      message: "复制追踪编号后总是查不到",
      context: {
        feature: "repair-status",
        route: "/",
        commitSha: "abc123",
        errorCode: "STATUS_NOT_FOUND",
        occurredAt: "2026-07-13T08:00:00.000Z",
      },
    });
  });

  it("rejects empty feedback", () => {
    expect(() => parseFeedbackInput({ message: "   " })).toThrow(
      "Feedback 内容不能为空",
    );
  });
});
