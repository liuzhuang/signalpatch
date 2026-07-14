// 【做什么】统一 Feedback/Codex Issue 的 raw → processed 生命周期与精确去重
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
  return issue.labels.map((label) =>
    typeof label === "string" ? label : label.name,
  );
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

function issueProblemFingerprint(issue) {
  const marker = issue.body?.match(/signalpatch-problem:([0-9a-f]{64})/i);
  if (marker) return marker[1].toLowerCase();

  const legacyContract = issue.body?.match(
    /<!-- signalpatch-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- signalpatch-contract:end -->/,
  );
  if (!legacyContract) return null;
  try {
    return problemFingerprint(JSON.parse(legacyContract[1]));
  } catch {
    return null;
  }
}

export function findDuplicateIssue(issues, contract, currentIssueNumber) {
  const fingerprint = problemFingerprint(contract);
  return (
    issues
      .filter(
        (issue) =>
          !issue.pull_request &&
          issue.number !== currentIssueNumber &&
          isProcessed(issue) &&
          issueProblemFingerprint(issue) === fingerprint,
      )
      .sort((left, right) => left.number - right.number)[0] ?? null
  );
}

export function findMarkedIssue(issues, marker) {
  return (
    issues.find(
      (issue) =>
        !issue.pull_request &&
        isLifecycleIssue(issue) &&
        issue.body?.includes(marker),
    ) ?? null
  );
}

async function listAll(repository, token, resource) {
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

export async function findIssueByMarker(repository, token, marker) {
  return findMarkedIssue(await listAll(repository, token, "issues"), marker);
}

export async function updateIssue({
  repository,
  token,
  issueNumber,
  body,
  labels,
}) {
  return requestJson(
    `https://api.github.com/repos/${repository}/issues/${issueNumber}`,
    {
      method: "PATCH",
      headers: headers(token),
      body: JSON.stringify({ body, labels }),
    },
  );
}

export async function ensureIssueComment({
  repository,
  token,
  issueNumber,
  marker,
  body,
}) {
  const comments = await listAll(
    repository,
    token,
    `issues/${issueNumber}/comments`,
  );
  if (comments.some((comment) => comment.body?.includes(marker))) return;

  await requestJson(
    `https://api.github.com/repos/${repository}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ body: `${body}\n\n<!-- ${marker} -->` }),
    },
  );
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
}) {
  await ensureIssueLifecycleLabels(repository, token);
  return (
    (await findIssueByMarker(repository, token, marker)) ??
    createIssue(repository, token, title, body, labels)
  );
}

export async function publishContractIssue({
  repository,
  token,
  contract,
  idempotencyMarker,
}) {
  const issue = await publishRawIssue({
    repository,
    token,
    title: contractIssueTitle(contract),
    body: contractIssueBody(contract, idempotencyMarker),
    marker: idempotencyMarker,
  });
  const duplicate = findDuplicateIssue(
    await listAll(repository, token, "issues"),
    contract,
    issue.number,
  );

  if (duplicate) {
    await requestJson(
      `https://api.github.com/repos/${repository}/issues/${issue.number}/comments`,
      {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({
          body: `Duplicate of #${duplicate.number}. The existing processed Issue remains the canonical record.`,
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
    return { issue: closed, duplicate };
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
