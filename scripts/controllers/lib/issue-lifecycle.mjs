// 【做什么】统一 Feedback/Codex/Manual Issue 的 raw → processed 生命周期与精确去重
// 【说明】库模块，无 CLI 入口；外部写操作只由受信任 Controller 或已认证 gh 入口调用
import { createHash } from "node:crypto";

import { requestJson } from "./http.mjs";

const labelDefinitions = [
  {
    name: "content:raw",
    color: "D876E3",
    description:
      "Original intake content awaiting or unable to complete qualification",
  },
  {
    name: "content:processed",
    color: "0E8A16",
    description: "Qualified SignalPatch Issue Contract",
  },
  {
    name: "duplicate",
    color: "CFD3D7",
    description: "This issue or pull request already exists",
  },
  {
    name: "source:manual",
    color: "1D76DB",
    description: "Qualified from a manually created GitHub Issue",
  },
];

const processedAutomationLabels = new Set([
  "ai:ready",
  "ai:building",
  "ai:verifying",
  "ai:repairing",
  "ai:observing",
  "ai:human-required",
  "ai:done",
]);

const manualContractStart = "<!-- signalpatch-manual-contract:start -->";
const manualContractEnd = "<!-- signalpatch-manual-contract:end -->";
const manualContextPattern =
  /<!-- signalpatch-manual-context:([0-9a-f]{64}) -->/i;

function headers(token) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-github-api-version": "2022-11-28",
  };
}

function normalize(value) {
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function labelNames(issue) {
  return (issue.labels ?? []).map((label) =>
    typeof label === "string" ? label : label.name,
  );
}

export function isTrustedIssueAuthor(issue, trustedBotLogin) {
  return (
    ["OWNER", "MEMBER", "COLLABORATOR"].includes(issue.author_association) ||
    (Boolean(trustedBotLogin) &&
      issue.user?.type === "Bot" &&
      issue.user?.login === trustedBotLogin)
  );
}

export function issueContextFrom(issue, comments) {
  return {
    title: issue.title ?? "",
    message: issue.body ?? "",
    comments: comments
      .filter((comment) => comment.user?.type !== "Bot")
      .map((comment) => ({
        body: comment.body ?? "",
        createdAt: comment.created_at,
      })),
  };
}

export function issueContextFingerprint(issue, comments) {
  return createHash("sha256")
    .update(JSON.stringify(issueContextFrom(issue, comments)))
    .digest("hex");
}

export function stripManualContract(body = "") {
  const start = body.indexOf(manualContractStart);
  if (start === -1) return body.trim();
  const end = body.indexOf(manualContractEnd, start);
  if (end === -1) return body.trim();
  return `${body.slice(0, start)}${body.slice(end + manualContractEnd.length)}`.trim();
}

export function manualIssueContextFingerprint(issue, comments) {
  return issueContextFingerprint(issue, comments);
}

export function manualIssueContextFrom(issue, comments) {
  return issueContextFrom(issue, comments);
}

export function manualContractBody(body, contractBody, contextFingerprint) {
  return [
    stripManualContract(body).trim(),
    manualContractStart,
    `<!-- signalpatch-manual-context:${contextFingerprint} -->`,
    contractBody,
    manualContractEnd,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function manualContextFingerprintFromBody(body = "") {
  return body.match(manualContextPattern)?.[1]?.toLowerCase() ?? null;
}

export function manualContractComment(comments, trustedBotLogin) {
  return (
    comments
      .filter(
        (comment) =>
          comment.user?.type === "Bot" &&
          (!trustedBotLogin || comment.user.login === trustedBotLogin) &&
          comment.body?.includes(manualContractStart) &&
          comment.body?.includes(manualContractEnd),
      )
      .sort((left, right) => left.id - right.id)
      .at(-1) ?? null
  );
}

export function issueContractText(issue, comments, trustedBotLogin) {
  const labels = labelNames(issue);
  const source = labels.includes("source:manual")
    ? manualContractComment(comments, trustedBotLogin)?.body
    : isTrustedIssueAuthor(issue, trustedBotLogin)
      ? issue.body
      : null;
  const match = source?.match(
    /<!-- signalpatch-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- signalpatch-contract:end -->/,
  );
  return match?.[1]?.trim() ?? null;
}

export function issueContractDigest(contractText) {
  return createHash("sha256").update(`${contractText}\n`).digest("hex");
}

function isProcessed(issue) {
  const labels = labelNames(issue);
  return (
    labels.includes("content:processed") ||
    labels.some((label) => processedAutomationLabels.has(label))
  );
}

function isLifecycleIssue(issue) {
  const labels = labelNames(issue);
  return (
    isProcessed(issue) ||
    labels.includes("content:raw") ||
    labels.includes("duplicate")
  );
}

function isManualIssueIdentity(issue) {
  if (
    !issue ||
    issue.state !== "open" ||
    issue.pull_request ||
    issue.user?.type === "Bot"
  ) {
    return false;
  }
  const body = issue.body ?? "";
  return (
    !body.includes("<!-- signalpatch-feedback:") &&
    !body.includes("<!-- signalpatch-conversation-request:")
  );
}

export function isManualIssueCandidate(
  issue,
  comments = [],
  trustedBotLogin = "",
) {
  if (!isManualIssueIdentity(issue)) return false;
  const labels = labelNames(issue);
  const body = issue.body ?? "";
  const raw =
    labels.includes("content:raw") &&
    !isProcessed(issue) &&
    !labels.includes("duplicate") &&
    !body.includes("<!-- signalpatch-contract:start -->");
  const unclassified =
    !labels.includes("content:raw") &&
    !isProcessed(issue) &&
    !labels.includes("duplicate") &&
    !body.includes("<!-- signalpatch-contract:start -->");
  const storedFingerprint = trustedBotLogin
    ? manualContextFingerprintFromBody(
        manualContractComment(comments, trustedBotLogin)?.body ?? "",
      )
    : null;
  const staleReady =
    labels.includes("source:manual") &&
    labels.includes("content:processed") &&
    labels.includes("ai:ready") &&
    !labels.includes("duplicate") &&
    storedFingerprint !== null &&
    storedFingerprint !== manualIssueContextFingerprint(issue, comments);
  return unclassified || raw || staleReady;
}

export function isCurrentManualRevision(issue, comments, trustedBotLogin) {
  const storedFingerprint = manualContextFingerprintFromBody(
    manualContractComment(comments, trustedBotLogin)?.body ?? "",
  );
  return (
    storedFingerprint !== null &&
    storedFingerprint === manualIssueContextFingerprint(issue, comments)
  );
}

export function isReadyForDelivery(issue) {
  if (!issue || issue.state !== "open" || issue.pull_request) return false;
  const labels = labelNames(issue);
  return (
    labels.includes("content:processed") &&
    labels.includes("ai:ready") &&
    !labels.includes("duplicate")
  );
}

export const issueLabels = {
  raw: (...extra) => ["content:raw", ...extra],
  processed: (contract) => [
    "content:processed",
    "ai:ready",
    `risk:${contract.riskLevel.toLowerCase()}`,
  ],
};

export function problemFingerprint(contract) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        [
          contract.problemSummary,
          contract.actualBehavior,
          contract.expectedBehavior,
        ].map(normalize),
      ),
    )
    .digest("hex");
}

