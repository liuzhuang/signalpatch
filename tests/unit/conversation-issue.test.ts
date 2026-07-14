import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertConversationContract,
  assertConversationRequest,
  issueBodyForRequest,
  newConversationRequest,
} from "../../scripts/controllers/lib/conversation-issue.mjs";

function contract() {
  return {
    status: "SPEC_READY",
    source: {
      kind: "codex-conversation",
      references: ["conversation:explicit-user-confirmation"],
    },
    problemSummary: "Codex 可以通过受控队列提交 Issue",
    actualBehavior: "Codex 不能直接提交 Issue。",
    expectedBehavior: "确认后由独立控制器创建 Issue。",
    evidence: [
      {
        kind: "confirmed-conversation-summary",
        value: "已确认需要受控发布入口。",
        redacted: true,
      },
    ],
    reproductionSteps: ["在 Codex 中请求提交一个 SPEC_READY Issue Contract。"],
    acceptanceCriteria: [
      {
        id: "AC-1",
        statement: "Contract 被提交到受控队列。",
        validator: "unit test",
      },
    ],
    nonGoals: ["不向 Codex 暴露凭据。"],
    allowedPaths: ["src/app/page.tsx"],
    riskLevel: "R1",
    runtimeAcceptance: ["pnpm verify"],
    privacy: {
      rawConversationIncluded: false,
      redactionSummary: "只保留脱敏摘要。",
    },
  };
}

describe("conversation issue queue", () => {
  it("accepts a confirmed conversation contract and renders an idempotency marker", () => {
    const request = newConversationRequest(
      contract(),
      "2026-07-13T12:00:00.000Z",
    );

    expect(assertConversationContract(request.contract)).toEqual(
      request.contract,
    );
    expect(assertConversationRequest(request)).toEqual(request);
    expect(issueBodyForRequest(request)).toContain(
      `signalpatch-conversation-request:${request.requestId}`,
    );
  });

  it("rejects a contract without explicit confirmation", () => {
    const unconfirmed = contract();
    unconfirmed.source.references = ["conversation:summary-only"];

    expect(() => assertConversationContract(unconfirmed)).toThrow(
      "explicit user confirmation",
    );
  });

  it("keeps the Intake confirmation marker aligned with the publisher", () => {
    expect(
      readFileSync(".agents/skills/issue-intake/SKILL.md", "utf8"),
    ).toContain("conversation:explicit-user-confirmation");
  });

  it("rejects requests whose identifier is not a UUID", () => {
    const request = newConversationRequest(
      contract(),
      "2026-07-13T12:00:00.000Z",
    );

    expect(() =>
      assertConversationRequest({ ...request, requestId: "not-a-uuid" }),
    ).toThrow("UUID");
  });

  it("queues a confirmed contract without GitHub credentials", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "signalpatch-conversation-"),
    );
    const contractPath = join(directory, "contract.json");
    await writeFile(contractPath, `${JSON.stringify(contract())}\n`);
    const environment = { ...process.env };
    delete environment.GH_TOKEN;
    delete environment.GITHUB_TOKEN;

    try {
      const output = execFileSync(
        process.execPath,
        ["scripts/controllers/enqueue-conversation-issue.mjs", contractPath],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...environment,
            SIGNALPATCH_CONVERSATION_QUEUE: join(directory, "queue"),
          },
        },
      );
      const queued = JSON.parse(output);
      const request = JSON.parse(
        await readFile(
          join(directory, "queue", "pending", `${queued.requestId}.json`),
          "utf8",
        ),
      );

      expect(queued.state).toBe("QUEUED");
      expect(assertConversationRequest(request)).toEqual(request);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
