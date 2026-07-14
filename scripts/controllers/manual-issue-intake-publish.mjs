#!/usr/bin/env node
// 【做什么】把 Manual Issue Intake 结果写回原 Issue；不创建新 Issue
// 【何时跑】manual-issue-intake.yml publish Job
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";
import {
  contractIssueBody,
  ensureIssueComment,
  issueLabels,
  updateIssue,
} from "./lib/issue-lifecycle.mjs";
import { loadPolicy, requiredRisk } from "../ai/lib/policy.mjs";

const [resultPath, statePath] = process.argv.slice(2);
if (!resultPath || !statePath) {
  throw new Error(
    "Usage: manual-issue-intake-publish.mjs <result.json> <state.json>",
  );
}
const { GH_TOKEN, GITHUB_REPOSITORY } = requireEnvironment([
  "GH_TOKEN",
  "GITHUB_REPOSITORY",
]);
const { result } = JSON.parse(await readFile(resultPath, "utf8"));
const state = JSON.parse(await readFile(statePath, "utf8"));
const issueUrl = `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${state.issueNumber}`;
const headers = {
  accept: "application/vnd.github+json",
  authorization: `Bearer ${GH_TOKEN}`,
  "x-github-api-version": "2022-11-28",
};

function labelsOf(issue) {
  return issue.labels.map((label) =>
    typeof label === "string" ? label : label.name,
  );
}

function transitionLabels(current, add, remove) {
  const labels = new Set(current);
  for (const label of remove) labels.delete(label);
  for (const label of add) labels.add(label);
  return [...labels];
}

const issue = await requestJson(issueUrl, { headers });
const currentLabels = labelsOf(issue);
if (!currentLabels.includes("content:raw")) {
  process.stdout.write(
    `Issue #${state.issueNumber} is no longer raw; skipped.\n`,
  );
  process.exit(0);
}

if (result.status === "NEEDS_EVIDENCE") {
  const missing = result.missingEvidence;
  const marker = `signalpatch-manual-needs-evidence:${createHash("sha256")
    .update(JSON.stringify(missing))
    .digest("hex")
    .slice(0, 16)}`;
  await updateIssue({
    repository: GITHUB_REPOSITORY,
    token: GH_TOKEN,
    issueNumber: state.issueNumber,
    body: issue.body ?? "",
    labels: transitionLabels(currentLabels, ["ai:needs-input"], ["ai:ready"]),
  });
  await ensureIssueComment({
    repository: GITHUB_REPOSITORY,
    token: GH_TOKEN,
    issueNumber: state.issueNumber,
    marker,
    body: [
      "## 需要补充上下文",
      "当前信息不足，暂时无法生成可执行的开发任务。",
      `原因：${result.reason}`,
      "请在此 Issue 下补充：",
      ...missing.map((item) => `- ${item}`),
      "补充后，定时器会重新评估这个 Issue。",
    ].join("\n"),
  });
  process.stdout.write(
    `${JSON.stringify({ issueNumber: state.issueNumber, status: result.status })}\n`,
  );
  process.exit(0);
}

if (result.status !== "SPEC_READY") {
  throw new Error(`Unsupported Intake status: ${result.status}`);
}

const contract = result.contract;
if (
  contract.source.kind !== "manual-issue" ||
  contract.source.references.length !== 1 ||
  contract.source.references[0] !== state.reference
) {
  throw new Error("Manual Issue Contract source does not match the Issue");
}
const policy = await loadPolicy();
contract.riskLevel = requiredRisk(
  policy,
  contract.allowedPaths,
  contract.riskLevel,
);
const body = [
  issue.body?.trim(),
  contractIssueBody(contract, `signalpatch-manual-issue:${state.issueNumber}`),
]
  .filter(Boolean)
  .join("\n\n");
const processedLabels = issueLabels.processed(contract);
await updateIssue({
  repository: GITHUB_REPOSITORY,
  token: GH_TOKEN,
  issueNumber: state.issueNumber,
  body,
  labels: transitionLabels(currentLabels, processedLabels, [
    "content:raw",
    "ai:needs-input",
    "ai:building",
    "ai:verifying",
    "ai:repairing",
    "ai:human-required",
    "ai:done",
  ]),
});
process.stdout.write(
  `${JSON.stringify({
    issueNumber: state.issueNumber,
    status: result.status,
    riskLevel: contract.riskLevel,
  })}\n`,
);