export function contractIssueTitle(contract) {
  return `[SignalPatch] ${contract.problemSummary}`;
}

export function contractIssueBody(contract, idempotencyMarker) {
  return [
    `## Problem\n\n${contract.problemSummary}`,
    `## Actual behavior\n\n${contract.actualBehavior}`,
    `## Expected behavior\n\n${contract.expectedBehavior}`,
    "<!-- signalpatch-contract:start -->",
    "```json",
    JSON.stringify(contract, null, 2),
    "```",
    "<!-- signalpatch-contract:end -->",
    `<!-- signalpatch-problem:${problemFingerprint(contract)} -->`,
    `<!-- ${idempotencyMarker} -->`,
    "_This Issue contains redacted evidence only. Raw conversations are not included._",
  ].join("\n\n");
}

function issueProblemFingerprint(
  issue,
  trustedBotLogin,
  commentsByIssue = new Map(),
) {
  const contractText = issueContractText(
    issue,
    commentsByIssue.get(issue.number) ?? [],
    trustedBotLogin,
  );
  if (!contractText) return null;
  try {
    return problemFingerprint(JSON.parse(contractText));
  } catch {
    return null;
  }
}

function isQualifiedRawIssue(issue, trustedBotLogin) {
  const labels = labelNames(issue);
  const body = issue.body ?? "";
  return (
    issue.state === "open" &&
    isTrustedIssueAuthor(issue, trustedBotLogin) &&
    labels.includes("content:raw") &&
    !labels.includes("duplicate") &&
    body.includes("<!-- signalpatch-contract:start -->") &&
    (body.includes("<!-- signalpatch-feedback:") ||
      body.includes("<!-- signalpatch-conversation-request:"))
  );
}

function contractFromIssue(issue) {
  const match = issue.body?.match(
    /<!-- signalpatch-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- signalpatch-contract:end -->/,
  );
  if (!match) throw new Error(`Issue #${issue.number} has no valid Contract`);
  return JSON.parse(match[1]);
}

