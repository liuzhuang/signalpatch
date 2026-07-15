import { afterEach, describe, expect, it, vi } from "vitest";

import {
  claimIssueForDelivery,
  contractIssueBody,
  findDuplicateIssue,
  findMarkedIssue,
  issueContextFingerprint,
  issueContextFrom,
  issueContractDigest,
  issueContractText,
  issueLabels,
  isManualIssueCandidate,
  isCurrentManualRevision,
  isReadyForDelivery,
  listAll,
  manualContractBody,
  manualContractComment,
  manualIssueContextFingerprint,
  problemFingerprint,
  promoteManualIssue,
  publishContractIssue,
  publishRawIssue,
} from "../../scripts/controllers/lib/issue-lifecycle.mjs";

const contract = {
  problemSummary: "Tracking ID lookup fails",
  actualBehavior: " A copied ID returns not found. ",
  expectedBehavior: "A copied ID resolves.",
  riskLevel: "R1",
};
const appBot = "signalpatch-automation[bot]";

describe("Issue lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps one Issue raw until the Contract is promoted", () => {
    expect(issueLabels.raw()).toEqual(["content:raw"]);
    expect(issueLabels.processed(contract)).toEqual([
      "content:processed",
      "ai:ready",
      "risk:r1",
    ]);
  });

  it("uses a stable Problem fingerprint in the Issue body", () => {
    const fingerprint = problemFingerprint(contract);
    const body = contractIssueBody(contract, "signalpatch-feedback:example");

    expect(body).toContain(`signalpatch-problem:${fingerprint}`);
    expect(body).toContain("signalpatch-feedback:example");
    expect(
      problemFingerprint({
        ...contract,
        problemSummary: " tracking   id LOOKUP fails ",
      }),
    ).toBe(fingerprint);
  });

  it("uses only an older processed Issue as the canonical duplicate", () => {
    const issues = [
      {
        number: 14,
        title: "[SignalPatch] Tracking ID lookup fails",
        body: contractIssueBody(contract, "signalpatch-feedback:fourteen"),
        labels: [{ name: "content:processed" }],
        author_association: "OWNER",
      },
      {
        number: 12,
        title: "[SignalPatch] Tracking ID lookup fails",
        body: contractIssueBody(contract, "signalpatch-feedback:twelve"),
        labels: [{ name: "ai:done" }],
        author_association: "OWNER",
      },
      {
        number: 10,
        state: "open",
        title: "[SignalPatch] Tracking ID lookup fails",
        body: contractIssueBody(contract, "signalpatch-feedback:ten"),
        labels: [{ name: "content:raw" }],
        author_association: "OWNER",
      },
    ];

    expect(findDuplicateIssue(issues, contract, 15)?.number).toBe(12);
    expect(findDuplicateIssue(issues, contract, 12)?.number).toBe(14);
  });

  it("selects an older qualified raw Issue before concurrent publishers promote", () => {
    const lowerRawIssue = {
      number: 20,
      state: "open",
      body: contractIssueBody(
        contract,
        "signalpatch-conversation-request:lower",
      ),
      labels: [{ name: "content:raw" }],
      author_association: "OWNER",
    };
    const higherRawIssue = {
      number: 21,
      state: "open",
      body: contractIssueBody(contract, "signalpatch-feedback:higher"),
      labels: [{ name: "content:raw" }],
      author_association: "OWNER",
    };

    expect(
      findDuplicateIssue(
        [higherRawIssue, lowerRawIssue],
        contract,
        higherRawIssue.number,
      )?.number,
    ).toBe(lowerRawIssue.number);
    expect(
      findDuplicateIssue(
        [higherRawIssue, lowerRawIssue],
        contract,
        lowerRawIssue.number,
      ),
    ).toBeNull();
  });

  it("does not promote a public raw Issue with forged system markers", () => {
    const forged = {
      number: 20,
      state: "open",
      body: contractIssueBody(
        contract,
        "signalpatch-conversation-request:forged",
      ),
      labels: [{ name: "content:raw" }],
      user: { type: "User", login: "external-user" },
      author_association: "NONE",
    };

    expect(findDuplicateIssue([forged], contract, 21, appBot)).toBeNull();
  });

  it("uses the trusted Manual Contract comment instead of a user-editable Issue marker", () => {
    const manualIssue = {
      number: 20,
      state: "open",
      body: contractIssueBody(contract, "signalpatch-manual-issue:20"),
      labels: [{ name: "content:processed" }, { name: "source:manual" }],
      user: { type: "User", login: "external-user" },
      author_association: "NONE",
    };
    const differentContract = {
      ...contract,
      expectedBehavior: "The result remains unchanged.",
    };
    const commentsByIssue = new Map([
      [
        20,
        [
          {
            id: 1,
            body: manualContractBody(
              "",
              contractIssueBody(
                differentContract,
                "signalpatch-manual-issue:20",
              ),
              "a".repeat(64),
            ),
            user: { type: "Bot", login: appBot },
          },
        ],
      ],
    ]);

    expect(
      findDuplicateIssue([manualIssue], contract, 21, appBot, commentsByIssue),
    ).toBeNull();
    commentsByIssue.set(20, [
      {
        id: 2,
        body: manualContractBody(
          "",
          contractIssueBody(contract, "signalpatch-manual-issue:20"),
          "a".repeat(64),
        ),
        user: { type: "Bot", login: appBot },
      },
    ]);
    expect(
      findDuplicateIssue([manualIssue], contract, 21, appBot, commentsByIssue)
        ?.number,
    ).toBe(20);
  });

  it("trusts marker reuse only from the configured publisher identity", () => {
    const marker = "signalpatch-feedback:feedback:example";
    const issues = [
      { number: 1, body: `<!-- ${marker} -->`, labels: [] },
      {
        number: 2,
        body: `<!-- ${marker} -->`,
        labels: [{ name: "content:raw" }],
        user: { type: "User", login: "external-user" },
        author_association: "NONE",
      },
      {
        number: 3,
        body: `<!-- ${marker} -->`,
        labels: [{ name: "content:raw" }],
        user: { type: "Bot", login: appBot },
        author_association: "NONE",
      },
    ];

    expect(findMarkedIssue(issues.slice(0, 2), marker, appBot)).toBeNull();
    expect(findMarkedIssue(issues, marker, appBot)?.number).toBe(3);
  });

  it("creates a new Issue instead of reusing a public forged marker", async () => {
    const marker = "signalpatch-feedback:feedback:tracking-id";
    const publicIssue = {
      number: 1,
      state: "open",
      body: `forged\n<!-- ${marker} -->`,
      labels: [{ name: "content:raw" }],
      user: { type: "User", login: "external-user" },
      author_association: "NONE",
    };
    let createdPayload: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(
      async (input: URL | RequestInfo, init: RequestInit = {}) => {
        const url = String(input);
        if (url.includes("/labels")) return new Response("[]");
        if (url.includes("/issues?") && !init.method) {
          return new Response(JSON.stringify([publicIssue]));
        }
        if (url.endsWith("/issues") && init.method === "POST") {
          createdPayload = JSON.parse(String(init.body));
          return new Response(JSON.stringify({ number: 2, ...createdPayload }));
        }
        if (url.endsWith("/labels") && init.method === "POST") {
          return new Response(JSON.stringify(JSON.parse(String(init.body))));
        }
        throw new Error(`Unexpected request: ${init.method ?? "GET"} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const issue = await publishRawIssue({
      repository: "liuzhuang/signalpatch",
      token: "token",
      marker,
      title: "Trusted title",
      body: `trusted\n<!-- ${marker} -->`,
      trustedBotLogin: appBot,
    });

    expect(issue.number).toBe(2);
    expect(createdPayload).toMatchObject({
      title: "Trusted title",
      body: `trusted\n<!-- ${marker} -->`,
    });
  });

  it("rewrites a trusted raw marker with controller-owned content", async () => {
    const marker = "signalpatch-feedback:feedback:tracking-id";
    const trustedRaw = {
      number: 1,
      state: "open",
      body: `old\n<!-- ${marker} -->`,
      labels: [{ name: "content:raw" }],
      user: { type: "Bot", login: appBot },
      author_association: "CONTRIBUTOR",
    };
    let patchedPayload: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(
      async (input: URL | RequestInfo, init: RequestInit = {}) => {
        const url = String(input);
        if (url.includes("/labels")) {
          return new Response(
            JSON.stringify([
              { name: "content:raw" },
              { name: "content:processed" },
              { name: "duplicate" },
              { name: "source:manual" },
            ]),
          );
        }
        if (url.includes("/issues?") && !init.method) {
          return new Response(JSON.stringify([trustedRaw]));
        }
        if (url.endsWith("/issues/1") && init.method === "PATCH") {
          patchedPayload = JSON.parse(String(init.body));
          return new Response(
            JSON.stringify({ ...trustedRaw, ...patchedPayload }),
          );
        }
        throw new Error(`Unexpected request: ${init.method ?? "GET"} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const issue = await publishRawIssue({
      repository: "liuzhuang/signalpatch",
      token: "token",
      marker,
      title: "Trusted title",
      body: `trusted\n<!-- ${marker} -->`,
      trustedBotLogin: appBot,
    });

    expect(issue.number).toBe(1);
    expect(patchedPayload).toMatchObject({
      title: "Trusted title",
      body: `trusted\n<!-- ${marker} -->`,
      labels: ["content:raw"],
    });
  });

  it("does not reset an idempotently reused processed Issue to ai:ready", async () => {
    const marker = "signalpatch-feedback:feedback:already-building";
    const existing = {
      number: 8,
      state: "open",
      body: contractIssueBody(contract, marker),
      labels: [
        { name: "content:processed" },
        { name: "ai:building" },
        { name: "risk:r1" },
      ],
      user: { type: "Bot", login: appBot },
      author_association: "NONE",
    };
    const fetchMock = vi.fn(
      async (input: URL | RequestInfo, init: RequestInit = {}) => {
        const url = String(input);
        if (url.includes("/labels")) {
          return new Response(
            JSON.stringify([
              { name: "content:raw" },
              { name: "content:processed" },
              { name: "duplicate" },
              { name: "source:manual" },
            ]),
          );
        }
        if (url.includes("/issues?") && !init.method) {
          return new Response(JSON.stringify([existing]));
        }
        throw new Error(`Unexpected request: ${init.method ?? "GET"} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishContractIssue({
      repository: "liuzhuang/signalpatch",
      token: "token",
      contract,
      idempotencyMarker: marker,
      trustedBotLogin: appBot,
    });

    expect(result).toEqual({ issue: existing, duplicate: null });
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("keeps only user comments in a stable Issue context snapshot", () => {
    const issue = {
      number: 27,
      state: "open",
      title: "Homepage update",
      body: "Initial context",
      labels: [{ name: "content:raw" }],
    };
    const comments = [
      {
        body: "Use this visible copy",
        created_at: "2026-07-15T01:00:00Z",
        user: { type: "User" },
      },
      {
        body: "Automation progress",
        created_at: "2026-07-15T01:01:00Z",
        user: { type: "Bot" },
      },
    ];

    expect(issueContextFrom(issue, comments)).toEqual({
      title: "Homepage update",
      message: "Initial context",
      comments: [
        {
          body: "Use this visible copy",
          createdAt: "2026-07-15T01:00:00Z",
        },
      ],
    });
    expect(issueContextFingerprint(issue, comments)).not.toBe(
      issueContextFingerprint(issue, [
        { ...comments[0], body: "Changed context" },
      ]),
    );
  });

  it("accepts only open unqualified manual Issues", () => {
    const issue = {
      number: 27,
      state: "open",
      body: "Manual request",
      labels: [{ name: "content:raw" }],
    };

    expect(isManualIssueCandidate(issue)).toBe(true);
    expect(isManualIssueCandidate({ ...issue, labels: [] })).toBe(true);
    expect(isManualIssueCandidate({ ...issue, user: { type: "Bot" } })).toBe(
      false,
    );
    expect(isManualIssueCandidate({ ...issue, pull_request: {} })).toBe(false);
    expect(isManualIssueCandidate({ ...issue, state: "closed" })).toBe(false);
    expect(
      isManualIssueCandidate({
        ...issue,
        labels: [{ name: "content:raw" }, { name: "duplicate" }],
      }),
    ).toBe(false);
    expect(
      isManualIssueCandidate({
        ...issue,
        body: "<!-- signalpatch-feedback:feedback:example -->",
      }),
    ).toBe(false);
    expect(
      isManualIssueCandidate({
        ...issue,
        body: "<!-- signalpatch-contract:start -->",
      }),
    ).toBe(false);
  });

  it("re-enters Manual Intake only when a ready revision has new user context", () => {
    const userComments = [
      {
        id: 1,
        body: "Use the shorter copy",
        created_at: "2026-07-15T01:00:00Z",
        user: { type: "User" },
      },
    ];
    const rawIssue = {
      number: 27,
      state: "open",
      title: "Homepage update",
      body: "Initial context",
      user: { type: "User" },
      labels: [{ name: "content:raw" }],
    };
    const fingerprint = manualIssueContextFingerprint(rawIssue, userComments);
    const trustedContractComment = {
      id: 2,
      body: manualContractBody(
        "",
        contractIssueBody(contract, "signalpatch-manual-issue:27"),
        fingerprint,
      ),
      created_at: "2026-07-15T01:00:30Z",
      user: { type: "Bot", login: appBot },
    };
    const comments = [...userComments, trustedContractComment];
    const readyIssue = {
      ...rawIssue,
      labels: [
        { name: "content:processed" },
        { name: "ai:ready" },
        { name: "source:manual" },
      ],
    };

    expect(isCurrentManualRevision(readyIssue, comments, appBot)).toBe(true);
    expect(isManualIssueCandidate(readyIssue, comments, appBot)).toBe(false);
    expect(
      isCurrentManualRevision(
        readyIssue,
        [
          ...comments,
          {
            id: 2,
            body: "Also update the mobile copy",
            created_at: "2026-07-15T01:01:00Z",
            user: { type: "User" },
          },
        ],
        appBot,
      ),
    ).toBe(false);
    expect(
      isManualIssueCandidate(
        readyIssue,
        [
          ...comments,
          {
            id: 2,
            body: "Also update the mobile copy",
            created_at: "2026-07-15T01:01:00Z",
            user: { type: "User" },
          },
        ],
        appBot,
      ),
    ).toBe(true);
    expect(
      isCurrentManualRevision(
        readyIssue,
        [
          ...comments,
          {
            id: 4,
            body: "Automation progress",
            created_at: "2026-07-15T01:02:00Z",
            user: { type: "Bot", login: appBot },
          },
        ],
        appBot,
      ),
    ).toBe(true);
  });

  it("reads a manual Contract only from the configured App Bot comment", () => {
    const trustedBody = manualContractBody(
      "",
      contractIssueBody(contract, "signalpatch-manual-issue:27"),
      "a".repeat(64),
    );
    const forgedContract = { ...contract, riskLevel: "R0" };
    const forgedBody = contractIssueBody(
      forgedContract,
      "signalpatch-manual-issue:27",
    );
    const publicIssue = {
      number: 27,
      body: forgedBody,
      labels: [{ name: "content:processed" }],
      user: { type: "User", login: "external-user" },
      author_association: "NONE",
    };

    expect(issueContractText(publicIssue, [], appBot)).toBeNull();
    expect(
      issueContractText(
        {
          ...publicIssue,
          labels: [{ name: "content:processed" }, { name: "source:manual" }],
        },
        [
          {
            id: 1,
            body: forgedBody,
            user: { type: "User", login: "external-user" },
          },
          {
            id: 2,
            body: trustedBody,
            user: { type: "Bot", login: appBot },
          },
        ],
        appBot,
      ),
    ).toBe(JSON.stringify(contract, null, 2));
    expect(
      manualContractComment(
        [
          {
            id: 1,
            body: trustedBody,
            user: { type: "Bot", login: "untrusted-app[bot]" },
          },
        ],
        appBot,
      ),
    ).toBeNull();
  });

  it("normalizes manual source whitespace consistently across revisions", () => {
    const issue = {
      title: "Whitespace request",
      body: "  keep this spacing\n\n",
      labels: [{ name: "content:raw" }],
    };
    const fingerprint = manualIssueContextFingerprint(issue, []);
    const comments = [
      {
        id: 1,
        body: manualContractBody(
          "",
          contractIssueBody(contract, "signalpatch-manual-issue:27"),
          fingerprint,
        ),
        user: { type: "Bot", login: appBot },
      },
    ];

    expect(manualIssueContextFingerprint(issue, comments)).toBe(fingerprint);
  });

  it("does not let public Manual Contract markers hide user context", () => {
    const issue = {
      title: "Marker request",
      body: "Initial context",
      labels: [{ name: "content:raw" }],
    };
    const wrapped = {
      ...issue,
      body: manualContractBody(
        issue.body,
        "User-controlled text that must remain context",
        "a".repeat(64),
      ),
    };

    expect(manualIssueContextFingerprint(wrapped, [])).not.toBe(
      manualIssueContextFingerprint(issue, []),
    );
  });

  it("restores raw when a user comment arrives between the final read and PATCH", async () => {
    const issue = {
      number: 27,
      state: "open",
      title: "Homepage update",
      body: "Initial context",
      user: { type: "User" },
      labels: [{ name: "content:raw" }],
    };
    const expectedContextFingerprint = manualIssueContextFingerprint(issue, []);
    let currentIssue = issue;
    let commentReads = 0;
    let contractComment: Record<string, unknown> | null = null;
    const patches: Array<{ body?: string; labels: string[] }> = [];
    const fetchMock = vi.fn(
      async (input: URL | RequestInfo, init: RequestInit = {}) => {
        const url = String(input);
        if (url.includes("/labels")) {
          return new Response(
            JSON.stringify([
              { name: "content:raw" },
              { name: "content:processed" },
              { name: "duplicate" },
              { name: "source:manual" },
            ]),
          );
        }
        if (url.includes("/comments") && init.method === "POST") {
          const payload = JSON.parse(String(init.body));
          contractComment = {
            id: 10,
            body: payload.body,
            created_at: "2026-07-15T01:00:30Z",
            user: { type: "Bot", login: appBot },
          };
          return new Response(JSON.stringify(contractComment));
        }
        if (url.includes("/comments")) {
          commentReads += 1;
          return new Response(
            JSON.stringify(
              commentReads === 1
                ? []
                : [
                    contractComment,
                    {
                      id: 2,
                      body: "Late but valid context",
                      created_at: "2026-07-15T01:01:00Z",
                      user: { type: "User" },
                    },
                  ],
            ),
          );
        }
        if (init.method === "PATCH") {
          const patch = JSON.parse(String(init.body));
          patches.push(patch);
          currentIssue = {
            ...currentIssue,
            body: patch.body ?? currentIssue.body,
            labels: patch.labels.map((name: string) => ({ name })),
          };
          return new Response(JSON.stringify(currentIssue));
        }
        return new Response(JSON.stringify(currentIssue));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await promoteManualIssue({
      repository: "liuzhuang/signalpatch",
      token: "token",
      issueNumber: issue.number,
      expectedContextFingerprint,
      contractBody: contractIssueBody(contract, "signalpatch-manual-issue:27"),
      addLabels: issueLabels.processed(contract),
      trustedBotLogin: appBot,
    });

    expect(result.status).toBe("stale");
    expect(patches).toHaveLength(2);
    expect(patches[0].labels).toContain("content:processed");
    expect(patches[1].labels).toContain("content:raw");
    expect(patches[1].labels).not.toContain("content:processed");
    expect(patches[1].body).toBeUndefined();
  });

  it("rolls back the Delivery claim when a comment lands before building", async () => {
    const issue = {
      number: 27,
      state: "open",
      title: "Homepage update",
      body: "Initial context",
      user: { type: "User", login: "external-user" },
      author_association: "NONE",
      labels: [
        { name: "content:processed" },
        { name: "ai:ready" },
        { name: "source:manual" },
        { name: "risk:r1" },
      ],
    };
    const fingerprint = manualIssueContextFingerprint(issue, []);
    const contractComment = {
      id: 10,
      body: manualContractBody(
        "",
        contractIssueBody(contract, "signalpatch-manual-issue:27"),
        fingerprint,
      ),
      created_at: "2026-07-15T01:00:00Z",
      user: { type: "Bot", login: appBot },
    };
    const preparedText = issueContractText(issue, [contractComment], appBot);
    let currentIssue = issue;
    let commentReads = 0;
    const patches: Array<{ labels: string[] }> = [];
    const fetchMock = vi.fn(
      async (input: URL | RequestInfo, init: RequestInit = {}) => {
        const url = String(input);
        if (url.includes("/comments")) {
          commentReads += 1;
          return new Response(
            JSON.stringify(
              commentReads === 1
                ? [contractComment]
                : [
                    contractComment,
                    {
                      id: 11,
                      body: "Arrived during claim",
                      created_at: "2026-07-15T01:00:01Z",
                      user: { type: "User", login: "external-user" },
                    },
                  ],
            ),
          );
        }
        if (init.method === "PATCH") {
          const patch = JSON.parse(String(init.body));
          patches.push(patch);
          currentIssue = {
            ...currentIssue,
            labels: patch.labels.map((name: string) => ({ name })),
          };
          return new Response(JSON.stringify(currentIssue));
        }
        return new Response(JSON.stringify(currentIssue));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await claimIssueForDelivery({
      repository: "liuzhuang/signalpatch",
      token: "token",
      issueNumber: issue.number,
      expectedContractDigest: issueContractDigest(preparedText!),
      trustedBotLogin: appBot,
    });

    expect(result).toMatchObject({
      started: false,
      reason: "context-changed",
    });
    expect(patches).toHaveLength(2);
    expect(patches[0].labels).toContain("ai:building");
    expect(patches[1].labels).toContain("content:raw");
    expect(patches[1].labels).not.toContain("content:processed");
  });

  it("does not claim Contract B with the artifact digest from Contract A", async () => {
    const issue = {
      number: 27,
      state: "open",
      title: "Homepage update",
      body: "Initial context",
      user: { type: "User", login: "external-user" },
      author_association: "NONE",
      labels: [
        { name: "content:processed" },
        { name: "ai:ready" },
        { name: "source:manual" },
      ],
    };
    const fingerprint = manualIssueContextFingerprint(issue, []);
    const contractComment = {
      id: 10,
      body: manualContractBody(
        "",
        contractIssueBody(contract, "signalpatch-manual-issue:27"),
        fingerprint,
      ),
      user: { type: "Bot", login: appBot },
    };
    const fetchMock = vi.fn(async (input: URL | RequestInfo) =>
      String(input).includes("/comments")
        ? new Response(JSON.stringify([contractComment]))
        : new Response(JSON.stringify(issue)),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await claimIssueForDelivery({
      repository: "liuzhuang/signalpatch",
      token: "token",
      issueNumber: issue.number,
      expectedContractDigest: "0".repeat(64),
      trustedBotLogin: appBot,
    });

    expect(result).toEqual({ started: false, reason: "contract-changed" });
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("starts Delivery only from the live ready state", () => {
    const issue = {
      state: "open",
      labels: [{ name: "content:processed" }, { name: "ai:ready" }],
    };

    expect(isReadyForDelivery(issue)).toBe(true);
    expect(isReadyForDelivery({ ...issue, pull_request: {} })).toBe(false);
    expect(
      isReadyForDelivery({
        ...issue,
        labels: [...issue.labels, { name: "duplicate" }],
      }),
    ).toBe(false);
    expect(
      isReadyForDelivery({
        ...issue,
        labels: [{ name: "content:processed" }, { name: "ai:building" }],
      }),
    ).toBe(false);
  });

  it("reads every page of Issue comments", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const page = Number(new URL(String(input)).searchParams.get("page"));
      const comments =
        page === 1
          ? Array.from({ length: 100 }, (_, id) => ({ id }))
          : [{ id: 100 }];
      return new Response(JSON.stringify(comments));
    });
    vi.stubGlobal("fetch", fetchMock);

    const comments = await listAll(
      "liuzhuang/signalpatch",
      "token",
      "issues/27/comments",
    );

    expect(comments).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
