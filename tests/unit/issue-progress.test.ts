import { describe, expect, it } from "vitest";

import {
  extractStartedAt,
  progressComment,
  progressMarker,
  trustedProgressComment,
} from "../../scripts/controllers/issue-progress.mjs";

describe("Issue Delivery progress comment", () => {
  it("keeps the start time when rendering the completion state", () => {
    const body = progressComment({
      startedAt: "2026-07-14T10:00:00.000Z",
      finishedAt: "2026-07-14T10:05:00.000Z",
      result: "success",
      runUrl: "https://github.com/liuzhuang/signalpatch/actions/runs/1",
    });

    expect(body).toContain(progressMarker);
    expect(body).toContain("Codex 执行完成，进入验证");
    expect(extractStartedAt(body)).toBe("2026-07-14T10:00:00.000Z");
    expect(body).toContain("2026-07-14T10:05:00.000Z");
  });

  it("shows execution in progress before an end time exists", () => {
    expect(
      progressComment({
        startedAt: "2026-07-14T10:00:00.000Z",
        runUrl: "https://github.com/liuzhuang/signalpatch/actions/runs/1",
      }),
    ).toContain("Codex 执行中");
  });

  it("ignores a public progress marker and reuses only the configured App Bot comment", () => {
    const appBot = "signalpatch-automation[bot]";
    const comments = [
      {
        id: 1,
        body: progressMarker,
        user: { type: "User", login: "external-user" },
      },
      {
        id: 2,
        body: progressMarker,
        user: { type: "Bot", login: appBot },
      },
    ];

    expect(trustedProgressComment(comments, appBot)?.id).toBe(2);
    expect(
      trustedProgressComment(comments.slice(0, 1), appBot),
    ).toBeUndefined();
  });
});