export function findDuplicateIssue(
  issues,
  contract,
  currentIssueNumber,
  trustedBotLogin,
  commentsByIssue = new Map(),
) {
  const fingerprint = problemFingerprint(contract);
  const equivalent = issues.filter(
    (issue) =>
      !issue.pull_request &&
      issue.number !== currentIssueNumber &&
      issueProblemFingerprint(issue, trustedBotLogin, commentsByIssue) ===
        fingerprint,
  );
  const processed = equivalent
    .filter(isProcessed)
    .sort((left, right) => left.number - right.number)[0];
  if (processed) return processed;
  return (
    equivalent
      .filter(
        (issue) =>
          issue.number < currentIssueNumber &&
          isQualifiedRawIssue(issue, trustedBotLogin),
      )
      .sort((left, right) => left.number - right.number)[0] ?? null
  );
}

export function findMarkedIssue(issues, marker, trustedBotLogin) {
  return (
    issues.find(
      (issue) =>
        !issue.pull_request &&
        isTrustedIssueAuthor(issue, trustedBotLogin) &&
        isLifecycleIssue(issue) &&
        issue.body?.includes(marker),
    ) ?? null
  );
}

export async function listAll(repository, token, resource) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const url = new URL(
      `https://api.github.com/repos/${repository}/${resource}`,
    );
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    if (resource === "issues") url.searchParams.set("state", "all");
    const batch = await requestJson(url, { headers: headers(token) });
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

export async function ensureIssueLifecycleLabels(repository, token) {
  const existing = new Set(
    (await listAll(repository, token, "labels")).map((label) => label.name),
  );
  for (const label of labelDefinitions) {
    if (existing.has(label.name)) continue;
    await requestJson(`https://api.github.com/repos/${repository}/labels`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(label),
    });
  }
}

export async function findIssueByMarker(
  repository,
  token,
  marker,
  trustedBotLogin,
) {
  return findMarkedIssue(
    await listAll(repository, token, "issues"),
    marker,
    trustedBotLogin,
  );
}

export async function updateIssue({
  repository,
  token,
  issueNumber,
  body,
  labels,
}) {
  const payload = {};
  if (body !== undefined) payload.body = body;
  if (labels !== undefined) payload.labels = labels;
  return requestJson(
    `https://api.github.com/repos/${repository}/issues/${issueNumber}`,
    {
      method: "PATCH",
      headers: headers(token),
      body: JSON.stringify(payload),
    },
  );
}

