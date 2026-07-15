#!/usr/bin/env node
// 【做什么】把 Manual Issue Intake 结果写回原 Issue；不创建新 Issue
// 【何时跑】manual-issue-intake.yml publish Job
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { requestJson, requireEnvironment } from "./lib/http.mjs";
import {
  contractIssueBody,
  ensureIssueComment,
  isManualIssueCandidate,
  issueLabels,
  listAll,
  manualIssueContextFingerprint,
  promoteManualIssue,
  updateIssue,
} from "./lib/issue-lifecycle.mjs";
import { loadPolicy, requiredRisk } from "../ai/lib/policy.mjs";

const [resultPath, statePath] = process.argv.slice(2);
if (!resultPath || !statePath) {
  throw new Error(
    "Usage: manual-issue-intake-publish.mjs <result.json> <state.json>",
  );
}
const { GH_TOKEN, GITHUB_REPOSITORY, SIGNALPATCH_APP_BOT } = requireEnvironment(
  ["GH_TOKEN", "GITHUB_REPOSITORY", "SIGNALPATCH_APP_BOT"],
);
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
const comments = await listAll(
  GITHUB_REPOSITORY,
  GH_TOKEN,
  `issues/${state.issueNumber}/comments`,
);
if (!isManualIssueCandidate(issue, comments, SIGNALPATCH_APP_BOT)) {
  process.stdout.write(
    `Issue #${state.issueNumber} is no longer eligible for Manual Intake; skipped.\n`,
  );
  process.exit(0);
}
if (
  manualIssueContextFingerprint(issue, comments) !== state.contextFingerprint
) {
  process.stdout.write(
    `Issue #${state.issueNumber} changed during Intake; skipped stale result.\n`,
  );
  process.exit(0);
}

if (result.status === "NEEDS_EVIDENCE") {
  const missing = result.missingEvidence;
  const marker = `signalpatch-manual-needs-evidence:${createHash("sha256")
    .update(JSON.stringify([missing, state.contextFingerprint]))
    .digest("hex")
    .slice(0, 16)}`;
  await updateIssue({
    repository: GITHUB_REPOSITORY,
    token: GH_TOKEN,
    issueNumber: state.issueNumber,
    labels: transitionLabels(
      currentLabels,
      ["content:raw", "ai:needs-input"],
      [
        "content:processed",
        "ai:ready",
        "risk:r0",
        "risk:r1",
        "risk:r2",
        "risk:r3",
      ],
    ),
  });
  await ensureIssueComment({
    repository: GITHUB_REPOSITORY,
    token: GH_TOKEN,
    issueNumber: state.issueNumber,
    marker,
    trustedBotLogin: SIGNALPATCH_APP_BOT,
    body: [
      "## 需要补充上下文",
      "当前信息不足，暂时无法生成可执行的开发任务。",
      `原因：${result.reason}`,
      "请在此 Issue 下补充：",
      ...missing.map((item) => `- ${item}`),
      "补充评论或修改 Issue 正文后，系统会重新评估这个 Issue。",
      `<!-- signalpatch-manual-needs-context:${state.contextFingerprint} -->`,
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
const processedLabels = issueLabels.processed(contract);
const publication = await promoteManualIssue({
  repository: GITHUB_REPOSITORY,
  token: GH_TOKEN,
  issueNumber: state.issueNumber,
  expectedContextFingerprint: state.contextFingerprint,
  contractBody: contractIssueBody(
    contract,
    `signalpatch-manual-issue:${state.issueNumber}`,
  ),
  addLabels: processedLabels,
  trustedBotLogin: SIGNALPATCH_APP_BOT,
});
if (publication.status !== "published") {
  process.stdout.write(
    `Issue #${state.issueNumber} changed during the final Intake transition; restored as raw.\n`,
  );
  process.exit(0);
}
process.stdout.write(
  `${JSON.stringify({
    issueNumber: state.issueNumber,
    status: result.status,
    riskLevel: contract.riskLevel,
  })}\n`,
);