export async function promoteManualIssue({
  repository,
  token,
  issueNumber,
  expectedContextFingerprint,
  contractBody,
  addLabels,
  trustedBotLogin,
}) {
  await ensureIssueLifecycleLabels(repository, token);
  const url = `https://api.github.com/repos/${repository}/issues/${issueNumber}`;
  let issue = await requestJson(url, { headers: headers(token) });
  let comments = await listAll(
    repository,
    token,
    `issues/${issueNumber}/comments`,
  );
  if (!isManualIssueCandidate(issue, comments, trustedBotLogin)) {
    return { status: "ineligible" };
  }
  if (
    manualIssueContextFingerprint(issue, comments) !==
    expectedContextFingerprint
  ) {
    return { status: "stale" };
  }

  const startingLabels = labelNames(issue);
  if (
    startingLabels.includes("content:processed") &&
    startingLabels.includes("ai:ready")
  ) {
    const rawLabels = new Set(startingLabels);
    rawLabels.add("content:raw");
    for (const label of [
      "content:processed",
      "ai:ready",
      "ai:needs-input",
      "risk:r0",
      "risk:r1",
      "risk:r2",
      "risk:r3",
    ]) {
      rawLabels.delete(label);
    }
    issue = await updateIssue({
      repository,
      token,
      issueNumber,
      labels: [...rawLabels],
    });
    comments = await listAll(
      repository,
      token,
      `issues/${issueNumber}/comments`,
    );
    if (
      !isManualIssueCandidate(issue, comments, trustedBotLogin) ||
      manualIssueContextFingerprint(issue, comments) !==
        expectedContextFingerprint
    ) {
      return { status: "stale" };
    }
  }

  const processedLabels = new Set(labelNames(issue));
  for (const label of [
    "content:raw",
    "ai:needs-input",
    "ai:building",
    "ai:verifying",
    "ai:repairing",
    "ai:human-required",
    "ai:done",
    "risk:r0",
    "risk:r1",
    "risk:r2",
    "risk:r3",
  ]) {
    processedLabels.delete(label);
  }
  for (const label of addLabels) processedLabels.add(label);
  processedLabels.add("source:manual");

  const trustedComment = manualContractComment(comments, trustedBotLogin);
  const commentBody = manualContractBody(
    "",
    contractBody,
    expectedContextFingerprint,
  );
  const contractComment = await requestJson(
    trustedComment
      ? `https://api.github.com/repos/${repository}/issues/comments/${trustedComment.id}`
      : `https://api.github.com/repos/${repository}/issues/${issueNumber}/comments`,
    {
      method: trustedComment ? "PATCH" : "POST",
      headers: headers(token),
      body: JSON.stringify({ body: commentBody }),
    },
  );
  if (
    contractComment.user?.type !== "Bot" ||
    contractComment.user?.login !== trustedBotLogin
  ) {
    throw new Error(
      "Manual Contract comment was not written by the trusted App Bot",
    );
  }

  const processed = await updateIssue({
    repository,
    token,
    issueNumber,
    labels: [...processedLabels],
  });

  ////////////////////////////////////////////////////
  // GitHub 不支持对 PATCH Issue 使用 If-Match。晋升后重新读取评论；若评论恰好在
  // 最后一次读取与 PATCH 之间变化，就撤销 Contract 并恢复 raw，交给事件队列重跑。
  ////////////////////////////////////////////////////
  const latestIssue = await requestJson(url, { headers: headers(token) });
  const latestComments = await listAll(
    repository,
    token,
    `issues/${issueNumber}/comments`,
  );
  if (
    manualIssueContextFingerprint(latestIssue, latestComments) !==
      expectedContextFingerprint ||
    !isCurrentManualRevision(latestIssue, latestComments, trustedBotLogin)
  ) {
    const latestLabels = new Set(labelNames(latestIssue));
    latestLabels.add("content:raw");
    for (const label of [
      "content:processed",
      "ai:ready",
      "ai:building",
      "ai:verifying",
      "ai:repairing",
      "ai:human-required",
      "ai:done",
      "risk:r0",
      "risk:r1",
      "risk:r2",
      "risk:r3",
    ]) {
      latestLabels.delete(label);
    }
    await updateIssue({
      repository,
      token,
      issueNumber,
      labels: [...latestLabels],
    });
    return { status: "stale" };
  }

  return { status: "published", issue: processed };
}

async function restoreManualRaw(repository, token, issue) {
  const labels = new Set(labelNames(issue));
  labels.add("content:raw");
  labels.add("source:manual");
  for (const label of [
    "content:processed",
    "ai:ready",
    "ai:building",
    "ai:verifying",
    "ai:repairing",
    "ai:human-required",
    "ai:done",
    "risk:r0",
    "risk:r1",
    "risk:r2",
    "risk:r3",
  ]) {
    labels.delete(label);
  }
  return updateIssue({
    repository,
    token,
    issueNumber: issue.number,
    labels: [...labels],
  });
}

export async function claimIssueForDelivery({
  repository,
  token,
  issueNumber,
  expectedContractDigest,
  trustedBotLogin,
}) {
  const url = `https://api.github.com/repos/${repository}/issues/${issueNumber}`;
  let issue = await requestJson(url, { headers: headers(token) });
  if (!isReadyForDelivery(issue)) {
    return { started: false, reason: "not-ready" };
  }

  const isManual = labelNames(issue).includes("source:manual");
  let comments = isManual
    ? await listAll(repository, token, `issues/${issueNumber}/comments`)
    : [];
  const contractText = issueContractText(issue, comments, trustedBotLogin);
  if (
    !contractText ||
    issueContractDigest(contractText) !== expectedContractDigest
  ) {
    return { started: false, reason: "contract-changed" };
  }
  if (isManual && !isCurrentManualRevision(issue, comments, trustedBotLogin)) {
    await restoreManualRaw(repository, token, issue);
    return { started: false, reason: "context-changed" };
  }

  const buildingLabels = new Set(labelNames(issue));
  buildingLabels.add("ai:building");
  for (const label of [
    "ai:ready",
    "ai:verifying",
    "ai:repairing",
    "ai:human-required",
  ]) {
    buildingLabels.delete(label);
  }
  issue = await updateIssue({
    repository,
    token,
    issueNumber,
    labels: [...buildingLabels],
  });

  const latestIssue = await requestJson(url, { headers: headers(token) });
  comments = isManual
    ? await listAll(repository, token, `issues/${issueNumber}/comments`)
    : [];
  const latestText = issueContractText(latestIssue, comments, trustedBotLogin);
  const digestMatches =
    latestText && issueContractDigest(latestText) === expectedContractDigest;
  const revisionMatches =
    !isManual ||
    isCurrentManualRevision(latestIssue, comments, trustedBotLogin);
  if (!digestMatches || !revisionMatches) {
    if (isManual && !revisionMatches) {
      await restoreManualRaw(repository, token, latestIssue);
    } else {
      const readyLabels = new Set(labelNames(latestIssue));
      readyLabels.add("ai:ready");
      readyLabels.delete("ai:building");
      await updateIssue({
        repository,
        token,
        issueNumber,
        labels: [...readyLabels],
      });
    }
    return {
      started: false,
      reason: digestMatches ? "context-changed" : "contract-changed",
    };
  }

  return { started: true, reason: "claimed", issue };
}

export async function ensureIssueComment({
  repository,
  token,
  issueNumber,
  marker,
  body,
  trustedBotLogin,
}) {
  const comments = await listAll(
    repository,
    token,
    `issues/${issueNumber}/comments`,
  );
  if (
    comments.some(
      (comment) =>
        comment.user?.type === "Bot" &&
        comment.user?.login === trustedBotLogin &&
        comment.body?.includes(marker),
    )
  ) {
    return;
  }

  const comment = await requestJson(
    `https://api.github.com/repos/${repository}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ body: `${body}\n\n<!-- ${marker} -->` }),
    },
  );
  if (comment.user?.type !== "Bot" || comment.user?.login !== trustedBotLogin) {
    throw new Error("Issue comment was not written by the trusted App Bot");
  }
}

async function createIssue(repository, token, title, body, labels) {
  return requestJson(`https://api.github.com/repos/${repository}/issues`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ title, body, labels }),
  });
}

export async function publishRawIssue({
  repository,
  token,
  title,
  body,
  marker,
  labels = issueLabels.raw(),
  trustedBotLogin,
}) {
  await ensureIssueLifecycleLabels(repository, token);
  const existing = await findIssueByMarker(
    repository,
    token,
    marker,
    trustedBotLogin,
  );
  if (!existing) return createIssue(repository, token, title, body, labels);
  const existingLabels = labelNames(existing);
  if (
    existing.state !== "open" ||
    !existingLabels.includes("content:raw") ||
    existingLabels.includes("duplicate") ||
    isProcessed(existing)
  ) {
    return existing;
  }
  return requestJson(
    `https://api.github.com/repos/${repository}/issues/${existing.number}`,
    {
      method: "PATCH",
      headers: headers(token),
      body: JSON.stringify({ title, body, labels }),
    },
  );
}

export async function publishContractIssue({
  repository,
  token,
  contract,
  idempotencyMarker,
  trustedBotLogin,
}) {
  const issue = await publishRawIssue({
    repository,
    token,
    title: contractIssueTitle(contract),
    body: contractIssueBody(contract, idempotencyMarker),
    marker: idempotencyMarker,
    trustedBotLogin,
  });
  if (isProcessed(issue)) {
    return { issue, duplicate: null };
  }
  const reusedDuplicate =
    labelNames(issue).includes("duplicate") || issue.state === "closed";
  const duplicate = findDuplicateIssue(
    await listAll(repository, token, "issues"),
    contract,
    issue.number,
    trustedBotLogin,
  );
  if (reusedDuplicate) return { issue, duplicate };

  if (duplicate) {
    let canonical = duplicate;
    if (!isProcessed(canonical)) {
      canonical = await requestJson(
        `https://api.github.com/repos/${repository}/issues/${canonical.number}`,
        {
          method: "PATCH",
          headers: headers(token),
          body: JSON.stringify({
            labels: issueLabels.processed(contractFromIssue(canonical)),
          }),
        },
      );
    }
    await requestJson(
      `https://api.github.com/repos/${repository}/issues/${issue.number}/comments`,
      {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({
          body: `Duplicate of #${canonical.number}. The existing processed Issue remains the canonical record.`,
        }),
      },
    );
    const closed = await requestJson(
      `https://api.github.com/repos/${repository}/issues/${issue.number}`,
      {
        method: "PATCH",
        headers: headers(token),
        body: JSON.stringify({
          state: "closed",
          state_reason: "not_planned",
          labels: issueLabels.raw("duplicate"),
        }),
      },
    );
    return { issue: closed, duplicate: canonical };
  }

  const processed = await requestJson(
    `https://api.github.com/repos/${repository}/issues/${issue.number}`,
    {
      method: "PATCH",
      headers: headers(token),
      body: JSON.stringify({ labels: issueLabels.processed(contract) }),
    },
  );
  return { issue: processed, duplicate: null };
}
